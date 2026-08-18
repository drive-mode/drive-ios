# Drive data policy (draft v0.3 — preview)

The engineering-grade companion to the privacy policy: what data exists,
what class it belongs to, where it lives, and how long. If a feature
can't answer these four questions it doesn't ship.

## Data classes

| Class | What | Lives | Leaves device | Retention |
|---|---|---|---|---|
| **A · Device-local** | Preferences, pins, profile layout, intent model, experiment flags/timers, guide-bar state | UserDefaults / app storage | Never | Until you change or delete it; intent model self-decays (7-day half-life) |
| **B · Work events** | Typed room events (tasks, artifacts, beats, presence, invites) published by your agents | Your writer/hub durable log; a capped working set cached in-app | Only to *your* configured infrastructure | Your log's policy; in-app working set evicts shipped work first |
| **C · Feedback submissions** | Structured suggestion: title, summary, surface, app version, active flags | drive-mode feedback inbox (client-side in preview) | Only on explicit **Send**, only while opted in | 90 days or until decided, whichever is sooner |
| **D · Account** | Sign-in email | Account service | At sign-in | Until account deletion |
| **E · Social (preview)** | Published project squares, README/DEMO content, comments, friend links | Device-local in preview; hosted service in a later phase | Only on explicit **Publish** / comment | Owner-deletable at any time; unpublish removes |

Not a class because it does not exist: voice audio, transcripts, source
code, screen captures, usage analytics. Feedback chat is Class-nothing —
in-memory, never persisted.

## Rules that bind every class

1. **Explicit egress.** Nothing in classes C or E leaves the device
   without a deliberate user action naming what's sent.
2. **Typed or nothing.** Everything that crosses a boundary is a typed,
   schema-validated payload. Schemas reject transcript- and secret-shaped
   keys.
3. **Presentation-only experiments.** A variant flag may change how
   things look or arrange; it may never widen collection, add egress, or
   soften an approval. Trials are per-device and expire at 7 days.
4. **Work is archived, people are deleted.** Filing/TTL semantics apply
   to work products; personal data deletion is immediate and real.
5. **Consent is versioned.** Widening any column in the table above
   requires a policy bump and re-consent; the app shows the diff.

## Feedback-mode addendum (exact payload)

```json
{
  "kind": "feedback.suggestion",
  "title": "≤ 80 chars",
  "summary": "≤ 600 chars, member-authored",
  "surface": "home | work | agents | tasks | profile | …",
  "appVersion": "0.3",
  "activeFlags": ["focus-home"],
  "sentAt": "ISO-8601"
}
```

No identifiers beyond the account the member is signed into; no device
fingerprinting; no location; no contact access.

## Open items before GA

- Route + storage for the hosted feedback inbox (currently client-side).
- Social phase E backend: hosting, moderation tooling, block-list sync.
- Formal DPA/regional review (this draft is a product spec, not counsel).
