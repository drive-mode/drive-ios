// Tasks at fleet scale — a port of `Sources/TasksView.swift`.
// Level-of-detail IA: attention rail first, then project cards (windowed
// grid), then one project's dependency map on drill-in. Search cuts across
// all of it, including the archive. Also home to `TaskRow`, `TaskStateChip`,
// `SearchResults`, `ArchiveView`, `AllTasksList` and the `NeedsYouRouter`.
import { html, cx, useState, useEffect, useMemo, useRef, useObservable, useLongPress, haptic } from "../../ui.js";
import { nav } from "../../nav.js";
import { Icon, AvatarChip, DriveSpinner, Screen, SearchField, HomeToolbarButton, SettingsToolbarButton, Empty } from "../../components.js";
import { TASK_STATE_TINT } from "../../models.js";
import { useScrollWindow, ModeToggle, EyebrowRow, pluralize } from "./shared.js";

let store = null;
/** Called once by registerTasks — the store is received, never imported. */
export function bindTasksStore(s) { store = s; }

const STATE_DOT = { Running: "var(--live)", Review: "var(--violet)", Blocked: "var(--danger)", Queued: "var(--ink-35)", Done: "var(--ink-35)" };

// ------------------------------------------------------------ rows

export function TaskStateChip({ state }) {
  if (state === "Done") return html`<span class="tk-state done" aria-label="Done"><${Icon} name="checkmark" size=${13} weight=${3} /></span>`;
  return html`<span class=${cx("tk-state", state.toLowerCase())}>${state === "Running" ? html`<i class="dot" />` : null}${state}</span>`;
}

export function TaskRow({ task, showProject = false, archived = false, className }) {
  return html`<div class=${cx("tk-taskrow", task.state === "Done" && "done", archived && "archived", className)}>
    <${AvatarChip} letter=${task.agentName.charAt(0)} name=${task.agentName} color=${task.agentColor} size=${28} />
    <div class="body">
      <div class="t">${task.title}</div>
      ${showProject ? html`<div class="r">${task.room}</div>` : null}
    </div>
    ${task.progress != null && task.state === "Running" ? html`<span class="pct">${Math.round(task.progress * 100)}%</span>` : null}
    <${TaskStateChip} state=${task.state} />
    ${archived ? html`<span class="tag" aria-hidden="true">ARCHIVED</span>` : null}
  </div>`;
}

/** Open the map focused on a task — or, for a blocked task with a live question, the conversation. */
export function openTask(task) {
  if (task.state === "Blocked") {
    const interrupt = store.interrupts.find((i) => !i.resolved && i.kind === "blocked" && i.agentName === task.agentName);
    if (interrupt) { nav.push("conversation", { interruptId: interrupt.id }); return; }
  }
  nav.push("projectMap", { projectId: task.room, focusTaskId: task.id });
}

function TaskButton({ task, showProject, label }) {
  return html`<button type="button" class="pressable" style=${{ width: "100%", textAlign: "left", color: "inherit" }} aria-label=${label ?? `${task.title}, ${task.state}, ${task.room}`} onClick=${() => { haptic("light"); openTask(task); }}>
    <${TaskRow} task=${task} showProject=${showProject} />
  </button>`;
}

/** Routes "needs you" to the single open conversation, or the triage list. */
export function needsYouRouter() {
  const open = store.openInterrupts;
  store.intent.record("needsYou");
  if (open.length === 1) nav.push("conversation", { interruptId: open[0].id });
  else nav.push("needsYou");
}

// ----------------------------------------------------------- root

