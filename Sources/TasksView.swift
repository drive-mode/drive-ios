import SwiftUI

/// Tasks at fleet scale: hundreds of projects, thousands of tasks.
/// Level-of-detail IA — attention rail first, then project cards (lazy grid),
/// then one project's dependency map on drill-in. Search cuts across all of it.
struct TasksView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var mode = "Projects"
    @State private var query = ""
    @State private var selecting = false
    @State private var selectedIds: Set<String> = []

    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    statusStrip.padding(.top, 8)
                    searchField.padding(.top, 12)

                    if searching {
                        SearchResults(query: query)
                    } else {
                        attentionRail
                        tidyCard
                        HStack(spacing: 8) {
                            modeToggle
                            if mode == "All tasks" {
                                Button {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                                        selecting.toggle()
                                        if !selecting { selectedIds = [] }
                                    }
                                } label: {
                                    Text(selecting ? "Done" : "Select")
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(selecting ? .white : DT.violetText(scheme))
                                        .padding(.horizontal, 14)
                                        .frame(height: 40)
                                        .background(selecting ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.violet.opacity(0.10)))
                                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                                }
                                .buttonStyle(Pressable())
                            }
                        }
                        .padding(.top, 18)
                        if mode == "Projects" {
                            projectGrid
                        } else {
                            AllTasksList(selecting: $selecting, selectedIds: $selectedIds)
                        }
                        archiveFooter
                    }
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .tabSwipe()
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Tasks")
            .overlay(alignment: .bottom) {
                if selecting && !selectedIds.isEmpty {
                    Button {
                        store.archiveTasks(selectedIds)
                        withAnimation { selectedIds = []; selecting = false }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "archivebox")
                                .font(.system(size: 14, weight: .semibold))
                            Text("File \(selectedIds.count) to archive")
                                .font(.system(size: 15, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 22)
                        .frame(height: 50)
                        .background(DT.heroGradient)
                        .clipShape(Capsule())
                        .shadow(color: DT.violet.opacity(0.4), radius: 14, y: 6)
                    }
                    .buttonStyle(Pressable())
                    .padding(.bottom, 18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .sensoryFeedback(.success, trigger: selecting)
                }
            }
        }
    }

    // MARK: Header

    private var statusStrip: some View {
        HStack(spacing: 9) {
            NavigationLink { NeedsYouRouter() } label: {
                stripTile("\(store.needsYouCount)", "Need you", accent: true)
            }
            .buttonStyle(Pressable())
            stripTile("\(countRunning)", "Running", live: true)
            stripTile("\(store.attentionTasks.filter { $0.state == .blocked }.count)", "Blocked", danger: true)
        }
    }

    private var countRunning: Int {
        store.aggByProject.values.reduce(0) { $0 + $1.running }
    }

    private var searchField: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(DT.ink35(scheme))
            TextField("Search \(store.tasks.count) tasks · \(store.projects.count) projects", text: $query)
                .font(.system(size: 15))
                .autocorrectionDisabled()
            if searching {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(DT.ink35(scheme))
                }
                .buttonStyle(Pressable())
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
        .background(DT.surface2(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }

    /// The queue of things a human must touch — O(attention), never O(tasks).
    private var attentionRail: some View {
        Group {
            let items = store.attentionTasks
            if !items.isEmpty {
                HStack {
                    Eyebrow("NEEDS A HUMAN")
                    Spacer()
                    Text("\(items.count)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(DT.violetText(scheme))
                }
                .padding(.top, 18)
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 9) {
                        ForEach(items.prefix(14)) { task in
                            NavigationLink { ProjectDetailView(projectId: task.room, focusTaskId: task.id) } label: {
                                attentionCard(task)
                            }
                            .buttonStyle(Pressable())
                        }
                        if items.count > 14 {
                            Text("+\(items.count - 14) more")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(DT.ink55(scheme))
                                .padding(.horizontal, 14)
                        }
                    }
                }
                .frame(height: 92)
                .padding(.top, 8)
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
        }
    }

    private func attentionCard(_ task: TaskItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                AvatarChip(letter: String(task.agentName.prefix(1)), color: task.agentColor, size: 20)
                TaskStateChip(state: task.state)
            }
            Text(task.title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(DT.ink(scheme))
                .lineLimit(1)
            Text(task.room)
                .font(.system(size: 10.5))
                .foregroundStyle(DT.ink55(scheme))
                .lineLimit(1)
        }
        .padding(11)
        .frame(width: 186, alignment: .leading)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(task.state == .blocked ? DT.danger.opacity(0.30) : DT.violet.opacity(0.25), lineWidth: 0.8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(task.title), \(task.state.rawValue), \(task.room)")
        .accessibilityHint("Opens the project map focused on this task")
    }

    /// Focus is the default: shipped work files itself out of view — never
    /// deleted, always searchable. One tap keeps the desk clear.
    private var tidyCard: some View {
        Group {
            let candidates = store.sweepCandidateCount
            if candidates > 0 {
                HStack(spacing: 12) {
                    if store.sweeping {
                        DriveSpinner(size: 26)
                            .foregroundStyle(DT.violetText(scheme))
                    } else {
                        Image(systemName: "sparkles")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(DT.violetText(scheme))
                            .frame(width: 26)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.sweeping ? "Filing…" : "\(candidates) shipped tasks ready to file")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(DT.ink(scheme))
                        Text("Out of sight, still searchable — never deleted")
                            .font(.system(size: 11))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    Spacer()
                    if !store.sweeping {
                        Button { store.sweepArchive() } label: {
                            Text("Sweep")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16).padding(.vertical, 9)
                                .background(DT.heroGradient)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(Pressable())
                        .sensoryFeedback(.success, trigger: store.sweeping)
                    }
                }
                .padding(13)
                .background(DT.violet.opacity(0.07))
                .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                    .strokeBorder(DT.violet.opacity(0.20), lineWidth: 0.8))
                .padding(.top, 16)
            }
        }
    }

    private var archiveFooter: some View {
        NavigationLink { ArchiveView() } label: {
            HStack(spacing: 9) {
                Image(systemName: "archivebox")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(DT.ink55(scheme))
                Text("Archive · \(store.archivedCount) items")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(DT.ink55(scheme))
                Text("filed, searchable, restorable")
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink35(scheme))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(DT.surface2(scheme).opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        }
        .buttonStyle(Pressable())
        .padding(.top, 14)
        .accessibilityLabel("Archive, \(store.archivedCount) items. Filed, searchable, restorable.")
    }

    // MARK: Projects grid

    private var modeToggle: some View {
        HStack(spacing: 4) {
            ForEach(["Projects", "All tasks"], id: \.self) { option in
                Button { mode = option } label: {
                    Text(option)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(mode == option ? DT.violetText(scheme) : DT.ink55(scheme))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(mode == option ? AnyView(DT.surface(scheme)) : AnyView(Color.clear))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(3)
        .background(DT.surface2(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }

    private var projectGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 9), GridItem(.flexible())], spacing: 9) {
            ForEach(store.orderedProjects) { project in
                NavigationLink { ProjectDetailView(projectId: project.id) } label: {
                    ProjectCard(project: project)
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(.top, 12)
    }
}

/// One project, one card: name, area, live counts, and a proportional state
/// bar — enough to triage hundreds of projects by scroll alone.
struct ProjectCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let project: Project

    var body: some View {
        let agg = store.agg(project.id)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                if store.pinnedProjects.contains(project.id) {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.top, 3)
                }
                Text(project.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(DT.ink(scheme))
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 4)
                if agg.attention > 0 {
                    Text("\(agg.attention)")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(minWidth: 20)
                        .frame(height: 20)
                        .background(agg.blocked > 0 ? DT.danger : DT.violet)
                        .clipShape(Capsule())
                }
            }
            Text("\(project.area.uppercased()) · \(agg.total) TASK\(agg.total == 1 ? "" : "S")")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(DT.ink35(scheme))
                .padding(.top, 4)

            stateBar(agg).padding(.top, 10)

            HStack(spacing: 8) {
                if agg.running > 0 {
                    legend(dot: DT.live(scheme), text: "\(agg.running) running")
                } else if agg.total == agg.done {
                    legend(dot: DT.ink35(scheme), text: "shipped")
                } else {
                    legend(dot: DT.ink35(scheme), text: "quiet")
                }
                Spacer()
            }
            .padding(.top, 7)
        }
        .padding(12)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(agg.blocked > 0 ? DT.danger.opacity(0.25)
                          : agg.attention > 0 ? DT.violet.opacity(0.25)
                          : DT.hairline(scheme), lineWidth: 0.8))
        .contextMenu {
            Button { store.togglePin(project.id) } label: {
                Label(store.pinnedProjects.contains(project.id) ? "Unpin" : "Pin to top",
                      systemImage: store.pinnedProjects.contains(project.id) ? "pin.slash" : "pin")
            }
            Button { store.archiveProject(project.id) } label: {
                Label("File project to archive", systemImage: "archivebox")
            }
            Button { store.toggleNeverFile(project.id) } label: {
                Label(store.neverFileProjects.contains(project.id) ? "Allow auto-file" : "Never auto-file",
                      systemImage: store.neverFileProjects.contains(project.id) ? "archivebox.circle" : "archivebox.circle.fill")
            }
        } preview: { peek }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(a11yLabel(agg))
        .accessibilityHint("Opens the project map. Long press to pin or archive.")
    }

    /// What holding a project card shows: the numbers plus the queue of
    /// tasks that need a human — triage without the drill-in.
    private var peek: some View {
        let agg = store.agg(project.id)
        let attention = (store.tasksByProject[project.id] ?? [])
            .filter { $0.state == .blocked || $0.state == .review }
            .prefix(3)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(project.name).scaledFont(16, .heavy)
                Spacer()
                Text("\(project.area.uppercased()) · \(agg.total) TASKS")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(DT.ink35(scheme))
            }
            HStack(spacing: 12) {
                peekCount("\(agg.running)", "running", DT.live(scheme))
                if agg.blocked > 0 { peekCount("\(agg.blocked)", "blocked", DT.danger) }
                if agg.review > 0 { peekCount("\(agg.review)", "review", DT.violetText(scheme)) }
                peekCount("\(agg.done)", "shipped", DT.ink55(scheme))
                Spacer()
            }
            ForEach(Array(attention)) { task in
                TaskRow(task: task, showProject: false)
            }
        }
        .padding(16)
        .frame(width: 340)
        .background(DT.page(scheme))
    }

    private func peekCount(_ value: String, _ label: String, _ color: Color) -> some View {
        HStack(spacing: 4) {
            Text(value).scaledFont(14, .heavy).foregroundStyle(color)
            Text(label).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(DT.ink55(scheme))
        }
    }

    private func a11yLabel(_ agg: ProjectAgg) -> String {
        var parts = ["\(project.name), \(project.area), \(agg.total) tasks"]
        if agg.running > 0 { parts.append("\(agg.running) running") }
        if agg.blocked > 0 { parts.append("\(agg.blocked) blocked") }
        if agg.review > 0 { parts.append("\(agg.review) in review") }
        return parts.joined(separator: ", ")
    }

    private func stateBar(_ agg: ProjectAgg) -> some View {
        GeometryReader { geo in
            let total = max(1, agg.total)
            HStack(spacing: 1.5) {
                segment(width: geo.size.width, count: agg.running, total: total, color: DT.live(scheme))
                segment(width: geo.size.width, count: agg.blocked, total: total, color: DT.danger)
                segment(width: geo.size.width, count: agg.review, total: total, color: DT.violet)
                segment(width: geo.size.width, count: agg.queued, total: total, color: DT.ink35(scheme).opacity(0.5))
                segment(width: geo.size.width, count: agg.done, total: total, color: DT.ink35(scheme).opacity(0.22))
            }
        }
        .frame(height: 6)
        .clipShape(Capsule())
    }

    @ViewBuilder
    private func segment(width: CGFloat, count: Int, total: Int, color: Color) -> some View {
        if count > 0 {
            Rectangle().fill(color)
                .frame(width: max(3, width * CGFloat(count) / CGFloat(total)))
        }
    }

    private func legend(dot: Color, text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(dot).frame(width: 5, height: 5)
            Text(text).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(DT.ink55(scheme))
        }
    }
}

