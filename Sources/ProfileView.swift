import SwiftUI

/// Your week — metrics that feel like Apple's rings and trends, wearing
/// Drive's verbs: Steer, Answer, Ship. Personable, honest, never stale.
struct ProfileView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    // The stat blocks are modules: yours to show, hide, and reorder.
    @AppStorage("profile.order") private var orderRaw = ProfileModule.defaultOrder
    @AppStorage("profile.hidden") private var hiddenRaw = ""
    @AppStorage("profile.displayName") private var profileName = "Harrison"
    @AppStorage("profile.email") private var profileEmail = "harrison@quant-h2.com"
    @State private var customizing = false

    private var activeModules: [ProfileModule] {
        let hidden = ProfileModule.hidden(from: hiddenRaw)
        return ProfileModule.order(from: orderRaw).filter { !hidden.contains($0) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header.padding(.top, 6)
                showcaseCard.padding(.top, 14)
                ForEach(activeModules) { module in
                    moduleView(module)
                }
                if activeModules.isEmpty {
                    Text("Everything's hidden — tap Customize to bring your stats back.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(DT.ink55(scheme))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }
                settingsLinks.padding(.top, 22)
                Text("Usage is measured on-device.")
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 18)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.intent.record(.profile) }
        .sheet(isPresented: $customizing) {
            CustomizeProfileSheet(orderRaw: $orderRaw, hiddenRaw: $hiddenRaw)
        }
    }

    @ViewBuilder
    private func moduleView(_ module: ProfileModule) -> some View {
        switch module {
        case .rings: ringsCard.padding(.top, 16)
        case .insights: insightRows.padding(.top, 14)
        case .week: shipChart.padding(.top, 16)
        case .trends: trendRow.padding(.top, 12)
        case .records: recordCards.padding(.top, 16)
        case .streak: streakBanner.padding(.top, 16)
        case .badges: badgeGrid.padding(.top, 14)
        }
    }

    private var header: some View {
        HStack(spacing: 13) {
            AvatarChip(letter: "H", color: DT.violet, size: 46, human: true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Your week, \(profileName)")
                    .font(.system(size: 21, weight: .heavy))
                    .kerning(-0.5)
                Text(verbatim: profileEmail)
                    .font(.system(size: 11.5))
                    .foregroundStyle(DT.ink55(scheme))
            }
            Spacer()
            Button { customizing = true } label: {
                Image(systemName: "rectangle.3.group")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(DT.violetText(scheme))
                    .frame(width: 34, height: 34)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(Circle())
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Customize profile")
            .accessibilityHint("Choose and reorder your stat modules")
        }
    }

    /// The door to Drivemode "by Cline" — your projects as a shelf.
    private var showcaseCard: some View {
        NavigationLink { ShowcaseView() } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(DT.heroGradient)
                        .frame(width: 40, height: 40)
                    Image(systemName: "square.grid.2x2.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Your showcase")
                        .scaledFont(15, .bold)
                        .foregroundStyle(DT.ink(scheme))
                    Text("\(ShowcaseDemo.you.count) projects · Drivemode by Cline")
                        .font(.system(size: 11))
                        .foregroundStyle(DT.ink55(scheme))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .card()
        }
        .buttonStyle(Pressable())
        .accessibilityHint("Your project squares, demos, and friends")
    }

    // MARK: Rings

    private var ringsCard: some View {
        HStack(spacing: 20) {
            ActivityRings(size: 132)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(DemoData.rings.indices, id: \.self) { i in
                    let ring = DemoData.rings[i]
                    HStack(spacing: 9) {
                        Circle().fill(ring.color).frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 4) {
                                CountUpText(ring.value)
                                    .font(.system(size: 15, weight: .heavy))
                                Text(ring.goal)
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(DT.ink55(scheme))
                            }
                            Text(ring.label.uppercased())
                                .font(.system(size: 8.5, weight: .heavy))
                                .tracking(1)
                                .foregroundStyle(DT.ink35(scheme))
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .card(radius: DT.rHero)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(ringsA11y)
    }

    private var ringsA11y: String {
        DemoData.rings.map { "\($0.label): \($0.value) \($0.goal)" }.joined(separator: ". ")
    }

    private var insightRows: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(DemoData.insights, id: \.self) { insight in
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "sparkle")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.top, 2)
                    Text(insight)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(DT.ink78(scheme))
                }
            }
        }
        .padding(.horizontal, 4)
    }

    // MARK: Chart

    private var shipChart: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Eyebrow("SHIPPED BY DAY")
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 9, weight: .bold))
                    Text("+23% vs last week")
                        .font(.system(size: 10.5, weight: .bold))
                }
                .foregroundStyle(DT.live(scheme))
            }
            WeekBars()
                .frame(height: 118)
                .padding(.top, 12)
        }
        .padding(16)
        .card(radius: DT.rHero)
    }

    private var trendRow: some View {
        HStack(spacing: 9) {
            ForEach(DemoData.trends.indices, id: \.self) { i in
                let trend = DemoData.trends[i]
                VStack(alignment: .leading, spacing: 5) {
                    Image(systemName: trend.symbol)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(DT.ink35(scheme))
                    HStack(spacing: 3) {
                        Image(systemName: trend.up ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 9, weight: .heavy))
                        Text(trend.delta)
                            .font(.system(size: 14, weight: .heavy))
                    }
                    .foregroundStyle(trend.good ? DT.live(scheme) : DT.danger)
                    Text(trend.label)
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundStyle(DT.ink55(scheme))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12).padding(.vertical, 11)
                .card()
            }
        }
    }

    private var recordCards: some View {
        HStack(spacing: 9) {
            ForEach(DemoData.records.indices, id: \.self) { i in
                let record = DemoData.records[i]
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: record.symbol)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color(hex: 0xFFC55C))
                        Text("RECORD")
                            .font(.system(size: 8, weight: .heavy))
                            .tracking(1.2)
                            .foregroundStyle(DT.ink35(scheme))
                    }
                    CountUpText(record.value)
                        .font(.system(size: 26, weight: .heavy))
                        .kerning(-0.8)
                    Text(record.label)
                        .font(.system(size: 12, weight: .bold))
                    Text(record.sub)
                        .font(.system(size: 10))
                        .foregroundStyle(DT.ink55(scheme))
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .card()
            }
        }
    }

    private var streakBanner: some View {
        HStack(spacing: 13) {
            ZStack {
                Circle().fill(DT.violet.opacity(0.12)).frame(width: 44, height: 44)
                DriveMark()
                    .foregroundStyle(DT.violetText(scheme))
                    .frame(width: 24, height: 24)
                    .markWiggle()
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    CountUpText("\(DemoData.streakDays)")
                        .font(.system(size: 17, weight: .heavy))
                    Text("day steering streak")
                        .font(.system(size: 14, weight: .bold))
                }
                Text("Answer one interrupt today to keep it rolling.")
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink55(scheme))
            }
            Spacer()
        }
        .padding(14)
        .background(DT.violet.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
            .strokeBorder(DT.violet.opacity(0.20), lineWidth: 0.8))
    }

    private var badgeGrid: some View {
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow("BADGES")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 9), count: 3), spacing: 9) {
                ForEach(DemoData.badges) { badge in
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(badge.earned ? AnyShapeStyle(DT.heroGradient) : AnyShapeStyle(DT.surface2(scheme)))
                                .frame(width: 42, height: 42)
                            Image(systemName: badge.earned ? badge.symbol : "lock.fill")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(badge.earned ? .white : DT.ink35(scheme))
                        }
                        Text(badge.name)
                            .font(.system(size: 10.5, weight: .bold))
                            .foregroundStyle(badge.earned ? DT.ink(scheme) : DT.ink35(scheme))
                        Text(badge.note)
                            .font(.system(size: 8.5))
                            .foregroundStyle(DT.ink35(scheme))
                            .multilineTextAlignment(.center)
                            .lineLimit(2, reservesSpace: true)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .card()
                    .opacity(badge.earned ? 1 : 0.72)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(badge.name), \(badge.earned ? "earned" : "locked"): \(badge.note)")
                }
            }
            .padding(.top, 10)
        }
    }

    private var settingsLinks: some View {
        VStack(spacing: 0) {
            Button { store.openSettings(.general, source: .profile) } label: {
                settingsRow(icon: "slider.horizontal.3", label: "Configuration",
                            sub: "Appearance · voice · approval defaults")
            }
            .buttonStyle(Pressable())
            Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 54)
            Button { store.openSettings(.privacy, source: .profile) } label: {
                settingsRow(icon: "lock", label: "Privacy & account",
                            sub: "Transcripts · work events · sign-in")
            }
            .buttonStyle(Pressable())
            Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 54)
            Button { store.openSettings(.billingPayments, source: .profile) } label: {
                settingsRow(icon: "creditcard", label: "Billing & payments",
                            sub: "Plan · payment method · renewal")
            }
            .buttonStyle(Pressable())
            Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 54)
            Button { store.openSettings(.usage, source: .profile) } label: {
                settingsRow(icon: "gauge.with.dots.needle.50percent", label: "Usage",
                            sub: "Model work · calls · resources")
            }
            .buttonStyle(Pressable())
            Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 54)
            Button { store.openSettings(.analytics, source: .profile) } label: {
                settingsRow(icon: "chart.xyaxis.line", label: "Analytics",
                            sub: "Shipped work · attention · artifacts")
            }
            .buttonStyle(Pressable())
        }
        .card()
    }

    private func settingsRow(icon: String, label: String, sub: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(DT.violetText(scheme))
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.system(size: 15)).foregroundStyle(DT.ink(scheme))
                Text(sub).font(.system(size: 11)).foregroundStyle(DT.ink35(scheme))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14)
        .frame(height: 56)
        .contentShape(Rectangle())
    }
}

