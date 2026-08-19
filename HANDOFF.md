# Handoff — Drive iOS product preview

Updated 2026-08-19 from merged `main` (`d3d3824`) plus the current
pull-request state. The 12-PR stack — including the release shell and App
Store plan from [#8](https://github.com/drive-mode/drive-ios/pull/8) — merged
across all four repositories on 2026-08-18.

## Status first

Drive iOS is a substantial native preview on merged `main`, not a
distributable app. All 12 approved PRs merged on 2026-08-18; Cline
coordinator [#17](https://github.com/drive-mode/cline-drivecode/pull/17)'s
`presenterGrantId` integration-CI failure was fixed
(`cline-drivecode@9647c40`) before merge. The Presenter leave/room-end
reconciliation (previously follow-up #1 here) merged on 2026-08-19 as harness
[#4](https://github.com/drive-mode/collaboration-harness/pull/4) and MCP
[#4](https://github.com/drive-mode/drivemode-mcp/pull/4); the iOS-side title
projection mirror is the remaining piece.

The merged stack implements the intended UI and protocol seams, but several
are still previews:

- Work targets are static `WorkTargetRef.previews` records.
- Work chat is a one-sided in-memory list plus a fire-and-forget event; there is
  no managed chat catalog, response stream, persistence, or resume yet.
- Calls enter local app state; they do not establish a production remote call.
- Billing uses `PreviewAccountService`; account creation, sign-out, deletion,
  StoreKit, and provider usage are not connected.
- Runtime badges and the iOS Director descriptor are hard-coded allowlisted
  preview values rather than host-supplied signed projections.
- The standalone MCP writer is append-only only for its current process. It is
  in-memory and resets on restart; cross-restart durability must come from the
  production Hub or future persistence work.

The release-hardening slice is merged (#8): `AppConfiguration` separates
Debug preview from a fail-closed Release shell, the privacy manifest is
target-bundled, Settings has Reset, and production-channel UI/accessibility
smoke tests are in the scheme. This reduces misleading review behavior; it
does not supply the missing host, account, distribution identity, signing,
device evidence, or App Store upload.

The canonical remaining-work list is [TODO.md](TODO.md). The backend
connection sequence is [docs/BACKEND-CONNECTION.md](docs/BACKEND-CONNECTION.md).
Its cross-repository dependency and claim source is Cline's
[golden-path implementation map](https://github.com/drive-mode/cline-drivecode/blob/main/docs/drivecode/plans/cline-drivemode/initiatives/portfolio-now/README.md).
The public-release gate is [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md).

## What this is

A SwiftUI iPhone/iPad client for starting a target-aware chat, escalating into
a live call, approving agent work, and reading typed work events. With the
local `drivemode-mcp` writer running, current-process tasks, artifacts, beats,
agents, interrupts, invitations, titles, and session lifecycle events populate
the app. Offline, a seeded preview world keeps the interface reviewable.

Voice capture currently measures live microphone level and drops each buffer in
the same callback. It does not transcribe or retain audio. The iOS 26 local-AI
spike reads one user-selected security-scoped text file (32 KB maximum) and runs
bounded summarization, extraction, navigation, or triage with Apple's system
model and no cloud fallback.

## Build and test

`Drive.xcodeproj` is the primary path. It contains the shared `Drive` scheme,
iPhone/iPad support, `DriveTests`, and `DriveUITests`:

```bash
cd drive-ios
xcodebuild -project Drive.xcodeproj -scheme Drive \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

Select any available matching simulator rather than copying the example name
blindly. The direct compiler path remains a simulator-preview fallback:

```bash
cd drive-ios
./build.sh
xcrun simctl install booted build/Drive.app
xcrun simctl launch booted ai.drivemode.drive.preview
```

For a live local writer, run the writer using the repository's pinned toolchain.
Debug defaults to `http://127.0.0.1:4600`, which works only when the app and
writer share the same network namespace (such as this simulator workflow).
Release has no default writer, rejects loopback/LAN/non-HTTPS endpoints, and
omits local-network keys from its built plist.

Do not restore the old scratchpad `seed_full.py` workflow as a source of truth.
TODO §13 intentionally replaces remembered seeding and simulator steps with
versioned fixtures and a public `drive-dev` contract.

## Product vocabulary

| Term | Meaning |
|---|---|
| Spotlight | The user-facing shared presentation surface |
| `stage` | The wire/protocol projection rendered by that surface |
| Presenter | A temporary, exclusive, auditable Agent Title allowed to publish typed stage content |
| Director | The signed, versioned, host-side orchestration policy |
| Persona | An editable agent name such as Maya or Scout |
| Runtime badge | An allowlisted model-family label plus hosted/on-device location |

Presenter replaces the old idea of a “spotlight owner”; it does not authorize
pixel capture and it does not expose Director implementation details.

## Rules that never bend

1. **Events, never pixels.** Agents publish typed work events. No title grants
   screen capture or pixel streaming.
2. **No stored voice transcript.** Microphone access is explicit; audio and
   transcripts are not retained by this client.
3. **Reference-only boundaries.** Prompts, tool policy, keys, exact model IDs,
   endpoints, Director scoring/routing, skill bodies, and resource contents do
   not cross in UI configuration or title grants.
4. **Human gates remain enforceable.** The host, not just the phone, enforces
   approvals and title permissions.
5. **Work may be retained; people can be deleted.** Production account deletion
   is release-blocking and must distinguish Drive-hosted data from a user's own
   infrastructure.
6. **Honesty chrome.** Preview, on-device, disconnected, unavailable, and
   unpersisted states say what they are.

## Architecture map

- `Store.swift` — the main-actor app store, root routing, preview fleet, Work
  chat/preset state, and current title projections.
- `WorkHub.swift` — chat-first Work root, opaque target/preset contracts,
  target picker, call configurator, and secondary Calls/History flows.
- `SettingsView.swift` — `SettingsTab`, `SettingsRoute`, modal deep-linking,
  adaptive iPad layout, shared drafts, preview account surface, usage,
  analytics, local AI, and safe Director overlays.
- `AgentSkills.swift` / `AgentsView.swift` — packages, search, category folding,
  compact equip controls, Memory/Skills entry points, and runtime badges.
- `AgentTitles.swift` — reference-only title shapes, local projection, Presenter
  controls, and non-exportable Director descriptor presentation.
- `WriterClient.swift` — adaptive polling and event projection/publishing for
  the current writer process. Do not describe this preview writer as
  cross-restart durable.
- `LocalAI.swift` — Foundation Models availability, bounded security-scoped file
  reading, task execution, cancellation, receipts, and honest fallbacks.
- `SpotlightDirector.swift` — the typed shared surface and beat clock. The file
  name is legacy; Presenter is the authority title, not a pixel-sharing mode.
- `Drive.xcodeproj`, `Tests/DriveCoreTests.swift`, and `UITests/DriveUITests.swift`
  — native project, 22 focused unit tests, and three production-channel UI tests
  including Home/Work accessibility audits. There is no release archive job.

## PR stack and merge order

All 12 approved PRs merged on 2026-08-18, in dependency order: Harness
[#2](https://github.com/drive-mode/collaboration-harness/pull/2)/[#3](https://github.com/drive-mode/collaboration-harness/pull/3)
(session lifecycle events, Agent Title protocol), MCP
[#2](https://github.com/drive-mode/drivemode-mcp/pull/2)/[#3](https://github.com/drive-mode/drivemode-mcp/pull/3)
(lifecycle tools, Presenter writer enforcement), iOS
[#1](https://github.com/drive-mode/drive-ios/pull/1)–[#8](https://github.com/drive-mode/drive-ios/pull/8)
(registry through release shell), and Cline
[#17](https://github.com/drive-mode/cline-drivecode/pull/17) (host
coordinator and signed Director boundary, CI fixed in `9647c40`).

Follow-up reconciliation, merged 2026-08-19 — title cleanup: Cline revokes a
leaving Presenter and clears titles on room end, which the standalone Harness
fold did not. Harness [#4](https://github.com/drive-mode/collaboration-harness/pull/4)
mirrors both rules into the fold (leave revokes the leaver's grant; a new
`control.end` clears the room) and MCP
[#4](https://github.com/drive-mode/drivemode-mcp/pull/4) exposes `room_end`
and rides the fold. The merged-system gate still wants iOS Presenter behavior
exercised against the actual Cline coordinator, and the iOS `WriterClient`
projects titles from `control.title_*` events only — it does not yet mirror
the two fold-level cleanup rules (leave revocation, `control.end`).

## Verification reality

The merged slice passes 22 unit and three UI tests, including production Home/
Work accessibility audits, and compiles a simulator Release whose built plist
selects production and contains no local-network exception. Prior preview work
also built and ran on iPhone and iPad simulators. Post-merge (2026-08-19, in a
Linux container): harness `bun run check` green; MCP `bun test` 16/16; Cline
`@cline/shared` 474/474, `@cline/drive` 419/419 after `bun run build:sdk`, and
the focused hub Presenter/room suites 81/81 — all on merged `main`. That
evidence does not cover:

- a post-merge run of the iOS Xcode suite (requires macOS; not rerun since
  the merges);
- a release-signed device archive or App Store upload validation;
- production services, authentication, account deletion, or StoreKit;
- physical-device local-network, microphone, file-provider, Foundation Models,
  thermal, memory, or battery behavior;
- a complete VoiceOver/Voice Control/Larger Text pass;
- SwiftUI toggle feel, long press, drag reorder, or 500-skill rendering latency;
- deterministic cross-repository setup, evidence, cleanup, and repeatability.

XcodeBuildMCP can drive labeled taps, swipes, and text, but element references
must be refreshed after navigation. Synthetic automation has not been a
substitute for hands-on screen-reader, gesture, control, or device testing.

## Docs to read before changing things

| Document | Source-of-truth scope |
|---|---|
| [TODO.md](TODO.md) | Product backlog, delivery state, and release priorities |
| [docs/WORK-PAGE.md](docs/WORK-PAGE.md) | Current chat-first Work interaction contract |
| [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md) | App Store/TestFlight readiness, gates, and evidence |
| [DATA-NEEDS.md](DATA-NEEDS.md) | Transport and service data requirements only |
| [docs/SKILLS.md](docs/SKILLS.md) | Skill capability/posture and host boundary |
| [docs/MEMORY.md](docs/MEMORY.md) | Memory scopes and hook/body rule |
| [docs/PRIVACY-POLICY.md](docs/PRIVACY-POLICY.md) | Preview privacy draft; must be finalized before release |
| [docs/DATA-POLICY.md](docs/DATA-POLICY.md) | Preview data inventory and open production decisions |

## Where to pick up

The connection sequence below is expanded, with owner-decision dependencies
and per-rung evidence, in [docs/BACKEND-CONNECTION.md](docs/BACKEND-CONNECTION.md).

1. Mirror the two merged fold rules (leave revocation, `control.end`) in the
   iOS `WriterClient` title projection, and rerun the iOS Xcode suite on
   macOS against merged `main` — including exercising iOS Presenter behavior
   against the actual Cline coordinator.
2. Connect managed chat, authenticated targets, remote call setup, runtime
   badges, the signed Director descriptor, and host-resolved call presets.
3. Connect account/authentication, deletion, billing/StoreKit decision, usage,
   and analytics truth.
4. Finish approval/skill policy sync, memory sync/attribution, and real skill
   bodies/generation.
5. Implement TODO §13 deterministic verification.
6. Work through the App Store plan from G0; the current public-release verdict
   is **NO-GO**, and external TestFlight is also blocked until distribution,
   privacy, backend/reviewer access, and account posture are real.

Cline [#15](https://github.com/drive-mode/cline-drivecode/pull/15) merged only
the Proposed invocation-scoped sensing ADR. It is not part of this connection
sequence and does not authorize runtime sensing; keep it Later until the ADR's
privacy and audit entry gates are accepted.

## Owner decisions still open

The authoritative release decisions are D01–D12 in
[docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md#owner-decision-register).
They cover identity/legal seller, business model, hosted-agent/4.7 posture,
Showcase, HTTPS/LAN, login, minimum OS/local AI, retention/deletion, microphone
value, storefronts/rating, support/SLO, and rollout thresholds. Do not let an
implementation PR silently settle one.

Non-release product decisions remain in [TODO.md](TODO.md): Inbox custom
filters, Slack approval posture, social identity, and whether a fast session
composer also belongs on Home.
