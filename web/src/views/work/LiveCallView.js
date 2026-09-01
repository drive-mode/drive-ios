// The live call — a port of `Sources/LiveCallView.swift`. Presented as the
// full-screen cover by `store.joinCall()`; always dark (`.work-dark`).
//
// Portrait: header → presence → Presenter chip → Spotlight → typed bubbles →
// hold strip. Theater: the Spotlight goes edge-to-edge and the chrome floats
// in opaque pseudo-glass (a live blur over a 30fps surface re-samples every
// frame; a raised fill with a hairline reads the same and costs nothing).
// The rotate control enters theater; a physically landscape viewport does too.
// Inside a portrait frame, theater draws the call rotated 90° — the phone
// turned in your hand.
//
// Voice is privacy-strict by construction: while the hold button is down we
// measure loudness from an AnalyserNode and drop every sample in the same
// callback. Nothing is recorded, retained, uploaded, or transcribed.
import { html, cx, useState, useEffect, useLayoutEffect, useRef, useTick, useObservable, haptic, reducedMotion } from "../../ui.js";
import { Icon, DriveMark, DriveSpinner, AvatarChip, Waveform } from "../../components.js";
import { injectStyle } from "./shared.js";
import { Spotlight } from "./SpotlightDirector.js";
import { PresenterTitleControl } from "./AgentTitles.js";

let store = null;
export function bindLiveCall(ctx) { store = ctx.store; }

