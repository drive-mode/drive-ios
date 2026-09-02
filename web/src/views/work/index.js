// The Work cluster: chat-first Work root, calls, the live call, the Spotlight,
// Presenter titles. One module per Swift file:
//   WorkHub.js           ← Sources/WorkHub.swift
//   CallTabView.js       ← Sources/CallTabView.swift
//   LiveCallView.js      ← Sources/LiveCallView.swift
//   SpotlightDirector.js ← Sources/SpotlightDirector.swift
//   AgentTitles.js       ← Sources/AgentTitles.swift (views)
import { registerRoute } from "../../nav.js";
import { WorkRoot, WorkTargetPickerView, CallConfiguratorView, WorkHistoryView, bindWorkHub } from "./WorkHub.js";
import { WorkCallsView, SessionComposerSheet, SessionRecordView, bindCallTab } from "./CallTabView.js";
import { LiveCallView, bindLiveCall } from "./LiveCallView.js";
import { bindSpotlight } from "./SpotlightDirector.js";
import { PresenterControlSheet, bindAgentTitles } from "./AgentTitles.js";

export { Spotlight, ReplaySpotlight, ProgressRail, BeatHeader, BeatCaption, BeatStage } from "./SpotlightDirector.js";
export { PresenterTitleControl } from "./AgentTitles.js";
export { LiveSessionCard, InvitationRow, SessionRecordCard } from "./CallTabView.js";

export function registerWork(ctx) {
  bindSpotlight(ctx);
  bindAgentTitles(ctx);
  bindLiveCall(ctx);
  bindWorkHub(ctx);
  bindCallTab(ctx);

  registerRoute("work", WorkRoot);
  registerRoute("workCalls", WorkCallsView);
  registerRoute("workHistory", WorkHistoryView);
  registerRoute("sessionRecord", SessionRecordView);
  registerRoute("sessionComposer", SessionComposerSheet);
  registerRoute("liveCall", LiveCallView);
  registerRoute("presenterControl", PresenterControlSheet);
  registerRoute("targetPicker", WorkTargetPickerView);
  registerRoute("callConfigurator", CallConfiguratorView);
}
