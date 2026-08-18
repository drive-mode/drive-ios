import SwiftUI

/// One project's dependency map — positions computed from the dependency
/// graph (topological layers left→right), not hand-placed, so any project in
/// a fleet of hundreds renders a readable map.
struct ProjectDetailView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let projectId: String
    var focusTaskId: String? = nil
    @State private var selectedTaskId: String?
    @State private var stateFilter: TaskState? = nil

    private var items: [TaskItem] { store.tasksByProject[projectId] ?? [] }

    /// Priority order: blocked > review > running > queued > done. The map
    /// shows the first 18; everything past the cap clusters by state below.
    private var sortedByPriority: [TaskItem] {
        let priority: [TaskState: Int] = [.blocked: 0, .review: 1, .running: 2, .queued: 3, .done: 4]
        return items.sorted { (priority[$0.state] ?? 9) < (priority[$1.state] ?? 9) }
    }

    private var mapItems: [TaskItem] { Array(sortedByPriority.prefix(18)) }

    /// Past the cap, tasks cluster by state — each chip filters the list.
    private var overflowClusters: [(state: TaskState, count: Int)] {
        let overflow = sortedByPriority.dropFirst(18)
        guard !overflow.isEmpty else { return [] }
        var counts: [TaskState: Int] = [:]
        for task in overflow { counts[task.state, default: 0] += 1 }
        let order: [TaskState] = [.blocked, .review, .running, .queued, .done]
        return order.compactMap { state in counts[state].map { (state, $0) } }
    }

    var body: some View {
        let agg = store.agg(projectId)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                summaryRow(agg).padding(.top, 8)

                if !mapItems.isEmpty {
                    DependencyMap(projectId: projectId, items: mapItems, selectedTaskId: $selectedTaskId)
                        .frame(height: mapHeight)
                        .padding(.top, 12)
                    if !overflowClusters.isEmpty {
                        clusterRow.padding(.top, 8)
                    }
                }

                if let id = selectedTaskId, let task = items.first(where: { $0.id == id }) {
                    TaskDetailCard(task: task).padding(.top, 12)
                }

                // The project's standing memory — decisions that outlive tasks.
                let projectMemory = store.memory(scope: .project, owner: projectId)
                if !projectMemory.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(projectMemory.enumerated()), id: \.element.id) { index, file in
                            if index > 0 {
                                Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 51)
                            }
                            NavigationLink { MemoryFileView(fileId: file.id) } label: {
                                MemoryRow(file: file)
                            }
                            .buttonStyle(Pressable())
                        }
                    }
                    .card()
                    .padding(.top, 12)
                }

                HStack {
                    Eyebrow(stateFilter.map { "\($0.rawValue.uppercased()) TASKS" } ?? "ALL TASKS")
                    Spacer()
                    if stateFilter != nil {
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { stateFilter = nil }
                        } label: {
                            HStack(spacing: 4) {
                                Text("Clear")
                                    .font(.system(size: 11.5, weight: .bold))
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(DT.violetText(scheme))
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .padding(.top, 20)
                LazyVStack(spacing: 9) {
                    ForEach(stateFilter.map { f in items.filter { $0.state == f } } ?? items) { task in
                        Button { selectedTaskId = task.id } label: {
                            TaskRow(task: task, showProject: false)
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .padding(.top, 10)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(projectId)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            selectedTaskId = focusTaskId ?? mapItems.first?.id
            store.intent.record(.projectMap)
        }
    }

    /// "Mapping the 18 most active" + one tappable cluster per overflow state.
    private var clusterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                Text("Mapping \(mapItems.count) most active")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                ForEach(overflowClusters, id: \.state) { cluster in
                    let active = stateFilter == cluster.state
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                            stateFilter = active ? nil : cluster.state
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Circle().fill(clusterTint(cluster.state)).frame(width: 5, height: 5)
                            Text("+\(cluster.count) \(cluster.state.rawValue.lowercased())")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundStyle(active ? .white : DT.ink78(scheme))
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(active ? AnyShapeStyle(clusterTint(cluster.state)) : AnyShapeStyle(DT.surface(scheme)))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(active ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                    .accessibilityLabel("\(cluster.count) more \(cluster.state.rawValue) tasks")
                    .accessibilityHint("Filters the task list below")
                }
            }
        }
        .padding(.horizontal, -20)
        .contentMargins(.horizontal, 20, for: .scrollContent)
    }

    private func clusterTint(_ state: TaskState) -> Color {
        switch state {
        case .running: return DT.live(scheme)
        case .review: return DT.violet
        case .blocked: return DT.danger
        case .queued: return DT.ink55(scheme)
        case .done: return DT.ink35(scheme)
        }
    }

    private var mapHeight: CGFloat {
        mapItems.count <= 4 ? 220 : mapItems.count <= 10 ? 300 : 380
    }

    private func summaryRow(_ agg: ProjectAgg) -> some View {
        HStack(spacing: 8) {
            summaryChip("\(agg.running)", "running", color: DT.live(scheme), show: true)
            summaryChip("\(agg.blocked)", "blocked", color: DT.danger, show: agg.blocked > 0)
            summaryChip("\(agg.review)", "review", color: DT.violetText(scheme), show: agg.review > 0)
            summaryChip("\(agg.done)/\(agg.total)", "shipped", color: DT.ink55(scheme), show: true)
            Spacer()
        }
    }

    @ViewBuilder
    private func summaryChip(_ n: String, _ label: String, color: Color, show: Bool) -> some View {
        if show {
            HStack(spacing: 5) {
                Text(n).font(.system(size: 13, weight: .heavy)).foregroundStyle(color)
                Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(DT.ink55(scheme))
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(DT.surface(scheme))
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        }
    }
}

// MARK: - Dependency-layered map

struct DependencyMap: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let projectId: String
    let items: [TaskItem]
    @Binding var selectedTaskId: String?

    // Pinch to zoom into a dense map; drag to pan while zoomed; double-tap
    // to reset. At rest the map scrolls with the page like any card.
    @State private var zoom: CGFloat = 1
    @State private var zoomAnchor: CGFloat = 1
    @State private var pan: CGSize = .zero
    @State private var panAnchor: CGSize = .zero

    /// Kahn layering: tasks with no shown dependencies sit in column 0;
    /// each dependent lands one column right of its deepest dependency.
    /// Tall layers wrap into extra columns of at most 4 rows.
    /// Pure and static — the PreheatEngine caches results per project.
    nonisolated static func computeLayout(items: [TaskItem]) -> [MapPlacement] {
        let shownIds = Set(items.map(\.id))
        var layerOf: [String: Int] = [:]

        func layer(_ task: TaskItem, depth: Int = 0) -> Int {
            if let cached = layerOf[task.id] { return cached }
            let deps = task.deps.filter { shownIds.contains($0) }
            var result = 0
            if depth < 6, !deps.isEmpty {
                result = deps.compactMap { id in items.first { $0.id == id }.map { layer($0, depth: depth + 1) + 1 } }.max() ?? 0
            }
            layerOf[task.id] = result
            return result
        }
        for task in items { _ = layer(task) }

        // Split layers into columns of ≤4 rows, then normalize positions.
        var columns: [[TaskItem]] = []
        let maxLayer = layerOf.values.max() ?? 0
        for l in 0...maxLayer {
            let inLayer = items.filter { layerOf[$0.id] == l }
            guard !inLayer.isEmpty else { continue }
            for chunk in stride(from: 0, to: inLayer.count, by: 4) {
                columns.append(Array(inLayer[chunk..<min(chunk + 4, inLayer.count)]))
            }
        }
        let colCount = max(1, columns.count)
        var out: [MapPlacement] = []
        for (c, column) in columns.enumerated() {
            let x = colCount == 1 ? 0.5 : 0.14 + 0.72 * Double(c) / Double(colCount - 1)
            for (r, task) in column.enumerated() {
                let y = column.count == 1 ? 0.42 : 0.16 + 0.62 * Double(r) / Double(column.count - 1)
                out.append(MapPlacement(taskId: task.id, x: x, y: y + (c.isMultiple(of: 2) ? 0 : 0.05)))
            }
        }
        return out
    }

    var body: some View {
        let byId = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        let placed: [(task: TaskItem, x: Double, y: Double)] = store.preheat
            .mapLayout(projectId: projectId, items: items)
            .compactMap { placement in
                byId[placement.taskId].map { ($0, placement.x, placement.y) }
            }
        let positions = Dictionary(uniqueKeysWithValues: placed.map { ($0.task.id, CGPoint(x: $0.x, y: $0.y)) })
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                // Edges
                ForEach(placed, id: \.task.id) { entry in
                    ForEach(entry.task.deps, id: \.self) { depId in
                        if let from = positions[depId], let dep = items.first(where: { $0.id == depId }) {
                            let to = positions[entry.task.id] ?? .zero
                            let a = CGPoint(x: from.x * size.width, y: from.y * size.height)
                            let b = CGPoint(x: to.x * size.width, y: to.y * size.height)
                            let blockedEdge = dep.state == .blocked
                            Path { p in
                                p.move(to: a)
                                p.addQuadCurve(to: b, control: CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 18))
                            }
                            .stroke(blockedEdge ? DT.danger.opacity(0.45) : DT.ink35(scheme).opacity(0.45),
                                    style: StrokeStyle(lineWidth: 1.2, dash: blockedEdge ? [4, 4] : []))
                        }
                    }
                }
                // Nodes
                ForEach(placed, id: \.task.id) { entry in
                    MapNode(task: entry.task, selected: selectedTaskId == entry.task.id)
                        .position(x: entry.x * size.width, y: entry.y * size.height)
                        .onTapGesture { selectedTaskId = entry.task.id }
                }
            }
            .scaleEffect(zoom)
            .offset(clampedPan(in: size))
        }
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        .overlay(alignment: .bottomTrailing) {
            if zoom > 1.02 {
                Text("\(zoom, specifier: "%.1f")×")
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.horizontal, 7).padding(.vertical, 4)
                    .background(DT.surface2(scheme).opacity(0.9))
                    .clipShape(Capsule())
                    .padding(8)
                    .transition(.opacity)
            }
        }
        .simultaneousGesture(
            MagnificationGesture()
                .onChanged { value in
                    zoom = min(2.6, max(1, zoomAnchor * value))
                }
                .onEnded { _ in
                    zoomAnchor = zoom
                    if zoom <= 1.02 { resetZoom() }
                }
        )
        // Pan only engages while zoomed — at rest the page scroll owns drags.
        .gesture(
            DragGesture(minimumDistance: 12)
                .onChanged { v in
                    guard zoom > 1.02 else { return }
                    pan = CGSize(width: panAnchor.width + v.translation.width,
                                 height: panAnchor.height + v.translation.height)
                }
                .onEnded { _ in panAnchor = pan },
            including: zoom > 1.02 ? .all : .subviews
        )
        .onTapGesture(count: 2) { resetZoom() }
        .animation(.easeOut(duration: 0.2), value: selectedTaskId)
        .accessibilityHint("Pinch to zoom the map; double-tap to reset")
    }

    private func resetZoom() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            zoom = 1; zoomAnchor = 1
            pan = .zero; panAnchor = .zero
        }
    }

    /// Keep the zoomed content covering the frame — no bare corners.
    private func clampedPan(in size: CGSize) -> CGSize {
        let maxX = size.width * (zoom - 1) / 2
        let maxY = size.height * (zoom - 1) / 2
        return CGSize(width: min(maxX, max(-maxX, pan.width)),
                      height: min(maxY, max(-maxY, pan.height)))
    }
}

