// One project's dependency map — a port of `Sources/ProjectMapView.swift`.
// Positions are computed from the dependency graph (topological layers,
// left→right, wrapped into columns of ≤4), never hand-placed, so any project
// in a fleet of hundreds renders a readable map. The layout builder is
// installed into `store.preheat.layoutBuilder` so the LRU-8 cache and the
// intent-driven warm-up both use it.
import { html, cx, useState, useEffect, useMemo, useRef, useObservable, haptic, clamp } from "../../ui.js";
import { nav } from "../../nav.js";
import { Icon, AvatarChip, Screen, Card, CLINE_BOT_PATH, Empty } from "../../components.js";
import { TaskRow, TaskStateChip } from "./TasksView.js";
import { useElementWidth, EyebrowRow } from "./shared.js";

let store = null;
export function bindProjectMapStore(s) { store = s; }

const PRIORITY = { Blocked: 0, Review: 1, Running: 2, Queued: 3, Done: 4 };
const STATE_ORDER = ["Blocked", "Review", "Running", "Queued", "Done"];
const MAP_CAP = 18;
const RING = { Running: "var(--live)", Review: "var(--violet)", Blocked: "var(--danger)", Queued: "var(--ink-35)", Done: "var(--ink-35)" };
const CLUSTER_TINT = { Running: "var(--live)", Review: "var(--violet)", Blocked: "var(--danger)", Queued: "var(--ink-55)", Done: "var(--ink-35)" };

// ------------------------------------------------------------ layout

/**
 * Kahn layering: tasks with no shown dependencies sit in column 0; each
 * dependent lands one column right of its deepest dependency. Tall layers
 * wrap into extra columns of at most 4 rows. Pure and static.
 */
export function computeLayout(items) {
  const shown = new Map(items.map((t) => [t.id, t]));
  const layerOf = new Map();
  const layer = (task, depth = 0) => {
    if (layerOf.has(task.id)) return layerOf.get(task.id);
    const deps = task.deps.filter((id) => shown.has(id));
    let result = 0;
    if (depth < 6 && deps.length) result = Math.max(0, ...deps.map((id) => layer(shown.get(id), depth + 1) + 1));
    layerOf.set(task.id, result);
    return result;
  };
  for (const t of items) layer(t);
  const columns = [];
  const maxLayer = Math.max(0, ...layerOf.values());
  for (let l = 0; l <= maxLayer; l++) {
    const inLayer = items.filter((t) => layerOf.get(t.id) === l);
    for (let c = 0; c < inLayer.length; c += 4) columns.push(inLayer.slice(c, c + 4));
  }
  const colCount = Math.max(1, columns.length);
  const out = [];
  columns.forEach((column, c) => {
    const x = colCount === 1 ? 0.5 : 0.14 + 0.72 * c / (colCount - 1);
    column.forEach((task, r) => {
      const y = column.length === 1 ? 0.42 : 0.16 + 0.62 * r / (column.length - 1);
      out.push({ taskId: task.id, x, y: y + (c % 2 === 0 ? 0 : 0.05) });
    });
  });
  return out;
}

/** The preheat builder: priority sort, 18-node cap, overflow clusters, placements. `count` keys the cache. */
export function buildProjectLayout(projectId, tasks) {
  const sorted = [...tasks].sort((a, b) => (PRIORITY[a.state] ?? 9) - (PRIORITY[b.state] ?? 9));
  const mapped = sorted.slice(0, MAP_CAP);
  const counts = {};
  for (const t of sorted.slice(MAP_CAP)) counts[t.state] = (counts[t.state] ?? 0) + 1;
  return {
    count: tasks.length,
    projectId,
    mapIds: mapped.map((t) => t.id),
    placements: computeLayout(mapped),
    clusters: STATE_ORDER.filter((s) => counts[s]).map((s) => ({ state: s, count: counts[s] })),
  };
}

// ------------------------------------------------------------- view

