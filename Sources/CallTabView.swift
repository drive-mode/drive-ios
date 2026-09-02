import SwiftUI
import UIKit

// MARK: - Upcoming sessions (exist before they're live)

struct UpcomingSession: Codable, Identifiable, Equatable {
    let id: String
    var title: String
    var project: String
    var when: String
    var people: [String]
    var agendaCount: Int
    var note: String
    var participantIds: [String]? = nil
    var agendaTaskIds: [String]? = nil
    var scheduledAt: Date? = nil

    static let seed = UpcomingSession(
        id: "up-seed-payments",
        title: "Payments refactor — plan review",
        project: "Payments refactor",
        when: "Tomorrow · 10:00",
        people: ["Maya", "Harrison"],
        agendaCount: 2,
        note: "Plan review, ~15 minutes. Join when you're ready.")

    static func load() -> [UpcomingSession] {
        guard let data = UserDefaults.standard.data(forKey: "upcoming.v1"),
              let saved = try? JSONDecoder().decode([UpcomingSession].self, from: data) else {
            return [seed]
        }
        return saved
    }

    static func save(_ sessions: [UpcomingSession]) {
        if let data = try? JSONEncoder().encode(sessions) {
            UserDefaults.standard.set(data, forKey: "upcoming.v1")
        }
    }

    static func scheduledDate(for choice: String, now: Date = Date()) -> Date {
        switch choice {
        case "Now":
            return now
        case "Later today":
            return now.addingTimeInterval(2 * 60 * 60)
        default:
            let calendar = Calendar.current
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
            return calendar.date(bySettingHour: 10, minute: 0, second: 0, of: tomorrow)
                ?? tomorrow
        }
    }

    static func displayWhen(_ date: Date, now: Date = Date()) -> String {
        let calendar = Calendar.current
        if abs(date.timeIntervalSince(now)) < 60 { return "Now" }
        if calendar.isDate(date, inSameDayAs: now) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now),
           calendar.isDate(date, inSameDayAs: tomorrow) {
            return "Tomorrow · \(date.formatted(date: .omitted, time: .shortened))"
        }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

// MARK: - Secondary Calls flow: the session lifecycle, top to bottom
// NOW → INVITATIONS → UPCOMING → PLAN → EARLIER (docs/WORK-PAGE.md)

struct WorkCallsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var composing = false

    private var pendingInvitations: [InboxItem] {
        store.inbox.filter { $0.kind == .invite && !$0.archived && !$0.read }
    }

    private var replayRecords: [Artifact] {
        store.artifacts.filter { $0.kind == .replay }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Eyebrow("NOW").padding(.top, 8)
                    if !store.hasLiveSession {
                        quietCard.padding(.top, 10)
                    } else {
                        LiveSessionCard().padding(.top, 10)
                    }

                    if !pendingInvitations.isEmpty {
                        Eyebrow("INVITATIONS").padding(.top, 24)
                        ForEach(pendingInvitations) { invitation in
                            InvitationRow(item: invitation).padding(.top, 10)
                        }
                    }

                    if !store.displayedUpcomingSessions.isEmpty {
                        Eyebrow("UPCOMING").padding(.top, 24)
                        ForEach(store.displayedUpcomingSessions) { session in
                            upcomingRow(session).padding(.top, 10)
                        }
                    }

                    if store.configuration.previewContentEnabled {
                        Button { composing = true } label: {
                            HStack(spacing: 9) {
                                Image(systemName: "calendar.badge.plus")
                                    .font(.system(size: 14, weight: .bold))
                                Text("Plan a session")
                                    .scaledFont(15, .bold)
                            }
                            .foregroundStyle(DT.violetText(scheme))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(DT.violet.opacity(0.10))
                            .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                                .strokeBorder(DT.violet.opacity(0.22), lineWidth: 0.8))
                        }
                        .buttonStyle(Pressable())
                        .padding(.top, 14)
                        .accessibilityHint("Pick a project, an agenda, and who to invite")
                    }

