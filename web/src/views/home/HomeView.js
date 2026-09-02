// HomeView.swift — the Home root: brand header with inbox tray and profile,
// honesty chrome for a dropped wire, search, the live hero (or the quiet
// session card), TODAY tiles with hold-to-peek, the Focus Home trial chip,
// the artifact and From Friends rails, RECENT rows, and the fail-closed
// production empty state. Also carries the subviews Home renders from other
// Swift files: LiveHeroCard, HomeQuietSessionCard, RecentRow, ArtifactRail
// (ArtifactsView.swift), FromFriendsRail (ShowcaseView.swift), TaskRow peek
// (TasksView.swift) and the FeedbackBubble door (MainTabs / FeedbackMode.swift).
import { html, useState, useObservable, haptic } from "../../ui.js";
import {
  DriveMark, DriveSpinner, AvatarChip, Icon, Eyebrow, LivePill, StateChip, Card, Pressable, ClineBot, showMenu,
} from "../../components.js";
import { DemoData, ARTIFACT_META, lifeBadge } from "../../models.js";
import { ctx } from "./shared.js";

/** RecentRoom → the project it belongs to (RecentRow has no destination in Swift; the map is the honest one). */
const RECENT_PROJECT = { payments: "Payments refactor", "status-sync": "Status board" };

/** ShowcaseDemo.fromFriends — the two friends' squares Home shows (ShowcaseView.swift). */
const FROM_FRIENDS = [
  { friend: { id: "anna", name: "Anna" }, project: { id: "anna-voice", name: "Voice memos → specs", state: "LIVE NOW", coverA: "#7A3FD4", coverB: "#4C1D95" } },
  { friend: { id: "marco", name: "Marco" }, project: { id: "marco-graph", name: "Dep-graph screensaver", state: "BUILDING", coverA: "#5B8DEF", coverB: "#1D4ED8" } },
];

