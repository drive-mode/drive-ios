import SwiftUI

/// The Agents tab — the Status Hub, one tap from anywhere, with per-agent config.
struct AgentsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 9) {
                        NavigationLink { NeedsYouRouter() } label: {
                            summaryTile(number: "\(store.needsYouCount)", label: "Need you", style: .needsYou)
                        }
                        .buttonStyle(Pressable())
                        summaryTile(number: "\(store.reportingCount)", label: "Reporting", style: .working)
                        summaryTile(number: "\(store.stuckCount)", label: "Stuck?", style: .stuck)
                    }
                    .padding(.top, 8)

                    HStack {
                        Eyebrow("AGENTS")
                        Spacer()
                        NavigationLink { SkillsLibraryView() } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "square.stack.3d.up")
                                    .font(.system(size: 10, weight: .semibold))
                                Text("Skill library")
                                    .font(.system(size: 12, weight: .bold))
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 9, weight: .bold))
                            }
                            .foregroundStyle(DT.violetText(scheme))
                        }
                        .buttonStyle(Pressable())
                        .accessibilityHint("Every capability the fleet can carry, and who carries it")
                    }
                    .padding(.top, 22)
                    ForEach(store.agents) { agent in
                        NavigationLink { AgentDetailView(agent: agent) } label: {
                            agentRow(agent)
                        }
                        .buttonStyle(Pressable())
                        .padding(.top, 10)
                        .contextMenu {
                            let editsKey = "approval.\(agent.id).edits"
                            let commandsKey = "approval.\(agent.id).commands"
                            let edits = UserDefaults.standard.object(forKey: editsKey) as? Bool ?? true
                            let commands = UserDefaults.standard.object(forKey: commandsKey) as? Bool ?? false
                            Button {
                                UserDefaults.standard.set(!edits, forKey: editsKey)
                            } label: {
                                Label(edits ? "Edits need approval — on" : "Edits need approval — off",
                                      systemImage: edits ? "checkmark.seal.fill" : "seal")
                            }
                            Button {
                                UserDefaults.standard.set(!commands, forKey: commandsKey)
                            } label: {
                                Label(commands ? "Commands need approval — on" : "Commands need approval — off",
                                      systemImage: commands ? "checkmark.seal.fill" : "seal")
                            }
                            Divider()
                            NavigationLink { AgentDetailView(agent: agent) } label: {
                                Label("Configure \(agent.name)", systemImage: "slider.horizontal.3")
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(agent.name), \(agent.role.capitalized), \(agent.state.rawValue). \(agent.statusLine). Reported \(agent.age) ago")
                        .accessibilityHint("Opens agent details and configuration. Long press for quick approval toggles.")
                    }

                    Text("Agents publish with report_status — a durable log you can read from any surface, including after the fact.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(DT.ink55(scheme))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 26)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .tabSwipe()
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Agents")
        }
    }

    private func summaryTile(number: String, label: String, style: AgentState) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(number)
                .font(.system(size: 21, weight: .heavy))
                .kerning(-0.5)
                .foregroundStyle(style == .needsYou ? DT.violetText(scheme) : style == .stuck ? DT.danger : DT.ink(scheme))
            HStack(spacing: 5) {
                if style == .working {
                    Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
                }
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(style == .needsYou ? DT.violetText(scheme) : DT.ink55(scheme))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 13).padding(.vertical, 12)
        .background(style == .needsYou ? AnyView(DT.violet.opacity(0.10)) : AnyView(DT.surface(scheme)))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(style == .needsYou ? DT.violet.opacity(0.22) : DT.hairline(scheme), lineWidth: 0.8))
    }

    private func agentRow(_ agent: Agent) -> some View {
        HStack(spacing: 12) {
            AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 38)
            VStack(alignment: .leading, spacing: 2.5) {
                HStack(spacing: 6) {
                    Text(agent.name).font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(DT.ink(scheme))
                    Text(agent.role)
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(DT.ink35(scheme))
                }
                Text(agent.statusLine)
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
                SkillChipRow(skills: store.equippedSkills(agent.id))
                    .padding(.top, 1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 5) {
                Text(agent.age)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(DT.ink35(scheme))
                StateChip(state: agent.state)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(agent.state == .needsYou ? DT.violet.opacity(0.28) : DT.hairline(scheme), lineWidth: 0.8))
        .shadow(color: scheme == .dark ? .clear : DT.inkLight.opacity(0.03), radius: 2, y: 1)
    }
}

