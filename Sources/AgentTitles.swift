import SwiftUI

enum AgentTitle: String, Codable {
    case presenter

    var displayName: String { "Presenter" }
}

enum AgentTitleScopeKind: String, Codable {
    case room, session, stage
}

struct AgentTitleScope: Codable, Equatable {
    let kind: AgentTitleScopeKind
    let reference: String

    enum CodingKeys: String, CodingKey {
        case kind
        case reference = "ref"
    }
}

enum AgentTitlePermission: String, Codable {
    case stagePresent = "stage.present"
}

/// A reference-only capability envelope. Skill/resource contents remain on
/// the signed host and are never embedded in the grant or transferred to UI.
struct AgentTitleGrant: Identifiable, Codable, Equatable {
    let id: String
    let agentId: String
    let title: AgentTitle
    let scope: AgentTitleScope
    let skillBundleRefs: [String]
    let resourceGrantRefs: [String]
    let delegatedAgentIds: [String]
    let permissions: [AgentTitlePermission]
    let grantedAt: Date
    let expiresAt: Date
    var revokedAt: Date?

    func isActive(at date: Date = Date()) -> Bool {
        grantedAt <= date && date < expiresAt && (revokedAt == nil || date < revokedAt!)
    }
}

enum AgentTitleEventKind: String, Codable {
    case granted, transferred, revoked
}

struct AgentTitleEventReceipt: Identifiable, Codable, Equatable {
    let id: String
    let kind: AgentTitleEventKind
    let at: Date
    let fromAgentId: String?
    let toAgentId: String?
    let reason: String?
}

struct DirectorPolicyDescriptor: Equatable {
    let version: String
    let signatureStatus: String
    let exportable: Bool

    static let builtIn = DirectorPolicyDescriptor(
        version: "director-host-v1",
        signatureStatus: "Verified",
        exportable: false)
}

extension AppStore {
    var activePresenterGrant: AgentTitleGrant? {
        titleGrantsByID.values
            .filter { $0.title == .presenter && $0.isActive() }
            .sorted { $0.grantedAt > $1.grantedAt }
            .first
    }

    var activePresenterAgent: Agent? {
        guard let id = activePresenterGrant?.agentId else { return nil }
        return agents.first { $0.id == id }
    }

    var presenterEligibleAgents: [Agent] {
        agents.filter { activeCallPresenterCandidateIDs.contains($0.id) }
    }

    @discardableResult
    func applyTitleGrant(_ grant: AgentTitleGrant, eventId: String? = nil) -> Bool {
        if let current = activePresenterGrant, current.id != grant.id {
            titleMutationError = "Presenter is already assigned to \(displayName(forAgentID: current.agentId)). Transfer it instead."
            return false
        }
        titleGrantsByID[grant.id] = grant
        appendTitleReceipt(AgentTitleEventReceipt(
            id: eventId ?? "local-title-grant-\(grant.id)",
            kind: .granted,
            at: grant.grantedAt,
            fromAgentId: nil,
            toAgentId: grant.agentId,
            reason: nil))
        titleMutationError = nil
        return true
    }

    func applyTitleTransfer(
        fromGrantId: String,
        toGrant: AgentTitleGrant,
        at: Date,
        eventId: String? = nil
    ) {
        let fromAgentId = titleGrantsByID[fromGrantId]?.agentId
        if var old = titleGrantsByID[fromGrantId] {
            old.revokedAt = at
            titleGrantsByID[fromGrantId] = old
        }
        titleGrantsByID[toGrant.id] = toGrant
        appendTitleReceipt(AgentTitleEventReceipt(
            id: eventId ?? "local-title-transfer-\(fromGrantId)-\(toGrant.id)",
            kind: .transferred,
            at: at,
            fromAgentId: fromAgentId,
            toAgentId: toGrant.agentId,
            reason: nil))
        titleMutationError = nil
    }

    func applyTitleRevocation(
        grantId: String,
        at: Date,
        reason: String,
        eventId: String? = nil
    ) {
        guard var grant = titleGrantsByID[grantId] else { return }
        grant.revokedAt = at
        titleGrantsByID[grantId] = grant
        appendTitleReceipt(AgentTitleEventReceipt(
            id: eventId ?? "local-title-revoke-\(grantId)-\(Int(at.timeIntervalSince1970))",
            kind: .revoked,
            at: at,
            fromAgentId: grant.agentId,
            toAgentId: nil,
            reason: reason))
        titleMutationError = nil
    }

