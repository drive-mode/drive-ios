# Drive iOS — MC1 consumer shell (preview)

SwiftUI implementation of the **Frontier phone shell** design for Drive —
voice-first pair programming. Stay on a call with your agents, watch work land
on the Spotlight, steer from anywhere.

**Maturity: PLANNED · design-intent demo, wire-consuming.** Every surface
renders and the demo narrative flows (join session → approval interrupt →
Allow → change lands → Status Hub / Needs you update). With the
`drivemode-mcp` writer running, tasks, artifacts, beats (including staged
related work events), agents, interrupts, and invitations all come off the
durable log; offline, the seeded demo world (~750 tasks / 220 projects)
carries the same shapes. No voice yet.

## Design SoT

- Artboards: **Drivecode Design System** project on claude.ai/design → `ios/` groups
  (synced from `../design-artboards/`)
- Brand locks: `../cline-drivecode/docs/drivecode/design/brand/MOBILE-BRAND-STYLING.md`
- Tokens live in [`Sources/Theme.swift`](Sources/Theme.swift) (`DT`) and alias the Hub variables

## Build & run (no Xcode project needed)

```bash
./build.sh   # swiftc -> build/Drive.app (iOS Simulator, arm64)
xcrun simctl install booted build/Drive.app
xcrun simctl launch booted ai.drivemode.drive.preview
```

## Surfaces

Tabs: **Home · Call · Agents · Tasks**, profile off Home's avatar.

| Screen | File | Notes |
|---|---|---|
| Open | `Sources/OpenView.swift` | Brand hero · Preview chip · one violet verb |
| Home (+tabs) | `Sources/HomeView.swift` | Live hero · today tiles · needs-you pill · profile |
| Call tab | `Sources/CallTabView.swift` | Live room · start a room · replays |
| **Directed Spotlight** | `Sources/SpotlightDirector.swift` | The star: typed beats (plan / diagram / edit / run / tests / decision / result), story rail, tap-to-scrub, looping program |
| Live call | `Sources/LiveCallView.swift` | Portrait + **theater** (landscape) layouts · rotate control (`requestGeometryUpdate`) · glass hold strip |
| Approval | `Sources/ApprovalView.swift` | Light sheet over dark call · Deny / Allow |
| Agents | `Sources/AgentsView.swift` | Status-hub tiles + rows (loadout chips) → per-agent profile: **skills** (equip/unequip, gated seals, wire-observed usage), appearance, approvals, reporting |
| Skills | `Sources/AgentSkills.swift` | The registry + library: a skill is a **typed capability with an approval posture** — its event-kind footprint on the wire, who carries it, how often the log saw it used. Prompts/tools/models never cross (docs/SKILLS.md) |
| Tasks | `Sources/TasksView.swift` | **Fleet scale** (~750 tasks · 220 projects seeded): attention rail → lazy project grid (agg cards, state bars) → search across everything; virtualized all-tasks list |
| Project map | `Sources/ProjectMapView.swift` | Per-project dependency map, positions **computed** (topological layers, wrapped columns, 18-node cap) — any project renders readable |
| Needs you | `Sources/NeedsYouView.swift` | Interrupt triage — cards open the conversation |
| Conversation | `Sources/ConversationView.swift` | The thread an interrupt points at: report_status trail · agent ask · quick replies · voice |
| Profile | `Sources/ProfileView.swift` | **Your week**: Steer/Answer/Ship rings (Activity-style, animated), personable insights, day chart with crowned best day, trend arrows, records, streak, badges — every block a **module you show/hide/reorder** (Customize sheet + "Ask Cline for a layout"); showcase entry; settings entries |
| Artifacts | `Sources/ArtifactsView.swift` | Kind-colored gallery + **lifecycle**: permanent ("keeps") vs ephemeral (TTL badge, auto-files to archive); group by project/repo/day/type; filter by kind/size/life; sort; context-menu TTL control |
| Artifact detail | `Sources/ArtifactDetailView.swift` | Every artifact opens: **replays play their beat program** (self-clocked `ReplayPlayer`, scrubbable), diffs render as diffs, others get a directed-summary preview — plus lineage, inline lifecycle chips, Open in session, Share |
| Activity | `Sources/ActivityView.swift` | The Today calendar: week bars, month calendar + **GitHub-style contribution wall** (darker squares = more activity, 5-level violet scale, horizontal year scroll), custom range — tap a day/square for per-project breakdown |
| Settings | `Sources/SettingsView.swift` | Configuration + Privacy & account · WIRE status + intent diagnostics · FEEDBACK & EXPERIMENTS · POLICIES |
| Showcase | `Sources/ShowcaseView.swift` | **Drivemode "by Cline"** (P0): your profile as a grid of project squares; project pages with README, DEMO (the directed replay), and People (team · join-session CTA · friend comments); FROM FRIENDS rail on Home. Private by default — see docs/SOCIAL.md |
| Feedback mode | `Sources/FeedbackMode.swift` | Two-switch program + opt-in (consent-gated); ephemeral design chat with Cline that drafts structured suggestions; **experiments with a hard 7-day clock** — try a variant, watch the app change, revert any time. docs/FEEDBACK-MODE.md is the contract |
| Policies | `Sources/PolicyViews.swift` | Privacy / Data / Feedback-mode policies rendered in-app; the feedback policy is the consent gate. Full text in docs/ |
| Inbox | `Sources/InboxView.swift` | Tray icon + unread badge on Home. Two voices — **For you** (approvals, blocked asks, invitations, ships, streaks) and **Product** (news, tips) — with read/unread, swipe archive/delete, filters, Read-all, context menus, and inline act (Deny/Allow, Reply, Join session) |

