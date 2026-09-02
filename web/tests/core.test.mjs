// Core parity tests — the web counterparts of Tests/DriveCoreTests.swift:
// director paging, release fail-closed, target safety, call presets,
// runtime-badge allowlist, Presenter exclusivity/transfer/revocation,
// Director policy non-exportability, the wire fold, and the archive rules.
//
//   node --test 'web/tests/**/*.test.mjs'
import "./helpers/dom-shim.mjs";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { createConfiguration, AppStore, Director } = await import("../src/store.js");
await import("../src/wire.js");
const models = await import("../src/models.js");
const { prefs } = await import("../src/prefs.js");
const { IntentRecorder } = await import("../src/intent.js");

beforeEach(() => prefs.clearAll());
const preview = () => new AppStore(createConfiguration({ search: "" }));
const production = () => new AppStore(createConfiguration({ search: "?channel=production" }));

test("director paging loops through the program and lands 55% into the next beat on forward skip", () => {
  const s = preview();
  const beats = s.beats;
  assert.equal(beats.length, 8);
  assert.deepEqual(Director.position(beats, 0), { index: 0, progress: 0 });
  const total = beats.reduce((n, b) => n + b.duration, 0);
  assert.equal(Director.position(beats, total).index, 0);
  assert.equal(Director.position(beats, beats[0].duration + 1).index, 1);
  s.callStart = Date.now();
  s.skipToNextBeat();
  const { index, progress } = s.directorPosition();
  assert.equal(index, 1);
  assert.ok(progress > 0.5 && progress < 0.6, `progress ${progress}`);
  s.skipToPreviousBeat(); // >20% in → restarts the current beat
  assert.equal(s.directorPosition().index, 1);
  assert.ok(s.directorPosition().progress < 0.05);
});

test("release configuration fails closed and unknown channels default to production", () => {
  const p = createConfiguration({ search: "?channel=production" });
  assert.equal(p.channel, "production");
  for (const flag of ["previewContentEnabled", "feedbackExperimentsEnabled", "showcaseEnabled", "billingEnabled", "localWriterEnabled"]) assert.equal(p[flag], false, flag);
  assert.equal(createConfiguration({ search: "?channel=bogus" }).channel, "production");
  assert.equal(createConfiguration({ search: "" }).channel, "preview");
  assert.equal(p.permitsWriterURL("http://127.0.0.1:4600"), false);
  assert.equal(p.permitsWriterURL("https://writer.local"), false);
  assert.equal(p.permitsWriterURL("https://hub.example.com"), true);
  const v = createConfiguration({ search: "" });
  assert.equal(v.permitsWriterURL("http://127.0.0.1:4600"), true);
  assert.equal(v.permitsWriterURL("http://10.0.0.5:4600"), false);
  assert.equal(v.permitsWriterURL("/writer"), true);
  assert.equal(p.permitsWriterURL("/writer"), false, "the serve.py proxy is preview-only");
});

test("discovery only uses the proxy when the discovered writer itself passes the channel policy", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ url: "http://127.0.0.1:43483", proxy: "/writer" }) });
  try {
    assert.equal(await preview().resolveInitialWriterURL(), "/writer");
    assert.equal(await production().resolveInitialWriterURL(), "");
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ url: "https://hub.example.com", proxy: "/writer" }) });
    assert.equal(await production().resolveInitialWriterURL(), "", "production never rides the proxy");
  } finally { globalThis.fetch = realFetch; }
});

test("pause during an in-flight poll cancels that loop; resume runs exactly one chain", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 40)); return { ok: true, json: async () => ({ result: { latestSeq: -1, events: [] } }) }; };
  try {
    const s = preview();
    s.writerURL = "http://127.0.0.1:4600";
    s.startWire();
    await new Promise((r) => setTimeout(r, 10)); // first poll is in flight
    s.pauseWire();
    s.startWire();
    s.startWire();
    await new Promise((r) => setTimeout(r, 120));
    s.pauseWire();
    const settled = calls;
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(calls, settled, "no polls after pause");
    assert.ok(calls <= 3, `only one chain polled (${calls} calls)`);
    assert.equal(s.wireStatus.live, true);
  } finally { globalThis.fetch = realFetch; }
});

