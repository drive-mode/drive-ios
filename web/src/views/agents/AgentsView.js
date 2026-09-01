// The Agents tab — a port of `Sources/AgentsView.swift`: the Status Hub one
// tap from anywhere (summary tiles, the roster with runtime badges and
// loadouts, quick approval toggles on long press), the per-agent profile
// (skills, memory, lineage, appearance, approvals, reporting), and the
// Lineage query — sessions direct beats, projects hold tasks, tasks yield
// artifacts, all derived from the same durable-log actor.
import { html, cx, useState, useMemo, useObservable, haptic } from "../../ui.js";
import { prefs, prefBool } from "../../prefs.js";
import { nav, registerRoute } from "../../nav.js";
import { runtimeBadgeForAgent, ARTIFACT_META, TASK_STATE_TINT } from "../../models.js";
import {
  Screen, Icon, Eyebrow, Empty, Card, AvatarChip, StateChip, Toggle, TextField, Pressable,
  HomeToolbarButton, SettingsToolbarButton, showMenu,
} from "../../components.js";
import { SkillChipRow, AgentSkillsSection } from "./AgentSkills.js";
import { AgentMemorySection } from "./AgentMemory.js";
import { useIncremental } from "./SkillPackages.js";

let store = null;

// ------------------------------------------------------------ module CSS

