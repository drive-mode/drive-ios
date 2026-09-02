// A port of `Sources/FeedbackMode.swift` — the feedback program: a floating
// bubble (only while the program is on AND this device opted in), the design
// chat with Cline (ephemeral, in memory, only the structured suggestion ever
// leaves on an explicit Send), and the Settings section with the two
// switches, the experiments list and the 7-day trial clock.
import { html, cx, useState, useRef, useEffect, useObservable, haptic } from "../../ui.js";
import { NavBar, Icon, AvatarChip, ClineBot, Eyebrow, Card, TextField, Button, ToggleRow, Toggle, Row } from "../../components.js";
import { agentColor } from "../../models.js";
import { ctx, SectionLabel, Footnote, Hairline } from "./shared.js";

// ------------------------------------------------------------- model

export const ExperimentStatus = { suggested: "suggested", trialing: "trialing", reverted: "reverted", expired: "expired" };

/** Days left on a trial (nil when not trialing). */
export function daysLeft(e, now = Date.now()) {
  if (e.status !== "trialing" || e.expiresAt == null) return null;
  return Math.max(0, Math.ceil((e.expiresAt - now) / 86_400_000));
}

export function statusLine(e) {
  switch (e.status) {
    case "suggested": return "Suggested · awaiting decision";
    case "trialing": { const d = daysLeft(e); return d == null ? "Trial" : `Trial · ${d}d left on this device`; }
    case "reverted": return "Trial ended by you · still in review";
    case "expired": return "Trial reached its week · still in review";
    default: return "";
  }
}

/** The variants this build knows how to try. Presentation-only, always. */
export const Variants = {
  focusHome: "focus-home",
  matches(text, surface) {
    const folded = String(text ?? "").toLowerCase();
    const focusWords = ["focus", "minimal", "simpl", "hide", "quiet", "clean", "less"];
    if ((surface === "Home" || folded.includes("home")) && focusWords.some((w) => folded.includes(w))) return Variants.focusHome;
    return null;
  },
};

/** The one variant the preview ships (docs/FEEDBACK-MODE.md): Focus Home,
 *  suggested and ready to trial. Production seeds nothing. */
const FOCUS_HOME_SEED = {
  id: "exp-focus-home", title: "Focus Home", detail: "Hide Home's ARTIFACTS and RECENT sections so the floor stays quiet while agents work.",
  surface: "Home", flag: Variants.focusHome, status: "suggested", startedAt: null, expiresAt: null, sentAt: 0,
};
export function seedExperiments(store) {
  if (store.experiments != null) return;
  store.setExperiments(store.configuration.feedbackExperimentsEnabled ? [FOCUS_HOME_SEED] : []);
}

// ----------------------------------------------------- floating bubble

/** The feedback door — only exists while the program is on AND this device
 *  opted in. Quiet, corner, never over the session plane. The Swift app mounts
 *  it on Home (HomeView.swift) while not in a call; here it rides Profile. */
export function FeedbackBubble() {
  const store = useObservable(ctx.store);
  if (!store.feedbackAvailable || store.inCall) return null;
  return html`<button type="button" class="pf-bubble pressable" aria-label="Design with Cline" title="Suggest a feature — chat stays on this device" onClick=${() => ctx.nav.present("feedbackChat")}>
    <${ClineBot} size=${22} color="#fff" />
  </button>`;
}

// ------------------------------------------------------- design chat

const SURFACES = ["Home", "Work", "Agents", "Tasks", "Profile", "Artifacts"];
let msgCounter = 0;
const msg = (fromCline, text) => ({ id: `fb-${++msgCounter}`, fromCline, text });

/** Chat with Cline to shape a suggestion. The conversation is ephemeral —
 *  in memory, gone when the sheet closes. Only the structured draft leaves,
 *  and only on an explicit Send. (Cline here is a rule-based design persona
 *  in the preview build; the honesty chrome says so.) */
