// ConversationView.swift — the conversation an interrupt points at: the
// agent's report_status trail plus the ask, answerable inline with quick
// replies, a composer, or hold-to-talk. Voice is *measured* (a live level for
// the waveform) and dropped in the same frame — never transcribed or kept.
import { html, useState, useEffect, useRef, useObservable, haptic, clamp } from "../../ui.js";
import { Screen, AvatarChip, Icon, Waveform } from "../../components.js";
import { ctx } from "./shared.js";

const QUICK = { blocked: ["Use env", "Use vault", "Hold on — let's talk"], review: ["Open the plan", "Park it for today"] };

export function ConversationView({ params }) {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;
  const interruptId = params?.interruptId;
  const interrupt = s.interrupts.find((i) => i.id === interruptId) ?? null;
  const thread = s.thread(interruptId);
  const scrollRef = useRef();
  const [draft, setDraft] = useState("");
  const voice = useVoiceLevel();

  // Newest message stays in view — a reply lands, the ack lands 1.2s later.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [thread.length]);

  const send = (text) => {
    const t = String(text ?? "").trim();
    if (!t || !interruptId) return;
    haptic("light");
    s.sendReply(interruptId, t);
    setDraft("");
  };

  const quick = interrupt && !interrupt.resolved ? QUICK[interrupt.kind] : null;
  const name = interrupt?.agentName ?? "agent";

  const footer = html`<div class="cv-footer" style=${{ paddingBottom: s.tabBarVisible ? "calc(var(--tabbar-h) + var(--safe-bottom) + 6px)" : "calc(var(--safe-bottom) + 6px)" }}>
    ${quick ? html`<div class="cv-quick" role="group" aria-label="Quick replies">
      ${quick.map((q) => html`<button key=${q} class="q pressable" onClick=${() => send(q)}>${q}</button>`)}
    </div>` : null}
    <div class="cv-bar">
      ${voice.held ? html`<div class="cv-voice" role="status" aria-live="assertive">
          <${Waveform} color="var(--violet-text)" barCount=${9} height=${20} live=${voice.capturing} level=${voice.level} />
          <span class="truncate">${voice.denied ? "No mic — level only, never audio" : voice.capturing ? "Listening — level only, nothing is kept" : "Hold to talk"}</span>
        </div>`
      : html`<label class="cv-field">
          <input value=${draft} placeholder=${`Message ${name}…`} aria-label=${`Message ${name}`} enterkeyhint="send"
            onInput=${(e) => setDraft(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); send(draft); } }} />
          <button class="send pressable" aria-label="Send" disabled=${!draft.trim()} onClick=${() => send(draft)}><${Icon} name="paperplane.fill" size=${15} weight=${2.4} fill /></button>
        </label>`}
      <button class=${voice.held ? "cv-mic held" : "cv-mic"} aria-label="Hold to talk" aria-pressed=${voice.held} title="Hold to talk — measured, never transcribed"
        onPointerDown=${(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } voice.start(); }}
        onPointerUp=${voice.stop} onPointerCancel=${voice.stop} onLostPointerCapture=${voice.stop}
        onKeyDown=${(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); voice.start(); } }}
        onKeyUp=${(e) => { if (e.key === " " || e.key === "Enter") voice.stop(); }}
        onContextMenu=${(e) => e.preventDefault()}>
        <${Icon} name="mic.fill" size=${17} weight=${2.4} fill />
      </button>
    </div>
  </div>`;

  return html`<${Screen} title=${interrupt?.agentName ?? "Conversation"} back scrollRef=${scrollRef} contentClass="hm-content" footer=${footer}
    trailing=${html`<button class="hm-wash pressable" onClick=${() => s.joinCall()} aria-label="Join session"><${Icon} name="waveform" size=${12} weight=${2.6} /> Join session</button>`}>
    <div class="cv-thread" data-surface="conversation" role="log" aria-live="polite" aria-label=${`Conversation with ${name}`}>
      ${interrupt ? html`<div class="cv-context">
        <i class=${interrupt.resolved ? "dot" : "dot violet"} aria-hidden="true" />
        <span class="t truncate">${interrupt.title}</span>
        <span class="mono faint" style=${{ fontSize: 10 }}>${interrupt.age}</span>
      </div>` : null}
      ${thread.map((m) => html`<${Bubble} key=${m.id} msg=${m} interrupt=${interrupt} />`)}
      ${interrupt?.kind === "approval" && !interrupt.resolved ? html`<${ApprovalCard} store=${s} />` : null}
      ${interrupt?.resolved ? html`<div class="cv-cleared fade-in">
        <${Icon} name="checkmark.circle.fill" size=${12} fill color="var(--live)" />
        <span>Cleared — ${interrupt.agentName} is moving again</span>
      </div>` : null}
    </div>
  </${Screen}>`;
}

