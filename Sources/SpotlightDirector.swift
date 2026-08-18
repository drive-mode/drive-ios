import SwiftUI
import UIKit

/// One hue per beat kind — the progress rail wears these so a skimmer can see
/// at a glance where the plans, diagrams, code, tests, and results live and
/// jump straight to what they want. (Danger red is reserved for future
/// bug/failure beats.)
extension BeatKind {
    var tint: Color {
        switch self {
        case .plan: return Color(hex: 0xB98AFF)      // steering: violet family
        case .decision: return Color(hex: 0x9F58FA)
        case .diagram: return Color(hex: 0x7DB0FF)   // structure: blue
        case .edit: return Color(hex: 0x4ADE80)      // code: green
        case .command: return Color(hex: 0x2DD4BF)   // runs: teal
        case .test: return Color(hex: 0xA3E635)      // verification: lime
        case .metric: return Color(hex: 0xFFC55C)    // results: amber
        }
    }
}

/// Program clock math, shared by the live Presenter stage (store-driven) and the
/// replay player (self-clocked).
enum Director {
    /// Beat index and 0..1 progress for an elapsed time into a looping program.
    static func position(beats: [Beat], elapsed: TimeInterval) -> (index: Int, progress: Double) {
        let total = beats.reduce(0) { $0 + $1.duration }
        guard total > 0 else { return (0, 0) }
        var t = elapsed.truncatingRemainder(dividingBy: total)
        if t < 0 { t += total }
        var acc: TimeInterval = 0
        for (i, beat) in beats.enumerated() {
            if t < acc + beat.duration {
                return (i, (t - acc) / beat.duration)
            }
            acc += beat.duration
        }
        return (beats.count - 1, 1)
    }
}

/// The Presenter stage. The Director choreographs typed work events into
/// beats, while a temporary Presenter title grants an agent publishing rights.
struct PresenterStage: View {
    @EnvironmentObject var store: AppStore
    /// Theater = landscape immersion: content edge-to-edge, chrome floats.
    var theater = false

    var body: some View {
        // Two cadences. Only the rail fill and the stage animation need
        // 30fps — they live in their own TimelineView leaves. The chrome
        // (header, caption, gestures, VoiceOver value) only changes at beat
        // boundaries, so it rides a 4 Hz tick: boundaries land within 250ms
        // without rebuilding the whole hierarchy thirty times a second.
        TimelineView(.periodic(from: .now, by: 0.25)) { chrome in
            let index = store.beats.isEmpty ? 0 : store.directorPosition(at: chrome.date).index
            let beat = store.beats.isEmpty ? nil : store.beats[index]
            ZStack {
                VStack(alignment: .leading, spacing: 0) {
                    TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                        let pos = store.directorPosition(at: context.date)
                        ProgressRail(beats: store.beats, index: pos.index, progress: pos.progress)
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    if let beat {
                        BeatHeader(beat: beat)
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                    TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                        let pos = store.directorPosition(at: context.date)
                        if !store.beats.isEmpty {
                            BeatStage(beat: store.beats[pos.index], t: pos.progress)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                // Story scrub zones (under the floating chrome, over the stage)
                HStack(spacing: 0) {
                    Color.clear.contentShape(Rectangle())
                        .onTapGesture { store.skipToPreviousBeat() }
                        .frame(maxWidth: .infinity)
                    Color.clear.contentShape(Rectangle())
                        .onTapGesture { store.skipToNextBeat() }
                        .frame(maxWidth: .infinity)
                        .frame(maxWidth: .infinity)
                }
                .padding(.top, 56) // keep the rail tappable-free zone minimal

                if let beat {
                    VStack {
                        Spacer()
                        BeatCaption(beat: beat, compact: theater)
                            .padding(.horizontal, theater ? 16 : 12)
                            .padding(.bottom, theater ? 14 : 12)
                            .frame(maxWidth: .infinity, alignment: theater ? .leading : .center)
                    }
                    .allowsHitTesting(false)
                }
            }
            // Swipe between beats like pages; taps on the thirds still work.
            .simultaneousGesture(
                DragGesture(minimumDistance: 30)
                    .onEnded { v in
                        let w = v.translation.width
                        guard abs(w) > 50, abs(w) > abs(v.translation.height) * 1.5 else { return }
                        if w < 0 { store.skipToNextBeat() } else { store.skipToPreviousBeat() }
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
            )
            // VoiceOver: one element narrating the program; swipe up/down scrubs.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Presenter stage")
            .accessibilityValue(beat.map { "Beat \(index + 1) of \(store.beats.count). \($0.kind.rawValue): \($0.title). \($0.director) directing. \($0.caption)" } ?? "No program yet")
            .accessibilityHint("Swipe up or down to move between beats")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: store.skipToNextBeat()
                case .decrement: store.skipToPreviousBeat()
                @unknown default: break
                }
            }
        }
        .background(DT.well)
        .clipShape(RoundedRectangle(cornerRadius: theater ? 0 : DT.rHero, style: .continuous))
        .overlay {
            if !theater {
                RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
                    .strokeBorder(.white.opacity(0.10), lineWidth: 0.8)
            }
        }
    }
}

// MARK: - Chrome

/// Kind-colored rail: the program's table of contents. Watched beats read at
/// full tint, the current one fills live, upcoming ones sit dimmed — so
/// "where are the tests?" is a glance, not a scrub.
struct ProgressRail: View {
    let beats: [Beat]
    let index: Int
    let progress: Double
    var body: some View {
        HStack(alignment: .center, spacing: 4) {
            ForEach(beats.indices, id: \.self) { i in
                let tint = beats[i].kind.tint
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(tint.opacity(0.30))
                        if i < index {
                            Capsule().fill(tint.opacity(0.95))
                        } else if i == index {
                            Capsule().fill(tint)
                                .frame(width: max(3, geo.size.width * progress))
                        }
                    }
                }
                .frame(height: i == index ? 5 : 3.5)
            }
        }
        .frame(height: 5)
        .accessibilityHidden(true)
    }
}