/** One `<style id="agents-css">` for the cluster, injected once. Token-only. */
export function ensureAgentsCSS() {
  if (typeof document === "undefined" || document.getElementById("agents-css")) return;
  const css = `
.ag-lede { font-size: 12.5px; line-height: 1.45; color: var(--ink-78); }
.ag-note { font-size: 10.5px; line-height: 1.4; color: var(--ink-55); }
.ag-note.faint { color: var(--ink-35); }
.ag-foot { font-size: 10.5px; line-height: 1.4; color: var(--ink-55); text-align: center; margin-top: 26px; padding: 0 8px; }
.ag-body { font-size: 13px; line-height: 1.55; color: var(--ink-78); white-space: pre-wrap; word-break: break-word; }
.ag-sep { height: .8px; background: var(--hairline); }
.ag-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 8px; }
.ag-tile { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left; padding: 12px 13px; min-height: 60px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline), var(--card-shadow); color: inherit; }
.ag-tile.needs { background: color-mix(in srgb, var(--violet) 10%, var(--surface)); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 22%, transparent); }
.ag-tile .n { font-size: 21px; font-weight: 900; letter-spacing: -.5px; line-height: 1.1; }
.ag-tile .l { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: var(--ink-55); }
.ag-tile.needs .n, .ag-tile.needs .l { color: var(--violet-text); }
.ag-tile.stuck .n { color: var(--danger); }
.ag-pill { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 9px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 8%, transparent); color: var(--violet-text); font-size: 12px; font-weight: 700; }
.ag-row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 13px 14px; margin-top: 10px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline), var(--card-shadow); color: inherit; }
.ag-row.needs { box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--violet) 28%, transparent), var(--card-shadow); }
.ag-row .name { font-size: 15px; font-weight: 600; }
.ag-row .status { font-size: 12px; color: var(--ink-55); margin-top: 2px; }
.ag-badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: var(--r-pill); background: var(--ink-08); color: var(--ink-55); font-size: 8.5px; font-weight: 700; white-space: nowrap; flex: none; }
.ag-skillchips { display: block; font-size: 9.5px; font-weight: 600; color: var(--ink-55); margin-top: 3px; }
.ag-hscroll { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.ag-hscroll::-webkit-scrollbar { display: none; }
.ag-hscroll > * { flex: none; }
.ag-icobox { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--surface2); color: var(--ink-35); flex: none; --tint: var(--violet); }
.ag-icobox.on { background: color-mix(in srgb, var(--tint) 13%, transparent); color: var(--tint); }
.ag-icobox.violet { background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); }
.ag-stat { padding: 11px 13px; min-width: 0; }
.ag-stat .v { font-size: 17px; font-weight: 900; letter-spacing: -.3px; }
.ag-stat .l { font-size: 10.5px; font-weight: 600; color: var(--ink-55); margin-top: 2px; }
.ag-cap-head { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 14px; color: inherit; min-height: 58px; }
.ag-cap-head .t { font-size: 14px; font-weight: 700; }
.ag-cap-head .d { font-size: 10.5px; color: var(--ink-55); margin-top: 2px; }
.ag-cap-body { padding: 0 14px 14px; }
.ag-disclose { transition: transform .2s var(--ease); }
:root[data-reduce-motion="1"] .ag-disclose { transition: none; }
.ag-linkbtn { display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 4px 6px; border-radius: 8px; color: var(--violet-text); font-size: 12.5px; font-weight: 700; }
.ag-linkbtn:disabled { cursor: default; }
.ag-chipbtn { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 5px 12px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); font-size: 11.5px; font-weight: 700; }
.ag-wide-violet { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px; border-radius: var(--r-control); background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); font-size: 14px; font-weight: 700; }
.ag-microtag { font-size: 8px; font-weight: 900; letter-spacing: .8px; color: var(--ink-35); white-space: nowrap; }
.ag-kv { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; min-height: 46px; padding: 6px 14px; color: inherit; }
.ag-kv .k { font-size: 15px; flex: 1; min-width: 0; }
.ag-kv .v { font-size: 14px; color: var(--ink-55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; }
.ag-kv.sep, .ag-mem-row.sep, .ag-pkg-row.sep { box-shadow: inset 0 .8px 0 var(--hairline); }
.ag-swatch { width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 0 0 .8px var(--hairline); flex: none; }
.ag-line-head { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; min-height: 42px; padding: 0 14px; color: inherit; }
.ag-line-task { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; min-height: 44px; padding: 4px 14px 4px 33px; color: inherit; }
.ag-legend { display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; min-height: 30px; padding: 2px 0; color: inherit; }
.ag-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.ag-art { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; min-height: 36px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px color-mix(in srgb, var(--tint) 25%, transparent); color: var(--ink-78); font-size: 11.5px; font-weight: 600; max-width: 220px; }
.ag-task-chip { display: inline-flex; align-items: center; gap: 4.5px; padding: 4.5px 9px; border-radius: var(--r-control); font-size: 11px; font-weight: 700; white-space: nowrap; flex: none; }
.ag-search .field, .ag-search { padding: 8px 11px; }
.ag-kitchip { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 7px 10px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--violet) 10%, transparent); color: var(--violet-text); font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.ag-kitchip.done { background: color-mix(in srgb, var(--violet) 5%, transparent); color: var(--ink-35); cursor: default; }
.ag-cat-head { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; padding: 0 12px; color: inherit; }
.ag-cat-head:disabled { cursor: default; }
.ag-skill-row { display: flex; align-items: center; gap: 4px; padding: 7px 8px 7px 12px; }
.ag-skill-main { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; text-align: left; color: inherit; padding: 2px 0; min-height: 44px; }
.ag-check { width: 44px; height: 44px; display: grid; place-items: center; flex: none; border-radius: 10px; }
.ag-lib-row, .ag-pkg-row { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 9px 12px; min-height: 52px; color: inherit; }
.ag-pick-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 12px; min-height: 46px; color: inherit; }
.ag-file-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-height: 44px; }
.ag-events { display: inline-block; font-size: 10.5px; padding: 5px 9px; border-radius: 6px; background: color-mix(in srgb, var(--well) 100%, transparent); box-shadow: inset 0 0 0 .8px var(--hairline); max-width: 100%; word-break: break-word; }
.ag-review { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 900; color: var(--tint); background: color-mix(in srgb, var(--tint) 12%, transparent); }
.ag-improve { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px; min-height: 36px; color: inherit; }
.ag-carrier { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; min-height: 30px; border-radius: var(--r-pill); background: var(--surface2); color: inherit; }
.ag-observed { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 10px; border-radius: 9px; background: color-mix(in srgb, var(--tint) 7%, transparent); color: inherit; }
.ag-carriers { display: inline-flex; flex: none; }
.ag-carriers .avatar { box-shadow: 0 0 0 1.5px var(--surface); }
.ag-carriers .avatar + .avatar { margin-left: -5px; }
.ag-kit-card { display: flex; flex-direction: column; gap: 7px; width: 190px; padding: 11px; background: var(--surface); border-radius: var(--r-card); box-shadow: inset 0 0 0 .8px var(--hairline), var(--card-shadow); }
.ag-kit-card.wide { width: 100%; }
.ag-kit-note { font-size: 10.5px; line-height: 1.35; color: var(--ink-55); min-height: 2.7em; }
.ag-sentinel { display: flex; justify-content: center; padding: 8px; box-shadow: inset 0 .8px 0 var(--hairline); }
.ag-editor { border-radius: var(--r-card); box-shadow: none; background: transparent; padding: 10px 12px; }
.ag-editor textarea { font-size: 13px; line-height: 1.55; min-height: 120px; }
.ag-sheet { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.ag-sheet .scroll { flex: 1; min-height: 0; }
.ag-sheet-foot { flex: none; padding: 10px 16px calc(var(--safe-bottom) + 12px); box-shadow: 0 -.5px 0 var(--hairline); background: var(--page); }
.ag-scope { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 7px 11px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 .8px var(--hairline); color: var(--ink-78); font-size: 12px; font-weight: 700; white-space: nowrap; }
.ag-scope.on { background: var(--tint); color: #fff; box-shadow: none; }
.ag-mem-row { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 9px 12px; min-height: 52px; color: inherit; }
.ag-pie { display: block; flex: none; }
`;
  const el = document.createElement("style");
  el.id = "agents-css";
  el.textContent = css;
  document.head.appendChild(el);
}