export function FeedbackChatView() {
  const store = useObservable(ctx.store);
  const [messages, setMessages] = useState(() => [msg(true, "What should Drive do better? Describe it like you'd tell a friend — I'll shape it into a proposal you can send.")]);
  const [input, setInput] = useState("");
  const [surface, setSurface] = useState("Home");
  const [draftTitle, setDraftTitle] = useState(null);
  const [draftSummary, setDraftSummary] = useState("");
  const [sent, setSent] = useState(false);
  const scrollRef = useRef();
  const matchedFlag = Variants.matches(draftSummary, surface);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, draftTitle, sent]);

  const receive = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const next = [...messages, msg(false, text)];
    if (draftTitle == null) {
      const words = text.split(/\s+/).slice(0, 7).join(" ");
      setDraftTitle(words.charAt(0).toUpperCase() + words.slice(1));
      setDraftSummary(text);
      const trialNote = Variants.matches(text, surface) ? " This one maps to a variant I can switch on right now if you want to feel it for a week." : "";
      next.push(msg(true, `Got it — here's how I'd pitch it. Pick which screen it's about, add anything, then send.${trialNote}`));
    } else {
      setDraftSummary((s) => `${s} ${text}`);
      next.push(msg(true, "Folded that in."));
    }
    setMessages(next);
  };

  const send = (trial) => {
    if (!draftTitle) return;
    const flag = matchedFlag;
    store.submitSuggestion({ title: draftTitle, summary: draftSummary, surface, flag });
    if (trial && flag && store.experiments?.[0]) store.startTrial(store.experiments[0].id);
    setSent(true);
    haptic("success");
    setTimeout(() => ctx.nav.dismiss(), 1100);
  };

  return html`<div class="pf-chat">
    <${NavBar} title="Design with Cline" leading=${html`<${Button} variant="ghost" size="sm" onClick=${() => ctx.nav.dismiss()}>Close</${Button}>`} />
    <div class="pf-honesty"><i class="dot" />CHAT STAYS ON THIS DEVICE · ONLY WHAT YOU SEND LEAVES</div>
    <div class="pf-msgs" ref=${scrollRef} aria-live="polite">
      ${messages.map((m) => html`<div key=${m.id} class=${cx("pf-msg", !m.fromCline && "me")}>
        ${m.fromCline ? html`<${AvatarChip} letter="C" name="Cline" color=${agentColor("coder")} size=${24} />` : null}
        <div class="pf-mbody">${m.text}</div>
      </div>`)}
      ${draftTitle != null ? html`<${Card} hero className="pf-draft pop-in" style=${{ marginTop: 6 }}>
        <div class="hstack" style=${{ justifyContent: "space-between" }}><${Eyebrow}>YOUR PROPOSAL</${Eyebrow}><span class="pf-dsurf">${surface}</span></div>
        <div class="pf-dtitle" style=${{ marginTop: 8 }}>${draftTitle}</div>
        <div class="pf-dsum" style=${{ marginTop: 6 }}>${draftSummary}</div>
        ${sent ? html`<div class="hstack" style=${{ gap: 7, marginTop: 10 }}><${Icon} name="checkmark.circle.fill" size=${16} fill color="var(--live)" /><span class="t-sm w6 ink78">Sent — track it in Settings → Feedback & experiments.</span></div>`
        : html`<div>
          <div class="hstack" style=${{ gap: 9, marginTop: 12 }}>
            <${Button} variant="gradient" fill onClick=${() => send(false)} style=${{ minHeight: 40, fontSize: 13 }}>Send suggestion</${Button}>
            ${matchedFlag ? html`<${Button} fill onClick=${() => send(true)} style=${{ minHeight: 40, fontSize: 13, color: "var(--violet-text)", background: "color-mix(in srgb, var(--violet) 10%, transparent)", boxShadow: "none" }}>Try it for a week</${Button}>` : null}
          </div>
          ${matchedFlag ? html`<div class="t-xs muted" style=${{ marginTop: 8, fontSize: 10, lineHeight: 1.4 }}>This one maps to a built variant (Focus Home) — trying it flips the flag on this device only, for 7 days, revertible any time.</div>` : null}
        </div>`}
      </${Card}>` : null}
    </div>
    <div class="pf-chips" role="radiogroup" aria-label="Which screen this is about">
      <span class="pf-about">About:</span>
      ${SURFACES.map((s) => html`<button key=${s} type="button" role="radio" aria-checked=${surface === s} class=${cx(surface === s && "on")} onClick=${() => { haptic("light"); setSurface(s); }}>${s}</button>`)}
    </div>
    <div class="pf-inputbar">
      <${TextField} value=${input} onInput=${setInput} placeholder="Describe the feature you'd want…" multiline rows=${1} clearable=${false} onSubmit=${receive} label="Message" autoFocus />
      <button type="button" class="pf-send pressable" aria-label="Send message" disabled=${!input.trim()} onClick=${receive}><${Icon} name="arrow.up" size=${16} weight=${3} /></button>
    </div>
  </div>`;
}