test("a dropped wire keeps its cursor and event count for diagnostics", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: { latestSeq: 7, events: [] } }) });
  try {
    const s = preview();
    s.writerURL = "http://127.0.0.1:4600";
    await s.pollWire();
    assert.deepEqual(s.wireStatus, { live: true, latestSeq: 7, events: 0 });
    globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };
    await s.pollWire();
    await s.pollWire();
    assert.deepEqual(s.wireStatus, { live: false, latestSeq: 7, events: 0 });
    assert.equal(s.wireDropped, true);
    assert.equal(s.wireSeq, 7);
  } finally { globalThis.fetch = realFetch; }
});

test("production store contains no preview seeds or loopback wire", () => {
  const s = production();
  assert.deepEqual(s.agents, []);
  assert.deepEqual(s.interrupts, []);
  assert.deepEqual(s.tasks, []);
  assert.deepEqual(s.artifacts, []);
  assert.deepEqual(s.beats, []);
  assert.deepEqual(s.inbox, []);
  assert.equal(s.selectedWorkTarget.id, models.WORK_TARGET_UNCONFIGURED.id);
  assert.equal(models.targetCanUse(s.selectedWorkTarget), false);
  assert.equal(models.presetCanLaunch(s.defaultCallPreset), false);
  assert.equal(s.writerURL, "");
  assert.equal(s.hasLiveSession, false);
  assert.equal(s.launchCall(models.CALL_PRESET_FALLBACK, false), false);
});

test("work targets never expose paths and unusable targets block chat", () => {
  const s = preview();
  for (const t of s.workTargets) assert.ok(!t.opaqueReference.includes("/"), t.opaqueReference);
  assert.equal(s.sendWorkChat("  "), false);
  assert.equal(s.sendWorkChat("Ship the gate"), true);
  assert.equal(s.workChatMessages.length, 1);
  s.selectWorkTarget("target-device-folder");
  assert.equal(models.targetCanUse(s.selectedWorkTarget), false);
  assert.equal(s.sendWorkChat("blocked"), false);
  s.startNewWorkChat();
  assert.equal(s.workChatMessages.length, 0);
});

test("call presets sanitize targets, agents and presenter candidates before launching", () => {
  const s = preview();
  const ok = s.launchCall({ id: "p", name: "P", targetIDs: ["target-device-folder", "target-drive-ios"], agentIDs: ["ghost", "maya"], presenterCandidateIDs: ["ghost", "maya"] }, true);
  assert.equal(ok, true);
  assert.equal(s.inCall, true);
  assert.deepEqual(s.defaultCallPreset.targetIDs, ["target-drive-ios"]);
  assert.deepEqual(s.defaultCallPreset.agentIDs, ["maya"]);
  assert.deepEqual(s.defaultCallPreset.presenterCandidateIDs, ["maya"]);
  assert.equal(prefs.get("call.defaultPreset.v1").id, "p");
  assert.equal(models.resolveCallLaunch("Launch default preset", s.defaultCallPreset), "launchDefault");
  assert.equal(models.resolveCallLaunch("Configure each call", s.defaultCallPreset), "configure");
  assert.equal(models.resolveCallLaunch("Launch default preset", models.CALL_PRESET_UNAVAILABLE), "configure");
  s.leaveCall();
  assert.equal(s.inCall, false);
});

test("runtime badges carry a family and a location only", () => {
  for (const id of ["maya", "coder", "scout", "indexer", "unknown"]) {
    const b = models.runtimeBadgeForAgent(id);
    assert.ok(models.AgentRuntimeFamily.includes(b.family));
    assert.ok(models.AgentExecutionLocation.includes(b.executionLocation));
    assert.deepEqual(Object.keys(b).sort(), ["executionLocation", "family", "label"]);
  }
});

test("Presenter is exclusive, transfers atomically, and revocation clears authority", () => {
  const s = preview();
  s.activeCallPresenterCandidateIDs = ["maya", "coder"];
  s.requestPresenter("maya");
  assert.equal(s.activePresenterGrant.agentId, "maya");
  const second = s.makePresenterGrant("coder");
  assert.equal(s.applyTitleGrant(second), false);
  assert.match(s.titleMutationError, /Transfer it instead/);
  s.requestPresenter("coder");
  assert.equal(s.activePresenterGrant.agentId, "coder");
  assert.equal(Object.values(s.titleGrantsByID).filter((g) => models.grantIsActive(g)).length, 1);
  assert.deepEqual(s.titleEventLog.map((r) => r.kind), ["granted", "transferred"]);
  s.requestPresenter("scout");
  assert.match(s.titleMutationError, /not eligible/);
  s.revokePresenter("policy");
  assert.equal(s.activePresenterGrant, null);
  assert.equal(s.titleEventLog.at(-1).reason, "policy");
  for (const g of Object.values(s.titleGrantsByID)) { assert.ok(!("prompt" in g)); assert.ok(!("skills" in g)); }
});

