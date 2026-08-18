import SwiftUI

// MARK: - Models (docs/SOCIAL.md — P0 prototype, local demo data)

struct ShowFriend: Identifiable {
    let id: String
    let name: String
    let color: Color
}

struct ShowComment: Identifiable {
    let id: String
    let author: String
    let color: Color
    let text: String
    let age: String
    var fromYou = false
}

/// A project square: cover, README sections, an optional directed demo
/// (DEMO.md is a beat program — replays ARE the demo format), team, comments.
struct ShowProject: Identifiable {
    let id: String
    let name: String
    let tagline: String
    let state: String            // "BUILDING" | "SHIPPED" | "LIVE NOW"
    let coverA: Color
    let coverB: Color
    let owner: String
    let ownerColor: Color
    let readme: [(heading: String, body: String)]
    let hasDemo: Bool
    let team: [(name: String, color: Color, isAgent: Bool)]
    var comments: [ShowComment]
}

enum ShowcaseDemo {
    static let friends: [ShowFriend] = [
        ShowFriend(id: "anna", name: "Anna", color: Color(hex: 0x7A3FD4)),
        ShowFriend(id: "marco", name: "Marco", color: Color(hex: 0x5B8DEF)),
        ShowFriend(id: "jo", name: "Jo", color: Color(hex: 0xE8A13C)),
        ShowFriend(id: "sam", name: "Sam", color: Color(hex: 0x2DD4BF)),
    ]

    static let you: [ShowProject] = [
        ShowProject(
            id: "auth", name: "Auth middleware", tagline: "JWT gate with a green suite",
            state: "LIVE NOW", coverA: Color(hex: 0x9F58FA), coverB: Color(hex: 0x6D28D9),
            owner: "Harrison", ownerColor: DT.violet,
            readme: [
                ("What it is", "A refresh-route gate: every token passes verifyJwt before routing. Two lines in the hot path, zero regressions."),
                ("Why it exists", "The refresh regression kept coming back. Now the suite pins it dead — 5/5 passing, 38ms p95 after the gate."),
                ("Stack", "TypeScript · bun test · drive-mode/auth"),
            ],
            hasDemo: true,
            team: [("Harrison", DT.violet, false), ("Cline", DemoData.coder, true), ("Maya", DemoData.maya, true), ("Scout", DemoData.scout, true)],
            comments: [
                ShowComment(id: "c1", author: "Anna", color: Color(hex: 0x7A3FD4),
                            text: "the demo sold me — that decision beat is such a nice way to show a call being made", age: "2h"),
                ShowComment(id: "c2", author: "Marco", color: Color(hex: 0x5B8DEF),
                            text: "stealing the early-return pattern for our gateway 🔥", age: "1h"),
            ]),
        ShowProject(
            id: "exports", name: "Exports refactor", tagline: "22 tasks, one clean adapter",
            state: "BUILDING", coverA: Color(hex: 0x2DD4BF), coverB: Color(hex: 0x0E7490),
            owner: "Harrison", ownerColor: DT.violet,
            readme: [
                ("What it is", "One adapter for every export target — the fixture backfill alone retired six special cases."),
                ("Where it stands", "7 running, 4 in review. The dependency map is the honest status page."),
            ],
            hasDemo: false,
            team: [("Harrison", DT.violet, false), ("Cline", DemoData.coder, true), ("Indexer", DemoData.indexer, true)],
            comments: [
                ShowComment(id: "c3", author: "Jo", color: Color(hex: 0xE8A13C),
                            text: "the task map on this is beautiful — how do I get in?", age: "3d"),
            ]),
        ShowProject(
            id: "notify", name: "Ship notifications", tagline: "Quiet by default, loud when it matters",
            state: "SHIPPED", coverA: Color(hex: 0xF472B6), coverB: Color(hex: 0xBE185D),
            owner: "Harrison", ownerColor: DT.violet,
            readme: [
                ("What it is", "Notification rules that respect quiet hours and escalate only unanswered blockers."),
            ],
            hasDemo: false,
            team: [("Harrison", DT.violet, false), ("Maya", DemoData.maya, true)],
            comments: []),
        ShowProject(
            id: "quotas", name: "Quotas audit", tagline: "Limits, documented and enforced",
            state: "SHIPPED", coverA: Color(hex: 0xFFC55C), coverB: Color(hex: 0xB45309),
            owner: "Harrison", ownerColor: DT.violet,
            readme: [
                ("What it is", "Findings plus limits for every tenant path — the doc is the artifact."),
            ],
            hasDemo: false,
            team: [("Harrison", DT.violet, false), ("Scout", DemoData.scout, true)],
            comments: []),
    ]

