// Agent skills — a port of `Sources/AgentSkills.swift`: the eight built-in
// capability cores, per-agent loadouts (persisted like `@AppStorage`), the
// store extension (equip · unequip · kits · observed use), the skills section
// on an agent's profile, the skill detail (read · edit · review · improve),
// the New skill / New kit sheets, and the categorized library.
//
// A skill is a typed capability with an approval posture. Its footprint on
// the wire is the whole story; prompts, tools, providers and model ids never
// appear here.
import { html, cx, useState, useMemo, useObservable, haptic } from "../../ui.js";
import { prefs } from "../../prefs.js";
import { nav, registerRoute } from "../../nav.js";
import { Screen, NavBar, Icon, Eyebrow, Empty, Button, Card, AvatarChip, TextField, showMenu } from "../../components.js";
import { SKILL_CATEGORIES, SkillCatalog, SkillReview, skillTint, reviewTint, isManifest, useIncremental, BundleCard } from "./SkillPackages.js";
import { ensureAgentsCSS } from "./AgentsView.js";

let store = null;

// -------------------------------------------- the built-in capability cores

/** `AgentSkill.allCases` — the catalog's spine; ids stay stable. */
export const AGENT_SKILLS = [
  { id: "directing", name: "Directing", verb: "Choreographs work into Presenter-stage beats a phone can digest", symbol: "sparkles.tv", events: "work.direction.beat", gated: false },
  { id: "tasks", name: "Task running", verb: "Creates and advances tasks, with the dependencies the map draws", symbol: "checklist", events: "work.task.created · state · progress", gated: false },
  { id: "artifacts", name: "Artifact publishing", verb: "Publishes plans, diffs, reports, and replays — with lifecycles", symbol: "shippingbox", events: "work.artifact.created · lifecycle", gated: false },
  { id: "editing", name: "Code editing", verb: "Proposes diffs and lands them once you allow it", symbol: "plus.forwardslash.minus", events: "work.edit → approval → land", gated: true },
  { id: "testing", name: "Test running", verb: "Runs suites and reports green, red, and how fast", symbol: "checkmark.diamond", events: "work.command · work.test", gated: true },
  { id: "research", name: "Research", verb: "Reads code and docs, answers the blocking questions", symbol: "magnifyingglass", events: "work.generic (read-only)", gated: false },
  { id: "inviting", name: "Inviting", verb: "Invites people into working sessions when it matters", symbol: "envelope.open", events: "control.invite", gated: false },
  { id: "feedback", name: "Feedback triage", verb: "Shapes rough suggestions into proposals worth deciding", symbol: "bubble.left.and.text.bubble.right", events: "feedback.suggestion (draft)", gated: false },
];
export const AgentSkill = Object.fromEntries(AGENT_SKILLS.map((s) => [s.id, s]));

// ------------------------------------------------------------- loadouts

/** Per-agent equipped sets, persisted on-device under `skills.<agentId>` as a comma-joined list (the Swift key + encoding). */
export const SkillLoadout = {
  defaults: {
    maya: ["directing", "tasks", "inviting", "research"],
    coder: ["editing", "tasks", "artifacts", "feedback"],
    scout: ["testing", "research", "artifacts", "tasks"],
    indexer: ["artifacts", "research"],
  },
  fallback(agentId) { return SkillLoadout.defaults[agentId] ?? ["tasks", "artifacts"]; },
  equipped(agentId) {
    const raw = prefs.get(`skills.${agentId}`, null);
    if (typeof raw !== "string") return [...SkillLoadout.fallback(agentId)];
    return raw.split(",").filter(Boolean);
  },
  setEquipped(ids, agentId) { prefs.set(`skills.${agentId}`, ids.join(",")); },
};

// -------------------------------------------------- AppStore extension

