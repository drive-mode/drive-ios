// Helpers shared across the Tasks cluster: the module-scoped stylesheet
// (token-only, injected once), the scroll-windowing hook that keeps the
// all-tasks list and the project grid at fleet scale, the Swift-style
// segmented toggle used by TasksView and ActivityView, and share/format
// utilities. Not a Swift file — the view modules are the 1:1 ports.
import { html, cx, useState, useEffect, useLayoutEffect, useRef, haptic } from "../../ui.js";
import { nav } from "../../nav.js";

// ------------------------------------------------------------- styles

const CSS = `
/* ===== Tasks cluster (TasksView / ProjectMapView / ArtifactsView / ArtifactDetailView / ActivityView) ===== */
:root { --heat-1: 18%; --heat-2: 38%; --heat-3: 62%; --heat-4: 95%; --bar-a: 22%; --bar-b: 28%; --node-shadow: rgba(21,21,22,.08); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --heat-1: 22%; --heat-2: 42%; --heat-3: 66%; --heat-4: 100%; --bar-a: 34%; --bar-b: 40%; --node-shadow: transparent; } }
:root[data-theme="dark"] { --heat-1: 22%; --heat-2: 42%; --heat-3: 66%; --heat-4: 100%; --bar-a: 34%; --bar-b: 40%; --node-shadow: transparent; }

.tk-hscroll { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 2px 16px 4px; align-items: center; }
.tk-hscroll::-webkit-scrollbar { display: none; }
.tk-hscroll > * { flex: none; }

/* --- status strip --- */
.tk-strip { display: flex; gap: 9px; margin-top: 8px; }
.tk-tile { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; padding: 10px 12px; min-height: 44px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); text-align: left; color: inherit; }
.tk-tile.accent { background: color-mix(in srgb, var(--violet) 10%, transparent); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 22%, transparent); }
.tk-tile .n { font-size: 17px; font-weight: 800; letter-spacing: -.3px; }
.tk-tile .l { font-size: 11px; font-weight: 600; color: var(--ink-55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.tk-tile.accent .n, .tk-tile.accent .l { color: var(--violet-text); }
.tk-tile.danger .n { color: var(--danger); }

.tk-search { margin-top: 12px; min-height: 44px; }
.tk-search input:focus-visible { outline: none; }
.tk-search input::-webkit-search-cancel-button, .tk-search input::-webkit-search-decoration { -webkit-appearance: none; appearance: none; display: none; }

/* --- attention rail --- */
.tk-railhead { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
.tk-rail { margin-top: 8px; gap: 9px; min-height: 92px; align-items: stretch; }
.tk-att { width: 186px; padding: 11px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 25%, transparent); text-align: left; color: inherit; display: flex; flex-direction: column; gap: 6px; min-height: 84px; }
.tk-att.blocked { box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--danger) 30%, transparent); }
.tk-att .t { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-att .r { font-size: 10.5px; color: var(--ink-55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-more { font-size: 12px; font-weight: 700; color: var(--ink-55); padding: 0 14px; align-self: center; }

/* --- tidy card --- */
.tk-tidy { margin-top: 16px; display: flex; align-items: center; gap: 12px; padding: 13px; border-radius: var(--r-card); background: color-mix(in srgb, var(--violet) 7%, transparent); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 20%, transparent); }
.tk-tidy .ic { width: 26px; display: grid; place-items: center; color: var(--violet-text); flex: none; }
.tk-sweep { background: var(--hero-gradient); color: #fff; font-weight: 700; font-size: 13px; padding: 9px 16px; min-height: 36px; border-radius: var(--r-pill); flex: none; }

/* --- segmented toggle (Swift modeToggle / rangeControl) --- */
.tk-toggle { display: flex; gap: 4px; padding: 3px; background: var(--surface2); border-radius: var(--r-control); flex: 1; min-width: 0; }
.tk-toggle > button { flex: 1; min-width: 0; height: 34px; border-radius: 7px; font-size: 13px; font-weight: 700; color: var(--ink-55); white-space: nowrap; transition: background .15s, color .15s; }
.tk-toggle > button.on { background: var(--surface); color: var(--violet-text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.tk-modebar { display: flex; gap: 8px; align-items: center; margin-top: 18px; }
.tk-select { height: 40px; padding: 0 14px; border-radius: var(--r-control); font-size: 13px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.tk-select.on { background: var(--violet); color: #fff; }

/* --- project grid --- */
.tk-grid { position: relative; margin-top: 12px; }
.tk-gridrow { position: absolute; left: 0; right: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.tk-proj { height: 118px; padding: 12px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); display: flex; flex-direction: column; text-align: left; color: inherit; overflow: hidden; min-width: 0; }
.tk-proj.attn { box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 25%, transparent); }
.tk-proj.blocked { box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--danger) 25%, transparent); }
.tk-proj .head { display: flex; align-items: flex-start; gap: 4px; }
.tk-proj .name { font-size: 14px; font-weight: 700; line-height: 1.25; height: 35px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; min-width: 0; }
.tk-proj .pin { color: var(--violet-text); margin-top: 3px; flex: none; }
.tk-proj .area { font-size: 9px; font-weight: 700; letter-spacing: .7px; color: var(--ink-35); margin-top: 4px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-proj.skel { box-shadow: none; }
.tk-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; color: #fff; font-size: 11px; font-weight: 800; display: inline-grid; place-items: center; background: var(--violet); flex: none; }
.tk-count.danger { background: var(--danger); }
.tk-bar { display: flex; gap: 1.5px; height: 6px; border-radius: 3px; overflow: hidden; margin-top: 10px; }
.tk-bar i { display: block; height: 100%; min-width: 3px; }
.tk-legend { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: var(--ink-55); margin-top: 7px; }
.tk-legend i { width: 5px; height: 5px; border-radius: 50%; display: inline-block; flex: none; }
.tk-peek { width: 256px; padding: 10px 8px 4px; }
.tk-peek .counts { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0 10px; }
.tk-peek .counts span { font-size: 10.5px; font-weight: 600; color: var(--ink-55); }
.tk-peek .counts b { font-size: 14px; font-weight: 800; margin-right: 4px; }

/* --- task rows --- */
.tk-taskrow { display: flex; align-items: center; gap: 11px; padding: 0 12px; height: 48px; background: var(--surface); border-radius: 11px; box-shadow: inset 0 0 0 .8px var(--hairline); text-align: left; color: inherit; width: 100%; position: relative; }
.tk-taskrow .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tk-taskrow .t { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.tk-taskrow .r { font-size: 11px; color: var(--ink-35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-taskrow .pct { font-family: var(--mono); font-size: 10.5px; font-weight: 600; color: var(--ink-35); flex: none; }
.tk-taskrow.done .t { color: var(--ink-55); }
.tk-taskrow.archived { opacity: .62; }
.tk-taskrow .tag { position: absolute; top: 5px; right: 10px; font-size: 7.5px; font-weight: 800; letter-spacing: .8px; color: var(--ink-35); }
.tk-state { display: inline-flex; align-items: center; gap: 4.5px; padding: 4.5px 9px; border-radius: var(--r-control); font-size: 11px; font-weight: 700; background: var(--surface2); color: var(--ink-55); flex: none; line-height: 1; }
.tk-state.review { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }
.tk-state.blocked { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
.tk-state.done { background: none; padding: 0; color: var(--ink-35); }
.tk-selrow { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; color: inherit; }
.tk-check { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.6px var(--ink-35); color: transparent; transition: background .15s, box-shadow .15s; }
.tk-check.on { background: var(--violet); box-shadow: none; color: #fff; }
/* Pushed pages keep the guide bar (SwiftUI keeps the tab bar on push) — leave room for it. */
.content.tk-pushed { padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 28px); }

/* --- windowed lists --- */
.tk-list { position: relative; margin-top: 12px; }
.tk-abs { position: absolute; left: 0; right: 0; }
.tk-sec { display: flex; align-items: center; justify-content: space-between; height: 30px; padding: 0 4px; font-size: 12px; font-weight: 800; color: var(--ink-55); background: color-mix(in srgb, var(--page) 96%, transparent); }
.tk-sec .n { font-family: var(--mono); font-size: 10px; font-weight: 700; color: var(--ink-35); }
.tk-sticky { position: sticky; top: 0; z-index: 2; height: 0; }
.tk-eyebrow-row { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
.tk-vlist { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.tk-showing { font-size: 12px; color: var(--ink-55); padding-top: 6px; }

/* --- file bar --- */
.tk-filebar { position: absolute; left: 0; right: 0; bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px); display: flex; justify-content: center; pointer-events: none; z-index: 6; }
.tk-filebar.pushed { bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 18px); }
.tk-filebar > button { pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; height: 50px; padding: 0 22px; border-radius: var(--r-pill); background: var(--hero-gradient); color: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 6px 14px color-mix(in srgb, var(--violet) 40%, transparent); animation: bounceIn .35s var(--spring); }

/* --- archive --- */
.tk-foot { margin-top: 14px; display: flex; align-items: center; gap: 9px; padding: 12px 14px; border-radius: var(--r-card); background: color-mix(in srgb, var(--surface2) 60%, transparent); color: var(--ink-55); font-size: 13px; font-weight: 600; width: 100%; text-align: left; min-height: 44px; }
.tk-foot .sub { font-size: 11px; font-weight: 400; color: var(--ink-35); }
.tk-archrow { display: flex; align-items: center; gap: 11px; padding: 10px 12px; min-height: 52px; border-radius: var(--r-card); background: color-mix(in srgb, var(--surface) 70%, transparent); box-shadow: inset 0 0 0 .8px var(--hairline); }
.tk-archrow .ic { width: 30px; height: 30px; border-radius: 8px; background: var(--surface2); display: grid; place-items: center; color: var(--ink-35); flex: none; }
.tk-archrow .nm { font-size: 14px; font-weight: 600; color: var(--ink-78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-archrow .ar { font-size: 10.5px; color: var(--ink-35); }
.tk-restore { font-size: 12.5px; font-weight: 700; color: var(--violet-text); padding: 0 12px; min-height: 40px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 10%, transparent); flex: none; }
.tk-archive-more { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; margin-top: 14px; padding: 11px 14px; min-height: 44px; border-radius: var(--r-card); background: color-mix(in srgb, var(--surface2) 60%, transparent); color: var(--ink-55); font-size: 12.5px; font-weight: 700; }

/* --- project map --- */
.tk-sum { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.tk-sumchip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 11px; font-weight: 600; color: var(--ink-55); }
.tk-sumchip b { font-size: 13px; font-weight: 800; }
.tk-map { position: relative; margin-top: 12px; background: var(--surface); border-radius: var(--r-hero); box-shadow: inset 0 0 0 .8px var(--hairline); overflow: hidden; touch-action: pan-y; }
.tk-map.zoomed { touch-action: none; }
.tk-map svg { display: block; width: 100%; height: 100%; transform-origin: center; }
.tk-map .node { cursor: pointer; }
.tk-map .node:focus-visible circle.hit { stroke: var(--violet); stroke-width: 2; }
.tk-map .lbl { font-family: var(--font); font-size: 9px; font-weight: 600; fill: var(--ink-78); }
.tk-map .lbl.done { fill: var(--ink-35); }
.tk-map .lbl.sel { font-weight: 700; }
.tk-zoom { position: absolute; right: 8px; bottom: 8px; font-family: var(--mono); font-size: 9.5px; font-weight: 700; color: var(--ink-55); padding: 4px 7px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--surface2) 90%, transparent); pointer-events: none; }
.tk-clusters { margin-top: 8px; font-size: 10.5px; color: var(--ink-55); }
.tk-cluster { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; min-height: 32px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 11px; font-weight: 700; color: var(--ink-78); }
.tk-cluster i { width: 5px; height: 5px; border-radius: 50%; background: var(--tint); display: inline-block; }
.tk-cluster.on { color: #fff; box-shadow: none; background: var(--tint); }
.tk-cluster.on i { background: #fff; }
.tk-detail { margin-top: 12px; padding: 14px; }
.tk-actions { display: flex; gap: 9px; margin-top: 12px; }
.tk-action { flex: 1; height: 42px; border-radius: var(--r-control); font-size: 13.5px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.tk-action.solid { background: var(--hero-gradient); color: #fff; }
.tk-memrow { display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; margin-top: 8px; font-size: 11.5px; font-weight: 600; color: var(--ink-78); min-height: 32px; }
.tk-clear { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--violet-text); min-height: 32px; padding: 0 4px; }

/* --- artifacts --- */
.tk-chips { margin-top: 8px; }
.tk-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; min-height: 36px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 12.5px; font-weight: 700; color: var(--ink-78); }
.tk-chip.on { color: #fff; background: var(--tint, var(--violet)); box-shadow: none; }
.tk-ctl { margin-top: 10px; }
.tk-mpill { display: inline-flex; align-items: center; gap: 5px; padding: 8px 11px; min-height: 34px; border-radius: var(--r-pill); background: var(--surface2); font-size: 11.5px; font-weight: 700; color: var(--ink-55); }
.tk-mpill.set { color: var(--violet-text); }
.tk-sechead { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; font-size: 12px; font-weight: 800; color: var(--ink-55); }
.tk-sechead .n { font-family: var(--mono); font-size: 10px; font-weight: 700; color: var(--ink-35); }
.tk-agrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 9px; }
.tk-art { padding: 12px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline); text-align: left; color: inherit; display: flex; flex-direction: column; min-width: 0; }
.tk-art .top { display: flex; align-items: center; justify-content: space-between; }
.tk-kind { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: color-mix(in srgb, var(--tint) 14%, transparent); color: var(--tint); flex: none; }
.tk-kind.lg { width: 42px; height: 42px; border-radius: 11px; }
.tk-art .age { font-family: var(--mono); font-size: 10px; color: var(--ink-35); }
.tk-art .title { font-size: 13.5px; font-weight: 700; margin-top: 10px; height: 34px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tk-art .meta { font-family: var(--mono); font-size: 10.5px; color: var(--tint); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-art .who { display: flex; align-items: center; gap: 6px; margin-top: 9px; font-size: 10px; color: var(--ink-55); min-width: 0; }
.tk-art .who span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-art .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
.tk-art .size { font-family: var(--mono); font-size: 9.5px; font-weight: 600; color: var(--ink-35); }
.tk-life { display: inline-flex; align-items: center; gap: 4px; padding: 3.5px 7px; border-radius: var(--r-pill); font-size: 9px; font-weight: 800; background: var(--surface2); color: var(--ink-55); }
.tk-life.eph { background: color-mix(in srgb, var(--tint-amber) 13%, transparent); color: var(--tint-amber); }
.tk-nomatch { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 0; color: var(--ink-55); font-size: 13px; font-weight: 600; }
.tk-note { font-size: 10.5px; color: var(--ink-55); text-align: center; margin-top: 22px; line-height: 1.4; }
.tk-railcard { width: 168px; padding: 11px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--tint) 22%, transparent); text-align: left; color: inherit; display: flex; flex-direction: column; gap: 7px; }

/* --- artifact detail --- */
.tk-dark { color-scheme: dark; --page: #0A0A0A; --surface: #12131A; --surface2: #1B1D24; --well: #0D0D10; --ink: #FFFFFF; --ink-rgb: 255,255,255; --ink-78: rgba(255,255,255,.78); --ink-55: rgba(255,255,255,.55); --ink-35: rgba(255,255,255,.35); --ink-18: rgba(255,255,255,.18); --ink-08: rgba(255,255,255,.08); --hairline: rgba(255,255,255,.10); --violet-text: #B98AFF; --live: #4ADE80; --diff-green: #4ADE80; --coder: #E6E8EE; --mark-ink: #fff; color: var(--ink); }
.tk-head { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.tk-head .ttl { font-size: 17px; font-weight: 800; line-height: 1.2; }
.tk-head .meta { font-family: var(--mono); font-size: 11.5px; color: var(--tint); margin-top: 2px; }
.tk-caption { font-size: 10.5px; color: var(--ink-55); margin-top: 8px; line-height: 1.4; }
.tk-preview { margin-top: 14px; padding: 44px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; background: var(--surface); border-radius: var(--r-hero); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--tint) 22%, transparent); }
.tk-well { margin-top: 14px; padding: 16px; background: var(--well); border-radius: var(--r-hero); box-shadow: inset 0 0 0 .8px var(--hairline); display: flex; flex-direction: column; gap: 5px; }
.tk-well .diff-line { font-size: 13px; padding: 1px 0; border-radius: 0; background: none; color: var(--ink-55); }
.tk-well .diff-line.added { color: var(--live); background: color-mix(in srgb, var(--live) 8%, transparent); }
.tk-meta { margin-top: 8px; padding: 0; overflow: hidden; }
.tk-metarow { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 6px 14px; font-size: 14px; }
.tk-metarow + .tk-metarow { box-shadow: inset 0 .8px 0 var(--hairline); }
.tk-metarow .v { font-size: 13.5px; color: var(--ink-55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 7px; }
.tk-lifechips { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.tk-lifechip { display: inline-flex; align-items: center; gap: 6px; padding: 9px 13px; min-height: 36px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 12.5px; font-weight: 700; color: var(--ink-78); }
.tk-lifechip.on { background: var(--violet); color: #fff; box-shadow: none; }
.tk-detail-actions { display: flex; gap: 9px; margin-top: 18px; }
.tk-detail-actions > button { flex: 1; height: 44px; border-radius: var(--r-control); display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); }
.tk-detail-actions > button.solid { background: var(--hero-gradient); color: #fff; }

/* --- replay player --- */
.tk-player { position: relative; margin-top: 14px; height: 360px; background: var(--well); border-radius: var(--r-hero); box-shadow: inset 0 0 0 .8px var(--hairline); overflow: hidden; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; touch-action: pan-y; outline: none; }
.tk-player:focus-visible { box-shadow: inset 0 0 0 2px var(--violet); }
.tk-ptop { display: flex; align-items: center; gap: 8px; padding: 12px 14px 0; }
.tk-prail { display: flex; align-items: center; gap: 4px; flex: 1; height: 5px; }
.tk-prail i { display: block; flex: 1; height: 3.5px; border-radius: 2px; background: color-mix(in srgb, var(--tint) 30%, transparent); position: relative; overflow: hidden; }
.tk-prail i.done { background: color-mix(in srgb, var(--tint) 95%, transparent); }
.tk-prail i.now { height: 5px; }
.tk-prail i.now b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--tint); border-radius: 2px; min-width: 3px; }
.tk-ptag { font-family: var(--mono); font-size: 8.5px; font-weight: 800; letter-spacing: .8px; color: var(--ink-35); flex: none; }
.tk-bhead { display: flex; align-items: center; gap: 9px; padding: 12px 16px 0; min-width: 0; }
.tk-bkind { font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: .8px; padding: 3.5px 7px; border-radius: 5px; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); flex: none; }
.tk-bhead .bt { font-size: 15px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.tk-bhead .dir { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--ink-55); flex: none; }
.tk-bhead .dir i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.tk-stage { flex: 1; min-height: 0; padding: 10px 16px; overflow: hidden; display: flex; flex-direction: column; max-width: 560px; width: 100%; }
.tk-stage .empty-beat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.tk-taps { position: absolute; left: 0; right: 0; top: 44px; bottom: 56px; display: flex; }
.tk-taps > button { flex: 1; cursor: default; }
.tk-pctl { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 2; }
.tk-pctl > button { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: var(--ink); background: var(--ink-08); box-shadow: inset 0 0 0 .8px var(--hairline); }
.tk-pctl > button.main { width: 44px; height: 44px; background: var(--violet); color: #fff; box-shadow: none; }
.tk-pctl .st { position: absolute; right: 14px; font-family: var(--mono); font-size: 9px; font-weight: 800; letter-spacing: .8px; color: var(--ink-35); }
/* beat renderers */
.tk-plan { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.tk-plan .st { display: flex; align-items: center; gap: 11px; font-size: 14.5px; color: var(--ink-35); }
.tk-plan .st.on, .tk-plan .st.done { color: var(--ink); }
.tk-plan .st.on { font-weight: 600; }
.tk-plan .ck { width: 21px; height: 21px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px var(--ink-18); flex: none; }
.tk-plan .st.on .ck { box-shadow: inset 0 0 0 1.5px var(--ink-55); }
.tk-plan .st.done .ck { box-shadow: inset 0 0 0 1.5px var(--live); background: color-mix(in srgb, var(--live) 18%, transparent); color: var(--live); }
.tk-plan .now { margin-left: auto; font-family: var(--mono); font-size: 8.5px; font-weight: 800; color: var(--violet-text); }
.tk-plan .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--violet); }
.tk-diag { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
.tk-diag.h { flex-direction: row; }
.tk-diag .nd { font-family: var(--mono); font-size: 12.5px; font-weight: 600; padding: 8px 12px; border-radius: var(--r-control); background: var(--surface); color: var(--ink-55); box-shadow: inset 0 0 0 .8px var(--ink-08); white-space: nowrap; }
.tk-diag .nd.lit { color: var(--ink); box-shadow: inset 0 0 0 .8px rgba(255,255,255,.30); }
.tk-diag .nd.new { color: var(--violet-text); background: color-mix(in srgb, var(--violet) 16%, transparent); box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 50%, transparent); }
.tk-diag .nd.new.lit { box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 90%, transparent), 0 0 18px color-mix(in srgb, var(--violet) 35%, transparent); }
.tk-diag .cn { width: 1.5px; height: 16px; background: var(--ink-18); }
.tk-diag.h .cn { width: 22px; height: 1.5px; }
.tk-diag .cn.on { background: color-mix(in srgb, var(--live) 80%, transparent); }
.tk-code { display: flex; flex-direction: column; gap: 5px; padding-top: 8px; font-family: var(--mono); font-size: 13.5px; }
.tk-code .ln { color: var(--ink-55); white-space: pre-wrap; word-break: break-word; }
.tk-code .ln.add { color: var(--live); }
.tk-code .ln.first { color: var(--ink); opacity: .92; }
.tk-code .cur { width: 7px; height: 15px; background: var(--live); }
.tk-tests { display: flex; flex-direction: column; gap: 11px; padding-top: 8px; flex: 1; }
.tk-tests .tr { display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 13.5px; color: var(--ink-35); }
.tk-tests .tr.on { color: var(--ink-78); }
.tk-tests .pass { margin-left: auto; font-size: 9px; font-weight: 800; color: var(--live); }
.tk-tests .ring { width: 15px; height: 15px; border-radius: 50%; box-shadow: inset 0 0 0 1.2px var(--ink-18); flex: none; }
.tk-tests .pulse { width: 15px; display: grid; place-items: center; flex: none; }
.tk-tests .pulse i { width: 7px; height: 7px; border-radius: 50%; background: var(--live); }
.tk-tests .sum { margin-top: auto; font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--live); }
.tk-decide { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
.tk-decide .op { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border-radius: var(--r-card); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); font-size: 14.5px; color: var(--ink-78); transition: background .3s, box-shadow .3s; }
.tk-decide .op.dim { color: var(--ink-35); }
.tk-decide .op.on { color: var(--ink); font-weight: 600; background: color-mix(in srgb, var(--violet) 14%, transparent); box-shadow: inset 0 0 0 1.4px color-mix(in srgb, var(--violet) 80%, transparent); }
.tk-decide .note { font-size: 10.5px; color: var(--ink-35); margin-top: 2px; }
.tk-metric { display: flex; flex-direction: column; gap: 16px; padding-top: 10px; }
.tk-metric .mrow { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--ink-55); }
.tk-metric .mrow b { font-family: var(--mono); font-size: 12.5px; font-weight: 700; color: var(--ink-78); }
.tk-metric .mrow b.after { color: var(--live); }
.tk-metric .mbar { height: 8px; border-radius: 4px; background: var(--ink-08); margin-top: 6px; overflow: hidden; }
.tk-metric .mbar i { display: block; height: 100%; border-radius: 4px; background: var(--ink-35); min-width: 4px; }
.tk-metric .mbar i.after { background: var(--live); }
.tk-metric .seal { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--ink-78); transition: opacity .3s; }

/* --- activity --- */
.tk-card { padding: 16px; margin-top: 16px; border-radius: var(--r-hero); }
.tk-week { display: flex; align-items: flex-end; gap: 10px; height: 130px; margin-top: 12px; }
.tk-week > button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; min-width: 0; color: inherit; }
.tk-week .cnt { font-family: var(--mono); font-size: 9.5px; font-weight: 700; color: var(--ink-35); }
.tk-week .bar { width: 100%; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; min-height: 0; }
.tk-week .bar i { display: block; border-radius: 5px; background: color-mix(in srgb, var(--violet) var(--bar-a), transparent); transition: height .3s var(--spring); }
.tk-week > button.on .bar i { background: var(--hero-gradient); }
.tk-week .wd { font-size: 9px; font-weight: 600; color: var(--ink-35); }
.tk-week > button.on .cnt, .tk-week > button.on .wd { color: var(--violet-text); font-weight: 800; }
.tk-month { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px 6px; margin-top: 12px; }
.tk-month .h { text-align: center; font-size: 9px; font-weight: 700; color: var(--ink-35); }
.tk-day { height: 40px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--ink-78); }
.tk-day.on { background: color-mix(in srgb, var(--violet) 12%, transparent); color: var(--violet-text); font-weight: 800; }
.tk-day i { width: 15px; height: 15px; border-radius: 3.5px; display: block; }
.tk-heat-0 { background: var(--surface2); }
.tk-heat-1 { background: color-mix(in srgb, var(--violet) var(--heat-1), transparent); }
.tk-heat-2 { background: color-mix(in srgb, var(--violet) var(--heat-2), transparent); }
.tk-heat-3 { background: color-mix(in srgb, var(--violet) var(--heat-3), transparent); }
.tk-heat-4 { background: color-mix(in srgb, var(--violet) var(--heat-4), transparent); }
.tk-wall { overflow-x: auto; scrollbar-width: none; margin-top: 12px; height: 112px; }
.tk-wall::-webkit-scrollbar { display: none; }
.tk-wall .cols { display: flex; gap: 3px; align-items: flex-start; }
.tk-wall .col { display: flex; flex-direction: column; gap: 3px; }
.tk-wall .ml { height: 10px; font-size: 8px; font-weight: 700; color: var(--ink-35); white-space: nowrap; line-height: 10px; }
.tk-wall .sq { width: 11px; height: 11px; border-radius: 2.5px; display: block; padding: 0; }
.tk-wall .sq.on { box-shadow: inset 0 0 0 1.5px var(--violet-text); }
.tk-wall .sq.blank { background: transparent; }
.tk-scale { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 10px; font-size: 9px; font-weight: 600; color: var(--ink-35); }
.tk-scale i { width: 10px; height: 10px; border-radius: 2.5px; display: block; }
.tk-dates { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.tk-date { background: var(--surface2); border: 0; border-radius: var(--r-control); padding: 8px 10px; min-height: 40px; font-size: 14px; font-weight: 600; color: var(--ink); box-shadow: inset 0 0 0 .8px var(--hairline); font-family: var(--font); }
.tk-date::-webkit-calendar-picker-indicator { opacity: .5; }
.tk-range-sum { font-size: 12.5px; font-weight: 600; color: var(--ink-78); margin-top: 12px; }
.tk-bd { margin-top: 14px; }
.tk-bd .bdhead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.tk-bd .bdhead .ttl { font-size: 14.5px; font-weight: 800; }
.tk-bd .bdhead .tot { font-family: var(--mono); font-size: 11.5px; font-weight: 700; color: var(--live); flex: none; }
.tk-bd .rows { display: flex; flex-direction: column; gap: 9px; margin-top: 12px; }
.tk-brow { display: flex; align-items: center; gap: 10px; min-height: 32px; width: 100%; color: inherit; text-align: left; }
.tk-brow .nm { width: 128px; flex: none; font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-brow .bar { flex: 1; min-width: 0; }
.tk-brow .bar i { display: block; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--violet) var(--bar-b), transparent); min-width: 4px; }
.tk-brow .n { width: 26px; text-align: right; font-family: var(--mono); font-size: 11.5px; font-weight: 700; color: var(--ink-55); flex: none; }
`;

