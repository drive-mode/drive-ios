// The secondary Calls flow — a port of `Sources/CallTabView.swift`: the session
// lifecycle top to bottom (NOW → INVITATIONS → UPCOMING → PLAN → EARLIER), the
// live card with its beat ticker, invitation rows, session records, and the
// plan-a-session composer. Lifecycle truth comes from typed session events
// when the wire is live; offline preview keeps it on this device and says so.
import { html, cx, useState, useTick, useObservable, haptic } from "../../ui.js";
import { Icon, NavBar, AvatarChip, LivePill, Empty, Eyebrow, showMenu, Chip } from "../../components.js";
import { nav, hasRoute } from "../../nav.js";
import { prefs } from "../../prefs.js";
import { LOCAL_USER_ID } from "../../store.js";
import { BEAT_TINT, TASK_STATE_TINT, scheduledDateFor, displayName as displayNameFor } from "../../models.js";
import { injectStyle, CheckCircle } from "./shared.js";
import { ProgressRail, ReplaySpotlight } from "./SpotlightDirector.js";

let store = null;
export function bindCallTab(ctx) { store = ctx.store; }

injectStyle("work-css-calls", `
.cl-quiet { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.cl-quiet .h { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
.cl-quiet .h i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-35); }
.cl-quiet .b { font-size: 12px; color: var(--ink-55); line-height: 1.4; }
.cl-quiet .host { display: flex; align-items: center; gap: 7px; min-height: 44px; font-size: 12px; font-weight: 600; color: var(--ink-55); }
.cl-live { padding: 16px; }
.cl-live .top { display: flex; align-items: center; justify-content: space-between; }
.cl-live .faces { display: flex; }
.cl-live .faces .avatar { box-shadow: 0 0 0 1.5px var(--surface); }
.cl-live .faces .avatar + .avatar { margin-left: -6px; }
.cl-live .t { font-size: 19px; font-weight: 800; letter-spacing: -0.4px; margin-top: 12px; line-height: 1.2; }
.cl-live .s { font-size: 11.5px; color: var(--ink-55); margin-top: 3px; }
.cl-ticker { margin-top: 12px; padding: 11px; border-radius: var(--r-card); background: color-mix(in srgb, var(--well) 70%, transparent); display: flex; flex-direction: column; gap: 8px; }
:root:not([data-theme="dark"]) .cl-ticker { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.cl-ticker .row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cl-ticker .kind { font-family: var(--mono); font-size: 8.5px; font-weight: 700; letter-spacing: .8px; padding: 3px 6px; border-radius: 5px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); flex: none; }
.cl-ticker .title { font-size: 12.5px; font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-ticker .n { font-family: var(--mono); font-size: 10px; font-weight: 700; color: var(--ink-35); flex: none; }
.cl-ticker .wait { font-size: 12.5px; font-weight: 600; color: var(--ink-55); }
.cl-invite { padding: 13px; border-radius: var(--r-card); background: color-mix(in srgb, var(--violet) 6%, transparent); box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--violet) 22%, transparent); display: flex; flex-direction: column; gap: 10px; }
.cl-invite .head { display: flex; align-items: flex-start; gap: 10px; }
.cl-invite .t { font-size: 13.5px; font-weight: 700; line-height: 1.3; }
.cl-invite .b { font-size: 11.5px; color: var(--ink-55); margin-top: 2px; line-height: 1.35; }
.cl-invite .age { font-family: var(--mono); font-size: 10px; color: var(--ink-35); margin-left: auto; flex: none; padding-top: 2px; }
.cl-invite .acts { display: flex; gap: 9px; }
.cl-invite .acts > button { flex: 1; min-height: 44px; border-radius: var(--r-control); font-size: 13px; font-weight: 700; }
.cl-invite .later { background: var(--surface2); color: var(--ink-55); }
.cl-invite .join { background: var(--hero-gradient); color: #fff; }
.cl-up { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left; color: var(--ink); min-height: 60px; }
.cl-up .ic { width: 36px; height: 36px; border-radius: var(--r-control); display: grid; place-items: center; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.cl-up .t { font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-up .s { font-size: 11.5px; color: var(--ink-55); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-up .chev { margin-left: auto; color: var(--ink-35); display: grid; flex: none; }
.cl-rec { padding: 13px; display: flex; flex-direction: column; gap: 10px; }
.cl-rec .head { display: flex; align-items: center; gap: 11px; min-width: 0; }
.cl-rec .ic { width: 36px; height: 36px; border-radius: var(--r-control); display: grid; place-items: center; flex: none; color: var(--tint-replay); background: color-mix(in srgb, var(--tint-replay) 13%, transparent); }
.cl-rec .t { font-size: 14.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-rec .s { font-size: 11.5px; color: var(--ink-55); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-rec .play { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; min-height: 44px; padding: 0 13px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.cl-rec .note { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 9px; background: color-mix(in srgb, var(--surface2) 70%, transparent); font-size: 11.5px; font-weight: 600; color: var(--ink-78); text-align: left; }
.cl-rec .note .brain { color: var(--tint-teal); display: grid; flex: none; }
.cl-rec .note .txt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-foot { font-size: 10.5px; color: var(--ink-35); text-align: center; line-height: 1.4; padding-top: 24px; }
.sr-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.sr-stage { height: 420px; display: flex; flex-direction: column; }
.sr-stage > .spotlight { flex: 1; }
.sc-agenda { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; text-align: left; color: var(--ink); min-height: 48px; }
.sc-agenda + .sc-agenda { box-shadow: inset 0 0.8px 0 var(--hairline); }
.sc-agenda .t { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-hint { font-size: 10.5px; color: var(--ink-55); margin-top: 6px; line-height: 1.4; }
`);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ------------------------------------------------------------ NOW card

