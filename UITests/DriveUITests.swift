import XCTest

final class DriveUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DRIVE_UI_TESTING"] = "1"
        app.launchEnvironment["DRIVE_RELEASE_CHANNEL_OVERRIDE"] = "production"
        app.launch()
    }

    func testProductionWorkRootHasPrimaryActionsAndHomeEscapeHatch() {
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))
        XCTAssertTrue(tabBar.buttons["Home"].exists)
        XCTAssertTrue(tabBar.buttons["Work"].exists)
        XCTAssertTrue(tabBar.buttons["Agents"].exists)
        XCTAssertTrue(tabBar.buttons["Tasks"].exists)

        tabBar.buttons["Work"].tap()

        XCTAssertTrue(app.navigationBars["Work"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Home"].exists)
        XCTAssertTrue(app.buttons["New Chat"].exists)
        XCTAssertTrue(app.buttons["Call"].exists)
        XCTAssertTrue(app.buttons["Work target, Choose a work target"].exists)
        XCTAssertTrue(app.staticTexts["No repository or folder connected"].exists)
        XCTAssertFalse(app.staticTexts["drive-ios"].exists)
        XCTAssertFalse(app.staticTexts["Maya"].exists)

        app.navigationBars["Work"].buttons["Home"].tap()
        XCTAssertTrue(app.staticTexts["Start from Work"].waitForExistence(timeout: 3))
    }

    func testProductionProfileDoesNotExposePreviewAccountOrBilling() {
        XCTAssertTrue(app.buttons["Profile"].waitForExistence(timeout: 5))
        app.buttons["Profile"].tap()

        XCTAssertTrue(app.navigationBars["Profile"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["No sample account data"].exists)
        XCTAssertTrue(app.staticTexts["Account service not connected"].exists)
        XCTAssertFalse(app.staticTexts["Your showcase"].exists)
        XCTAssertFalse(app.buttons["Billing & payments"].exists)
        XCTAssertFalse(app.staticTexts["harrison@quant-h2.com"].exists)
    }

    func testProductionHomeAndWorkPassCoreAccessibilityAudit() throws {
        XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 5))
        try app.performAccessibilityAudit(for: [
            .elementDetection,
            .sufficientElementDescription,
            .hitRegion,
            .trait,
            .textClipped,
        ])

        app.tabBars.buttons["Work"].tap()
        XCTAssertTrue(app.navigationBars["Work"].waitForExistence(timeout: 3))
        try app.performAccessibilityAudit(for: [
            .elementDetection,
            .sufficientElementDescription,
            .hitRegion,
            .trait,
            .textClipped,
        ])
    }
}
