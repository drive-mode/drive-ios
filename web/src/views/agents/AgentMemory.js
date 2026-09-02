// Agent memory — a port of `Sources/AgentMemory.swift`. Memory is a notebook
// of files scoped to what it's about (agent · session · task · project ·
// plan). Same discovery rule as skills: the hook line always loads; the body
// loads when the work makes it relevant. Notes, never transcripts.
import { html, cx, useState, useMemo, useObservable, haptic } from "../../ui.js";
import { nav, registerRoute } from "../../nav.js";
import { Screen, Icon, Eyebrow, Empty, Card, TextField, Pressable, showMenu } from "../../components.js";
import { ensureAgentsCSS } from "./AgentsView.js";

let store = null;

// ---------------------------------------------------------------- model

/** `MemoryScope.allCases` with their symbols and tints (tokens, not hex). */
export const MEMORY_SCOPES = [
  { id: "Agent", symbol: "brain", tint: "var(--violet)" },
  { id: "Session", symbol: "waveform", tint: "var(--live)" },
  { id: "Task", symbol: "checklist", tint: "var(--tint-blue)" },
  { id: "Project", symbol: "folder", tint: "var(--tint-amber)" },
  { id: "Plan", symbol: "map", tint: "var(--tint-teal)" },
];
export const MemoryScope = { agent: "Agent", session: "Session", task: "Task", project: "Project", plan: "Plan" };
export const scopeMeta = (scope) => MEMORY_SCOPES.find((s) => s.id === scope) ?? MEMORY_SCOPES[0];

const file = (id, scope, owner, ownerLabel, name, hook, body, updated, pinned = false) => ({ id, scope, owner, ownerLabel, name, hook, body, updated, pinned });

export const MemorySeeds = {
  files: [
    // Agent memory — durable, who-they-work-with knowledge.
    file("m1", "Agent", "coder", "Cline", "host-preferences.md", "How the host likes edits proposed",
      "Small, scoped asks — one decision per approval. Diff summaries must be honest (+12 −3 means +12 −3). Branch names follow drive/<topic>. Never batch a rename into a feature diff. Prefers the suite green before the ask, not after.", "2d", true),
    file("m2", "Agent", "coder", "Cline", "auth-conventions.md", "Auth stack conventions that keep landing",
      "verifyJwt gates every refresh route — early return, no soft-fail. Middleware lives in auth.ts; helpers get named exports. Tests pin regressions by name (refresh-regression stays dead).", "1d"),
    file("m3", "Agent", "maya", "Maya", "decision-style.md", "How this room makes calls",
      "Two options max, named plainly. The host decides fast when the suite covers the risk — lead with coverage. Gate-now beat flag-later has won three times running.", "6h"),
    file("m4", "Agent", "scout", "Scout", "staging-map.md", "Where staging secrets actually live",
      "DATABASE_URL: env in staging, vault in prod — asked once, answered by the host 2026-08-17. WEBHOOK_SECRET still undecided (blocked ask w8 open). Never read prod vault without an approval.", "31m"),
    // Session memory — one working session, what happened and why.
    file("m5", "Session", "coder", "Cline · Auth middleware", "session-2026-08-17-auth.md", "The auth-gate session: what landed, what's parked",
      "Landed requireAuth behind the approval (+12 −3). Suite went 5/5, 38ms p95 after the gate. Maya called gate-now-no-flag; decision beat is in the replay. Parked: webhook signature verification (w8) pending the secret-store answer.", "1h", true),
    file("m6", "Session", "maya", "Maya · Auth middleware", "session-2026-08-17-directing.md", "Directing notes — what held attention",
      "8-beat program looped clean. The tests beat staged real artifacts (plan, diff, report) — skimmers stopped skipping there. Keep decision beats under 7s; the caption carries the call.", "1h"),
    // Task memory — the working notes a task accumulates.
    file("m7", "Task", "w1", "Gate JWT refresh", "gate-jwt-notes.md", "Constraints that shaped the gate",
      "Early return chosen over throw — middleware stays composable. p95 target was 40ms; landed at 38. Refresh regression test named and pinned; do not rename it.", "1h"),
    file("m8", "Task", "w8", "Verify webhook signatures", "webhook-blockers.md", "Why this is blocked and what unblocks it",
      "Needs WEBHOOK_SECRET source (env vs vault). Signature scheme decided: HMAC-SHA256, signed payloads per the webhook contract doc. Once the store is named, verification is a two-file change.", "38m"),
    // Project memory — decisions that outlive tasks.
    file("m9", "Project", "Auth middleware", "Auth middleware", "decisions.md", "Standing decisions — read before proposing",
      "Gate refresh at middleware, not per-route (2026-08-17, suite covers it). No feature flags for auth-path changes; the suite is the flag. Secrets: env in staging, vault in prod.", "1h", true),
    file("m10", "Project", "Exports refactor", "Exports refactor", "adapter-shape.md", "The one-adapter rule",
      "Every export target goes through the adapter — no special cases. Fixture backfill retired six; new targets add a config, not a code path.", "3d"),
    // Plan memory — the thinking a plan carries between sessions.
    file("m11", "Plan", "payments-plan", "Payments refactor plan", "payments-plan-notes.md", "Open questions the plan must answer",
      "5 steps, touches 14 files. Open: idempotency keys per provider or shared? Maya leans shared with provider salt. Review parked until the host opens it — nothing moves before that.", "1d"),
  ],
};

