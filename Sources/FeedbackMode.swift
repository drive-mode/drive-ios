import SwiftUI
import UIKit

// MARK: - Model

enum ExperimentStatus: String, Codable {
    case suggested, trialing, reverted, expired
}

/// A suggestion, and — when it maps to a presentation variant — its trial.
/// Trials carry a hard 7-day clock (docs/FEEDBACK-MODE.md).
struct Experiment: Identifiable, Codable, Equatable {
    let id: String
    var title: String
    var detail: String
    var surface: String
    var flag: String          // "" = suggestion only, no variant to try
    var status: ExperimentStatus
    var startedAt: Date?
    var expiresAt: Date?
    var sentAt: Date

    var daysLeft: Int? {
        guard status == .trialing, let end = expiresAt else { return nil }
        return max(0, Int(ceil(end.timeIntervalSince(Date()) / 86_400)))
    }

    var statusLine: String {
        switch status {
        case .suggested: return "Suggested · awaiting decision"
        case .trialing: return daysLeft.map { "Trial · \($0)d left on this device" } ?? "Trial"
        case .reverted: return "Trial ended by you · still in review"
        case .expired: return "Trial reached its week · still in review"
        }
    }

    static func load() -> [Experiment] {
        guard let data = UserDefaults.standard.data(forKey: "experiments.v1"),
              let decoded = try? JSONDecoder().decode([Experiment].self, from: data) else { return [] }
        return decoded
    }

    static func save(_ experiments: [Experiment]) {
        if let data = try? JSONEncoder().encode(experiments) {
            UserDefaults.standard.set(data, forKey: "experiments.v1")
        }
    }
}

/// The variants this build knows how to try. Presentation-only, always.
enum Variants {
    static let focusHome = "focus-home"
    static func matches(_ text: String, surface: String) -> String? {
        let folded = text.lowercased()
        let focusWords = ["focus", "minimal", "simpl", "hide", "quiet", "clean", "less"]
        if surface == "Home" || folded.contains("home"),
           focusWords.contains(where: { folded.contains($0) }) {
            return focusHome
        }
        return nil
    }
}

// MARK: - Floating bubble

/// The feedback door — only exists while the program is on AND this device
/// opted in. Quiet, corner, never over the session plane.
struct FeedbackBubble: View {
    @EnvironmentObject var store: AppStore
    @State private var chatOpen = false

    var body: some View {
        Button { chatOpen = true } label: {
            ZStack {
                Circle().fill(DT.heroGradient)
                ClineBotShape()
                    .fill(style: FillStyle(eoFill: true))
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
            }
            .frame(width: 46, height: 46)
            .shadow(color: DT.violet.opacity(0.4), radius: 10, y: 4)
        }
        .buttonStyle(Pressable())
        .accessibilityLabel("Design with Cline")
        .accessibilityHint("Suggest a feature — chat stays on this device")
        .sheet(isPresented: $chatOpen) {
            FeedbackChatView()
        }
    }
}

// MARK: - The design chat

private struct FBMessage: Identifiable {
    let id = UUID()
    let fromCline: Bool
    let text: String
}

