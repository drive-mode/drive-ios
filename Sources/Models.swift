import SwiftUI

enum AgentState: String {
    case working = "Working"
    case needsYou = "Needs you"
    case stuck = "Stuck?"
}

struct Agent: Identifiable, Equatable {
    let id: String
    let name: String
    let role: String
    let color: Color
    var statusLine: String
    var age: String
    var state: AgentState
    var voice: String
    var editsAllowed: Int
    var testsRun: Int
    var uptime: String
}

enum AgentRuntimeFamily: String, CaseIterable {
    case claude = "Claude"
    case codex = "Codex"
    case cline = "Cline"
    case apple = "Apple"
    case other = "Other"
}

enum AgentExecutionLocation: String, CaseIterable {
    case hosted = "Hosted"
    case onDevice = "On device"
}

/// Sanitized runtime identity. This intentionally cannot carry a model id,
/// endpoint, key, prompt, tool list, or routing configuration.
struct AgentRuntimeBadge: Equatable {
    let family: AgentRuntimeFamily
    let executionLocation: AgentExecutionLocation

    var label: String { "\(family.rawValue) · \(executionLocation.rawValue)" }

    static func forAgentID(_ id: String) -> AgentRuntimeBadge {
        switch id {
        case "maya": return AgentRuntimeBadge(family: .claude, executionLocation: .hosted)
        case "coder": return AgentRuntimeBadge(family: .codex, executionLocation: .hosted)
        case "scout": return AgentRuntimeBadge(family: .codex, executionLocation: .hosted)
        case "indexer": return AgentRuntimeBadge(family: .apple, executionLocation: .onDevice)
        default: return AgentRuntimeBadge(family: .other, executionLocation: .hosted)
        }
    }
}

struct DiffLine: Identifiable {
    let id = UUID()
    let text: String
    let added: Bool
}

enum InterruptKind { case approval, blocked, review }

struct Interrupt: Identifiable {
    let id: String
    let agentName: String
    let agentColor: Color
    let title: String
    let kind: InterruptKind
    let detail: [String]
    let age: String
    var resolved = false
}

struct RecentRoom: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let badge: String?
}

// MARK: - Tasks

enum TaskState: String {
    case running = "Running"
    case review = "Review"
    case blocked = "Blocked"
    case queued = "Queued"
    case done = "Done"
}

struct TaskItem: Identifiable, Equatable {
    let id: String
    let title: String
    let room: String
    let agentName: String
    let agentColor: Color
    var state: TaskState
    var progress: Double? = nil
    var detail: String? = nil
    /// Task ids this task depends on (edges on the task map).
    var deps: [String] = []
}

struct Project: Identifiable, Hashable {
    let id: String
    let name: String
    let area: String
}

/// Per-project aggregate — computed once per index rebuild so the overview
/// stays O(visible cards), not O(all tasks), at render time.
struct ProjectAgg {
    var total = 0
    var running = 0
    var review = 0
    var blocked = 0
    var queued = 0
    var done = 0
    var attention: Int { review + blocked }
    var active: Bool { running > 0 }
}

// MARK: - Artifacts

enum ArtifactKind: String, CaseIterable {
    case plan = "Plan"
    case diff = "Diff"
    case report = "Report"
    case replay = "Replay"
    case doc = "Doc"
    case capture = "Capture"

    var symbol: String {
        switch self {
        case .plan: return "list.bullet.rectangle"
        case .diff: return "plus.forwardslash.minus"
        case .report: return "chart.bar.doc.horizontal"
        case .replay: return "play.rectangle"
        case .doc: return "doc.richtext"
        case .capture: return "camera.viewfinder"
        }
    }

    var tint: Color {
        switch self {
        case .plan: return Color(hex: 0x9F58FA)
        case .diff: return Color(hex: 0x2BCC28)
        case .report: return Color(hex: 0x5B8DEF)
        case .replay: return Color(hex: 0xFFC55C)
        case .doc: return Color(hex: 0x2DD4BF)
        case .capture: return Color(hex: 0xF472B6)
        }
    }
}

/// Purpose decides lifespan: a bug-fix demo dies with the bug (ephemeral,
/// TTL then auto-file); an architecture diagram keeps until superseded.
enum ArtifactLife: Equatable {
    case permanent
    case ephemeral(daysLeft: Int)

