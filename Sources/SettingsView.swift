import SwiftUI
import UniformTypeIdentifiers

enum SettingsTab: String, CaseIterable, Identifiable {
    case general = "General"
    case profile = "Profile"
    case calls = "Calls"
    case agents = "Agents"
    case billingPayments = "Billing & payments"
    case usage = "Usage"
    case analytics = "Analytics"
    case privacy = "Privacy"
    case localAI = "On-device AI"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .general: return "slider.horizontal.3"
        case .profile: return "person.crop.circle"
        case .calls: return "phone"
        case .agents: return "person.2"
        case .billingPayments: return "creditcard"
        case .usage: return "gauge.with.dots.needle.50percent"
        case .analytics: return "chart.xyaxis.line"
        case .privacy: return "lock"
        case .localAI: return "iphone.gen3.radiowaves.left.and.right"
        }
    }
}

enum SettingsSource: String {
    case home, profile, work, agents, tasks
}

struct SettingsRoute: Identifiable, Equatable {
    let id = UUID()
    let initialTab: SettingsTab
    let source: SettingsSource
}

@MainActor
final class SettingsDraftStore: ObservableObject {
    @Published var appearance: String
    @Published var reduceMotion: Bool
    @Published var micDefault: String
    @Published var talkGesture: String
    @Published var autoFile: Bool
    @Published var sweepAge: String
    @Published var notifyApprovals: Bool
    @Published var notifyBlocked: Bool
    @Published var notifyInvites: Bool
    @Published var notifyShips: Bool
    @Published var notifyProduct: Bool
    @Published var quietHours: Bool
    @Published var quietFrom: Int
    @Published var quietTo: Int
    @Published var escalation: String
    @Published var displayName: String
    @Published var email: String
    @Published var callLaunchBehavior: String
    @Published var defaultCallPresetName: String

    private let defaults: UserDefaults
    private var persisted: Snapshot?

    private struct Snapshot: Equatable {
        let appearance: String
        let reduceMotion: Bool
        let micDefault: String
        let talkGesture: String
        let autoFile: Bool
        let sweepAge: String
        let notifyApprovals: Bool
        let notifyBlocked: Bool
        let notifyInvites: Bool
        let notifyShips: Bool
        let notifyProduct: Bool
        let quietHours: Bool
        let quietFrom: Int
        let quietTo: Int
        let escalation: String
        let displayName: String
        let email: String
        let callLaunchBehavior: String
        let defaultCallPresetName: String
    }

    init(
        defaults: UserDefaults = .standard,
        configuration: AppConfiguration = .current
    ) {
        self.defaults = defaults
        appearance = defaults.string(forKey: "appearance") ?? "System"
        reduceMotion = defaults.bool(forKey: "reduceMotion")
        micDefault = defaults.string(forKey: "micDefault") ?? "Muted"
        talkGesture = defaults.string(forKey: "talkGesture") ?? "Hold to talk"
        autoFile = defaults.object(forKey: "archive.autoFile") == nil
            ? true : defaults.bool(forKey: "archive.autoFile")
        sweepAge = defaults.string(forKey: "archive.sweepAge") ?? "Right away"
        notifyApprovals = defaults.object(forKey: "notify.approval") == nil
            ? true : defaults.bool(forKey: "notify.approval")
        notifyBlocked = defaults.object(forKey: "notify.blocked") == nil
            ? true : defaults.bool(forKey: "notify.blocked")
        notifyInvites = defaults.object(forKey: "notify.invite") == nil
            ? true : defaults.bool(forKey: "notify.invite")
        notifyShips = defaults.bool(forKey: "notify.ships")
        notifyProduct = defaults.bool(forKey: "notify.product")
        quietHours = defaults.bool(forKey: "notify.quiet")
        quietFrom = defaults.object(forKey: "notify.quietFrom") == nil
            ? 22 * 60 : defaults.integer(forKey: "notify.quietFrom")
        quietTo = defaults.object(forKey: "notify.quietTo") == nil
            ? 8 * 60 : defaults.integer(forKey: "notify.quietTo")
        escalation = defaults.string(forKey: "notify.escalation") ?? "Do nothing"
        displayName = defaults.string(forKey: "profile.displayName")
            ?? (configuration.previewContentEnabled ? "Harrison" : "")
        email = defaults.string(forKey: "profile.email")
            ?? (configuration.previewContentEnabled ? "harrison@quant-h2.com" : "")
        callLaunchBehavior = defaults.string(forKey: "call.launchBehavior") ?? "Configure each call"
        defaultCallPresetName = defaults.string(forKey: "call.defaultPreset")
            ?? (configuration.previewContentEnabled ? "Focused pair" : "No default preset")
        persisted = Snapshot(
            appearance: appearance, reduceMotion: reduceMotion,
            micDefault: micDefault, talkGesture: talkGesture,
            autoFile: autoFile, sweepAge: sweepAge,
            notifyApprovals: notifyApprovals, notifyBlocked: notifyBlocked,
            notifyInvites: notifyInvites, notifyShips: notifyShips,
            notifyProduct: notifyProduct, quietHours: quietHours,
            quietFrom: quietFrom, quietTo: quietTo, escalation: escalation,
            displayName: displayName, email: email,
            callLaunchBehavior: callLaunchBehavior,
            defaultCallPresetName: defaultCallPresetName)
    }

