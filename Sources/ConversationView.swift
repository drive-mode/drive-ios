import SwiftUI

/// The conversation an interrupt points at — the agent's report_status trail
/// plus the ask itself, answerable inline with quick replies or voice.
struct InterruptConversationView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let interruptId: String

    private var interrupt: Interrupt? {
        store.interrupts.first { $0.id == interruptId }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let interrupt {
                        contextChip(interrupt)
                    }
                    ForEach(store.thread(for: interruptId)) { msg in
                        bubble(msg)
                    }
                    if interrupt?.kind == .approval && !(interrupt?.resolved ?? true) {
                        approvalCard
                    }
                    if let interrupt, interrupt.resolved {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(DT.live(scheme))
                            Text("Cleared — \(interrupt.agentName) is moving again")
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(DT.ink55(scheme))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 6)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 16)
            }

            if let interrupt, !interrupt.resolved, interrupt.kind == .blocked {
                quickReplies(["Use env", "Use vault", "Hold on — let's talk"])
            } else if let interrupt, !interrupt.resolved, interrupt.kind == .review {
                quickReplies(["Open the plan", "Park it for today"])
            }

            inputBar
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(interrupt?.agentName ?? "Conversation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { store.joinCall() } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "waveform")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Join session")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(Capsule())
                }
                .buttonStyle(Pressable())
            }
        }
    }

    private func contextChip(_ interrupt: Interrupt) -> some View {
        HStack(spacing: 7) {
            Circle().fill(interrupt.resolved ? DT.live(scheme) : DT.violet)
                .frame(width: 6, height: 6)
            Text(interrupt.title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(DT.ink55(scheme))
                .lineLimit(1)
            Spacer()
            Text(interrupt.age)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(DT.surface2(scheme))
        .clipShape(Capsule())
    }

    @ViewBuilder
    private func bubble(_ msg: ConvMessage) -> some View {
        switch msg.sender {
        case .system:
            HStack(spacing: 6) {
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 9))
                Text(msg.text)
                    .font(.system(size: 10.5, design: .monospaced))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(msg.time)
                    .font(.system(size: 9.5, design: .monospaced))
            }
            .foregroundStyle(DT.ink35(scheme))
            .padding(.horizontal, 4)
        case .agent:
            HStack(alignment: .bottom, spacing: 9) {
                if let interrupt {
                    AvatarChip(letter: String(interrupt.agentName.prefix(1)),
                               color: interrupt.agentColor, size: 26)
                        .accessibilityHidden(true)
                }
                Text(msg.text)
                    .scaledFont(14)
                    .lineSpacing(2.5)
                    .foregroundStyle(DT.ink(scheme))
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(DT.surface(scheme))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                        .strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
                Spacer(minLength: 28)
            }
        case .you:
            HStack(alignment: .bottom) {
                Spacer(minLength: 48)
                Text(msg.text)
                    .scaledFont(14, .medium)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(DT.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
            }
        }
    }

    private var approvalCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("+ export function requireAuth()")
                Text("+   verifyJwt(req); next()")
            }
            .font(.system(size: 11.5, design: .monospaced))
            .foregroundStyle(scheme == .dark ? DT.live(.dark) : DT.diffGreenOnLight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(DT.surface2(scheme))
            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))

            HStack(spacing: 9) {
                Button { store.denyEdit() } label: {
                    Text("Deny")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(DT.ink78(scheme))
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(DT.surface2(scheme))
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
                Button { store.allowEdit() } label: {
                    Text("Allow")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 44)
                        .background(DT.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                }
                .buttonStyle(Pressable())
            }
            .padding(.top, 12)
        }
        .padding(14)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(DT.violet.opacity(0.28), lineWidth: 0.8))
    }

    private func quickReplies(_ options: [String]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.self) { option in
                    Button { store.sendReply(interruptId: interruptId, option) } label: {
                        Text(option)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(DT.violetText(scheme))
                            .padding(.horizontal, 14).padding(.vertical, 9)
                            .background(DT.violet.opacity(0.10))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(DT.violet.opacity(0.22), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 10)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            Text("Message \(interrupt?.agentName ?? "agent")…")
                .font(.system(size: 14))
                .foregroundStyle(DT.ink35(scheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(DT.surface2(scheme))
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            Image(systemName: "mic.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(DT.heroGradient, in: Circle())
                .shadow(color: DT.violet.opacity(0.3), radius: 8, y: 4)
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel("Dictate a reply")
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
    }
}