test("control.leave revokes the leaver's grant and control.end clears every live grant", () => {
  const s = preview();
  s.activeCallPresenterCandidateIDs = ["maya", "coder"];
  s.requestPresenter("maya");
  s.applyControlLeave("coder", Date.now());
  assert.equal(s.activePresenterGrant?.agentId, "maya");
  s.applyControlLeave("maya", Date.now(), "left", "evt-1");
  assert.equal(s.activePresenterGrant, null);
  s.requestPresenter("coder");
  s.applyControlEnd(Date.now(), "ended", "evt-2");
  assert.equal(s.activePresenterGrant, null);
  assert.equal(s.titleEventLog.at(-1).reason, "ended");
});

test("Director policy descriptor is never exportable", () => {
  assert.equal(models.DIRECTOR_POLICY.exportable, false);
  assert.equal(models.DIRECTOR_POLICY.signatureStatus, "Verified");
});

test("the wire fold builds tasks, artifacts, beats, agents and interrupts from typed events", () => {
  const s = preview();
  const at = new Date().toISOString();
  s.applyWireEvent({ type: "control.join", at, participant: { id: "atlas", kind: "agent", displayName: "Atlas", role: "partner" } });
  s.applyWireEvent({ id: "e1", type: "work.generic", at, actorId: "atlas", kind: "work.task.created", payload: { taskId: "w1", title: "Gate refresh", project: "Auth", state: "running", deps: [] } });
  s.applyWireEvent({ id: "e2", type: "work.generic", at, actorId: "atlas", kind: "work.task.progress", payload: { taskId: "w1", progress: 0.4 } });
  s.applyWireEvent({ id: "e3", type: "work.generic", at, actorId: "atlas", kind: "work.task.state", payload: { taskId: "w1", state: "blocked", summary: "Needs a secret" } });
  s.applyWireEvent({ id: "e4", type: "work.generic", at, actorId: "atlas", kind: "work.artifact.created", payload: { artifactId: "wa1", title: "Plan", kind: "plan", project: "Auth", life: { ttlDays: 7 }, sizeKb: 12 } });
  s.applyWireEvent({ id: "e5", type: "work.generic", at, actorId: "atlas", kind: "work.direction.beat", payload: { programId: "p1", beatIndex: 0, kind: "plan", title: "Shape", caption: "Four moves", durationSec: 5, steps: ["a", "b"], accent: [0] } });
  s.rebuildFromWire();
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].state, "Blocked");
  assert.equal(s.tasks[0].progress, 0.4);
  assert.equal(s.interrupts.length, 1);
  assert.equal(s.interrupts[0].kind, "blocked");
  assert.equal(s.artifacts.length, 1);
  assert.equal(s.artifacts[0].life.daysLeft, 7);
  assert.equal(s.beats.length, 1);
  assert.equal(s.beats[0].kind, "PLAN");
  assert.equal(s.agents.length, 1);
  assert.equal(s.agents[0].name, "Atlas");
  assert.equal(s.agents[0].state, "Needs you");
  assert.equal(s.wireSkillUse.atlas.tasks, 3);
});

test("wire title events fold into the same grant table as local ones", () => {
  const s = preview();
  const now = Date.now() - 10_000; // wire timestamps are in the past
  const grant = { id: "g1", agentId: "maya", title: "presenter", scope: { kind: "stage", ref: "p1" }, skillBundleRefs: [], resourceGrantRefs: [], delegatedAgentIds: [], permissions: ["stage.present"], grantedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString(), revokedAt: null };
  s.applyWireEvent({ id: "t1", type: "control.title_granted", at: new Date(now).toISOString(), grant });
  assert.equal(s.activePresenterGrant?.id, "g1");
  s.applyWireEvent({ id: "t2", type: "control.title_transferred", fromGrantId: "g1", toGrant: { ...grant, id: "g2", agentId: "coder" }, transferredAt: new Date(now + 1000).toISOString() });
  assert.equal(s.activePresenterGrant?.agentId, "coder");
  s.applyWireEvent({ id: "t3", type: "control.title_revoked", grantId: "g2", revokedAt: new Date(now + 2000).toISOString(), reason: "revoked" });
  assert.equal(s.activePresenterGrant, null);
  s.applyWireEvent({ id: "bad", type: "control.title_granted", grant: { ...grant, id: "g3", permissions: ["pixels.stream"] } });
  assert.equal(s.titleGrantsByID.g3, undefined);
});