    /// Friends' squares for the Home rail — inspiration, one swipe deep.
    static let fromFriends: [(friend: ShowFriend, project: ShowProject)] = [
        (friends[0], ShowProject(
            id: "anna-voice", name: "Voice memos → specs", tagline: "Talk a spec into existence",
            state: "LIVE NOW", coverA: Color(hex: 0x7A3FD4), coverB: Color(hex: 0x4C1D95),
            owner: "Anna", ownerColor: Color(hex: 0x7A3FD4),
            readme: [
                ("What it is", "Hold to talk, get a structured spec: sections, acceptance criteria, open questions."),
                ("Try it", "Join a session and watch the plan beats assemble themselves."),
            ],
            hasDemo: true,
            team: [("Anna", Color(hex: 0x7A3FD4), false), ("Cline", DemoData.coder, true)],
            comments: [
                ShowComment(id: "c4", author: "Harrison", color: DT.violet,
                            text: "ok the acceptance-criteria beat is genius", age: "1d", fromYou: true),
            ])),
        (friends[1], ShowProject(
            id: "marco-graph", name: "Dep-graph screensaver", tagline: "Your build graph, but gorgeous",
            state: "BUILDING", coverA: Color(hex: 0x5B8DEF), coverB: Color(hex: 0x1D4ED8),
            owner: "Marco", ownerColor: Color(hex: 0x5B8DEF),
            readme: [
                ("What it is", "Renders the module graph as a slow constellation. Zero utility, maximum joy."),
            ],
            hasDemo: false,
            team: [("Marco", Color(hex: 0x5B8DEF), false)],
            comments: [])),
    ]
}

// MARK: - Showcase (your grid + friends)

/// Drivemode "by Cline" — your projects as a shelf of squares, friends one
/// row away, and every square one tap from README, demo, and the session.
struct ShowcaseView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header.padding(.top, 8)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                    ForEach(ShowcaseDemo.you) { project in
                        NavigationLink { ProjectShowcaseView(project: project) } label: {
                            ProjectSquare(project: project)
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .padding(.top, 14)

                Eyebrow("FRIENDS").padding(.top, 22)
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 12) {
                        ForEach(ShowcaseDemo.friends) { friend in
                            VStack(spacing: 5) {
                                AvatarChip(letter: String(friend.name.prefix(1)), color: friend.color, size: 44, human: true)
                                Text(friend.name)
                                    .font(.system(size: 10.5, weight: .semibold))
                                    .foregroundStyle(DT.ink78(scheme))
                            }
                        }
                        VStack(spacing: 5) {
                            Image(systemName: "plus")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(DT.violetText(scheme))
                                .frame(width: 44, height: 44)
                                .background(DT.violet.opacity(0.10))
                                .clipShape(Circle())
                            Text("Invite")
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(DT.violetText(scheme))
                        }
                    }
                }
                .padding(.top, 10)

                ForEach(ShowcaseDemo.fromFriends, id: \.project.id) { pair in
                    NavigationLink { ProjectShowcaseView(project: pair.project) } label: {
                        friendRow(pair.friend, pair.project)
                    }
                    .buttonStyle(Pressable())
                    .padding(.top, 10)
                }

                Text("Preview · your showcase is private by default — publishing a square is explicit, and demos are directed replays: source code never leaves.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 22)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Showcase")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        HStack(spacing: 12) {
            AvatarChip(letter: "H", color: DT.violet, size: 44, human: true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Harrison's showcase")
                    .kerning(-0.4)
                    .scaledFont(20, .heavy)
                HStack(spacing: 5) {
                    ClineBotShape()
                        .fill(style: FillStyle(eoFill: true))
                        .foregroundStyle(DT.ink35(scheme))
                        .frame(width: 10, height: 10)
                    Text("Drivemode by Cline · \(ShowcaseDemo.you.count) projects · \(ShowcaseDemo.friends.count) friends")
                        .font(.system(size: 11))
                        .foregroundStyle(DT.ink55(scheme))
                }
            }
            Spacer()
        }
    }

    private func friendRow(_ friend: ShowFriend, _ project: ShowProject) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(LinearGradient(colors: [project.coverA, project.coverB],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 46, height: 46)
                .overlay {
                    ClineBotShape()
                        .fill(style: FillStyle(eoFill: true))
                        .foregroundStyle(.white.opacity(0.85))
                        .frame(width: 18, height: 18)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .scaledFont(14.5, .bold)
                    .foregroundStyle(DT.ink(scheme))
                Text("\(friend.name) · \(project.tagline)")
                    .font(.system(size: 11.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .lineLimit(1)
            }
            Spacer()
            if project.state == "LIVE NOW" {
                LivePill()
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
            }
        }
        .padding(.horizontal, 13).padding(.vertical, 11)
        .card()
    }
}

