// A port of `Sources/ProfileView.swift` — your week: metrics that feel like
// Apple's rings and trends, wearing Drive's verbs: Steer, Answer, Ship.
// Personable, honest, never stale. Production shows observed counts only.
import { html, cx, useState, useEffect, useObservable, reducedMotion } from "../../ui.js";
import { Screen, Icon, AvatarChip, DriveMark, Row, RowGroup, Eyebrow, Card } from "../../components.js";
import { prefs } from "../../prefs.js";
import { DemoData } from "../../models.js";
import { ctx, profileLayout, CountUpText } from "./shared.js";
import { readProfileLayout } from "./ProfileCustomize.js";
import { ShowcaseDemo } from "./ShowcaseView.js";

export function ProfileView() {
  const store = useObservable(ctx.store);
  useObservable(profileLayout);
  const preview = store.configuration.previewContentEnabled;
  const layout = readProfileLayout();
  const active = layout.order.filter((id) => !layout.hidden.has(id));

  const nameRaw = String(prefs.get("profile.displayName", "") ?? "").trim();
  const emailRaw = String(prefs.get("profile.email", "") ?? "").trim();
  const displayName = nameRaw || (preview ? "Preview" : "Drive account");
  const displayEmail = emailRaw || (preview ? "preview@example.com" : "Account service not connected");
  const initial = displayName.charAt(0).toUpperCase();

  // The feedback bubble rides Home (HomeView.swift) — the Home cluster mounts its own; Profile stays quiet.
  return html`<${Screen} title="Profile" back>
    <div class="pf-head">
      <${AvatarChip} letter=${initial} name=${displayName} color="var(--violet)" size=${46} human />
      <div class="grow">
        <div class="pf-name">${preview ? `Your week, ${displayName}` : displayName}</div>
        <div class="pf-mail">${displayEmail}</div>
      </div>
      ${preview ? html`<button type="button" class="pf-iconbtn pressable" aria-label="Customize profile" title="Choose and reorder your stat modules" onClick=${() => ctx.nav.push("profileCustomize")}><${Icon} name="rectangle.3.group" size=${15} weight=${2.4} /></button>` : null}
    </div>

    ${preview ? html`
      ${store.configuration.showcaseEnabled ? html`<${ShowcaseCard} />` : null}
      ${active.map((id) => html`<${ModuleView} key=${id} id=${id} />`)}
      ${active.length === 0 ? html`<div class="t-sm muted" style=${{ textAlign: "center", padding: "40px 0" }}>Everything's hidden — tap Customize to bring your stats back.</div>` : null}
    ` : html`<${ProductionSummary} store=${store} />`}

    <${SettingsLinks} store=${store} />
    <div class="pf-foot">${preview ? "Usage is measured on-device." : "Only observed work is shown; unavailable account totals are never estimated."}</div>
  </${Screen}>`;
}

function ModuleView({ id }) {
  switch (id) {
    case "rings": return html`<div style=${{ marginTop: 16 }}><${RingsCard} /></div>`;
    case "insights": return html`<div style=${{ marginTop: 14 }}><${InsightRows} /></div>`;
    case "week": return html`<div style=${{ marginTop: 16 }}><${ShipChart} /></div>`;
    case "trends": return html`<div style=${{ marginTop: 12 }}><${TrendRow} /></div>`;
    case "records": return html`<div style=${{ marginTop: 16 }}><${RecordCards} /></div>`;
    case "streak": return html`<div style=${{ marginTop: 16 }}><${StreakBanner} /></div>`;
    case "badges": return html`<div style=${{ marginTop: 14 }}><${BadgeGrid} /></div>`;
    default: return null;
  }
}

function ProductionSummary({ store }) {
  const metric = (value, label) => html`<div class="pf-metric"><div class="pf-mv">${value}</div><div class="pf-ml">${label}</div></div>`;
  return html`<${Card} hero style=${{ marginTop: 16, padding: 16 }}>
    <div class="hstack t-md w7" style=${{ gap: 8, fontSize: 14 }}><${Icon} name="checkmark.shield" size=${16} weight=${2.4} />No sample account data</div>
    <div class="t-sm muted" style=${{ marginTop: 10, lineHeight: 1.45 }}>Usage and analytics begin with observed events from an approved host. Billing stays hidden until the account-service boundary is configured.</div>
    <div class="pf-metrics" style=${{ marginTop: 12 }}>
      ${metric(store.tasks.length, "tasks")}
      ${metric(store.artifacts.length, "artifacts")}
      ${metric(Object.keys(store.wireSessions).length, "calls")}
    </div>
  </${Card}>`;
}

