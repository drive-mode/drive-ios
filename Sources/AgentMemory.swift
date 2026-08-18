import SwiftUI

// MARK: - Model

/// Memory is a notebook of files, scoped to what it's about: an agent's
/// durable memory, one working session's notes, a task, a project, a plan.
/// Same discovery rule as skills: the hook line loads up front; the body
/// loads when the work makes it relevant.
enum MemoryScope: String, Codable, CaseIterable, Identifiable {
    case agent = "Agent"
    case session = "Session"
    case task = "Task"
    case project = "Project"
    case plan = "Plan"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .agent: return "brain"
        case .session: return "waveform"
        case .task: return "checklist"
        case .project: return "folder"
        case .plan: return "map"
        }
    }

    var tint: Color {
        switch self {
        case .agent: return Color(hex: 0x9F58FA)
        case .session: return Color(hex: 0x2BCC28)
        case .task: return Color(hex: 0x5B8DEF)
        case .project: return Color(hex: 0xFFC55C)
        case .plan: return Color(hex: 0x2DD4BF)
        }
    }
}

struct MemoryFile: Codable, Identifiable, Equatable {
    let id: String
    let scope: MemoryScope
    /// Who or what this file belongs to (agent id, task id, project name…).
    let owner: String
    let ownerLabel: String
    var name: String
    /// The index line — always loaded, the reason to open the body.
    var hook: String
    var body: String
    var updated: String
    var pinned = false

    static func load() -> [MemoryFile] {
        guard let data = UserDefaults.standard.data(forKey: "memory.v1"),
              let saved = try? JSONDecoder().decode([MemoryFile].self, from: data) else {
            return MemorySeeds.files
        }
        return saved
    }

    static func save(_ files: [MemoryFile]) {
        if let data = try? JSONEncoder().encode(files) {
            UserDefaults.standard.set(data, forKey: "memory.v1")
        }
    }
}

enum MemorySeeds {
    static let files: [MemoryFile] = [
        // Agent memory — durable, who-they-work-with knowledge.
        MemoryFile(id: "m1", scope: .agent, owner: "coder", ownerLabel: "Cline",
                   name: "harrison-preferences.md",
                   hook: "How Harrison likes edits proposed",
                   body: "Small, scoped asks — one decision per approval. Diff summaries must be honest (+12 −3 means +12 −3). Branch names follow drive/<topic>. Never batch a rename into a feature diff. Prefers the suite green before the ask, not after.",
                   updated: "2d", pinned: true),
        MemoryFile(id: "m2", scope: .agent, owner: "coder", ownerLabel: "Cline",
                   name: "auth-conventions.md",
                   hook: "Auth stack conventions that keep landing",
                   body: "verifyJwt gates every refresh route — early return, no soft-fail. Middleware lives in auth.ts; helpers get named exports. Tests pin regressions by name (refresh-regression stays dead).",
                   updated: "1d"),
        MemoryFile(id: "m3", scope: .agent, owner: "maya", ownerLabel: "Maya",
                   name: "decision-style.md",
                   hook: "How this room makes calls",
                   body: "Two options max, named plainly. Harrison decides fast when the suite covers the risk — lead with coverage. Gate-now beat flag-later has won three times running.",
                   updated: "6h"),
        MemoryFile(id: "m4", scope: .agent, owner: "scout", ownerLabel: "Scout",
                   name: "staging-map.md",
                   hook: "Where staging secrets actually live",
                   body: "DATABASE_URL: env in staging, vault in prod — asked once, answered by Harrison 2026-08-17. WEBHOOK_SECRET still undecided (blocked ask w8 open). Never read prod vault without an approval.",
                   updated: "31m"),

        // Session memory — one working session, what happened and why.
        MemoryFile(id: "m5", scope: .session, owner: "coder", ownerLabel: "Cline · Auth middleware",
                   name: "session-2026-08-17-auth.md",
                   hook: "The auth-gate session: what landed, what's parked",
                   body: "Landed requireAuth behind the approval (+12 −3). Suite went 5/5, 38ms p95 after the gate. Maya called gate-now-no-flag; decision beat is in the replay. Parked: webhook signature verification (w8) pending the secret-store answer.",
                   updated: "1h", pinned: true),
        MemoryFile(id: "m6", scope: .session, owner: "maya", ownerLabel: "Maya · Auth middleware",
                   name: "session-2026-08-17-directing.md",
                   hook: "Directing notes — what held attention",
                   body: "8-beat program looped clean. The tests beat staged real artifacts (plan, diff, report) — skimmers stopped skipping there. Keep decision beats under 7s; the caption carries the call.",
                   updated: "1h"),

        // Task memory — the working notes a task accumulates.
        MemoryFile(id: "m7", scope: .task, owner: "w1", ownerLabel: "Gate JWT refresh",
                   name: "gate-jwt-notes.md",
                   hook: "Constraints that shaped the gate",
                   body: "Early return chosen over throw — middleware stays composable. p95 target was 40ms; landed at 38. Refresh regression test named and pinned; do not rename it.",
                   updated: "1h"),
        MemoryFile(id: "m8", scope: .task, owner: "w8", ownerLabel: "Verify webhook signatures",
                   name: "webhook-blockers.md",
                   hook: "Why this is blocked and what unblocks it",
                   body: "Needs WEBHOOK_SECRET source (env vs vault). Signature scheme decided: HMAC-SHA256, signed payloads per the webhook contract doc. Once the store is named, verification is a two-file change.",
                   updated: "38m"),

        // Project memory — decisions that outlive tasks.
        MemoryFile(id: "m9", scope: .project, owner: "Auth middleware", ownerLabel: "Auth middleware",
                   name: "decisions.md",
                   hook: "Standing decisions — read before proposing",
                   body: "Gate refresh at middleware, not per-route (2026-08-17, suite covers it). No feature flags for auth-path changes; the suite is the flag. Secrets: env in staging, vault in prod.",
                   updated: "1h", pinned: true),
        MemoryFile(id: "m10", scope: .project, owner: "Exports refactor", ownerLabel: "Exports refactor",
                   name: "adapter-shape.md",
                   hook: "The one-adapter rule",
                   body: "Every export target goes through the adapter — no special cases. Fixture backfill retired six; new targets add a config, not a code path.",
                   updated: "3d"),

        // Plan memory — the thinking a plan carries between sessions.
        MemoryFile(id: "m11", scope: .plan, owner: "payments-plan", ownerLabel: "Payments refactor plan",
                   name: "payments-plan-notes.md",
                   hook: "Open questions the plan must answer",
                   body: "5 steps, touches 14 files. Open: idempotency keys per provider or shared? Maya leans shared with provider salt. Review parked until Harrison opens it — nothing moves before that.",
                   updated: "1d"),
    ]
}