/// One project square — cover gradient, state, the quiet Cline watermark.
struct ProjectSquare: View {
    let project: ShowProject

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            Text(project.name)
                .scaledFont(15, .heavy)
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .lineLimit(2)
            Text(project.tagline)
                .font(.system(size: 10.5))
                .foregroundStyle(.white.opacity(0.75))
                .lineLimit(2)
                .padding(.top, 3)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .aspectRatio(1, contentMode: .fit)
        .background(LinearGradient(colors: [project.coverA, project.coverB],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
        .overlay(alignment: .topLeading) {
            Text(project.state)
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.8)
                .foregroundStyle(.white)
                .padding(.horizontal, 7).padding(.vertical, 4)
                .background(.white.opacity(project.state == "LIVE NOW" ? 0.28 : 0.16))
                .clipShape(Capsule())
                .padding(9)
        }
        .overlay(alignment: .topTrailing) {
            ClineBotShape()
                .fill(style: FillStyle(eoFill: true))
                .foregroundStyle(.white.opacity(0.45))
                .frame(width: 14, height: 14)
                .padding(10)
        }
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(project.name), \(project.state.lowercased()): \(project.tagline)")
        .accessibilityHint("Opens the project's README, demo, and people")
    }
}

// MARK: - Project page (README · Demo · People)

struct ProjectShowcaseView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State var project: ShowProject
    @State private var tab = "README"
    @State private var newComment = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                cover.padding(.top, 8)
                tabPicker.padding(.top, 14)

                switch tab {
                case "Demo": demoTab.padding(.top, 14)
                case "People": peopleTab.padding(.top, 14)
                default: readmeTab.padding(.top, 6)
                }
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var cover: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(project.state)
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(.white.opacity(0.22))
                    .clipShape(Capsule())
                Spacer()
                HStack(spacing: -6) {
                    ForEach(project.team.indices, id: \.self) { i in
                        let member = project.team[i]
                        AvatarChip(letter: String(member.name.prefix(1)), color: member.color,
                                   size: 24, human: !member.isAgent)
                            .overlay(Circle().strokeBorder(.white.opacity(0.85), lineWidth: 1.5))
                    }
                }
            }
            Text(project.name)
                .kerning(-0.5)
                .scaledFont(22, .heavy)
                .foregroundStyle(.white)
                .padding(.top, 14)
            Text("\(project.owner) · \(project.tagline)")
                .scaledFont(12)
                .foregroundStyle(.white.opacity(0.8))
                .padding(.top, 3)
        }
        .padding(16)
        .background(LinearGradient(colors: [project.coverA, project.coverB],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
    }

    private var tabPicker: some View {
        HStack(spacing: 4) {
            ForEach(["README", "Demo", "People"], id: \.self) { option in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { tab = option }
                } label: {
                    Text(option)
                        .scaledFont(13, .bold)
                        .foregroundStyle(tab == option ? DT.violetText(scheme) : DT.ink55(scheme))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(tab == option ? AnyView(DT.surface(scheme)) : AnyView(Color.clear))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(3)
        .background(DT.surface2(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }

    // README.md, rendered natively.
    private var readmeTab: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(project.readme.indices, id: \.self) { i in
                let section = project.readme[i]
                VStack(alignment: .leading, spacing: 7) {
                    Text(section.heading)
                        .scaledFont(15, .heavy)
                        .foregroundStyle(DT.ink(scheme))
                    Text(section.body)
                        .scaledFont(13)
                        .lineSpacing(3)
                        .foregroundStyle(DT.ink78(scheme))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
                .padding(.top, 8)
            }
            Text("README.md · rendered from the project")
                .font(.system(size: 10))
                .foregroundStyle(DT.ink35(scheme))
                .padding(.top, 8)
        }
    }

    // DEMO.md — the directed beat program IS the demo.
    @ViewBuilder
    private var demoTab: some View {
        if project.hasDemo {
            VStack(alignment: .leading, spacing: 8) {
                ReplayPlayer(beats: store.beats)
                    .frame(height: 340)
                Text("DEMO.md · a directed replay — the same beats the session played live. Tap the thirds or swipe to scrub.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
            }
        } else {
            VStack(spacing: 10) {
                Image(systemName: "sparkles.tv")
                    .font(.system(size: 30, weight: .light))
                    .foregroundStyle(DT.ink35(scheme))
                Text("No demo published yet")
                    .scaledFont(13.5, .semibold)
                    .foregroundStyle(DT.ink78(scheme))
                Text("Publish any session replay as this project's DEMO.md.")
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink55(scheme))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 70)
            .card(radius: DT.rHero)
        }
    }

    // People: the team, the invitation, and friends' comments.
    private var peopleTab: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(spacing: 0) {
                ForEach(project.team.indices, id: \.self) { i in
                    let member = project.team[i]
                    HStack(spacing: 11) {
                        AvatarChip(letter: String(member.name.prefix(1)), color: member.color,
                                   size: 30, human: !member.isAgent)
                        Text(member.name).scaledFont(14, .semibold)
                        if member.isAgent {
                            Text("AGENT")
                                .font(.system(size: 8, weight: .heavy))
                                .tracking(0.8)
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 13).padding(.vertical, 8)
                    if i < project.team.count - 1 {
                        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 54)
                    }
                }
            }
            .padding(.vertical, 4)
            .card()

            Button { store.joinCall() } label: {
                HStack(spacing: 8) {
                    Image(systemName: "waveform")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Join this project's session")
                        .scaledFont(14, .bold)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(DT.heroGradient)
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            }
            .buttonStyle(Pressable())
            .padding(.top, 12)
            .accessibilityHint("You'll be invited into the working session")

            Eyebrow("FROM FRIENDS").padding(.top, 20)
            if project.comments.isEmpty {
                Text("No comments yet — friends you invite can cheer here.")
                    .font(.system(size: 12))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 8)
            }
            ForEach(project.comments) { comment in
                HStack(alignment: .top, spacing: 10) {
                    AvatarChip(letter: String(comment.author.prefix(1)), color: comment.color,
                               size: 26, human: true)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(comment.author).scaledFont(12.5, .bold)
                            Text(comment.age)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        Text(comment.text)
                            .scaledFont(13)
                            .lineSpacing(2)
                            .foregroundStyle(DT.ink78(scheme))
                    }
                    Spacer()
                }
                .padding(12)
                .card()
                .padding(.top, 8)
            }

            HStack(spacing: 9) {
                TextField("Say something nice…", text: $newComment)
                    .scaledFont(13.5)
                    .padding(.horizontal, 13).padding(.vertical, 9)
                    .background(DT.surface2(scheme))
                    .clipShape(Capsule())
                Button {
                    let text = newComment.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { return }
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        project.comments.append(ShowComment(
                            id: UUID().uuidString, author: "You", color: DT.violet,
                            text: text, age: "now", fromYou: true))
                    }
                    newComment = ""
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(DT.heroGradient)
                        .clipShape(Circle())
                }
                .buttonStyle(Pressable())
                .accessibilityLabel("Post comment")
            }
            .padding(.top, 12)
            Text("Owners moderate their space — you can remove any comment on your work.")
                .font(.system(size: 10))
                .foregroundStyle(DT.ink35(scheme))
                .padding(.top, 7)
        }
    }
}

