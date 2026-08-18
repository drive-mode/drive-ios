# Handoff — Drive iOS (MC1 preview)

Written 2026-08-18. Everything below is true as of `49d255a` on
`main` at **github.com/drive-mode/drive-ios** (private).

## What this is

A SwiftUI iPhone app for Drive — voice-first pair programming with your
agents. It runs today as a **wire-consuming preview**: with the
`drivemode-mcp` writer running, tasks, artifacts, session beats, agents,
interrupts, and invitations all come off the durable log; offline it
falls back to a seeded demo world (~750 tasks / 220 projects) with the
same shapes. No hub, no hosted backend, no stored audio.

## Run it in 90 seconds

```bash
cd drive-ios && ./build.sh && xcrun simctl install booted build/Drive.app && xcrun simctl launch booted ai.drivemode.drive.preview
```

There is **no Xcode project** — `build.sh` is `swiftc` over `Sources/*.swift`
into `build/Drive.app`, plus Info.plist, icons, the bundled font, and an
ad-hoc signature. (An Xcode/xcodegen project is the gate for widgets and
Live Activities — see Backlog.)

For the live wire, in `drivemode-mcp` (on `main`):

```bash
DRIVEMODE_HTTP_PORT=4600 mise x bun@1.3.14 node@22.23.2 -- bun run --cwd apps/writer start
```

The writer's log is **in-memory** — after any restart, reseed with the
session scratchpad's `seed_full.py` (roster, tasks w1–w8 incl. a blocked
one, artifacts x1–x4, the 8-beat program with stage content, one
invitation). Keep a copy near the repo; it is the fastest way back to a
full-looking app.

## The rules that never bend

These are product decisions, not implementation details. Breaking one is
a bug even if it compiles:

1. **Events, never pixels.** Agents publish typed work events; the phone
   choreographs them. No screen sharing, no file contents on the wire.
2. **Transcripts are never stored.** Conversation — voice or typed —
   lives in memory for the session and is gone on leave. Schemas reject
   transcript-shaped payloads. Voice capture computes a loudness level
   and drops the buffer in the same callback.
3. **Prompts, tool allowlists, API keys, and model IDs never cross.**
   The phone configures *appearance, skills (capability + approval
   posture), and approvals* — never the how.
4. **Nothing lands without a human.** Edits are gated; the approval sheet
   is the product's spine.
5. **Work is archived, people are deleted.** Filing/TTL applies to work
   products; personal data deletion is immediate and real.
6. **Honesty chrome.** If something is demo, on-device, or not yet wired,
   the UI says so (quiet states over fake LIVE, "Preview" labels).

## Architecture in one page

- `Store.swift` — one `AppStore` (`@MainActor`, `ObservableObject`) holding
  every surface's state. Task mutations flow through `tasks.didSet` →
  `rebuildTaskIndex()`, which recomputes per-project aggregates, ordering,
  attention, archive counts, the folded search index, and warms the
  preheat caches. Touch that function carefully; it is the fleet-scale
  performance contract.
- `WriterClient.swift` — the wire. Polls `POST /rpc {events_since}` with an
  adaptive cadence (1s in-session/bursts → 8s idle, exponential backoff to
  30s offline, paused in background), parses with Codable structs, and
  maps events into tasks/artifacts/beats/agents/interrupts/inbox. Beat
  stage precedence: **curated `steps` → `relatedEventIds` resolution →
  structural placeholder**. Handles writer restarts (`latestSeq < cursor`
  → resync).
- `SpotlightDirector.swift` — the directed session view. One `Director`
  clock; the 30fps TimelineView holds only the rail and the stage, chrome
  rides a 4 Hz tick.
- `IntentEngine.swift` — Markov next-surface prediction + preheat (folded
  search index, dependency-map layout LRU).
- Feature files are one-per-surface (`HomeView`, `CallTabView` = Work,
  `TasksView`, `AgentsView`, `ProfileView`, `ArtifactsView`,
  `ActivityView`, `InboxView`, `ShowcaseView`, `SettingsView`) plus the
  systems: `AgentSkills` / `SkillPackages`, `AgentMemory`, `FeedbackMode`,
  `PolicyViews`, `Notifications`, `VoiceCapture`.

## Docs to read before changing things

| Doc | Why |
|---|---|
| `docs/SKILLS.md` | What a skill *is* (capability + posture), packages, kits, the host boundary |
| `docs/MEMORY.md` | Memory scopes and the hook-always/body-on-demand rule |
| `docs/FEEDBACK-MODE.md` | Consent, the 7-day trial lifecycle, kill switch |
| `docs/PRIVACY-POLICY.md`, `docs/DATA-POLICY.md` | Data classes A–E, exact payloads |
| `docs/SOCIAL.md` | Drivemode "by Cline" showcase thesis and phases |
| `docs/WORK-PAGE.md` | The Work page review → redesign → P0/P1/P2 plan |
| `DATA-NEEDS.md` | What each surface needs from the transport (the contract) |
| `TODO.md` | The living backlog, §-numbered |

## Sibling repos (both on `main`, PRs merged)

- **drivemode-mcp** — writer + packs (`packs-tasks`, `packs-artifacts`,
  `packs-direction` incl. the `steps`/`accent` stage lines). Check with
  `mise x bun@1.3.14 node@22.23.2 -- bun run check`.
- **collaboration-harness** — protocol/kernel; carries `control.invite`.

## Verification reality (read this before trusting a screenshot)

The simulator MCP drives taps, swipes, and text well. It **cannot**
reliably drive: SwiftUI `Toggle`s, long-press/hold (synthetic dwell
registers as a tap), or drag-reorder. Anything gated behind those is
marked "hands-on" in TODO. Workarounds used here: set defaults directly
(`xcrun simctl spawn booted defaults write ai.drivemode.drive.preview
<key> -bool YES`), grant privacy (`xcrun simctl privacy booted grant
microphone …`), and prove notification authorization via
`xcrun simctl push`.

Two footguns that cost time:
- `lsof -ti :4600 | xargs kill` **kills the simulator app too** (it holds
  a client socket). Use `-sTCP:LISTEN`.
- The shell's cwd resets between commands; `cd` into `drive-ios`
  explicitly or `./build.sh` silently doesn't run.

## Where to pick up

Highest-value next moves, in order:

1. **Wire the session registry** (WORK-PAGE P1): session created/started/
   ended events so NOW/UPCOMING derive from the log, and the composer's
   Send publishes real `room_invite`s instead of local state.
2. **Policy sync to the host** — approvals *and* skill loadouts
   (`{agentId, skill, equipped, gated}`) over a typed channel. The UI
   already models per-skill granularity; the host contract doesn't.
3. **Memory host contract** — file sync per scope, write attribution,
   session-note TTLs (DATA-NEEDS + docs/MEMORY.md).
4. **Xcode project** — unblocks the streak widget / Live Activity and
   real distribution.
5. **Integrations P0** (`initiatives/integrations-vcs`, still awaiting a
   green light): connector ADR → `packs-vcs`/`comms.*` → tier-0 health →
   GitHub App → Slack → a Connections settings surface.
6. **Hands-on QA pass** for the un-drivable interactions above, plus a
   real VoiceOver run.

## Owner decisions still open

Naming lockup ("Drive" vs "Cline Drive"), mic default (muted vs hot),
PWA posture, Slack inline-approve vs deep-link, Inbox custom filter
names, showcase name ("Drivemode by Cline" vs "Drive Showcase"),
comment identity, and whether the session composer also belongs on Home.
