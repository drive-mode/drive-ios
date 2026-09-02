// Skill packages — a port of `Sources/SkillPackages.swift`: categories, the
// package pieces (files, review state), bundles (kits), and the catalog of
// built-in manifests. The Swift file carries no view, so the `packages`
// route here is the flat registry read (kits + every package) that the
// library folds into categories. Everything a package shows is capability
// and posture — never a prompt, tool list, provider or model id.
import { html, useState, useEffect, useRef, useObservable } from "../../ui.js";
import { nav, registerRoute } from "../../nav.js";
import { Screen, Icon, Eyebrow, Empty, Button, Card, AvatarChip, showMenu } from "../../components.js";
import { AGENT_SKILLS } from "./AgentSkills.js";
import { ensureAgentsCSS } from "./AgentsView.js";

let store = null;

// ------------------------------------------------------------ categories

/** SkillCategory — rawValue strings, exactly as the Swift enum encodes them. */
export const SkillCategory = {
  direction: "Direction & story",
  delivery: "Build & delivery",
  quality: "Quality & verification",
  knowledge: "Knowledge & research",
  collaboration: "People & collaboration",
};

/** `SkillCategory.allCases`, in declaration order, with their symbols. */
export const SKILL_CATEGORIES = [
  { id: "direction", label: SkillCategory.direction, symbol: "sparkles.tv" },
  { id: "delivery", label: SkillCategory.delivery, symbol: "shippingbox" },
  { id: "quality", label: SkillCategory.quality, symbol: "checkmark.diamond" },
  { id: "knowledge", label: SkillCategory.knowledge, symbol: "books.vertical" },
  { id: "collaboration", label: SkillCategory.collaboration, symbol: "person.2.wave.2" },
];

export const categorySymbol = (label) => SKILL_CATEGORIES.find((c) => c.label === label)?.symbol ?? "square.stack.3d.up";

// --------------------------------------------------------- package pieces

export const SkillReview = { draft: "Draft", reviewed: "Reviewed", needsWork: "Needs work" };

/** `SkillFile` — name, note, line count. The manifest is always `SKILL.md`. */
export const skillFile = (name, note, lines) => ({ name, note, lines });
export const isManifest = (file) => file.name === "SKILL.md";

/** `tintHex` is stored as a number (UInt32) so the JSON matches the Swift save. */
export const skillTint = (pkg) => `#${(pkg.tintHex >>> 0).toString(16).padStart(6, "0")}`;

export const reviewTint = (review) => (review === SkillReview.reviewed ? "var(--live)" : review === SkillReview.draft ? "var(--tint-amber)" : "var(--danger)");

// ------------------------------------------------------------- bundles

/** A bundle equips several skills in one move — set a kit up once, hand it to any agent. */
export const SkillBundle = {
  builtIns: [
    { id: "kit-director", name: "Director kit", note: "Runs the room: directs, plans, invites", skillIds: ["directing", "tasks", "inviting"], builtIn: true },
    { id: "kit-builder", name: "Builder kit", note: "Lands the work: edits, tasks, artifacts", skillIds: ["editing", "tasks", "artifacts"], builtIn: true },
    { id: "kit-quality", name: "Quality kit", note: "Proves the work: tests, research, reports", skillIds: ["testing", "research", "artifacts"], builtIn: true },
    { id: "kit-front", name: "Front-of-house kit", note: "Faces people: invites, triages feedback", skillIds: ["inviting", "feedback"], builtIn: true },
  ],
};

// ------------------------------------------------------------- catalog

const WHEN_TO_USE = {
  directing: "When humans are watching the session — every meaningful stretch of work deserves a beat someone can follow from a phone.",
  tasks: "Whenever work has shape: more than one step, a dependency, or anything a human might ask 'where is it?' about.",
  artifacts: "When work produces something worth keeping — a plan, a diff summary, a report, a replay. Purpose decides lifespan.",
  editing: "When the change is drafted and the diff summary is honest. Never lands without the approval gate.",
  testing: "Before claiming anything works, and after every landing. Green is evidence, not a mood.",
  research: "When a question blocks work — read first, ask the human only what reading can't answer.",
  inviting: "When a human would change the outcome — a decision, a review, a demo worth watching live.",
  feedback: "When a rough suggestion arrives — shape it into a proposal with a clear surface and a decidable ask.",
};