    var hasUnsavedChanges: Bool { snapshot != persisted }

    func save() {
        let values: [(String, Any)] = [
            ("appearance", appearance), ("reduceMotion", reduceMotion),
            ("micDefault", micDefault), ("talkGesture", talkGesture),
            ("archive.autoFile", autoFile), ("archive.sweepAge", sweepAge),
            ("notify.approval", notifyApprovals), ("notify.blocked", notifyBlocked),
            ("notify.invite", notifyInvites), ("notify.ships", notifyShips),
            ("notify.product", notifyProduct), ("notify.quiet", quietHours),
            ("notify.quietFrom", quietFrom), ("notify.quietTo", quietTo),
            ("notify.escalation", escalation), ("profile.displayName", displayName),
            ("profile.email", email), ("call.launchBehavior", callLaunchBehavior),
            ("call.defaultPreset", defaultCallPresetName),
        ]
        values.forEach { defaults.set($0.1, forKey: $0.0) }
        persisted = snapshot
    }

    func reset() {
        guard let persisted else { return }
        appearance = persisted.appearance
        reduceMotion = persisted.reduceMotion
        micDefault = persisted.micDefault
        talkGesture = persisted.talkGesture
        autoFile = persisted.autoFile
        sweepAge = persisted.sweepAge
        notifyApprovals = persisted.notifyApprovals
        notifyBlocked = persisted.notifyBlocked
        notifyInvites = persisted.notifyInvites
        notifyShips = persisted.notifyShips
        notifyProduct = persisted.notifyProduct
        quietHours = persisted.quietHours
        quietFrom = persisted.quietFrom
        quietTo = persisted.quietTo
        escalation = persisted.escalation
        displayName = persisted.displayName
        email = persisted.email
        callLaunchBehavior = persisted.callLaunchBehavior
        defaultCallPresetName = persisted.defaultCallPresetName
    }

    private var snapshot: Snapshot {
        Snapshot(
            appearance: appearance, reduceMotion: reduceMotion,
            micDefault: micDefault, talkGesture: talkGesture,
            autoFile: autoFile, sweepAge: sweepAge,
            notifyApprovals: notifyApprovals, notifyBlocked: notifyBlocked,
            notifyInvites: notifyInvites, notifyShips: notifyShips,
            notifyProduct: notifyProduct, quietHours: quietHours,
            quietFrom: quietFrom, quietTo: quietTo, escalation: escalation,
            displayName: displayName, email: email,
            callLaunchBehavior: callLaunchBehavior,
            defaultCallPresetName: defaultCallPresetName)
    }
}

struct AccountServiceSnapshot {
    let plan: String
    let billingStatus: String
    let paymentMethod: String
    let renewal: String
    let source: String
}

protocol AccountServiceProviding {
    var snapshot: AccountServiceSnapshot { get }
}

struct PreviewAccountService: AccountServiceProviding {
    let snapshot = AccountServiceSnapshot(
        plan: "Drive Preview",
        billingStatus: "No charge",
        paymentMethod: "No payment method",
        renewal: "Preview access does not renew",
        source: "Preview account service")
}

