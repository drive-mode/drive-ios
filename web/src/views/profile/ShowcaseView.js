// A port of `Sources/ShowcaseView.swift` — Drivemode "by Cline": your
// projects as a shelf of squares, friends one row away, and every square one
// tap from README, demo (a directed replay — beats, never pixels) and the
// session. P0 prototype on local demo data (docs/SOCIAL.md).
import { html, cx, useState, useEffect, useRef, useObservable, useTick, haptic, reducedMotion } from "../../ui.js";
import { Screen, Icon, AvatarChip, ClineBot, Eyebrow, Card, LivePill, Segmented, TextField, Button, Empty } from "../../components.js";
import { agentColor, BEAT_TINT } from "../../models.js";
import { ctx } from "./shared.js";

// ------------------------------------------------------------- models

const VIOLET = "var(--violet)";
const friend = (id, name, color) => ({ id, name, color });
const comment = (id, author, color, text, age, fromYou = false) => ({ id, author, color, text, age, fromYou });
const member = (name, color, isAgent) => ({ name, color, isAgent });
const project = (p) => ({ comments: [], ...p });

export const ShowcaseDemo = {
  friends: [friend("anna", "Anna", "#7A3FD4"), friend("marco", "Marco", "#5B8DEF"), friend("jo", "Jo", "#E8A13C"), friend("sam", "Sam", "#2DD4BF")],
  you: [
    project({ id: "auth", name: "Auth middleware", tagline: "JWT gate with a green suite", state: "LIVE NOW", coverA: "#9F58FA", coverB: "#6D28D9", owner: "Harrison", ownerColor: VIOLET,
      readme: [
        { heading: "What it is", body: "A refresh-route gate: every token passes verifyJwt before routing. Two lines in the hot path, zero regressions." },
        { heading: "Why it exists", body: "The refresh regression kept coming back. Now the suite pins it dead — 5/5 passing, 38ms p95 after the gate." },
        { heading: "Stack", body: "TypeScript · bun test · drive-mode/auth" },
      ],
      hasDemo: true,
      team: [member("Harrison", VIOLET, false), member("Cline", agentColor("coder"), true), member("Maya", agentColor("maya"), true), member("Scout", agentColor("scout"), true)],
      cheers: ["Anna", "Marco"],
      comments: [
        comment("c1", "Anna", "#7A3FD4", "the demo sold me — that decision beat is such a nice way to show a call being made", "2h"),
        comment("c2", "Marco", "#5B8DEF", "stealing the early-return pattern for our gateway 🔥", "1h"),
      ] }),
    project({ id: "exports", name: "Exports refactor", tagline: "22 tasks, one clean adapter", state: "BUILDING", coverA: "#2DD4BF", coverB: "#0E7490", owner: "Harrison", ownerColor: VIOLET,
      readme: [
        { heading: "What it is", body: "One adapter for every export target — the fixture backfill alone retired six special cases." },
        { heading: "Where it stands", body: "7 running, 4 in review. The dependency map is the honest status page." },
      ],
      hasDemo: false,
      team: [member("Harrison", VIOLET, false), member("Cline", agentColor("coder"), true), member("Indexer", agentColor("indexer"), true)],
      cheers: ["Jo"],
      comments: [comment("c3", "Jo", "#E8A13C", "the task map on this is beautiful — how do I get in?", "3d")] }),
    project({ id: "notify", name: "Ship notifications", tagline: "Quiet by default, loud when it matters", state: "SHIPPED", coverA: "#F472B6", coverB: "#BE185D", owner: "Harrison", ownerColor: VIOLET,
      readme: [{ heading: "What it is", body: "Notification rules that respect quiet hours and escalate only unanswered blockers." }],
      hasDemo: false, team: [member("Harrison", VIOLET, false), member("Maya", agentColor("maya"), true)], cheers: [] }),
    project({ id: "quotas", name: "Quotas audit", tagline: "Limits, documented and enforced", state: "SHIPPED", coverA: "#FFC55C", coverB: "#B45309", owner: "Harrison", ownerColor: VIOLET,
      readme: [{ heading: "What it is", body: "Findings plus limits for every tenant path — the doc is the artifact." }],
      hasDemo: false, team: [member("Harrison", VIOLET, false), member("Scout", agentColor("scout"), true)], cheers: [] }),
  ],
  /** Friends' squares for the Home rail — inspiration, one swipe deep. */
  fromFriends: [],
  find(id) { return ShowcaseDemo.you.find((p) => p.id === id) ?? ShowcaseDemo.fromFriends.find((pair) => pair.project.id === id)?.project ?? null; },
  isYours(id) { return ShowcaseDemo.you.some((p) => p.id === id); },
};
ShowcaseDemo.fromFriends = [
  { friend: ShowcaseDemo.friends[0], project: project({ id: "anna-voice", name: "Voice memos → specs", tagline: "Talk a spec into existence", state: "LIVE NOW", coverA: "#7A3FD4", coverB: "#4C1D95", owner: "Anna", ownerColor: "#7A3FD4",
    readme: [
      { heading: "What it is", body: "Hold to talk, get a structured spec: sections, acceptance criteria, open questions." },
      { heading: "Try it", body: "Join a session and watch the plan beats assemble themselves." },
    ],
    hasDemo: true, team: [member("Anna", "#7A3FD4", false), member("Cline", agentColor("coder"), true)], cheers: ["Harrison", "Sam"],
    comments: [comment("c4", "Harrison", VIOLET, "ok the acceptance-criteria beat is genius", "1d", true)] }) },
  { friend: ShowcaseDemo.friends[1], project: project({ id: "marco-graph", name: "Dep-graph screensaver", tagline: "Your build graph, but gorgeous", state: "BUILDING", coverA: "#5B8DEF", coverB: "#1D4ED8", owner: "Marco", ownerColor: "#5B8DEF",
    readme: [{ heading: "What it is", body: "Renders the module graph as a slow constellation. Zero utility, maximum joy." }],
    hasDemo: false, team: [member("Marco", "#5B8DEF", false)], cheers: [] }) },
];

