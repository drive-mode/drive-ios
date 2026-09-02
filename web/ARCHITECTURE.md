# Drive local web build — architecture and contract

This directory is a **local, no-Xcode build of the Drive iOS app**: the same
surfaces, vocabulary, data model, wire fold and design tokens as
`Sources/*.swift`, rendered in a browser (desktop frame, or installed to an
iPhone home screen as a PWA). Zero build step, zero network dependencies:
`python3 serve.py` and open the printed URL.

The port is **one JS module per Swift file**, grouped by tab. Read the Swift
file you are porting first — behavior, copy, gates and edge cases come from
there. This document is the shared contract every module builds on.

```text
web/
  index.html            shell; applies appearance before first paint
  serve.py              static server + /discovery + /writer/* proxy (stdlib only)
  manifest.webmanifest  PWA identity (Add to Home Screen)
  vendor/               preact, preact-hooks, htm — vendored, MIT/Apache
  assets/               Schibsted Grotesk, Drive mark (mask), app icon
  src/
    ui.js               html`` + hooks + Observable + useLongPress/useSwipe/haptic
    theme.css           DT tokens (light + dark), primitives, layers
    prefs.js            UserDefaults over localStorage (same keys as Swift)
    models.js           Models.swift: enums, DemoData, DemoScale, ActivityDemo, value types
    store.js            Store.swift + AgentTitles store ext (AppStore, Director)
    wire.js             WriterClient.swift (installed onto AppStore.prototype)
    intent.js           IntentEngine.swift (IntentRecorder, PreheatEngine)
    notifications.js    Notifications.swift (banners + Web Notifications)
    components.js       Components.swift + DriveBrand + ClineBotShape + SwiftUI primitives
    icons.js            SF Symbol name → Lucide SVG (generated)
    nav.js              NavigationStack / sheets / cover / menus / toasts / banners
    app.js              DriveApp.swift: RootView, MainTabs, guide bar, layers
    views/
      index.js          registerAllViews — imports every cluster
      home/             OpenView, HomeView, NeedsYouView, ConversationView, InboxView, ApprovalView
      work/             WorkHub, CallTabView, LiveCallView, SpotlightDirector, AgentTitles (views)
      agents/           AgentsView, AgentSkills, SkillPackages, AgentMemory
      tasks/            TasksView, ProjectMapView, ArtifactsView, ArtifactDetailView, ActivityView
      profile/          ProfileView, ProfileCustomize, SettingsView, ShowcaseView, FeedbackMode, PolicyViews, LocalAI
```

## Rendering model

```js
import { html, useState, useEffect, useMemo, useRef, useObservable, useTick, useFrame, cx, haptic, useLongPress, useSwipe } from "../../ui.js";
import { store }  // NOT importable — receive it from registerX({ store, nav }) or read window.drive.store
```

- Views are Preact function components written with `htm`:
  `` html`<div class=${cx("card", on && "on")}>${label}</div>` ``. Components are
  interpolated: `` html`<${Button} variant="primary" onClick=${fn}>Call</${Button}>` ``.
- **State**: `const s = useObservable(store)` subscribes the component to the
  store; read fields directly (`s.agents`, `s.needsYouCount`, `s.tasksByProject`).
  Mutate only through store methods (they `commit()`), or `store.set({ field })`
  for simple assignments. Never mutate then forget to commit.
- **Local state** stays `useState`. Persisted per-view prefs use `prefs` with
  the same key the Swift file uses (`@AppStorage("reduceMotion")` →
  `prefs.get("reduceMotion", false)`).
- **Time**: `useTick(4)` re-renders at 4 Hz (captions, clocks); `useFrame()`
  per animation frame (Spotlight rail fill only). Keep the Swift render budgets.
- **Motion**: CSS handles springs (`.pressable`, `.pop-in`, `.bounce-in`,
  `.fade-in`). Respect `reducedMotion()` for any JS-driven animation.
- **Dates** are epoch ms. Colors are CSS strings (hex or `var(--maya)`).

## Store surface (port of Store.swift — see the file for the full list)

