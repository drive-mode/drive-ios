// Navigation for the local build: four tab roots, a per-tab push stack,
// a sheet stack, one full-screen cover, floating menus, toasts, banners.
// Views register by route name and navigate by name, so clusters never
// import each other. Mirrors NavigationStack / .sheet / .fullScreenCover.
import { Observable } from "./ui.js";
import { prefs } from "./prefs.js";

const routes = new Map();

/** Register a view for a route name. `Component` receives `{ params, route }`. */
export function registerRoute(name, Component, options = {}) {
  routes.set(name, { Component, options });
}
export function routeFor(name) { return routes.get(name); }
export function hasRoute(name) { return routes.has(name); }

class Nav extends Observable {
  constructor() {
    super();
    this.tab = "home";
    this.tabDirection = 1;
    this.stacks = { home: [], work: [], agents: [], tasks: [] };
    this.sheets = [];       // [{ id, name, params, detent:'large'|'medium', light, closing }]
    this.cover = null;      // { id, name, params, closing }
    this.menu = null;       // { id, x, y, items, title, preview }
    this.toasts = [];       // [{ id, text, icon, leaving }]
    this.banners = [];      // [{ id, title, body, icon, tint, action, onAction, leaving }]
    this.counter = 0;
    this.onTabChange = null; // set by app: (tab) => void (intent recording)
    this.onPush = null;
  }

  id(prefix) { return `${prefix}-${++this.counter}`; }
  get stack() { return this.stacks[this.tab]; }
  get depth() { return this.stack.length; }
  get top() { return this.stack[this.stack.length - 1] ?? null; }
  get atRoot() { return this.stack.length === 0 && this.sheets.length === 0 && !this.cover; }

  selectTab(tab) {
    if (!(tab in this.stacks)) return;
    const order = ["home", "work", "agents", "tasks"];
    this.tabDirection = order.indexOf(tab) >= order.indexOf(this.tab) ? 1 : -1;
    if (this.tab === tab) { this.popToRoot(); return; }
    this.tab = tab;
    this.onTabChange?.(tab);
    this.emit();
  }

  push(name, params = {}, { tab } = {}) {
    if (!routes.has(name)) { console.warn("[nav] unknown route", name); return; }
    if (tab && tab !== this.tab) { this.tab = tab; this.onTabChange?.(tab); }
    this.stack.push({ id: this.id("page"), name, params, popping: false });
    this.onPush?.(name, params);
    this.emit();
  }

  /** Replace the current top page (or push when at root). */
  replace(name, params = {}) {
    if (this.stack.length) this.stack.pop();
    this.push(name, params);
  }

  pop() {
    const page = this.top;
    if (!page || page.popping) return;
    page.popping = true;
    this.emit();
    setTimeout(() => {
      const i = this.stack.indexOf(page);
      if (i >= 0) this.stack.splice(i, 1);
      this.emit();
    }, 280);
  }

  popToRoot() {
    if (!this.stack.length) return;
    this.stacks[this.tab] = [];
    this.emit();
  }

  present(name, params = {}, { detent = "large", light = false } = {}) {
    if (!routes.has(name)) { console.warn("[nav] unknown route", name); return; }
    this.sheets.push({ id: this.id("sheet"), name, params, detent, light, closing: false });
    this.emit();
  }

  dismiss(result) {
    const sheet = this.sheets[this.sheets.length - 1];
    if (!sheet || sheet.closing) return;
    sheet.closing = true;
    sheet.result = result;
    this.emit();
    setTimeout(() => {
      const i = this.sheets.indexOf(sheet);
      if (i >= 0) this.sheets.splice(i, 1);
      this.emit();
    }, 260);
  }

  dismissAll() { this.sheets = []; this.emit(); }

  presentCover(name, params = {}) {
    if (!routes.has(name)) { console.warn("[nav] unknown route", name); return; }
    this.cover = { id: this.id("cover"), name, params, closing: false };
    this.emit();
  }

  dismissCover() {
    const cover = this.cover;
    if (!cover || cover.closing) return;
    cover.closing = true;
    this.emit();
    setTimeout(() => { if (this.cover === cover) this.cover = null; this.emit(); }, 300);
  }

  /** Back = whichever layer is on top: menu → sheet → cover → page. */
  back() {
    if (this.menu) return this.closeMenu();
    if (this.sheets.length) return this.dismiss();
    if (this.cover) return this.dismissCover();
    return this.pop();
  }

  /** Context/dropdown menu at a point. items: [{label, icon, danger, disabled, onSelect, keep}] */
  openMenu({ x, y, items, title = null, preview = null, anchor = null }) {
    this.menu = { id: this.id("menu"), x, y, items, title, preview, anchor };
    this.emit();
  }
  closeMenu() { this.menu = null; this.emit(); }

  toast(text, { icon = null, ms = 2200 } = {}) {
    const t = { id: this.id("toast"), text, icon, leaving: false };
    this.toasts.push(t);
    if (this.toasts.length > 2) this.toasts.shift();
    this.emit();
    setTimeout(() => { t.leaving = true; this.emit(); }, ms);
    setTimeout(() => { this.toasts = this.toasts.filter((x) => x !== t); this.emit(); }, ms + 260);
  }

  /** In-foreground notification banner (Notifications.swift). */
  banner({ title, body, icon = "bell.badge", tint = "var(--violet)", action = null, onAction = null, ms = 6000 }) {
    const b = { id: this.id("banner"), title, body, icon, tint, action, onAction, leaving: false };
    this.banners.push(b);
    if (this.banners.length > 2) this.banners.shift();
    this.emit();
    const close = () => { b.leaving = true; this.emit(); setTimeout(() => { this.banners = this.banners.filter((x) => x !== b); this.emit(); }, 260); };
    b.close = close;
    setTimeout(() => { if (!b.leaving) close(); }, ms);
    return b;
  }

  /** The Surface the user is on, for the intent engine. */
  currentSurface() {
    const map = { projectMap: "projectMap", activity: "activity", inbox: "inbox", artifacts: "artifacts", artifact: "artifacts", profile: "profile", archive: "archive", needsYou: "needsYou", search: "search", conversation: "needsYou" };
    const top = this.top;
    if (top && map[top.name]) return map[top.name];
    return this.tab;
  }
}

export const nav = new Nav();

// Hardware back / Escape closes the top layer; browser history stays flat on
// purpose (the device frame is the app, not a website).
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") nav.back();
});

/** Restore the last tab across reloads — a small convenience, never a surprise. */
const savedTab = prefs.get("nav.tab", null);
if (savedTab && savedTab in nav.stacks) nav.tab = savedTab;
nav.subscribe(() => prefs.set("nav.tab", nav.tab));