    var isPermanent: Bool { if case .permanent = self { return true }; return false }
    var badge: String {
        switch self {
        case .permanent: return "keeps"
        case .ephemeral(let d): return d <= 0 ? "filing…" : "\(d)d left"
        }
    }
    var symbol: String { isPermanent ? "infinity" : "hourglass" }
}

struct Artifact: Identifiable, Equatable {
    let id: String
    let title: String
    let kind: ArtifactKind
    let room: String
    let repo: String
    let agentName: String
    let agentColor: Color
    let age: String
    let day: String
    let meta: String
    let sizeKB: Int
    var life: ArtifactLife

    var sizeLabel: String {
        sizeKB >= 1024 ? String(format: "%.1f MB", Double(sizeKB) / 1024) : "\(sizeKB) KB"
    }
}

// MARK: - Activity history (the Today calendar)

struct DayRecord: Identifiable {
    let id: Int
    let date: Date
    let ships: Int
    let byProject: [(name: String, count: Int)]
}

enum ActivityDemo {
    /// 365 days of shipping history, index 0 = today. Seeded — stable.
    static let days: [DayRecord] = {
        var rng = DemoScale.SeededRNG(state: 0xAC71_1717)
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let pool = ["Auth middleware", "Exports refactor", "Analytics v2", "Payments refactor",
                    "Ship notifications", "Ops", "Quotas audit", "Sessions hardening"]
        return (0..<365).map { i in
            let date = cal.date(byAdding: .day, value: -i, to: today) ?? today
            let weekday = cal.component(.weekday, from: date)
            let weekend = weekday == 1 || weekday == 7
            let base = weekend ? Int.random(in: 0...6, using: &rng) : Int.random(in: 3...22, using: &rng)
            var remaining = base
            var slices: [(String, Int)] = []
            let projectCount = min(max(1, base / 5 + 1), 4)
            for p in 0..<projectCount where remaining > 0 {
                let take = p == projectCount - 1 ? remaining : Int.random(in: 1...max(1, remaining), using: &rng)
                slices.append((pool[Int.random(in: 0..<pool.count, using: &rng)], take))
                remaining -= take
            }
            // merge duplicate project names
            var merged: [String: Int] = [:]
            for (name, count) in slices { merged[name, default: 0] += count }
            return DayRecord(id: i, date: date, ships: base,
                             byProject: merged.map { ($0.key, $0.value) }.sorted { $0.1 > $1.1 })
        }
    }()

    /// The contribution wall re-renders on every selection tap — its week
    /// columns and month labels are derived once here, never per body.
    static let yearColumns: [[DayRecord?]] = {
        let ordered = days.sorted { $0.date < $1.date }
        guard let first = ordered.first else { return [] }
        let lead = Calendar.current.component(.weekday, from: first.date) - 1
        var cells: [DayRecord?] = Array(repeating: nil, count: lead) + ordered.map { $0 }
        while cells.count % 7 != 0 { cells.append(nil) }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<$0 + 7]) }
    }()

    static let yearMonthLabels: [String?] = {
        let cal = Calendar.current
        return yearColumns.indices.map { c in
            guard let day = yearColumns[c].compactMap({ $0 }).first else { return nil }
            let month = cal.component(.month, from: day.date)
            if c == 0 { return day.date.formatted(.dateTime.month(.abbreviated)) }
            if let prev = yearColumns[c - 1].compactMap({ $0 }).first,
               cal.component(.month, from: prev.date) != month {
                return day.date.formatted(.dateTime.month(.abbreviated))
            }
            return nil
        }
    }()

    static let maxDailyShips: Int = max(1, days.map(\.ships).max() ?? 1)
}

// MARK: - Inbox

/// One stream, two voices: updates from your fleet (approvals, invitations,
/// ships) and news from the product itself. Managed like mail: read state,
/// archive, delete, act inline.
enum InboxKind {
    case approval, blocked, invite, shipped, streak, product, tip

    var symbol: String {
        switch self {
        case .approval: return "checkmark.seal"
        case .blocked: return "questionmark.bubble"
        case .invite: return "envelope.open"
        case .shipped: return "shippingbox"
        case .streak: return "sparkles"
        case .product: return "megaphone"
        case .tip: return "lightbulb"
        }
    }

    var tint: Color {
        switch self {
        case .approval: return Color(hex: 0x9F58FA)
        case .blocked: return Color(hex: 0x5B8DEF)
        case .invite: return Color(hex: 0xB98AFF)
        case .shipped: return Color(hex: 0x2BCC28)
        case .streak: return Color(hex: 0xFFC55C)
        case .product: return Color(hex: 0x2DD4BF)
        case .tip: return Color(hex: 0xF472B6)
        }
    }

