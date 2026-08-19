# Backend connection — the ladder from preview to product

Written 2026-08-19 against merged `main`. This is the engineering sequence for
replacing every preview seam with a connected production behavior. It decides
order and evidence, not product policy: every owner decision it depends on is
one of D01–D12 in
[APP-STORE-REVIEW.md](APP-STORE-REVIEW.md#owner-decision-register), and no
rung may silently settle one. Transport-level payload requirements stay in
[../DATA-NEEDS.md](../DATA-NEEDS.md); this file sequences them.

## The seams to replace

From [HANDOFF.md](../HANDOFF.md), current on merged `main`:

| Seam | Preview behavior today |
|---|---|
| Work targets | Static `WorkTargetRef.previews` records |
| Work chat | One-sided in-memory list + fire-and-forget event; no catalog, stream, persistence, or resume |
| Calls | Enter local app state only; no production remote call |
| Account/billing | `PreviewAccountService`; no auth, sign-out, deletion, StoreKit, or provider usage |
| Runtime badges / Director descriptor | Hard-coded allowlisted values, not host-supplied signed projections |
| Writer durability | Standalone MCP writer is in-memory; the log resets on restart |

Rule that shapes every rung: **honesty chrome stays** — a surface says
"disconnected" or "preview" until its rung is actually landed. No rung ships
by widening a preview to look connected.

## Rung 0 — merged-system verification *(in flight)*

Close the loop the merge opened. No owner decisions.

- Land harness [#4](https://github.com/drive-mode/collaboration-harness/pull/4)
  and MCP [#4](https://github.com/drive-mode/drivemode-mcp/pull/4)
  (Presenter leave/room-end fold reconciliation, `room_end`).
- Mirror the two fold rules in the iOS `WriterClient` title projection
  (leave revokes the leaver's grant; `control.end` clears titles) so the
  phone's view of "who may present" cannot disagree with the room fold.
- Rerun the iOS Xcode suite on macOS against merged `main`, and exercise iOS
  Presenter behavior against the actual Cline coordinator rather than the
  standalone writer.

Evidence: recorded suite numbers per repo on `main`, plus one cross-repo run
(coordinator → writer → iOS) showing grant/transfer/revoke/leave/end agree.

## Rung 1 — durable host and writer identity

The production Hub becomes the writer the phone trusts: append-only log that
survives restarts, writer discovery/pairing instead of a typed URL, HTTPS
end-to-end. Replaces the in-memory writer seam; the client already resyncs on
`latestSeq < cursor`, which becomes the recovery path against a durable log.

- Repos: `cline-drivecode` (hub durability + pairing), `drive-ios`
  (Settings connection surface — also the missing first-run setup step),
  `drivemode-mcp` (writer stays the local/dev reference).
- Depends on: **D05** (HTTPS/local-network posture). Release already rejects
  loopback/LAN/non-HTTPS endpoints, so this rung is what makes Release
  connectable at all.
- Evidence: kill and restart the host mid-session on a physical device;
  tasks/artifacts/titles resume without the demo world leaking in.

## Rung 2 — authenticated targets and the Connections surface

Work targets become real repositories the user authorized. This is the
`integrations-vcs` P0 order already approved in the workspace plan (TODO §6):
connector ADR + credential generalization → `packs-vcs`/`comms.*` zod with
secret-shape rejection → tier-0 remote health in Status Hub → GitHub App
adapter (device flow, PR, webhooks) → Slack interrupts → Connections settings.

- Repos: `cline-drivecode` (adapter + credential store), `drivemode-mcp`
  (pack schemas), `drive-ios` (target picker reads authorized targets;
  Connections settings surface).
- Depends on: Rung 1 (a host to hold credentials — they never live on the
  phone), integrations decision #3 (Slack posture) for the Slack half only.
- Evidence: a target picked on the phone resolves to a real repo the host can
  read; revoking the connection makes the target honestly unavailable.

## Rung 3 — managed chat

The Work tab's default surface gets its backend: a chat catalog (per-target
threads), a response stream, persistence, and resume. Today's
`conversation.message` events carry room conversation; managed chat needs
thread identity, streaming deltas, and history — a hub-side service projected
through the wire, not a bigger in-memory list.

- Repos: `cline-drivecode` (chat service + agent loop), `collaboration-harness`
  (thread/stream event shapes if they ride the room protocol),
  `drivemode-mcp` (writer tools for the dev loop), `drive-ios` (WorkHub chat
  binds to the catalog; drafts survive relaunch).
- Depends on: Rungs 1–2 (durable host, real targets). Consent language for
  what leaves the device rides **G2/G4** work (hosted-AI disclosure).
- Evidence: send from iPhone, kill the app, resume the thread on iPad —
  history and in-flight response state agree with the host.

## Rung 4 — remote calls and host presets

Call becomes a production remote session: host-resolved call presets, the
session lifecycle events already merged (`control.session_*`) driving
NOW/UPCOMING from the durable log, and invitations that reach other devices
via push rather than the local notification path.

- Repos: `cline-drivecode` (session orchestration, push fan-out),
  `drive-ios` (LiveCall joins the remote session; reminders keyed to host
  time), `collaboration-harness` (already carries the lifecycle protocol).
- Depends on: Rung 1; push infrastructure (also unblocks TODO §5 "Inbox items
  sourced from push + durable log").
- Evidence: two devices join the same session; interrupt → approval →
  resolution round-trips through the host with the phone offline-tolerant.

## Rung 5 — signed Director descriptor and runtime badges

Replace the hard-coded allowlisted preview values with host-supplied signed
projections: the Director descriptor the phone shows is verified, versioned,
and non-exportable; runtime badges come from the host's sanitized identity,
never a model id. The reference-only boundary rules in HANDOFF §"Rules that
never bend" are the contract; this rung makes them enforced rather than
asserted.

- Repos: `cline-drivecode` (descriptor signing + badge projection),
  `drive-ios` (verify + display; drop the local allowlist).
- Depends on: Rung 1. No owner decision — the boundary is already policy.
- Evidence: tampered descriptor fails closed with the honest "unavailable"
  chrome; badges for a real fleet match the host's roster.

## Rung 6 — account, deletion, and billing truth

`PreviewAccountService` is replaced by real authentication, sign-out, and
**in-app account deletion** (release-blocking, and it must distinguish
Drive-hosted data from the user's own infrastructure — HANDOFF rule 5).
Billing surfaces stay hidden until the commerce posture is real.

- Repos: `cline-drivecode` (identity + deletion pipeline), `drive-ios`
  (account UI truth, StoreKit if chosen).
- Depends on: **D01** (seller identity), **D02** (business model), **D06**
  (login posture), **D08** (retention/deletion). This rung is gated G3 in the
  release plan and cannot start meaningfully before those are recorded.
- Evidence: create → use → delete an account and show what data remains
  where; usage/analytics read observed values from the real account.

## Rung 7 — policy, skills, and memory sync

Approval toggles and skill loadouts sync to the host that actually enforces
them (HANDOFF rule 4: human gates are host-enforced); memory files sync with
attribution; skill packages get real bodies/generation server-side. The
skills contract ([SKILLS.md](SKILLS.md)) and memory contract
([MEMORY.md](MEMORY.md)) already define the boundary.

- Repos: `cline-drivecode` (policy + memory services), `drive-ios` (sync
  status chrome), `collaboration-harness` (no change expected — capability
  postures already ride typed events).
- Depends on: Rungs 1, 6 (policies belong to an account).
- Evidence: toggling an approval on the phone changes what the host permits,
  observable in the wire log.

## Rung 8 — deterministic cross-repo verification (TODO §13)

Versioned fixtures and a public `drive-dev` contract replace remembered
seeding; one command stands up coordinator + writer + simulator evidence and
tears it down repeatably. This rung hardens everything above it and is the
prerequisite for CI on the merged system rather than per-repo suites.

## Rung 9 — the App Store plan, from G0

With rungs 1–8 landing, [APP-STORE-REVIEW.md](APP-STORE-REVIEW.md) takes over:
G0 records D01–D12, then distribution identity, privacy evidence, TestFlight,
and submission. The current verdict stands — **public App Store: NO-GO;
external TestFlight: NO-GO** — until the gates say otherwise.

## Decision dependencies at a glance

| Owner decision | Blocks rung |
|---|---|
| D05 HTTPS/LAN posture | 1 |
| Integrations #3 (Slack) | 2 (Slack half only) |
| D03 hosted-agent/4.7 posture, D09 microphone value | 3–4 framing, G4 |
| D01 seller, D02 business model, D06 login, D08 retention/deletion | 6 |
| D04 Showcase, D07 minimum OS/local AI, D10–D12 | 9 (G0 recording) |

Rungs 0–2 and 5 are engineering-ready now; 3–4 follow 1–2 by construction;
6 is decision-blocked before it is code-blocked. Parallelism that stays
honest: 0 with 1, 2 with 1 after the connector ADR, 5 any time after 1.
