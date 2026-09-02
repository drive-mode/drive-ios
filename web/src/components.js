// Shared controls — a port of `Sources/Components.swift`, `DriveBrand.swift`,
// `ClineBotShape.swift`, plus the primitives SwiftUI gives for free
// (NavigationBar, List rows, Toggle, Picker, TextField, Menu, ContextMenu).
import { html, cx, useState, useEffect, useLayoutEffect, useRef, useFrame, useLongPress, haptic, reducedMotion } from "./ui.js";
import { ICONS } from "./icons.js";
import { nav } from "./nav.js";
import { initials as initialsOf } from "./models.js";

// ------------------------------------------------------------- icons

/** SF-Symbol-named icon. `weight` maps to stroke width; `fill` for the .fill faces. */
export function Icon({ name, size = 16, weight = 2, color, className, fill = false, style = {}, label }) {
  const body = ICONS[name] ?? ICONS["circle.circle"];
  if (!ICONS[name]) console.warn("[icon] unmapped symbol", name);
  return html`<svg class=${cx("icon", className)} width=${size} height=${size} viewBox="0 0 24 24" fill=${fill ? "currentColor" : "none"}
    stroke="currentColor" stroke-width=${weight} stroke-linecap="round" stroke-linejoin="round"
    style=${{ color, flex: "none", display: "inline-block", verticalAlign: "-0.15em", ...style }}
    aria-hidden=${label ? "false" : "true"} role=${label ? "img" : undefined} aria-label=${label}
    dangerouslySetInnerHTML=${{ __html: body }} />`;
}

// ------------------------------------------------------------- brand

/** The official Drive mark — the only entry point for the steering-wheel. */
export function DriveMark({ size = 24, contrast = "adaptive", className, wiggle = false, style = {} }) {
  const cls = contrast === "onLight" ? "on-light" : contrast === "onDark" ? "on-dark" : "";
  return html`<span class=${cx("drive-mark", cls, wiggle && !reducedMotion() && "wiggle", className)} style=${{ width: size, height: size, ...style }} aria-hidden="true" />`;
}

/** A small steering motion — never a tumbling mark. Stills under Reduce Motion. */
export function DriveSpinner({ size = 28, contrast = "adaptive" }) {
  return html`<span class=${cx("drive-mark", contrast === "onLight" ? "on-light" : contrast === "onDark" ? "on-dark" : "", !reducedMotion() && "spin")} style=${{ width: size, height: size }} role="progressbar" aria-label="Working" />`;
}

/** The Cline bot mark, 1:1 from the hub icon (viewBox 466.73 × 487.04, even-odd). */
export const CLINE_BOT_PATH = "M463.6 275.08L434.34 216.33V182.5C434.34 126.42 389.33 81 333.81 81H283.8C287.42 73.57 289.41 65.21 289.41 56.39C289.41 25.22 264.33 0 233.34 0C202.35 0 177.27 25.22 177.27 56.39C177.27 65.21 179.26 73.56 182.88 81H132.87C77.36 81 32.35 126.42 32.35 182.5V216.33L2.48 274.92C-0.53 280.82 -0.53 287.84 2.48 293.73L32.35 351.66V385.49C32.35 441.57 77.36 486.99 132.87 486.99H333.82C389.33 486.99 434.35 441.57 434.35 385.49V351.66L463.56 293.53C466.46 287.74 466.46 280.92 463.61 275.07ZM202.75 322.96C202.75 348.44 182.21 369.1 156.87 369.1C131.53 369.1 110.99 348.44 110.99 322.96V240.94C110.99 215.46 131.53 194.8 156.87 194.8C182.21 194.8 202.75 215.46 202.75 240.94V322.96ZM350.58 322.96C350.58 348.44 330.04 369.1 304.7 369.1C279.36 369.1 258.82 348.44 258.82 322.96V240.94C258.82 215.46 279.36 194.8 304.7 194.8C330.04 194.8 350.58 215.46 350.58 240.94V322.96Z";
export function ClineBot({ size = 20, color = "currentColor", style = {} }) {
  return html`<svg width=${size} height=${size * (487.04 / 466.73)} viewBox="0 0 466.73 487.04" aria-hidden="true" style=${{ display: "block", ...style }}>
    <path d=${CLINE_BOT_PATH} fill=${color} fill-rule="evenodd" />
  </svg>`;
}