// ---------------------------------------------------- settings section

/** FEEDBACK & EXPERIMENTS — both switches, the experiment list, and the
 *  consent gate. Lives inside Configuration settings. */
export function FeedbackSettingsSection() {
  const store = useObservable(ctx.store);
  const experiments = store.experiments ?? [];
  const setOptIn = (wantsOn) => {
    // Turning ON routes through the policy screen; OFF is immediate.
    if (wantsOn) ctx.nav.present("policy", { kind: "feedback", consenting: true });
    else store.setFeedbackOptIn(false);
  };
  return html`<div>
    <${SectionLabel}>FEEDBACK & EXPERIMENTS</${SectionLabel}>
    <div class="card" style=${{ overflow: "hidden", padding: 0 }}>
      <${ToggleRow} title="Feedback program" checked=${store.feedbackProgramOn} onChange=${(v) => store.setFeedbackProgramOn(v)} />
      <${Row} title="Feedback mode" trailing=${html`<${Toggle} checked=${store.feedbackOptIn} onChange=${setOptIn} label="Feedback mode" disabled=${!store.feedbackProgramOn} />`} />
      ${store.feedbackAvailable ? html`<${Row} leading=${html`<${AvatarChip} letter="C" name="Cline" color=${agentColor("coder")} size=${24} />`} title=${html`<span class="violet" style=${{ fontWeight: 500 }}>Suggest something</span>`} trailing=${html`<${Icon} name="bubble.left.and.text.bubble.right" size=${14} color="var(--ink-35)" />`} onClick=${() => ctx.nav.present("feedbackChat")} label="Suggest something" />` : null}
      ${experiments.map((e) => html`<${ExperimentRow} key=${e.id} experiment=${e} store=${store} />`)}
    </div>
    <${Footnote}>${store.feedbackProgramOn
      ? "Two switches: the program (ours) and feedback mode (yours). Trials are look-and-feel only, live 7 days max on this device, and revert any time. Preview build: you hold both switches."
      : "Program off — feedback UI hidden everywhere, trials reverted, opt-in cleared."}</${Footnote}>
  </div>`;
}

function ExperimentRow({ experiment: e, store }) {
  const trialing = e.status === "trialing";
  return html`<div>
    <${Hairline} />
    <div class=${cx("pf-exp", trialing && "trialing")}>
      <span class="pf-exp-icon"><${Icon} name="flask.fill" size=${14} weight=${2.2} fill=${trialing} /></span>
      <div class="grow">
        <div class="pf-exp-title">${e.title}</div>
        <div class="pf-exp-status">${statusLine(e)}</div>
      </div>
      ${trialing ? html`<button type="button" class="pf-pill-btn pressable" onClick=${() => { haptic("light"); store.endTrial(e.id); }}>End trial</button>`
      : e.status === "suggested" && e.flag ? html`<button type="button" class="pf-pill-btn violet pressable" onClick=${() => { haptic("light"); store.startTrial(e.id); }}>Try for a week</button>` : null}
    </div>
  </div>`;
}