export function ProjectMapView({ params }) {
  const s = useObservable(store);
  const projectId = params?.projectId;
  const items = s.tasksByProject[projectId] ?? [];
  const agg = s.agg(projectId);
  const layout = useMemo(() => (items.length ? s.preheat.layout(projectId, items) : null), [projectId, items]);
  const [selectedId, setSelectedId] = useState(null);
  const [stateFilter, setStateFilter] = useState(null);
  const byId = useMemo(() => new Map(items.map((t) => [t.id, t])), [items]);
  const mapItems = useMemo(() => (layout?.mapIds ?? []).map((id) => byId.get(id)).filter(Boolean), [layout, byId]);

  useEffect(() => { setSelectedId(params?.focusTaskId ?? layout?.mapIds[0] ?? null); }, [projectId]);

  const selected = selectedId ? byId.get(selectedId) : null;
  const memory = useMemo(() => projectMemory(s.memoryFiles, "project", projectId), [s.memoryFiles, projectId]);
  const listed = stateFilter ? items.filter((t) => t.state === stateFilter) : items;
  const mapHeight = mapItems.length <= 4 ? 220 : mapItems.length <= 10 ? 300 : 380;
  const archived = s.archivedProjects.has(projectId);

  return html`<${Screen} title=${projectId ?? "Project"} back contentClass="tk-pushed">
    ${!items.length ? html`<${Empty} icon="point.3.connected.trianglepath.dotted" title=${archived ? "This project is filed" : "No tasks in this project"} body=${archived ? "Restore it from the archive to see its map." : "Tasks land here as agents report them."} action=${archived ? "Open archive" : null} onAction=${() => nav.push("archive")} />` : html`
      <div class="tk-sum">
        <${SummaryChip} n=${agg.running} label="running" color="var(--live)" />
        ${agg.blocked > 0 ? html`<${SummaryChip} n=${agg.blocked} label="blocked" color="var(--danger)" />` : null}
        ${agg.review > 0 ? html`<${SummaryChip} n=${agg.review} label="review" color="var(--violet-text)" />` : null}
        <${SummaryChip} n=${`${agg.done}/${agg.total}`} label="shipped" color="var(--ink-55)" />
      </div>
      ${mapItems.length ? html`<${DependencyMap} projectId=${projectId} items=${mapItems} placements=${layout.placements} height=${mapHeight} selectedId=${selectedId} onSelect=${setSelectedId} />` : null}
      ${layout?.clusters.length ? html`<div class="tk-hscroll tk-clusters" role="group" aria-label="Tasks past the map cap">
        <span>Mapping ${mapItems.length} most active</span>
        ${layout.clusters.map((c) => html`<button key=${c.state} type="button" class=${cx("tk-cluster pressable", stateFilter === c.state && "on")} style=${{ "--tint": CLUSTER_TINT[c.state] }} aria-pressed=${stateFilter === c.state}
          aria-label=${`${c.count} more ${c.state} tasks`} title="Filters the task list below" onClick=${() => { haptic("light"); setStateFilter(stateFilter === c.state ? null : c.state); }}><i />+${c.count} ${c.state.toLowerCase()}</button>`)}
      </div>` : null}
      ${selected ? html`<${TaskDetailCard} task=${selected} />` : null}
      ${memory.length ? html`<${Card} className="tk-detail" pad=${false} style=${{ padding: 0, overflow: "hidden" }}>
        ${memory.map((f, i) => html`<${MemoryRow} key=${f.id} file=${f} first=${i === 0} />`)}
      </${Card}>` : null}
      <div class="tk-eyebrow-row" style=${{ marginTop: 20 }}>
        <div class="eyebrow">${stateFilter ? `${stateFilter.toUpperCase()} TASKS` : "ALL TASKS"}</div>
        ${stateFilter ? html`<button type="button" class="tk-clear pressable" onClick=${() => { haptic("light"); setStateFilter(null); }}>Clear <${Icon} name="xmark.circle" size=${13} weight=${2.4} /></button>` : null}
      </div>
      <div class="vstack" style=${{ gap: 9, marginTop: 10 }} role="list">
        ${listed.map((t) => html`<button key=${t.id} type="button" class="pressable" style=${{ width: "100%", textAlign: "left", color: "inherit" }} aria-label=${`${t.title}, ${t.state}`} aria-pressed=${t.id === selectedId} onClick=${() => { haptic("light"); setSelectedId(t.id); }}><${TaskRow} task=${t} /></button>`)}
      </div>
    `}
  </${Screen}>`;
}