/// Russian dolls: an agent's work, nested the way it actually contains —
/// sessions direct beats, projects hold tasks, tasks yield artifacts.
/// Every slice derives from the same durable-log lineage (actorId), so
/// this view is a query, not a picture.
struct AgentLineage: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let agent: Agent
    @State private var expanded: Set<String> = []

    private static let slicePalette: [Color] = [
        Color(hex: 0x9F58FA), Color(hex: 0x5B8DEF), Color(hex: 0x2BCC28),
        Color(hex: 0xFFC55C), Color(hex: 0x2DD4BF), Color(hex: 0xF472B6),
    ]

    private var myTasks: [TaskItem] {
        store.tasks.filter { $0.agentName == agent.name && !store.isArchived($0) }
    }
    private var byProject: [(name: String, tasks: [TaskItem])] {
        Dictionary(grouping: myTasks, by: \.room)
            .map { ($0.key, $0.value) }
            .sorted { $0.1.count > $1.1.count }
    }
    private var myArtifacts: [Artifact] {
        store.artifacts.filter { $0.agentName == agent.name }
    }
    private var myBeats: Int {
        store.beats.filter { $0.director == agent.name }.count
    }

    var body: some View {
        let projects = byProject
        let total = max(1, myTasks.count)
        VStack(alignment: .leading, spacing: 0) {
            // The pie: this agent's tasks, sliced by project.
            HStack(spacing: 18) {
                ZStack {
                    let slices: [(from: Double, to: Double)] = {
                        var out: [(Double, Double)] = []
                        var start = 0.0
                        for slice in projects {
                            let fraction = Double(slice.tasks.count) / Double(total)
                            out.append((start, start + fraction))
                            start += fraction
                        }
                        return out
                    }()
                    ForEach(projects.indices, id: \.self) { i in
                        Circle()
                            .trim(from: slices[i].from + 0.008, to: slices[i].to - 0.008)
                            .stroke(Self.slicePalette[i % Self.slicePalette.count],
                                    style: StrokeStyle(lineWidth: 12, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .padding(8)
                    }
                    VStack(spacing: 1) {
                        AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 26)
                        Text("\(myTasks.count)")
                            .font(.system(size: 12, weight: .heavy))
                        Text("tasks")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(DT.ink35(scheme))
                    }
                }
                .frame(width: 104, height: 104)
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(projects.indices, id: \.self) { i in
                        NavigationLink { ProjectDetailView(projectId: projects[i].name) } label: {
                            HStack(spacing: 7) {
                                Circle().fill(Self.slicePalette[i % Self.slicePalette.count])
                                    .frame(width: 7, height: 7)
                                Text(projects[i].name)
                                    .font(.system(size: 12.5, weight: .semibold))
                                    .foregroundStyle(DT.ink(scheme))
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Text("\(projects[i].tasks.count)")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundStyle(DT.ink55(scheme))
                            }
                        }
                        .buttonStyle(Pressable())
                    }
                    if projects.isEmpty {
                        Text("No active tasks — check the archive.")
                            .font(.system(size: 12))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .card()

            // The dolls: project ▸ tasks, each row a doorway.
            ForEach(projects, id: \.name) { slice in
                VStack(alignment: .leading, spacing: 0) {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                            if expanded.contains(slice.name) {
                                expanded.remove(slice.name)
                            } else {
                                expanded.insert(slice.name)
                            }
                        }
                    } label: {
                        HStack(spacing: 9) {
                            Image(systemName: expanded.contains(slice.name) ? "chevron.down" : "chevron.right")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(DT.ink35(scheme))
                            Text(slice.name)
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundStyle(DT.ink(scheme))
                            Spacer()
                            Text("\(slice.tasks.count) task\(slice.tasks.count == 1 ? "" : "s")")
                                .font(.system(size: 11))
                                .foregroundStyle(DT.ink55(scheme))
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(Pressable())
                    if expanded.contains(slice.name) {
                        ForEach(slice.tasks) { task in
                            NavigationLink { ProjectDetailView(projectId: task.room, focusTaskId: task.id) } label: {
                                HStack(spacing: 8) {
                                    Text(task.title)
                                        .font(.system(size: 12.5))
                                        .foregroundStyle(DT.ink78(scheme))
                                        .lineLimit(1)
                                    Spacer()
                                    TaskStateChip(state: task.state)
                                }
                                .padding(.leading, 33)
                                .padding(.trailing, 14)
                                .frame(minHeight: 36)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(Pressable())
                        }
                    }
                }
                .card()
                .padding(.top, 8)
            }

            // Sessions this agent directs.
            if myBeats > 0 {
                HStack(spacing: 11) {
                    Image(systemName: "sparkles.tv")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(DT.violetText(scheme))
                        .frame(width: 30, height: 30)
                        .background(DT.violet.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Auth middleware session")
                            .font(.system(size: 13.5, weight: .bold))
                        Text("Directs \(myBeats) of \(store.beats.count) beats")
                            .font(.system(size: 11))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    Spacer()
                    Button { store.joinCall() } label: {
                        Text("Join")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(DT.violetText(scheme))
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background(DT.violet.opacity(0.10))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(Pressable())
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
                .card()
                .padding(.top, 8)
            }

            // Artifacts this agent produced.
            if !myArtifacts.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 8) {
                        ForEach(myArtifacts) { artifact in
                            NavigationLink { ArtifactsView() } label: {
                                HStack(spacing: 7) {
                                    Image(systemName: artifact.kind.symbol)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(artifact.kind.tint)
                                    Text(artifact.title)
                                        .font(.system(size: 11.5, weight: .semibold))
                                        .foregroundStyle(DT.ink78(scheme))
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 11).padding(.vertical, 8)
                                .background(DT.surface(scheme))
                                .clipShape(Capsule())
                                .overlay(Capsule().strokeBorder(artifact.kind.tint.opacity(0.25), lineWidth: 0.8))
                            }
                            .buttonStyle(Pressable())
                        }
                    }
                }
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .padding(.top, 10)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lineage: \(myTasks.count) tasks across \(projects.count) projects, \(myArtifacts.count) artifacts\(myBeats > 0 ? ", directs \(myBeats) beats" : "")")
    }
}

struct AgentDetailView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let agent: Agent
    // Persisted per agent — approval policy is the most trust-sensitive
    // config in the product and must survive relaunches.
    @AppStorage private var editsNeedApproval: Bool
    @AppStorage private var commandsNeedApproval: Bool
    @AppStorage private var autoLandGreen: Bool

    init(agent: Agent) {
        self.agent = agent
        _editsNeedApproval = AppStorage(wrappedValue: true, "approval.\(agent.id).edits")
        _commandsNeedApproval = AppStorage(wrappedValue: false, "approval.\(agent.id).commands")
        _autoLandGreen = AppStorage(wrappedValue: false, "approval.\(agent.id).autoland")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 14) {
                    AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 7) {
                            Text(agent.name).font(.system(size: 20, weight: .heavy))
                            StateChip(state: agent.state)
                        }
                        Text("\(agent.role.capitalized) · in Auth middleware")
                            .font(.system(size: 12))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    Spacer()
                }
                .padding(16)
                .card()
                .padding(.top, 8)

                HStack(spacing: 9) {
                    stat("\(agent.editsAllowed)", "edits allowed")
                    stat("\(agent.testsRun)", "tests run")
                    stat(agent.uptime, "uptime today")
                }
                .padding(.top, 10)

                HStack {
                    Eyebrow("SKILLS")
                    Spacer()
                    NavigationLink { SkillsLibraryView() } label: {
                        HStack(spacing: 4) {
                            Text("Library")
                                .font(.system(size: 12, weight: .bold))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .foregroundStyle(DT.violetText(scheme))
                    }
                    .buttonStyle(Pressable())
                }
                .padding(.top, 22)
                .padding(.horizontal, 14)
                AgentSkillsSection(agent: agent).padding(.top, 7)
                Text("Sealed skills act only after you allow — the approvals below are the gate.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 7)
                    .padding(.horizontal, 14)

                Eyebrow("LINEAGE").padding(.top, 22).padding(.leading, 14)
                AgentLineage(agent: agent).padding(.top, 7)

                Eyebrow("APPEARANCE").padding(.top, 22).padding(.leading, 14)
                VStack(spacing: 0) {
                    row("Display name", value: agent.name)
                    hairline
                    HStack {
                        Text("Color").font(.system(size: 15))
                        Spacer()
                        Circle().fill(agent.color).frame(width: 20, height: 20)
                            .overlay(Circle().strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    row("Voice", value: agent.voice)
                }
                .card()
                .padding(.top, 7)

                Eyebrow("APPROVALS").padding(.top, 20).padding(.leading, 14)
                VStack(spacing: 0) {
                    toggleRow("Edits need approval", isOn: $editsNeedApproval)
                    hairline
                    toggleRow("Commands need approval", isOn: $commandsNeedApproval)
                    hairline
                    toggleRow("Auto-land green edits", isOn: $autoLandGreen)
                }
                .card()
                .padding(.top, 7)

                Eyebrow("REPORTING").padding(.top, 20).padding(.leading, 14)
                VStack(spacing: 0) {
                    row("Cadence", value: "Every event")
                    hairline
                    row("Quiet hours", value: "Off")
                }
                .card()
                .padding(.top, 7)

                Text("Skills are capability policy — what this agent may publish, and what needs you first. The how (prompts, tools, providers, model IDs) never leaves the host; Drive configures appearance, skills, and approvals only.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 22)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.system(size: 17, weight: .heavy)).kerning(-0.3)
            Text(label).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(DT.ink55(scheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 13).padding(.vertical, 11)
        .card()
    }

    private func row(_ label: String, value: String) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Text(value).scaledFont(14).foregroundStyle(DT.ink55(scheme))
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
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
}