export function TasksView() {
  const s = useObservable(store);
  const [mode, setMode] = useState("Projects");
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const scrollRef = useRef();
  const searching = query.trim().length > 0;
  const preview = s.configuration.previewContentEnabled;

  const countRunning = useMemo(() => Object.values(s.aggByProject).reduce((n, a) => n + a.running, 0), [s.aggByProject]);
  const blocked = useMemo(() => s.attentionTasks.filter((t) => t.state === "Blocked").length, [s.attentionTasks]);

  const toggleSelecting = () => { setSelecting((v) => { if (v) setSelectedIds(new Set()); return !v; }); };
  const toggleId = (id) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const fileSelected = () => {
    const n = selectedIds.size;
    s.archiveTasks([...selectedIds]);
    setSelectedIds(new Set()); setSelecting(false);
    haptic("success");
    nav.toast(`Filed ${pluralize(n, "task")} to the archive`, { icon: "archivebox" });
  };

  const footer = selecting && selectedIds.size > 0 ? html`<div class="tk-filebar"><button type="button" class="pressable" onClick=${fileSelected}><${Icon} name="archivebox" size=${15} weight=${2.4} />File ${selectedIds.size} to archive</button></div>` : null;

  return html`<${Screen} largeTitle="Tasks" root scrollRef=${scrollRef} footer=${footer}
    leading=${html`<${HomeToolbarButton} />`} trailing=${html`<${SettingsToolbarButton} tab="General" source="tasks" />`}>
    <${StatusStrip} needsYou=${s.needsYouCount} running=${countRunning} blocked=${blocked} />
    <${SearchField} className="tk-search" value=${query} onInput=${setQuery} placeholder=${`Search ${s.tasks.length} tasks · ${s.projects.length} projects`} label="Search tasks and projects" />
    ${searching ? html`<${SearchResults} query=${query} />` : html`
      <${AttentionRail} items=${s.attentionTasks} />
      <${TidyCard} />
      <div class="tk-modebar">
        <${ModeToggle} options=${["Projects", "All tasks"]} value=${mode} onChange=${setMode} label="Tasks view" />
        ${mode === "All tasks" ? html`<button type="button" class=${cx("tk-select pressable", selecting && "on")} aria-pressed=${selecting} onClick=${() => { haptic("light"); toggleSelecting(); }}>${selecting ? "Done" : "Select"}</button>` : null}
      </div>
      ${mode === "Projects"
        ? html`<${ProjectGrid} scrollRef=${scrollRef} projects=${s.orderedProjects} seeded=${s.fleetSeeded} preview=${preview} />`
        : html`<${AllTasksList} scrollRef=${scrollRef} selecting=${selecting} selectedIds=${selectedIds} onToggle=${toggleId} />`}
      <${ArchiveFooter} count=${s.archivedCount} />
    `}
  </${Screen}>`;
}

function StatusStrip({ needsYou, running, blocked }) {
  const tile = (n, label, { accent, live, danger, onClick, hint } = {}) => html`<${onClick ? "button" : "div"} type=${onClick ? "button" : undefined} class=${cx("tk-tile", accent && "accent", danger && "danger", onClick && "pressable")} onClick=${onClick} aria-label=${`${n} ${label}${hint ? `. ${hint}` : ""}`}>
    <span class="n">${n}</span><span class="l">${live ? html`<i class="dot" />` : null}${label}</span>
  </${onClick ? "button" : "div"}>`;
  return html`<div class="tk-strip">
    ${tile(needsYou, "Need you", { accent: true, onClick: () => { haptic("light"); needsYouRouter(); }, hint: "Opens what needs a human" })}
    ${tile(running, "Running", { live: true })}
    ${tile(blocked, "Blocked", { danger: true })}
  </div>`;
}

/** The queue of things a human must touch — O(attention), never O(tasks). */
function AttentionRail({ items }) {
  if (!items.length) return null;
  const shown = items.slice(0, 14);
  return html`
    <${EyebrowRow} label="NEEDS A HUMAN" trailing=${items.length} />
    <div class="tk-hscroll tk-rail" role="list" aria-label="Needs a human">
      ${shown.map((task) => html`<button key=${task.id} type="button" role="listitem" class=${cx("tk-att pressable", task.state === "Blocked" && "blocked")}
        aria-label=${`${task.title}, ${task.state}, ${task.room}`} title="Opens the project map focused on this task"
        onClick=${() => { haptic("light"); openTask(task); }}>
        <div class="hstack" style=${{ gap: 6 }}><${AvatarChip} letter=${task.agentName.charAt(0)} color=${task.agentColor} size=${20} /><${TaskStateChip} state=${task.state} /></div>
        <div class="t">${task.title}</div>
        <div class="r">${task.room}</div>
      </button>`)}
      ${items.length > 14 ? html`<span class="tk-more">+${items.length - 14} more</span>` : null}
    </div>`;
}

