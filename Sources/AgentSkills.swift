import SwiftUI
import UIKit

// MARK: - The built-in capability cores

/// The eight built-in capabilities — the catalog's spine. Everything the
/// UI shows comes from SkillPackage (SkillPackages.swift); this enum seeds
/// the built-in packages and keeps ids stable.
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

    var gated: Bool {
        switch self {
        case .editing, .testing: return true
        default: return false
        }
    }
}

// MARK: - Loadouts (id-based: built-ins and custom skills equip alike)

enum SkillLoadout {
    static let defaults: [String: [String]] = [
        "maya": ["directing", "tasks", "inviting", "research"],
        "coder": ["editing", "tasks", "artifacts", "feedback"],
        "scout": ["testing", "research", "artifacts", "tasks"],
        "indexer": ["artifacts", "research"],
    ]

    static func fallback(for agentId: String) -> [String] {
        defaults[agentId] ?? ["tasks", "artifacts"]
    }

    static func equipped(for agentId: String) -> [String] {
        guard let raw = UserDefaults.standard.string(forKey: "skills.\(agentId)") else {
            return fallback(for: agentId)
        }
        return raw.split(separator: ",").map(String.init)
    }

    static func setEquipped(_ ids: [String], for agentId: String) {
        UserDefaults.standard.set(ids.joined(separator: ","), forKey: "skills.\(agentId)")
    }
}

extension AppStore {
    /// The agent's loadout, resolved to packages (unknown ids drop out).
    func equippedSkills(_ agentId: String) -> [SkillPackage] {
        SkillLoadout.equipped(for: agentId).compactMap { package($0) }
    }

    func equippedIds(_ agentId: String) -> Set<String> {
        Set(SkillLoadout.equipped(for: agentId))
    }

    func toggleSkill(_ skillId: String, agentId: String) {
        var current = SkillLoadout.equipped(for: agentId)
        if let i = current.firstIndex(of: skillId) {
            current.remove(at: i)
        } else {
            current.append(skillId)
        }
        SkillLoadout.setEquipped(current, for: agentId)
        bumpSkills()
    }

    /// Select all / unselect all — the whole catalog in one move.
    func setAllSkills(_ agentId: String, on: Bool) {
        SkillLoadout.setEquipped(on ? skillPackages.map(\.id) : [], for: agentId)
        bumpSkills()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Equip a kit: union the bundle into the loadout (never removes).
    func equipBundle(_ bundle: SkillBundle, agentId: String) {
        var current = SkillLoadout.equipped(for: agentId)
        for id in bundle.skillIds where !current.contains(id) {
            current.append(id)
        }
        SkillLoadout.setEquipped(current, for: agentId)
        bumpSkills()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func bumpSkills() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            skillsVersion += 1
        }
    }

    func skillUse(_ agentId: String, _ skillId: String) -> Int {
        wireSkillUse[agentId]?[skillId] ?? 0
    }

    /// Agents carrying a given skill.
    func carriers(of skillId: String) -> [Agent] {
        agents.filter { equippedIds($0.id).contains(skillId) }
    }
}

// MARK: - Roster chips

struct SkillChipRow: View {
    let skills: [SkillPackage]

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

/// Equip per skill, per kit, or all at once. Rows open the package —
/// read it, edit it, review it — and the toggle stays right here.
struct AgentSkillsSection: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let agent: Agent