// ------------------------------------------------ per-agent persisted prefs

/** Approval policy is the most trust-sensitive config in the product — `@AppStorage` per agent, defaults as in Swift. */
export const APPROVAL_KEYS = { edits: ["edits", true], commands: ["commands", false], autoland: ["autoland", false] };
export const approvalPref = (agentId, key) => prefBool(`approval.${agentId}.${APPROVAL_KEYS[key][0]}`, APPROVAL_KEYS[key][1]);
export function setApprovalPref(agentId, key, on) { prefs.set(`approval.${agentId}.${APPROVAL_KEYS[key][0]}`, !!on); }

/** Appearance overrides (display name · color · voice) and reporting, per agent. */
export const AGENT_PALETTE = [
  { label: "Violet", value: "var(--maya)" }, { label: "Blue", value: "var(--scout)" }, { label: "Green", value: "var(--diff-green)" },
  { label: "Amber", value: "var(--tint-amber)" }, { label: "Teal", value: "var(--tint-teal)" }, { label: "Pink", value: "var(--tint-pink)" },
  { label: "Ink", value: "var(--coder)" }, { label: "Graphite", value: "var(--indexer)" },
];
export const VOICES = ["Sage · en-US", "Brook · en-US", "Quill · en-GB", "Mono · en-US"];
export const CADENCES = ["Every event", "Every 5 minutes", "Hourly digest"];
export const QUIET_HOURS = ["Off", "22:00 – 07:00", "Weekends"];

const canonical = new Map(); // agentId → { name, color, voice } before any override

/** Bind the store and apply persisted appearance overrides to the roster (lineage keeps matching on the canonical name). */
export function bindAgents(s) {
  store = s;
  for (const a of s.agents) {
    if (!canonical.has(a.id)) canonical.set(a.id, { name: a.name, color: a.color, voice: a.voice });
    const name = prefs.get(`agent.${a.id}.displayName`, null);
    const color = prefs.get(`agent.${a.id}.color`, null);
    const voice = prefs.get(`agent.${a.id}.voice`, null);
    if (typeof name === "string" && name.trim()) a.name = name.trim();
    if (typeof color === "string" && color) a.color = color;
    if (typeof voice === "string" && voice) a.voice = voice;
  }
}
export const canonicalName = (agent) => canonical.get(agent.id)?.name ?? agent.name;
const canonicalOf = (agent) => { if (!canonical.has(agent.id)) canonical.set(agent.id, { name: agent.name, color: agent.color, voice: agent.voice }); return canonical.get(agent.id); };

function setAgentAppearance(agent, patch) {
  const base = canonicalOf(agent);
  if ("name" in patch) { const v = String(patch.name ?? "").trim(); prefs.set(`agent.${agent.id}.displayName`, v && v !== base.name ? v : null); agent.name = v || base.name; }
  if ("color" in patch) { prefs.set(`agent.${agent.id}.color`, patch.color && patch.color !== base.color ? patch.color : null); agent.color = patch.color || base.color; }
  if ("voice" in patch) { prefs.set(`agent.${agent.id}.voice`, patch.voice && patch.voice !== base.voice ? patch.voice : null); agent.voice = patch.voice || base.voice; }
  store.commit();
}

/** Quick approval toggles — the context menu on a roster row (also reachable from the profile). */
function approvalMenu(e, pt, agent, bump) {
  const edits = approvalPref(agent.id, "edits"), commands = approvalPref(agent.id, "commands");
  showMenu({ clientX: pt?.x ?? e.clientX, clientY: pt?.y ?? e.clientY, currentTarget: e.currentTarget }, [
    { label: `Edits need approval — ${edits ? "on" : "off"}`, icon: edits ? "checkmark.seal.fill" : "checkmark.seal", onSelect: () => { setApprovalPref(agent.id, "edits", !edits); bump(); } },
    { label: `Commands need approval — ${commands ? "on" : "off"}`, icon: commands ? "checkmark.seal.fill" : "checkmark.seal", onSelect: () => { setApprovalPref(agent.id, "commands", !commands); bump(); } },
    { label: `Configure ${agent.name}`, icon: "slider.horizontal.3", onSelect: () => nav.push("agent", { agentId: agent.id }) },
  ], { title: agent.name });
}

