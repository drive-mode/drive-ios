// The Agents cluster — one module per Swift file: AgentsView, AgentSkills,
// SkillPackages, AgentMemory. Registration seeds the slices this cluster
// owns (skill packages, kits, memory files — `[]` in production), installs
// the AppStore extensions the Swift files declare, and registers every route
// the navigation contract lists for the tab.
import { ensureAgentsCSS, bindAgents, registerAgentsRoutes } from "./AgentsView.js";
import { installSkillsStore, registerSkillRoutes } from "./AgentSkills.js";
import { seedSkillCatalog, registerSkillPackagesRoutes } from "./SkillPackages.js";
import { installMemoryStore, seedMemory, registerMemoryRoutes } from "./AgentMemory.js";

export function registerAgents({ store }) {
  ensureAgentsCSS();
  installSkillsStore(store);
  installMemoryStore(store);
  seedSkillCatalog(store);
  seedMemory(store);
  bindAgents(store);
  registerAgentsRoutes();      // agents · agent
  registerSkillRoutes();       // skillsLibrary · skill · improveSkill · newSkill · newBundle
  registerSkillPackagesRoutes(); // packages
  registerMemoryRoutes();      // memoryBrowser · memoryFile
}