    /// Fold `control.leave`: revoke still-live grants for the leaver.
    /// Stage cards are left in place — same as the kernel.
    func applyControlLeave(
        participantId: String,
        at: Date,
        reason: String = "left",
        eventId: String? = nil
    ) {
        let liveIds = titleGrantsByID.values
            .filter { $0.agentId == participantId && $0.isActive(at: at) }
            .map(\.id)
        for grantId in liveIds {
            applyTitleRevocation(
                grantId: grantId,
                at: at,
                reason: reason,
                eventId: eventId.map { "\($0)-leave-\(grantId)" })
        }
    }

    /// Fold `control.end`: revoke every still-live grant. Cards survive.
    func applyControlEnd(
        at: Date,
        reason: String = "ended",
        eventId: String? = nil
    ) {
        let liveIds = titleGrantsByID.values
            .filter { $0.isActive(at: at) }
            .map(\.id)
        for grantId in liveIds {
            applyTitleRevocation(
                grantId: grantId,
                at: at,
                reason: reason,
                eventId: eventId.map { "\($0)-end-\(grantId)" })
        }
    }

    func requestPresenter(to agentId: String, duration: TimeInterval = 15 * 60) {
        guard activeCallPresenterCandidateIDs.contains(agentId),
              agents.contains(where: { $0.id == agentId }) else {
            titleMutationError = "That agent is not eligible to present in this call."
            return
        }
        let now = Date()
        let newGrant = makePresenterGrant(agentId: agentId, at: now, duration: duration)
        if wireStatus.isLive {
            Task { [weak self] in
                guard let self else { return }
                do {
                    if let current = self.activePresenterGrant {
                        try await self.publishPresenterTransfer(from: current, to: newGrant)
                    } else {
                        try await self.publishPresenterGrant(newGrant)
                    }
                } catch {
                    self.titleMutationError = "The host did not accept the Presenter change."
                }
            }
        } else if let current = activePresenterGrant {
            if current.agentId == agentId { return }
            applyTitleTransfer(fromGrantId: current.id, toGrant: newGrant, at: now)
        } else {
            applyTitleGrant(newGrant)
        }
    }

    func revokePresenter(reason: String = "revoked") {
        guard let current = activePresenterGrant else { return }
        if wireStatus.isLive {
            Task { [weak self] in
                do { try await self?.publishPresenterRevocation(current, reason: reason) }
                catch { self?.titleMutationError = "The host did not accept the Presenter revocation." }
            }
        } else {
            applyTitleRevocation(grantId: current.id, at: Date(), reason: reason)
        }
    }

    func activateDefaultPresenterIfNeeded() {
        guard activePresenterGrant == nil,
              let candidate = activeCallPresenterCandidateIDs.first else { return }
        requestPresenter(to: candidate)
    }

    func makePresenterGrant(
        agentId: String,
        at: Date = Date(),
        duration: TimeInterval = 15 * 60
    ) -> AgentTitleGrant {
        AgentTitleGrant(
            id: "grant-presenter-\(agentId)-\(Int(at.timeIntervalSince1970 * 1000))",
            agentId: agentId,
            title: .presenter,
            scope: AgentTitleScope(kind: .stage, reference: wireActiveProgramId ?? "local-stage"),
            skillBundleRefs: ["bundle-presenter-v1"],
            resourceGrantRefs: ["typed-stage"],
            delegatedAgentIds: [],
            permissions: [.stagePresent],
            grantedAt: at,
            expiresAt: at.addingTimeInterval(duration),
            revokedAt: nil)
    }

    func displayName(forAgentID id: String) -> String {
        agents.first { $0.id == id }?.name ?? id
    }

    private func appendTitleReceipt(_ receipt: AgentTitleEventReceipt) {
        guard !titleEventLog.contains(where: { $0.id == receipt.id }) else { return }
        titleEventLog.append(receipt)
        titleEventLog.sort { $0.at < $1.at }
        if titleEventLog.count > 200 { titleEventLog.removeFirst(titleEventLog.count - 200) }
    }
}

struct PresenterTitleControl: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingDetails = false
    var compact = false

    var body: some View {
        Button { showingDetails = true } label: {
            HStack(spacing: 6) {
                Image(systemName: "rectangle.inset.filled.and.person.filled")
                    .font(.system(size: compact ? 9 : 10, weight: .semibold))
                if let agent = store.activePresenterAgent {
                    Text("Presenter · \(agent.name)")
                } else {
                    Text("Assign Presenter")
                }
            }
            .font(.system(size: compact ? 10.5 : 11.5, weight: .bold))
            .foregroundStyle(.white.opacity(0.88))
            .padding(.horizontal, compact ? 9 : 11)
            .frame(height: compact ? 28 : 32)
            .background(DT.raised, in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 0.8))
        }
        .buttonStyle(Pressable())
        .accessibilityHint("Opens the temporary title grant, transfer, and audit controls")
        .sheet(isPresented: $showingDetails) { PresenterControlSheet() }
    }
}