Fields: `launched inCall showApproval editAllowed micHeld handRaised agents interrupts
workTargets selectedWorkTargetID selectedWorkTarget workChatMessages defaultCallPreset
callPresetForCurrentTarget activeCallPresenterCandidateIDs titleGrantsByID titleEventLog
titleMutationError tasks projects tasksByProject aggByProject orderedProjects attentionTasks
archivedProjects archivedTasks sweeping pinnedProjects neverFileProjects archivedCount
sweepCandidateCount fleetSeeded tabBarVisible skillsVersion wireSkillUse skillPackages
skillBundles memoryFiles upcomingSessions wireUpcomingSessions wireActiveSession
wireActiveProgramId wireEndedSessions lastSessionError feedbackProgramOn feedbackOptIn
experiments feedbackAvailable writerURL wireStatus{live,latestSeq,events} wireDropped
beats callStart beatSkew conversations artifacts inbox unreadInboxCount sessionMessages
needsYouCount openInterrupts reportingCount stuckCount runningTasks programDuration
activePresenterGrant activePresenterAgent presenterEligibleAgents displayedUpcomingSessions
hasLiveSession liveSessionTitle liveSessionPeople hasLiveProgramBeats usesWireSessionRegistry
configuration intent preheat`

Methods: `selectWorkTarget startNewWorkChat sendWorkChat setDefaultCallPreset launchCall
openSettings(tab, source) toggleNeverFile togglePin archiveProject archiveTasks(ids)
sweepArchive restoreProject restoreTask isArchived agg(projectId) searchTasks(q)
scheduleTabBarHide summonTabBar touchTabBar bumpSkills setSkillPackages setSkillBundles
package updatePackage addPackage addBundle setMemoryFiles setUpcomingSessions planSession
removeUpcoming setFeedbackProgramOn setFeedbackOptIn setExperiments variantActive
sweepExperiments startTrial endTrial submitSuggestion markInbox archiveInbox deleteInbox
markAllInboxRead setArtifactLife directorPosition(now) skipToNextBeat skipToPreviousBeat
seekToBeat(i, within) joinCall(presenterCandidates?) leaveCall launch unlaunch
sendSessionMessage allowEdit denyEdit resolveInterrupt thread(interruptId)
sendReply(interruptId, text) callClock(now) applyTitleGrant applyTitleTransfer
applyTitleRevocation requestPresenter(agentId) revokePresenter makePresenterGrant
displayNameForAgent displayNameForUser` + wire: `applyWriterURL startWire pauseWire
postConversation wireSnapshot()` + `Director.position(beats, elapsed)`.

Slices owned by a cluster (`skillPackages`, `skillBundles`, `memoryFiles`,
`experiments`) start as `null` when never persisted: the owning module seeds
them at registration (`if (store.skillPackages == null) store.setSkillPackages(SkillCatalog.builtIns)`),
except in production (`!store.configuration.previewContentEnabled` → `[]`).

## Navigation contract (nav.js)

```js
import { nav, registerRoute } from "../../nav.js";
registerRoute("conversation", ConversationView);        // ({ params, route }) => vnode
nav.push("conversation", { interruptId });               // push onto the current tab's stack
nav.pop(); nav.popToRoot(); nav.selectTab("tasks");
nav.present("settings", { tab: "General", source: "home" }, { detent: "large"|"medium", light: bool });
nav.dismiss(); nav.presentCover("liveCall"); nav.dismissCover(); nav.back();
nav.openMenu({ x, y, title, items: [{ label, icon, danger, disabled, checked, onSelect }] });
nav.toast("Filed 12 tasks", { icon: "archivebox" });
nav.banner({ title, body, icon, tint, action: "Join", onAction });
```

Pushed pages get a slide transition and edge-swipe back for free. Sheets get a
drag handle, backdrop tap, Escape. Long-press: `useLongPress(fn)` or
`showMenu(e, items, { title, preview })` from components.

### Route names (register exactly these; navigate only by name)

| Cluster | Roots | Pushed | Presented |
|---|---|---|---|
| home | `open` `home` | `needsYou` `conversation{interruptId}` `inbox` | `approval` (medium, light) |
| work | `work` | `workCalls` `workHistory` `sessionRecord{id}` | `liveCall` (cover) `sessionComposer` `presenterControl` `targetPicker` `callConfigurator` |
| agents | `agents` | `agent{agentId}` `skillsLibrary` `skill{skillId,agentId?}` `memoryBrowser` `memoryFile{id}` `packages` | `newSkill` `newBundle` `improveSkill{skillId}` |
| tasks | `tasks` | `projectMap{projectId}` `allTasks` `archive` `search` `artifacts` `artifact{id}` `activity` | — |
| profile | — | `profile` `profileCustomize` `showcase` `showProject{id}` `policy{kind:'privacy'|'data'|'feedback'}` `localAI` `neverFile` | `settings{tab,source}` `feedbackChat` |

