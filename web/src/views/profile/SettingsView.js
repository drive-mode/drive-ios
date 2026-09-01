// A port of `Sources/SettingsView.swift` — one responsive modal: a sheet with
// deep-linked tabs on narrow widths, a split form (tab list · content) at
// ≥ 700px. Edits live in `SettingsDraftStore` until Save writes them to
// prefs (same keys as the Swift app) and announces "drive:prefs-changed" so
// appearance / reduce-motion apply instantly. Reset restores the persisted
// snapshot; closing with a dirty draft warns.
import { html, cx, useState, useEffect, useRef, useObservable, useTick, haptic, Observable } from "../../ui.js";
import { Icon, Row, ToggleRow, Toggle, Segmented, PickerRow, TextField, Button, Screen, AvatarChip, Card, Eyebrow, Empty, Stat, PreviewChip } from "../../components.js";
import { prefs, prefBool } from "../../prefs.js";
import { SETTINGS_TABS, PREVIEW_ACCOUNT, DemoData, DIRECTOR_POLICY } from "../../models.js";
import { notifications } from "../../notifications.js";
import { routeFor } from "../../nav.js";
import { ctx, SectionLabel, Footnote, Hairline, ValueRow, useContainerWidth, minutesToTime, timeToMinutes } from "./shared.js";
import { FeedbackSettingsSection } from "./FeedbackMode.js";
import { LocalAIPanel } from "./LocalAI.js";

// ------------------------------------------------------- draft store

/** [field, prefs key, default(configuration)] — the exact keys the Swift store writes. */
const FIELDS = [
  ["appearance", "appearance", () => "System"],
  ["reduceMotion", "reduceMotion", () => false],
  ["micDefault", "micDefault", () => "Muted"],
  ["talkGesture", "talkGesture", () => "Hold to talk"],
  ["autoFile", "archive.autoFile", () => true],
  ["sweepAge", "archive.sweepAge", () => "Right away"],
  ["notifyApprovals", "notify.approval", () => true],
  ["notifyBlocked", "notify.blocked", () => true],
  ["notifyInvites", "notify.invite", () => true],
  ["notifyShips", "notify.ships", () => false],
  ["notifyProduct", "notify.product", () => false],
  ["quietHours", "notify.quiet", () => false],
  ["quietFrom", "notify.quietFrom", () => 22 * 60],
  ["quietTo", "notify.quietTo", () => 8 * 60],
  ["escalation", "notify.escalation", () => "Do nothing"],
  ["displayName", "profile.displayName", (c) => (c.previewContentEnabled ? "Harrison" : "")],
  ["email", "profile.email", (c) => (c.previewContentEnabled ? "harrison@quant-h2.com" : "")],
  ["callLaunchBehavior", "call.launchBehavior", () => "Configure each call"],
  ["defaultCallPresetName", "call.defaultPreset", (c) => (c.previewContentEnabled ? "Focused pair" : "No default preset")],
];

export class SettingsDraftStore extends Observable {
  constructor(configuration) {
    super();
    this.configuration = configuration;
    this.reload();
  }
  /** Re-read every field from prefs and take that as the persisted snapshot. */
  reload() {
    for (const [name, key, dflt] of FIELDS) {
      const v = prefs.get(key, null);
      this[name] = v == null ? dflt(this.configuration) : v;
    }
    this.persisted = this.snapshot();
    this.emit();
  }
  snapshot() { const s = {}; for (const [name] of FIELDS) s[name] = this[name]; return s; }
  get hasUnsavedChanges() { const s = this.snapshot(); return FIELDS.some(([name]) => s[name] !== this.persisted[name]); }
  set(name, value) { this[name] = value; this.emit(); }
  save() {
    for (const [name, key] of FIELDS) prefs.set(key, this[name]);
    this.persisted = this.snapshot();
    window.dispatchEvent(new Event("drive:prefs-changed"));
    this.emit();
  }
  reset() { Object.assign(this, this.persisted); this.emit(); }
}

let drafts = null;
/** One draft store for the app's lifetime — closing Settings keeps edits as a draft. */
export function getDrafts() { drafts ??= new SettingsDraftStore(ctx.store.configuration); return drafts; }

export const availableSettingsTabs = (configuration) => SETTINGS_TABS.filter((t) => t.id !== "Billing & payments" || configuration.billingEnabled);

// ------------------------------------------------------------- modal

