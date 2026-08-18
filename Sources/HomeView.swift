import SwiftUI

struct MainTabs: View {
    @EnvironmentObject var store: AppStore
    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $store.selectedTab) {
                HomeView()
                    .toolbar(store.tabBarVisible ? .visible : .hidden, for: .tabBar)
                    .tabItem { Label("Home", systemImage: "house") }
                    .tag(AppTab.home)
                CallTabView()
                    .toolbar(store.tabBarVisible ? .visible : .hidden, for: .tabBar)
                    .tabItem { Label("Work", systemImage: "waveform" ) }
                    .tag(AppTab.work)
                AgentsView()
                    .toolbar(store.tabBarVisible ? .visible : .hidden, for: .tabBar)
                    .tabItem { Label("Agents", systemImage: "person.2") }
                    .badge(store.needsYouCount > 0 ? store.needsYouCount : 0)
                    .tag(AppTab.agents)
                TasksView()
                    .toolbar(store.tabBarVisible ? .visible : .hidden, for: .tabBar)
                    .tabItem { Label("Tasks", systemImage: "checklist") }
                    .tag(AppTab.tasks)
            }
            .tint(DT.violet)

            // Feedback door — only while the program AND this device's
            // opt-in are both on, and never over the session plane.
            if store.feedbackAvailable && !store.inCall && store.selectedTab == .home {
                HStack {
                    Spacer()
                    VStack {
                        Spacer()
                        FeedbackBubble()
                            .padding(.trailing, 16)
                            // Auto-dodge: drop into the gap the guide bar
                            // leaves when it hides — less content overlap.
                            .padding(.bottom, store.tabBarVisible ? 96 : 44)
                    }
                }
                .allowsHitTesting(true)
                .animation(.spring(response: 0.35, dampingFraction: 0.85), value: store.tabBarVisible)
                .transition(.scale.combined(with: .opacity))
            }

            // Summon zone: only exists while the bar is away. A quiet grabber
            // marks the spot; press or swipe up to bring navigation back.
            if !store.tabBarVisible {
                VStack(spacing: 5) {
                    Capsule()
                        .fill(DT.violet.opacity(0.35))
                        .frame(width: 36, height: 4)
                }
                .frame(width: 170, height: 34)
                .contentShape(Rectangle())
                .onTapGesture { store.summonTabBar() }
                .gesture(
                    DragGesture(minimumDistance: 10)
                        .onEnded { v in
                            if v.translation.height < -12 { store.summonTabBar() }
                        }
                )
                .padding(.bottom, 4)
                .transition(.opacity)
                .accessibilityElement(children: .ignore)
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel("Show navigation")
                .accessibilityHint("Reveals the tab bar")
            }
        }
        .onAppear { store.scheduleTabBarHide() }
        .onChange(of: store.selectedTab) { _, newTab in
            // Bar taps keep it alive; hidden-bar swipes stay hidden — a
            // swiping user has already learned the way.
            store.touchTabBar()
            store.intent.record(Surface(tab: newTab))
        }
    }
}

