import SwiftUI

// MARK: - The skill registry

/// A skill is a TYPED CAPABILITY with an approval posture: the family of
/// events an agent may publish, and whether a human gates them. That is
/// exactly the policy that's allowed to cross the wire — and exactly where
/// the line sits: the *how* (prompts, tools, providers, models) lives on
/// the host and never crosses. Skills here mirror the packs the transport
/// already speaks (docs/SKILLS.md).
enum AgentSkill: String, CaseIterable, Identifiable {
    case directing, tasks, artifacts, editing, testing, research, inviting, feedback

    var id: String { rawValue }

    var name: String {
        switch self {
        case .directing: return "Directing"
        case .tasks: return "Task running"
        case .artifacts: return "Artifact publishing"
        case .editing: return "Code editing"
        case .testing: return "Test running"
        case .research: return "Research"
        case .inviting: return "Inviting"
        case .feedback: return "Feedback triage"
        }
    }

    var verb: String {
        switch self {
        case .directing: return "Choreographs work into Spotlight beats a phone can digest"
        case .tasks: return "Creates and advances tasks, with the dependencies the map draws"
        case .artifacts: return "Publishes plans, diffs, reports, and replays — with lifecycles"
        case .editing: return "Proposes diffs and lands them once you allow it"
        case .testing: return "Runs suites and reports green, red, and how fast"
        case .research: return "Reads code and docs, answers the blocking questions"
        case .inviting: return "Invites people into working sessions when it matters"
        case .feedback: return "Shapes rough suggestions into proposals worth deciding"
        }
    }

    var symbol: String {
        switch self {
        case .directing: return "sparkles.tv"
        case .tasks: return "checklist"
        case .artifacts: return "shippingbox"
        case .editing: return "plus.forwardslash.minus"
        case .testing: return "checkmark.diamond"
        case .research: return "magnifyingglass"
        case .inviting: return "envelope.open"
        case .feedback: return "bubble.left.and.text.bubble.right"
        }
    }

    var tint: Color {
        switch self {
        case .directing: return Color(hex: 0x9F58FA)
        case .tasks: return Color(hex: 0x5B8DEF)
        case .artifacts: return Color(hex: 0xFFC55C)
        case .editing: return Color(hex: 0x4ADE80)
        case .testing: return Color(hex: 0xA3E635)
        case .research: return Color(hex: 0x2DD4BF)
        case .inviting: return Color(hex: 0xB98AFF)
        case .feedback: return Color(hex: 0xF472B6)
        }
    }

    /// The event kinds this capability publishes — the skill's whole
    /// footprint on the wire, and the honest answer to "what can it do?"
    var events: String {
        switch self {
        case .directing: return "work.direction.beat"
        case .tasks: return "work.task.created · state · progress"
        case .artifacts: return "work.artifact.created · lifecycle"
        case .editing: return "work.edit → approval → land"
        case .testing: return "work.command · work.test"
        case .research: return "work.generic (read-only)"
        case .inviting: return "control.invite"
        case .feedback: return "feedback.suggestion (draft)"
        }
    }

    /// Approval-gated by default: the skill acts only after a human allows.
    var gated: Bool {
        switch self {
        case .editing: return true
        case .testing: return true
        default: return false
        }
    }
}

// MARK: - Loadouts (equipped skills per agent, persisted)

enum SkillLoadout {
    /// The out-of-the-box loadouts — each agent set up with the skills the
    /// fleet actually uses, matched to their role in the room.
    static let defaults: [String: [AgentSkill]] = [
        "maya": [.directing, .tasks, .inviting, .research],
        "coder": [.editing, .tasks, .artifacts, .feedback],
        "scout": [.testing, .research, .artifacts, .tasks],
        "indexer": [.artifacts, .research],
    ]

    static func fallback(for agentId: String) -> [AgentSkill] {
        defaults[agentId] ?? [.tasks, .artifacts]
    }

    static func equipped(for agentId: String) -> [AgentSkill] {
        guard let raw = UserDefaults.standard.string(forKey: "skills.\(agentId)") else {
            return fallback(for: agentId)
        }
        return raw.split(separator: ",").compactMap { AgentSkill(rawValue: String($0)) }
    }

    static func setEquipped(_ skills: [AgentSkill], for agentId: String) {
        UserDefaults.standard.set(
            skills.map(\.rawValue).joined(separator: ","),
            forKey: "skills.\(agentId)")
    }
}

extension AppStore {
    func equippedSkills(_ agentId: String) -> [AgentSkill] {
        SkillLoadout.equipped(for: agentId)
    }

    func toggleSkill(_ skill: AgentSkill, agentId: String) {
        var current = SkillLoadout.equipped(for: agentId)
        if let i = current.firstIndex(of: skill) {
            current.remove(at: i)
        } else {
            current.append(current.isEmpty ? skill : skill)
        }
        SkillLoadout.setEquipped(current, for: agentId)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            skillsVersion += 1
        }
    }

    /// Times this agent exercised a skill on the durable log — observed,
    /// never self-reported. Empty offline (demo world shows loadout only).
    func skillUse(_ agentId: String, _ skill: AgentSkill) -> Int {
        wireSkillUse[agentId]?[skill.rawValue] ?? 0
    }
}

// MARK: - Roster chips

/// The loadout at a glance — tiny tinted capability marks on agent rows.
struct SkillChipRow: View {
    let skills: [AgentSkill]