/** Humans keep initials; agents wear the Cline bot, told apart by color. */
export function AvatarChip({ letter, name, color = "var(--violet)", size = 34, speaking = false, human = false, className, style = {} }) {
  const ch = letter ?? initialsOf(name);
  return html`<span class=${cx("avatar", speaking && "speaking", className)} style=${{ width: size, height: size, background: color, fontSize: size * 0.36, ...style }} aria-label=${name ? `${name}${speaking ? ", speaking" : ""}` : undefined} role=${name ? "img" : undefined}>
    ${human ? ch : html`<${ClineBot} size=${size * 0.58} color="#fff" />`}
  </span>`;
}

export function AvatarStack({ people, size = 26 }) {
  return html`<span class="avatar-stack">${people.map((p) => html`<${AvatarChip} key=${p.name ?? p.letter} letter=${p.letter} name=${p.name} color=${p.color} size=${size} human=${p.human} />`)}</span>`;
}

// ---------------------------------------------------------- buttons

/** Pressable button with spring press feedback. variant: primary | gradient | secondary | ghost | quiet | danger | onDark */
export function Button({ variant = "secondary", size, fill = false, pill = false, icon, iconSize, trailing, children, className, onClick, disabled, label, type = "button", solid, style, ...rest }) {
  const v = variant === "secondary" ? "" : variant;
  return html`<button type=${type} class=${cx("btn", v, size, fill && "fill", pill && "pill", solid && "solid", className)} disabled=${disabled} aria-label=${label} style=${style}
    onClick=${(e) => { if (disabled) return; haptic("light"); onClick?.(e); }} ...${rest}>
    ${icon ? html`<${Icon} name=${icon} size=${iconSize ?? (size === "sm" || size === "xs" ? 14 : 17)} weight=${2.4} />` : null}
    ${children != null ? html`<span>${children}</span>` : null}
    ${trailing ? html`<${Icon} name=${trailing} size=${14} weight=${2.4} />` : null}
  </button>`;
}

export function IconButton({ name, size = 18, label, onClick, plain = false, className, tint, dim, badge, disabled, style, ...rest }) {
  return html`<button type="button" class=${cx("icon-btn", plain && "plain", dim, className)} aria-label=${label} title=${label} disabled=${disabled}
    style=${{ color: tint, position: "relative", ...style }} onClick=${(e) => { haptic("light"); onClick?.(e); }} ...${rest}>
    <${Icon} name=${name} size=${size} weight=${2.2} />
    ${badge ? html`<span class="badge-count" style=${{ position: "absolute", top: -3, right: -4 }}>${badge}</span>` : null}
  </button>`;
}

/** Any tappable container with press feedback + optional long-press menu. */
export function Pressable({ as = "div", className, onClick, onLongPress, children, style, label, role, ...rest }) {
  const lp = useLongPress(onLongPress, { onClick: (e) => { haptic("light"); onClick?.(e); } });
  const handlers = onLongPress ? lp : { onClick: (e) => { haptic("light"); onClick?.(e); } };
  const Tag = as;
  return html`<${Tag} class=${cx("pressable", className)} style=${{ cursor: onClick || onLongPress ? "pointer" : undefined, ...style }} role=${role ?? (onClick ? "button" : undefined)} tabIndex=${onClick ? 0 : undefined} aria-label=${label}
    onKeyDown=${onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined} ...${handlers} ...${rest}>${children}</${Tag}>`;
}

// ------------------------------------------------------------ chrome