**Language:** sessions, not calls. The tab is **Work**; people are *invited to a
working session* (pair programming with a friend), never "called." Avoid
naming that makes people dodge the feature.

**Guide bar:** ambient — hides after ~6s idle; summoned by pressing the
bottom-center grabber or swiping up there. Never auto-appears on tab swipes:
a swiping user already knows the way.

The Spotlight never streams pixels — agents publish typed work events
(the harness's `work.plan` / `work.edit` / `work.test` / `work.decision` packs)
and the director choreographs them into beats a phone can digest, portrait
or rotated. Beats loop as the room's replayable program.

## Cline & lineage

The main agent is **Cline** — every agent wears the Cline bot mark
(`ClineBotShape.swift`, converted 1:1 from the upstream icon), told apart by
color; humans keep initials. Agent detail carries **Lineage**: the pie of the
agent's tasks by project, russian-doll project▸task rows, sessions they
direct, artifacts they produced — all derived from durable-log `actorId`, a
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

- `DriveMarkShape.swift` is the **official Drive mark converted 1:1 from
  `cline-drivecode/assets/drive/cline-drive-mark-layers.svg`** (locked by
  DEC-drive-mark-official) — the sporty flat-bottom D-rim steering wheel with
  the Cline head as hub, in two layers (`DriveWheelShape` + `DriveHeadShape`).
  Motion rule from DRIVE-MARK.md: **the wheel turns; Cline stays upright** —
  `DriveSpinner` rotates only the wheel layer. Used in Open (idle wiggle),
  the Home lockup, presence chips, the reconnect chip, and the app icon.
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

## Next (build-out)

- [x] Wire to `drivemode-mcp` writer — tasks, artifacts, beats (+related
      events), agents, interrupts, invitations, reconnect UX all consume
      `events_since` (see TODO §5)
- [ ] Real voice: hold-to-talk capture, in-memory only (privacy-strict — no transcript persistence)
- [ ] Push for interrupts → Needs you as notification landing surface (preferences already in Settings)
- [ ] Bundle Schibsted Grotesk (needs OTF/TTF from design)
- [ ] Owner decisions: naming lockup, mic default, PWA — variant cards staged in the design project
- [ ] Xcode project (or xcodegen) once the app grows resources/entitlements (unblocks widgets/Live Activity)