    var body: some View {
        let _ = store.skillsVersion
        let equipped = store.equippedIds(agent.id)
        VStack(alignment: .leading, spacing: 0) {
            // Kits: one tap equips the set (union — never removes).
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(store.skillBundles) { bundle in
                        Button { store.equipBundle(bundle, agentId: agent.id) } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "plus.square.on.square")
                                    .font(.system(size: 9, weight: .semibold))
                                Text(bundle.name)
                                    .font(.system(size: 11.5, weight: .bold))
                                    .fixedSize()
                            }
                            .foregroundStyle(bundleFullyEquipped(bundle, equipped) ? DT.ink35(scheme) : DT.violetText(scheme))
                            .padding(.horizontal, 10).padding(.vertical, 7)
                            .background(DT.violet.opacity(bundleFullyEquipped(bundle, equipped) ? 0.05 : 0.10))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(Pressable())
                        .disabled(bundleFullyEquipped(bundle, equipped))
                        .accessibilityLabel("Equip \(bundle.name): \(bundle.note)")
                    }
                }
            }
            .padding(.horizontal, -20)
            .contentMargins(.horizontal, 20, for: .scrollContent)

            VStack(spacing: 0) {
                ForEach(Array(store.skillPackages.enumerated()), id: \.element.id) { index, skill in
                    if index > 0 {
                        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 52)
                    }
                    skillRow(skill, isOn: equipped.contains(skill.id))
                }
            }
            .card()
            .padding(.top, 10)
        }
    }

    private func bundleFullyEquipped(_ bundle: SkillBundle, _ equipped: Set<String>) -> Bool {
        bundle.skillIds.allSatisfy { equipped.contains($0) }
    }

    private func skillRow(_ skill: SkillPackage, isOn: Bool) -> some View {
        HStack(spacing: 11) {
            NavigationLink { SkillDetailView(packageId: skill.id) } label: {
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
                            if store.wireStatus.isLive, isOn, store.skillUse(agent.id, skill.id) > 0 {
                                Text("×\(store.skillUse(agent.id, skill.id))")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(skill.tint)
                            }
                        }
                        Text(skill.verb)
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink55(scheme))
                            .lineLimit(2)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
            Toggle(skill.name, isOn: Binding(
                get: { isOn },
                set: { _ in store.toggleSkill(skill.id, agentId: agent.id) }))
                .labelsHidden()
                .tint(DT.live(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
    }
}

// MARK: - Skill detail: read · edit · review · improve

struct SkillDetailView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let packageId: String

    @State private var editing = false
    @State private var draftVerb = ""
    @State private var draftWhen = ""
    @State private var draftInstructions = ""
    @State private var improveSheet = false

    private var package: SkillPackage? {
        store.package(packageId)
    }

    var body: some View {
        ScrollView {
            if let skill = package {
                VStack(alignment: .leading, spacing: 0) {
                    header(skill).padding(.top, 8)

                    Text(skill.events)
                        .font(.system(size: 10.5, design: .monospaced))
                        .foregroundStyle(skill.tint)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(DT.well.opacity(scheme == .dark ? 1 : 0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .padding(.top, 12)

                    HStack {
                        Eyebrow("WHEN TO USE")
                        Spacer()
                        Button {
                            if editing {
                                var updated = skill
                                updated.verb = draftVerb
                                updated.whenToUse = draftWhen
                                updated.instructions = draftInstructions
                                updated.review = .draft   // edits re-enter review
                                store.updatePackage(updated)
                            } else {
                                draftVerb = skill.verb
                                draftWhen = skill.whenToUse
                                draftInstructions = skill.instructions
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
                    editableCard(text: skill.whenToUse, draft: $draftWhen, minHeight: 70)
                        .padding(.top, 7)

                    Eyebrow("INSTRUCTIONS").padding(.top, 18)
                    editableCard(text: skill.instructions, draft: $draftInstructions, minHeight: 130)
                        .padding(.top, 7)

                    HStack {
                        Eyebrow("FILES · \(skill.files.count)")
                        Spacer()
                        Text("DYNAMIC CONTEXT DISCOVERY")
                            .font(.system(size: 8, weight: .heavy))
                            .tracking(0.8)
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    .padding(.top, 18)
                    filesCard(skill).padding(.top, 7)
                    Text("The manifest's hook loads up front; deeper files load only when the work makes them relevant. Skills are folders, not paragraphs.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(DT.ink55(scheme))
                        .padding(.top, 7)

                    Eyebrow("REVIEW").padding(.top, 18)
                    reviewCard(skill).padding(.top, 7)

                    Eyebrow("EQUIPPED BY").padding(.top, 18)
                    carriersRow(skill).padding(.top, 7)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(package?.name ?? "Skill")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $improveSheet) {
            if let skill = package {
                ImproveSkillSheet(original: skill)
            }
        }
    }

    private func header(_ skill: SkillPackage) -> some View {
        HStack(spacing: 12) {
            Image(systemName: skill.symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(skill.tint)
                .frame(width: 40, height: 40)
                .background(skill.tint.opacity(0.13))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(skill.name).scaledFont(17, .heavy)
                    if skill.gated {
                        Image(systemName: "checkmark.seal")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(DT.violetText(scheme))
                    }
                }
                HStack(spacing: 6) {
                    Text(skill.category.rawValue)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(DT.ink55(scheme))
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(DT.surface2(scheme))
                        .clipShape(Capsule())
                    Text("v\(skill.version)\(skill.builtIn ? "" : " · custom")")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(DT.ink35(scheme))
                }
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func editableCard(text: String, draft: Binding<String>, minHeight: CGFloat) -> some View {
        Group {
            if editing {
                TextEditor(text: draft)
                    .scaledFont(13)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: minHeight)
                    .padding(8)
            } else {
                Text(text)
                    .scaledFont(13)
                    .lineSpacing(3)
                    .foregroundStyle(DT.ink78(scheme))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .card()
    }

    private func filesCard(_ skill: SkillPackage) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(skill.files.enumerated()), id: \.element.id) { index, file in
                if index > 0 {
                    Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 40)
                }
                HStack(spacing: 10) {
                    Image(systemName: file.name == "SKILL.md" ? "doc.text.fill" : "doc.text")
                        .font(.system(size: 12))
                        .foregroundStyle(file.name == "SKILL.md" ? skill.tint : DT.ink35(scheme))
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(file.name)
                            .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                        Text(file.note)
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink55(scheme))
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(file.name == "SKILL.md" ? "always" : "on demand")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(file.name == "SKILL.md" ? DT.live(scheme) : DT.ink35(scheme))
                    Text("\(file.lines)L")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(DT.ink35(scheme))
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
        }
        .card()
    }

    private func reviewCard(_ skill: SkillPackage) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(skill.review.rawValue)
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(reviewTint(skill.review))
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(reviewTint(skill.review).opacity(0.12))
                    .clipShape(Capsule())
                Spacer()
                Button {
                    var updated = skill
                    updated.review = .reviewed
                    store.updatePackage(updated)
                } label: {
                    Text("Mark reviewed")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(skill.review == .reviewed ? DT.ink35(scheme) : DT.live(scheme))
                }
                .buttonStyle(Pressable())
                .disabled(skill.review == .reviewed)
                Button {
                    var updated = skill
                    updated.review = .needsWork
                    store.updatePackage(updated)
                } label: {
                    Text("Needs work")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(skill.review == .needsWork ? DT.ink35(scheme) : DT.danger)
                }
                .buttonStyle(Pressable())
                .disabled(skill.review == .needsWork)
            }
            Button { improveSheet = true } label: {
                HStack(spacing: 8) {
                    AvatarChip(letter: "C", color: DemoData.coder, size: 22)
                    Text("Generate a better one with Cline")
                        .scaledFont(13, .bold)
                        .foregroundStyle(DT.violetText(scheme))
                    Spacer()
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 12))
                        .foregroundStyle(DT.violetText(scheme))
                }
            }
            .buttonStyle(Pressable())
        }
        .padding(12)
        .card()
    }

    private func reviewTint(_ review: SkillReview) -> Color {
        switch review {
        case .reviewed: return DT.live(scheme)
        case .draft: return Color(hex: 0xFFC55C)
        case .needsWork: return DT.danger
        }
    }

    private func carriersRow(_ skill: SkillPackage) -> some View {
        let carriers = store.carriers(of: skill.id)
        return HStack(spacing: 7) {
            if carriers.isEmpty {
                Text("No one yet — equip it from any agent's profile.")
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
            }
            ForEach(carriers) { agent in
                HStack(spacing: 5) {
                    AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 18)
                    Text(agent.name)
                        .font(.system(size: 11, weight: .bold))
                        .fixedSize()
                        .foregroundStyle(DT.ink78(scheme))
                    if store.wireStatus.isLive, store.skillUse(agent.id, skill.id) > 0 {
                        Text("×\(store.skillUse(agent.id, skill.id))")
                            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                            .foregroundStyle(skill.tint)
                    }
                }
                .padding(.horizontal, 8).padding(.vertical, 5)
                .background(DT.surface2(scheme))
                .clipShape(Capsule())
            }
            Spacer()
        }
    }
}

/// Cline's sharpened draft, side by side with what changes — accept to
/// bump the version, discard to keep what you have. Drafts re-enter review.
struct ImproveSkillSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    let original: SkillPackage

    var body: some View {
        let improved = SkillCatalog.improved(original)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 9) {
                        AvatarChip(letter: "C", color: DemoData.coder, size: 26)
                        Text("Cline sharpened \(original.name) — v\(original.version) → v\(improved.version). Review the changes; accepting re-enters review as a draft.")
                            .scaledFont(12.5)
                            .foregroundStyle(DT.ink78(scheme))
                    }
                    .padding(.top, 8)

                    Eyebrow("WHEN TO USE — REVISED").padding(.top, 16)
                    Text(improved.whenToUse)
                        .scaledFont(13)
                        .lineSpacing(3)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                        .padding(.top, 7)

                    Eyebrow("INSTRUCTIONS — REVISED").padding(.top, 16)
                    Text(improved.instructions)
                        .scaledFont(13)
                        .lineSpacing(3)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                        .padding(.top, 7)

                    if improved.files.count > original.files.count {
                        HStack(spacing: 7) {
                            Image(systemName: "doc.badge.plus")
                                .font(.system(size: 12))
                                .foregroundStyle(DT.live(scheme))
                            Text("Adds \(improved.files.last?.name ?? "a file") — \(improved.files.last?.note ?? "")")
                                .font(.system(size: 12))
                                .foregroundStyle(DT.ink78(scheme))
                        }
                        .padding(.top, 12)
                    }

                    HStack(spacing: 9) {
                        Button { dismiss() } label: {
                            Text("Discard")
                                .scaledFont(14, .bold)
                                .foregroundStyle(DT.ink55(scheme))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(DT.surface2(scheme))
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                        Button {
                            store.updatePackage(improved)
                            dismiss()
                        } label: {
                            Text("Accept draft")
                                .scaledFont(14, .bold)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(DT.heroGradient)
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                    }
                    .padding(.top, 20)
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Improve \(original.name)")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
        .presentationCornerRadius(22)
    }
}

// MARK: - New skill & new kit

struct NewSkillSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var what = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("Name the capability and say what it does — Cline scaffolds the package (manifest + reference file), guesses a category, and files it as a draft for review.")
                    .scaledFont(12.5)
                    .foregroundStyle(DT.ink78(scheme))
                    .padding(.top, 8)
                TextField("Skill name (e.g. Release notes)", text: $name)
                    .scaledFont(15, .semibold)
                    .padding(12)
                    .background(DT.surface2(scheme))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    .padding(.top, 16)
                TextField("What should it do?", text: $what, axis: .vertical)
                    .scaledFont(14)
                    .lineLimit(3...6)
                    .padding(12)
                    .background(DT.surface2(scheme))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    .padding(.top, 9)
                Button {
                    let trimmedName = name.trimmingCharacters(in: .whitespaces)
                    let trimmedWhat = what.trimmingCharacters(in: .whitespaces)
                    guard !trimmedName.isEmpty, !trimmedWhat.isEmpty else { return }
                    store.addPackage(SkillCatalog.draftCustom(name: trimmedName, description: trimmedWhat))
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    dismiss()
                } label: {
                    Text("Create draft skill")
                        .scaledFont(14, .bold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(DT.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
                .padding(.top, 16)
                Text("Custom skills publish work.generic until the host maps a real footprint — the honest default.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .padding(.top, 10)
                Spacer()
            }
            .padding(.horizontal, 20)
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("New skill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationCornerRadius(22)
    }
}

struct NewBundleSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var note = ""
    @State private var picked: Set<String> = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    TextField("Kit name (e.g. Demo-day kit)", text: $name)
                        .scaledFont(15, .semibold)
                        .padding(12)
                        .background(DT.surface2(scheme))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        .padding(.top, 8)
                    TextField("One line on when to hand this out", text: $note)
                        .scaledFont(13)
                        .padding(12)
                        .background(DT.surface2(scheme))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        .padding(.top, 9)

                    Eyebrow("PICK SKILLS · \(picked.count)").padding(.top, 16)
                    VStack(spacing: 0) {
                        ForEach(Array(store.skillPackages.enumerated()), id: \.element.id) { index, skill in
                            if index > 0 {
                                Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 44)
                            }
                            Button {
                                if picked.contains(skill.id) {
                                    picked.remove(skill.id)
                                } else {
                                    picked.insert(skill.id)
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: picked.contains(skill.id) ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 17))
                                        .foregroundStyle(picked.contains(skill.id) ? DT.violet : DT.ink35(scheme))
                                    Image(systemName: skill.symbol)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(skill.tint)
                                    Text(skill.name)
                                        .scaledFont(13.5, .semibold)
                                        .foregroundStyle(DT.ink(scheme))
                                    Spacer()
                                }
                                .padding(.horizontal, 12).padding(.vertical, 9)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card()
                    .padding(.top, 7)

                    Button {
                        let trimmed = name.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty, !picked.isEmpty else { return }
                        store.addBundle(name: trimmed,
                                        note: note.trimmingCharacters(in: .whitespaces),
                                        skillIds: Array(picked))
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        dismiss()
                    } label: {
                        Text("Create kit")
                            .scaledFont(14, .bold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(DT.heroGradient)
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                    .padding(.top, 16)
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("New kit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large, .medium])
        .presentationCornerRadius(22)
    }
}

// MARK: - The skill library (categorized, with kits)

struct SkillsLibraryView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var newSkill = false
    @State private var newBundle = false

    var body: some View {
        let _ = store.skillsVersion
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("A skill is a typed capability with an approval posture, packaged as files — the hook loads up front, the rest on demand. Equip singly, by kit, or all at once from any agent's profile.")
                    .scaledFont(12.5)
                    .lineSpacing(2)
                    .foregroundStyle(DT.ink78(scheme))
                    .padding(.top, 8)

                HStack {
                    Eyebrow("KITS")
                    Spacer()
                    Button { newBundle = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 10, weight: .bold))
                            Text("New kit")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(DT.violetText(scheme))
                    }
                    .buttonStyle(Pressable())
                }
                .padding(.top, 18)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(store.skillBundles) { bundle in
                            bundleCard(bundle)
                        }
                    }
                }
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .padding(.top, 8)

                ForEach(SkillCategory.allCases) { category in
                    let inCategory = store.skillPackages.filter { $0.category == category }
                    if !inCategory.isEmpty {
                        HStack(spacing: 7) {
                            Image(systemName: category.symbol)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(DT.ink35(scheme))
                            Eyebrow(category.rawValue.uppercased())
                        }
                        .padding(.top, 20)
                        VStack(spacing: 0) {
                            ForEach(Array(inCategory.enumerated()), id: \.element.id) { index, skill in
                                if index > 0 {
                                    Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 52)
                                }
                                NavigationLink { SkillDetailView(packageId: skill.id) } label: {
                                    libraryRow(skill)
                                }
                                .buttonStyle(Pressable())
                            }
                        }
                        .card()
                        .padding(.top, 8)
                    }
                }

                Button { newSkill = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Generate a new skill with Cline")
                            .scaledFont(14, .bold)
                    }
                    .foregroundStyle(DT.violetText(scheme))
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
                .padding(.top, 22)

                Text("Usage counts are observed from the durable log — never self-reported. Prompts, tools, and models never cross; skills carry capability and posture only.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Skills")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $newSkill) { NewSkillSheet() }
        .sheet(isPresented: $newBundle) { NewBundleSheet() }
    }

    private func bundleCard(_ bundle: SkillBundle) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Image(systemName: "square.on.square.badge.person.crop")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DT.violetText(scheme))
                Text(bundle.name)
                    .scaledFont(13, .heavy)
                    .foregroundStyle(DT.ink(scheme))
            }
            Text(bundle.note)
                .font(.system(size: 10.5))
                .foregroundStyle(DT.ink55(scheme))
                .lineLimit(2, reservesSpace: true)
            HStack(spacing: 5) {
                ForEach(bundle.skillIds, id: \.self) { id in
                    if let skill = store.package(id) {
                        Image(systemName: skill.symbol)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(skill.tint)
                    }
                }
                Spacer()
                Menu {
                    ForEach(store.agents) { agent in
                        Button {
                            store.equipBundle(bundle, agentId: agent.id)
                        } label: {
                            Label("Equip on \(agent.name)", systemImage: "person.badge.plus")
                        }
                    }
                } label: {
                    Text("Equip")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(DT.violet.opacity(0.10))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(11)
        .frame(width: 190, alignment: .leading)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(bundle.name): \(bundle.note). \(bundle.skillIds.count) skills")
    }

    private func libraryRow(_ skill: SkillPackage) -> some View {
        let carriers = store.carriers(of: skill.id)
        return HStack(spacing: 11) {
            Image(systemName: skill.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(skill.tint)
                .frame(width: 30, height: 30)
                .background(skill.tint.opacity(0.13))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(skill.name)
                        .scaledFont(14, .semibold)
                        .foregroundStyle(DT.ink(scheme))
                    if skill.gated {
                        Image(systemName: "checkmark.seal")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(DT.violetText(scheme))
                    }
                    if skill.review != .reviewed {
                        Text(skill.review.rawValue.uppercased())
                            .font(.system(size: 7.5, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(skill.review == .draft ? Color(hex: 0xFFC55C) : DT.danger)
                    }
                }
                Text("\(skill.files.count) files · \(skill.verb)")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
            }
            Spacer()
            HStack(spacing: -5) {
                ForEach(carriers.prefix(4)) { agent in
                    AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 18)
                        .overlay(Circle().strokeBorder(DT.surface(scheme), lineWidth: 1.5))
                }
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .contentShape(Rectangle())
    }
}
