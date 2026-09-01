// OpenView.swift — the brand hero and the one violet verb. Preview keeps its
// honesty chrome (PreviewChip, HonestyDots, the Apple stand-in); production
// shows none of that theater and says so in one line.
import { html, useObservable } from "../../ui.js";
import { DriveMark, PreviewChip, HonestyDots } from "../../components.js";
import { ctx } from "./shared.js";

export function OpenView() {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;
  const preview = s.configuration.previewContentEnabled;
  const live = s.hasLiveSession;

  const primary = () => {
    if (live) s.joinCall();
    else { s.launch(); nav.selectTab("home"); }
  };

  return html`<div class="op" data-surface="open">
    ${preview ? html`<${PreviewChip} />` : html`<div style=${{ height: 30 }} />`}
    <div style=${{ flex: 1, minHeight: 24 }} />

    <div class="mark-tile" aria-hidden="true"><${DriveMark} size=${54} wiggle /></div>
    <div class="wordmark">DRIVE</div>
    <h1>${preview ? "Talk to your" : "Work with your"}<br /><span class="verb">codebase</span></h1>
    <p class="lede">${preview
      ? "Watch agents ship while you steer —\nhold to talk, approve every edit."
      : "Choose a target and connect an approved host.\nNothing runs until you take action."}</p>

    <button class="cta pressable" onClick=${primary} aria-label=${live ? "Watch a live session" : "Open Drive"}>
      ${live ? "Watch a live session" : "Open Drive"}
    </button>
    ${preview ? html`<button class="alt pressable" onClick=${() => s.launch()}>Continue with Apple</button>` : null}
    ${preview ? html`<button class="invite pressable" onClick=${() => nav.toast("Invite links open a session directly — none on this device yet.", { icon: "link" })}>I have an invite link</button>` : null}

    <div style=${{ flex: 1, minHeight: 24 }} />
    ${preview
      ? html`<div class="foot" style=${{ paddingTop: 0 }}><${HonestyDots} /></div>`
      : html`<div class="foot" style=${{ paddingTop: 0 }}>No edits or file access without your action</div>`}
  </div>`;
}
