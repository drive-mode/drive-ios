// The wire — consumption of the drivemode-mcp writer, a port of
// `Sources/WriterClient.swift`. Poll `/rpc events_since` with a strictly-after
// cursor, fold typed events, adapt the cadence, resync when the writer
// restarts. Offline preview → labeled demo world; offline production → empty.
// Installed as methods on AppStore (the Swift file is an `extension AppStore`).
import { AppStore } from "./store.js";
import { prefs } from "./prefs.js";
import { relative, displayName, colorForActor, ArtifactKind, permanent, ephemeral, displayWhen, scheduledDateFor } from "./models.js";

const TASK_CAP = 3000;
const ARTIFACT_CAP = 800;
const BEAT_CAP = 64;
const EVENT_TITLE_CAP = 4000;
const LOCAL_USER = "harrison";
const BEAT_KINDS = { plan: "PLAN", diagram: "DIAGRAM", edit: "EDIT", run: "RUN", tests: "TESTS", decision: "DECISION", result: "RESULT" };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const parseIso = (raw) => { if (!raw) return null; const t = Date.parse(raw); return Number.isNaN(t) ? null : t; };
const isoString = (ms) => new Date(ms).toISOString();
const isLocalUser = (id) => id === LOCAL_USER || id === "drive:human";

const wire = {
  /** Identity: stored URL → ?writer= → /discovery proxy → nothing. Never a magic port. */
  async resolveInitialWriterURL() {
    const stored = prefs.get("writerURL", "");
    if (this.configuration.permitsWriterURL(stored)) return stored;
    if (this.configuration.permitsWriterURL(this.configuration.writerBaseURL)) return this.configuration.writerBaseURL;
    try {
      const res = await fetch("./discovery", { cache: "no-store" });
      if (res.ok) {
        const info = await res.json();
        // The proxy is only a transport: the discovered writer itself must
        // pass the channel's URL policy (production never reaches loopback).
        if (info?.url && info?.proxy && this.configuration.permitsWriterURL(info.url) && this.configuration.permitsWriterURL(info.proxy)) {
          this.discoveredWriter = info.url;
          return info.proxy;
        }
      }
    } catch { /* not served by serve.py — fine */ }
    return "";
  },

  applyWriterURL(value) {
    const trimmed = String(value ?? "").trim();
    if (trimmed && !this.configuration.permitsWriterURL(trimmed)) return false;
    this.writerURL = trimmed;
    prefs.set("writerURL", trimmed);
    this.pauseWire();
    this.startWire();
    return true;
  },

  startWire() {
    if (this.wireTimer != null) return;
    if (!this.configuration.permitsWriterURL(this.writerURL)) { this.wireStatus = { live: false, latestSeq: -1, events: 0 }; this.commit(); return; }
    // A generation token cancels a loop whose poll is in flight when the wire
    // pauses, so a pause/resume never leaves two chains polling the writer.
    const gen = (this.wireGeneration = (this.wireGeneration ?? 0) + 1);
    const loop = async () => {
      if (this.wireGeneration !== gen) return;
      await this.pollWire();
      if (this.wireGeneration !== gen) return;
      this.wireTimer = setTimeout(loop, this.wirePollInterval() * 1000);
    };
    this.wireTimer = setTimeout(loop, 0);
  },

  pauseWire() {
    this.wireGeneration = (this.wireGeneration ?? 0) + 1;
    if (this.wireTimer != null) clearTimeout(this.wireTimer);
    this.wireTimer = null;
    this.intent.persistNow();
  },

  /** Intent-adaptive cadence; exponential backoff while the writer is away. */
  wirePollInterval() {
    if (!this.wireStatus.live) { this.wireBackoff = Math.min(30, Math.max(3, this.wireBackoff * 2)); return this.wireBackoff; }
    this.wireBackoff = 1.5;
    if (Date.now() < this.intent.burstUntil) return 1.0;
    if (this.inCall) return 1.0;
    const s = this.intent.current;
    if (s === "tasks" || s === "projectMap" || s === "needsYou") return 1.5;
    if (Date.now() - this.intent.lastRecordAt > 60_000) return 8.0;
    return 3.0;
  },

  async rpc(tool, args, timeoutMs = 2500) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.writerURL.replace(/\/$/, "")}/rpc`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args }), signal: ctrl.signal,
      });
      return await res.json();
    } finally { clearTimeout(t); }
  },

  async pollWire() {
    if (this.wirePolling) return;
    this.wirePolling = true;
    try {
      const envelope = await this.rpc("events_since", { sinceSeq: this.wireSeq });
      const result = envelope?.result;
      if (!result || typeof result.latestSeq !== "number") throw new Error(envelope?.error ?? "malformed envelope");
      this.wireLastPollAt = Date.now();
      this.wireLastError = null;
      if (result.latestSeq < this.wireSeq) {
        // The writer restarted with a fresh log. Resync from the top.
        this.wireSeq = -1;
        for (const id of this.wireReminderScheduled) this.hooks.cancelSessionReminder(id);
        this.wireSessions = {}; this.wireBeats = {}; this.wireBeatRelated = {}; this.wireBeatPrograms = {};
        this.beats = [];
        this.wireUpcomingSessions = []; this.wireActiveSession = null; this.wireActiveProgramId = null;
        this.wireReminderScheduled = new Set();
        this.titleGrantsByID = {}; this.titleEventLog = [];
        this.commit();
        return;
      }
      let count = this.wireStatus.live ? this.wireStatus.events : 0;
      for (const entry of result.events ?? []) { this.applyWireEvent(entry.event ?? entry); count++; }
      this.wireSeq = Math.max(this.wireSeq, result.latestSeq);
      this.wireStatus = { live: true, latestSeq: this.wireSeq, events: count };
      if (this.wireDropped) this.wireDropped = false;
      if ((result.events ?? []).length) { this.intent.burstUntil = Date.now() + 20_000; this.rebuildFromWire(); }
      this.commit();
    } catch (err) {
      this.wireLastError = String(err?.message ?? err);
      // Guarded: an offline writer must not re-publish the app every poll, and
      // a drop keeps the cursor/event count so WIRE diagnostics stay truthful.
      if (this.wireStatus.live) { this.wireStatus = { live: false, latestSeq: this.wireSeq, events: this.wireStatus.events }; this.wireDropped = true; this.commit(); }
    } finally { this.wirePolling = false; }
  },

  applyWireEvent(event) {
    if (!event || typeof event.type !== "string") return;
    const at = parseIso(event.at) ?? Date.now();
    switch (event.type) {
      case "control.join": {
        const p = event.participant; if (!p) return;
        this.wireParticipants[p.id] = { id: p.id, kind: p.kind ?? "agent", displayName: p.displayName ?? displayName(p.id), role: p.role ?? "partner", joinedAt: at };
        return;
      }
      case "control.title_granted": {
        const grant = materializeGrant(event.grant); if (!grant) return;
        this.applyTitleGrant(grant, event.id ?? null); return;
      }
      case "control.title_transferred": {
        const grant = materializeGrant(event.toGrant); if (!event.fromGrantId || !grant) return;
        this.applyTitleTransfer(event.fromGrantId, grant, parseIso(event.transferredAt) ?? at, event.id ?? null); return;
      }
      case "control.title_revoked":
        if (!event.grantId) return;
        this.applyTitleRevocation(event.grantId, parseIso(event.revokedAt) ?? at, event.reason ?? "revoked", event.id ?? null); return;
      case "control.leave":
        if (!event.participantId) return;
        delete this.wireParticipants[event.participantId];
        this.applyControlLeave(event.participantId, at, event.reason ?? "left", event.id ?? null); return;
      case "control.end":
        this.wireParticipants = {};
        this.applyControlEnd(at, event.reason ?? "ended", event.id ?? null); return;
      case "control.invite": {
        const { id, inviterId, inviteeId } = event;
        if (!id || !inviterId || !inviteeId || this.inbox.some((i) => i.id === id)) return;
        this.countSkillUse(inviterId, "inviting");
        const outgoing = isLocalUser(inviterId);
        if (!outgoing && !isLocalUser(inviteeId)) return;
        this.inbox.unshift({
          id, kind: "invite",
          title: outgoing ? `You invited ${displayName(inviteeId)} to a working session` : `${displayName(inviterId)} invited you to a working session`,
          body: event.note ?? (event.title ? `${event.title} — join when you're ready.` : "Join when you're ready."),
          age: relative(at), read: outgoing, archived: false, interruptId: null, sessionId: event.sessionId ?? null,
        });
        return;
      }
      case "control.session_created": {
        const { sessionId: id, organizerId, title, project, participantIds, agendaTaskIds } = event;
        if (!id || !organizerId || !title || !project || !participantIds || !agendaTaskIds) return;
        this.wireSessions[id] = { id, organizerId, title, project, participantIds, agendaTaskIds, note: event.note ?? "Join when you're ready.", createdAt: at, scheduledAt: null, startedAt: null, endedAt: null, programId: null, replayArtifactId: null };
        return;
      }
      case "control.session_scheduled": {
        const s = this.wireSessions[event.sessionId]; const when = parseIso(event.scheduledFor);
        if (s && when != null) s.scheduledAt = when; return;
      }
      case "control.session_started": {
        const s = this.wireSessions[event.sessionId]; if (!s || !event.programId) return;
        s.startedAt = at; s.endedAt = null; s.programId = event.programId; return;
      }
      case "control.session_ended": {
        const s = this.wireSessions[event.sessionId]; if (!s) return;
        s.endedAt = at; s.replayArtifactId = event.replayArtifactId ?? null; return;
      }
      case "work.generic": break;
      default: return;
    }

    const kind = event.kind, payload = event.payload;
    if (!kind || !payload) return;
    const actorId = event.actorId ?? "coder";

    const line = payload.title ?? payload.summary;
    if (line) {
      this.wireActorStatus[actorId] = { line, at };
      if (event.id) {
        if (this.wireEventTitles[event.id] == null) this.wireEventOrder.push(event.id);
        this.wireEventTitles[event.id] = payload.summary ? `${line} — ${payload.summary}` : line;
        if (this.wireEventOrder.length > EVENT_TITLE_CAP) delete this.wireEventTitles[this.wireEventOrder.shift()];
      }
    }

    switch (kind) {
      case "work.direction.beat": this.countSkillUse(payload.directorId ?? actorId, "directing"); break;
      case "work.task.created": case "work.task.state": case "work.task.progress": this.countSkillUse(actorId, "tasks"); break;
      case "work.artifact.created":
        this.countSkillUse(actorId, "artifacts");
        if (payload.kind === "diff") this.countSkillUse(actorId, "editing");
        if (payload.kind === "report") this.countSkillUse(actorId, "testing");
        break;
      default: break;
    }

    switch (kind) {
      case "work.task.created": {
        const { taskId: id, title, project } = payload;
        if (!id || !title || !project) return;
        if (!this.wireTasks[id]) this.wireTaskOrder.push(id);
        this.wireTasks[id] = { id, title, room: project, agentName: displayName(actorId), agentColor: colorForActor(actorId), state: cap(payload.state ?? "queued"), progress: null, detail: null, deps: payload.deps ?? [] };
        if (!["Running", "Review", "Blocked", "Queued", "Done"].includes(this.wireTasks[id].state)) this.wireTasks[id].state = "Queued";
        this.wireTaskAt[id] = at;
        this.evictTasksIfNeeded();
        return;
      }
      case "work.task.progress": {
        const t = this.wireTasks[payload.taskId]; if (!t || typeof payload.progress !== "number") return;
        t.progress = payload.progress; this.wireTaskAt[t.id] = at; return;
      }
      case "work.task.state": {
        const t = this.wireTasks[payload.taskId]; if (!t || !payload.state) return;
        const st = cap(payload.state); t.state = ["Running", "Review", "Blocked", "Queued", "Done"].includes(st) ? st : "Queued";
        if (payload.summary) t.detail = payload.summary;
        this.wireTaskAt[t.id] = at; return;
      }
      case "work.artifact.created": {
        const { artifactId: id, title } = payload; const kindLabel = cap(payload.kind ?? "");
        if (!id || !title || !Object.values(ArtifactKind).includes(kindLabel)) return;
        let life;
        if (payload.life?.ttlDays != null) life = ephemeral(Math.max(0, payload.life.ttlDays - Math.floor((Date.now() - at) / 86_400_000)));
        else life = permanent();
        if (!this.wireArtifacts[id]) this.wireArtifactOrder.push(id);
        this.wireArtifacts[id] = { id, title, kind: kindLabel, room: payload.project ?? "Auth middleware", repo: payload.repo ?? "drive-mode", agentName: displayName(actorId), agentColor: colorForActor(actorId), age: relative(at), day: "Today", meta: payload.summary ?? kindLabel.toLowerCase(), sizeKB: payload.sizeKb ?? 0, life, at };
        if (this.wireArtifactOrder.length > ARTIFACT_CAP) delete this.wireArtifacts[this.wireArtifactOrder.shift()];
        return;
      }
      case "work.direction.beat": {
        const { beatIndex: index, title } = payload;
        if (typeof index !== "number" || !title || !payload.kind) return;
        const directorId = payload.directorId ?? actorId;
        const programId = payload.programId ?? "legacy";
        const key = `${programId}#${index}`;
        this.wireBeats[key] = { id: index, kind: BEAT_KINDS[payload.kind] ?? "PLAN", title, director: displayName(directorId), directorColor: colorForActor(directorId), caption: payload.caption ?? title, duration: payload.durationSec ?? 7, steps: payload.steps ?? [], accent: payload.accent ?? [] };
        this.wireBeatRelated[key] = payload.relatedEventIds ?? [];
        this.wireBeatPrograms[key] = programId;
        const keys = Object.keys(this.wireBeats);
        if (keys.length > BEAT_CAP) { const victim = keys.sort()[0]; delete this.wireBeats[victim]; delete this.wireBeatRelated[victim]; delete this.wireBeatPrograms[victim]; }
        return;
      }
      default: return;
    }
  },

  /** A typed session message joins the room's feed — fire and forget. */
  postConversation(text) {
    if (!this.wireStatus.live) return;
    this.rpc("conversation_publish", { text, actorId: LOCAL_USER }).catch(() => {});
  },

  async publishSessionPlan(session, inviteeIds) {
    if (!this.wireStatus.live) throw new Error("writer offline");
    const organizerId = LOCAL_USER;
    const participantIds = session.participantIds ?? [organizerId, ...inviteeIds];
    const agendaTaskIds = session.agendaTaskIds ?? [];
    const scheduledAt = session.scheduledAt ?? scheduledDateFor(session.when);
    this.applyWireEvent(await this.performWireMutation("session_create", { sessionId: session.id, organizerId, title: session.title, project: session.project, participantIds: [...new Set(participantIds)].sort(), agendaTaskIds, note: session.note }));
    this.applyWireEvent(await this.performWireMutation("session_schedule", { sessionId: session.id, scheduledFor: isoString(scheduledAt), actorId: organizerId }));
    if (session.when === "Now") this.applyWireEvent(await this.performWireMutation("session_start", { sessionId: session.id, programId: `program-${session.id}`, actorId: organizerId }));
    for (const inviteeId of inviteeIds) this.applyWireEvent(await this.performWireMutation("room_invite", { inviterId: organizerId, inviteeId, sessionId: session.id, title: session.title, note: session.note }));
    this.rebuildFromWire();
    this.commit();
  },

  async cancelWireSession(sessionId) {
    this.applyWireEvent(await this.performWireMutation("session_end", { sessionId, outcome: "cancelled", actorId: LOCAL_USER }));
    this.rebuildFromWire();
    this.commit();
  },

  async publishPresenterGrant(grant) { this.applyWireEvent(await this.performWireMutation("title_grant", grantArgs(grant))); },

  async publishPresenterTransfer(from, grant) {
    const args = grantArgs(grant);
    delete args.grantId; delete args.agentId; delete args.scopeKind; delete args.scopeRef;
    args.fromGrantId = from.id; args.toGrantId = grant.id; args.toAgentId = grant.agentId;
    this.applyWireEvent(await this.performWireMutation("title_transfer", args));
  },

  async publishPresenterRevocation(grant, reason) {
    this.applyWireEvent(await this.performWireMutation("title_revoke", { grantId: grant.id, reason, actorId: LOCAL_USER }));
  },

  async performWireMutation(tool, args) {
    const response = await this.rpc(tool, args, 3500);
    if (!response?.ok) throw new Error(response?.error ?? "writer rejected mutation");
    if (!response.result?.event) throw new Error("missing event");
    return response.result.event;
  },

  countSkillUse(actorId, skill) {
    const row = (this.wireSkillUse[actorId] ??= {});
    row[skill] = (row[skill] ?? 0) + 1;
  },

  evictTasksIfNeeded() {
    if (this.wireTaskOrder.length <= TASK_CAP) return;
    const victim = this.wireTaskOrder.find((id) => this.wireTasks[id]?.state === "Done") ?? this.wireTaskOrder[0];
    delete this.wireTasks[victim]; delete this.wireTaskAt[victim];
    this.wireTaskOrder.splice(this.wireTaskOrder.indexOf(victim), 1);
  },

  /** The wire replaces a category only once it actually carries one. */
  rebuildFromWire() {
    const tasks = Object.values(this.wireTasks);
    if (tasks.length) {
      const pulsing = new Set(tasks.filter((t) => t.state === "Running" || t.state === "Review" || t.state === "Blocked").map((t) => t.room));
      for (const p of pulsing) this.archivedProjects.delete(p);
      this.tasks = tasks.sort((a, b) => a.id.localeCompare(b.id));
      this.interrupts = tasks.filter((t) => t.state === "Blocked").sort((a, b) => a.id.localeCompare(b.id)).map((t) => ({
        id: `wire-${t.id}`, agentName: t.agentName, agentColor: t.agentColor, title: `${t.agentName} is blocked — ${t.title}`, kind: "blocked",
        detail: t.detail ? [t.detail] : [], age: this.wireTaskAt[t.id] ? relative(this.wireTaskAt[t.id]) : "now", resolved: false, taskId: t.id,
      }));
    }
    const artifacts = Object.values(this.wireArtifacts);
    if (artifacts.length) this.artifacts = artifacts.sort((a, b) => a.id.localeCompare(b.id));
    this.rebuildWireSessions();

    const beatKeys = Object.keys(this.wireBeats);
    if (beatKeys.length) {
      const active = beatKeys.filter((k) => this.wireActiveProgramId == null || this.wireBeatPrograms[k] === this.wireActiveProgramId);
      this.beats = active.sort((a, b) => (this.wireBeats[a].id - this.wireBeats[b].id) || a.localeCompare(b)).map((key) => {
        const beat = this.wireBeats[key];
        if (beat.steps.length) return beat;
        const steps = (this.wireBeatRelated[key] ?? []).map((id) => this.wireEventTitles[id]).filter(Boolean);
        return steps.length ? { ...beat, steps } : beat;
      });
    }

    const infos = Object.values(this.wireParticipants).filter((p) => p.kind === "agent");
    if (infos.length) {
      const blocked = new Set(tasks.filter((t) => t.state === "Blocked").map((t) => t.agentName));
      this.agents = infos.sort((a, b) => a.id.localeCompare(b.id)).map((info) => {
        const name = info.id === "coder" ? "Cline" : info.displayName;
        const status = this.wireActorStatus[info.id];
        return { id: info.id, name, role: String(info.role).toUpperCase(), color: colorForActor(info.id), statusLine: status?.line ?? "Joined the room", age: relative(status?.at ?? info.joinedAt), state: blocked.has(name) ? "Needs you" : "Working", voice: "—", editsAllowed: 0, testsRun: 0, uptime: relative(info.joinedAt) };
      });
    }
  },

  rebuildWireSessions() {
    const all = Object.values(this.wireSessions);
    const live = all.filter((s) => s.startedAt != null && s.endedAt == null).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
    this.wireActiveSession = live ? this.materializeSession(live) : null;
    this.wireActiveProgramId = live?.programId ?? null;
    this.wireUpcomingSessions = all.filter((s) => s.startedAt == null && s.endedAt == null).sort((a, b) => (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt)).map((s) => this.materializeSession(s));
    this.wireEndedSessions = all.filter((s) => s.endedAt != null).sort((a, b) => b.endedAt - a.endedAt).map((s) => ({ ...this.materializeSession(s), endedAt: s.endedAt, replayArtifactId: s.replayArtifactId }));
    for (const s of all) {
      if ((s.startedAt != null || s.endedAt != null) && this.wireReminderScheduled.has(s.id)) { this.hooks.cancelSessionReminder(s.id); this.wireReminderScheduled.delete(s.id); }
    }
    for (const s of all) {
      if (s.startedAt != null || s.endedAt != null || s.scheduledAt == null) continue;
      if (s.scheduledAt - Date.now() <= -60_000 || this.wireReminderScheduled.has(s.id)) continue;
      this.hooks.scheduleSessionReminder(this.materializeSession(s));
      this.wireReminderScheduled.add(s.id);
    }
  },

  materializeSession(s) {
    const people = s.participantIds.map((id) => this.wireParticipants[id]?.displayName ?? displayName(id));
    return { id: s.id, title: s.title, project: s.project, when: s.scheduledAt != null ? displayWhen(s.scheduledAt) : "Time not set", people, agendaCount: s.agendaTaskIds.length, note: s.note, participantIds: s.participantIds, agendaTaskIds: s.agendaTaskIds, scheduledAt: s.scheduledAt, startedAt: s.startedAt ?? null };
  },

  /** Diagnostics for Settings → WIRE. */
  wireSnapshot() {
    return {
      url: this.writerURL, discovered: this.discoveredWriter ?? null, status: this.wireStatus, dropped: this.wireDropped, seq: this.wireSeq,
      lastPollAt: this.wireLastPollAt, lastError: this.wireLastError, backoff: this.wireBackoff, interval: this.wireTimer != null ? this.wirePollIntervalPreview() : null,
      tasks: Object.keys(this.wireTasks).length, artifacts: Object.keys(this.wireArtifacts).length, beats: Object.keys(this.wireBeats).length,
      participants: Object.keys(this.wireParticipants).length, sessions: Object.keys(this.wireSessions).length, grants: Object.keys(this.titleGrantsByID).length,
    };
  },

  wirePollIntervalPreview() {
    if (!this.wireStatus.live) return this.wireBackoff;
    if (Date.now() < this.intent.burstUntil || this.inCall) return 1.0;
    const s = this.intent.current;
    if (s === "tasks" || s === "projectMap" || s === "needsYou") return 1.5;
    if (Date.now() - this.intent.lastRecordAt > 60_000) return 8.0;
    return 3.0;
  },
};

