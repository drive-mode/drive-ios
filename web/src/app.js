// @main — the app shell. A port of `DriveApp.swift` (RootView, MainTabs), the
// guide bar (`Store.tabBarVisible`), tab swipes (`TabSwipe`), navigation
// layers (pages, sheets, cover, menus, toasts, banners) and scene-phase wire
// start/pause. Views live in ./views/*; each cluster registers its routes.
import { html, render, cx, useEffect, useRef, useState, useObservable, useSwipe, haptic, Fragment } from "./ui.js";
import { prefs } from "./prefs.js";
import { createConfiguration, AppStore } from "./store.js";
import "./wire.js";
import { nav, routeFor, hasRoute } from "./nav.js";
import { Icon, DriveMark, MenuLayer, Badge, Button } from "./components.js";
import { notifications } from "./notifications.js";
import { registerAllViews } from "./views/index.js";

const configuration = createConfiguration();
export const store = new AppStore(configuration);
window.drive = { store, nav, configuration, prefs, hasRoute, __hasRoute: hasRoute }; // console + test hooks

registerAllViews({ store, nav });
notifications.configure(store);
applyAppearance();

// ------------------------------------------------------ appearance

export function applyAppearance() {
  const a = prefs.get("appearance", "System");
  const root = document.documentElement;
  if (a === "Light" || a === "Dark") root.dataset.theme = a.toLowerCase(); else delete root.dataset.theme;
  // The in-app toggle forces Reduce Motion on; otherwise the OS preference
  // (prefers-reduced-motion) decides, so the attribute is absent, not "0".
  if (prefs.get("reduceMotion", false)) root.dataset.reduceMotion = "1"; else delete root.dataset.reduceMotion;
}
window.addEventListener("drive:prefs-changed", applyAppearance);

// -------------------------------------------------------- tab pages

const TABS = [
  { id: "home", label: "Home", icon: "house" },
  { id: "work", label: "Work", icon: null },
  { id: "agents", label: "Agents", icon: "person.2" },
  { id: "tasks", label: "Tasks", icon: "checklist" },
];

function TabBar() {
  const s = useObservable(store);
  const n = useObservable(nav);
  const badges = { home: s.unreadInboxCount, agents: s.needsYouCount, tasks: s.attentionTasks.filter((t) => t.state === "Blocked").length };
  return html`<${Fragment}>
    <nav class=${cx("tabbar", (!s.tabBarVisible || n.stack.length > 0) && "hidden-bar")} aria-label="Guide bar" onPointerDown=${() => s.touchTabBar()}>
      ${TABS.map((t) => html`<button key=${t.id} class=${cx("tab", n.tab === t.id && "on")} role="tab" aria-selected=${n.tab === t.id} aria-label=${t.label} onClick=${() => { haptic("light"); nav.selectTab(t.id); }}>
        ${t.icon ? html`<${Icon} name=${t.icon} size=${22} weight=${n.tab === t.id ? 2.4 : 1.9} />` : html`<${DriveMark} size=${22} style=${{ background: n.tab === t.id ? "var(--violet-text)" : "var(--ink-35)" }} />`}
        <span>${t.label}</span>
        ${badges[t.id] ? html`<span class="tab-badge"><${Badge} count=${badges[t.id]} violet=${t.id !== "agents"} /></span>` : null}
      </button>`)}
    </nav>
    <button class=${cx("grabber", !s.tabBarVisible && n.stack.length === 0 && "visible")} aria-label="Show guide bar" onClick=${() => s.summonTabBar()} onPointerDown=${(e) => { const y = e.clientY; const up = (ev) => { if (y - ev.clientY > 10) s.summonTabBar(); window.removeEventListener("pointerup", up); }; window.addEventListener("pointerup", up); }}><i /></button>
  </${Fragment}>`;
}

function TabRoot({ tab }) {
  const route = routeFor(tab);
  if (!route) return html`<div class="empty">No view registered for ${tab}</div>`;
  const swipe = useSwipe((dir) => {
    const order = ["home", "work", "agents", "tasks"];
    const j = order.indexOf(tab) - dir;
    if (j >= 0 && j < order.length) { haptic("light"); nav.selectTab(order[j]); }
  });
  return html`<div class="tab-page" key=${tab} style=${{ "--dir": nav.tabDirection }} ...${swipe}><${route.Component} params=${{}} route=${{ name: tab }} /></div>`;
}

// --------------------------------------------------- pushed pages

function Page({ page, index, depth }) {
  const route = routeFor(page.name);
  const ref = useRef();
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const isTop = index === depth - 1;
  // Edge-swipe back: begin within 28px of the left edge, follow the finger, pop past 35%.
  const onDown = (e) => { if (!isTop || e.clientX - (ref.current?.getBoundingClientRect().left ?? 0) > 28) return; drag.current = { x: e.clientX, w: ref.current.offsetWidth }; try { ref.current.setPointerCapture?.(e.pointerId); } catch { /* stale pointer id */ } };
  const onMove = (e) => { if (!drag.current) return; setDx(Math.max(0, e.clientX - drag.current.x)); };
  const onUp = () => { if (!drag.current) return; const w = drag.current.w; const pop = dx > w * 0.35; drag.current = null; setDx(0); if (pop) nav.pop(); };
  return html`<div ref=${ref} class=${cx("page", index > 0 || true ? "pushed" : "", page.popping && "popping", !isTop && "under", dx > 0 && "dragging")} style=${dx > 0 ? { transform: `translateX(${dx}px)` } : undefined}
    onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} aria-hidden=${!isTop}>
    ${route ? html`<${route.Component} params=${page.params} route=${page} />` : html`<div class="empty">Unknown route ${page.name}</div>`}
  </div>`;
}

