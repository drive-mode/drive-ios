import SwiftUI

enum WorkTargetKind: String, Codable, CaseIterable {
    case githubRepository
    case directory
    case fileSet
    case deviceSandbox

    var label: String {
        switch self {
        case .githubRepository: return "GitHub repository"
        case .directory: return "Folder"
        case .fileSet: return "Saved file set"
        case .deviceSandbox: return "Device sandbox"
        }
    }

    var symbol: String {
        switch self {
        case .githubRepository: return "chevron.left.forwardslash.chevron.right"
        case .directory: return "folder"
        case .fileSet: return "doc.on.doc"
        case .deviceSandbox: return "iphone"
        }
    }
}

enum WorkTargetAccessPosture: String, Codable {
    case readOnly
    case readWrite
    case permissionRequired

    var label: String {
        switch self {
        case .readOnly: return "Read only"
        case .readWrite: return "Read & write"
        case .permissionRequired: return "Permission required"
        }
    }
}

enum WorkTargetConnectionState: String, Codable {
    case connected
    case disconnected
    case unavailable

    var label: String {
        switch self {
        case .connected: return "Connected"
        case .disconnected: return "Reconnect"
        case .unavailable: return "Unavailable"
        }
    }
}

/// A user-facing target that never exposes a raw filesystem path or provider
/// credential. The opaque reference is resolved only by the owning host/tool.
struct WorkTargetRef: Identifiable, Codable, Equatable {
    let id: String
    var displayName: String
    var displayLocation: String
    let kind: WorkTargetKind
    var accessPosture: WorkTargetAccessPosture
    var connectionState: WorkTargetConnectionState
    let opaqueReference: String

    var canUse: Bool {
        connectionState == .connected && accessPosture != .permissionRequired
    }

    static let previews: [WorkTargetRef] = [
        WorkTargetRef(
            id: "target-drive-ios",
            displayName: "drive-ios",
            displayLocation: "GitHub · drive-mode/drive-ios",
            kind: .githubRepository,
            accessPosture: .readWrite,
            connectionState: .connected,
            opaqueReference: "repo_ref_8bb75f"),
        WorkTargetRef(
            id: "target-product-specs",
            displayName: "Product specs",
            displayLocation: "Saved files · 14 documents",
            kind: .fileSet,
            accessPosture: .readOnly,
            connectionState: .connected,
            opaqueReference: "fileset_ref_1c04da"),
        WorkTargetRef(
            id: "target-device-folder",
            displayName: "Choose a device folder",
            displayLocation: "On this device · access not granted",
            kind: .directory,
            accessPosture: .permissionRequired,
            connectionState: .disconnected,
            opaqueReference: "security_scope_pending"),
    ]

    static let unconfigured = WorkTargetRef(
        id: "target-unconfigured",
        displayName: "Choose a work target",
        displayLocation: "No repository or folder connected",
        kind: .directory,
        accessPosture: .permissionRequired,
        connectionState: .unavailable,
        opaqueReference: "host_target_required")
}

struct CallPreset: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var targetIDs: [String]
    var agentIDs: [String]
    var presenterCandidateIDs: [String]

    var canLaunch: Bool { !targetIDs.isEmpty && !agentIDs.isEmpty }

    static let fallback = CallPreset(
        id: "preset-focused-pair",
        name: "Focused pair",
        targetIDs: ["target-drive-ios"],
        agentIDs: ["maya", "coder"],
        presenterCandidateIDs: ["maya"])

    static let unavailable = CallPreset(
        id: "preset-unavailable",
        name: "No default preset",
        targetIDs: [],
        agentIDs: [],
        presenterCandidateIDs: [])

    static func loadDefault(
        defaults: UserDefaults = .standard,
        fallback: CallPreset = .fallback
    ) -> CallPreset {
        guard let data = defaults.data(forKey: "call.defaultPreset.v1"),
              let value = try? JSONDecoder().decode(CallPreset.self, from: data) else {
            return fallback
        }
        return value
    }

    func saveDefault(defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        defaults.set(data, forKey: "call.defaultPreset.v1")
    }
}

enum CallLaunchDecision: Equatable {
    case launchDefault
    case configure

    static func resolve(preference: String, preset: CallPreset) -> CallLaunchDecision {
        preference == "Launch default preset" && preset.canLaunch ? .launchDefault : .configure
    }
}

struct WorkChatMessage: Identifiable, Equatable {
    let id: UUID
    let text: String

    init(id: UUID = UUID(), text: String) {
        self.id = id
        self.text = text
    }
}