export function Card({ children, className, radius, hero = false, pad = true, gradient = false, surface2 = false, interactive = false, onClick, onLongPress, style = {}, label, ...rest }) {
  const cls = cx("card", hero && "hero", pad && "pad", gradient && "gradient", surface2 && "surface2", (interactive || onClick) && "interactive", className);
  const st = radius ? { borderRadius: radius, ...style } : style;
  if (onClick || onLongPress) return html`<${Pressable} className=${cls} style=${st} onClick=${onClick} onLongPress=${onLongPress} label=${label} ...${rest}>${children}</${Pressable}>`;
  return html`<div class=${cls} style=${st} ...${rest}>${children}</div>`;
}

export function Eyebrow({ children, className, style }) {
  return html`<div class=${cx("eyebrow", className)} style=${style}>${children}</div>`;
}

export function Section({ eyebrow, title, action, onAction, children, className, style }) {
  return html`<section class=${cx("section", className)} style=${style}>
    ${eyebrow || title || action ? html`<div class="section-head">
      <div>${eyebrow ? html`<${Eyebrow}>${eyebrow}</${Eyebrow}>` : null}${title ? html`<div class="section-title">${title}</div>` : null}</div>
      ${action ? html`<${Button} variant="ghost" size="sm" onClick=${onAction}>${action}</${Button}>` : null}
    </div>` : null}
    ${children}
  </section>`;
}

export function Chip({ children, tint, variant, icon, className, style, pill = false }) {
  return html`<span class=${cx("chip", variant, tint && "tint", pill && "pill", className)} style=${{ "--tint": tint, ...style }}>
    ${icon ? html`<${Icon} name=${icon} size=${11} weight=${2.6} />` : null}${children}
  </span>`;
}

export function LivePill({ onGradient = false }) {
  return html`<span class="chip pill" style=${onGradient ? { background: "rgba(255,255,255,.18)", color: "#fff" } : { background: "var(--surface)", boxShadow: "inset 0 0 0 .8px var(--hairline)", color: "var(--ink)" }} aria-label="Live">
    <i class="dot pulse" style=${onGradient ? { background: "#4ADE80" } : {}} /> <span style=${{ letterSpacing: 1.2, fontWeight: 900, fontSize: 10 }}>LIVE</span>
  </span>`;
}

export function PreviewChip({ text = "PREVIEW · DEMO SESSION" }) {
  return html`<span class="chip pill" style=${{ background: "var(--surface)", boxShadow: "inset 0 0 0 .8px var(--hairline)", color: "var(--ink-78)", padding: "8px 14px", letterSpacing: 1.1, fontSize: 10 }}><i class="dot" /> ${text}</span>`;
}

export function StateChip({ state }) {
  if (state === "Working") return html`<span class="chip"><i class="dot" />${state}</span>`;
  if (state === "Needs you") return html`<span class="chip violet">${state}</span>`;
  return html`<span class="chip danger">${state}</span>`;
}

export function HonestyDots({ items = ["On device", "You approve"] }) {
  return html`<div class="hstack" style=${{ gap: 16 }}>${items.map((s) => html`<span key=${s} class="hstack t-sm muted" style=${{ gap: 6 }}><i class="dot" />${s}</span>`)}</div>`;
}

export function Badge({ count, violet = false }) {
  if (!count) return null;
  return html`<span class=${cx("badge-count", violet && "violet")}>${count > 99 ? "99+" : count}</span>`;
}

export function ProgressBar({ value = 0, tint, height = 5, className, style }) {
  return html`<div class=${cx("progress", className)} style=${{ height, "--tint": tint, ...style }} role="progressbar" aria-valuenow=${Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100"><i style=${{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>`;
}

export function Divider() { return html`<div class="divider" role="separator" />`; }

export function Empty({ icon = "circle.circle", title, body, action, onAction, children }) {
  return html`<div class="empty fade-in">
    <div class="empty-icon"><${Icon} name=${icon} size=${26} weight=${1.8} /></div>
    ${title ? html`<div class="empty-title">${title}</div>` : null}
    ${body ? html`<div class="empty-body">${body}</div>` : null}
    ${action ? html`<${Button} variant="primary" size="sm" onClick=${onAction} style=${{ marginTop: 8 }}>${action}</${Button}>` : null}
    ${children}
  </div>`;
}