/** The live card: what the session is doing right now, live off the director clock. */
export function LiveSessionCard() {
  const s = useObservable(store ?? window.drive.store);
  const people = s.liveSessionPeople;
  const you = s.displayNameForUser();
  return html`<div class="card hero cl-live">
    <div class="top">
      <${LivePill} />
      <div class="faces" aria-label=${`With ${people.join(", ")}`}>
        ${people.slice(0, 4).map((name) => { const agent = s.agents.find((a) => a.name === name); return html`<${AvatarChip} key=${name} name=${name} color=${agent?.color ?? "var(--violet)"} size=${26} human=${name === you} />`; })}
      </div>
    </div>
    <div class="t">${s.liveSessionTitle}</div>
    <div class="s">${people.length} people · Presenter stage · rotate for theater</div>
    ${s.hasLiveProgramBeats ? html`<${BeatTicker} s=${s} />` : html`<div class="cl-ticker"><div class="wait">Waiting for the first directed beat…</div></div>`}
    <button type="button" class="wk-grad-btn glow pressable" style=${{ marginTop: 14 }} onClick=${() => s.joinCall()} title="Joins the live working session">Join</button>
  </div>`;
}

/** 2 Hz is information cadence, not decoration — the same director clock the Spotlight runs on. */
function BeatTicker({ s }) {
  useTick(2);
  const pos = s.directorPosition(Date.now());
  const beat = s.beats[pos.index];
  if (!beat) return null;
  return html`<div class="cl-ticker" role="img" aria-label=${`Now: beat ${pos.index + 1} of ${s.beats.length}, ${beat.kind}: ${beat.title}`}>
    <div class="row">
      <span class="kind" style=${{ "--tint": BEAT_TINT[beat.kind] ?? "var(--violet)" }}>${beat.kind}</span>
      <span class="title">${beat.title}</span>
      <span class="n">${pos.index + 1}/${s.beats.length}</span>
    </div>
    <${ProgressRail} beats=${s.beats} index=${pos.index} progress=${pos.progress} />
  </div>`;
}

// ---------------------------------------------------------- invitations