/** Focus is the default: shipped work files itself out of view — never deleted, always searchable. */
function TidyCard() {
  const s = useObservable(store);
  const pending = useRef(0);
  useEffect(() => {
    if (!s.sweeping && pending.current) { const n = pending.current; pending.current = 0; haptic("success"); nav.toast(`Filed ${pluralize(n, "task")} to the archive`, { icon: "archivebox" }); }
  }, [s.sweeping]);
  const candidates = s.sweepCandidateCount;
  if (candidates <= 0 && !s.sweeping) return null;
  return html`<div class="tk-tidy" role="status">
    <span class="ic">${s.sweeping ? html`<${DriveSpinner} size=${26} />` : html`<${Icon} name="sparkles" size=${18} weight=${2.4} />`}</span>
    <div class="grow">
      <div class="t-sm w7" style=${{ fontSize: 13.5 }}>${s.sweeping ? "Filing…" : `${candidates} shipped tasks ready to file`}</div>
      <div class="t-xs muted" style=${{ marginTop: 2 }}>Out of sight, still searchable — never deleted</div>
    </div>
    ${!s.sweeping ? html`<button type="button" class="tk-sweep pressable" onClick=${() => { pending.current = candidates; haptic("light"); s.sweepArchive(); }}>Sweep</button>` : null}
  </div>`;
}

function ArchiveFooter({ count }) {
  return html`<button type="button" class="tk-foot pressable" onClick=${() => { haptic("light"); nav.push("archive"); }} aria-label=${`Archive, ${count} items. Filed, searchable, restorable.`}>
    <${Icon} name="archivebox" size=${14} weight=${2.2} />
    <span>Archive · ${count} items</span>
    <span class="sub grow">filed, searchable, restorable</span>
    <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
  </button>`;
}

// --------------------------------------------------- project grid

const CARD_H = 118, CARD_GAP = 9;

/** LazyVGrid twin: two columns, only the rows in view get built. */
function ProjectGrid({ scrollRef, projects, seeded, preview }) {
  const hostRef = useRef();
  const skeletons = preview && !seeded ? 6 : 0;
  const cells = projects.length + skeletons;
  const rowCount = Math.ceil(cells / 2);
  const offsets = useMemo(() => Array.from({ length: rowCount }, (_, r) => r * (CARD_H + CARD_GAP)), [rowCount]);
  const [start, end] = useScrollWindow(scrollRef, hostRef, offsets);
  const total = rowCount ? rowCount * (CARD_H + CARD_GAP) - CARD_GAP : 0;
  if (!cells) return html`<${Empty} icon="checklist" title="No projects on the floor" body=${preview ? "Everything is filed — restore a project from the archive or wait for the wire." : "Connect a writer to see your fleet's projects here."} />`;
  const rows = [];
  for (let r = start; r < end; r++) {
    const a = r * 2, b = a + 1;
    rows.push(html`<div key=${r} class="tk-gridrow" style=${{ top: offsets[r] }}>
      ${[a, b].map((i) => i < projects.length ? html`<${ProjectCard} key=${projects[i].id} project=${projects[i]} />` : i < cells ? html`<div key=${`sk${i}`} class="tk-proj skel skeleton" aria-busy="true" />` : null)}
    </div>`);
  }
  return html`<div ref=${hostRef} class="tk-grid" style=${{ height: total }} role="list" aria-label="Projects" aria-busy=${skeletons > 0}>${rows}</div>`;
}

/** One project, one card: name, area, live counts, and a proportional state bar. */
export function ProjectCard({ project }) {
  const s = store;
  const agg = s.agg(project.id);
  const attention = agg.review + agg.blocked;
  const pinned = s.pinnedProjects.has(project.id);
  const never = s.neverFileProjects.has(project.id);
  const openMap = () => nav.push("projectMap", { projectId: project.id });
  const menu = (e, pt) => {
    nav.openMenu({ x: pt.x, y: pt.y, preview: html`<${ProjectPeek} project=${project} />`, items: [
      { label: pinned ? "Unpin" : "Pin to top", icon: pinned ? "pin.slash" : "pin", onSelect: () => s.togglePin(project.id) },
      { label: "File project to archive", icon: "archivebox", onSelect: () => { s.archiveProject(project.id); nav.toast(`Filed ${project.name}`, { icon: "archivebox" }); } },
      { label: never ? "Allow auto-file" : "Never auto-file", icon: never ? "archivebox.circle" : "archivebox.circle.fill", onSelect: () => s.toggleNeverFile(project.id) },
    ] });
  };
  const lp = useLongPress(menu, { onClick: () => { haptic("light"); openMap(); } });
  const parts = [`${project.name}, ${project.area}, ${pluralize(agg.total, "task")}`];
  if (agg.running) parts.push(`${agg.running} running`);
  if (agg.blocked) parts.push(`${agg.blocked} blocked`);
  if (agg.review) parts.push(`${agg.review} in review`);
  return html`<button type="button" role="listitem" class=${cx("tk-proj pressable", agg.blocked > 0 ? "blocked" : attention > 0 && "attn")} aria-label=${parts.join(", ")} title="Opens the project map. Long press to pin or archive." ...${lp}>
    <div class="head">
      ${pinned ? html`<span class="pin"><${Icon} name="pin.fill" size=${10} weight=${2.6} fill /></span>` : null}
      <span class="name">${project.name}</span>
      ${attention > 0 ? html`<span class=${cx("tk-count", agg.blocked > 0 && "danger")}>${attention}</span>` : null}
    </div>
    <div class="area">${project.area} · ${agg.total} task${agg.total === 1 ? "" : "s"}</div>
    <${StateBar} agg=${agg} />
    <div class="tk-legend">${agg.running > 0 ? html`<i style=${{ background: "var(--live)" }} />${agg.running} running` : agg.total === agg.done ? html`<i style=${{ background: "var(--ink-35)" }} />shipped` : html`<i style=${{ background: "var(--ink-35)" }} />quiet`}</div>
  </button>`;
}