/** `extension AppStore` — installed on the prototype so views call `s.equippedSkills(id)` like the Swift ones. */
export function installSkillsStore(s) {
  store = s;
  const proto = Object.getPrototypeOf(s);
  Object.assign(proto, {
    /** The agent's loadout, resolved to packages (unknown ids drop out). */
    equippedSkills(agentId) { return SkillLoadout.equipped(agentId).map((id) => this.package(id)).filter(Boolean); },
    equippedIds(agentId) { return new Set(SkillLoadout.equipped(agentId)); },
    toggleSkill(skillId, agentId) {
      const current = SkillLoadout.equipped(agentId);
      const i = current.indexOf(skillId);
      if (i >= 0) current.splice(i, 1); else current.push(skillId);
      SkillLoadout.setEquipped(current, agentId);
      this.bumpSkills();
    },
    /** Select all / unselect all — the whole catalog in one move. */
    setAllSkills(agentId, on) {
      SkillLoadout.setEquipped(on ? (this.skillPackages ?? []).map((p) => p.id) : [], agentId);
      this.bumpSkills();
      haptic("light");
    },
    /** Equip a kit: union the bundle into the loadout (never removes). */
    equipBundle(bundle, agentId) {
      const current = SkillLoadout.equipped(agentId);
      for (const id of bundle.skillIds) if (!current.includes(id)) current.push(id);
      SkillLoadout.setEquipped(current, agentId);
      this.bumpSkills();
      haptic("success");
    },
    skillUse(agentId, skillId) { return this.wireSkillUse?.[agentId]?.[skillId] ?? 0; },
    /** Agents carrying a given skill. */
    carriers(skillId) { return this.agents.filter((a) => this.equippedIds(a.id).has(skillId)); },
  });
}

export const SkillSearch = {
  filtered(packages, query, category = null) {
    const folded = String(query ?? "").trim().toLowerCase();
    return (packages ?? []).filter((skill) => {
      if (category != null && skill.category !== category) return false;
      if (!folded) return true;
      return skill.name.toLowerCase().includes(folded) || skill.verb.toLowerCase().includes(folded)
        || skill.category.toLowerCase().includes(folded) || skill.whenToUse.toLowerCase().includes(folded);
    });
  },
};

// --------------------------------------------------------- roster chips

export function SkillChipRow({ skills }) {
  const names = skills.slice(0, 2).map((s) => s.name).join(", ");
  const text = skills.length === 0 ? "No skills" : `${skills.length} skills · ${names}${skills.length > 2 ? ` +${skills.length - 2}` : ""}`;
  return html`<span class="ag-skillchips truncate" aria-label=${`Skills: ${skills.map((s) => s.name).join(", ") || "none"}`}>${text}</span>`;
}

// --------------------------------------------------------- small pieces

const Sep = ({ inset = 52 }) => html`<div class="ag-sep" style=${{ marginLeft: inset }} role="presentation" />`;

/** The 30pt symbol box a skill wears: tinted when on, quiet when off. */
export function SkillIconBox({ pkg, on = true, size = 30 }) {
  return html`<span class=${cx("ag-icobox", on && "on")} style=${{ "--tint": skillTint(pkg), width: size, height: size }}><${Icon} name=${pkg.symbol} size=${Math.round(size * 0.45)} weight=${2.4} /></span>`;
}

/** The equip / pick indicator: an outlined circle, or a violet disc with a white check. */
export function CheckDot({ on }) {
  return html`<span class=${cx("ag-checkdot", on && "on")} aria-hidden="true">${on ? html`<${Icon} name="checkmark" size=${12} weight=${3.2} />` : null}</span>`;
}

function SearchEmpty({ query }) {
  return html`<${Empty} icon="magnifyingglass" title=${`No Results for “${query}”`} body="Check the spelling or try a new search." />`;
}

function CategoryHeader({ category, open, count, onClick, disclosureLocked, size = 42 }) {
  return html`<button type="button" class="ag-cat-head pressable" style=${{ minHeight: size }} onClick=${onClick} aria-expanded=${open} aria-label=${`${category.label}, ${count}`} disabled=${disclosureLocked}>
    <${Icon} name="chevron.right" size=${11} weight=${3} color="var(--ink-35)" className="ag-disclose" style=${{ transform: open ? "rotate(90deg)" : "none" }} />
    <${Icon} name=${category.symbol} size=${13} weight=${2.4} color="var(--violet-text)" />
    <span class="w7 grow truncate" style=${{ fontSize: 12.5, textAlign: "left" }}>${category.label}</span>
    <span class="mono w7 muted" style=${{ fontSize: 10.5 }}>${count}</span>
  </button>`;
}

// -------------------------------------- the skills section on a profile