/** Inject the cluster stylesheet once (ARCHITECTURE.md `injectStyle` pattern). */
export function injectTasksStyle() {
  if (document.getElementById("tasks-css")) return;
  const style = document.createElement("style");
  style.id = "tasks-css";
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------- windowing

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}

/**
 * Scroll windowing for a list that lives inside the page scroll (`scrollRef`
 * from `<Screen>`). `offsets[i]` is the top of row i inside `hostRef`. Returns
 * `[start, end)` — only those rows get built, which is what keeps hundreds of
 * rows smooth. Recomputes on scroll (rAF-coalesced) and resize.
 */
export function useScrollWindow(scrollRef, hostRef, offsets, overscan = 360) {
  const [range, setRange] = useState(() => [0, Math.min(offsets.length, 24)]);
  const rangeRef = useRef(range);
  useEffect(() => {
    const el = scrollRef?.current, host = hostRef.current;
    if (!host) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const viewH = el ? el.clientHeight : window.innerHeight;
      const scrollTop = el ? el.scrollTop : window.scrollY;
      const hostTop = el ? host.getBoundingClientRect().top - el.getBoundingClientRect().top + scrollTop : host.getBoundingClientRect().top + scrollTop;
      const lo = scrollTop - hostTop - overscan, hi = scrollTop - hostTop + viewH + overscan;
      const start = Math.max(0, lowerBound(offsets, lo) - 1);
      const end = Math.min(offsets.length, lowerBound(offsets, hi) + 1);
      const cur = rangeRef.current;
      if (cur[0] !== start || cur[1] !== end) { rangeRef.current = [start, end]; setRange([start, end]); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    const target = el ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(raf); target.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [scrollRef, hostRef, offsets, overscan]);
  return range;
}

/** Width of an element, tracked through resizes (the SVG map needs px). */
export function useElementWidth(ref, fallback = 0) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => { const next = el.clientWidth; if (next) setW((prev) => (prev === next ? prev : next)); };
    read();
    let ro = null;
    if ("ResizeObserver" in window) { ro = new ResizeObserver(read); ro.observe(el); }
    else window.addEventListener("resize", read);
    return () => { ro ? ro.disconnect() : window.removeEventListener("resize", read); };
  }, [ref.current]);
  return w;
}