    /// Product news vs your own usage.
    var isProduct: Bool { self == .product || self == .tip }
}

struct InboxItem: Identifiable, Equatable {
    let id: String
    let kind: InboxKind
    let title: String
    let body: String
    let age: String
    var read = false
    var archived = false
    /// Interrupt this item can act on (approval / blocked reply).
    var interruptId: String? = nil
}

extension DemoData {
    static let inbox: [InboxItem] = [
        InboxItem(id: "n1", kind: .approval, title: "Cline needs an approval",
                  body: "Wants to edit auth.ts — +12 −3 on branch drive/auth. Allow it right from here.",
                  age: "2m", interruptId: "approve-auth"),
        InboxItem(id: "n2", kind: .blocked, title: "Scout is blocked",
                  body: "“Which secret store should I read for DATABASE_URL — env or vault?”",
                  age: "5m", interruptId: "blocked-scout"),
        InboxItem(id: "n3", kind: .invite, title: "Maya invited you to a working session",
                  body: "Payments refactor — plan review, ~15 minutes. Join when you're ready.",
                  age: "18m"),
        InboxItem(id: "n4", kind: .shipped, title: "Gate JWT refresh landed",
                  body: "Auth middleware · Cline — suite green, 38ms p95 after the gate.",
                  age: "31m"),
        InboxItem(id: "n5", kind: .streak, title: "6-day steering streak",
                  body: "Answer one interrupt today to keep it rolling.",
                  age: "1h", read: true),
        InboxItem(id: "n6", kind: .product, title: "Theater mode is here",
                  body: "Rotate your phone in any working session — the Presenter stage goes full-bleed with floating controls.",
                  age: "3h"),
        InboxItem(id: "n7", kind: .tip, title: "Scrub beats like stories",
                  body: "Swipe or tap the Presenter stage edges to move between plan, diagram, and test beats.",
                  age: "5h", read: true),
        InboxItem(id: "n8", kind: .shipped, title: "223 tasks filed to the archive",
                  body: "Your sweep kept the desk clear — everything stays searchable.",
                  age: "1d", read: true),
        InboxItem(id: "n9", kind: .product, title: "Drive 0.2 release notes",
                  body: "Task map, Presenter stage, ambient guide bar, and the working-sessions rename.",
                  age: "2d", read: true),
        InboxItem(id: "n10", kind: .invite, title: "Scout invited you to a working session",
                  body: "Sessions hardening — token rotation walkthrough.",
                  age: "3d", read: true, archived: true),
    ]
}

// MARK: - Metrics ("your week")

struct DayStat: Identifiable {
    let id: Int
    let day: String
    let ships: Int
    let approvals: Int
    let talkMin: Int
}

struct Badge: Identifiable {
    let id: String
    let symbol: String
    let name: String
    let note: String
    let earned: Bool
}

// MARK: - Interrupt conversations

enum ConvSender { case agent, you, system }

struct ConvMessage: Identifiable {
    let id = UUID()
    let sender: ConvSender
    let text: String
    let time: String
}

// MARK: - Presenter stage

/// One beat of the directed program. The Presenter stage never streams pixels —
/// agents publish typed work events and the director choreographs them
/// into something a phone can digest (portrait or theater).
enum BeatKind: String, Equatable {
    case plan = "PLAN"
    case diagram = "DIAGRAM"
    case edit = "EDIT"
    case command = "RUN"
    case test = "TESTS"
    case decision = "DECISION"
    case metric = "RESULT"
}

struct Beat: Identifiable, Equatable {
    let id: Int
    let kind: BeatKind
    let title: String
    let director: String
    let directorColor: Color
    let caption: String
    let duration: Double
    let steps: [String]
    var accent: [Int] = []
}

// MARK: - Demo data

enum DemoData {
    static let maya = Color(hex: 0x7A3FD4)
    static let coder = Color(hex: 0x151516)
    static let scout = Color(hex: 0x5B8DEF)

