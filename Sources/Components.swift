import SwiftUI
import UIKit

// MARK: - Accessibility & UX helpers

/// Dynamic Type support for the token-sized brand type: multiplies the design
/// size by the user's text-size setting (relative to body). Rides the bundled
/// Schibsted Grotesk (variable weight); monospaced design keeps the system
/// mono, and the custom face falls back to system if the bundle lacks it.
struct ScaledFont: ViewModifier {
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1
    var size: CGFloat
    var weight: Font.Weight
    var design: Font.Design
    func body(content: Content) -> some View {
        if design == .monospaced {
            content.font(.system(size: size * scale, weight: weight, design: design))
        } else {
            content.font(.custom("Schibsted Grotesk", size: size * scale).weight(weight))
        }
    }
}

extension View {
    func scaledFont(_ size: CGFloat, _ weight: Font.Weight = .regular, design: Font.Design = .default) -> some View {
        modifier(ScaledFont(size: size, weight: weight, design: design))
    }
}

/// Horizontal swipe between the four tab pages. Attach to each tab's ROOT
/// surface only — pushed views keep the edge-swipe for back.
struct TabSwipe: ViewModifier {
    @EnvironmentObject var store: AppStore
    func body(content: Content) -> some View {
        content.simultaneousGesture(
            DragGesture(minimumDistance: 40)
                .onEnded { v in
                    let w = v.translation.width
                    guard abs(w) > 60,
                          abs(w) > abs(v.translation.height) * 2,
                          v.startLocation.x > 28 else { return }
                    let order: [AppTab] = [.home, .work, .agents, .tasks]
                    guard let i = order.firstIndex(of: store.selectedTab) else { return }
                    let j = w < 0 ? i + 1 : i - 1
                    guard order.indices.contains(j) else { return }
                    withAnimation(.easeOut(duration: 0.2)) { store.selectedTab = order[j] }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
        )
    }
}

extension View {
    func tabSwipe() -> some View { modifier(TabSwipe()) }
}

/// The OFFICIAL Drive mark — sporty flat-bottom D-rim steering wheel with
/// the Cline head as its hub (assets/drive/, DEC-drive-mark-official).
/// Monochrome silhouette: black on light, white on dark, never purple fill.
struct DriveMark: View {
    var body: some View {
        ZStack {
            DriveWheelShape().fill(style: FillStyle(eoFill: true))
            DriveHeadShape().fill(style: FillStyle(eoFill: true))
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

/// Brand loader per the motion doc: **the wheel turns; Cline stays
/// upright** — a whole-mark spin reads as a tumbling logo, not driving.
/// Stills under Reduce Motion.
struct DriveSpinner: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    var size: CGFloat = 28
    @State private var spin = false
    var body: some View {
        ZStack {
            DriveWheelShape()
                .fill(style: FillStyle(eoFill: true))
                .rotationEffect(.degrees(spin ? 360 : 0))
            DriveHeadShape()
                .fill(style: FillStyle(eoFill: true))
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(width: size, height: size)
        .onAppear {
            guard !(systemReduceMotion || appReduceMotion) else { return }
            withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                spin = true
            }
        }
    }
}

/// Idle "head peek": a slow, tiny steering wiggle for hero marks.
struct MarkWiggle: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    func body(content: Content) -> some View {
        if systemReduceMotion || appReduceMotion {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                // A wiggle every few seconds, easing through ±7°.
                let phase = t.truncatingRemainder(dividingBy: 4.2)
                let angle = phase < 1.2 ? sin(phase / 1.2 * .pi * 2) * 7 : 0
                content.rotationEffect(.degrees(angle))
            }
        }
    }
}

extension View {
    func markWiggle() -> some View { modifier(MarkWiggle()) }
}

/// Springy press feedback for every button in the app.
struct Pressable: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    func makeBody(configuration: Configuration) -> some View {
        let reduced = systemReduceMotion || appReduceMotion
        configuration.label
            .scaleEffect(configuration.isPressed && !reduced ? 0.96 : 1)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.55), value: configuration.isPressed)
    }
}