// ---------------------------------------------------------------- pieces

export function AgentRuntimeBadgeView({ badge }) {
  return html`<span class="ag-badge" aria-label=${`Runtime ${badge.family}, ${badge.executionLocation}`}>${badge.label}</span>`;
}

function SummaryTile({ number, label, style, onClick }) {
  const body = html`<span class="n">${number}</span><span class="l">${style === "working" ? html`<i class="dot" />` : null}${label}</span>`;
  const cls = cx("ag-tile", style === "needsYou" && "needs", style === "stuck" && "stuck", onClick && "pressable");
  if (onClick) return html`<button type="button" class=${cls} onClick=${() => { haptic("light"); onClick(); }} aria-label=${`${number} ${label}. Opens what needs you`}>${body}</button>`;
  return html`<div class=${cls} role="group" aria-label=${`${number} ${label}`}>${body}</div>`;
}

function AgentRow({ agent, bump }) {
  const s = useObservable(store);
  const badge = runtimeBadgeForAgent(agent.id);
  const skills = s.equippedSkills(agent.id);
  return html`<${Pressable} as="button" className=${cx("ag-row", agent.state === "Needs you" && "needs")}
    onClick=${() => nav.push("agent", { agentId: agent.id })} onLongPress=${(e, pt) => approvalMenu(e, pt, agent, bump)}
    label=${`${agent.name}, ${agent.role.charAt(0) + agent.role.slice(1).toLowerCase()}, ${agent.state}. ${agent.statusLine}. Reported ${agent.age} ago. Opens agent details and configuration. Long press for quick approval toggles.`}>
    <${AvatarChip} name=${agent.name} color=${agent.color} size=${38} />
    <span class="row-body">
      <span class="hstack" style=${{ gap: 6 }}><span class="name truncate">${agent.name}</span><${AgentRuntimeBadgeView} badge=${badge} /></span>
      <span class="status truncate" style=${{ display: "block" }}>${agent.statusLine}</span>
      <${SkillChipRow} skills=${skills} />
    </span>
    <span class="vstack" style=${{ alignItems: "flex-end", gap: 5, flex: "none" }}>
      <span class="mono faint" style=${{ fontSize: 10 }}>${agent.age}</span>
      <${StateChip} state=${agent.state} />
    </span>
    <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
  </${Pressable}>`;
}

// ------------------------------------------------------------------ root

export function AgentsView() {
  ensureAgentsCSS();
  const s = useObservable(store);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const openNeedsYou = () => {
    const open = s.openInterrupts;
    if (open.length === 1) nav.push("conversation", { interruptId: open[0].id });
    else nav.push("needsYou");
  };
  return html`<${Screen} largeTitle="Agents" root leading=${html`<${HomeToolbarButton} />`} trailing=${html`<${SettingsToolbarButton} tab="Agents" source="agents" />`}>
    <div class="ag-tiles">
      <${SummaryTile} number=${s.needsYouCount} label="Need you" style="needsYou" onClick=${openNeedsYou} />
      <${SummaryTile} number=${s.reportingCount} label="Reporting" style="working" />
      <${SummaryTile} number=${s.stuckCount} label="Stuck?" style="stuck" />
    </div>

    <div class="hstack" style=${{ gap: 8, marginTop: 22 }}>
      <${Eyebrow}>AGENTS</${Eyebrow}>
      <span class="grow" />
      <button type="button" class="ag-pill pressable" onClick=${() => nav.push("memoryBrowser")} aria-label="Memory" title="The fleet's notebooks — agent, session, task, project, and plan memory">
        <${Icon} name="brain" size=${11} weight=${2.4} /><span>Memory</span><${Icon} name="chevron.right" size=${9} weight=${3} />
      </button>
      <button type="button" class="ag-pill pressable" onClick=${() => nav.push("skillsLibrary")} aria-label="Skills" title="Every capability the fleet can carry, and who carries it">
        <${Icon} name="square.stack.3d.up" size=${11} weight=${2.4} /><span>Skills</span><${Icon} name="chevron.right" size=${9} weight=${3} />
      </button>
    </div>

    ${s.agents.length
      ? s.agents.map((a) => html`<${AgentRow} key=${a.id} agent=${a} bump=${bump} />`)
      : html`<${Empty} icon="person.2" title=${s.wireDropped ? "Reconnecting to your fleet" : "No agents connected"}
          body=${s.configuration.previewContentEnabled ? "Agents appear here as soon as the room log reports one." : "Agents come from the writer's room log. Nothing is seeded in this build — connect a writer to see your fleet."}
          action=${s.configuration.writerSettingsVisible || !s.configuration.previewContentEnabled ? "Connect a writer" : null} onAction=${() => nav.present("settings", { tab: "General", source: "agents" })} />`}

    <p class="ag-foot">Agents publish with report_status — a durable log you can read from any surface, including after the fact.</p>
  </${Screen}>`;
}

