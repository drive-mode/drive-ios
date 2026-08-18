import SwiftUI

// MARK: - Categories

enum SkillCategory: String, Codable, CaseIterable, Identifiable {
    case direction = "Direction & story"
    case delivery = "Build & delivery"
    case quality = "Quality & verification"
    case knowledge = "Knowledge & research"
    case collaboration = "People & collaboration"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .direction: return "sparkles.tv"
        case .delivery: return "shippingbox"
        case .quality: return "checkmark.diamond"
        case .knowledge: return "books.vertical"
        case .collaboration: return "person.2.wave.2"
        }
    }
}

// MARK: - Package pieces

/// Skills are multi-file packages: a manifest plus supporting files. Only
/// the manifest's hook loads up front — deeper files load when the work
/// makes them relevant (dynamic context discovery).
struct SkillFile: Codable, Identifiable, Equatable {
    var id: String { name }
    let name: String
    let note: String
    let lines: Int
}

enum SkillReview: String, Codable {
    case draft = "Draft"
    case reviewed = "Reviewed"
    case needsWork = "Needs work"
}

struct SkillPackage: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var verb: String
    var category: SkillCategory
    var symbol: String
    var tintHex: UInt32
    var gated: Bool
    var events: String
    var whenToUse: String
    var instructions: String
    var files: [SkillFile]
    var version: Int
    var review: SkillReview
    var builtIn: Bool

    var tint: Color { Color(hex: tintHex) }

    static func load() -> [SkillPackage] {
        guard let data = UserDefaults.standard.data(forKey: "skillPackages.v1"),
              let saved = try? JSONDecoder().decode([SkillPackage].self, from: data) else {
            return SkillCatalog.builtIns
        }
        // Forward-compat: catalog skills added after the save still appear.
        var out = saved
        for pack in SkillCatalog.builtIns where !out.contains(where: { $0.id == pack.id }) {
            out.append(pack)
        }
        return out
    }

    static func save(_ packages: [SkillPackage]) {
        if let data = try? JSONEncoder().encode(packages) {
            UserDefaults.standard.set(data, forKey: "skillPackages.v1")
        }
    }
}

// MARK: - Bundles (kits)

/// A bundle equips several skills in one move — set a kit up once, hand
/// it to any agent.
struct SkillBundle: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var note: String
    var skillIds: [String]
    var builtIn: Bool

    static let builtIns: [SkillBundle] = [
        SkillBundle(id: "kit-director", name: "Director kit",
                    note: "Runs the room: directs, plans, invites",
                    skillIds: ["directing", "tasks", "inviting"], builtIn: true),
        SkillBundle(id: "kit-builder", name: "Builder kit",
                    note: "Lands the work: edits, tasks, artifacts",
                    skillIds: ["editing", "tasks", "artifacts"], builtIn: true),
        SkillBundle(id: "kit-quality", name: "Quality kit",
                    note: "Proves the work: tests, research, reports",
                    skillIds: ["testing", "research", "artifacts"], builtIn: true),
        SkillBundle(id: "kit-front", name: "Front-of-house kit",
                    note: "Faces people: invites, triages feedback",
                    skillIds: ["inviting", "feedback"], builtIn: true),
    ]

    static func load() -> [SkillBundle] {
        guard let data = UserDefaults.standard.data(forKey: "skillBundles.v1"),
              let saved = try? JSONDecoder().decode([SkillBundle].self, from: data) else {
            return builtIns
        }
        var out = saved
        for bundle in builtIns where !out.contains(where: { $0.id == bundle.id }) {
            out.append(bundle)
        }
        return out
    }

    static func save(_ bundles: [SkillBundle]) {
        if let data = try? JSONEncoder().encode(bundles) {
            UserDefaults.standard.set(data, forKey: "skillBundles.v1")
        }
    }
}

// MARK: - The catalog (built-in packages, full manifests)

