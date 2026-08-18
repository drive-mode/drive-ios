# Drive privacy policy (draft v0.3 — preview)

Plain language, because that's the product's voice. This draft ships
in-app under Privacy & account and is the source the screens render.

## The short version

Drive runs on your device and talks only to infrastructure you point it
at. We don't sell data, we don't run ads, and the things you say out loud
in a session are never stored anywhere — by design, not by promise.

## What stays on your device

- Your preferences: appearance, voice settings, approval defaults,
  notification choices, archive policy, pinned projects, profile layout.
- Your intent model (the on-device prediction of which screen you'll open
  next) — never uploaded, self-decaying.
- Experiment flags and their timers (see Feedback Mode Policy).
- The working copy of your fleet's event log.

## What is never stored, anywhere

- **Voice audio and transcripts.** Conversation exists in memory during a
  live session and is gone when the session ends. Schemas on the wire
  reject transcript-shaped payloads.
- Your code, beyond the typed work events your agents deliberately
  publish (a plan step, a diff summary, a test result — events, never
  screen pixels, never file contents).
- Prompts, tool allowlists, API keys, or model identifiers — these never
  cross between your phone and your agents' host.

## What leaves your device, and when

- **Work events** flow between your device and *your* writer/hub — the
  address you configure, your infrastructure, your log. We don't operate
  or see it.
- **Feedback submissions** — only if you opt into feedback mode, and only
  the structured suggestion you explicitly send (see Feedback Mode
  Policy). Retained 90 days or until decided, then deleted.
- **Account basics** — the email you sign in with. Nothing else.

## Social features (Showcase, preview)

Projects are **private by default**. Publishing a project square, README,
or demo is an explicit act, visible to the friends you invite. Comments
belong to the profile owner's space: owners can remove any comment on
their work; anyone can block, and blocked means invisible both ways.
A published demo is a directed replay of typed events — publishing one
never exposes source code.

## Deletion

Deleting your account deletes account data and any pending feedback
submissions. Work events live in your own infrastructure and are yours to
keep or purge — we couldn't delete them if we wanted to, which is the
point. Personal-data deletion is real deletion, not archival: the
archive-not-delete ethos applies to *work*, never to *you*.

## Age, changes, contact

Drive is for people 13 and older. Policy changes are announced in-app
(Product inbox) and re-consent is required where the change widens any
collection. Questions: privacy@drivemode.ai (placeholder — route TBD).
