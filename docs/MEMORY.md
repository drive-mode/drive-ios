# Memory — the fleet's notebooks

Skills say *how* an agent works. Memory says *what it knows*. This doc
pins the shape before the host contract exists.

## The model

Memory is **files with hooks**, scoped to what they're about:

| Scope | Owner | Example |
|---|---|---|
| **Agent** | agent id | `host-preferences.md` — how the host likes edits proposed |
| **Session** | agent id (+ session) | `session-2026-08-17-auth.md` — what landed, what's parked |
| **Task** | task id | `webhook-blockers.md` — why w8 is blocked, what unblocks it |
| **Project** | project name | `decisions.md` — standing calls, read before proposing |
| **Plan** | plan id | `payments-plan-notes.md` — open questions the plan must answer |

Each file: `name`, `hook` (one index line), `body`, `updated`, `pinned`.

## The discovery rule (same as skills)

**Hooks always load; bodies load when relevant.** At session start an
agent reads the hook lines of its own notebook (agent + session scopes)
plus the project's — a table of contents, not a context dump. A body is
pulled in only when the work touches it. Pinned files float first.

## Who writes, who reads

- **Agents write their own** — durable agent memory (conventions,
  preferences learned) and per-session notes (what happened, what's
  parked). Session notes are the "specific times it was worked" record.
- **Tasks/projects/plans accumulate** memory from whoever works them.
- **Humans read, edit, and pin everything.** Memory is never hidden state:
  every file is openable and editable in-app, and the honesty rule holds —
  what shapes an agent's behavior is inspectable.

## Boundaries (the usual hard lines)

- Memory is *notes*, not transcripts — conversation is never stored, so
  nothing conversation-shaped lands here. Files carry conclusions.
- No secrets: bodies are linted for secret-shaped strings before save
  (host rule; the preview seeds are clean by construction).
- On-device in the preview. The host contract syncs the same shape:
  files + hooks per scope, hook-first loading.

## Surfaces (preview build)

- **Agent profile → MEMORY**: the agent's notebook (agent + session
  scopes), tap to read, edit in place.
- **Project map**: the project's standing memory below the map; task
  memory hooks on the task card.
- **Agents tab → Memory**: the browser — every notebook, filtered by
  scope.

## Open

- Host contract: memory pack or file-sync channel; write attribution
  (which agent wrote what) once agents author for real.
- Retention: session notes could TTL like ephemeral artifacts; agent and
  project memory keep until superseded — same lifecycle language.
- Memory-aware preheat: hooks are cheap; the intent engine could warm
  the bodies a predicted surface will need.