struct SettingsModalView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var drafts: SettingsDraftStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let route: SettingsRoute
    @State private var selectedTab: SettingsTab

    init(route: SettingsRoute) {
        self.route = route
        _selectedTab = State(initialValue: route.initialTab)
    }

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                NavigationSplitView {
                    List {
                        ForEach(store.configuration.availableSettingsTabs) { tab in
                            Button { selectedTab = tab } label: {
                                Label(tab.rawValue, systemImage: tab.symbol)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(selectedTab == tab ? DT.violet.opacity(0.10) : Color.clear)
                            .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
                        }
                    }
                    .navigationTitle("Settings")
                    .navigationSplitViewColumnWidth(min: 210, ideal: 240, max: 280)
                } detail: {
                    NavigationStack { selectedContent }
                        .toolbar(.visible, for: .navigationBar)
                }
            } else {
                NavigationStack {
                    VStack(spacing: 0) {
                        compactTabPicker
                        selectedContent
                    }
                }
                .toolbar(.visible, for: .navigationBar)
            }
        }
        .overlay(alignment: .top) { modalControls }
        .presentationDragIndicator(.visible)
        .presentationDetents([.large])
        .presentationContentInteraction(.scrolls)
        .onAppear {
            if !store.configuration.availableSettingsTabs.contains(selectedTab) {
                selectedTab = .general
            }
        }
    }

    private var modalControls: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
            }
            .accessibilityLabel("Close settings")
            .accessibilityHint("Draft changes stay available when settings reopens")
            Spacer()
            Button("Reset") { drafts.reset() }
                .font(.system(size: 13, weight: .bold))
                .disabled(!drafts.hasUnsavedChanges)
                .accessibilityHint("Restores the last saved settings")
            Button("Save") {
                drafts.save()
                dismiss()
            }
            .font(.system(size: 13, weight: .bold))
            .padding(.horizontal, 12)
            .frame(minHeight: 30)
            .background(DT.violet.opacity(drafts.hasUnsavedChanges ? 0.14 : 0.06), in: Capsule())
            .disabled(!drafts.hasUnsavedChanges)
        }
        .foregroundStyle(DT.violet)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .allowsHitTesting(true)
    }

    private var compactTabPicker: some View {
        HStack {
            Image(systemName: selectedTab.symbol)
                .foregroundStyle(DT.violet)
            Picker("Settings section", selection: $selectedTab) {
                ForEach(store.configuration.availableSettingsTabs) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.menu)
            .font(.system(size: 15, weight: .bold))
            Spacer()
            if drafts.hasUnsavedChanges {
                Text("Draft")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(DT.violet)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(DT.violet.opacity(0.10), in: Capsule())
            }
        }
        .padding(.horizontal, 20).frame(minHeight: 48)
        .background(.bar)
    }

    @ViewBuilder
    private var selectedContent: some View {
        switch selectedTab {
        case .general: ConfigSettingsView()
        case .profile: ProfileSettingsPanel()
        case .calls: CallSettingsPanel()
        case .agents: AgentSettingsPanel()
        case .billingPayments:
            if store.configuration.billingEnabled {
                BillingSettingsPanel(service: PreviewAccountService())
            } else {
                AccountServiceUnavailablePanel()
            }
        case .usage: UsageSettingsPanel()
        case .analytics: AnalyticsSettingsPanel()
        case .privacy: PrivacyAccountView()
        case .localAI: LocalAISettingsPanel()
        }
    }
}

private struct ProfileSettingsPanel: View {
    @EnvironmentObject private var drafts: SettingsDraftStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        settingsPanel(title: "Profile", intro: "Your editable persona and account contact.") {
            VStack(spacing: 0) {
                TextField("Display name", text: $drafts.displayName)
                    .textContentType(.name)
                    .padding(14)
                Divider().padding(.leading, 14)
                TextField("Email", text: $drafts.email)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .padding(14)
            }
            .card()
            Text("Closing Settings keeps these edits as a draft. Save writes them to this device.")
                .font(.system(size: 11)).foregroundStyle(DT.ink55(scheme))
        }
    }
}

