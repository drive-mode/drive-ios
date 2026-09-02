// Domain types + the labeled preview world. A port of `Sources/Models.swift`
// (plus the value types from WorkHub / CallTabView / AgentTitles / Settings /
// IntentEngine that the store needs). Colors are hex strings; dates are ms.

// ------------------------------------------------------------- palette

export const COLORS = {
  violet: "#9F58FA", violetHi: "#AC6BFF", violetDeep: "#8B45E8", danger: "#F53969",
  maya: "#7A3FD4", coder: "#151516", scout: "#5B8DEF", indexer: "#8A8F98",
  plan: "#9F58FA", diff: "#2BCC28", report: "#5B8DEF", replay: "#FFC55C", doc: "#2DD4BF", capture: "#F472B6",
  teal: "#2DD4BF", amber: "#FFC55C", blue: "#5B8DEF", lime: "#A3E635", pink: "#F472B6", green: "#2BCC28",
};

/** Agent colors are CSS variables so Cline's near-black flips on dark. */
export const AGENT_COLOR_VAR = { maya: "var(--maya)", coder: "var(--coder)", scout: "var(--scout)", indexer: "var(--indexer)" };
export const agentColor = (id, fallback) => AGENT_COLOR_VAR[id] ?? fallback ?? COLORS.indexer;
const FALLBACK_COLORS = ["#7A3FD4", "#5B8DEF", "#2DD4BF", "#F472B6", "#FFC55C"];
export function fallbackColor(actorId) {
  let hash = 0;
  for (const ch of String(actorId)) hash = (hash * 31 + ch.codePointAt(0)) & 0xffff;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
export function colorForActor(actorId) { return AGENT_COLOR_VAR[actorId] ?? fallbackColor(actorId); }

// ------------------------------------------------------------- agents

export const AgentState = { working: "Working", needsYou: "Needs you", stuck: "Stuck?" };

export const AgentRuntimeFamily = ["Claude", "Codex", "Cline", "Apple", "Other"];
export const AgentExecutionLocation = ["Hosted", "On device"];

/** Sanitized runtime identity: family + location only — never a model id. */
export function runtimeBadgeForAgent(id) {
  const badge = (family, location) => ({ family, executionLocation: location, label: `${family} · ${location}` });
  switch (id) {
    case "maya": return badge("Claude", "Hosted");
    case "coder": return badge("Codex", "Hosted");
    case "scout": return badge("Codex", "Hosted");
    case "indexer": return badge("Apple", "On device");
    default: return badge("Other", "Hosted");
  }
}

// -------------------------------------------------------------- tasks

export const TaskState = { running: "Running", review: "Review", blocked: "Blocked", queued: "Queued", done: "Done" };
export const TASK_STATES = ["Running", "Review", "Blocked", "Queued", "Done"];
export const TASK_STATE_TINT = { Running: "var(--tint-blue)", Review: "var(--violet)", Blocked: "var(--danger)", Queued: "var(--ink-35)", Done: "var(--live)" };

export function emptyAgg() { return { total: 0, running: 0, review: 0, blocked: 0, queued: 0, done: 0 }; }
export const aggAttention = (a) => a.review + a.blocked;
export const aggActive = (a) => a.running > 0;

// ---------------------------------------------------------- artifacts

export const ArtifactKind = { plan: "Plan", diff: "Diff", report: "Report", replay: "Replay", doc: "Doc", capture: "Capture" };
export const ARTIFACT_KINDS = ["Plan", "Diff", "Report", "Replay", "Doc", "Capture"];
export const ARTIFACT_META = {
  Plan: { symbol: "list.bullet.rectangle", tint: COLORS.plan },
  Diff: { symbol: "plus.forwardslash.minus", tint: COLORS.diff },
  Report: { symbol: "chart.bar.doc.horizontal", tint: COLORS.report },
  Replay: { symbol: "play.rectangle", tint: COLORS.replay },
  Doc: { symbol: "doc.richtext", tint: COLORS.doc },
  Capture: { symbol: "camera.viewfinder", tint: COLORS.capture },
};

/** Purpose decides lifespan: `{permanent:true}` or `{permanent:false, daysLeft}`. */
export const permanent = () => ({ permanent: true });
export const ephemeral = (daysLeft) => ({ permanent: false, daysLeft });
export function lifeBadge(life) {
  if (life.permanent) return "keeps";
  return life.daysLeft <= 0 ? "filing…" : `${life.daysLeft}d left`;
}
export const lifeSymbol = (life) => (life.permanent ? "infinity" : "hourglass");
export function sizeLabel(sizeKB) {
  return sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
}

// -------------------------------------------------------------- inbox

export const INBOX_META = {
  approval: { symbol: "checkmark.seal", tint: "#9F58FA", product: false },
  blocked: { symbol: "questionmark.bubble", tint: "#5B8DEF", product: false },
  invite: { symbol: "envelope.open", tint: "#B98AFF", product: false },
  shipped: { symbol: "shippingbox", tint: "#2BCC28", product: false },
  streak: { symbol: "sparkles", tint: "#FFC55C", product: false },
  product: { symbol: "megaphone", tint: "#2DD4BF", product: true },
  tip: { symbol: "lightbulb", tint: "#F472B6", product: true },
};

// -------------------------------------------------------------- beats

export const BeatKind = { plan: "PLAN", diagram: "DIAGRAM", edit: "EDIT", command: "RUN", test: "TESTS", decision: "DECISION", metric: "RESULT" };
/** Kind-colored progress rail: plan/decision violet, diagram blue, edit green, run teal, tests lime, result amber. */
export const BEAT_TINT = { PLAN: "var(--violet)", DECISION: "var(--violet)", DIAGRAM: "var(--tint-blue)", EDIT: "var(--diff-green)", RUN: "var(--tint-teal)", TESTS: "var(--tint-lime)", RESULT: "var(--tint-amber)" };

// ------------------------------------------------------------ surfaces

export const AppTab = ["home", "work", "agents", "tasks"];
export const Surface = ["home", "work", "agents", "tasks", "projectMap", "activity", "inbox", "artifacts", "profile", "archive", "needsYou", "search"];

// ------------------------------------------------------- work targets

export const WORK_TARGET_KIND = {
  githubRepository: { label: "GitHub repository", symbol: "chevron.left.forwardslash.chevron.right" },
  directory: { label: "Folder", symbol: "folder" },
  fileSet: { label: "Saved file set", symbol: "doc.on.doc" },
  deviceSandbox: { label: "Device sandbox", symbol: "iphone" },
};
export const ACCESS_POSTURE = { readOnly: "Read only", readWrite: "Read & write", permissionRequired: "Permission required" };
export const CONNECTION_STATE = { connected: "Connected", disconnected: "Reconnect", unavailable: "Unavailable" };
export const targetCanUse = (t) => t.connectionState === "connected" && t.accessPosture !== "permissionRequired";

export const WORK_TARGET_PREVIEWS = [
  { id: "target-drive-ios", displayName: "drive-ios", displayLocation: "GitHub · drive-mode/drive-ios", kind: "githubRepository", accessPosture: "readWrite", connectionState: "connected", opaqueReference: "repo_ref_8bb75f" },
  { id: "target-product-specs", displayName: "Product specs", displayLocation: "Saved files · 14 documents", kind: "fileSet", accessPosture: "readOnly", connectionState: "connected", opaqueReference: "fileset_ref_1c04da" },
  { id: "target-device-folder", displayName: "Choose a device folder", displayLocation: "On this device · access not granted", kind: "directory", accessPosture: "permissionRequired", connectionState: "disconnected", opaqueReference: "security_scope_pending" },
];
export const WORK_TARGET_UNCONFIGURED = { id: "target-unconfigured", displayName: "Choose a work target", displayLocation: "No repository or folder connected", kind: "directory", accessPosture: "permissionRequired", connectionState: "unavailable", opaqueReference: "host_target_required" };

export const CALL_PRESET_FALLBACK = { id: "preset-focused-pair", name: "Focused pair", targetIDs: ["target-drive-ios"], agentIDs: ["maya", "coder"], presenterCandidateIDs: ["maya"] };
export const CALL_PRESET_UNAVAILABLE = { id: "preset-unavailable", name: "No default preset", targetIDs: [], agentIDs: [], presenterCandidateIDs: [] };
export const presetCanLaunch = (p) => p.targetIDs.length > 0 && p.agentIDs.length > 0;
export function resolveCallLaunch(preference, preset) {
  return preference === "Launch default preset" && presetCanLaunch(preset) ? "launchDefault" : "configure";
}

// -------------------------------------------------------- sessions

export const UPCOMING_SEED = {
  id: "up-seed-payments", title: "Payments refactor — plan review", project: "Payments refactor",
  when: "Tomorrow · 10:00", people: ["Maya", "You"], agendaCount: 2,
  note: "Plan review, ~15 minutes. Join when you're ready.",
  participantIds: null, agendaTaskIds: null, scheduledAt: null,
};

export function scheduledDateFor(choice, now = Date.now()) {
  if (choice === "Now") return now;
  if (choice === "Later today") return now + 2 * 3600e3;
  const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
  return d.getTime();
}

const timeFmt = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export function displayWhen(ms, now = Date.now()) {
  if (Math.abs(ms - now) < 60e3) return "Now";
  const d = new Date(ms), n = new Date(now);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, n)) return timeFmt.format(d);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (same(d, tomorrow)) return `Tomorrow · ${timeFmt.format(d)}`;
  return dateFmt.format(d);
}

