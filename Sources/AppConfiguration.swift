import Foundation

enum DriveReleaseChannel: String, Equatable, Sendable {
    case preview
    case production
}

/// One release policy controls which incomplete/demo integrations can be
/// reached. Release builds fail closed: no seeded customer data, experiments,
/// Showcase, billing chrome, or loopback writer connection.
struct AppConfiguration: Equatable, Sendable {
    let channel: DriveReleaseChannel
    let writerBaseURL: String
    let isUITesting: Bool

    var previewContentEnabled: Bool { channel == .preview }
    var feedbackExperimentsEnabled: Bool { channel == .preview }
    var showcaseEnabled: Bool { channel == .preview }
    var billingEnabled: Bool { channel == .preview }
    var localWriterEnabled: Bool { channel == .preview }
    var writerSettingsVisible: Bool { localWriterEnabled || !writerBaseURL.isEmpty }

    var availableSettingsTabs: [SettingsTab] {
        SettingsTab.allCases.filter { tab in
            tab != .billingPayments || billingEnabled
        }
    }

    static let preview = AppConfiguration(
        channel: .preview,
        writerBaseURL: "http://127.0.0.1:4600",
        isUITesting: false)

    static let production = AppConfiguration(
        channel: .production,
        writerBaseURL: "",
        isUITesting: false)

    static var current: AppConfiguration {
        from(info: Bundle.main.infoDictionary ?? [:], environment: ProcessInfo.processInfo.environment)
    }

    static func from(
        info: [String: Any],
        environment: [String: String] = [:]
    ) -> AppConfiguration {
        let isUITesting = environment["DRIVE_UI_TESTING"] == "1"
        let configuredChannel = (info["DriveReleaseChannel"] as? String)?.lowercased()
        let testChannel = isUITesting
            ? environment["DRIVE_RELEASE_CHANNEL_OVERRIDE"]?.lowercased()
            : nil
        let rawChannel = testChannel ?? configuredChannel
        let channel = DriveReleaseChannel(rawValue: rawChannel ?? "") ?? .production
        let configuredURL = (info["DriveWriterBaseURL"] as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return AppConfiguration(
            channel: channel,
            writerBaseURL: configuredURL,
            isUITesting: isUITesting)
    }

    func permitsWriterURL(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let components = URLComponents(string: trimmed),
              let scheme = components.scheme?.lowercased(), let host = components.host?.lowercased()
        else { return false }

        if channel == .preview {
            return scheme == "https" || (scheme == "http" && Self.isLoopback(host))
        }
        return scheme == "https" && !Self.isLoopback(host) && !host.hasSuffix(".local")
    }

    func initialWriterURL(defaults: UserDefaults = .standard) -> String {
        let stored = defaults.string(forKey: "writerURL") ?? ""
        if permitsWriterURL(stored) { return stored }
        return permitsWriterURL(writerBaseURL) ? writerBaseURL : ""
    }

    private static func isLoopback(_ host: String) -> Bool {
        host == "localhost" || host == "127.0.0.1" || host == "::1"
    }
}