const cover = (p) => ({ "--a": p.coverA, "--b": p.coverB });

// -------------------------------------------------- showcase (grid)

export function ShowcaseView() {
  const store = useObservable(ctx.store);
  const enabled = store.configuration.showcaseEnabled;
  useEffect(() => { if (!enabled) ctx.nav.pop(); }, [enabled]);
  if (!enabled) return html`<${Screen} title="Showcase" back><${Empty} icon="square.grid.2x2" title="Showcase isn't in this build" body="The showcase is a preview surface — production fails closed." /></${Screen}>`;
  const name = store.displayNameForUser();
  return html`<${Screen} title="Showcase" back>
    <div class="hstack" style=${{ gap: 12, paddingTop: 8 }}>
      <${AvatarChip} letter=${name.charAt(0).toUpperCase()} name=${name} color="var(--violet)" size=${44} human />
      <div class="grow">
        <div class="t-xl w8" style=${{ fontSize: 20, letterSpacing: -0.4 }}>${name}'s showcase</div>
        <div class="hstack t-xs muted" style=${{ gap: 5, marginTop: 2 }}><${ClineBot} size=${10} color="var(--ink-35)" />Drivemode by Cline · ${ShowcaseDemo.you.length} projects · ${ShowcaseDemo.friends.length} friends</div>
      </div>
    </div>

    <div class="pf-grid" style=${{ marginTop: 14 }}>
      ${ShowcaseDemo.you.map((p) => html`<${ProjectSquare} key=${p.id} project=${p} onClick=${() => ctx.nav.push("showProject", { id: p.id })} />`)}
    </div>

    <div style=${{ marginTop: 22 }}><${Eyebrow}>FRIENDS</${Eyebrow}></div>
    <div class="pf-friends" role="list" aria-label="Friends">
      ${ShowcaseDemo.friends.map((f) => html`<div key=${f.id} class="pf-friend" role="listitem"><${AvatarChip} letter=${f.name.charAt(0)} name=${f.name} color=${f.color} size=${44} human /><span>${f.name}</span></div>`)}
      <button type="button" class="pf-friend invite pressable" onClick=${() => ctx.nav.toast("Invite links are preview only — friends arrive with the hosted showcase", { icon: "person.badge.plus" })} aria-label="Invite a friend">
        <span class="pf-iconbtn lg"><${Icon} name="plus" size=${16} weight=${2.6} /></span><span>Invite</span>
      </button>
    </div>

    ${ShowcaseDemo.fromFriends.map(({ friend: f, project: p }) => html`<div key=${p.id} style=${{ marginTop: 10 }}>
      <${Card} pad=${false} onClick=${() => ctx.nav.push("showProject", { id: p.id })} label=${`${p.name} by ${f.name}${p.state === "LIVE NOW" ? ", live now" : ""}`}>
        <div class="pf-friend-row">
          <span class="pf-thumb" style=${cover(p)}><${ClineBot} size=${18} color="rgba(255,255,255,.85)" /></span>
          <div class="grow">
            <div class="w7" style=${{ fontSize: 14.5 }}>${p.name}</div>
            <div class="t-xs muted truncate" style=${{ fontSize: 11.5, marginTop: 2 }}>${f.name} · ${p.tagline}</div>
          </div>
          ${p.state === "LIVE NOW" ? html`<${LivePill} />` : html`<${Icon} name="chevron.right" size=${13} weight=${2.6} color="var(--ink-35)" />`}
        </div>
      </${Card}>
    </div>`)}

    <div class="pf-foot" style=${{ paddingTop: 22, color: "var(--ink-55)" }}>Preview · your showcase is private by default — publishing a square is explicit, and demos are directed replays: source code never leaves.</div>
  </${Screen}>`;
}