extension AppStore {
    func memory(scope: MemoryScope? = nil, owner: String? = nil) -> [MemoryFile] {
        memoryFiles.filter { file in
            (scope == nil || file.scope == scope) && (owner == nil || file.owner == owner)
        }
        .sorted { ($0.pinned ? 0 : 1, $0.id) < ($1.pinned ? 0 : 1, $1.id) }
    }

    /// An agent's notebook: durable memory plus its per-session notes.
    func agentMemory(_ agentId: String) -> [MemoryFile] {
        memoryFiles.filter { ($0.scope == .agent || $0.scope == .session) && $0.owner == agentId }
            .sorted { ($0.pinned ? 0 : 1, $0.id) < ($1.pinned ? 0 : 1, $1.id) }
    }

    func updateMemory(_ id: String, body: String) {
        guard let i = memoryFiles.firstIndex(where: { $0.id == id }) else { return }
        memoryFiles[i].body = body
        memoryFiles[i].updated = "now"
    }

    func addMemory(scope: MemoryScope, owner: String, ownerLabel: String, name: String, hook: String, body: String) {
        memoryFiles.insert(MemoryFile(
            id: "m-\(Int(Date().timeIntervalSince1970))",
            scope: scope, owner: owner, ownerLabel: ownerLabel,
            name: name, hook: hook, body: body, updated: "now"), at: 0)
    }
}

// MARK: - Rows & sections

struct MemoryRow: View {
    @Environment(\.colorScheme) private var scheme
    let file: MemoryFile
    var showOwner = false

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: file.scope.symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(file.scope.tint)
                .frame(width: 28, height: 28)
                .background(file.scope.tint.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(file.name)
                        .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                        .foregroundStyle(DT.ink(scheme))
                        .lineLimit(1)
                    if file.pinned {
                        Image(systemName: "pin.fill")
                            .font(.system(size: 8))
                            .foregroundStyle(DT.violetText(scheme))
                    }
                }
                Text(showOwner ? "\(file.ownerLabel) — \(file.hook)" : file.hook)
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
            }
            Spacer()
            Text(file.updated)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(DT.ink35(scheme))
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(file.scope.rawValue) memory: \(file.name). \(file.hook). Updated \(file.updated) ago")
    }
}