injectStyle("work-css-live", `
.live-call { position: absolute; inset: 0; background: var(--page); overflow: hidden; }
.live-frame { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--page); }
.live-frame.rotated { inset: auto; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(90deg); transform-origin: center; }
.live-frame.animate { transition: transform .45s var(--ease), width .45s var(--ease), height .45s var(--ease); }

.lc-portrait { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-top: calc(var(--safe-top) + 6px); padding-bottom: calc(var(--safe-bottom) + 8px); }
.lc-header { display: flex; align-items: center; gap: 8px; padding: 0 16px; flex: none; }
.lc-round { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--ink-78);
  background: var(--surface); box-shadow: inset 0 0 0 0.8px var(--hairline); }
.lc-round.dim { color: var(--ink-55); }
.lc-hit { position: relative; }
.lc-hit::before { content: ""; position: absolute; inset: -6px; }
.lc-title { flex: 1; min-width: 0; text-align: center; }
.lc-title .t { font-size: 15px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-title .l { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--live); font-variant-numeric: tabular-nums; margin-top: 2px; }
.lc-presence { display: flex; justify-content: center; align-items: center; gap: 10px; padding-top: 12px; flex: none; }
.lc-you { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface2); box-shadow: inset 0 0 0 0.8px var(--hairline); position: relative; flex: none; }
.lc-you.speaking::after { content: ""; position: absolute; inset: -3.5px; border-radius: 50%; border: 2px solid var(--violet); }
.lc-presenter { display: flex; justify-content: center; padding-top: 10px; flex: none; }
.lc-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 12px 0; }
.lc-stage > .spotlight { flex: 1; min-height: 0; }
.lc-bubbles { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding: 10px 16px 0; flex: none; }
.lc-bubble { font-size: 12.5px; color: var(--ink); padding: 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--violet) 55%, transparent); max-width: 100%; word-break: break-word; line-height: 1.35; animation: bounceIn .3s var(--spring); }
.lc-strip { display: flex; align-items: center; gap: 10px; padding: 12px; margin: 14px 12px 0; border-radius: 24px; flex: none;
  background: color-mix(in srgb, var(--surface) 72%, transparent); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  box-shadow: inset 0 0 0 0.8px var(--hairline); }
.lc-strip.tight { margin-top: 10px; }
.lc-square { width: 52px; height: 52px; border-radius: var(--r-hero); display: grid; place-items: center; flex: none; color: rgba(var(--ink-rgb), .85);
  background: var(--surface2); box-shadow: inset 0 0 0 0.8px var(--hairline); font-size: 19px; transition: background .15s, box-shadow .15s, transform .28s var(--spring); }
.lc-square.raised { background: color-mix(in srgb, var(--violet) 28%, transparent); box-shadow: inset 0 0 0 1.5px var(--violet); }
.lc-square.leave { color: var(--danger); background: color-mix(in srgb, var(--danger) 14%, transparent); box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--danger) 30%, transparent); font-size: 13px; font-weight: 700; }
.lc-hold { flex: 1; min-width: 0; height: 52px; border-radius: var(--r-hero); display: flex; align-items: center; justify-content: center; gap: 9px; color: #fff; font-size: 16px; font-weight: 700;
  background: var(--hero-gradient); box-shadow: 0 8px 13px color-mix(in srgb, var(--violet) 35%, transparent); transition: transform .15s ease-out, box-shadow .15s; touch-action: none; user-select: none; -webkit-user-select: none; }
.lc-hold.held { transform: scale(.97); box-shadow: 0 8px 13px color-mix(in srgb, var(--violet) 55%, transparent); }
.lc-hold .lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-typing { display: flex; align-items: center; gap: 9px; padding: 10px; }
.lc-circle { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; flex: none; color: rgba(var(--ink-rgb), .85); background: var(--surface2); box-shadow: inset 0 0 0 0.8px var(--hairline); }
.lc-circle.send { color: #fff; background: var(--hero-gradient); box-shadow: none; }
.lc-circle:disabled { opacity: .6; }
.lc-field { flex: 1; min-width: 0; min-height: 46px; max-height: 84px; padding: 12px 14px; border-radius: 17px; background: var(--surface2); box-shadow: inset 0 0 0 0.8px rgba(var(--ink-rgb), .12);
  color: var(--ink); font-size: 14px; line-height: 1.35; border: 0; resize: none; caret-color: var(--violet); }
.lc-field::placeholder { color: var(--ink-35); }
.lc-field:focus { box-shadow: inset 0 0 0 1.4px var(--violet); }

.lc-theater { position: absolute; inset: 0; display: flex; flex-direction: column; }
.lc-theater > .spotlight { position: absolute; inset: 0; }
.lc-theater .top { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 14px 0; padding-left: calc(14px + var(--theater-inset, 0px)); flex: none; }
.lc-theater .bottom { position: relative; margin-top: auto; display: flex; align-items: flex-end; gap: 8px; padding: 0 14px 10px; padding-left: calc(14px + var(--theater-inset, 0px)); flex: none; }
.lc-glass { background: color-mix(in srgb, var(--surface) 94%, transparent); box-shadow: inset 0 0 0 0.8px rgba(var(--ink-rgb), .12); }
.lc-tround { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none; color: rgba(var(--ink-rgb), .85); font-size: 15px; transition: background .15s, box-shadow .15s; }
.lc-tround.sm { width: 32px; height: 32px; }
.lc-tround.raised { background: color-mix(in srgb, var(--violet) 40%, transparent); box-shadow: inset 0 0 0 1.4px var(--violet); }
.lc-tround.mic { width: 46px; height: 46px; color: #fff; background: var(--hero-gradient); box-shadow: 0 4px 10px color-mix(in srgb, var(--violet) 35%, transparent); touch-action: none; user-select: none; -webkit-user-select: none; transition: transform .15s ease-out; }
.lc-tround.mic.held { transform: scale(.94); box-shadow: 0 4px 10px color-mix(in srgb, var(--violet) 60%, transparent); }
.lc-tround.leave { color: var(--danger); background: color-mix(in srgb, var(--danger) 18%, transparent); box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--danger) 35%, transparent); }
.lc-tclock { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: rgba(var(--ink-rgb), .85); font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 0; }
.lc-tclock span { overflow: hidden; text-overflow: ellipsis; }
.lc-tcontrols { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 999px; margin-left: auto; flex: none; }
.lc-theater .lc-strip { margin: 0; }
.lc-theater .lc-typing { border-radius: 24px; max-width: 560px; flex: 1; }
.lc-theater .lc-bubbles { padding: 0; max-width: 300px; align-self: flex-end; }

.lc-joining { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: color-mix(in srgb, var(--page) 94%, transparent); color: var(--ink-78); font-size: 13.5px; font-weight: 600; transition: opacity .35s var(--ease); }
.lc-joining.gone { opacity: 0; pointer-events: none; }
`);

