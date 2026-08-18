import SwiftUI
import UIKit

/// Rotate the interface between portrait and theater (landscape).
/// The same layout activates when the user physically rotates the phone.
@MainActor
func toggleTheaterOrientation() {
    guard let scene = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene }).first else { return }
    let mask: UIInterfaceOrientationMask = scene.interfaceOrientation.isPortrait ? .landscapeRight : .portrait
    scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask))
}

struct LiveCallView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.verticalSizeClass) private var vSize
    @State private var joining = true
    // Typing: the voice lane's quiet sibling — for when you don't want to
    // speak. The draft and sent bubbles live in memory only.
    @State private var typing = false
    @State private var draft = ""
    @FocusState private var draftFocused: Bool

    private var theater: Bool { vSize == .compact }

    var body: some View {
        Group {
            if theater { theaterLayout } else { portraitLayout }
        }
        .overlay {
            if joining {
                VStack(spacing: 14) {
                    DriveSpinner(size: 44)
                        .foregroundStyle(.white)
                    Text("Joining Auth middleware…")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.78))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(DT.pageDark.opacity(0.94))
                .ignoresSafeArea()
                .transition(.opacity)
            }
        }
        .onAppear {
            Task {
                try? await Task.sleep(nanoseconds: 900_000_000)
                withAnimation(.easeOut(duration: 0.35)) { joining = false }
            }
        }
        .onDisappear {
            // Leaving from theater must hand back a portrait app.
            if let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene }).first,
               !scene.interfaceOrientation.isPortrait {
                scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait))
            }
        }
        .background(DT.pageDark.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .sheet(isPresented: $store.showApproval) {
            ApprovalView()
                .presentationDetents([.height(430)])
                .presentationCornerRadius(22)
                .presentationDragIndicator(.hidden)
        }
        .statusBarHidden(theater)
    }

    // MARK: Portrait — spotlight fills between thin chrome and the hold strip

    private var portraitLayout: some View {
        VStack(spacing: 0) {
            header
            presenceChips.padding(.top, 12)
            DirectedSpotlight()
                .padding(.horizontal, 12)
                .padding(.top, 14)
            if !store.sessionMessages.isEmpty {
                sentBubbles
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
            }
            Group {
                if typing { typingBar } else { holdStrip }
            }
            .padding(.horizontal, 12)
            .padding(.top, store.sessionMessages.isEmpty ? 14 : 10)
            .padding(.bottom, 8)
        }
    }

    /// The last few typed messages, floating over the plane then gone with
    /// the session — in memory, never stored.
    private var sentBubbles: some View {
        VStack(alignment: .trailing, spacing: 6) {
            ForEach(store.sessionMessages) { message in
                Text(message.text)
                    .scaledFont(12.5)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(DT.violet.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Your typed messages: \(store.sessionMessages.map(\.text).joined(separator: ". "))")
    }

    /// Typing replaces the hold strip; the mic button brings voice back.
    private var typingBar: some View {
        HStack(spacing: 9) {
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                    typing = false
                    draftFocused = false
                }
            } label: {
                Image(systemName: "mic.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(width: 46, height: 46)
                    .background(DT.surface2Dark)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Back to voice")

            TextField("Type to the room…", text: $draft, axis: .vertical)
                .scaledFont(14)
                .lineLimit(1...3)
                .foregroundStyle(.white)
                .tint(DT.violet)
                .focused($draftFocused)
                .submitLabel(.send)
                .onSubmit { sendDraft() }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(DT.surface2Dark)
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .strokeBorder(.white.opacity(0.12), lineWidth: 0.8))

            Button { sendDraft() } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(draft.trimmingCharacters(in: .whitespaces).isEmpty
                                ? AnyShapeStyle(DT.surface2Dark) : AnyShapeStyle(DT.heroGradient))
                    .clipShape(Circle())
            }
            .buttonStyle(Pressable())
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            .sensoryFeedback(.impact(weight: .light), trigger: store.sessionMessages.count)
            .accessibilityLabel("Send message")
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
    }

    private func sendDraft() {
        let text = draft
        draft = ""
        store.sendSessionMessage(text)
    }

    // MARK: Theater — rotate the phone: content edge-to-edge, chrome floats

    /// Floating chrome over the theater spotlight wears pseudo-glass, not a
    /// material: a live blur over a surface animating at 30fps makes the
    /// compositor re-sample every frame. An opaque raised fill with a
    /// hairline reads identically on the dark plane and costs nothing.
    private var theaterGlass: Color { DT.raised.opacity(0.94) }

    private var theaterLayout: some View {
        ZStack {
            DirectedSpotlight(theater: true)
                .ignoresSafeArea()

            VStack {
                HStack {
                    Button { store.leaveCall() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.85))
                            .frame(width: 32, height: 32)
                            .background(theaterGlass, in: Circle())
                            .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                    Spacer()
                    HStack(spacing: 6) {
                        Circle().fill(DT.live(.dark)).frame(width: 6, height: 6)
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            Text("Auth middleware · \(store.callClock(at: context.date, start: store.callStart))")
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.85))
                                .monospacedDigit()
                        }
                    }
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(theaterGlass, in: Capsule())
                    .overlay(Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 0.8))
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)
                Spacer()
                if typing {
                    typingBar
                        .padding(.horizontal, 14)
                        .padding(.bottom, 10)
                        .frame(maxWidth: 560)
                } else {
                    HStack {
                        if !store.sessionMessages.isEmpty {
                            sentBubbles.frame(maxWidth: 300)
                                .padding(.leading, 14)
                        }
                        Spacer()
                        theaterControls
                            .padding(.trailing, 14)
                            .padding(.bottom, 10)
                    }
                }
            }
        }
    }

    private var theaterControls: some View {
        HStack(spacing: 8) {
            Button { store.handRaised.toggle() } label: {
                Text("✋").font(.system(size: 15))
                    .frame(width: 40, height: 40)
                    .background(store.handRaised ? DT.violet.opacity(0.4) : theaterGlass, in: Circle())
                    .overlay(Circle().strokeBorder(store.handRaised ? DT.violet : .white.opacity(0.12), lineWidth: store.handRaised ? 1.4 : 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel(store.handRaised ? "Lower hand" : "Raise hand")

            Image(systemName: store.micHeld ? "waveform" : "mic.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(DT.heroGradient, in: Circle())
                .shadow(color: DT.violet.opacity(store.micHeld ? 0.6 : 0.35), radius: 10, y: 4)
                .scaleEffect(store.micHeld ? 0.94 : 1)
                .animation(.easeOut(duration: 0.15), value: store.micHeld)
                .sensoryFeedback(.impact(weight: .medium), trigger: store.micHeld)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in if !store.micHeld { store.micHeld = true } }
                        .onEnded { _ in store.micHeld = false }
                )
                .accessibilityElement(children: .ignore)
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel("Hold to talk")
                .accessibilityValue(store.micHeld ? "Microphone live" : "Microphone muted")
                .accessibilityHint("Double-tap to toggle the microphone")
                .accessibilityAction { store.micHeld.toggle() }

            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                    typing = true
                    draftFocused = true
                }
            } label: {
                Image(systemName: "keyboard")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(width: 40, height: 40)
                    .background(theaterGlass, in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Type instead")

            Button { toggleTheaterOrientation() } label: {
                Image(systemName: "iphone")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(width: 40, height: 40)
                    .background(theaterGlass, in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Exit theater")

            Button { store.leaveCall() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(DT.danger)
                    .frame(width: 40, height: 40)
                    .background(DT.danger.opacity(0.18), in: Circle())
                    .overlay(Circle().strokeBorder(DT.danger.opacity(0.35), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Leave session")
        }
        .padding(6)
        .background(theaterGlass, in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
    }

    // MARK: Shared chrome (portrait)

    private var header: some View {
        HStack {
            Button { store.leaveCall() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.78))
                    .frame(width: 34, height: 34)
                    .background(DT.raised)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Leave session")
            Spacer()
            VStack(spacing: 2) {
                Text("Auth middleware")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                HStack(spacing: 5) {
                    Circle().fill(DT.live(.dark)).frame(width: 6, height: 6)
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Text("Live · \(store.callClock(at: context.date, start: store.callStart))")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(DT.live(.dark))
                            .monospacedDigit()
                    }
                }
            }
            Spacer()
            Button { toggleTheaterOrientation() } label: {
                Image(systemName: "rotate.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .frame(width: 34, height: 34)
                    .background(DT.raised)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Enter theater")
            .accessibilityHint("Rotates the spotlight to fill the screen")
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    private var presenceChips: some View {
        HStack(spacing: 10) {
            AvatarChip(letter: "M", color: Color(hex: 0x7A3FD4), speaking: !store.editAllowed)
            AvatarChip(letter: "A", color: Color(hex: 0x5B8DEF))
            DriveMark()
                .foregroundStyle(.white)
                .frame(width: 18, height: 18)
                .frame(width: 34, height: 34)
                .background(DT.surface2Dark)
                .clipShape(Circle())
                .overlay {
                    Circle().strokeBorder(.white.opacity(0.10), lineWidth: 0.8)
                    if store.editAllowed {
                        Circle().strokeBorder(DT.violet, lineWidth: 2).padding(-3.5)
                    }
                }
        }
    }

    private var holdStrip: some View {
        HStack(spacing: 10) {
            Button { store.handRaised.toggle() } label: {
                Text("✋")
                    .font(.system(size: 19))
                    .frame(width: 52, height: 52)
                    .background(store.handRaised ? DT.violet.opacity(0.28) : DT.surface2Dark)
                    .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
                        .strokeBorder(store.handRaised ? DT.violet : .white.opacity(0.10), lineWidth: store.handRaised ? 1.5 : 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel(store.handRaised ? "Lower hand" : "Raise hand")

            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                    typing = true
                    draftFocused = true
                }
            } label: {
                Image(systemName: "keyboard")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(width: 52, height: 52)
                    .background(DT.surface2Dark)
                    .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
                        .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
            .accessibilityLabel("Type instead")
            .accessibilityHint("Send a typed message to the room — for when you don't want to speak")

            holdButton

            Button { store.leaveCall() } label: {
                Text("Leave")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(DT.danger)
                    .frame(width: 52, height: 52)
                    .background(DT.danger.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
                        .strokeBorder(DT.danger.opacity(0.3), lineWidth: 0.8))
            }
            .buttonStyle(Pressable())
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
    }

    private var holdButton: some View {
        HStack(spacing: 9) {
            if store.micHeld {
                Waveform(color: .white, barCount: 5, height: 14)
                Text("Holding — release to send")
            } else {
                Image(systemName: "mic.fill").font(.system(size: 15, weight: .semibold))
                Text("Hold")
            }
        }
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(DT.heroGradient)
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .shadow(color: DT.violet.opacity(store.micHeld ? 0.55 : 0.35), radius: 13, y: 8)
        .scaleEffect(store.micHeld ? 0.97 : 1)
        .animation(.easeOut(duration: 0.15), value: store.micHeld)
        .sensoryFeedback(.impact(weight: .medium), trigger: store.micHeld)
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in if !store.micHeld { store.micHeld = true } }
                .onEnded { _ in store.micHeld = false }
        )
        // Press-and-hold is not operable by VoiceOver / Switch Control:
        // activating the element toggles the mic instead.
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Hold to talk")
        .accessibilityValue(store.micHeld ? "Microphone live" : "Microphone muted")
        .accessibilityHint("Double-tap to toggle the microphone")
        .accessibilityAction { store.micHeld.toggle() }
    }
}
