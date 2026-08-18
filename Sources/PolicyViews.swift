import SwiftUI

// MARK: - Shared rendering

private struct PolicyBlock: Identifiable {
    let id = UUID()
    let heading: String
    let points: [String]
}

private struct PolicyScreen: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let tagline: String
    let blocks: [PolicyBlock]
    let footer: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(tagline)
                    .scaledFont(13)
                    .lineSpacing(3)
                    .foregroundStyle(DT.ink78(scheme))
                    .padding(.top, 8)
                ForEach(blocks) { block in
                    VStack(alignment: .leading, spacing: 9) {
                        Eyebrow(block.heading.uppercased())
                        ForEach(block.points, id: \.self) { point in
                            HStack(alignment: .top, spacing: 9) {
                                Circle().fill(DT.violet.opacity(0.6))
                                    .frame(width: 5, height: 5)
                                    .padding(.top, 6)
                                Text(point)
                                    .scaledFont(12.5)
                                    .lineSpacing(2)
                                    .foregroundStyle(DT.ink78(scheme))
                            }
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    .padding(.top, 12)
                }
                Text(footer)
                    .font(.system(size: 10.5))
                    .foregroundStyle(DT.ink35(scheme))
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 18)
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Privacy policy

struct PrivacyPolicyView: View {
    var body: some View {
        PolicyScreen(
            title: "Privacy policy",
            tagline: "Drive runs on your device and talks only to infrastructure you point it at. No ads, no selling, and what you say out loud is never stored — by design, not by promise.",
            blocks: [
                PolicyBlock(heading: "Stays on your device", points: [
                    "Preferences, pins, profile layout, notification and archive choices.",
                    "Your intent model — the on-device guess at your next screen. Never uploaded, decays on its own.",
                    "Experiment flags and their 7-day timers.",
                ]),
                PolicyBlock(heading: "Never stored, anywhere", points: [
                    "Voice audio and transcripts — conversation lives in memory during a session and is gone when it ends. Wire schemas reject transcript-shaped payloads.",
                    "Your code, beyond the typed work events your agents deliberately publish. Events, never pixels; summaries, never files.",
                    "Prompts, tool allowlists, API keys, model identifiers — these never cross between phone and host.",
                ]),
                PolicyBlock(heading: "Leaves your device only when", points: [
                    "Work events sync with your writer/hub — the address you configure, your infrastructure, your log.",
                    "You explicitly send a feedback suggestion (see the Feedback mode policy).",
                    "You sign in — the email, nothing else.",
                    "You publish a showcase project or comment — explicit, friends-visible, and README/demo only: never source code.",
                ]),
                PolicyBlock(heading: "Deletion", points: [
                    "Deleting your account deletes account data and pending feedback submissions — real deletion, not archival.",
                    "Work events live in your own infrastructure; they're yours to keep or purge, which is the point.",
                ]),
            ],
            footer: "Draft v0.3 · changes are announced in the Product inbox; widening any collection re-asks for consent. Drive is for people 13 and older.")
    }
}

// MARK: - Data policy

struct DataPolicyView: View {
    var body: some View {
        PolicyScreen(
            title: "Data policy",
            tagline: "Every piece of data answers four questions — what it is, where it lives, whether it leaves, how long it stays. If a feature can't answer, it doesn't ship.",
            blocks: [
                PolicyBlock(heading: "A · Device-local", points: [
                    "Preferences, layouts, intent model, experiment timers. Never leave. Live until you change or delete them.",
                ]),
                PolicyBlock(heading: "B · Work events", points: [
                    "Typed room events your agents publish (tasks, artifacts, beats, invites). Flow only to your configured infrastructure; the in-app working set is capped and evicts shipped work first.",
                ]),
                PolicyBlock(heading: "C · Feedback submissions", points: [
                    "Only the structured suggestion you explicitly send: title, summary, surface, app version, active flags. Kept 90 days or until decided, then deleted.",
                ]),
                PolicyBlock(heading: "D · Account", points: [
                    "The sign-in email. Kept until account deletion.",
                ]),
                PolicyBlock(heading: "E · Social (preview)", points: [
                    "Published squares, READMEs, demos, comments, friend links. Publishing is explicit; unpublish removes; owners can delete any comment on their work.",
                ]),
                PolicyBlock(heading: "Rules that bind every class", points: [
                    "Explicit egress — nothing personal leaves without a deliberate action naming what's sent.",
                    "Typed or nothing — schema-validated payloads; transcript- and secret-shaped keys are rejected.",
                    "Experiments are presentation-only: a variant may restyle, never widen collection or soften an approval.",
                    "Work is archived; people are deleted. Personal deletion is immediate and real.",
                ]),
            ],
            footer: "Draft v0.3 · the engineering companion to the privacy policy. Full text ships in the repo (docs/DATA-POLICY.md).")
    }
}

// MARK: - Feedback mode policy (also the consent gate)

/// Read-only from Privacy & account; consent mode adds Agree / Not now and
/// is the only path that turns feedback mode on.
struct FeedbackPolicyView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    var consenting = false
    var onAgree: (() -> Void)? = nil

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PolicyScreen(
                    title: "Feedback mode policy",
                    tagline: "Feedback mode lets you design suggestions with Cline and try approved look-and-feel variants for up to a week. Here is the entire deal:",
                    blocks: [
                        PolicyBlock(heading: "Collected — only on Send", points: [
                            "The structured suggestion you explicitly send: title, summary, which screen it's about, app version, and which experiment flags are active.",
                            "Kept 90 days or until we decide (adopt or retire), whichever comes first.",
                        ]),
                        PolicyBlock(heading: "Never collected", points: [
                            "The chat itself — it's ephemeral, in memory, gone when the sheet closes. The transcripts-never-stored rule covers feedback chat too.",
                            "Voice, code, repo contents, screenshots, usage analytics.",
                        ]),
                        PolicyBlock(heading: "Trials — the one-week rule", points: [
                            "A trial is a look-and-feel flag on this device only, with a 7-day clock that enforces itself.",
                            "You can end a trial any time; we can retire a variant any time; day 7 ends it automatically.",
                            "Variants never widen data collection, bypass approvals, or touch privacy rules — that line is hard.",
                        ]),
                        PolicyBlock(heading: "The switches", points: [
                            "The program switch is ours; feedback mode is yours. Either off → no feedback UI, no trials, nothing collected.",
                            "If the program turns off, trials revert and your opt-in clears. Re-joining re-asks for this consent.",
                        ]),
                    ],
                    footer: consenting
                        ? "Agreeing turns feedback mode on for this device. Declining costs nothing."
                        : "Draft v0.3 · shown in full whenever feedback mode is turned on.")

                if consenting {
                    HStack(spacing: 9) {
                        Button {
                            dismiss()
                        } label: {
                            Text("Not now")
                                .scaledFont(14, .bold)
                                .foregroundStyle(DT.ink55(scheme))
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(DT.surface2(scheme))
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                        Button {
                            onAgree?()
                            dismiss()
                        } label: {
                            Text("Agree & turn on")
                                .scaledFont(14, .bold)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(DT.heroGradient)
                                .clipShape(RoundedRectangle(cornerRadius: DT.rControl, style: .continuous))
                        }
                        .buttonStyle(Pressable())
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(DT.page(scheme))
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(22)
    }
}