const INSTRUCTIONS = {
  directing: "Choreograph typed work events into beats: one idea per beat, 6–9 seconds, kind-tagged (plan, diagram, edit, run, tests, decision, result). Name related events so the stage can show the real work. Caption every beat — the audio thread must survive a skimmer. The wheel turns; the story stays upright.",
  tasks: "Create tasks with honest titles and real dependencies — the map draws what you declare. Advance state promptly (queued → running → review/blocked → done) and attach a summary to blocked states: the summary becomes the human's quoted ask.",
  artifacts: "Publish the durable outputs with a lifecycle: permanent for architecture and decisions, TTL for demos and captures. Title for a shelf, summarize for a card. Supersede rather than overwrite.",
  editing: "Propose diffs with a truthful +/− summary and the branch named. Wait for the gate. After landing, publish the diff artifact and hand the suite to testing. Never batch unrelated changes into one ask.",
  testing: "Run the suite that covers the change, report counts and timing, and file a report artifact when it matters. A red run is a finding, not a failure — report it the same way.",
  research: "Read code and docs before asking. When you must ask, ask one decidable question with the options named. Publish what you learned if it unblocks others.",
  inviting: "Invite, don't summon: name the session, say why now, respect quiet hours. One invitation per decision — chase-ups go through the inbox, not repeat invites.",
  feedback: "Turn raw suggestions into structured proposals: title, summary, surface, and — when one exists — the variant that lets a human feel it for a week. Keep the member's words; sharpen, don't replace.",
};

const FILES = {
  directing: [skillFile("SKILL.md", "Manifest — hook, when-to-use, beat grammar", 64), skillFile("beat-grammar.md", "Kinds, durations, caption voice", 118), skillFile("staging.md", "relatedEventIds — staging real work", 42)],
  tasks: [skillFile("SKILL.md", "Manifest — states, dependencies, summaries", 58), skillFile("states.md", "The five states and when they lie", 71), skillFile("dependency-style.md", "Deps the map can draw", 39)],
  artifacts: [skillFile("SKILL.md", "Manifest — lifecycle decides lifespan", 52), skillFile("lifecycle.md", "Permanent vs TTL, superseding", 66), skillFile("naming.md", "Titles for shelves, summaries for cards", 28)],
  editing: [skillFile("SKILL.md", "Manifest — the approval gate is the point", 61), skillFile("diff-honesty.md", "Truthful summaries, scoped asks", 54), skillFile("landing.md", "After the gate: artifact + suite handoff", 33)],
  testing: [skillFile("SKILL.md", "Manifest — green is evidence", 47), skillFile("reporting.md", "Counts, timing, red-run findings", 58)],
  research: [skillFile("SKILL.md", "Manifest — read before asking", 44), skillFile("asking.md", "One decidable question, options named", 36)],
  inviting: [skillFile("SKILL.md", "Manifest — invite, don't summon", 38), skillFile("timing.md", "Why-now, quiet hours, no chase-ups", 31)],
  feedback: [skillFile("SKILL.md", "Manifest — sharpen, don't replace", 41), skillFile("proposal-shape.md", "Title, summary, surface, variant", 45)],
};

const TINT_HEX = { directing: 0x9F58FA, tasks: 0x5B8DEF, artifacts: 0xFFC55C, editing: 0x4ADE80, testing: 0xA3E635, research: 0x2DD4BF, inviting: 0xB98AFF, feedback: 0xF472B6 };

let builtInsCache = null;