                    if !replayRecords.isEmpty {
                        Eyebrow("EARLIER").padding(.top, 24)
                        ForEach(replayRecords) { replay in
                            SessionRecordCard(replay: replay).padding(.top, 10)
                        }
                    }

                    Text(store.configuration.previewContentEnabled
                         ? "Sessions replay as their directed program — every beat, readable after the fact. Preview conversation is not persisted."
                         : "Calls and history appear after an approved host supplies authenticated session records.")
                        .font(.system(size: 10.5))
                        .foregroundStyle(DT.ink35(scheme))
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, 24)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .tabSwipe()
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Calls")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $composing) {
                SessionComposerSheet()
            }
        }
    }

    /// Honesty over theater: when nothing is live, say so — and offer the
    /// two real moves.
    private var quietCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Circle().fill(DT.ink35(scheme)).frame(width: 6, height: 6)
                Text("No session live")
                    .scaledFont(15, .bold)
                Spacer()
            }
            Text(store.configuration.previewContentEnabled
                 ? "Plan one, or catch up on what already happened."
                 : "Connect an approved host and work target before starting a call.")
                .font(.system(size: 12))
                .foregroundStyle(DT.ink55(scheme))
            if store.configuration.previewContentEnabled {
                HStack(spacing: 9) {
                    Button { composing = true } label: {
                        Text("Plan a session")
                            .scaledFont(13, .bold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 42)
                            .background(DT.heroGradient)
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                    if let last = replayRecords.first {
                        NavigationLink { ArtifactDetailView(artifactId: last.id) } label: {
                            Text("Watch the last replay")
                                .scaledFont(13, .bold)
                                .foregroundStyle(DT.violetText(scheme))
                                .frame(maxWidth: .infinity)
                                .frame(height: 42)
                                .background(DT.violet.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                    }
                }
            } else {
                Label("Host connection required", systemImage: "network.slash")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(DT.ink55(scheme))
                    .frame(minHeight: 44)
            }
        }
        .padding(16)
        .card(radius: DT.rHero)
    }

    private func upcomingRow(_ session: UpcomingSession) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(DT.violetText(scheme))
                .frame(width: 36, height: 36)
                .background(DT.violet.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(session.title)
                    .scaledFont(14.5, .semibold)
                    .lineLimit(1)
                Text("\(session.when) · \(session.people.joined(separator: ", ")) · \(session.agendaCount) agenda item\(session.agendaCount == 1 ? "" : "s")")
                    .font(.system(size: 11.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .card()
        .contextMenu {
            Button(role: .destructive) { store.removeUpcoming(session.id) } label: {
                Label("Remove", systemImage: "trash")
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Upcoming: \(session.title), \(session.when), with \(session.people.joined(separator: " and "))")
        .accessibilityHint("Long press to remove")
    }
}

// MARK: - NOW: the live card with a beat ticker

/// Home's hero says "a session exists." This card says what the session
/// is doing *right now* — the current beat, live off the director clock.
struct LiveSessionCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                LivePill()
                Spacer()
                HStack(spacing: -6) {
                    ForEach(Array(store.liveSessionPeople.prefix(4)), id: \.self) { name in
                        let agent = store.agents.first { $0.name == name }
                        AvatarChip(
                            letter: String(name.prefix(1)),
                            color: agent?.color ?? DT.violet,
                            size: 26,
                            human: name == "Harrison")
                            .overlay(Circle().strokeBorder(DT.surface(scheme), lineWidth: 1.5))
                    }
                }
            }
            Text(store.liveSessionTitle)
                .kerning(-0.4)
                .scaledFont(19, .heavy)
                .padding(.top, 12)
            Text("\(store.liveSessionPeople.count) people · Presenter stage · rotate for theater")
                .font(.system(size: 11.5))
                .foregroundStyle(DT.ink55(scheme))
                .padding(.top, 3)

            // The ticker: 2 Hz is information cadence, not decoration —
            // the same director clock the Presenter stage runs on.
            if store.hasLiveProgramBeats {
                TimelineView(.periodic(from: .now, by: 0.5)) { context in
                    let pos = store.directorPosition(at: context.date)
                    let beat = store.beats[pos.index]
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Text(beat.kind.rawValue)
                                .font(.system(size: 8.5, weight: .bold, design: .monospaced))
                                .tracking(0.8)
                                .foregroundStyle(beat.kind.tint)
                                .padding(.horizontal, 6).padding(.vertical, 3)
                                .background(beat.kind.tint.opacity(0.14))
                                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                            Text(beat.title)
                                .scaledFont(12.5, .semibold)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                            Spacer()
                            Text("\(pos.index + 1)/\(store.beats.count)")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        ProgressRail(beats: store.beats, index: pos.index, progress: pos.progress)
                    }
                    .padding(11)
                    .background(DT.well.opacity(scheme == .dark ? 0.7 : 0.05))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                    .padding(.top, 12)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Now: beat \(pos.index + 1) of \(store.beats.count), \(beat.kind.rawValue): \(beat.title)")
                }
            } else {
                Text("Waiting for the first directed beat…")
                    .scaledFont(12.5, .semibold)
                    .foregroundStyle(DT.ink55(scheme))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(11)
                    .background(DT.well.opacity(scheme == .dark ? 0.7 : 0.05))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                    .padding(.top, 12)
            }

            Button { store.joinCall() } label: {
                Text("Join")
                    .scaledFont(14.5, .bold)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(DT.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    .shadow(color: DT.violet.opacity(0.35), radius: 10, y: 5)
            }
            .buttonStyle(Pressable())
            .padding(.top, 14)
            .accessibilityHint("Joins the live working session")
        }
        .padding(16)
        .card(radius: DT.rHero)
    }
}

