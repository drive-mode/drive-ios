// Everything the agents produce — a port of `Sources/ArtifactsView.swift`.
// Organized any way you think: by project, repo, day, or type; filtered by
// kind, size, and lifespan; sorted in one tap. Purpose decides lifespan:
// ephemeral artifacts carry a TTL and file themselves into the archive;
// permanent ones keep until superseded. One pass over the gallery per render.
import { html, cx, useState, useMemo, useObservable, useLongPress, haptic } from "../../ui.js";
import { nav } from "../../nav.js";
import { Icon, AvatarChip, Screen, Empty } from "../../components.js";
import { ARTIFACT_KINDS, ARTIFACT_META, lifeBadge, lifeSymbol, sizeLabel, permanent, ephemeral } from "../../models.js";
import { shareText } from "./shared.js";

let store = null;
export function bindArtifactsStore(s) { store = s; }

const GROUPINGS = ["Project", "Repo", "Day", "Type", "None"];
const SIZE_BANDS = ["Any size", "< 100 KB", "100 KB – 1 MB", "> 1 MB"];
const LIFE_FILTERS = ["Any life", "Permanent", "Ephemeral"];
const SORTS = ["Newest", "Largest", "A–Z"];

export const shareLine = (a) => `${a.title} — ${a.meta} · ${a.room}`;

/** Context-menu items shared by the gallery card and the Home rail. */
export function artifactMenuItems(a, { lifecycle = true } = {}) {
  const items = [
    { label: "Open in session", icon: "waveform", onSelect: () => store.joinCall() },
    { label: "Share", icon: "square.and.arrow.up", onSelect: () => shareText(shareLine(a)) },
  ];
  if (!lifecycle) return items;
  if (a.life.permanent) {
    items.push({ label: "Make ephemeral · 7d", icon: "hourglass", onSelect: () => store.setArtifactLife(a.id, ephemeral(7)) });
    items.push({ label: "Make ephemeral · 30d", icon: "hourglass.bottomhalf.filled", onSelect: () => store.setArtifactLife(a.id, ephemeral(30)) });
  } else items.push({ label: "Mark permanent", icon: "infinity", onSelect: () => store.setArtifactLife(a.id, permanent()) });
  return items;
}

// ---------------------------------------------------------- pipeline

/** One pass: counts per kind, filters, sort, grouping. */
function buildGallery(artifacts, { kindFilter, grouping, sizeBand, lifeFilter, sort }) {
  const out = { sections: [], kindCounts: {}, total: artifacts.length, visible: 0 };
  const items = [];
  for (const a of artifacts) {
    out.kindCounts[a.kind] = (out.kindCounts[a.kind] ?? 0) + 1;
    if (kindFilter && a.kind !== kindFilter) continue;
    if (sizeBand === "< 100 KB" && a.sizeKB >= 100) continue;
    if (sizeBand === "100 KB – 1 MB" && (a.sizeKB < 100 || a.sizeKB >= 1024)) continue;
    if (sizeBand === "> 1 MB" && a.sizeKB < 1024) continue;
    if (lifeFilter === "Permanent" && !a.life.permanent) continue;
    if (lifeFilter === "Ephemeral" && a.life.permanent) continue;
    items.push(a);
  }
  if (sort === "Largest") items.sort((a, b) => b.sizeKB - a.sizeKB);
  else if (sort === "A–Z") items.sort((a, b) => a.title.localeCompare(b.title));
  out.visible = items.length;
  const key = grouping === "Repo" ? (a) => a.repo : grouping === "Day" ? (a) => a.day : grouping === "Type" ? (a) => `${a.kind}s` : grouping === "Project" ? (a) => a.room : null;
  if (!key) { out.sections = [{ header: "", items }]; return out; }
  const order = [], buckets = new Map();
  for (const a of items) { const k = key(a); if (!buckets.has(k)) { order.push(k); buckets.set(k, []); } buckets.get(k).push(a); }
  out.sections = order.map((h) => ({ header: h, items: buckets.get(h) }));
  return out;
}

// -------------------------------------------------------------- view