struct HomeView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var query = ""
    @State private var goNeedsYou = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .center, spacing: 10) {
                        HStack(spacing: 9) {
                            DriveMark()
                                .foregroundStyle(DT.ink(scheme))
                                .frame(width: 27, height: 27)
                            Text("Drive")
                                .kerning(-1.2)
                                .scaledFont(34, .heavy)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Drive")
                        .accessibilityAddTraits(.isHeader)
                        Spacer()
                        NavigationLink { InboxView() } label: {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "tray")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(DT.ink78(scheme))
                                    .frame(width: 34, height: 34)
                                    .background(DT.surface(scheme))
                                    .clipShape(Circle())
                                    .overlay(Circle().strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                                if store.unreadInboxCount > 0 {
                                    Text("\(store.unreadInboxCount)")
                                        .font(.system(size: 10, weight: .heavy))
                                        .foregroundStyle(.white)
                                        .frame(minWidth: 17)
                                        .frame(height: 17)
                                        .background(DT.violet)
                                        .clipShape(Capsule())
                                        .offset(x: 5, y: -4)
                                }
                            }
                        }
                        .buttonStyle(Pressable())
                        .accessibilityLabel("Inbox, \(store.unreadInboxCount) unread")
                        .accessibilityHint("Asks, invitations, and product news")
                        NavigationLink { ProfileView() } label: {
                            AvatarChip(letter: "H", color: DT.violet, size: 34, human: true)
                        }
                        .accessibilityLabel("Profile")
                        .accessibilityHint("Usage stats and settings")
                    }
                    .padding(.top, 6)

                    // Honesty chrome: a live wire that drops says so — and
                    // says what the screens are showing meanwhile.
                    if store.wireDropped && !store.wireStatus.isLive {
                        HStack(spacing: 10) {
                            DriveSpinner(size: 18)
                                .foregroundStyle(DT.ink55(scheme))
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Reconnecting to your fleet")
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundStyle(DT.ink78(scheme))
                                Text("The wire dropped — showing the last synced work.")
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(DT.ink55(scheme))
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 13).padding(.vertical, 10)
                        .background(DT.surface2(scheme))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                        .padding(.top, 12)
                        .transition(.opacity)
                        .accessibilityElement(children: .combine)
                    }

                    HStack(spacing: 9) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(DT.ink35(scheme))
                        TextField("Search sessions & plans", text: $query)
                            .font(.system(size: 15))
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(DT.surface2(scheme))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    .padding(.top, 14)

                    Eyebrow(store.hasLiveSession ? "IN SESSION" : "WORK")
                        .padding(.top, 24)
                    if store.hasLiveSession {
                        LiveHeroCard().padding(.top, 10)
                    } else {
                        HomeQuietSessionCard().padding(.top, 10)
                    }

                    HStack {
                        Eyebrow("TODAY")
                        Spacer()
                        NavigationLink { ActivityView() } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "calendar")
                                    .font(.system(size: 10, weight: .semibold))
                                Text("Calendar")
                                    .font(.system(size: 12, weight: .bold))
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 9, weight: .bold))
                            }
                            .foregroundStyle(DT.violetText(scheme))
                        }
                        .buttonStyle(Pressable())
                        .accessibilityHint("Week, month, year, and custom shipping history")
                    }
                    .padding(.top, 24)
                    // Hold any tile to peek at what's behind it — iOS's
                    // press-and-hold preview, tap still navigates.
                    HStack(spacing: 9) {
                        Button { store.selectedTab = .tasks } label: {
                            pulseTile(value: "\(store.runningTasks)", label: "tasks running", icon: "checklist")
                        }
                        .buttonStyle(Pressable())
                        .contextMenu {
                            Button { store.selectedTab = .tasks } label: {
                                Label("Open Tasks", systemImage: "checklist")
                            }
                        } preview: { tasksPeek }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(store.runningTasks) tasks running")
                        .accessibilityHint("Opens the Tasks tab. Hold to preview.")
                        Button { store.selectedTab = .agents } label: {
                            pulseTile(value: "\(store.reportingCount)", label: "agents reporting", icon: "person.2")
                        }
                        .buttonStyle(Pressable())
                        .contextMenu {
                            Button { store.selectedTab = .agents } label: {
                                Label("Open Agents", systemImage: "person.2")
                            }
                        } preview: { agentsPeek }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(store.reportingCount) agents reporting")
                        .accessibilityHint("Opens the Agents tab. Hold to preview.")
                        NavigationLink { NeedsYouRouter() } label: {
                            pulseTile(value: "\(store.needsYouCount)", label: "need you", icon: "bell",
                                      accent: store.needsYouCount > 0)
                        }
                        .buttonStyle(Pressable())
                        .contextMenu {
                            Button { goNeedsYou = true } label: {
                                Label("Open Needs you", systemImage: "bell")
                            }
                        } preview: { needsYouPeek }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(store.needsYouCount) items need you")
                        .accessibilityHint("Opens the conversation that needs an answer. Hold to preview.")
                    }
                    .padding(.top, 10)

                    // Focus Home (trial variant): the fast surfaces stay,
                    // the browsing rails step back. Honesty chip names it.
                    if store.variantActive("focus-home") {
                        HStack(spacing: 7) {
                            Image(systemName: "flask.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text("Focus Home trial — rails hidden · manage in Settings")
                                .font(.system(size: 10.5, weight: .semibold))
                        }
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(DT.violet.opacity(0.08))
                        .clipShape(Capsule())
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                        .accessibilityLabel("Focus Home trial active — artifact and recent rails hidden. Manage in Settings.")
                    } else {
                        ArtifactRail().padding(.top, 24)

                        FromFriendsRail().padding(.top, 24)

                        Eyebrow("RECENT").padding(.top, 24)
                        ForEach(DemoData.recents) { room in
                            RecentRow(room: room).padding(.top, 10)
                        }
                    }

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
            .tabSwipe()
            .background(DT.page(scheme).ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $goNeedsYou) { NeedsYouRouter() }
        }
    }

    // MARK: Peeks — what "hold to preview" shows for each tile

    private var tasksPeek: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                peekStat("\(store.runningTasks)", "running", color: DT.live(scheme))
                peekStat("\(store.attentionTasks.filter { $0.state == .blocked }.count)", "blocked", color: DT.danger)
                peekStat("\(store.orderedProjects.count)", "projects", color: DT.violetText(scheme))
                Spacer()
            }
            ForEach(store.attentionTasks.prefix(3)) { task in
                TaskRow(task: task, showProject: true)
            }
            if store.attentionTasks.isEmpty {
                Text("Nothing needs a human right now.")
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
            }
        }
        .padding(16)
        .frame(width: 340)
        .background(DT.page(scheme))
    }

    private var agentsPeek: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(store.agents) { agent in
                HStack(spacing: 10) {
                    AvatarChip(letter: String(agent.name.prefix(1)), color: agent.color, size: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(agent.name).scaledFont(13.5, .bold)
                        Text(agent.statusLine)
                            .font(.system(size: 11))
                            .foregroundStyle(DT.ink55(scheme))
                            .lineLimit(1)
                    }
                    Spacer()
                    StateChip(state: agent.state)
                }
            }
        }
        .padding(16)
        .frame(width: 340)
        .background(DT.page(scheme))
    }

    private var needsYouPeek: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(store.openInterrupts.prefix(3)) { interrupt in
                HStack(alignment: .top, spacing: 10) {
                    AvatarChip(letter: String(interrupt.agentName.prefix(1)), color: interrupt.agentColor, size: 26)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(interrupt.title).scaledFont(13, .bold).lineLimit(2)
                        if let first = interrupt.detail.first {
                            Text(first)
                                .font(.system(size: 11.5))
                                .foregroundStyle(DT.ink55(scheme))
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                    Text(interrupt.age)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(DT.ink35(scheme))
                }
            }
            if store.openInterrupts.isEmpty {
                Text("All clear — nobody's waiting on you.")
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
            }
        }
        .padding(16)
        .frame(width: 340)
        .background(DT.page(scheme))
    }

    private func peekStat(_ value: String, _ label: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Text(value).scaledFont(15, .heavy).foregroundStyle(color)
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(DT.ink55(scheme))
        }
    }

    private func pulseTile(value: String, label: String, icon: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent ? DT.violetText(scheme) : DT.ink35(scheme))
            Text(value)
                .kerning(-0.5)
                .scaledFont(20, .heavy)
                .foregroundStyle(accent ? DT.violetText(scheme) : DT.ink(scheme))
            Text(label)
                .scaledFont(10.5, .semibold)
                .foregroundStyle(DT.ink55(scheme))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 13).padding(.vertical, 12)
        .background(accent ? AnyView(DT.violet.opacity(0.10)) : AnyView(DT.surface(scheme)))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(accent ? DT.violet.opacity(0.22) : DT.hairline(scheme), lineWidth: 0.8))
    }
}

