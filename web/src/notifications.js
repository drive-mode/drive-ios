// Notifications — a port of `Sources/Notifications.swift`. Planned sessions
// schedule a reminder carrying a SESSION category whose Join action deep-links
// into the session; banners show in-foreground too. Web Notifications are
// used when the viewer granted them; otherwise the in-app banner is the
// notification. Preferences come from Settings → NOTIFICATIONS.
import { prefs, prefBool } from "./prefs.js";
import { nav } from "./nav.js";

const LEAD_MS = 5 * 60_000; // remind five minutes before

export class NotificationManager {
  constructor() { this.store = null; this.timers = new Map(); this.permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported"; }

  configure(store) { this.store = store; store.hooks.scheduleSessionReminder = (s) => this.scheduleSessionReminder(s); store.hooks.cancelSessionReminder = (id) => this.cancelSessionReminder(id); }

  async requestPermission() {
    if (typeof Notification === "undefined") return "unsupported";
    try { this.permission = await Notification.requestPermission(); } catch { this.permission = "denied"; }
    return this.permission;
  }

  enabled(kind) {
    const defaults = { approval: true, blocked: true, invite: true, ships: false, product: false };
    return prefBool(`notify.${kind}`, defaults[kind] ?? true);
  }

  inQuietHours(now = new Date()) {
    if (!prefBool("notify.quiet", false)) return false;
    const from = prefs.get("notify.quietFrom", 22 * 60), to = prefs.get("notify.quietTo", 8 * 60);
    const m = now.getHours() * 60 + now.getMinutes();
    return from <= to ? m >= from && m < to : m >= from || m < to;
  }

  scheduleSessionReminder(session) {
    this.cancelSessionReminder(session.id);
    if (!this.enabled("invite")) return;
    const at = (session.scheduledAt ?? Date.now() + 2 * 3600e3) - LEAD_MS;
    const delay = Math.max(1500, at - Date.now());
    if (delay > 12 * 3600e3) return; // beyond this page's lifetime — the Hub owns durable pushes
    const id = setTimeout(() => { this.timers.delete(session.id); this.fire(session); }, delay);
    this.timers.set(session.id, id);
  }

  cancelSessionReminder(id) { const t = this.timers.get(id); if (t) clearTimeout(t); this.timers.delete(id); }

  fire(session) {
    if (this.inQuietHours()) return;
    const title = `${session.title} starts soon`;
    const body = `${session.when} · ${session.people.join(", ")}`;
    nav.banner({ title, body, icon: "calendar.badge.plus", action: "Join", onAction: () => this.store?.joinCall() });
    if (this.permission === "granted" && document.visibilityState !== "visible") {
      try { const n = new Notification(title, { body, tag: `session-${session.id}` }); n.onclick = () => { window.focus(); this.store?.joinCall(); }; } catch { /* ignore */ }
    }
  }

  /** Generic fleet notification (approval / blocked / invite / shipped). */
  notify(kind, { title, body, onAction, action, icon, tint }) {
    if (!this.enabled(kind) || this.inQuietHours()) return;
    nav.banner({ title, body, icon, tint, action, onAction });
  }

  snapshot() { return { permission: this.permission, scheduled: this.timers.size, quiet: this.inQuietHours() }; }
}

export const notifications = new NotificationManager();