    static let agents: [Agent] = [
        Agent(id: "maya", name: "Maya", role: "REVIEWER", color: maya,
              statusLine: "Reviewing diff · auth.ts", age: "8s", state: .working,
              voice: "Sage · en-US", editsAllowed: 9, testsRun: 12, uptime: "2h 14m"),
        Agent(id: "coder", name: "Cline", role: "BUILDER", color: coder,
              statusLine: "Waiting on approval — edit auth.ts", age: "2m", state: .needsYou,
              voice: "Brook · en-US", editsAllowed: 26, testsRun: 61, uptime: "5h 02m"),
        Agent(id: "scout", name: "Scout", role: "RESEARCHER", color: scout,
              statusLine: "Migrating tests · 12/40", age: "24s", state: .working,
              voice: "Quill · en-GB", editsAllowed: 3, testsRun: 118, uptime: "1h 40m"),
        Agent(id: "indexer", name: "Indexer", role: "UTILITY", color: Color(hex: 0x8A8F98),
              statusLine: "No report for 6 minutes", age: "6m", state: .stuck,
              voice: "Mono · en-US", editsAllowed: 0, testsRun: 0, uptime: "6h 51m"),
    ]

    static let interrupts: [Interrupt] = [
        Interrupt(id: "approve-auth", agentName: "Cline", agentColor: coder,
                  title: "Cline wants to edit auth.ts", kind: .approval,
                  detail: ["+ export function requireAuth()", "+   verifyJwt(req)"], age: "2m"),
        Interrupt(id: "blocked-scout", agentName: "Scout", agentColor: scout,
                  title: "Scout is blocked on staging config", kind: .blocked,
                  detail: ["“Which secret store should I read for DATABASE_URL — env or vault?”"], age: "5m"),
        Interrupt(id: "review-maya", agentName: "Maya", agentColor: maya,
                  title: "Plan ready to review — payments refactor", kind: .review,
                  detail: [], age: "1h"),
    ]

    static let recents: [RecentRoom] = [
        RecentRoom(id: "payments", title: "Payments refactor", subtitle: "Yesterday · Plan ready", badge: "Review"),
        RecentRoom(id: "status-sync", title: "Status board sync", subtitle: "Mon · Completed", badge: nil),
    ]

    /// Curated tasks that carry the demo narrative (interrupts reference t1/t2/t4).
    static let curatedTasks: [TaskItem] = [
        TaskItem(id: "t1", title: "Gate JWT refresh", room: "Auth middleware", agentName: "Cline",
                 agentColor: coder, state: .running, progress: 0.72, detail: "requireAuth landing · tests queued",
                 deps: ["t2"]),
        TaskItem(id: "t2", title: "Migrate auth tests", room: "Auth middleware", agentName: "Scout",
                 agentColor: scout, state: .running, progress: 0.30, detail: "12/40 suites moved",
                 deps: ["t4"]),
        TaskItem(id: "t3", title: "Payments refactor plan", room: "Payments refactor", agentName: "Maya",
                 agentColor: maya, state: .review, detail: "5-step plan · touches 14 files"),
        TaskItem(id: "t4", title: "Rotate staging secrets", room: "Ops", agentName: "Scout",
                 agentColor: scout, state: .blocked, detail: "Needs DATABASE_URL source"),
        TaskItem(id: "t5", title: "Status board sync", room: "Status board", agentName: "Maya",
                 agentColor: maya, state: .done),
        TaskItem(id: "t6", title: "Bump bun to 1.2", room: "Chores", agentName: "Cline",
                 agentColor: coder, state: .done),
    ]

    static let usage: [(value: String, label: String, sub: String)] = [
        ("6", "Sessions this week", "1h 42m working together"),
        ("38", "Edits allowed", "3 denied"),
        ("11", "Interrupts cleared", "median 40s to answer"),
        ("24m", "Talk time", "hold-to-talk"),
    ]

    // Rings close when the fleet keeps moving: steer (talk), answer
    // (interrupts), ship (tasks landed). Apple Activity habits, Drive verbs.
    static let rings: [(label: String, value: String, goal: String, progress: Double, color: Color)] = [
        ("Steer", "24m", "of 30m talk", 0.80, Color(hex: 0x9F58FA)),
        ("Answer", "11", "of 12 interrupts", 0.92, Color(hex: 0x2BCC28)),
        ("Ship", "38", "of 40 tasks", 0.95, Color(hex: 0xFFC55C)),
    ]

