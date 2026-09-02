// A port of `Sources/PolicyViews.swift` — the in-app policy text (privacy,
// data, feedback mode). The feedback policy doubles as the consent gate:
// presented with `consenting: true` it adds Agree / Not now and is the only
// path that turns feedback mode on.
import { html, useObservable, haptic } from "../../ui.js";
import { Screen, NavBar, Eyebrow, Button, Empty } from "../../components.js";
import { ctx } from "./shared.js";

export const POLICIES = {
  privacy: {
    title: "Privacy policy",
    tagline: "Drive runs on your device and talks only to infrastructure you point it at. No ads, no selling, and what you say out loud is never stored — by design, not by promise.",
    blocks: [
      { heading: "Stays on your device", points: [
        "Preferences, pins, profile layout, notification and archive choices.",
        "Your intent model — the on-device guess at your next screen. Never uploaded, decays on its own.",
        "Experiment flags and their 7-day timers.",
      ] },
      { heading: "Never stored, anywhere", points: [
        "Voice audio and transcripts — conversation lives in memory during a session and is gone when it ends. Wire schemas reject transcript-shaped payloads.",
        "Your code, beyond the typed work events your agents deliberately publish. Events, never pixels; summaries, never files.",
        "Prompts, tool allowlists, API keys, model identifiers — these never cross between phone and host.",
      ] },
      { heading: "Leaves your device only when", points: [
        "Work events sync with your writer/hub — the address you configure, your infrastructure, your log.",
        "You explicitly send a feedback suggestion (see the Feedback mode policy).",
        "You sign in — the email, nothing else.",
        "You publish a showcase project or comment — explicit, friends-visible, and README/demo only: never source code.",
      ] },
      { heading: "Deletion", points: [
        "Deleting your account deletes account data and pending feedback submissions — real deletion, not archival.",
        "Work events live in your own infrastructure; they're yours to keep or purge, which is the point.",
      ] },
    ],
    footer: "Draft v0.3 · changes are announced in the Product inbox; widening any collection re-asks for consent. Drive is for people 13 and older.",
  },
  data: {
    title: "Data policy",
    tagline: "Every piece of data answers four questions — what it is, where it lives, whether it leaves, how long it stays. If a feature can't answer, it doesn't ship.",
    blocks: [
      { heading: "A · Device-local", points: ["Preferences, layouts, intent model, experiment timers. Never leave. Live until you change or delete them."] },
      { heading: "B · Work events", points: ["Typed room events your agents publish (tasks, artifacts, beats, invites). Flow only to your configured infrastructure; the in-app working set is capped and evicts shipped work first."] },
      { heading: "C · Feedback submissions", points: ["Only the structured suggestion you explicitly send: title, summary, surface, app version, active flags. Kept 90 days or until decided, then deleted."] },
      { heading: "D · Account", points: ["The sign-in email. Kept until account deletion."] },
      { heading: "E · Social (preview)", points: ["Published squares, READMEs, demos, comments, friend links. Publishing is explicit; unpublish removes; owners can delete any comment on their work."] },
      { heading: "Rules that bind every class", points: [
        "Explicit egress — nothing personal leaves without a deliberate action naming what's sent.",
        "Typed or nothing — schema-validated payloads; transcript- and secret-shaped keys are rejected.",
        "Experiments are presentation-only: a variant may restyle, never widen collection or soften an approval.",
        "Work is archived; people are deleted. Personal deletion is immediate and real.",
      ] },
    ],
    footer: "Draft v0.3 · the engineering companion to the privacy policy. Full text ships in the repo (docs/DATA-POLICY.md).",
  },
  feedback: {
    title: "Feedback mode policy",
    tagline: "Feedback mode lets you design suggestions with Cline and try approved look-and-feel variants for up to a week. Here is the entire deal:",
    blocks: [
      { heading: "Collected — only on Send", points: [
        "The structured suggestion you explicitly send: title, summary, which screen it's about, app version, and which experiment flags are active.",
        "Kept 90 days or until we decide (adopt or retire), whichever comes first.",
      ] },
      { heading: "Never collected", points: [
        "The chat itself — it's ephemeral, in memory, gone when the sheet closes. The transcripts-never-stored rule covers feedback chat too.",
        "Voice, code, repo contents, screenshots, usage analytics.",
      ] },
      { heading: "Trials — the one-week rule", points: [
        "A trial is a look-and-feel flag on this device only, with a 7-day clock that enforces itself.",
        "You can end a trial any time; we can retire a variant any time; day 7 ends it automatically.",
        "Variants never widen data collection, bypass approvals, or touch privacy rules — that line is hard.",
      ] },
      { heading: "The switches", points: [
        "The program switch is ours; feedback mode is yours. Either off → no feedback UI, no trials, nothing collected.",
        "If the program turns off, trials revert and your opt-in clears. Re-joining re-asks for this consent.",
      ] },
    ],
    footer: "Draft v0.3 · shown in full whenever feedback mode is turned on.",
    consentFooter: "Agreeing turns feedback mode on for this device. Declining costs nothing.",
  },
};

function PolicyBody({ policy, footer }) {
  return html`<div>
    <div class="pf-policy-tag">${policy.tagline}</div>
    ${policy.blocks.map((b) => html`<div key=${b.heading} class="card pf-block">
      <${Eyebrow}>${b.heading.toUpperCase()}</${Eyebrow}>
      ${b.points.map((p) => html`<div key=${p} class="pf-point"><i />${p}</div>`)}
    </div>`)}
    <div class="pf-foot">${footer}</div>
  </div>`;
}

/** Route "policy" — params.kind ∈ privacy | data | feedback; `consenting`
 *  (feedback only) turns the screen into the consent gate. Works pushed,
 *  embedded inside Settings (params.onBack) or presented as a sheet. */
export function PolicyView({ params = {}, route }) {
  const store = useObservable(ctx.store);
  const policy = POLICIES[params.kind];
  const isSheet = route?.detent != null;
  if (!policy) return html`<${Screen} title="Policy" back=${params.onBack ?? true}><${Empty} icon="doc.text" title="Unknown policy" /></${Screen}>`;
  const consenting = params.kind === "feedback" && !!params.consenting;
  const agree = () => { store.setFeedbackOptIn(true); haptic("success"); ctx.nav.toast("Feedback mode on", { icon: "checkmark.circle" }); if (isSheet) ctx.nav.dismiss(); else ctx.nav.back(); };
  const decline = () => { if (isSheet) ctx.nav.dismiss(); else ctx.nav.back(); };

  const footer = consenting ? html`<div class="pf-consent">
    <${Button} fill onClick=${decline} style=${{ minHeight: 46 }}>Not now</${Button}>
    <${Button} variant="gradient" fill onClick=${agree} style=${{ minHeight: 46 }}>Agree & turn on</${Button}>
  </div>` : null;

  return html`<${Screen} title=${policy.title} back=${isSheet ? false : (params.onBack ?? true)}
    trailing=${isSheet ? html`<${Button} variant="ghost" size="sm" onClick=${() => ctx.nav.dismiss()}>Close</${Button}>` : null}
    footer=${footer}>
    <${PolicyBody} policy=${policy} footer=${consenting ? policy.consentFooter : policy.footer} />
  </${Screen}>`;
}