// --------------------------------------------------------------- hooks

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return matches;
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return size;
}

/**
 * Hold-to-talk level meter. Requests the mic only while held, reads RMS from an
 * AnalyserNode each frame, and lets every buffer die in the callback. The only
 * value that survives is a smoothed 0…1 Float the waveform draws.
 */
function useMicLevel(held) {
  const [level, setLevel] = useState(0);
  const [denied, setDenied] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!held) { setLevel(0); setLive(false); return undefined; }
    let cancelled = false, stream = null, ctx = null, raf = 0;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let smooth = 0;
        setDenied(false); setLive(true);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          smooth = smooth * 0.7 + Math.min(1, rms * 6) * 0.3;
          setLevel(smooth);
          buf.fill(0); // the samples end here
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) setDenied(true);
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close?.().catch?.(() => {});
    };
  }, [held]);
  return { level, denied, live };
}

/** Press-and-hold handlers; keyboard/AT activation toggles instead. */
function holdHandlers(s) {
  const down = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); if (!s.micHeld) { haptic("medium"); s.set({ micHeld: true }); } };
  const up = () => { if (s.micHeld) s.set({ micHeld: false }); };
  return {
    onPointerDown: down, onPointerUp: up, onPointerCancel: up, onLostPointerCapture: up,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); haptic("medium"); s.set({ micHeld: !s.micHeld }); } },
    onContextMenu: (e) => e.preventDefault(),
  };
}

// --------------------------------------------------------------- parts

function CallClock({ start, prefix = "" }) {
  useTick(1);
  return html`<span>${prefix}${(store ?? window.drive.store).callClock(Date.now(), start)}</span>`;
}

/** Everyone on the call: agents wear the bot, told apart by color; the speaking ring follows the director. */
function PresenceChips({ s }) {
  useTick(4);
  const director = s.beats.length ? s.beats[s.directorPosition(Date.now()).index]?.director : null;
  const agents = s.agents.slice(0, 4);
  return html`<div class="lc-presence" role="group" aria-label="Participants">
    ${agents.map((a) => html`<${AvatarChip} key=${a.id} name=${a.name} color=${a.color} size=${34} speaking=${a.name === director} />`)}
    <span class=${cx("lc-you", s.editAllowed && "speaking")} role="img" aria-label=${`${s.displayNameForUser()}${s.editAllowed ? ", edits allowed" : ""}`}><${DriveMark} size=${18} contrast="onDark" /></span>
  </div>`;
}

function SentBubbles({ s, className }) {
  if (!s.sessionMessages.length) return null;
  return html`<div class=${cx("lc-bubbles", className)} role="group" aria-label=${`Your typed messages: ${s.sessionMessages.map((m) => m.text).join(". ")}`}>
    ${s.sessionMessages.map((m) => html`<div key=${m.id} class="lc-bubble">${m.text}</div>`)}
  </div>`;
}

function HoldLabel({ s, denied, live, level }) {
  if (!s.micHeld) return html`<${Icon} name="mic.fill" size=${15} weight=${2.4} fill /><span class="lbl">Hold</span>`;
  return html`<${Waveform} color="var(--ink)" barCount=${5} height=${14} live=${live && !denied} level=${level} /><span class="lbl">${denied ? "Mic access off" : "Holding — release to send"}</span>`;
}

