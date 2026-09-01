# CLAUDE.md — drive-ios

Guidance for Claude Code (and other coding agents) working in this repository.

## What this repository is

`drive-ios` is the SwiftUI iPhone/iPad client for Drive Mode: start a chat
against an explicit repository/file target, escalate into a live call when it
helps, watch typed agent work land on a shared **Spotlight**, approve or
interrupt, and steer a fleet of agents from a phone.

**Maturity: implemented preview, not a released app.** Debug builds keep a
clearly labeled preview world (seeded fleet, preview account, Showcase,
experiments). Release builds **fail closed** behind one configuration policy.
Managed chat, production targets/accounts, distribution identity, and App Store
submission are still release work.

This repository is the **App Store candidate**. The in-tree
`cline-drivecode/apps/drive-ios/` project is a legacy fixture — not the native
delivery source of truth. Do not port work there.

### Where it sits in the Drive Mode family

| Repo | Role |
|---|---|
| [`collaboration-harness`](https://github.com/drive-mode/collaboration-harness) | Room protocol + pure kernel (the event vocabulary this app renders) |
| [`drivemode-mcp`](https://github.com/drive-mode/drivemode-mcp) | The writer this app polls (`/rpc events_since`) |
| [`cline-drivecode`](https://github.com/drive-mode/cline-drivecode) | Cline fork + hub; owns brand tokens and the golden-path plan |
| **drive-ios** (this) | iPhone/iPad client |
| [`site`](https://github.com/drive-mode/site) | drivemode.ai static site |

## Read these first

| File | Why |
|---|---|
| `README.md` | Surface-by-surface map (screen → file → behavior) |
| `HANDOFF.md` | Cold-start brief: what is real, what is preview |
| `TODO.md` | The canonical remaining-work list (§12–§14 are current) |
| `DATA-NEEDS.md` | What each surface demands from the wire — the transport requirements doc |
| `docs/APP-STORE-REVIEW.md` | The release gate |
| `docs/BACKEND-CONNECTION.md` | The connect-to-production sequence |
| `docs/SKILLS.md`, `docs/MEMORY.md`, `docs/WORK-PAGE.md` | Model of skills, memory, and the Work surface |
| `Brand/PRINCIPLES.md` | Locked mark geometry and the generator contract |

## Toolchain and builds

- **Xcode with an iOS Simulator.** `Drive.xcodeproj` is the primary build path
  and carries the shared **`Drive`** scheme plus the `DriveTests` and
  `DriveUITests` targets. Select a simulator and Run/Test the shared scheme.
- Deployment target **iOS 17.0**, `SWIFT_VERSION = 5.0`,
  `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad).
- Bundle id `ai.drivemode.drive.preview` (final distribution identity is
  outstanding release work).

```bash
xcodebuild -project Drive.xcodeproj -scheme Drive \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

**Fallback (no Xcode project):** `./build.sh` drives `swiftc` directly into
`build/Drive.app` for the simulator.

```bash
./build.sh
xcrun simctl install booted build/Drive.app
xcrun simctl launch booted ai.drivemode.drive.preview
```

`build.sh` is a *preview* path only: it compiles `Sources/*.swift`, copies
`Info.Debug.plist`, `PrivacyInfo.xcprivacy`, the font, and the legacy PNG icons —
it does **not** build `Assets.xcassets`, and it does not build or run the test
targets. Use the Xcode project for anything you intend to ship or verify.

**Local web build (any OS, no Xcode):** `web/` is a one-module-per-Swift-file
port of the whole app onto vendored Preact — same store, wire fold, tokens,
copy and gates. `cd web && python3 serve.py` serves it and proxies the
discovered writer; `node --test web/tests/` runs the core parity tests;
`web/tools/smoke.mjs` walks every surface in headless Chromium. Read
`web/ARCHITECTURE.md` before touching it. When you change a Swift surface,
port the change to its `web/src/views/<tab>/<File>.js` twin (and the reverse):
the two builds are meant to document the same contract, and the web fold
(`web/src/wire.js`) must not drift from `WriterClient.swift`.

### The two configurations differ on purpose

| | Debug (`Info.Debug.plist`) | Release (`Info.plist`) |
|---|---|---|
| `DriveReleaseChannel` | `preview` | `production` |
| `DriveWriterBaseURL` | empty (discover printed URL / `writer.json`) | empty |
| Local networking keys | `NSAllowsLocalNetworking`, `NSAppTransportSecurity`, `NSLocalNetworkUsageDescription` | **absent** |

Do not add local-network or loopback configuration to `Info.plist`.

## Architecture

Plain SwiftUI + Combine, no third-party packages. `Sources/` is flat — one file
per surface or subsystem (~16.5k lines).

```text
DriveApp.swift          @main; RootView; scene-phase wire start/pause
AppConfiguration.swift  the release-channel policy (see below)
Store.swift             AppStore — the @MainActor ObservableObject app state
Models.swift            domain types + DemoData seeds
WriterClient.swift      the wire: polls /rpc events_since, folds typed events
Theme.swift             DT design tokens + CardStyle
Components.swift        shared controls (Pressable, scaledFont, …)
DriveBrand.swift        the only feature-code entry point for the Drive mark
ClineBotShape.swift     agent avatar mark, converted 1:1 from the hub icon
web/                    the local web build — same app, no Xcode (see web/ARCHITECTURE.md)
```

Surfaces: `OpenView`, `HomeView`, `WorkHub`, `CallTabView`, `LiveCallView`,
`SpotlightDirector`, `ApprovalView`, `AgentsView`, `AgentSkills`,
`SkillPackages`, `AgentMemory`, `AgentTitles`, `TasksView`, `ProjectMapView`,
`NeedsYouView`, `ConversationView`, `ProfileView`, `ProfileCustomize`,
`ArtifactsView`, `ArtifactDetailView`, `ActivityView`, `InboxView`,
`SettingsView`, `ShowcaseView`, `FeedbackMode`, `PolicyViews`, `LocalAI`,
`VoiceCapture`, `Notifications`, `IntentEngine`.

### `AppConfiguration` is the fail-closed gate

One policy object decides what an incomplete integration may reach. It reads
`DriveReleaseChannel` / `DriveWriterBaseURL` from the bundle and **defaults to
`.production` when the channel is unknown or missing**. Preview-only surfaces
(`previewContentEnabled`, `feedbackExperimentsEnabled`, `showcaseEnabled`,
`billingEnabled`, `localWriterEnabled`) gate on it.

`permitsWriterURL` is the other half: preview allows `https` **or** `http` to
loopback; production allows `https` to a non-loopback, non-`.local` host only.

**When you add anything demo-shaped, seeded, unpriced, unauthenticated, or
locally-wired, gate it here and add a test that production stays clean.**
`Tests/DriveCoreTests.swift` already asserts
`testReleaseConfigurationFailsClosed`,
`testUnknownBuildChannelDefaultsToProduction`, and
`testProductionStoreContainsNoPreviewSeedsOrLoopbackWire`.

### The wire

`WriterClient` polls the `drivemode-mcp` writer and is the truth when live:
tasks, artifacts, beats, agents, interrupts, invitations, titles, and the
session lifecycle all come from typed events. Offline Debug falls back to the
labeled demo world; **offline Release shows an empty disconnected state**, never
seeds.

Decoding is `Codable` (no dictionary spelunking on the hot path), the working set
is capped (shipped work evicts first), and `WireSessionRecord` is *rebuilt* from
`control.session_*` events — it is not a second source of truth. A dropped wire
after being live says "Reconnecting to your fleet" and clears on recovery,
including across a writer restart (cursor resync).

Poll cadence adapts: ~1s in session/bursts, 1.5s on task surfaces, 3s active,
8s idle, exponential backoff to 30s offline, paused in background. Diagnostics
live in Settings → WIRE.

### Spotlight, Presenter, Director

Same vocabulary as the rest of the family, and it must not drift:

- **Spotlight** — the user-facing shared surface.
- **stage** — the typed wire projection.
- **Presenter** — a temporary, exclusive, auditable title that authorizes an
  agent to publish to the stage. Grants are revocable and never carry skill or
  prompt contents.
- **Director** — host policy; the descriptor is non-exportable.

The Spotlight **never streams pixels**. Agents publish typed work events and
`SpotlightDirector` choreographs them into beats; beats loop as the room's
replayable program.

### Intent and preheat

`IntentEngine.swift` keeps first-order Markov transitions plus frequency/recency
priors (UserDefaults, 7-day half-life) to predict the next surface;
`PreheatEngine` warms it (folded search index, dependency-map layouts with an
LRU-8 read-through cache and memory-warning eviction).

Render budgets are deliberate: the Spotlight's 30fps `TimelineView` drives only
the rail fill and stage (header/caption/gestures ride a 4 Hz tick), theater
chrome is opaque pseudo-glass rather than live blur, the demo fleet seeds
off-main after first paint, and the contribution wall's columns are precomputed.
Keep new work inside these budgets.

## Conventions

- **Design tokens only.** Colors, radii, and gradients come from `DT` in
  `Theme.swift` (which aliases the Hub variables in
  `cline-drivecode/docs/drivecode/design/brand/MOBILE-BRAND-STYLING.md`). Use
  `.card()` for surfaces. No ad-hoc hex in feature code.
- **The Drive mark has exactly one entry point:** `DriveBrand.swift`. Do not add
  another logo file. After any brand change run
  `python3 Brand/generate-brand-assets.py --check` — it verifies the reference
  hash and regenerates the normalized source, adaptive runtime image, Any/Dark/
  Tinted app-icon catalog, and legacy simulator icons. The mark is monochrome;
  never fill it violet.
- **Agent avatars** wear `ClineBotShape`, distinguished by color; humans keep
  initials.
- **Accessibility is part of the feature, not a follow-up.** `scaledFont` for
  Dynamic Type (capped at `accessibility3`), fixed heights become `minHeight`,
  icon buttons/rows/map nodes carry labels and hints, decorative rails are
  hidden, the Spotlight is one adjustable element for VoiceOver, and
  press-and-hold exposes a toggle action.
- **Reduce Motion** (system setting *or* the in-app toggle) must still the
  waveform, live pulse, and beat decoration.
- **Language:** the tab is **Work**; **Chat** is the default asynchronous entry;
  **Call** is the explicit real-time action. Never hide a call behind a vague
  "Start".
- Swipe between tab pages on root surfaces only — pushed views keep
  edge-swipe-back.

## Hard rules

- **Privacy-strict.** `VoiceCapture` measures live mic level and drops each
  buffer in the same callback. Do not transcribe, retain, or persist audio or
  transcripts. Voice telemetry may only be spans (start/stop/duration).
- **Prompts, tool allowlists, providers, endpoints, API keys, and model IDs
  never cross to the phone.** A skill is a *typed capability with an approval
  posture*; the host maps it to its own prompts and tools privately. Runtime
  badges are an allowlisted model-*family*/location only.
- **`LocalAI` stays bounded.** iOS 26 availability-gated `SystemLanguageModel`
  over one user-selected, security-scoped text file (32 KB max), read-only,
  offline, **no cloud fallback**, and file content is marked untrusted in the
  prompt.
- **Release fails closed.** No demo seeds, preview account/sign-in, Showcase,
  experiments, billing, or loopback writer in production builds.
- **Archived work is never deleted.** Auto-file and the Tidy sweep move things;
  search still spans the archive and `ArchiveView` restores in one tap. The
  sweep obeys Settings → FOCUS & ARCHIVE (auto-file toggle, aging threshold,
  per-project "never file"), and a project with a live wire pulse un-files
  itself.

## Testing

- `Tests/DriveCoreTests.swift` (XCTest, `@testable import Drive`) — director
  paging, settings drafts/reset, **release fail-closed**, target safety, call
  presets, runtime-badge allowlist, Presenter exclusivity/transfer/revocation,
  Director policy non-exportability, LocalAI bounds, brand contrast.
- `UITests/DriveUITests.swift` (XCUITest) — launches with
  `DRIVE_UI_TESTING=1` and `DRIVE_RELEASE_CHANNEL_OVERRIDE=production`, then
  audits the *production* root surfaces for primary actions, absence of preview
  account/billing, and core accessibility.
- `Brand/test_generate_brand_assets.py` covers the asset generator.

The channel override is honored **only** when `DRIVE_UI_TESTING=1` — that is
what lets UI tests exercise production behavior from a Debug build. Don't widen
it.

## Gotchas

- `build.sh` skips the asset catalog, so icon/asset regressions are invisible on
  that path. Verify brand and icon work through Xcode.
- Production defaults are reached by *absence*: an unknown or missing
  `DriveReleaseChannel` resolves to `.production`. A new plist that forgets the
  key gets the strict behavior, not the preview one.
- The standalone writer is in-memory and resets on restart. "Durable" behavior
  needs the production Hub; do not model persistence the writer does not have.
- Work targets (`WorkTargetRef.previews`), Work chat, calls, billing, runtime
  badges, and the iOS Director descriptor are still **preview stand-ins**. Check
  `HANDOFF.md` before assuming a seam is connected.
- Cross-repository ordering and acceptance evidence live in Cline's golden-path
  implementation map (`docs/drivecode/plans/cline-drivemode/initiatives/portfolio-now/README.md`
  in `cline-drivecode`) — align claims with it rather than inventing status here.

## Before you push

1. Build and test the shared `Drive` scheme on a simulator (unit **and** UI
   targets — the UI target runs the production channel).
2. If you touched brand assets: `python3 Brand/generate-brand-assets.py --check`.
3. If you touched a preview-shaped surface: confirm the production channel still
   fails closed, and add the assertion if it is missing.
4. Update `TODO.md` / `HANDOFF.md` when the status of a seam actually changed.
