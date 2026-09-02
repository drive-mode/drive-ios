// NeedsYouView.swift — interrupt triage. Approval cards act inline
// (Deny/Allow); everything else opens the conversation. Plan reviews wait in
// a dashed "deferred" row. `NeedsYouRouter` (TasksView.swift) decides between
// the single open conversation and this list.
import { html, useObservable, useMemo } from "../../ui.js";
import { Screen, AvatarChip, Icon } from "../../components.js";
import { ctx, TabBarSpacer, stripAgentPrefix } from "./shared.js";
import { ConversationView } from "./ConversationView.js";

/** Routes "needs you" to the single open conversation, or the triage list. */
export function NeedsYouRouter({ params }) {
  // Decided once on entry — the page does not swap out from under a reply.
  const only = useMemo(() => {
    const open = ctx.store.openInterrupts;
    return open.length === 1 ? open[0].id : null;
  }, []);
  if (only) return html`<${ConversationView} params=${{ interruptId: only }} />`;
  return html`<${NeedsYouView} params=${params} />`;
}

export function NeedsYouView() {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;
  const open = s.interrupts.filter((i) => !i.resolved && i.kind !== "review");
  const deferred = s.interrupts.filter((i) => !i.resolved && i.kind === "review");
  const count = s.needsYouCount;

  return html`<${Screen} title="Needs you" back contentClass="hm-content"
    trailing=${count > 0 ? html`<span class="ny-count" role="status" aria-label=${`${count} need you`}>${count}</span>` : null}>
    <div data-surface="needsYou" aria-live="polite">
      ${open.length === 0 ? html`<div class="ny-empty fade-in">
        <${Icon} name="checkmark.circle" size=${34} weight=${1.4} color="var(--live)" />
        <div class="t-lg w7">Nothing needs you</div>
        <div class="t-sm muted">Everything else is working — ${s.reportingCount} agents reporting</div>
      </div>` : null}
      <div role="list" aria-label="Open interrupts">
        ${open.map((it) => html`<${InterruptCard} key=${it.id} interrupt=${it} store=${s} nav=${nav} />`)}
        ${deferred.map((it) => html`<${DeferredRow} key=${it.id} interrupt=${it} store=${s} />`)}
      </div>
    </div>
    <${TabBarSpacer} />
  </${Screen}>`;
}

function InterruptCard({ interrupt, store, nav }) {
  const openThread = () => nav.push("conversation", { interruptId: interrupt.id });
  return html`<article class="ny-card bounce-in" role="listitem" aria-label=${interrupt.title}>
    <button class="ny-head pressable" onClick=${openThread} aria-label=${`${interrupt.title}, ${interrupt.age} ago. Opens the conversation`}>
      <${AvatarChip} letter=${interrupt.agentName[0]} name=${interrupt.agentName} color=${interrupt.agentColor} size=${32} />
      <span class="t clamp2">${interrupt.title}</span>
      <span class="mono faint" style=${{ fontSize: 10 }}>${interrupt.age}</span>
      <${Icon} name="chevron.right" size=${13} weight=${2.6} color="var(--ink-35)" />
    </button>
    ${interrupt.kind === "approval" ? html`
      <div class="ny-diff" aria-label="Proposed change">${interrupt.detail.map((l) => html`<span key=${l}>${l}</span>`)}</div>
      <div class="ny-actions">
        <button class="ny-btn ghost pressable" onClick=${() => store.denyEdit()}>Deny</button>
        <button class="ny-btn solid pressable" onClick=${() => store.allowEdit()}>Allow</button>
      </div>` : html`
      ${interrupt.detail.map((l) => html`<div class="ny-quote" key=${l}><i aria-hidden="true" /><span>${l}</span></div>`)}
      <div class="ny-actions">
        <button class="ny-btn ghost pressable" onClick=${openThread}>Reply</button>
        <button class="ny-btn wash pressable" onClick=${() => store.joinCall()}>Join session</button>
      </div>`}
  </article>`;
}

function DeferredRow({ interrupt, store }) {
  return html`<div class="ny-deferred" role="listitem">
    <${AvatarChip} letter=${interrupt.agentName[0]} name=${interrupt.agentName} color=${interrupt.agentColor} size=${28} />
    <div class="t clamp2"><b>${interrupt.agentName}</b> · ${stripAgentPrefix(interrupt.title, interrupt.agentName)}</div>
    <button class="ny-open pressable" onClick=${() => store.resolveInterrupt(interrupt.id)} aria-label=${`Open ${interrupt.title}`}>Open</button>
  </div>`;
}
