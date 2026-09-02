// Profile / Settings cluster — one module per Swift file:
//   ProfileView · ProfileCustomize · SettingsView · ShowcaseView · FeedbackMode · PolicyViews · LocalAI
// `registerProfile({ store, nav })` binds the store, injects the cluster's
// stylesheet, seeds the experiments slice, and registers every route.
import { registerRoute } from "../../nav.js";
import { bind, injectStyle, PROFILE_CSS } from "./shared.js";
import { ProfileView } from "./ProfileView.js";
import { CustomizeProfileView } from "./ProfileCustomize.js";
import { SettingsModalView, NeverFileView } from "./SettingsView.js";
import { ShowcaseView, ProjectShowcaseView } from "./ShowcaseView.js";
import { FeedbackChatView, seedExperiments } from "./FeedbackMode.js";
import { PolicyView } from "./PolicyViews.js";
import { LocalAIView, installLocalAITestHook } from "./LocalAI.js";

export { FeedbackBubble, FeedbackSettingsSection, Variants, ExperimentStatus } from "./FeedbackMode.js";
export { FromFriendsRail, ProjectSquare, ShowcaseDemo, ReplayPlayer } from "./ShowcaseView.js";
export { SettingsDraftStore, getDrafts, availableSettingsTabs } from "./SettingsView.js";
export { ActivityRings, WeekBars } from "./ProfileView.js";
export { ProfileModule, readProfileLayout, writeProfileLayout } from "./ProfileCustomize.js";
export { POLICIES } from "./PolicyViews.js";
export { LocalAIStore, localAI, LocalAITaskKind, LocalAIModelAvailability, LocalAIRunState, decodeBounded, MAXIMUM_BYTES } from "./LocalAI.js";

export function registerProfile({ store, nav }) {
  bind({ store, nav });
  injectStyle("profile-css", PROFILE_CSS);
  seedExperiments(store);

  registerRoute("profile", ProfileView);
  registerRoute("profileCustomize", CustomizeProfileView);
  registerRoute("settings", SettingsModalView);
  registerRoute("neverFile", NeverFileView);
  registerRoute("showcase", ShowcaseView);
  registerRoute("showProject", ProjectShowcaseView);
  registerRoute("feedbackChat", FeedbackChatView);
  registerRoute("policy", PolicyView);
  registerRoute("localAI", LocalAIView);

  installLocalAITestHook();
}
