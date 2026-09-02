// UserDefaults for the browser: JSON values in localStorage under one prefix.
// Keys mirror the Swift app's (`appearance`, `reduceMotion`, `archive.autoFile`,
// `pinnedProjects`, `writerURL`, …) so the two builds document the same contract.
const PREFIX = "drive.";

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export const prefs = {
  has(key) {
    const s = storage();
    return !!s && s.getItem(PREFIX + key) != null;
  },
  get(key, fallback = null) {
    const s = storage();
    if (!s) return fallback;
    const raw = s.getItem(PREFIX + key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value) {
    const s = storage();
    if (!s) return;
    try {
      if (value === undefined || value === null) s.removeItem(PREFIX + key);
      else s.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* quota or private mode */ }
  },
  remove(key) { storage()?.removeItem(PREFIX + key); },
  /** Wipe everything the app stored (Settings → Reset local data). */
  clearAll() {
    const s = storage();
    if (!s) return;
    for (const k of Object.keys(s)) if (k.startsWith(PREFIX)) s.removeItem(k);
  },
  keys() {
    const s = storage();
    return s ? Object.keys(s).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)) : [];
  },
};

/** Convenience: boolean with a default when the key was never written. */
export const prefBool = (key, fallback) => (prefs.has(key) ? !!prefs.get(key) : fallback);
