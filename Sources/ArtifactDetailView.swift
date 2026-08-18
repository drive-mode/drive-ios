import SwiftUI
import UIKit

/// One artifact, opened: replays play their directed beat program right
/// here, diffs read as diffs, everything carries its lineage and lifecycle.
/// Phones get the directed summary; the full artifact opens on desktop.
struct ArtifactDetailView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    let artifactId: String

    private var artifact: Artifact? {
        store.artifacts.first { $0.id == artifactId }
    }

    var body: some View {
        ScrollView {
            if let artifact {
                VStack(alignment: .leading, spacing: 0) {
                    header(artifact).padding(.top, 8)

                    switch artifact.kind {
                    case .replay:
                        ReplayPlayer(beats: store.beats)
                            .frame(height: 360)
                            .padding(.top, 14)
                        Text("The room's program, replayed — the same beats the session directed live.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink55(scheme))
                            .padding(.top, 8)
                    case .diff:
                        DiffCard(lines: DemoData.baseDiff)
                            .padding(.top, 14)
                        Text("Directed summary — the full diff opens on desktop.")
                            .font(.system(size: 10.5))
                            .foregroundStyle(DT.ink55(scheme))
                            .padding(.top, 8)
                    default:
                        previewCard(artifact).padding(.top, 14)
                    }

                    metadata(artifact).padding(.top, 18)
                    lifecycle(artifact).padding(.top, 18)
                    actions(artifact).padding(.top, 18)
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 20)
            }
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(artifact?.kind.rawValue ?? "Artifact")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func header(_ artifact: Artifact) -> some View {
        HStack(spacing: 12) {
            Image(systemName: artifact.kind.symbol)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(artifact.kind.tint)
                .frame(width: 42, height: 42)
                .background(artifact.kind.tint.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(artifact.title)
                    .scaledFont(17, .heavy)
                    .foregroundStyle(DT.ink(scheme))
                Text(artifact.meta)
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundStyle(artifact.kind.tint)
            }
            Spacer()
        }
    }

    private func previewCard(_ artifact: Artifact) -> some View {
        VStack(spacing: 12) {
            Image(systemName: artifact.kind.symbol)
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(artifact.kind.tint)
            Text(artifact.meta)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(DT.ink78(scheme))
            Text("Directed summary — the full \(artifact.kind.rawValue.lowercased()) opens on desktop.")
                .font(.system(size: 10.5))
                .foregroundStyle(DT.ink55(scheme))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
        .background(DT.surface(scheme))
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
            .strokeBorder(artifact.kind.tint.opacity(0.22), lineWidth: 0.8))
    }

    private func metadata(_ artifact: Artifact) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow("LINEAGE")
            VStack(spacing: 0) {
                metaRow("Project", artifact.room)
                divider
                metaRow("Repository", artifact.repo)
                divider
                HStack {
                    Text("Produced by").scaledFont(14)
                    Spacer()
                    HStack(spacing: 7) {
                        AvatarChip(letter: String(artifact.agentName.prefix(1)),
                                   color: artifact.agentColor, size: 20)
                        Text(artifact.agentName)
                            .scaledFont(13.5)
                            .foregroundStyle(DT.ink55(scheme))
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 44)
                divider
                metaRow("Day", "\(artifact.day) · \(artifact.age) ago")
                divider
                metaRow("Size", artifact.sizeLabel)
            }
            .card()
            .padding(.top, 8)
        }
    }

    private var divider: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).scaledFont(14)
            Spacer()
            Text(value)
                .scaledFont(13.5)
                .foregroundStyle(DT.ink55(scheme))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 44)
    }

    /// Purpose decides lifespan — and the purpose is yours to change.
    private func lifecycle(_ artifact: Artifact) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow("LIFECYCLE")
            HStack(spacing: 8) {
                lifeChip("Keeps", symbol: "infinity",
                         active: artifact.life.isPermanent) {
                    store.setArtifactLife(artifact.id, .permanent)
                }
                lifeChip("7 days", symbol: "hourglass",
                         active: artifact.life == .ephemeral(daysLeft: 7)) {
                    store.setArtifactLife(artifact.id, .ephemeral(daysLeft: 7))
                }
                lifeChip("30 days", symbol: "hourglass.bottomhalf.filled",
                         active: artifact.life == .ephemeral(daysLeft: 30)) {
                    store.setArtifactLife(artifact.id, .ephemeral(daysLeft: 30))
                }
                Spacer()
            }
            .padding(.top, 8)
            Text(artifact.life.isPermanent
                 ? "Keeps until superseded."
                 : "Files to the archive in \(artifact.life.badge.replacingOccurrences(of: " left", with: "")) — searchable, never deleted.")
                .font(.system(size: 10.5))
                .foregroundStyle(DT.ink55(scheme))
                .padding(.top, 8)
        }
    }

    private func lifeChip(_ label: String, symbol: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 10, weight: .semibold))
                Text(label).font(.system(size: 12.5, weight: .bold))
            }
            .foregroundStyle(active ? .white : DT.ink78(scheme))
            .padding(.horizontal, 13).padding(.vertical, 9)
            .background(active ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(active ? .clear : DT.hairline(scheme), lineWidth: 0.8))
        }
        .buttonStyle(Pressable())
    }

    private func actions(_ artifact: Artifact) -> some View {
        HStack(spacing: 9) {
            Button { store.joinCall() } label: {
                HStack(spacing: 7) {
                    Image(systemName: "waveform")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Open in session")
                        .font(.system(size: 13.5, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(DT.heroGradient)
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            }
            .buttonStyle(Pressable())

            ShareLink(item: "\(artifact.title) — \(artifact.meta) · \(artifact.room)") {
                HStack(spacing: 7) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Share")
                        .font(.system(size: 13.5, weight: .bold))
                }
                .foregroundStyle(DT.violetText(scheme))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(DT.violet.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
            }
            .buttonStyle(Pressable())
        }
    }
}

// MARK: - Replay player

/// A self-clocked directed program: same beats, same renderers as the live
/// Presenter stage, but the clock starts when the player appears. Tap the thirds
/// or swipe to scrub; the program loops.
struct ReplayPlayer: View {
    let beats: [Beat]
    @State private var start = Date()
    @State private var skew: TimeInterval = 0

    private func position(at now: Date) -> (index: Int, progress: Double) {
        Director.position(beats: beats, elapsed: now.timeIntervalSince(start) + skew)
    }

    private func skipForward() {
        let (i, p) = position(at: Date())
        guard !beats.isEmpty else { return }
        let next = (i + 1) % beats.count
        skew += beats[i].duration * (1 - p) + beats[next].duration * 0.55
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func skipBack() {
        let (i, p) = position(at: Date())
        guard !beats.isEmpty else { return }
        if p > 0.2 {
            skew -= beats[i].duration * p - 0.01
        } else {
            let prev = (i - 1 + beats.count) % beats.count
            skew -= beats[i].duration * p + beats[prev].duration - 0.01
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { chrome in
            let index = beats.isEmpty ? 0 : position(at: chrome.date).index
            let beat = beats.isEmpty ? nil : beats[index]
            ZStack {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                            let pos = position(at: context.date)
                            ProgressRail(beats: beats, index: pos.index, progress: pos.progress)
                        }
                        Text("REPLAY")
                            .font(.system(size: 8.5, weight: .heavy, design: .monospaced))
                            .tracking(0.8)
                            .foregroundStyle(.white.opacity(0.45))
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    if let beat {
                        BeatHeader(beat: beat)
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                    TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                        let pos = position(at: context.date)
                        if !beats.isEmpty {
                            BeatStage(beat: beats[pos.index], t: pos.progress)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                HStack(spacing: 0) {
                    Color.clear.contentShape(Rectangle())
                        .onTapGesture { skipBack() }
                        .frame(maxWidth: .infinity)
                    Color.clear.contentShape(Rectangle())
                        .onTapGesture { skipForward() }
                        .frame(maxWidth: .infinity)
                }
                .padding(.top, 44)
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 30)
                    .onEnded { v in
                        let w = v.translation.width
                        guard abs(w) > 50, abs(w) > abs(v.translation.height) * 1.5 else { return }
                        if w < 0 { skipForward() } else { skipBack() }
                    }
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Replay")
            .accessibilityValue(beat.map { "Beat \(index + 1) of \(beats.count). \($0.kind.rawValue): \($0.title)" } ?? "Empty program")
            .accessibilityHint("Swipe up or down to move between beats")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: skipForward()
                case .decrement: skipBack()
                @unknown default: break
                }
            }
        }
        .background(DT.well)
        .environment(\.colorScheme, .dark)
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
            .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
    }
}

// MARK: - Diff view

struct DiffCard: View {
    let lines: [DiffLine]

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(lines) { line in
                Text(line.text)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(line.added ? DT.live(.dark) : Color.white.opacity(0.55))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 1)
                    .background(line.added ? DT.live(.dark).opacity(0.08) : .clear)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DT.well)
        .clipShape(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DT.rHero, style: .continuous)
            .strokeBorder(.white.opacity(0.10), lineWidth: 0.8))
    }
}
