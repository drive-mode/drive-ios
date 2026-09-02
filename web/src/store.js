// AppStore — the app state, a port of `Sources/Store.swift` (+ the title
// extension from AgentTitles.swift). One observable object; views call
// `useStore()` and read fields directly, mutate through methods, and every
// method ends in `commit()` so subscribers re-render once per microtask.
import { Observable } from "./ui.js";
import { prefs, prefBool } from "./prefs.js";
import {
  DemoData, generatedFleet, WORK_TARGET_PREVIEWS, WORK_TARGET_UNCONFIGURED, CALL_PRESET_FALLBACK,
  CALL_PRESET_UNAVAILABLE, UPCOMING_SEED, targetCanUse, grantIsActive, AgentTitle, AgentTitlePermission,
} from "./models.js";
import { IntentRecorder, PreheatEngine } from "./intent.js";
import { nav } from "./nav.js";

// ------------------------------------------------------ configuration

/** One release policy decides what an incomplete integration may reach. */
export function createConfiguration({ search = window.location.search } = {}) {
  const params = new URLSearchParams(search);
  const raw = (params.get("channel") ?? window.DRIVE_RELEASE_CHANNEL ?? "preview").toLowerCase();
  // Unknown values fail closed, exactly like the plist: production.
  const channel = raw === "preview" ? "preview" : "production";
  const writerBaseURL = (params.get("writer") ?? "").trim();
  const isUITesting = params.get("uitest") === "1";
  const c = {
    channel, writerBaseURL, isUITesting,
    get previewContentEnabled() { return channel === "preview"; },
    get feedbackExperimentsEnabled() { return channel === "preview"; },
    get showcaseEnabled() { return channel === "preview"; },
    get billingEnabled() { return channel === "preview"; },
    get localWriterEnabled() { return channel === "preview"; },
    get writerSettingsVisible() { return c.localWriterEnabled || !!writerBaseURL; },
    permitsWriterURL(value) {
      const v = String(value ?? "").trim();
      if (!v) return false;
      // Same-origin proxy paths are a preview-only transport (serve.py).
      if (v.startsWith("/")) return channel === "preview";
      let url;
      try { url = new URL(v); } catch { return false; }
      const scheme = url.protocol.replace(":", "");
      const host = url.hostname.toLowerCase();
      const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
      if (channel === "preview") return scheme === "https" || (scheme === "http" && loopback);
      return scheme === "https" && !loopback && !host.endsWith(".local");
    },
  };
  return c;
}

const SESSION_DUMMY_ID = "host";

