import SwiftUI

/// Consumption of the drivemode-mcp writer: poll `/rpc events_since`,
/// map typed events into app state. Offline → seeded demo world; live →
/// the wire is the truth for tasks, artifacts, beats, agents, interrupts.
enum WireStatus: Equatable {
    case offline
    case live(latestSeq: Int, events: Int)

    var isLive: Bool { if case .live = self { return true }; return false }
    var label: String {
        switch self {
        case .offline: return "Offline · demo data"
        case .live(let seq, let events): return "Live · seq \(seq) · \(events) events"
        }
    }
}

/// A room participant as the wire reported it (control.join).
struct WireParticipant {
    let id: String
    let kind: String        // "human" | "agent"
    let displayName: String
    let role: String
    let joinedAt: Date
}

/// Client-side reduction of the log-carried session lifecycle. This is not a
/// second source of truth: it is rebuilt from control.session_* events.
struct WireSessionRecord {
    let id: String
    var organizerId: String
    var title: String
    var project: String
    var participantIds: [String]
    var agendaTaskIds: [String]
    var note: String
    var createdAt: Date
    var scheduledAt: Date?
    var startedAt: Date?
    var endedAt: Date?
    var programId: String?
    var replayArtifactId: String?
}

// MARK: - Wire schema (Codable — no dictionary spelunking on the hot path)

private struct WireEnvelope: Decodable {
    let result: WireResult
}

private struct WireResult: Decodable {
    let latestSeq: Int
    let events: [WireEntry]
}

private struct WireEntry: Decodable {
    let event: WireEvent
}

private struct WireMutationEnvelope: Decodable {
    let ok: Bool
    let result: WireMutationResult?
    let error: String?
}

private struct WireMutationResult: Decodable {
    let event: WireEvent?
}

private enum WireMutationFailure: Error {
    case rejected(String)
    case missingEvent
}

private struct WireEventParticipant: Decodable {
    let id: String
    let kind: String?
    let displayName: String?
    let role: String?
}

private struct WireLife: Decodable {
    let permanent: Bool?
    let ttlDays: Int?
}

private struct WireAgentTitleScope: Decodable {
    let kind: String
    let ref: String
}

private struct WireAgentTitleGrant: Decodable {
    let id: String
    let agentId: String
    let title: String
    let scope: WireAgentTitleScope
    let skillBundleRefs: [String]
    let resourceGrantRefs: [String]
    let delegatedAgentIds: [String]
    let permissions: [String]
    let grantedAt: String
    let expiresAt: String
    let revokedAt: String?
}

/// One optional-field payload covers every pack kind we consume — decoded
/// once, typed, no `as? [String: Any]` casts.
private struct WirePayload: Decodable {
    // work.task.*
    let taskId: String?
    let project: String?
    let state: String?
    let deps: [String]?
    let progress: Double?
    // work.artifact.*
    let artifactId: String?
    let life: WireLife?
    let repo: String?
    let sizeKb: Int?
    // work.direction.beat
    let programId: String?
    let beatIndex: Int?
    let directorId: String?
    let caption: String?
    let durationSec: Double?
    let relatedEventIds: [String]?
    let steps: [String]?
    let accent: [Int]?
    // shared
    let title: String?
    let kind: String?
    let summary: String?
}

private struct WireEvent: Decodable {
    let id: String?
    let type: String
    let at: String?
    let actorId: String?
    // control.join
    let participant: WireEventParticipant?
    // control.invite
    let inviterId: String?
    let inviteeId: String?
    let sessionId: String?
    let title: String?
    let note: String?
    // control.session_*
    let organizerId: String?
    let project: String?
    let participantIds: [String]?
    let agendaTaskIds: [String]?
    let scheduledFor: String?
    let programId: String?
    let outcome: String?
    let replayArtifactId: String?
    // control.title_*
    let grant: WireAgentTitleGrant?
    let grantId: String?
    let revokedAt: String?
    let reason: String?
    let fromGrantId: String?
    let toGrant: WireAgentTitleGrant?
    let transferredAt: String?
    // work.generic
    let kind: String?
    let payload: WirePayload?
}