function StateBar({ agg }) {
  const total = Math.max(1, agg.total);
  const seg = (count, color) => (count > 0 ? html`<i style=${{ flex: `${count} 1 0`, background: color }} title=${count} />` : null);
  return html`<div class="tk-bar" aria-hidden="true">
    ${seg(agg.running, "var(--live)")}
    ${seg(agg.blocked, TASK_STATE_TINT.Blocked)}
    ${seg(agg.review, TASK_STATE_TINT.Review)}
    ${seg(agg.queued, "color-mix(in srgb, var(--ink-35) 50%, transparent)")}
    ${seg(agg.done, "color-mix(in srgb, var(--ink-35) 22%, transparent)")}
  </div>`;
}

/** What holding a project card shows: the numbers plus the queue that needs a human. */
function ProjectPeek({ project }) {
  const agg = store.agg(project.id);
  const attention = (store.tasksByProject[project.id] ?? []).filter((t) => t.state === "Blocked" || t.state === "Review").slice(0, 3);
  const count = (v, l, c) => html`<span><b style=${{ color: c }}>${v}</b>${l}</span>`;
  return html`<div class="tk-peek">
    <div class="hstack" style=${{ justifyContent: "space-between", gap: 8 }}><span class="w8" style=${{ fontSize: 16 }}>${project.name}</span><span class="eyebrow" style=${{ fontSize: 9, letterSpacing: .7 }}>${project.area} · ${agg.total} tasks</span></div>
    <div class="counts">
      ${count(agg.running, "running", "var(--live)")}
      ${agg.blocked > 0 ? count(agg.blocked, "blocked", "var(--danger)") : null}
      ${agg.review > 0 ? count(agg.review, "review", "var(--violet-text)") : null}
      ${count(agg.done, "shipped", "var(--ink-55)")}
    </div>
    <div class="vstack" style=${{ gap: 8 }}>${attention.map((t) => html`<${TaskRow} key=${t.id} task=${t} />`)}</div>
  </div>`;
}

// --------------------------------------------------- search & lists

export function SearchResults({ query }) {
  const s = useObservable(store);
  const [showArchived, setShowArchived] = useState(false);
  const results = useMemo(() => s.searchTasks(query), [query, s.tasksByProject, s.archivedCount]);
  const active = results.active.slice(0, 100);
  return html`<div>
    <${EyebrowRow} label=${results.active.length ? `${results.active.length} ACTIVE MATCH${results.active.length === 1 ? "" : "ES"}` : "NO ACTIVE MATCHES"} />
    <div class="tk-vlist" role="list">
      ${active.map((t) => html`<${TaskButton} key=${t.id} task=${t} showProject />`)}
      ${results.active.length > 100 ? html`<div class="tk-showing">Showing 100 of ${results.active.length} — narrow the search</div>` : null}
      ${!results.active.length && !results.archived.length ? html`<div class="tk-showing">Nothing matches “${query.trim()}” — across the floor or the archive.</div>` : null}
    </div>
    ${results.archived.length ? html`
      <button type="button" class="tk-archive-more pressable" aria-expanded=${showArchived} onClick=${() => { haptic("light"); setShowArchived((v) => !v); }}>
        <${Icon} name="archivebox" size=${13} weight=${2.2} />
        <span>${results.archived.length} more in the archive</span>
        <${Icon} name=${showArchived ? "chevron.up" : "chevron.down"} size=${11} weight=${2.6} />
      </button>
      ${showArchived ? html`<div class="tk-vlist fade-in" role="list" aria-label="Archived matches">${results.archived.slice(0, 50).map((t) => html`<${TaskRow} key=${t.id} task=${t} showProject archived />`)}</div>` : null}
    ` : null}
  </div>`;
}