/** One project square — cover gradient, state, the quiet Cline watermark. */
export function ProjectSquare({ project: p, onClick }) {
  const live = p.state === "LIVE NOW";
  return html`<button type="button" class="pf-square pressable" style=${cover(p)} onClick=${() => { haptic("light"); onClick?.(); }}
    aria-label=${`${p.name}, ${p.state.toLowerCase()}: ${p.tagline}`} title="Opens the project's README, demo, and people">
    <span class=${cx("pf-state", live && "live")}>${p.state}</span>
    <span class="pf-watermark" aria-hidden="true"><${ClineBot} size=${14} color="currentColor" /></span>
    <span class="pf-sq-name">${p.name}</span>
    <span class="pf-sq-tag">${p.tagline}</span>
  </button>`;
}

// ------------------------------------------ project page (README · Demo · People)

export function ProjectShowcaseView({ params = {} }) {
  const store = useObservable(ctx.store);
  const p = ShowcaseDemo.find(params.id);
  if (!store.configuration.showcaseEnabled || !p) return html`<${Screen} title="Project" back><${Empty} icon="square.grid.2x2" title="Project not found" /></${Screen}>`;
  const [tab, setTab] = useState("README");
  const [comments, setComments] = useState(p.comments);
  const [newComment, setNewComment] = useState("");
  const [cheered, setCheered] = useState(p.cheers.includes("Harrison"));
  const yours = ShowcaseDemo.isYours(p.id);
  const you = store.displayNameForUser();

  const post = () => {
    const text = newComment.trim();
    if (!text) return;
    setComments([...comments, { id: `c-${Date.now()}`, author: "You", color: VIOLET, text, age: "now", fromYou: true }]);
    setNewComment("");
    haptic("light");
  };
  const remove = (id) => { setComments(comments.filter((c) => c.id !== id)); ctx.nav.toast("Comment removed", { icon: "trash" }); };
  const share = async () => {
    const summary = `${p.name} — ${p.tagline} · Drivemode by Cline (README & demo only; source never leaves)`;
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text: summary }); return; }
      await navigator.clipboard?.writeText(summary);
      ctx.nav.toast("Copied — README & demo only, never source", { icon: "square.and.arrow.up" });
    } catch { /* cancelled */ }
  };
  const cheerNames = p.cheers.filter((n) => n !== "Harrison");
  const cheerLine = cheered
    ? (cheerNames.length ? `You, ${cheerNames.join(" and ")} cheered` : "You cheered")
    : (cheerNames.length ? `${cheerNames.join(" and ")} cheered` : "Be the first to cheer");

  return html`<${Screen} title=${p.name} back>
    <div class="pf-cover" style=${{ ...cover(p), marginTop: 8 }}>
      <div class="hstack" style=${{ justifyContent: "space-between" }}>
        <span class="pf-cstate">${p.state}</span>
        <span class="avatar-stack">${p.team.map((m) => html`<${AvatarChip} key=${m.name} letter=${m.name.charAt(0)} name=${m.name} color=${m.color} size=${24} human=${!m.isAgent} />`)}</span>
      </div>
      <div class="pf-cname">${p.name}</div>
      <div class="pf-csub">${p.owner} · ${p.tagline}</div>
      <div class="pf-cover-actions">
        <${Button} variant="onDark" size="sm" pill icon=${cheered ? "heart.fill" : "heart"} className=${cheered ? "on" : ""} onClick=${() => { setCheered(!cheered); haptic(cheered ? "light" : "success"); }} aria-pressed=${cheered} label=${cheered ? "Cheered — tap to undo" : "Cheer"}>${cheered ? "Cheered" : "Cheer"}</${Button}>
        <${Button} variant="onDark" size="sm" pill icon="square.and.arrow.up" onClick=${share} label="Share README and demo">Share</${Button}>
        <span class="grow" />
        <span style=${{ fontSize: 10.5, color: "rgba(255,255,255,.75)", alignSelf: "center", textAlign: "right" }}>${cheerLine}</span>
      </div>
    </div>

    <div style=${{ marginTop: 14 }}><${Segmented} options=${["README", "Demo", "People"]} value=${tab} onChange=${setTab} label="Project sections" /></div>

    ${tab === "Demo" ? html`<div style=${{ marginTop: 14 }}>
      ${p.hasDemo ? html`<div class="vstack" style=${{ gap: 8 }}>
        <${ReplayPlayer} beats=${store.beats} />
        <div class="t-xs muted" style=${{ fontSize: 10.5, lineHeight: 1.4 }}>DEMO.md · a directed replay — the same beats the session played live. Tap the thirds or swipe to scrub.</div>
      </div>` : html`<${Card} hero style=${{ padding: "70px 20px", textAlign: "center" }}>
        <${Icon} name="sparkles.tv" size=${30} weight=${1.6} color="var(--ink-35)" />
        <div class="w6 ink78" style=${{ fontSize: 13.5, marginTop: 10 }}>No demo published yet</div>
        <div class="t-xs muted" style=${{ marginTop: 4 }}>Publish any session replay as this project's DEMO.md.</div>
      </${Card}>`}
    </div>`
    : tab === "People" ? html`<div style=${{ marginTop: 14 }}>
      <div class="card" style=${{ padding: "4px 0" }}>
        ${p.team.map((m) => html`<div key=${m.name} class="pf-member">
          <${AvatarChip} letter=${m.name.charAt(0)} name=${m.name} color=${m.color} size=${30} human=${!m.isAgent} />
          <span class="w6" style=${{ fontSize: 14 }}>${m.name}</span>
          ${m.isAgent ? html`<span class="pf-agent">AGENT</span>` : null}
        </div>`)}
      </div>
      <div style=${{ marginTop: 12 }}><${Button} variant="gradient" fill icon="waveform" onClick=${() => store.joinCall()} style=${{ minHeight: 46 }} title="You'll be invited into the working session">Join this project's session</${Button}></div>

      <div style=${{ marginTop: 20 }}><${Eyebrow}>FROM FRIENDS</${Eyebrow}></div>
      ${comments.length === 0 ? html`<div class="t-sm muted" style=${{ marginTop: 8 }}>No comments yet — friends you invite can cheer here.</div>` : null}
      ${comments.map((c) => html`<div key=${c.id} class="card pf-comment bounce-in" style=${{ marginTop: 8 }}>
        <${AvatarChip} letter=${c.author.charAt(0)} name=${c.author} color=${c.color} size=${26} human />
        <div class="grow">
          <div><span class="pf-cauthor">${c.author}</span><span class="pf-cage">${c.age}</span></div>
          <div class="pf-ctext">${c.text}</div>
        </div>
        ${yours || c.fromYou ? html`<button type="button" class="pf-cdel pressable" aria-label=${`Remove comment by ${c.author}`} onClick=${() => remove(c.id)}><${Icon} name="trash" size=${14} weight=${2.2} /></button>` : null}
      </div>`)}
      <div class="pf-compose" style=${{ marginTop: 12 }}>
        <${TextField} value=${newComment} onInput=${setNewComment} placeholder="Say something nice…" onSubmit=${post} label="Comment" clearable=${false} />
        <button type="button" class="pf-send pressable" style=${{ width: 34, height: 34 }} aria-label="Post comment" disabled=${!newComment.trim()} onClick=${post}><${Icon} name="arrow.up" size=${15} weight=${3} /></button>
      </div>
      <div class="t-xs faint" style=${{ fontSize: 10, marginTop: 7 }}>Owners moderate their space — you can remove any comment on your work.</div>
    </div>`
    : html`<div style=${{ marginTop: 6 }}>
      ${p.readme.map((s) => html`<div key=${s.heading} class="card pf-readme" style=${{ marginTop: 8 }}><div class="pf-rh">${s.heading}</div><div class="pf-rb">${s.body}</div></div>`)}
      <div class="t-xs faint" style=${{ fontSize: 10, marginTop: 8 }}>README.md · rendered from the project</div>
    </div>`}
  </${Screen}>`;
}

