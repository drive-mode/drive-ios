// The Tasks cluster — one module per Swift file:
//   TasksView.js          TasksView.swift        tasks · allTasks · archive · search
//   ProjectMapView.js     ProjectMapView.swift   projectMap{projectId, focusTaskId?}
//   ArtifactsView.js      ArtifactsView.swift    artifacts
//   ArtifactDetailView.js ArtifactDetailView.swift artifact{id}
//   ActivityView.js       ActivityView.swift     activity
// `registerTasks` installs the dependency-map layout builder into the
// PreheatEngine (so warm-ups and the LRU-8 cache share it) and registers the
// routes. Clusters never import each other — navigation is by route name.
import { registerRoute } from "../../nav.js";
import { injectTasksStyle } from "./shared.js";
import { TasksView, AllTasksView, ArchiveView, SearchView, bindTasksStore } from "./TasksView.js";
import { ProjectMapView, buildProjectLayout, bindProjectMapStore } from "./ProjectMapView.js";
import { ArtifactsView, bindArtifactsStore } from "./ArtifactsView.js";
import { ArtifactDetailView, bindArtifactDetailStore } from "./ArtifactDetailView.js";
import { ActivityView, bindActivityStore } from "./ActivityView.js";

export { TaskRow, TaskStateChip } from "./TasksView.js";
export { ArtifactRail, ArtifactCard } from "./ArtifactsView.js";
export { ReplayPlayer, DiffCard, ProgressRail, BeatHeader, BeatStage } from "./ArtifactDetailView.js";
export { BreakdownCard, ContributionGrid, heatLevel } from "./ActivityView.js";
export { buildProjectLayout, computeLayout } from "./ProjectMapView.js";

export function registerTasks({ store }) {
  injectTasksStyle();
  for (const bind of [bindTasksStore, bindProjectMapStore, bindArtifactsStore, bindArtifactDetailStore, bindActivityStore]) bind(store);

  // The map layout is pure; installing it here lets rebuildTaskIndex warm the
  // hot projects before the user drills in, and makes the view a cache read.
  store.preheat.layoutBuilder = buildProjectLayout;
  if (store.fleetSeeded || store.tasks.length) store.rebuildTaskIndex();

  registerRoute("tasks", TasksView);
  registerRoute("projectMap", ProjectMapView);
  registerRoute("allTasks", AllTasksView);
  registerRoute("archive", ArchiveView);
  registerRoute("search", SearchView);
  registerRoute("artifacts", ArtifactsView);
  registerRoute("artifact", ArtifactDetailView);
  registerRoute("activity", ActivityView);
}