    static let week: [DayStat] = [
        DayStat(id: 0, day: "Mon", ships: 9, approvals: 5, talkMin: 4),
        DayStat(id: 1, day: "Tue", ships: 21, approvals: 9, talkMin: 7),
        DayStat(id: 2, day: "Wed", ships: 6, approvals: 3, talkMin: 2),
        DayStat(id: 3, day: "Thu", ships: 14, approvals: 8, talkMin: 6),
        DayStat(id: 4, day: "Fri", ships: 11, approvals: 6, talkMin: 3),
        DayStat(id: 5, day: "Sat", ships: 3, approvals: 1, talkMin: 1),
        DayStat(id: 6, day: "Sun", ships: 8, approvals: 6, talkMin: 5),
    ]

    static let trends: [(symbol: String, label: String, delta: String, up: Bool, good: Bool)] = [
        ("checkmark.circle", "Edits allowed", "+23%", true, true),
        ("bolt", "Time to answer", "−18%", false, true),
        ("waveform", "Talk per session", "+9%", true, true),
    ]

    static let records: [(value: String, label: String, sub: String, symbol: String)] = [
        ("40s", "Fastest unblock", "Scout, Thursday — personal best", "bolt.fill"),
        ("21", "Best shipping day", "Tuesday · new record", "flag.checkered"),
    ]

    static let insights: [String] = [
        "Tuesday is your power day — 55% of this week's ships landed before lunch.",
        "You answer Scout fastest. Cline waits 3× longer — worth a quiet-hours tweak?",
    ]

    static let streakDays = 6

    static let badges: [Badge] = [
        Badge(id: "unblocker", symbol: "key.fill", name: "Unblocker", note: "Cleared 5 blocked agents", earned: true),
        Badge(id: "night", symbol: "moon.stars.fill", name: "Night Shift", note: "Approved after midnight", earned: true),
        Badge(id: "theater", symbol: "rectangle.landscape.rotate", name: "Theater Debut", note: "First rotated Presenter stage", earned: true),
        Badge(id: "sweep", symbol: "sparkles", name: "Clean Desk", note: "First archive sweep", earned: true),
        Badge(id: "century", symbol: "100.circle", name: "Century", note: "100 tasks shipped", earned: false),
        Badge(id: "marathon", symbol: "timer", name: "Marathon", note: "10 hours in session", earned: false),
    ]

    static let indexer = Color(hex: 0x8A8F98)