/** Live-level or idle-animated bars. `level` 0..1 drives the live form. */
export function Waveform({ color = "var(--violet)", barCount = 6, height = 18, live = false, level = 0 }) {
  const reduced = reducedMotion();
  useFrame(!reduced && !live);
  const t = performance.now() / 1000;
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    let h;
    if (live) { const center = (barCount - 1) / 2; const falloff = 1 - Math.abs(i - center) / (center + 1); h = height * Math.max(0.16, level * (0.45 + 0.55 * falloff)); }
    else if (reduced) h = height * [0.45, 0.8, 1.0, 0.6, 0.85, 0.4][i % 6];
    else h = height * (0.30 + 0.70 * Math.abs(Math.sin(t * 5.5 + i * 1.1)));
    bars.push(html`<i key=${i} style=${{ width: 3, height: h, borderRadius: 1.5, background: color, transition: live ? "height .08s ease-out" : "none" }} />`);
  }
  return html`<span class="hstack" style=${{ gap: 2.5, height, alignItems: "center" }} aria-hidden="true">${bars}</span>`;
}

// ---------------------------------------------------------- nav bar

/** Navigation bar. `back` (bool|fn), `title`, `leading`/`trailing` nodes, `large` title below. */
export function NavBar({ title, back = false, onBack, leading, trailing, large = false, hairline = false, subtitle, center = true }) {
  const showBack = back === true || typeof back === "function" || typeof back === "string";
  return html`<header class=${cx("navbar", hairline && "hairline")}>
    <div class="nav-side">
      ${showBack ? html`<button class="back-btn pressable" onClick=${() => { haptic("light"); (typeof back === "function" ? back : onBack ?? (() => nav.back()))(); }} aria-label="Back"><${Icon} name="chevron.left" size=${22} weight=${2.6} />${typeof back === "string" ? html`<span>${back}</span>` : null}</button>` : null}
      ${leading}
    </div>
    ${!large ? html`<div class=${cx("nav-title truncate", !center && "leading")}>${title}${subtitle ? html`<div class="t-xs muted" style=${{ fontWeight: 500 }}>${subtitle}</div>` : null}</div>` : html`<div class="grow" />`}
    <div class="nav-side trailing">${trailing}</div>
  </header>`;
}

/** Home toolbar escape hatch on non-Home roots. */
export function HomeToolbarButton() {
  return html`<button class="back-btn pressable" style=${{ color: "var(--ink)", gap: 6 }} onClick=${() => { nav.selectTab("home"); }} aria-label="Home" title="Returns to the Drive home screen"><${DriveMark} size=${20} /><span class="t-sm w7">Home</span></button>`;
}

export function SettingsToolbarButton({ tab = "General", source = "home" }) {
  return html`<${IconButton} name="gearshape" plain label="Settings" onClick=${() => nav.present("settings", { tab, source })} />`;
}

/** A full page: nav bar + scroll area with content padding. Root pages leave room for the tab bar. */
export function Screen({ title, largeTitle, back, onBack, leading, trailing, subtitle, root = false, children, scrollRef, className, contentClass, onScroll, footer, style, noPad = false, noNav = false }) {
  return html`<div class=${cx("screen", className)} style=${style}>
    ${noNav ? html`<div style=${{ height: "var(--safe-top)", flex: "none" }} />` : html`<${NavBar} title=${title} back=${back} onBack=${onBack} leading=${leading} trailing=${trailing} subtitle=${subtitle} large=${!!largeTitle && !title} />`}
    <div class="scroll" ref=${scrollRef} onScroll=${onScroll}>
      <div class=${cx(!noPad && "content", !root && "no-tabbar", contentClass)}>
        ${largeTitle ? html`<h1 class="large-title">${largeTitle}</h1>` : null}
        ${children}
      </div>
    </div>
    ${footer}
  </div>`;
}

// ------------------------------------------------------------- rows