function SummaryChip({ n, label, color }) {
  return html`<span class="tk-sumchip"><b style=${{ color }}>${n}</b>${label}</span>`;
}

function projectMemory(files, scope, owner) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => String(f.scope ?? "").toLowerCase() === scope && f.owner === owner)
    .sort((a, b) => (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1) || String(a.id).localeCompare(String(b.id)));
}

const SCOPE_META = { agent: ["brain", "var(--violet)"], session: ["waveform", "var(--live)"], task: ["checklist", "var(--tint-blue)"], project: ["folder", "var(--tint-amber)"], plan: ["map", "var(--tint-teal)"] };

/** The project's standing memory — decisions that outlive tasks (AgentMemory's MemoryRow). */
function MemoryRow({ file, first }) {
  const [symbol, tint] = SCOPE_META[String(file.scope ?? "").toLowerCase()] ?? SCOPE_META.project;
  return html`<button type="button" class="row interactive pressable" style=${{ boxShadow: first ? "none" : undefined }} onClick=${() => { haptic("light"); nav.push("memoryFile", { id: file.id }); }} aria-label=${`${file.name}. ${file.hook}`}>
    <span class="row-icon" style=${{ color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)` }}><${Icon} name=${symbol} size=${15} weight=${2.2} /></span>
    <div class="row-body"><div class="row-title truncate">${file.name}</div><div class="row-sub truncate">${file.hook}</div></div>
    <div class="row-trailing"><span class="t-xs mono faint">${file.updated ?? ""}</span><${Icon} name="chevron.right" size=${14} weight=${2.4} /></div>
  </button>`;
}

// ------------------------------------------------------- dependency map

const NODE_LABEL_W = 76;
function wrapLabel(title, max = 13) {
  const words = String(title).split(/\s+/);
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + " " + w).length <= max) lines[lines.length - 1] = cur + " " + w;
    else if (lines.length < 2) lines.push(w);
    else { lines[1] = (lines[1] + " " + w); break; }
  }
  if (lines[1] && lines[1].length > max + 1) lines[1] = lines[1].slice(0, max) + "…";
  return lines;
}

/** SVG map: nodes colored by state, edges as quad curves, pinch/wheel zoom, drag to pan while zoomed, double-tap to reset. */
function DependencyMap({ projectId, items, placements, height, selectedId, onSelect }) {
  const hostRef = useRef();
  const width = useElementWidth(hostRef, 361);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gesture = useRef({ pointers: new Map(), pinchDist: 0, zoomAnchor: 1, panAnchor: { x: 0, y: 0 }, dragFrom: null, lastTap: 0 });
  const byId = useMemo(() => new Map(items.map((t) => [t.id, t])), [items]);
  const positions = useMemo(() => {
    const m = new Map();
    for (const p of placements) if (byId.has(p.taskId)) m.set(p.taskId, { x: p.x * width, y: p.y * height });
    return m;
  }, [placements, byId, width, height]);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); gesture.current.zoomAnchor = 1; gesture.current.panAnchor = { x: 0, y: 0 }; }, [projectId]);

  const zoomed = zoom > 1.02;
  const clampPan = (p, z = zoom) => ({ x: clamp(p.x, -width * (z - 1) / 2, width * (z - 1) / 2), y: clamp(p.y, -height * (z - 1) / 2, height * (z - 1) / 2) });
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); gesture.current.zoomAnchor = 1; gesture.current.panAnchor = { x: 0, y: 0 }; };

  const onPointerDown = (e) => {
    const g = gesture.current;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y); g.zoomAnchor = zoom; g.dragFrom = null;
      hostRef.current?.setPointerCapture?.(e.pointerId);
    } else if (g.pointers.size === 1) {
      const now = performance.now();
      if (now - g.lastTap < 300) { g.lastTap = 0; reset(); return; }
      g.lastTap = now;
      if (zoomed) { g.dragFrom = { x: e.clientX, y: e.clientY }; g.panAnchor = pan; hostRef.current?.setPointerCapture?.(e.pointerId); }
    }
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2 && g.pinchDist) {
      const [a, b] = [...g.pointers.values()];
      const z = clamp(g.zoomAnchor * Math.hypot(a.x - b.x, a.y - b.y) / g.pinchDist, 1, 2.6);
      setZoom(z); setPan((p) => clampPan(p, z));
    } else if (g.dragFrom && zoomed) {
      const dx = e.clientX - g.dragFrom.x, dy = e.clientY - g.dragFrom.y;
      if (Math.hypot(dx, dy) > 12 || g.dragging) { g.dragging = true; setPan(clampPan({ x: g.panAnchor.x + dx, y: g.panAnchor.y + dy })); }
    }
  };
  const onPointerUp = (e) => {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) { g.pinchDist = 0; g.zoomAnchor = zoom; if (zoom <= 1.02) reset(); }
    if (!g.pointers.size) { g.dragFrom = null; g.dragging = false; g.panAnchor = pan; }
  };
  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const z = clamp(zoom * (e.deltaY < 0 ? 1.08 : 0.92), 1, 2.6);
    setZoom(z); setPan((p) => clampPan(p, z)); gesture.current.zoomAnchor = z;
    if (z <= 1.02) reset();
  };

  const edges = [];
  for (const t of items) for (const depId of t.deps) {
    const from = positions.get(depId), to = positions.get(t.id), dep = byId.get(depId);
    if (!from || !to || !dep) continue;
    const blockedEdge = dep.state === "Blocked";
    edges.push(html`<path key=${`${depId}->${t.id}`} d=${`M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 18} ${to.x} ${to.y}`} fill="none"
      stroke=${blockedEdge ? "var(--danger)" : "var(--ink-35)"} stroke-opacity=".45" stroke-width="1.2" stroke-dasharray=${blockedEdge ? "4 4" : undefined} />`);
  }

  return html`<div ref=${hostRef} class=${cx("tk-map", zoomed && "zoomed")} style=${{ height }}
    onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp} onWheel=${onWheel}
    onDblClick=${reset} title="Pinch or ⌘-scroll to zoom the map; double-tap to reset">
    <svg viewBox=${`0 0 ${width} ${height}`} width=${width} height=${height} role="group" aria-label=${`Dependency map, ${items.length} tasks. Pinch to zoom; double-tap to reset.`}
      style=${{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: gesture.current.pointers.size ? "none" : "transform .25s var(--ease)" }}>
      <g aria-hidden="true">${edges}</g>
      ${items.map((t) => { const p = positions.get(t.id); return p ? html`<${MapNode} key=${t.id} task=${t} x=${p.x} y=${p.y} selected=${t.id === selectedId} onSelect=${() => { haptic("light"); onSelect(t.id); }} />` : null; })}
    </svg>
    ${zoomed ? html`<span class="tk-zoom fade-in">${zoom.toFixed(1)}×</span>` : null}
  </div>`;
}

function MapNode({ task, x, y, selected, onSelect }) {
  const done = task.state === "Done";
  const r = done ? 17 : 22;
  const ring = RING[task.state];
  const running = task.state === "Running" && task.progress != null;
  const rr = r - 1.5, C = 2 * Math.PI * rr;
  const lines = wrapLabel(task.title);
  let label = `${task.title}, ${task.state}`;
  if (running) label += `, ${Math.round(task.progress * 100)} percent`;
  label += `, ${task.agentName}`;
  const botScale = 13 / 487.04;
  return html`<g class="node" transform=${`translate(${x} ${y})`} role="button" tabindex="0" aria-label=${label} aria-pressed=${selected} title="Selects this task on the map"
    onClick=${(e) => { e.stopPropagation(); onSelect(); }} onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}>
    <circle class="hit" r=${r + 6} fill="transparent" />
    <circle r=${r} fill="var(--surface)" style=${{ filter: "drop-shadow(0 2px 3px var(--node-shadow))" }} />
    <circle r=${rr} fill="none" stroke=${ring} stroke-opacity=".25" stroke-width="3" />
    ${running
      ? html`<circle r=${rr} fill="none" stroke="var(--live)" stroke-width="3" stroke-linecap="round" stroke-dasharray=${`${C * task.progress} ${C}`} transform="rotate(-90)" />`
      : html`<circle r=${rr} fill="none" stroke=${ring} stroke-width="3" stroke-opacity=${done ? .35 : 1} />`}
    ${done
      ? html`<path d="M-4.5 0.5 L-1.5 3.5 L4.5 -3" fill="none" stroke="var(--ink-35)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
      : html`<circle r="11" fill=${task.agentColor} /><path d=${CLINE_BOT_PATH} fill="#fff" fill-rule="evenodd" transform=${`translate(${-466.73 * botScale / 2} ${-487.04 * botScale / 2}) scale(${botScale})`} />`}
    ${selected ? html`<circle r=${r + 4} fill="none" stroke="var(--violet)" stroke-width="2" />` : null}
    <text class=${cx("lbl", done && "done", selected && "sel")} y=${r + 11} text-anchor="middle">
      ${lines.map((ln, i) => html`<tspan key=${i} x="0" dy=${i === 0 ? 0 : 11}>${ln}</tspan>`)}
    </text>
  </g>`;
}

