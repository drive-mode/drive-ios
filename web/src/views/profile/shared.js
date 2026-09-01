// Shared plumbing for the Profile / Settings cluster: the bound store + nav
// (received from registerProfile), the module-scoped stylesheet (token-only,
// injected once), and a few tiny helpers every module in this folder uses.
import { html, cx, useState, useEffect, useRef, Observable } from "../../ui.js";
import { CountUp, Icon } from "../../components.js";

/** Bound at registration; views read `ctx.store` / `ctx.nav` (never import the store). */
export const ctx = { store: null, nav: null };
export function bind({ store, nav }) { ctx.store = store; ctx.nav = nav; }

/** Profile layout (order / hidden) changes are announced here so the pushed
 *  Profile page underneath the customize sheet re-renders. */
export const profileLayout = new Observable();

/** Inject a stylesheet once (ARCHITECTURE.md pattern). */
export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

export const PROFILE_CSS = `
/* ---- profile cluster (token-only) ---- */
.pf-head { display: flex; align-items: center; gap: 13px; padding-top: 6px; }
.pf-head .pf-name { font-size: 21px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; }
.pf-head .pf-mail { font-size: 11.5px; color: var(--ink-55); margin-top: 2px; }
.pf-iconbtn { width: 34px; height: 34px; border-radius: 50%; display: inline-grid; place-items: center; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.pf-iconbtn.lg { width: 44px; height: 44px; }
.pf-showcase-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--hero-gradient); display: grid; place-items: center; color: #fff; flex: none; }
.pf-rings-card { display: flex; align-items: center; gap: 20px; }
.pf-ring-track { opacity: .16; }
.pf-ring-fill { transition: stroke-dashoffset 1.1s var(--spring); transition-delay: var(--delay, 0s); }
:root[data-reduce-motion="1"] .pf-ring-fill { transition: none; }
.pf-legend { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pf-legend .pf-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.pf-legend .pf-val { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pf-legend .pf-goal { font-size: 10.5px; color: var(--ink-55); }
.pf-legend .pf-lab { font-size: 8.5px; font-weight: 800; letter-spacing: 1px; color: var(--ink-35); text-transform: uppercase; }
.pf-insight { display: flex; align-items: flex-start; gap: 9px; font-size: 12.5px; line-height: 1.45; color: var(--ink-78); }
.pf-insight .icon { margin-top: 3px; color: var(--violet-text); }
.pf-week { display: flex; align-items: flex-end; gap: 10px; height: 118px; }
.pf-week .pf-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; min-width: 0; }
.pf-week .pf-num { font-family: var(--mono); font-size: 9.5px; font-weight: 700; color: var(--ink-35); opacity: 0; transition: opacity .5s ease .5s; }
.pf-week .pf-num.best { color: var(--violet-text); }
.pf-week .pf-barwrap { flex: 1; width: 100%; display: flex; align-items: flex-end; min-height: 0; }
.pf-week .pf-bar { width: 100%; border-radius: 5px; background: color-mix(in srgb, var(--violet) 22%, transparent); transform-origin: bottom; transform: scaleY(.05); transition: transform .8s var(--spring) .15s; min-height: 5px; }
:root[data-theme="dark"] .pf-week .pf-bar { background: color-mix(in srgb, var(--violet) 34%, transparent); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pf-week .pf-bar { background: color-mix(in srgb, var(--violet) 34%, transparent); } }
:root[data-theme="light"] .pf-week .pf-bar { background: color-mix(in srgb, var(--violet) 22%, transparent); }
.pf-week .pf-bar.best { background: var(--hero-gradient); }
.pf-week.grow .pf-bar { transform: scaleY(1); }
.pf-week.grow .pf-num { opacity: 1; }
:root[data-reduce-motion="1"] .pf-week .pf-bar, :root[data-reduce-motion="1"] .pf-week .pf-num { transition: none; }
.pf-week .pf-day { font-size: 9px; font-weight: 600; color: var(--ink-35); }
.pf-week .pf-day.best { font-weight: 800; color: var(--violet-text); }
.pf-trend { display: flex; flex-direction: column; gap: 5px; padding: 11px 12px; min-width: 0; }
.pf-trend .pf-delta { display: flex; align-items: center; gap: 3px; font-size: 14px; font-weight: 800; color: var(--live); }
.pf-trend .pf-delta.bad { color: var(--danger); }
.pf-trend .pf-tlabel { font-size: 9.5px; font-weight: 600; color: var(--ink-55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-record { display: flex; flex-direction: column; gap: 6px; padding: 14px; min-width: 0; }
.pf-record .pf-rec-eyebrow { display: flex; align-items: center; gap: 6px; font-size: 8px; font-weight: 800; letter-spacing: 1.2px; color: var(--ink-35); }
.pf-record .pf-rec-eyebrow .icon { color: var(--tint-amber); }
.pf-record .pf-rec-val { font-size: 26px; font-weight: 800; letter-spacing: -0.8px; font-variant-numeric: tabular-nums; }
.pf-record .pf-rec-lab { font-size: 12px; font-weight: 700; }
.pf-record .pf-rec-sub { font-size: 10px; color: var(--ink-55); }
.pf-streak { display: flex; align-items: center; gap: 13px; padding: 14px; border-radius: var(--r-hero); background: color-mix(in srgb, var(--violet) 7%, transparent); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 20%, transparent); }
.pf-streak .pf-ring { width: 44px; height: 44px; border-radius: 50%; background: color-mix(in srgb, var(--violet) 12%, transparent); display: grid; place-items: center; flex: none; }
.pf-badges { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.pf-badge { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 11px 6px; text-align: center; }
.pf-badge.locked { opacity: .72; }
.pf-badge .pf-medal { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: var(--surface2); color: var(--ink-35); }
.pf-badge.earned .pf-medal { background: var(--hero-gradient); color: #fff; }
.pf-badge .pf-bname { font-size: 10.5px; font-weight: 700; }
.pf-badge.locked .pf-bname { color: var(--ink-35); }
.pf-badge .pf-bnote { font-size: 8.5px; color: var(--ink-35); line-height: 1.3; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-links .row { min-height: 56px; }
.pf-links .row .row-icon { background: transparent; color: var(--violet-text); }
.pf-links .row .row-sub { font-size: 11px; color: var(--ink-35); }
.pf-metrics { display: flex; gap: 9px; }
.pf-metric { flex: 1; min-width: 0; }
.pf-metric .pf-mv { font-size: 21px; font-weight: 800; }
.pf-metric .pf-ml { font-size: 10px; font-weight: 600; color: var(--ink-55); }
.pf-foot { font-size: 10.5px; color: var(--ink-35); text-align: center; padding-top: 18px; }

/* ---- customize ---- */
.pf-mod { display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 14px; min-height: 56px; background: var(--surface); position: relative; touch-action: pan-y; transition: transform .22s var(--ease), box-shadow .2s; }
.pf-mod + .pf-mod { box-shadow: inset 0 .8px 0 var(--hairline); }
.pf-mod.dragging { z-index: 2; box-shadow: 0 10px 30px rgba(0,0,0,.25), inset 0 0 0 .8px var(--hairline); border-radius: var(--r-control); transition: none; }
.pf-mod .pf-mod-icon { width: 26px; color: var(--violet-text); display: grid; place-items: center; flex: none; }
.pf-mod .pf-mod-label { flex: 1; min-width: 0; font-size: 15px; }
.pf-mod .pf-grip { width: 44px; height: 44px; display: grid; place-items: center; color: var(--ink-35); cursor: grab; touch-action: none; flex: none; border-radius: 8px; }
.pf-mod .pf-grip:active { cursor: grabbing; }
.pf-arrows { display: flex; flex-direction: column; gap: 0; }
.pf-arrows button { width: 30px; height: 22px; display: grid; place-items: center; color: var(--ink-35); border-radius: 6px; }
.pf-arrows button:disabled { opacity: .3; }
.pf-cline-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; min-height: 56px; width: 100%; text-align: left; }

/* ---- settings ---- */
.pf-settings { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }
.pf-set-top { display: flex; align-items: center; gap: 8px; padding: 4px 12px 8px 12px; min-height: 48px; }
.pf-set-top .pf-set-title { flex: 1; text-align: center; font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }
.pf-set-top .pf-close { width: 36px; height: 36px; display: grid; place-items: center; color: var(--violet-text); border-radius: 50%; background: color-mix(in srgb, var(--violet) 12%, transparent); }
.pf-set-top .pf-reset { font-size: 13px; font-weight: 700; color: var(--violet); padding: 6px 8px; border-radius: 8px; min-height: 36px; }
.pf-set-top .pf-reset:disabled { opacity: .4; }
.pf-set-top .pf-save { font-size: 13px; font-weight: 700; color: var(--violet); padding: 0 12px; min-height: 36px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 6%, transparent); transition: background .15s; }
.pf-set-top .pf-save.dirty { background: color-mix(in srgb, var(--violet) 14%, transparent); }
.pf-set-top .pf-save:disabled { opacity: .55; }
.pf-set-picker { display: flex; align-items: center; gap: 10px; padding: 0 16px 0 20px; min-height: 48px; box-shadow: 0 .5px 0 var(--hairline); background: color-mix(in srgb, var(--page) 86%, transparent); flex: none; }
.pf-set-picker .pf-pick { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; min-height: 44px; padding: 0 6px; border-radius: 8px; color: var(--ink); }
.pf-set-picker .pf-pick .icon { color: var(--violet); }
.pf-set-picker .pf-pick .chev { color: var(--ink-35); }
.pf-draft-pill { font-size: 10px; font-weight: 700; color: var(--violet); padding: 4px 8px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.pf-set-body { flex: 1; min-height: 0; display: flex; }
.pf-set-body.split { display: grid; grid-template-columns: 240px 1fr; }
.pf-set-side { border-right: .8px solid var(--hairline); overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.pf-set-side .pf-side-title { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; padding: 10px 12px 12px; }
.pf-set-side button { display: flex; align-items: center; gap: 10px; padding: 0 12px; min-height: 44px; border-radius: var(--r-control); font-size: 14.5px; font-weight: 600; color: var(--ink); text-align: left; width: 100%; }
.pf-set-side button .icon { color: var(--ink-55); }
.pf-set-side button.on { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }
.pf-set-side button.on .icon { color: var(--violet-text); }
.pf-set-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.pf-panel-title { font-size: 17px; font-weight: 700; letter-spacing: -0.2px; text-align: center; padding: 10px 16px 6px; }
.pf-intro { font-size: 12.5px; color: var(--ink-55); line-height: 1.45; padding: 6px 0 14px; }
.pf-section-label { padding: 20px 14px 7px; }
.pf-section-label.first { padding-top: 8px; }
.pf-footnote { font-size: 11px; color: var(--ink-55); line-height: 1.45; padding: 7px 14px 0; }
.pf-hairline { height: .8px; background: var(--hairline); margin-left: 14px; }
.pf-vrow { display: flex; align-items: center; gap: 10px; padding: 6px 14px; min-height: 46px; width: 100%; text-align: left; color: inherit; }
.pf-vrow .pf-vlabel { flex: 1; min-width: 0; font-size: 15px; }
.pf-vrow .pf-vvalue { font-size: 14px; color: var(--ink-55); text-align: right; min-width: 0; }
.pf-vrow .pf-vvalue.mono { font-family: var(--mono); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
.pf-vrow .chev { color: var(--ink-35); flex: none; }
.pf-vrow.interactive:active { background: var(--surface2); }
.pf-vrow .pf-inline-field { flex: 1; min-width: 0; }
.pf-vrow .pf-inline-field input { width: 100%; background: transparent; border: 0; font-size: 15px; text-align: right; }
.pf-vrow .pf-inline-field input.mono { font-family: var(--mono); font-size: 13px; color: var(--ink-55); }
.pf-vrow .pf-inline-field input::placeholder { color: var(--ink-35); }
.pf-time { background: var(--surface2); border: 0; border-radius: var(--r-control); padding: 7px 10px; font-size: 14px; color: var(--ink); box-shadow: inset 0 0 0 .8px var(--hairline); min-height: 36px; font-variant-numeric: tabular-nums; }
.pf-time::-webkit-calendar-picker-indicator { opacity: .5; }
.pf-field-card input { background: transparent; border: 0; width: 100%; font-size: 15px; padding: 14px; min-height: 48px; }
.pf-field-card input::placeholder { color: var(--ink-35); }
.pf-wire-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-35); flex: none; }
.pf-wire-dot.live { background: var(--live); }
.pf-diag { font-family: var(--mono); font-size: 11px; line-height: 1.55; color: var(--ink-55); padding: 10px 14px 12px; display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 2px; }
.pf-diag b { color: var(--ink-78); font-weight: 600; }
.pf-err { color: var(--danger); font-size: 11px; padding: 6px 14px 10px; }
.pf-labels { display: flex; flex-direction: column; gap: 10px; font-size: 13px; font-weight: 600; color: var(--ink-78); }
.pf-labels > div { display: flex; align-items: flex-start; gap: 9px; }
.pf-labels .icon { flex: none; margin-top: 1px; }
.pf-mgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.pf-mcell .pf-mk { font-size: 11px; font-weight: 700; color: var(--ink-55); }
.pf-mcell .pf-mvv { font-size: 25px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pf-mcell .pf-ms { font-size: 10px; color: var(--ink-55); }
.pf-preview-note { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ink-55); padding: 0 2px; }
.pf-sub { position: absolute; inset: 0; z-index: 3; background: var(--page); animation: slideIn .3s var(--ease); display: flex; flex-direction: column; }
.pf-sub .screen { position: absolute; inset: 0; }
.pf-never-row { display: flex; align-items: center; gap: 11px; padding: 10px 12px; }
.pf-never-row .pf-pname { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---- showcase ---- */
.pf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pf-square { aspect-ratio: 1; border-radius: var(--r-card); background: linear-gradient(135deg, var(--a), var(--b)); padding: 12px; display: flex; flex-direction: column; justify-content: flex-end; position: relative; overflow: hidden; color: #fff; width: 100%; text-align: left; }
.pf-square .pf-sq-name { font-size: 15px; font-weight: 800; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-square .pf-sq-tag { font-size: 10.5px; color: rgba(255,255,255,.75); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-state { position: absolute; top: 9px; left: 9px; font-size: 8px; font-weight: 800; letter-spacing: .8px; padding: 4px 7px; border-radius: var(--r-pill); background: rgba(255,255,255,.16); color: #fff; }
.pf-state.live { background: rgba(255,255,255,.28); }
.pf-watermark { position: absolute; top: 10px; right: 10px; color: rgba(255,255,255,.45); }
.pf-friends { display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding: 10px 0 2px; }
.pf-friends::-webkit-scrollbar { display: none; }
.pf-friend { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: var(--ink-78); flex: none; min-width: 52px; }
.pf-friend.invite { color: var(--violet-text); }
.pf-friend-row { display: flex; align-items: center; gap: 12px; padding: 11px 13px; width: 100%; text-align: left; color: inherit; }
.pf-thumb { width: 46px; height: 46px; border-radius: 11px; background: linear-gradient(135deg, var(--a), var(--b)); display: grid; place-items: center; color: rgba(255,255,255,.85); flex: none; }
.pf-cover { padding: 16px; border-radius: var(--r-hero); background: linear-gradient(135deg, var(--a), var(--b)); color: #fff; }
.pf-cover .pf-cstate { font-size: 9px; font-weight: 800; letter-spacing: 1px; padding: 5px 9px; border-radius: var(--r-pill); background: rgba(255,255,255,.22); }
.pf-cover .pf-cname { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-top: 14px; }
.pf-cover .pf-csub { font-size: 12px; color: rgba(255,255,255,.8); margin-top: 3px; }
.pf-cover .avatar-stack .avatar { box-shadow: 0 0 0 1.5px rgba(255,255,255,.85); }
.pf-cover-actions { display: flex; gap: 8px; margin-top: 14px; }
.pf-cover-actions .btn.onDark.on { background: rgba(255,255,255,.32); }
.pf-readme { padding: 14px; display: flex; flex-direction: column; gap: 7px; }
.pf-readme .pf-rh { font-size: 15px; font-weight: 800; }
.pf-readme .pf-rb { font-size: 13px; line-height: 1.55; color: var(--ink-78); }
.pf-member { display: flex; align-items: center; gap: 11px; padding: 8px 13px; min-height: 46px; }
.pf-member + .pf-member { box-shadow: inset 0 .8px 0 var(--hairline); }
.pf-member .pf-agent { font-size: 8px; font-weight: 800; letter-spacing: .8px; color: var(--ink-35); }
.pf-comment { display: flex; align-items: flex-start; gap: 10px; padding: 12px; }
.pf-comment .pf-cauthor { font-size: 12.5px; font-weight: 700; }
.pf-comment .pf-cage { font-family: var(--mono); font-size: 10px; color: var(--ink-35); margin-left: 6px; }
.pf-comment .pf-ctext { font-size: 13px; line-height: 1.5; color: var(--ink-78); margin-top: 3px; }
.pf-comment .pf-cdel { width: 30px; height: 30px; display: grid; place-items: center; color: var(--ink-35); border-radius: 50%; flex: none; }
.pf-compose { display: flex; align-items: center; gap: 9px; }
.pf-compose .field { border-radius: var(--r-pill); flex: 1; }
.pf-send { width: 36px; height: 36px; border-radius: 50%; background: var(--hero-gradient); color: #fff; display: grid; place-items: center; flex: none; }
.pf-send:disabled { background: var(--ink-35); }
.pf-rail { display: flex; gap: 9px; overflow-x: auto; scrollbar-width: none; padding: 10px 20px 4px; margin: 0 -20px; }
.pf-rail::-webkit-scrollbar { display: none; }
.pf-rail-card { width: 200px; flex: none; display: flex; align-items: center; gap: 10px; padding: 10px; text-align: left; color: inherit; }
.pf-rail-card .pf-thumb { width: 56px; height: 56px; border-radius: 10px; }
.pf-replay { border-radius: var(--r-hero); background: var(--ink); color: var(--page); padding: 12px 14px 14px; height: 340px; display: flex; flex-direction: column; position: relative; overflow: hidden; user-select: none; }
:root[data-theme="dark"] .pf-replay, .pf-replay { background: #0A0A0A; color: #fff; }
.pf-replay .pf-rail-track { display: flex; gap: 3px; flex: 1; }
.pf-replay .pf-rail-seg { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,.18); overflow: hidden; }
.pf-replay .pf-rail-seg i { display: block; height: 100%; background: var(--tint, var(--violet)); }
.pf-replay .pf-rkind { font-size: 9px; font-weight: 800; letter-spacing: 1px; color: var(--tint, var(--violet)); }
.pf-replay .pf-rtitle { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; margin-top: 4px; }
.pf-replay .pf-rcaption { font-size: 12px; color: rgba(255,255,255,.65); margin-top: 3px; line-height: 1.4; }
.pf-replay .pf-steps { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; overflow: hidden; }
.pf-replay .pf-step { font-family: var(--mono); font-size: 12px; padding: 6px 9px; border-radius: 7px; background: rgba(255,255,255,.06); color: rgba(255,255,255,.85); opacity: 0; transform: translateY(6px); transition: opacity .3s, transform .3s var(--ease); white-space: pre-wrap; word-break: break-word; }
.pf-replay .pf-step.shown { opacity: 1; transform: none; }
.pf-replay .pf-step.accent { background: color-mix(in srgb, var(--tint, var(--violet)) 22%, transparent); color: #fff; }
.pf-replay .pf-tapzone { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; }
.pf-replay .pf-tapzone button { background: transparent; }
.pf-replay .pf-director { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: rgba(255,255,255,.6); margin-top: 8px; }

/* ---- feedback ---- */
.pf-bubble { position: absolute; right: 16px; bottom: calc(var(--safe-bottom) + 18px); width: 46px; height: 46px; border-radius: 50%; background: var(--hero-gradient); display: grid; place-items: center; box-shadow: 0 4px 10px rgba(159,88,250,.4); z-index: 6; }
.pf-chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pf-honesty { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: var(--r-pill); background: var(--surface2); font-size: 8.5px; font-weight: 700; letter-spacing: .8px; color: var(--ink-55); margin: 10px auto 0; }
.pf-msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; scrollbar-width: none; }
.pf-msg { display: flex; align-items: flex-end; gap: 8px; }
.pf-msg .pf-mbody { font-size: 13.5px; line-height: 1.4; padding: 10px 13px; border-radius: 15px; max-width: calc(100% - 40px); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); }
.pf-msg.me { justify-content: flex-end; }
.pf-msg.me .pf-mbody { background: var(--hero-gradient); color: #fff; box-shadow: none; }
.pf-chips { display: flex; align-items: center; gap: 7px; overflow-x: auto; scrollbar-width: none; padding: 9px 18px; flex: none; }
.pf-chips::-webkit-scrollbar { display: none; }
.pf-chips .pf-about { font-size: 11px; font-weight: 600; color: var(--ink-35); flex: none; }
.pf-chips button { font-size: 12px; font-weight: 700; padding: 6px 11px; border-radius: var(--r-pill); background: var(--surface); color: var(--ink-78); box-shadow: inset 0 0 0 .8px var(--hairline); flex: none; min-height: 32px; }
.pf-chips button.on { background: var(--violet); color: #fff; box-shadow: none; }
.pf-inputbar { display: flex; align-items: flex-end; gap: 9px; padding: 0 16px calc(var(--safe-bottom) + 12px); flex: none; }
.pf-inputbar .field { flex: 1; border-radius: 17px; }
.pf-draft .pf-dsurf { font-size: 10px; font-weight: 700; color: var(--violet-text); padding: 3px 8px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.pf-draft .pf-dtitle { font-size: 15px; font-weight: 800; }
.pf-draft .pf-dsum { font-size: 12.5px; color: var(--ink-78); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.pf-exp { display: flex; align-items: center; gap: 10px; padding: 8px 14px; min-height: 48px; }
.pf-exp .pf-exp-icon { width: 24px; display: grid; place-items: center; color: var(--ink-35); flex: none; }
.pf-exp.trialing .pf-exp-icon { color: var(--violet-text); }
.pf-exp .pf-exp-title { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-exp .pf-exp-status { font-size: 10.5px; color: var(--ink-55); }
.pf-exp.trialing .pf-exp-status { color: var(--violet-text); }
.pf-pill-btn { font-size: 11.5px; font-weight: 700; padding: 6px 10px; border-radius: var(--r-pill); background: var(--surface2); color: var(--ink-55); min-height: 32px; flex: none; }
.pf-pill-btn.violet { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }

/* ---- policies ---- */
.pf-policy-tag { font-size: 13px; line-height: 1.55; color: var(--ink-78); padding-top: 8px; }
.pf-block { padding: 14px; display: flex; flex-direction: column; gap: 9px; margin-top: 12px; }
.pf-point { display: flex; align-items: flex-start; gap: 9px; font-size: 12.5px; line-height: 1.5; color: var(--ink-78); }
.pf-point i { width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, var(--violet) 60%, transparent); flex: none; margin-top: 7px; }
.pf-consent { display: flex; gap: 9px; padding: 12px 20px calc(var(--safe-bottom) + 12px); background: var(--page); box-shadow: 0 -.5px 0 var(--hairline); flex: none; }

/* ---- local AI ---- */
.pf-avail { display: flex; align-items: flex-start; gap: 10px; }
.pf-avail .icon { flex: none; margin-top: 2px; color: var(--tint-amber); }
.pf-avail.ready .icon { color: var(--live); }
.pf-avail .pf-atitle { font-size: 14px; font-weight: 700; }
.pf-avail .pf-adetail { font-size: 11.5px; color: var(--ink-55); line-height: 1.45; margin-top: 3px; }
.pf-file-btn { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 10px 12px; border-radius: var(--r-control); background: var(--surface2); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 14px; font-weight: 600; text-align: left; }
.pf-file-btn .pf-fname { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-receipt { font-family: var(--mono); font-size: 11px; color: var(--ink-55); line-height: 1.5; padding: 8px 10px; border-radius: 8px; background: var(--surface2); }
.pf-receipt b { color: var(--ink-78); font-weight: 600; }
.pf-state-line { display: flex; align-items: flex-start; gap: 7px; font-size: 11.5px; font-weight: 600; color: var(--ink-55); line-height: 1.4; }
.pf-state-line.warn { color: var(--tint-amber); }
.pf-state-line.bad { color: var(--danger); }
.pf-state-line .icon { flex: none; margin-top: 1px; }
.pf-untrusted { font-family: var(--mono); font-size: 10.5px; color: var(--ink-35); padding: 8px 10px; border-radius: 8px; background: var(--well); white-space: pre-wrap; line-height: 1.5; }
`;

