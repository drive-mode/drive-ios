// The Spotlight — a port of `Sources/SpotlightDirector.swift`.
// The Director choreographs typed work events into beats; a temporary
// Presenter title grants an agent publishing rights. Nothing here is a pixel
// stream: every stage is rendered from a typed step list.
//
// Two cadences, exactly like the Swift `TimelineView` split: only the rail
// fill and the stage ride the 30fps clock (`useFrame30`, scoped to those two
// leaves). The chrome — header, caption, gestures, the VoiceOver value —
// changes at beat boundaries and rides a 4 Hz tick.
import { html, cx, useState, useEffect, useLayoutEffect, useRef, useReducer, useTick, useObservable, haptic, reducedMotion } from "../../ui.js";
import { Icon, Waveform } from "../../components.js";
import { BEAT_TINT } from "../../models.js";
import { injectStyle, CheckCircle } from "./shared.js";

let boundStore = null;
/** Called once by registerWork; other clusters that import <Spotlight/> get the same store. */
export function bindSpotlight({ store }) { boundStore = store; }
const getStore = () => boundStore ?? window.drive?.store;

injectStyle("work-css-spotlight", `
.spotlight { position: relative; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--well);
  border-radius: var(--r-hero); box-shadow: inset 0 0 0 0.8px var(--hairline); outline: none; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
.spotlight.theater { border-radius: 0; box-shadow: none; }
.spotlight:focus-visible { box-shadow: inset 0 0 0 2px var(--violet); }
.sp-rail-row { display: flex; align-items: center; gap: 8px; margin: 12px 14px 0; flex: none; }
.sp-rail { display: flex; align-items: center; gap: 4px; height: 5px; flex: 1; min-width: 0; }
.sp-rail > i { flex: 1; height: 3.5px; border-radius: 3px; background: color-mix(in srgb, var(--tint) 30%, transparent); position: relative; overflow: hidden; transition: height .18s var(--ease); }
.sp-rail > i.done { background: color-mix(in srgb, var(--tint) 95%, transparent); }
.sp-rail > i.now { height: 5px; }
.sp-rail > i.now > b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: var(--tint); min-width: 3px; }
.sp-badge { font-family: var(--mono); font-size: 8.5px; font-weight: 800; letter-spacing: .8px; color: var(--ink-35); flex: none; }
.sp-head { display: flex; align-items: center; gap: 9px; padding: 12px 16px 0; min-width: 0; flex: none; }
.sp-kind { font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: .8px; padding: 3.5px 7px; border-radius: 5px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); flex: none; }
.sp-title { font-size: 15px; font-weight: 700; color: var(--ink); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-director { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--ink-55); flex: none; }
.sp-director i { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.sp-stage { flex: 1; min-height: 0; padding: 10px 16px 64px; overflow: hidden; position: relative; }
.spotlight.theater .sp-stage { padding-bottom: 70px; }
.sp-stage-inner { max-width: 560px; height: 100%; }
.sp-zones { position: absolute; left: 0; right: 0; top: 56px; bottom: 0; display: flex; }
.sp-zones > div { flex: 1; }
.sp-caption-wrap { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 12px 12px; pointer-events: none; display: flex; justify-content: center; }
.spotlight.theater .sp-caption-wrap { padding: 0 16px 14px; justify-content: flex-start; }
.sp-caption { display: flex; align-items: center; gap: 11px; padding: 10px 13px; border-radius: var(--r-card); max-width: 100%;
  background: color-mix(in srgb, var(--surface) 92%, transparent); box-shadow: inset 0 0 0 0.8px var(--hairline); font-size: 12.5px; color: var(--ink-78); line-height: 1.3; }
.spotlight.theater .sp-caption { max-width: 420px; }
.sp-caption b { color: var(--violet-text); font-weight: 700; }
.sp-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; color: var(--ink-55); }
.sp-empty .t { font-size: 17px; font-weight: 800; color: var(--ink); }
.sp-empty .b { font-size: 12.5px; max-width: 260px; line-height: 1.4; }
.sp-wire { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.sp-wire .t { font-size: 17px; font-weight: 800; color: var(--ink); }
.sp-wire .d { font-size: 11px; font-weight: 600; color: rgba(var(--ink-rgb), .45); }

/* stage renderers */
.bt { height: 100%; display: flex; flex-direction: column; padding-top: 8px; }
.bt-row { display: flex; align-items: center; gap: 11px; min-width: 0; }
.bt-plan { gap: 12px; }
.bt-ring { width: 21px; height: 21px; border-radius: 50%; border: 1.5px solid rgba(var(--ink-rgb), .25); display: grid; place-items: center; flex: none; color: var(--live); }
.bt-ring.active { border-color: rgba(var(--ink-rgb), .6); }
.bt-ring.done { border-color: var(--live); background: color-mix(in srgb, var(--live) 18%, transparent); }
.bt-ring .pdot { width: 7px; height: 7px; border-radius: 50%; background: var(--violet); }
.bt-plan .txt { flex: 1; min-width: 0; font-size: 14.5px; color: rgba(var(--ink-rgb), .45); line-height: 1.3; }
.bt-plan .txt.on { color: rgba(var(--ink-rgb), .92); }
.bt-plan .txt.active { font-weight: 600; }
.bt-now { font-family: var(--mono); font-size: 8.5px; font-weight: 800; color: var(--violet-text); flex: none; }
.bt-diagram { justify-content: center; align-items: center; padding: 0; }
.bt-chain { display: flex; align-items: center; justify-content: center; }
.bt-chain.v { flex-direction: column; }
.bt-node { font-family: var(--mono); font-size: 12.5px; font-weight: 600; padding: 8px 12px; border-radius: var(--r-control); background: var(--surface);
  color: rgba(var(--ink-rgb), .5); box-shadow: inset 0 0 0 0.8px rgba(var(--ink-rgb), .12); white-space: nowrap; transition: color .2s, box-shadow .2s; }
.bt-node.lit { color: rgba(var(--ink-rgb), .92); box-shadow: inset 0 0 0 0.8px rgba(var(--ink-rgb), .30); }
.bt-node.new { color: var(--violet-text); background: color-mix(in srgb, var(--violet) 16%, transparent); box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 50%, transparent); }
.bt-node.new.lit { box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 90%, transparent), 0 0 20px color-mix(in srgb, var(--violet) 35%, transparent); }
.bt-conn { background: rgba(var(--ink-rgb), .15); flex: none; transition: background .2s; }
.bt-conn.h { width: 22px; height: 1.5px; } .bt-conn.v { width: 1.5px; height: 16px; }
.bt-conn.active { background: color-mix(in srgb, var(--live) 80%, transparent); }
.bt-code { gap: 5px; align-items: flex-start; }
.bt-code .line { font-family: var(--mono); font-size: 13.5px; color: rgba(var(--ink-rgb), .55); white-space: pre-wrap; word-break: break-word; line-height: 1.35; animation: fadeIn .18s var(--ease); }
.bt-code .line.added { color: var(--live); }
.bt-code .line.first { color: rgba(var(--ink-rgb), .92); }
.bt-code.cmd { gap: 6px; } .bt-code.cmd .line { font-size: 13px; color: rgba(var(--ink-rgb), .5); }
.bt-cursor { width: 7px; height: 15px; background: var(--live); display: block; }
.bt-tests { gap: 11px; }
.bt-tests .txt { flex: 1; min-width: 0; font-family: var(--mono); font-size: 13.5px; color: rgba(var(--ink-rgb), .4); line-height: 1.3; }
.bt-tests .txt.on { color: rgba(var(--ink-rgb), .85); }
.bt-tests .mark { width: 15px; height: 15px; display: grid; place-items: center; flex: none; }
.bt-tests .mark .ring { width: 15px; height: 15px; border-radius: 50%; border: 1.2px solid rgba(var(--ink-rgb), .2); }
.bt-tests .mark .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--live); }
.bt-pass { font-family: var(--mono); font-size: 9px; font-weight: 800; color: color-mix(in srgb, var(--live) 85%, transparent); flex: none; }
.bt-passing { margin-top: auto; font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--live); }
.bt-decision { gap: 12px; }
.bt-opt { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border-radius: var(--r-card); background: var(--surface); box-shadow: inset 0 0 0 0.8px var(--hairline);
  color: rgba(var(--ink-rgb), .7); font-size: 14.5px; transition: background .3s, box-shadow .3s, color .3s; }
.bt-opt .ic { color: rgba(var(--ink-rgb), .3); flex: none; display: grid; }
.bt-opt.chosen { background: color-mix(in srgb, var(--violet) 14%, transparent); box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 80%, transparent); color: rgba(var(--ink-rgb), .95); font-weight: 600; }
.bt-opt.chosen .ic { color: var(--violet-text); }
.bt-opt.dimmed { color: rgba(var(--ink-rgb), .35); }
.bt-decision .note { font-size: 10.5px; color: rgba(var(--ink-rgb), .35); padding-top: 2px; }
.bt-metric { gap: 16px; padding-top: 10px; }
.bt-metric .lbl { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; font-weight: 600; color: rgba(var(--ink-rgb), .6); }
.bt-metric .val { font-family: var(--mono); font-size: 12.5px; font-weight: 700; color: rgba(var(--ink-rgb), .75); }
.bt-metric .val.after { color: var(--live); }
.bt-metric .bar { height: 8px; border-radius: 4px; background: rgba(var(--ink-rgb), .10); margin-top: 6px; overflow: hidden; }
.bt-metric .bar > b { display: block; height: 100%; border-radius: 4px; background: rgba(var(--ink-rgb), .35); min-width: 4px; }
.bt-metric .bar > b.after { background: var(--live); }
.bt-metric .seal { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: rgba(var(--ink-rgb), .85); transition: opacity .3s; }
.bt-metric .seal .ic { color: var(--live); display: grid; }
`);