export function ArtifactsView() {
  const s = useObservable(store);
  const [kindFilter, setKindFilter] = useState(null);
  const [grouping, setGrouping] = useState("Project");
  const [sizeBand, setSizeBand] = useState("Any size");
  const [lifeFilter, setLifeFilter] = useState("Any life");
  const [sort, setSort] = useState("Newest");
  // Lifecycle edits mutate artifacts in place; a cheap signature keeps the memo honest.
  const lifeSig = s.artifacts.map((a) => (a.life.permanent ? "p" : a.life.daysLeft)).join(",");
  const model = useMemo(() => buildGallery(s.artifacts, { kindFilter, grouping, sizeBand, lifeFilter, sort }), [s.artifacts, s.artifacts.length, lifeSig, kindFilter, grouping, sizeBand, lifeFilter, sort]);

  if (!s.artifacts.length) {
    return html`<${Screen} title="Artifacts" back contentClass="tk-pushed">
      <${Empty} icon="tray" title="No artifacts yet" body=${s.configuration.previewContentEnabled ? "Plans, diffs, reports and replays land here as agents publish them." : "Artifacts arrive from the writer once a room is live. Nothing is seeded in this build."} />
    </${Screen}>`;
  }

  return html`<${Screen} title="Artifacts" back contentClass="tk-pushed">
    <div class="tk-hscroll tk-chips" role="tablist" aria-label="Filter by kind">
      <${KindChip} kind=${null} label=${`All · ${model.total}`} selected=${kindFilter === null} onSelect=${() => setKindFilter(null)} />
      ${ARTIFACT_KINDS.map((k) => (model.kindCounts[k] ? html`<${KindChip} key=${k} kind=${k} label=${`${k} · ${model.kindCounts[k]}`} selected=${kindFilter === k} onSelect=${() => setKindFilter(k)} />` : null))}
    </div>
    <div class="tk-hscroll tk-ctl" role="group" aria-label="Group, filter and sort">
      <${MenuPill} icon="square.grid.2x2" value=${grouping} options=${GROUPINGS} prefix="By" onChange=${setGrouping} title="Group by" />
      <${MenuPill} icon="server.rack" value=${sizeBand} options=${SIZE_BANDS} onChange=${setSizeBand} title="Size" />
      <${MenuPill} icon="hourglass" value=${lifeFilter} options=${LIFE_FILTERS} onChange=${setLifeFilter} title="Lifespan" />
      <${MenuPill} icon="arrow.up.arrow.down" value=${sort} options=${SORTS} onChange=${setSort} title="Sort" />
    </div>
    ${model.sections.map((sec) => html`<div key=${sec.header || "all"}>
      ${sec.header ? html`<div class="tk-sechead"><span>${sec.header}</span><span class="tk-n">${sec.items.length}</span></div>` : null}
      <div class="tk-agrid" role="list">${sec.items.map((a) => html`<${ArtifactCard} key=${a.id} artifact=${a} />`)}</div>
    </div>`)}
    ${model.visible === 0 ? html`<div class="tk-nomatch"><${Icon} name="tray" size=${26} weight=${1.4} color="var(--ink-35)" />Nothing matches those filters</div>` : null}
    <p class="tk-note">Ephemeral artifacts file to the archive when their TTL passes — searchable, never deleted. Permanent ones keep until superseded.</p>
  </${Screen}>`;
}

function KindChip({ kind, label, selected, onSelect }) {
  const tint = kind ? ARTIFACT_META[kind].tint : "var(--violet)";
  return html`<button type="button" role="tab" aria-selected=${selected} class=${cx("tk-chip pressable", selected && "tk-on")} style=${{ "--tint": tint }} onClick=${() => { if (!selected) { haptic("light"); onSelect(); } }}>
    ${kind ? html`<${Icon} name=${ARTIFACT_META[kind].symbol} size=${12} weight=${2.4} />` : null}${label}
  </button>`;
}

/** Menu pill: the Swift `Menu { Picker }` — opens a checked menu at the pill. */
function MenuPill({ icon, value, options, prefix, onChange, title }) {
  const neutral = value.startsWith("Any") || value === "Newest" || value === "None";
  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    nav.openMenu({ x: r.left, y: r.bottom, title, items: options.map((o) => ({ label: o, checked: o === value, onSelect: () => onChange(o) })) });
  };
  return html`<button type="button" class=${cx("tk-mpill pressable", !neutral && "tk-set")} aria-haspopup="menu" aria-label=${`${title}: ${value}`} onClick=${(e) => { haptic("light"); open(e); }}>
    <${Icon} name=${icon} size=${11} weight=${2.4} />${prefix ? `${prefix} ${value.toLowerCase()}` : value}<${Icon} name="chevron.down" size=${9} weight=${3} />
  </button>`;
}

