# Drive iOS — backlog

Audited 2026-08-19 against repository state, the merged 12-PR stack, and local
verification. A checked box means the work is implemented and verified on the
named branch; it does **not** mean the change is distributed or backed by a
production service.

Delivery snapshot:

- The approved 12-PR stack **merged on 2026-08-18**: `drive-ios` [#1](https://github.com/drive-mode/drive-ios/pull/1)–[#8](https://github.com/drive-mode/drive-ios/pull/8), `collaboration-harness` [#2](https://github.com/drive-mode/collaboration-harness/pull/2)–[#3](https://github.com/drive-mode/collaboration-harness/pull/3), `drivemode-mcp` [#2](https://github.com/drive-mode/drivemode-mcp/pull/2)–[#3](https://github.com/drive-mode/drivemode-mcp/pull/3), and Cline coordinator [#17](https://github.com/drive-mode/cline-drivecode/pull/17) (its `presenterGrantId` integration-CI failure was fixed in `cline-drivecode@9647c40` before merge). All four `main` branches carry the stack.
- Post-merge verification on `main` (2026-08-19, Linux container, no Xcode): harness `bun run check` green (13 tests); MCP `bun test` 16/16 (root `bun run typecheck` needed a fresh-clone resolution fix — see the reconciliation PR); Cline `@cline/shared` 474/474, `@cline/drive` 419/419 after `bun run build:sdk`, focused hub Presenter/room suites 81/81. The iOS Xcode suite was **not** rerun (requires macOS); the standing evidence remains the pre-merge 22-unit + 3-UI-test runs.
- Presenter leave/room-end reconciliation (HANDOFF follow-up #1) is open as harness [#4](https://github.com/drive-mode/collaboration-harness/pull/4) and MCP [#4](https://github.com/drive-mode/drivemode-mcp/pull/4): the standalone fold now revokes a leaving presenter's grant and clears titles on a new `control.end`, mirroring the Cline coordinator. iOS still projects titles from `control.title_*` events only and does not yet mirror those two fold rules (follow-up below).

The app is therefore an implemented **preview on merged `main`**, not shipped
product. The backend connection sequence is planned in
[docs/BACKEND-CONNECTION.md](docs/BACKEND-CONNECTION.md); data requirements
for the durable surfaces remain in [DATA-NEEDS.md](DATA-NEEDS.md); App Store
readiness is planned in [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md).

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
- [x] **Invitation/session push surface** — planned sessions schedule a
      local reminder carrying a SESSION category whose **Join** action
      deep-links into the session; banners show in-foreground too;
      Settings has "Send a test reminder" (also the permission path).
      Verified: push went from "not authorized" → delivered, activation
      joined the session. Real remote push waits on the hub.
- [ ] **Streak widget / Live Activity** for the lock screen. The Xcode project
      now exists; this still needs an extension target, ActivityKit/widget
      product decision, entitlements, lifecycle behavior, and release review.
- [x] Task map: **pinch-zoom + pan** (clamped, 2.6× max, double-tap reset,
      zoom badge) + **overflow clusters** past the 18-node cap — one chip per
      state ("+4 done") that filters the task list below.
- [x] Full **Dynamic Type on brand chrome** — Eyebrow, LivePill, StateChip,
      TaskStateChip, PreviewChip, Home lockup, hero titles, pulse tiles all
      ride `scaledFont` (kerning stays on the Text).
- [ ] **Hands-on VoiceOver audit** with the screen reader actually on
      (labels/actions are in place; behavior needs a human pass).

## 4 · Brand & platform

- [x] **Bundle Schibsted Grotesk** — the OFL variable TTF from Google
      Fonts (`Fonts/`, `UIAppFonts`, copied by build.sh) now drives every
      `scaledFont` call site; mono sites keep the system face. The blocker
      was never the license.
- [x] **Xcode project** with a shared `Drive` scheme, iPhone/iPad device family,
      and `DriveTests`; `build.sh` remains a simulator-preview fallback.

## 5 · Data-dependent (unblocks when transport lands)

- [x] **Wire to `drivemode-mcp` — first consumption landed** (2026-08-17):
      `WriterClient` polls `events_since`; tasks, artifacts, session beats,
      projects, and ages all render from the current writer's append-only log
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
- [x] Real **voice**: hold-to-talk runs AVAudioEngine and the waveform
      draws actual loudness; the tap computes RMS and **drops the buffer
      in the same callback** — nothing retained, written, or transcribed.
      Refusal reads "Mic access off". (Live levels need a hands-on check;
      synthetic dwell registers as a tap.)
- [x] Age-based artifact TTLs against real clocks — wire artifacts count
      down from their own event timestamp (`ttlDays − age`, floored at
      "filing…"). Task sweep aging already reads `wireTaskAt`.
- [ ] Metrics/badges/records earned from real durable-log history; state-bar
      sparklines; search ranking + debounce at 10k+ tasks.
- [ ] Inbox items sourced from push + durable log.

## 6 · Integrations (plan approved, build awaiting green light)

The workspace-only `cline-drivecode/docs/drivecode/plans/cline-drivemode/initiatives/integrations-vcs`
plan currently owns the detail. P0 order: connector ADR + credential
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

## 10 · Agent profiles & skills (2026-08-17 late pass 2)

A skill = a **typed capability with an approval posture** — what an agent
may publish, and what needs a human first. Never prompts/tools/models
(those stay host-side). Contract: `docs/SKILLS.md`.

- [x] **Skill registry** (`AgentSkills.swift`) — eight skills mirroring
      the packs the transport speaks: directing, task running, artifact
      publishing, code editing (gated), test running (gated), research,
      inviting, feedback triage. Each carries its event-kind footprint.
- [x] **Loadouts** — per-agent equipped sets, persisted
      (`skills.<agentId>`), role-matched defaults (Maya directs+invites,
      Cline edits+triages, Scout tests+researches, Indexer archives);
      unknown wire agents get a sane fallback.
- [x] **Agent profiles** — SKILLS section on agent detail (equip toggles,
      gated seals tied to APPROVALS, wire-observed usage counts), loadout
      chips on roster rows, boundary footnote updated.
- [x] **Skill library** — every capability, its wire footprint, who
      carries it (tappable into agent profiles), usage per carrier.
- [x] **Observed usage** — counted off the current-writer log per actorId (beats
      → director; diff artifacts also count as editing evidence, reports
      as testing). Verified live: Maya ×4 directing, Cline ×4 tasks.

**v2 (same day): packages, kits, memory** — skills became multi-file
packages (SKILL.md + on-demand files, dynamic context discovery shown per
file), organized by category (Direction/Delivery/Quality/Knowledge/
Collaboration); **kits** equip sets in one tap (4 built-ins + user-created
via New kit), per-agent **All/None**; every package opens to read, edit
(edits re-enter review), review (Reviewed/Needs work), and **generate a
better one** (Cline drafts v+1: sharpened when-to-use, checklist,
examples.md — accept/discard, verified v1→v2 live); **New skill** scaffolds
a draft custom package from name+description. **Memory** shipped alongside
(docs/MEMORY.md): files-with-hooks across agent/session/task/project/plan
scopes, hook-always/body-on-demand, agent notebooks on profiles, project
memory under maps, task memory on task cards, scope-filtered browser off
the Agents tab, edit-in-place. Verified live: select-all, kit dimming when
fully equipped, package detail + improver, browser with 11 seeded files.

## 11 · Work page, ground up (2026-08-17 late pass 3)

Historical P0, reviewed and verified before the chat-first reset in §12: Work
was rebuilt as **the session lifecycle page** — NOW (live card
w/ 2 Hz beat ticker on the director clock; honest quiet state with real
actions when nothing's live) → INVITATIONS (inbox invites surfaced, Join
now/Later) → UPCOMING (persisted `upcoming.v1`, context-menu remove) →
**Plan a session** composer (project chips → agenda auto-suggested from
blocked/review tasks → people with **directing-skill sparks** → when →
note → Send: creates the upcoming session + inbox receipt, honesty line)
→ EARLIER (session records = replay artifact + session-memory hook,
Play → the replay player). Verified live incl. a composed session
landing in UPCOMING. P1 working tree (2026-08-18): typed session
created/scheduled/started/ended events now drive NOW/UPCOMING; the
composer publishes the ordered lifecycle plus session-linked
`room_invite`s; reminders use the scheduled timestamp. Verified on the
existing iPhone 17 Pro via accessibility labels and writer-log readback.
The product direction changed on 2026-08-18. This lifecycle is no longer Work's
default; it is retained in secondary Calls/History flows under §12 and
`docs/WORK-PAGE.md`. Open P1/P2 remains per-session replay windows and speaking
presence; owner decision: composer on Home too?

Open:
- [x] "Observed but unequipped" surfacing — current-writer evidence now
      suggests and equips missing skills (`4a0c53c`).
- [ ] Skill policy sync to host (rides the approval-sync ask, DATA-NEEDS).
- [ ] Per-skill approval granularity host contract (UI models it already).
- [ ] Memory host contract (file-sync channel, write attribution, session
      TTLs) + memory-aware preheat; add-note composer surfaces.
- [ ] Skill file *bodies* on device (shape shown today; contents ride the
      skills-as-folders host contract); real model-backed generation.

## 12 · Chat-first Work, account surfaces & Agent Titles (2026-08-18)

This is a product-direction change, not another layer on the current Work
page. Work becomes the quiet place to start or resume a chat against an
explicit target; the shipped session lifecycle remains useful, but moves
behind Calls / History instead of filling the default surface. The unfinished
§11 P1/P2 work is re-scoped under this initiative rather than tracked twice.

**Roadmap change:** navigation, Work, Settings, and fleet configuration move
forward now. Skill-policy and memory contracts remain enabling infrastructure.
Showcase P1 and the hosted feedback route move to Later to make room; their
existing entries in §9 remain the source of detail.

### Now · committed core UX

- [x] **Chat-first Work hub** — open on a visually quiet, target-aware chat
      composer. Name the selected GitHub repository, device folder, or saved
      file set without exposing an unapproved raw path. Put **New Chat** and
      **Call** in the top-right, visible without scrolling. New Chat starts a
      clean managed chat; Call uses the default preset or opens the
      configurator. Invitations, upcoming sessions, and replays move to
      secondary Calls / History flows. Do not build a second chat engine:
      converge on the managed chat catalog/runtime when its release gate opens,
      with an honest local preview until then.
- [x] **Navigation escape hatch** — every non-Home root surface gets a visible
      Drive-mark Home control with a VoiceOver label and hint. Pushed screens
      retain native back navigation. Page titles remain titles; they do not
      hide a second back behavior.
- [x] **One Settings modal** — replace separate settings destinations with one
      responsive container: sheet on iPhone, form sheet/sidebar on iPad.
      Entrypoints select the relevant tab (Profile → Account, Work → Work,
      agent profile → Agents). A shared draft store survives tab changes and
      accidental dismissal; reopening restores drafts until Save.
      Persisted switch/picker preferences keep their existing immediate-save
      behavior.
- [x] **Agents at fleet scale** — make Memory and Skills two equal, independent
      controls, each with its own icon, label, hit target, and chevron. Add
      skill search, collapsed categories, result counts, and compact
      checkmark-style equip controls instead of the bright default green
      switches. Agent profiles show a collapsed loadout summary first and
      expand categories on demand. Prove the interaction with 500+ skills.

### Next · contracts and connected capability

- [x] **Profile account surface shells** — Profile links open the shared Settings
      modal directly on **Billing & payments**, **Usage**, and **Analytics**.
      Billing is explicitly backed by `PreviewAccountService`; Usage and
      Analytics only show observable current-writer/local counts. Production account
      plan, payment method, invoices, provider consumption, and cross-device
      outcomes remain connected-service work below. Seeded numbers are never
      presented as live account data.
- [x] **Call presets + configurator** — persist one default call preset plus a
      preference for immediate launch vs always configure. The configurator is
      a feature-isolated sheet/module that chooses opaque targets, agents, and
      Presenter-eligible agents. On the web it may ship as an MFE; native iOS
      consumes the same typed contract rather than embedding a web surface.
- [x] **Persona + model family + title** — keep editable persona names such as
      Maya and Scout. Cline remains the coordinator for routing and presentation
      handoffs. Show an allowlisted family badge such as Claude, Codex, or Apple
      on-device separately from the name, plus execution location (hosted or
      on-device). Exact model/version ids, endpoints, credentials, prompts,
      tool policy, and routing configuration never cross.
- [x] **Agent Titles** — add temporary, scoped, auditable grants that attach a
      reviewed skill bundle, opaque resource grants, delegated-agent refs, and
      bounded abilities to an agent. `Presenter` replaces “spotlight owner” as
      the title that grants typed-stage publishing. Multiple unrelated titles
      may coexist, but only one active Presenter owns a stage; grant, transfer,
      expiry, and revoke are durable events. “Can present” means typed beats,
      artifacts, and views only — never pixel capture or screen streaming.
- [x] **Protect the Director boundary** — the built-in orchestration policy is
      signed, versioned, host-side, and non-exportable. Members may fork or add
      an overlay for allowed Director behavior, but the base prompts, routing
      logic, scoring, tool/model maps, and compiler remain proprietary host
      implementation. Customization is a reviewed input, not the product's
      orchestration source code.
- [x] **System-model local AI spike** — first evaluate Apple
      `SystemLanguageModel` behind runtime availability checks, with read-only
      tools over user-approved security-scoped files. Bound the first
      experience to local summarization, extraction, navigation, and
      triage; do not claim full coding autonomy or advanced reasoning. Handle
      unsupported hardware, Apple Intelligence disabled/not-ready, revoked file
      access, context limits, cancellation, and offline use explicitly. This
      depends on an Xcode project, iPad/device-family support, and privacy-policy
      review. References: [Foundation Models](https://developer.apple.com/documentation/FoundationModels),
      [capabilities and limitations](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models),
      [security-scoped file importer](https://developer.apple.com/documentation/swiftui/view/fileimporter%28ispresented%3Aallowedcontenttypes%3Aoncompletion%3A%29).

### Later · directional bets

- [ ] **Custom local models** — evaluate downloadable Core AI / MLX coding
      models only after the system-model spike establishes thermals, memory,
      storage, context, battery, and App Store constraints on phones/tablets.
- [ ] **Consent-based automatic UI/UX experiments** — reuse the existing
      presentation-only experiment flag lifecycle, then add stable assignment,
      exposure events, outcome metrics, sample-size/stop rules, guardrails, and
      a data-policy revision with re-consent. Experiments may not widen data
      collection, bypass approvals, or silently promote generated UI.
- [ ] **Deferred to fund the reset** — Showcase P1 and the hosted feedback
      route stay in §9 but do not compete with the Now work above.

### Planned interface contracts

- `SettingsTab` and `SettingsRoute(initialTab, source)` open the shared modal;
  `SettingsDraftStore` owns unsaved drafts across presentation lifecycles.
- `WorkTargetRef` represents an opaque repository, directory, file set, or
  device sandbox target with label, access posture, source, and connection
  state. A display path is presentation metadata, never transport authority.
- `CallPreset` references targets, agents, launch behavior, and eligible
  Presenter candidates; it carries ids and policy, not secrets or raw paths.
- `AgentRuntimeBadge` exposes only an allowlisted model-family label and
  execution location.
- `AgentTitleGrant` references the agent, title, scope, skill bundle, resource
  grants, delegated agents, abilities, grant/revoke timestamps, and expiry.
  Titles transfer references; they do not embed skill/resource bodies.

### Acceptance gates

- Work opens on the target-aware composer; New Chat and Call are reachable
  without scrolling, and Calls / History preserve the useful §11 lifecycle.
- Dismissing Settings and reopening from another entry preserves drafts while
  selecting the newly requested tab; Save clears the draft correctly and Reset
  restores the last saved snapshot without discarding cached state on close.
- Every root surface has a visible, VoiceOver-operable route Home, while pushed
  screens still navigate back normally.
- Skill search and folding remain responsive and visually legible with 500+
  entries; equip state is clear without a wall of green switches.
- Presenter ownership is exclusive, temporary, replayable from durable events,
  and incapable of pixel capture.
- Local mode fails honestly for unsupported devices, unavailable models,
  revoked file access, and offline/low-resource states.

### Remaining connected implementation

- [ ] **Land the 12-PR stack** in dependency order and repair Cline PR #17's
      required `presenterGrantId` propagation through Hub/CLI fixtures and the
      stage reducer before treating Presenter coordination as delivered.
- [ ] **Connect managed chat** — replace the one-sided in-memory Work message
      list with the managed chat catalog/runtime: stable chat ids, agent
      responses/streaming, persistence, resume, cancellation, and honest error
      recovery.
- [ ] **Connect real Work targets** — replace `WorkTargetRef.previews` with
      authenticated repository and saved-file discovery plus security-scoped
      device selection, revocation, reconnection, and host-side opaque-ref
      resolution.
- [ ] **Connect account truth** — production sign-in/account service, billing
      and invoices, hosted/local usage, durable user-visible analytics, and
      in-app account deletion. Decide StoreKit vs a permitted business-account
      model before exposing paid digital features.
- [x] **Finish Settings draft controls** — Reset restores the last saved
      snapshot, Save persists the draft, accidental dismissal keeps edits, and
      unit coverage exercises the reset/persistence boundary.
- [ ] **Resolve call presets through the host** and verify default launch,
      configurator launch, Presenter rejection/transfer/expiry/revoke,
      reconnect, and durable replay across the merged stack.
- [ ] **Project runtime identity from the host** — replace fixed agent-id badge
      mappings with allowlisted family/location data, and fetch/verify the
      signed Director policy descriptor plus reviewed overlay state rather than
      hard-coding “Verified” on iOS.
- [ ] **Unify Presenter cleanup semantics** — leaving or ending a room must
      revoke/clear the active grant and stage consistently in Cline, the
      standalone Harness, MCP, iOS projection, and replay tests.
- [ ] **Prove fleet-scale interaction, not only filtering** — exercise 500+
      unique skill ids through SwiftUI rendering, search, category folding,
      Memory/Skills navigation, equip changes, VoiceOver, and latency budgets.
- [ ] **Validate local AI on physical devices** — eligible/unavailable hardware,
      iOS 17–25 fallback, Apple Intelligence off/model-not-ready, Files/iCloud
      providers, revoked access, locale/refusal/context/cancellation, offline,
      thermal, memory, and battery behavior.
- [x] **Add a fail-closed Release boundary** — Debug keeps the labeled preview;
      Release suppresses seeded customer/account/social data, experiments,
      billing and fake sign-in, refuses loopback/LAN writer URLs, omits local-
      network keys from the built plist, and uses a target-bundled privacy
      manifest. Unit plus production-channel XCUITest/accessibility coverage
      protects the boundary.
- [ ] **Finish production distribution and services** — choose the production
      bundle id/team/signing/version, connect the authenticated HTTPS reviewer
      service and real accounts/targets, remove compiled preview-only fixtures
      if required by the frozen scope, finalize privacy labels/public URLs,
      qualify icons/devices, and upload the accepted candidate. Detailed gate:
      §14 and [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md).

## 13 · Deterministic cross-repo verification (2026-08-18)

The current session-registry demo spans `drive-ios`, `drivemode-mcp`, and
`collaboration-harness`, but its successful verification still depends on
scratchpad seed scripts, remembered process state, manual simulator steps, and
logs gathered from several places. Build a repeatable developer workflow around
the durable protocol before adding more session behavior. This is a developer-
experience track alongside §12, not application scope or a replacement for the
hands-on interaction and VoiceOver passes already called out in §§3/9/11.

**Resolved boundaries:** `collaboration-harness` owns protocol schemas and
canonical fixtures; `drivemode-mcp` owns the executable orchestration and writer
replay; `drive-ios` owns launch-only determinism and accessible automation
surfaces. The CLI owns reproducible mechanics, while product judgment and task
selection remain with a human or thin agent skill. Machine state is discovered
or generated from repository truth rather than maintained as a second handoff
source that can silently drift.

### Now · contract, feasibility, deterministic inputs

- [ ] **Specify the `drive-dev` contract before implementation** — define
      `doctor`, `check --all`, `writer --fixture <name>`, and `verify
      <scenario>` commands with one versioned JSON result envelope, documented
      phase names, stable exit-code classes, absolute artifact paths, and
      actionable failure details. Reserve `next --json` for explicitly ranked
      backlog/configuration data; it must not invent priorities from dirty-tree
      heuristics. No command may require a developer-specific path, simulator
      UDID, or fixed port.
- [ ] **Prove the simulator/UI adapter boundary** — determine which checks and
      actions can run in a normal executable and which require an agent-facing
      XcodeBuildMCP workflow. Do not couple `drive-dev` to private daemon state
      or scrape MCP internals. The spike must leave one supported adapter
      contract, an honest missing-capability result, and a path that works with
      the current Xcode project and `build.sh`; decide explicitly which checks
      belong in XCTest/XCUITest and which stay in the external adapter.
- [ ] **Add a deterministic iOS launch configuration** — stable accessibility
      identifiers for the session entry, lifecycle controls, invitations,
      upcoming rows, replay, and evidence-bearing states; process-only overrides
      for writer URL and onboarding; injectable clock/age values; and reduced
      nonessential animation in automation mode. Keep useful accessibility
      labels, values, traits, and hints—the identifier is not the VoiceOver
      name. Normal launches must retain production behavior, and test launches
      must not mutate persistent defaults.
- [ ] **Create canonical versioned fixtures** — in `collaboration-harness`, add
      a Zod-validated lifecycle fixture for create → schedule → start → invite
      → end with one shared session id and explicit ordering rules. In
      `drivemode-mcp`, replay that fixture through the real writer boundary and
      add a richer preview scenario covering roster, beats, tasks, artifacts,
      invitations, and upcoming sessions. Reject malformed or incompatible
      fixture versions with a phase-specific error.

### Next · one-command verification and recovery

- [ ] **Implement `drive-dev` in `drivemode-mcp/tools/drive-dev`** — preflight
      all three repositories and required toolchains; reuse an already booted
      matching simulator when safe; choose an available ephemeral writer port;
      retain the exact child PID; seed through the canonical replay path; build
      and install once; launch with temporary configuration; exercise the UI
      through stable identifiers; and assert lifecycle order and shared ids
      against writer readback. Never kill by port alone or terminate an
      unrelated writer/app process.
- [ ] **Produce a self-contained evidence bundle** — every verification run
      writes a versioned report plus command/runtime metadata, writer and app
      logs, assertion results, and named screenshots to one run directory.
      JSON output references stable absolute paths and distinguishes preflight,
      writer, fixture, build, install, launch, UI-action, protocol-assertion,
      evidence, and cleanup failures without masking the primary cause.
- [ ] **Make cleanup transactional and interruption-safe** — record only state
      the run owns, restore launch configuration and simulator/app state on
      success, failure, and Ctrl-C, and report any incomplete restoration.
      Cover expired snapshots, missing or ambiguous simulators, writer startup,
      fixture rejection, build/install/launch failures, stale UI references,
      assertion failures, and evidence-write failures. Run the scenario twice
      against the same booted simulator to prove idempotence and absence of
      leaked listeners or persistent settings.
- [ ] **Add cross-repo checks** — `drive-dev check --all --json` runs each
      repository's supported validation (`bun run check` / `bun test` and the
      iOS build or selected test adapter), records the starting worktree state,
      and confirms verification introduced no tracked diff. Existing developer
      changes are reported and preserved, never cleaned or rewritten.

### Later · generated handoff, skill wrapper, workflow polish

- [ ] **Generate, do not hand-maintain, handoff state** — expose current
      baselines, repository revisions/status, available scenarios, verification
      command, evidence paths, explicit owner gates, and any backlog-ranked next
      item as generated JSON/YAML under a gitignored `.drive-dev/` workspace.
      If a committed manifest is needed, limit it to stable repository roles,
      commands, and schema versions; current status and hashes stay generated.
- [ ] **Add a thin user-level verification skill after the CLI stabilizes** —
      with owner approval, teach the skill to call the public `drive-dev`
      contract, interpret its structured result, and link evidence. It must not
      duplicate shell orchestration, embed developer paths, or bypass cleanup
      and policy gates.
- [ ] **Document and measure the workflow** — quick start, result schema,
      scenario authoring, artifact layout, recovery/troubleshooting, and the
      boundary between automated evidence and hands-on checks. Record median
      setup/verification time and manual intervention count; target a reduction
      from the current roughly 20–30 minute flow to 3–5 minutes without trading
      away failure diagnostics.
- [ ] **Add project-native UI tests where they improve evidence** — the Xcode
      project now exists; use the adapter spike to decide which external UI
      steps should move into XCTest/XCUITest. Keep microphone hold behavior, SwiftUI toggle
      semantics, drag reorder, and full VoiceOver navigation as named hands-on
      gates until automation demonstrates equivalent coverage.

### Planned developer contracts

- `DriveDevResultV1` carries command, scenario, run id, status, failed phase,
  exit class, timings, diagnostics, artifact directory, and owned-resource
  cleanup results; stdout stays machine-readable and human progress goes to
  stderr.
- `DriveDevScenarioManifest` pins fixture/schema versions, required app
  capabilities, UI steps, typed-event assertions, evidence requests, and supported
  adapter versions without containing machine-local paths or secrets.
- `DriveAutomationLaunchConfig` is process-scoped and includes writer endpoint,
  onboarding disposition, deterministic clock seed, and animation posture. It
  is ignored unless an explicit automation launch flag is present.
- `DriveDevRunState` records only resources created or changed by the current
  run (child PID, selected simulator, installed-app/config snapshot, temporary
  files), enabling precise rollback without broad process or filesystem cleanup.

### Acceptance gates

- A fresh developer can run one documented command from any location inside the
  workspace; it discovers the three repositories and reuses a suitable booted
  simulator without a hardcoded UDID, user path, or port.
- The canonical session scenario is validated at the schema boundary, rendered
  through the app, and asserted from typed writer events with one session id
  and the required lifecycle ordering.
- Success and every tested failure produce a phase-specific result and a stable
  absolute evidence directory; Ctrl-C still performs owned-resource cleanup.
- Persistent app configuration and all three tracked worktrees match their
  pre-run state. Pre-existing changes remain untouched, unrelated processes are
  not killed, and two consecutive runs pass without leaked state.
- The automated report names the remaining hands-on checks rather than implying
  coverage of microphone gestures, native control feel, reorder gestures, or a
  complete VoiceOver audit.

## 14 · App Store and TestFlight readiness (2026-08-18 audit)

Canonical execution plan: [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md).
Current verdict is **NO-GO** for both public App Store submission and external
TestFlight. Local development evidence remains valid. The app now has a
production-channel shell, privacy manifest, Release plist separation, and
XCUITest/accessibility smoke, but the stack remains unmerged and the candidate
still lacks its final identity/signing, authenticated reviewer service, real
accounts/targets, approved policies/labels, upload, and physical-device proof.

Implemented in the 2026-08-18 release-hardening slice:

- [x] `AppConfiguration` defaults unknown channels to production and rejects
      loopback, `.local`, empty, and non-HTTPS writer endpoints in Release.
- [x] Release starts with no seeded agents, tasks, calls, inbox, memory,
      artifacts, profile outcomes, Showcase, feedback experiments, fake billing,
      or fake account actions; unavailable integrations say so explicitly.
- [x] `PrivacyInfo.xcprivacy` is copied into the app and declares tracking false
      plus the app-preference `UserDefaults` reason `CA92.1`.
- [x] `DriveUITests` verifies production Work/Home/Profile behavior and runs
      `performAccessibilityAudit`; the shared scheme runs unit and UI targets.
- [x] A simulator Release build succeeds and its built plist contains
      `DriveReleaseChannel=production` with no local-network exception.

The release plan now carries the provisional v1 scope, owner decisions D01–D12,
dependency program R0–R6, guideline coverage, and evidence-binder manifest.
Execution order is scope/ownership → merge the 12-PR stack → parallel
distribution/service/privacy/quality tracks → internal TestFlight → external
TestFlight → App Review → manual/phased release.

### Now · make a release candidate possible

- [ ] **G0 product freeze** — name owners; decide public-v1 feature set,
      StoreKit/free-companion/organization-only business model, hosted-agent
      posture, Showcase/UGC exclusion or moderation scope, and Guideline 4.7
      architecture interpretation. Resolve and record every D01–D12 entry in
      the release evidence binder; the recommended low-risk v1 is a free
      companion with Showcase, experiments, LAN setup, and paid chrome disabled.
- [ ] **G1 distributable identity** — production App ID/bundle id, developer
      team/signing, Release configuration, asset-catalog/Icon Composer icons,
      Xcode 26+ archive, accepted App Store Connect upload, and no preview/debug
      artifacts in the submitted binary.
- [ ] **G2 privacy and security truth** — complete data-flow inventory,
      final required-reason binary audit, public policy/privacy-
      choices/support URLs, accurate privacy labels, hosted-AI consent,
      Keychain/server authorization, threat model, and final-archive scan.
- [ ] **G3 real account and commerce** — authentication/sign-out, in-app account
      deletion, login-service compliance, connected account/billing/usage data,
      and an end-to-end StoreKit lifecycle or documented valid non-IAP posture.
- [ ] **Reviewer-accessible services** — authenticated HTTPS staging tenant,
      synthetic non-expiring reviewer account/data, monitored availability, and
      optional LAN pairing/purpose copy tested on physical hardware.

### Next · prove safety and quality

- [ ] **G4 AI/UGC safety** — provider/rights inventory, just-in-time consent,
      adversarial agent tests, output reporting, canonical Presenter cleanup,
      updated age rating, and either hosted Showcase moderation or a release
      kill switch.
- [ ] **G5 release-quality matrix** — extend the implemented production-root
      XCUITest/accessibility smoke to physical iPhone/iPad permissions and
      file-provider passes, Foundation Models
      availability/thermal/battery tests, common-task VoiceOver/Voice Control/
      AX5 coverage, network/IPv6/offline/restart, and meaningful microphone
      behavior or removal of the claim.
- [ ] **G6 TestFlight exit** — upload the exact release build; complete beta
      metadata/export answers; run internal then external testing; reach zero
      P0/P1, 100% deletion/entitlement pass, the backend SLO, and cross-functional
      Release/Privacy/T&S/Payments/Accessibility/QA sign-off.

### Later · submit and operate

- [ ] **G7 submission packet** — final metadata, rights/rating/privacy/export/
      regional declarations, truthful iPhone/iPad screenshots, review notes and
      attachments, second-person claim audit, and a frozen review environment.
- [ ] **G8 manual/phased release** — responsive reviewer communication,
      rejection-to-evidence workflow, production monitoring, and rollback for
      deletion, entitlement, undisclosed egress, consent, moderation, crash,
      availability, secret/pixel, or title-scope failures.

### App Store acceptance gates

- App Store Connect accepts a production-signed archive with the final identity,
  icons, manifest, entitlements, symbols, and no validation warnings left
  unexplained.
- The uploaded build, public policy, privacy labels, in-app copy, backend,
  provider consent, retention, and deletion behavior agree exactly.
- Reviewers can exercise every enabled feature against synthetic production-
  equivalent services without a developer Mac, fixed port, expiring login, or
  hidden setup.
- Common tasks pass on supported iPhone/iPad devices and assistive technologies;
  no P0/P1 remains and all unavailable/offline/revoked states are honest.
- Account deletion, commerce entitlement/restore (if used), AI consent,
  moderation (if used), Presenter scope, and rollback have auditable evidence.
