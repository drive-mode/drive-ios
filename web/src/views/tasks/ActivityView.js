// The Today section, unfolded — a port of `Sources/ActivityView.swift`.
// This week, this month, this year (the GitHub-style contribution wall), or
// your own range — tap any day to see what shipped and which projects it fed.
// Columns and month labels come precomputed from `activityDemo()`; a tap
// re-renders this view and must not re-derive the year.
import { html, cx, useState, useEffect, useMemo, useRef, useObservable, haptic } from "../../ui.js";
import { nav } from "../../nav.js";
import { Icon, Screen, Card, Empty } from "../../components.js";
import { activityDemo } from "../../models.js";
import { ModeToggle } from "./shared.js";

let store = null;
export function bindActivityStore(s) { store = s; }

const DAY_MS = 86_400_000;
const RANGES = ["Week", "Month", "Year", "Custom"];
const fmtLong = new Intl.DateTimeFormat([], { weekday: "long", month: "long", day: "numeric" });
const fmtShort = new Intl.DateTimeFormat([], { month: "short", day: "numeric" });
const fmtNarrow = new Intl.DateTimeFormat([], { weekday: "narrow" });
const fmtMonthYear = new Intl.DateTimeFormat([], { month: "long", year: "numeric" });
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fromIso = (s) => { const [y, m, d] = String(s).split("-").map(Number); return y && m && d ? new Date(y, m - 1, d).getTime() : NaN; };

/** GitHub-style: darker = more. 0 = nothing shipped; 1–4 scale to the busiest day. */
export const heatLevel = (ships, maxShips) => (ships > 0 && maxShips > 0 ? Math.max(1, Math.min(4, Math.ceil((ships / maxShips) * 4))) : 0);
const shipsLabel = (day) => `${day.ships} ship${day.ships === 1 ? "" : "s"} on ${fmtShort.format(day.date)}`;

const EMPTY = { days: [], yearColumns: [], yearMonthLabels: [], maxDailyShips: 1 };

export function ActivityView() {
  const s = useObservable(store);
  const preview = s.configuration.previewContentEnabled;
  const demo = useMemo(() => (preview ? activityDemo() : EMPTY), [preview]);
  const { days } = demo;
  const [range, setRange] = useState("Week");
  const [selectedDayId, setSelectedDayId] = useState(0);
  const today = startOfDay(Date.now());
  const [customFrom, setCustomFrom] = useState(today - 13 * DAY_MS);
  const [customTo, setCustomTo] = useState(today);

  const monthRecords = useMemo(() => { const n = new Date(); return days.filter((d) => { const x = new Date(d.date); return x.getMonth() === n.getMonth() && x.getFullYear() === n.getFullYear(); }); }, [days]);
  const customRecords = useMemo(() => days.filter((d) => d.date >= customFrom && d.date <= customTo), [days, customFrom, customTo]);

  const changeRange = (r) => { setRange(r); setSelectedDayId(r === "Week" ? 0 : null); };
  const toggleDay = (id) => setSelectedDayId((cur) => (cur === id ? null : id));

  const breakdown = useMemo(() => {
    const day = selectedDayId != null ? days.find((d) => d.id === selectedDayId) : null;
    if (day) return { title: fmtLong.format(day.date), records: [day] };
    if (!days.length) return null;
    switch (range) {
      case "Week": return { title: "Last 7 days", records: days.slice(0, 7) };
      case "Month": return { title: "This month", records: monthRecords };
      case "Year": return { title: "Last 12 months", records: days };
      default: return { title: "Custom range", records: customRecords };
    }
  }, [selectedDayId, range, days, monthRecords, customRecords]);

  return html`<${Screen} title="Activity" back contentClass="tk-pushed">
    <div style=${{ marginTop: 8 }}><${ModeToggle} options=${RANGES} value=${range} onChange=${changeRange} label="Range" /></div>
    ${!days.length ? html`<${Empty} icon="calendar" title="No activity yet" body="Shipping history fills in as agents land work through the writer. Nothing is seeded in this build." />` : html`
      ${range === "Week" ? html`<${WeekBars} days=${days} selectedDayId=${selectedDayId} onToggle=${toggleDay} />`
      : range === "Month" ? html`<${MonthCalendar} records=${monthRecords} selectedDayId=${selectedDayId} onToggle=${toggleDay} />`
      : range === "Year" ? html`<${YearWall} demo=${demo} selectedDayId=${selectedDayId} onSelect=${setSelectedDayId} />`
      : html`<${CustomRange} from=${customFrom} to=${customTo} today=${today} onFrom=${setCustomFrom} onTo=${setCustomTo} records=${customRecords} />`}
      ${breakdown ? html`<${BreakdownCard} title=${breakdown.title} records=${breakdown.records} />` : null}
    `}
  </${Screen}>`;
}