    var body: some View {
        HStack(spacing: 5) {
            ForEach(skills.prefix(5)) { skill in
                Image(systemName: skill.symbol)
                    .font(.system(size: 8.5, weight: .semibold))
                    .foregroundStyle(skill.tint.opacity(0.9))
            }
            if skills.count > 5 {
                Text("+\(skills.count - 5)")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Skills: \(skills.map(\.name).joined(separator: ", "))")
    }
}

// MARK: - The skills section on an agent's profile

/// Equip and unequip capabilities per agent. Gated skills carry the seal —
/// the tie back to APPROVALS below. Usage counts come off the durable log
/// when the wire is live.
struct AgentSkillsSection: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let agent: Agent

    var body: some View {
        // Reading skillsVersion keeps this section live across toggles.
        let _ = store.skillsVersion
        let equipped = Set(store.equippedSkills(agent.id))
        VStack(spacing: 0) {
            ForEach(Array(AgentSkill.allCases.enumerated()), id: \.element.id) { index, skill in
                if index > 0 {
                    Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 52)
                }
                skillRow(skill, isOn: equipped.contains(skill))
            }
        }
        .card()
    }

    private func skillRow(_ skill: AgentSkill, isOn: Bool) -> some View {
        HStack(spacing: 11) {
            Image(systemName: skill.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isOn ? skill.tint : DT.ink35(scheme))
                .frame(width: 30, height: 30)
                .background(isOn ? skill.tint.opacity(0.13) : DT.surface2(scheme))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(skill.name)
                        .scaledFont(14, .semibold)
                        .foregroundStyle(isOn ? DT.ink(scheme) : DT.ink55(scheme))
                    if skill.gated {
                        Image(systemName: "checkmark.seal")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(DT.violetText(scheme))
                            .accessibilityLabel("Approval-gated")
                    }
                    if store.wireStatus.isLive, isOn, store.skillUse(agent.id, skill) > 0 {
                        Text("×\(store.skillUse(agent.id, skill))")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(skill.tint)
                    }
                }
                Text(skill.verb)
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(2)
            }
            Spacer()
            Toggle(skill.name, isOn: Binding(
                get: { isOn },
                set: { _ in store.toggleSkill(skill, agentId: agent.id) }))
                .labelsHidden()
                .tint(DT.live(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
    }
}

// MARK: - The skill library

/// Every capability the fleet can carry, and who carries it — set a skill
/// up once, equip it on any agent. A query over loadouts, not a picture.
struct SkillsLibraryView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        // Live across equips from agent pages.
        let _ = store.skillsVersion
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("A skill is a typed capability with an approval posture — what an agent may publish, and what needs you first. Equip them per agent; the how never leaves the host.")
                    .scaledFont(12.5)
                    .lineSpacing(2)
                    .foregroundStyle(DT.ink78(scheme))
                    .padding(.top, 8)

                ForEach(AgentSkill.allCases) { skill in
                    skillCard(skill).padding(.top, 12)
                }

                Text("Usage counts are observed from the durable log — never self-reported.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 20)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Skills")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func skillCard(_ skill: AgentSkill) -> some View {
        let carriers = store.agents.filter { store.equippedSkills($0.id).contains(skill) }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 11) {
                Image(systemName: skill.symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(skill.tint)
                    .frame(width: 34, height: 34)
                    .background(skill.tint.opacity(0.13))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 6) {
                        Text(skill.name).scaledFont(15, .heavy)
                        if skill.gated {
                            HStack(spacing: 3) {
                                Image(systemName: "checkmark.seal")
                                    .font(.system(size: 9, weight: .semibold))
                                Text("needs approval")
                                    .font(.system(size: 9, weight: .bold))
                            }
                            .foregroundStyle(DT.violetText(scheme))
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(DT.violet.opacity(0.10))
                            .clipShape(Capsule())
                        }
                    }
                    Text(skill.verb)
                        .font(.system(size: 11.5))
                        .foregroundStyle(DT.ink55(scheme))
                }
                Spacer()
            }

            Text(skill.events)
                .font(.system(size: 10.5, design: .monospaced))
                .foregroundStyle(skill.tint)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(DT.well.opacity(scheme == .dark ? 1 : 0.06))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

            HStack(spacing: 7) {
                Text("EQUIPPED BY")
                    .font(.system(size: 8.5, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(DT.ink35(scheme))
                if carriers.isEmpty {
                    Text("no one yet")
                        .font(.system(size: 11))
                        .foregroundStyle(DT.ink35(scheme))
                }
                ForEach(carriers) { agent in
                    NavigationLink { AgentDetailView(agent: agent) } label: {
                        HStack(spacing: 5) {
                            AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 18)
                            Text(agent.name)
                                .font(.system(size: 11, weight: .bold))
                                .fixedSize()
                                .foregroundStyle(DT.ink78(scheme))
                            if store.wireStatus.isLive, store.skillUse(agent.id, skill) > 0 {
                                Text("×\(store.skillUse(agent.id, skill))")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .foregroundStyle(skill.tint)
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(DT.surface2(scheme))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(Pressable())
                }
                Spacer()
            }
        }
        .padding(13)
        .card()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(skill.name)\(skill.gated ? ", needs approval" : ""): \(skill.verb). Equipped by \(carriers.isEmpty ? "no one" : carriers.map(\.name).joined(separator: ", "))")
    }
}