// MARK: - Search & flat list

struct SearchResults: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let query: String
    @State private var showArchived = false

    var body: some View {
        let results = store.searchTasks(query)
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow(results.active.isEmpty ? "NO ACTIVE MATCHES" : "\(results.active.count) ACTIVE MATCH\(results.active.count == 1 ? "" : "ES")")
                .padding(.top, 18)
            LazyVStack(spacing: 10) {
                ForEach(results.active.prefix(100)) { task in
                    NavigationLink { ProjectDetailView(projectId: task.room, focusTaskId: task.id) } label: {
                        TaskRow(task: task, showProject: true)
                    }
                    .buttonStyle(Pressable())
                }
                if results.active.count > 100 {
                    Text("Showing 100 of \(results.active.count) — narrow the search")
                        .font(.system(size: 12))
                        .foregroundStyle(DT.ink55(scheme))
                        .padding(.top, 6)
                }
            }
            .padding(.top, 10)

            // The archive answers when asked — and only when asked.
            if !results.archived.isEmpty {
                Button { withAnimation(.easeOut(duration: 0.2)) { showArchived.toggle() } } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "archivebox")
                            .font(.system(size: 12, weight: .medium))
                        Text("\(results.archived.count) more in the archive")
                            .font(.system(size: 12.5, weight: .bold))
                        Image(systemName: showArchived ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .semibold))
                        Spacer()
                    }
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(DT.surface2(scheme).opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                }
                .buttonStyle(Pressable())
                .padding(.top, 14)
                if showArchived {
                    LazyVStack(spacing: 10) {
                        ForEach(results.archived.prefix(50)) { task in
                            TaskRow(task: task, showProject: true)
                                .opacity(0.62)
                                .overlay(alignment: .topTrailing) {
                                    Text("ARCHIVED")
                                        .font(.system(size: 7.5, weight: .heavy))
                                        .tracking(0.8)
                                        .foregroundStyle(DT.ink35(scheme))
                                        .padding(.top, 5).padding(.trailing, 10)
                                }
                        }
                    }
                    .padding(.top, 10)
                }
            }
        }
    }
}