Cross-cluster hops used by the Swift app (all by name): Home → `needsYou`,
`inbox`, `profile`, `artifacts`, `artifact`, `activity`, `projectMap`,
`conversation`, `settings`; Agents → `skill`, `artifact`, `projectMap`; Tasks →
`conversation`; Inbox → `conversation`, `liveCall` (via `store.joinCall()`);
Settings → `neverFile`, `localAI`, `policy`, `feedbackChat`, `showcase`.

## Components (components.js)

`Icon{name,size,weight,fill,color}` (SF Symbol names — the Swift ones all map;
an unmapped name warns and falls back) · `DriveMark{size,contrast,wiggle}` ·
`DriveSpinner` · `ClineBot{size,color}` · `AvatarChip{letter|name,color,size,speaking,human}`
· `AvatarStack{people}` · `Button{variant:'primary'|'gradient'|'secondary'|'ghost'|'quiet'|'danger'|'onDark',size:'xs'|'sm'|'lg',fill,pill,icon,trailing}`
· `IconButton{name,label,plain,tint,badge}` · `Pressable{onClick,onLongPress}` ·
`Card{hero,pad,gradient,surface2,onClick,onLongPress}` · `Eyebrow` · `Section{eyebrow,title,action,onAction}`
· `Chip{tint,variant:'violet'|'danger'|'solid'|'outline',icon,pill}` · `LivePill{onGradient}` · `PreviewChip`
· `StateChip{state}` · `HonestyDots` · `Badge{count}` · `ProgressBar{value,tint}` · `Divider` ·
`Empty{icon,title,body,action,onAction}` · `Waveform{color,barCount,height,live,level}` ·
`NavBar{title,back,onBack,leading,trailing,subtitle}` · `HomeToolbarButton` · `SettingsToolbarButton{tab,source}`
· `Screen{title|largeTitle,back,trailing,leading,root,footer,scrollRef}` · `Row{icon,iconTint,leading,title,subtitle,trailing,chevron,onClick,onLongPress,checked}`
· `RowGroup{header,footer}` · `Toggle` · `ToggleRow` · `Segmented{options,value,onChange}` ·
`TextField{value,onInput,placeholder,multiline,icon,onSubmit,autoFocus}` · `SearchField` · `PickerRow{title,value,options,onChange}`
· `showMenu(e, items, {title})` · `Stat` · `CountUp{value}` · `DiffLine{text,added}` · `Spacer{h}`.

Root tab pages use `<Screen root ...>` (leaves room for the guide bar);
pushed pages use `<Screen back ...>`. Every non-Home root carries
`leading=${html`<${HomeToolbarButton} />`}` and a `SettingsToolbarButton`.

## Design tokens (theme.css)

`--violet --violet-hi --violet-deep --violet-text --danger --page --surface
--surface2 --well --ink --ink-78 --ink-55 --ink-35 --ink-18 --ink-08 --hairline
--live --diff-green --maya --coder --scout --indexer --tint-plan/diff/report/
replay/doc/capture/teal/amber/blue/lime/pink --r-control --r-card --r-hero
--hero-gradient --font --mono --safe-top --safe-bottom --tabbar-h`. Utility
classes: `.card .pad .hero .gradient .btn .chip .row .list .section .eyebrow
.hstack .vstack .grow .grid2 .grid3 .truncate .clamp2 .mono .muted .faint
.t-xs .t-sm .t-lg .t-xl .t-hero .w6 .w7 .w8 .glass .diff-line .skeleton`.
Add view-specific CSS at the top of the view module via a `<style>` string
injected once (see `injectStyle(id, css)` pattern: `document.head` append if
absent) — keep it token-only, no ad-hoc hex.

## Rules that carry over unchanged

- Vocabulary: **Work** tab, **Chat** default, **Call** explicit; **Spotlight**
  surface, **Presenter** title, **Director** policy. Never "Start".
- No pixels on the stage — beats are typed steps. No prompts, tool lists,
  endpoints, keys or model ids anywhere in UI; runtime badges are family +
  location only.
- Voice: measure level, drop audio. Never transcribe or persist.
- Production channel (`?channel=production`) fails closed: no seeds, no
  preview account, no Showcase, no experiments, no billing, no loopback writer.
  Gate on `store.configuration.*Enabled`.
- Archived work is never deleted. Accessibility: labels on icon buttons, rows
  and map nodes; `aria-live` where the Swift view announces; Reduce Motion stills
  waveform/pulse/beat decoration.
- Copy stays honest: preview, disconnected, unpersisted states say what they are.

## Verify

```bash
python3 web/serve.py            # open http://127.0.0.1:8787/
node tools/smoke.mjs            # (scratch) headless walk + console-error check
```