// ------------------------------------------------------------ clocks

/** rAF, capped at 30fps — the Swift `.animation(minimumInterval: 1/30)` leaf. */
function useFrame30(active = true) {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!active) return undefined;
    let id = 0, last = 0;
    const loop = (t) => { if (t - last >= 33) { last = t; force(); } id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** Reduce Motion keeps information moving (4 Hz) but stills the decoration. */
function useStageClock() {
  const reduced = reducedMotion();
  useFrame30(!reduced);
  useTick(4, reduced);
  return reduced;
}

const tintOf = (beat) => BEAT_TINT[beat.kind] ?? "var(--violet)";

// ---------------------------------------------------------------- rail

/** Kind-colored rail: watched beats at full tint, the current one fills live, upcoming dimmed. */
export function ProgressRail({ beats, index, progress, className }) {
  return html`<div class=${cx("sp-rail", className)} aria-hidden="true">
    ${beats.map((b, i) => html`<i key=${b.id ?? i} class=${cx(i < index && "done", i === index && "now")} style=${{ "--tint": tintOf(b) }}>
      ${i === index ? html`<b style=${{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />` : null}
    </i>`)}
  </div>`;
}

/** The rail leaf: it alone re-renders at 30fps. */
function LiveRail({ beats, position, badge }) {
  useStageClock();
  const pos = position(Date.now());
  return html`<div class="sp-rail-row">
    <${ProgressRail} beats=${beats} index=${pos.index} progress=${pos.progress} />
    ${badge ? html`<span class="sp-badge">${badge}</span>` : null}
  </div>`;
}

// -------------------------------------------------------------- chrome

export function BeatHeader({ beat }) {
  const tint = tintOf(beat);
  const dot = beat.directorColor === "var(--coder)" ? "var(--ink)" : beat.directorColor;
  return html`<div class="sp-head">
    <span class="sp-kind" style=${{ "--tint": tint }}>${beat.kind}</span>
    <span class="sp-title">${beat.title}</span>
    <span class="sp-director"><i style=${{ background: dot }} />${beat.director}</span>
  </div>`;
}

export function BeatCaption({ beat, compact = false }) {
  return html`<div class="sp-caption">
    <${Waveform} color="var(--live)" barCount=${compact ? 4 : 5} height=${14} />
    <span class="clamp2"><b>${beat.director}</b> — ${beat.caption}</span>
  </div>`;
}

// --------------------------------------------------------------- stage

const WIRE_SYMBOL = { PLAN: "list.bullet.rectangle", DIAGRAM: "point.3.connected.trianglepath.dotted", EDIT: "plus.forwardslash.minus", RUN: "terminal", TESTS: "checkmark.diamond", DECISION: "signpost.right", RESULT: "chart.bar.xaxis" };

/** The stage leaf: re-renders at 30fps with the beat's 0..1 progress. */
function LiveStage({ beats, position, horizontal }) {
  const reduced = useStageClock();
  const pos = position(Date.now());
  const beat = beats[pos.index];
  if (!beat) return null;
  return html`<div class="sp-stage-inner"><${BeatStage} beat=${beat} t=${pos.progress} reduced=${reduced} horizontal=${horizontal} /></div>`;
}

export function BeatStage({ beat, t, reduced = false, horizontal = false }) {
  if (!beat.steps?.length) {
    // Wire beats carry structure (kind/title/director/caption); rich stage
    // content arrives via relatedEventIds later.
    return html`<div class="sp-wire">
      <${Icon} name=${WIRE_SYMBOL[beat.kind] ?? "circle.circle"} size=${34} weight=${1.4} color=${tintOf(beat)} style=${{ opacity: 0.5 + 0.5 * Math.min(1, t * 3) }} />
      <div class="t">${beat.title}</div>
      <div class="d">Directed live · ${beat.director}</div>
    </div>`;
  }
  switch (beat.kind) {
    case "PLAN": return html`<${PlanBeat} beat=${beat} t=${t} reduced=${reduced} />`;
    case "DIAGRAM": return html`<${DiagramBeat} beat=${beat} t=${t} horizontal=${horizontal} />`;
    case "EDIT": return html`<${EditBeat} beat=${beat} t=${t} reduced=${reduced} />`;
    case "RUN": return html`<${CommandBeat} beat=${beat} t=${t} />`;
    case "TESTS": return html`<${TestBeat} beat=${beat} t=${t} reduced=${reduced} />`;
    case "DECISION": return html`<${DecisionBeat} beat=${beat} t=${t} />`;
    case "RESULT": return html`<${MetricBeat} beat=${beat} t=${t} />`;
    default: return html`<${PlanBeat} beat=${beat} t=${t} reduced=${reduced} />`;
  }
}

const pulse = (t, k, reduced) => (reduced ? 1 : Math.abs(Math.sin(t * k)));

function PlanBeat({ beat, t, reduced }) {
  const doneCount = beat.accent?.length ?? 0;
  return html`<div class="bt bt-plan">
    ${beat.steps.map((step, i) => {
      const isDone = i < doneCount || (i === doneCount && t > 0.72);
      const isActive = i === doneCount && !isDone;
      const shown = t > i * 0.08;
      return html`<div key=${i} class="bt-row" style=${{ opacity: shown ? 1 : 0, transition: "opacity .2s" }}>
        <span class=${cx("bt-ring", isDone && "done", isActive && "active")}>
          ${isDone ? html`<${Icon} name="checkmark" size=${10} weight=${3.2} />` : isActive ? html`<i class="pdot" style=${{ opacity: 0.4 + 0.6 * pulse(t, 12, reduced) }} />` : null}
        </span>
        <span class=${cx("txt", (isDone || isActive) && "on", isActive && "active")}>${step}</span>
        ${isActive ? html`<span class="bt-now">NOW</span>` : null}
      </div>`;
    })}
  </div>`;
}

function DiagramBeat({ beat, t, horizontal }) {
  const n = beat.steps.length;
  const pulseIndex = t * Math.max(0, n - 1);
  const nodes = [];
  beat.steps.forEach((label, i) => {
    const isNew = beat.accent?.includes(i);
    const lit = pulseIndex >= i - 0.5;
    nodes.push(html`<span key=${`n${i}`} class=${cx("bt-node", isNew && "new", lit && "lit")}>${label}</span>`);
    if (i < n - 1) nodes.push(html`<i key=${`c${i}`} class=${cx("bt-conn", horizontal ? "h" : "v", pulseIndex > i && "active")} />`);
  });
  return html`<div class="bt bt-diagram"><div class=${cx("bt-chain", !horizontal && "v")}>${nodes}</div></div>`;
}

function EditBeat({ beat, t, reduced }) {
  const visible = Math.floor(t * 1.35 * beat.steps.length) + 1;
  return html`<div class="bt bt-code">
    ${beat.steps.slice(0, visible).map((line, i) => html`<div key=${i} class=${cx("line", line.startsWith("+") && "added")}>${line}</div>`)}
    ${visible <= beat.steps.length ? html`<i class="bt-cursor" style=${{ opacity: pulse(t, 14, reduced) }} />` : null}
  </div>`;
}

function CommandBeat({ beat, t }) {
  const visible = Math.floor(t * 1.35 * beat.steps.length) + 1;
  return html`<div class="bt bt-code cmd">
    ${beat.steps.slice(0, visible).map((line, i) => html`<div key=${i} class=${cx("line", i === 0 && "first")}>${line}</div>`)}
  </div>`;
}

function TestBeat({ beat, t, reduced }) {
  const n = beat.steps.length;
  const done = Math.floor(t * n * 1.15);
  return html`<div class="bt bt-tests">
    ${beat.steps.map((step, i) => html`<div key=${i} class="bt-row">
      <span class="mark">
        ${i < done ? html`<${CheckCircle} on size=${15} tint="var(--live)" style=${{ color: "var(--well)" }} />`
          : i === done ? html`<i class="dot" style=${{ opacity: 0.35 + 0.65 * pulse(t, 14, reduced) }} />`
          : html`<i class="ring" />`}
      </span>
      <span class=${cx("txt", i <= done && "on")}>${step}</span>
      ${i < done ? html`<span class="bt-pass">PASS</span>` : null}
    </div>`)}
    <div class="bt-passing">${Math.min(done, n)}/${n} passing</div>
  </div>`;
}

function DecisionBeat({ beat, t }) {
  return html`<div class="bt bt-decision">
    ${beat.steps.map((step, i) => {
      const inAccent = beat.accent?.includes(i);
      const chosen = inAccent && t > 0.5;
      const dimmed = !inAccent && t > 0.5;
      return html`<div key=${i} class=${cx("bt-opt", chosen && "chosen", dimmed && "dimmed")}>
        <span class="ic"><${CheckCircle} on=${chosen} size=${17} tint="var(--violet)" style=${{ boxShadow: chosen ? "none" : "inset 0 0 0 1.5px rgba(var(--ink-rgb), .3)" }} /></span>
        <span class="grow">${step}</span>
      </div>`;
    })}
    <div class="note">Decisions are narrated, logged, and reversible from history.</div>
  </div>`;
}

function MetricBeat({ beat, t }) {
  const grow = Math.min(1, t * 1.8);
  return html`<div class="bt bt-metric">
    ${beat.steps.map((step, i) => {
      const parts = step.split("|");
      const value = parts.length === 2 ? Number(parts[1]) : NaN;
      if (parts.length === 2 && Number.isFinite(value)) {
        const isAfter = beat.accent?.includes(i);
        return html`<div key=${i}>
          <div class="lbl"><span>${parts[0]}</span><span class=${cx("val", isAfter && "after")}>${Math.round(value)}ms</span></div>
          <div class="bar"><b class=${cx(isAfter && "after")} style=${{ width: `${Math.max(1, (value / 41) * grow * 100)}%` }} /></div>
        </div>`;
      }
      return html`<div key=${i} class="seal" style=${{ opacity: t > 0.5 ? 1 : 0 }}>
        <span class="ic"><${Icon} name="checkmark.seal.fill" size=${14} fill /></span><span>${step}</span>
      </div>`;
    })}
  </div>`;
}

// ------------------------------------------------------------ spotlight

/**
 * The Spotlight. Store-driven by default (`store.beats`, `store.directorPosition`,
 * skip/seek through the store); pass `beats` + `position` + handlers to drive it
 * from elsewhere (the replay player does).
 *
 * VoiceOver: one adjustable element — role="slider" whose value text names the
 * beat, kind, title, director and caption. Arrow keys move between beats.
 * `rotated` says the content is drawn rotated 90° inside a portrait frame, so
 * a horizontal swipe on the stage is a vertical one on the glass.
 */
export function Spotlight({ beats: beatsProp, position: positionProp, onNext, onPrev, onSeek, theater = false, rotated = false, badge = null, label = "Presenter stage", className, style }) {
  const store = getStore();
  const s = store ? useObservable(store) : null;
  useTick(4);
  const beats = beatsProp ?? s?.beats ?? [];
  const position = positionProp ?? ((now) => s.directorPosition(now));
  const next = onNext ?? (() => s?.skipToNextBeat());
  const prev = onPrev ?? (() => s?.skipToPreviousBeat());
  const seek = onSeek ?? ((i) => s?.seekToBeat(i, 0));

  const pos = beats.length ? position(Date.now()) : { index: 0, progress: 0 };
  const beat = beats[pos.index] ?? null;

  // Diagram orientation follows the stage's aspect.
  const stageRef = useRef();
  const [horizontal, setHorizontal] = useState(theater);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setHorizontal(el.clientWidth > el.clientHeight);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [theater, rotated]);

  // Swipe between beats like pages; taps on the thirds still work.
  const from = useRef(null);
  const swiped = useRef(false);
  const onPointerDown = (e) => { from.current = { x: e.clientX, y: e.clientY }; swiped.current = false; };
  const onPointerUp = (e) => {
    const f = from.current; from.current = null;
    if (!f) return;
    let dx = e.clientX - f.x, dy = e.clientY - f.y;
    if (rotated) { const sx = dx; dx = dy; dy = -sx; }
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swiped.current = true;
    haptic("light");
    if (dx < 0) next(); else prev();
  };
  const tap = (fn) => (e) => { e.stopPropagation(); if (swiped.current) { swiped.current = false; return; } haptic("light"); fn(); };
  const onKeyDown = (e) => {
    if (!beats.length) return;
    if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); next(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "PageDown") { e.preventDefault(); prev(); }
    else if (e.key === "Home") { e.preventDefault(); seek(0); }
    else if (e.key === "End") { e.preventDefault(); seek(beats.length - 1); }
  };

  const valueText = beat
    ? `Beat ${pos.index + 1} of ${beats.length}. ${beat.kind}: ${beat.title}. ${beat.director} directing. ${beat.caption}`
    : "No program yet";

  return html`<div class=${cx("spotlight work-dark", theater && "theater", className)} style=${style}
    role="slider" tabIndex="0" aria-label=${label} aria-valuemin="1" aria-valuemax=${Math.max(1, beats.length)} aria-valuenow=${beats.length ? pos.index + 1 : 1}
    aria-valuetext=${valueText} aria-orientation="horizontal" onKeyDown=${onKeyDown}
    onPointerDown=${onPointerDown} onPointerUp=${onPointerUp} onPointerCancel=${() => { from.current = null; }}>
    ${beats.length ? html`
      <${LiveRail} beats=${beats} position=${position} badge=${badge} />
      ${beat ? html`<${BeatHeader} beat=${beat} />` : null}
      <div class="sp-stage" ref=${stageRef}><${LiveStage} beats=${beats} position=${position} horizontal=${horizontal} /></div>
      <div class="sp-zones" aria-hidden="true">
        <div onClick=${tap(prev)} />
        <div onClick=${tap(next)} />
      </div>
      ${beat ? html`<div class="sp-caption-wrap"><${BeatCaption} beat=${beat} compact=${theater} /></div>` : null}
    ` : html`<div class="sp-empty">
      <${Icon} name="rectangle.inset.filled.and.person.filled" size=${28} weight=${1.6} color="var(--ink-35)" />
      <div class="t">Stage is quiet</div>
      <div class="b">${s?.usesWireSessionRegistry ? "Waiting for the Presenter's first typed beat." : "No directed program yet. Beats appear here as agents publish typed work."}</div>
    </div>`}
    <div class="sr-only" aria-live="polite">${beat ? `${beat.director} — ${beat.caption}` : ""}</div>
  </div>`;
}

