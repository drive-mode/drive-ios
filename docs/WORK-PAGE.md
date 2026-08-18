# The Work page, from the ground up

Review → redesign → plan for the Work tab. The whole user experience is
in scope: entry, states, motion, language, honesty, accessibility, and
what the page is *for*.

## Review — what the page is today, honestly

Today's Work tab is three things stacked: the same IN SESSION hero Home
already shows, a "Start a session" button that secretly just joins the
demo session, and two static "recent" rows whose Replay labels don't
replay anything.

The audit, part by part:

| UX part | Today | Verdict |
|---|---|---|
| Reason to visit | None — Home already has the hero | ✗ redundant |
| "Start a session" | Fake: joins the existing demo call | ✗ dishonest affordance |
| Live context | Static subtitle; no sense of what's happening inside | ✗ opaque |
| Invitations | Live in the inbox only — the session tab never shows them | ✗ missing |
| Upcoming | No concept of a scheduled/planned session | ✗ missing |
| Records | "Recents" rows, disconnected from replay artifacts and memory | ✗ dead ends |
| Empty state | Page assumes a live session forever | ✗ unconsidered |
| Wire truth | Ignores wire presence/beats entirely | ✗ demo-only |
| New systems | No skills, no session memory, no composer | ✗ predates them |
| Language | Title "Work" ✓; body copy fine | ✓ keep |
| Swipe/guide bar | tabSwipe ✓, ambient bar ✓ | ✓ keep |

The page predates everything the product now knows: sessions have
invitations, agents have skills, sessions leave memory and replays.

## The thesis

**Work is the session lifecycle page.** One page that answers, top to
bottom: *what's live right now → who's inviting me → what's coming →
how do I start one → what happened before.* Home is the doorway;
Work is the front porch of the room — it should show you the inside
before you commit, and hold the records after.

Differentiation rule: Home's hero says "a session exists — join." The
Work page's live card says *what the session is doing right now* (the
current beat, live), because that's what makes joining feel worth it.

## The redesign, section by section

### 1 · NOW — the live card with a beat ticker
Title, LIVE pill, the people in the room (humans as initials, agents as
Cline bots), and the differentiator: a **live beat ticker** — the
current beat's kind chip + title over the kind-colored progress rail,
updating at 2 Hz off the same director clock as the Spotlight. Join is
the only verb.
- **Quiet state** (no live session): the card becomes an honest quiet
  state — "No session live" — with the two real actions: *Plan a
  session* and *Watch the last replay*. Never a fake LIVE.
- **Wire truth**: live when the session registry carries a started,
  unended session (or the demo world is offline). Until that session's
  first directed beat arrives, the card says so instead of borrowing a
  different program. Once beats arrive, the ticker reads the same
  `directorPosition` the Spotlight uses — one clock, no drift.

### 2 · INVITATIONS — the entry ritual, surfaced
Unarchived invitations from the inbox render here as first-class rows:
inviter avatar, note, **Join now** / **Later** (Later marks read,
keeps the inbox item). People don't like being called; the tab where
sessions live is exactly where being *invited* should be visible.

### 3 · UPCOMING — sessions that exist before they're live
Planned sessions with when, people, and agenda size. Sourced from the
composer (below) plus anything the wire schedules later. Context menu
removes. This is the page's memory of intent.

### 4 · PLAN A SESSION — the composer (the old button, made real)
A sheet, not a lie:
1. **Project** — picked from the real project registry (attention-sorted).
2. **Agenda** — auto-suggested from that project's blocked/review tasks
   (the things that actually need humans), toggleable.
3. **People** — agent chips with **skill hints** (a directing badge shows
   who can run the room — the skills system feeding session setup).
4. **Note** — the invitation line, prefilled with the session language.
5. **Send invitations** — on a live wire, publishes create → schedule →
   optional start → one session-linked invite per selected agent. Offline
   preview keeps an explicitly local session; a dropped wire asks the user
   to reconnect instead of silently forking state.

### 5 · EARLIER — session records, not dead rows
Every replay artifact is a session record card: title, beats/duration
meta, **Play** (opens the replay player that already exists), and —
when session memory holds notes for that room — the **"what landed"
hook** with a link into the memory file. Records = replay + notes,
the durable pair the session leaves behind.

### Page-wide UX decisions
- **States**: live / quiet / wire-dropped (last synced registry remains
  coherent; mutations wait for reconnect) / first-run (quiet state +
  seeded upcoming makes the page legible before any session).
- **Motion**: ticker at 2 Hz periodic (information, not decoration —
  allowed under Reduce Motion; the LivePill still stills itself).
  Composer and rows use the standard springs; Pressable everywhere.
- **A11y**: live card is one element ("Live: <title>, beat 3 of 8,
  <beat title>. Join."); ticker rail hidden decorative; invitation rows
  combine; composer fields labeled; all targets ≥ 44pt.
- **Dynamic Type**: scaledFont on titles/rows; tickers use minimum
  scale factors, never truncate the beat title silently.
- **Language**: sessions, invitations, "plan" not "schedule-call";
  no "start" language on something that joins.
- **Intent/preheat**: page records `.work`; composer warms the picked
  project's map (already cached via preheat on selection).
- **Honesty**: nothing on this page pretends — quiet state over fake
  LIVE, on-device composer labeled, replays labeled as directed beats.

## Plan

- **P0 — this build (shipped with this doc)**: everything above,
  on-device. Ticker off the store clock; invitations from the inbox
  store; upcoming persisted (`upcoming.v1`); composer local; records
  from replay artifacts + session memory.
- **P1 — wire (partly shipped in the 2026-08-18 working tree)**: typed
  session created/scheduled/started/ended events now drive NOW/UPCOMING;
  the composer publishes real session-linked `room_invite`s; scheduled
  timestamps drive reminders. Remaining: records enumerate per-session
  programs via `events_since` windows instead of artifact stand-ins.
- **P2 — presence & voice**: who's speaking on the live card; join
  straight into hold-to-talk; scheduled-session push at T-minus.
- **Design ops**: capture the rebuilt page to the design project's
  `ios/v2/` group alongside the other live screens.

Owner decisions staged: should UPCOMING sessions push a reminder
(pairs with notification prefs)? Does the composer belong on Home too
(as a quick action), or stay a Work-page ritual?