// MARK: - INVITATIONS: the entry ritual, surfaced

struct InvitationRow: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let item: InboxItem

    private var inviterName: String {
        item.title.components(separatedBy: " ").first ?? "Someone"
    }

    private var inviterColor: Color {
        store.agents.first { $0.name == inviterName }?.color ?? DT.violet
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                AvatarChip(letter: String(inviterName.prefix(1)), color: inviterColor, size: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .scaledFont(13.5, .bold)
                        .lineLimit(2)
                    Text(item.body)
                        .font(.system(size: 11.5))
                        .foregroundStyle(DT.ink55(scheme))
                        .lineLimit(2)
                }
                Spacer()
                Text(item.age)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(DT.ink35(scheme))
            }
            HStack(spacing: 9) {
                Button {
                    store.markInbox(item.id, read: true)
                    store.joinCall()
                } label: {
                    Text("Join now")
                        .scaledFont(13, .bold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(DT.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        store.markInbox(item.id, read: true)
                    }
                } label: {
                    Text("Later")
                        .scaledFont(13, .bold)
                        .foregroundStyle(DT.ink55(scheme))
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(DT.surface2(scheme))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(13)
        .background(DT.violet.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.violet.opacity(0.22), lineWidth: 0.8))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - EARLIER: session records (replay + memory, the durable pair)

struct SessionRecordCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let replay: Artifact

    /// Session notes for this room, when an agent left them.
    private var sessionNote: MemoryFile? {
        store.memoryFiles.first { $0.scope == .session && $0.ownerLabel.contains(replay.room) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 11) {
                Image(systemName: "play.rectangle.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ArtifactKind.replay.tint)
                    .frame(width: 36, height: 36)
                    .background(ArtifactKind.replay.tint.opacity(0.13))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(replay.room)
                        .scaledFont(14.5, .bold)
                        .lineLimit(1)
                    Text("\(replay.meta) · \(replay.age) ago")
                        .font(.system(size: 11.5))
                        .foregroundStyle(DT.ink55(scheme))
                        .lineLimit(1)
                }
                Spacer()
                NavigationLink { ArtifactDetailView(artifactId: replay.id) } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text("Play")
                            .font(.system(size: 12.5, weight: .bold))
                    }
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(Capsule())
                }
                .buttonStyle(Pressable())
            }
            if let note = sessionNote {
                NavigationLink { MemoryFileView(fileId: note.id) } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "brain")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(MemoryScope.session.tint)
                        Text(note.hook)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(DT.ink78(scheme))
                            .lineLimit(1)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .background(DT.surface2(scheme).opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .buttonStyle(Pressable())
                .accessibilityLabel("Session notes: \(note.hook)")
            }
        }
        .padding(13)
        .card()
        .accessibilityElement(children: .contain)
    }
}