// ------------------------------------------------------- agent titles

export const AgentTitle = { presenter: "presenter" };
export const AgentTitleScopeKind = ["room", "session", "stage"];
export const AgentTitlePermission = { stagePresent: "stage.present" };
export const DIRECTOR_POLICY = { version: "director-host-v1", signatureStatus: "Verified", exportable: false };
export function grantIsActive(g, at = Date.now()) {
  return g.grantedAt <= at && at < g.expiresAt && (g.revokedAt == null || at < g.revokedAt);
}

// ------------------------------------------------------------ settings

export const SETTINGS_TABS = [
  { id: "General", symbol: "slider.horizontal.3" },
  { id: "Profile", symbol: "person.crop.circle" },
  { id: "Calls", symbol: "phone" },
  { id: "Agents", symbol: "person.2" },
  { id: "Billing & payments", symbol: "creditcard" },
  { id: "Usage", symbol: "gauge.with.dots.needle.50percent" },
  { id: "Analytics", symbol: "chart.xyaxis.line" },
  { id: "Privacy", symbol: "lock" },
  { id: "On-device AI", symbol: "iphone.gen3.radiowaves.left.and.right" },
];
export const PREVIEW_ACCOUNT = { plan: "Drive Preview", billingStatus: "No charge", paymentMethod: "No payment method", renewal: "Preview access does not renew", source: "Preview account service" };