private struct CallSettingsPanel: View {
    @EnvironmentObject private var drafts: SettingsDraftStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        settingsPanel(title: "Calls", intro: "Choose whether Call starts immediately or asks for a target and team.") {
            VStack(spacing: 0) {
                Picker("Call action", selection: $drafts.callLaunchBehavior) {
                    Text("Configure each call").tag("Configure each call")
                    Text("Launch default preset").tag("Launch default preset")
                }
                .padding(14)
                Divider().padding(.leading, 14)
                TextField("Default preset name", text: $drafts.defaultCallPresetName)
                    .padding(14)
            }
            .card()
            Text("Targets, agents, and Presenter eligibility are configured in the Work call configurator.")
                .font(.system(size: 11)).foregroundStyle(DT.ink55(scheme))
        }
    }
}

private struct AgentSettingsPanel: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @AppStorage("director.overlay.pace") private var directorPace = "Balanced"
    @AppStorage("director.overlay.handoffs") private var suggestHandoffs = true
    var body: some View {
        settingsPanel(title: "Agents", intro: "Persona names stay editable; runtime identity is shown separately.") {
            VStack(alignment: .leading, spacing: 10) {
                Label("Director policy stays signed, versioned, and host-side", systemImage: "checkmark.shield")
                Label("Typed-stage presentation only — never pixel capture", systemImage: "rectangle.on.rectangle.slash")
                Label("Temporary Agent Titles are logged and expire", systemImage: "clock.badge.checkmark")
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(DT.ink78(scheme))
            .padding(16).card()

            if store.configuration.previewContentEnabled {
                let policy = DirectorPolicyDescriptor.builtIn
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Director policy").font(.system(size: 14, weight: .bold))
                            Text("\(policy.version) · \(policy.signatureStatus) · Host-only")
                                .font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "checkmark.shield.fill").foregroundStyle(DT.violet)
                    }
                    .padding(14)
                    Divider().padding(.leading, 14)
                    directorOverlays
                }
                .card()
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Label("Director policy unavailable", systemImage: "shield.slash")
                        .font(.system(size: 14, weight: .bold))
                        .padding(14)
                    Divider().padding(.leading, 14)
                    Text("Connect an approved host before policy status, routing, or Presenter handoffs are shown.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .padding(14)
                }
                .card()
            }
            Text("These are safe user overlays. The signed prompts, routing, tools, scoring, and model configuration are not editable or exportable.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }

    private var directorOverlays: some View {
        VStack(spacing: 0) {
            Picker("Presentation pace", selection: $directorPace) {
                Text("Calm").tag("Calm")
                Text("Balanced").tag("Balanced")
                Text("Fast").tag("Fast")
            }
            .padding(14)
            Divider().padding(.leading, 14)
            Toggle("Suggest Presenter handoffs", isOn: $suggestHandoffs)
                .tint(DT.violet)
                .padding(14)
        }
    }
}

private struct AccountServiceUnavailablePanel: View {
    var body: some View {
        settingsPanel(
            title: "Billing & payments",
            intro: "Billing is not available until the account-service integration is configured.") {
                Label("No billing data is loaded", systemImage: "creditcard.trianglebadge.exclamationmark")
                    .font(.system(size: 14, weight: .semibold))
                    .padding(16)
                    .card()
            }
    }
}

private struct BillingSettingsPanel<Service: AccountServiceProviding>: View {
    @Environment(\.colorScheme) private var scheme
    let service: Service
    var body: some View {
        settingsPanel(title: "Billing & payments", intro: "Billing values come from the account-service boundary.") {
            VStack(spacing: 0) {
                value("Plan", service.snapshot.plan)
                Divider().padding(.leading, 14)
                value("Status", service.snapshot.billingStatus)
                Divider().padding(.leading, 14)
                value("Payment", service.snapshot.paymentMethod)
                Divider().padding(.leading, 14)
                value("Renewal", service.snapshot.renewal)
            }
            .card()
            Label(service.snapshot.source, systemImage: "server.rack")
                .font(.system(size: 11)).foregroundStyle(DT.ink55(scheme))
        }
    }

    private func value(_ label: String, _ value: String) -> some View {
        HStack { Text(label); Spacer(); Text(value).foregroundStyle(.secondary) }
            .font(.system(size: 14)).padding(14)
    }
}