function HoldStrip({ s, onType, className }) {
  const { level, denied, live } = useMicLevel(s.micHeld);
  return html`<div class=${cx("lc-strip", className)}>
    <button type="button" class=${cx("lc-square pressable", s.handRaised && "raised")} onClick=${() => s.set({ handRaised: !s.handRaised })} aria-label=${s.handRaised ? "Lower hand" : "Raise hand"} aria-pressed=${s.handRaised}>✋</button>
    <button type="button" class="lc-square pressable" onClick=${onType} aria-label="Type instead" title="Send a typed message to the room — for when you don't want to speak"><${Icon} name="keyboard" size=${17} weight=${2.2} /></button>
    <button type="button" class=${cx("lc-hold", s.micHeld && "held")} ...${holdHandlers(s)} aria-label="Hold to talk" aria-pressed=${s.micHeld} title="Double-tap to toggle the microphone">
      <${HoldLabel} s=${s} denied=${denied} live=${live} level=${level} />
    </button>
    <button type="button" class="lc-square leave pressable" onClick=${() => s.leaveCall()} aria-label="Leave session">Leave</button>
  </div>`;
}

function TypingBar({ s, onVoice, className, style }) {
  const [draft, setDraft] = useState("");
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 60); }, []);
  const send = () => { const text = draft.trim(); if (!text) return; setDraft(""); haptic("light"); s.sendSessionMessage(text); ref.current?.focus(); };
  return html`<div class=${cx("lc-strip lc-typing", className)} style=${style}>
    <button type="button" class="lc-circle pressable" onClick=${onVoice} aria-label="Back to voice"><${Icon} name="mic.fill" size=${16} weight=${2.3} fill /></button>
    <textarea ref=${ref} class="lc-field" rows="1" placeholder="Type to the room…" aria-label="Type to the room" value=${draft}
      onInput=${(e) => setDraft(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
    <button type="button" class=${cx("lc-circle pressable", draft.trim() && "send")} disabled=${!draft.trim()} onClick=${send} aria-label="Send message"><${Icon} name="arrow.up" size=${17} weight=${2.6} /></button>
  </div>`;
}

// -------------------------------------------------------------- layouts

function PortraitLayout({ s, typing, setTyping, onRotate }) {
  return html`<div class="lc-portrait">
    <div class="lc-header">
      <button type="button" class="lc-round lc-hit pressable" onClick=${() => s.leaveCall()} aria-label="Leave session"><${Icon} name="chevron.left" size=${16} weight=${2.4} /></button>
      <div class="lc-title">
        <div class="t">${s.liveSessionTitle}</div>
        <div class="l"><i class="dot" /><${CallClock} start=${s.callStart} prefix="Live · " /></div>
      </div>
      <button type="button" class="lc-round dim lc-hit pressable" onClick=${onRotate} aria-label="Enter theater" title="Rotates the Presenter stage to fill the screen"><${Icon} name="rotate.right" size=${15} weight=${2.3} /></button>
    </div>
    <${PresenceChips} s=${s} />
    <div class="lc-presenter"><${PresenterTitleControl} /></div>
    <div class="lc-stage"><${Spotlight} /></div>
    <${SentBubbles} s=${s} />
    ${typing
      ? html`<${TypingBar} s=${s} onVoice=${() => setTyping(false)} className=${s.sessionMessages.length ? "tight" : ""} />`
      : html`<${HoldStrip} s=${s} onType=${() => setTyping(true)} className=${s.sessionMessages.length ? "tight" : ""} />`}
  </div>`;
}