export function Row({ icon, iconTint, iconBg, leading, title, subtitle, trailing, chevron = false, onClick, onLongPress, className, danger = false, style, label, checked }) {
  const body = html`
    ${leading ?? (icon ? html`<span class="row-icon" style=${{ color: iconTint, background: iconBg }}><${Icon} name=${icon} size=${16} weight=${2.2} /></span>` : null)}
    <div class="row-body">
      <div class=${cx("row-title", danger && "danger")}>${title}</div>
      ${subtitle ? html`<div class="row-sub">${subtitle}</div>` : null}
    </div>
    ${trailing != null || chevron || checked != null ? html`<div class="row-trailing">${trailing}${checked ? html`<${Icon} name="checkmark" size=${16} weight=${3} color="var(--violet-text)" />` : null}${chevron ? html`<${Icon} name="chevron.right" size=${16} weight=${2.4} />` : null}</div>` : null}`;
  if (onClick || onLongPress) return html`<${Pressable} as="button" className=${cx("row interactive", className)} style=${style} onClick=${onClick} onLongPress=${onLongPress} label=${label}>${body}</${Pressable}>`;
  return html`<div class=${cx("row", className)} style=${style}>${body}</div>`;
}

/** Grouped rows in one card (SwiftUI List section). */
export function RowGroup({ children, className, style, header, footer }) {
  return html`<div>
    ${header ? html`<div class="eyebrow" style=${{ padding: "0 4px 8px" }}>${header}</div>` : null}
    <div class=${cx("card", className)} style=${{ overflow: "hidden", padding: 0, ...style }}>${children}</div>
    ${footer ? html`<div class="t-xs muted" style=${{ padding: "8px 4px 0", lineHeight: 1.4 }}>${footer}</div>` : null}
  </div>`;
}

// ------------------------------------------------------------ inputs

export function Toggle({ checked, onChange, label, violet = false, disabled }) {
  return html`<button type="button" role="switch" aria-checked=${!!checked} aria-label=${label} disabled=${disabled} class=${cx("toggle", checked && "on", violet && "violet")} onClick=${() => { haptic("light"); onChange?.(!checked); }} />`;
}

export function ToggleRow({ title, subtitle, checked, onChange, icon, iconTint, violet, disabled }) {
  return html`<${Row} icon=${icon} iconTint=${iconTint} title=${title} subtitle=${subtitle} trailing=${html`<${Toggle} checked=${checked} onChange=${onChange} label=${title} violet=${violet} disabled=${disabled} />`} />`;
}

export function Segmented({ options, value, onChange, label, size }) {
  return html`<div class=${cx("segmented", size)} role="tablist" aria-label=${label}>
    ${options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label;
      return html`<button key=${v} role="tab" aria-selected=${v === value} class=${cx(v === value && "on")} onClick=${() => { if (v !== value) { haptic("light"); onChange(v); } }}>${l}</button>`; })}
  </div>`;
}

export function TextField({ value, onInput, onChange, placeholder, multiline = false, rows = 1, icon, clearable = true, autoFocus, type = "text", onSubmit, label, className, style, inputMode, maxLength, disabled }) {
  const [focus, setFocus] = useState(false);
  const ref = useRef();
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 80); }, [autoFocus]);
  const common = {
    ref, value: value ?? "", placeholder, "aria-label": label ?? placeholder, inputMode, maxLength, disabled,
    onInput: (e) => onInput?.(e.target.value, e), onChange: (e) => onChange?.(e.target.value, e),
    onFocus: () => setFocus(true), onBlur: () => setFocus(false),
    onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey && onSubmit && !multiline) { e.preventDefault(); onSubmit(value); } if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) { e.preventDefault(); onSubmit(value); } },
  };
  return html`<label class=${cx("field", focus && "focus", className)} style=${style}>
    ${icon ? html`<${Icon} name=${icon} size=${16} color="var(--ink-35)" />` : null}
    ${multiline ? html`<textarea rows=${rows} ...${common} />` : html`<input type=${type} ...${common} />`}
    ${clearable && value ? html`<button type="button" class="clear" aria-label="Clear" onClick=${() => { onInput?.(""); onChange?.(""); ref.current?.focus(); }}><${Icon} name="xmark.circle.fill" size=${16} fill /></button>` : null}
  </label>`;
}

export function SearchField(props) { return html`<${TextField} icon="magnifyingglass" type="search" ...${props} />`; }

