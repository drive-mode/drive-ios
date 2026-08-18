# What the v2 surfaces demand from the wire

The demo app is now a requirements document: every surface below runs on
seeded data whose shape tells us exactly what the transport must provide.
Baseline = the harness's five primitives and existing packs
(`work.edit/command/test/plan/decision/generic`, `report_status`,
`interrupt_raise/ack`, `conversation_publish`, `events_since`).

Every protocol event carries an ISO wall-clock timestamp. The iOS client uses it
for invitation ages, artifact TTL clocks, and scheduled-session reminders;
remaining aggregates should use that source rather than inventing local ages.
The standalone preview writer is in-memory and resets on restart, so these
events are only cross-restart durable when a production Hub/persistence layer
makes them so.

| Surface | Runs on today (demo) | Needs from the wire |
|---|---|---|
| Directed Spotlight + replays | Scripted `Beat[]` (kind, title, director, caption, duration) | Existing `work.*` events **plus beat grouping**: program id + beat index + director ref + caption line (or a `stage.direct` annotation event). Replay = `events_since` over a session's program |
| Work session lifecycle | Local `UpcomingSession` fallback when offline | **Implemented on the open Harness/MCP/iOS branches**: typed `control.session_created/scheduled/started/ended`; `control.invite.sessionId`; writer lifecycle tools; iOS NOW/UPCOMING fold and real composer sends. Remaining: merge/release plus per-session replay windows and speaking presence |
| Managed Work chat | One-sided in-memory `WorkChatMessage[]`; connected Send emits `conversation_publish` without response/error lifecycle | Managed chat catalog/runtime: stable chat id, opaque target refs, user/agent messages, streaming deltas, completion/failure/cancel, resume/history, idempotency, and retention/deletion. iOS must not create a second chat engine |
| Work targets | Static `WorkTargetRef.previews` | Authenticated provider registry for repos/saved sets plus security-scoped device URLs/bookmarks; opaque host-resolved authority, display metadata, access posture, connection/revocation/reconnect, and no raw credential/path transport |
| Call presets | Device-local `CallPreset` and local `joinCall` state | Host-resolved call/session creation using opaque target/agent refs, default behavior, Presenter candidates, rejection/errors, reconnect, audit, and cross-device policy if required |
| Tasks + task map | Seeded `TaskItem` (project, agent, state, progress, deps) | **New pack `work.task.*`**: created / state / progress / deps — aligns with the task-bank initiative. Deps are what the map draws |
| Projects + archive | Name-keyed rooms; state-based auto-file | Project registry (id, name, area) + lifecycle events (archived/restored); **age-based policy needs timestamps** |
| Activity calendar / contribution wall | Seeded 365-day `DayRecord` | Derivable — count `work.task.done` by day × project. No new events; needs timestamps + project refs |
| Inbox | Seeded `InboxItem` | `interrupt_raise/ack` (exists) + **`room.invite`** (the invitation object the session language needs) + ship notifications (derive from task.done) + per-user **read-state sync** + product feed (server-side, not MCP) |
| Artifacts + TTLs | Seeded `Artifact` (kind, size, repo, life) | **New pack `work.artifact`**: id, kind, purpose → life (permanent \| ttlDays), size, repo, room, `supersedes` link. TTL expiry emits archive lifecycle |
| Your week (rings/streaks/records) | Seeded aggregates | Derivable from log: approvals + **answer latency** (raise→ack delta), ships/day, **voice spans (start/stop/duration only — privacy-strict: never audio or transcripts)**. Badges = derived milestones |
| Agents + per-agent approvals | `@AppStorage` per agent | Appearance via `roster_set_profile` (exists). **Approval policy must sync to the host** (phone writes policy, host enforces; prompts/tools/models never cross — hard rule) |
| Agent skills (loadouts + usage) | `@AppStorage` loadouts (`skills.<agentId>`); usage derived from log kinds per actor | **Skill policy sync rides the approval-sync ask**: `{agentId, skill, equipped, gated}` phone → host, host maps capability → its own prompts/tools privately. Usage needs nothing — observed from the log (docs/SKILLS.md) |
| Runtime identity | Hard-coded preview mapping from agent id to Claude/Codex/Apple + hosted/on-device | Host projection of an allowlisted family label and execution location only; never exact model/version, endpoint, key, prompt, tool, or routing configuration |
| Agent Titles / Presenter | Local projection plus open Harness/MCP/Cline title branches | Canonical reference-only grant/transfer/revoke/expiry events, exclusive Presenter enforcement, host authorization, and identical leave/room-end cleanup in every reducer and replay |
| Director descriptor | iOS hard-coded “Verified” host-only descriptor and local AppStorage overlays | Signed/versioned descriptor from the Cline host plus allowlisted overlay schema/state. No prompts, routing, scoring, tool/model maps, compiler, or signing secret crosses |
| Account / billing / usage | Device-local name/email, `PreviewAccountService`, current-writer/local derived counts | Auth/account service, plan/payment/invoice or StoreKit entitlement truth, provider consumption, user-visible outcomes, retention/export/deletion, and App Store privacy/commerce posture |
| On-device AI | One user-selected UTF-8 file, 32 KB cap, `SystemLanguageModel` where available | No host data needed for local mode. Release needs security-scoped bookmark decision, device/OS/model availability matrix, explicit hosted-transfer consent if ever added, and local-only receipt semantics |
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
   **Addendum (merged to main)**: beats also carry `steps` + `accent` —
   director-curated typed stage lines (diagram nodes, diff summary lines,
   run output, test names, metric rows). The live session now renders the
   full stage everywhere; precedence steps > relatedEventIds > placeholder.
   Both PRs (harness `control.invite`, mcp fleet packs) are **merged to
   main**.
5. ~~**`room.invite`**~~ — **landed**, then extended in the current
   working tree with `sessionId`: `control.invite` → writer `room_invite`
   → real composer send → addressed inbox card with real ages. Outgoing
   invitations become local read receipts; Inbox **read-state sync**
   remains open (client-side state only today).
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

Mirrored as a card in the Drivecode Design System project (`ios/v2/`). This
file is the source of truth for transport and connected-service requirements
only; [TODO.md](TODO.md) owns product priority and delivery status.