export function HomeView() {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;
  const preview = s.configuration.previewContentEnabled;
  const [query, setQuery] = useState("");
  const unread = s.unreadInboxCount;
  const displayName = s.displayNameForUser();
  const hasProfileName = displayName !== "You";

  const submitSearch = () => { const q = query.trim(); if (q) nav.push("search", { query: q }); };

  return html`<div class="screen" data-surface="home">
    <div class="scroll">
      <div class="content hm-content" style=${{ paddingTop: "calc(var(--safe-top) + 6px)" }}>
        <header class="hm-header">
          <div class="hm-brand" role="heading" aria-level="1" aria-label="Drive">
            <${DriveMark} size=${27} />
            <h1 aria-hidden="true">Drive</h1>
          </div>
          <button class="hm-hit pressable" onClick=${() => nav.push("inbox")} aria-label=${`Inbox, ${unread} unread`} title="Asks, invitations, and product news">
            <span class="ring"><${Icon} name="tray" size=${15} weight=${2.4} /></span>
            ${unread > 0 ? html`<span class="hm-badge" aria-hidden="true">${unread}</span>` : null}
          </button>
          <button class="hm-hit pressable" onClick=${() => s.openSettings("General", "home")} aria-label="Settings" title="General, calls, privacy, wire">
            <span class="ring"><${Icon} name="gearshape" size=${16} weight=${2.2} /></span>
          </button>
          <button class="hm-hit pressable" onClick=${() => nav.push("profile")} aria-label="Profile" title="Usage stats and settings">
            ${hasProfileName
              ? html`<${AvatarChip} letter=${displayName[0].toUpperCase()} color="var(--violet)" size=${34} human />`
              : html`<span class="ring"><${Icon} name="person.crop.circle" size=${18} weight=${2} /></span>`}
          </button>
        </header>

        ${s.wireDropped && !s.wireStatus.live ? html`<div class="hm-reconnect fade-in" role="status" aria-live="polite">
          <${DriveSpinner} size=${18} />
          <div class="grow">
            <div class="t-sm w7 ink78">Reconnecting to your fleet</div>
            <div class="muted" style=${{ fontSize: 10.5 }}>The wire dropped — showing the last synced work.</div>
          </div>
        </div>` : null}

        <label class="hm-search">
          <${Icon} name="magnifyingglass" size=${14} weight=${2.2} color="var(--ink-35)" />
          <input type="search" value=${query} placeholder="Search sessions & plans" aria-label="Search sessions and plans" enterkeyhint="search"
            onInput=${(e) => setQuery(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); submitSearch(); } }} />
        </label>

        ${s.hasLiveSession ? html`
          <div style=${{ marginTop: 24 }}><${Eyebrow}>IN SESSION</${Eyebrow}></div>
          <div style=${{ marginTop: 10 }}><${LiveHeroCard} /></div>`
        : preview ? html`
          <div style=${{ marginTop: 24 }}><${Eyebrow}>WORK</${Eyebrow}></div>
          <div style=${{ marginTop: 10 }}><${HomeQuietSessionCard} /></div>` : null}

        <div class="hstack" style=${{ marginTop: 24, justifyContent: "space-between" }}>
          <${Eyebrow}>TODAY</${Eyebrow}>
          ${preview ? html`<button class="hm-link pressable" onClick=${() => nav.push("activity")} aria-label="Calendar" title="Week, month, year, and custom shipping history">
            <${Icon} name="calendar" size=${11} weight=${2.6} />Calendar<${Icon} name="chevron.right" size=${9} weight=${3} />
          </button>` : null}
        </div>
        <div class="hm-tiles" role="group" aria-label="Today">
          <${PulseTile} value=${s.runningTasks} label="tasks running" icon="checklist" onClick=${() => nav.selectTab("tasks")}
            ariaLabel=${`${s.runningTasks} tasks running`} hint="Opens the Tasks tab. Hold to preview."
            menuLabel="Open Tasks" preview=${html`<${TasksPeek} store=${s} />`} />
          <${PulseTile} value=${s.reportingCount} label="agents reporting" icon="person.2" onClick=${() => nav.selectTab("agents")}
            ariaLabel=${`${s.reportingCount} agents reporting`} hint="Opens the Agents tab. Hold to preview."
            menuLabel="Open Agents" preview=${html`<${AgentsPeek} store=${s} />`} />
          <${PulseTile} value=${s.needsYouCount} label="need you" icon="bell" accent=${s.needsYouCount > 0} onClick=${() => nav.push("needsYou")}
            ariaLabel=${`${s.needsYouCount} items need you`} hint="Opens the conversation that needs an answer. Hold to preview."
            menuLabel="Open Needs you" preview=${html`<${NeedsYouPeek} store=${s} />`} />
        </div>

        ${s.variantActive("focus-home") ? html`<div class="hm-trial" role="status" aria-label="Focus Home trial active — artifact and recent rails hidden. Manage in Settings.">
          <span><${Icon} name="flask.fill" size=${10} weight=${2.6} fill />Focus Home trial — rails hidden · manage in Settings</span>
        </div>` : html`
          ${s.artifacts.length ? html`<${ArtifactRail} store=${s} nav=${nav} />` : null}
          ${preview ? html`
            <${FromFriendsRail} nav=${nav} />
            <div style=${{ marginTop: 24 }}><${Eyebrow}>RECENT</${Eyebrow}></div>
            ${DemoData.recents.map((room) => html`<${RecentRow} key=${room.id} room=${room} nav=${nav} />`)}`
          : s.artifacts.length === 0 && s.tasks.length === 0 ? html`<${ProductionEmptyState} nav=${nav} />` : null}`}
      </div>
    </div>
    ${s.feedbackAvailable && !s.inCall ? html`<button class="hm-fab" style=${{ bottom: `calc(var(--safe-bottom) + ${s.tabBarVisible ? 96 : 44}px)` }}
      onClick=${() => { haptic("light"); nav.present("feedbackChat"); }} aria-label="Design with Cline" title="Suggest a feature — chat stays on this device">
      <${ClineBot} size=${22} color="#fff" />
    </button>` : null}
  </div>`;
}

// ------------------------------------------------------------- tiles

function PulseTile({ value, label, icon, accent = false, onClick, ariaLabel, hint, menuLabel, preview }) {
  const onLongPress = (e, pt) => showMenu(pt ? { clientX: pt.x, clientY: pt.y, currentTarget: e?.currentTarget } : e,
    [{ label: menuLabel, icon, onSelect: onClick }], { preview });
  return html`<${Pressable} as="button" className=${accent ? "hm-tile accent" : "hm-tile"} onClick=${onClick} onLongPress=${onLongPress} label=${ariaLabel} title=${hint}>
    <${Icon} name=${icon} size=${13} weight=${2.4} className="icon" />
    <span class="v">${value}</span>
    <span class="l">${label}</span>
  </${Pressable}>`;
}