/// Chat with Cline to shape a suggestion. The conversation is ephemeral —
/// in memory, gone when the sheet closes. Only the structured draft leaves,
/// and only on an explicit Send. (Cline here is a rule-based design
/// persona in the preview build; the honesty chrome says so.)
struct FeedbackChatView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [FBMessage] = [
        FBMessage(fromCline: true,
                  text: "What should Drive do better? Describe it like you'd tell a friend — I'll shape it into a proposal you can send.")
    ]
    @State private var input = ""
    @State private var surface = "Home"
    @State private var draftTitle: String?
    @State private var draftSummary = ""
    @State private var sent = false

    private let surfaces = ["Home", "Work", "Agents", "Tasks", "Profile", "Artifacts"]

    private var matchedFlag: String? {
        Variants.matches(draftSummary, surface: surface)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                honesty.padding(.top, 10)
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(messages) { message in
                            bubble(message)
                        }
                        if draftTitle != nil { draftCard.padding(.top, 6) }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
                }
                surfaceChips
                inputBar
            }
            .background(DT.page(scheme).ignoresSafeArea())
            .navigationTitle("Design with Cline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(22)
    }

    private var honesty: some View {
        HStack(spacing: 7) {
            Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
            Text("CHAT STAYS ON THIS DEVICE · ONLY WHAT YOU SEND LEAVES")
                .tracking(0.8)
                .scaledFont(8.5, .bold)
                .foregroundStyle(DT.ink55(scheme))
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(DT.surface2(scheme))
        .clipShape(Capsule())
    }

    private func bubble(_ message: FBMessage) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.fromCline {
                AvatarChip(letter: "C", color: DemoData.coder, size: 24)
            } else {
                Spacer(minLength: 40)
            }
            Text(message.text)
                .scaledFont(13.5)
                .foregroundStyle(message.fromCline ? DT.ink(scheme) : Color.white)
                .padding(.horizontal, 13).padding(.vertical, 10)
                .background(message.fromCline ? AnyShapeStyle(DT.surface(scheme)) : AnyShapeStyle(DT.heroGradient))
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .strokeBorder(message.fromCline ? DT.hairline(scheme) : .clear, lineWidth: 0.8))
            if message.fromCline { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: message.fromCline ? .leading : .trailing)
    }

    private var draftCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Eyebrow("YOUR PROPOSAL")
                Spacer()
                Text(surface)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(DT.violetText(scheme))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(DT.violet.opacity(0.10))
                    .clipShape(Capsule())
            }
            Text(draftTitle ?? "")
                .scaledFont(15, .heavy)
                .foregroundStyle(DT.ink(scheme))
            Text(draftSummary)
                .scaledFont(12.5)
                .foregroundStyle(DT.ink78(scheme))
                .lineLimit(6)

            if sent {
                HStack(spacing: 7) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(DT.live(scheme))
                    Text("Sent — track it in Settings → Feedback & experiments.")
                        .scaledFont(12, .semibold)
                        .foregroundStyle(DT.ink78(scheme))
                }
                .padding(.top, 4)
            } else {
                HStack(spacing: 9) {
                    Button { send(trial: false) } label: {
                        Text("Send suggestion")
                            .scaledFont(13, .bold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(DT.heroGradient)
                            .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                    }
                    .buttonStyle(Pressable())
                    if matchedFlag != nil {
                        Button { send(trial: true) } label: {
                            Text("Try it for a week")
                                .scaledFont(13, .bold)
                                .foregroundStyle(DT.violetText(scheme))
                                .frame(maxWidth: .infinity)
                                .frame(height: 40)
                                .background(DT.violet.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .padding(.top, 6)
                if matchedFlag != nil {
                    Text("This one maps to a built variant (Focus Home) — trying it flips the flag on this device only, for 7 days, revertible any time.")
                        .font(.system(size: 10))
                        .foregroundStyle(DT.ink55(scheme))
                }
            }
        }
        .padding(14)
        .card(radius: DT.rHero)
    }

    private var surfaceChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                Text("About:")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(DT.ink35(scheme))
                ForEach(surfaces, id: \.self) { option in
                    Button { surface = option } label: {
                        Text(option)
                            .scaledFont(12, .bold)
                            .foregroundStyle(surface == option ? .white : DT.ink78(scheme))
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(surface == option ? AnyShapeStyle(DT.violet) : AnyShapeStyle(DT.surface(scheme)))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(surface == option ? .clear : DT.hairline(scheme), lineWidth: 0.8))
                    }
                    .buttonStyle(Pressable())
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.vertical, 9)
    }

    private var inputBar: some View {
        HStack(spacing: 9) {
            TextField("Describe the feature you'd want…", text: $input, axis: .vertical)
                .scaledFont(14)
                .lineLimit(1...3)
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(DT.surface2(scheme))
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
            Button { receive() } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(input.trimmingCharacters(in: .whitespaces).isEmpty
                                ? AnyShapeStyle(DT.ink35(scheme)) : AnyShapeStyle(DT.heroGradient))
                    .clipShape(Circle())
            }
            .buttonStyle(Pressable())
            .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }

    private func receive() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        input = ""
        messages.append(FBMessage(fromCline: false, text: text))

        if draftTitle == nil {
            let words = text.split(separator: " ").prefix(7).joined(separator: " ")
            draftTitle = words.prefix(1).uppercased() + words.dropFirst()
            draftSummary = text
            let trialNote = Variants.matches(text, surface: surface) != nil
                ? " This one maps to a variant I can switch on right now if you want to feel it for a week."
                : ""
            messages.append(FBMessage(fromCline: true,
                text: "Got it — here's how I'd pitch it. Pick which screen it's about, add anything, then send.\(trialNote)"))
        } else {
            draftSummary += " " + text
            messages.append(FBMessage(fromCline: true, text: "Folded that in."))
        }
    }

    private func send(trial: Bool) {
        guard let title = draftTitle else { return }
        let flag = matchedFlag
        store.submitSuggestion(title: title, summary: draftSummary, surface: surface, flag: flag)
        if trial, flag != nil, let first = store.experiments.first {
            store.startTrial(first.id)
        }
        sent = true
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        Task {
            try? await Task.sleep(nanoseconds: 1_100_000_000)
            dismiss()
        }
    }
}