/** Route "settings" — presented as a sheet with params { tab, source }. */
export function SettingsModalView({ params = {} }) {
  const store = useObservable(ctx.store);
  const d = useObservable(getDrafts());
  const tabs = availableSettingsTabs(store.configuration);
  const [tab, setTab] = useState(() => (tabs.some((t) => t.id === params.tab) ? params.tab : "General"));
  const [sub, setSub] = useState(null);
  const rootRef = useRef();
  const width = useContainerWidth(rootRef);
  const split = width >= 700;
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  useEffect(() => { if (!tabs.some((t) => t.id === tab)) setTab("General"); }, [tabs.length]);

  const openSub = (name, p = {}) => { if (!routeFor(name)) { ctx.nav.toast("That page isn't available yet"); return; } setSub({ name, params: { ...p, onBack: () => setSub(null), embedded: true } }); };
  const save = () => { d.save(); store.rebuildTaskIndex(); store.commit(); haptic("success"); ctx.nav.toast("Settings saved", { icon: "checkmark.circle" }); ctx.nav.dismiss(); };
  const close = (e) => {
    if (!d.hasUnsavedChanges) { ctx.nav.dismiss(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    ctx.nav.openMenu({ x: r.left, y: r.bottom, title: "You have unsaved changes", items: [
      { label: "Save and close", icon: "checkmark.circle", onSelect: save },
      { label: "Keep draft and close", icon: "square.and.pencil", onSelect: () => ctx.nav.dismiss() },
      { label: "Discard changes", icon: "arrow.uturn.left", danger: true, onSelect: () => { d.reset(); ctx.nav.dismiss(); } },
    ] });
  };
  const pickTab = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ctx.nav.openMenu({ x: r.left, y: r.bottom, title: "Settings section", items: tabs.map((t) => ({ label: t.id, icon: t.symbol, checked: t.id === tab, onSelect: () => setTab(t.id) })) });
  };

  const panel = html`<${TabContent} tab=${tab} store=${store} d=${d} openSub=${openSub} />`;
  const subRoute = sub ? routeFor(sub.name) : null;

  return html`<div class="pf-settings" ref=${rootRef} data-split=${split}>
    <div class="pf-set-top">
      <button type="button" class="pf-close pressable" aria-label="Close settings" title="Draft changes stay available when settings reopens" onClick=${close}><${Icon} name="xmark" size=${15} weight=${3} /></button>
      <span class="pf-set-title">Settings</span>
      <button type="button" class="pf-reset pressable" disabled=${!d.hasUnsavedChanges} title="Restores the last saved settings" onClick=${() => { d.reset(); haptic("light"); }}>Reset</button>
      <button type="button" class=${cx("pf-save pressable", d.hasUnsavedChanges && "dirty")} disabled=${!d.hasUnsavedChanges} onClick=${save}>Save</button>
    </div>
    ${split ? html`<div class="pf-set-body split">
      <nav class="pf-set-side" aria-label="Settings sections">
        <div class="pf-side-title">Settings</div>
        ${tabs.map((t) => html`<button key=${t.id} type="button" class=${cx(t.id === tab && "on")} aria-current=${t.id === tab ? "page" : undefined} onClick=${() => setTab(t.id)}><${Icon} name=${t.symbol} size=${16} weight=${2.2} />${t.id}</button>`)}
      </nav>
      <div class="pf-set-main">
        <div class="pf-panel-title">${panelTitle(tab)}</div>
        ${panel}
      </div>
    </div>` : html`<div class="pf-set-body" style=${{ flexDirection: "column" }}>
      <div class="pf-set-picker">
        <button type="button" class="pf-pick pressable" onClick=${pickTab} aria-label=${`Settings section: ${current.id}. Change section`} aria-haspopup="menu">
          <${Icon} name=${current.symbol} size=${16} weight=${2.3} /><span>${current.id}</span><${Icon} name="chevron.down" size=${13} weight=${2.6} className="chev" />
        </button>
        <span class="grow" />
        ${d.hasUnsavedChanges ? html`<span class="pf-draft-pill">Draft</span>` : null}
      </div>
      <div class="pf-set-main">${panel}</div>
    </div>`}
    ${sub && subRoute ? html`<div class="pf-sub" key=${sub.name}><${subRoute.Component} params=${sub.params} route=${{ name: sub.name, embedded: true }} /></div>` : null}
  </div>`;
}

const panelTitle = (tab) => (tab === "General" ? "Configuration" : tab === "Privacy" ? "Privacy & account" : tab);

function TabContent({ tab, store, d, openSub }) {
  switch (tab) {
    case "General": return html`<${GeneralPanel} store=${store} d=${d} openSub=${openSub} />`;
    case "Profile": return html`<${ProfilePanel} store=${store} d=${d} />`;
    case "Calls": return html`<${CallsPanel} store=${store} d=${d} />`;
    case "Agents": return html`<${AgentsPanel} store=${store} />`;
    case "Billing & payments": return store.configuration.billingEnabled ? html`<${BillingPanel} />` : html`<${AccountServiceUnavailablePanel} />`;
    case "Usage": return html`<${UsagePanel} store=${store} />`;
    case "Analytics": return html`<${AnalyticsPanel} store=${store} />`;
    case "Privacy": return html`<${PrivacyPanel} store=${store} d=${d} openSub=${openSub} />`;
    case "On-device AI": return html`<${Panel} intro="Use Apple's built-in system model for small, read-only file tasks."><${LocalAIPanel} intro=${false} /></${Panel}>`;
    default: return html`<${Empty} title="Unknown section" />`;
  }
}

/** Scrollable panel body (Swift `settingsPanel`). */
function Panel({ intro, children, tight = false }) {
  return html`<div class="scroll"><div class="content no-tabbar" style=${{ paddingTop: tight ? 0 : 6 }}>
    ${intro ? html`<div class="pf-intro">${intro}</div>` : null}
    ${children}
  </div></div>`;
}

const Group = ({ children, style }) => html`<div class="card" style=${{ overflow: "hidden", padding: 0, ...style }}>${children}</div>`;

// ------------------------------------------------------------ General

function GeneralPanel({ store, d, openSub }) {
  const never = store.neverFileProjects.size;
  return html`<${Panel} tight>
    <${SectionLabel} first>APPEARANCE</${SectionLabel}>
    <${Group}>
      <${Row} title="Appearance" trailing=${html`<${Segmented} size="sm" options=${["System", "Light", "Dark"]} value=${d.appearance} onChange=${(v) => d.set("appearance", v)} label="Appearance" />`} />
      <${ToggleRow} title="Reduce motion" checked=${d.reduceMotion} onChange=${(v) => d.set("reduceMotion", v)} />
    </${Group}>
    <${Footnote}>Saved appearance applies the moment you tap Save — the page never flashes the wrong scheme on launch.</${Footnote}>

    <${SectionLabel}>APPROVAL DEFAULTS</${SectionLabel}>
    <${Group}>
      <${ValueRow} label="New agents" value="Edits need approval" chevron=${false} />
      <${Hairline} />
      <${ValueRow} label="Per-agent overrides" value="Agents tab" onClick=${() => { ctx.nav.dismiss(); ctx.nav.selectTab("agents"); }} />
    </${Group}>
    <${Footnote}>Every edit is yours to allow — defaults only set where the ask happens.</${Footnote}>

    <${SectionLabel}>FOCUS & ARCHIVE</${SectionLabel}>
    <${Group}>
      <${ToggleRow} title="Auto-file quiet projects" checked=${d.autoFile} onChange=${(v) => d.set("autoFile", v)} />
      <${PickerRow} title="Sweep shipped tasks" value=${d.sweepAge} options=${["Right away", "After 3 days", "After 7 days"]} onChange=${(v) => d.set("sweepAge", v)} />
      <${Hairline} />
      <${ValueRow} label="Never file" value=${never === 0 ? "No exemptions" : `${never} project${never === 1 ? "" : "s"}`} onClick=${() => openSub("neverFile")} />
    </${Group}>
    <${Footnote}>Filed work is never deleted — search finds it, restore brings it back. Exempt projects stay on the floor no matter how quiet.</${Footnote}>

    <${SectionLabel}>NOTIFICATIONS</${SectionLabel}>
    <${Group}>
      <${ToggleRow} title="Approvals" checked=${d.notifyApprovals} onChange=${(v) => d.set("notifyApprovals", v)} />
      <${ToggleRow} title="Blocked asks" checked=${d.notifyBlocked} onChange=${(v) => d.set("notifyBlocked", v)} />
      <${ToggleRow} title="Invitations" checked=${d.notifyInvites} onChange=${(v) => d.set("notifyInvites", v)} />
      <${ToggleRow} title="Ships & streaks" checked=${d.notifyShips} onChange=${(v) => d.set("notifyShips", v)} />
      <${ToggleRow} title="Product news" checked=${d.notifyProduct} onChange=${(v) => d.set("notifyProduct", v)} />
      <${ToggleRow} title="Quiet hours" checked=${d.quietHours} onChange=${(v) => d.set("quietHours", v)} />
      ${d.quietHours ? html`<div class="pf-vrow hairline-top" style=${{ gap: 10 }}>
        <input type="time" class="pf-time" aria-label="Quiet hours from" value=${minutesToTime(d.quietFrom)} onInput=${(e) => d.set("quietFrom", timeToMinutes(e.target.value))} />
        <${Icon} name="arrow.right" size=${12} weight=${2.6} color="var(--ink-35)" />
        <input type="time" class="pf-time" aria-label="Quiet hours to" value=${minutesToTime(d.quietTo)} onInput=${(e) => d.set("quietTo", timeToMinutes(e.target.value))} />
        <span class="grow" />
      </div>` : null}
      <${Hairline} />
      <${PickerRow} title="If unanswered" value=${d.escalation} options=${["Do nothing", "Nudge after 10m", "Escalate to Slack"]} onChange=${(v) => d.set("escalation", v)} />
      <${Hairline} />
      <${TestReminderRow} store=${store} />
      <${Hairline} />
      <${PermissionRow} />
    </${Group}>
    <${Footnote}>${d.escalation === "Escalate to Slack"
      ? "Slack escalation arrives with the Slack connection — the preference applies the moment it does."
      : "Push arrives with the hub connection — these choices apply the moment it does. Approvals and blocked asks break through quiet hours only if you let them."}</${Footnote}>

    ${store.configuration.feedbackExperimentsEnabled ? html`<${FeedbackSettingsSection} />` : null}
    ${store.configuration.writerSettingsVisible ? html`<${WireSection} store=${store} />` : null}
  </${Panel}>`;
}

function TestReminderRow({ store }) {
  const send = () => {
    const preview = store.configuration.previewContentEnabled;
    ctx.nav.banner({
      title: preview ? "Auth middleware — working session" : "Drive test notification",
      body: preview ? "Maya & Cline · now — the gate review you asked for." : "Notifications are enabled on this device.",
      icon: "calendar.badge.plus", action: preview ? "Join" : null, onAction: preview ? () => store.joinCall() : null,
    });
    if (notifications.permission === "granted" && document.visibilityState !== "visible") {
      try { new Notification(preview ? "Auth middleware — working session" : "Drive test notification", { body: preview ? "Maya & Cline · now — the gate review you asked for." : "Notifications are enabled on this device.", tag: "session-test" }); } catch { /* ignore */ }
    }
  };
  return html`<button type="button" class="pf-vrow interactive pressable" onClick=${send}><span class="pf-vlabel violet">Send a test reminder</span><${Icon} name="bell.badge" size=${14} weight=${2.2} color="var(--ink-35)" /></button>`;
}

const PERMISSION_LABEL = { granted: "Allowed", denied: "Blocked in browser", default: "Not asked yet", unsupported: "Unsupported here" };
function PermissionRow() {
  const [perm, setPerm] = useState(notifications.permission);
  const ask = async () => { const p = await notifications.requestPermission(); setPerm(p); haptic(p === "granted" ? "success" : "light"); ctx.nav.toast(p === "granted" ? "Notifications allowed" : p === "denied" ? "Notifications blocked by the browser" : "Web notifications aren't available here", { icon: "bell" }); };
  const askable = perm === "default";
  return html`<${ValueRow} label="Allow notifications" value=${PERMISSION_LABEL[perm] ?? perm} chevron=${askable} onClick=${askable ? ask : undefined} ariaLabel=${`Allow notifications: ${PERMISSION_LABEL[perm] ?? perm}`} />`;
}

// ---------------------------------------------------------------- Wire

function WireSection({ store }) {
  const [draft, setDraft] = useState(store.writerURL);
  const [error, setError] = useState(null);
  useEffect(() => { setDraft(store.writerURL); }, [store.writerURL]);
  const commit = () => {
    const ok = store.applyWriterURL(draft);
    if (!ok) { setError(store.configuration.channel === "preview" ? "Not permitted: preview allows https, or http to loopback." : "Not permitted: production requires https to a non-local host."); haptic("error"); return; }
    setError(null); setDraft(store.writerURL); haptic("success"); ctx.nav.toast(draft.trim() ? "Writer set — polling" : "Writer cleared", { icon: "antenna.radiowaves.left.and.right" });
  };
  const live = store.wireStatus.live;
  const label = live ? `live · seq ${store.wireStatus.latestSeq} · ${store.wireStatus.events} events` : store.wireDropped ? "reconnecting…" : "offline";
  const intent = store.intent.snapshot();
  return html`<div>
    <${SectionLabel}>WIRE</${SectionLabel}>
    <${Group}>
      <div class="pf-vrow"><span class="pf-vlabel">Writer</span><span class="hstack" style=${{ gap: 6 }}><i class=${cx("pf-wire-dot", live && "live")} /><span class="pf-vvalue mono" style=${{ maxWidth: "none" }}>${label}</span></span></div>
      <${Hairline} />
      <div class="pf-vrow" role="group" aria-label="Writer URL">
        <span class="pf-vlabel">URL</span>
        <span class="pf-inline-field"><input class="mono" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Printed writer URL" aria-label="Writer URL — press Return to apply" value=${draft}
          onInput=${(e) => { setDraft(e.target.value); setError(null); }} onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} onBlur=${() => { if (draft !== store.writerURL) setError("Press Return to apply — typing never retargets an active poll."); }} /></span>
      </div>
      ${error ? html`<div class="pf-err" role="alert">${error}</div>` : null}
      <${Hairline} />
      <div class="pf-vrow"><span class="pf-vlabel">Intent</span><span class="pf-vvalue mono">${intent.current} · ${intent.records} rec · ${intent.predictions.map((p) => `${p.surface} ${p.score.toFixed(2)}`).join(" ") || "no prediction"}</span></div>
      <${Hairline} />
      <${WireDiagnostics} store=${store} />
    </${Group}>
    <${Footnote}>${live
      ? "Tasks, artifacts, and the session program are coming from the connected event stream."
      : "Paste the printed writer URL, or set DRIVEMODE_WRITER_URL / ~/.drivemode/writer.json. Preview allows loopback HTTP; identity is that URL, not :4600."}</${Footnote}>
  </div>`;
}

/** Diagnostics refresh once a second — only this leaf re-renders. */
function WireDiagnostics({ store }) {
  useTick(1);
  const w = store.wireSnapshot();
  const i = store.intent.snapshot();
  const p = store.preheat.snapshot();
  const ago = w.lastPollAt ? `${Math.max(0, Math.round((Date.now() - w.lastPollAt) / 1000))}s ago` : "never";
  const rows = [
    ["wire", `${w.status.live ? "live" : "offline"}${w.dropped ? " · dropped" : ""} · seq ${w.seq} · events ${w.status.events}`],
    ["poll", `${ago} · every ${w.interval != null ? `${w.interval}s` : "—"} · backoff ${w.backoff}s`],
    ["url", w.url || "—"], ["discovered", w.discovered ?? "—"], ["error", w.lastError ?? "—"],
    ["folded", `${w.tasks} tasks · ${w.artifacts} artifacts · ${w.beats} beats · ${w.participants} people · ${w.sessions} sessions · ${w.grants} grants`],
    ["intent", `${i.current} · ${i.records} records · ${i.knownSurfaces} surfaces${i.burst ? " · burst" : ""}`],
    ["predict", i.predictions.map((x) => `${x.surface} ${x.score.toFixed(2)}`).join(", ") || "—"],
    ["preheat", `${p.indexed} indexed · ${p.cachedLayouts} layouts · warmed ${p.warmed} · hits ${p.hits} · misses ${p.misses}`],
  ];
  return html`<div class="pf-diag" aria-label="Wire diagnostics">${rows.map(([k, v]) => html`<b key=${k}>${k}</b><span key=${k + "v"} style=${{ wordBreak: "break-word" }}>${v}</span>`)}</div>`;
}

// ------------------------------------------------------------ Profile

function ProfilePanel({ store, d }) {
  const preview = store.configuration.previewContentEnabled;
  const name = d.displayName.trim() || (preview ? "Harrison" : "Drive account");
  return html`<${Panel} intro="Your editable persona and account contact.">
    <${Card} pad=${false} className="pf-field-card">
      <div class="hstack" style=${{ gap: 12, padding: "14px 14px 10px" }}>
        <${AvatarChip} letter=${name.charAt(0).toUpperCase()} name=${name} color="var(--violet)" size=${44} human />
        <div class="grow">
          <div class="t-md w7">${name}</div>
          <div class="t-xs muted" style=${{ marginTop: 2 }}>${preview ? "Nothing billed, nothing synced" : "Account service not connected"}</div>
        </div>
        ${preview ? html`<${PreviewChip} text="PREVIEW" />` : null}
      </div>
      <${Hairline} />
      <input type="text" autocomplete="name" placeholder="Display name" aria-label="Display name" value=${d.displayName} onInput=${(e) => d.set("displayName", e.target.value)} />
      <${Hairline} />
      <input type="email" autocomplete="email" autocapitalize="off" inputmode="email" placeholder="Email" aria-label="Email" value=${d.email} onInput=${(e) => d.set("email", e.target.value)} />
    </${Card}>
    <${Footnote}>Closing Settings keeps these edits as a draft. Save writes them to this device.</${Footnote}>
  </${Panel}>`;
}

// -------------------------------------------------------------- Calls

function CallsPanel({ store, d }) {
  return html`<${Panel} intro="Choose whether Call starts immediately or asks for a target and team.">
    <${SectionLabel} first>VOICE</${SectionLabel}>
    <${Group}>
      <${PickerRow} title="Mic default" value=${d.micDefault} options=${["Muted", "Hot mic"]} onChange=${(v) => d.set("micDefault", v)} />
      <${Hairline} />
      <${PickerRow} title="Talk gesture" value=${d.talkGesture} options=${["Hold to talk", "Tap to toggle"]} onChange=${(v) => d.set("talkGesture", v)} />
    </${Group}>
    <${Footnote}>${d.micDefault === "Muted" ? "Hold anywhere on the session strip to speak; release to send." : "You're live when a session starts — tap the strip to mute."}${d.talkGesture === "Tap to toggle" ? " Tap once to open the mic, again to close it." : ""}</${Footnote}>

    <${SectionLabel}>CALL</${SectionLabel}>
    <${Group} className="pf-field-card">
      <div style=${{ padding: 14 }}>
        <div class="t-sm w6 muted" style=${{ marginBottom: 8 }}>Call action</div>
        <${Segmented} options=${["Configure each call", "Launch default preset"]} value=${d.callLaunchBehavior} onChange=${(v) => d.set("callLaunchBehavior", v)} label="Call action" />
      </div>
      <${Hairline} />
      <div class="pf-field-card"><input type="text" placeholder="Default preset name" aria-label="Default preset name" value=${d.defaultCallPresetName} onInput=${(e) => d.set("defaultCallPresetName", e.target.value)} /></div>
      <${Hairline} />
      <${ValueRow} label="Active preset" value=${`${store.defaultCallPreset.name} · ${store.defaultCallPreset.agentIDs.length} agent${store.defaultCallPreset.agentIDs.length === 1 ? "" : "s"}`} chevron=${false} />
    </${Group}>
    <${Footnote}>Targets, agents, and Presenter eligibility are configured in the Work call configurator.</${Footnote}>
  </${Panel}>`;
}

// ------------------------------------------------------------- Agents

function AgentsPanel({ store }) {
  const [pace, setPace] = useState(prefs.get("director.overlay.pace", "Balanced"));
  const [handoffs, setHandoffs] = useState(prefBool("director.overlay.handoffs", true));
  const changePace = (v) => { setPace(v); prefs.set("director.overlay.pace", v); };
  const changeHandoffs = (v) => { setHandoffs(v); prefs.set("director.overlay.handoffs", v); };
  return html`<${Panel} intro="Persona names stay editable; runtime identity is shown separately.">
    <${Card} style=${{ padding: 16 }}>
      <div class="pf-labels">
        <div><${Icon} name="checkmark.shield" size=${15} weight=${2.3} />Director policy stays signed, versioned, and host-side</div>
        <div><${Icon} name="rectangle.on.rectangle.slash" size=${15} weight=${2.3} />Typed-stage presentation only — never pixel capture</div>
        <div><${Icon} name="clock.badge.checkmark" size=${15} weight=${2.3} />Temporary Agent Titles are logged and expire</div>
      </div>
    </${Card}>
    ${store.configuration.previewContentEnabled ? html`<${Group} style=${{ marginTop: 14 }}>
      <div class="hstack" style=${{ padding: 14, gap: 10 }}>
        <div class="grow">
          <div class="w7" style=${{ fontSize: 14 }}>Director policy</div>
          <div class="mono muted" style=${{ fontSize: 10, marginTop: 2 }}>${DIRECTOR_POLICY.version} · ${DIRECTOR_POLICY.signatureStatus} · Host-only</div>
        </div>
        <${Icon} name="checkmark.shield.fill" size=${18} weight=${2.2} color="var(--violet)" fill />
      </div>
      <${Hairline} />
      <${PickerRow} title="Presentation pace" value=${pace} options=${["Calm", "Balanced", "Fast"]} onChange=${changePace} icon="director.overlay.pace" iconTint="var(--violet-text)" />
      <${ToggleRow} title="Suggest Presenter handoffs" checked=${handoffs} onChange=${changeHandoffs} violet icon="director.overlay.handoffs" iconTint="var(--violet-text)" />
    </${Group}>` : html`<${Group} style=${{ marginTop: 14 }}>
      <div class="hstack w7" style=${{ padding: 14, gap: 8, fontSize: 14 }}><${Icon} name="shield.slash" size=${16} weight=${2.3} />Director policy unavailable</div>
      <${Hairline} />
      <div class="t-xs muted" style=${{ padding: 14, lineHeight: 1.45 }}>Connect an approved host before policy status, routing, or Presenter handoffs are shown.</div>
    </${Group}>`}
    <${Footnote}>These are safe user overlays. The signed prompts, routing, tools, scoring, and model configuration are not editable or exportable.</${Footnote}>
  </${Panel}>`;
}

// ------------------------------------------------------------ Billing

function BillingPanel() {
  const a = PREVIEW_ACCOUNT;
  return html`<${Panel} intro="Billing values come from the account-service boundary.">
    <${Group}>
      <${ValueRow} label="Plan" value=${a.plan} chevron=${false} /><${Hairline} />
      <${ValueRow} label="Status" value=${a.billingStatus} chevron=${false} /><${Hairline} />
      <${ValueRow} label="Payment" value=${a.paymentMethod} chevron=${false} /><${Hairline} />
      <${ValueRow} label="Renewal" value=${a.renewal} chevron=${false} />
    </${Group}>
    <div class="hstack t-xs muted" style=${{ gap: 6, marginTop: 10, padding: "0 2px" }}><${Icon} name="server.rack" size=${13} weight=${2.2} />${a.source}</div>
    <${Footnote}>Preview access is never charged. There is no card on file and nothing to cancel.</${Footnote}>
  </${Panel}>`;
}

function AccountServiceUnavailablePanel() {
  return html`<${Panel} intro="Billing is not available until the account-service integration is configured.">
    <${Card} style=${{ padding: 16 }}><div class="hstack w6" style=${{ gap: 8, fontSize: 14 }}><${Icon} name="creditcard.trianglebadge.exclamationmark" size=${16} weight=${2.3} />No billing data is loaded</div></${Card}>
  </${Panel}>`;
}

// ------------------------------------------------------------- Usage

function MetricGrid({ metrics }) {
  return html`<div class="pf-mgrid">${metrics.map(([k, v, s]) => html`<div key=${k} class="card pf-mcell" style=${{ padding: 14 }}><div class="pf-mk">${k}</div><div class="pf-mvv">${v}</div><div class="pf-ms">${s}</div></div>`)}</div>`;
}

function UsagePanel({ store }) {
  const events = store.wireStatus.live ? store.wireStatus.events : 0;
  const preview = store.configuration.previewContentEnabled;
  return html`<${Panel} intro="Observed consumption, without inventing provider token totals.">
    ${preview ? html`<div>
      <div class="pf-preview-note" style=${{ marginBottom: 8 }}><i class="dot" />Preview · sample usage measured on-device</div>
      <div class="grid2">${DemoData.usage.map((u) => html`<${Stat} key=${u.label} value=${u.value} label=${u.label} sub=${u.sub} />`)}</div>
      <div style=${{ marginTop: 16 }}><${Eyebrow}>OBSERVED</${Eyebrow}></div>
    </div>` : null}
    <div style=${{ marginTop: preview ? 8 : 0 }}><${MetricGrid} metrics=${[["Model work", events, "durable events"], ["Calls", Object.keys(store.wireSessions).length, "registry records"], ["Resources", store.tasks.length + store.artifacts.length + (store.memoryFiles?.length ?? 0), "tasks · artifacts · memory"]]} /></div>
    <${Footnote}>Provider token and billing-unit totals appear only when the account service reports them.</${Footnote}>
  </${Panel}>`;
}

function AnalyticsPanel({ store }) {
  const shipped = store.tasks.filter((t) => t.state === "Done").length;
  const attention = store.tasks.filter((t) => t.state === "Blocked" || t.state === "Review").length;
  const preview = store.configuration.previewContentEnabled;
  return html`<${Panel} intro="User-visible outcomes derived from durable work state.">
    <${MetricGrid} metrics=${[["Shipped", shipped, "completed tasks"], ["Needs you", attention, "blocked or review"], ["Artifacts", store.artifacts.length, "replayable outputs"]]} />
    ${preview ? html`<div>
      <div class="pf-preview-note" style=${{ margin: "16px 0 8px" }}><i class="dot" />Preview · this week's trends and records</div>
      <div class="grid3" style=${{ gap: 9 }}>${DemoData.trends.map((t) => html`<div key=${t.label} class="card pf-trend"><${Icon} name=${t.symbol} size=${12} weight=${2.4} color="var(--ink-35)" /><div class=${cx("pf-delta", !t.good && "bad")}><${Icon} name=${t.up ? "arrow.up.right" : "arrow.down.right"} size=${9} weight=${3.2} />${t.delta}</div><div class="pf-tlabel">${t.label}</div></div>`)}</div>
      <div class="grid2" style=${{ gap: 9, marginTop: 9 }}>${DemoData.records.map((r) => html`<div key=${r.label} class="card pf-record"><div class="pf-rec-eyebrow"><${Icon} name=${r.symbol} size=${12} weight=${2.6} fill />RECORD</div><div class="pf-rec-val">${r.value}</div><div class="pf-rec-lab">${r.label}</div><div class="pf-rec-sub clamp2">${r.sub}</div></div>`)}</div>
    </div>` : null}
    <${Footnote}>These are product outcomes, not hidden engagement scoring.</${Footnote}>
  </${Panel}>`;
}

// ------------------------------------------------------------ Privacy

/** Personal settings — privacy honesty and account (Swift `PrivacyAccountView`). */
function PrivacyPanel({ store, d, openSub }) {
  const preview = store.configuration.previewContentEnabled;
  const confirmReset = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ctx.nav.openMenu({ x: r.left, y: r.bottom, title: "Reset local data? Preferences, layouts, drafts, the intent model and experiment timers on this device are wiped. Work events in your own infrastructure are untouched.", items: [
      { label: "Reset and reload", icon: "trash", danger: true, onSelect: () => { prefs.clearAll(); try { sessionStorage.clear(); } catch { /* ignore */ } window.location.reload(); } },
      { label: "Keep everything", onSelect: () => {} },
    ] });
  };
  return html`<${Panel} tight>
    <${SectionLabel} first>PRIVACY</${SectionLabel}>
    <${Group}>
      ${preview ? html`<div class="pf-vrow"><span class="pf-vlabel">Transcripts</span><span class="hstack" style=${{ gap: 6 }}><i class="dot" /><span class="pf-vvalue">Never stored</span></span></div><${Hairline} /><${ValueRow} label="Work events" value="Current writer" chevron=${false} />`
      : html`<${ValueRow} label="Account service" value="Not connected" chevron=${false} /><${Hairline} /><${ValueRow} label="Work host" value=${store.wireStatus.live ? "Connected" : "Not connected"} chevron=${false} />`}
    </${Group}>
    <${Footnote}>${preview ? "Conversation stays in memory. Preview behavior is not a production retention promise." : "Drive shows only connected service state. Hosted transfer and retention disclosures must be approved before a host can connect."}</${Footnote}>

    <${SectionLabel}>POLICIES</${SectionLabel}>
    <${Group}>
      <${ValueRow} label="Privacy policy" value="v0.3" onClick=${() => openSub("policy", { kind: "privacy" })} />
      <${Hairline} />
      <${ValueRow} label="Data policy" value="v0.3" onClick=${() => openSub("policy", { kind: "data" })} />
      ${store.configuration.feedbackExperimentsEnabled ? html`<${Hairline} /><${ValueRow} label="Feedback mode policy" value="v0.3" onClick=${() => openSub("policy", { kind: "feedback" })} />` : null}
    </${Group}>
    <${Footnote}>Plain language, versioned — widening any collection re-asks for consent.</${Footnote}>

    <${SectionLabel}>ACCOUNT</${SectionLabel}>
    <${Group}>
      ${preview ? html`<div class="pf-vrow"><span class="pf-vlabel">Signed in</span><span class="pf-vvalue" style=${{ fontSize: 13 }}>${d.email}</span></div><${Hairline} /><${ValueRow} label="Invite links" value="Preview only" chevron=${false} />`
      : html`<${ValueRow} label="Status" value="Not signed in" chevron=${false} /><${Hairline} /><${ValueRow} label="Account actions" value="Unavailable" chevron=${false} />`}
    </${Group}>

    <${SectionLabel}>DATA CONTROLS</${SectionLabel}>
    <${Group}>
      <button type="button" class="pf-vrow interactive pressable" onClick=${confirmReset}><span class="pf-vlabel danger">Reset local data</span><span class="pf-vvalue">This device</span><${Icon} name="trash" size=${14} weight=${2.2} color="var(--ink-35)" /></button>
      ${preview ? html`<${Hairline} /><button type="button" class="pf-vrow interactive pressable" onClick=${() => { haptic("light"); store.unlaunch(); }}><span class="pf-vlabel">Sign out of preview</span><span class="pf-vvalue">Back to Open</span><${Icon} name="rectangle.portrait.and.arrow.right" size=${14} weight=${2.2} color="var(--ink-35)" /></button>` : null}
    </${Group}>
    <${Footnote}>Reset wipes this device's preferences, layouts, drafts and experiment timers, then reloads. Work is archived; people are deleted — nothing here reaches your writer.</${Footnote}>

    <div class="pf-foot" style=${{ paddingTop: 32 }}>${preview ? "Drive 0.2 · MC1 preview" : "Drive 0.2"}</div>
  </${Panel}>`;
}