function PeekStat({ value, label, color }) {
  return html`<span class="stat"><b style=${{ color }}>${value}</b><span>${label}</span></span>`;
}

function TasksPeek({ store }) {
  const blocked = store.attentionTasks.filter((t) => t.state === "Blocked").length;
  return html`<div class="hm-peek">
    <div class="hstack" style=${{ gap: 12 }}>
      <${PeekStat} value=${store.runningTasks} label="running" color="var(--live)" />
      <${PeekStat} value=${blocked} label="blocked" color="var(--danger)" />
      <${PeekStat} value=${store.orderedProjects.length} label="projects" color="var(--violet-text)" />
    </div>
    ${store.attentionTasks.slice(0, 3).map((t) => html`<${TaskRow} key=${t.id} task=${t} showProject />`)}
    ${store.attentionTasks.length === 0 ? html`<div class="t-sm muted">Nothing needs a human right now.</div>` : null}
  </div>`;
}

function AgentsPeek({ store }) {
  return html`<div class="hm-peek">
    ${store.agents.map((a) => html`<div key=${a.id} class="hstack" style=${{ gap: 10 }}>
      <${AvatarChip} letter=${a.name[0]} color=${a.color} size=${30} />
      <div class="grow"><div style=${{ fontSize: 13.5, fontWeight: 700 }}>${a.name}</div><div class="t-xs muted truncate">${a.statusLine}</div></div>
      <${StateChip} state=${a.state} />
    </div>`)}
    ${store.agents.length === 0 ? html`<div class="t-sm muted">No agents reporting yet.</div>` : null}
  </div>`;
}

