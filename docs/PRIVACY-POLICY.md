# Drive privacy policy (draft v0.4 — preview, not submission-ready)

Plain language, because that's the product's voice. This repository draft
describes the current preview boundary and the intended release rules. The
in-app v0.3 copy is not yet synchronized with every item below. Before any
TestFlight/App Store release, publish a reviewed HTTPS version, replace the
placeholder contact, update the in-app copy, and make the App Store privacy
label match production behavior. See [APP-STORE-REVIEW.md](APP-STORE-REVIEW.md).

## The short version

Debug preview runs on your device and talks to the writer address you configure.
The current Release channel has no default service, rejects loopback/LAN/non-
HTTPS writer endpoints, and starts without sample account/work/social data. The
app has no ads and does not sell data. Microphone buffers are used only to draw
a live level and are discarded immediately; this client does not store audio or
transcripts. Text deliberately sent to a connected writer is a work event and
leaves the device, as described below.

## What stays on your device

- Your preferences: appearance, voice settings, approval defaults,
  notification choices, archive policy, pinned projects, profile layout.
- Your intent model (the on-device prediction of which screen you'll open
  next) — never uploaded, self-decaying.
- Preview experiment flags and their timers (see Feedback Mode Policy);
  experiments are disabled in the current Release channel.
- The working copy of your fleet's event log.
- The selected file and Apple system-model response while a bounded local-AI
  task runs. The file is read through a security-scoped URL, is not copied into
  app storage, and is not sent to a hosted model by this local mode.

## What is never stored, anywhere

- **Voice audio and transcripts.** This client computes a loudness value and
  drops each microphone buffer in the same callback.
- Screen pixels from an agent host. The shared surface is reconstructed from
  typed events, not screen capture or streaming.
- Exact model ids, endpoints, credentials, prompts, Director internals, or tool
  policy. The phone may show an allowlisted family/location badge such as
  Claude, Codex, or Apple on-device; that is not a model configuration.

## What leaves your device, and when

- **Work events and sent text** flow between your device and the configured
  writer/hub. The local preview writer is in-memory and resets on restart; a
  production Hub may retain events under its published policy. The release
  policy must name the controller and retention rather than assuming every
  configured service is user-operated.
- **Feedback submissions** — only if you opt into feedback mode, and only
  the structured suggestion you explicitly send (see Feedback Mode
  Policy). Retained 90 days or until decided, then deleted.
- **Account basics** — the preview stores editable name/email on the device and
  has no production sign-in service. A release account service must disclose
  identifiers, billing/purchase state, server logs, retention, and deletion.

## AI processing

Apple's system model receives only the contents of the file you selected for a
bounded on-device task. Drive records a local receipt (task, filename,
execution location, network-used flag, completion time) in memory for display.
There is no hidden cloud fallback.

Hosted agents are not covered by that local guarantee. Before any release sends
personal data, messages, repository content, or files to Claude, Codex, or
another third-party AI provider, Drive must identify what is sent, to whom, for
what purpose, with what retention/training posture, and obtain explicit
permission. Refusal and withdrawal must remain usable choices.

## Social features (Showcase, Debug preview only)

Showcase is disabled in the current Release channel. The following describes
the preview direction, not an operating public moderation or retention system.

Projects are **private by default**. Publishing a project square, README,
or demo is an explicit act, visible to the friends you invite. Comments
belong to the profile owner's space: owners can remove any comment on
their work; anyone can block, and blocked means invisible both ways.
A published demo is a directed replay of typed events — publishing one
never exposes source code.

## Deletion

The current preview does not create a production Drive account and does not yet
implement the required in-app deletion flow. Before account creation ships,
deletion must remove Drive-controlled account data and pending feedback/social
data, clear local credentials, explain any legally retained records, and
distinguish data held by a separately user-controlled Hub. Personal deletion is
real deletion, not archival: archive-not-delete applies to *work*, never to
*you*.

## Age, changes, contact

The final age rating will come from the App Store Connect questionnaire and the
enabled AI/UGC feature set; this draft's earlier “13+” statement is not a rating
decision. Policy changes that widen collection require notice and re-consent.
Questions: `privacy@drivemode.ai` is a **placeholder and not a release contact**;
replace it with a monitored address before publishing.