function NavigationStack() {
  const n = useObservable(nav);
  const stack = n.stack;
  return html`<div class="nav-stack">
    <div class=${cx("page", stack.length && "under")} aria-hidden=${stack.length > 0}><${TabRoot} tab=${n.tab} /></div>
    ${stack.map((p, i) => html`<${Page} key=${p.id} page=${p} index=${i} depth=${stack.length} />`)}
  </div>`;
}

// ------------------------------------------------------- overlays

function SheetLayer({ sheet }) {
  const route = routeFor(sheet.name);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);
  const ref = useRef();
  const onDown = (e) => { drag.current = { y: e.clientY }; };
  const onMove = (e) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)); };
  const onUp = () => { if (!drag.current) return; const close = dy > 120; drag.current = null; setDy(0); if (close) nav.dismiss(); };
  return html`<div class="overlay" role="dialog" aria-modal="true">
    <div class="backdrop" style=${sheet.closing ? { animation: "fadeOut .25s forwards" } : undefined} onClick=${() => nav.dismiss()} />
    <div ref=${ref} class=${cx("sheet", sheet.detent, sheet.light && "light", sheet.closing && "closing")} style=${dy > 0 ? { transform: `translateY(${dy}px)`, animation: "none" } : undefined}>
      <div class="sheet-grab-zone" onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} style=${{ touchAction: "none", cursor: "grab", padding: "6px 0 2px", flex: "none" }}><div class="sheet-grab" /></div>
      ${route ? html`<${route.Component} params=${sheet.params} route=${sheet} />` : null}
    </div>
  </div>`;
}

function CoverLayer({ cover }) {
  const route = routeFor(cover.name);
  return html`<div class=${cx("nav-cover", cover.closing && "closing")} role="dialog" aria-modal="true">${route ? html`<${route.Component} params=${cover.params} route=${cover} />` : null}</div>`;
}

function Toasts({ toasts }) {
  return html`<div class="toast-layer" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class=${cx("toast", t.leaving && "leaving")}>${t.icon ? html`<${Icon} name=${t.icon} size=${15} weight=${2.4} />` : null}${t.text}</div>`)}</div>`;
}

function Banners({ banners }) {
  return html`<div class="banner-layer">${banners.map((b) => html`<div key=${b.id} class=${cx("banner", b.leaving && "leaving")} role="status">
    <span class="row-icon" style=${{ color: "#fff", background: b.tint }}><${Icon} name=${b.icon} size=${16} weight=${2.3} /></span>
    <div class="grow"><div class="t-sm w7">${b.title}</div><div class="t-xs muted" style=${{ marginTop: 2 }}>${b.body}</div></div>
    ${b.action ? html`<${Button} size="xs" variant="primary" onClick=${() => { b.close(); b.onAction?.(); }}>${b.action}</${Button}>` : null}
    <button class="icon-btn sm plain" aria-label="Dismiss" onClick=${() => b.close()}><${Icon} name="xmark" size=${14} /></button>
  </div>`)}</div>`;
}

// ----------------------------------------------------------- root

function RootView() {
  const s = useObservable(store);
  const n = useObservable(nav);
  const frameless = new URLSearchParams(location.search).get("frame") === "0" || window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    s.resolveInitialWriterURL().then((url) => { if (url) { s.writerURL = url; } s.startWire(); });
    s.sweepExperiments();
    s.scheduleTabBarHide();
    const onVis = () => { if (document.visibilityState === "visible") { s.startWire(); s.sweepExperiments(); } else s.pauseWire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => { s.intent.record(nav.currentSurface()); }, [n.tab, n.stack.length]);
  useEffect(() => { if (s.showApproval && !n.sheets.some((sh) => sh.name === "approval")) nav.present("approval", {}, { detent: "medium", light: true }); }, [s.showApproval]);

  const open = routeFor("open");
  return html`<div class=${cx("device", frameless && "frameless")} data-channel=${configuration.channel}>
    ${s.launched ? html`<${NavigationStack} /><${TabBar} />` : html`<div class="screen">${open ? html`<${open.Component} params=${{}} />` : html`<div class="empty">Open view missing</div>`}</div>`}
    ${n.cover ? html`<${CoverLayer} cover=${n.cover} />` : null}
    ${n.sheets.map((sh) => html`<${SheetLayer} key=${sh.id} sheet=${sh} />`)}
    ${n.menu ? html`<${MenuLayer} menu=${n.menu} />` : null}
    <${Banners} banners=${n.banners} />
    <${Toasts} toasts=${n.toasts} />
  </div>`;
}

render(html`<${RootView} />`, document.getElementById("app"));