function NeedsYouPeek({ store }) {
  const open = store.openInterrupts.slice(0, 3);
  return html`<div class="hm-peek">
    ${open.map((i) => html`<div key=${i.id} class="hstack" style=${{ gap: 10, alignItems: "flex-start" }}>
      <${AvatarChip} letter=${i.agentName[0]} color=${i.agentColor} size=${26} />
      <div class="grow"><div class="clamp2" style=${{ fontSize: 13, fontWeight: 700 }}>${i.title}</div>${i.detail[0] ? html`<div class="clamp2 muted" style=${{ fontSize: 11.5 }}>${i.detail[0]}</div>` : null}</div>
      <span class="mono faint" style=${{ fontSize: 10 }}>${i.age}</span>
    </div>`)}
    ${open.length === 0 ? html`<div class="t-sm muted">All clear — nobody's waiting on you.</div>` : null}
  </div>`;
}

/** TasksView.swift's TaskRow, as the peek renders it. */
function TaskRow({ task, showProject }) {
  const cls = task.state === "Review" ? "hm-state review" : task.state === "Blocked" ? "hm-state blocked" : "hm-state";
  return html`<div class="hm-task">
    <${AvatarChip} letter=${task.agentName[0]} color=${task.agentColor} size=${28} />
    <div class="grow">
      <div class="truncate" style=${{ fontSize: 14, fontWeight: 600, color: task.state === "Done" ? "var(--ink-55)" : "var(--ink)" }}>${task.title}</div>
      ${showProject ? html`<div class="t-xs faint truncate">${task.room}</div>` : null}
    </div>
    ${task.state === "Running" && task.progress != null ? html`<span class="mono faint" style=${{ fontSize: 10.5 }}>${Math.round(task.progress * 100)}%</span>` : null}
    ${task.state === "Done" ? html`<${Icon} name="checkmark" size=${13} weight=${2.6} color="var(--ink-35)" />`
      : html`<span class=${cls}>${task.state === "Running" ? html`<i class="dot" />` : null}${task.state}</span>`}
  </div>`;
}

// -------------------------------------------------------------- hero

/** The live room hero — shared by Home and the Call tab. */
export function LiveHeroCard({ expanded = false }) {
  const s = useObservable(ctx.store);
  const people = s.liveSessionPeople;
  const you = s.displayNameForUser();
  return html`<section class="hm-hero" aria-label=${`Live session: ${s.liveSessionTitle}`}>
    <${LivePill} onGradient />
    <div class="title">${s.liveSessionTitle}</div>
    <div class="people">${people.length} people · live now</div>
    ${expanded ? html`<div class="stage"><${Icon} name="sparkles.tv" size=${11} weight=${2.6} />${s.hasLiveProgramBeats ? `Presenter stage · ${s.beats.length} beats · rotate for theater` : "Presenter stage · waiting for the first beat"}</div>` : null}
    <div class="foot">
      <div class="hm-stack" aria-label=${people.slice(0, 4).join(", ")}>
        ${people.slice(0, 4).map((name) => {
          const agent = s.agents.find((a) => a.name === name);
          return html`<${AvatarChip} key=${name} letter=${name[0]} color=${agent?.color ?? "var(--violet)"} size=${28} human=${name === you} />`;
        })}
      </div>
      <button class="join pressable" onClick=${() => s.joinCall()} aria-label="Join the live session">Join</button>
    </div>
  </section>`;
}

function HomeQuietSessionCard() {
  const s = useObservable(ctx.store);
  const n = s.displayedUpcomingSessions.length;
  return html`<${Card} hero className="hm-quiet" label="No session live">
    <span class="glyph" aria-hidden="true"><${Icon} name="moon.stars" size=${15} weight=${2.4} /></span>
    <div class="grow">
      <div style=${{ fontSize: 14.5, fontWeight: 700 }}>No session live</div>
      <div class="muted" style=${{ fontSize: 11.5, marginTop: 2 }}>${n === 0 ? "Plan one from Work when you’re ready." : `${n} coming up — open Work to review.`}</div>
    </div>
    <button class="hm-wash pressable" onClick=${() => ctx.nav.selectTab("work")}>Open Work</button>
  </${Card}>`;
}

// ------------------------------------------------------------- rails

/** ArtifactsView.swift · ArtifactRail — the freshest work products, one swipe deep. */
function ArtifactRail({ store, nav }) {
  const share = (a) => {
    const text = `${a.title} — ${a.meta} · ${a.room}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => nav.toast("Copied to clipboard", { icon: "square.and.arrow.up" }), () => {});
  };
  return html`<section style=${{ marginTop: 24 }} aria-label="Artifacts">
    <div class="hstack" style=${{ justifyContent: "space-between" }}>
      <${Eyebrow}>ARTIFACTS</${Eyebrow}>
      <button class="hm-link pressable" onClick=${() => nav.push("artifacts")} aria-label=${`All ${store.artifacts.length} artifacts`}>All ${store.artifacts.length}<${Icon} name="chevron.right" size=${9} weight=${3} /></button>
    </div>
    <div class="hm-rail" role="list">
      ${store.artifacts.slice(0, 6).map((a) => {
        const meta = ARTIFACT_META[a.kind];
        const permanent = a.life.permanent;
        const peek = html`<div class="hm-peek">
          <div class="hstack" style=${{ gap: 10 }}>
            <span class="row-icon" style=${{ width: 36, height: 36, borderRadius: 10, color: meta.tint, background: `color-mix(in srgb, ${meta.tint} 14%, transparent)` }}><${Icon} name=${meta.symbol} size=${16} weight=${2.4} /></span>
            <div class="grow"><div style=${{ fontSize: 15, fontWeight: 900 }}>${a.title}</div><div class="mono" style=${{ fontSize: 11, color: meta.tint }}>${a.meta}</div></div>
          </div>
          <div class="hstack" style=${{ gap: 8 }}>
            <${AvatarChip} letter=${a.agentName[0]} color=${a.agentColor} size=${20} />
            <span class="grow muted" style=${{ fontSize: 11.5 }}>${a.agentName} · ${a.room} · ${a.age} ago</span>
            <span style=${{ fontSize: 10, fontWeight: 900, color: permanent ? "var(--ink-55)" : "var(--tint-amber)" }}>${lifeBadge(a.life)}</span>
          </div>
        </div>`;
        const onLongPress = (e, pt) => showMenu(pt ? { clientX: pt.x, clientY: pt.y } : e, [
          { label: "Open in session", icon: "waveform", onSelect: () => store.joinCall() },
          { label: "Share", icon: "square.and.arrow.up", onSelect: () => share(a) },
        ], { preview: peek });
        return html`<${Pressable} as="button" key=${a.id} className="hm-art" style=${{ "--tint": meta.tint }} role="listitem"
          onClick=${() => nav.push("artifact", { id: a.id })} onLongPress=${onLongPress}
          label=${`${a.kind}: ${a.title}, ${a.room}, ${permanent ? "permanent" : `ephemeral, ${lifeBadge(a.life)}`}`} title="Opens the artifact. Hold for options.">
          <span class="kind"><${Icon} name=${meta.symbol} size=${11} weight=${2.6} /><span>${a.kind.toUpperCase()}</span><span class="grow" />${permanent ? null : html`<${Icon} name="hourglass" size=${9} weight=${2.8} color="var(--tint-amber)" />`}</span>
          <span class="t clamp2">${a.title}</span>
          <span class="m truncate">${a.room} · ${a.age}</span>
        </${Pressable}>`;
      })}
    </div>
  </section>`;
}