/// The live room hero — shared by Home and the Call tab.
struct LiveHeroCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LivePill(onGradient: true).foregroundStyle(.white)
            Text(store.liveSessionTitle)
                .kerning(-0.5)
                .scaledFont(23, .heavy)
                .foregroundStyle(.white)
                .padding(.top, 12)
            Text("\(store.liveSessionPeople.count) people · live now")
                .scaledFont(13)
                .foregroundStyle(.white.opacity(0.78))
                .padding(.top, 5)
            if expanded {
                HStack(spacing: 7) {
                    Image(systemName: "sparkles.tv")
                        .font(.system(size: 11, weight: .semibold))
                    Text(store.hasLiveProgramBeats
                        ? "Presenter stage · \(store.beats.count) beats · rotate for theater"
                        : "Presenter stage · waiting for the first beat")
                        .font(.system(size: 11.5, weight: .semibold))
                }
                .foregroundStyle(.white.opacity(0.85))
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(.white.opacity(0.14))
                .clipShape(Capsule())
                .padding(.top, 12)
            }
            HStack {
                HStack(spacing: -7) {
                    ForEach(Array(store.liveSessionPeople.prefix(4)), id: \.self) { name in
                        let agent = store.agents.first { $0.name == name }
                        AvatarChip(
                            letter: String(name.prefix(1)),
                            color: agent?.color ?? DT.violet,
                            size: 28,
                            human: name == "Harrison")
                            .overlay(Circle().strokeBorder(.white.opacity(0.9), lineWidth: 2))
                    }
                }
                Spacer()
                Button {
                    store.joinCall()
                } label: {
                    Text("Join")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: 0x7A3FD4))
                        .padding(.horizontal, 20).padding(.vertical, 9)
                        .background(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(Pressable())
            }
            .padding(.top, 16)
        }
        .padding(18)
        .background {
            ZStack {
                DT.heroGradient
                RadialGradient(colors: [.white.opacity(0.30), .clear],
                               center: .init(x: 0.88, y: -0.1), startRadius: 0, endRadius: 190)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .shadow(color: DT.violet.opacity(scheme == .dark ? 0.18 : 0.28), radius: 15, y: 8)
    }
}

