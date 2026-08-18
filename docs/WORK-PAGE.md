# Work: chat first, calls when useful

This document is the product and interaction contract for the Work root. It
supersedes the 2026-08-17 decision that made Work a vertically stacked session
lifecycle page. The lifecycle work was not discarded: it now lives in the
secondary **Calls** and **History** flows.

Implementation status as of 2026-08-18: the native surface described here is
implemented on the open `drive-ios` PR stack through
`codex/on-device-system-model`. It is not merged or released, and its chat and
target registries remain local preview boundaries rather than production
services. Debug retains those fixtures; Release starts with one disabled
“Choose a work target” reference, no agents/messages/calls, and rejects chat or
call launch until real target and roster connections exist. [TODO.md](../TODO.md)
is the canonical backlog.

## Thesis

**Work is the quiet place where a person starts or resumes work against an
explicit target.** Most visits should begin with a composer, not an operations
dashboard. The person can escalate the same intent into a call without first
scrolling through invitations, schedules, and replays.

The first screen answers four questions immediately:

1. What repository, folder, or saved file set will receive this work?
2. Can Drive currently access it, and with what posture?
3. Do I want a new chat or a live call?
4. What should the agents do?

## Primary surface

### Target context

The header shows a human-readable target label, source, connection state, and
access posture. `WorkTargetRef` carries an opaque host-resolved reference; a
display path is never authorization and no credential or raw device path is
rendered or sent as configuration.

Changing a target opens a compact picker. Unavailable or permission-required
targets remain legible but cannot accept a message. Device files use the system
file importer and security-scoped URLs rather than broad filesystem access.

### New Chat and Call

Both actions are visible at the top-right without scrolling:

- **New Chat** clears the current managed conversation only after the runtime
  can establish a new chat identity. In the current preview it clears local
  messages and says so in its accessibility hint.
- **Call** launches a valid saved preset immediately when that is the person's
  preference; otherwise it opens the call configurator.

The configurator selects opaque targets, agent references, and Presenter-
eligible agents. It does not carry prompts, tools, credentials, model IDs, or
Presenter grants. Cline remains the host coordinator and issues any temporary
title grant when the call begins.

### Composer

The empty state names the selected target and leaves the visual field quiet.
The composer is the dominant interaction and is disabled when access is not
usable. Sending must eventually enter the managed chat catalog/runtime; it must
not create a second chat protocol inside the iOS app.

## Secondary Calls and History

The earlier lifecycle design remains useful, but no longer owns the root:

- **Calls** contains live state, invitations, upcoming sessions, and the plan-a-
  session composer.
- **History** contains replayable session records and their durable memory
  hooks.
- A live call opens Spotlight's typed stage. The temporary Presenter publishes
  structured beats and artifacts; no screen pixels are captured or streamed.

Lifecycle truth comes from typed session created, scheduled, started, invited,
and ended events. Quiet, disconnected, and preview states must be explicit.

## States and honesty

| State | Required behavior |
|---|---|
| No messages | Target-aware empty state and enabled composer when access is valid |
| Active chat | Managed messages associated with a stable chat and target reference |
| Permission required | Explain the missing grant and offer the system picker; never imply access |
| Target disconnected | Preserve context read-only, block mutations, and offer reconnect |
| Writer/runtime unavailable | Identify which capability is unavailable; do not silently fork durable state |
| Offline local task | Only advertise local execution when the Apple system model reports availability |
| Call configured | Validate at least one usable target and agent before launch |
| Call live | Make Presenter ownership visible, temporary, exclusive, and revocable |

## Accessibility and layout

- The Drive-mark Home control is visible and VoiceOver-labeled; native back
  behavior remains intact on pushed screens.
- New Chat, Call, target selection, the composer, Calls, and History have
  distinct labels and minimum 44-point hit targets.
- Dynamic Type may wrap target context and action labels; it must not push Chat
  or Call below a required scroll.
- iPad uses the same information architecture with adaptive width, not a scaled
  phone screenshot.
- Reduce Motion still allows informational state changes while removing
  decorative movement.

## Implemented on the open stack

- [x] Quiet target-aware Work root with New Chat and Call above the fold.
- [x] Opaque `WorkTargetRef` and saved `CallPreset` shapes.
- [x] Feature-isolated native call configurator.
- [x] Calls and History as secondary sheets over the root.
- [x] Unified Settings deep link for call behavior and preset naming.
- [x] Exclusive Presenter UI and typed grant/transfer/revoke protocol across
      the iOS, harness, writer, and Cline branches.

## Remaining integration

- [ ] Replace `WorkTargetRef.previews` with authenticated repository, saved-file,
      and security-scoped device target discovery plus revocation/reconnect.
- [ ] Replace the local one-sided message list with the managed chat catalog,
      response streaming, persistence, resume, cancellation, and error states.
- [ ] Resolve call presets through the host and prove grant rejection,
      transfer, expiry, reconnect, and replay end to end after the stacked PRs
      merge.
- [ ] Derive History from per-session durable event windows rather than replay
      artifact stand-ins; add speaking presence where the transport supports it.
- [ ] Add release-grade empty, degraded, and reviewer-demo data. Remove seeded
      production claims and localhost dependencies from an App Store build.
- [ ] Complete hands-on iPhone/iPad, VoiceOver, Voice Control, Larger Text,
      keyboard, reduced-motion, and poor-network testing.

## Acceptance gate

- Work opens on a quiet target-aware composer.
- New Chat and Call are both reachable without scrolling at supported text
  sizes on iPhone and iPad.
- The displayed target never functions as an authorization token.
- Calls and History retain the useful lifecycle behavior without crowding the
  default surface.
- No message or call mutation claims success unless the owning runtime accepted
  it, except in an explicitly labeled local preview/test mode.
- Presenter capability is typed-stage-only, exclusive, temporary, revocable,
  and replayable once the owning host persists the typed events.