/// Chat is the primary Work surface. Calls and lifecycle records remain
/// reachable, but no longer crowd the empty-state composer.
struct CallTabView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var settingsDrafts: SettingsDraftStore
    @Environment(\.colorScheme) private var scheme
    @State private var composer = ""
    @State private var showingTargets = false
    @State private var showingConfigurator = false
    @State private var showingCalls = false
    @State private var showingHistory = false
    @FocusState private var composerFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                workHeader
                if store.workChatMessages.isEmpty {
                    emptyChat
                } else {
                    conversation
                }
                composerBar
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Work")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { HomeToolbarButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { showingCalls = true } label: {
                            Label("Calls", systemImage: "phone")
                        }
                        Button { showingHistory = true } label: {
                            Label("History", systemImage: "clock.arrow.circlepath")
                        }
                        Divider()
                        Button { store.openSettings(.calls, source: .work) } label: {
                            Label("Settings", systemImage: "gearshape")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Work menu")
                }
            }
            .sheet(isPresented: $showingTargets) {
                WorkTargetPickerView()
            }
            .sheet(isPresented: $showingConfigurator) {
                CallConfiguratorView(preset: selectedCallPreset) { preset, saveAsDefault in
                    store.launchCall(preset: preset, saveAsDefault: saveAsDefault)
                }
            }
            .sheet(isPresented: $showingCalls) { WorkCallsView() }
            .sheet(isPresented: $showingHistory) { WorkHistoryView() }
        }
    }

    private var workHeader: some View {
        HStack(spacing: 8) {
            Button { showingTargets = true } label: {
                HStack(spacing: 7) {
                    Image(systemName: store.selectedWorkTarget.kind.symbol)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(store.selectedWorkTarget.canUse
                             ? store.selectedWorkTarget.displayName
                             : "Target")
                            .font(.system(size: 12, weight: .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            .allowsTightening(true)
                        if store.selectedWorkTarget.canUse {
                            Text(store.selectedWorkTarget.connectionState.label)
                                .font(.system(size: 9.5, weight: .semibold))
                                .foregroundStyle(DT.live(scheme))
                        }
                    }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .bold))
                }
                .foregroundStyle(DT.ink78(scheme))
                .padding(.horizontal, 10)
                .frame(height: 38)
                .background(DT.surface2(scheme), in: Capsule())
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Work target, \(store.selectedWorkTarget.displayName)")
            .accessibilityHint("Choose a repository, folder, or saved file set")

            Spacer(minLength: 4)

            Button {
                withAnimation(.easeOut(duration: 0.2)) { store.startNewWorkChat() }
                composerFocused = true
            } label: {
                Label("New Chat", systemImage: "square.and.pencil")
                    .font(.system(size: 11.5, weight: .bold))
            }
            .buttonStyle(WorkHeaderButtonStyle(scheme: scheme, prominent: false))
            .accessibilityHint("Clears this local conversation and starts a new chat")

            Button { beginCall() } label: {
                Label("Call", systemImage: "phone.fill")
                    .font(.system(size: 11.5, weight: .bold))
            }
            .buttonStyle(WorkHeaderButtonStyle(scheme: scheme, prominent: true))
            .accessibilityHint("Starts the default call or opens call configuration")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(.bar)
    }

    private var emptyChat: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: store.selectedWorkTarget.kind.symbol)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(DT.violetText(scheme))
                .frame(width: 54, height: 54)
                .background(DT.violet.opacity(0.10), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            VStack(spacing: 6) {
                Text("Start with \(store.selectedWorkTarget.displayName)")
                    .font(.system(size: 19, weight: .heavy))
                    .multilineTextAlignment(.center)
                Text(store.selectedWorkTarget.displayLocation)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(DT.ink55(scheme))
                    .multilineTextAlignment(.center)
                Text("\(store.selectedWorkTarget.kind.label) · \(store.selectedWorkTarget.accessPosture.label)")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
            }
            if !store.selectedWorkTarget.canUse {
                Button { showingTargets = true } label: {
                    Text(store.workTargets.contains(where: \.canUse)
                         ? "Choose an available target"
                         : "View target connection status")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
            }
            Spacer()
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var conversation: some View {
        ScrollView {
            LazyVStack(alignment: .trailing, spacing: 12) {
                ForEach(store.workChatMessages) { message in
                    Text(message.text)
                        .font(.system(size: 14))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .background(DT.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .frame(maxWidth: 300, alignment: .trailing)
                        .accessibilityLabel("You: \(message.text)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(16)
        }
    }

    private var composerBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Message \(store.selectedWorkTarget.displayName)", text: $composer, axis: .vertical)
                .lineLimit(1...5)
                .focused($composerFocused)
                .font(.system(size: 14))
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .frame(minHeight: 44)
                .background(DT.surface2(scheme), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .disabled(!store.selectedWorkTarget.canUse)
                .accessibilityHidden(!store.selectedWorkTarget.canUse)
            Button { send() } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(composer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? DT.ink35(scheme) : DT.violet, in: Circle())
            }
            .disabled(composer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !store.selectedWorkTarget.canUse)
            .accessibilityLabel("Send message")
            .accessibilityHidden(!store.selectedWorkTarget.canUse)
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(.bar)
    }

    private func send() {
        guard store.sendWorkChat(composer) else { return }
        composer = ""
    }

    private func beginCall() {
        switch CallLaunchDecision.resolve(
            preference: settingsDrafts.callLaunchBehavior,
            preset: selectedCallPreset) {
        case .launchDefault:
            store.launchCall(preset: selectedCallPreset, saveAsDefault: false)
        case .configure:
            showingConfigurator = true
        }
    }

    private var selectedCallPreset: CallPreset {
        var preset = store.callPresetForCurrentTarget
        let name = settingsDrafts.defaultCallPresetName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { preset.name = name }
        return preset
    }
}

private struct WorkHeaderButtonStyle: ButtonStyle {
    let scheme: ColorScheme
    let prominent: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(prominent ? Color.white : DT.violetText(scheme))
            .padding(.horizontal, 10)
            .frame(minHeight: 44)
            .background(prominent ? AnyShapeStyle(DT.heroGradient) : AnyShapeStyle(DT.violet.opacity(0.10)), in: Capsule())
            .opacity(configuration.isPressed ? 0.72 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}

struct WorkTargetPickerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.workTargets) { target in
                    Button {
                        store.selectWorkTarget(target.id)
                        if target.canUse { dismiss() }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: target.kind.symbol)
                                .foregroundStyle(DT.violetText(scheme))
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(target.displayName).font(.system(size: 14, weight: .bold))
                                Text(target.displayLocation).font(.system(size: 11)).foregroundStyle(.secondary)
                                Text("\(target.accessPosture.label) · \(target.connectionState.label)")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(target.canUse ? DT.live(scheme) : DT.ink55(scheme))
                            }
                            Spacer()
                            if store.selectedWorkTargetID == target.id {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(DT.violet)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!target.canUse)
                }
                if !store.workTargets.contains(where: \.canUse) {
                    ContentUnavailableView(
                        "No targets available",
                        systemImage: "folder.badge.questionmark",
                        description: Text("A connected host or security-scoped folder grant is required."))
                        .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Work target")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Feature-isolated call configuration. It passes only opaque target and
/// agent references back to the host; Presenter grants are issued later by
/// the title protocol, never embedded in the preset.
struct CallConfiguratorView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var draft: CallPreset
    @State private var saveAsDefault = false
    let onStart: (CallPreset, Bool) -> Void

    init(preset: CallPreset, onStart: @escaping (CallPreset, Bool) -> Void) {
        _draft = State(initialValue: preset)
        self.onStart = onStart
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if store.workTargets.allSatisfy({ !$0.canUse }) || store.agents.isEmpty {
                        ContentUnavailableView(
                            "Call unavailable",
                            systemImage: "phone.down",
                            description: Text("Connect a work target and an approved agent roster before starting a call."))
                    }
                    section("TARGETS") {
                        VStack(spacing: 0) {
                            ForEach(store.workTargets.filter(\.canUse)) { target in
                                selectionRow(
                                    title: target.displayName,
                                    subtitle: target.displayLocation,
                                    selected: draft.targetIDs.contains(target.id)) {
                                        toggle(target.id, in: &draft.targetIDs)
                                    }
                            }
                        }.card()
                    }
                    section("AGENTS") {
                        VStack(spacing: 0) {
                            ForEach(store.agents) { agent in
                                selectionRow(
                                    title: agent.name,
                                    subtitle: agent.role.capitalized,
                                    selected: draft.agentIDs.contains(agent.id)) {
                                        toggle(agent.id, in: &draft.agentIDs)
                                        if !draft.agentIDs.contains(agent.id) {
                                            draft.presenterCandidateIDs.removeAll { $0 == agent.id }
                                        }
                                    }
                            }
                        }.card()
                    }
                    section("PRESENTATION PERMISSIONS") {
                        VStack(spacing: 0) {
                            ForEach(store.agents.filter { draft.agentIDs.contains($0.id) }) { agent in
                                selectionRow(
                                    title: "\(agent.name) may be Presenter",
                                    subtitle: "Generated typed stage only — no screen or pixel capture",
                                    selected: draft.presenterCandidateIDs.contains(agent.id)) {
                                        toggle(agent.id, in: &draft.presenterCandidateIDs)
                                    }
                            }
                        }.card()
                    }
                    Toggle("Use as default call preset", isOn: $saveAsDefault)
                        .font(.system(size: 13, weight: .semibold))
                        .tint(DT.violet)
                    Button {
                        onStart(draft, saveAsDefault)
                        dismiss()
                    } label: {
                        Label("Start call", systemImage: "phone.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(DT.heroGradient, in: RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    }
                    .disabled(!draft.canLaunch)
                }
                .padding(20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Configure call")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .presentationDetents([.large])
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(title)
            content()
        }
    }

    private func selectionRow(
        title: String,
        subtitle: String,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 11) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? DT.violet : DT.ink35(scheme))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 13.5, weight: .semibold))
                    Text(subtitle).font(.system(size: 10.5)).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .foregroundStyle(DT.ink(scheme))
            .padding(12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func toggle(_ id: String, in values: inout [String]) {
        if values.contains(id) { values.removeAll { $0 == id } }
        else { values.append(id) }
    }
}

struct WorkHistoryView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme

    private var replays: [Artifact] { store.artifacts.filter { $0.kind == .replay } }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if replays.isEmpty {
                        ContentUnavailableView("No call history", systemImage: "clock.arrow.circlepath")
                            .padding(.top, 80)
                    } else {
                        ForEach(replays) { SessionRecordCard(replay: $0) }
                    }
                }
                .padding(20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.large])
    }
}
