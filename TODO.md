# Drive iOS — backlog

> §1 and §7 closed 2026-08-17 (same day). §2b perf audit fully applied,
> §2 policy/notification controls, §3 artifact detail + map zoom/cluster +
> brand-chrome Dynamic Type, and §5 wire consumption (agents, interrupts,
> beat stage content, reconnect) closed 2026-08-17 (evening pass, verified
> on-simulator against a live writer). Data requirements for §5 specified in
> [DATA-NEEDS.md](DATA-NEEDS.md).

Audited 2026-08-17 against the full working-session history. Everything asked
for in-session **shipped and was verified on-simulator** except the items
below (plus three call-language strings caught and fixed in the audit).

## 1 · Quick wins (small, high trust)

- [x] **Persist per-agent approval toggles** (AppStorage per agent; verified on-disk) — `AgentDetailView` uses `@State`;
      resets on relaunch. The most trust-sensitive config in the product.
      (Flagged in the power-user review as "smallest work, biggest trust.")
- [x] **Make voice rows editable** (menu pickers; footnote follows the choice) — Mic default / Talk gesture in
      Configuration are display-only value rows (open owner decision #2 on the
      default itself).
- [x] **App icon from the official mark** (canvas-rendered from the SVG; on the springboard) — springboard still shows the
      placeholder; needs a rasterized icon + `CFBundleIcons` in the build
      script.
- [x] **Custom-range segment visual pass** (verified — clean as-is) — Activity's Custom range works but
      was never visually verified; give it the same polish as Week/Month/Year.

## 2 · Power-user layer (from the UI/UX review)

- [x] Long-press context menus on **project cards and agent rows** (pin/file
      project; quick approval toggles on agents) — standard `.contextMenu`;
      synthetic long-press can't be driven headlessly, needs a hands-on tap.
- [x] **Pin/focus set** for projects (persisted; pinned sort first, pin badge).
- [x] **Bulk select** in All-tasks (Select → checkmarks → "File N to archive").
- [x] **Archive policy controls** — Settings → FOCUS & ARCHIVE: auto-file
      toggle, sweep aging threshold (wire tasks age via `wireTaskAt`),
      per-project "never file" (project-card long-press + NeverFileView).
- [x] **Notification preferences** — Settings → NOTIFICATIONS: per-kind
      toggles, quiet hours (from/to), escalation picker (Slack option waits
      on the Slack connection); persisted, applied when push lands.
- [ ] Inbox: decide on **custom filter names** ("rename" — open question) and
      saved filters.

## 2b · Performance backlog (from the subagent audit — top items applied)

Applied 2026-08-17: guarded wire-status publishes (killed an app-wide re-render
every 1.5s while offline), scenePhase pause/resume + adaptive polling with
backoff, per-second call clock moved to a TimelineView leaf, precomputed
archive/sweep counts, folded search index, cached dependency-map layouts
(read-through, LRU 8), single-write reply mutation, Equatable row models,
`formUnion` sweep. Plus the intent engine (Markov + priors) pre-warming
predicted surfaces — diagnostics in Settings → WIRE.