/** Pushed search surface (route "search") — the same results, with focus on the field. */
export function SearchView({ params }) {
  const s = useObservable(store);
  const [query, setQuery] = useState(params?.query ?? "");
  return html`<${Screen} title="Search" back contentClass="tk-pushed">
    <${SearchField} className="tk-search" value=${query} onInput=${setQuery} autoFocus placeholder=${`Search ${s.tasks.length} tasks · ${s.projects.length} projects`} label="Search tasks and projects" />
    ${query.trim() ? html`<${SearchResults} query=${query} />` : html`<div class="tk-showing" style=${{ marginTop: 14 }}>Search spans every project, task, and the archive.</div>`}
  </${Screen}>`;
}

const HEAD_PITCH = 40, ROW_PITCH = 58, ROW_H = 48;

/** Every task, grouped by project, windowed — hundreds of rows because only what is on screen is built. */
export function AllTasksList({ scrollRef, selecting = false, selectedIds, onToggle, pushed = false }) {
  const s = useObservable(store);
  const hostRef = useRef();
  const model = useMemo(() => {
    const rows = [], offsets = [], sectionOf = [];
    let y = 0, section = -1;
    for (const p of s.orderedProjects) {
      const items = s.tasksByProject[p.id];
      if (!items?.length) continue;
      section = rows.length;
      rows.push({ kind: "head", id: `h:${p.id}`, project: p, count: items.length }); offsets.push(y); sectionOf.push(section); y += HEAD_PITCH;
      for (const t of items) { rows.push({ kind: "task", id: t.id, task: t }); offsets.push(y); sectionOf.push(section); y += ROW_PITCH; }
    }
    return { rows, offsets, sectionOf, total: Math.max(0, y - 10) };
  }, [s.orderedProjects, s.tasksByProject]);
  const [start, end] = useScrollWindow(scrollRef, hostRef, model.offsets);
  if (!model.rows.length) return html`<${Empty} icon="checklist" title="No tasks on the floor" body=${s.configuration.previewContentEnabled ? "Everything is filed. The archive keeps it searchable." : "Tasks arrive from the writer once a room is live."} />`;
  const stickyHead = model.rows[model.sectionOf[start]];
  const out = [];
  for (let i = start; i < end; i++) {
    const row = model.rows[i];
    if (row.kind === "head") out.push(html`<div key=${row.id} class="tk-abs tk-sec" style=${{ top: model.offsets[i] }} role="presentation"><span>${row.project.name}</span><span class="n">${row.count}</span></div>`);
    else if (selecting) {
      const on = selectedIds.has(row.id);
      out.push(html`<button key=${row.id} type="button" class="tk-abs tk-selrow pressable" style=${{ top: model.offsets[i], height: ROW_H }} role="checkbox" aria-checked=${on} aria-label=${`${on ? "Selected" : "Not selected"}: ${row.task.title}`} onClick=${() => { haptic("light"); onToggle(row.id); }}>
        <span class=${cx("tk-check", on && "on")}><${Icon} name="checkmark" size=${13} weight=${3.2} /></span>
        <${TaskRow} task=${row.task} />
      </button>`);
    } else out.push(html`<div key=${row.id} class="tk-abs" style=${{ top: model.offsets[i] }}><${TaskButton} task=${row.task} /></div>`);
  }
  return html`<div ref=${hostRef} class="tk-list" style=${{ height: model.total }} role="list" aria-label="All tasks">
    ${stickyHead?.kind === "head" ? html`<div class="tk-sticky" aria-hidden="true"><div class="tk-sec"><span>${stickyHead.project.name}</span><span class="n">${stickyHead.count}</span></div></div>` : null}
    ${out}
  </div>`;
}

