# What the v2 surfaces demand from the wire

The demo app is now a requirements document: every surface below runs on
seeded data whose shape tells us exactly what the transport must provide.
Baseline = the harness's five primitives and existing packs
(`work.edit/command/test/plan/decision/generic`, `report_status`,
`interrupt_raise/ack`, `conversation_publish`, `events_since`).

**The one gap under everything: wall-clock timestamps on the durable log.**
Ages, TTLs, the activity calendar, streaks, and records are all fake until
events carry time, not just sequence.

| Surface | Runs on today (demo) | Needs from the wire |
|---|---|---|
| Directed Spotlight + replays | Scripted `Beat[]` (kind, title, director, caption, duration) | Existing `work.*` events **plus beat grouping**: program id + beat index + director ref + caption line (or a `stage.direct` annotation event). Replay = `events_since` over a session's program |
| Tasks + task map | Seeded `TaskItem` (project, agent, state, progress, deps) | **New pack `work.task.*`**: created / state / progress / deps — aligns with the task-bank initiative. Deps are what the map draws |
| Projects + archive | Name-keyed rooms; state-based auto-file | Project registry (id, name, area) + lifecycle events (archived/restored); **age-based policy needs timestamps** |
| Activity calendar / contribution wall | Seeded 365-day `DayRecord` | Derivable — count `work.task.done` by day × project. No new events; needs timestamps + project refs |
| Inbox | Seeded `InboxItem` | `interrupt_raise/ack` (exists) + **`room.invite`** (the invitation object the session language needs) + ship notifications (derive from task.done) + per-user **read-state sync** + product feed (server-side, not MCP) |
| Artifacts + TTLs | Seeded `Artifact` (kind, size, repo, life) | **New pack `work.artifact`**: id, kind, purpose → life (permanent \| ttlDays), size, repo, room, `supersedes` link. TTL expiry emits archive lifecycle |
| Your week (rings/streaks/records) | Seeded aggregates | Derivable from log: approvals + **answer latency** (raise→ack delta), ships/day, **voice spans (start/stop/duration only — privacy-strict: never audio or transcripts)**. Badges = derived milestones |
| Agents + per-agent approvals | `@AppStorage` per agent | Appearance via `roster_set_profile` (exists). **Approval policy must sync to the host** (phone writes policy, host enforces; prompts/tools/models never cross — hard rule) |
| Status Hub freshness | Seeded ages | `report_status` (exists) + timestamps for "8s ago" / stuck detection |

## The six asks — status after the schema pass (2026-08-17)

1. ~~**Timestamps**~~ — **already satisfied**: every protocol event carries
   `at` (ISO wall-clock) in `DriveEventBaseSchema`; the iOS demo just never
   consumed it. Client work, not wire work.
2. ~~**`work.task.*` pack**~~ — **landed**: `@drivemode/packs-tasks`
   (created/state/progress, deps edges), registered in the writer, tested.
3. ~~**`work.artifact` pack**~~ — **landed**: `@drivemode/packs-artifacts`
   (kind, life = permanent | ttlDays, size, repo, superseded, lifecycle).
4. ~~**Beat grouping**~~ — **landed and verified end-to-end** (2026-08-17):
   `@drivemode/packs-direction` (`work.direction.beat`: programId, beatIndex,
   kind, director, caption, relatedEventIds) — rides `work.generic`, kernel
   untouched. The client now resolves `relatedEventIds` against seen work
   events and stages them (plan checklists, test rows) — verified live.
5. ~~**`room.invite`**~~ — **landed**: `control.invite` in
   collaboration-harness (PR #1) → writer `room_invite` → inbox card with
   real ages, verified. Inbox **read-state sync** remains open (client-side
   state only today).
6. ~~**Voice spans + latency**~~ — **already derivable**: `presence.speaking`
   true/false spans + `control.interrupt_ack`, all timestamped. Client-side
   aggregation, no new events.

Follow-ups noted:
- The stage projector classifies the new kinds as category `"other"` —
  spotlight card category mapping for task/artifact/beat kinds is a small
  harness follow-up.
- `packs-artifacts` `CreatedPayload` is `.strict()` with **no `project`
  field** — artifacts can't name their project/room on the wire, so the
  client defaults it. Add optional `project` (and consider the same for a
  future project registry) in the next packs pass.

Mirrored as a card in the Drivecode Design System project (`ios/v2/`);
this file is the source of truth.
