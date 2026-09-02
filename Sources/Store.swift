import SwiftUI
import Combine

enum AppTab: Hashable { case home, work, agents, tasks }

/// A typed message sent into the live session — for when you don't want
/// to speak. Ephemeral by design: memory only, cleared on leave.
struct SessionMessage: Identifiable, Equatable {
    let id = UUID()
    let text: String
}

@MainActor
final class AppStore: ObservableObject {
    let configuration: AppConfiguration
    let intent = IntentRecorder()
    let preheat = PreheatEngine()
    var wireBackoff: Double = 1.5
    @Published var launched = false
    @Published var selectedTab: AppTab = .home
    @Published var settingsRoute: SettingsRoute?
    @Published var inCall = false
    @Published var showApproval = false
    @Published var editAllowed = false
    @Published var micHeld = false
    @Published var handRaised = false
    @Published var agents = DemoData.agents
    @Published var interrupts = DemoData.interrupts

    // MARK: Chat-first Work

    @Published var workTargets = WorkTargetRef.previews
    @Published var selectedWorkTargetID = WorkTargetRef.previews[0].id
    @Published var workChatMessages: [WorkChatMessage] = []
    @Published var defaultCallPreset = CallPreset.loadDefault() {
        didSet { defaultCallPreset.saveDefault() }
    }
    @Published var activeCallPresenterCandidateIDs: [String] = []
    @Published var titleGrantsByID: [String: AgentTitleGrant] = [:]
    @Published var titleEventLog: [AgentTitleEventReceipt] = []
    @Published var titleMutationError: String?

    var selectedWorkTarget: WorkTargetRef {
        workTargets.first { $0.id == selectedWorkTargetID }
            ?? workTargets[0]
    }

    var callPresetForCurrentTarget: CallPreset {
        var preset = defaultCallPreset
        if !preset.targetIDs.contains(selectedWorkTargetID) {
            preset.targetIDs = [selectedWorkTargetID]
        }
        preset.presenterCandidateIDs = preset.presenterCandidateIDs.filter(preset.agentIDs.contains)
        return preset
    }

    func selectWorkTarget(_ id: String) {
        guard workTargets.contains(where: { $0.id == id }) else { return }
        selectedWorkTargetID = id
    }

    func startNewWorkChat() {
        workChatMessages.removeAll()
    }

    @discardableResult
    func sendWorkChat(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, selectedWorkTarget.canUse else { return false }
        workChatMessages.append(WorkChatMessage(text: trimmed))
        postConversation(trimmed)
        return true
    }

    func launchCall(preset: CallPreset, saveAsDefault: Bool) {
        let validTargetIDs = preset.targetIDs.filter { id in
            workTargets.contains { $0.id == id && $0.canUse }
        }
        let validAgentIDs = preset.agentIDs.filter { id in agents.contains { $0.id == id } }
        guard !validTargetIDs.isEmpty, !validAgentIDs.isEmpty else { return }

        var sanitized = preset
        sanitized.targetIDs = validTargetIDs
        sanitized.agentIDs = validAgentIDs
        sanitized.presenterCandidateIDs = preset.presenterCandidateIDs.filter(validAgentIDs.contains)
        if saveAsDefault { defaultCallPreset = sanitized }
        selectedWorkTargetID = validTargetIDs[0]
        joinCall(presenterCandidates: sanitized.presenterCandidateIDs)
    }

    func openSettings(_ tab: SettingsTab, source: SettingsSource) {
        settingsRoute = SettingsRoute(initialTab: tab, source: source)
    }
    /// First paint carries only the curated narrative; the generated fleet
    /// (~220 projects, ~1,200 tasks) is seeded off-main right after launch.
    @Published var tasks = DemoData.curatedTasks {
        didSet { rebuildTaskIndex() }
    }