function Bubble({ msg, interrupt }) {
  if (msg.sender === "system") {
    return html`<div class="cv-sys" role="note">
      <${Icon} name="waveform.path.ecg" size=${10} weight=${2.4} />
      <span class="t truncate">${msg.text}</span>
      <span style=${{ fontSize: 9.5 }}>${msg.time}</span>
    </div>`;
  }
  if (msg.sender === "agent") {
    return html`<div class="cv-agent bounce-in">
      ${interrupt ? html`<${AvatarChip} letter=${interrupt.agentName[0]} color=${interrupt.agentColor} size=${26} />` : null}
      <div class="b">${msg.text}</div>
    </div>`;
  }
  return html`<div class="cv-you bounce-in"><div class="b">${msg.text}</div></div>`;
}

function ApprovalCard({ store }) {
  return html`<div class="cv-approval" role="group" aria-label="Approve Cline's edit">
    <div class="ny-diff" style=${{ marginTop: 0 }}><span>+ export function requireAuth()</span><span>+   verifyJwt(req); next()</span></div>
    <div class="ny-actions" style=${{ marginTop: 12 }}>
      <button class="ny-btn ghost pressable" onClick=${() => store.denyEdit()}>Deny</button>
      <button class="ny-btn solid pressable" onClick=${() => store.allowEdit()}>Allow</button>
    </div>
  </div>`;
}

/**
 * VoiceCapture.swift for the browser: getUserMedia → AnalyserNode → RMS → dB
 * → 0…1, smoothed 0.35 like the Swift tap. The graph never reaches a
 * destination, nothing is recorded, and the stream is stopped on release.
 * Without a mic (denied, headless, insecure origin) the waveform idles.
 */
function useVoiceLevel() {
  const [held, setHeld] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [level, setLevel] = useState(0);
  const ref = useRef({ holding: false, audio: null, stream: null, raf: 0, smooth: 0 });

  const teardown = () => {
    const r = ref.current;
    cancelAnimationFrame(r.raf); r.raf = 0;
    r.stream?.getTracks().forEach((t) => t.stop()); r.stream = null;
    r.audio?.close().catch(() => {}); r.audio = null;
    r.smooth = 0;
  };

  const start = async () => {
    const r = ref.current;
    if (r.holding) return;
    r.holding = true; setHeld(true); haptic("medium");
    if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) { setDenied(true); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
    catch { setDenied(true); return; }
    if (!r.holding) { stream.getTracks().forEach((t) => t.stop()); return; }
    setDenied(false);
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    r.stream = stream; r.audio = audio;
    const buf = new Float32Array(analyser.fftSize);
    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const db = 20 * Math.log10(Math.max(rms, 1e-7));
      const normalized = clamp((db + 50) / 50, 0, 1);
      r.smooth += (normalized - r.smooth) * 0.35;
      setLevel(r.smooth);
      r.raf = requestAnimationFrame(loop);
    };
    setCapturing(true);
    r.raf = requestAnimationFrame(loop);
  };

  const stop = () => {
    const r = ref.current;
    if (!r.holding) return;
    r.holding = false;
    teardown();
    setHeld(false); setCapturing(false); setLevel(0);
  };

  useEffect(() => () => { ref.current.holding = false; teardown(); }, []);
  return { held, capturing, denied, level, start, stop };
}
