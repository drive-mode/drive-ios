import Foundation
import UserNotifications

/// Local session notifications: planned sessions remind you (preview
/// timing), and the notification's Join action drops you straight into
/// the session. Honors the NOTIFICATIONS preferences; permission is asked
/// the first time something would actually fire — never at launch.
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    weak var store: AppStore?

    func configure(store: AppStore) {
        self.store = store
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let join = UNNotificationAction(
            identifier: "JOIN", title: "Join session", options: [.foreground])
        let later = UNNotificationAction(
            identifier: "LATER", title: "Later", options: [])
        let session = UNNotificationCategory(
            identifier: "SESSION", actions: [join, later],
            intentIdentifiers: [], options: [])
        center.setNotificationCategories([session])
    }

    /// Preview timing: "Now" fires shortly (so the flow is demonstrable);
    /// the labels say so. Real scheduling lands with the wire session
    /// registry (docs/WORK-PAGE.md P1).
    func scheduleSessionReminder(_ session: UpcomingSession) {
        let invitesOn = UserDefaults.standard.object(forKey: "notify.invite") == nil
            ? true : UserDefaults.standard.bool(forKey: "notify.invite")
        guard invitesOn else { return }

        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = session.title
            content.body = "\(session.people.joined(separator: " & ")) · \(session.when) — \(session.note)"
            content.categoryIdentifier = "SESSION"
            content.sound = .default
            let delay: TimeInterval
            switch session.when {
            case "Now": delay = 8
            case "Later today": delay = 45
            default: delay = 90
            }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            center.add(UNNotificationRequest(
                identifier: "session-\(session.id)", content: content, trigger: trigger))
        }
    }

    /// Settings → "Send a test reminder": asks for permission if needed and
    /// fires a real one a few seconds later, so anyone can prove their setup
    /// works without waiting for a planned session.
    func sendTestReminder() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Auth middleware — working session"
            content.body = "Maya & Cline · now — the gate review you asked for."
            content.categoryIdentifier = "SESSION"
            content.sound = .default
            center.add(UNNotificationRequest(
                identifier: "session-test",
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
        }
    }

    // Banners show even while the app is foregrounded — a planned session
    // deserves its nudge either way.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    // Join (or a plain tap) lands in the session; Later just dismisses.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let action = response.actionIdentifier
        if action == "JOIN" || action == UNNotificationDefaultActionIdentifier {
            Task { @MainActor [weak store] in
                store?.joinCall()
            }
        }
        completionHandler()
    }
}