const byPinThenId = (a, b) => (a.pinned === b.pinned ? String(a.id).localeCompare(String(b.id), undefined, { numeric: true }) : a.pinned ? -1 : 1);

// -------------------------------------------------- AppStore extension

export function installMemoryStore(s) {
  store = s;
  const proto = Object.getPrototypeOf(s);
  Object.assign(proto, {
    memory(scope = null, owner = null) {
      return (this.memoryFiles ?? []).filter((f) => (scope == null || f.scope === scope) && (owner == null || f.owner === owner)).sort(byPinThenId);
    },
    /** An agent's notebook: durable memory plus its per-session notes. */
    agentMemory(agentId) {
      return (this.memoryFiles ?? []).filter((f) => (f.scope === "Agent" || f.scope === "Session") && f.owner === agentId).sort(byPinThenId);
    },
    updateMemory(id, body) {
      const list = this.memoryFiles ?? [];
      if (!list.some((f) => f.id === id)) return;
      this.setMemoryFiles(list.map((f) => (f.id === id ? { ...f, body, updated: "now" } : f)));
    },
    togglePinMemory(id) {
      const list = this.memoryFiles ?? [];
      if (!list.some((f) => f.id === id)) return;
      this.setMemoryFiles(list.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f)));
    },
    addMemory({ scope, owner, ownerLabel, name, hook, body }) {
      this.setMemoryFiles([file(`m-${Math.floor(Date.now() / 1000)}`, scope, owner, ownerLabel, name, hook, body, "now"), ...(this.memoryFiles ?? [])]);
    },
  });
}

/** Seed the notebook once; production stays empty (nothing is seeded in that build). */
export function seedMemory(s) {
  store = s;
  if (s.memoryFiles == null) s.setMemoryFiles(s.configuration.previewContentEnabled ? MemorySeeds.files.map((f) => ({ ...f })) : []);
}

// -------------------------------------------------------- rows & sections

function ScopeBox({ scope, size = 28 }) {
  const meta = scopeMeta(scope);
  return html`<span class="ag-icobox on" style=${{ "--tint": meta.tint, width: size, height: size, borderRadius: 7 }}><${Icon} name=${meta.symbol} size=${Math.round(size * 0.46)} weight=${2.4} /></span>`;
}