Closed 2026-08-17 (evening): spotlight chrome now rides a 4 Hz tick while
only the rail + stage live in the 30fps TimelineView (#3); theater chrome
swapped to opaque pseudo-glass — no live blur over a 30fps surface (#4);
DemoScale fleet seeds off-main after first paint, guarded against a live
wire (#6); ContributionGrid columns/labels precomputed in ActivityDemo
(#7/#9); wire dicts capped with done-first eviction (#12); artifacts
pipeline is one pass per body incl. kind counts (#15); wire parsing is
Codable structs, no `[String: Any]` (bonus: writer-restart resync when
`latestSeq < cursor`). #14 resolved by design: context menus stay on
project/artifact cards because the containers are lazy — only visible
cells instantiate menus; flat task rows never had them.

## 3 · Product surfaces & delight

- [x] **Artifact detail views** — every artifact opens: replays play their
      beat program in a self-clocked `ReplayPlayer` (scrub by tap/swipe/VO),
      diffs render as diffs, the rest get a directed-summary preview; plus
      lineage card, inline lifecycle chips, real "Open in session" + Share.
- [ ] **Invitation push surface** — "Maya invited you to a working session" as
      a notification + lock-screen approve action (inbox card exists in-app).
- [ ] **Streak widget / Live Activity** for the lock screen (needs an app
      extension → waits on the Xcode project, §4).
- [x] Task map: **pinch-zoom + pan** (clamped, 2.6× max, double-tap reset,
      zoom badge) + **overflow clusters** past the 18-node cap — one chip per
      state ("+4 done") that filters the task list below.
- [x] Full **Dynamic Type on brand chrome** — Eyebrow, LivePill, StateChip,
      TaskStateChip, PreviewChip, Home lockup, hero titles, pulse tiles all
      ride `scaledFont` (kerning stays on the Text).
- [ ] **Hands-on VoiceOver audit** with the screen reader actually on
      (labels/actions are in place; behavior needs a human pass).

## 4 · Brand & platform

- [ ] **Bundle Schibsted Grotesk** (needs OTF/TTF — iOS can't register the
      woff2 we mirror; ask design for the desktop app's font files).
- [ ] **Xcode project (or xcodegen)** once resources/entitlements grow beyond
      the swiftc pipeline.

## 5 · Data-dependent (unblocks when transport lands)

- [x] **Wire to `drivemode-mcp` — first consumption landed** (2026-08-17):
      `WriterClient` polls `events_since`; tasks, artifacts, session beats,
      projects, and ages all render from the durable log when the writer runs
      (demo world offline). `room.invite` shipped through the whole stack
      (harness PR #1 → writer `room_invite` → inbox card, real ages).
- [x] **Wire consumption, second pass** (2026-08-17 evening, all verified
      live): **agents from `control.join` participants** (latest work line as
      status, uptime from join, blocked tasks flip Needs you); **interrupts
      derived from blocked wire tasks** (state-event `summary` becomes the
      quoted ask); **beat stage content via `relatedEventIds`** (plan
      checklists / test rows render the actual work events); **reconnect UX**
      (live→dropped shows the Home chip "Reconnecting to your fleet", clears
      on recovery; writer-restart resync when the log resets). Fixed along
      the way: leaving theater no longer strands landscape; a live wire pulse
      un-files a same-named auto-filed demo project. Remaining: spotlight
      card category mapping for the new kinds (harness follow-up).
- [ ] Real **voice**: hold-to-talk capture, in-memory only (privacy-strict).
- [ ] Age-based archive TTLs against real clocks (artifact TTLs + task sweep
      are state-based demo values today).
- [ ] Metrics/badges/records earned from real durable-log history; state-bar
      sparklines; search ranking + debounce at 10k+ tasks.
- [ ] Inbox items sourced from push + durable log.

## 6 · Integrations (plan approved, build awaiting green light)

Per `initiatives/integrations-vcs` — P0 order: connector ADR + credential
generalization → `packs-vcs`/`comms.*` zod (+ secret-shape rejection) →
tier-0 remote health in Status Hub → GitHub App adapter (device flow, PR,
webhooks) → Slack interrupts + deep links → **Connections settings surface**
(also the missing first-run setup step).

## 7 · Design ops

- [x] **Sync v2 surfaces back to the Drivecode Design System project** (9 live-build screen cards + Data-needs card under ios/v2/) — the
      13 artboards still show v0.1; app has since gained tabs, directed
      Spotlight/theater, task map, conversations, inbox, activity calendar,
      artifacts lifecycle, "Your week", ambient bar, session language.

## 8 · Owner decisions (staged, not blocking)

- Naming lockup ("Drive" vs "Cline Drive") — variant card staged
- Mic default (muted vs hold-hot) — variant card staged
- PWA install posture
- Slack inline-approve vs deep-link-only (integrations decision #3)
- Inbox "rename" intent — custom filter names? (question back to Harrison)
- Showcase naming: "Drivemode by Cline" vs "Drive Showcase" (SOCIAL.md)
- Showcase comment identity: name only vs avatar+name

## 9 · Customization, feedback & showcase (2026-08-17 late pass)

Designed first (docs/), then built, verified on-simulator:

- [x] **Docs before build**: `docs/FEEDBACK-MODE.md` (roles, consent,
      one-week trial lifecycle, kill switch, invariants),
      `docs/PRIVACY-POLICY.md`, `docs/DATA-POLICY.md` (data classes A–E,
      exact suggestion payload), `docs/SOCIAL.md` (Drivemode "by Cline"
      thesis, phases P0–P3, risks).
- [x] **Profile customization** — every stat block is a module: show/hide +
      drag-reorder via the Customize sheet (AppStorage-persisted), with an
      "Ask Cline for a layout" suggested arrangement.
- [x] **Feedback mode** — two switches (program + device opt-in through the
      consent policy screen); floating Cline bubble; ephemeral design chat
      that drafts a structured proposal; explicit Send; **experiments with
      a real 7-day clock** (self-expiring, End-trial revert, kill switch).
      One shipped variant proves the loop: Focus Home (verified live:
      suggest → trial → Home switches → revert → "still in review").
- [x] **Policy surfaces in-app** — Privacy & account → POLICIES renders all
      three; the feedback policy doubles as the consent gate.
- [x] **Hold-to-preview** — press-and-hold peeks on Home's TODAY tiles
      (tasks/agents/needs-you summaries), artifact rail cards, and project
      cards (counts + attention queue), with Open actions in the menu.
- [x] **Showcase P0 prototype** — profile grid of project squares (state +
      Cline watermark), friends row, project pages with README tab, DEMO
      tab (the directed replay IS the demo), People tab (team, join-session
      CTA, friend comments + composer), FROM FRIENDS rail on Home,
      "Your showcase" entry on Profile.

Open from this pass:
- [ ] Hands-on pass for what headless taps can't drive: SwiftUI toggles
      (incl. the consent flow end-to-end), hold-to-preview feel, customize
      drag-reorder. (Menus/buttons/navigation all verified.)
- [ ] Feedback backend route (suggestions are client-side in preview) —
      typed `feedback.suggestion` channel per DATA-POLICY addendum.
- [ ] Showcase P1: map squares to real repos (rides integrations/VCS);
      publish flow with secret-shape lint; block/report before any P2.
- [ ] Feedback bubble placement vs FROM FRIENDS rail overlap on short
      screens — nudge or auto-dodge.