extension AppStore {
    private static let agentColors: [String: Color] = [
        "maya": DemoData.maya, "coder": DemoData.coder,
        "scout": DemoData.scout, "indexer": DemoData.indexer,
    ]
    /// Unknown agents still get a stable Cline-bot color.
    private static let fallbackColors: [Color] = [
        Color(hex: 0x7A3FD4), Color(hex: 0x5B8DEF), Color(hex: 0x2DD4BF),
        Color(hex: 0xF472B6), Color(hex: 0xFFC55C),
    ]

    // Long sessions must not grow without bound — the durable log lives in
    // the writer; the app keeps a working set.
    private static let taskCap = 3000
    private static let artifactCap = 800
    private static let beatCap = 64
    private static let eventTitleCap = 4000

    func startWire() {
        guard wireTask == nil else { return }
        wireTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.pollWire()
                let interval = self?.wirePollInterval() ?? 3.0
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func pauseWire() {
        wireTask?.cancel()
        wireTask = nil
        intent.persistNow()
    }

    /// Intent-adaptive cadence: fast in-session, normal on task surfaces,
    /// slow when idle, exponential backoff while the writer is away.
    private func wirePollInterval() -> Double {
        if !wireStatus.isLive {
            wireBackoff = min(30, max(3, wireBackoff * 2))
            return wireBackoff
        }
        wireBackoff = 1.5
        if Date() < intent.burstUntil { return 1.0 }
        if inCall { return 1.0 }
        let surface = intent.current
        if surface == .tasks || surface == .projectMap || surface == .needsYou { return 1.5 }
        if Date().timeIntervalSince(intent.lastRecordAt) > 60 { return 8.0 }
        return 3.0
    }

    private static let decoder = JSONDecoder()

    private func pollWire() async {
        guard let url = URL(string: "\(writerURL)/rpc") else { return }
        var request = URLRequest(url: url, timeoutInterval: 2)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "tool": "events_since",
            "args": ["sinceSeq": wireSeq],
        ])
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let result = try Self.decoder.decode(WireEnvelope.self, from: data).result
            if result.latestSeq < wireSeq {
                // The writer restarted with a fresh log — our strictly-after
                // cursor would never see it. Resync from the top; events are
                // keyed by id, so replays land idempotently.
                wireSeq = -1
                for sessionId in wireReminderScheduled {
                    NotificationManager.shared.cancelSessionReminder(sessionId)
                }
                wireSessions.removeAll()
                wireBeats.removeAll()
                wireBeatRelated.removeAll()
                wireBeatPrograms.removeAll()
                beats = []
                wireUpcomingSessions = []
                wireActiveSession = nil
                wireActiveProgramId = nil
                wireReminderScheduled.removeAll()
                titleGrantsByID.removeAll()
                titleEventLog.removeAll()
                return
            }
            var eventCount = 0
            if case .live(_, let previous) = wireStatus { eventCount = previous }
            for entry in result.events {
                apply(wireEvent: entry.event)
                eventCount += 1
            }
            wireSeq = max(wireSeq, result.latestSeq)
            let next: WireStatus = .live(latestSeq: wireSeq, events: eventCount)
            if wireStatus != next { wireStatus = next }
            if wireDropped { wireDropped = false }
            if !result.events.isEmpty {
                intent.burstUntil = Date().addingTimeInterval(20)
                rebuildFromWire()
            }
        } catch {
            // Guarded: an offline writer must not re-publish the app every poll.
            if wireStatus != .offline {
                wireStatus = .offline
                wireDropped = true   // was live — surface the reconnect chip
            }
        }
    }

    private func apply(wireEvent event: WireEvent) {
        let at = event.at.flatMap(Self.parseIso) ?? Date()

        switch event.type {
        case "control.join":
            guard let p = event.participant else { return }
            wireParticipants[p.id] = WireParticipant(
                id: p.id, kind: p.kind ?? "agent",
                displayName: p.displayName ?? Self.displayName(p.id),
                role: p.role ?? "partner", joinedAt: at)
            return
        case "control.title_granted":
            guard let raw = event.grant,
                  let grant = Self.materializeTitleGrant(raw) else { return }
            applyTitleGrant(grant, eventId: event.id)
            return
        case "control.title_transferred":
            guard let fromGrantId = event.fromGrantId,
                  let raw = event.toGrant,
                  let grant = Self.materializeTitleGrant(raw) else { return }
            applyTitleTransfer(
                fromGrantId: fromGrantId,
                toGrant: grant,
                at: event.transferredAt.flatMap(Self.parseIso) ?? at,
                eventId: event.id)
            return
        case "control.title_revoked":
            guard let grantId = event.grantId else { return }
            applyTitleRevocation(
                grantId: grantId,
                at: event.revokedAt.flatMap(Self.parseIso) ?? at,
                reason: event.reason ?? "revoked",
                eventId: event.id)
            return
        case "control.invite":
            // Invitations ride the control track straight into the inbox.
            // Outgoing events are receipts; only invitations addressed to
            // this person appear as incoming calls to action.
            guard let id = event.id, let inviter = event.inviterId,
                  let invitee = event.inviteeId,
                  !inbox.contains(where: { $0.id == id }) else { return }
            countSkillUse(inviter, .inviting)
            let outgoing = Self.isLocalUser(inviter)
            guard outgoing || Self.isLocalUser(invitee) else { return }
            inbox.insert(InboxItem(
                id: id, kind: .invite,
                title: outgoing
                    ? "You invited \(Self.displayName(invitee)) to a working session"
                    : "\(Self.displayName(inviter)) invited you to a working session",
                body: event.note
                    ?? event.title.map { "\($0) — join when you're ready." }
                    ?? "Join when you're ready.",
                age: Self.relative(at), read: outgoing), at: 0)
            return
        case "control.session_created":
            guard let id = event.sessionId, let organizerId = event.organizerId,
                  let title = event.title, let project = event.project,
                  let participantIds = event.participantIds,
                  let agendaTaskIds = event.agendaTaskIds else { return }
            wireSessions[id] = WireSessionRecord(
                id: id, organizerId: organizerId, title: title, project: project,
                participantIds: participantIds, agendaTaskIds: agendaTaskIds,
                note: event.note ?? "Join when you're ready.", createdAt: at)
            return
        case "control.session_scheduled":
            guard let id = event.sessionId, let raw = event.scheduledFor,
                  let scheduledAt = Self.parseIso(raw), var session = wireSessions[id] else { return }
            session.scheduledAt = scheduledAt
            wireSessions[id] = session
            return
        case "control.session_started":
            guard let id = event.sessionId, let programId = event.programId,
                  var session = wireSessions[id] else { return }
            session.startedAt = at
            session.endedAt = nil
            session.programId = programId
            wireSessions[id] = session
            return
        case "control.session_ended":
            guard let id = event.sessionId, var session = wireSessions[id] else { return }
            session.endedAt = at
            session.replayArtifactId = event.replayArtifactId
            wireSessions[id] = session
            return
        case "work.generic":
            break
        default:
            return
        }

        guard let kind = event.kind, let payload = event.payload else { return }
        let actorId = event.actorId ?? "coder"

        // Every work event feeds the actor's status line and, by id, the
        // stage content of any beat that names it in relatedEventIds.
        if let line = payload.title ?? payload.summary {
            wireActorStatus[actorId] = (line: line, at: at)
            if let eventId = event.id {
                if wireEventTitles[eventId] == nil { wireEventOrder.append(eventId) }
                wireEventTitles[eventId] = payload.summary.map { "\(line) — \($0)" } ?? line
                if wireEventTitles.count > Self.eventTitleCap, let victim = wireEventOrder.first {
                    wireEventOrder.removeFirst()
                    wireEventTitles.removeValue(forKey: victim)
                }
            }
        }

        // Skill usage, observed: which capability did this event exercise?
        switch kind {
        case "work.direction.beat":
            countSkillUse(payload.directorId ?? actorId, .directing)
        case "work.task.created", "work.task.state", "work.task.progress":
            countSkillUse(actorId, .tasks)
        case "work.artifact.created":
            countSkillUse(actorId, .artifacts)
            if payload.kind == "diff" { countSkillUse(actorId, .editing) }
            if payload.kind == "report" { countSkillUse(actorId, .testing) }
        default:
            break
        }

        switch kind {
        case "work.task.created":
            guard let id = payload.taskId, let title = payload.title,
                  let project = payload.project else { return }
            let state = TaskState(rawValue: (payload.state ?? "queued").capitalized) ?? .queued
            if wireTasks[id] == nil { wireTaskOrder.append(id) }
            wireTasks[id] = TaskItem(
                id: id, title: title, room: project,
                agentName: Self.displayName(actorId),
                agentColor: Self.agentColors[actorId] ?? Self.fallbackColor(actorId),
                state: state,
                deps: payload.deps ?? [])
            wireTaskAt[id] = at
            evictTasksIfNeeded()
        case "work.task.progress":
            guard let id = payload.taskId, let progress = payload.progress else { return }
            wireTasks[id]?.progress = progress
            wireTaskAt[id] = at
        case "work.task.state":
            guard let id = payload.taskId, let raw = payload.state else { return }
            wireTasks[id]?.state = TaskState(rawValue: raw.capitalized) ?? .queued
            if let detail = payload.summary { wireTasks[id]?.detail = detail }
            wireTaskAt[id] = at
        case "work.artifact.created":
            guard let id = payload.artifactId, let title = payload.title,
                  let kindRaw = payload.kind,
                  let artifactKind = ArtifactKind(rawValue: kindRaw.capitalized) else { return }
            // TTLs run on a real clock: days left = ttl − age, floored at 0
            // ("filing…"). The log's `at` is the birthday.
            let life: ArtifactLife
            if let ttl = payload.life?.ttlDays {
                let ageDays = Int(Date().timeIntervalSince(at) / 86_400)
                life = .ephemeral(daysLeft: max(0, ttl - ageDays))
            } else {
                life = .permanent
            }
            if wireArtifacts[id] == nil { wireArtifactOrder.append(id) }
            wireArtifacts[id] = Artifact(
                id: id, title: title, kind: artifactKind,
                room: payload.project ?? "Auth middleware",
                repo: payload.repo ?? "drive-mode",
                agentName: Self.displayName(actorId),
                agentColor: Self.agentColors[actorId] ?? Self.fallbackColor(actorId),
                age: Self.relative(at), day: "Today",
                meta: payload.summary ?? artifactKind.rawValue.lowercased(),
                sizeKB: payload.sizeKb ?? 0,
                life: life)
            if wireArtifacts.count > Self.artifactCap, let victim = wireArtifactOrder.first {
                wireArtifactOrder.removeFirst()
                wireArtifacts.removeValue(forKey: victim)
            }
        case "work.direction.beat":
            guard let index = payload.beatIndex, let title = payload.title,
                  let kindRaw = payload.kind else { return }
            let beatKind: BeatKind = [
                "plan": .plan, "diagram": .diagram, "edit": .edit, "run": .command,
                "tests": .test, "decision": .decision, "result": .metric,
            ][kindRaw] ?? .plan
            let directorId = payload.directorId ?? actorId
            let programId = payload.programId ?? "legacy"
            let key = "\(programId)#\(index)"
            wireBeats[key] = Beat(
                id: index, kind: beatKind, title: title,
                director: Self.displayName(directorId),
                directorColor: Self.agentColors[directorId] ?? Self.fallbackColor(directorId),
                caption: payload.caption ?? title,
                duration: payload.durationSec ?? 7,
                steps: payload.steps ?? [],
                accent: payload.accent ?? [])
            wireBeatRelated[key] = payload.relatedEventIds ?? []
            wireBeatPrograms[key] = programId
            if wireBeats.count > Self.beatCap, let victim = wireBeats.keys.min() {
                wireBeats.removeValue(forKey: victim)
                wireBeatRelated.removeValue(forKey: victim)
                wireBeatPrograms.removeValue(forKey: victim)
            }
        default:
            break
        }
    }

    /// A typed session message joins the room's conversation feed via the
    /// writer — fire and forget; offline it stays a local ephemeral bubble.
    func postConversation(_ text: String) {
        guard wireStatus.isLive, let url = URL(string: "\(writerURL)/rpc") else { return }
        var request = URLRequest(url: url, timeoutInterval: 2)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "tool": "conversation_publish",
            "args": ["text": text, "actorId": "harrison"],
        ])
        Task { _ = try? await URLSession.shared.data(for: request) }
    }

    /// Publish the composer's durable registry records, then one real
    /// room_invite per selected participant. Returned log events are reduced
    /// immediately; the next poll replays them idempotently and advances seq.
    func publishSessionPlan(_ session: UpcomingSession, inviteeIds: [String]) async throws {
        guard wireStatus.isLive else {
            throw WireMutationFailure.rejected("writer offline")
        }
        let organizerId = "harrison"
        let participantIds = session.participantIds ?? [organizerId] + inviteeIds
        let agendaTaskIds = session.agendaTaskIds ?? []
        let scheduledAt = session.scheduledAt ?? UpcomingSession.scheduledDate(for: session.when)

        let created = try await performWireMutation(tool: "session_create", args: [
            "sessionId": session.id,
            "organizerId": organizerId,
            "title": session.title,
            "project": session.project,
            "participantIds": Array(Set(participantIds)).sorted(),
            "agendaTaskIds": agendaTaskIds,
            "note": session.note,
        ])
        apply(wireEvent: created)

        let scheduled = try await performWireMutation(tool: "session_schedule", args: [
            "sessionId": session.id,
            "scheduledFor": Self.isoString(scheduledAt),
            "actorId": organizerId,
        ])
        apply(wireEvent: scheduled)

        if session.when == "Now" {
            let started = try await performWireMutation(tool: "session_start", args: [
                "sessionId": session.id,
                "programId": "program-\(session.id)",
                "actorId": organizerId,
            ])
            apply(wireEvent: started)
        }

        for inviteeId in inviteeIds {
            let invitation = try await performWireMutation(tool: "room_invite", args: [
                "inviterId": organizerId,
                "inviteeId": inviteeId,
                "sessionId": session.id,
                "title": session.title,
                "note": session.note,
            ])
            apply(wireEvent: invitation)
        }
        rebuildFromWire()
    }

    func cancelWireSession(_ sessionId: String) async throws {
        let ended = try await performWireMutation(tool: "session_end", args: [
            "sessionId": sessionId,
            "outcome": "cancelled",
            "actorId": "harrison",
        ])
        apply(wireEvent: ended)
        rebuildFromWire()
    }

    func publishPresenterGrant(_ grant: AgentTitleGrant) async throws {
        let event = try await performWireMutation(tool: "title_grant", args: titleGrantArguments(grant))
        apply(wireEvent: event)
    }

    func publishPresenterTransfer(from: AgentTitleGrant, to grant: AgentTitleGrant) async throws {
        var args = titleGrantArguments(grant)
        args.removeValue(forKey: "grantId")
        args.removeValue(forKey: "agentId")
        args.removeValue(forKey: "scopeKind")
        args.removeValue(forKey: "scopeRef")
        args["fromGrantId"] = from.id
        args["toGrantId"] = grant.id
        args["toAgentId"] = grant.agentId
        let event = try await performWireMutation(tool: "title_transfer", args: args)
        apply(wireEvent: event)
    }

    func publishPresenterRevocation(_ grant: AgentTitleGrant, reason: String) async throws {
        let event = try await performWireMutation(tool: "title_revoke", args: [
            "grantId": grant.id,
            "reason": reason,
            "actorId": "harrison",
        ])
        apply(wireEvent: event)
    }

    private func titleGrantArguments(_ grant: AgentTitleGrant) -> [String: Any] {
        [
            "grantId": grant.id,
            "agentId": grant.agentId,
            "title": grant.title.rawValue,
            "scopeKind": grant.scope.kind.rawValue,
            "scopeRef": grant.scope.reference,
            "skillBundleRefs": grant.skillBundleRefs,
            "resourceGrantRefs": grant.resourceGrantRefs,
            "delegatedAgentIds": grant.delegatedAgentIds,
            "permissions": grant.permissions.map(\.rawValue),
            "expiresAt": Self.isoString(grant.expiresAt),
            "actorId": "harrison",
        ]
    }

    private func performWireMutation(
        tool: String, args: [String: Any]
    ) async throws -> WireEvent {
        guard let url = URL(string: "\(writerURL)/rpc") else {
            throw WireMutationFailure.rejected("invalid writer URL")
        }
        var request = URLRequest(url: url, timeoutInterval: 3)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "tool": tool, "args": args,
        ])
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try Self.decoder.decode(WireMutationEnvelope.self, from: data)
        guard response.ok else {
            throw WireMutationFailure.rejected(response.error ?? "writer rejected mutation")
        }
        guard let event = response.result?.event else {
            throw WireMutationFailure.missingEvent
        }
        return event
    }

    private func countSkillUse(_ actorId: String, _ skill: AgentSkill) {
        wireSkillUse[actorId, default: [:]][skill.rawValue, default: 0] += 1
    }

    /// Oldest shipped work leaves the working set first; live work never does.
    private func evictTasksIfNeeded() {
        guard wireTasks.count > Self.taskCap else { return }
        let victim = wireTaskOrder.first { wireTasks[$0]?.state == .done } ?? wireTaskOrder.first
        guard let victim else { return }
        wireTasks.removeValue(forKey: victim)
        wireTaskAt.removeValue(forKey: victim)
        if let i = wireTaskOrder.firstIndex(of: victim) { wireTaskOrder.remove(at: i) }
    }

    /// The wire replaces a category only once it actually carries one.
    private func rebuildFromWire() {
        if !wireTasks.isEmpty {
            // A project with a live wire pulse can't stay auto-filed — the
            // demo world may have filed a same-named quiet project earlier.
            let pulsing = Set(wireTasks.values
                .filter { $0.state == .running || $0.state == .review || $0.state == .blocked }
                .map(\.room))
            if !pulsing.isEmpty { archivedProjects.subtract(pulsing) }
            tasks = Array(wireTasks.values).sorted { $0.id < $1.id }

            // Blocked wire tasks ARE the interrupts — Needs you reflects the
            // durable log, not the demo narrative.
            interrupts = wireTasks.values
                .filter { $0.state == .blocked }
                .sorted { $0.id < $1.id }
                .map { t in
                    Interrupt(id: "wire-\(t.id)", agentName: t.agentName, agentColor: t.agentColor,
                              title: "\(t.agentName) is blocked — \(t.title)", kind: .blocked,
                              detail: t.detail.map { [$0] } ?? [],
                              age: wireTaskAt[t.id].map(Self.relative) ?? "now")
                }
        }
        if !wireArtifacts.isEmpty {
            artifacts = Array(wireArtifacts.values).sorted { $0.id < $1.id }
        }
        rebuildWireSessions()

        if !wireBeats.isEmpty {
            // Stage precedence: director-curated steps win; otherwise resolve
            // relatedEventIds against work events seen so far (late arrivals
            // resolve next rebuild); otherwise the structural placeholder.
            let activeBeats = wireBeats.filter { key, _ in
                guard let activeProgram = wireActiveProgramId else { return true }
                return wireBeatPrograms[key] == activeProgram
            }
            beats = activeBeats.sorted {
                if $0.value.id == $1.value.id { return $0.key < $1.key }
                return $0.value.id < $1.value.id
            }.map { key, beat in
                guard beat.steps.isEmpty else { return beat }
                let steps = (wireBeatRelated[key] ?? []).compactMap { wireEventTitles[$0] }
                guard !steps.isEmpty else { return beat }
                return Beat(id: beat.id, kind: beat.kind, title: beat.title,
                            director: beat.director, directorColor: beat.directorColor,
                            caption: beat.caption, duration: beat.duration, steps: steps)
            }
        }

        // The roster: agent participants become the Agents surface, their
        // latest work line as the status, blocked tasks flipping Needs you.
        let agentInfos = wireParticipants.values.filter { $0.kind == "agent" }
        if !agentInfos.isEmpty {
            let blockedAgents = Set(wireTasks.values.filter { $0.state == .blocked }.map(\.agentName))
            agents = agentInfos.sorted { $0.id < $1.id }.map { info in
                let name = info.id == "coder" ? "Cline" : info.displayName
                let status = wireActorStatus[info.id]
                return Agent(
                    id: info.id, name: name, role: info.role.uppercased(),
                    color: Self.agentColors[info.id] ?? Self.fallbackColor(info.id),
                    statusLine: status?.line ?? "Joined the room",
                    age: Self.relative(status?.at ?? info.joinedAt),
                    state: blockedAgents.contains(name) ? .needsYou : .working,
                    voice: "—", editsAllowed: 0, testsRun: 0,
                    uptime: Self.relative(info.joinedAt))
            }
        }
    }

    private func rebuildWireSessions() {
        let live = wireSessions.values
            .filter { $0.startedAt != nil && $0.endedAt == nil }
            .sorted { ($0.startedAt ?? .distantPast) > ($1.startedAt ?? .distantPast) }
            .first
        wireActiveSession = live.map(materialize)
        wireActiveProgramId = live?.programId
        wireUpcomingSessions = wireSessions.values
            .filter { $0.startedAt == nil && $0.endedAt == nil }
            .sorted {
                ($0.scheduledAt ?? $0.createdAt) < ($1.scheduledAt ?? $1.createdAt)
            }
            .map(materialize)

        let activeOrEnded = wireSessions.values.filter {
            $0.startedAt != nil || $0.endedAt != nil
        }
        for session in activeOrEnded where wireReminderScheduled.contains(session.id) {
            NotificationManager.shared.cancelSessionReminder(session.id)
            wireReminderScheduled.remove(session.id)
        }
        for session in wireSessions.values where session.startedAt == nil && session.endedAt == nil {
            guard let scheduledAt = session.scheduledAt,
                  scheduledAt.timeIntervalSinceNow > -60,
                  !wireReminderScheduled.contains(session.id) else { continue }
            NotificationManager.shared.scheduleSessionReminder(materialize(session))
            wireReminderScheduled.insert(session.id)
        }
    }

    private func materialize(_ session: WireSessionRecord) -> UpcomingSession {
        let people = session.participantIds.map { id in
            wireParticipants[id]?.displayName ?? Self.displayName(id)
        }
        return UpcomingSession(
            id: session.id,
            title: session.title,
            project: session.project,
            when: session.scheduledAt.map { UpcomingSession.displayWhen($0) }
                ?? "Time not set",
            people: people,
            agendaCount: session.agendaTaskIds.count,
            note: session.note,
            participantIds: session.participantIds,
            agendaTaskIds: session.agendaTaskIds,
            scheduledAt: session.scheduledAt)
    }

    private static func fallbackColor(_ actorId: String) -> Color {
        var hash = 0
        for scalar in actorId.unicodeScalars { hash = (hash &* 31 &+ Int(scalar.value)) & 0xFFFF }
        return fallbackColors[hash % fallbackColors.count]
    }

    private static func materializeTitleGrant(_ raw: WireAgentTitleGrant) -> AgentTitleGrant? {
        guard let title = AgentTitle(rawValue: raw.title),
              let scopeKind = AgentTitleScopeKind(rawValue: raw.scope.kind),
              let grantedAt = parseIso(raw.grantedAt),
              let expiresAt = parseIso(raw.expiresAt) else { return nil }
        let permissions = raw.permissions.compactMap(AgentTitlePermission.init(rawValue:))
        guard !permissions.isEmpty else { return nil }
        return AgentTitleGrant(
            id: raw.id,
            agentId: raw.agentId,
            title: title,
            scope: AgentTitleScope(kind: scopeKind, reference: raw.scope.ref),
            skillBundleRefs: raw.skillBundleRefs,
            resourceGrantRefs: raw.resourceGrantRefs,
            delegatedAgentIds: raw.delegatedAgentIds,
            permissions: permissions,
            grantedAt: grantedAt,
            expiresAt: expiresAt,
            revokedAt: raw.revokedAt.flatMap(parseIso))
    }

    static func displayName(_ actorId: String) -> String {
        if actorId == "coder" { return "Cline" }  // the main agent is Cline
        return actorId.prefix(1).uppercased() + actorId.dropFirst()
    }

    private static func isLocalUser(_ actorId: String) -> Bool {
        actorId == "harrison" || actorId == "drive:human"
    }

    private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static func parseIso(_ raw: String) -> Date? {
        isoParser.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    private static func isoString(_ date: Date) -> String {
        isoParser.string(from: date)
    }

    /// "8s" / "2m" / "3h" / "4d" — the wire's `at`, humanized.
    static func relative(_ date: Date) -> String {
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        if seconds < 60 { return "\(seconds)s" }
        if seconds < 3600 { return "\(seconds / 60)m" }
        if seconds < 86_400 { return "\(seconds / 3600)h" }
        return "\(seconds / 86_400)d"
    }
}
