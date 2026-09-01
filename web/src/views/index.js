// Every surface registers its routes here. Clusters mirror the Swift files
// (one module per Swift file, grouped by tab) and never import each other —
// cross-cluster navigation goes through route names (see nav.js / ROUTES.md).
import { registerHome } from "./home/index.js";
import { registerWork } from "./work/index.js";
import { registerAgents } from "./agents/index.js";
import { registerTasks } from "./tasks/index.js";
import { registerProfile } from "./profile/index.js";

export function registerAllViews(ctx) {
  registerHome(ctx);
  registerWork(ctx);
  registerAgents(ctx);
  registerTasks(ctx);
  registerProfile(ctx);
}