function TheaterControls({ s, onType, onExit }) {
  const { level, denied, live } = useMicLevel(s.micHeld);
  return html`<div class="lc-tcontrols lc-glass">
    <button type="button" class=${cx("lc-tround lc-glass pressable", s.handRaised && "raised")} onClick=${() => s.set({ handRaised: !s.handRaised })} aria-label=${s.handRaised ? "Lower hand" : "Raise hand"} aria-pressed=${s.handRaised}>✋</button>
    <button type="button" class=${cx("lc-tround mic", s.micHeld && "held")} ...${holdHandlers(s)} aria-label="Hold to talk" aria-pressed=${s.micHeld} title="Double-tap to toggle the microphone">
      ${s.micHeld ? html`<${Waveform} color="var(--ink)" barCount=${4} height=${14} live=${live && !denied} level=${level} />` : html`<${Icon} name="mic.fill" size=${16} weight=${2.4} fill />`}
    </button>
    <button type="button" class="lc-tround lc-glass pressable" onClick=${onType} aria-label="Type instead"><${Icon} name="keyboard" size=${15} weight=${2.2} /></button>
    <button type="button" class="lc-tround lc-glass pressable" onClick=${onExit} aria-label="Exit theater"><${Icon} name="iphone" size=${15} weight=${2.2} /></button>
    <button type="button" class="lc-tround leave pressable" onClick=${() => s.leaveCall()} aria-label="Leave session"><${Icon} name="xmark" size=${14} weight=${2.8} /></button>
  </div>`;
}

function TheaterLayout({ s, typing, setTyping, onExit, rotated }) {
  return html`<div class="lc-theater" style=${{ "--theater-inset": rotated ? "var(--safe-top)" : "0px" }}>
    <${Spotlight} theater rotated=${rotated} />
    <div class="top">
      <button type="button" class="lc-tround sm lc-glass lc-hit pressable" onClick=${() => s.leaveCall()} aria-label="Leave session"><${Icon} name="chevron.left" size=${14} weight=${2.4} /></button>
      <div class="grow" />
      <div class="lc-tclock lc-glass"><i class="dot" /><span><${CallClock} start=${s.callStart} prefix=${`${s.liveSessionTitle} · `} /></span></div>
      <${PresenterTitleControl} compact />
    </div>
    <div class="bottom">
      ${typing
        ? html`<${TypingBar} s=${s} onVoice=${() => setTyping(false)} />`
        : html`<${SentBubbles} s=${s} /><${TheaterControls} s=${s} onType=${() => setTyping(true)} onExit=${onExit} />`}
    </div>
  </div>`;
}

// ----------------------------------------------------------------- root

/** Route "liveCall" — the full-screen cover. */
export function LiveCallView() {
  const s = useObservable(store ?? window.drive.store);
  const [joining, setJoining] = useState(true);
  const [typing, setTyping] = useState(false);
  const [theaterWanted, setTheaterWanted] = useState(false);
  const landscape = useMediaQuery("(orientation: landscape)");
  const theater = theaterWanted || landscape;
  const rotated = theaterWanted && !landscape;
  const rootRef = useRef();
  const { w, h } = useSize(rootRef);

  useEffect(() => { const id = setTimeout(() => setJoining(false), 900); return () => clearTimeout(id); }, []);
  // Leaving from theater hands back a portrait app: the cover unmounts, and
  // with it the rotated frame. The mic is released by the store (`leaveCall`).

  const frameStyle = rotated && w && h ? { width: h, height: w } : undefined;
  return html`<div class="live-call work-dark" ref=${rootRef} data-theater=${theater ? "1" : "0"}>
    <div class=${cx("live-frame", rotated && "rotated", !reducedMotion() && "animate")} style=${frameStyle}>
      ${theater
        ? html`<${TheaterLayout} s=${s} typing=${typing} setTyping=${setTyping} rotated=${rotated} onExit=${() => { haptic("light"); setTheaterWanted(false); }} />`
        : html`<${PortraitLayout} s=${s} typing=${typing} setTyping=${setTyping} onRotate=${() => { haptic("light"); setTheaterWanted(true); }} />`}
    </div>
    <div class=${cx("lc-joining", !joining && "gone")} aria-hidden=${!joining}>
      <${DriveSpinner} size=${44} contrast="onDark" />
      <div>Joining ${s.liveSessionTitle}…</div>
    </div>
  </div>`;
}