// MARK: - Settings section

/// FEEDBACK & EXPERIMENTS — both switches, the experiment list, and the
/// consent gate. Lives inside Configuration settings.
struct FeedbackSettingsSection: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @State private var consentSheet = false
    @State private var chatOpen = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow("FEEDBACK & EXPERIMENTS").padding(.leading, 14).padding(.top, 8)
            VStack(spacing: 0) {
                toggleRow("Feedback program", isOn: Binding(
                    get: { store.feedbackProgramOn },
                    set: { store.feedbackProgramOn = $0 }))
                hairline
                HStack {
                    Text("Feedback mode").scaledFont(15)
                    Spacer()
                    Toggle("Feedback mode", isOn: optInBinding)
                        .labelsHidden()
                        .tint(DT.live(scheme))
                        .disabled(!store.feedbackProgramOn)
                }
                .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)

                if store.feedbackAvailable {
                    hairline
                    Button { chatOpen = true } label: {
                        HStack(spacing: 10) {
                            AvatarChip(letter: "C", color: DemoData.coder, size: 24)
                            Text("Suggest something").scaledFont(15).foregroundStyle(DT.violetText(scheme))
                            Spacer()
                            Image(systemName: "bubble.left.and.text.bubble.right")
                                .font(.system(size: 13))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .padding(.horizontal, 14).frame(minHeight: 46)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                ForEach(store.experiments) { experiment in
                    hairline
                    experimentRow(experiment)
                }
            }
            .card()
            .padding(.top, 7)
            Text(store.feedbackProgramOn
                 ? "Two switches: the program (ours) and feedback mode (yours). Trials are look-and-feel only, live 7 days max on this device, and revert any time. Preview build: you hold both switches."
                 : "Program off — feedback UI hidden everywhere, trials reverted, opt-in cleared.")
                .font(.system(size: 11))
                .foregroundStyle(DT.ink55(scheme))
                .padding(.horizontal, 14)
                .padding(.top, 7)
        }
        .sheet(isPresented: $consentSheet) {
            FeedbackPolicyView(consenting: true) {
                store.feedbackOptIn = true
            }
        }
        .sheet(isPresented: $chatOpen) {
            FeedbackChatView()
        }
    }

    /// Turning ON routes through the policy screen; OFF is immediate.
    private var optInBinding: Binding<Bool> {
        Binding(
            get: { store.feedbackOptIn },
            set: { wantsOn in
                if wantsOn { consentSheet = true } else { store.feedbackOptIn = false }
            })
    }

    private func experimentRow(_ experiment: Experiment) -> some View {
        HStack(spacing: 10) {
            Image(systemName: experiment.status == .trialing ? "flask.fill" : "flask")
                .font(.system(size: 13))
                .foregroundStyle(experiment.status == .trialing ? DT.violetText(scheme) : DT.ink35(scheme))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(experiment.title).scaledFont(13.5, .semibold).lineLimit(1)
                Text(experiment.statusLine)
                    .font(.system(size: 10.5))
                    .foregroundStyle(experiment.status == .trialing ? DT.violetText(scheme) : DT.ink55(scheme))
            }
            Spacer()
            if experiment.status == .trialing {
                Button { store.endTrial(experiment.id) } label: {
                    Text("End trial")
                        .scaledFont(11.5, .bold)
                        .foregroundStyle(DT.ink55(scheme))
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(DT.surface2(scheme))
                        .clipShape(Capsule())
                }
                .buttonStyle(Pressable())
            } else if experiment.status != .trialing, !experiment.flag.isEmpty,
                      experiment.status == .suggested {
                Button { store.startTrial(experiment.id) } label: {
                    Text("Try for a week")
                        .scaledFont(11.5, .bold)
                        .foregroundStyle(DT.violetText(scheme))
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(DT.violet.opacity(0.10))
                        .clipShape(Capsule())
                }
                .buttonStyle(Pressable())
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 8).frame(minHeight: 48)
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }

    private func toggleRow(_ label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Toggle(label, isOn: isOn).labelsHidden().tint(DT.live(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
    }
}
