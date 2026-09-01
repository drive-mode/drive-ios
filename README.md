# Drive iOS — product preview

SwiftUI implementation of Drive's iPhone and iPad experience: start a chat
against an explicit repository or file target, move into a live call when the
work benefits from it, and steer a fleet of agents from anywhere.

**Maturity: implemented preview, not a released app.** The approved 12-PR
stack — chat-first Work hub, unified Settings, iPhone/iPad project and tests,
scalable skills, Presenter titles, the bounded Apple system-model spike, and
the fail-closed release shell — merged to `main` across all four repositories
on 2026-08-18. The Debug builds retain the clearly labeled preview world.
Release builds fail closed behind one configuration policy: no demo seeds,
fake account/sign-in, Showcase, experiments, billing, or loopback writer.
Managed chat, production targets/accounts, final distribution identity, and
App Store submission remain release work; the connection sequence is
[docs/BACKEND-CONNECTION.md](docs/BACKEND-CONNECTION.md). See
[TODO.md](TODO.md) for the delivery snapshot and
[docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md) for the release gate.

## Design SoT

- Artboards: **Drivecode Design System** project on claude.ai/design → `ios/`
  groups. Any `../design-artboards/` mirror is workspace-only, not part of this
  standalone repository.
- Brand locks: [mobile brand styling](https://github.com/drive-mode/cline-drivecode/blob/main/docs/drivecode/design/brand/MOBILE-BRAND-STYLING.md)
- Tokens live in [`Sources/Theme.swift`](Sources/Theme.swift) (`DT`) and alias
  the Hub variables.

## Build, test, and run

`Drive.xcodeproj` is the primary build path and carries the shared `Drive`
scheme, iPhone + iPad support, and the `DriveTests` + `DriveUITests` targets.
The UI target launches the production channel and runs root-surface smoke and
accessibility audits. Select an iOS Simulator in Xcode and run or test the
shared scheme.

The direct compiler script remains a lightweight preview fallback:

```bash
./build.sh   # swiftc -> build/Drive.app (iOS Simulator, arm64)
xcrun simctl install booted build/Drive.app
xcrun simctl launch booted ai.drivemode.drive.preview
```

### Local web build (no Xcode)

[`web/`](web/README.md) is a fully working local version of the app for any
machine — the same surfaces, copy, store, wire fold, brand and tokens as
`Sources/`, ported one module per Swift file onto vendored Preact with no
build step. It runs in a phone frame on a desktop and installs to an iPhone
home screen as a standalone app.

```bash
cd web && python3 serve.py        # http://127.0.0.1:8787/ — discovers ~/.drivemode/writer.json
node --test web/tests/            # core parity tests (director, fail-closed, titles, presets, fold)
```

`?channel=production` exercises the fail-closed channel in the browser. The
contract is [`web/ARCHITECTURE.md`](web/ARCHITECTURE.md).

## Surfaces

Tabs: **Home · Work · Agents · Tasks**, profile off Home's avatar.

| Screen | File | Notes |
|---|---|---|
| Open | `Sources/OpenView.swift` | Brand hero and one violet verb; preview/auth theater is absent from Release |
| Home (+tabs) | `Sources/HomeView.swift` | Live hero · today tiles · needs-you pill · profile |
| Work tab | `Sources/WorkHub.swift` | **Chat first**: selected opaque repository/folder/file-set target, quiet composer, and visible New Chat + Call actions. Calls and History retain the session lifecycle without filling the default surface; see [docs/WORK-PAGE.md](docs/WORK-PAGE.md) |
| **Spotlight** | `Sources/SpotlightDirector.swift`, `Sources/AgentTitles.swift` | User-facing shared surface for typed beats (plan / diagram / edit / run / tests / decision / result), writable by one temporary, exclusive, auditable Presenter. No pixel streaming |
| Live call | `Sources/LiveCallView.swift` | Portrait + **theater** (landscape) layouts · rotate control (`requestGeometryUpdate`) · glass hold strip |
| Approval | `Sources/ApprovalView.swift` | Light sheet over dark call · Deny / Allow |
| Agents | `Sources/AgentsView.swift` | Status-hub tiles + rows → per-agent profile with separate Memory and Skills controls, collapsed loadout summaries, searchable/foldable skill categories, compact selection, runtime-family badge, appearance, approvals, and reporting |
| Skills | `Sources/AgentSkills.swift` | The registry + library: a skill is a **typed capability with an approval posture** — its event-kind footprint on the wire, who carries it, how often the log saw it used. Prompts/tools/models never cross (docs/SKILLS.md) |
| Tasks | `Sources/TasksView.swift` | **Fleet scale** (~750 tasks · 220 projects seeded): attention rail → lazy project grid (agg cards, state bars) → search across everything; virtualized all-tasks list |
| Project map | `Sources/ProjectMapView.swift` | Per-project dependency map, positions **computed** (topological layers, wrapped columns, 18-node cap) — any project renders readable |
| Needs you | `Sources/NeedsYouView.swift` | Interrupt triage — cards open the conversation |
| Conversation | `Sources/ConversationView.swift` | The thread an interrupt points at: report_status trail · agent ask · quick replies · voice |
| Profile | `Sources/ProfileView.swift` | Preview: modular Steer/Answer/Ship week and Showcase. Release: zero-seed account state and observed counts only; billing remains hidden until connected |
| Artifacts | `Sources/ArtifactsView.swift` | Kind-colored gallery + **lifecycle**: permanent ("keeps") vs ephemeral (TTL badge, auto-files to archive); group by project/repo/day/type; filter by kind/size/life; sort; context-menu TTL control |
| Artifact detail | `Sources/ArtifactDetailView.swift` | Every artifact opens: **replays play their beat program** (self-clocked `ReplayPlayer`, scrubbable), diffs render as diffs, others get a directed-summary preview — plus lineage, inline lifecycle chips, Open in session, Share |
| Activity | `Sources/ActivityView.swift` | The Today calendar: week bars, month calendar + **GitHub-style contribution wall** (darker squares = more activity, 5-level violet scale, horizontal year scroll), custom range — tap a day/square for per-project breakdown |
| Settings | `Sources/SettingsView.swift` | One responsive modal (sheet on iPhone, split form on iPad) with deep-linked tabs, cached drafts, Save, and Reset. Billing/feedback/writer preview controls are unavailable in Release; Usage and Analytics show observed values only |
| On-device AI | `Sources/LocalAI.swift` | iOS 26 availability-gated `SystemLanguageModel` tasks over one user-selected, security-scoped text file; read-only, bounded, offline, and no cloud fallback |
| Showcase | `Sources/ShowcaseView.swift` | Debug-preview-only until the hosted UGC moderation gate passes; see docs/SOCIAL.md |
| Feedback mode | `Sources/FeedbackMode.swift` | Debug-preview-only experiment program; excluded from Release pending consent/data-policy work |
| Policies | `Sources/PolicyViews.swift` | Privacy / Data / Feedback-mode policies rendered in-app; the feedback policy is the consent gate. Full text in docs/ |
| Inbox | `Sources/InboxView.swift` | Tray icon + unread badge on Home. Two voices — **For you** (approvals, blocked asks, invitations, ships, streaks) and **Product** (news, tips) — with read/unread, swipe archive/delete, filters, Read-all, context menus, and inline act (Deny/Allow, Reply, Join session) |

**Language:** the tab is **Work**. **Chat** is the default asynchronous entry;
**Call** is the explicit real-time action. Invitations and durable records may
still call the resulting collaboration a working session. The UI should never
hide a call behind a vague Start action.

**Guide bar:** ambient — hides after ~6s idle; summoned by pressing the
bottom-center grabber or swiping up there. Never auto-appears on tab swipes:
a swiping user already knows the way.

Spotlight never streams pixels — agents publish typed work events
(the harness's `work.plan` / `work.edit` / `work.test` / `work.decision` packs)
and the director choreographs them into beats a phone can digest, portrait
or rotated. Beats loop as the room's replayable program.

## Cline & lineage

The main agent is **Cline** — every agent wears the Cline bot mark
(`ClineBotShape.swift`, converted 1:1 from the upstream icon), told apart by
color; humans keep initials. Agent detail carries **Lineage**: the pie of the
agent's tasks by project, russian-doll project▸task rows, sessions they
direct, artifacts they produced — all derived from current-writer `actorId`, a
query not a picture.

## Intent & preheat

`IntentEngine.swift`: first-order Markov transitions + frequency/recency
priors (UserDefaults, 7-day half-life) predict the next surface;
`PreheatEngine` pre-warms it — folded search index, dependency-map layouts
(read-through cache, LRU 8, memory-warning eviction). Wire polling adapts:
1s in-session/bursts, 1.5s on task surfaces, 3s active, 8s idle, exponential
backoff to 30s offline, paused in background. Diagnostics: Settings → WIRE.

Render costs are budgeted: the Spotlight's 30fps TimelineView holds only the
rail fill and the stage — header/caption/gestures ride a 4 Hz tick; theater
chrome is opaque pseudo-glass (no live blur over an animating surface); the
demo fleet seeds **off-main after first paint**; the contribution wall's
columns are precomputed; the artifacts gallery filters in one pass per body;
wire parsing is Codable and the wire working set is capped (shipped work
evicts first). If the wire drops after being live, Home says so
("Reconnecting to your fleet") and clears itself on recovery — including
across a writer restart (cursor resync).

## Focus & the archive

Project management is default-on: quiet projects (nothing running, nothing
needing a human) arrive **auto-filed**, and the Tidy card sweeps shipped tasks
on tap — animated, with the brand spinner. Archived work is never deleted:
search spans it (labeled, collapsed until asked), `ArchiveView` lists filed
projects with one-tap Restore. Deep into the material, no sprawl.

The sweep obeys the user: Settings → **FOCUS & ARCHIVE** carries the
auto-file toggle, a sweep aging threshold (wire tasks age on real clocks),
and per-project **"never file"** exemptions (added from a project card's
long-press). A project with a live wire pulse un-files itself.
**NOTIFICATIONS** holds per-kind push toggles, quiet hours, and the
escalation preference — persisted now, applied the moment push lands.

## Brand & delight

- [`Brand/DriveMarkReference.png`](Brand/DriveMarkReference.png) is the exact
  approved light/dark steering-wheel reference; its hash and locked geometry
  are recorded in [`Brand/PRINCIPLES.md`](Brand/PRINCIPLES.md).
  `Brand/generate-brand-assets.py` normalizes that reference into
  `Brand/DriveMarkSource.png` and derives the adaptive runtime image,
  the Any/Dark/Tinted app-icon catalog, and legacy simulator icons from it;
  `Sources/DriveBrand.swift` is the only feature-code entry point. Run the
  generator with `--check` after any brand change. The mark is used in Open,
  the Home lockup/control, Work tab, presence chips, reconnect/loading states,
  Profile, and the install icon.
  Agent avatars wear `ClineBotShape` (from the hub's `cline-logo-filled.svg`).
- `Pressable` spring press-feedback on every button; joining overlay on call
  entry; sweep/success haptics. All motion respects Reduce Motion.

## Input & accessibility

- **Swipe between tab pages** (root surfaces only — pushed views keep edge-swipe-back); **swipe the Spotlight** to scrub beats; taps on the thirds still work.
- **Hold to preview**: press-and-hold Home's TODAY tiles, artifact rail cards, and project cards for a peek at what's behind them (iOS context-menu previews) — tap still navigates.
- **Kind-colored progress rail**: plan/decision violet, diagram blue, edit green, run teal, tests lime, result amber (danger red reserved for bug beats) — the program's table of contents for skimmers. Forward skips land 55% into a beat so fast navigation shows the payoff state, and the caption keeps naming who's speaking so audio stays useful mid-skim.
- **VoiceOver**: the Spotlight is one adjustable element (swipe up/down moves beats, value narrates kind/title/director/caption); hold-to-talk exposes a toggle action (press-and-hold isn't VO-operable); icon buttons, tiles, agent rows, and map nodes carry labels/hints; decorative waveforms and rails are hidden.
- **Dynamic Type** via the `scaledFont` modifier (conversation, settings, rows scale; capped at accessibility3); fixed row heights became `minHeight`.
- **Reduce Motion**: system setting *or* the in-app toggle stills the waveform, live pulse, and beat decoration.
- **Haptics** on hold-to-talk, tab swipes, and beat skips.

## Next (release-critical)

- [x] Land the cross-repository product stack and Presenter leave/end writer
      reconciliation; Cline #17 was repaired before merge, and Harness/MCP #4
      merged on 2026-08-19.
- [ ] Replace the local Work chat and preview target registry with the managed
      chat catalog/runtime plus authenticated, revocable target resolution.
- [ ] Connect Profile account surfaces to production account, billing, usage,
      analytics, sign-in, and in-app account-deletion services; decide the
      StoreKit business model before exposing paid digital functionality.
- [ ] Finish the host trust contracts: approval/skill policy sync, memory file
      sync and attribution, and real skill package bodies/generation.
- [x] Add a fail-closed Release channel, target-bundled privacy manifest,
      Settings Reset, production-root XCUITest/accessibility audits, and omit
      local-network configuration from the built Release `Info.plist`.
- [ ] Complete the remaining identity, signing, icon, hosted-service, privacy
      labels/policies, physical-device, TestFlight, and App Review gates in
      [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md).
- [ ] Build the deterministic cross-repository verification workflow in TODO
      §13 so release evidence does not depend on remembered simulator steps.

The cross-repository order and acceptance evidence are maintained in Cline's
[golden-path implementation map](https://github.com/drive-mode/cline-drivecode/blob/main/docs/drivecode/plans/cline-drivemode/initiatives/portfolio-now/README.md).
