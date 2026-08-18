import SwiftUI

/// The Today section, unfolded: this week, this month, this year, or your
/// own range — tap any day to see what shipped and which projects it fed.
struct ActivityView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var range = "Week"
    @State private var selectedDayId: Int? = 0
    @State private var customFrom = Calendar.current.date(byAdding: .day, value: -13, to: Date()) ?? Date()
    @State private var customTo = Date()

    private let days = ActivityDemo.days

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                rangeControl.padding(.top, 8)

                switch range {
                case "Week": weekBars.padding(.top, 16)
                case "Month": monthCalendar.padding(.top, 16)
                case "Year": yearBars.padding(.top, 16)
                default: customRange.padding(.top, 16)
                }

                if let breakdown {
                    BreakdownCard(title: breakdown.title, records: breakdown.records)
                        .padding(.top, 14)
                }
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Activity")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.intent.record(.activity) }
    }

    // MARK: Range plumbing

    private var rangeControl: some View {
        HStack(spacing: 4) {
            ForEach(["Week", "Month", "Year", "Custom"], id: \.self) { option in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                        range = option
                        selectedDayId = option == "Week" ? 0 : nil
                    }
                } label: {
                    Text(option)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(range == option ? DT.violetText(scheme) : DT.ink55(scheme))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(range == option ? AnyView(DT.surface(scheme)) : AnyView(Color.clear))
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(3)
        .background(DT.surface2(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }

    private var breakdown: (title: String, records: [DayRecord])? {
        if let id = selectedDayId, let day = days.first(where: { $0.id == id }) {
            return (day.date.formatted(.dateTime.weekday(.wide).month().day()), [day])
        }
        switch range {
        case "Week": return ("Last 7 days", Array(days.prefix(7)))
        case "Month": return ("This month", monthRecords)
        case "Year": return ("Last 12 months", Array(days))
        default: return ("Custom range", customRecords)
        }
    }

    private var monthRecords: [DayRecord] {
        let cal = Calendar.current
        return days.filter { cal.isDate($0.date, equalTo: Date(), toGranularity: .month) }
    }

    private var customRecords: [DayRecord] {
        let from = Calendar.current.startOfDay(for: customFrom)
        let to = Calendar.current.startOfDay(for: customTo)
        return days.filter { $0.date >= from && $0.date <= to }
    }

    // MARK: Week

    private var weekBars: some View {
        let week = Array(days.prefix(7)).reversed()
        let maxShips = max(1, week.map(\.ships).max() ?? 1)
        return VStack(alignment: .leading, spacing: 0) {
            Eyebrow("SHIPPED · LAST 7 DAYS")
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(Array(week)) { day in
                    let selected = selectedDayId == day.id
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            selectedDayId = selected ? nil : day.id
                        }
                    } label: {
                        VStack(spacing: 6) {
                            Text("\(day.ships)")
                                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                .foregroundStyle(selected ? DT.violetText(scheme) : DT.ink35(scheme))
                            GeometryReader { geo in
                                VStack {
                                    Spacer(minLength: 0)
                                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                                        .fill(selected ? AnyShapeStyle(DT.heroGradient)
                                                       : AnyShapeStyle(DT.violet.opacity(scheme == .dark ? 0.34 : 0.22)))
                                        .frame(height: max(5, geo.size.height * CGFloat(day.ships) / CGFloat(maxShips)))
                                }
                            }
                            Text(day.date.formatted(.dateTime.weekday(.narrow)))
                                .font(.system(size: 9, weight: selected ? .heavy : .semibold))
                                .foregroundStyle(selected ? DT.violetText(scheme) : DT.ink35(scheme))
                        }
                    }
                    .buttonStyle(Pressable())
                }
            }
            .frame(height: 130)
            .padding(.top, 12)
        }
        .padding(16)
        .card(radius: DT.rHero)
    }

    // MARK: Month calendar

    private var monthCalendar: some View {
        let cal = Calendar.current
        let today = Date()
        let monthDays = monthRecords.sorted { $0.date < $1.date }
        let maxShips = max(1, monthDays.map(\.ships).max() ?? 1)
        let firstWeekday = monthDays.first.map { cal.component(.weekday, from: $0.date) } ?? 1
        return VStack(alignment: .leading, spacing: 0) {
            Eyebrow(today.formatted(.dateTime.month(.wide).year()).uppercased())
            let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
            LazyVGrid(columns: columns, spacing: 8) {
                // Lazy grids flatten child identity — namespace every ForEach
                // id or sibling collisions silently drop cells.
                ForEach(["S", "M", "T", "W", "T", "F", "S"].indices.map { "hdr-\($0)" }, id: \.self) { key in
                    Text(["S", "M", "T", "W", "T", "F", "S"][Int(key.dropFirst(4))!])
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(DT.ink35(scheme))
                }
                ForEach((0..<(firstWeekday - 1)).map { "blank-\($0)" }, id: \.self) { _ in
                    Color.clear.frame(height: 34)
                }
                ForEach(monthDays) { day in
                    let selected = selectedDayId == day.id
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            selectedDayId = selected ? nil : day.id
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text(day.date.formatted(.dateTime.day()))
                                .font(.system(size: 11, weight: selected ? .heavy : .semibold))
                                .foregroundStyle(selected ? DT.violetText(scheme) : DT.ink78(scheme))
                            RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                                .fill(heatColor(level: heatLevel(day.ships, max: maxShips), scheme: scheme))
                                .frame(width: 15, height: 15)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(selected ? DT.violet.opacity(0.12) : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                    .accessibilityLabel("\(day.date.formatted(.dateTime.month().day())), \(day.ships) shipped")
                }
            }
            .padding(.top, 12)
        }
        .padding(16)
        .card(radius: DT.rHero)
    }

    // MARK: Year — the contribution graph. Darker squares, busier days.

    private var yearBars: some View {
        let total = days.reduce(0) { $0 + $1.ships }
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Eyebrow("SHIPPED · LAST 12 MONTHS")
                Spacer()
                Text("\(total) total")
                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                    .foregroundStyle(DT.violetText(scheme))
            }
            ContributionGrid(selectedDayId: $selectedDayId)
                .padding(.top, 12)
            HStack(spacing: 4) {
                Spacer()
                Text("Less")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
                ForEach(0..<5, id: \.self) { level in
                    RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                        .fill(heatColor(level: level, scheme: scheme))
                        .frame(width: 10, height: 10)
                }
                Text("More")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
            }
            .padding(.top, 10)
        }
        .padding(16)
        .card(radius: DT.rHero)
    }

    // MARK: Custom

    private var customRange: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow("CUSTOM RANGE")
            HStack {
                DatePicker("From", selection: $customFrom, in: ...customTo, displayedComponents: .date)
                    .labelsHidden()
                Image(systemName: "arrow.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
                DatePicker("To", selection: $customTo, in: customFrom...Date(), displayedComponents: .date)
                    .labelsHidden()
                Spacer()
            }
            let records = customRecords
            Text("\(records.reduce(0) { $0 + $1.ships }) shipped across \(records.count) days")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(DT.ink78(scheme))
        }
        .padding(16)
        .card(radius: DT.rHero)
    }
}