// -------------------------------------------------------------- week

function WeekBars({ days, selectedDayId, onToggle }) {
  const week = days.slice(0, 7).reverse();
  const maxShips = Math.max(1, ...week.map((d) => d.ships));
  return html`<${Card} className="tk-card" hero>
    <div class="eyebrow">SHIPPED · LAST 7 DAYS</div>
    <div class="tk-week" role="group" aria-label="Shipped per day, last 7 days">
      ${week.map((day) => { const on = selectedDayId === day.id; return html`<button key=${day.id} type="button" class=${cx("pressable", on && "tk-on")} aria-pressed=${on} aria-label=${shipsLabel(day)} onClick=${() => { haptic("light"); onToggle(day.id); }}>
        <span class="tk-cnt">${day.ships}</span>
        <span class="tk-week-bar"><i style=${{ height: `${Math.max(5, (day.ships / maxShips) * 100)}%`, minHeight: 5 }} /></span>
        <span class="tk-wd">${fmtNarrow.format(day.date)}</span>
      </button>`; })}
    </div>
  </${Card}>`;
}

// ------------------------------------------------------------- month

function MonthCalendar({ records, selectedDayId, onToggle }) {
  const monthDays = useMemo(() => [...records].sort((a, b) => a.date - b.date), [records]);
  const maxShips = Math.max(1, ...monthDays.map((d) => d.ships));
  const firstWeekday = monthDays.length ? new Date(monthDays[0].date).getDay() : 0;
  return html`<${Card} className="tk-card" hero>
    <div class="eyebrow">${fmtMonthYear.format(new Date()).toUpperCase()}</div>
    <div class="tk-month" role="grid" aria-label="This month">
      ${["S", "M", "T", "W", "T", "F", "S"].map((h, i) => html`<div key=${`h${i}`} class="tk-h" role="columnheader">${h}</div>`)}
      ${Array.from({ length: firstWeekday }, (_, i) => html`<div key=${`b${i}`} style=${{ height: 34 }} />`)}
      ${monthDays.map((day) => { const on = selectedDayId === day.id; return html`<button key=${day.id} type="button" role="gridcell" class=${cx("tk-day pressable", on && "tk-on")} aria-pressed=${on} aria-label=${shipsLabel(day)} onClick=${() => { haptic("light"); onToggle(day.id); }}>
        <span>${new Date(day.date).getDate()}</span><i class=${`tk-heat-${heatLevel(day.ships, maxShips)}`} />
      </button>`; })}
    </div>
  </${Card}>`;
}

// -------------------------------------------------------------- year

function YearWall({ demo, selectedDayId, onSelect }) {
  const total = useMemo(() => demo.days.reduce((n, d) => n + d.ships, 0), [demo]);
  return html`<${Card} className="tk-card" hero>
    <div class="hstack" style=${{ justifyContent: "space-between" }}><div class="eyebrow">SHIPPED · LAST 12 MONTHS</div><span class="mono t-xs w7" style=${{ color: "var(--violet-text)", fontSize: 10.5 }}>${total} total</span></div>
    <${ContributionGrid} demo=${demo} selectedDayId=${selectedDayId} onSelect=${onSelect} />
    <div class="tk-scale" aria-hidden="true">Less ${[0, 1, 2, 3, 4].map((l) => html`<i key=${l} class=${`tk-heat-${l}`} />`)} More</div>
  </${Card}>`;
}