/** Native-feeling picker rendered as a row that opens a menu. */
export function PickerRow({ title, subtitle, value, options, onChange, icon, iconTint }) {
  const open = (e, pt) => {
    const rect = e.currentTarget?.getBoundingClientRect?.();
    nav.openMenu({ x: pt?.x ?? rect?.right ?? 200, y: pt?.y ?? rect?.bottom ?? 200, title, items: options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return { label: l, checked: v === value, onSelect: () => onChange(v) }; }) });
  };
  return html`<${Row} icon=${icon} iconTint=${iconTint} title=${title} subtitle=${subtitle} onClick=${open} trailing=${html`<span class="t-sm muted">${typeof value === "string" ? value : value?.label ?? value}</span>`} chevron=${false} />`;
}

// ------------------------------------------------------------- menus

/** Open a context menu at an event's point. items: [{label, icon, danger, disabled, checked, onSelect}] */
export function showMenu(e, items, { title, preview } = {}) {
  const pt = e?.touches?.[0] ?? e;
  const rect = e?.currentTarget?.getBoundingClientRect?.();
  nav.openMenu({ x: pt?.clientX ?? rect?.left ?? 160, y: pt?.clientY ?? rect?.bottom ?? 200, items, title, preview });
}

export function MenuLayer({ menu }) {
  const ref = useRef();
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  useLayoutEffect(() => {
    const host = ref.current?.parentElement?.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 240, h = ref.current?.offsetHeight ?? 120;
    if (!host) return;
    let left = menu.x - host.left, top = menu.y - host.top + 8;
    if (left + w > host.width - 12) left = host.width - w - 12;
    if (top + h > host.height - 12) top = Math.max(12, menu.y - host.top - h - 8);
    setPos({ left: Math.max(12, left), top });
  }, [menu]);
  return html`<div class="menu-layer">
    <div class="backdrop" onClick=${() => nav.closeMenu()} />
    <div class="menu" ref=${ref} style=${pos} role="menu">
      ${menu.preview ? html`<div class="menu-preview">${menu.preview}</div>` : null}
      ${menu.title ? html`<div class="menu-title">${menu.title}</div>` : null}
      ${menu.items.map((it, i) => html`<button key=${i} role="menuitem" class=${cx("menu-item", it.danger && "danger", it.disabled && "disabled")} disabled=${it.disabled}
        onClick=${() => { haptic("light"); nav.closeMenu(); it.onSelect?.(); }}>
        <span>${it.label}</span>
        ${it.checked ? html`<${Icon} name="checkmark" size=${16} weight=${3} color="var(--violet-text)" />` : it.icon ? html`<${Icon} name=${it.icon} size=${16} />` : null}
      </button>`)}
    </div>
  </div>`;
}

// ------------------------------------------------------- misc widgets

export function Stat({ value, label, sub, tint }) {
  return html`<div class="card pad" style=${{ minWidth: 0 }}>
    <div class="t-xl w8" style=${{ color: tint, letterSpacing: -0.5 }}>${value}</div>
    <div class="t-sm w6" style=${{ marginTop: 2 }}>${label}</div>
    ${sub ? html`<div class="t-xs muted" style=${{ marginTop: 2 }}>${sub}</div>` : null}
  </div>`;
}

/** Counts up from 0 to `value` on mount (Profile's CountUpText). */
export function CountUp({ value, duration = 700, format = (n) => Math.round(n).toLocaleString(), className, style }) {
  const [n, setN] = useState(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) { setN(value); return undefined; }
    const start = performance.now(); let id = 0;
    const tick = (now) => { const p = Math.min(1, (now - start) / duration); setN(value * (1 - Math.pow(1 - p, 3))); if (p < 1) id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return html`<span class=${className} style=${style}>${format(n)}</span>`;
}

export function DiffLine({ text, added, removed }) {
  return html`<div class=${cx("diff-line", added && "added", removed && "removed")}>${text}</div>`;
}

/** Vertical space. */
export function Spacer({ h = 12 }) { return html`<div style=${{ height: h }} />`; }