private struct UsageSettingsPanel: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        let eventCount: Int = {
            if case .live(_, let events) = store.wireStatus { return events }
            return 0
        }()
        settingsPanel(title: "Usage", intro: "Observed consumption, without inventing provider token totals.") {
            MetricSettingsGrid(metrics: [
                ("Model work", "\(eventCount)", "durable events"),
                ("Calls", "\(store.wireSessions.count)", "registry records"),
                ("Resources", "\(store.tasks.count + store.artifacts.count + store.memoryFiles.count)", "tasks · artifacts · memory"),
            ])
            Text("Provider token and billing-unit totals appear only when the account service reports them.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }
}

private struct AnalyticsSettingsPanel: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        let shipped = store.tasks.filter { $0.state == .done }.count
        let attention = store.tasks.filter { $0.state == .blocked || $0.state == .review }.count
        settingsPanel(title: "Analytics", intro: "User-visible outcomes derived from durable work state.") {
            MetricSettingsGrid(metrics: [
                ("Shipped", "\(shipped)", "completed tasks"),
                ("Needs you", "\(attention)", "blocked or review"),
                ("Artifacts", "\(store.artifacts.count)", "replayable outputs"),
            ])
            Text("These are product outcomes, not hidden engagement scoring.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }
}

private struct LocalAISettingsPanel: View {
    @EnvironmentObject private var localAI: LocalAIStore
    @Environment(\.colorScheme) private var scheme
    @State private var showingFileImporter = false

    var body: some View {
        settingsPanel(title: "On-device AI", intro: "Use Apple's built-in system model for small, read-only file tasks.") {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: localAI.availability.symbol)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(localAI.availability == .ready ? DT.live(scheme) : Color.orange)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(localAI.availability.title)
                            .font(.system(size: 14, weight: .bold))
                        Text(localAI.availability.detail)
                            .font(.system(size: 11.5))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    Spacer()
                    Button("Check again") { localAI.refreshAvailability() }
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .padding(16).card()

            VStack(alignment: .leading, spacing: 12) {
                Picker("Local task", selection: $localAI.selectedTask) {
                    ForEach(LocalAITaskKind.allCases) { task in
                        Text(task.rawValue).tag(task)
                    }
                }
                .pickerStyle(.menu)

                Text(localAI.selectedTask.purpose)
                    .font(.system(size: 11.5))
                    .foregroundStyle(DT.ink55(scheme))

                Button {
                    showingFileImporter = true
                } label: {
                    Label(localAI.selectedFileName ?? "Choose a file", systemImage: "doc.badge.plus")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)

                Button {
                    if localAI.runState == .running {
                        localAI.cancelSelectedTask()
                    } else {
                        localAI.startSelectedTask()
                    }
                } label: {
                    Label(
                        localAI.runState == .running ? "Cancel local task" : "Run on device",
                        systemImage: localAI.runState == .running ? "xmark.circle" : "iphone.gen3.radiowaves.left.and.right"
                    )
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(localAI.runState == .running ? Color.secondary : DT.violet)
                .disabled(localAI.runState != .running && !localAI.canRun)

                if let message = localAI.runState.message {
                    Label(message, systemImage: localAI.runState == .completed ? "checkmark.seal" : "info.circle")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(localAI.runState == .fileAccessRevoked ? Color.orange : DT.ink55(scheme))
                }
            }
            .padding(16).card()

            if let result = localAI.result {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Local result", systemImage: "text.alignleft")
                        .font(.system(size: 12, weight: .bold))
                    Text(result)
                        .font(.system(size: 13))
                        .textSelection(.enabled)
                    if let receipt = localAI.lastReceipt {
                        Text("\(receipt.executionLocation) · Network used: \(receipt.networkUsed ? "Yes" : "No")")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                }
                .padding(16).card()
            }

            VStack(alignment: .leading, spacing: 6) {
                Label("Read-only security-scoped access", systemImage: "lock.doc")
                Label("32 KB text limit for bounded tasks", systemImage: "gauge.with.dots.needle.33percent")
                Label("No cloud fallback or full coding autonomy", systemImage: "cloud.slash")
                Label("No edits, writes, or hidden background access", systemImage: "pencil.slash")
            }
            .font(.system(size: 11.5, weight: .semibold))
            .foregroundStyle(DT.ink55(scheme))
            .padding(16).card()
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.plainText, .sourceCode, .json, .commaSeparatedText],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first { localAI.selectFile(url) }
            case .failure:
                break
            }
        }
    }
}