enum SkillCatalog {
    static let builtIns: [SkillPackage] = AgentSkill.allCases.map { base in
        SkillPackage(
            id: base.rawValue,
            name: base.name,
            verb: base.verb,
            category: category(for: base),
            symbol: base.symbol,
            tintHex: tintHex(for: base),
            gated: base.gated,
            events: base.events,
            whenToUse: whenToUse(for: base),
            instructions: instructions(for: base),
            files: files(for: base),
            version: 1,
            review: .reviewed,
            builtIn: true)
    }

    static func category(for skill: AgentSkill) -> SkillCategory {
        switch skill {
        case .directing: return .direction
        case .tasks, .artifacts, .editing: return .delivery
        case .testing: return .quality
        case .research: return .knowledge
        case .inviting, .feedback: return .collaboration
        }
    }

    private static func tintHex(for skill: AgentSkill) -> UInt32 {
        switch skill {
        case .directing: return 0x9F58FA
        case .tasks: return 0x5B8DEF
        case .artifacts: return 0xFFC55C
        case .editing: return 0x4ADE80
        case .testing: return 0xA3E635
        case .research: return 0x2DD4BF
        case .inviting: return 0xB98AFF
        case .feedback: return 0xF472B6
        }
    }

    private static func whenToUse(for skill: AgentSkill) -> String {
        switch skill {
        case .directing:
            return "When humans are watching the session — every meaningful stretch of work deserves a beat someone can follow from a phone."
        case .tasks:
            return "Whenever work has shape: more than one step, a dependency, or anything a human might ask 'where is it?' about."
        case .artifacts:
            return "When work produces something worth keeping — a plan, a diff summary, a report, a replay. Purpose decides lifespan."
        case .editing:
            return "When the change is drafted and the diff summary is honest. Never lands without the approval gate."
        case .testing:
            return "Before claiming anything works, and after every landing. Green is evidence, not a mood."
        case .research:
            return "When a question blocks work — read first, ask the human only what reading can't answer."
        case .inviting:
            return "When a human would change the outcome — a decision, a review, a demo worth watching live."
        case .feedback:
            return "When a rough suggestion arrives — shape it into a proposal with a clear surface and a decidable ask."
        }
    }

    private static func instructions(for skill: AgentSkill) -> String {
        switch skill {
        case .directing:
            return "Choreograph typed work events into beats: one idea per beat, 6–9 seconds, kind-tagged (plan, diagram, edit, run, tests, decision, result). Name related events so the stage can show the real work. Caption every beat — the audio thread must survive a skimmer. The wheel turns; the story stays upright."
        case .tasks:
            return "Create tasks with honest titles and real dependencies — the map draws what you declare. Advance state promptly (queued → running → review/blocked → done) and attach a summary to blocked states: the summary becomes the human's quoted ask."
        case .artifacts:
            return "Publish the durable outputs with a lifecycle: permanent for architecture and decisions, TTL for demos and captures. Title for a shelf, summarize for a card. Supersede rather than overwrite."
        case .editing:
            return "Propose diffs with a truthful +/− summary and the branch named. Wait for the gate. After landing, publish the diff artifact and hand the suite to testing. Never batch unrelated changes into one ask."
        case .testing:
            return "Run the suite that covers the change, report counts and timing, and file a report artifact when it matters. A red run is a finding, not a failure — report it the same way."
        case .research:
            return "Read code and docs before asking. When you must ask, ask one decidable question with the options named. Publish what you learned if it unblocks others."
        case .inviting:
            return "Invite, don't summon: name the session, say why now, respect quiet hours. One invitation per decision — chase-ups go through the inbox, not repeat invites."
        case .feedback:
            return "Turn raw suggestions into structured proposals: title, summary, surface, and — when one exists — the variant that lets a human feel it for a week. Keep the member's words; sharpen, don't replace."
        }
    }