// ---------------------------------------------------------- detail

function TaskDetailCard({ task }) {
  const s = useObservable(store);
  const interrupt = task.state === "Blocked" ? s.interrupts.find((i) => !i.resolved && i.agentName === task.agentName && i.kind === "blocked") : null;
  const memory = useMemo(() => projectMemory(s.memoryFiles, "task", task.id), [s.memoryFiles, task.id]);
  return html`<${Card} className="tk-detail bounce-in" key=${task.id}>
    <div class="hstack" style=${{ gap: 10 }}>
      <${AvatarChip} letter=${task.agentName.charAt(0)} name=${task.agentName} color=${task.agentColor} size=${30} />
      <div class="grow" style=${{ minWidth: 0 }}>
        <div class="w7" style=${{ fontSize: 14.5 }}>${task.title}</div>
        <div class="t-xs faint">${task.room} · ${task.agentName}</div>
      </div>
      <${TaskStateChip} state=${task.state} />
    </div>
    ${task.detail ? html`<div class="t-sm muted" style=${{ marginTop: 9, fontSize: 12 }}>${task.detail}</div>` : null}
    ${memory.map((f) => html`<button key=${f.id} type="button" class="tk-memrow pressable" onClick=${() => { haptic("light"); nav.push("memoryFile", { id: f.id }); }} aria-label=${`Task memory: ${f.hook}`}>
      <${Icon} name="brain" size=${11} weight=${2.4} color="var(--tint-blue)" /><span class="grow truncate">${f.hook}</span><${Icon} name="chevron.right" size=${10} weight=${2.6} color="var(--ink-35)" />
    </button>`)}
    <div class="tk-actions">
      ${interrupt ? html`<button type="button" class="tk-action solid pressable" onClick=${() => { haptic("light"); nav.push("conversation", { interruptId: interrupt.id }); }}>Answer ${task.agentName}</button>`
        : task.room === "Auth middleware" ? html`<button type="button" class="tk-action solid pressable" onClick=${() => { haptic("light"); s.joinCall(); }}>Join session</button>` : null}
      <button type="button" class="tk-action pressable" onClick=${() => { haptic("light"); nav.selectTab("agents"); }}>View agent</button>
    </div>
  </${Card}>`;
}