/// The archive: everything ever filed, grouped by project, one tap to
/// restore. Nothing here is deleted — it is simply out of the way.
struct ArchiveView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    private var archivedProjectList: [Project] {
        store.projects.filter { store.archivedProjects.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Filed to keep the desk clear. Search finds all of it; restore brings a project back to the floor.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 8)

                Eyebrow("ARCHIVED PROJECTS · \(archivedProjectList.count)").padding(.top, 18)
                LazyVStack(spacing: 9) {
                    ForEach(archivedProjectList) { project in
                        HStack(spacing: 11) {
                            Image(systemName: "archivebox")
                                .font(.system(size: 13))
                                .foregroundStyle(DT.ink35(scheme))
                                .frame(width: 30, height: 30)
                                .background(DT.surface2(scheme))
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(project.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(DT.ink78(scheme))
                                Text(project.area)
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(DT.ink35(scheme))
                            }
                            Spacer()
                            Button { store.restoreProject(project.id) } label: {
                                Text("Restore")
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundStyle(DT.violetText(scheme))
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(DT.violet.opacity(0.10))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(Pressable())
                        }
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(DT.surface(scheme).opacity(0.7))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                    }
                }
                .padding(.top, 10)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Archive")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Every task, grouped by project, virtualized — thousands of rows scroll
/// because LazyVStack only builds what's on screen.
struct AllTasksList: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Binding var selecting: Bool
    @Binding var selectedIds: Set<String>

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 10, pinnedViews: [.sectionHeaders]) {
            ForEach(store.orderedProjects) { project in
                if let items = store.tasksByProject[project.id], !items.isEmpty {
                    Section {
                        ForEach(items) { task in
                            if selecting {
                                Button {
                                    if selectedIds.contains(task.id) {
                                        selectedIds.remove(task.id)
                                    } else {
                                        selectedIds.insert(task.id)
                                    }
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: selectedIds.contains(task.id) ? "checkmark.circle.fill" : "circle")
                                            .font(.system(size: 19))
                                            .foregroundStyle(selectedIds.contains(task.id) ? DT.violet : DT.ink35(scheme))
                                        TaskRow(task: task, showProject: false)
                                    }
                                }
                                .buttonStyle(Pressable())
                                .accessibilityLabel("\(selectedIds.contains(task.id) ? "Selected" : "Not selected"): \(task.title)")
                            } else {
                                NavigationLink { ProjectDetailView(projectId: task.room, focusTaskId: task.id) } label: {
                                    TaskRow(task: task, showProject: false)
                                }
                                .buttonStyle(Pressable())
                            }
                        }
                    } header: {
                        HStack {
                            Text(project.name)
                                .font(.system(size: 12, weight: .heavy))
                                .foregroundStyle(DT.ink55(scheme))
                            Spacer()
                            Text("\(items.count)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .padding(.vertical, 7).padding(.horizontal, 4)
                        .background(DT.page(scheme).opacity(0.96))
                    }
                }
            }
        }
        .padding(.top, 12)
    }
}