// ------------------------------------------------------- small helpers

/** Section eyebrow with the Swift 14px inset. */
export function SectionLabel({ children, first = false }) {
  return html`<div class=${cx("eyebrow pf-section-label", first && "first")}>${children}</div>`;
}

export function Footnote({ children }) { return html`<div class="pf-footnote">${children}</div>`; }
export function Hairline() { return html`<div class="pf-hairline" role="separator" />`; }

/** Label · value · chevron (the Swift `valueRow`). Interactive when `onClick`. */
export function ValueRow({ label, value, chevron = true, onClick, mono = false, trailing, ariaLabel }) {
  const body = html`<span class="pf-vlabel">${label}</span>${value != null && value !== "" ? html`<span class=${cx("pf-vvalue", mono && "mono")}>${value}</span>` : null}${trailing}${chevron ? html`<${Icon} name="chevron.right" size=${14} weight=${2.6} className="chev" />` : null}`;
  if (onClick) return html`<button type="button" class="pf-vrow interactive pressable" onClick=${onClick} aria-label=${ariaLabel}>${body}</button>`;
  return html`<div class="pf-vrow">${body}</div>`;
}

/** "24m" → counts 0→24 keeping the suffix (Profile's CountUpText). */
export function CountUpText({ text, className, style }) {
  const m = /^(\D*?)(\d[\d,]*)(.*)$/.exec(String(text));
  if (!m) return html`<span class=${className} style=${style}>${text}</span>`;
  const n = Number(m[2].replace(/,/g, ""));
  return html`<${CountUp} value=${n} className=${className} style=${style} format=${(v) => `${m[1]}${Math.round(v).toLocaleString()}${m[3]}`} />`;
}

/** Width of a container element (ResizeObserver) — for the Settings split form. */
export function useContainerWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref.current]);
  return w;
}

/** Minutes-from-midnight ⇄ "HH:MM" for <input type=time>. */
export const minutesToTime = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function timeToMinutes(v) { const [h, m] = String(v ?? "").split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; }
const clockFmt = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
export function minutesLabel(m) { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return clockFmt.format(d); }

export function useMounted() { const r = useRef(true); useEffect(() => () => { r.current = false; }, []); return r; }