// ------------------------------------------------------------ widgets

/** The Swift `modeToggle` / `rangeControl`: surface2 well, surface pill for the selection. */
export function ModeToggle({ options, value, onChange, label }) {
  return html`<div class="tk-toggle" role="tablist" aria-label=${label}>
    ${options.map((o) => html`<button key=${o} type="button" role="tab" aria-selected=${o === value} class=${cx("pressable", o === value && "on")} onClick=${() => { if (o !== value) { haptic("light"); onChange(o); } }}>${o}</button>`)}
  </div>`;
}

/** Short eyebrow + trailing count row used across the cluster. */
export function EyebrowRow({ label, trailing, style }) {
  return html`<div class="tk-eyebrow-row" style=${style}><div class="eyebrow">${label}</div>${trailing != null ? html`<div class="t-xs w7" style=${{ color: "var(--violet-text)" }}>${trailing}</div>` : null}</div>`;
}

// ------------------------------------------------------------ actions

/** ShareLink stand-in: the Web Share sheet when the platform has one, else copy + toast. */
export async function shareText(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e?.name === "AbortError") return; }
  try { await navigator.clipboard?.writeText(text); nav.toast("Copied to clipboard", { icon: "square.and.arrow.up" }); }
  catch { nav.toast("Sharing isn’t available here"); }
}

export const pluralize = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;