struct TaskRow: View {
    @Environment(\.colorScheme) private var scheme
    let task: TaskItem
    var showProject: Bool

    var body: some View {
        HStack(spacing: 11) {
            AvatarChip(letter: String(task.agentName.prefix(1)), color: task.agentColor, size: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(task.state == .done ? DT.ink55(scheme) : DT.ink(scheme))
                    .lineLimit(1)
                if showProject {
                    Text(task.room)
                        .font(.system(size: 11))
                        .foregroundStyle(DT.ink35(scheme))
                        .lineLimit(1)
                }
            }
            Spacer()
            if let p = task.progress, task.state == .running {
                Text("\(Int(p * 100))%")
                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(DT.ink35(scheme))
            }
            TaskStateChip(state: task.state)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous)
            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        .accessibilityElement(children: .combine)
    }
}

/// Routes "needs you" to the single open conversation, or the triage list.
struct NeedsYouRouter: View {
    @EnvironmentObject var store: AppStore
    var body: some View {
        Group {
            if store.openInterrupts.count == 1, let only = store.openInterrupts.first {
                InterruptConversationView(interruptId: only.id)
            } else {
                NeedsYouView()
            }
        }
        .onAppear { store.intent.record(.needsYou) }
    }
}

struct TaskStateChip: View {
    @Environment(\.colorScheme) private var scheme
    let state: TaskState
    var body: some View {
        Group {
            switch state {
            case .running:
                HStack(spacing: 4.5) {
                    Circle().fill(DT.live(scheme)).frame(width: 5, height: 5)
                    Text(state.rawValue)
                }
                .foregroundStyle(DT.ink55(scheme))
                .padding(.horizontal, 9).padding(.vertical, 4.5)
                .background(DT.surface2(scheme))
            case .review:
                Text(state.rawValue)
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 9).padding(.vertical, 4.5)
                    .background(DT.violet.opacity(0.10))
            case .blocked:
                Text(state.rawValue)
                    .foregroundStyle(DT.danger)
                    .padding(.horizontal, 9).padding(.vertical, 4.5)
                    .background(DT.danger.opacity(0.08))
            case .queued:
                Text(state.rawValue)
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.horizontal, 9).padding(.vertical, 4.5)
                    .background(DT.surface2(scheme))
            case .done:
                Image(systemName: "checkmark")
                    .foregroundStyle(DT.ink35(scheme))
            }
        }
        .scaledFont(11, .bold)
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }
}

extension TasksView {
    func stripTile(_ n: String, _ label: String, accent: Bool = false, live: Bool = false, danger: Bool = false) -> some View {
        HStack(spacing: 7) {
            Text(n)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(accent ? DT.violetText(scheme) : danger ? DT.danger : DT.ink(scheme))
            HStack(spacing: 4) {
                if live { Circle().fill(DT.live(scheme)).frame(width: 5, height: 5) }
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(accent ? DT.violetText(scheme) : DT.ink55(scheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(accent ? AnyView(DT.violet.opacity(0.10)) : AnyView(DT.surface(scheme)))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(accent ? DT.violet.opacity(0.22) : DT.hairline(scheme), lineWidth: 0.8))
    }
}