// MARK: - Pieces

/// Activity-style concentric rings, drawn in with a staggered spring.
struct ActivityRings: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    var size: CGFloat
    @State private var progress: [Double] = [0, 0, 0]

    var body: some View {
        ZStack {
            ForEach(DemoData.rings.indices, id: \.self) { i in
                let ring = DemoData.rings[i]
                let inset = CGFloat(i) * 17
                Circle()
                    .stroke(ring.color.opacity(0.16), lineWidth: 11)
                    .padding(inset + 8)
                Circle()
                    .trim(from: 0, to: progress[i])
                    .stroke(ring.color, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(inset + 8)
            }
            DriveMark()
                .foregroundStyle(DT.ink35(scheme))
                .frame(width: size * 0.16, height: size * 0.16)
        }
        .frame(width: size, height: size)
        .onAppear {
            let reduced = systemReduceMotion || appReduceMotion
            for i in DemoData.rings.indices {
                if reduced {
                    progress[i] = DemoData.rings[i].progress
                } else {
                    withAnimation(.spring(response: 1.1, dampingFraction: 0.85).delay(Double(i) * 0.18)) {
                        progress[i] = DemoData.rings[i].progress
                    }
                }
            }
        }
    }
}

/// Branded week bars: violet gradient, best day crowned, quiet grid.
struct WeekBars: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    @State private var grow = false

    var body: some View {
        let maxShips = DemoData.week.map(\.ships).max() ?? 1
        HStack(alignment: .bottom, spacing: 10) {
            ForEach(DemoData.week) { day in
                let isBest = day.ships == maxShips
                VStack(spacing: 6) {
                    Text("\(day.ships)")
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundStyle(isBest ? DT.violetText(scheme) : DT.ink35(scheme))
                        .opacity(grow ? 1 : 0)
                    GeometryReader { geo in
                        VStack {
                            Spacer(minLength: 0)
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(isBest ? AnyShapeStyle(DT.heroGradient)
                                             : AnyShapeStyle(DT.violet.opacity(scheme == .dark ? 0.34 : 0.22)))
                                .frame(height: max(5, geo.size.height * CGFloat(day.ships) / CGFloat(maxShips) * (grow ? 1 : 0.05)))
                        }
                    }
                    Text(day.day)
                        .font(.system(size: 9, weight: isBest ? .heavy : .semibold))
                        .foregroundStyle(isBest ? DT.violetText(scheme) : DT.ink35(scheme))
                }
            }
        }
        .onAppear {
            if systemReduceMotion || appReduceMotion {
                grow = true
            } else {
                withAnimation(.spring(response: 0.8, dampingFraction: 0.8).delay(0.15)) { grow = true }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Shipped by day: " + DemoData.week.map { "\($0.day) \($0.ships)" }.joined(separator: ", "))
    }
}

/// Numbers that roll in like Apple's — numeric content transition.
struct CountUpText: View {
    let text: String
    @State private var shown = false
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(shown ? text : placeholder)
            .monospacedDigit()
            .contentTransition(.numericText(countsDown: false))
            .onAppear {
                withAnimation(.easeOut(duration: 0.7).delay(0.1)) { shown = true }
            }
    }
    private var placeholder: String {
        String(text.map { $0.isNumber ? "0" : $0 })
    }
}