export function ArtifactCard({ artifact: a }) {
  const meta = ARTIFACT_META[a.kind];
  const eph = !a.life.permanent;
  const lp = useLongPress((e, pt) => nav.openMenu({ x: pt.x, y: pt.y, title: a.title, items: artifactMenuItems(a) }), { onClick: () => { haptic("light"); nav.push("artifact", { id: a.id }); } });
  return html`<button type="button" role="listitem" class="tk-art pressable" style=${{ "--tint": meta.tint }} ...${lp}
    aria-label=${`${a.kind}: ${a.title}, ${a.room}, ${sizeLabel(a.sizeKB)}, ${a.life.permanent ? "permanent" : `ephemeral, ${lifeBadge(a.life)}`}`} title="Opens the artifact. Long press for lifecycle options.">
    <div class="tk-top"><span class="tk-kind"><${Icon} name=${meta.symbol} size=${15} weight=${2.3} /></span><span class="tk-age">${a.age}</span></div>
    <div class="tk-title">${a.title}</div>
    <div class="tk-art-meta">${a.meta}</div>
    <div class="tk-who"><${AvatarChip} letter=${a.agentName.charAt(0)} color=${a.agentColor} size=${16} /><span>${a.room}</span></div>
    <div class="tk-art-foot">
      <span class="tk-size">${sizeLabel(a.sizeKB)}</span>
      <span class=${cx("tk-life", eph && "tk-eph")}><${Icon} name=${lifeSymbol(a.life)} size=${9} weight=${2.8} />${lifeBadge(a.life)}</span>
    </div>
  </button>`;
}

/** The Home rail — the freshest work products, one swipe deep (exported for the Home port). */
export function ArtifactRail() {
  const s = useObservable(store);
  if (!s.artifacts.length) return null;
  return html`<div>
    <div class="hstack" style=${{ justifyContent: "space-between" }}>
      <div class="eyebrow">ARTIFACTS</div>
      <button type="button" class="pressable hstack t-sm w7" style=${{ color: "var(--violet-text)", gap: 4, minHeight: 32 }} onClick=${() => { haptic("light"); nav.push("artifacts"); }}>All ${s.artifacts.length}<${Icon} name="chevron.right" size=${10} weight=${3} /></button>
    </div>
    <div class="tk-hscroll" style=${{ marginTop: 10, gap: 9 }} role="list">
      ${s.artifacts.slice(0, 6).map((a) => html`<${RailCard} key=${a.id} artifact=${a} />`)}
    </div>
  </div>`;
}

function RailCard({ artifact: a }) {
  const meta = ARTIFACT_META[a.kind];
  const lp = useLongPress((e, pt) => nav.openMenu({ x: pt.x, y: pt.y, preview: html`<${RailPeek} artifact=${a} />`, items: artifactMenuItems(a, { lifecycle: false }) }), { onClick: () => { haptic("light"); nav.push("artifact", { id: a.id }); } });
  return html`<button type="button" role="listitem" class="tk-railcard pressable" style=${{ "--tint": meta.tint }} ...${lp} aria-label=${`${a.kind}: ${a.title}, ${a.room}, ${a.age} ago`}>
    <div class="hstack" style=${{ gap: 6 }}>
      <${Icon} name=${meta.symbol} size=${12} weight=${2.4} color=${meta.tint} /><span class="eyebrow" style=${{ fontSize: 8.5, letterSpacing: .8, color: meta.tint }}>${a.kind}</span>
      <span class="grow" />${!a.life.permanent ? html`<${Icon} name="hourglass" size=${9} weight=${2.8} color="var(--tint-amber)" />` : null}
    </div>
    <div class="clamp2 w7" style=${{ fontSize: 12.5, lineHeight: 1.25 }}>${a.title}</div>
    <div class="truncate" style=${{ fontSize: 9.5, color: "var(--ink-55)" }}>${a.room} · ${a.age}</div>
  </button>`;
}

function RailPeek({ artifact: a }) {
  const meta = ARTIFACT_META[a.kind];
  return html`<div class="tk-peek" style=${{ "--tint": meta.tint }}>
    <div class="hstack" style=${{ gap: 10 }}>
      <span class="tk-kind" style=${{ width: 36, height: 36, borderRadius: 10 }}><${Icon} name=${meta.symbol} size=${16} weight=${2.3} /></span>
      <div class="grow" style=${{ minWidth: 0 }}><div class="w8" style=${{ fontSize: 15 }}>${a.title}</div><div class="mono" style=${{ fontSize: 11, color: meta.tint }}>${a.meta}</div></div>
    </div>
    <div class="hstack" style=${{ gap: 8, marginTop: 10 }}>
      <${AvatarChip} letter=${a.agentName.charAt(0)} color=${a.agentColor} size=${20} />
      <span class="grow t-xs muted truncate" style=${{ fontSize: 11.5 }}>${a.agentName} · ${a.room} · ${a.age} ago</span>
      <span class="t-xs w8" style=${{ color: a.life.permanent ? "var(--ink-55)" : "var(--tint-amber)", fontSize: 10 }}>${lifeBadge(a.life)}</span>
    </div>
  </div>`;
}
