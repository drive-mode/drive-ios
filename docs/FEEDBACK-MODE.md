# Feedback mode — design before build

The ask: let people inside the app chat with AI to design and suggest
features, try an approved variant **for up to one week**, and let us decide
to adopt or remove it — all under an explicit policy. This document locks
the decisions before the build so the careful parts stay careful.

## Roles

- **Program owner** (the Drive team): turns the feedback program on or off
  for everyone, reviews suggestions, decides *adopt* or *remove* per
  experiment. Owns the kill switch.
- **Member** (a user): opts in per device, designs suggestions in a chat
  with Cline, optionally runs a variant trial on their own device, can
  revert at any time.

Two switches must both be on for anything to happen: the owner's program
switch and the member's device opt-in. Either side off → no feedback UI,
no trials, no collection.

## Consent is the front door

Opting in presents the **Feedback Mode Policy** as a full screen, not a
footnote. It states exactly:

- what is collected — *only* the structured suggestion you explicitly send
  (title, summary, the surface it's about, app version, active experiment
  flags). Nothing is collected from the chat itself.
- what is never collected — the conversation (ephemeral, in memory, gone
  when the sheet closes — the transcripts-never-stored rule applies to
  feedback chat too), voice, code, repo contents, screenshots (v1),
  usage analytics.
- where it goes — the drive-mode feedback inbox, retained 90 days or until
  decided, whichever is sooner.
- what a trial is — a local variant flag on *your* device with a 7-day
  clock, revertible any time, removable by us any time.

Declining costs nothing. Consent is versioned: a policy change re-prompts.

## The suggestion loop

1. Member taps the feedback bubble (only visible while opted in).
2. **Design chat with Cline**: conversational, but its only output is a
   *structured draft* — title, one-paragraph summary, target surface,
   and (when the idea maps to a supported variant) a "try it" offer.
   The chat is a drafting tool, not a data channel.
3. **Send** is explicit and shows exactly what leaves the device.
4. The suggestion lands in the owner's review queue (client-side inbox in
   the preview build; a typed channel later — see Data notes).

## The experiment lifecycle (the one-week rule)

```
suggested → trialing (≤ 7 days, this device only) → decided
                        │                             ├─ adopt → ships for everyone
        revert (member) ┘                             └─ remove → flag retired
        expire (automatic at day 7 → reverts itself)
```

- A trial is a **local variant flag** with `startedAt` and
  `expiresAt = startedAt + 7 days`, checked at launch and on foreground.
  Day 7 reached → the variant deactivates itself; no owner action needed.
- The member sees the countdown ("4 days left") in Settings → Experiments
  and can end the trial early with one tap.
- The owner's *adopt* turns the variant into a shipped default (a normal
  release); *remove* retires the flag — devices deactivate at next check.
- Variants are **presentation-level only**. A variant may rearrange, hide,
  or restyle; it may never widen data collection, bypass approvals, or
  touch the privacy rules. That is a hard line enforced in review, and it
  is what makes one-week trials safe to run.

## Kill switch

Owner disables the program → members' devices exit feedback mode at next
check: bubble gone, trials reverted, opt-in cleared (re-consent required
if the program returns). Nothing lingers.

## Invariants that do not move

- Transcripts never stored — including feedback chat.
- Events, never pixels; no prompts, tool allowlists, API keys, or model
  IDs cross any boundary.
- Data leaves the device only on an explicit member action (Send).
- Trials are per-device, time-boxed, revertible, and presentation-only.

## Data notes (future wire shape)

Feedback is not room work, so it does not ride `work.generic`. When the
hosted path lands it gets its own typed channel (`feedback.suggestion`
with exactly the consent-listed fields). Until then the preview build
keeps suggestions client-side (Experiments list + inbox card) so the
whole loop is testable without a backend.

## Build map (what the preview implements)

- Settings → **FEEDBACK & EXPERIMENTS**: program state, opt-in toggle
  (gated by the policy screen), Experiments list with countdowns/revert.
- Floating feedback bubble on the main surfaces while opted in.
- Feedback chat sheet: Cline design persona, drafts the structured
  suggestion, explicit Send, "Try for a week" when a variant exists.
- One real variant ships with the preview — **Focus Home** (hides Home's
  ARTIFACTS + RECENT sections) — so the trial mechanic is demonstrably
  real: activate, watch Home change, revert, expire.
