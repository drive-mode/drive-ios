# Drive — local web build

A fully working, local version of the Drive iOS app that runs without Xcode:
the same surfaces, copy, data model, wire fold, brand and design tokens as
`../Sources/*.swift`, rendered in a browser. On a desktop it shows inside an
iPhone frame; on a phone it fills the screen and installs to the home screen
as a standalone app.

There is **no build step and no dependency to install**: Preact and htm are
vendored (`vendor/`), fonts and the mark are local (`assets/`), and the server
is Python's standard library.

```bash
cd web
python3 serve.py            # → http://127.0.0.1:8787/
python3 serve.py --host 0.0.0.0 --port 8787   # reach it from a phone on the same Wi-Fi
```

Then on the iPhone: open the LAN URL in Safari → Share → **Add to Home Screen**.
The app launches standalone with the Drive icon, safe areas respected.

## What runs

| Surface | Module | Same as the Swift app |
|---|---|---|
| Open · Home · Needs you · Conversation · Inbox · Approval | `src/views/home/` | `OpenView` `HomeView` `NeedsYouView` `ConversationView` `InboxView` `ApprovalView` |
| Work (chat-first) · Calls · History · Live call · Spotlight · Presenter | `src/views/work/` | `WorkHub` `CallTabView` `LiveCallView` `SpotlightDirector` `AgentTitles` |
| Agents · Skills · Packages · Memory | `src/views/agents/` | `AgentsView` `AgentSkills` `SkillPackages` `AgentMemory` |
| Tasks · Project map · Artifacts · Artifact detail · Activity | `src/views/tasks/` | `TasksView` `ProjectMapView` `ArtifactsView` `ArtifactDetailView` `ActivityView` |
| Profile · Customize · Settings · Showcase · Feedback · Policies · On-device AI | `src/views/profile/` | `ProfileView` `ProfileCustomize` `SettingsView` `ShowcaseView` `FeedbackMode` `PolicyViews` `LocalAI` |
| App state, wire, intent, notifications, tokens | `src/store.js` `src/wire.js` `src/intent.js` `src/notifications.js` `src/theme.css` | `Store` `WriterClient` `IntentEngine` `Notifications` `Theme` |

`ARCHITECTURE.md` is the module-by-module contract.

## Two channels, same as the plists

| | Preview (default) | Production (`?channel=production`) |
|---|---|---|
| Seeded fleet, demo session, preview account | yes, labeled | **absent** — empty, honest states |
| Showcase, feedback experiments, billing chrome | yes | absent |
| Writer | `https` or loopback `http`, and the `serve.py` proxy | `https` to a real host only |

An unknown channel value fails closed to production, exactly like
`AppConfiguration.swift`.

## Connect the live writer

Run the [`drivemode-mcp`](https://github.com/drive-mode/drivemode-mcp) writer
(`bun run writer`). It prints its ephemeral URL and drops
`~/.drivemode/writer.json`. `serve.py` discovers that file (or
`DRIVEMODE_WRITER_URL`) and proxies `/writer/*` to it, so the page, a phone on
the LAN, and a loopback-only writer all agree without CORS or mixed-content
exceptions. Settings → On-device AI → WIRE shows status, cursor, cadence and
the intent/preheat diagnostics; the writer URL can be overridden there.

Offline preview shows the labeled demo world; once the wire is live it owns
tasks, artifacts, beats, agents, interrupts, invitations, titles and the
session lifecycle. A drop after being live says "Reconnecting to your fleet"
and resyncs across a writer restart.

## Persistence

`localStorage` plays UserDefaults, under the same keys the Swift app uses
(`appearance`, `reduceMotion`, `archive.autoFile`, `pinnedProjects`,
`writerURL`, `call.defaultPreset.v1`, …). Settings → Privacy → **Reset local
data** clears it.

## Verify

```bash
node --test tests/            # core parity tests (director, fail-closed, titles, presets, fold)
```

Headless UI walk (needs `playwright-core` and a Chromium; see `tools/smoke.mjs`):

```bash
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node tools/smoke.mjs
```

## What is deliberately not here

- No microphone audio ever leaves the page or is retained: the waveform reads a
  live level and drops the buffer, as `VoiceCapture.swift` does.
- No Apple Foundation Models in a browser: the On-device AI surface keeps the
  bounded state machine (one text file ≤ 32 KB, read-only, no cloud fallback)
  and reports the platform honestly.
- No third-party services, analytics, or CDNs.