/** The door to Drivemode "by Cline" — your projects as a shelf. */
function ShowcaseCard() {
  return html`<div style=${{ marginTop: 14 }}>
    <${Card} pad=${false} onClick=${() => ctx.nav.push("showcase")} label="Your showcase" title="Your project squares, demos, and friends">
      <div class="hstack" style=${{ gap: 12, padding: "12px 14px" }}>
        <span class="pf-showcase-icon"><${Icon} name="square.grid.2x2.fill" size=${15} weight=${2.4} /></span>
        <div class="grow">
          <div class="t-md w7">Your showcase</div>
          <div class="t-xs muted" style=${{ marginTop: 2 }}>${ShowcaseDemo.you.length} projects · Drivemode by Cline</div>
        </div>
        <${Icon} name="chevron.right" size=${14} weight=${2.6} color="var(--ink-35)" />
      </div>
    </${Card}>
  </div>`;
}

// ------------------------------------------------------------- rings

/** Activity-style concentric rings, drawn in with a staggered spring. */
export function ActivityRings({ size = 132, rings = DemoData.rings }) {
  const reduced = reducedMotion();
  const [grow, setGrow] = useState(reduced);
  useEffect(() => {
    if (reduced) { setGrow(true); return undefined; }
    let id2 = 0;
    const id = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setGrow(true)); });
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(id2); };
  }, []);
  const c = size / 2;
  return html`<div style=${{ position: "relative", width: size, height: size, flex: "none" }} role="img" aria-label=${rings.map((r) => `${r.label}: ${r.value} ${r.goal}`).join(". ")}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`} aria-hidden="true">
      ${rings.map((ring, i) => {
        const inset = i * 17 + 8;
        const r = c - inset - 5.5;
        const C = 2 * Math.PI * r;
        const offset = grow ? C * (1 - ring.progress) : C;
        return html`<g key=${ring.label}>
          <circle class="pf-ring-track" cx=${c} cy=${c} r=${r} fill="none" stroke=${ring.color} stroke-width="11" />
          <circle class="pf-ring-fill" cx=${c} cy=${c} r=${r} fill="none" stroke=${ring.color} stroke-width="11" stroke-linecap="round"
            stroke-dasharray=${C} stroke-dashoffset=${offset} transform=${`rotate(-90 ${c} ${c})`} style=${{ "--delay": `${i * 0.18}s` }} />
        </g>`;
      })}
    </svg>
    <div style=${{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><${DriveMark} size=${size * 0.16} /></div>
  </div>`;
}

function RingsCard() {
  return html`<${Card} hero style=${{ padding: 16 }}>
    <div class="pf-rings-card">
      <${ActivityRings} size=${132} />
      <div class="pf-legend">
        ${DemoData.rings.map((ring) => html`<div key=${ring.label} class="hstack" style=${{ gap: 9 }}>
          <span class="pf-dot" style=${{ background: ring.color }} />
          <div>
            <div class="hstack" style=${{ gap: 4 }}><${CountUpText} text=${ring.value} className="pf-val" /><span class="pf-goal">${ring.goal}</span></div>
            <div class="pf-lab">${ring.label}</div>
          </div>
        </div>`)}
      </div>
    </div>
  </${Card}>`;
}

function InsightRows() {
  return html`<div class="vstack" style=${{ gap: 9, padding: "0 4px" }}>
    ${DemoData.insights.map((s) => html`<div key=${s} class="pf-insight"><${Icon} name="sparkle" size=${11} weight=${2.6} /><span>${s}</span></div>`)}
  </div>`;
}

// ------------------------------------------------------------- chart

/** Branded week bars: violet gradient, best day crowned, quiet grid. */
export function WeekBars({ week = DemoData.week }) {
  const reduced = reducedMotion();
  const [grow, setGrow] = useState(reduced);
  useEffect(() => {
    if (reduced) { setGrow(true); return undefined; }
    const id = requestAnimationFrame(() => setGrow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...week.map((d) => d.ships));
  return html`<div class=${cx("pf-week", grow && "grow")} role="img" aria-label=${"Shipped by day: " + week.map((d) => `${d.day} ${d.ships}`).join(", ")}>
    ${week.map((d) => { const best = d.ships === max; return html`<div key=${d.id} class="pf-col">
      <span class=${cx("pf-num", best && "best")}>${d.ships}</span>
      <div class="pf-barwrap"><div class=${cx("pf-bar", best && "best")} style=${{ height: `${Math.max(4, (d.ships / max) * 100)}%` }} /></div>
      <span class=${cx("pf-day", best && "best")}>${d.day}</span>
    </div>`; })}
  </div>`;
}

function ShipChart() {
  return html`<${Card} hero style=${{ padding: 16 }}>
    <div class="hstack" style=${{ justifyContent: "space-between", alignItems: "baseline" }}>
      <${Eyebrow}>SHIPPED BY DAY</${Eyebrow}>
      <span class="hstack live" style=${{ gap: 4, fontSize: 10.5, fontWeight: 700 }}><${Icon} name="arrow.up.right" size=${10} weight=${3} />+23% vs last week</span>
    </div>
    <div style=${{ marginTop: 12 }}><${WeekBars} /></div>
  </${Card}>`;
}

function TrendRow() {
  return html`<div class="grid3" style=${{ gap: 9 }}>
    ${DemoData.trends.map((t) => html`<div key=${t.label} class="card pf-trend">
      <${Icon} name=${t.symbol} size=${12} weight=${2.4} color="var(--ink-35)" />
      <div class=${cx("pf-delta", !t.good && "bad")}><${Icon} name=${t.up ? "arrow.up.right" : "arrow.down.right"} size=${9} weight=${3.2} /><${CountUpText} text=${t.delta} /></div>
      <div class="pf-tlabel">${t.label}</div>
    </div>`)}
  </div>`;
}

function RecordCards() {
  return html`<div class="grid2" style=${{ gap: 9 }}>
    ${DemoData.records.map((r) => html`<div key=${r.label} class="card pf-record" role="group" aria-label=${`Record: ${r.label} ${r.value}, ${r.sub}`}>
      <div class="pf-rec-eyebrow"><${Icon} name=${r.symbol} size=${12} weight=${2.6} fill />RECORD</div>
      <${CountUpText} text=${r.value} className="pf-rec-val" />
      <div class="pf-rec-lab">${r.label}</div>
      <div class="pf-rec-sub clamp2">${r.sub}</div>
    </div>`)}
  </div>`;
}

function StreakBanner() {
  return html`<div class="pf-streak">
    <span class="pf-ring"><${DriveMark} size=${24} wiggle /></span>
    <div class="grow">
      <div class="hstack" style=${{ gap: 5 }}><${CountUpText} text=${String(DemoData.streakDays)} className="t-lg w8" /><span class="w7" style=${{ fontSize: 14 }}>day steering streak</span></div>
      <div class="t-xs muted" style=${{ marginTop: 2 }}>Answer one interrupt today to keep it rolling.</div>
    </div>
  </div>`;
}

function BadgeGrid() {
  return html`<div>
    <${Eyebrow}>BADGES</${Eyebrow}>
    <div class="pf-badges" style=${{ marginTop: 10 }}>
      ${DemoData.badges.map((b) => html`<div key=${b.id} class=${cx("card pf-badge", b.earned ? "earned" : "locked")} role="img" aria-label=${`${b.name}, ${b.earned ? "earned" : "locked"}: ${b.note}`}>
        <span class="pf-medal"><${Icon} name=${b.earned ? b.symbol : "lock.fill"} size=${15} weight=${2.4} fill=${b.earned && b.symbol.endsWith(".fill")} /></span>
        <span class="pf-bname">${b.name}</span>
        <span class="pf-bnote">${b.note}</span>
      </div>`)}
    </div>
  </div>`;
}

// ---------------------------------------------------------- settings

function SettingsLinks({ store }) {
  const open = (tab) => () => store.openSettings(tab, "profile");
  return html`<div class="pf-links" style=${{ marginTop: 22 }}>
    <${RowGroup}>
      <${Row} icon="slider.horizontal.3" title="Configuration" subtitle="Appearance · voice · approval defaults" chevron onClick=${open("General")} />
      <${Row} icon="lock" title="Privacy & account" subtitle="Transcripts · work events · sign-in" chevron onClick=${open("Privacy")} />
      ${store.configuration.billingEnabled ? html`<${Row} icon="creditcard" title="Billing & payments" subtitle="Plan · payment method · renewal" chevron onClick=${open("Billing & payments")} />` : null}
      <${Row} icon="gauge.with.dots.needle.50percent" title="Usage" subtitle="Model work · calls · resources" chevron onClick=${open("Usage")} />
      <${Row} icon="chart.xyaxis.line" title="Analytics" subtitle="Shipped work · attention · artifacts" chevron onClick=${open("Analytics")} />
    </${RowGroup}>
  </div>`;
}