// MARK: - PLAN A SESSION: the composer (the old button, made real)

struct SessionComposerSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    @State private var project = ""
    @State private var title = ""
    @State private var pickedAgenda: Set<String> = []
    @State private var pickedPeople: Set<String> = []
    @State private var when = "Later today"
    @State private var note = "Join when you're ready."
    @State private var sending = false
    @State private var sendError: String?

    private var projectOptions: [String] {
        Array(store.orderedProjects.prefix(8).map(\.name))
    }

    /// The agenda suggests itself: what in this project needs a human.
    private var agendaSuggestions: [TaskItem] {
        (store.tasksByProject[project] ?? [])
            .filter { $0.state == .blocked || $0.state == .review }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Eyebrow("PROJECT").padding(.top, 8)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(projectOptions, id: \.self) { option in
                                Button {
                                    project = option
                                    title = "\(option) — working session"
                                    pickedAgenda = []
                                } label: {
                                    Text(option)
                                        .scaledFont(12.5, .bold)
                                        .foregroundStyle(project == option ? .white : DT.ink78(scheme))
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(project == option ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                                        .clipShape(Capsule())
                                        .overlay(Capsule().strokeBorder(project == option ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                                }
                                .buttonStyle(Pressable())
                            }
                        }
                    }
                    .padding(.horizontal, -20)
                    .contentMargins(.horizontal, 20, for: .scrollContent)
                    .padding(.top, 8)

                    if !project.isEmpty {
                        Eyebrow("TITLE").padding(.top, 18)
                        TextField("Session title", text: $title)
                            .scaledFont(14, .semibold)
                            .padding(12)
                            .background(DT.surface2(scheme))
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                            .padding(.top, 7)

                        if !agendaSuggestions.isEmpty {
                            Eyebrow("AGENDA · WHAT NEEDS A HUMAN").padding(.top, 18)
                            VStack(spacing: 0) {
                                ForEach(Array(agendaSuggestions.enumerated()), id: \.element.id) { index, task in
                                    if index > 0 {
                                        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 44)
                                    }
                                    Button {
                                        if pickedAgenda.contains(task.id) {
                                            pickedAgenda.remove(task.id)
                                        } else {
                                            pickedAgenda.insert(task.id)
                                        }
                                    } label: {
                                        HStack(spacing: 10) {
                                            Image(systemName: pickedAgenda.contains(task.id) ? "checkmark.circle.fill" : "circle")
                                                .font(.system(size: 17))
                                                .foregroundStyle(pickedAgenda.contains(task.id) ? DT.violet : DT.ink35(scheme))
                                            Text(task.title)
                                                .scaledFont(13.5, .semibold)
                                                .foregroundStyle(DT.ink(scheme))
                                                .lineLimit(1)
                                            Spacer()
                                            TaskStateChip(state: task.state)
                                        }
                                        .padding(.horizontal, 12).padding(.vertical, 9)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .card()
                            .padding(.top, 7)
                        }

                        Eyebrow("PEOPLE").padding(.top, 18)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 7) {
                                ForEach(store.agents) { agent in
                                    let picked = pickedPeople.contains(agent.id)
                                    let directs = store.equippedIds(agent.id).contains("directing")
                                    Button {
                                        if picked {
                                            pickedPeople.remove(agent.id)
                                        } else {
                                            pickedPeople.insert(agent.id)
                                        }
                                    } label: {
                                        HStack(spacing: 6) {
                                            AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 20)
                                            Text(agent.name)
                                                .scaledFont(12.5, .bold)
                                                .fixedSize()
                                            if directs {
                                                Image(systemName: "sparkles.tv")
                                                    .font(.system(size: 9, weight: .semibold))
                                                    .foregroundStyle(picked ? .white.opacity(0.85) : Color(hex: 0x9F58FA))
                                                    .accessibilityLabel("Can direct")
                                            }
                                        }
                                        .foregroundStyle(picked ? .white : DT.ink78(scheme))
                                        .padding(.horizontal, 10).padding(.vertical, 7)
                                        .background(picked ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                                        .clipShape(Capsule())
                                        .overlay(Capsule().strokeBorder(picked ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                                    }
                                    .buttonStyle(Pressable())
                                }
                            }
                        }
                        .padding(.horizontal, -20)
                        .contentMargins(.horizontal, 20, for: .scrollContent)
                        .padding(.top, 8)
                        Text("The spark marks who can direct — someone should run the room.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink55(scheme))
                            .padding(.top, 6)

                        Eyebrow("WHEN").padding(.top, 18)
                        HStack(spacing: 7) {
                            ForEach(["Now", "Later today", "Tomorrow · 10:00"], id: \.self) { option in
                                Button { when = option } label: {
                                    Text(option)
                                        .scaledFont(12.5, .bold)
                                        .foregroundStyle(when == option ? .white : DT.ink78(scheme))
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(when == option ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                                        .clipShape(Capsule())
                                        .overlay(Capsule().strokeBorder(when == option ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                                }
                                .buttonStyle(Pressable())
                            }
                        }
                        .padding(.top, 8)

                        Eyebrow("INVITATION NOTE").padding(.top, 18)
                        TextField("A line for the invitation", text: $note, axis: .vertical)
                            .scaledFont(13)
                            .lineLimit(2...3)
                            .padding(12)
                            .background(DT.surface2(scheme))
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                            .padding(.top, 7)

                        Button {
                            let inviteeIds = pickedPeople.isEmpty
                                ? [store.agents.first(where: { $0.id == "maya" })?.id
                                    ?? store.agents.first?.id].compactMap { $0 }
                                : pickedPeople.sorted()
                            let selectedNames = inviteeIds.map { id in
                                store.agents.first(where: { $0.id == id })?.name
                                    ?? AppStore.displayName(id)
                            }
                            let scheduledAt = UpcomingSession.scheduledDate(for: when)
                            let session = UpcomingSession(
                                id: "session-\(UUID().uuidString.lowercased())",
                                title: title.trimmingCharacters(in: .whitespaces),
                                project: project,
                                when: when,
                                people: ["Harrison"] + selectedNames,
                                agendaCount: pickedAgenda.count,
                                note: note,
                                participantIds: ["host"] + inviteeIds,
                                agendaTaskIds: pickedAgenda.sorted(),
                                scheduledAt: scheduledAt)
                            Task {
                                sending = true
                                sendError = nil
                                let sent = await store.planSession(
                                    session, inviteeIds: inviteeIds)
                                sending = false
                                if sent {
                                    UINotificationFeedbackGenerator()
                                        .notificationOccurred(.success)
                                    dismiss()
                                } else {
                                    sendError = store.lastSessionError
                                        ?? "The writer did not accept the session. Try again."
                                }
                            }
                        } label: {
                            Text(sending ? "Sending…" : "Send invitations")
                                .scaledFont(14, .bold)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(DT.heroGradient)
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || sending)
                        .padding(.top, 20)
                        if let sendError {
                            Text(sendError)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(Color.red)
                                .padding(.top, 8)
                        }
                        Text(store.wireStatus.isLive
                            ? "Live: the session and invitations are published to the room log."
                            : store.wireDropped
                                ? "Reconnect before sending so the room log stays the source of truth."
                                : "Offline preview: this session stays on this device until the writer reconnects.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink35(scheme))
                            .padding(.top, 8)
                    } else {
                        Text("Pick a project — the agenda suggests itself from what needs a human there.")
                            .scaledFont(12.5)
                            .foregroundStyle(DT.ink55(scheme))
                            .padding(.top, 16)
                    }
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Plan a session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(22)
    }
}