export function MemoryRow({ file: f, showOwner = false, first = false }) {
  const s = useObservable(store);
  const menu = (e, pt) => showMenu({ clientX: pt?.x ?? e.clientX, clientY: pt?.y ?? e.clientY, currentTarget: e.currentTarget }, [
    { label: f.pinned ? "Unpin" : "Pin to top", icon: f.pinned ? "pin.slash" : "pin", onSelect: () => s.togglePinMemory(f.id) },
    { label: "Open", icon: "doc.text", onSelect: () => nav.push("memoryFile", { id: f.id }) },
  ], { title: f.name });
  return html`<${MemoryRowButton} first=${first} onClick=${() => nav.push("memoryFile", { id: f.id })} onLongPress=${menu}
    label=${`${f.scope} memory: ${f.name}. ${f.hook}. Updated ${f.updated} ago${f.pinned ? ". Pinned" : ""}`}>
    <${ScopeBox} scope=${f.scope} />
    <span class="row-body">
      <span class="hstack" style=${{ gap: 5 }}>
        <span class="mono w7 truncate" style=${{ fontSize: 12.5 }}>${f.name}</span>
        ${f.pinned ? html`<${Icon} name="pin.fill" size=${9} weight=${2} fill color="var(--violet-text)" label="Pinned" />` : null}
      </span>
      <span class="t-xs muted truncate" style=${{ display: "block", marginTop: 2 }}>${showOwner ? `${f.ownerLabel} — ${f.hook}` : f.hook}</span>
    </span>
    <span class="mono faint" style=${{ fontSize: 10 }}>${f.updated}</span>
    <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
  </${MemoryRowButton}>`;
}

function MemoryRowButton({ first, onClick, onLongPress, label, children }) {
  return html`<${Pressable} as="button" className=${cx("ag-mem-row", !first && "sep")} onClick=${onClick} onLongPress=${onLongPress} label=${label}>${children}</${Pressable}>`;
}

/** An agent's notebook on its profile — durable files plus session notes. */
export function AgentMemorySection({ agent }) {
  const s = useObservable(store);
  const files = s.agentMemory(agent.id);
  return html`<${Card} pad=${false}>
    ${files.length === 0 ? html`<div class="t-sm muted" style=${{ textAlign: "center", padding: "20px 12px" }}>No memory yet — this agent starts every session fresh.</div>` : null}
    ${files.map((f, i) => html`<${MemoryRow} key=${f.id} file=${f} first=${i === 0} />`)}
  </${Card}>`;
}

// ---------------------------------------------------------- reader / editor

/** Read a memory file; edit it in place. Hook = the index line (always loaded); body = what discovery pulls in. */
export function MemoryFileView({ params }) {
  ensureAgentsCSS();
  const s = useObservable(store);
  const f = (s.memoryFiles ?? []).find((x) => x.id === params.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!f) return html`<${Screen} title="Memory" back><${Empty} icon="brain" title="File not found" body="It may have been removed from the notebook." /></${Screen}>`;
  const meta = scopeMeta(f.scope);
  const toggleEdit = () => {
    if (editing) { s.updateMemory(f.id, draft); nav.toast("Saved — updated now", { icon: "checkmark.circle" }); }
    else setDraft(f.body);
    setEditing(!editing);
  };
  return html`<${Screen} title=${f.name} back trailing=${html`<button type="button" class="icon-btn plain pressable" aria-label=${f.pinned ? "Unpin" : "Pin"} title=${f.pinned ? "Unpin" : "Pin"} onClick=${() => { haptic("light"); s.togglePinMemory(f.id); }}><${Icon} name=${f.pinned ? "pin.fill" : "pin"} size=${17} fill=${f.pinned} color=${f.pinned ? "var(--violet-text)" : "var(--ink-78)"} /></button>`}>
    <div class="hstack" style=${{ gap: 10, marginTop: 8 }}>
      <${ScopeBox} scope=${f.scope} size=${32} />
      <div class="grow" style=${{ minWidth: 0 }}>
        <div class="mono w7 truncate" style=${{ fontSize: 15 }}>${f.name}</div>
        <div class="t-xs muted" style=${{ marginTop: 2, fontSize: 10.5 }}>${f.scope} memory · ${f.ownerLabel} · updated ${f.updated} ago</div>
      </div>
    </div>

    <${Eyebrow} style=${{ marginTop: 18 }}>HOOK · ALWAYS LOADED</${Eyebrow}>
    <${Card} style=${{ marginTop: 7 }}><div class="w6" style=${{ fontSize: 13.5, lineHeight: 1.4 }}>${f.hook}</div></${Card}>

    <div class="hstack" style=${{ marginTop: 18 }}>
      <${Eyebrow}>BODY · LOADS WHEN RELEVANT</${Eyebrow}>
      <span class="grow" />
      <button type="button" class="ag-linkbtn pressable" onClick=${toggleEdit} aria-label=${editing ? "Save body" : "Edit body"}>${editing ? "Save" : "Edit"}</button>
    </div>
    ${editing
      ? html`<${Card} pad=${false} style=${{ marginTop: 7 }}><${TextField} value=${draft} onInput=${setDraft} multiline rows=${8} clearable=${false} label="Memory body" autoFocus className="ag-editor" /></${Card}>`
      : html`<${Card} style=${{ marginTop: 7, minHeight: 120 }}><p class="ag-body" style=${{ whiteSpace: "pre-wrap" }}>${f.body}</p></${Card}>`}
    <p class="ag-note faint" style=${{ marginTop: 14 }}>Dynamic context discovery: the hook loads at session start; the body loads only when the work makes it relevant. On-device in the preview; the host reads the same shape.</p>
  </${Screen}>`;
}

