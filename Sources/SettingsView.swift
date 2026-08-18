import SwiftUI

/// Configuration settings — how Drive behaves.
struct ConfigSettingsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme
    @AppStorage("appearance") private var appearance = "System"
    @AppStorage("reduceMotion") private var reduceMotion = false
    @AppStorage("micDefault") private var micDefault = "Muted"
    @AppStorage("talkGesture") private var talkGesture = "Hold to talk"
    @AppStorage("archive.autoFile") private var autoFile = true
    @AppStorage("archive.sweepAge") private var sweepAge = "Right away"
    @AppStorage("notify.approval") private var notifyApprovals = true
    @AppStorage("notify.blocked") private var notifyBlocked = true
    @AppStorage("notify.invite") private var notifyInvites = true
    @AppStorage("notify.ships") private var notifyShips = false
    @AppStorage("notify.product") private var notifyProduct = false
    @AppStorage("notify.quiet") private var quietHours = false
    @AppStorage("notify.quietFrom") private var quietFrom = 22 * 60
    @AppStorage("notify.quietTo") private var quietTo = 8 * 60
    @AppStorage("notify.escalation") private var escalation = "Do nothing"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("APPEARANCE")
                VStack(spacing: 0) {
                    HStack {
                        Text("Appearance").font(.system(size: 15))
                        Spacer()
                        Picker("", selection: $appearance) {
                            Text("System").tag("System")
                            Text("Light").tag("Light")
                            Text("Dark").tag("Dark")
                        }
                        .pickerStyle(.menu)
                        .tint(DT.ink55(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    HStack {
                        Text("Reduce motion").font(.system(size: 15))
                        Spacer()
                        Toggle("Reduce motion", isOn: $reduceMotion).labelsHidden().tint(DT.live(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                }
                .card()
                .padding(.top, 7)

                sectionLabel("VOICE").padding(.top, 20)
                VStack(spacing: 0) {
                    pickerRow("Mic default", selection: $micDefault, options: ["Muted", "Hot mic"])
                    hairline
                    pickerRow("Talk gesture", selection: $talkGesture, options: ["Hold to talk", "Tap to toggle"])
                }
                .card()
                .padding(.top, 7)
                footnote(micDefault == "Muted"
                         ? "Hold anywhere on the session strip to speak; release to send."
                         : "You're live when a session starts — tap the strip to mute.")

                sectionLabel("APPROVAL DEFAULTS").padding(.top, 20)
                VStack(spacing: 0) {
                    valueRow("New agents", value: "Edits need approval")
                    hairline
                    valueRow("Per-agent overrides", value: "Agents tab")
                }
                .card()
                .padding(.top, 7)
                footnote("Every edit is yours to allow — defaults only set where the ask happens.")

                sectionLabel("FOCUS & ARCHIVE").padding(.top, 20)
                VStack(spacing: 0) {
                    toggleRow("Auto-file quiet projects", isOn: $autoFile)
                    hairline
                    pickerRow("Sweep shipped tasks", selection: $sweepAge,
                              options: ["Right away", "After 3 days", "After 7 days"])
                    hairline
                    NavigationLink { NeverFileView() } label: {
                        valueRow("Never file", value: store.neverFileProjects.isEmpty
                                 ? "No exemptions"
                                 : "\(store.neverFileProjects.count) project\(store.neverFileProjects.count == 1 ? "" : "s")")
                    }
                    .buttonStyle(.plain)
                }
                .card()
                .padding(.top, 7)
                footnote("Filed work is never deleted — search finds it, restore brings it back. Exempt projects stay on the floor no matter how quiet.")

                sectionLabel("NOTIFICATIONS").padding(.top, 20)
                VStack(spacing: 0) {
                    toggleRow("Approvals", isOn: $notifyApprovals)
                    hairline
                    toggleRow("Blocked asks", isOn: $notifyBlocked)
                    hairline
                    toggleRow("Invitations", isOn: $notifyInvites)
                    hairline
                    toggleRow("Ships & streaks", isOn: $notifyShips)
                    hairline
                    toggleRow("Product news", isOn: $notifyProduct)
                    hairline
                    toggleRow("Quiet hours", isOn: $quietHours)
                    if quietHours {
                        HStack {
                            DatePicker("From", selection: timeBinding($quietFrom), displayedComponents: .hourAndMinute)
                                .labelsHidden()
                            Image(systemName: "arrow.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(DT.ink35(scheme))
                            DatePicker("To", selection: timeBinding($quietTo), displayedComponents: .hourAndMinute)
                                .labelsHidden()
                            Spacer()
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    }
                    hairline
                    pickerRow("If unanswered", selection: $escalation,
                              options: ["Do nothing", "Nudge after 10m", "Escalate to Slack"])
                    hairline
                    Button { NotificationManager.shared.sendTestReminder() } label: {
                        HStack {
                            Text("Send a test reminder").scaledFont(15)
                                .foregroundStyle(DT.violetText(scheme))
                            Spacer()
                            Image(systemName: "bell.badge")
                                .font(.system(size: 13))
                                .foregroundStyle(DT.ink35(scheme))
                        }
                        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .card()
                .padding(.top, 7)
                footnote(escalation == "Escalate to Slack"
                         ? "Slack escalation arrives with the Slack connection — the preference applies the moment it does."
                         : "Push arrives with the hub connection — these choices apply the moment it does. Approvals and blocked asks break through quiet hours only if you let them.")

                FeedbackSettingsSection().padding(.top, 20)

                sectionLabel("WIRE").padding(.top, 20)
                VStack(spacing: 0) {
                    HStack {
                        Text("Writer").scaledFont(15)
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(store.wireStatus.isLive ? DT.live(scheme) : DT.ink35(scheme))
                                .frame(width: 6, height: 6)
                            Text(store.wireStatus.label)
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundStyle(DT.ink55(scheme))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    valueRow("URL", value: store.writerURL)
                    hairline
                    HStack {
                        Text("Intent").scaledFont(15)
                        Spacer()
                        Text("\(store.intent.diagnostics) · \(store.preheat.diagnostics)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(DT.ink55(scheme))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                }
                .card()
                .padding(.top, 7)
                footnote(store.wireStatus.isLive
                         ? "Tasks, artifacts, and the session program are coming off the durable log."
                         : "Start it: DRIVEMODE_HTTP_PORT=4600 bun run writer — demo data until then.")

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Configuration")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }
    private func sectionLabel(_ s: String) -> some View {
        Eyebrow(s).padding(.leading, 14).padding(.top, 8)
    }
    private func valueRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Text(value).scaledFont(14).foregroundStyle(DT.ink55(scheme))
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
        .contentShape(Rectangle())
    }
    private func pickerRow(_ label: String, selection: Binding<String>, options: [String]) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Picker(label, selection: selection) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .tint(DT.ink55(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
    }
    private func toggleRow(_ label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            Toggle(label, isOn: isOn).labelsHidden().tint(DT.live(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
    }
    /// Quiet-hours storage is minutes-from-midnight; the pickers speak Date.
    private func timeBinding(_ minutes: Binding<Int>) -> Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(bySettingHour: minutes.wrappedValue / 60,
                                      minute: minutes.wrappedValue % 60,
                                      second: 0, of: Date()) ?? Date()
            },
            set: { date in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
                minutes.wrappedValue = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
            })
    }
    private func footnote(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11))
            .foregroundStyle(DT.ink55(scheme))
            .padding(.horizontal, 14)
            .padding(.top, 7)
    }
}

/// Projects exempt from every auto-file path — added from a project card's
/// long-press, removed here.
struct NeverFileView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("These projects stay on the floor no matter how quiet they get. Add one by long-pressing its card in Tasks.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(DT.ink55(scheme))
                    .padding(.top, 8)

                if store.neverFileProjects.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "pin.slash")
                            .font(.system(size: 24, weight: .light))
                            .foregroundStyle(DT.ink35(scheme))
                        Text("No exemptions yet")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                } else {
                    LazyVStack(spacing: 9) {
                        ForEach(store.neverFileProjects.sorted(), id: \.self) { projectId in
                            HStack(spacing: 11) {
                                Image(systemName: "archivebox.circle")
                                    .font(.system(size: 15))
                                    .foregroundStyle(DT.violetText(scheme))
                                Text(projectId)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(DT.ink(scheme))
                                    .lineLimit(1)
                                Spacer()
                                Button { store.toggleNeverFile(projectId) } label: {
                                    Text("Remove")
                                        .font(.system(size: 12.5, weight: .bold))
                                        .foregroundStyle(DT.ink55(scheme))
                                        .padding(.horizontal, 12).padding(.vertical, 7)
                                        .background(DT.surface2(scheme))
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(Pressable())
                            }
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .card()
                        }
                    }
                    .padding(.top, 14)
                }
                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Never file")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Personal settings — privacy honesty and account.
struct PrivacyAccountView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("PRIVACY")
                VStack(spacing: 0) {
                    HStack {
                        Text("Transcripts").font(.system(size: 15))
                        Spacer()
                        HStack(spacing: 6) {
                            Circle().fill(DT.live(scheme)).frame(width: 6, height: 6)
                            Text("Never stored").font(.system(size: 14)).foregroundStyle(DT.ink55(scheme))
                        }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    valueRow("Work events", value: "On-device log")
                }
                .card()
                .padding(.top, 7)
                footnote("Conversation stays in memory. Nothing uploads outside a live session.")

                sectionLabel("POLICIES").padding(.top, 20)
                VStack(spacing: 0) {
                    NavigationLink { PrivacyPolicyView() } label: {
                        valueRow("Privacy policy", value: "v0.3")
                    }
                    .buttonStyle(.plain)
                    hairline
                    NavigationLink { DataPolicyView() } label: {
                        valueRow("Data policy", value: "v0.3")
                    }
                    .buttonStyle(.plain)
                    hairline
                    NavigationLink { FeedbackPolicyView() } label: {
                        valueRow("Feedback mode policy", value: "v0.3")
                    }
                    .buttonStyle(.plain)
                }
                .card()
                .padding(.top, 7)
                footnote("Plain language, versioned — widening any collection re-asks for consent.")

                sectionLabel("ACCOUNT").padding(.top, 20)
                VStack(spacing: 0) {
                    HStack {
                        Text("Signed in").font(.system(size: 15))
                        Spacer()
                        Text(verbatim: "harrison@quant-h2.com")
                            .font(.system(size: 13))
                            .foregroundStyle(DT.ink55(scheme))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                    hairline
                    valueRow("Invite links", value: "")
                    hairline
                    HStack {
                        Text("Sign out").font(.system(size: 15)).foregroundStyle(DT.danger)
                        Spacer()
                    }
                    .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
                }
                .card()
                .padding(.top, 7)

                Text("Drive 0.2 · MC1 preview")
                    .font(.system(size: 11))
                    .foregroundStyle(DT.ink35(scheme))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 32)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 20)
        }
        .background(DT.page(scheme).ignoresSafeArea())
        .navigationTitle("Privacy & account")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hairline: some View {
        Rectangle().fill(DT.hairline(scheme)).frame(height: 0.8).padding(.leading, 14)
    }
    private func sectionLabel(_ s: String) -> some View {
        Eyebrow(s).padding(.leading, 14).padding(.top, 8)
    }
    private func valueRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).scaledFont(15)
            Spacer()
            if !value.isEmpty {
                Text(value).scaledFont(14).foregroundStyle(DT.ink55(scheme))
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DT.ink35(scheme))
        }
        .padding(.horizontal, 14).padding(.vertical, 6).frame(minHeight: 46)
        .contentShape(Rectangle())
    }
    private func footnote(_ s: String) -> some View {
        Text(s)
            .font(.system(size: 11))
            .foregroundStyle(DT.ink55(scheme))
            .padding(.horizontal, 14)
            .padding(.top, 7)
    }
}
