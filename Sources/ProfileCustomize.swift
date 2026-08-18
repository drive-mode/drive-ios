import SwiftUI

/// The profile is yours to arrange: every stat block is a module you can
/// show, hide, and reorder. Persisted as two strings so the layout
/// survives relaunches and future modules append gracefully.
enum ProfileModule: String, CaseIterable, Identifiable {
    case rings, insights, week, trends, records, streak, badges

    var id: String { rawValue }

    var label: String {
        switch self {
        case .rings: return "Steer · Answer · Ship rings"
        case .insights: return "Insights"
        case .week: return "Shipped by day"
        case .trends: return "Trends"
        case .records: return "Records"
        case .streak: return "Steering streak"
        case .badges: return "Badges"
        }
    }

    var symbol: String {
        switch self {
        case .rings: return "circle.circle"
        case .insights: return "sparkle"
        case .week: return "chart.bar"
        case .trends: return "arrow.up.right"
        case .records: return "flag.checkered"
        case .streak: return "flame"
        case .badges: return "rosette"
        }
    }

    static let defaultOrder = allCases.map(\.rawValue).joined(separator: ",")

    /// Parse a stored order, appending any modules the stored string
    /// predates — new modules appear instead of vanishing.
    static func order(from raw: String) -> [ProfileModule] {
        var seen: [ProfileModule] = raw.split(separator: ",")
            .compactMap { ProfileModule(rawValue: String($0)) }
        for module in allCases where !seen.contains(module) {
            seen.append(module)
        }
        return seen
    }

    static func hidden(from raw: String) -> Set<ProfileModule> {
        Set(raw.split(separator: ",").compactMap { ProfileModule(rawValue: String($0)) })
    }
}

/// Choose and arrange the stats you actually want to see — with a one-tap
/// "Cline's pick" if you'd rather be suggested a layout.
struct CustomizeProfileSheet: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    @Binding var orderRaw: String
    @Binding var hiddenRaw: String

    @State private var order: [ProfileModule]
    @State private var hidden: Set<ProfileModule>
    @State private var clinePicked = false

    init(orderRaw: Binding<String>, hiddenRaw: Binding<String>) {
        self._orderRaw = orderRaw
        self._hiddenRaw = hiddenRaw
        self._order = State(initialValue: ProfileModule.order(from: orderRaw.wrappedValue))
        self._hidden = State(initialValue: ProfileModule.hidden(from: hiddenRaw.wrappedValue))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(order) { module in
                        HStack(spacing: 12) {
                            Image(systemName: module.symbol)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(DT.violetText(scheme))
                                .frame(width: 26)
                            Text(module.label)
                                .scaledFont(15)
                            Spacer()
                            Toggle(module.label, isOn: shownBinding(module))
                                .labelsHidden()
                                .tint(DT.live(scheme))
                        }
                    }
                    .onMove { from, to in
                        order.move(fromOffsets: from, toOffset: to)
                        persist()
                    }
                } footer: {
                    Text("Drag to reorder. Everything stays on this device.")
                }

                Section {
                    Button {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                            order = ProfileModule.order(from: "rings,week,streak,insights,records,trends,badges")
                            hidden = []
                            clinePicked = true
                            persist()
                        }
                    } label: {
                        HStack(spacing: 10) {
                            AvatarChip(letter: "C", color: DemoData.coder, size: 26)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Ask Cline for a layout")
                                    .scaledFont(14, .bold)
                                    .foregroundStyle(DT.ink(scheme))
                                Text(clinePicked
                                     ? "Cline's pick applied — momentum first: rings, week, streak."
                                     : "Suggests an arrangement from what you check most.")
                                    .font(.system(size: 11))
                                    .foregroundStyle(DT.ink55(scheme))
                            }
                        }
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Customize profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { persist(); dismiss() }
                        .fontWeight(.bold)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        withAnimation {
                            order = ProfileModule.allCases.map { $0 }
                            hidden = []
                            clinePicked = false
                            persist()
                        }
                    }
                }
            }
        }
        .presentationDetents([.large, .medium])
        .presentationCornerRadius(22)
    }

    private func shownBinding(_ module: ProfileModule) -> Binding<Bool> {
        Binding(
            get: { !hidden.contains(module) },
            set: { shown in
                if shown { hidden.remove(module) } else { hidden.insert(module) }
                persist()
            })
    }

    private func persist() {
        orderRaw = order.map(\.rawValue).joined(separator: ",")
        hiddenRaw = hidden.map(\.rawValue).sorted().joined(separator: ",")
    }
}
