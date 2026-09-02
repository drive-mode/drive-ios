// Home cluster — shared bits that Components.swift does not give us: the
// module-scoped stylesheet (token-only, injected once), the store/nav context
// handed over by registerHome, and two tiny helpers every Home view uses.
import { html, useObservable } from "../../ui.js";

/** Append a <style> once. Views call this at module load. */
export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Set by registerHome({ store, nav }) before any view renders. */
export const ctx = { store: null, nav: null };
export function setContext(next) { Object.assign(ctx, next); }

/** Pushed pages sit under the guide bar while it is visible — leave room. */
export function TabBarSpacer() {
  const s = useObservable(ctx.store);
  return html`<div aria-hidden="true" style=${{ height: s.tabBarVisible ? "var(--tabbar-h)" : 0, transition: "height .3s var(--ease)" }} />`;
}

/** "Maya · Plan ready…" — the deferred row drops the agent's own name prefix. */
export function stripAgentPrefix(title, agentName) {
  return title.startsWith(`${agentName} `) ? title.slice(agentName.length + 1) : title;
}

injectStyle("home-css", `
/* ---------------------------------------------------------- Open */
.hm-open { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: calc(var(--safe-top) + 24px) 36px calc(var(--safe-bottom) + 10px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--violet) 3%, var(--page)), var(--page) 60%); overflow-y: auto; }
.hm-open .mark-tile { width: 96px; height: 96px; border-radius: 22px; background: var(--surface); display: grid; place-items: center;
  box-shadow: inset 0 0 0 .8px var(--hairline), 0 5px 14px rgba(0,0,0,.08); }
.hm-open .wordmark { margin-top: 20px; font-size: 12px; font-weight: 700; letter-spacing: 4.5px; color: var(--ink-55); }
.hm-open h1 { margin-top: 10px; font-size: 34px; font-weight: 900; letter-spacing: -1.2px; line-height: 1.08; }
.hm-open h1 .verb { color: var(--violet-text); }
.hm-open .lede { margin-top: 14px; font-size: 15px; line-height: 1.45; color: var(--ink-55); white-space: pre-line; }
.hm-open .cta { margin-top: 34px; width: 100%; height: 52px; border-radius: var(--r-hero); font-size: 16px; font-weight: 700; color: #fff;
  background: var(--hero-gradient); box-shadow: 0 8px 14px color-mix(in srgb, var(--violet) 35%, transparent); }
.hm-open .alt { margin-top: 12px; width: 100%; height: 52px; border-radius: var(--r-hero); font-size: 15px; font-weight: 600; color: var(--ink);
  background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); }
.hm-open .invite { margin-top: 18px; min-height: 44px; padding: 0 12px; font-size: 13px; font-weight: 600; color: var(--violet-text); }
.hm-open .foot { margin-top: auto; padding: 24px 0 0; font-size: 12px; font-weight: 600; color: var(--ink-55); }

/* ---------------------------------------------------------- Home */
.hm-content { padding-left: 20px; padding-right: 20px; }
.hm-header { display: flex; align-items: center; gap: 6px; }
.hm-brand { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 0; }
.hm-brand h1 { font-size: 34px; font-weight: 900; letter-spacing: -1.2px; line-height: 1; }
.hm-hit { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; position: relative; flex: none; color: var(--ink-78); }
.hm-hit .ring { width: 34px; height: 34px; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); display: grid; place-items: center; }
.hm-hit .hm-badge { position: absolute; top: 2px; right: 1px; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 9px;
  background: var(--violet); color: #fff; font-size: 10px; font-weight: 900; display: grid; place-items: center; }
.hm-reconnect { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 13px; background: var(--surface2);
  border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); }
.hm-search { margin-top: 14px; display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 14px; background: var(--surface2); border-radius: var(--r-control); }
.hm-search input { flex: 1; min-width: 0; background: transparent; border: 0; font-size: 15px; color: var(--ink); }
.hm-search input::placeholder { color: var(--ink-35); }
.hm-link { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 4px; font-size: 12px; font-weight: 700; color: var(--violet-text); }
.hm-hero { position: relative; overflow: hidden; padding: 18px; border-radius: var(--r-hero); background: var(--hero-gradient); color: #fff; text-align: left;
  box-shadow: 0 8px 30px color-mix(in srgb, var(--violet) 28%, transparent); }
.hm-hero::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(190px 190px at 88% -10%, rgba(255,255,255,.30), transparent 70%); }
.hm-hero > * { position: relative; }
.hm-hero .title { margin-top: 12px; font-size: 23px; font-weight: 900; letter-spacing: -.5px; line-height: 1.15; }
.hm-hero .people { margin-top: 5px; font-size: 13px; opacity: .78; }
.hm-hero .stage { display: inline-flex; align-items: center; gap: 7px; margin-top: 12px; padding: 7px 10px; border-radius: var(--r-pill);
  background: rgba(255,255,255,.14); font-size: 11.5px; font-weight: 600; opacity: .9; }
.hm-hero .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.hm-hero .hm-stack { display: inline-flex; }
.hm-hero .hm-stack .avatar { box-shadow: 0 0 0 2px rgba(255,255,255,.9); }
.hm-hero .hm-stack .avatar + .avatar { margin-left: -7px; }
.hm-hero .join { padding: 9px 20px; min-height: 36px; border-radius: var(--r-pill); background: #fff; color: var(--maya); font-size: 14px; font-weight: 700; }
.hm-quiet { display: flex; align-items: center; gap: 12px; }
.hm-quiet .glyph { width: 38px; height: 38px; border-radius: var(--r-control); display: grid; place-items: center; color: var(--violet-text);
  background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.hm-wash { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 8px 12px; border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); font-size: 12.5px; font-weight: 700; white-space: nowrap; }
.hm-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 10px; }
.hm-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 84px; padding: 12px 13px; text-align: left; color: var(--ink);
  background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline), var(--card-shadow); }
.hm-tile .icon { color: var(--ink-35); }
.hm-tile .v { font-size: 20px; font-weight: 900; letter-spacing: -.5px; line-height: 1; }
.hm-tile .l { font-size: 10.5px; font-weight: 600; color: var(--ink-55); }
.hm-tile.accent { background: color-mix(in srgb, var(--violet) 10%, transparent); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 22%, transparent); }
.hm-tile.accent .v, .hm-tile.accent .icon { color: var(--violet-text); }
.hm-trial { display: flex; justify-content: center; margin-top: 24px; }
.hm-trial span { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; border-radius: var(--r-pill); font-size: 10.5px; font-weight: 600;
  color: var(--violet-text); background: color-mix(in srgb, var(--violet) 8%, transparent); }
.hm-rail { display: flex; gap: 9px; overflow-x: auto; margin: 10px -20px 0; padding: 0 20px 4px; scrollbar-width: none; scroll-snap-type: x proximity; }
.hm-rail::-webkit-scrollbar { display: none; }
.hm-rail > * { flex: none; scroll-snap-align: start; }
.hm-art { width: 168px; min-height: 96px; padding: 11px; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; text-align: left; color: var(--ink);
  background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--tint) 22%, transparent); }
.hm-art .kind { display: flex; align-items: center; gap: 6px; width: 100%; color: var(--tint); font-size: 8.5px; font-weight: 900; letter-spacing: .8px; }
.hm-art .kind .grow { flex: 1; }
.hm-art .t { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
.hm-art .m { font-size: 9.5px; color: var(--ink-55); margin-top: auto; }
.hm-friend { width: 200px; padding: 10px; display: flex; align-items: center; gap: 10px; text-align: left; color: var(--ink);
  background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); }
.hm-friend .hm-cover { width: 56px; height: 56px; border-radius: 10px; display: grid; place-items: center; flex: none; background: linear-gradient(135deg, var(--a), var(--b)); }
.hm-recent { display: flex; align-items: center; gap: 12px; padding: 13px 14px; margin-top: 10px; text-align: left; color: var(--ink); width: 100%; }
.hm-recent .glyph { width: 36px; height: 36px; border-radius: var(--r-control); display: grid; place-items: center; font-size: 14px; font-weight: 900; flex: none;
  background: var(--surface2); color: var(--ink-55); }
.hm-recent .glyph.badge { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }
.hm-recent .pill { padding: 6px 11px; border-radius: var(--r-control); font-size: 12px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.hm-prod { margin-top: 24px; padding: 22px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.hm-peek { display: flex; flex-direction: column; gap: 9px; padding: 8px 8px 4px; text-align: left; }
.hm-peek .stat { display: inline-flex; align-items: baseline; gap: 5px; }
.hm-peek .stat b { font-size: 15px; font-weight: 900; }
.hm-peek .stat span { font-size: 11px; font-weight: 600; color: var(--ink-55); }
.hm-task { display: flex; align-items: center; gap: 9px; padding: 8px 10px; background: var(--surface); border-radius: 11px; box-shadow: inset 0 0 0 .8px var(--hairline); }
.hm-state { font-size: 11px; font-weight: 700; padding: 4.5px 9px; border-radius: var(--r-control); background: var(--surface2); color: var(--ink-55); display: inline-flex; align-items: center; gap: 4.5px; }
.hm-state.review { color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.hm-state.blocked { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.hm-fab { position: absolute; right: 16px; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; z-index: 6;
  background: var(--hero-gradient); box-shadow: 0 4px 10px color-mix(in srgb, var(--violet) 40%, transparent); transition: bottom .35s var(--spring), transform .28s var(--spring); }
.hm-fab:active { transform: scale(calc(1 - .06 * var(--motion))); }

/* ------------------------------------------------------ Needs you */
.ny-count { width: 26px; height: 26px; border-radius: 50%; background: var(--violet); color: #fff; font-size: 12px; font-weight: 900; display: grid; place-items: center; }
.ny-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 0; text-align: center; }
.ny-card { margin-top: 14px; padding: 16px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 28%, transparent); }
.ny-head { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; color: var(--ink); min-height: 44px; }
.ny-head .t { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 700; line-height: 1.3; }
.ny-diff { margin-top: 12px; padding: 11px 13px; background: var(--surface2); border-radius: var(--r-control); font-family: var(--mono); font-size: 11.5px; color: var(--diff-green);
  display: flex; flex-direction: column; gap: 4px; white-space: pre-wrap; word-break: break-word; }
.ny-quote { display: flex; margin-top: 12px; }
.ny-quote i { width: 2.5px; border-radius: 2px; background: color-mix(in srgb, var(--violet) 40%, transparent); flex: none; }
.ny-quote span { padding-left: 12px; font-size: 13.5px; line-height: 1.45; color: var(--ink-78); }
.ny-actions { display: flex; gap: 9px; margin-top: 14px; }
.ny-btn { flex: 1; min-height: 44px; border-radius: var(--r-control); font-size: 14px; font-weight: 700; display: grid; place-items: center; }
.ny-btn.ghost { background: var(--surface2); color: var(--ink-78); }
.ny-btn.wash { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }
.ny-btn.solid { background: var(--hero-gradient); color: #fff; }
.ny-deferred { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 8px 8px 8px 16px; border-radius: var(--r-card);
  border: .8px dashed color-mix(in srgb, var(--ink) 14%, transparent); }
.ny-deferred .t { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; color: var(--ink-55); }
.ny-deferred .t b { color: var(--ink); }
.ny-open { min-height: 44px; padding: 0 10px; font-size: 13px; font-weight: 700; color: var(--violet-text); }

/* ---------------------------------------------------- Conversation */
.cv-thread { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
.cv-context { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: var(--r-pill); background: var(--surface2); font-size: 11px; font-weight: 600; color: var(--ink-55); }
.cv-context .t { flex: 1; min-width: 0; }
.cv-sys { display: flex; align-items: center; gap: 6px; padding: 0 4px; color: var(--ink-35); font-family: var(--mono); font-size: 10.5px; }
.cv-sys .t { flex: 1; min-width: 0; }
.cv-agent { display: flex; align-items: flex-end; gap: 9px; padding-right: 28px; }
.cv-agent .b { padding: 11px 14px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 14px; line-height: 1.5; }
.cv-you { display: flex; justify-content: flex-end; padding-left: 48px; }
.cv-you .b { padding: 11px 14px; background: var(--hero-gradient); color: #fff; border-radius: var(--r-card); font-size: 14px; font-weight: 500; line-height: 1.5; }
.cv-cleared { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 6px; font-size: 11.5px; font-weight: 600; color: var(--ink-55); }
.cv-approval { padding: 14px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 28%, transparent); }
.cv-footer { flex: none; background: var(--page); box-shadow: 0 -.5px 0 var(--hairline); transition: padding-bottom .3s var(--ease); }
.cv-quick { display: flex; gap: 8px; overflow-x: auto; padding: 10px 20px; scrollbar-width: none; }
.cv-quick::-webkit-scrollbar { display: none; }
.cv-quick .q { flex: none; min-height: 36px; padding: 9px 14px; border-radius: var(--r-pill); font-size: 13px; font-weight: 700; color: var(--violet-text);
  background: color-mix(in srgb, var(--violet) 10%, transparent); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 22%, transparent); }
.cv-bar { display: flex; align-items: center; gap: 10px; padding: 6px 20px 10px; }
.cv-field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 6px 0 14px; background: var(--surface2); border-radius: 22px; }
.cv-field input { flex: 1; min-width: 0; background: transparent; border: 0; font-size: 14px; color: var(--ink); }
.cv-field input::placeholder { color: var(--ink-35); }
.cv-field .send { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--violet); }
.cv-field .send:disabled { opacity: .35; }
.cv-voice { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px; border-radius: 22px;
  background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); font-size: 12.5px; font-weight: 600; }
.cv-mic { width: 44px; height: 44px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: var(--hero-gradient);
  box-shadow: 0 4px 8px color-mix(in srgb, var(--violet) 30%, transparent); touch-action: none; user-select: none; -webkit-user-select: none; transition: transform .28s var(--spring); }
.cv-mic.held { transform: scale(1.1); }

/* ----------------------------------------------------------- Inbox */
.ib-filters { display: flex; flex-direction: column; gap: 8px; padding: 8px 20px 4px; }
.ib-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ib-unread { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 8px 13px; border-radius: var(--r-pill); font-size: 12.5px; font-weight: 700;
  color: var(--ink-78); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); }
.ib-unread .dot { background: var(--violet); }
.ib-unread.on { color: #fff; background: var(--violet); box-shadow: none; }
.ib-unread.on .dot { background: #fff; }
.ib-list { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.ib-swipe { position: relative; overflow: hidden; border-radius: var(--r-card); }
.ib-actions { position: absolute; inset: 0; display: flex; }
.ib-actions.lead { justify-content: flex-start; background: var(--violet); }
.ib-actions.trail { justify-content: flex-end; background: var(--danger); }
.ib-act { width: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #fff; font-size: 11px; font-weight: 700; }
.ib-act.read { width: 88px; background: var(--violet); }
.ib-act.archive { background: var(--tint-blue); }
.ib-act.delete { background: var(--danger); }
.ib-row { position: relative; width: 100%; padding: 13px; text-align: left; color: inherit; background: var(--surface); border-radius: var(--r-card);
  box-shadow: inset 0 0 0 .8px var(--hairline); transition: transform .25s var(--ease); touch-action: pan-y; }
.ib-row.dragging { transition: none; }
.ib-row.read { background: color-mix(in srgb, var(--surface) 62%, var(--page)); }
.ib-row.unread { box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--tint) 28%, transparent); }
.ib-head { display: flex; align-items: flex-start; gap: 11px; }
.ib-kind { position: relative; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: none;
  background: color-mix(in srgb, var(--tint) 13%, transparent); color: var(--tint); }
.ib-kind .dot { position: absolute; top: -3px; right: -3px; width: 8px; height: 8px; background: var(--violet); }
.ib-body { flex: 1; min-width: 0; }
.ib-title { display: flex; align-items: baseline; gap: 8px; font-size: 14px; font-weight: 600; }
.ib-title.unread { font-weight: 900; }
.ib-title .t { flex: 1; min-width: 0; }
.ib-text { margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--ink-55); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ib-acts { display: flex; gap: 9px; margin-top: 11px; padding-left: 45px; flex-wrap: wrap; }
.ib-btn { min-height: 38px; padding: 0 18px; border-radius: var(--r-control); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
.ib-btn.solid { background: var(--hero-gradient); color: #fff; }
.ib-btn.plain { background: var(--surface2); color: var(--ink-78); }
.ib-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 24px; text-align: center; }

/* -------------------------------------------------------- Approval */
.ap { padding: 6px 20px calc(var(--safe-bottom) + 20px); color: var(--ink); --diff-green-on-light: #178C15; /* DT.diffGreenOnLight */ }
.ap h2 { margin-top: 8px; font-size: 26px; font-weight: 900; letter-spacing: -.8px; }
.ap .who { display: flex; align-items: center; gap: 5px; margin-top: 6px; font-size: 14px; color: var(--ink-55); }
.ap .file { font-family: var(--mono); font-size: 12.5px; color: var(--ink); background: var(--surface2); padding: 2px 6px; border-radius: 5px; }
.ap .diff { margin-top: 16px; padding: 13px 15px; background: var(--surface2); border-radius: var(--r-control); box-shadow: inset 0 0 0 .8px var(--ink-08); display: flex; flex-direction: column; gap: 5px; }
.ap .diff .diff-line { background: none; padding: 0; font-size: 12.5px; color: var(--diff-green-on-light); }
.ap .stats { display: flex; gap: 14px; margin-top: 10px; font-family: var(--mono); font-size: 11px; color: var(--ink-35); }
.ap .stats .plus { color: var(--diff-green-on-light); } .ap .stats .minus { color: var(--danger); }
.ap .btns { display: flex; gap: 10px; margin-top: 20px; }
.ap .btns button { flex: 1; height: 52px; border-radius: var(--r-hero); font-size: 16px; font-weight: 700; transition: transform .28s var(--spring), opacity .15s; }
.ap .btns button:active { transform: scale(calc(1 - .04 * var(--motion))); opacity: .88; }
.ap .deny { background: var(--surface2); color: var(--ink); }
.ap .allow { background: var(--hero-gradient); color: #fff; box-shadow: 0 6px 12px color-mix(in srgb, var(--violet) 35%, transparent); }
.ap .foot { margin-top: 14px; text-align: center; font-size: 11px; color: var(--ink-35); }
`);
injectStyle("home-css-focus", `
.hm-search input:focus, .cv-field input:focus { outline: none; }
.hm-search:focus-within, .cv-field:focus-within { box-shadow: inset 0 0 0 1.4px var(--violet); }
`);