export class AppStore extends Observable {
  constructor(configuration) {
    super();
    this.configuration = configuration;
    this.intent = new IntentRecorder();
    this.preheat = new PreheatEngine();
    this.hooks = { scheduleSessionReminder: () => {}, cancelSessionReminder: () => {} };
    this.wireBackoff = 1.5;

    this.launched = false;
    this.inCall = false;
    this.showApproval = false;
    this.editAllowed = false;
    this.micHeld = false;
    this.handRaised = false;
    this.agents = DemoData.agents.map((a) => ({ ...a }));
    this.interrupts = DemoData.interrupts.map((i) => ({ ...i }));

    // Chat-first Work
    this.workTargets = [...WORK_TARGET_PREVIEWS];
    this.selectedWorkTargetID = WORK_TARGET_PREVIEWS[0].id;
    this.workChatMessages = [];
    this.defaultCallPreset = prefs.get("call.defaultPreset.v1", null) ?? CALL_PRESET_FALLBACK;
    this.activeCallPresenterCandidateIDs = [];
    this.titleGrantsByID = {};
    this.titleEventLog = [];
    this.titleMutationError = null;

    // Tasks + indices
    this._tasks = DemoData.curatedTasks.map((t) => ({ ...t, deps: [...t.deps] }));
    this.projects = [...DemoData.baseProjects];
    this.tasksByProject = {};
    this.aggByProject = {};
    this.orderedProjects = [];
    this.attentionTasks = [];
    this.archivedProjects = new Set();
    this.archivedTasks = new Set();
    this.sweeping = false;
    this.pinnedProjects = new Set(prefs.get("pinnedProjects", []));
    this.neverFileProjects = new Set(prefs.get("neverFileProjects", []));
    this.archivedCount = 0;
    this.sweepCandidateCount = 0;
    this.fleetSeeded = false;

    // Guide bar
    this.tabBarVisible = true;
    this._hideGeneration = 0;

    // Skills, memory, sessions — slices seeded by their owning modules
    this.skillsVersion = 0;
    this.wireSkillUse = {};
    this.skillPackages = prefs.get("skills.packages.v1", null);
    this.skillBundles = prefs.get("skills.bundles.v1", null);
    this.memoryFiles = prefs.get("memory.files.v1", null);
    this.upcomingSessions = prefs.get("upcoming.v1", null) ?? [UPCOMING_SEED];
    this.wireUpcomingSessions = [];
    this.wireActiveSession = null;
    this.wireActiveProgramId = null;
    this.lastSessionError = null;

    // Feedback & experiments
    this.feedbackProgramOn = prefBool("feedback.program", true);
    this.feedbackOptIn = prefBool("feedback.optIn", false);
    this.experiments = prefs.get("experiments.v1", null);

    // Wire
    this.writerURL = "";
    this.wireStatus = { live: false, latestSeq: -1, events: 0 };
    this.wireDropped = false;
    this.wireSeq = -1;
    this.wireTimer = null;
    this.wirePolling = false;
    this.wireTasks = {};
    this.wireTaskAt = {};
    this.wireTaskOrder = [];
    this.wireArtifacts = {};
    this.wireArtifactOrder = [];
    this.wireBeats = {};
    this.wireBeatRelated = {};
    this.wireBeatPrograms = {};
    this.wireSessions = {};
    this.wireReminderScheduled = new Set();
    this.wireParticipants = {};
    this.wireActorStatus = {};
    this.wireEventTitles = {};
    this.wireEventOrder = [];
    this.wireLastPollAt = 0;
    this.wireLastError = null;

    // Director
    this.beats = DemoData.beats.map((b) => ({ ...b }));
    this.callStart = Date.now();
    this.beatSkew = 0;
    this._approvalTimer = 0;

    this.conversations = {};
    this.artifacts = DemoData.artifacts.map((a) => ({ ...a, life: { ...a.life } }));
    this.inbox = DemoData.inbox.map((i) => ({ ...i }));
    this.sessionMessages = [];

    if (!configuration.previewContentEnabled) {
      this.agents = [];
      this.interrupts = [];
      this.workTargets = [WORK_TARGET_UNCONFIGURED];
      this.selectedWorkTargetID = WORK_TARGET_UNCONFIGURED.id;
      this.defaultCallPreset = CALL_PRESET_UNAVAILABLE;
      this._tasks = [];
      this.projects = [];
      this.beats = [];
      this.artifacts = [];
      this.inbox = [];
      this.memoryFiles = [];
      this.upcomingSessions = [];
      this.skillPackages = [];
      this.skillBundles = [];
      this.experiments = [];
    }
    this.launched = configuration.isUITesting || prefs.get("launched", false) === true;

    if (AppStore.autoFileEnabled()) {
      for (const p of AppStore.quietProjects(this._tasks)) if (!this.neverFileProjects.has(p)) this.archivedProjects.add(p);
    }
    this.rebuildTaskIndex();
    if (configuration.previewContentEnabled) this.seedFleet();
  }

  commit() { this.emit(); }
  /** Assign several fields at once and commit. */
  set(patch) { Object.assign(this, patch); this.commit(); }

  // ----------------------------------------------------------- work

  get selectedWorkTarget() {
    return this.workTargets.find((t) => t.id === this.selectedWorkTargetID) ?? this.workTargets[0];
  }

  get callPresetForCurrentTarget() {
    const preset = { ...this.defaultCallPreset, targetIDs: [...this.defaultCallPreset.targetIDs] };
    if (!preset.targetIDs.includes(this.selectedWorkTargetID)) preset.targetIDs = [this.selectedWorkTargetID];
    preset.presenterCandidateIDs = this.defaultCallPreset.presenterCandidateIDs.filter((id) => preset.agentIDs.includes(id));
    return preset;
  }

  selectWorkTarget(id) {
    if (!this.workTargets.some((t) => t.id === id)) return;
    this.selectedWorkTargetID = id;
    this.commit();
  }

  startNewWorkChat() { this.workChatMessages = []; this.commit(); }