/** 52 weeks of squares, weekday rows — scrolls to now; tap a square for that day's breakdown. */
export function ContributionGrid({ demo, selectedDayId, onSelect }) {
  const ref = useRef();
  const { yearColumns: cols, yearMonthLabels: labels, maxDailyShips } = demo;
  useEffect(() => { const el = ref.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  return html`<div ref=${ref} class="tk-wall" role="grid" aria-label="Contribution wall, last 12 months">
    <div class="tk-cols">
      ${cols.map((col, c) => html`<div key=${c} class="tk-col" role="row">
        <span class="tk-ml" aria-hidden="true">${labels[c] ?? " "}</span>
        ${col.map((day, r) => day
          ? html`<button key=${day.id} type="button" role="gridcell" class=${cx("tk-sq", `tk-heat-${heatLevel(day.ships, maxDailyShips)}`, selectedDayId === day.id && "tk-on")} aria-pressed=${selectedDayId === day.id} aria-label=${shipsLabel(day)} onClick=${() => { haptic("light"); onSelect(day.id); }} />`
          : html`<span key=${`e${r}`} class="tk-sq tk-blank" />`)}
      </div>`)}
    </div>
  </div>`;
}

// ------------------------------------------------------------ custom

function CustomRange({ from, to, today, onFrom, onTo, records }) {
  const total = records.reduce((n, d) => n + d.ships, 0);
  return html`<${Card} className="tk-card" hero>
    <div class="eyebrow">CUSTOM RANGE</div>
    <div class="tk-dates">
      <input type="date" class="tk-date" aria-label="From" value=${isoDate(from)} max=${isoDate(to)} onChange=${(e) => { const v = fromIso(e.target.value); if (Number.isFinite(v) && v <= to) onFrom(v); }} />
      <${Icon} name="arrow.right" size=${12} weight=${2.4} color="var(--ink-35)" />
      <input type="date" class="tk-date" aria-label="To" value=${isoDate(to)} min=${isoDate(from)} max=${isoDate(today)} onChange=${(e) => { const v = fromIso(e.target.value); if (Number.isFinite(v) && v >= from && v <= today) onTo(v); }} />
    </div>
    <div class="tk-range-sum" aria-live="polite">${total} shipped across ${records.length} day${records.length === 1 ? "" : "s"}</div>
  </${Card}>`;
}

// --------------------------------------------------------- breakdown

/** Where the work went: totals plus per-project split, status-hub style. */
export function BreakdownCard({ title, records }) {
  const merged = useMemo(() => {
    const totals = new Map();
    for (const r of records) for (const { name, count } of r.byProject) totals.set(name, (totals.get(name) ?? 0) + count);
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [records]);
  const total = records.reduce((n, r) => n + r.ships, 0);
  const maxCount = Math.max(1, merged[0]?.count ?? 1);
  return html`<${Card} className="tk-card tk-bd fade-in" hero key=${title}>
    <div class="tk-bdhead"><span class="tk-ttl">${title}</span><span class="tk-tot">${total} shipped</span></div>
    <div class="tk-rows" role="list">
      ${merged.slice(0, 8).map((slice) => html`<button key=${slice.name} type="button" role="listitem" class="tk-brow pressable" aria-label=${`${slice.name}, ${slice.count} shipped. Opens the project map.`} onClick=${() => { haptic("light"); nav.push("projectMap", { projectId: slice.name }); }}>
        <span class="tk-nm">${slice.name}</span>
        <span class="tk-brow-bar"><i style=${{ width: `${Math.max(3, (slice.count / maxCount) * 100)}%` }} /></span>
        <span class="tk-n">${slice.count}</span>
        <${Icon} name="chevron.right" size=${10} weight=${2.6} color="var(--ink-35)" />
      </button>`)}
      ${!merged.length ? html`<div class="t-sm muted">Nothing shipped in this range.</div>` : null}
    </div>
  </${Card}>`;
}