    private static func files(for skill: AgentSkill) -> [SkillFile] {
        switch skill {
        case .directing:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — hook, when-to-use, beat grammar", lines: 64),
                SkillFile(name: "beat-grammar.md", note: "Kinds, durations, caption voice", lines: 118),
                SkillFile(name: "staging.md", note: "relatedEventIds — staging real work", lines: 42),
            ]
        case .tasks:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — states, dependencies, summaries", lines: 58),
                SkillFile(name: "states.md", note: "The five states and when they lie", lines: 71),
                SkillFile(name: "dependency-style.md", note: "Deps the map can draw", lines: 39),
            ]
        case .artifacts:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — lifecycle decides lifespan", lines: 52),
                SkillFile(name: "lifecycle.md", note: "Permanent vs TTL, superseding", lines: 66),
                SkillFile(name: "naming.md", note: "Titles for shelves, summaries for cards", lines: 28),
            ]
        case .editing:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — the approval gate is the point", lines: 61),
                SkillFile(name: "diff-honesty.md", note: "Truthful summaries, scoped asks", lines: 54),
                SkillFile(name: "landing.md", note: "After the gate: artifact + suite handoff", lines: 33),
            ]
        case .testing:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — green is evidence", lines: 47),
                SkillFile(name: "reporting.md", note: "Counts, timing, red-run findings", lines: 58),
            ]
        case .research:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — read before asking", lines: 44),
                SkillFile(name: "asking.md", note: "One decidable question, options named", lines: 36),
            ]
        case .inviting:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — invite, don't summon", lines: 38),
                SkillFile(name: "timing.md", note: "Why-now, quiet hours, no chase-ups", lines: 31),
            ]
        case .feedback:
            return [
                SkillFile(name: "SKILL.md", note: "Manifest — sharpen, don't replace", lines: 41),
                SkillFile(name: "proposal-shape.md", note: "Title, summary, surface, variant", lines: 45),
            ]
        }
    }

    /// The custom-skill scaffold: category guessed from the description,
    /// a fresh tint, generic footprint until the host maps a real one.
    static func draftCustom(name: String, description: String) -> SkillPackage {
        let folded = description.lowercased()
        let category: SkillCategory =
            folded.contains("test") || folded.contains("verif") ? .quality
            : folded.contains("doc") || folded.contains("read") || folded.contains("learn") ? .knowledge
            : folded.contains("invit") || folded.contains("review") || folded.contains("people") ? .collaboration
            : folded.contains("demo") || folded.contains("beat") || folded.contains("story") ? .direction
            : .delivery
        let palette: [UInt32] = [0xE8A13C, 0x38BDF8, 0xFB7185, 0x34D399, 0xC084FC]
        var hash = 0
        for scalar in name.unicodeScalars { hash = (hash &* 31 &+ Int(scalar.value)) & 0xFFFF }
        return SkillPackage(
            id: "custom-\(Int(Date().timeIntervalSince1970))",
            name: name,
            verb: description,
            category: category,
            symbol: "wand.and.stars",
            tintHex: palette[hash % palette.count],
            gated: false,
            events: "work.generic (host mapping pending)",
            whenToUse: "Draft — sharpen this with a review pass: when exactly should an agent reach for this?",
            instructions: description,
            files: [
                SkillFile(name: "SKILL.md", note: "Manifest — drafted from your description", lines: 18),
                SkillFile(name: "reference.md", note: "Add the deeper how-to here", lines: 0),
            ],
            version: 1,
            review: .draft,
            builtIn: false)
    }

    /// "Generate a better one": a sharpened draft of an existing package.
    /// Rule-based in the preview — the improvement is visible and honest.
    static func improved(_ package: SkillPackage) -> SkillPackage {
        var out = package
        out.version = package.version + 1
        out.review = .draft
        if !out.whenToUse.hasPrefix("Reach for this") {
            out.whenToUse = "Reach for this \(out.whenToUse.prefix(1).lowercased() + out.whenToUse.dropFirst())"
        }
        if !out.instructions.contains("Checklist:") {
            out.instructions += "\n\nChecklist: name the outcome before starting · publish the smallest honest event · close the loop (report, artifact, or beat) · leave the next reader a hook."
        }
        if !out.files.contains(where: { $0.name == "examples.md" }) {
            out.files.append(SkillFile(name: "examples.md", note: "Worked examples — generated, review before trusting", lines: 52))
        }
        return out
    }
}
