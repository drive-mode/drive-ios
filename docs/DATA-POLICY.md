# Drive data policy (draft v0.4 — preview, not submission-ready)

The engineering companion to the privacy policy: what data exists, where it
lives, whether it leaves, and how long it remains. This is a preview inventory,
not an approved App Store disclosure. Production must extend each row with
controller/processor, purpose, consent, deletion, and App Store label. If a
feature cannot answer those questions it does not ship.

## Data classes

| Class | What | Lives | Leaves device | Retention |
|---|---|---|---|---|
| **A · Device-local** | Preferences, pins, profile layout, intent model, experiment flags/timers, guide-bar state, call preset; selected-file text and response while a bounded local-AI task runs | UserDefaults / app state / security-scoped read | Local-AI mode: never; other values stay local unless a separately specified sync is added | Preferences until changed/deleted; intent self-decays; local-AI file/result currently remain only in the live store |
| **B · Work events** | Typed room events (tasks, artifacts, beats, presence, invites, titles) and text explicitly sent while connected | Configured writer/hub; capped working set cached in-app | To the configured endpoint on deliberate mutation/send | Preview writer is in-memory and resets on restart; production Hub policy is unresolved; in-app working set evicts shipped work first |
| **C · Feedback submissions** | Structured suggestion: title, summary, surface, app version, active flags | drive-mode feedback inbox (client-side in preview) | Only on explicit **Send**, only while opted in | 90 days or until decided, whichever is sooner |
| **D · Account** | Preview display name/email today; future user id, authentication, billing/purchase state and service logs require a new signed inventory | Device-local in preview; no production account service | No production account transfer today | Preview values until changed/deleted; production retention/deletion unresolved |
| **E · Social (preview)** | Published project squares, README/DEMO content, comments, friend links | Device-local in preview; hosted service in a later phase | Only on explicit **Publish** / comment | Owner-deletable at any time; unpublish removes |

Not stored by this preview client: voice audio/transcripts or remote screen
pixels. Source files do exist when a person explicitly selects one for local AI;
they are read transiently and do not leave local mode. Sent chat text is Class
B. Runtime family/location badges exist but exact model configuration does not
cross. Usage/Analytics screens currently derive local/current-writer state; the
developer does not yet collect a separate analytics stream. Any hosted file/code
transfer, diagnostics, analytics, or provider logging added later needs its own
inventory row, disclosure, label, consent, retention, and deletion behavior.

## Rules that bind every class

1. **Explicit egress.** Nothing in classes C or E leaves the device without a
   deliberate user action naming what is sent. Class B text leaves when the
   person presses Send against a connected writer; target selection alone is
   not authorization to upload file contents.
2. **Typed or nothing.** Everything that crosses a boundary is a typed,
   schema-validated payload. Schemas reject transcript- and secret-shaped
   keys.
3. **Presentation-only experiments.** A variant flag may change how
   things look or arrange; it may never widen collection, add egress, or
   soften an approval. Trials are per-device and expire at 7 days.
4. **Work is archived, people are deleted.** Filing/TTL semantics apply
   to work products; personal data deletion is immediate and real.
5. **Consent is versioned.** Widening any column above requires a policy bump
   and re-consent. Sharing personal data with a third-party AI requires an
   explicit just-in-time disclosure and permission before the first transfer.

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

- Final production data-flow inventory and App Store privacy-label worksheet.
- Final required-reason audit, aggregated privacy report, and public privacy/
  support/privacy-choices URLs. A target-bundled manifest now declares tracking
  false and the app-preference `UserDefaults` reason `CA92.1`; the uploaded
  candidate still needs validation.
- Hosted-agent consent naming data, provider/provider class, purpose,
  execution location, retention, and training posture.
- Account authentication, sign-out, in-app deletion, billing/StoreKit decision,
  provider usage, server logs, retention, and regional/legal review.
- Production Hub controller, authentication/authorization, persistence,
  retention, deletion/export, and reviewer-tenant posture. The preview writer's
  current-process log must not be described as cross-restart durable.
- Route + storage for the hosted feedback inbox (currently client-side).
- Social phase E backend: hosting, moderation tooling, block-list sync.
- Formal DPA/regional review (this draft is a product spec, not counsel).

Execution gate: [APP-STORE-REVIEW.md](APP-STORE-REVIEW.md).