struct BeatHeader: View {
    let beat: Beat
    var body: some View {
        HStack(spacing: 9) {
            Text(beat.kind.rawValue)
                .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                .tracking(0.8)
                .foregroundStyle(kindColor)
                .padding(.horizontal, 7).padding(.vertical, 3.5)
                .background(kindColor.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            Text(beat.title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
            Spacer(minLength: 0)
            HStack(spacing: 5) {
                Circle().fill(beat.directorColor == DemoData.coder ? .white : beat.directorColor)
                    .frame(width: 6, height: 6)
                Text(beat.director)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
            }
        }
    }

    private var kindColor: Color { beat.kind.tint }
}

struct BeatCaption: View {
    let beat: Beat
    var compact: Bool
    var body: some View {
        HStack(spacing: 11) {
            Waveform(color: DT.live(.dark), barCount: compact ? 4 : 5, height: 14)
            (Text(beat.director).bold().foregroundColor(DT.violetText(.dark))
             + Text(" — \(beat.caption)").foregroundColor(.white.opacity(0.80)))
                .font(.system(size: 12.5))
                .lineLimit(2)
        }
        .padding(.horizontal, 13).padding(.vertical, 10)
        .background(DT.raised.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
            .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
        .frame(maxWidth: compact ? 420 : .infinity, alignment: .leading)
    }
}

// MARK: - Stage

struct BeatStage: View {
    let beat: Beat
    let t: Double
    var body: some View {
        Group {
            if beat.steps.isEmpty {
                // Wire beats carry structure (kind/title/director/caption);
                // rich stage content arrives via relatedEventIds later.
                VStack(spacing: 12) {
                    Image(systemName: wireSymbol)
                        .font(.system(size: 34, weight: .light))
                        .foregroundStyle(beat.kind.tint)
                        .opacity(0.5 + 0.5 * min(1, t * 3))
                    Text(beat.title)
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("Directed live · \(beat.director)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.45))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                stage
            }
        }
        .frame(maxWidth: 560)
    }

    private var wireSymbol: String {
        switch beat.kind {
        case .plan: return "list.bullet.rectangle"
        case .diagram: return "point.3.connected.trianglepath.dotted"
        case .edit: return "plus.forwardslash.minus"
        case .command: return "terminal"
        case .test: return "checkmark.diamond"
        case .decision: return "signpost.right"
        case .metric: return "chart.bar.xaxis"
        }
    }

    @ViewBuilder
    private var stage: some View {
        Group {
            switch beat.kind {
            case .plan: PlanBeat(beat: beat, t: t)
            case .diagram: DiagramBeat(beat: beat, t: t)
            case .edit: EditBeat(beat: beat, t: t)
            case .command: CommandBeat(beat: beat, t: t)
            case .test: TestBeat(beat: beat, t: t)
            case .decision: DecisionBeat(beat: beat, t: t)
            case .metric: MetricBeat(beat: beat, t: t)
            }
        }
        .frame(maxWidth: 560)
    }
}

struct PlanBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(beat.steps.indices, id: \.self) { i in
                let doneCount = beat.accent.count
                let isDone = i < doneCount || (i == doneCount && t > 0.72)
                let isActive = i == doneCount && !isDone
                HStack(spacing: 11) {
                    ZStack {
                        Circle()
                            .strokeBorder(isDone ? DT.live(.dark) : .white.opacity(isActive ? 0.6 : 0.25), lineWidth: 1.5)
                            .background(Circle().fill(isDone ? DT.live(.dark).opacity(0.18) : .clear))
                        if isDone {
                            Image(systemName: "checkmark")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(DT.live(.dark))
                        } else if isActive {
                            Circle().fill(DT.violet).frame(width: 7, height: 7)
                                .opacity(0.4 + 0.6 * abs(sin(t * 12)))
                        }
                    }
                    .frame(width: 21, height: 21)
                    Text(beat.steps[i])
                        .font(.system(size: 14.5, weight: isActive ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(isDone || isActive ? 0.92 : 0.45))
                    Spacer(minLength: 0)
                    if isActive {
                        Text("NOW")
                            .font(.system(size: 8.5, weight: .heavy, design: .monospaced))
                            .foregroundStyle(DT.violetText(.dark))
                    }
                }
                .opacity(revealOpacity(i: i))
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 8)
    }

    private func revealOpacity(i: Int) -> Double {
        let appear = Double(i) * 0.08
        return t > appear ? 1 : 0
    }
}

struct DiagramBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        GeometryReader { geo in
            let horizontal = geo.size.width > geo.size.height
            let pulseIndex = t * Double(beat.steps.count - 1)
            Group {
                if horizontal {
                    HStack(spacing: 0) { chain(pulseIndex: pulseIndex, horizontal: true) }
                } else {
                    VStack(spacing: 0) { chain(pulseIndex: pulseIndex, horizontal: false) }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func chain(pulseIndex: Double, horizontal: Bool) -> some View {
        ForEach(beat.steps.indices, id: \.self) { i in
            let isNew = beat.accent.contains(i)
            let lit = pulseIndex >= Double(i) - 0.5
            node(beat.steps[i], isNew: isNew, lit: lit)
            if i < beat.steps.count - 1 {
                connector(active: pulseIndex > Double(i), horizontal: horizontal)
            }
        }
    }

    private func node(_ label: String, isNew: Bool, lit: Bool) -> some View {
        Text(label)
            .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
            .foregroundStyle(isNew ? DT.violetText(.dark) : .white.opacity(lit ? 0.92 : 0.5))
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(isNew ? DT.violet.opacity(0.16) : DT.raised)
            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous)
                .strokeBorder(isNew ? DT.violet.opacity(lit ? 0.9 : 0.5) : .white.opacity(lit ? 0.30 : 0.12),
                              lineWidth: isNew ? 1.4 : 0.8))
            .shadow(color: isNew && lit ? DT.violet.opacity(0.35) : .clear, radius: 10)
    }

    private func connector(active: Bool, horizontal: Bool) -> some View {
        Group {
            if horizontal {
                Rectangle().fill(active ? DT.live(.dark).opacity(0.8) : .white.opacity(0.15))
                    .frame(width: 22, height: 1.5)
            } else {
                Rectangle().fill(active ? DT.live(.dark).opacity(0.8) : .white.opacity(0.15))
                    .frame(width: 1.5, height: 16)
            }
        }
    }
}

struct EditBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        let visible = Int((t * 1.35) * Double(beat.steps.count)) + 1
        VStack(alignment: .leading, spacing: 5) {
            ForEach(beat.steps.indices, id: \.self) { i in
                if i < visible {
                    Text(beat.steps[i])
                        .font(.system(size: 13.5, design: .monospaced))
                        .foregroundStyle(beat.steps[i].hasPrefix("+") ? DT.live(.dark) : .white.opacity(0.55))
                        .transition(.opacity)
                }
            }
            if visible <= beat.steps.count {
                Rectangle().fill(DT.live(.dark)).frame(width: 7, height: 15)
                    .opacity(abs(sin(t * 14)))
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
        .animation(.easeOut(duration: 0.18), value: visible)
    }
}

struct CommandBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        let visible = Int((t * 1.35) * Double(beat.steps.count)) + 1
        VStack(alignment: .leading, spacing: 6) {
            ForEach(beat.steps.indices, id: \.self) { i in
                if i < visible {
                    Text(beat.steps[i])
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(i == 0 ? .white.opacity(0.92) : .white.opacity(0.5))
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
        .animation(.easeOut(duration: 0.18), value: visible)
    }
}

struct TestBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        let done = Int(t * Double(beat.steps.count) * 1.15)
        VStack(alignment: .leading, spacing: 11) {
            ForEach(beat.steps.indices, id: \.self) { i in
                HStack(spacing: 10) {
                    if i < done {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(DT.live(.dark))
                    } else if i == done {
                        Circle().fill(DT.live(.dark)).frame(width: 7, height: 7)
                            .opacity(0.35 + 0.65 * abs(sin(t * 14)))
                            .frame(width: 15)
                    } else {
                        Circle().strokeBorder(.white.opacity(0.2), lineWidth: 1.2)
                            .frame(width: 15, height: 15)
                    }
                    Text(beat.steps[i])
                        .font(.system(size: 13.5, design: .monospaced))
                        .foregroundStyle(.white.opacity(i <= done ? 0.85 : 0.4))
                    Spacer(minLength: 0)
                    if i < done {
                        Text("PASS")
                            .font(.system(size: 9, weight: .heavy, design: .monospaced))
                            .foregroundStyle(DT.live(.dark).opacity(0.85))
                    }
                }
            }
            Spacer(minLength: 0)
            HStack {
                Text("\(min(done, beat.steps.count))/\(beat.steps.count) passing")
                    .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(DT.live(.dark))
                Spacer()
            }
        }
        .padding(.top, 8)
    }
}

struct DecisionBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(beat.steps.indices, id: \.self) { i in
                let chosen = beat.accent.contains(i) && t > 0.5
                let dimmed = !beat.accent.contains(i) && t > 0.5
                HStack(spacing: 11) {
                    Image(systemName: chosen ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 17))
                        .foregroundStyle(chosen ? DT.violetText(.dark) : .white.opacity(0.3))
                    Text(beat.steps[i])
                        .font(.system(size: 14.5, weight: chosen ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(chosen ? 0.95 : dimmed ? 0.35 : 0.7))
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 14).padding(.vertical, 13)
                .background(chosen ? DT.violet.opacity(0.14) : DT.raised)
                .clipShape(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: DT.rCard, style: .continuous)
                    .strokeBorder(chosen ? DT.violet.opacity(0.8) : .white.opacity(0.10),
                                  lineWidth: chosen ? 1.4 : 0.8))
                .animation(.easeOut(duration: 0.3), value: chosen)
            }
            Text("Decisions are narrated, logged, and reversible from history.")
                .font(.system(size: 10.5))
                .foregroundStyle(.white.opacity(0.35))
                .padding(.top, 2)
            Spacer(minLength: 0)
        }
        .padding(.top, 8)
    }
}

struct MetricBeat: View {
    let beat: Beat
    let t: Double
    var body: some View {
        let grow = min(1, t * 1.8)
        VStack(alignment: .leading, spacing: 16) {
            ForEach(beat.steps.indices, id: \.self) { i in
                let parts = beat.steps[i].split(separator: "|")
                if parts.count == 2, let value = Double(parts[1]) {
                    let isAfter = beat.accent.contains(i)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(String(parts[0]))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.6))
                            Spacer()
                            Text("\(Int(value))ms")
                                .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                                .foregroundStyle(isAfter ? DT.live(.dark) : .white.opacity(0.75))
                        }
                        GeometryReader { geo in
                            Capsule()
                                .fill(isAfter ? AnyShapeStyle(DT.live(.dark)) : AnyShapeStyle(.white.opacity(0.35)))
                                .frame(width: max(4, geo.size.width * (value / 41.0) * grow))
                        }
                        .frame(height: 8)
                        .background(Capsule().fill(.white.opacity(0.10)))
                    }
                } else {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(DT.live(.dark))
                        Text(beat.steps[i])
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    .opacity(t > 0.5 ? 1 : 0)
                    .animation(.easeOut(duration: 0.3), value: t > 0.5)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 10)
    }
}