// ---------------------------------------------------------- Never file

/** Projects exempt from every auto-file path — added from a project card's
 *  long-press (or here), removed here. Route "neverFile". */
export function NeverFileView({ params = {} }) {
  const store = useObservable(ctx.store);
  const exempt = [...store.neverFileProjects].sort((a, b) => a.localeCompare(b));
  const candidates = store.orderedProjects.filter((p) => !store.neverFileProjects.has(p.id));
  const add = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ctx.nav.openMenu({ x: r.right, y: r.bottom, title: candidates.length ? "Exempt a project" : "No projects to exempt", items: candidates.slice(0, 12).map((p) => ({ label: p.name, icon: "archivebox.circle", onSelect: () => { store.toggleNeverFile(p.id); ctx.nav.toast(`${p.name} will never file`, { icon: "pin" }); } })) });
  };
  return html`<${Screen} title="Never file" back=${params.onBack ?? true} trailing=${html`<${Button} variant="ghost" size="sm" icon="plus" onClick=${add} disabled=${!candidates.length}>Add</${Button}>`}>
    <div class="t-sm muted" style=${{ paddingTop: 8, lineHeight: 1.45 }}>These projects stay on the floor no matter how quiet they get. Add one by long-pressing its card in Tasks.</div>
    ${exempt.length === 0 ? html`<div class="empty" style=${{ padding: "60px 24px" }}><${Icon} name="pin.slash" size=${24} weight=${1.6} color="var(--ink-35)" /><div class="t-sm w6 muted">No exemptions yet</div></div>`
    : html`<div class="list" style=${{ gap: 9, marginTop: 14 }}>${exempt.map((id) => html`<div key=${id} class="card pf-never-row">
      <${Icon} name="archivebox.circle" size=${16} weight=${2.2} color="var(--violet-text)" />
      <span class="pf-pname">${store.projects.find((p) => p.id === id)?.name ?? id}</span>
      <button type="button" class="pf-pill-btn pressable" style=${{ fontSize: 12.5, padding: "7px 12px" }} onClick=${() => { store.toggleNeverFile(id); haptic("light"); }} aria-label=${`Remove ${id} from never file`}>Remove</button>
    </div>`)}</div>`}
  </${Screen}>`;
}