struct HomeQuietSessionCard: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "moon.stars")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(DT.violetText(scheme))
                .frame(width: 38, height: 38)
                .background(DT.violet.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("No session live")
                    .scaledFont(14.5, .bold)
                Text(store.displayedUpcomingSessions.isEmpty
                    ? "Plan one from Work when you’re ready."
                    : "\(store.displayedUpcomingSessions.count) coming up — open Work to review.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(DT.ink55(scheme))
            }
            Spacer()
            Button { store.selectedTab = .work } label: {
                Text("Open Work")
                    .scaledFont(12.5, .bold)
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(Capsule())
            }
            .buttonStyle(Pressable())
        }
        .padding(14)
        .card(radius: DT.rHero)
        .accessibilityElement(children: .contain)
    }
}

struct RecentRow: View {
    @Environment(\.colorScheme) private var scheme
    let room: RecentRoom
    var body: some View {
        HStack(spacing: 12) {
            Text(String(room.title.prefix(1)))
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(room.badge != nil ? DT.violetText(scheme) : DT.ink55(scheme))
                .frame(width: 36, height: 36)
                .background(room.badge != nil ? DT.violet.opacity(0.10) : DT.surface2(scheme))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(room.title).font(.system(size: 15, weight: .semibold))
                Text(room.subtitle).font(.system(size: 12)).foregroundStyle(DT.ink55(scheme))
            }
            Spacer()
            if let badge = room.badge {
                Text(badge)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 11).padding(.vertical, 6)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            } else {
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
        .card()
    }
}