test("session lifecycle events rebuild the registry; a resync clears it", () => {
  const s = preview();
  const at = new Date().toISOString();
  s.applyWireEvent({ type: "control.session_created", at, sessionId: "s1", organizerId: "you", title: "Plan review", project: "Auth", participantIds: ["you", "maya"], agendaTaskIds: ["t1"] });
  s.applyWireEvent({ type: "control.session_scheduled", at, sessionId: "s1", scheduledFor: new Date(Date.now() + 3600e3).toISOString() });
  s.rebuildFromWire();
  assert.equal(s.wireUpcomingSessions.length, 1);
  assert.equal(s.wireActiveSession, null);
  s.applyWireEvent({ type: "control.session_started", at, sessionId: "s1", programId: "p1" });
  s.rebuildFromWire();
  assert.equal(s.wireActiveSession?.id, "s1");
  assert.equal(s.wireActiveProgramId, "p1");
  s.applyWireEvent({ type: "control.session_ended", at, sessionId: "s1", replayArtifactId: "ra1" });
  s.rebuildFromWire();
  assert.equal(s.wireActiveSession, null);
  assert.equal(s.wireEndedSessions[0].replayArtifactId, "ra1");
});

test("archive rules: quiet projects auto-file, never-file exempts, sweep files shipped work, restore brings it back", async () => {
  const s = preview();
  const fleet = models.generatedFleet();
  s.installFleet(fleet.projects, fleet.tasks, AppStore.quietProjects(fleet.tasks));
  assert.ok(s.archivedProjects.has("Chores"), "quiet demo project is auto-filed");
  assert.ok(!s.archivedProjects.has("Auth middleware"));
  s.toggleNeverFile("Chores");
  assert.ok(!s.archivedProjects.has("Chores"));
  assert.ok(s.neverFileProjects.has("Chores"));
  const before = s.sweepCandidateCount;
  assert.ok(before > 0);
  s.sweepArchive();
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(s.sweepCandidateCount, 0);
  assert.ok(s.archivedCount >= before);
  const filed = s.tasks.find((t) => s.archivedTasks.has(t.id));
  s.restoreTask(filed.id);
  assert.ok(!s.archivedTasks.has(filed.id));
  const { active, archived } = s.searchTasks("bump");
  assert.ok(active.length + archived.length >= 1);
});

test("pins sort first and persist", () => {
  const s = preview();
  s.installFleet(models.generatedFleet().projects, models.generatedFleet().tasks, AppStore.quietProjects(models.generatedFleet().tasks));
  const last = s.orderedProjects.at(-1).id;
  s.togglePin(last);
  assert.equal(s.orderedProjects[0].id, last);
  assert.deepEqual(prefs.get("pinnedProjects"), [last]);
  assert.ok(s.tasks.length > 700, `fleet seeded ${s.tasks.length}`);
});

test("interrupt replies resolve the interrupt and resume the blocked task", async () => {
  const s = preview();
  s.sendReply("blocked-scout", "env");
  assert.equal(s.interrupts.find((i) => i.id === "blocked-scout").resolved, true);
  assert.equal(s.tasks.find((t) => t.id === "t4").state, "Running");
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal(s.thread("blocked-scout").at(-1).sender, "agent");
  s.allowEdit();
  assert.equal(s.editAllowed, true);
  assert.equal(s.agents.find((a) => a.id === "coder").state, "Working");
});

test("display names strip namespaces before the Cline alias", () => {
  assert.equal(models.displayName("coder"), "Cline");
  assert.equal(models.displayName("agent:coder"), "Cline");
  assert.equal(models.displayName("agent:atlas"), "Atlas");
  assert.equal(models.displayName("drive:you"), "You");
  const s = preview();
  assert.equal(s.nameFor("agent:coder"), "Cline");
  s.applyWireEvent({ type: "control.join", at: new Date().toISOString(), participant: { id: "agent:beacon", kind: "agent", displayName: "Beacon", role: "partner" } });
  assert.equal(s.nameFor("agent:beacon"), "Beacon");
});

test("intent recorder predicts the most frequent next surface", () => {
  const r = new IntentRecorder();
  r.reset();
  r.record("home"); r.record("tasks"); r.record("home"); r.record("tasks"); r.record("home"); r.record("agents"); r.record("home");
  assert.equal(r.predict(1)[0].surface, "tasks");
});