// ------------------------------------------------------ replay player

function positionIn(beats, elapsed) {
  if (!beats.length) return { index: 0, progress: 0 };
  const total = beats.reduce((s, b) => s + b.duration, 0);
  let t = ((elapsed % total) + total) % total;
  for (let i = 0; i < beats.length; i++) { if (t < beats[i].duration) return { index: i, progress: t / beats[i].duration }; t -= beats[i].duration; }
  return { index: beats.length - 1, progress: 1 };
}

/** DEMO.md IS the directed beat program: plan → diagram → edit → tests →
 *  result, replayed from typed events. Tap the thirds or swipe to scrub. */
export function ReplayPlayer({ beats }) {
  const start = useRef(Date.now());
  const skew = useRef(0);
  const swipeFrom = useRef(null);
  useTick(4, beats.length > 0);
  if (!beats.length) return html`<div class="pf-replay center"><span class="t-sm" style=${{ color: "rgba(255,255,255,.6)" }}>No beats in this replay.</span></div>`;
  const now = Date.now();
  const pos = positionIn(beats, (now - start.current) / 1000 + skew.current);
  const beat = beats[pos.index];
  const tint = BEAT_TINT[beat.kind] ?? "var(--violet)";
  const skipForward = () => { const { index: i, progress: p } = pos; const next = (i + 1) % beats.length; skew.current += beats[i].duration * (1 - p) + beats[next].duration * 0.55; haptic("light"); };
  const skipBack = () => { const { index: i, progress: p } = pos; if (p > 0.2) skew.current -= beats[i].duration * p - 0.01; else { const prev = (i - 1 + beats.length) % beats.length; skew.current -= beats[i].duration * p + beats[prev].duration - 0.01; } haptic("light"); };
  const shown = reducedMotion() ? beat.steps.length : Math.min(beat.steps.length, Math.ceil(pos.progress * beat.steps.length * 1.25) + 1);
  return html`<div class="pf-replay" style=${{ "--tint": tint }} role="group" aria-label=${`Replay, beat ${pos.index + 1} of ${beats.length}: ${beat.kind} ${beat.title}`}
    onPointerDown=${(e) => { swipeFrom.current = e.clientX; }} onPointerUp=${(e) => { const f = swipeFrom.current; swipeFrom.current = null; if (f == null) return; const dx = e.clientX - f; if (Math.abs(dx) > 50) { dx < 0 ? skipForward() : skipBack(); } }}>
    <div class="hstack" style=${{ gap: 8 }}>
      <div class="pf-rail-track" aria-hidden="true">${beats.map((b, i) => html`<span key=${b.id} class="pf-rail-seg" style=${{ "--tint": BEAT_TINT[b.kind] }}><i style=${{ width: `${i < pos.index ? 100 : i === pos.index ? pos.progress * 100 : 0}%` }} /></span>`)}</div>
      <span class="mono" style=${{ fontSize: 8.5, fontWeight: 800, letterSpacing: .8, color: "rgba(255,255,255,.45)" }}>REPLAY</span>
    </div>
    <div class="pf-rkind" style=${{ marginTop: 12 }}>${beat.kind} · ${pos.index + 1}/${beats.length}</div>
    <div class="pf-rtitle">${beat.title}</div>
    <div class="pf-rcaption">${beat.caption}</div>
    <div class="pf-steps">${beat.steps.map((s, i) => html`<div key=${`${beat.id}-${i}`} class=${cx("pf-step", i < shown && "shown", beat.accent?.includes(i) && "accent")}>${s.replace("|", " · ")}</div>`)}</div>
    <div class="pf-director"><${AvatarChip} letter=${beat.director.charAt(0)} name=${beat.director} color=${beat.directorColor} size=${16} /><span>${beat.director} directing</span></div>
    <div class="pf-tapzone" aria-hidden="true"><button type="button" tabIndex=${-1} onClick=${skipBack} /><span /><button type="button" tabIndex=${-1} onClick=${skipForward} /></div>
  </div>`;
}

