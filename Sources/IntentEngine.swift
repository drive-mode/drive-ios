import SwiftUI

/// Where the user can be. Tabs map 1:1; pushed surfaces get their own cases.
enum Surface: String, Codable, CaseIterable {
    case home, work, agents, tasks
    case projectMap, activity, inbox, artifacts, profile, archive, needsYou, search

    init(tab: AppTab) {
        switch tab {
        case .home: self = .home
        case .work: self = .work
        case .agents: self = .agents
        case .tasks: self = .tasks
        }
    }
}

/// First-order Markov transitions + frequency/recency priors, persisted in
/// UserDefaults (~4 KB). Predicts where the user goes next so the preheater
/// can warm it. Prediction only ever pre-warms — it never changes what the
/// user sees.
@MainActor
final class IntentRecorder {
    private struct Model: Codable {
        var transitions: [String: [String: Double]] = [:]
        var visits: [String: Double] = [:]
        var lastVisit: [String: Date] = [:]
        var lastDecay = Date()
    }

    private var model: Model
    private(set) var current: Surface = .home
    private(set) var lastRecordAt = Date()
    var burstUntil = Date.distantPast
    private var persistTask: Task<Void, Never>?
    var lastPrediction: [Surface] = []

    init() {
        if let data = UserDefaults.standard.data(forKey: "intentModel.v1"),
           let decoded = try? JSONDecoder().decode(Model.self, from: data) {
            model = decoded
        } else {
            model = Model()
        }
        decayIfDue()
    }

    func record(_ surface: Surface) {
        guard surface != current else { lastRecordAt = Date(); return }
        model.transitions[current.rawValue, default: [:]][surface.rawValue, default: 0] += 1
        model.visits[surface.rawValue, default: 0] += 1
        model.lastVisit[surface.rawValue] = Date()
        current = surface
        lastRecordAt = Date()
        lastPrediction = predictedNext(from: surface)
        schedulePersist()
    }

    /// Laplace-smoothed blend: markov 0.55 · frequency 0.20 · recency 0.15,
    /// with an attention boost for the surfaces attention pulls users toward.
    func predictedNext(from surface: Surface, attention: Int = 0) -> [Surface] {
        let all = Surface.allCases
        let n = Double(all.count)
        let row = model.transitions[surface.rawValue] ?? [:]
        let rowTotal = row.values.reduce(0, +)
        let visitTotal = model.visits.values.reduce(0, +)
        let now = Date()
        var scored: [(Surface, Double)] = all.compactMap { candidate in
            guard candidate != surface else { return nil }
            let markov = ((row[candidate.rawValue] ?? 0) + 1) / (rowTotal + n)
            let freq = ((model.visits[candidate.rawValue] ?? 0) + 1) / (visitTotal + n)
            let recency: Double
            if let last = model.lastVisit[candidate.rawValue] {
                recency = exp(-now.timeIntervalSince(last) / (6 * 3600))
            } else {
                recency = 0
            }
            var score = 0.55 * markov + 0.20 * freq + 0.15 * recency
            if attention > 0, [.tasks, .needsYou, .projectMap].contains(candidate) {
                score *= 1.5
            }
            return (candidate, score)
        }
        scored.sort { $0.1 > $1.1 }
        return scored.map(\.0)
    }

    var diagnostics: String {
        let top = lastPrediction.prefix(2).map(\.rawValue).joined(separator: ",")
        return "\(current.rawValue)→[\(top)]"
    }

    private func decayIfDue() {
        // 7-day half-life, applied at most hourly.
        let hours = Date().timeIntervalSince(model.lastDecay) / 3600
        guard hours >= 1 else { return }
        let factor = pow(0.5, hours / 168)
        for (from, var row) in model.transitions {
            for (to, count) in row {
                let decayed = count * factor
                row[to] = decayed < 0.05 ? nil : decayed
            }
            model.transitions[from] = row.isEmpty ? nil : row
        }
        model.visits = model.visits.compactMapValues {
            let decayed = $0 * factor
            return decayed < 0.05 ? nil : decayed
        }
        model.lastDecay = Date()
    }

    private func schedulePersist() {
        persistTask?.cancel()
        persistTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            guard let self, !Task.isCancelled else { return }
            self.persistNow()
        }
    }

    func persistNow() {
        if let data = try? JSONEncoder().encode(model) {
            UserDefaults.standard.set(data, forKey: "intentModel.v1")
        }
    }
}

struct MapPlacement: Sendable {
    let taskId: String
    let x: Double
    let y: Double
}

/// Read-through caches for the expensive first paints. A cache hit changes
/// latency only — a miss runs the identical pure function inline.
@MainActor
final class PreheatEngine {
    /// Folded search corpus, rebuilt atomically with the task index.
    private(set) var searchIndex: [(id: String, folded: String)] = []
    /// Dependency-map layouts keyed by project, hashed against their items.
    private var mapLayouts: [String: (itemsHash: Int, placed: [MapPlacement])] = [:]
    private var layoutOrder: [String] = []
    private(set) var hits = 0
    private(set) var misses = 0

    init() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.mapLayouts.removeAll()
                self?.layoutOrder.removeAll()
            }
        }
    }

    func rebuildSearchIndex(tasks: [TaskItem]) {
        guard tasks.count <= 5000 else { searchIndex = []; return }
        searchIndex = tasks.map { ($0.id, "\($0.title.lowercased()) \($0.room.lowercased())") }
    }

    func mapLayout(projectId: String, items: [TaskItem]) -> [MapPlacement] {
        let hash = itemsHash(items)
        if let cached = mapLayouts[projectId], cached.itemsHash == hash {
            hits += 1
            return cached.placed
        }
        misses += 1
        let placed = DependencyMap.computeLayout(items: items)
        storeLayout(projectId: projectId, hash: hash, placed: placed)
        return placed
    }

    /// Warm the top predicted projects off-main.
    func warm(projects: [(id: String, items: [TaskItem])]) {
        let work = projects.filter { mapLayouts[$0.id]?.itemsHash != itemsHash($0.items) }
        guard !work.isEmpty else { return }
        Task.detached(priority: .utility) {
            let results = work.map { ($0.id, self.itemsHashNonisolated($0.items), DependencyMap.computeLayout(items: $0.items)) }
            await MainActor.run {
                for (id, hash, placed) in results {
                    self.storeLayout(projectId: id, hash: hash, placed: placed)
                }
            }
        }
    }

    private func storeLayout(projectId: String, hash: Int, placed: [MapPlacement]) {
        mapLayouts[projectId] = (hash, placed)
        layoutOrder.removeAll { $0 == projectId }
        layoutOrder.append(projectId)
        // LRU cap: 8 projects.
        while layoutOrder.count > 8 {
            mapLayouts.removeValue(forKey: layoutOrder.removeFirst())
        }
    }

    nonisolated private func itemsHashNonisolated(_ items: [TaskItem]) -> Int {
        var hasher = Hasher()
        for item in items {
            hasher.combine(item.id)
            hasher.combine(item.state)
            hasher.combine(item.deps)
        }
        return hasher.finalize()
    }

    private func itemsHash(_ items: [TaskItem]) -> Int {
        itemsHashNonisolated(items)
    }

    var diagnostics: String {
        "maps \(mapLayouts.count)/8 · idx \(searchIndex.count) · hit \(hits)/\(hits + misses)"
    }
}
