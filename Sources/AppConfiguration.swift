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
        writerBaseURL: "",
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

    /// Identity is stored URL, then printed/env URL, then `~/.drivemode/writer.json`.
    /// Never a magic port. Preview still allows loopback when the URL is real.
    func initialWriterURL(
        defaults: UserDefaults = .standard,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        fileManager: FileManager = .default
    ) -> String {
        let stored = defaults.string(forKey: "writerURL") ?? ""
        if permitsWriterURL(stored) { return stored }

        for key in ["DRIVEMODE_WRITER_URL", "DRIVE_WRITER_URL"] {
            let value = (environment[key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if permitsWriterURL(value) { return value }
        }

        if let discovered = Self.readDiscoveryURL(
            environment: environment,
            fileManager: fileManager
        ), permitsWriterURL(discovered) {
            return discovered
        }

        return permitsWriterURL(writerBaseURL) ? writerBaseURL : ""
    }

    static func readDiscoveryURL(
        environment: [String: String],
        fileManager: FileManager
    ) -> String? {
        let explicit = environment["DRIVEMODE_WRITER_DISCOVERY"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let home = environment["HOME"]
            ?? fileManager.homeDirectoryForCurrentUser.path
        let defaultPath = (home as NSString).appendingPathComponent(".drivemode/writer.json")
        let path = (explicit?.isEmpty == false ? explicit : defaultPath) ?? defaultPath
        guard let data = fileManager.contents(atPath: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let url = json["url"] as? String
        else { return nil }
        return url.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isLoopback(_ host: String) -> Bool {
        host == "localhost" || host == "127.0.0.1" || host == "::1"
    }
}