// ----------------------------------------------------------- Home rail

/** Inspiration one swipe deep: friends' freshest squares on Home. */
export function FromFriendsRail() {
  return html`<div>
    <div class="hstack" style=${{ justifyContent: "space-between" }}>
      <${Eyebrow}>FROM FRIENDS</${Eyebrow}>
      <button type="button" class="hstack violet w7 pressable" style=${{ gap: 4, fontSize: 12, minHeight: 32, padding: "0 4px" }} onClick=${() => ctx.nav.push("showcase")}>Showcase<${Icon} name="chevron.right" size=${10} weight=${3} /></button>
    </div>
    <div class="pf-rail">
      ${ShowcaseDemo.fromFriends.map(({ friend: f, project: p }) => html`<button key=${p.id} type="button" class="card pf-rail-card pressable" onClick=${() => ctx.nav.push("showProject", { id: p.id })} aria-label=${`${p.name} by ${f.name}${p.state === "LIVE NOW" ? ", live now" : ""}`}>
        <span class="pf-thumb" style=${cover(p)}><${ClineBot} size=${20} color="rgba(255,255,255,.85)" /></span>
        <span class="grow" style=${{ minWidth: 0 }}>
          <span class="w7 truncate" style=${{ display: "block", fontSize: 12.5 }}>${p.name}</span>
          <span class="t-xs muted" style=${{ display: "block", marginTop: 3, fontSize: 10.5 }}>${f.name}</span>
          ${p.state === "LIVE NOW" ? html`<span class="hstack live w7" style=${{ gap: 4, fontSize: 9, marginTop: 3 }}><i class="dot" style=${{ width: 5, height: 5 }} />Live now</span>` : null}
        </span>
      </button>`)}
    </div>
  </div>`;
}
