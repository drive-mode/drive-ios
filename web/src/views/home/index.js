// Home cluster — one module per Swift file. Routes: open, home, needsYou,
// conversation{interruptId}, inbox, approval (medium, light sheet).
import { registerRoute } from "../../nav.js";
import { setContext } from "./shared.js";
import { OpenView } from "./OpenView.js";
import { HomeView } from "./HomeView.js";
import { NeedsYouRouter } from "./NeedsYouView.js";
import { ConversationView } from "./ConversationView.js";
import { InboxView } from "./InboxView.js";
import { ApprovalView } from "./ApprovalView.js";

export function registerHome({ store, nav }) {
  setContext({ store, nav });
  registerRoute("open", OpenView);
  registerRoute("home", HomeView);
  registerRoute("needsYou", NeedsYouRouter);
  registerRoute("conversation", ConversationView);
  registerRoute("inbox", InboxView);
  registerRoute("approval", ApprovalView, { detent: "medium", light: true });
}