// ---------------------------------------------------------- demo data

export const DemoData = {
  agents: [
    { id: "maya", name: "Maya", role: "REVIEWER", color: agentColor("maya"), statusLine: "Reviewing diff · auth.ts", age: "8s", state: "Working", voice: "Sage · en-US", editsAllowed: 9, testsRun: 12, uptime: "2h 14m" },
    { id: "coder", name: "Cline", role: "BUILDER", color: agentColor("coder"), statusLine: "Waiting on approval — edit auth.ts", age: "2m", state: "Needs you", voice: "Brook · en-US", editsAllowed: 26, testsRun: 61, uptime: "5h 02m" },
    { id: "scout", name: "Scout", role: "RESEARCHER", color: agentColor("scout"), statusLine: "Migrating tests · 12/40", age: "24s", state: "Working", voice: "Quill · en-GB", editsAllowed: 3, testsRun: 118, uptime: "1h 40m" },
    { id: "indexer", name: "Indexer", role: "UTILITY", color: agentColor("indexer"), statusLine: "No report for 6 minutes", age: "6m", state: "Stuck?", voice: "Mono · en-US", editsAllowed: 0, testsRun: 0, uptime: "6h 51m" },
  ],

  interrupts: [
    { id: "approve-auth", agentName: "Cline", agentColor: agentColor("coder"), title: "Cline wants to edit auth.ts", kind: "approval", detail: ["+ export function requireAuth()", "+   verifyJwt(req)"], age: "2m", resolved: false },
    { id: "blocked-scout", agentName: "Scout", agentColor: agentColor("scout"), title: "Scout is blocked on staging config", kind: "blocked", detail: ["“Which secret store should I read for DATABASE_URL — env or vault?”"], age: "5m", resolved: false },
    { id: "review-maya", agentName: "Maya", agentColor: agentColor("maya"), title: "Plan ready to review — payments refactor", kind: "review", detail: [], age: "1h", resolved: false },
  ],

  recents: [
    { id: "payments", title: "Payments refactor", subtitle: "Yesterday · Plan ready", badge: "Review" },
    { id: "status-sync", title: "Status board sync", subtitle: "Mon · Completed", badge: null },
  ],

  curatedTasks: [
    { id: "t1", title: "Gate JWT refresh", room: "Auth middleware", agentName: "Cline", agentColor: agentColor("coder"), state: "Running", progress: 0.72, detail: "requireAuth landing · tests queued", deps: ["t2"] },
    { id: "t2", title: "Migrate auth tests", room: "Auth middleware", agentName: "Scout", agentColor: agentColor("scout"), state: "Running", progress: 0.30, detail: "12/40 suites moved", deps: ["t4"] },
    { id: "t3", title: "Payments refactor plan", room: "Payments refactor", agentName: "Maya", agentColor: agentColor("maya"), state: "Review", progress: null, detail: "5-step plan · touches 14 files", deps: [] },
    { id: "t4", title: "Rotate staging secrets", room: "Ops", agentName: "Scout", agentColor: agentColor("scout"), state: "Blocked", progress: null, detail: "Needs DATABASE_URL source", deps: [] },
    { id: "t5", title: "Status board sync", room: "Status board", agentName: "Maya", agentColor: agentColor("maya"), state: "Done", progress: null, detail: null, deps: [] },
    { id: "t6", title: "Bump bun to 1.2", room: "Chores", agentName: "Cline", agentColor: agentColor("coder"), state: "Done", progress: null, detail: null, deps: [] },
  ],

  usage: [
    { value: "6", label: "Sessions this week", sub: "1h 42m working together" },
    { value: "38", label: "Edits allowed", sub: "3 denied" },
    { value: "11", label: "Interrupts cleared", sub: "median 40s to answer" },
    { value: "24m", label: "Talk time", sub: "hold-to-talk" },
  ],

  rings: [
    { label: "Steer", value: "24m", goal: "of 30m talk", progress: 0.80, color: "#9F58FA" },
    { label: "Answer", value: "11", goal: "of 12 interrupts", progress: 0.92, color: "#2BCC28" },
    { label: "Ship", value: "38", goal: "of 40 tasks", progress: 0.95, color: "#FFC55C" },
  ],

  week: [
    { id: 0, day: "Mon", ships: 9, approvals: 5, talkMin: 4 },
    { id: 1, day: "Tue", ships: 21, approvals: 9, talkMin: 7 },
    { id: 2, day: "Wed", ships: 6, approvals: 3, talkMin: 2 },
    { id: 3, day: "Thu", ships: 14, approvals: 8, talkMin: 6 },
    { id: 4, day: "Fri", ships: 11, approvals: 6, talkMin: 3 },
    { id: 5, day: "Sat", ships: 3, approvals: 1, talkMin: 1 },
    { id: 6, day: "Sun", ships: 8, approvals: 6, talkMin: 5 },
  ],

  trends: [
    { symbol: "checkmark.circle", label: "Edits allowed", delta: "+23%", up: true, good: true },
    { symbol: "bolt", label: "Time to answer", delta: "−18%", up: false, good: true },
    { symbol: "waveform", label: "Talk per session", delta: "+9%", up: true, good: true },
  ],

  records: [
    { value: "40s", label: "Fastest unblock", sub: "Scout, Thursday — personal best", symbol: "bolt.fill" },
    { value: "21", label: "Best shipping day", sub: "Tuesday · new record", symbol: "flag.checkered" },
  ],

  insights: [
    "Tuesday is your power day — 55% of this week's ships landed before lunch.",
    "You answer Scout fastest. Cline waits 3× longer — worth a quiet-hours tweak?",
  ],

  streakDays: 6,

  badges: [
    { id: "unblocker", symbol: "key.fill", name: "Unblocker", note: "Cleared 5 blocked agents", earned: true },
    { id: "night", symbol: "moon.stars.fill", name: "Night Shift", note: "Approved after midnight", earned: true },
    { id: "theater", symbol: "rectangle.landscape.rotate", name: "Theater Debut", note: "First rotated Presenter stage", earned: true },
    { id: "sweep", symbol: "sparkles", name: "Clean Desk", note: "First archive sweep", earned: true },
    { id: "century", symbol: "100.circle", name: "Century", note: "100 tasks shipped", earned: false },
    { id: "marathon", symbol: "timer", name: "Marathon", note: "10 hours in session", earned: false },
  ],

  artifacts: [
    { id: "a1", title: "Auth rollout plan", kind: "Plan", room: "Auth middleware", repo: "drive-mode/auth", agentName: "Maya", agentColor: agentColor("maya"), age: "12m", day: "Today", meta: "5 steps · 14 files", sizeKB: 18, life: permanent() },
    { id: "a2", title: "requireAuth diff", kind: "Diff", room: "Auth middleware", repo: "drive-mode/auth", agentName: "Cline", agentColor: agentColor("coder"), age: "26m", day: "Today", meta: "+12 −3 · auth.ts", sizeKB: 6, life: ephemeral(7) },
    { id: "a3", title: "Auth suite report", kind: "Report", room: "Auth middleware", repo: "drive-mode/auth", agentName: "Scout", agentColor: agentColor("scout"), age: "31m", day: "Today", meta: "5/5 passing · 38ms p95", sizeKB: 142, life: ephemeral(30) },
    { id: "a4", title: "Room replay — beats 1–8", kind: "Replay", room: "Auth middleware", repo: "drive-mode/auth", agentName: "Maya", agentColor: agentColor("maya"), age: "1h", day: "Today", meta: "56s · 8 beats", sizeKB: 4300, life: ephemeral(30) },
    { id: "a5", title: "Payments refactor plan", kind: "Plan", room: "Payments refactor", repo: "drive-mode/payments", agentName: "Maya", agentColor: agentColor("maya"), age: "1d", day: "Yesterday", meta: "waiting on review", sizeKB: 24, life: permanent() },
    { id: "a6", title: "Latency ladder", kind: "Report", room: "Payments refactor", repo: "drive-mode/payments", agentName: "Scout", agentColor: agentColor("scout"), age: "1d", day: "Yesterday", meta: "41ms → 38ms", sizeKB: 88, life: permanent() },
    { id: "a7", title: "Secrets runbook", kind: "Doc", room: "Ops", repo: "drive-mode/infra", agentName: "Scout", agentColor: agentColor("scout"), age: "2d", day: "2 days ago", meta: "env rotation steps", sizeKB: 41, life: permanent() },
    { id: "a8", title: "Staging config capture", kind: "Capture", room: "Ops", repo: "drive-mode/infra", agentName: "Scout", agentColor: agentColor("scout"), age: "2d", day: "2 days ago", meta: "before rotation", sizeKB: 980, life: ephemeral(5) },
    { id: "a9", title: "Exports adapter diff", kind: "Diff", room: "Exports refactor", repo: "drive-mode/exports", agentName: "Cline", agentColor: agentColor("coder"), age: "3h", day: "Today", meta: "+84 −29 · 6 files", sizeKB: 34, life: ephemeral(7) },
    { id: "a10", title: "Fixture backfill report", kind: "Report", room: "Exports refactor", repo: "drive-mode/exports", agentName: "Indexer", agentColor: agentColor("indexer"), age: "5h", day: "Today", meta: "1,204 rows", sizeKB: 260, life: ephemeral(30) },
    { id: "a11", title: "Notifications v2 plan", kind: "Plan", room: "Ship notifications", repo: "drive-mode/notify", agentName: "Maya", agentColor: agentColor("maya"), age: "6h", day: "Today", meta: "3 phases", sizeKB: 15, life: permanent() },
    { id: "a12", title: "Quota audit doc", kind: "Doc", room: "Quotas audit", repo: "drive-mode/quotas", agentName: "Maya", agentColor: agentColor("maya"), age: "8h", day: "Today", meta: "findings + limits", sizeKB: 66, life: permanent() },
    { id: "a13", title: "Analytics schema diff", kind: "Diff", room: "Analytics v2", repo: "drive-mode/analytics", agentName: "Cline", agentColor: agentColor("coder"), age: "9h", day: "Today", meta: "+41 −7 · events.ts", sizeKB: 12, life: ephemeral(3) },
    { id: "a14", title: "Dashboard capture", kind: "Capture", room: "Analytics v2", repo: "drive-mode/analytics", agentName: "Indexer", agentColor: agentColor("indexer"), age: "10h", day: "Today", meta: "weekly rollup", sizeKB: 1850, life: ephemeral(7) },
    { id: "a15", title: "Status board replay", kind: "Replay", room: "Status board", repo: "drive-mode/hub", agentName: "Maya", agentColor: agentColor("maya"), age: "3d", day: "3 days ago", meta: "42s · 6 beats", sizeKB: 3100, life: ephemeral(1) },
    { id: "a16", title: "Webhook contract doc", kind: "Doc", room: "Ship webhooks", repo: "drive-mode/webhooks", agentName: "Cline", agentColor: agentColor("coder"), age: "3d", day: "3 days ago", meta: "v0 · signed payloads", sizeKB: 52, life: permanent() },
    { id: "a17", title: "Session probe report", kind: "Report", room: "Sessions hardening", repo: "drive-mode/sessions", agentName: "Scout", agentColor: agentColor("scout"), age: "4d", day: "4 days ago", meta: "0 leaks found", sizeKB: 190, life: permanent() },
    { id: "a18", title: "Token rotation diff", kind: "Diff", room: "Sessions hardening", repo: "drive-mode/sessions", agentName: "Cline", agentColor: agentColor("coder"), age: "4d", day: "4 days ago", meta: "+18 −18", sizeKB: 9, life: ephemeral(2) },
  ],

  /** The directed program for the auth-middleware room (~56s loop). */
  beats: [
    { id: 0, kind: "PLAN", title: "Ship auth middleware", director: "Maya", directorColor: agentColor("maya"), caption: "Here's the shape — four moves, we're on the second.", duration: 7, steps: ["Add verifyJwt to middleware", "Gate the refresh route", "Land requireAuth helper", "Run the auth suite"], accent: [0] },
    { id: 1, kind: "DIAGRAM", title: "Request path", director: "Maya", directorColor: agentColor("maya"), caption: "Every refresh now passes through verifyJwt before routing.", duration: 8, steps: ["Client", "POST /refresh", "middleware", "verifyJwt", "next()"], accent: [3] },
    { id: 2, kind: "EDIT", title: "auth.ts · middleware", director: "Cline", directorColor: agentColor("coder"), caption: "Two lines in the hot path — token check, early return.", duration: 8, steps: ["export async function middleware(req) {", "+  const token = await verifyJwt(req)", "+  if (!token) return unauthorized()", "   return next()", "}"], accent: [] },
    { id: 3, kind: "RUN", title: "bun test auth", director: "Scout", directorColor: agentColor("scout"), caption: "Running the suite against the new gate.", duration: 6, steps: ["$ bun test auth --bail", "scanning 6 files…", "auth/middleware.test.ts", "auth/refresh.test.ts", "auth/session.test.ts"], accent: [] },
    { id: 4, kind: "TESTS", title: "Auth suite", director: "Scout", directorColor: agentColor("scout"), caption: "Green across the gate — refresh regression stays dead.", duration: 8, steps: ["verifies signed JWT", "rejects expired token", "rejects missing header", "refresh flows through gate", "session survives rotate"], accent: [] },
    { id: 5, kind: "DECISION", title: "Gate refresh before merge?", director: "Maya", directorColor: agentColor("maya"), caption: "Maya's call: gate now, no flag — the suite covers it.", duration: 7, steps: ["Gate now — suite covers the path", "Ship behind a flag, gate later"], accent: [0] },
    { id: 6, kind: "EDIT", title: "auth.ts · requireAuth", director: "Cline", directorColor: agentColor("coder"), caption: "Landing the helper you approved.", duration: 7, steps: ["+ export function requireAuth() {", "+   verifyJwt(req); next()", "+ }"], accent: [] },
    { id: 7, kind: "RESULT", title: "After the gate", director: "Maya", directorColor: agentColor("maya"), caption: "Cheaper and safer — ready to merge.", duration: 7, steps: ["p95 before|41", "p95 after|38", "0 unauthorized regressions"], accent: [1] },
  ],

  baseDiff: [
    { text: "export async function middleware(req) {", added: false },
    { text: "+  const token = await verifyJwt(req)", added: true },
    { text: "+  if (!token) return unauthorized()", added: true },
    { text: "   return next()", added: false },
    { text: "}", added: false },
  ],

  seedConversation(interruptId) {
    switch (interruptId) {
      case "blocked-scout":
        return [
          { sender: "system", text: "Scout · report_status — Migrating tests · 12/40", time: "9m" },
          { sender: "system", text: "Scout · report_status — Staging run needs DATABASE_URL", time: "6m" },
          { sender: "agent", text: "I'm blocked on staging config. Which secret store should I read for DATABASE_URL — env or vault?", time: "5m" },
        ];
      case "approve-auth":
        return [
          { sender: "system", text: "Cline · report_status — Drafting requireAuth in auth.ts", time: "4m" },
          { sender: "agent", text: "Ready to land requireAuth — +12 −3 on auth.ts, branch drive/auth. Approve?", time: "2m" },
        ];
      case "review-maya":
        return [
          { sender: "system", text: "Maya · report_status — Plan drafted · 5 steps", time: "1h" },
          { sender: "agent", text: "The payments refactor plan is ready — 5 steps, touches 14 files. Review when you have a minute; nothing moves until you do.", time: "1h" },
        ];
      default:
        return [];
    }
  },

  baseProjects: [
    { id: "Auth middleware", name: "Auth middleware", area: "Platform" },
    { id: "Payments refactor", name: "Payments refactor", area: "Platform" },
    { id: "Ops", name: "Ops", area: "Infra" },
    { id: "Status board", name: "Status board", area: "Hub" },
    { id: "Chores", name: "Chores", area: "Infra" },
  ],

  inbox: [
    { id: "n1", kind: "approval", title: "Cline needs an approval", body: "Wants to edit auth.ts — +12 −3 on branch drive/auth. Allow it right from here.", age: "2m", read: false, archived: false, interruptId: "approve-auth" },
    { id: "n2", kind: "blocked", title: "Scout is blocked", body: "“Which secret store should I read for DATABASE_URL — env or vault?”", age: "5m", read: false, archived: false, interruptId: "blocked-scout" },
    { id: "n3", kind: "invite", title: "Maya invited you to a working session", body: "Payments refactor — plan review, ~15 minutes. Join when you're ready.", age: "18m", read: false, archived: false, interruptId: null },
    { id: "n4", kind: "shipped", title: "Gate JWT refresh landed", body: "Auth middleware · Cline — suite green, 38ms p95 after the gate.", age: "31m", read: false, archived: false, interruptId: null },
    { id: "n5", kind: "streak", title: "6-day steering streak", body: "Answer one interrupt today to keep it rolling.", age: "1h", read: true, archived: false, interruptId: null },
    { id: "n6", kind: "product", title: "Theater mode is here", body: "Rotate your phone in any working session — the Presenter stage goes full-bleed with floating controls.", age: "3h", read: false, archived: false, interruptId: null },
    { id: "n7", kind: "tip", title: "Scrub beats like stories", body: "Swipe or tap the Presenter stage edges to move between plan, diagram, and test beats.", age: "5h", read: true, archived: false, interruptId: null },
    { id: "n8", kind: "shipped", title: "223 tasks filed to the archive", body: "Your sweep kept the desk clear — everything stays searchable.", age: "1d", read: true, archived: false, interruptId: null },
    { id: "n9", kind: "product", title: "Drive 0.2 release notes", body: "Task map, Presenter stage, ambient guide bar, and the working-sessions rename.", age: "2d", read: true, archived: false, interruptId: null },
    { id: "n10", kind: "invite", title: "Scout invited you to a working session", body: "Sessions hardening — token rotation walkthrough.", age: "3d", read: true, archived: true, interruptId: null },
  ],
};

