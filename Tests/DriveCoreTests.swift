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
}