  sendWorkChat(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed || !targetCanUse(this.selectedWorkTarget)) return false;
    this.workChatMessages = [...this.workChatMessages, { id: `wc-${Date.now()}-${this.workChatMessages.length}`, text: trimmed, at: Date.now() }];
    this.postConversation(trimmed);
    this.commit();
    return true;
  }

  setDefaultCallPreset(preset) {
    this.defaultCallPreset = preset;
    prefs.set("call.defaultPreset.v1", preset);
    this.commit();
  }

  launchCall(preset, saveAsDefault) {
    const validTargetIDs = preset.targetIDs.filter((id) => this.workTargets.some((t) => t.id === id && targetCanUse(t)));
    const validAgentIDs = preset.agentIDs.filter((id) => this.agents.some((a) => a.id === id));
    if (!validTargetIDs.length || !validAgentIDs.length) return false;
    const sanitized = { ...preset, targetIDs: validTargetIDs, agentIDs: validAgentIDs, presenterCandidateIDs: preset.presenterCandidateIDs.filter((id) => validAgentIDs.includes(id)) };
    if (saveAsDefault) this.setDefaultCallPreset(sanitized);
    this.selectedWorkTargetID = validTargetIDs[0];
    this.joinCall(sanitized.presenterCandidateIDs);
    return true;
  }

  openSettings(tab, source) {
    nav.present("settings", { tab, source });
  }

  // ---------------------------------------------------------- tasks

  get tasks() { return this._tasks; }
  set tasks(value) { this._tasks = value; this.rebuildTaskIndex(); }

  static quietProjects(tasks) {
    const pulse = new Set();
    const all = new Set();
    for (const t of tasks) {
      all.add(t.room);
      if (t.state === "Running" || t.state === "Review" || t.state === "Blocked") pulse.add(t.room);
    }
    const quiet = new Set();
    for (const p of all) if (!pulse.has(p)) quiet.add(p);
    return quiet;
  }

  static sweepAgeDays() {
    switch (prefs.get("archive.sweepAge", "Right away")) {
      case "After 3 days": return 3;
      case "After 7 days": return 7;
      default: return null;
    }
  }

  static autoFileEnabled() { return prefBool("archive.autoFile", true); }

  /** The demo fleet is heavy — build it after first paint, install in one rebuild. */
  seedFleet() {
    const run = () => {
      const generated = generatedFleet();
      const quiet = AppStore.quietProjects(generated.tasks);
      this.installFleet(generated.projects, generated.tasks, quiet);
    };
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 800 });
    else setTimeout(run, 60);
  }

  installFleet(projects, tasks, quiet) {
    if (Object.keys(this.wireTasks).length) return; // the wire owns the world
    this.projects = [...projects];
    if (AppStore.autoFileEnabled()) for (const p of quiet) if (!this.neverFileProjects.has(p)) this.archivedProjects.add(p);
    this.fleetSeeded = true;
    this.tasks = tasks;
    this.commit();
  }

  isArchived(task) { return this.archivedTasks.has(task.id) || this.archivedProjects.has(task.room); }

  get sweepCandidates() {
    const minAgeDays = AppStore.sweepAgeDays();
    const minAge = minAgeDays == null ? null : minAgeDays * 86_400_000;
    return this._tasks.filter((t) => {
      if (t.state !== "Done" || this.isArchived(t) || this.neverFileProjects.has(t.room)) return false;
      if (minAge != null && this.wireTaskAt[t.id] != null) return Date.now() - this.wireTaskAt[t.id] >= minAge;
      return true;
    });
  }

  toggleNeverFile(projectId) {
    if (this.neverFileProjects.has(projectId)) this.neverFileProjects.delete(projectId);
    else { this.neverFileProjects.add(projectId); this.archivedProjects.delete(projectId); }
    prefs.set("neverFileProjects", [...this.neverFileProjects]);
    this.rebuildTaskIndex();
    this.commit();
  }

  togglePin(projectId) {
    if (this.pinnedProjects.has(projectId)) this.pinnedProjects.delete(projectId);
    else this.pinnedProjects.add(projectId);
    prefs.set("pinnedProjects", [...this.pinnedProjects]);
    this.rebuildTaskIndex();
    this.commit();
  }

  archiveProject(projectId) { this.archivedProjects.add(projectId); this.rebuildTaskIndex(); this.commit(); }

  archiveTasks(ids) { for (const id of ids) this.archivedTasks.add(id); this.rebuildTaskIndex(); this.commit(); }

  sweepArchive() {
    if (this.sweeping) return;
    this.sweeping = true;
    this.commit();
    setTimeout(() => {
      for (const t of this.sweepCandidates) this.archivedTasks.add(t.id);
      this.rebuildTaskIndex();
      this.sweeping = false;
      this.commit();
    }, 900);
  }

  restoreProject(projectId) {
    this.archivedProjects.delete(projectId);
    for (const t of this._tasks) if (t.room === projectId) this.archivedTasks.delete(t.id);
    this.rebuildTaskIndex();
    this.commit();
  }

  restoreTask(id) { this.archivedTasks.delete(id); this.rebuildTaskIndex(); this.commit(); }

  rebuildTaskIndex() {
    const byProject = {};
    for (const t of this._tasks) if (!this.isArchived(t)) (byProject[t.room] ??= []).push(t);
    this.tasksByProject = byProject;
    const known = new Set(this.projects.map((p) => p.id));
    for (const room of Object.keys(byProject)) if (!known.has(room)) { this.projects.push({ id: room, name: room, area: "Wire" }); known.add(room); }
    const aggs = {};
    for (const [project, items] of Object.entries(byProject)) {
      const agg = { total: items.length, running: 0, review: 0, blocked: 0, queued: 0, done: 0 };
      for (const t of items) {
        if (t.state === "Running") agg.running++; else if (t.state === "Review") agg.review++;
        else if (t.state === "Blocked") agg.blocked++; else if (t.state === "Queued") agg.queued++; else agg.done++;
      }
      aggs[project] = agg;
    }
    this.aggByProject = aggs;
    const attention = (a) => a.review + a.blocked;
    this.orderedProjects = this.projects
      .filter((p) => !this.archivedProjects.has(p.id) && (aggs[p.id]?.total ?? 0) > 0)
      .sort((a, b) => {
        const ap = this.pinnedProjects.has(a.id), bp = this.pinnedProjects.has(b.id);
        if (ap !== bp) return ap ? -1 : 1;
        const aa = aggs[a.id], bb = aggs[b.id];
        if (attention(aa) !== attention(bb)) return attention(bb) - attention(aa);
        if (aa.running !== bb.running) return bb.running - aa.running;
        return bb.total - aa.total;
      });
    this.attentionTasks = this._tasks
      .filter((t) => t.state === "Blocked" || t.state === "Review")
      .sort((a, b) => {
        if ((a.state === "Blocked") !== (b.state === "Blocked")) return a.state === "Blocked" ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    this.archivedCount = this._tasks.reduce((n, t) => n + (this.isArchived(t) ? 1 : 0), 0);
    this.sweepCandidateCount = this.sweepCandidates.length;

    this.preheat.rebuildSearchIndex(this._tasks.filter((t) => !this.isArchived(t)));
    const hot = this.orderedProjects.slice(0, 4).map((p) => p.id);
    const rooms = this.attentionTasks.slice(0, 3).map((t) => t.room);
    const warm = [...new Set([...hot, ...rooms])];
    this.preheat.warm(warm.filter((id) => byProject[id]).map((id) => [id, byProject[id]]));
  }

  agg(projectId) { return this.aggByProject[projectId] ?? { total: 0, running: 0, review: 0, blocked: 0, queued: 0, done: 0 }; }

  /** Search spans the archive too — filed, not deleted. */
  searchTasks(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return { active: [], archived: [] };
    const activeIds = new Set(this.preheat.searchIndex.filter((e) => e.folded.includes(q)).map((e) => e.id));
    const active = [], archived = [];
    for (const t of this._tasks) {
      if (activeIds.has(t.id)) active.push(t);
      else if (this.isArchived(t) && (t.title.toLowerCase().includes(q) || t.room.toLowerCase().includes(q))) archived.push(t);
    }
    return { active, archived };
  }

  // ------------------------------------------------------- guide bar

  scheduleTabBarHide(seconds = 6) {
    const gen = ++this._hideGeneration;
    setTimeout(() => {
      if (gen !== this._hideGeneration || !this.tabBarVisible) return;
      this.tabBarVisible = false;
      this.commit();
    }, seconds * 1000);
  }
  summonTabBar() { this.tabBarVisible = true; this.commit(); this.scheduleTabBarHide(); }
  touchTabBar() { if (this.tabBarVisible) this.scheduleTabBarHide(); }

  // ------------------------------------------------------- skills

  bumpSkills() { this.skillsVersion++; this.commit(); }
  setSkillPackages(list) { this.skillPackages = list; prefs.set("skills.packages.v1", list); this.commit(); }
  setSkillBundles(list) { this.skillBundles = list; prefs.set("skills.bundles.v1", list); this.commit(); }
  package(id) { return (this.skillPackages ?? []).find((p) => p.id === id) ?? null; }
  updatePackage(pkg) {
    const list = this.skillPackages ?? [];
    const i = list.findIndex((p) => p.id === pkg.id);
    if (i < 0) return;
    this.setSkillPackages(list.map((p, j) => (j === i ? pkg : p)));
  }
  addPackage(pkg) { this.setSkillPackages([...(this.skillPackages ?? []), pkg]); }
  addBundle(name, note, skillIds) {
    this.setSkillBundles([...(this.skillBundles ?? []), { id: `kit-${Math.floor(Date.now() / 1000)}`, name, note, skillIds, builtIn: false }]);
  }

  // ------------------------------------------------------- memory

  setMemoryFiles(list) { this.memoryFiles = list; prefs.set("memory.files.v1", list); this.commit(); }

  // ------------------------------------------------------ sessions

  setUpcomingSessions(list) { this.upcomingSessions = list; prefs.set("upcoming.v1", list); this.commit(); }

  get usesWireSessionRegistry() { return this.wireStatus.live || (this.wireDropped && Object.keys(this.wireSessions).length > 0); }
  get displayedUpcomingSessions() { return this.usesWireSessionRegistry ? this.wireUpcomingSessions : this.upcomingSessions; }
  get hasLiveSession() { return this.usesWireSessionRegistry ? this.wireActiveSession != null : this.beats.length > 0; }
  get liveSessionTitle() { return this.usesWireSessionRegistry ? (this.wireActiveSession?.title ?? "Working session") : "Ship auth middleware"; }
  get liveSessionPeople() {
    if (this.usesWireSessionRegistry) return this.wireActiveSession?.people ?? [];
    return [this.displayNameForUser(), ...this.agents.map((a) => a.name)];
  }
  get hasLiveProgramBeats() { return this.usesWireSessionRegistry ? Object.keys(this.wireBeats).length > 0 && this.beats.length > 0 : this.beats.length > 0; }

  displayNameForUser() { return prefs.get("profile.displayName", null) || (this.configuration.previewContentEnabled ? "Preview" : "You"); }

  async planSession(session, inviteeIds) {
    this.lastSessionError = null;
    if (this.wireDropped) { this.lastSessionError = "Reconnect to the room log before sending invitations."; this.commit(); return false; }
    if (this.wireStatus.live) {
      try { await this.publishSessionPlan(session, inviteeIds); return true; }
      catch { this.lastSessionError = "Writer didn’t finish publishing. Check the room log before retrying."; this.commit(); return false; }
    }
    this.setUpcomingSessions([session, ...this.upcomingSessions]);
    this.inbox.unshift({
      id: `up-${session.id}`, kind: "invite",
      title: `You invited ${session.people.join(" & ")} to a working session`,
      body: `${session.title} — ${session.when}. ${session.agendaCount} agenda item${session.agendaCount === 1 ? "" : "s"}.`,
      age: "now", read: true, archived: false, interruptId: null,
    });
    this.hooks.scheduleSessionReminder(session);
    this.commit();
    return true;
  }

  removeUpcoming(id) {
    if (this.wireStatus.live) { this.cancelWireSession(id).catch(() => {}); return; }
    this.hooks.cancelSessionReminder(id);
    this.setUpcomingSessions(this.upcomingSessions.filter((s) => s.id !== id));
  }

  // -------------------------------------------- feedback & experiments

  setFeedbackProgramOn(on) {
    this.feedbackProgramOn = on;
    prefs.set("feedback.program", on);
    if (!on) this.feedbackKillSwitch();
    this.commit();
  }
  setFeedbackOptIn(on) { this.feedbackOptIn = on; prefs.set("feedback.optIn", on); this.commit(); }
  setExperiments(list) { this.experiments = list; prefs.set("experiments.v1", list); this.commit(); }
  get feedbackAvailable() { return this.configuration.feedbackExperimentsEnabled && this.feedbackProgramOn && this.feedbackOptIn; }

  variantActive(flag) {
    if (!this.configuration.feedbackExperimentsEnabled) return false;
    return (this.experiments ?? []).some((e) => e.flag === flag && e.status === "trialing" && e.expiresAt != null && e.expiresAt > Date.now());
  }

  sweepExperiments() {
    if (!this.configuration.feedbackExperimentsEnabled || !this.experiments) return;
    let any = false;
    const changed = this.experiments.map((e) => {
      if (e.status === "trialing" && e.expiresAt != null && e.expiresAt <= Date.now()) { any = true; return { ...e, status: "expired" }; }
      return e;
    });
    if (!any) return;
    this.setExperiments(changed);
    this.inbox.unshift({ id: `exp-expired-${Math.floor(Date.now() / 1000)}`, kind: "tip", title: "A trial reached its week", body: "The variant reverted itself — trials never outstay the 7-day clock. The suggestion stays in review.", age: "now", read: false, archived: false, interruptId: null });
    this.commit();
  }

  startTrial(id) {
    if (!this.configuration.feedbackExperimentsEnabled) return;
    this.setExperiments((this.experiments ?? []).map((e) => (e.id === id ? { ...e, status: "trialing", startedAt: Date.now(), expiresAt: Date.now() + 7 * 86_400_000 } : e)));
  }
  endTrial(id) { this.setExperiments((this.experiments ?? []).map((e) => (e.id === id ? { ...e, status: "reverted" } : e))); }

  submitSuggestion({ title, summary, surface, flag }) {
    if (!this.configuration.feedbackExperimentsEnabled) return;
    const id = `sug-${Math.floor(Date.now() / 1000)}`;
    this.setExperiments([{ id, title, detail: summary, surface, flag: flag ?? "", status: "suggested", startedAt: null, expiresAt: null, sentAt: Date.now() }, ...(this.experiments ?? [])]);
    this.inbox.unshift({ id: `fb-${id}`, kind: "tip", title: `Suggestion sent — ${title}`, body: "We review within a week: adopt it for everyone or retire it. Track it in Settings → Feedback & experiments.", age: "now", read: false, archived: false, interruptId: null });
    this.commit();
  }

  feedbackKillSwitch() {
    this.feedbackOptIn = false; prefs.set("feedback.optIn", false);
    if (this.experiments) this.setExperiments(this.experiments.map((e) => (e.status === "trialing" ? { ...e, status: "reverted" } : e)));
  }

  // ---------------------------------------------------------- inbox

  get unreadInboxCount() { return this.inbox.filter((i) => !i.read && !i.archived).length; }
  markInbox(id, read) { const i = this.inbox.find((x) => x.id === id); if (i) { i.read = read; this.commit(); } }
  archiveInbox(id, archived = true) { const i = this.inbox.find((x) => x.id === id); if (i) { i.archived = archived; if (archived) i.read = true; this.commit(); } }
  deleteInbox(id) { this.inbox = this.inbox.filter((x) => x.id !== id); this.commit(); }
  markAllInboxRead() { for (const i of this.inbox) i.read = true; this.commit(); }

  setArtifactLife(id, life) { const a = this.artifacts.find((x) => x.id === id); if (a) { a.life = life; this.commit(); } }

  get needsYouCount() { return this.interrupts.filter((i) => !i.resolved && i.kind !== "review").length; }
  get openInterrupts() { return this.interrupts.filter((i) => !i.resolved && i.kind !== "review"); }
  get reportingCount() { return this.agents.filter((a) => a.state !== "Stuck?").length; }
  get stuckCount() { return this.agents.filter((a) => a.state === "Stuck?").length; }
  get runningTasks() { return this._tasks.filter((t) => t.state === "Running").length; }

  // ------------------------------------------------------- director

  get programDuration() { return this.beats.reduce((s, b) => s + b.duration, 0); }

  /** Current beat index and 0..1 progress within it. */
  directorPosition(now = Date.now()) {
    return Director.position(this.beats, (now - this.callStart) / 1000 + this.beatSkew);
  }

  skipToNextBeat() {
    if (!this.beats.length) return;
    const { index: i, progress: p } = this.directorPosition();
    const next = (i + 1) % this.beats.length;
    this.beatSkew += this.beats[i].duration * (1 - p) + this.beats[next].duration * 0.55;
    this.commit();
  }

  skipToPreviousBeat() {
    if (!this.beats.length) return;
    const { index: i, progress: p } = this.directorPosition();
    if (p > 0.2) this.beatSkew -= this.beats[i].duration * p - 0.01;
    else { const prev = (i - 1 + this.beats.length) % this.beats.length; this.beatSkew -= this.beats[i].duration * p + this.beats[prev].duration - 0.01; }
    this.commit();
  }

  /** Jump straight to a beat (rail taps, VoiceOver adjust). */
  seekToBeat(index, within = 0) {
    if (!this.beats.length) return;
    const target = ((index % this.beats.length) + this.beats.length) % this.beats.length;
    let elapsed = 0;
    for (let k = 0; k < target; k++) elapsed += this.beats[k].duration;
    elapsed += this.beats[target].duration * within;
    this.beatSkew = elapsed - (Date.now() - this.callStart) / 1000;
    this.commit();
  }

  // -------------------------------------------------- call lifecycle

  joinCall(presenterCandidates = null) {
    this.launched = true;
    prefs.set("launched", true);
    this.inCall = true;
    this.callStart = Date.now();
    this.beatSkew = 0;
    this.intent.record("work");
    if (presenterCandidates) this.activeCallPresenterCandidateIDs = presenterCandidates;
    else if (!this.activeCallPresenterCandidateIDs.length) this.activeCallPresenterCandidateIDs = [...this.defaultCallPreset.presenterCandidateIDs];
    this.activateDefaultPresenterIfNeeded();
    if (!this.editAllowed) {
      clearTimeout(this._approvalTimer);
      this._approvalTimer = setTimeout(() => {
        if (!this.inCall || this.editAllowed) return;
        this.showApproval = true;
        this.commit();
      }, 6000);
    }
    nav.presentCover("liveCall");
    this.commit();
  }

  leaveCall() {
    this.revokePresenter();
    this.inCall = false;
    this.showApproval = false;
    clearTimeout(this._approvalTimer);
    this.sessionMessages = [];
    this.activeCallPresenterCandidateIDs = [];
    this.micHeld = false;
    this.handRaised = false;
    nav.dismissCover();
    this.commit();
  }

  launch() { this.launched = true; prefs.set("launched", true); this.commit(); }
  /** Back to the Open screen (Settings → Privacy → Sign out of preview). */
  unlaunch() { this.launched = false; prefs.set("launched", false); nav.dismissAll(); nav.popToRoot(); this.commit(); }

  sendSessionMessage(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return;
    this.sessionMessages = [...this.sessionMessages, { id: `sm-${Date.now()}`, text: trimmed }];
    if (this.sessionMessages.length > 3) this.sessionMessages = this.sessionMessages.slice(1);
    this.postConversation(trimmed);
    this.commit();
  }

  allowEdit() {
    this.editAllowed = true;
    this.showApproval = false;
    this.resolveInterrupt("approve-auth");
    const coder = this.agents.find((a) => a.id === "coder");
    if (coder) { coder.statusLine = "Landing requireAuth · tests queued"; coder.age = "2s"; coder.state = "Working"; }
    const n1 = this.inbox.find((i) => i.id === "n1"); if (n1) n1.read = true;
    this.commit();
  }

  denyEdit() {
    this.showApproval = false;
    this.resolveInterrupt("approve-auth");
    const coder = this.agents.find((a) => a.id === "coder");
    if (coder) { coder.statusLine = "Edit denied — drafting alternative"; coder.age = "1s"; coder.state = "Working"; }
    const n1 = this.inbox.find((i) => i.id === "n1"); if (n1) n1.read = true;
    this.commit();
  }

  resolveInterrupt(id) { const i = this.interrupts.find((x) => x.id === id); if (i) { i.resolved = true; this.commit(); } }

  // --------------------------------------------------- conversations

  thread(interruptId) {
    if (this.conversations[interruptId]) return this.conversations[interruptId];
    const seeded = DemoData.seedConversation(interruptId).map((m, k) => ({ ...m, id: `${interruptId}-${k}` }));
    this.conversations[interruptId] = seeded;
    return seeded;
  }

  sendReply(interruptId, text) {
    const msgs = [...this.thread(interruptId), { id: `${interruptId}-you-${Date.now()}`, sender: "you", text, time: "now" }];
    this.conversations[interruptId] = msgs;
    this.resolveInterrupt(interruptId);
    if (interruptId === "blocked-scout") {
      const scout = this.agents.find((a) => a.id === "scout");
      if (scout) { scout.statusLine = "Rotating staging secrets · env"; scout.age = "1s"; scout.state = "Working"; }
      const t4 = this._tasks.find((t) => t.id === "t4");
      if (t4) { t4.state = "Running"; t4.progress = 0.08; t4.detail = "Reading env.DATABASE_URL"; this.rebuildTaskIndex(); }
      const n2 = this.inbox.find((i) => i.id === "n2"); if (n2) n2.read = true;
    }
    this.commit();
    setTimeout(() => {
      const ack = interruptId === "blocked-scout" ? "On it — reading env.DATABASE_URL. I'll report when staging is green."
        : interruptId === "review-maya" ? "Noted — I'll keep the plan parked until you open it." : "Got it.";
      this.conversations[interruptId] = [...this.thread(interruptId), { id: `${interruptId}-ack-${Date.now()}`, sender: "agent", text: ack, time: "now" }];
      this.commit();
    }, 1200);
  }

  /** Derived from callStart — rendered inside a ticking leaf, never a store publish. */
  callClock(now = Date.now(), start = this.callStart) {
    const seconds = 724 + Math.max(0, Math.floor((now - start) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  // --------------------------------------------------- agent titles

  get activePresenterGrant() {
    return Object.values(this.titleGrantsByID)
      .filter((g) => g.title === AgentTitle.presenter && grantIsActive(g))
      .sort((a, b) => b.grantedAt - a.grantedAt)[0] ?? null;
  }
  get activePresenterAgent() {
    const id = this.activePresenterGrant?.agentId;
    return id ? this.agents.find((a) => a.id === id) ?? null : null;
  }
  get presenterEligibleAgents() { return this.agents.filter((a) => this.activeCallPresenterCandidateIDs.includes(a.id)); }

  applyTitleGrant(grant, eventId = null) {
    const current = this.activePresenterGrant;
    if (current && current.id !== grant.id) {
      this.titleMutationError = `Presenter is already assigned to ${this.displayNameForAgent(current.agentId)}. Transfer it instead.`;
      this.commit();
      return false;
    }
    this.titleGrantsByID[grant.id] = grant;
    this.appendTitleReceipt({ id: eventId ?? `local-title-grant-${grant.id}`, kind: "granted", at: grant.grantedAt, fromAgentId: null, toAgentId: grant.agentId, reason: null });
    this.titleMutationError = null;
    this.commit();
    return true;
  }

  applyTitleTransfer(fromGrantId, toGrant, at, eventId = null) {
    const fromAgentId = this.titleGrantsByID[fromGrantId]?.agentId ?? null;
    if (this.titleGrantsByID[fromGrantId]) this.titleGrantsByID[fromGrantId] = { ...this.titleGrantsByID[fromGrantId], revokedAt: at };
    this.titleGrantsByID[toGrant.id] = toGrant;
    this.appendTitleReceipt({ id: eventId ?? `local-title-transfer-${fromGrantId}-${toGrant.id}`, kind: "transferred", at, fromAgentId, toAgentId: toGrant.agentId, reason: null });
    this.titleMutationError = null;
    this.commit();
  }

  applyTitleRevocation(grantId, at, reason, eventId = null) {
    const grant = this.titleGrantsByID[grantId];
    if (!grant) return;
    this.titleGrantsByID[grantId] = { ...grant, revokedAt: at };
    this.appendTitleReceipt({ id: eventId ?? `local-title-revoke-${grantId}-${Math.floor(at / 1000)}`, kind: "revoked", at, fromAgentId: grant.agentId, toAgentId: null, reason });
    this.titleMutationError = null;
    this.commit();
  }

  applyControlLeave(participantId, at, reason = "left", eventId = null) {
    const live = Object.values(this.titleGrantsByID).filter((g) => g.agentId === participantId && grantIsActive(g, at)).map((g) => g.id);
    for (const id of live) this.applyTitleRevocation(id, at, reason, eventId ? `${eventId}-leave-${id}` : null);
  }

  applyControlEnd(at, reason = "ended", eventId = null) {
    const live = Object.values(this.titleGrantsByID).filter((g) => grantIsActive(g, at)).map((g) => g.id);
    for (const id of live) this.applyTitleRevocation(id, at, reason, eventId ? `${eventId}-end-${id}` : null);
  }

  requestPresenter(agentId, duration = 15 * 60) {
    if (!this.activeCallPresenterCandidateIDs.includes(agentId) || !this.agents.some((a) => a.id === agentId)) {
      this.titleMutationError = "That agent is not eligible to present in this call.";
      this.commit();
      return;
    }
    const now = Date.now();
    const grant = this.makePresenterGrant(agentId, now, duration);
    if (this.wireStatus.live) {
      const current = this.activePresenterGrant;
      (current ? this.publishPresenterTransfer(current, grant) : this.publishPresenterGrant(grant))
        .catch(() => { this.titleMutationError = "The host did not accept the Presenter change."; this.commit(); });
    } else {
      const current = this.activePresenterGrant;
      if (current) { if (current.agentId === agentId) return; this.applyTitleTransfer(current.id, grant, now); }
      else this.applyTitleGrant(grant);
    }
  }

  revokePresenter(reason = "revoked") {
    const current = this.activePresenterGrant;
    if (!current) return;
    if (this.wireStatus.live) {
      this.publishPresenterRevocation(current, reason).catch(() => { this.titleMutationError = "The host did not accept the Presenter revocation."; this.commit(); });
    } else this.applyTitleRevocation(current.id, Date.now(), reason);
  }

  activateDefaultPresenterIfNeeded() {
    if (this.activePresenterGrant) return;
    const candidate = this.activeCallPresenterCandidateIDs[0];
    if (candidate) this.requestPresenter(candidate);
  }

  makePresenterGrant(agentId, at = Date.now(), duration = 15 * 60) {
    return {
      id: `grant-presenter-${agentId}-${at}`, agentId, title: AgentTitle.presenter,
      scope: { kind: "stage", reference: this.wireActiveProgramId ?? "local-stage" },
      skillBundleRefs: ["bundle-presenter-v1"], resourceGrantRefs: ["typed-stage"], delegatedAgentIds: [],
      permissions: [AgentTitlePermission.stagePresent], grantedAt: at, expiresAt: at + duration * 1000, revokedAt: null,
    };
  }

  displayNameForAgent(id) { return this.agents.find((a) => a.id === id)?.name ?? id; }

  appendTitleReceipt(receipt) {
    if (this.titleEventLog.some((r) => r.id === receipt.id)) return;
    this.titleEventLog = [...this.titleEventLog, receipt].sort((a, b) => a.at - b.at).slice(-200);
  }
}

/** Director paging — pure, so tests and the replay player share it. */
export const Director = {
  position(beats, elapsed) {
    if (!beats.length) return { index: 0, progress: 0 };
    const total = beats.reduce((s, b) => s + b.duration, 0);
    let t = ((elapsed % total) + total) % total;
    for (let i = 0; i < beats.length; i++) {
      if (t < beats[i].duration) return { index: i, progress: t / beats[i].duration };
      t -= beats[i].duration;
    }
    return { index: beats.length - 1, progress: 1 };
  },
};

export { SESSION_DUMMY_ID as LOCAL_USER_ID };