/**
 * A self-clocked directed program (ArtifactDetailView's ReplayPlayer): same
 * beats, same renderers, but the clock starts when the player appears.
 */
export function ReplaySpotlight({ beats, badge = "REPLAY", label = "Replay", className, style, theater = false }) {
  const [start] = useState(() => Date.now());
  const skew = useRef(0);
  const [, bump] = useReducer((n) => n + 1, 0);
  // Pure paging, the same math as `Director.position` — kept local so the
  // player never touches the live program clock.
  const total = beats.reduce((sum, b) => sum + b.duration, 0);
  const position = (now) => {
    if (!beats.length || total <= 0) return { index: 0, progress: 0 };
    let t = (((now - start) / 1000 + skew.current) % total + total) % total;
    for (let i = 0; i < beats.length; i++) {
      if (t < beats[i].duration) return { index: i, progress: t / beats[i].duration };
      t -= beats[i].duration;
    }
    return { index: beats.length - 1, progress: 1 };
  };
  const onNext = () => {
    if (!beats.length) return;
    const { index: i, progress: p } = position(Date.now());
    const nxt = (i + 1) % beats.length;
    skew.current += beats[i].duration * (1 - p) + beats[nxt].duration * 0.55;
    bump();
  };
  const onPrev = () => {
    if (!beats.length) return;
    const { index: i, progress: p } = position(Date.now());
    if (p > 0.2) skew.current -= beats[i].duration * p - 0.01;
    else { const prv = (i - 1 + beats.length) % beats.length; skew.current -= beats[i].duration * p + beats[prv].duration - 0.01; }
    bump();
  };
  const onSeek = (index) => {
    if (!beats.length) return;
    let elapsed = 0;
    for (let k = 0; k < index; k++) elapsed += beats[k].duration;
    skew.current = elapsed - (Date.now() - start) / 1000;
    bump();
  };
  return html`<${Spotlight} beats=${beats} position=${position} onNext=${onNext} onPrev=${onPrev} onSeek=${onSeek} badge=${badge} label=${label} className=${className} style=${style} theater=${theater} />`;
}