struct PresenterControlSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    currentGrant
                    Eyebrow("ELIGIBLE AGENTS")
                    VStack(spacing: 0) {
                        ForEach(store.presenterEligibleAgents) { agent in
                            Button { store.requestPresenter(to: agent.id) } label: {
                                HStack(spacing: 11) {
                                    AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 30)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(agent.name).font(.system(size: 13.5, weight: .bold))
                                        Text("Temporary typed-stage permission")
                                            .font(.system(size: 10.5)).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: store.activePresenterGrant?.agentId == agent.id
                                          ? "checkmark.circle.fill" : "arrow.left.arrow.right.circle")
                                        .foregroundStyle(DT.violet)
                                }
                                .foregroundStyle(DT.ink(scheme))
                                .padding(12)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        if store.presenterEligibleAgents.isEmpty {
                            Text("No Presenter candidates were allowed by this call preset.")
                                .font(.system(size: 12)).foregroundStyle(.secondary).padding(14)
                        }
                    }
                    .card()

                    directorBoundary

                    if !store.titleEventLog.isEmpty {
                        Eyebrow("TITLE EVENTS")
                        VStack(spacing: 0) {
                            ForEach(store.titleEventLog.suffix(8).reversed()) { receipt in
                                HStack(spacing: 9) {
                                    Image(systemName: receipt.kind == .granted ? "plus.circle" : receipt.kind == .transferred ? "arrow.left.arrow.right.circle" : "xmark.circle")
                                        .foregroundStyle(DT.violetText(scheme))
                                    Text(eventLabel(receipt))
                                        .font(.system(size: 11.5, weight: .semibold))
                                    Spacer()
                                    Text(receipt.at.formatted(date: .omitted, time: .shortened))
                                        .font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                                }
                                .padding(11)
                            }
                        }
                        .card()
                    }

                    if let error = store.titleMutationError {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(DT.danger)
                    }
                }
                .padding(20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Presenter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.large])
    }

    private var currentGrant: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Presenter", systemImage: "rectangle.inset.filled.and.person.filled")
                    .font(.system(size: 15, weight: .heavy))
                Spacer()
                Text(store.activePresenterAgent?.name ?? "Unassigned")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(DT.violetText(scheme))
            }
            if let grant = store.activePresenterGrant {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    let seconds = max(0, Int(grant.expiresAt.timeIntervalSince(context.date)))
                    Text("Expires in \(seconds / 60)m \(seconds % 60)s · \(grant.scope.kind.rawValue) scope")
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
                }
                Text("\(grant.skillBundleRefs.count) skill bundle ref · \(grant.resourceGrantRefs.count) resource ref · stage.present")
                    .font(.system(size: 10.5)).foregroundStyle(.secondary)
                Button(role: .destructive) { store.revokePresenter() } label: {
                    Text("Revoke Presenter").font(.system(size: 12, weight: .bold))
                }
            } else {
                Text("Only one agent can own the typed stage. Assigning creates a temporary, replayable event.")
                    .font(.system(size: 11.5)).foregroundStyle(.secondary)
            }
            Label("Typed work only — no device screen, camera, or pixel stream", systemImage: "rectangle.on.rectangle.slash")
                .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(.secondary)
        }
        .padding(14).card()
    }

    private var directorBoundary: some View {
        let policy = DirectorPolicyDescriptor.builtIn
        return VStack(alignment: .leading, spacing: 7) {
            Label("Director policy boundary", systemImage: "checkmark.shield")
                .font(.system(size: 13.5, weight: .bold))
            Text("\(policy.version) · \(policy.signatureStatus) · Host-only")
                .font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.secondary)
            Text("The title passes opaque bundle and resource references. Prompts, routing, tools, scoring, and model configuration stay signed and non-exportable on the host.")
                .font(.system(size: 11.5)).foregroundStyle(.secondary)
        }
        .padding(14).card()
    }

    private func eventLabel(_ receipt: AgentTitleEventReceipt) -> String {
        switch receipt.kind {
        case .granted:
            return "Granted to \(agentName(receipt.toAgentId))"
        case .transferred:
            return "\(agentName(receipt.fromAgentId)) → \(agentName(receipt.toAgentId))"
        case .revoked:
            return "Revoked from \(agentName(receipt.fromAgentId))"
        }
    }

    private func agentName(_ id: String?) -> String {
        guard let id else { return "Agent" }
        return store.displayName(forAgentID: id)
    }
}