/** Route "allTasks": the windowed list on its own page, with Select mode. */
export function AllTasksView() {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const scrollRef = useRef();
  const toggleId = (id) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const fileSelected = () => {
    const n = selectedIds.size;
    store.archiveTasks([...selectedIds]);
    setSelectedIds(new Set()); setSelecting(false);
    haptic("success");
    nav.toast(`Filed ${pluralize(n, "task")} to the archive`, { icon: "archivebox" });
  };
  const footer = selecting && selectedIds.size > 0 ? html`<div class="tk-filebar pushed"><button type="button" class="pressable" onClick=${fileSelected}><${Icon} name="archivebox" size=${15} weight=${2.4} />File ${selectedIds.size} to archive</button></div>` : null;
  return html`<${Screen} title="All tasks" back contentClass="tk-pushed" scrollRef=${scrollRef} footer=${footer}
    trailing=${html`<button type="button" class=${cx("tk-select pressable", selecting && "on")} style=${{ height: 34 }} aria-pressed=${selecting} onClick=${() => { haptic("light"); setSelecting((v) => { if (v) setSelectedIds(new Set()); return !v; }); }}>${selecting ? "Done" : "Select"}</button>`}>
    <${AllTasksList} scrollRef=${scrollRef} selecting=${selecting} selectedIds=${selectedIds} onToggle=${toggleId} pushed />
  </${Screen}>`;
}

// ---------------------------------------------------------- archive

/** Everything ever filed, one tap to restore. Nothing here is deleted — it is simply out of the way. */
export function ArchiveView() {
  const s = useObservable(store);
  const scrollRef = useRef();
  const hostRef = useRef();
  const projects = useMemo(() => s.projects.filter((p) => s.archivedProjects.has(p.id)), [s.projects, s.archivedCount, s.orderedProjects]);
  const tasks = useMemo(() => s.tasks.filter((t) => s.archivedTasks.has(t.id) && !s.archivedProjects.has(t.room)), [s.tasks, s.archivedCount, s.orderedProjects]);
  const offsets = useMemo(() => tasks.map((_, i) => i * ROW_PITCH), [tasks]);
  const [start, end] = useScrollWindow(scrollRef, hostRef, offsets);
  const restoreProject = (p) => { haptic("success"); s.restoreProject(p.id); nav.toast(`${p.name} is back on the floor`, { icon: "arrow.uturn.left" }); };
  const restoreTask = (t) => { haptic("success"); s.restoreTask(t.id); nav.toast(`Restored ${t.title}`, { icon: "arrow.uturn.left" }); };
  const rows = [];
  for (let i = start; i < end; i++) {
    const t = tasks[i];
    rows.push(html`<div key=${t.id} class="tk-abs hstack" style=${{ top: offsets[i], gap: 8 }}>
      <div class="grow"><${TaskRow} task=${t} showProject /></div>
      <button type="button" class="tk-restore pressable" onClick=${() => restoreTask(t)} aria-label=${`Restore ${t.title}`}>Restore</button>
    </div>`);
  }
  return html`<${Screen} title="Archive" back contentClass="tk-pushed" scrollRef=${scrollRef}>
    <p class="t-sm muted" style=${{ marginTop: 8, lineHeight: 1.4 }}>Filed to keep the desk clear. Search finds all of it; restore brings a project back to the floor.</p>
    ${!projects.length && !tasks.length ? html`<${Empty} icon="archivebox" title="Nothing filed yet" body="Shipped work files itself here — searchable, restorable, never deleted." />` : null}
    ${projects.length ? html`
      <${EyebrowRow} label=${`ARCHIVED PROJECTS · ${projects.length}`} />
      <div class="vstack" style=${{ gap: 9, marginTop: 10 }} role="list">
        ${projects.map((p) => html`<div key=${p.id} class="tk-archrow" role="listitem">
          <span class="ic"><${Icon} name="archivebox" size=${14} /></span>
          <div class="grow" style=${{ minWidth: 0 }}><div class="nm">${p.name}</div><div class="ar">${p.area}${s.neverFileProjects.has(p.id) ? " · never auto-files" : ""}</div></div>
          <button type="button" class="tk-restore pressable" onClick=${() => restoreProject(p)} aria-label=${`Restore ${p.name}`}>Restore</button>
        </div>`)}
      </div>` : null}
    ${tasks.length ? html`
      <${EyebrowRow} label=${`ARCHIVED TASKS · ${tasks.length}`} />
      <div ref=${hostRef} class="tk-list" style=${{ height: Math.max(0, tasks.length * ROW_PITCH - 10), marginTop: 10 }} role="list">${rows}</div>` : null}
  </${Screen}>`;
}