// ------------------------------------------------------- demo at scale

/** Deterministic 64-bit LCG (same constants as DemoScale.SeededRNG). */
export class SeededRNG {
  constructor(seed) { this.state = BigInt.asUintN(64, BigInt(seed)); }
  next() {
    this.state = BigInt.asUintN(64, this.state * 6364136223846793005n + 1442695040888963407n);
    return this.state;
  }
  /** Integer in [lo, hi] inclusive. */
  int(lo, hi) {
    const span = BigInt(hi - lo + 1);
    return lo + Number((this.next() >> 11n) % span);
  }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}

const AREAS = ["Platform", "Mobile", "Hub", "Infra", "Growth", "SDK", "Ops", "Docs"];
const PROJECT_NOUNS = ["billing", "search", "onboarding", "presence", "exports", "webhooks", "analytics", "notifications", "migrations", "caching", "rate limits", "review flow", "secrets", "telemetry", "design tokens", "replays", "transcripts", "packs", "roster", "invites", "sessions", "presenter", "interrupts", "voice", "artifacts", "checkpoints", "sandboxes", "quotas"];
const PROJECT_SHAPES = ["%@ refactor", "%@ hardening", "%@ v2", "Ship %@", "%@ cleanup", "%@ rollout", "%@ audit"];
const VERBS = ["Migrate", "Gate", "Rotate", "Bump", "Wire", "Split", "Cache", "Throttle", "Instrument", "Backfill", "Dedupe", "Flatten", "Extract", "Polish", "Document", "Profile", "Batch", "Retry", "Snapshot", "Verify"];
const OBJECTS = ["tokens", "sessions", "fixtures", "adapters", "queries", "events", "schemas", "routes", "mocks", "specs", "flags", "indexes", "payloads", "retries", "timeouts", "cursors", "digests", "manifests", "locks", "probes"];
const AGENT_POOL = [["Maya", agentColor("maya")], ["Cline", agentColor("coder")], ["Scout", agentColor("scout")], ["Indexer", agentColor("indexer")]];