// MARK: - Home rail

/// Inspiration one swipe deep: friends' freshest squares on Home.
struct FromFriendsRail: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Eyebrow("FROM FRIENDS")
                Spacer()
                NavigationLink { ShowcaseView() } label: {
                    HStack(spacing: 4) {
                        Text("Showcase")
                            .font(.system(size: 12, weight: .bold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(DT.violetText(scheme))
                }
                .buttonStyle(Pressable())
            }
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 9) {
                    ForEach(ShowcaseDemo.fromFriends, id: \.project.id) { pair in
                        NavigationLink { ProjectShowcaseView(project: pair.project) } label: {
                            railCard(pair.friend, pair.project)
                        }
                        .buttonStyle(Pressable())
                    }
                }
            }
            .frame(height: 92)
            .padding(.top, 10)
            .padding(.horizontal, -20)
            .contentMargins(.horizontal, 20, for: .scrollContent)
        }
    }

    private func railCard(_ friend: ShowFriend, _ project: ShowProject) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(LinearGradient(colors: [project.coverA, project.coverB],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 56, height: 56)
                .overlay {
                    ClineBotShape()
                        .fill(style: FillStyle(eoFill: true))
                        .foregroundStyle(.white.opacity(0.85))
                        .frame(width: 20, height: 20)
                }
            VStack(alignment: .leading, spacing: 3) {
                Text(project.name)
                    .scaledFont(12.5, .bold)
                    .foregroundStyle(DT.ink(scheme))
                    .lineLimit(1)
                Text(friend.name)
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink55(scheme))
                if project.state == "LIVE NOW" {
                    HStack(spacing: 4) {
                        Circle().fill(DT.live(scheme)).frame(width: 5, height: 5)
                        Text("Live now")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(DT.live(scheme))
                    }
                }
            }
        }
        .padding(10)
        .frame(width: 200, alignment: .leading)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(project.name) by \(friend.name)\(project.state == "LIVE NOW" ? ", live now" : "")")
    }
}
