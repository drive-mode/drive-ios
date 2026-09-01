// One artifact, opened — a port of `Sources/ArtifactDetailView.swift`.
// Replays play their directed beat program right here in a self-clocked
// player (its own clock, not the store's call clock), diffs read as diffs,
// everything carries its lineage and lifecycle. Phones get the directed
// summary; the full artifact opens on desktop.
//
// The beat renderers (ProgressRail / BeatHeader / BeatStage) are local
// twins of SpotlightDirector.swift's; once `../work/SpotlightDirector.js`
// exports them, this file can import those instead — same props.
import { html, cx, useRef, useReducer, useObservable, useTick, useFrame, haptic, reducedMotion } from "../../ui.js";
import { nav } from "../../nav.js";
import { Icon, AvatarChip, Screen, Card, DiffLine, Empty } from "../../components.js";
import { ARTIFACT_META, BEAT_TINT, DemoData, lifeBadge, sizeLabel, permanent, ephemeral } from "../../models.js";
import { Director } from "../../store.js";
import { shareText } from "./shared.js";
import { shareLine } from "./ArtifactsView.js";

let store = null;
export function bindArtifactDetailStore(s) { store = s; }

export function ArtifactDetailView({ params }) {
  const s = useObservable(store);
  const id = params?.id ?? params?.artifactId;
  const artifact = s.artifacts.find((a) => a.id === id);
  if (!artifact) {
    return html`<${Screen} title="Artifact" back contentClass="tk-pushed"><${Empty} icon="tray" title="Artifact not found" body="It may have been superseded or filed. Search still finds filed work." action="All artifacts" onAction=${() => nav.replace("artifacts")} /></${Screen}>`;
  }
  const meta = ARTIFACT_META[artifact.kind];
  const beats = s.beats.length ? s.beats : s.configuration.previewContentEnabled ? DemoData.beats : [];
  const lifeIs = (days) => !artifact.life.permanent && artifact.life.daysLeft === days;

  return html`<${Screen} title=${artifact.kind} back contentClass="tk-pushed">
    <div class="tk-head" style=${{ "--tint": meta.tint }}>
      <span class="tk-kind lg"><${Icon} name=${meta.symbol} size=${20} weight=${2.3} /></span>
      <div class="grow" style=${{ minWidth: 0 }}><div class="ttl">${artifact.title}</div><div class="meta">${artifact.meta}</div></div>
    </div>

    ${artifact.kind === "Replay" ? html`
      <${ReplayPlayer} beats=${beats} />
      <p class="tk-caption">The room's program, replayed — the same beats the session directed live.</p>`
    : artifact.kind === "Diff" ? html`
      <${DiffCard} lines=${DemoData.baseDiff} />
      <p class="tk-caption">Directed summary — the full diff opens on desktop.</p>`
    : html`<div class="tk-preview" style=${{ "--tint": meta.tint }}>
        <${Icon} name=${meta.symbol} size=${36} weight=${1.3} color=${meta.tint} />
        <div class="t-sm w6 ink78" style=${{ fontSize: 13 }}>${artifact.meta}</div>
        <div class="t-xs muted" style=${{ fontSize: 10.5 }}>Directed summary — the full ${artifact.kind.toLowerCase()} opens on desktop.</div>
      </div>`}

    <div class="eyebrow" style=${{ marginTop: 18 }}>LINEAGE</div>
    <${Card} className="tk-meta" pad=${false}>
      <${MetaRow} label="Project" value=${artifact.room} />
      <${MetaRow} label="Repository" value=${artifact.repo} />
      <${MetaRow} label="Produced by" value=${html`<${AvatarChip} letter=${artifact.agentName.charAt(0)} color=${artifact.agentColor} size=${20} />${artifact.agentName}`} />
      <${MetaRow} label="Day" value=${`${artifact.day} · ${artifact.age} ago`} />
      <${MetaRow} label="Size" value=${sizeLabel(artifact.sizeKB)} />
    </${Card}>

    <div class="eyebrow" style=${{ marginTop: 18 }}>LIFECYCLE</div>
    <div class="tk-lifechips" role="radiogroup" aria-label="Lifespan">
      <${LifeChip} label="Keeps" symbol="infinity" active=${artifact.life.permanent} onClick=${() => s.setArtifactLife(artifact.id, permanent())} />
      <${LifeChip} label="7 days" symbol="hourglass" active=${lifeIs(7)} onClick=${() => s.setArtifactLife(artifact.id, ephemeral(7))} />
      <${LifeChip} label="30 days" symbol="hourglass.bottomhalf.filled" active=${lifeIs(30)} onClick=${() => s.setArtifactLife(artifact.id, ephemeral(30))} />
    </div>
    <p class="tk-caption">${artifact.life.permanent ? "Keeps until superseded." : `Files to the archive in ${lifeBadge(artifact.life).replace(" left", "")} — searchable, never deleted.`}</p>

    <div class="tk-detail-actions">
      <button type="button" class="solid pressable" onClick=${() => { haptic("light"); s.joinCall(); }}><${Icon} name="waveform" size=${13} weight=${2.4} />Open in session</button>
      <button type="button" class="pressable" onClick=${() => { haptic("light"); shareText(shareLine(artifact)); }}><${Icon} name="square.and.arrow.up" size=${13} weight=${2.4} />Share</button>
    </div>
  </${Screen}>`;
}

function MetaRow({ label, value }) {
  return html`<div class="tk-metarow"><span>${label}</span><span class="v">${value}</span></div>`;
}

function LifeChip({ label, symbol, active, onClick }) {
  return html`<button type="button" role="radio" aria-checked=${active} class=${cx("tk-lifechip pressable", active && "on")} onClick=${() => { if (!active) { haptic("light"); onClick(); } }}>
    <${Icon} name=${symbol} size=${11} weight=${2.4} />${label}
  </button>`;
}

// ---------------------------------------------------------- diff view

export function DiffCard({ lines }) {
  return html`<div class="tk-dark tk-well" role="figure" aria-label="Diff">
    ${lines.map((l, i) => html`<${DiffLine} key=${i} text=${l.text} added=${l.added} />`)}
  </div>`;
}

// ------------------------------------------------------ replay player

/**
 * A self-clocked directed program: same beats, same renderers as the live
 * Presenter stage, but the clock starts when the player appears. Tap the
 * halves, swipe, or use the arrow keys to scrub; Space pauses; the program
 * loops. One adjustable element for assistive tech.
 */
export function ReplayPlayer({ beats }) {
  const clock = useRef({ start: performance.now(), skew: 0, paused: false, pausedAt: 0 });
  const [, force] = useReducer((n) => n + 1, 0);
  const hostRef = useRef();
  const swipe = useRef(null);
  useTick(4, beats.length > 0); // chrome (header, a11y value) rides a 4 Hz tick

  const elapsed = (now = performance.now()) => { const c = clock.current; return ((c.paused ? c.pausedAt : now) - c.start) / 1000 + c.skew; };
  const position = (now) => Director.position(beats, elapsed(now));
  const skipForward = () => {
    if (!beats.length) return;
    const { index: i, progress: p } = position();
    const next = (i + 1) % beats.length;
    clock.current.skew += beats[i].duration * (1 - p) + beats[next].duration * 0.55;
    haptic("light"); force();
  };
  const skipBack = () => {
    if (!beats.length) return;
    const { index: i, progress: p } = position();
    if (p > 0.2) clock.current.skew -= beats[i].duration * p - 0.01;
    else { const prev = (i - 1 + beats.length) % beats.length; clock.current.skew -= beats[i].duration * p + beats[prev].duration - 0.01; }
    haptic("light"); force();
  };
  const togglePlay = () => {
    const c = clock.current, now = performance.now();
    if (c.paused) { c.start += now - c.pausedAt; c.paused = false; } else { c.pausedAt = now; c.paused = true; }
    haptic("light"); force();
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); skipForward(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); skipBack(); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Home") { e.preventDefault(); clock.current.skew = -elapsed() + clock.current.skew; force(); }
  };
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const f = swipe.current; swipe.current = null;
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.stopPropagation(); if (dx < 0) skipForward(); else skipBack(); swipe.current = { consumed: true }; setTimeout(() => { swipe.current = null; }, 0); }
  };
  const tap = (fn) => (e) => { if (swipe.current?.consumed) return; fn(); };

  const paused = clock.current.paused;
  const pos = beats.length ? position() : { index: 0, progress: 0 };
  const beat = beats[pos.index] ?? null;
  const valueText = beat ? `Beat ${pos.index + 1} of ${beats.length}. ${beat.kind}: ${beat.title}${paused ? ". Paused" : ""}` : "Empty program";

  return html`<div ref=${hostRef} class="tk-dark tk-player" tabindex="0" role="slider" aria-label="Replay" aria-valuemin="1" aria-valuemax=${Math.max(1, beats.length)} aria-valuenow=${pos.index + 1} aria-valuetext=${valueText}
    title="Swipe or tap the sides to move between beats; Space pauses" onKeyDown=${onKeyDown} onPointerDown=${onPointerDown} onPointerUp=${onPointerUp} onPointerCancel=${() => { swipe.current = null; }}>
    <div class="tk-ptop">
      <${RailClock} beats=${beats} position=${position} paused=${paused} />
      <span class="tk-ptag">REPLAY</span>
    </div>
    ${beat ? html`<${BeatHeader} beat=${beat} />` : null}
    ${beats.length ? html`<${StageClock} beats=${beats} position=${position} paused=${paused} />` : html`<div class="tk-stage"><div class="empty-beat">
      <${Icon} name="play.rectangle" size=${34} weight=${1.3} color="var(--tint-replay)" />
      <div class="w8" style=${{ fontSize: 17 }}>Empty program</div>
      <div class="t-xs muted">No beats have been directed for this room yet.</div>
    </div></div>`}
    ${beats.length ? html`<div class="tk-taps" aria-hidden="true">
      <button type="button" tabindex="-1" onClick=${tap(skipBack)} />
      <button type="button" tabindex="-1" onClick=${tap(skipForward)} />
    </div>` : null}
    ${beats.length ? html`<div class="tk-pctl">
      <button type="button" aria-label="Previous beat" onClick=${skipBack}><${Icon} name="backward.fill" size=${14} fill /></button>
      <button type="button" class="main" aria-label=${paused ? "Play" : "Pause"} aria-pressed=${paused} onClick=${togglePlay}><${Icon} name=${paused ? "play.fill" : "pause.fill"} size=${18} fill /></button>
      <button type="button" aria-label="Next beat" onClick=${skipForward}><${Icon} name="forward.fill" size=${14} fill /></button>
      <span class="st">${paused ? "PAUSED" : `${pos.index + 1}/${beats.length}`}</span>
    </div>` : null}
  </div>`;
}

/** 30 fps rail fill — the only per-frame subscriber besides the stage. */
function RailClock({ beats, position, paused }) {
  useFrame(!paused && !reducedMotion() && beats.length > 0);
  useTick(4, paused || reducedMotion());
  const pos = beats.length ? position() : { index: 0, progress: 0 };
  return html`<${ProgressRail} beats=${beats} index=${pos.index} progress=${pos.progress} />`;
}

function StageClock({ beats, position, paused }) {
  useFrame(!paused && !reducedMotion());
  useTick(4, paused || reducedMotion());
  const pos = position();
  return html`<div class="tk-stage"><${BeatStage} beat=${beats[pos.index]} t=${pos.progress} /></div>`;
}

// --------------------------------------------- stage renderers (local)

/** Kind-colored rail: watched beats at full tint, the current one fills live, upcoming dimmed. */
export function ProgressRail({ beats, index, progress }) {
  return html`<div class="tk-prail" aria-hidden="true">
    ${beats.map((b, i) => html`<i key=${b.id ?? i} class=${cx(i < index && "done", i === index && "now")} style=${{ "--tint": BEAT_TINT[b.kind] ?? "var(--violet)" }}>${i === index ? html`<b style=${{ width: `${Math.max(2, progress * 100)}%` }} />` : null}</i>`)}
  </div>`;
}

export function BeatHeader({ beat }) {
  const tint = BEAT_TINT[beat.kind] ?? "var(--violet)";
  const dirColor = beat.directorColor === "var(--coder)" ? "#fff" : beat.directorColor;
  return html`<div class="tk-bhead" style=${{ "--tint": tint }}>
    <span class="tk-bkind">${beat.kind}</span>
    <span class="bt">${beat.title}</span>
    <span class="dir"><i style=${{ background: dirColor }} />${beat.director}</span>
  </div>`;
}

const WIRE_SYMBOL = { PLAN: "list.bullet.rectangle", DIAGRAM: "point.3.connected.trianglepath.dotted", EDIT: "plus.forwardslash.minus", RUN: "terminal", TESTS: "checkmark.diamond", DECISION: "signpost.right", RESULT: "chart.bar.xaxis" };

export function BeatStage({ beat, t }) {
  if (!beat) return null;
  if (!beat.steps?.length) {
    return html`<div class="empty-beat">
      <${Icon} name=${WIRE_SYMBOL[beat.kind] ?? "circle.circle"} size=${34} weight=${1.3} color=${BEAT_TINT[beat.kind]} style=${{ opacity: 0.5 + 0.5 * Math.min(1, t * 3) }} />
      <div class="w8" style=${{ fontSize: 17 }}>${beat.title}</div>
      <div class="t-xs w6" style=${{ color: "var(--ink-35)" }}>Directed live · ${beat.director}</div>
    </div>`;
  }
  switch (beat.kind) {
    case "PLAN": return html`<${PlanBeat} beat=${beat} t=${t} />`;
    case "DIAGRAM": return html`<${DiagramBeat} beat=${beat} t=${t} />`;
    case "EDIT": return html`<${CodeBeat} beat=${beat} t=${t} edit />`;
    case "RUN": return html`<${CodeBeat} beat=${beat} t=${t} />`;
    case "TESTS": return html`<${TestBeat} beat=${beat} t=${t} />`;
    case "DECISION": return html`<${DecisionBeat} beat=${beat} t=${t} />`;
    case "RESULT": return html`<${MetricBeat} beat=${beat} t=${t} />`;
    default: return html`<${PlanBeat} beat=${beat} t=${t} />`;
  }
}

const pulse = (t, k) => (reducedMotion() ? 1 : Math.abs(Math.sin(t * k)));

function PlanBeat({ beat, t }) {
  const doneCount = beat.accent.length;
  return html`<div class="tk-plan">
    ${beat.steps.map((step, i) => {
      const isDone = i < doneCount || (i === doneCount && t > 0.72);
      const isActive = i === doneCount && !isDone;
      return html`<div key=${i} class=${cx("st", isDone && "done", isActive && "on")} style=${{ opacity: t > i * 0.08 ? 1 : 0 }}>
        <span class="ck">${isDone ? html`<${Icon} name="checkmark" size=${10} weight=${3} />` : isActive ? html`<i class="dot" style=${{ opacity: 0.4 + 0.6 * pulse(t, 12) }} />` : null}</span>
        <span>${step}</span>
        ${isActive ? html`<span class="now">NOW</span>` : null}
      </div>`;
    })}
  </div>`;
}

function DiagramBeat({ beat, t }) {
  const n = beat.steps.length;
  const pulseIndex = t * (n - 1);
  const horizontal = false; // phone stage: the chain reads top-down (Swift: width > height)
  const parts = [];
  beat.steps.forEach((label, i) => {
    const isNew = beat.accent.includes(i), lit = pulseIndex >= i - 0.5;
    parts.push(html`<span key=${`n${i}`} class=${cx("nd", isNew && "new", lit && "lit")}>${label}</span>`);
    if (i < n - 1) parts.push(html`<i key=${`c${i}`} class=${cx("cn", pulseIndex > i && "on")} />`);
  });
  return html`<div class=${cx("tk-diag", horizontal && "h")}>${parts}</div>`;
}

function CodeBeat({ beat, t, edit = false }) {
  const visible = Math.floor(t * 1.35 * beat.steps.length) + 1;
  return html`<div class="tk-code">
    ${beat.steps.slice(0, visible).map((ln, i) => html`<div key=${i} class=${cx("ln", edit ? ln.startsWith("+") && "add" : i === 0 && "first")}>${ln}</div>`)}
    ${edit && visible <= beat.steps.length ? html`<i class="cur" style=${{ opacity: pulse(t, 14) }} />` : null}
  </div>`;
}

function TestBeat({ beat, t }) {
  const done = Math.floor(t * beat.steps.length * 1.15);
  return html`<div class="tk-tests">
    ${beat.steps.map((s, i) => html`<div key=${i} class=${cx("tr", i <= done && "on")}>
      ${i < done ? html`<${Icon} name="checkmark.circle.fill" size=${15} fill color="var(--live)" />` : i === done ? html`<span class="pulse"><i style=${{ opacity: 0.35 + 0.65 * pulse(t, 14) }} /></span>` : html`<span class="ring" />`}
      <span>${s}</span>
      ${i < done ? html`<span class="pass">PASS</span>` : null}
    </div>`)}
    <div class="sum">${Math.min(done, beat.steps.length)}/${beat.steps.length} passing</div>
  </div>`;
}

function DecisionBeat({ beat, t }) {
  return html`<div class="tk-decide">
    ${beat.steps.map((s, i) => {
      const chosen = beat.accent.includes(i) && t > 0.5, dimmed = !beat.accent.includes(i) && t > 0.5;
      return html`<div key=${i} class=${cx("op", chosen && "on", dimmed && "dim")}>
        <${Icon} name=${chosen ? "checkmark.circle.fill" : "circle"} size=${17} fill=${chosen} color=${chosen ? "var(--violet-text)" : "var(--ink-35)"} />
        <span>${s}</span>
      </div>`;
    })}
    <div class="note">Decisions are narrated, logged, and reversible from history.</div>
  </div>`;
}

function MetricBeat({ beat, t }) {
  const grow = Math.min(1, t * 1.8);
  return html`<div class="tk-metric">
    ${beat.steps.map((s, i) => {
      const parts = s.split("|");
      const value = parts.length === 2 ? Number(parts[1]) : NaN;
      if (parts.length === 2 && Number.isFinite(value)) {
        const after = beat.accent.includes(i);
        return html`<div key=${i}>
          <div class="mrow"><span>${parts[0]}</span><b class=${cx(after && "after")}>${Math.round(value)}ms</b></div>
          <div class="mbar"><i class=${cx(after && "after")} style=${{ width: `${Math.max(2, (value / 41) * grow * 100)}%` }} /></div>
        </div>`;
      }
      return html`<div key=${i} class="seal" style=${{ opacity: t > 0.5 ? 1 : 0 }}><${Icon} name="checkmark.seal.fill" size=${14} fill color="var(--live)" />${s}</div>`;
    })}
  </div>`;
}