// ------------------------------------------------------------- browser

/** Every notebook in one place, filterable by scope — plus a search over names, hooks, owners and bodies. */
export function MemoryBrowserView() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const [scope, setScope] = useState(null);
  const [query, setQuery] = useState("");
  const all = s.memoryFiles ?? [];
  const folded = query.trim().toLowerCase();
  const files = useMemo(() => s.memory(scope).filter((f) => !folded || [f.name, f.hook, f.ownerLabel, f.body].some((t) => t.toLowerCase().includes(folded))), [all, scope, folded]);
  const chip = (id, label, meta) => {
    const selected = scope === id;
    const tint = meta?.tint ?? "var(--violet)";
    return html`<button key=${id ?? "all"} type="button" role="tab" aria-selected=${selected} class=${cx("ag-scope pressable", selected && "on")} style=${{ "--tint": tint }} onClick=${() => { haptic("light"); setScope(id); }}>
      ${meta ? html`<${Icon} name=${meta.symbol} size=${11} weight=${2.4} />` : null}<span>${label}</span>
    </button>`;
  };
  return html`<${Screen} title="Memory" back>
    <div class="ag-hscroll" style=${{ marginTop: 8 }} role="tablist" aria-label="Scope">
      ${chip(null, `All · ${all.length}`, null)}
      ${MEMORY_SCOPES.map((m) => { const n = s.memory(m.id).length; return n > 0 ? chip(m.id, `${m.id} · ${n}`, m) : null; })}
    </div>
    <${TextField} value=${query} onInput=${setQuery} icon="magnifyingglass" placeholder=${`Search ${all.length} files`} label="Search memory" style=${{ marginTop: 10 }} />
    ${files.length ? html`<${Card} pad=${false} style=${{ marginTop: 12 }}>
      ${files.map((f, i) => html`<${MemoryRow} key=${f.id} file=${f} showOwner first=${i === 0} />`)}
    </${Card}>` : all.length
      ? html`<${Empty} icon="magnifyingglass" title=${`No Results for “${query}”`} body="Check the spelling or try a new search." />`
      : html`<${Empty} icon="brain" title="No memory yet" body=${s.configuration.previewContentEnabled ? "Agents write their own notebooks as they work." : "Notebooks sync from the host once a writer is connected. Nothing is seeded in this build."} />`}
    <p class="ag-foot">Memory is the fleet's notebook — files with hooks. Hooks always load; bodies load when relevant. Agents write their own; you can read, edit, and pin everything.</p>
  </${Screen}>`;
}

export function registerMemoryRoutes() {
  registerRoute("memoryBrowser", MemoryBrowserView);
  registerRoute("memoryFile", MemoryFileView);
}
