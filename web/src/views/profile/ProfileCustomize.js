// A port of `Sources/ProfileCustomize.swift` — the profile is yours to
// arrange: every stat block is a module you can show, hide, and reorder.
// Persisted as two strings (`profile.order`, `profile.hidden`) so the layout
// survives relaunches and future modules append gracefully.
import { html, cx, useState, useRef, haptic } from "../../ui.js";
import { Screen, Icon, Toggle, AvatarChip, Button } from "../../components.js";
import { prefs } from "../../prefs.js";
import { agentColor } from "../../models.js";
import { ctx, profileLayout } from "./shared.js";

export const PROFILE_MODULES = [
  { id: "rings", label: "Steer · Answer · Ship rings", symbol: "circle.circle" },
  { id: "insights", label: "Insights", symbol: "sparkle" },
  { id: "week", label: "Shipped by day", symbol: "chart.bar" },
  { id: "trends", label: "Trends", symbol: "arrow.up.right" },
  { id: "records", label: "Records", symbol: "flag.checkered" },
  { id: "streak", label: "Steering streak", symbol: "flame" },
  { id: "badges", label: "Badges", symbol: "rosette" },
];
const ALL = PROFILE_MODULES.map((m) => m.id);
const CLINE_PICK = "rings,week,streak,insights,records,trends,badges";

export const ProfileModule = {
  all: ALL,
  defaultOrder: ALL.join(","),
  byId: (id) => PROFILE_MODULES.find((m) => m.id === id),
  /** Parse a stored order, appending any modules the stored string predates. */
  order(raw) {
    const seen = String(raw ?? "").split(",").filter((id) => ALL.includes(id));
    for (const id of ALL) if (!seen.includes(id)) seen.push(id);
    return seen;
  },
  hidden(raw) { return new Set(String(raw ?? "").split(",").filter((id) => ALL.includes(id))); },
};

export function readProfileLayout() {
  return { order: ProfileModule.order(prefs.get("profile.order", ProfileModule.defaultOrder)), hidden: ProfileModule.hidden(prefs.get("profile.hidden", "")) };
}

export function writeProfileLayout(order, hidden) {
  prefs.set("profile.order", order.join(","));
  prefs.set("profile.hidden", [...hidden].sort().join(","));
  profileLayout.emit();
}

/** Choose and arrange the stats you actually want to see — with a one-tap
 *  "Cline's pick" if you'd rather be suggested a layout. */
export function CustomizeProfileView({ params = {}, route }) {
  const initial = readProfileLayout();
  const [order, setOrder] = useState(initial.order);
  const [hidden, setHidden] = useState(initial.hidden);
  const [clinePicked, setClinePicked] = useState(false);
  const [drag, setDrag] = useState(null); // { id, from, index, dy }
  const listRef = useRef();
  const dragRef = useRef(null);

  const persist = (o = order, h = hidden) => writeProfileLayout(o, h);
  const leave = () => { persist(); if (route?.detent) ctx.nav.dismiss(); else if (params.onBack) params.onBack(); else ctx.nav.pop(); };

  const setShown = (id, shown) => {
    const next = new Set(hidden);
    if (shown) next.delete(id); else next.add(id);
    setHidden(next); persist(order, next);
  };
  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next); persist(next, hidden);
    haptic("light");
  };

  // Press-and-drag the grip: rows shift live; the layout persists on release.
  const rowHeight = () => listRef.current?.firstElementChild?.offsetHeight ?? 56;
  const onGripDown = (e, id) => {
    const from = order.indexOf(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { id, from, index: from, y: e.clientY, order: [...order] };
    setDrag({ id, from, index: from, dy: 0 });
    haptic("medium");
  };
  const onGripMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dy = e.clientY - d.y;
    const h = rowHeight();
    const index = Math.max(0, Math.min(order.length - 1, d.from + Math.round(dy / h)));
    if (index !== d.index) {
      const next = [...d.order];
      const [item] = next.splice(d.from, 1);
      next.splice(index, 0, item);
      d.index = index;
      setOrder(next);
    }
    setDrag({ id: d.id, from: d.from, index, dy });
  };
  const onGripUp = () => {
    const d = dragRef.current; if (!d) return;
    dragRef.current = null;
    setDrag(null);
    const next = [...d.order];
    const [item] = next.splice(d.from, 1);
    next.splice(d.index, 0, item);
    setOrder(next); persist(next, hidden);
  };

  const reset = () => { setOrder([...ALL]); setHidden(new Set()); setClinePicked(false); persist([...ALL], new Set()); };
  const clinePick = () => { const o = ProfileModule.order(CLINE_PICK); setOrder(o); setHidden(new Set()); setClinePicked(true); persist(o, new Set()); haptic("success"); };

  const h = rowHeight();
  return html`<${Screen} title="Customize profile"
    leading=${html`<${Button} variant="ghost" size="sm" onClick=${reset}>Reset</${Button}>`}
    trailing=${html`<${Button} variant="ghost" size="sm" onClick=${leave} style=${{ fontWeight: 800 }}>Done</${Button}>`}>
    <div class="card" style=${{ overflow: "hidden", padding: 0, marginTop: 8 }} ref=${listRef} role="list" aria-label="Profile modules">
      ${order.map((id, i) => {
        const m = ProfileModule.byId(id);
        const dragging = drag?.id === id;
        const style = dragging ? { transform: `translateY(${drag.dy - (drag.index - drag.from) * h}px)` } : undefined;
        return html`<div key=${id} class=${cx("pf-mod", dragging && "dragging")} style=${style} role="listitem">
          <span class="pf-mod-icon"><${Icon} name=${m.symbol} size=${15} weight=${2.4} /></span>
          <span class="pf-mod-label">${m.label}</span>
          <div class="pf-arrows" aria-hidden=${drag != null}>
            <button type="button" aria-label=${`Move ${m.label} up`} disabled=${i === 0} onClick=${() => move(i, i - 1)}><${Icon} name="chevron.up" size=${13} weight=${2.6} /></button>
            <button type="button" aria-label=${`Move ${m.label} down`} disabled=${i === order.length - 1} onClick=${() => move(i, i + 1)}><${Icon} name="chevron.down" size=${13} weight=${2.6} /></button>
          </div>
          <${Toggle} checked=${!hidden.has(id)} onChange=${(v) => setShown(id, v)} label=${m.label} />
          <span class="pf-grip" role="button" aria-label=${`Reorder ${m.label}`} title="Drag to reorder"
            onPointerDown=${(e) => onGripDown(e, id)} onPointerMove=${onGripMove} onPointerUp=${onGripUp} onPointerCancel=${onGripUp}>
            <${Icon} name="line.3.horizontal" size=${18} weight=${2} />
          </span>
        </div>`;
      })}
    </div>
    <div class="t-xs muted" style=${{ padding: "8px 4px 0", lineHeight: 1.4 }}>Drag to reorder. Everything stays on this device.</div>

    <div class="card" style=${{ overflow: "hidden", padding: 0, marginTop: 22 }}>
      <button type="button" class="pf-cline-row pressable" onClick=${clinePick}>
        <${AvatarChip} letter="C" color=${agentColor("coder")} size=${26} />
        <div class="grow">
          <div class="t-md w7" style=${{ fontSize: 14 }}>Ask Cline for a layout</div>
          <div class="t-xs muted" style=${{ marginTop: 1 }}>${clinePicked ? "Cline's pick applied — momentum first: rings, week, streak." : "Suggests an arrangement from what you check most."}</div>
        </div>
      </button>
    </div>
  </${Screen}>`;
}
