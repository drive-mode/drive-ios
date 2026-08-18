import SwiftUI
import XCTest
@testable import Drive

final class DriveCoreTests: XCTestCase {
    func testDirectorPositionMovesAcrossBeatsAndLoops() {
        let beats = [
            Beat(
                id: 0,
                kind: .plan,
                title: "Plan",
                director: "Maya",
                directorColor: .purple,
                caption: "Plan the change",
                duration: 2,
                steps: []
            ),
            Beat(
                id: 1,
                kind: .test,
                title: "Verify",
                director: "Scout",
                directorColor: .blue,
                caption: "Run tests",
                duration: 3,
                steps: []
            ),
        ]

        let middle = Director.position(beats: beats, elapsed: 3)
        XCTAssertEqual(middle.index, 1)
        XCTAssertEqual(middle.progress, 1.0 / 3.0, accuracy: 0.0001)

        let looped = Director.position(beats: beats, elapsed: 6)
        XCTAssertEqual(looped.index, 0)
        XCTAssertEqual(looped.progress, 0.5, accuracy: 0.0001)
    }

    func testDirectorHandlesAnEmptyProgram() {
        let position = Director.position(beats: [], elapsed: 10)
        XCTAssertEqual(position.index, 0)
        XCTAssertEqual(position.progress, 0)
    }

    @MainActor
    func testSettingsDraftsRemainInSharedStateUntilSaved() throws {
        let suite = "DriveCoreTests.Settings.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let drafts = SettingsDraftStore(defaults: defaults)
        drafts.displayName = "Draft name"
        drafts.callLaunchBehavior = "Launch default preset"

        XCTAssertTrue(drafts.hasUnsavedChanges)
        XCTAssertEqual(drafts.displayName, "Draft name")
        XCTAssertNil(defaults.string(forKey: "profile.displayName"))

        drafts.save()
        XCTAssertFalse(drafts.hasUnsavedChanges)

        let reopened = SettingsDraftStore(defaults: defaults)
        XCTAssertEqual(reopened.displayName, "Draft name")
        XCTAssertEqual(reopened.callLaunchBehavior, "Launch default preset")
    }

    func testSettingsRouteKeepsRequestedEntryTab() {
        let route = SettingsRoute(initialTab: .analytics, source: .profile)
        XCTAssertEqual(route.initialTab, .analytics)
        XCTAssertEqual(route.source, .profile)
        XCTAssertGreaterThan(SettingsTab.allCases.count, 5)
    }
}
