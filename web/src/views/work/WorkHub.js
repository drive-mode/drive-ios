// The Work root — a port of `Sources/WorkHub.swift` (`CallTabView` is the
// chat-first root in that file, plus `WorkTargetPickerView`,
// `CallConfiguratorView`, `WorkHistoryView`). Chat is the primary surface;
// calls and lifecycle records stay reachable without crowding the composer.
//
// The displayed target is never authorization: a `WorkTargetRef` carries an
// opaque host-resolved reference, and no credential or raw device path is
// rendered or sent. A target that can't be used disables the composer and
// says why.
import { html, cx, useState, useEffect, useRef, useObservable, haptic } from "../../ui.js";
import { Icon, NavBar, HomeToolbarButton, IconButton, Empty, Eyebrow, ToggleRow, showMenu } from "../../components.js";
import { nav } from "../../nav.js";
import { prefs } from "../../prefs.js";
import { WORK_TARGET_KIND, ACCESS_POSTURE, CONNECTION_STATE, targetCanUse, presetCanLaunch, resolveCallLaunch } from "../../models.js";
import { injectStyle, CheckCircle, BackButton } from "./shared.js";
import { SessionRecordCard } from "./CallTabView.js";

let store = null;
export function bindWorkHub(ctx) { store = ctx.store; }

injectStyle("work-css-hub", `
.wh-header { display: flex; align-items: center; gap: 8px; padding: 9px 14px; flex: none; position: relative; z-index: 4;
  background: color-mix(in srgb, var(--page) 86%, transparent); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4); box-shadow: 0 0.5px 0 var(--hairline); }
.wh-target { display: flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 12px; border-radius: 999px; background: var(--surface2); color: var(--ink-78); min-width: 0; flex: 0 1 auto; text-align: left; }
.wh-target .name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; line-height: 1.2; }
.wh-target .state { font-size: 9.5px; font-weight: 600; color: var(--live); line-height: 1.2; }
.wh-hbtn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; flex: none;
  color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.wh-hbtn.prominent { color: #fff; background: var(--hero-gradient); }
.wh-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; display: flex; flex-direction: column; overscroll-behavior: contain; }
.wh-body::-webkit-scrollbar { display: none; }
.wh-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px 28px; text-align: center; min-height: 100%; }
.wh-empty .glyph { width: 54px; height: 54px; border-radius: 17px; display: grid; place-items: center; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.wh-empty .t { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.2; }
.wh-empty .loc { font-size: 12px; font-weight: 600; color: var(--ink-55); margin-top: 6px; }
.wh-empty .kind { font-size: 10.5px; color: var(--ink-35); margin-top: 6px; }
.wh-empty .why { font-size: 11.5px; font-weight: 600; color: var(--ink-55); margin-top: 10px; line-height: 1.4; max-width: 280px; }
.wh-empty .pick { min-height: 44px; padding: 0 14px; font-size: 12px; font-weight: 700; color: var(--violet-text); border-radius: var(--r-control); }
.wh-thread { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; padding: 16px; }
.wh-bubble { max-width: 300px; padding: 11px 14px; border-radius: 16px; background: var(--hero-gradient); color: #fff; font-size: 14px; line-height: 1.35; word-break: break-word; animation: bounceIn .3s var(--spring); }
.wh-composer { display: flex; align-items: flex-end; gap: 10px; padding: 10px 14px 8px; flex: none; transition: padding-bottom .3s var(--ease);
  background: color-mix(in srgb, var(--page) 86%, transparent); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4); box-shadow: 0 -0.5px 0 var(--hairline); }
.wh-input { flex: 1; min-width: 0; min-height: 44px; max-height: 122px; padding: 11px 13px; border-radius: 18px; background: var(--surface2); font-size: 14px; line-height: 1.35; resize: none; border: 0; color: var(--ink); }
.wh-input::placeholder { color: var(--ink-35); }
.wh-input:focus { box-shadow: inset 0 0 0 1.4px var(--violet); }
.wh-input:disabled { color: var(--ink-35); }
.wh-send { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; flex: none; color: #fff; background: var(--ink-35); transition: background .15s, transform .28s var(--spring); }
.wh-send.ready { background: var(--violet); }
.wh-send:disabled { cursor: default; }
.tp-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left; color: var(--ink); min-height: 64px; }
.tp-row + .tp-row { box-shadow: inset 0 0.8px 0 var(--hairline); }
.tp-row:not([aria-disabled="true"]):active { background: var(--surface2); }
.tp-row .ic { width: 30px; display: grid; place-items: center; color: var(--violet-text); flex: none; }
.tp-row .n { font-size: 14px; font-weight: 700; }
.tp-row .l { font-size: 11px; color: var(--ink-55); margin-top: 3px; }
.tp-row .st { font-size: 10px; font-weight: 600; margin-top: 3px; color: var(--ink-55); }
.tp-row .st.ok { color: var(--live); }
.tp-row .chk { margin-left: auto; color: var(--violet); display: grid; flex: none; }
.cc-unavail { padding: 8px 0 4px; }
`);