    static let artifacts: [Artifact] = [
        Artifact(id: "a1", title: "Auth rollout plan", kind: .plan, room: "Auth middleware", repo: "drive-mode/auth", agentName: "Maya", agentColor: maya, age: "12m", day: "Today", meta: "5 steps · 14 files", sizeKB: 18, life: .permanent),
        Artifact(id: "a2", title: "requireAuth diff", kind: .diff, room: "Auth middleware", repo: "drive-mode/auth", agentName: "Cline", agentColor: coder, age: "26m", day: "Today", meta: "+12 −3 · auth.ts", sizeKB: 6, life: .ephemeral(daysLeft: 7)),
        Artifact(id: "a3", title: "Auth suite report", kind: .report, room: "Auth middleware", repo: "drive-mode/auth", agentName: "Scout", agentColor: scout, age: "31m", day: "Today", meta: "5/5 passing · 38ms p95", sizeKB: 142, life: .ephemeral(daysLeft: 30)),
        Artifact(id: "a4", title: "Room replay — beats 1–8", kind: .replay, room: "Auth middleware", repo: "drive-mode/auth", agentName: "Maya", agentColor: maya, age: "1h", day: "Today", meta: "56s · 8 beats", sizeKB: 4300, life: .ephemeral(daysLeft: 30)),
        Artifact(id: "a5", title: "Payments refactor plan", kind: .plan, room: "Payments refactor", repo: "drive-mode/payments", agentName: "Maya", agentColor: maya, age: "1d", day: "Yesterday", meta: "waiting on review", sizeKB: 24, life: .permanent),
        Artifact(id: "a6", title: "Latency ladder", kind: .report, room: "Payments refactor", repo: "drive-mode/payments", agentName: "Scout", agentColor: scout, age: "1d", day: "Yesterday", meta: "41ms → 38ms", sizeKB: 88, life: .permanent),
        Artifact(id: "a7", title: "Secrets runbook", kind: .doc, room: "Ops", repo: "drive-mode/infra", agentName: "Scout", agentColor: scout, age: "2d", day: "2 days ago", meta: "env rotation steps", sizeKB: 41, life: .permanent),
        Artifact(id: "a8", title: "Staging config capture", kind: .capture, room: "Ops", repo: "drive-mode/infra", agentName: "Scout", agentColor: scout, age: "2d", day: "2 days ago", meta: "before rotation", sizeKB: 980, life: .ephemeral(daysLeft: 5)),
        Artifact(id: "a9", title: "Exports adapter diff", kind: .diff, room: "Exports refactor", repo: "drive-mode/exports", agentName: "Cline", agentColor: coder, age: "3h", day: "Today", meta: "+84 −29 · 6 files", sizeKB: 34, life: .ephemeral(daysLeft: 7)),
        Artifact(id: "a10", title: "Fixture backfill report", kind: .report, room: "Exports refactor", repo: "drive-mode/exports", agentName: "Indexer", agentColor: indexer, age: "5h", day: "Today", meta: "1,204 rows", sizeKB: 260, life: .ephemeral(daysLeft: 30)),
        Artifact(id: "a11", title: "Notifications v2 plan", kind: .plan, room: "Ship notifications", repo: "drive-mode/notify", agentName: "Maya", agentColor: maya, age: "6h", day: "Today", meta: "3 phases", sizeKB: 15, life: .permanent),
        Artifact(id: "a12", title: "Quota audit doc", kind: .doc, room: "Quotas audit", repo: "drive-mode/quotas", agentName: "Maya", agentColor: maya, age: "8h", day: "Today", meta: "findings + limits", sizeKB: 66, life: .permanent),
        Artifact(id: "a13", title: "Analytics schema diff", kind: .diff, room: "Analytics v2", repo: "drive-mode/analytics", agentName: "Cline", agentColor: coder, age: "9h", day: "Today", meta: "+41 −7 · events.ts", sizeKB: 12, life: .ephemeral(daysLeft: 3)),
        Artifact(id: "a14", title: "Dashboard capture", kind: .capture, room: "Analytics v2", repo: "drive-mode/analytics", agentName: "Indexer", agentColor: indexer, age: "10h", day: "Today", meta: "weekly rollup", sizeKB: 1850, life: .ephemeral(daysLeft: 7)),
        Artifact(id: "a15", title: "Status board replay", kind: .replay, room: "Status board", repo: "drive-mode/hub", agentName: "Maya", agentColor: maya, age: "3d", day: "3 days ago", meta: "42s · 6 beats", sizeKB: 3100, life: .ephemeral(daysLeft: 1)),
        Artifact(id: "a16", title: "Webhook contract doc", kind: .doc, room: "Ship webhooks", repo: "drive-mode/webhooks", agentName: "Cline", agentColor: coder, age: "3d", day: "3 days ago", meta: "v0 · signed payloads", sizeKB: 52, life: .permanent),
        Artifact(id: "a17", title: "Session probe report", kind: .report, room: "Sessions hardening", repo: "drive-mode/sessions", agentName: "Scout", agentColor: scout, age: "4d", day: "4 days ago", meta: "0 leaks found", sizeKB: 190, life: .permanent),
        Artifact(id: "a18", title: "Token rotation diff", kind: .diff, room: "Sessions hardening", repo: "drive-mode/sessions", agentName: "Cline", agentColor: coder, age: "4d", day: "4 days ago", meta: "+18 −18", sizeKB: 9, life: .ephemeral(daysLeft: 2)),
    ]