export function InvitationRow({ item }) {
  const s = useObservable(store ?? window.drive.store);
  const inviter = item.title.split(" ")[0] || "Someone";
  const color = s.agents.find((a) => a.name === inviter)?.color ?? "var(--violet)";
  return html`<div class="cl-invite" role="group" aria-label=${item.title}>
    <div class="head">
      <${AvatarChip} name=${inviter} color=${color} size=${30} />
      <div style=${{ minWidth: 0 }}><div class="t clamp2">${item.title}</div><div class="b clamp2">${item.body}</div></div>
      <span class="age">${item.age}</span>
    </div>
    <div class="acts">
      <button type="button" class="join pressable" onClick=${() => { s.markInbox(item.id, true); s.joinCall(); }}>Join now</button>
      <button type="button" class="later pressable" onClick=${() => { haptic("light"); s.markInbox(item.id, true); }}>Later</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------ EARLIER

/** Session record: a replay artifact (offline preview) or a wire-ended session, plus its memory hook. */
export function SessionRecordCard({ replay, session }) {
  const s = useObservable(store ?? window.drive.store);
  const id = session?.id ?? replay?.id;
  const title = session?.title ?? replay?.room ?? "Session";
  const meta = session
    ? `${session.people?.length ? `with ${session.people.join(", ")}` : session.project} · ended ${new Intl.DateTimeFormat([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(session.endedAt)}`
    : `${replay.meta} · ${replay.age} ago`;
  const room = session?.project ?? replay?.room ?? "";
  const note = (s.memoryFiles ?? []).find((m) => m.scope === "session" && String(m.ownerLabel ?? "").includes(room)) ?? null;
  return html`<div class="card cl-rec" role="group" aria-label=${`Session record: ${title}`}>
    <div class="head">
      <span class="ic"><${Icon} name="play.rectangle" size=${17} weight=${2.2} /></span>
      <div style=${{ minWidth: 0 }}><div class="t">${title}</div><div class="s">${meta}</div></div>
      <button type="button" class="play pressable" onClick=${() => nav.push("sessionRecord", { id, kind: session ? "session" : "replay" })} aria-label=${`Play ${title}`}>
        <${Icon} name="play.fill" size=${11} weight=${2.6} fill /> Play
      </button>
    </div>
    ${note ? html`<button type="button" class="note pressable" onClick=${() => { if (hasRoute("memoryFile")) nav.push("memoryFile", { id: note.id }); }} aria-label=${`Session notes: ${note.hook}`}>
      <span class="brain"><${Icon} name="brain" size=${12} weight=${2.3} /></span><span class="txt">${note.hook}</span><${Icon} name="chevron.right" size=${11} weight=${2.4} color="var(--ink-35)" />
    </button>` : null}
  </div>`;
}

/** Route "sessionRecord" — one record, replayed as its directed program. */
export function SessionRecordView({ params }) {
  const s = useObservable(store ?? window.drive.store);
  const wire = (s.wireEndedSessions ?? []).find((r) => r.id === params.id) ?? null;
  const replay = s.artifacts.find((a) => a.id === params.id) ?? null;
  const title = wire?.title ?? replay?.room ?? "Session";
  const beats = s.beats;
  const chips = wire
    ? [wire.project, wire.when, plural(wire.agendaCount ?? 0, "agenda item"), ...(wire.people ?? []).map((p) => p)]
    : replay ? [replay.room, replay.meta, `${replay.agentName} directed`, `${replay.age} ago`] : [];
  return html`<div class="screen">
    <${NavBar} title=${title} back=${() => nav.pop()} />
    <div class="scroll"><div class="content no-tabbar vstack" style=${{ "--gap": "14px", paddingTop: 8 }}>
      ${!wire && !replay ? html`<${Empty} icon="clock.arrow.circlepath" title="Record not found" body="This session record is no longer in the working set." />` : null}
      ${chips.length ? html`<div class="sr-meta">${chips.map((c) => html`<${Chip} key=${c}>${c}</${Chip}>`)}</div>` : null}
      <div class="sr-stage">
        ${beats.length ? html`<${ReplaySpotlight} beats=${beats} />` : html`<div class="spotlight work-dark" style=${{ flex: 1 }}><div class="sp-empty"><div class="t">Stage is quiet</div><div class="b">No replayable program was kept for this session.</div></div></div>`}
      </div>
      <div class="wk-note" style=${{ textAlign: "center" }}>The room's program, replayed — the same beats the session directed live. Tap the thirds or swipe to scrub.</div>
      ${replay && hasRoute("artifact") ? html`<button type="button" class="wk-tint-btn fill pressable" onClick=${() => nav.push("artifact", { id: replay.id })}><${Icon} name="play.rectangle" size=${15} weight=${2.2} /> Open replay artifact</button>` : null}
    </div></div>
  </div>`;
}

// --------------------------------------------------------------- Calls

/** Route "workCalls" — the lifecycle, top to bottom. */
export function WorkCallsView() {
  const s = useObservable(store ?? window.drive.store);
  const preview = s.configuration.previewContentEnabled;
  const invitations = s.inbox.filter((i) => i.kind === "invite" && !i.archived && !i.read);
  const upcoming = s.displayedUpcomingSessions;
  const ended = s.usesWireSessionRegistry ? (s.wireEndedSessions ?? []) : [];
  const replays = s.artifacts.filter((a) => a.kind === "Replay");
  const plan = () => nav.present("sessionComposer", {}, { detent: "large" });
  const upcomingMenu = (e, session) => showMenu(e, [{ label: "Remove", icon: "trash", danger: true, onSelect: () => s.removeUpcoming(session.id) }], { title: session.title });

  return html`<div class="screen">
    <${NavBar} title="Calls" back=${() => nav.pop()} />
    <div class="scroll"><div class="content no-tabbar" style=${{ paddingTop: 8 }}>
      <${Eyebrow}>NOW</${Eyebrow}>
      <div style=${{ marginTop: 10 }}>
        ${s.hasLiveSession ? html`<${LiveSessionCard} />` : html`<div class="card hero cl-quiet">
          <div class="h"><i />No session live</div>
          <div class="b">${preview ? "Plan one, or catch up on what already happened." : "Connect an approved host and work target before starting a call."}</div>
          ${preview ? html`<div class="hstack" style=${{ gap: 9 }}>
            <button type="button" class="wk-grad-btn sm pressable" style=${{ fontSize: 13 }} onClick=${plan}>Plan a session</button>
            ${replays[0] ? html`<button type="button" class="wk-tint-btn sm fill pressable" onClick=${() => nav.push("sessionRecord", { id: replays[0].id, kind: "replay" })}>Watch the last replay</button>` : null}
          </div>` : html`<div class="host"><${Icon} name="network.slash" size=${14} weight=${2.2} /> Host connection required</div>`}
        </div>`}
      </div>

      ${invitations.length ? html`<${Eyebrow} className="wk-eyebrow-gap">INVITATIONS</${Eyebrow}>
        ${invitations.map((it) => html`<div key=${it.id} style=${{ marginTop: 10 }}><${InvitationRow} item=${it} /></div>`)}` : null}

      ${upcoming.length ? html`<${Eyebrow} className="wk-eyebrow-gap">UPCOMING</${Eyebrow}>
        ${upcoming.map((u) => html`<div key=${u.id} class="card" style=${{ marginTop: 10, overflow: "hidden" }}>
          <button type="button" class="cl-up pressable" onClick=${(e) => upcomingMenu(e, u)} onContextMenu=${(e) => { e.preventDefault(); upcomingMenu(e, u); }}
            aria-label=${`Upcoming: ${u.title}, ${u.when}, with ${(u.people ?? []).join(" and ")}`} title="Long press to remove">
            <span class="ic"><${Icon} name="calendar" size=${16} weight=${2.3} /></span>
            <span style=${{ minWidth: 0 }}><div class="t">${u.title}</div><div class="s">${u.when} · ${(u.people ?? []).join(", ")} · ${plural(u.agendaCount ?? 0, "agenda item")}</div></span>
            <span class="chev"><${Icon} name="chevron.right" size=${13} weight=${2.4} /></span>
          </button>
        </div>`)}` : null}
      ${s.lastSessionError ? html`<div class="wk-error" role="alert" style=${{ marginTop: 10 }}><${Icon} name="exclamationmark.triangle" size=${14} weight=${2.3} /> ${s.lastSessionError}</div>` : null}

      ${preview ? html`<button type="button" class="wk-tint-btn card fill pressable" style=${{ marginTop: 14 }} onClick=${plan} title="Pick a project, an agenda, and who to invite">
        <${Icon} name="calendar.badge.plus" size=${16} weight=${2.4} /> Plan a session
      </button>` : null}

      ${ended.length || replays.length ? html`<${Eyebrow} className="wk-eyebrow-gap">EARLIER</${Eyebrow}>
        ${ended.map((rec) => html`<div key=${rec.id} style=${{ marginTop: 10 }}><${SessionRecordCard} session=${rec} /></div>`)}
        ${replays.map((r) => html`<div key=${r.id} style=${{ marginTop: 10 }}><${SessionRecordCard} replay=${r} /></div>`)}` : null}

      <div class="cl-foot">${preview
        ? "Sessions replay as their directed program — every beat, readable after the fact. Preview conversation is not persisted."
        : "Calls and history appear after an approved host supplies authenticated session records."}</div>
    </div></div>
  </div>`;
}

// ------------------------------------------------------ session composer

const SKILL_DEFAULTS = { maya: ["directing", "tasks", "inviting", "research"], coder: ["editing", "tasks", "artifacts", "feedback"], scout: ["testing", "research", "artifacts", "tasks"], indexer: ["artifacts", "research"] };
/** Who can direct — the Agents cluster's loadout when it exposes one, else the Swift defaults. */
function canDirect(s, agentId) {
  if (typeof s.equippedIds === "function") { try { const ids = s.equippedIds(agentId); return ids?.has?.("directing") || (Array.isArray(ids) && ids.includes("directing")); } catch { /* fall through */ } }
  const raw = prefs.get(`skills.${agentId}`, null);
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : SKILL_DEFAULTS[agentId] ?? [];
  return list.includes("directing");
}

/** Route "sessionComposer" — plan a session: project, agenda, people, when, note. */
export function SessionComposerSheet() {
  const s = useObservable(store ?? window.drive.store);
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState(() => new Set());
  const [people, setPeople] = useState(() => new Set());
  const [when, setWhen] = useState("Later today");
  const [note, setNote] = useState("Join when you're ready.");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const projects = s.orderedProjects.slice(0, 8).map((p) => p.name);
  const suggestions = (s.tasksByProject[project] ?? []).filter((t) => t.state === "Blocked" || t.state === "Review");
  const toggleSet = (setter) => (id) => setter((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const send = async () => {
    const inviteeIds = people.size ? [...people].sort() : [s.agents.find((a) => a.id === "maya")?.id ?? s.agents[0]?.id].filter(Boolean);
    const names = inviteeIds.map((id) => s.agents.find((a) => a.id === id)?.name ?? displayNameFor(id));
    const scheduledAt = scheduledDateFor(when);
    const session = {
      id: `session-${(crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).toLowerCase()}`,
      title: title.trim(), project, when, people: [s.displayNameForUser(), ...names], agendaCount: agenda.size, note,
      participantIds: [LOCAL_USER_ID, ...inviteeIds], agendaTaskIds: [...agenda].sort(), scheduledAt,
    };
    setSending(true); setSendError(null);
    const sent = await s.planSession(session, inviteeIds);
    setSending(false);
    if (sent) { haptic("success"); nav.dismiss(); }
    else setSendError(s.lastSessionError ?? "The writer did not accept the session. Try again.");
  };

  const pick = (on, label, onClick, extra) => html`<button type="button" class=${cx("wk-pick pressable", on && "on")} aria-pressed=${on} onClick=${() => { haptic("light"); onClick(); }}>${extra}${label}</button>`;

  return html`<div class="wk-sheet">
    <${NavBar} title="Plan a session" leading=${html`<button class="btn ghost sm" onClick=${() => nav.dismiss()}>Cancel</button>`} />
    <div class="scroll"><div class="content" style=${{ paddingTop: 4 }}>
      <${Eyebrow}>PROJECT</${Eyebrow}>
      <div class="wk-chip-row" style=${{ marginTop: 8 }} role="group" aria-label="Project">
        ${projects.map((name) => pick(project === name, name, () => { setProject(name); setTitle(`${name} — working session`); setAgenda(new Set()); }))}
        ${!projects.length ? html`<div class="wk-note">No projects with open work yet.</div>` : null}
      </div>

      ${project ? html`
        <${Eyebrow} style=${{ marginTop: 18 }}>TITLE</${Eyebrow}>
        <input class="wk-input" style=${{ marginTop: 7 }} value=${title} placeholder="Session title" aria-label="Session title" onInput=${(e) => setTitle(e.target.value)} />

        ${suggestions.length ? html`
          <${Eyebrow} style=${{ marginTop: 18 }}>AGENDA · WHAT NEEDS A HUMAN</${Eyebrow}>
          <div class="card" style=${{ marginTop: 7, overflow: "hidden" }}>
            ${suggestions.map((t) => { const on = agenda.has(t.id); return html`<button key=${t.id} type="button" class="sc-agenda pressable" role="checkbox" aria-checked=${on} onClick=${() => { haptic("light"); toggleSet(setAgenda)(t.id); }}>
              <${CheckCircle} on=${on} size=${18} />
              <span class="t">${t.title}</span>
              <${Chip} tint=${TASK_STATE_TINT[t.state]}>${t.state}</${Chip}>
            </button>`; })}
          </div>` : null}

        <${Eyebrow} style=${{ marginTop: 18 }}>PEOPLE</${Eyebrow}>
        <div class="wk-chip-row" style=${{ marginTop: 8 }} role="group" aria-label="People">
          ${s.agents.map((a) => { const on = people.has(a.id); const directs = canDirect(s, a.id);
            return pick(on, a.name, () => toggleSet(setPeople)(a.id), html`<${AvatarChip} name=${a.name} color=${a.color} size=${20} />${directs ? html`<${Icon} name="sparkles.tv" size=${11} weight=${2.4} label="Can direct" style=${{ marginLeft: 2, color: on ? "currentColor" : "var(--violet)", opacity: on ? 0.85 : 1 }} />` : null}`); })}
        </div>
        <div class="sc-hint">The spark marks who can direct — someone should run the room.</div>

        <${Eyebrow} style=${{ marginTop: 18 }}>WHEN</${Eyebrow}>
        <div class="hstack" style=${{ gap: 7, marginTop: 8, flexWrap: "wrap" }} role="group" aria-label="When">
          ${["Now", "Later today", "Tomorrow · 10:00"].map((opt) => pick(when === opt, opt, () => setWhen(opt)))}
        </div>

        <${Eyebrow} style=${{ marginTop: 18 }}>INVITATION NOTE</${Eyebrow}>
        <textarea class="wk-input" style=${{ marginTop: 7, fontSize: 13, fontWeight: 500 }} rows="2" value=${note} placeholder="A line for the invitation" aria-label="Invitation note" onInput=${(e) => setNote(e.target.value)} />

        <button type="button" class="wk-grad-btn pressable" style=${{ marginTop: 20 }} disabled=${!title.trim() || sending} onClick=${send}>${sending ? "Sending…" : "Send invitations"}</button>
        ${sendError ? html`<div class="wk-error" role="alert" style=${{ marginTop: 8 }}>${sendError}</div>` : null}
        <div class="wk-note" style=${{ marginTop: 8 }}>${s.wireStatus.live
          ? "Live: the session and invitations are published to the room log."
          : s.wireDropped ? "Reconnect before sending so the room log stays the source of truth."
          : "Offline preview: this session stays on this device until the writer reconnects."}</div>
      ` : html`<div class="t-sm muted" style=${{ marginTop: 16, lineHeight: 1.4 }}>Pick a project — the agenda suggests itself from what needs a human there.</div>`}
    </div></div>
  </div>`;
}
