// Module-scoped CSS for the Work cluster. Each module injects its own block
// once through `injectStyle`; everything is token-only (theme.css variables).
//
// `.work-dark` is the one exception worth explaining: the live call and the
// Spotlight are always dark in Swift (`.preferredColorScheme(.dark)` and
// `DT.well` / `DT.raised`). theme.css only defines the dark ladder on `:root`,
// so this class re-declares the same values as a scoped ladder — the mirror
// of `.sheet.light` in theme.css. If theme.css grows a `.scheme-dark` class,
// delete this block and use that.

import { html, cx } from "../../ui.js";
import { Icon } from "../../components.js";
import { nav } from "../../nav.js";

export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

injectStyle("work-css", `
.work-dark {
  color-scheme: dark;
  --page: #0A0A0A; --surface: #12131A; --surface2: #1B1D24; --well: #0D0D10;
  --ink: #FFFFFF; --ink-rgb: 255, 255, 255;
  --ink-78: rgba(255, 255, 255, 0.78); --ink-55: rgba(255, 255, 255, 0.55); --ink-35: rgba(255, 255, 255, 0.35);
  --ink-18: rgba(255, 255, 255, 0.18); --ink-08: rgba(255, 255, 255, 0.08); --hairline: rgba(255, 255, 255, 0.10);
  --violet-text: #B98AFF; --live: #4ADE80; --diff-green: #4ADE80; --card-shadow: none; --coder: #E6E8EE; --mark-ink: #fff;
  color: var(--ink);
}
.wk-sheet { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.wk-sheet > .scroll { flex: 1; min-height: 0; }
.wk-eyebrow-gap { margin-top: 24px; }
.wk-note { font-size: 10.5px; color: var(--ink-35); line-height: 1.4; }
.wk-error { display: flex; align-items: flex-start; gap: 7px; font-size: 11.5px; font-weight: 600; color: var(--danger); line-height: 1.35; }
.wk-select-row { display: flex; align-items: center; gap: 11px; width: 100%; padding: 12px; text-align: left; color: var(--ink); min-height: 52px; }
.wk-select-row + .wk-select-row { box-shadow: inset 0 0.8px 0 var(--hairline); }
.wk-select-row:active { background: var(--surface2); }
.wk-select-row .t { font-size: 13.5px; font-weight: 600; line-height: 1.25; }
.wk-select-row .s { font-size: 10.5px; color: var(--ink-55); margin-top: 2px; line-height: 1.3; }
.wk-select-row[aria-disabled="true"] { cursor: default; }
.wk-chip-row { display: flex; gap: 7px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 2px 16px; }
.wk-chip-row::-webkit-scrollbar { display: none; }
.wk-pick { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; min-height: 36px; border-radius: 999px; font-size: 12.5px; font-weight: 700; white-space: nowrap;
  background: var(--surface); color: var(--ink-78); box-shadow: inset 0 0 0 0.8px var(--hairline); flex: none; }
.wk-pick.on { background: var(--violet); color: #fff; box-shadow: none; }
.wk-tint-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 0 14px; border-radius: var(--r-control);
  font-size: 13px; font-weight: 700; color: var(--violet-text); background: color-mix(in srgb, var(--violet) 10%, transparent); white-space: nowrap; }
.wk-tint-btn.fill { width: 100%; }
.wk-tint-btn.card { border-radius: var(--r-card); box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--violet) 22%, transparent); min-height: 48px; font-size: 15px; }
.wk-grad-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 16px; border-radius: var(--r-control);
  font-size: 14px; font-weight: 700; color: #fff; background: var(--hero-gradient); white-space: nowrap; width: 100%; }
.wk-grad-btn.glow { box-shadow: 0 5px 10px color-mix(in srgb, var(--violet) 35%, transparent); }
.wk-grad-btn:disabled { opacity: .45; }
.wk-grad-btn.sm, .wk-tint-btn.sm { min-height: 42px; }
.wk-input { width: 100%; padding: 12px; border-radius: var(--r-control); background: var(--surface2); font-size: 14px; font-weight: 600; line-height: 1.35; border: 0; resize: none; color: var(--ink); }
.wk-input::placeholder { color: var(--ink-35); font-weight: 500; }
.wk-input:focus { box-shadow: inset 0 0 0 1.4px var(--violet); }
.wk-check { border-radius: 50%; display: inline-grid; place-items: center; flex: none; box-shadow: inset 0 0 0 1.5px var(--ink-35); color: #fff; transition: background .15s, box-shadow .15s; }
.wk-check.on { background: var(--tint, var(--violet)); box-shadow: none; }
`);

/**
 * Navigation-bar back chevron for pushed pages. The foundation's `Page` starts
 * an edge-swipe (with pointer capture) for any pointerdown within 28px of the
 * left edge, which swallows the NavBar's own chevron; stopping pointerdown here
 * keeps the tap a tap. Pass it as `leading` instead of `back`.
 */
export function BackButton({ onClick, label = "Back" }) {
  return html`<button type="button" class="back-btn pressable" aria-label=${label} onPointerDown=${(e) => e.stopPropagation()} onClick=${() => (onClick ?? (() => nav.pop()))()}>
    <${Icon} name="chevron.left" size=${22} weight=${2.6} />
  </button>`;
}

/** `checkmark.circle.fill` / `circle` as SwiftUI draws them: a tinted disc with a white check, or a ring. */
export function CheckCircle({ on = false, size = 20, tint = "var(--violet)", className, style }) {
  return html`<span class=${cx("wk-check", on && "on", className)} style=${{ width: size, height: size, "--tint": tint, ...style }} aria-hidden="true">
    ${on ? html`<${Icon} name="checkmark" size=${Math.round(size * 0.55)} weight=${3.4} />` : null}
  </span>`;
}