/** ShowcaseView.swift · FromFriendsRail — inspiration one swipe deep (preview only). */
function FromFriendsRail({ nav }) {
  return html`<section style=${{ marginTop: 24 }} aria-label="From friends">
    <div class="hstack" style=${{ justifyContent: "space-between" }}>
      <${Eyebrow}>FROM FRIENDS</${Eyebrow}>
      <button class="hm-link pressable" onClick=${() => nav.push("showcase")} aria-label="Showcase">Showcase<${Icon} name="chevron.right" size=${9} weight=${3} /></button>
    </div>
    <div class="hm-rail" role="list">
      ${FROM_FRIENDS.map(({ friend, project }) => html`<${Pressable} as="button" key=${project.id} className="hm-friend" role="listitem"
        onClick=${() => nav.push("showProject", { id: project.id })} label=${`${project.name} by ${friend.name}${project.state === "LIVE NOW" ? ", live now" : ""}`}>
        <span class="hm-cover" style=${{ "--a": project.coverA, "--b": project.coverB }} aria-hidden="true"><${ClineBot} size=${20} color="rgba(255,255,255,.85)" /></span>
        <span class="grow" style=${{ minWidth: 0 }}>
          <span class="truncate" style=${{ display: "block", fontSize: 12.5, fontWeight: 700 }}>${project.name}</span>
          <span class="muted" style=${{ display: "block", fontSize: 10.5, marginTop: 3 }}>${friend.name}</span>
          ${project.state === "LIVE NOW" ? html`<span class="hstack live" style=${{ gap: 4, fontSize: 9, fontWeight: 700, marginTop: 3 }}><i class="dot" style=${{ width: 5, height: 5 }} />Live now</span>` : null}
        </span>
      </${Pressable}>`)}
    </div>
  </section>`;
}

function RecentRow({ room, nav }) {
  const projectId = RECENT_PROJECT[room.id];
  return html`<${Card} className="hm-recent" pad=${false} onClick=${projectId ? () => nav.push("projectMap", { projectId }) : undefined} label=${`${room.title}, ${room.subtitle}${room.badge ? `, ${room.badge}` : ", completed"}`}>
    <span class=${room.badge ? "glyph badge" : "glyph"} aria-hidden="true">${room.title[0]}</span>
    <span class="grow" style=${{ minWidth: 0 }}>
      <span class="truncate" style=${{ display: "block", fontSize: 15, fontWeight: 600 }}>${room.title}</span>
      <span class="muted" style=${{ display: "block", fontSize: 12, marginTop: 2 }}>${room.subtitle}</span>
    </span>
    ${room.badge ? html`<span class="pill">${room.badge}</span>` : html`<${Icon} name="checkmark" size=${13} weight=${2.6} color="var(--ink-35)" />`}
  </${Card}>`;
}

/** Production, offline, nothing observed yet: say so, and point at Work. */
function ProductionEmptyState({ nav }) {
  return html`<${Card} hero className="hm-prod" role="status">
    <${Icon} name="rectangle.and.pencil.and.ellipsis" size=${28} weight=${1.5} color="var(--violet-text)" />
    <div style=${{ fontSize: 15, fontWeight: 700 }}>Start from Work</div>
    <div class="muted" style=${{ fontSize: 12, lineHeight: 1.45, maxWidth: 280 }}>Choose a repository or folder, then begin a chat. Activity appears only after Drive observes real work.</div>
    <button class="hm-link pressable" style=${{ minHeight: 44, padding: "0 16px", fontSize: 13 }} onClick=${() => nav.selectTab("work")}>Open Work</button>
  </${Card}>`;
}