// --------------------------------------------------------------- lineage

const SLICE_PALETTE = ["var(--violet)", "var(--tint-blue)", "var(--diff-green)", "var(--tint-amber)", "var(--tint-teal)", "var(--tint-pink)"];

function TaskStateChip({ state }) {
  if (state === "Done") return html`<${Icon} name="checkmark" size=${13} weight=${3} color="var(--ink-35)" label="Done" />`;
  const st = state === "Review" ? { background: "color-mix(in srgb, var(--violet) 10%, transparent)", color: "var(--violet-text)" }
    : state === "Blocked" ? { background: "color-mix(in srgb, var(--danger) 8%, transparent)", color: "var(--danger)" }
    : { background: "var(--surface2)", color: "var(--ink-55)" };
  return html`<span class="ag-task-chip" style=${st}>${state === "Running" ? html`<i class="dot" style=${{ width: 5, height: 5 }} />` : null}${state}</span>`;
}

/** Russian dolls: an agent's work, nested the way it contains — a query over the log's lineage, not a picture. */
export function AgentLineage({ agent }) {
  const s = useObservable(store);
  const [expanded, setExpanded] = useState(() => new Set());
  const name = canonicalName(agent);
  const myTasks = useMemo(() => s.tasks.filter((t) => t.agentName === name && !s.isArchived(t)), [s.tasks, s.archivedTasks.size, s.archivedProjects.size, name]);
  const projects = useMemo(() => {
    const groups = new Map();
    for (const t of myTasks) (groups.get(t.room) ?? groups.set(t.room, []).get(t.room)).push(t);
    return [...groups].map(([n, tasks]) => ({ name: n, tasks })).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [myTasks]);
  const myArtifacts = s.artifacts.filter((a) => a.agentName === name);
  const myBeats = s.beats.filter((b) => b.director === name).length;
  const total = Math.max(1, myTasks.count ?? myTasks.length);
  const toggle = (n) => setExpanded((prev) => { const x = new Set(prev); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const { visible: dolls, sentinel } = useIncremental(projects, 24);

  // The pie: this agent's tasks, sliced by project (gap 0.008 of the circle each side, like the Swift trim).
  const R = 38, C = 2 * Math.PI * R;
  let start = 0;
  const slices = projects.map((p, i) => { const frac = p.tasks.length / total; const from = start + 0.008, to = start + frac - 0.008; start += frac; return { i, from, to, len: Math.max(0, to - from) }; });
  const legend = projects.slice(0, 6);

  return html`<div role="group" aria-label=${`Lineage: ${myTasks.length} tasks across ${projects.length} projects, ${myArtifacts.length} artifacts${myBeats > 0 ? `, directs ${myBeats} beats` : ""}`}>
    <${Card} style=${{ padding: 14 }}>
      <div class="hstack" style=${{ gap: 18, alignItems: "center" }}>
        <div style=${{ position: "relative", width: 104, height: 104, flex: "none" }}>
          <svg class="ag-pie" width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
            ${slices.map((sl) => sl.len > 0 ? html`<circle key=${sl.i} cx="52" cy="52" r=${R} fill="none" stroke=${SLICE_PALETTE[sl.i % SLICE_PALETTE.length]} stroke-width="12" stroke-linecap="round"
              stroke-dasharray=${`${sl.len * C} ${C}`} stroke-dashoffset=${-sl.from * C} transform="rotate(-90 52 52)" />` : null)}
          </svg>
          <div class="vstack" style=${{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 1 }}>
            <${AvatarChip} name=${agent.name} color=${agent.color} size=${26} />
            <span class="w9" style=${{ fontSize: 12 }}>${myTasks.length}</span>
            <span class="w6 faint" style=${{ fontSize: 8 }}>tasks</span>
          </div>
        </div>
        <div class="vstack grow" style=${{ gap: 4, minWidth: 0 }}>
          ${legend.map((p, i) => html`<button key=${p.name} type="button" class="ag-legend pressable" onClick=${() => nav.push("projectMap", { projectId: p.name })} aria-label=${`${p.name}, ${p.tasks.length} tasks. Opens the project map`}>
            <i class="ag-dot" style=${{ background: SLICE_PALETTE[i % SLICE_PALETTE.length] }} />
            <span class="w6 grow truncate" style=${{ fontSize: 12.5 }}>${p.name}</span>
            <span class="mono w7 muted" style=${{ fontSize: 11 }}>${p.tasks.length}</span>
          </button>`)}
          ${projects.length > legend.length ? html`<span class="t-xs muted" style=${{ paddingLeft: 14 }}>+${projects.length - legend.length} more projects below</span>` : null}
          ${projects.length === 0 ? html`<span class="t-sm muted">No active tasks — check the archive.</span>` : null}
        </div>
      </div>
    </${Card}>

    ${dolls.map((slice) => { const open = expanded.has(slice.name); return html`<${Card} key=${slice.name} pad=${false} style=${{ marginTop: 8 }}>
      <button type="button" class="ag-line-head pressable" onClick=${() => toggle(slice.name)} aria-expanded=${open} aria-label=${`${slice.name}, ${slice.tasks.length} task${slice.tasks.length === 1 ? "" : "s"}`}>
        <${Icon} name="chevron.right" size=${11} weight=${3} color="var(--ink-35)" className="ag-disclose" style=${{ transform: open ? "rotate(90deg)" : "none" }} />
        <span class="w7 grow truncate" style=${{ fontSize: 13.5 }}>${slice.name}</span>
        <span class="t-xs muted">${slice.tasks.length} task${slice.tasks.length === 1 ? "" : "s"}</span>
      </button>
      ${open ? slice.tasks.map((t) => html`<button key=${t.id} type="button" class="ag-line-task pressable" onClick=${() => nav.push("projectMap", { projectId: t.room, focusTaskId: t.id })} aria-label=${`${t.title}, ${t.state}. Opens on the project map`}>
        <span class="grow truncate" style=${{ fontSize: 12.5, color: "var(--ink-78)" }}>${t.title}</span>
        <${TaskStateChip} state=${t.state} />
      </button>`) : null}
    </${Card}>`; })}
    ${sentinel}

    ${myBeats > 0 ? html`<${Card} style=${{ marginTop: 8, padding: "11px 14px" }}>
      <div class="hstack" style=${{ gap: 11 }}>
        <span class="ag-icobox violet"><${Icon} name="sparkles.tv" size=${14} weight=${2.4} /></span>
        <div class="grow" style=${{ minWidth: 0 }}>
          <div class="w7 truncate" style=${{ fontSize: 13.5 }}>Auth middleware session</div>
          <div class="t-xs muted">Directs ${myBeats} of ${s.beats.length} beats</div>
        </div>
        <button type="button" class="ag-chipbtn pressable" onClick=${() => s.joinCall()} aria-label="Join the session">Join</button>
      </div>
    </${Card}>` : null}

    ${myArtifacts.length ? html`<div class="ag-hscroll" style=${{ marginTop: 10 }} role="group" aria-label=${`${myArtifacts.length} artifacts`}>
      ${myArtifacts.map((a) => { const meta = ARTIFACT_META[a.kind]; return html`<button key=${a.id} type="button" class="ag-art pressable" style=${{ "--tint": meta?.tint }} onClick=${() => nav.push("artifact", { id: a.id })} aria-label=${`${a.kind}: ${a.title}`}>
        <${Icon} name=${meta?.symbol ?? "doc"} size=${12} weight=${2.4} color=${meta?.tint} /><span class="truncate">${a.title}</span>
      </button>`; })}
    </div>` : null}
  </div>`;
}

// ----------------------------------------------------------------- detail

function CapabilityCard({ title, symbol, detail, open, onToggle, children }) {
  return html`<${Card} pad=${false}>
    <button type="button" class="ag-cap-head pressable" onClick=${onToggle} aria-expanded=${open} aria-label=${`${title}: ${detail}. ${open ? "Collapse" : "Expand"}`}>
      <span class="ag-icobox violet"><${Icon} name=${symbol} size=${14} weight=${2.4} /></span>
      <span class="grow" style=${{ minWidth: 0 }}><span class="t" style=${{ display: "block" }}>${title}</span><span class="d" style=${{ display: "block" }}>${detail}</span></span>
      <${Icon} name="chevron.right" size=${13} weight=${2.6} color="var(--violet-text)" className="ag-disclose" style=${{ transform: open ? "rotate(90deg)" : "none" }} />
    </button>
    ${open ? html`<div class="ag-cap-body">${children}</div>` : null}
  </${Card}>`;
}

function KVRow({ label, value, trailing, onClick, first, ariaLabel }) {
  return html`<button type="button" class=${cx("ag-kv pressable", !first && "sep")} onClick=${onClick} aria-label=${ariaLabel ?? `${label}: ${value}. Change`}>
    <span class="k">${label}</span>${trailing ?? html`<span class="v">${value}</span>`}
    <${Icon} name="chevron.right" size=${12} weight=${2.6} color="var(--ink-35)" />
  </button>`;
}

function ToggleKV({ label, checked, onChange, first }) {
  return html`<div class=${cx("ag-kv", !first && "sep")}><span class="k">${label}</span><${Toggle} checked=${checked} onChange=${onChange} label=${label} /></div>`;
}

export function AgentDetailView({ params }) {
  ensureAgentsCSS();
  const s = useObservable(store);
  const agent = s.agents.find((a) => a.id === params.agentId);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  if (!agent) return html`<${Screen} title="Agent" back><${Empty} icon="person.2" title="Agent not on the roster" body="It may have left the room, or the wire replaced the fleet." /></${Screen}>`;

  const badge = runtimeBadgeForAgent(agent.id);
  const packages = s.skillPackages ?? [];
  const pick = (e, title, options, current, onPick) => showMenu(e, options.map((o) => ({ label: o.label ?? o, checked: (o.value ?? o) === current, onSelect: () => onPick(o.value ?? o) })), { title });
  const cadence = prefs.get(`reporting.${agent.id}.cadence`, CADENCES[0]);
  const quiet = prefs.get(`reporting.${agent.id}.quietHours`, QUIET_HOURS[0]);
  const approvals = [
    ["edits", "Edits need approval"], ["commands", "Commands need approval"], ["autoland", "Auto-land green edits"],
  ];

  return html`<${Screen} title=${agent.name} back>
    <${Card} style=${{ padding: 16, marginTop: 8 }}>
      <div class="hstack" style=${{ gap: 14 }}>
        <${AvatarChip} name=${agent.name} color=${agent.color} size=${52} />
        <div class="grow" style=${{ minWidth: 0 }}>
          <div class="hstack" style=${{ gap: 7, flexWrap: "wrap" }}>
            <span class="w9" style=${{ fontSize: 20, letterSpacing: -0.3 }}>${agent.name}</span>
            <${AgentRuntimeBadgeView} badge=${badge} />
            <${StateChip} state=${agent.state} />
          </div>
          <div class="t-sm muted" style=${{ marginTop: 3, fontSize: 12 }}>${agent.role.charAt(0) + agent.role.slice(1).toLowerCase()} · in Auth middleware</div>
        </div>
      </div>
    </${Card}>

    <div class="grid3" style=${{ marginTop: 10, gap: 9 }}>
      ${[[agent.editsAllowed, "edits allowed"], [agent.testsRun, "tests run"], [agent.uptime, "uptime today"]].map(([v, l]) => html`<${Card} key=${l} className="ag-stat" pad=${false} role="group" aria-label=${`${v} ${l}`}><div class="v">${v}</div><div class="l">${l}</div></${Card}>`)}
    </div>

    <div class="vstack" style=${{ gap: 10, marginTop: 18 }}>
      <${CapabilityCard} title="Skills" symbol="square.stack.3d.up" detail=${`${s.equippedSkills(agent.id).length} equipped · ${packages.length} available`} open=${skillsOpen} onToggle=${() => setSkillsOpen(!skillsOpen)}>
        <div class="hstack" style=${{ gap: 14, marginBottom: 10 }}>
          <button type="button" class="ag-linkbtn pressable" style=${{ fontSize: 11.5, padding: "4px 2px" }} onClick=${() => s.setAllSkills(agent.id, true)} aria-label="Equip all skills">All</button>
          <button type="button" class="ag-linkbtn pressable" style=${{ fontSize: 11.5, padding: "4px 2px" }} onClick=${() => s.setAllSkills(agent.id, false)} aria-label="Unequip all skills">None</button>
          <span class="grow" />
          <button type="button" class="ag-linkbtn pressable" style=${{ fontSize: 11.5 }} onClick=${() => nav.push("skillsLibrary")}>Open library</button>
        </div>
        <${AgentSkillsSection} agent=${agent} />
        <p class="ag-note" style=${{ marginTop: 10 }}>Search and open only the categories you need. Approval gates remain authoritative.</p>
      </${CapabilityCard}>
      <${CapabilityCard} title="Memory" symbol="brain" detail=${`${s.agentMemory(agent.id).length} files`} open=${memoryOpen} onToggle=${() => setMemoryOpen(!memoryOpen)}>
        <${AgentMemorySection} agent=${agent} />
        <button type="button" class="ag-linkbtn pressable" style=${{ fontSize: 11.5, marginTop: 8, padding: "4px 2px" }} onClick=${() => nav.push("memoryBrowser")}>Open memory browser</button>
        <p class="ag-note" style=${{ marginTop: 6 }}>Hooks load at session start; bodies load only when relevant.</p>
      </${CapabilityCard}>
    </div>

    <${Eyebrow} style=${{ marginTop: 22, paddingLeft: 14 }}>LINEAGE</${Eyebrow}>
    <div style=${{ marginTop: 7 }}><${AgentLineage} agent=${agent} /></div>

    <${Eyebrow} style=${{ marginTop: 22, paddingLeft: 14 }}>APPEARANCE</${Eyebrow}>
    <${Card} pad=${false} style=${{ marginTop: 7 }}>
      ${editingName
        ? html`<div class="ag-kv" style=${{ gap: 8 }}>
            <${TextField} value=${nameDraft} onInput=${setNameDraft} placeholder=${canonicalName(agent)} label="Display name" autoFocus className="grow" style=${{ padding: "7px 10px" }}
              onSubmit=${() => { setAgentAppearance(agent, { name: nameDraft }); setEditingName(false); }} />
            <button type="button" class="ag-linkbtn pressable" onClick=${() => { setAgentAppearance(agent, { name: nameDraft }); setEditingName(false); }} aria-label="Save display name">Save</button>
          </div>`
        : html`<${KVRow} first label="Display name" value=${agent.name} onClick=${() => { setNameDraft(agent.name); setEditingName(true); }} />`}
      <${KVRow} label="Color" value=${AGENT_PALETTE.find((p) => p.value === agent.color)?.label ?? "Custom"} trailing=${html`<span class="ag-swatch" style=${{ background: agent.color }} aria-hidden="true" />`}
        onClick=${(e) => pick(e, "Color", AGENT_PALETTE, agent.color, (v) => setAgentAppearance(agent, { color: v }))} ariaLabel=${`Color: ${AGENT_PALETTE.find((p) => p.value === agent.color)?.label ?? "custom"}. Change`} />
      <${KVRow} label="Voice" value=${agent.voice} onClick=${(e) => pick(e, "Voice", [...new Set([agent.voice, ...VOICES])], agent.voice, (v) => setAgentAppearance(agent, { voice: v }))} />
    </${Card}>

    <${Eyebrow} style=${{ marginTop: 20, paddingLeft: 14 }}>APPROVALS</${Eyebrow}>
    <${Card} pad=${false} style=${{ marginTop: 7 }}>
      ${approvals.map(([key, label], i) => html`<${ToggleKV} key=${key} first=${i === 0} label=${label} checked=${approvalPref(agent.id, key)} onChange=${(on) => { setApprovalPref(agent.id, key, on); bump(); }} />`)}
    </${Card}>

    <${Eyebrow} style=${{ marginTop: 20, paddingLeft: 14 }}>REPORTING</${Eyebrow}>
    <${Card} pad=${false} style=${{ marginTop: 7 }}>
      <${KVRow} first label="Cadence" value=${cadence} onClick=${(e) => pick(e, "Cadence", CADENCES, cadence, (v) => { prefs.set(`reporting.${agent.id}.cadence`, v); bump(); })} />
      <${KVRow} label="Quiet hours" value=${quiet} onClick=${(e) => pick(e, "Quiet hours", QUIET_HOURS, quiet, (v) => { prefs.set(`reporting.${agent.id}.quietHours`, v); bump(); })} />
    </${Card}>

    <p class="ag-foot faint" style=${{ marginTop: 22, color: "var(--ink-35)" }}>Skills are capability policy — what this agent may publish, and what needs you first. The how (prompts, tools, providers, model IDs) never leaves the host; Drive configures appearance, skills, and approvals only.</p>
  </${Screen}>`;
}

export function registerAgentsRoutes() {
  registerRoute("agents", AgentsView);
  registerRoute("agent", AgentDetailView);
}
