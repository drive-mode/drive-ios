// InboxView.swift — the fleet's asks and the product's news in one managed
// stream. Swipe to read/unread (leading, full swipe commits), archive/delete
// (trailing); hold for the same actions as a menu; act on approvals inline;
// filter by voice. Mail habits, Drive verbs.
import { html, useState, useEffect, useRef, useObservable, haptic, clamp } from "../../ui.js";
import { Screen, Segmented, Icon, Button, showMenu } from "../../components.js";
import { INBOX_META } from "../../models.js";
import { ctx, TabBarSpacer } from "./shared.js";

const FILTERS = ["All", "For you", "Product", "Archived"];
const LEAD_W = 88, TRAIL_W = 160, FULL = 150;

export function InboxView() {
  const s = useObservable(ctx.store);
  const nav = ctx.nav;
  const [filter, setFilter] = useState("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState(null);

  const items = s.inbox.filter((item) => {
    if (filter === "Archived") return item.archived;
    if (item.archived) return false;
    if (unreadOnly && item.read) return false;
    const product = INBOX_META[item.kind]?.product ?? false;
    if (filter === "For you") return !product;
    if (filter === "Product") return product;
    return true;
  });
  const unread = s.unreadInboxCount;

  return html`<${Screen} title="Inbox" back contentClass="hm-content"
    trailing=${unread > 0 ? html`<${Button} variant="ghost" size="sm" onClick=${() => s.markAllInboxRead()} aria-label="Mark all read">Read all</${Button}>` : null}>
    <div data-surface="inbox" style=${{ margin: "0 -20px" }}>
      <div class="ib-filters">
        <${Segmented} options=${FILTERS} value=${filter} onChange=${(v) => { setFilter(v); setOpenId(null); }} label="Inbox voice" />
        <div class="ib-meta">
          <span class="t-sm muted" aria-live="polite">${unread === 0 ? "All caught up" : `${unread} unread`}</span>
          <button class=${unreadOnly ? "ib-unread on pressable" : "ib-unread pressable"} aria-pressed=${unreadOnly} onClick=${() => { haptic("light"); setUnreadOnly(!unreadOnly); }}>
            <i class="dot" aria-hidden="true" />Unread
          </button>
        </div>
      </div>
      ${items.length === 0 ? html`<div class="ib-empty fade-in" role="status">
        <${Icon} name="tray" size=${30} weight=${1.4} color="var(--ink-35)" />
        <div class="t-md w7">${filter === "Archived" ? "Nothing archived" : unreadOnly ? "No unread items" : "Inbox zero — nicely done"}</div>
        <div class="t-sm muted">Asks, invitations, ships, and product news land here.</div>
      </div>` : html`<div class="ib-list" role="list" aria-label=${`Inbox, ${filter}`} style=${{ padding: "8px 20px 0" }}>
        ${items.map((item) => html`<${InboxRow} key=${item.id} item=${item} store=${s} nav=${nav} open=${openId === item.id} onOpen=${setOpenId} />`)}
      </div>`}
    </div>
    <${TabBarSpacer} />
  </${Screen}>`;
}

function InboxRow({ item, store, nav, open, onOpen }) {
  const meta = INBOX_META[item.kind] ?? INBOX_META.tip;
  const interrupt = item.interruptId ? store.interrupts.find((i) => i.id === item.interruptId) ?? null : null;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef({ active: false, id: 0, x: 0, y: 0, from: 0, horizontal: null, dx: 0, suppress: false, timer: 0 });

  // One open row at a time — the list closes the others.
  useEffect(() => { if (!open && dx !== 0) setDx(0); }, [open]);

  const snap = (to) => { setDx(to); g.current.dx = to; onOpen(to === 0 ? null : item.id); };
  const toggleRead = () => store.markInbox(item.id, !item.read);
  const archive = () => store.archiveInbox(item.id, !item.archived);
  const remove = () => store.deleteInbox(item.id);
  const readLabel = item.read ? "Mark unread" : "Mark read";
  const archiveLabel = item.archived ? "Restore" : "Archive";

  const menu = (e, pt) => {
    snap(0);
    showMenu(pt ? { clientX: pt.x, clientY: pt.y } : e, [
      { label: readLabel, icon: item.read ? "envelope.badge" : "envelope.open", onSelect: toggleRead },
      { label: archiveLabel, icon: item.archived ? "tray.and.arrow.up" : "archivebox", onSelect: archive },
      { label: "Delete", icon: "trash", danger: true, onSelect: remove },
    ], { title: item.title });
  };

  const cancelHold = () => { clearTimeout(g.current.timer); g.current.timer = 0; };
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const r = g.current;
    r.active = true; r.id = e.pointerId; r.x = e.clientX; r.y = e.clientY; r.from = dx; r.horizontal = null; r.suppress = false;
    cancelHold();
    r.timer = setTimeout(() => { if (r.active && r.horizontal === null) { r.active = false; r.suppress = true; haptic("medium"); menu(e, { x: r.x, y: r.y }); } }, 460);
  };
  const onMove = (e) => {
    const r = g.current;
    if (!r.active) return;
    const mx = e.clientX - r.x, my = e.clientY - r.y;
    if (r.horizontal === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      cancelHold();
      r.horizontal = Math.abs(mx) > Math.abs(my);
      if (!r.horizontal) { r.active = false; return; }
      try { e.currentTarget.setPointerCapture(r.id); } catch { /* synthetic or stale pointer */ }
      setDragging(true);
    }
    const next = clamp(r.from + mx, -TRAIL_W, FULL + 60);
    r.dx = next; r.suppress = true;
    setDx(next);
  };
  const onUp = () => {
    const r = g.current;
    cancelHold();
    if (!r.active) return;
    r.active = false;
    setDragging(false);
    if (r.horizontal !== true) return;
    const d = r.dx;
    if (d > FULL) { haptic("success"); toggleRead(); snap(0); }
    else if (d > LEAD_W / 2) snap(LEAD_W);
    else if (d < -TRAIL_W / 2) snap(-TRAIL_W);
    else snap(0);
  };
  const onClick = () => {
    const r = g.current;
    if (r.suppress) { r.suppress = false; return; }
    if (dx !== 0) { snap(0); return; }
    haptic("light");
    toggleRead();
  };
  const stop = (fn) => (e) => { e.stopPropagation(); haptic("light"); fn(); };
  const actionsOpen = dx !== 0;

  return html`<div class="ib-swipe" role="listitem">
    ${actionsOpen ? html`<div class=${dx > 0 ? "ib-actions lead" : "ib-actions trail"}>
      ${dx > 0
        ? html`<button class="ib-act read" onClick=${stop(() => { toggleRead(); snap(0); })} aria-label=${readLabel}>
            <${Icon} name=${item.read ? "envelope.badge" : "envelope.open"} size=${18} weight=${2.2} /><span>${item.read ? "Unread" : "Read"}</span></button>`
        : html`<button class="ib-act archive" onClick=${stop(() => { archive(); snap(0); })} aria-label=${archiveLabel}>
            <${Icon} name=${item.archived ? "tray.and.arrow.up" : "archivebox"} size=${18} weight=${2.2} /><span>${archiveLabel}</span></button>
          <button class="ib-act delete" onClick=${stop(() => { remove(); })} aria-label="Delete">
            <${Icon} name="trash" size=${18} weight=${2.2} /><span>Delete</span></button>`}
    </div>` : null}
    <div class=${["ib-row", item.read ? "read" : "unread", dragging && "dragging"].filter(Boolean).join(" ")} style=${{ "--tint": meta.tint, transform: dx ? `translateX(${dx}px)` : undefined }}
      role="button" tabIndex="0" aria-label=${`${item.read ? "" : "Unread. "}${item.title}. ${item.body}`} aria-description="Tap to toggle read. Swipe for archive and delete."
      onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} onClick=${onClick}
      onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRead(); } if (e.key === "Delete" || e.key === "Backspace") remove(); }}
      onContextMenu=${(e) => { e.preventDefault(); cancelHold(); g.current.active = false; menu(e); }}>
      <div class="ib-head">
        <span class="ib-kind" aria-hidden="true"><${Icon} name=${meta.symbol} size=${15} weight=${2.4} />${item.read ? null : html`<i class="dot" />`}</span>
        <div class="ib-body">
          <div class=${item.read ? "ib-title" : "ib-title unread"}>
            <span class="t truncate">${item.title}</span>
            <span class="mono faint" style=${{ fontSize: 10 }}>${item.age}</span>
          </div>
          <div class="ib-text">${item.body}</div>
        </div>
      </div>
      ${interrupt && !interrupt.resolved ? html`<div class="ib-acts">
        ${interrupt.kind === "approval" ? html`
          <button class="ib-btn plain pressable" onClick=${stop(() => { store.denyEdit(); store.markInbox(item.id, true); })}>Deny</button>
          <button class="ib-btn solid pressable" onClick=${stop(() => { store.allowEdit(); store.markInbox(item.id, true); })}>Allow</button>`
        : html`<button class="ib-btn solid pressable" onClick=${stop(() => { store.markInbox(item.id, true); nav.push("conversation", { interruptId: interrupt.id }); })}>
            <${Icon} name="arrowshape.turn.up.left" size=${12} weight=${2.6} />Reply to ${interrupt.agentName}</button>`}
      </div>` : item.kind === "invite" && !item.archived ? html`<div class="ib-acts">
        <button class="ib-btn solid pressable" onClick=${stop(() => { store.markInbox(item.id, true); store.joinCall(); })}>Join session</button>
        <button class="ib-btn plain pressable" onClick=${stop(() => store.archiveInbox(item.id))}>Later</button>
      </div>` : null}
    </div>
  </div>`;
}