private struct MetricSettingsGrid: View {
    let metrics: [(String, String, String)]
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 10)], spacing: 10) {
            ForEach(Array(metrics.enumerated()), id: \.offset) { _, metric in
                VStack(alignment: .leading, spacing: 4) {
                    Text(metric.0).font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)
                    Text(metric.1).font(.system(size: 25, weight: .heavy))
                    Text(metric.2).font(.system(size: 10)).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14).card()
            }
        }
    }
}

private func settingsPanel<Content: View>(
    title: String,
    intro: String,
    @ViewBuilder content: () -> Content
) -> some View {
    ScrollView {
        VStack(alignment: .leading, spacing: 14) {
            Text(intro).font(.system(size: 12.5)).foregroundStyle(.secondary)
            content()
            Spacer(minLength: 30)
        }
        .padding(20)
    }
    .navigationTitle(title)
    .navigationBarTitleDisplayMode(.inline)
}

/// Configuration settings — how Drive behaves.
struct ConfigSettingsView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject private var drafts: SettingsDraftStore
    @Environment(\.colorScheme) private var scheme
    /// Typing must not retarget an active poll; commit on Return only.
    @State private var writerURLDraft = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("APPEARANCE")
                VStack(spacing: 0) {
                    HStack {
                        Text("Appearance").font(.system(size: 15))
                        Spacer()
                        Picker("", selection: $drafts.appearance) {
                            Text("System").tag("System")
                            Text("Light").tag("Light")
                            Text("Dark").tag("Dark")
                        }
                        .pickerStyle(.menu)
                        .tint(DT.ink55(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    HStack {
                        Text("Reduce motion").font(.system(size: 15))
                        Spacer()
                        Toggle("Reduce motion", isOn: $drafts.reduceMotion).labelsHidden().tint(DT.live(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                }
                .card()
                .padding(.top, 7)

                sectionLabel("VOICE").padding(.top, 20)
                VStack(spacing: 0) {
                    pickerRow("Mic default", selection: $drafts.micDefault, options: ["Muted", "Hot mic"])
                    hairline
                    pickerRow("Talk gesture", selection: $drafts.talkGesture, options: ["Hold to talk", "Tap to toggle"])
                }
                .card()
                .padding(.top, 7)
                footnote(drafts.micDefault == "Muted"
                         ? "Hold anywhere on the session strip to speak; release to send."
                         : "You're live when a session starts — tap the strip to mute.")

                sectionLabel("APPROVAL DEFAULTS").padding(.top, 20)
                VStack(spacing: 0) {
                    valueRow("New agents", value: "Edits need approval")
                    hairline
                    valueRow("Per-agent overrides", value: "Agents tab")
                }
                .card()
                .padding(.top, 7)
                footnote("Every edit is yours to allow — defaults only set where the ask happens.")

                sectionLabel("FOCUS & ARCHIVE").padding(.top, 20)
                VStack(spacing: 0) {
                    toggleRow("Auto-file quiet projects", isOn: $drafts.autoFile)
                    hairline
                    pickerRow("Sweep shipped tasks", selection: $drafts.sweepAge,
                              options: ["Right away", "After 3 days", "After 7 days"])
                    hairline
                    NavigationLink { NeverFileView() } label: {
                        valueRow("Never file", value: store.neverFileProjects.isEmpty
                                 ? "No exemptions"
                                 : "\(store.neverFileProjects.count) project\(store.neverFileProjects.count == 1 ? "" : "s")")
                    }
                    .buttonStyle(.plain)
                }
                .card()
                .padding(.top, 7)
                footnote("Filed work is never deleted — search finds it, restore brings it back. Exempt projects stay on the floor no matter how quiet.")

                sectionLabel("NOTIFICATIONS").padding(.top, 20)
                VStack(spacing: 0) {
                    toggleRow("Approvals", isOn: $drafts.notifyApprovals)
                    hairline
                    toggleRow("Blocked asks", isOn: $drafts.notifyBlocked)
                    hairline
                    toggleRow("Invitations", isOn: $drafts.notifyInvites)
                    hairline
                    toggleRow("Ships & streaks", isOn: $drafts.notifyShips)
                    hairline
                    toggleRow("Product news", isOn: $drafts.notifyProduct)
                    hairline
                    toggleRow("Quiet hours", isOn: $drafts.quietHours)
                    if drafts.quietHours {
                        HStack {
                            DatePicker("From", selection: timeBinding($drafts.quietFrom), displayedComponents: .hourAndMinute)
                                .labelsHidden()
                            Image(systemName: "arrow.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(DT.ink35(scheme))
                            DatePicker("To", selection: timeBinding($drafts.quietTo), displayedComponents: .hourAndMinute)
                                .labelsHidden()
                            Spacer()
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    }
                    hairline
                    pickerRow("If unanswered", selection: $drafts.escalation,
                              options: ["Do nothing", "Nudge after 10m", "Escalate to Slack"])
                    hairline
                    Button { NotificationManager.shared.sendTestReminder() } label: {
                        HStack {
                            Text("Send a test reminder").scaledFont(15)
                                .foregroundStyle(DT.violetText(scheme))
                            Spacer()
                            Image(systemName: "bell.badge")
                                .font(.system(size: 13))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .card()
                .padding(.top, 7)
                footnote(drafts.escalation == "Escalate to Slack"
                         ? "Slack escalation arrives with the Slack connection — the preference applies the moment it does."
                         : "Push arrives with the hub connection — these choices apply the moment it does. Approvals and blocked asks break through quiet hours only if you let them.")

                if store.configuration.feedbackExperimentsEnabled {
                    FeedbackSettingsSection().padding(.top, 20)
                }

                if store.configuration.writerSettingsVisible {
                    sectionLabel("WIRE").padding(.top, 20)
                    VStack(spacing: 0) {
                        HStack {
                            Text("Writer").scaledFont(15)
                            Spacer()
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(store.wireStatus.isLive ? DT.live(scheme) : DT.ink35(scheme))
                                    .frame(width: 6, height: 6)
                                Text(store.wireStatus.label)
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundStyle(DT.ink55(scheme))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        hairline
                        HStack {
                            Text("URL").scaledFont(15)
                                .accessibilityHidden(true)
                            TextField("Printed writer URL", text: $writerURLDraft)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .multilineTextAlignment(.trailing)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundStyle(DT.ink55(scheme))
                                .onSubmit { commitWriterURLDraft() }
                                .accessibilityLabel("Writer URL")
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        hairline
                        HStack {
                            Text("Intent").scaledFont(15)
                            Spacer()
                            Text("\(store.intent.diagnostics) · \(store.preheat.diagnostics)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(DT.ink55(scheme))
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    }
                    .card()
                    .padding(.top, 7)
                    footnote(store.wireStatus.isLive
                             ? "Tasks, artifacts, and the session program are coming from the connected event stream."
                             : "Paste the printed writer URL, or set DRIVEMODE_WRITER_URL / ~/.drivemode/writer.json. Preview allows loopback HTTP; identity is that URL, not :4600.")
                }

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Configuration")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { writerURLDraft = store.writerURL }
        .onChange(of: store.writerURL) { _, url in
            writerURLDraft = url
        }
    }

    private func commitWriterURLDraft() {
        store.applyWriterURL(writerURLDraft)
        writerURLDraft = store.writerURL
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }
    private func sectionLabel(_ s: String) -> some View {
        Eyebrow(s).padding(.leading, 14).padding(.top, 8)
    }
    private func valueRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Text(value).scaledFont(14).foregroundStyle(DT.ink55(scheme))
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
        .contentShape(Rectangle())
    }
    private func pickerRow(_ label: String, selection: Binding<String>, options: [String]) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Picker(label, selection: selection) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .tint(DT.ink55(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
    }
    private func toggleRow(_ label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Toggle(label, isOn: isOn).labelsHidden().tint(DT.live(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
    }
    /// Quiet-hours storage is minutes-from-midnight; the pickers speak Date.
    private func timeBinding(_ minutes: Binding<Int>) -> Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(bySettingHour: minutes.wrappedValue / 60,
                                      minute: minutes.wrappedValue % 60,
                                      second: 0, of: Date()) ?? Date()
            },
            set: { date in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
                minutes.wrappedValue = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
            })
    }
    private func footnote(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11))
            .foregroundStyle(DT.ink55(scheme))
            .padding(.horizontal, 14)
            .padding(.top, 7)
    }
}

/// Projects exempt from every auto-file path — added from a project card's
/// long-press, removed here.
struct NeverFileView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("These projects stay on the floor no matter how quiet they get. Add one by long-pressing its card in Tasks.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 8)

                if store.neverFileProjects.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "pin.slash")
                            .font(.system(size: 24, weight: .light))
                            .foregroundStyle(DT.ink35(scheme))
                        Text("No exemptions yet")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                } else {
                    LazyVStack(spacing: 9) {
                        ForEach(store.neverFileProjects.sorted(), id: \.self) { projectId in
                            HStack(spacing: 11) {
                                Image(systemName: "archivebox.circle")
                                    .font(.system(size: 15))
                                    .foregroundStyle(DT.violetText(scheme))
                                Text(projectId)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(DT.ink(scheme))
                                    .lineLimit(1)
                                Spacer()
                                Button { store.toggleNeverFile(projectId) } label: {
                                    Text("Remove")
                                        .font(.system(size: 12.5, weight: .bold))
                                        .foregroundStyle(DT.ink55(scheme))
                                        .padding(.horizontal, 12).padding(.vertical, 7)
                                        .background(DT.surface2(scheme))
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(Pressable())
                            }
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .card()
                        }
                    }
                    .padding(.top, 14)
                }
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Never file")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Personal settings — privacy honesty and account.
struct PrivacyAccountView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var drafts: SettingsDraftStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("PRIVACY")
                VStack(spacing: 0) {
                    if store.configuration.previewContentEnabled {
                        HStack {
                            Text("Transcripts").font(.system(size: 15))
                            Spacer()
                            HStack(spacing: 6) {
                                Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
                                Text("Never stored").font(.system(size: 14)).foregroundStyle(DT.ink55(scheme))
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        hairline
                        valueRow("Work events", value: "Current writer")
                    } else {
                        valueRow("Account service", value: "Not connected")
                        hairline
                        valueRow("Work host", value: store.wireStatus.isLive ? "Connected" : "Not connected")
                    }
                }
                .card()
                .padding(.top, 7)
                footnote(store.configuration.previewContentEnabled
                         ? "Conversation stays in memory. Preview behavior is not a production retention promise."
                         : "Drive shows only connected service state. Hosted transfer and retention disclosures must be approved before a host can connect.")

                sectionLabel("POLICIES").padding(.top, 20)
                VStack(spacing: 0) {
                    NavigationLink { PrivacyPolicyView() } label: {
                        valueRow("Privacy policy", value: "v0.3")
                    }
                    .buttonStyle(.plain)
                    hairline
                    NavigationLink { DataPolicyView() } label: {
                        valueRow("Data policy", value: "v0.3")
                    }
                    .buttonStyle(.plain)
                    if store.configuration.feedbackExperimentsEnabled {
                        hairline
                        NavigationLink { FeedbackPolicyView() } label: {
                            valueRow("Feedback mode policy", value: "v0.3")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .card()
                .padding(.top, 7)
                footnote("Plain language, versioned — widening any collection re-asks for consent.")

                sectionLabel("ACCOUNT").padding(.top, 20)
                VStack(spacing: 0) {
                    if store.configuration.previewContentEnabled {
                        HStack {
                            Text("Signed in").font(.system(size: 15))
                            Spacer()
                            Text(verbatim: drafts.email)
                                .font(.system(size: 13))
                                .foregroundStyle(DT.ink55(scheme))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        hairline
                        valueRow("Invite links", value: "Preview only")
                    } else {
                        valueRow("Status", value: "Not signed in")
                        hairline
                        valueRow("Account actions", value: "Unavailable")
                    }
                }
                .card()
                .padding(.top, 7)

                Text(store.configuration.previewContentEnabled
                     ? "Drive 0.2 · MC1 preview"
                     : productionVersionLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink35(scheme))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 32)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Privacy & account")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var productionVersionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return "Drive \(version ?? "")"
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }
    private func sectionLabel(_ s: String) -> some View {
        Eyebrow(s).padding(.leading, 14).padding(.top, 8)
    }
    private func valueRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            if !value.isEmpty {
                Text(value).scaledFont(14).foregroundStyle(DT.ink55(scheme))
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
        .contentShape(Rectangle())
    }
    private func footnote(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11))
            .foregroundStyle(DT.ink55(scheme))
            .padding(.horizontal, 14)
            .padding(.top, 7)
    }
}