/** The catalog: the eight built-in packages with full manifests, plus the scaffold and the improver. */
export const SkillCatalog = {
  /** Lazy so the AgentSkills ↔ SkillPackages import cycle never reads an uninitialised binding. */
  get builtIns() {
    if (!builtInsCache) {
      builtInsCache = AGENT_SKILLS.map((base) => ({
        id: base.id, name: base.name, verb: base.verb, category: SkillCatalog.category(base.id), symbol: base.symbol,
        tintHex: TINT_HEX[base.id], gated: base.gated, events: base.events,
        whenToUse: WHEN_TO_USE[base.id], instructions: INSTRUCTIONS[base.id],
        files: FILES[base.id].map((f) => ({ ...f })), version: 1, review: SkillReview.reviewed, builtIn: true,
      }));
    }
    return builtInsCache.map((p) => ({ ...p, files: p.files.map((f) => ({ ...f })) }));
  },

  category(skillId) {
    switch (skillId) {
      case "directing": return SkillCategory.direction;
      case "tasks": case "artifacts": case "editing": return SkillCategory.delivery;
      case "testing": return SkillCategory.quality;
      case "research": return SkillCategory.knowledge;
      case "inviting": case "feedback": return SkillCategory.collaboration;
      default: return SkillCategory.delivery;
    }
  },

  /** The custom-skill scaffold: category guessed from the description, a fresh tint, generic footprint until the host maps a real one. */
  draftCustom(name, description) {
    const folded = description.toLowerCase();
    const category = folded.includes("test") || folded.includes("verif") ? SkillCategory.quality
      : folded.includes("doc") || folded.includes("read") || folded.includes("learn") ? SkillCategory.knowledge
      : folded.includes("invit") || folded.includes("review") || folded.includes("people") ? SkillCategory.collaboration
      : folded.includes("demo") || folded.includes("beat") || folded.includes("story") ? SkillCategory.direction
      : SkillCategory.delivery;
    const palette = [0xE8A13C, 0x38BDF8, 0xFB7185, 0x34D399, 0xC084FC];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) & 0xFFFF;
    return {
      id: `custom-${Math.floor(Date.now() / 1000)}`, name, verb: description, category, symbol: "wand.and.stars",
      tintHex: palette[hash % palette.length], gated: false, events: "work.generic (host mapping pending)",
      whenToUse: "Draft — sharpen this with a review pass: when exactly should an agent reach for this?",
      instructions: description,
      files: [skillFile("SKILL.md", "Manifest — drafted from your description", 18), skillFile("reference.md", "Add the deeper how-to here", 0)],
      version: 1, review: SkillReview.draft, builtIn: false,
    };
  },

  /** "Generate a better one": a sharpened draft of an existing package. Rule-based in the preview — visible and honest. */
  improved(pkg) {
    const out = { ...pkg, files: pkg.files.map((f) => ({ ...f })), version: pkg.version + 1, review: SkillReview.draft };
    if (!out.whenToUse.startsWith("Reach for this")) out.whenToUse = `Reach for this ${out.whenToUse.charAt(0).toLowerCase()}${out.whenToUse.slice(1)}`;
    if (!out.instructions.includes("Checklist:")) out.instructions += "\n\nChecklist: name the outcome before starting · publish the smallest honest event · close the loop (report, artifact, or beat) · leave the next reader a hook.";
    if (!out.files.some((f) => f.name === "examples.md")) out.files.push(skillFile("examples.md", "Worked examples — generated, review before trusting", 52));
    return out;
  },
};

// --------------------------------------------------------------- seeding

/**
 * Seed the store slices at registration. Never-persisted slices start as
 * `null`; production fails closed to `[]`. Saved catalogs pick up built-ins
 * added after the save (the Swift `load()` forward-compat rule).
 */
export function seedSkillCatalog(s) {
  store = s;
  const preview = s.configuration.previewContentEnabled;
  if (s.skillPackages == null) s.setSkillPackages(preview ? SkillCatalog.builtIns : []);
  else if (preview) {
    const missing = SkillCatalog.builtIns.filter((p) => !s.skillPackages.some((x) => x.id === p.id));
    if (missing.length) s.setSkillPackages([...s.skillPackages, ...missing]);
  }
  if (s.skillBundles == null) s.setSkillBundles(preview ? SkillBundle.builtIns.map((b) => ({ ...b, skillIds: [...b.skillIds] })) : []);
  else if (preview) {
    const missing = SkillBundle.builtIns.filter((b) => !s.skillBundles.some((x) => x.id === b.id));
    if (missing.length) s.setSkillBundles([...s.skillBundles, ...missing.map((b) => ({ ...b, skillIds: [...b.skillIds] }))]);
  }
}

// ------------------------------------------------- long-list rendering

/**
 * 500-skill-friendly lists: render the first chunk, grow as a sentinel scrolls
 * into view. Cheap, DOM-light, and the scroll position never jumps.
 */