struct LivePill: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    var onGradient = false
    @State private var pulse = false
    private var reduced: Bool { systemReduceMotion || appReduceMotion }
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(DT.live(onGradient ? .dark : scheme))
                .frame(width: 6, height: 6)
                .opacity(reduced ? 1 : (pulse ? 1 : 0.45))
            Text("LIVE")
                .tracking(1.2)
                .scaledFont(10, .heavy)
        }
        .padding(.horizontal, 11).padding(.vertical, 5)
        .background(onGradient ? AnyShapeStyle(.white.opacity(0.18)) : AnyShapeStyle(DT.surface(scheme)))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(onGradient ? .clear : DT.hairline(scheme), lineWidth: 0.8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Live")
        .onAppear {
            guard !reduced else { return }
            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}

struct Eyebrow: View {
    @Environment(\.colorScheme) private var scheme
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .tracking(1.0)
            .scaledFont(11, .bold)
            .foregroundStyle(DT.ink35(scheme))
    }
}

struct AvatarChip: View {
    let letter: String
    let color: Color
    var size: CGFloat = 34
    var speaking = false
    /// Humans keep initials; agents wear the Cline bot, told apart by color.
    var human = false
    var body: some View {
        ZStack {
            Circle().fill(color)
            if human {
                Text(letter)
                    .font(.system(size: size * 0.36, weight: .bold))
                    .foregroundStyle(.white)
            } else {
                ClineBotShape()
                    .fill(style: FillStyle(eoFill: true))
                    .foregroundStyle(.white)
                    .frame(width: size * 0.58, height: size * 0.58)
            }
        }
        .frame(width: size, height: size)
        .overlay {
            if speaking {
                Circle().strokeBorder(DT.violet, lineWidth: 2).padding(-3.5)
            }
        }
    }
}

struct Waveform: View {
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @AppStorage("reduceMotion") private var appReduceMotion = false
    var color: Color
    var barCount = 6
    var height: CGFloat = 18
    private var reduced: Bool { systemReduceMotion || appReduceMotion }
    var body: some View {
        Group {
            if reduced {
                staticBars
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 20.0)) { context in
                    let t = context.date.timeIntervalSinceReferenceDate
                    HStack(alignment: .center, spacing: 2.5) {
                        ForEach(0..<barCount, id: \.self) { i in
                            let phase = t * 5.5 + Double(i) * 1.1
                            let h = height * (0.30 + 0.70 * abs(sin(phase)))
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(color)
                                .frame(width: 3, height: h)
                        }
                    }
                    .frame(height: height)
                }
            }
        }
        .accessibilityHidden(true)
    }

    private var staticBars: some View {
        HStack(alignment: .center, spacing: 2.5) {
            ForEach(0..<barCount, id: \.self) { i in
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(color)
                    .frame(width: 3, height: height * [0.45, 0.8, 1.0, 0.6, 0.85, 0.4][i % 6])
            }
        }
        .frame(height: height)
    }
}

struct HonestyDots: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        HStack(spacing: 16) {
            label("On device")
            label("You approve")
        }
    }
    private func label(_ s: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
            Text(s).scaledFont(12).foregroundStyle(DT.ink55(scheme))
        }
    }
}

struct PreviewChip: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
            Text("PREVIEW · DEMO SESSION")
                .tracking(1.1)
                .scaledFont(10, .bold)
                .foregroundStyle(DT.ink78(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(DT.surface(scheme))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(DT.hairline(scheme), lineWidth: 0.8))
    }
}

struct StateChip: View {
    @Environment(\.colorScheme) private var scheme
    let state: AgentState
    var body: some View {
        Group {
            switch state {
            case .working:
                HStack(spacing: 4.5) {
                    Circle().fill(DT.live(scheme)).frame(width: 5, height: 5)
                    Text(state.rawValue)
                }
                .foregroundStyle(DT.ink55(scheme))
                .padding(.horizontal, 9).padding(.vertical, 4.5)
                .background(DT.surface2(scheme))
            case .needsYou:
                Text(state.rawValue)
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 9).padding(.vertical, 4.5)
                    .background(DT.violet.opacity(0.10))
            case .stuck:
                Text(state.rawValue)
                    .foregroundStyle(DT.danger)
                    .padding(.horizontal, 9).padding(.vertical, 4.5)
                    .background(DT.danger.opacity(0.08))
            }
        }
        .scaledFont(11, .bold)
        .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
    }
}
