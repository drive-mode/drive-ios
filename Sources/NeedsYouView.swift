import SwiftUI

struct NeedsYouView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    private var open: [Interrupt] { store.interrupts.filter { !$0.resolved && $0.kind != .review } }
    private var deferred: [Interrupt] { store.interrupts.filter { !$0.resolved && $0.kind == .review } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if open.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 34, weight: .light))
                            .foregroundStyle(DT.live(scheme))
                        Text("Nothing needs you")
                            .font(.system(size: 17, weight: .bold))
                        Text("Everything else is working — \(store.reportingCount) agents reporting")
                            .font(.system(size: 13))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                }
                ForEach(open) { interrupt in
                    interruptCard(interrupt).padding(.top, 14)
                }
                ForEach(deferred) { interrupt in
                    deferredRow(interrupt).padding(.top, 14)
                }
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Needs you")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.needsYouCount > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Text("\(store.needsYouCount)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(DT.violet)
                        .clipShape(Circle())
                }
            }
        }
    }

    @ViewBuilder
    private func interruptCard(_ interrupt: Interrupt) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            NavigationLink { InterruptConversationView(interruptId: interrupt.id) } label: {
                HStack(spacing: 10) {
                    AvatarChip(letter: String(interrupt.agentName.prefix(1)), color: interrupt.agentColor, size: 32)
                    Text(interrupt.title)
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(DT.ink(scheme))
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                    Spacer()
                    Text(interrupt.age)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(DT.ink35(scheme))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(DT.ink35(scheme))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())

            if interrupt.kind == .approval {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(interrupt.detail, id: \.self) { line in
                        Text(line)
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundStyle(scheme == .dark ? DT.live(.dark) : DT.diffGreenOnLight)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 13).padding(.vertical, 11)
                .background(DT.surface2(scheme))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                .padding(.top, 12)

                HStack(spacing: 9) {
                    actionButton("Deny", style: .ghost) { store.denyEdit() }
                    actionButton("Allow", style: .solid) { store.allowEdit() }
                }
                .padding(.top, 14)
            } else {
                ForEach(interrupt.detail, id: \.self) { line in
                    HStack(spacing: 0) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(DT.violet.opacity(0.4))
                            .frame(width: 2.5)
                        Text(line)
                            .font(.system(size: 13.5))
                            .foregroundStyle(DT.ink78(scheme))
                            .lineSpacing(2)
                            .padding(.leading, 12)
                    }
                    .padding(.top, 12)
                }
                HStack(spacing: 9) {
                    NavigationLink { InterruptConversationView(interruptId: interrupt.id) } label: {
                        Text("Reply")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(DT.ink78(scheme))
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(DT.surface2(scheme))
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                    actionButton("Join session", style: .wash) { store.joinCall() }
                }
                .padding(.top, 14)
            }
        }
        .padding(16)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.violet.opacity(0.28), lineWidth: 0.8))
    }

    private func deferredRow(_ interrupt: Interrupt) -> some View {
        HStack(spacing: 10) {
            AvatarChip(letter: String(interrupt.agentName.prefix(1)), color: interrupt.agentColor, size: 28)
            (Text(interrupt.agentName).bold().foregroundColor(DT.ink(scheme))
             + Text(" · \(interrupt.title.replacingOccurrences(of: "\(interrupt.agentName) ", with: ""))")
                .foregroundColor(DT.ink55(scheme)))
                .font(.system(size: 13))
                .lineLimit(2)
            Spacer()
            Button { store.resolveInterrupt(id: interrupt.id) } label: {
                Text("Open")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(DT.violetText(scheme))
            }
            .buttonStyle(Pressable())
        }
        .padding(.horizontal, 16).padding(.vertical, 13)
        .background {
            RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                .strokeBorder(DT.ink(scheme).opacity(0.14), style: StrokeStyle(lineWidth: 0.8, dash: [4, 3]))
        }
    }

    private enum ActionStyle { case ghost, wash, solid }

    private func actionButton(_ label: String, style: ActionStyle, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(style == .solid ? .white : style == .wash ? DT.violetText(scheme) : DT.ink78(scheme))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background {
                    switch style {
                    case .ghost: DT.surface2(scheme)
                    case .wash: DT.violet.opacity(0.10)
                    case .solid: AnyView(DT.heroGradient)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
        }
        .buttonStyle(Pressable())
    }
}