function materializeGrant(raw) {
  if (!raw || raw.title !== "presenter" || !raw.scope || !["room", "session", "stage"].includes(raw.scope.kind)) return null;
  const grantedAt = parseIso(raw.grantedAt), expiresAt = parseIso(raw.expiresAt);
  if (grantedAt == null || expiresAt == null) return null;
  const permissions = (raw.permissions ?? []).filter((p) => p === "stage.present");
  if (!permissions.length) return null;
  return { id: raw.id, agentId: raw.agentId, title: "presenter", scope: { kind: raw.scope.kind, reference: raw.scope.ref }, skillBundleRefs: raw.skillBundleRefs ?? [], resourceGrantRefs: raw.resourceGrantRefs ?? [], delegatedAgentIds: raw.delegatedAgentIds ?? [], permissions, grantedAt, expiresAt, revokedAt: parseIso(raw.revokedAt) };
}

function grantArgs(grant) {
  return {
    grantId: grant.id, agentId: grant.agentId, title: grant.title, scopeKind: grant.scope.kind, scopeRef: grant.scope.reference,
    skillBundleRefs: grant.skillBundleRefs, resourceGrantRefs: grant.resourceGrantRefs, delegatedAgentIds: grant.delegatedAgentIds,
    permissions: grant.permissions, expiresAt: isoString(grant.expiresAt), actorId: LOCAL_USER,
  };
}

Object.assign(AppStore.prototype, wire);
export { LOCAL_USER };