const HELP_BY_STATE = {
  permissionRequired: "Permission required — grant access with the system picker before sending.",
  disconnected: "Target disconnected — context is read-only until it reconnects.",
  unavailable: "No repository or folder connected — choose a work target first.",
};
function honestReason(target) {
  if (target.accessPosture === "permissionRequired" && target.connectionState === "connected") return HELP_BY_STATE.permissionRequired;
  return HELP_BY_STATE[target.connectionState] ?? HELP_BY_STATE.permissionRequired;
}

/** The saved preset for this target, named by Settings → Calls when a name was given. */
function selectedCallPreset(s) {
  const preset = s.callPresetForCurrentTarget;
  const name = String(prefs.get("call.defaultPreset", "") ?? "").trim();
  return name ? { ...preset, name } : preset;
}

function beginCall(s) {
  const preset = selectedCallPreset(s);
  const decision = resolveCallLaunch(prefs.get("call.launchBehavior", "Configure each call"), preset);
  if (decision === "launchDefault") {
    if (!s.launchCall(preset, false)) nav.toast("Call unavailable — connect a target and an agent", { icon: "phone.down" });
  } else {
    nav.present("callConfigurator", { preset }, { detent: "large" });
  }
}

// ------------------------------------------------------------ Work root

/** Route "work" — chat first, calls when useful. */
export function WorkRoot() {
  const s = useObservable(store ?? window.drive.store);
  const [composer, setComposer] = useState("");
  const inputRef = useRef();
  const bodyRef = useRef();
  const target = s.selectedWorkTarget;
  const canUse = targetCanUse(target);
  const kind = WORK_TARGET_KIND[target.kind] ?? WORK_TARGET_KIND.directory;
  const anyUsable = s.workTargets.some(targetCanUse);
  const ready = composer.trim().length > 0 && canUse;

  useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [s.workChatMessages.length]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(122, el.scrollHeight)}px`; }, [composer]);

  const send = () => { if (!s.sendWorkChat(composer)) return; setComposer(""); haptic("light"); inputRef.current?.focus(); };
  const openMenu = (e) => showMenu(e, [
    { label: "Calls", icon: "phone", onSelect: () => nav.push("workCalls") },
    { label: "History", icon: "clock.arrow.circlepath", onSelect: () => nav.push("workHistory") },
    { label: "Settings", icon: "gearshape", onSelect: () => s.openSettings("Calls", "work") },
  ], { title: "Work" });

  return html`<div class="screen">
    <${NavBar} title="Work" leading=${html`<${HomeToolbarButton} />`} trailing=${html`<${IconButton} name="ellipsis.circle" plain label="Work menu" onClick=${openMenu} />`} />
    <div class="wh-header">
      <button type="button" class="wh-target pressable" onClick=${() => nav.present("targetPicker", {}, { detent: "medium" })}
        aria-label=${`Work target, ${target.displayName}`} title="Choose a repository, folder, or saved file set">
        <${Icon} name=${kind.symbol} size=${15} weight=${2.2} />
        <span style=${{ minWidth: 0 }}>
          <div class="name">${canUse ? target.displayName : "Target"}</div>
          ${canUse ? html`<div class="state">${CONNECTION_STATE[target.connectionState]}</div>` : null}
        </span>
        <${Icon} name="chevron.down" size=${11} weight=${3} />
      </button>
      <div class="grow" style=${{ minWidth: 4 }} />
      <button type="button" class="wh-hbtn pressable" onClick=${() => { s.startNewWorkChat(); setComposer(""); inputRef.current?.focus(); }} title="Clears this local conversation and starts a new chat">
        <${Icon} name="square.and.pencil" size=${13} weight=${2.4} /> New Chat
      </button>
      <button type="button" class="wh-hbtn prominent pressable" onClick=${() => beginCall(s)} title="Starts the default call or opens call configuration">
        <${Icon} name="phone.fill" size=${13} weight=${2.4} fill /> Call
      </button>
    </div>
    <div class="wh-body" ref=${bodyRef}>
      ${s.workChatMessages.length ? html`<div class="wh-thread">
        ${s.workChatMessages.map((m) => html`<div key=${m.id} class="wh-bubble" aria-label=${`You: ${m.text}`}>${m.text}</div>`)}
      </div>` : html`<div class="wh-empty fade-in">
        <div class="glyph"><${Icon} name=${kind.symbol} size=${26} weight=${2.2} /></div>
        <div>
          <div class="t">Start with ${target.displayName}</div>
          <div class="loc">${target.displayLocation}</div>
          <div class="kind">${kind.label} · ${ACCESS_POSTURE[target.accessPosture]}</div>
          ${!canUse ? html`<div class="why">${honestReason(target)}</div>` : null}
        </div>
        ${!canUse ? html`<button type="button" class="pick pressable" onClick=${() => nav.present("targetPicker", {}, { detent: "medium" })}>${anyUsable ? "Choose an available target" : "View target connection status"}</button>` : null}
      </div>`}
    </div>
    <div class="wh-composer" style=${{ paddingBottom: s.tabBarVisible ? "calc(var(--tabbar-h) + var(--safe-bottom) + 8px)" : "calc(var(--safe-bottom) + 8px)" }}>
      <textarea ref=${inputRef} class="wh-input" rows="1" value=${composer} disabled=${!canUse}
        placeholder=${canUse ? `Message ${target.displayName}` : honestReason(target)}
        aria-label=${canUse ? `Message ${target.displayName}` : `Composer unavailable. ${honestReason(target)}`}
        onInput=${(e) => setComposer(e.target.value)}
        onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <button type="button" class=${cx("wh-send pressable", ready && "ready")} disabled=${!ready} onClick=${send} aria-label="Send message"><${Icon} name="arrow.up" size=${17} weight=${2.8} /></button>
    </div>
  </div>`;
}

// -------------------------------------------------------- target picker

/** Route "targetPicker" — the compact target sheet (medium / large). */
export function WorkTargetPickerView() {
  const s = useObservable(store ?? window.drive.store);
  const anyUsable = s.workTargets.some(targetCanUse);
  return html`<div class="wk-sheet">
    <${NavBar} title="Work target" trailing=${html`<button class="btn ghost sm" onClick=${() => nav.dismiss()}>Done</button>`} />
    <div class="scroll"><div class="content" style=${{ paddingTop: 4 }}>
      <div class="card" style=${{ overflow: "hidden" }} role="listbox" aria-label="Work targets">
        ${s.workTargets.map((t) => {
          const ok = targetCanUse(t);
          const kind = WORK_TARGET_KIND[t.kind] ?? WORK_TARGET_KIND.directory;
          const selected = s.selectedWorkTargetID === t.id;
          return html`<button key=${t.id} type="button" class="tp-row" role="option" aria-selected=${selected} aria-disabled=${!ok}
            onClick=${() => { if (!ok) return; haptic("light"); s.selectWorkTarget(t.id); nav.dismiss(); }}>
            <span class="ic"><${Icon} name=${kind.symbol} size=${18} weight=${2.2} /></span>
            <span style=${{ minWidth: 0 }}>
              <div class="n">${t.displayName}</div>
              <div class="l">${t.displayLocation}</div>
              <div class=${cx("st", ok && "ok")}>${ACCESS_POSTURE[t.accessPosture]} · ${CONNECTION_STATE[t.connectionState]}</div>
            </span>
            ${selected ? html`<span class="chk"><${CheckCircle} on size=${20} /></span>` : null}
          </button>`;
        })}
      </div>
      ${!anyUsable ? html`<${Empty} icon="folder.badge.questionmark" title="No targets available" body="A connected host or security-scoped folder grant is required." />` : null}
    </div></div>
  </div>`;
}

// ------------------------------------------------------ call configurator

function SelectionRow({ title, subtitle, selected, onToggle }) {
  return html`<button type="button" class="wk-select-row pressable" role="checkbox" aria-checked=${selected} onClick=${() => { haptic("light"); onToggle(); }}>
    <${CheckCircle} on=${selected} size=${20} />
    <span style=${{ minWidth: 0 }}><div class="t">${title}</div><div class="s">${subtitle}</div></span>
  </button>`;
}

/**
 * Route "callConfigurator". Feature-isolated: it passes only opaque target and
 * agent references back to the host; Presenter grants are issued later by the
 * title protocol, never embedded in the preset.
 */
export function CallConfiguratorView({ params }) {
  const s = useObservable(store ?? window.drive.store);
  const [draft, setDraft] = useState(() => {
    const p = params?.preset ?? selectedCallPreset(s);
    return { ...p, targetIDs: [...p.targetIDs], agentIDs: [...p.agentIDs], presenterCandidateIDs: [...p.presenterCandidateIDs] };
  });
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const usable = s.workTargets.filter(targetCanUse);
  const unavailable = !usable.length || !s.agents.length;
  const toggle = (key, id) => setDraft((d) => {
    const list = d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id];
    const next = { ...d, [key]: list };
    if (key === "agentIDs" && !list.includes(id)) next.presenterCandidateIDs = d.presenterCandidateIDs.filter((x) => x !== id);
    return next;
  });
  const start = () => {
    const launched = s.launchCall(draft, saveAsDefault);
    nav.dismiss();
    if (!launched) nav.toast("Call unavailable — connect a target and an agent", { icon: "phone.down" });
  };
  const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  return html`<div class="wk-sheet">
    <${NavBar} title="Configure call" leading=${html`<button class="btn ghost sm" onClick=${() => nav.dismiss()}>Cancel</button>`} />
    <div class="scroll"><div class="content vstack" style=${{ "--gap": "18px", paddingTop: 4 }}>
      ${unavailable ? html`<div class="cc-unavail"><${Empty} icon="phone.down" title="Call unavailable" body="Connect a work target and an approved agent roster before starting a call." /></div>` : null}
      <div>
        <${Eyebrow} style=${{ padding: "0 4px 8px" }}>TARGETS</${Eyebrow}>
        <div class="card" style=${{ overflow: "hidden" }}>
          ${usable.map((t) => html`<${SelectionRow} key=${t.id} title=${t.displayName} subtitle=${t.displayLocation} selected=${draft.targetIDs.includes(t.id)} onToggle=${() => toggle("targetIDs", t.id)} />`)}
          ${!usable.length ? html`<div class="wk-note" style=${{ padding: 14 }}>No usable targets yet.</div>` : null}
        </div>
      </div>
      <div>
        <${Eyebrow} style=${{ padding: "0 4px 8px" }}>AGENTS</${Eyebrow}>
        <div class="card" style=${{ overflow: "hidden" }}>
          ${s.agents.map((a) => html`<${SelectionRow} key=${a.id} title=${a.name} subtitle=${cap(a.role)} selected=${draft.agentIDs.includes(a.id)} onToggle=${() => toggle("agentIDs", a.id)} />`)}
          ${!s.agents.length ? html`<div class="wk-note" style=${{ padding: 14 }}>No approved agent roster is connected.</div>` : null}
        </div>
      </div>
      <div>
        <${Eyebrow} style=${{ padding: "0 4px 8px" }}>PRESENTATION PERMISSIONS</${Eyebrow}>
        <div class="card" style=${{ overflow: "hidden" }}>
          ${s.agents.filter((a) => draft.agentIDs.includes(a.id)).map((a) => html`<${SelectionRow} key=${a.id} title=${`${a.name} may be Presenter`} subtitle="Generated typed stage only — no screen or pixel capture" selected=${draft.presenterCandidateIDs.includes(a.id)} onToggle=${() => toggle("presenterCandidateIDs", a.id)} />`)}
          ${!draft.agentIDs.length ? html`<div class="wk-note" style=${{ padding: 14 }}>Pick at least one agent to choose who may present.</div>` : null}
        </div>
      </div>
      <div class="card" style=${{ overflow: "hidden" }}><${ToggleRow} title="Use as default call preset" checked=${saveAsDefault} onChange=${setSaveAsDefault} violet /></div>
      <button type="button" class="wk-grad-btn pressable" style=${{ minHeight: 48, fontSize: 15 }} disabled=${!presetCanLaunch(draft)} onClick=${start}>
        <${Icon} name="phone.fill" size=${16} weight=${2.4} fill /> Start call
      </button>
    </div></div>
  </div>`;
}

// --------------------------------------------------------------- history

/** Route "workHistory" — replayable session records and their memory hooks. */
export function WorkHistoryView() {
  const s = useObservable(store ?? window.drive.store);
  const wire = s.usesWireSessionRegistry ? (s.wireEndedSessions ?? []) : [];
  const replays = s.artifacts.filter((a) => a.kind === "Replay");
  const empty = !wire.length && !replays.length;
  return html`<div class="screen">
    <${NavBar} title="History" leading=${html`<${BackButton} />`} />
    <div class="scroll"><div class="content no-tabbar list" style=${{ paddingTop: 8 }}>
      ${empty ? html`<div style=${{ paddingTop: 60 }}><${Empty} icon="clock.arrow.circlepath" title="No call history" body=${s.configuration.previewContentEnabled ? "Sessions you join replay here as their directed program." : "History appears after an approved host supplies authenticated session records."} /></div>` : null}
      ${wire.map((rec) => html`<${SessionRecordCard} key=${rec.id} session=${rec} />`)}
      ${replays.map((r) => html`<${SessionRecordCard} key=${r.id} replay=${r} />`)}
    </div></div>
  </div>`;
}