/// An agent's notebook on its profile — durable files plus session notes.
struct AgentMemorySection: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let agent: Agent

    var body: some View {
        let files = store.agentMemory(agent.id)
        VStack(spacing: 0) {
            if files.isEmpty {
                Text("No memory yet — this agent starts every session fresh.")
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }
            ForEach(Array(files.enumerated()), id: \.element.id) { index, file in
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
    }
}

// MARK: - Reader / editor

/// Read a memory file; edit it in place. The hook is the index line —
/// always loaded — and the body is what discovery pulls in when relevant.
struct MemoryFileView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let fileId: String
    @State private var editing = false
    @State private var draft = ""

    private var file: MemoryFile? {
        store.memoryFiles.first { $0.id == fileId }
    }

    var body: some View {
        ScrollView {
            if let file {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        Image(systemName: file.scope.symbol)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(file.scope.tint)
                            .frame(width: 32, height: 32)
                            .background(file.scope.tint.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(file.name)
                                .font(.system(size: 15, weight: .bold, design: .monospaced))
                            Text("\(file.scope.rawValue) memory · \(file.ownerLabel) · updated \(file.updated) ago")
                                .font(.system(size: 10.5))
                                .foregroundStyle(DT.ink55(scheme))
                        }
                        Spacer()
                    }
                    .padding(.top, 8)

                    Eyebrow("HOOK · ALWAYS LOADED").padding(.top, 18)
                    Text(file.hook)
                        .scaledFont(13.5, .semibold)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                        .padding(.top, 7)

                    HStack {
                        Eyebrow("BODY · LOADS WHEN RELEVANT")
                        Spacer()
                        Button {
                            if editing {
                                store.updateMemory(file.id, body: draft)
                            } else {
                                draft = file.body
                            }
                            withAnimation(.easeOut(duration: 0.2)) { editing.toggle() }
                        } label: {
                            Text(editing ? "Save" : "Edit")
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundStyle(DT.violetText(scheme))
                        }
                        .buttonStyle(Pressable())
                    }
                    .padding(.top, 18)

                    Group {
                        if editing {
                            TextEditor(text: $draft)
                                .scaledFont(13)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 180)
                                .padding(8)
                        } else {
                            Text(file.body)
                                .scaledFont(13)
                                .lineSpacing(3)
                                .foregroundStyle(DT.ink78(scheme))
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .card()
                    .padding(.top, 7)

                    Text("Dynamic context discovery: the hook loads at session start; the body loads only when the work makes it relevant. On-device in the preview; the host reads the same shape.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(DT.ink35(scheme))
                        .padding(.top, 14)
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(file?.name ?? "Memory")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Browser (all scopes)

/// Every notebook in one place, filterable by scope — agent, session,
/// task, project, plan.
struct MemoryBrowserView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var scopeFilter: MemoryScope? = nil

    var body: some View {
        let files = store.memory(scope: scopeFilter)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        scopeChip(nil, label: "All · \(store.memoryFiles.count)")
                        ForEach(MemoryScope.allCases) { scope in
                            let count = store.memory(scope: scope).count
                            if count > 0 {
                                scopeChip(scope, label: "\(scope.rawValue) · \(count)")
                            }
                        }
                    }
                }
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .padding(.top, 8)

                VStack(spacing: 0) {
                    ForEach(Array(files.enumerated()), id: \.element.id) { index, file in
                        if index > 0 {
                            Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 51)
                        }
                        NavigationLink { MemoryFileView(fileId: file.id) } label: {
                            MemoryRow(file: file, showOwner: true)
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .card()
                .padding(.top, 12)

                Text("Memory is the fleet's notebook — files with hooks. Hooks always load; bodies load when relevant. Agents write their own; you can read, edit, and pin everything.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 18)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Memory")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func scopeChip(_ scope: MemoryScope?, label: String) -> some View {
        let selected = scopeFilter == scope
        let tint = scope?.tint ?? DT.violet
        return Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { scopeFilter = scope }
        } label: {
            HStack(spacing: 5) {
                if let scope {
                    Image(systemName: scope.symbol).font(.system(size: 10, weight: .semibold))
                }
                Text(label).font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(selected ? .white : DT.ink78(scheme))
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(selected ? AnyShapeStyle(tint) : AnyShapeStyle(DT.surface(scheme)))
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(selected ? .clear : DT.hairline(scheme), lineWidth: 0.8))
        }
        .buttonStyle(Pressable())
    }
}
