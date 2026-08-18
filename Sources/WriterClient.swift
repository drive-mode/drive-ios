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
    let title: String?
    let note: String?
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
        case "control.invite":
            // Invitations ride the control track straight into the inbox.
            guard let id = event.id, let inviter = event.inviterId,
                  !inbox.contains(where: { $0.id == id }) else { return }
            countSkillUse(inviter, .inviting)
            inbox.insert(InboxItem(
                id: id, kind: .invite,
                title: "\(Self.displayName(inviter)) invited you to a working session",
                body: event.note
                    ?? event.title.map { "\($0) — join when you're ready." }
                    ?? "Join when you're ready.",
                age: Self.relative(at)), at: 0)
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
            wireBeats[index] = Beat(
                id: index, kind: beatKind, title: title,
                director: Self.displayName(directorId),
                directorColor: Self.agentColors[directorId] ?? Self.fallbackColor(directorId),
                caption: payload.caption ?? title,
                duration: payload.durationSec ?? 7,
                steps: payload.steps ?? [],
                accent: payload.accent ?? [])
            wireBeatRelated[index] = payload.relatedEventIds ?? []
            if wireBeats.count > Self.beatCap, let victim = wireBeats.keys.min() {
                wireBeats.removeValue(forKey: victim)
                wireBeatRelated.removeValue(forKey: victim)
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
        if !wireBeats.isEmpty {
            // Stage precedence: director-curated steps win; otherwise resolve
            // relatedEventIds against work events seen so far (late arrivals
            // resolve next rebuild); otherwise the structural placeholder.
            beats = wireBeats.sorted { $0.key < $1.key }.map { index, beat in
                guard beat.steps.isEmpty else { return beat }
                let steps = (wireBeatRelated[index] ?? []).compactMap { wireEventTitles[$0] }
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

    private static func fallbackColor(_ actorId: String) -> Color {
        var hash = 0
        for scalar in actorId.unicodeScalars { hash = (hash &* 31 &+ Int(scalar.value)) & 0xFFFF }
        return fallbackColors[hash % fallbackColors.count]
    }

    static func displayName(_ actorId: String) -> String {
        if actorId == "coder" { return "Cline" }  // the main agent is Cline
        return actorId.prefix(1).uppercased() + actorId.dropFirst()
    }

    private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static func parseIso(_ raw: String) -> Date? {
        isoParser.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
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
