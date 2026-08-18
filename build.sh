#!/bin/bash
# Build Drive.app for the iOS Simulator without an Xcode project:
# swiftc -> .app bundle -> ad-hoc sign. Install/launch via simctl or the
# simulator MCP 'launch' action.
set -euo pipefail
cd "$(dirname "$0")"

SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)"
APP=build/Drive.app

rm -rf "$APP"
mkdir -p "$APP"

swiftc -O -parse-as-library \
  -sdk "$SDK" \
  -target arm64-apple-ios17.0-simulator \
  Sources/*.swift \
  -o "$APP/Drive"

cp Info.Debug.plist "$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Add :UIDeviceFamily array" \
  -c "Add :UIDeviceFamily:0 integer 1" \
  -c "Add :UIDeviceFamily:1 integer 2" "$APP/Info.plist"
cp Icons/AppIcon60x60@2x.png Icons/AppIcon60x60@3x.png "$APP/" 2>/dev/null || true
cp PrivacyInfo.xcprivacy "$APP/PrivacyInfo.xcprivacy"
mkdir -p "$APP/Fonts" && cp Fonts/SchibstedGrotesk.ttf "$APP/Fonts/" 2>/dev/null || true
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

echo "Built $APP"
