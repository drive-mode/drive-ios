# Agent skills — capability, not configuration

Agents get set up with the skills the fleet actually runs on. This doc
pins what a "skill" is in Drive, because the word is load-bearing and the
boundary around it is a hard rule.

## The definition

A **skill** is a *typed capability with an approval posture*:

- **capability** — the family of events the agent may publish on the wire
  (the skill's entire observable footprint), and
- **posture** — whether a human gates it (the seal: acts only after you
  allow).

That's it. A skill is **not** a prompt, a tool allowlist, a provider, or
a model choice. Those are the *how*; they live on the agent's host and
never cross the wire in either direction. The phone equips capability and
sets the gate — the same class of thing as the approval toggles, which is
exactly why it's allowed to cross.

## The registry (v1) — the skills we run on

Each skill mirrors a capability the transport already speaks:

| Skill | Publishes | Gated | Mirrors |
|---|---|---|---|
| Directing | `work.direction.beat` | — | packs-direction |
| Task running | `work.task.created/state/progress` | — | packs-tasks |
| Artifact publishing | `work.artifact.created/lifecycle` | — | packs-artifacts |
| Code editing | `work.edit` → approval → land | ✓ | harness work packs + approvals |
| Test running | `work.command` / `work.test` | ✓ | harness work packs |
| Research | `work.generic` (read-only) | — | generic pack |
| Inviting | `control.invite` | — | harness control track |
| Feedback triage | `feedback.suggestion` (draft) | — | feedback channel (preview) |

## Loadouts

Per-agent equipped sets, persisted on-device (`skills.<agentId>`),
shipping with defaults that match each agent's role in the room:

- **Maya** (reviewer/director): directing, task running, inviting, research
- **Cline** (builder): code editing, task running, artifacts, feedback triage
- **Scout** (researcher): test running, research, artifacts, task running
- **Indexer** (utility): artifacts, research
- Unknown wire agents fall back to task running + artifacts.

Equipping is instant and per-agent; the library view answers the inverse
question — "who carries this skill?" — so a capability is set up once and
equipped anywhere.

## Observed, never self-reported

When the wire is live, each skill row shows a usage count **derived from
the durable log** (events by kind per `actorId` — beats count for their
director, a `diff` artifact also counts as editing evidence, a `report`
as testing). Agents don't get to claim skill activity; the log speaks.
Offline, the demo world shows loadouts without counts.

## What crosses the wire (future)

Today equipping is client-side policy, preview-only. The hosted path
syncs it the same way approvals will: a policy channel, phone → host —
`{agentId, skill, equipped, gated}` and nothing else. The host maps
capability → its own prompts/tools privately. Usage stays derived
client-side from the log; there is nothing to sync.

Open items:
- Policy sync channel (rides the same ask as approval sync — DATA-NEEDS).
- Per-skill approval granularity (gate editing but not testing, per agent
  — the UI already models it; the host contract needs it).
- Skill-aware routing: "who on the fleet can direct?" powering
  session-setup suggestions.