export function useIncremental(items, chunk = 40) {
  const total = items.length;
  const [limit, setLimit] = useState(chunk);
  const ref = useRef();
  useEffect(() => { setLimit(chunk); }, [total, chunk]);
  useEffect(() => {
    const el = ref.current;
    if (!el || limit >= total || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => Math.min(total, l + chunk));
    }, { rootMargin: "240px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total, chunk]);
  const visible = total > limit ? items.slice(0, limit) : items;
  const remaining = total - visible.length;
  const sentinel = remaining > 0
    ? html`<div ref=${ref} class="ag-sentinel"><button type="button" class="ag-linkbtn" onClick=${() => setLimit(total)} aria-label=${`Show all ${total}`}>${remaining} more · show all</button></div>`
    : null;
  return { visible, sentinel, remaining };
}

// ------------------------------------------------------ registry page

/** Kit card used by the registry and the library: name, note, skill marks, Equip menu. */
export function BundleCard({ bundle, wide = false }) {
  const s = useObservable(store);
  const equip = (e) => {
    const items = s.agents.length
      ? s.agents.map((a) => ({ label: `Equip on ${a.name}`, icon: "person.badge.plus", onSelect: () => { s.equipBundle(bundle, a.id); nav.toast(`${bundle.name} equipped on ${a.name}`, { icon: "checkmark.circle" }); } }))
      : [{ label: "No agents connected", disabled: true }];
    showMenu(e, items, { title: bundle.name });
  };
  return html`<div class=${wide ? "ag-kit-card wide" : "ag-kit-card"} role="group" aria-label=${`${bundle.name}: ${bundle.note}. ${bundle.skillIds.length} skills`}>
    <div class="hstack" style=${{ gap: 6 }}>
      <${Icon} name="square.on.square.badge.person.crop" size=${13} weight=${2.4} color="var(--violet-text)" />
      <span class="w8" style=${{ fontSize: 13 }}>${bundle.name}</span>
      ${!bundle.builtIn ? html`<span class="ag-microtag">CUSTOM</span>` : null}
    </div>
    <div class="ag-kit-note clamp2">${bundle.note}</div>
    <div class="hstack" style=${{ gap: 5 }}>
      ${bundle.skillIds.map((id) => { const p = s.package(id); return p ? html`<${Icon} key=${id} name=${p.symbol} size=${11} weight=${2.4} color=${skillTint(p)} label=${p.name} />` : null; })}
      <span class="grow" />
      <button type="button" class="ag-chipbtn pressable" onClick=${equip} aria-label=${`Equip ${bundle.name} on an agent`}>Equip</button>
    </div>
  </div>`;
}

/** The flat registry: every kit, then every package with its shape (files · version · review). */
export function PackagesView() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const packages = s.skillPackages ?? [];
  const bundles = s.skillBundles ?? [];
  const { visible, sentinel } = useIncremental(packages, 40);
  return html`<${Screen} title="Packages" back>
    <p class="ag-lede" style=${{ marginTop: 8 }}>Skills are folders, not paragraphs: a manifest whose hook loads up front, and files that load when the work makes them relevant. This is the registry as stored — kits first, then every package.</p>

    <div class="hstack" style=${{ marginTop: 18 }}>
      <${Eyebrow}>KITS · ${bundles.length}</${Eyebrow}>
      <span class="grow" />
      <button type="button" class="ag-linkbtn pressable" onClick=${() => nav.present("newBundle", {}, { detent: "large" })} aria-label="New kit"><${Icon} name="plus" size=${11} weight=${3} /> New kit</button>
    </div>
    ${bundles.length
      ? html`<div class="vstack" style=${{ gap: 8, marginTop: 8 }}>${bundles.map((b) => html`<${BundleCard} key=${b.id} bundle=${b} wide />`)}</div>`
      : html`<div class="ag-note" style=${{ marginTop: 8 }}>No kits yet — a kit equips several skills in one move.</div>`}

    <${Eyebrow} style=${{ marginTop: 20 }}>PACKAGES · ${packages.length}</${Eyebrow}>
    ${packages.length ? html`<${Card} pad=${false} style=${{ marginTop: 8 }}>
      ${visible.map((pkg, i) => html`<${PackageRow} key=${pkg.id} pkg=${pkg} first=${i === 0} />`)}
      ${sentinel}
    </${Card}>` : html`<${Empty} icon="square.stack.3d.up" title="No packages" body=${s.configuration.previewContentEnabled ? "Generate a skill from the library to start a catalog." : "The catalog syncs from the host once a writer is connected. Nothing is seeded in this build."} action=${s.configuration.previewContentEnabled ? "Generate a new skill" : null} onAction=${() => nav.present("newSkill", {}, { detent: "medium" })} />`}

    <p class="ag-foot">Packages carry capability and posture only. Prompts, tools, providers and model ids stay on the host.</p>
  </${Screen}>`;
}

function PackageRow({ pkg, first }) {
  const tint = skillTint(pkg);
  return html`<button type="button" class=${first ? "ag-pkg-row pressable" : "ag-pkg-row pressable sep"} onClick=${() => nav.push("skill", { skillId: pkg.id })}
    aria-label=${`${pkg.name}, ${pkg.category}, ${pkg.files.length} files, version ${pkg.version}, ${pkg.review}`}>
    <span class="ag-icobox on" style=${{ "--tint": tint }}><${Icon} name=${pkg.symbol} size=${14} weight=${2.4} /></span>
    <span class="row-body">
      <span class="hstack" style=${{ gap: 5 }}>
        <span class="w6" style=${{ fontSize: 14 }}>${pkg.name}</span>
        ${pkg.gated ? html`<${Icon} name="checkmark.seal" size=${11} weight=${2.4} color="var(--violet-text)" label="Approval-gated" />` : null}
        ${!pkg.builtIn ? html`<span class="ag-microtag">CUSTOM</span>` : null}
      </span>
      <span class="t-xs muted truncate" style=${{ display: "block", marginTop: 2 }}>${pkg.category} · ${pkg.files.length} files · v${pkg.version} · <span style=${{ color: reviewTint(pkg.review), fontWeight: 700 }}>${pkg.review}</span></span>
    </span>
    <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
  </button>`;
}

export function registerSkillPackagesRoutes() {
  registerRoute("packages", PackagesView);
}
