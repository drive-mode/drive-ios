// Intent & preheat — a port of `Sources/IntentEngine.swift`.
// IntentRecorder: first-order Markov transitions + frequency/recency priors
// (7-day half-life) persisted in prefs; predicts the next surface so the
// preheater can warm it. Prediction only ever pre-warms — it never changes
// what the user sees. PreheatEngine: folded search index + LRU-8 map layouts.
import { prefs } from "./prefs.js";

const HALF_LIFE_MS = 7 * 86_400_000;

export class IntentRecorder {
  constructor() {
    const saved = prefs.get("intent.model.v1", null) ?? {};
    this.transitions = saved.transitions ?? {};
    this.visits = saved.visits ?? {};
    this.lastVisit = saved.lastVisit ?? {};
    this.lastDecay = saved.lastDecay ?? Date.now();
    this.current = "home";
    this.lastRecordAt = Date.now();
    this.burstUntil = 0;
    this.records = 0;
    this._persistTimer = 0;
    this.decayIfNeeded();
  }

  record(surface) {
    if (!surface) return;
    const from = this.current;
    if (from !== surface) {
      const row = (this.transitions[from] ??= {});
      row[surface] = (row[surface] ?? 0) + 1;
    }
    this.visits[surface] = (this.visits[surface] ?? 0) + 1;
    this.lastVisit[surface] = Date.now();
    this.current = surface;
    this.lastRecordAt = Date.now();
    this.records++;
    this.schedulePersist();
  }

  /** Top-k predicted next surfaces with normalized scores. */
  predict(k = 3, from = this.current) {
    const scores = {};
    const row = this.transitions[from] ?? {};
    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0) || 1;
    const visitTotal = Object.values(this.visits).reduce((a, b) => a + b, 0) || 1;
    const now = Date.now();
    const all = new Set([...Object.keys(row), ...Object.keys(this.visits)]);
    for (const s of all) {
      if (s === from) continue;
      const markov = (row[s] ?? 0) / rowTotal;
      const freq = (this.visits[s] ?? 0) / visitTotal;
      const age = now - (this.lastVisit[s] ?? 0);
      const recency = this.lastVisit[s] ? Math.pow(0.5, age / HALF_LIFE_MS) : 0;
      scores[s] = 0.6 * markov + 0.25 * freq + 0.15 * recency;
    }
    return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, k).map(([surface, score]) => ({ surface, score }));
  }

  decayIfNeeded() {
    const elapsed = Date.now() - this.lastDecay;
    if (elapsed < 86_400_000) return;
    const factor = Math.pow(0.5, elapsed / HALF_LIFE_MS);
    for (const k of Object.keys(this.visits)) this.visits[k] *= factor;
    for (const row of Object.values(this.transitions)) for (const k of Object.keys(row)) row[k] *= factor;
    this.lastDecay = Date.now();
  }

  schedulePersist() {
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this.persistNow(), 1500);
  }

  persistNow() {
    prefs.set("intent.model.v1", { transitions: this.transitions, visits: this.visits, lastVisit: this.lastVisit, lastDecay: this.lastDecay });
  }

  reset() {
    this.transitions = {}; this.visits = {}; this.lastVisit = {}; this.lastDecay = Date.now();
    prefs.remove("intent.model.v1");
  }

  /** Diagnostics for Settings → WIRE. */
  snapshot() {
    return {
      current: this.current,
      records: this.records,
      predictions: this.predict(3),
      knownSurfaces: Object.keys(this.visits).length,
      burst: Date.now() < this.burstUntil,
    };
  }
}

export class PreheatEngine {
  constructor() {
    this.searchIndex = [];
    this.layouts = new Map(); // projectId -> layout (LRU 8, insertion order)
    this.warmed = 0;
    this.hits = 0;
    this.misses = 0;
    this.layoutBuilder = null; // installed by the project-map view: (projectId, tasks) => layout
    window.addEventListener("drive:memory-warning", () => this.evictAll());
  }

  rebuildSearchIndex(tasks) {
    this.searchIndex = tasks.map((t) => ({ id: t.id, folded: `${t.title} ${t.room} ${t.agentName}`.toLowerCase() }));
  }

  /** Warm layouts for the projects the user is likely to open next. */
  warm(entries) {
    if (!this.layoutBuilder) return;
    for (const [projectId, tasks] of entries) {
      if (this.layouts.has(projectId)) continue;
      this.put(projectId, this.layoutBuilder(projectId, tasks));
      this.warmed++;
    }
  }

  /** Read-through cache: returns the layout, computing it on a miss. */
  layout(projectId, tasks, builder = this.layoutBuilder) {
    const hit = this.layouts.get(projectId);
    if (hit && hit.count === tasks.length) { this.hits++; this.layouts.delete(projectId); this.layouts.set(projectId, hit); return hit.layout; }
    this.misses++;
    const layout = builder ? builder(projectId, tasks) : null;
    if (layout) this.put(projectId, layout, tasks.length);
    return layout;
  }

  put(projectId, layout, count = null) {
    this.layouts.delete(projectId);
    this.layouts.set(projectId, { layout, count: count ?? layout?.count ?? 0 });
    while (this.layouts.size > 8) this.layouts.delete(this.layouts.keys().next().value);
  }

  evictAll() { this.layouts.clear(); }

  snapshot() {
    return { indexed: this.searchIndex.length, cachedLayouts: this.layouts.size, warmed: this.warmed, hits: this.hits, misses: this.misses };
  }
}
