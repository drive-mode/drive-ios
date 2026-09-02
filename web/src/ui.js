// The rendering runtime for the local web build: Preact + htm, vendored, no
// build step. Every view imports `html` and hooks from here — never from
// ../vendor directly — so the runtime has one entry point.
import { h, render, Fragment, createContext, createRef } from "../vendor/preact.mjs";
import {
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useReducer, useContext,
} from "../vendor/preact-hooks.mjs";
import htm from "../vendor/htm.mjs";

export { h, render, Fragment, createContext, createRef };
export { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useReducer, useContext };
export const html = htm.bind(h);

/** Join class names, skipping falsy values. */
export function cx(...parts) {
  return parts.flat().filter(Boolean).join(" ");
}

/** Re-render the calling component at `hz` ticks per second (0 = never). */
export function useTick(hz = 4, active = true) {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!active || !hz) return undefined;
    const id = setInterval(force, 1000 / hz);
    return () => clearInterval(id);
  }, [hz, active]);
}

/** Re-render on every animation frame while `active` (Spotlight rail, waveform). */
export function useFrame(active = true) {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!active) return undefined;
    let id = 0;
    const loop = () => { force(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** Subscribe a component to an `Observable` (store, nav) — re-renders on emit. */
export function useObservable(observable) {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => observable.subscribe(force), [observable]);
  return observable;
}

/** Minimal observable: `subscribe(fn) -> unsubscribe`, `emit()`. Emits are batched per microtask. */
export class Observable {
  constructor() { this._subs = new Set(); this._scheduled = false; }
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  emit() {
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      for (const fn of [...this._subs]) fn();
    });
  }
}

/** True when the system or the in-app toggle asks for reduced motion. */
export function reducedMotion() {
  const attr = document.documentElement.dataset.reduceMotion;
  if (attr === "1") return true;
  if (attr === "0") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Light haptic stand-in (Vibration API where it exists; silent elsewhere). */
export function haptic(kind = "light") {
  try {
    if (reducedMotion()) return;
    const ms = { light: 8, medium: 14, heavy: 22, success: [10, 40, 10], error: [30, 40, 30] }[kind] ?? 8;
    navigator.vibrate?.(ms);
  } catch { /* unsupported */ }
}

/** Press-and-hold: calls `onLong` after `ms` without movement; returns handlers to spread. */
export function useLongPress(onLong, { ms = 420, onClick } = {}) {
  const ref = useRef({ timer: 0, fired: false, x: 0, y: 0 });
  const start = (e) => {
    const p = e.touches?.[0] ?? e;
    ref.current = { timer: 0, fired: false, x: p.clientX, y: p.clientY };
    ref.current.timer = setTimeout(() => {
      ref.current.fired = true;
      haptic("medium");
      onLong?.(e, { x: p.clientX, y: p.clientY });
    }, ms);
  };
  const cancel = () => { clearTimeout(ref.current.timer); };
  const move = (e) => {
    const p = e.touches?.[0] ?? e;
    if (Math.hypot(p.clientX - ref.current.x, p.clientY - ref.current.y) > 8) cancel();
  };
  const click = (e) => {
    if (ref.current.fired) { e.preventDefault(); e.stopPropagation(); ref.current.fired = false; return; }
    onClick?.(e);
  };
  return {
    onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel, onPointerMove: move,
    onClick: click,
    onContextMenu: (e) => { e.preventDefault(); if (!ref.current.fired) { cancel(); onLong?.(e, { x: e.clientX, y: e.clientY }); } },
  };
}

/** Horizontal swipe recogniser on a container: `onSwipe(dir)` with dir = -1 (left) / +1 (right). */
export function useSwipe(onSwipe, { min = 60, edgeGuard = 28, ratio = 2 } = {}) {
  const from = useRef(null);
  return {
    onPointerDown: (e) => { from.current = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e) => {
      const f = from.current; from.current = null;
      if (!f) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y;
      if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * ratio || f.x < edgeGuard) return;
      onSwipe(dx < 0 ? -1 : 1);
    },
    onPointerCancel: () => { from.current = null; },
  };
}

/** Local `useState` that survives a re-mount by keying on sessionStorage. */
export function useSessionState(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = sessionStorage.getItem("drive.ui." + key); return raw == null ? initial : JSON.parse(raw); } catch { return initial; }
  });
  const set = useCallback((next) => {
    setV((prev) => {
      const val = typeof next === "function" ? next(prev) : next;
      try { sessionStorage.setItem("drive.ui." + key, JSON.stringify(val)); } catch { /* quota */ }
      return val;
    });
  }, [key]);
  return [v, set];
}

let uidCounter = 0;
export const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