/** Equip per skill, per kit, or all at once. Rows open the package; the toggle stays here. */
export function AgentSkillsSection({ agent }) {
  const s = useObservable(store);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const equipped = s.equippedIds(agent.id);
  const packages = s.skillPackages ?? [];
  const bundles = s.skillBundles ?? [];
  const fully = (b) => b.skillIds.every((id) => equipped.has(id));
  const toggleCategory = (label) => {
    if (query) return;
    setExpanded((prev) => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  };
  const anyMatch = SkillSearch.filtered(packages, query).length > 0;
  return html`<div class="vstack" style=${{ gap: 0 }}>
    <${TextField} value=${query} onInput=${setQuery} icon="magnifyingglass" placeholder=${`Search ${packages.length} skills`} label="Search skills" className="ag-search" />

    ${bundles.length ? html`<div class="ag-hscroll" style=${{ marginTop: 9 }} role="group" aria-label="Kits">
      ${bundles.map((b) => html`<button key=${b.id} type="button" class=${cx("ag-kitchip pressable", fully(b) && "done")} disabled=${fully(b)}
        onClick=${() => { s.equipBundle(b, agent.id); nav.toast(`${b.name} equipped`, { icon: "checkmark.circle" }); }} aria-label=${`Equip ${b.name}: ${b.note}`}>
        <${Icon} name="plus.square.on.square" size=${11} weight=${2.6} /><span>${b.name}</span>
      </button>`)}
    </div>` : null}

    <div class="vstack" style=${{ gap: 8, marginTop: 10 }}>
      ${SKILL_CATEGORIES.map((category) => {
        const matches = SkillSearch.filtered(packages, query, category.label);
        if (!matches.length) return null;
        const open = !!query || expanded.has(category.label);
        return html`<${Card} key=${category.id} pad=${false}>
          <${CategoryHeader} category=${category} open=${open} count=${`${matches.filter((m) => equipped.has(m.id)).length}/${matches.length}`} onClick=${() => toggleCategory(category.label)} disclosureLocked=${!!query} />
          ${open ? html`<${SkillRows} agent=${agent} skills=${matches} equipped=${equipped} />` : null}
        </${Card}>`;
      })}
    </div>
    ${!anyMatch ? html`<${SearchEmpty} query=${query} />` : null}
  </div>`;
}

function SkillRows({ agent, skills, equipped }) {
  const s = useObservable(store);
  const { visible, sentinel } = useIncremental(skills, 30);
  const live = s.wireStatus.live;
  return html`<div>
    ${visible.map((skill, i) => {
      const on = equipped.has(skill.id);
      const use = s.skillUse(agent.id, skill.id);
      return html`<div key=${skill.id}>
        ${i > 0 ? html`<${Sep} />` : null}
        <div class="ag-skill-row">
          <button type="button" class="ag-skill-main pressable" onClick=${() => nav.push("skill", { skillId: skill.id, agentId: agent.id })} aria-label=${`${skill.name}${skill.gated ? ", approval-gated" : ""}. ${skill.verb}. Opens the package`}>
            <${SkillIconBox} pkg=${skill} on=${on} />
            <span class="row-body">
              <span class="hstack" style=${{ gap: 5 }}>
                <span class="w6" style=${{ fontSize: 14, color: on ? "var(--ink)" : "var(--ink-55)" }}>${skill.name}</span>
                ${skill.gated ? html`<${Icon} name="checkmark.seal" size=${11} weight=${2.4} color="var(--violet-text)" label="Approval-gated" />` : null}
                ${live && on && use > 0 ? html`<span class="mono w7" style=${{ fontSize: 10, color: skillTint(skill) }}>×${use}</span>` : null}
              </span>
              <span class="clamp2 t-xs muted" style=${{ display: "block", marginTop: 2, fontSize: 10.5 }}>${skill.verb}</span>
            </span>
          </button>
          <button type="button" class="ag-check pressable" role="switch" aria-checked=${on} aria-label=${`${on ? "Unequip" : "Equip"} ${skill.name}`} onClick=${() => { haptic("light"); s.toggleSkill(skill.id, agent.id); }}>
            <${CheckDot} on=${on} />
          </button>
        </div>
      </div>`;
    })}
    ${sentinel}
  </div>`;
}

// ------------------------------------- skill detail: read · edit · review · improve

export function SkillDetailView({ params }) {
  ensureAgentsCSS();
  const s = useObservable(store);
  const skill = s.package(params.skillId);
  const [editing, setEditing] = useState(false);
  const [draftVerb, setDraftVerb] = useState("");
  const [draftWhen, setDraftWhen] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  if (!skill) return html`<${Screen} title="Skill" back><${Empty} icon="square.stack.3d.up" title="Skill not found" body="It may have been removed from the catalog." /></${Screen}>`;

  const toggleEdit = () => {
    if (editing) {
      s.updatePackage({ ...skill, verb: draftVerb, whenToUse: draftWhen, instructions: draftInstructions, review: SkillReview.draft }); // edits re-enter review
      nav.toast("Saved as a draft", { icon: "square.and.pencil" });
    } else { setDraftVerb(skill.verb); setDraftWhen(skill.whenToUse); setDraftInstructions(skill.instructions); }
    setEditing(!editing);
  };
  const setReview = (review) => s.updatePackage({ ...skill, review });
  const tint = skillTint(skill);
  const carriers = s.carriers(skill.id);
  // The log doesn't lie: agents seen exercising a skill they don't carry get surfaced — equip what the evidence proves.
  const observed = s.agents.filter((a) => s.skillUse(a.id, skill.id) > 0 && !s.equippedIds(a.id).has(skill.id));
  const live = s.wireStatus.live;
  const totalUse = s.agents.reduce((n, a) => n + s.skillUse(a.id, skill.id), 0);

  const editable = (text, draft, setDraft, minHeight) => editing
    ? html`<${Card} pad=${false} style=${{ marginTop: 7 }}><${TextField} value=${draft} onInput=${setDraft} multiline rows=${Math.max(3, Math.round(minHeight / 24))} clearable=${false} label="Edit text" className="ag-editor" /></${Card}>`
    : html`<${Card} style=${{ marginTop: 7, minHeight }}><p class="ag-body">${text}</p></${Card}>`;

  return html`<${Screen} title=${skill.name} back>
    <div class="hstack" style=${{ gap: 12, marginTop: 8 }}>
      <${SkillIconBox} pkg=${skill} on size=${40} />
      <div class="grow" style=${{ minWidth: 0 }}>
        <div class="hstack" style=${{ gap: 6 }}>
          <span class="w8 truncate" style=${{ fontSize: 17 }}>${skill.name}</span>
          ${skill.gated ? html`<${Icon} name="checkmark.seal" size=${12} weight=${2.4} color="var(--violet-text)" label="Approval-gated" />` : null}
        </div>
        <div class="hstack" style=${{ gap: 6, marginTop: 3 }}>
          <span class="chip pill" style=${{ fontSize: 10 }}>${skill.category}</span>
          <span class="mono faint" style=${{ fontSize: 10 }}>v${skill.version}${skill.builtIn ? "" : " · custom"}</span>
        </div>
      </div>
    </div>

    <div class="ag-events mono" style=${{ color: tint, marginTop: 12 }} aria-label=${`Publishes ${skill.events}`}>${skill.events}</div>
    <div class="hstack" style=${{ gap: 14, marginTop: 8 }}>
      <span class="hstack t-xs muted" style=${{ gap: 5 }}><${Icon} name=${skill.gated ? "checkmark.seal" : "circle.dashed"} size=${11} weight=${2.4} color=${skill.gated ? "var(--violet-text)" : "var(--ink-35)"} />${skill.gated ? "Acts only after you allow it" : "No gate — publishes on its own"}</span>
      <span class="hstack t-xs muted" style=${{ gap: 5 }}><${Icon} name="eye" size=${11} weight=${2.4} color="var(--ink-35)" />${live ? `Log saw it ×${totalUse}` : "Offline — no counts"}</span>
    </div>

    <div class="hstack" style=${{ marginTop: 18 }}>
      <${Eyebrow}>WHEN TO USE</${Eyebrow}>
      <span class="grow" />
      <button type="button" class="ag-linkbtn pressable" onClick=${toggleEdit} aria-label=${editing ? "Save edits" : "Edit when-to-use and instructions"}>${editing ? "Save" : "Edit"}</button>
    </div>
    ${editable(skill.whenToUse, draftWhen, setDraftWhen, 70)}

    <${Eyebrow} style=${{ marginTop: 18 }}>INSTRUCTIONS</${Eyebrow}>
    ${editable(skill.instructions, draftInstructions, setDraftInstructions, 130)}

    <div class="hstack" style=${{ marginTop: 18 }}>
      <${Eyebrow}>FILES · ${skill.files.length}</${Eyebrow}>
      <span class="grow" />
      <span class="ag-microtag">DYNAMIC CONTEXT DISCOVERY</span>
    </div>
    <${Card} pad=${false} style=${{ marginTop: 7 }}>
      ${skill.files.map((file, i) => html`<div key=${file.name}>
        ${i > 0 ? html`<${Sep} inset=${40} />` : null}
        <div class="ag-file-row" aria-label=${`${file.name}, ${file.note}, ${isManifest(file) ? "always loaded" : "loads on demand"}, ${file.lines} lines`}>
          <${Icon} name="doc.text" size=${14} weight=${isManifest(file) ? 2.6 : 1.8} color=${isManifest(file) ? tint : "var(--ink-35)"} style=${{ width: 22 }} />
          <span class="row-body">
            <span class="mono w7" style=${{ fontSize: 12.5, display: "block" }}>${file.name}</span>
            <span class="t-xs muted truncate" style=${{ display: "block", fontSize: 10.5 }}>${file.note}</span>
          </span>
          <span class="w7" style=${{ fontSize: 9, color: isManifest(file) ? "var(--live)" : "var(--ink-35)" }}>${isManifest(file) ? "always" : "on demand"}</span>
          <span class="mono faint" style=${{ fontSize: 10 }}>${file.lines}L</span>
        </div>
      </div>`)}
    </${Card}>
    <p class="ag-note" style=${{ marginTop: 7 }}>The manifest's hook loads up front; deeper files load only when the work makes them relevant. Skills are folders, not paragraphs.</p>

    <${Eyebrow} style=${{ marginTop: 18 }}>REVIEW</${Eyebrow}>
    <${Card} style=${{ marginTop: 7, padding: 12 }}>
      <div class="hstack" style=${{ gap: 8 }}>
        <span class="ag-review" style=${{ "--tint": reviewTint(skill.review) }}>${skill.review}</span>
        <span class="grow" />
        <button type="button" class="ag-linkbtn pressable" disabled=${skill.review === SkillReview.reviewed} style=${{ color: skill.review === SkillReview.reviewed ? "var(--ink-35)" : "var(--live)", fontSize: 12 }} onClick=${() => setReview(SkillReview.reviewed)}>Mark reviewed</button>
        <button type="button" class="ag-linkbtn pressable" disabled=${skill.review === SkillReview.needsWork} style=${{ color: skill.review === SkillReview.needsWork ? "var(--ink-35)" : "var(--danger)", fontSize: 12 }} onClick=${() => setReview(SkillReview.needsWork)}>Needs work</button>
      </div>
      <button type="button" class="ag-improve pressable" onClick=${() => nav.present("improveSkill", { skillId: skill.id }, { detent: "large" })} aria-label=${`Generate a better ${skill.name} with Cline`}>
        <${AvatarChip} name="Cline" color="var(--coder)" size=${22} />
        <span class="grow w7" style=${{ fontSize: 13, color: "var(--violet-text)", textAlign: "left" }}>Generate a better one with Cline</span>
        <${Icon} name="wand.and.stars" size=${13} weight=${2.2} color="var(--violet-text)" />
      </button>
    </${Card}>

    <${Eyebrow} style=${{ marginTop: 18 }}>EQUIPPED BY</${Eyebrow}>
    <div class="vstack" style=${{ gap: 8, marginTop: 7 }}>
      <div class="hstack" style=${{ gap: 7, flexWrap: "wrap" }}>
        ${carriers.length === 0 ? html`<span class="t-sm muted">No one yet — equip it from any agent's profile.</span>` : null}
        ${carriers.map((a) => html`<button key=${a.id} type="button" class="ag-carrier pressable" onClick=${() => nav.push("agent", { agentId: a.id })} aria-label=${`${a.name} carries ${skill.name}. Opens ${a.name}`}>
          <${AvatarChip} name=${a.name} color=${a.color} size=${18} />
          <span class="w7" style=${{ fontSize: 11, color: "var(--ink-78)" }}>${a.name}</span>
          ${live && s.skillUse(a.id, skill.id) > 0 ? html`<span class="mono w7" style=${{ fontSize: 9.5, color: tint }}>×${s.skillUse(a.id, skill.id)}</span>` : null}
        </button>`)}
      </div>
      ${observed.map((a) => html`<button key=${a.id} type="button" class="ag-observed pressable" style=${{ "--tint": tint }} onClick=${() => s.toggleSkill(skill.id, a.id)}
        aria-label=${`${a.name} used ${skill.name} ${s.skillUse(a.id, skill.id)} times without carrying it. Equip it.`}>
        <${Icon} name="eye" size=${11} weight=${2.4} color=${tint} />
        <span class="grow w6" style=${{ fontSize: 11, color: "var(--ink-78)", textAlign: "left" }}>The log saw ${a.name} do this ×${s.skillUse(a.id, skill.id)} — unequipped</span>
        <span class="ag-chipbtn">Equip</span>
      </button>`)}
    </div>
    ${params.agentId && s.agents.some((a) => a.id === params.agentId) ? html`<${Card} style=${{ marginTop: 12, padding: "10px 12px" }}>
      <div class="hstack">
        <span class="t-sm muted grow">On ${s.displayNameForAgent(params.agentId)}: ${s.equippedIds(params.agentId).has(skill.id) ? "equipped" : "not equipped"}</span>
        <${Button} size="xs" variant=${s.equippedIds(params.agentId).has(skill.id) ? "secondary" : "primary"} onClick=${() => s.toggleSkill(skill.id, params.agentId)}>${s.equippedIds(params.agentId).has(skill.id) ? "Unequip" : "Equip"}</${Button}>
      </div>
    </${Card}>` : null}
  </${Screen}>`;
}

// ---------------------------------------------------------------- sheets

/** Sheet chrome: nav bar + its own scroll, so medium detents size to content. */
function SheetFrame({ title, children, footer, onCancel }) {
  return html`<div class="ag-sheet">
    <${NavBar} title=${title} leading=${onCancel ? html`<button type="button" class="back-btn pressable" style=${{ padding: "6px 8px" }} onClick=${onCancel} aria-label="Cancel">Cancel</button>` : null} />
    <div class="scroll"><div class="content no-tabbar">${children}</div></div>
    ${footer ? html`<div class="ag-sheet-foot">${footer}</div>` : null}
  </div>`;
}

/** Cline's sharpened draft — accept to bump the version, discard to keep what you have. Drafts re-enter review. */
export function ImproveSkillSheet({ params }) {
  ensureAgentsCSS();
  const s = useObservable(store);
  const original = s.package(params.skillId);
  const improved = useMemo(() => (original ? SkillCatalog.improved(original) : null), [original]);
  if (!original) return html`<${SheetFrame} title="Improve" onCancel=${() => nav.dismiss()}><${Empty} title="Skill not found" /></${SheetFrame}>`;
  const added = improved.files.length > original.files.length ? improved.files[improved.files.length - 1] : null;
  return html`<${SheetFrame} title=${`Improve ${original.name}`} onCancel=${() => nav.dismiss()}>
    <div class="hstack" style=${{ gap: 9, marginTop: 8, alignItems: "flex-start" }}>
      <${AvatarChip} name="Cline" color="var(--coder)" size=${26} />
      <p class="ag-lede">Cline sharpened ${original.name} — v${original.version} → v${improved.version}. Review the changes; accepting re-enters review as a draft.</p>
    </div>
    <${Eyebrow} style=${{ marginTop: 16 }}>WHEN TO USE — REVISED</${Eyebrow}>
    <${Card} style=${{ marginTop: 7 }}><p class="ag-body" style=${{ color: "var(--ink)" }}>${improved.whenToUse}</p></${Card}>
    <${Eyebrow} style=${{ marginTop: 16 }}>INSTRUCTIONS — REVISED</${Eyebrow}>
    <${Card} style=${{ marginTop: 7 }}><p class="ag-body" style=${{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>${improved.instructions}</p></${Card}>
    ${added ? html`<div class="hstack t-sm" style=${{ gap: 7, marginTop: 12, color: "var(--ink-78)" }}><${Icon} name="doc.badge.plus" size=${13} weight=${2.2} color="var(--live)" /><span>Adds ${added.name} — ${added.note}</span></div>` : null}
    <div class="grid2" style=${{ marginTop: 20 }}>
      <${Button} fill onClick=${() => nav.dismiss()} style=${{ color: "var(--ink-55)", minHeight: 44 }}>Discard</${Button}>
      <${Button} fill variant="gradient" style=${{ minHeight: 44 }} onClick=${() => { s.updatePackage(improved); haptic("success"); nav.dismiss(); nav.toast(`${improved.name} v${improved.version} drafted`, { icon: "wand.and.stars" }); }}>Accept draft</${Button}>
    </div>
  </${SheetFrame}>`;
}

export function NewSkillSheet() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const [name, setName] = useState("");
  const [what, setWhat] = useState("");
  const ready = name.trim() && what.trim();
  const create = () => {
    if (!ready) return;
    const pkg = SkillCatalog.draftCustom(name.trim(), what.trim());
    s.addPackage(pkg);
    haptic("success");
    nav.dismiss();
    nav.toast(`${pkg.name} filed as a draft`, { icon: "wand.and.stars" });
  };
  return html`<${SheetFrame} title="New skill" onCancel=${() => nav.dismiss()}>
    <p class="ag-lede" style=${{ marginTop: 8 }}>Name the capability and say what it does — Cline scaffolds the package (manifest + reference file), guesses a category, and files it as a draft for review.</p>
    <${TextField} value=${name} onInput=${setName} placeholder="Skill name (e.g. Release notes)" label="Skill name" autoFocus style=${{ marginTop: 16, fontWeight: 600 }} />
    <${TextField} value=${what} onInput=${setWhat} placeholder="What should it do?" label="What should it do?" multiline rows=${3} onSubmit=${create} style=${{ marginTop: 9 }} />
    <${Button} fill variant="gradient" disabled=${!ready} onClick=${create} style=${{ marginTop: 16, minHeight: 46 }}>Create draft skill</${Button}>
    <p class="ag-note faint" style=${{ marginTop: 10 }}>Custom skills publish work.generic until the host maps a real footprint — the honest default.</p>
  </${SheetFrame}>`;
}

export function NewBundleSheet() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const packages = s.skillPackages ?? [];
  const { visible, sentinel } = useIncremental(packages, 40);
  const toggle = (id) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ready = name.trim() && picked.size > 0;
  const create = () => {
    if (!ready) return;
    s.addBundle(name.trim(), note.trim(), [...picked]);
    haptic("success");
    nav.dismiss();
    nav.toast(`${name.trim()} kit created`, { icon: "square.on.square.badge.person.crop" });
  };
  return html`<${SheetFrame} title="New kit" onCancel=${() => nav.dismiss()}
    footer=${html`<${Button} fill variant="gradient" disabled=${!ready} onClick=${create} style=${{ minHeight: 46 }}>Create kit${picked.size ? ` · ${picked.size}` : ""}</${Button}>`}>
    <${TextField} value=${name} onInput=${setName} placeholder="Kit name (e.g. Demo-day kit)" label="Kit name" autoFocus style=${{ marginTop: 8, fontWeight: 600 }} />
    <${TextField} value=${note} onInput=${setNote} placeholder="One line on when to hand this out" label="When to hand this out" style=${{ marginTop: 9 }} />
    <${Eyebrow} style=${{ marginTop: 16 }}>PICK SKILLS · ${picked.size}</${Eyebrow}>
    ${packages.length ? html`<${Card} pad=${false} style=${{ marginTop: 7 }}>
      ${visible.map((skill, i) => { const on = picked.has(skill.id); return html`<div key=${skill.id}>
        ${i > 0 ? html`<${Sep} inset=${44} />` : null}
        <button type="button" class="ag-pick-row pressable" role="checkbox" aria-checked=${on} aria-label=${`${skill.name}`} onClick=${() => toggle(skill.id)}>
          <${CheckDot} on=${on} />
          <${Icon} name=${skill.symbol} size=${13} weight=${2.4} color=${skillTint(skill)} />
          <span class="w6 grow truncate" style=${{ fontSize: 13.5, textAlign: "left" }}>${skill.name}</span>
        </button>
      </div>`; })}
      ${sentinel}
    </${Card}>` : html`<div class="ag-note" style=${{ marginTop: 8 }}>No skills in the catalog yet — generate one from the library first.</div>`}
  </${SheetFrame}>`;
}

// ------------------------------------------------- the skill library

export function SkillsLibraryView() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const packages = s.skillPackages ?? [];
  const bundles = s.skillBundles ?? [];
  const toggleCategory = (label) => {
    if (query) return;
    setExpanded((prev) => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  };
  const anyMatch = SkillSearch.filtered(packages, query).length > 0;
  return html`<${Screen} title="Skills" back trailing=${html`<button type="button" class="ag-linkbtn pressable" onClick=${() => nav.push("packages")} aria-label="Open the package registry">Registry</button>`}>
    <p class="ag-lede" style=${{ marginTop: 8 }}>A skill is a typed capability with an approval posture, packaged as files — the hook loads up front, the rest on demand. Equip singly, by kit, or all at once from any agent's profile.</p>
    <${TextField} value=${query} onInput=${setQuery} icon="magnifyingglass" placeholder=${`Search ${packages.length} skills`} label="Search skills" style=${{ marginTop: 14 }} />

    <div class="hstack" style=${{ marginTop: 18 }}>
      <${Eyebrow}>KITS</${Eyebrow}>
      <span class="grow" />
      <button type="button" class="ag-linkbtn pressable" onClick=${() => nav.present("newBundle", {}, { detent: "large" })} aria-label="New kit"><${Icon} name="plus" size=${11} weight=${3} /> New kit</button>
    </div>
    ${bundles.length ? html`<div class="ag-hscroll" style=${{ marginTop: 8 }} role="group" aria-label="Kits">${bundles.map((b) => html`<${BundleCard} key=${b.id} bundle=${b} />`)}</div>`
      : html`<div class="ag-note" style=${{ marginTop: 8 }}>No kits yet — a kit equips several skills in one move.</div>`}

    ${SKILL_CATEGORIES.map((category) => {
      const inCategory = SkillSearch.filtered(packages, query, category.label);
      if (!inCategory.length) return null;
      const open = !!query || expanded.has(category.label);
      return html`<${Card} key=${category.id} pad=${false} style=${{ marginTop: 10 }}>
        <${CategoryHeader} category=${category} open=${open} count=${inCategory.length} onClick=${() => toggleCategory(category.label)} disclosureLocked=${!!query} size=${44} />
        ${open ? html`<${LibraryRows} skills=${inCategory} />` : null}
      </${Card}>`;
    })}
    ${!anyMatch ? (packages.length ? html`<${SearchEmpty} query=${query} />` : html`<${Empty} icon="square.stack.3d.up" title="No skills yet" body=${s.configuration.previewContentEnabled ? "The catalog is empty. Generate a skill to start one." : "The catalog syncs from the host once a writer is connected. Nothing is seeded in this build."} />`) : null}

    <button type="button" class="ag-wide-violet pressable" style=${{ marginTop: 22 }} onClick=${() => nav.present("newSkill", {}, { detent: "medium" })}>
      <${Icon} name="wand.and.stars" size=${15} weight=${2.4} /><span>Generate a new skill with Cline</span>
    </button>
    <p class="ag-foot">Usage counts are observed from the durable log — never self-reported. Prompts, tools, and models never cross; skills carry capability and posture only.</p>
  </${Screen}>`;
}

function LibraryRows({ skills }) {
  const s = useObservable(store);
  const { visible, sentinel } = useIncremental(skills, 30);
  return html`<div>
    ${visible.map((skill, i) => {
      const carriers = s.carriers(skill.id);
      return html`<div key=${skill.id}>
        ${i > 0 ? html`<${Sep} />` : null}
        <button type="button" class="ag-lib-row pressable" onClick=${() => nav.push("skill", { skillId: skill.id })}
          aria-label=${`${skill.name}${skill.gated ? ", approval-gated" : ""}, ${skill.review}. ${skill.files.length} files. ${carriers.length ? `Carried by ${carriers.map((a) => a.name).join(", ")}` : "No carriers"}`}>
          <${SkillIconBox} pkg=${skill} on />
          <span class="row-body">
            <span class="hstack" style=${{ gap: 5 }}>
              <span class="w6 truncate" style=${{ fontSize: 14 }}>${skill.name}</span>
              ${skill.gated ? html`<${Icon} name="checkmark.seal" size=${11} weight=${2.4} color="var(--violet-text)" />` : null}
              ${skill.review !== SkillReview.reviewed ? html`<span class="ag-microtag" style=${{ color: reviewTint(skill.review) }}>${skill.review.toUpperCase()}</span>` : null}
            </span>
            <span class="t-xs muted truncate" style=${{ display: "block", marginTop: 2, fontSize: 10.5 }}>${skill.files.length} files · ${skill.verb}</span>
          </span>
          <span class="ag-carriers" aria-hidden="true">${carriers.slice(0, 4).map((a) => html`<${AvatarChip} key=${a.id} name=${a.name} color=${a.color} size=${18} />`)}</span>
          <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
        </button>
      </div>`;
    })}
    ${sentinel}
  </div>`;
}

export function registerSkillRoutes() {
  registerRoute("skillsLibrary", SkillsLibraryView);
  registerRoute("skill", SkillDetailView);
  registerRoute("improveSkill", ImproveSkillSheet);
  registerRoute("newSkill", NewSkillSheet);
  registerRoute("newBundle", NewBundleSheet);
}