function padTasks(project, count, hot, rng) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const [agentName, color] = rng.pick(AGENT_POOL);
    const roll = rng.int(0, 99);
    const state = hot
      ? (roll < 30 ? "Running" : roll < 42 ? "Review" : roll < 50 ? "Blocked" : roll < 72 ? "Queued" : "Done")
      : (roll < 12 ? "Running" : roll < 17 ? "Review" : roll < 20 ? "Blocked" : roll < 45 ? "Queued" : "Done");
    const title = `${rng.pick(VERBS)} ${rng.pick(OBJECTS)}`;
    const slug = project.toLowerCase().replace(/ /g, "-");
    const task = { id: `g-${slug}-${i}`, title, room: project, agentName, agentColor: color, state, progress: null, detail: null, deps: [] };
    if (state === "Running") task.progress = rng.int(8, 92) / 100;
    if (state === "Blocked") task.detail = "Waiting on an answer";
    if (i > 0 && rng.int(0, 99) < 35) task.deps = [out[rng.int(0, out.length - 1)].id];
    out.push(task);
  }
  return out;
}

let generatedCache = null;
/** Hundreds of projects, ~1,200 tasks — computed once, off the first paint. */
export function generatedFleet() {
  if (generatedCache) return generatedCache;
  const rng = new SeededRNG(0xD217ECA5En);
  const projects = [...DemoData.baseProjects];
  let tasks = [...DemoData.curatedTasks];
  const used = new Set(projects.map((p) => p.name));
  tasks = tasks.concat(padTasks("Auth middleware", 9, true, rng), padTasks("Payments refactor", 7, true, rng), padTasks("Ops", 6, true, rng));
  const tiers = [[[10, 22], 5, true], [[4, 10], 40, false], [[1, 3], 170, false]];
  for (const [range, projectCount, hot] of tiers) {
    for (let k = 0; k < projectCount; k++) {
      const noun = rng.pick(PROJECT_NOUNS);
      let name = rng.pick(PROJECT_SHAPES).replace("%@", noun);
      name = name[0].toUpperCase() + name.slice(1);
      if (used.has(name)) { let n = 2; while (used.has(`${name} ${n}`)) n++; name = `${name} ${n}`; }
      used.add(name);
      projects.push({ id: name, name, area: rng.pick(AREAS) });
      tasks = tasks.concat(padTasks(name, rng.int(range[0], range[1]), hot, rng));
    }
  }
  generatedCache = { projects, tasks };
  return generatedCache;
}

