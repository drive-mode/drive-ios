// ApprovalView.swift — the approval sheet is intentionally light even over the
// dark call: sheet · one decision · clear code. app.js presents it as a medium,
// light sheet when `store.showApproval` flips; Deny/Allow decide and dismiss.
import { html, useEffect, useObservable } from "../../ui.js";
import { DiffLine } from "../../components.js";
import { ctx } from "./shared.js";

const LINES = ["+ export function requireAuth()", "+   verifyJwt(req)", "+   next()"];

export function ApprovalView() {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;

  // A swipe-down mirrors `.sheet(isPresented:)` — the binding goes false.
  useEffect(() => () => { if (ctx.store.showApproval) ctx.store.set({ showApproval: false }); }, []);

  const decide = (allow) => {
    if (allow) s.allowEdit(); else s.denyEdit();
    nav.dismiss();
  };

  return html`<div class="ap" data-surface="approval" role="document" aria-labelledby="ap-title">
    <h2 id="ap-title">Approve change?</h2>
    <div class="who">Cline wants to edit <span class="file">auth.ts</span></div>
    <div class="diff" role="group" aria-label="Proposed change, 3 added lines">
      ${LINES.map((t) => html`<${DiffLine} key=${t} text=${t} added />`)}
    </div>
    <div class="stats" aria-label="12 additions, 3 deletions, auth.ts, branch drive/auth">
      <span><span class="plus">+12</span> <span class="minus">−3</span></span>
      <span>auth.ts</span>
      <span>branch drive/auth</span>
    </div>
    <div class="btns">
      <button class="deny" onClick=${() => decide(false)}>Deny</button>
      <button class="allow" onClick=${() => decide(true)}>Allow</button>
    </div>
    <div class="foot">Nothing lands without you — every edit is yours to allow.</div>
  </div>`;
}