    // Scale indices — grouped and aggregated once per mutation, so the
    // overview renders O(visible cards) even with thousands of tasks.
    // Projects derive from the data: the demo registry plus any room the
    // wire ships tasks for.
    private(set) var projects = DemoData.baseProjects
    private(set) var tasksByProject: [String: [TaskItem]] = [:]
    private(set) var aggByProject: [String: ProjectAgg] = [:]
    private(set) var orderedProjects: [Project] = []
    private(set) var attentionTasks: [TaskItem] = []

    // MARK: Archive — outdated work is filed, never deleted. Archived items
    // leave every default surface but stay searchable and restorable.
    @Published var archivedProjects: Set<String> = []
    @Published var archivedTasks: Set<String> = []
    @Published var sweeping = false

    // MARK: Pins — the user's own order beats attention-sort.
    @Published var pinnedProjects: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "pinnedProjects") ?? []) {
        didSet {
            UserDefaults.standard.set(Array(pinnedProjects), forKey: "pinnedProjects")
            rebuildTaskIndex()
        }
    }

    // MARK: Archive policy — the sweep obeys the user, not the other way
    // round: exempt projects never auto-file, and an aging threshold keeps
    // fresh ships on the floor a while.
    @Published var neverFileProjects: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "neverFileProjects") ?? []) {
        didSet {
            UserDefaults.standard.set(Array(neverFileProjects), forKey: "neverFileProjects")
            rebuildTaskIndex()
        }
    }

    func toggleNeverFile(_ projectId: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            if neverFileProjects.contains(projectId) {
                neverFileProjects.remove(projectId)
            } else {
                neverFileProjects.insert(projectId)
                archivedProjects.remove(projectId)
            }
        }
    }

    /// "Right away" | "After 3 days" | "After 7 days" — wire tasks carry real
    /// clocks (`wireTaskAt`); demo tasks have none and sweep immediately.
    static var sweepAgeDays: Int? {
        switch UserDefaults.standard.string(forKey: "archive.sweepAge") {
        case "After 3 days": return 3
        case "After 7 days": return 7
        default: return nil
        }
    }

    static var autoFileEnabled: Bool {
        UserDefaults.standard.object(forKey: "archive.autoFile") == nil
            ? true
            : UserDefaults.standard.bool(forKey: "archive.autoFile")
    }

    func togglePin(_ projectId: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            if pinnedProjects.contains(projectId) {
                pinnedProjects.remove(projectId)
            } else {
                pinnedProjects.insert(projectId)
            }
        }
    }

    func archiveProject(_ projectId: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            archivedProjects.insert(projectId)
            rebuildTaskIndex()
        }
    }

    /// Bulk file — the fleet-scale gesture.
    func archiveTasks(_ ids: Set<String>) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            archivedTasks.formUnion(ids)
            rebuildTaskIndex()
        }
    }

    init(configuration: AppConfiguration = .current) {
        self.configuration = configuration
        writerURL = configuration.initialWriterURL()

        if !configuration.previewContentEnabled {
            agents = []
            interrupts = []
            workTargets = [.unconfigured]
            selectedWorkTargetID = WorkTargetRef.unconfigured.id
            defaultCallPreset = .unavailable
            tasks = []
            projects = []
            beats = []
            artifacts = []
            inbox = []
            memoryFiles = []
            upcomingSessions = []
        }
        launched = configuration.isUITesting

        // Focus by default: quiet projects (nothing running, nothing needing
        // a human) arrive already filed. The ethos — deep, not sprawling.
        if Self.autoFileEnabled {
            archivedProjects.formUnion(Self.quietProjects(in: tasks).subtracting(neverFileProjects))
        }
        rebuildTaskIndex()
        if configuration.previewContentEnabled {
            seedFleet()
        }
    }

    private nonisolated static func quietProjects(in tasks: [TaskItem]) -> Set<String> {
        var quiet: Set<String> = []
        for (project, items) in Dictionary(grouping: tasks, by: \.room) {
            let hasPulse = items.contains { $0.state == .running || $0.state == .review || $0.state == .blocked }
            if !hasPulse { quiet.insert(project) }
        }
        return quiet
    }

    /// The demo fleet is heavy to generate — build it off the main thread so
    /// the Open screen paints instantly, then install it in one index rebuild.
    private func seedFleet() {
        Task.detached(priority: .utility) { [weak self] in
            let generated = DemoScale.generated
            let quiet = Self.quietProjects(in: generated.tasks)
            await self?.installFleet(projects: generated.projects, tasks: generated.tasks, quiet: quiet)
        }
    }

    private func installFleet(projects newProjects: [Project], tasks newTasks: [TaskItem], quiet: Set<String>) {
        // If the wire went live first, the wire owns the world — skip the demo.
        guard wireTasks.isEmpty else { return }
        projects = newProjects
        if Self.autoFileEnabled {
            archivedProjects.formUnion(quiet.subtracting(neverFileProjects))
        }
        tasks = newTasks   // the single didSet index rebuild
    }

    func isArchived(_ task: TaskItem) -> Bool {
        archivedTasks.contains(task.id) || archivedProjects.contains(task.room)
    }

    /// Precomputed in rebuildTaskIndex — read every TasksView body.
    private(set) var archivedCount = 0
    private(set) var sweepCandidateCount = 0

    /// Shipped tasks inside still-active projects — the clutter the Tidy
    /// sweep files next. Active work is never sweep-eligible; neither are
    /// exempt projects, nor ships younger than the aging threshold.
    private var sweepCandidates: [TaskItem] {
        let minAge = Self.sweepAgeDays.map { TimeInterval($0) * 86_400 }
        return tasks.filter { task in
            guard task.state == .done, !isArchived(task),
                  !neverFileProjects.contains(task.room) else { return false }
            if let minAge, let at = wireTaskAt[task.id] {
                return Date().timeIntervalSince(at) >= minAge
            }
            return true
        }
    }

    func sweepArchive() {
        sweeping = true
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 900_000_000)
            guard let self else { return }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                self.archivedTasks.formUnion(self.sweepCandidates.map(\.id))
                self.rebuildTaskIndex()
                self.sweeping = false
            }
        }
    }

    func restoreProject(_ projectId: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            archivedProjects.remove(projectId)
            for task in tasks where task.room == projectId {
                archivedTasks.remove(task.id)
            }
            rebuildTaskIndex()
        }
    }

    private func rebuildTaskIndex() {
        tasksByProject = Dictionary(grouping: tasks.filter { !isArchived($0) }, by: \.room)
        let known = Set(projects.map(\.id))
        for room in tasksByProject.keys where !known.contains(room) {
            projects.append(Project(id: room, name: room, area: "Wire"))
        }
        var aggs: [String: ProjectAgg] = [:]
        for (project, items) in tasksByProject {
            var agg = ProjectAgg()
            agg.total = items.count
            for t in items {
                switch t.state {
                case .running: agg.running += 1
                case .review: agg.review += 1
                case .blocked: agg.blocked += 1
                case .queued: agg.queued += 1
                case .done: agg.done += 1
                }
            }
            aggs[project] = agg
        }
        aggByProject = aggs
        orderedProjects = projects.filter { !archivedProjects.contains($0.id) && (aggs[$0.id]?.total ?? 0) > 0 }.sorted { a, b in
            let ap = pinnedProjects.contains(a.id)
            let bp = pinnedProjects.contains(b.id)
            if ap != bp { return ap }
            let aa = aggs[a.id] ?? ProjectAgg()
            let bb = aggs[b.id] ?? ProjectAgg()
            if aa.attention != bb.attention { return aa.attention > bb.attention }
            if aa.running != bb.running { return aa.running > bb.running }
            return aa.total > bb.total
        }
        attentionTasks = tasks.filter { $0.state == .blocked || $0.state == .review }
            .sorted { a, b in
                if (a.state == .blocked) != (b.state == .blocked) { return a.state == .blocked }
                return a.title < b.title
            }
        archivedCount = tasks.lazy.filter { self.isArchived($0) }.count
        sweepCandidateCount = sweepCandidates.count

        // Preheat: fold the search corpus and warm the likely-next maps.
        preheat.rebuildSearchIndex(tasks: tasks.filter { !isArchived($0) })
        let hot = orderedProjects.prefix(4).map(\.id)
        let attentionRooms = attentionTasks.prefix(3).map(\.room)
        let warmIds = Array(Set(hot + attentionRooms))
        preheat.warm(projects: warmIds.compactMap { id in
            tasksByProject[id].map { (id, $0) }
        })
    }

    func agg(_ projectId: String) -> ProjectAgg { aggByProject[projectId] ?? ProjectAgg() }

    /// Search spans the archive too — filed, not deleted. Active matches
    /// come first; archived matches arrive labeled, never as clutter.
    func searchTasks(_ query: String) -> (active: [TaskItem], archived: [TaskItem]) {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return ([], []) }
        // Active side rides the preheated folded index — no per-keystroke
        // lowercasing of the whole fleet.
        let activeIds = Set(preheat.searchIndex.filter { $0.folded.contains(q) }.map(\.id))
        var active: [TaskItem] = []
        var filed: [TaskItem] = []
        for task in tasks {
            if activeIds.contains(task.id) {
                active.append(task)
            } else if isArchived(task),
                      task.title.lowercased().contains(q) || task.room.lowercased().contains(q) {
                filed.append(task)
            }
        }
        return (active, filed)
    }

    // MARK: Guide bar — ambient navigation. Fades when idle; summoned by a
    // bottom-center press or swipe-up. Never pops up mid-swipe between pages:
    // a swiping user already knows the way.
    @Published var tabBarVisible = true
    private var hideGeneration = 0

    func scheduleTabBarHide(after seconds: Double = 6) {
        hideGeneration += 1
        let gen = hideGeneration
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard let self, gen == self.hideGeneration, self.tabBarVisible else { return }
            withAnimation(.easeInOut(duration: 0.3)) { self.tabBarVisible = false }
        }
    }

    func summonTabBar() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { tabBarVisible = true }
        scheduleTabBarHide()
    }

    /// Bar interactions while visible keep it alive a little longer.
    func touchTabBar() {
        guard tabBarVisible else { return }
        scheduleTabBarHide()
    }

    // MARK: Skills — capability loadouts per agent (AgentSkills.swift),
    // multi-file packages + kits (SkillPackages.swift). Bumped on any equip
    // change so every skill surface re-renders; usage is observed off the
    // durable log per actor, never self-reported.
    @Published var skillsVersion = 0
    var wireSkillUse: [String: [String: Int]] = [:]

    @Published var skillPackages: [SkillPackage] = SkillPackage.load() {
        didSet { SkillPackage.save(skillPackages) }
    }

    @Published var skillBundles: [SkillBundle] = SkillBundle.load() {
        didSet { SkillBundle.save(skillBundles) }
    }

    func package(_ id: String) -> SkillPackage? {
        skillPackages.first { $0.id == id }
    }

    func updatePackage(_ package: SkillPackage) {
        guard let i = skillPackages.firstIndex(where: { $0.id == package.id }) else { return }
        skillPackages[i] = package
    }

    func addPackage(_ package: SkillPackage) {
        skillPackages.append(package)
    }

    func addBundle(name: String, note: String, skillIds: [String]) {
        skillBundles.append(SkillBundle(
            id: "kit-\(Int(Date().timeIntervalSince1970))",
            name: name, note: note, skillIds: skillIds, builtIn: false))
    }

    // MARK: Memory — the fleet's notebooks (AgentMemory.swift): agent,
    // session, task, project, and plan scopes; hooks always load, bodies
    // load when relevant.
    @Published var memoryFiles: [MemoryFile] = MemoryFile.load() {
        didSet { MemoryFile.save(memoryFiles) }
    }

    // MARK: Work page — sessions that exist before they're live. The durable
    // registry is wire truth when connected; these persisted rows are the
    // explicitly labeled offline fallback (docs/WORK-PAGE.md).
    @Published var upcomingSessions: [UpcomingSession] = UpcomingSession.load() {
        didSet { UpcomingSession.save(upcomingSessions) }
    }
    @Published var wireUpcomingSessions: [UpcomingSession] = []
    @Published var wireActiveSession: UpcomingSession?
    @Published var wireActiveProgramId: String?
    @Published var lastSessionError: String?

    /// Once a live wire has supplied registry rows, a drop keeps the last
    /// synced session view intact under the reconnect chip. Falling back to
    /// unrelated on-device rows would make NOW and UPCOMING disagree.
    var usesWireSessionRegistry: Bool {
        wireStatus.isLive || (wireDropped && !wireSessions.isEmpty)
    }

    var displayedUpcomingSessions: [UpcomingSession] {
        usesWireSessionRegistry ? wireUpcomingSessions : upcomingSessions
    }

    var hasLiveSession: Bool {
        usesWireSessionRegistry ? wireActiveSession != nil : !beats.isEmpty
    }

    var liveSessionTitle: String {
        usesWireSessionRegistry
            ? wireActiveSession?.title ?? "Working session"
            : "Ship auth middleware"
    }

    var liveSessionPeople: [String] {
        if usesWireSessionRegistry { return wireActiveSession?.people ?? [] }
        return ["You"] + agents.map(\.name)
    }

    /// The name shown for the local user: the saved profile name, else the
    /// preview account label, else the honest disconnected label.
    var profileDisplayName: String {
        let saved = UserDefaults.standard.string(forKey: "profile.displayName")?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !saved.isEmpty { return saved }
        return configuration.previewContentEnabled ? "Preview" : "Drive account"
    }

    /// One letter for avatar chips, derived from `profileDisplayName`.
    var profileInitial: String {
        String(profileDisplayName.prefix(1)).uppercased()
    }

    var hasLiveProgramBeats: Bool {
        usesWireSessionRegistry ? !wireBeats.isEmpty && !beats.isEmpty : !beats.isEmpty
    }

    func planSession(_ session: UpcomingSession, inviteeIds: [String]) async -> Bool {
        lastSessionError = nil
        if wireDropped {
            lastSessionError = "Reconnect to the room log before sending invitations."
            return false
        }
        if wireStatus.isLive {
            do {
                try await publishSessionPlan(session, inviteeIds: inviteeIds)
                return true
            } catch {
                lastSessionError = "Writer didn’t finish publishing. Check the room log before retrying."
                return false
            }
        }

        upcomingSessions.insert(session, at: 0)
        inbox.insert(InboxItem(
            id: "up-\(session.id)", kind: .invite,
            title: "You invited \(session.people.joined(separator: " & ")) to a working session",
            body: "\(session.title) — \(session.when). \(session.agendaCount) agenda item\(session.agendaCount == 1 ? "" : "s").",
            age: "now", read: true), at: 0)
        NotificationManager.shared.scheduleSessionReminder(session)
        return true
    }

    func removeUpcoming(_ id: String) {
        if wireStatus.isLive {
            Task { [weak self] in
                try? await self?.cancelWireSession(id)
            }
            return
        }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            upcomingSessions.removeAll { $0.id == id }
        }
    }

    // MARK: Feedback & experiments — see docs/FEEDBACK-MODE.md. Two switches
    // must both be on (program + device opt-in); trials are presentation-only
    // variant flags with a hard 7-day clock; the kill switch clears it all.

    @Published var feedbackProgramOn: Bool = UserDefaults.standard.object(forKey: "feedback.program") == nil
        ? true : UserDefaults.standard.bool(forKey: "feedback.program") {
        didSet {
            UserDefaults.standard.set(feedbackProgramOn, forKey: "feedback.program")
            if !feedbackProgramOn { feedbackKillSwitch() }
        }
    }

    @Published var feedbackOptIn = UserDefaults.standard.bool(forKey: "feedback.optIn") {
        didSet { UserDefaults.standard.set(feedbackOptIn, forKey: "feedback.optIn") }
    }

    @Published var experiments: [Experiment] = Experiment.load() {
        didSet { Experiment.save(experiments) }
    }

    var feedbackAvailable: Bool {
        configuration.feedbackExperimentsEnabled && feedbackProgramOn && feedbackOptIn
    }

    /// True while a presentation variant is in an unexpired trial.
    func variantActive(_ flag: String) -> Bool {
        guard configuration.feedbackExperimentsEnabled else { return false }
        return experiments.contains {
            $0.flag == flag && $0.status == .trialing && ($0.expiresAt.map { $0 > Date() } ?? false)
        }
    }

    /// The one-week rule enforces itself: run at launch and on foreground.
    func sweepExperiments() {
        guard configuration.feedbackExperimentsEnabled else { return }
        var changed = experiments
        var any = false
        for i in changed.indices where changed[i].status == .trialing {
            if let end = changed[i].expiresAt, end <= Date() {
                changed[i].status = .expired
                any = true
            }
        }
        guard any else { return }
        experiments = changed
        inbox.insert(InboxItem(
            id: "exp-expired-\(Int(Date().timeIntervalSince1970))", kind: .tip,
            title: "A trial reached its week",
            body: "The variant reverted itself — trials never outstay the 7-day clock. The suggestion stays in review.",
            age: "now"), at: 0)
    }

    func startTrial(_ id: String) {
        guard configuration.feedbackExperimentsEnabled else { return }
        guard let i = experiments.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            experiments[i].status = .trialing
            experiments[i].startedAt = Date()
            experiments[i].expiresAt = Date().addingTimeInterval(7 * 86_400)
        }
    }

    func endTrial(_ id: String) {
        guard let i = experiments.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            experiments[i].status = .reverted
        }
    }

    /// The only thing that ever leaves the chat: the structured suggestion,
    /// on an explicit send. (Client-side inbox in the preview build.)
    func submitSuggestion(title: String, summary: String, surface: String, flag: String?) {
        guard configuration.feedbackExperimentsEnabled else { return }
        let id = "sug-\(Int(Date().timeIntervalSince1970))"
        experiments.insert(Experiment(
            id: id, title: title, detail: summary, surface: surface,
            flag: flag ?? "", status: .suggested,
            startedAt: nil, expiresAt: nil, sentAt: Date()), at: 0)
        inbox.insert(InboxItem(
            id: "fb-\(id)", kind: .tip,
            title: "Suggestion sent — \(title)",
            body: "We review within a week: adopt it for everyone or retire it. Track it in Settings → Feedback & experiments.",
            age: "now"), at: 0)
    }

    /// Program off → bubble gone, trials reverted, opt-in cleared.
    private func feedbackKillSwitch() {
        feedbackOptIn = false
        var changed = experiments
        for i in changed.indices where changed[i].status == .trialing {
            changed[i].status = .reverted
        }
        experiments = changed
    }

    // MARK: Wire — consumption of the drivemode-mcp writer
    @Published var writerURL = ""
    @Published var wireStatus: WireStatus = .offline
    /// True once a live wire has dropped — drives the reconnect chip. Cleared
    /// the moment events flow again.
    @Published var wireDropped = false
    var wireSeq = -1
    var wireTask: Task<Void, Never>?
    var wireTasks: [String: TaskItem] = [:]
    var wireTaskAt: [String: Date] = [:]
    var wireTaskOrder: [String] = []
    var wireArtifacts: [String: Artifact] = [:]
    var wireArtifactOrder: [String] = []
    var wireBeats: [String: Beat] = [:]
    var wireBeatRelated: [String: [String]] = [:]
    var wireBeatPrograms: [String: String] = [:]
    var wireSessions: [String: WireSessionRecord] = [:]
    var wireReminderScheduled: Set<String> = []
    /// Room roster + latest per-actor work line, from control.join / work.*.
    var wireParticipants: [String: WireParticipant] = [:]
    var wireActorStatus: [String: (line: String, at: Date)] = [:]
    /// eventId → display line, so beats can stage their related work events.
    var wireEventTitles: [String: String] = [:]
    var wireEventOrder: [String] = []

    // Director state for the Presenter-stage program
    @Published var beats = DemoData.beats
    @Published var callStart = Date()
    @Published var beatSkew: TimeInterval = 0

    private var approvalTask: Task<Void, Never>?

    /// Threads for interrupt conversations, seeded lazily per interrupt.
    @Published var conversations: [String: [ConvMessage]] = [:]

    /// Artifacts, mutable so lifecycle (permanent vs ephemeral TTL) can be
    /// set per artifact from the gallery.
    @Published var artifacts = DemoData.artifacts

    // MARK: Inbox

    @Published var inbox = DemoData.inbox

    var unreadInboxCount: Int { inbox.filter { !$0.read && !$0.archived }.count }

    func markInbox(_ id: String, read: Bool) {
        if let i = inbox.firstIndex(where: { $0.id == id }) { inbox[i].read = read }
    }

    func archiveInbox(_ id: String, _ archived: Bool = true) {
        if let i = inbox.firstIndex(where: { $0.id == id }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                inbox[i].archived = archived
                if archived { inbox[i].read = true }
            }
        }
    }

    func deleteInbox(_ id: String) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            inbox.removeAll { $0.id == id }
        }
    }

    func setArtifactLife(_ id: String, _ life: ArtifactLife) {
        if let i = artifacts.firstIndex(where: { $0.id == id }) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                artifacts[i].life = life
            }
        }
    }

    var needsYouCount: Int { interrupts.filter { !$0.resolved && $0.kind != .review }.count }
    var openInterrupts: [Interrupt] { interrupts.filter { !$0.resolved && $0.kind != .review } }
    var reportingCount: Int { agents.filter { $0.state != .stuck }.count }
    var stuckCount: Int { agents.filter { $0.state == .stuck }.count }
    var runningTasks: Int { tasks.filter { $0.state == .running }.count }

    // MARK: Director

    var programDuration: TimeInterval { beats.reduce(0) { $0 + $1.duration } }

    /// Current beat index and 0..1 progress within it.
    func directorPosition(at now: Date) -> (index: Int, progress: Double) {
        Director.position(beats: beats, elapsed: now.timeIntervalSince(callStart) + beatSkew)
    }

    /// Forward skips land 55% into the next beat: skimmers see the beat's
    /// revealed payoff, not the build-up. (The caption still names who's
    /// talking, so the audio thread survives fast navigation.)
    func skipToNextBeat() {
        let (i, p) = directorPosition(at: Date())
        let next = (i + 1) % beats.count
        beatSkew += beats[i].duration * (1 - p) + beats[next].duration * 0.55
    }

    func skipToPreviousBeat() {
        let (i, p) = directorPosition(at: Date())
        if p > 0.2 {
            beatSkew -= beats[i].duration * p - 0.01 // restart current beat
        } else {
            let prev = (i - 1 + beats.count) % beats.count
            beatSkew -= beats[i].duration * p + beats[prev].duration - 0.01
        }
    }

    // MARK: Call lifecycle

    func joinCall(presenterCandidates: [String]? = nil) {
        launched = true
        inCall = true
        callStart = Date()
        beatSkew = 0
        intent.record(.work)
        if let presenterCandidates {
            activeCallPresenterCandidateIDs = presenterCandidates
        } else if activeCallPresenterCandidateIDs.isEmpty {
            activeCallPresenterCandidateIDs = defaultCallPreset.presenterCandidateIDs
        }
        activateDefaultPresenterIfNeeded()
        if !editAllowed {
            approvalTask?.cancel()
            approvalTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 6_000_000_000)
                guard let self, !Task.isCancelled, self.inCall, !self.editAllowed else { return }
                self.showApproval = true
            }
        }
    }

    func leaveCall() {
        revokePresenter()
        inCall = false
        showApproval = false
        approvalTask?.cancel()
        sessionMessages.removeAll()   // conversation lives in memory only
        activeCallPresenterCandidateIDs.removeAll()
    }

    // MARK: In-session typing — the voice lane's quiet sibling

    @Published var sessionMessages: [SessionMessage] = []

    func sendSessionMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            sessionMessages.append(SessionMessage(text: trimmed))
            if sessionMessages.count > 3 { sessionMessages.removeFirst() }
        }
        postConversation(trimmed)   // joins the room's feed when the wire is live
    }

    func allowEdit() {
        editAllowed = true
        showApproval = false
        resolveInterrupt(id: "approve-auth")
        if let i = agents.firstIndex(where: { $0.id == "coder" }) {
            agents[i].statusLine = "Landing requireAuth · tests queued"
            agents[i].age = "2s"
            agents[i].state = .working
        }
    }

    func denyEdit() {
        showApproval = false
        resolveInterrupt(id: "approve-auth")
        if let i = agents.firstIndex(where: { $0.id == "coder" }) {
            agents[i].statusLine = "Edit denied — drafting alternative"
            agents[i].age = "1s"
            agents[i].state = .working
        }
    }

    func resolveInterrupt(id: String) {
        if let i = interrupts.firstIndex(where: { $0.id == id }) {
            interrupts[i].resolved = true
        }
    }

    // MARK: Conversations

    func thread(for interruptId: String) -> [ConvMessage] {
        if let existing = conversations[interruptId] { return existing }
        let seeded = DemoData.seedConversation(for: interruptId)
        conversations[interruptId] = seeded
        return seeded
    }

    /// Send a quick reply into an interrupt conversation; the agent acks and
    /// the blocked work resumes (visible on the task map).
    func sendReply(interruptId: String, _ text: String) {
        var msgs = thread(for: interruptId)
        msgs.append(ConvMessage(sender: .you, text: text, time: "now"))
        conversations[interruptId] = msgs
        resolveInterrupt(id: interruptId)

        if interruptId == "blocked-scout" {
            if let i = agents.firstIndex(where: { $0.id == "scout" }) {
                agents[i].statusLine = "Rotating staging secrets · env"
                agents[i].age = "1s"
                agents[i].state = .working
            }
            // Single write — the didSet index rebuild runs once, not thrice.
            if let t = tasks.firstIndex(where: { $0.id == "t4" }) {
                var task = tasks[t]
                task.state = .running
                task.progress = 0.08
                task.detail = "Reading env.DATABASE_URL"
                tasks[t] = task
            }
        }

        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard let self else { return }
            var updated = self.thread(for: interruptId)
            let ack: String
            switch interruptId {
            case "blocked-scout":
                ack = "On it — reading env.DATABASE_URL. I'll report when staging is green."
            case "review-maya":
                ack = "Noted — I'll keep the plan parked until you open it."
            default:
                ack = "Got it."
            }
            updated.append(ConvMessage(sender: .agent, text: ack, time: "now"))
            self.conversations[interruptId] = updated
        }
    }

    /// Derived from callStart — no per-second published tick invalidating
    /// the whole store (render it inside a TimelineView.periodic leaf).
    nonisolated func callClock(at date: Date, start: Date) -> String {
        let seconds = 724 + max(0, Int(date.timeIntervalSince(start)))
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