// ----------------------------------------------------- activity history

const DAY_MS = 86_400_000;
function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

let activityCache = null;
/** 365 days of shipping history, index 0 = today. Seeded — stable. */
export function activityDemo() {
  if (activityCache) return activityCache;
  const rng = new SeededRNG(0xAC711717n);
  const today = startOfDay(Date.now());
  const pool = ["Auth middleware", "Exports refactor", "Analytics v2", "Payments refactor", "Ship notifications", "Ops", "Quotas audit", "Sessions hardening"];
  const days = [];
  for (let i = 0; i < 365; i++) {
    const date = today - i * DAY_MS;
    const wd = new Date(date).getDay();
    const weekend = wd === 0 || wd === 6;
    const base = weekend ? rng.int(0, 6) : rng.int(3, 22);
    let remaining = base;
    const slices = [];
    const projectCount = Math.min(Math.max(1, Math.floor(base / 5) + 1), 4);
    for (let p = 0; p < projectCount && remaining > 0; p++) {
      const take = p === projectCount - 1 ? remaining : rng.int(1, Math.max(1, remaining));
      slices.push([pool[rng.int(0, pool.length - 1)], take]);
      remaining -= take;
    }
    const merged = new Map();
    for (const [name, count] of slices) merged.set(name, (merged.get(name) ?? 0) + count);
    days.push({ id: i, date, ships: base, byProject: [...merged].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) });
  }
  const ordered = [...days].sort((a, b) => a.date - b.date);
  const lead = new Date(ordered[0].date).getDay();
  const cells = Array(lead).fill(null).concat(ordered);
  while (cells.length % 7) cells.push(null);
  const yearColumns = [];
  for (let c = 0; c < cells.length; c += 7) yearColumns.push(cells.slice(c, c + 7));
  const monthFmt = new Intl.DateTimeFormat([], { month: "short" });
  const yearMonthLabels = yearColumns.map((col, c) => {
    const day = col.find(Boolean);
    if (!day) return null;
    const month = new Date(day.date).getMonth();
    if (c === 0) return monthFmt.format(day.date);
    const prev = yearColumns[c - 1].find(Boolean);
    if (prev && new Date(prev.date).getMonth() !== month) return monthFmt.format(day.date);
    return null;
  });
  const maxDailyShips = Math.max(1, ...days.map((d) => d.ships));
  activityCache = { days, yearColumns, yearMonthLabels, maxDailyShips };
  return activityCache;
}

// ------------------------------------------------------------- helpers

/** "8s" / "2m" / "3h" / "4d" — a timestamp humanized. */
export function relative(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** Namespaced ids ("agent:atlas", "drive:host") read as their local part. */
export function localActorId(actorId) {
  return String(actorId ?? "").replace(/^(agent|drive|human|user):/, "");
}

export function displayName(actorId) {
  const s = localActorId(actorId);
  if (s === "coder") return "Cline"; // the main agent is Cline
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const initials = (name) => String(name ?? "?").trim().charAt(0).toUpperCase() || "?";