    /// The directed program for the auth-middleware room (~56s loop).
    static let beats: [Beat] = [
        Beat(id: 0, kind: .plan, title: "Ship auth middleware", director: "Maya", directorColor: maya,
             caption: "Here's the shape — four moves, we're on the second.", duration: 7,
             steps: ["Add verifyJwt to middleware", "Gate the refresh route", "Land requireAuth helper", "Run the auth suite"],
             accent: [0]),
        Beat(id: 1, kind: .diagram, title: "Request path", director: "Maya", directorColor: maya,
             caption: "Every refresh now passes through verifyJwt before routing.", duration: 8,
             steps: ["Client", "POST /refresh", "middleware", "verifyJwt", "next()"],
             accent: [3]),
        Beat(id: 2, kind: .edit, title: "auth.ts · middleware", director: "Cline", directorColor: coder,
             caption: "Two lines in the hot path — token check, early return.", duration: 8,
             steps: ["export async function middleware(req) {",
                     "+  const token = await verifyJwt(req)",
                     "+  if (!token) return unauthorized()",
                     "   return next()",
                     "}"]),
        Beat(id: 3, kind: .command, title: "bun test auth", director: "Scout", directorColor: scout,
             caption: "Running the suite against the new gate.", duration: 6,
             steps: ["$ bun test auth --bail",
                     "scanning 6 files…",
                     "auth/middleware.test.ts",
                     "auth/refresh.test.ts",
                     "auth/session.test.ts"]),
        Beat(id: 4, kind: .test, title: "Auth suite", director: "Scout", directorColor: scout,
             caption: "Green across the gate — refresh regression stays dead.", duration: 8,
             steps: ["verifies signed JWT", "rejects expired token", "rejects missing header",
                     "refresh flows through gate", "session survives rotate"]),
        Beat(id: 5, kind: .decision, title: "Gate refresh before merge?", director: "Maya", directorColor: maya,
             caption: "Maya's call: gate now, no flag — the suite covers it.", duration: 7,
             steps: ["Gate now — suite covers the path", "Ship behind a flag, gate later"],
             accent: [0]),
        Beat(id: 6, kind: .edit, title: "auth.ts · requireAuth", director: "Cline", directorColor: coder,
             caption: "Landing the helper you approved.", duration: 7,
             steps: ["+ export function requireAuth() {",
                     "+   verifyJwt(req); next()",
                     "+ }"]),
        Beat(id: 7, kind: .metric, title: "After the gate", director: "Maya", directorColor: maya,
             caption: "Cheaper and safer — ready to merge.", duration: 7,
             steps: ["p95 before|41", "p95 after|38", "0 unauthorized regressions"],
             accent: [1]),
    ]

    static let baseDiff: [DiffLine] = [
        DiffLine(text: "export async function middleware(req) {", added: false),
        DiffLine(text: "+  const token = await verifyJwt(req)", added: true),
        DiffLine(text: "+  if (!token) return unauthorized()", added: true),
        DiffLine(text: "   return next()", added: false),
        DiffLine(text: "}", added: false),
    ]

    /// Seed threads for interrupt conversations — the durable, readable-after-
    /// the-fact log rendered as a thread instead of a wall of text.
    static func seedConversation(for interruptId: String) -> [ConvMessage] {
        switch interruptId {
        case "blocked-scout":
            return [
                ConvMessage(sender: .system, text: "Scout · report_status — Migrating tests · 12/40", time: "9m"),
                ConvMessage(sender: .system, text: "Scout · report_status — Staging run needs DATABASE_URL", time: "6m"),
                ConvMessage(sender: .agent, text: "I'm blocked on staging config. Which secret store should I read for DATABASE_URL — env or vault?", time: "5m"),
            ]
        case "approve-auth":
            return [
                ConvMessage(sender: .system, text: "Cline · report_status — Drafting requireAuth in auth.ts", time: "4m"),
                ConvMessage(sender: .agent, text: "Ready to land requireAuth — +12 −3 on auth.ts, branch drive/auth. Approve?", time: "2m"),
            ]
        case "review-maya":
            return [
                ConvMessage(sender: .system, text: "Maya · report_status — Plan drafted · 5 steps", time: "1h"),
                ConvMessage(sender: .agent, text: "The payments refactor plan is ready — 5 steps, touches 14 files. Review when you have a minute; nothing moves until you do.", time: "1h"),
            ]
        default:
            return []
        }
    }

    /// The projects the curated narrative lives in — present from first paint.
    /// The generated fleet (hundreds more) arrives asynchronously after launch.
    static let baseProjects: [Project] = [
        Project(id: "Auth middleware", name: "Auth middleware", area: "Platform"),
        Project(id: "Payments refactor", name: "Payments refactor", area: "Platform"),
        Project(id: "Ops", name: "Ops", area: "Infra"),
        Project(id: "Status board", name: "Status board", area: "Hub"),
        Project(id: "Chores", name: "Chores", area: "Infra"),
    ]
}

/// Deterministic large-scale demo world: hundreds of projects, ~1,200 tasks,
/// generated with a seeded RNG so layouts and narratives are stable run to run.
enum DemoScale {
    struct SeededRNG: RandomNumberGenerator {
        var state: UInt64
        mutating func next() -> UInt64 {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return state
        }
    }