// MARK: - Heat scale (GitHub-style: darker = more)

func heatLevel(_ ships: Int, max maxShips: Int) -> Int {
    guard ships > 0, maxShips > 0 else { return 0 }
    return Swift.max(1, Swift.min(4, Int(ceil(Double(ships) / Double(maxShips) * 4))))
}

func heatColor(level: Int, scheme: ColorScheme) -> Color {
    let steps: [Double] = scheme == .dark ? [0, 0.22, 0.42, 0.66, 1.0] : [0, 0.18, 0.38, 0.62, 0.95]
    if level == 0 { return scheme == .dark ? DT.surface2Dark : DT.surface2Light }
    return DT.violet.opacity(steps[level])
}

/// 52 weeks of squares, weekday rows — the GitHub/Cursor contribution wall.
/// Scrolls to now; tap a square to open that day's breakdown. Columns and
/// month labels come precomputed from ActivityDemo — a selection tap
/// re-renders this view and must not re-derive the year.
struct ContributionGrid: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var selectedDayId: Int?

    var body: some View {
        let maxShips = ActivityDemo.maxDailyShips
        let cols = ActivityDemo.yearColumns
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top, spacing: 3) {
                        ForEach(cols.indices, id: \.self) { c in
                            VStack(spacing: 3) {
                                Text(ActivityDemo.yearMonthLabels[c] ?? " ")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(DT.ink35(scheme))
                                    .frame(height: 10)
                                    .fixedSize()
                                ForEach(0..<7, id: \.self) { r in
                                    if let day = cols[c][r] {
                                        Button { selectedDayId = day.id } label: {
                                            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                                                .fill(heatColor(level: heatLevel(day.ships, max: maxShips), scheme: scheme))
                                                .frame(width: 11, height: 11)
                                                .overlay {
                                                    if selectedDayId == day.id {
                                                        RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                                                            .strokeBorder(DT.violetText(scheme), lineWidth: 1.5)
                                                    }
                                                }
                                        }
                                        .buttonStyle(.plain)
                                        .accessibilityLabel("\(day.date.formatted(.dateTime.month().day())), \(day.ships) shipped")
                                    } else {
                                        Color.clear.frame(width: 11, height: 11)
                                    }
                                }
                            }
                            .id(c)
                        }
                    }
                }
            }
            .onAppear { proxy.scrollTo(cols.count - 1, anchor: .trailing) }
        }
        .frame(height: 112)
    }
}

/// Where the work went: totals plus per-project split, status-hub style.
struct BreakdownCard: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let records: [DayRecord]

    private var merged: [(name: String, count: Int)] {
        var totals: [String: Int] = [:]
        for record in records {
            for (name, count) in record.byProject { totals[name, default: 0] += count }
        }
        return totals.map { ($0.key, $0.value) }.sorted { $0.1 > $1.1 }
    }

    var body: some View {
        let total = records.reduce(0) { $0 + $1.ships }
        let maxCount = max(1, merged.first?.count ?? 1)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.system(size: 14.5, weight: .heavy))
                Spacer()
                Text("\(total) shipped")
                    .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                    .foregroundStyle(DT.live(scheme))
            }
            VStack(spacing: 9) {
                ForEach(merged.prefix(8), id: \.name) { slice in
                    NavigationLink { ProjectDetailView(projectId: slice.name) } label: {
                        HStack(spacing: 10) {
                            Text(slice.name)
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(DT.ink(scheme))
                                .lineLimit(1)
                                .frame(width: 128, alignment: .leading)
                            GeometryReader { geo in
                                Capsule()
                                    .fill(DT.violet.opacity(scheme == .dark ? 0.4 : 0.28))
                                    .frame(width: max(4, geo.size.width * CGFloat(slice.count) / CGFloat(maxCount)))
                                    .frame(maxHeight: .infinity, alignment: .center)
                            }
                            Text("\(slice.count)")
                                .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                                .foregroundStyle(DT.ink55(scheme))
                                .frame(width: 26, alignment: .trailing)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .frame(height: 22)
                    }
                    .buttonStyle(Pressable())
                }
            }
            .padding(.top, 12)
        }
        .padding(16)
        .card(radius: DT.rHero)
    }
}