struct MapNode: View {
    @Environment(\.colorScheme) private var scheme
    let task: TaskItem
    let selected: Bool

    var body: some View {
        VStack(spacing: 5) {
            ZStack {
                Circle().fill(DT.surface(scheme))
                    .shadow(color: scheme == .dark ? .clear : DT.inkLight.opacity(0.08), radius: 4, y: 2)
                Circle().strokeBorder(ringColor.opacity(0.25), lineWidth: 3)
                if let progress = task.progress, task.state == .running {
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(DT.live(scheme), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .padding(1.5)
                } else {
                    Circle().strokeBorder(ringColor, lineWidth: 3)
                        .opacity(task.state == .done ? 0.35 : 1)
                }
                if task.state == .done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(DT.ink35(scheme))
                } else {
                    AvatarChip(letter: String(task.agentName.prefix(1)), color: task.agentColor, size: 22)
                }
            }
            .frame(width: task.state == .done ? 34 : 44, height: task.state == .done ? 34 : 44)
            .overlay {
                if selected {
                    Circle().strokeBorder(DT.violet, lineWidth: 2).padding(-4)
                }
            }
            Text(task.title)
                .font(.system(size: 9, weight: selected ? .bold : .semibold))
                .foregroundStyle(task.state == .done ? DT.ink35(scheme) : DT.ink78(scheme))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(width: 76)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(nodeLabel)
        .accessibilityHint("Selects this task on the map")
    }

    private var nodeLabel: String {
        var label = "\(task.title), \(task.state.rawValue)"
        if let p = task.progress, task.state == .running { label += ", \(Int(p * 100)) percent" }
        label += ", \(task.agentName)"
        return label
    }

    private var ringColor: Color {
        switch task.state {
        case .running: return DT.live(scheme)
        case .review: return DT.violet
        case .blocked: return DT.danger
        case .queued, .done: return DT.ink35(scheme)
        }
    }
}

struct TaskDetailCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let task: TaskItem

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                AvatarChip(letter: String(task.agentName.prefix(1)), color: task.agentColor, size: 30)
                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title).font(.system(size: 14.5, weight: .bold))
                    Text("\(task.room) · \(task.agentName)")
                        .font(.system(size: 11))
                        .foregroundStyle(DT.ink35(scheme))
                }
                Spacer()
                TaskStateChip(state: task.state)
            }
            if let detail = task.detail {
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 9)
            }
            // Task memory: the notes this task accumulated.
            ForEach(store.memory(scope: .task, owner: task.id)) { file in
                NavigationLink { MemoryFileView(fileId: file.id) } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "brain")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(MemoryScope.task.tint)
                        Text(file.hook)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(DT.ink78(scheme))
                            .lineLimit(1)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    .padding(.top, 8)
                }
                .buttonStyle(Pressable())
            }
            HStack(spacing: 9) {
                if task.state == .blocked, let interrupt = blockingInterrupt {
                    NavigationLink { InterruptConversationView(interruptId: interrupt.id) } label: {
                        actionLabel("Answer \(task.agentName)", solid: true)
                    }
                    .buttonStyle(Pressable())
                } else if task.room == "Auth middleware" {
                    Button { store.joinCall() } label: {
                        actionLabel("Join session", solid: true)
                    }
                    .buttonStyle(Pressable())
                }
                Button { store.selectedTab = .agents } label: {
                    actionLabel("View agent", solid: false)
                }
                .buttonStyle(Pressable())
            }
            .padding(.top, 12)
        }
        .padding(14)
        .card()
    }

    private var blockingInterrupt: Interrupt? {
        store.interrupts.first { !$0.resolved && $0.agentName == task.agentName && $0.kind == .blocked }
    }

    private func actionLabel(_ text: String, solid: Bool) -> some View {
        Text(text)
            .font(.system(size: 13.5, weight: .bold))
            .foregroundStyle(solid ? .white : DT.violetText(scheme))
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(solid ? AnyView(DT.heroGradient) : AnyView(DT.violet.opacity(0.10)))
            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }
}