    private static let areas = ["Platform", "Mobile", "Hub", "Infra", "Growth", "SDK", "Ops", "Docs"]
    private static let projectNouns = ["billing", "search", "onboarding", "presence", "exports", "webhooks",
                                       "analytics", "notifications", "migrations", "caching", "rate limits",
                                       "review flow", "secrets", "telemetry", "design tokens", "replays",
                                       "transcripts", "packs", "roster", "invites", "sessions", "presenter",
                                       "interrupts", "voice", "artifacts", "checkpoints", "sandboxes", "quotas"]
    private static let projectShapes = ["%@ refactor", "%@ hardening", "%@ v2", "Ship %@", "%@ cleanup", "%@ rollout", "%@ audit"]
    private static let verbs = ["Migrate", "Gate", "Rotate", "Bump", "Wire", "Split", "Cache", "Throttle",
                                "Instrument", "Backfill", "Dedupe", "Flatten", "Extract", "Polish",
                                "Document", "Profile", "Batch", "Retry", "Snapshot", "Verify"]
    private static let objects = ["tokens", "sessions", "fixtures", "adapters", "queries", "events", "schemas",
                                  "routes", "mocks", "specs", "flags", "indexes", "payloads", "retries",
                                  "timeouts", "cursors", "digests", "manifests", "locks", "probes"]
    private static let agentPool: [(String, Color)] = [
        ("Maya", DemoData.maya), ("Cline", DemoData.coder), ("Scout", DemoData.scout),
        ("Indexer", Color(hex: 0x8A8F98)),
    ]

    /// Computed on first access — dispatch that access off the main thread
    /// (AppStore.seedFleet does) so launch never pays for the fleet.
    static let generated: (projects: [Project], tasks: [TaskItem]) = build()

    private static func build() -> ([Project], [TaskItem]) {
        var rng = SeededRNG(state: 0xD217E_CA5E)
        var projects = DemoData.baseProjects
        var tasks = DemoData.curatedTasks
        var usedNames = Set(projects.map(\.name))

        // Pad the curated hot projects so their maps feel busy.
        tasks += padTasks(project: "Auth middleware", count: 9, hot: true, rng: &rng)
        tasks += padTasks(project: "Payments refactor", count: 7, hot: true, rng: &rng)
        tasks += padTasks(project: "Ops", count: 6, hot: true, rng: &rng)

        // 5 more hot, ~40 medium, ~170 quiet projects.
        for tier in 0..<3 {
            let (countRange, projectCount, hot): (ClosedRange<Int>, Int, Bool) = [
                (10...22, 5, true), (4...10, 40, false), (1...3, 170, false),
            ][tier]
            for _ in 0..<projectCount {
                let noun = projectNouns.randomElement(using: &rng)!
                var name = String(format: projectShapes.randomElement(using: &rng)!, noun)
                name = name.prefix(1).uppercased() + name.dropFirst()
                // Word banks are finite; suffix rather than spin when they run dry.
                if usedNames.contains(name) {
                    var n = 2
                    while usedNames.contains("\(name) \(n)") { n += 1 }
                    name = "\(name) \(n)"
                }
                usedNames.insert(name)
                let project = Project(id: name, name: name, area: areas.randomElement(using: &rng)!)
                projects.append(project)
                tasks += padTasks(project: name, count: Int.random(in: countRange, using: &rng), hot: hot, rng: &rng)
            }
        }
        return (projects, tasks)
    }

    private static func padTasks(project: String, count: Int, hot: Bool, rng: inout SeededRNG) -> [TaskItem] {
        var out: [TaskItem] = []
        for i in 0..<count {
            let agent = agentPool.randomElement(using: &rng)!
            let roll = Int.random(in: 0..<100, using: &rng)
            let state: TaskState = hot
                ? (roll < 30 ? .running : roll < 42 ? .review : roll < 50 ? .blocked : roll < 72 ? .queued : .done)
                : (roll < 12 ? .running : roll < 17 ? .review : roll < 20 ? .blocked : roll < 45 ? .queued : .done)
            let title = "\(verbs.randomElement(using: &rng)!) \(objects.randomElement(using: &rng)!)"
            let slug = project.lowercased().replacingOccurrences(of: " ", with: "-")
            let id = "g-\(slug)-\(i)"
            var task = TaskItem(id: id, title: title, room: project,
                                agentName: agent.0, agentColor: agent.1, state: state)
            if state == .running {
                task.progress = Double(Int.random(in: 8...92, using: &rng)) / 100
            }
            if state == .blocked { task.detail = "Waiting on an answer" }
            // ~35% of non-first tasks depend on an earlier sibling — layered maps.
            if i > 0, Int.random(in: 0..<100, using: &rng) < 35 {
                task.deps = [out[Int.random(in: 0..<out.count, using: &rng)].id]
            }
            out.append(task)
        }
        return out
    }


}
