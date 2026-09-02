// Presenter title views — a port of the view half of `Sources/AgentTitles.swift`
// (`PresenterTitleControl`, `PresenterControlSheet`). The store half (grants,
// transfer, revocation, receipts) lives in store.js.
//
// A grant is a reference-only capability envelope: this UI shows the agent,
// the scope, the expiry and the counts of opaque refs — never skill or prompt
// contents, which stay signed and non-exportable on the host.
import { html, cx, useTick, useObservable } from "../../ui.js";
import { Icon, AvatarChip, NavBar, Eyebrow } from "../../components.js";
import { nav } from "../../nav.js";
import { DIRECTOR_POLICY } from "../../models.js";
import { injectStyle, CheckCircle } from "./shared.js";

let store = null;
export function bindAgentTitles(ctx) { store = ctx.store; }

injectStyle("work-css-titles", `
.pt-chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
  color: rgba(var(--ink-rgb), .88); background: var(--surface); box-shadow: inset 0 0 0 0.8px var(--hairline); white-space: nowrap; }
.pt-chip.compact { height: 28px; padding: 0 9px; font-size: 10.5px; }
.pt-chip.unclaimed { color: var(--violet-text); }
.pt-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pt-card .head { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; }
.pt-card .holder { margin-left: auto; font-size: 13px; font-weight: 700; color: var(--violet-text); }
.pt-card .meta { font-family: var(--mono); font-size: 11px; color: var(--ink-55); }
.pt-card .refs { font-size: 10.5px; color: var(--ink-55); }
.pt-card .body { font-size: 11.5px; color: var(--ink-55); line-height: 1.4; }
.pt-card .boundary { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 600; color: var(--ink-55); }
.pt-revoke { align-self: flex-start; min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; margin: -6px 0 -6px -12px; border-radius: var(--r-control); font-size: 12px; font-weight: 700; color: var(--danger); }
.pt-agent { display: flex; align-items: center; gap: 11px; width: 100%; padding: 12px; text-align: left; color: var(--ink); min-height: 54px; }
.pt-agent + .pt-agent { box-shadow: inset 0 0.8px 0 var(--hairline); }
.pt-agent:active { background: var(--surface2); }
.pt-agent .n { font-size: 13.5px; font-weight: 700; }
.pt-agent .s { font-size: 10.5px; color: var(--ink-55); margin-top: 2px; }
.pt-agent .ic { margin-left: auto; color: var(--violet); display: grid; flex: none; }
.pt-none { font-size: 12px; color: var(--ink-55); padding: 14px; line-height: 1.4; }
.pt-event { display: flex; align-items: center; gap: 9px; padding: 11px; font-size: 11.5px; font-weight: 600; min-height: 44px; }
.pt-event + .pt-event { box-shadow: inset 0 0.8px 0 var(--hairline); }
.pt-event .ic { color: var(--violet-text); display: grid; flex: none; }
.pt-event .when { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--ink-55); flex: none; }
.pt-event .why { color: var(--ink-35); font-weight: 500; }
.pt-director { padding: 14px; display: flex; flex-direction: column; gap: 7px; }
.pt-director .head { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; }
.pt-director .meta { font-family: var(--mono); font-size: 10.5px; color: var(--ink-55); }
.pt-director .body { font-size: 11.5px; color: var(--ink-55); line-height: 1.4; }
`);

const timeFmt = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

/** The chip in the live call: who holds Presenter right now (or "Assign Presenter"). */
export function PresenterTitleControl({ compact = false, className }) {
  const s = useObservable(store ?? window.drive.store);
  const agent = s.activePresenterAgent;
  return html`<button type="button" class=${cx("pt-chip pressable", compact && "compact", !agent && "unclaimed", className)}
    onClick=${() => nav.present("presenterControl")}
    aria-label=${agent ? `Presenter, ${agent.name}` : "Assign Presenter"} title="Opens the temporary title grant, transfer, and audit controls">
    <${Icon} name="rectangle.inset.filled.and.person.filled" size=${compact ? 11 : 12} weight=${2.4} />
    <span>${agent ? `Presenter · ${agent.name}` : "Assign Presenter"}</span>
  </button>`;
}

function GrantExpiry({ grant }) {
  useTick(1);
  const seconds = Math.max(0, Math.floor((grant.expiresAt - Date.now()) / 1000));
  return html`<div class="meta">Expires in ${Math.floor(seconds / 60)}m ${seconds % 60}s · ${grant.scope.kind} scope</div>`;
}

function eventLabel(s, r) {
  const name = (id) => (id ? s.displayNameForAgent(id) : "Agent");
  switch (r.kind) {
    case "granted": return `Granted to ${name(r.toAgentId)}`;
    case "transferred": return `${name(r.fromAgentId)} → ${name(r.toAgentId)}`;
    case "revoked": return `Revoked from ${name(r.fromAgentId)}`;
    default: return r.kind;
  }
}
const EVENT_ICON = { granted: "plus.circle", transferred: "arrow.left.arrow.right.circle", revoked: "xmark.circle" };

/** Route "presenterControl" — the grant, transfer, revoke and audit sheet. */
export function PresenterControlSheet() {
  const s = useObservable(store ?? window.drive.store);
  const grant = s.activePresenterGrant;
  const holder = s.activePresenterAgent;
  const eligible = s.presenterEligibleAgents;
  const events = s.titleEventLog.slice(-8).reverse();
  return html`<div class="wk-sheet">
    <${NavBar} title="Presenter" trailing=${html`<button class="btn ghost sm" onClick=${() => nav.dismiss()}>Done</button>`} />
    <div class="scroll"><div class="content vstack" style=${{ "--gap": "18px", paddingTop: 4 }}>
      <div class="card pt-card">
        <div class="head"><${Icon} name="rectangle.inset.filled.and.person.filled" size=${16} weight=${2.3} /> Presenter
          <span class="holder">${holder?.name ?? "Unassigned"}</span></div>
        ${grant ? html`
          <${GrantExpiry} grant=${grant} />
          <div class="refs">${grant.skillBundleRefs.length} skill bundle ref · ${grant.resourceGrantRefs.length} resource ref · ${grant.permissions.join(", ")}</div>
          <button type="button" class="pt-revoke pressable" onClick=${() => s.revokePresenter()}>Revoke Presenter</button>
        ` : html`<div class="body">Only one agent can own the typed stage. Assigning creates a temporary, replayable event.</div>`}
        <div class="boundary"><${Icon} name="rectangle.on.rectangle.slash" size=${13} weight=${2.2} /> Typed work only — no device screen, camera, or pixel stream</div>
      </div>

      <div>
        <${Eyebrow} style=${{ padding: "0 4px 8px" }}>ELIGIBLE AGENTS</${Eyebrow}>
        <div class="card" style=${{ overflow: "hidden" }}>
          ${eligible.map((agent) => {
            const holds = grant?.agentId === agent.id;
            return html`<button key=${agent.id} type="button" class="pt-agent" onClick=${() => s.requestPresenter(agent.id)}
              aria-label=${holds ? `${agent.name}, current Presenter` : `${grant ? "Transfer Presenter to" : "Grant Presenter to"} ${agent.name}`}>
              <${AvatarChip} name=${agent.name} color=${agent.color} size=${30} />
              <div><div class="n">${agent.name}</div><div class="s">Temporary typed-stage permission</div></div>
              <span class="ic">${holds ? html`<${CheckCircle} on size=${18} />` : html`<${Icon} name="arrow.left.arrow.right.circle" size=${18} />`}</span>
            </button>`;
          })}
          ${!eligible.length ? html`<div class="pt-none">No Presenter candidates were allowed by this call preset.</div>` : null}
        </div>
      </div>

      <div class="card pt-director">
        <div class="head"><${Icon} name="checkmark.shield" size=${15} weight=${2.3} /> Director policy boundary</div>
        <div class="meta">${DIRECTOR_POLICY.version} · ${DIRECTOR_POLICY.signatureStatus} · ${DIRECTOR_POLICY.exportable ? "Exportable" : "Host-only · not exportable"}</div>
        <div class="body">The title passes opaque bundle and resource references. Prompts, routing, tools, scoring, and model configuration stay signed and non-exportable on the host.</div>
      </div>

      ${events.length ? html`<div>
        <${Eyebrow} style=${{ padding: "0 4px 8px" }}>TITLE EVENTS</${Eyebrow}>
        <div class="card" style=${{ overflow: "hidden" }}>
          ${events.map((r) => html`<div key=${r.id} class="pt-event">
            <span class="ic"><${Icon} name=${EVENT_ICON[r.kind] ?? "circle"} size=${16} /></span>
            <span>${eventLabel(s, r)}${r.reason ? html` <span class="why">· ${r.reason}</span>` : null}</span>
            <span class="when">${timeFmt.format(r.at)}</span>
          </div>`)}
        </div>
      </div>` : null}

      ${s.titleMutationError ? html`<div class="wk-error" role="alert"><${Icon} name="exclamationmark.triangle" size=${14} weight=${2.3} /> ${s.titleMutationError}</div>` : null}
    </div></div>
  </div>`;
}
