# Drive iOS App Store review-readiness plan

**Audit date:** 2026-08-18  
**Policy baseline:** Apple's current
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
last updated June 8, 2026. Re-check the guidelines and
[upcoming submission requirements](https://developer.apple.com/news/upcoming-requirements/)
within 48 hours of every submission.

This is an engineering and release plan, not legal advice. `TODO.md` is the
product backlog; this file is the one canonical App Store/TestFlight gate.

## Readiness verdict

- **Public App Store: NO-GO.**
- **External TestFlight: NO-GO** until the distribution identity, privacy
  manifest, reviewer-accessible backend/demo posture, and account behavior are
  resolved.
- **Local development/simulator review: GO** for product and protocol evidence,
  provided preview data is not represented as production truth.

Debug remains an intentional preview. Release now uses a fail-closed production
channel, but it is a truthful disconnected shell rather than a submittable
product. Apple requires final, fully-functional behavior, accurate metadata,
live supporting services, and review access under Guidelines 2.1–2.3; beta
builds belong in TestFlight.

## Blockers found in the repository

| Blocker | Evidence / consequence |
|---|---|
| Preview distribution identity | Bundle id `ai.drivemode.drive.preview`, version `0.1 (1)`, no team or distribution setup |
| Privacy evidence incomplete | A target-bundled `PrivacyInfo.xcprivacy` now declares tracking false and `UserDefaults` reason `CA92.1`; final required-reason inventory, aggregated report, labels, legal review, and uploaded-binary validation remain |
| Reviewer cannot reach the service | Release rejects loopback/LAN/non-HTTPS writer URLs and has no default endpoint; there is still no authenticated reviewer staging tenant or pairing flow |
| Local-network posture incomplete | Release omits local-network keys. Debug has a scoped purpose string for its loopback preview; any public LAN mode still needs authenticated pairing plus denial/revocation and physical-device tests |
| Account service absent | Release removes preview sign-in/account values and reports “not connected,” but production authentication, sign-out, and in-app account deletion do not exist |
| Commerce undecided | Release hides preview billing, but there are no StoreKit products, entitlement service, restore/manage flow, or approved alternative posture |
| Hosted AI consent not implemented | No production just-in-time disclosure/permission naming what personal, repo, or file data is sent to a third-party AI provider |
| Showcase is not releasable UGC | Release disables the seeded Showcase/social surface; hosted filtering, reporting, blocking enforcement, moderation operations, and deletion are incomplete if it returns |
| Policies are drafts | Placeholder privacy contact, no public policy/support/privacy-choices URLs, and claims that do not yet model production hosted services |
| Release quality evidence incomplete | Unit tests plus production-channel XCUITest and Home/Work accessibility audits now run in the shared scheme; release archive CI, all-root/modal coverage, and the physical-device/VoiceOver matrix remain |
| Icon upload risk | Loose PNG icons, no asset catalog/iPad set, and all current PNGs contain alpha channels |
| Product behavior incomplete | Release no longer exposes preview/demo account/work/social truth, but Work chat, calls, targets, accounts, and microphone steering remain disconnected or incomplete |
| Open delivery stack | Resolved 2026-08-18: all 12 PRs merged (Cline #17's Hub/CLI CI fixed in `9647c40`); the Presenter leave/end reconciliation (harness #4 / MCP #4) merged 2026-08-19. The iOS Xcode suite has not been rerun post-merge |

Official references:
[required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api),
[privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files),
[local-network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy),
and [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

## Gate status overview

| Gate | Current status | Evidence missing before it can advance |
|---|---|---|
| G0 Product scope | **Not started** | Named owners and recorded D01–D12 decisions |
| G1 Distribution | **Blocked** | Release configuration/manifest exist; production identity/team, icons, archive and accepted upload remain |
| G2 Privacy/security | **In progress** | Draft policies exist; production data inventory, consent, labels, public URLs, threat model and sign-off do not |
| G3 Account/commerce | **Blocked** | Real auth/sign-out/deletion and StoreKit or approved non-IAP posture |
| G4 AI/UGC safety | **In progress** | Typed title/Director boundaries exist on open branches; consent, rights, adversarial and moderation evidence remain |
| G5 Quality | **In progress** | Unit/UI and root a11y simulator evidence exist; all-flow coverage and the physical-device matrix remain |
| G6 TestFlight | **Blocked by G1–G5** | Exact candidate, reviewer tenant, beta metadata and exit report |
| G7 Submission | **Not started** | Final metadata, screenshots, ratings, export/trader/storefront answers and second-person audit |
| G8 Release operations | **Not started** | Apple approval, rollout/monitoring ownership and verified rollback path |

### Implemented baseline (2026-08-18)

- `AppConfiguration` defaults unknown channels to production; Release accepts
  only non-local HTTPS writer endpoints and currently has no default service.
- Release starts without seeded agents, work, calls, memory, account outcomes,
  Showcase, feedback experiments, fake billing/sign-in, or developer writer UI.
- `PrivacyInfo.xcprivacy` is bundled with tracking false and `UserDefaults`
  reason `CA92.1`; the built Release plist contains no local-network exception.
- The shared scheme runs 22 unit tests plus three production-channel UI tests,
  including `performAccessibilityAudit` on Home and Work. Simulator Release
  compilation passes; this is not a signed archive/device/upload qualification.
- Settings now has an explicit Reset action that restores the last saved draft.

## Roles

| Role | Accountable work |
|---|---|
| Release DRI | Scope freeze, gates, submission, reviewer communication, release/rollback |
| iOS lead | Distribution project, permissions, manifest, StoreKit client, device/UI tests |
| Backend/account lead | Hub/writer, auth, deletion, reviewer tenant, retention and uptime |
| AI platform lead | Provider routing/consent, safety, retention, local-model limits |
| Trust & Safety | UGC/agent safety, filtering, report/block, moderation SLA and evidence |
| Privacy/legal | Policy, labels, consent, deletion/retention, age and regional declarations |
| Payments lead | Business-model decision, StoreKit, server notifications, entitlement truth |
| Design/accessibility | Product-page assets and common-task accessibility across devices |
| QA | Release/device matrix, permissions/failures, TestFlight exit |
| App Store Connect owner | Agreements, certificates, app record, metadata, export and submission |

One named person must own every row before G0. A person may hold multiple roles.

## Provisional public-v1 scope

This is the recommended lowest-risk release shape. It becomes binding only when
the Release DRI records the G0 decisions. Any expansion must add its service,
privacy, safety, quality, metadata, and reviewer evidence before the release
candidate is cut.

| Capability | Recommended v1 posture | Release condition |
|---|---|---|
| Home, Tasks, Agents, Profile, Settings | Include | Production-backed or truthful empty/degraded state; no seeded account or outcome presented as real |
| Work chat and targets | Include as the core loop | Managed chat lifecycle, authenticated opaque targets, cancellation/resume, and reviewer-accessible synthetic repository |
| Calls and Presenter | Include | Host-created call, exclusive/expiring Presenter authority, canonical leave/end cleanup, reconnect, and replay evidence |
| Hosted Cline agents | Include only as an account-provisioned roster, not a public agent marketplace | Explicit provider/data consent, output reporting, safety evaluation, allowlisted runtime badges, and a documented Guideline 4.7 posture |
| On-device Apple model | Include only if the physical-device matrix passes; otherwise compile/feature-gate it out of v1 | Honest availability, bounded read-only tasks, no cloud fallback, file revocation, thermal/memory/battery evidence |
| Billing & payments | Hide for the fastest free-companion release | If consumer purchases are required, replace this posture with complete StoreKit products, entitlements, restore/manage, server notifications, and review metadata |
| Usage and Analytics | Include only with real user-visible truth | Cline account-service/provider projections or clearly labeled local/current-session measures; no fabricated values or undisclosed analytics stream |
| LAN writer setup | Development/internal only by default | Public enablement requires purpose text, authenticated pairing, denial/revocation UX, hardware testing, and no broad ATS exception |
| Showcase, comments, friends | Disable in Release v1 | Enable only after hosted filter/report/block/moderation/contact/retention/deletion and age controls pass G4 |
| Feedback experiments and automatic A/B tests | Disable in Release v1 | Consent, assignment/exposure policy, outcome guardrails, deletion, privacy-label review, and kill switch |
| Live Activity/widget, downloadable MLX models, public agent marketplace | Defer | Separate product, entitlement, resource, privacy, safety, and review gates after v1 |
| Demo/sample content | Exclude from customer builds | A live synthetic reviewer tenant may contain clearly identified fictional data; it cannot substitute for missing production behavior |

The fastest plausible public path is therefore a free companion to a real
Cline account, with no purchase CTA, no Showcase, HTTPS-hosted reviewer access,
an account-provisioned agent roster, and optional local AI only after device
qualification. If the business requires consumer monetization at launch,
StoreKit becomes critical-path work rather than a follow-up.

## Owner decision register

No release implementation should silently choose these. Record the decision,
owner, date, rationale, and affected gates in the evidence binder.

| ID | Decision required | Recommended default | Needed before | Accountable owner |
|---|---|---|---|---|
| D01 | Public product/developer name, final bundle id, legal seller, trademark rights | Keep persona/model-family labels separate; use a seller-controlled production identifier | G1 App ID | Product + legal + App Store Connect owner |
| D02 | Business model | Free companion with no purchase CTA for v1; otherwise commit to complete StoreKit | G0 scope freeze | Product + payments |
| D03 | Hosted agent scope and Guideline 4.7 classification | Account-provisioned roster only; no public agent marketplace | G0 architecture note | Product + AI platform + legal |
| D04 | Showcase/UGC | Off in v1 | Release feature flags | Product + Trust & Safety |
| D05 | Primary connectivity | Authenticated HTTPS host; LAN hidden unless its full gate passes | Backend implementation | Backend + security + iOS |
| D06 | Account/login method | Cline first-party account; add Sign in with Apple if Guideline 4.8 applies to chosen third-party login | Auth build | Account + legal |
| D07 | Minimum OS and local-AI posture | Keep iOS 17 support; capability-gate the iOS 26 system model | Release configuration | iOS + product |
| D08 | Production retention, export, and deletion by data class | Short documented retention; self-service deletion/export; separately explain user-owned hosts | G2 policy sign-off | Privacy + backend |
| D09 | Microphone value | Implement meaningful steering/call input or remove the claim and permission from v1 | G5 device matrix | Product + iOS |
| D10 | Launch storefronts, languages, trader status, age rating, and regional obligations | Start only in reviewed storefronts/languages; expand deliberately | G7 metadata | Legal + App Store Connect owner |
| D11 | Support, moderation, backend SLO, and incident owner | Monitored channels and on-call coverage throughout review and launch | External TestFlight | Release + backend + Trust & Safety |
| D12 | Release thresholds and rollout | Zero open P0/P1, manual release, then phased rollout after telemetry is healthy | G6 exit | Release DRI |

## Dependency-ordered release program

| Wave | Work | Depends on | Exit artifact |
|---|---|---|---|
| R0 · Scope and ownership | Name every role; decide D01–D12; freeze included/disabled features; assign release DRI | None | Signed scope/decision record and feature-flag matrix |
| R1 · Verify the product foundation | The 12-PR stack, Cline #17 repair, and Harness/MCP #4 reconciliation are merged; finish iOS cleanup projection and verify cross-repository contracts from default branches | R0 scope for any release-visible behavior | Green default branches, merge manifest, cross-repo contract report |
| R2A · Distribution | Production App ID/project settings, signing, icons, versioning, privacy manifest, Release scan, archive/upload CI | D01, D07; can run beside R2B–R2D | Accepted App Store Connect build |
| R2B · Service and accounts | Managed chat/targets/calls, HTTPS reviewer tenant, auth/sign-out/deletion, retention/export, account projections | D02, D03, D05, D06, D08 | End-to-end synthetic reviewer flow and deletion audit |
| R2C · Privacy, AI, safety | Data inventory/labels/policy, hosted-AI consent, title/Director security, adversarial evaluation, UGC disabled or moderated | D03, D04, D08 | Privacy and safety sign-off |
| R2D · Product quality | XCUITest/accessibility, physical iPhone/iPad, file/network/mic/local-AI, performance/energy, offline/recovery | Stable R1 contracts; D07, D09 | Signed release/device matrix with zero P0/P1 |
| R3 · Internal TestFlight | Upload the exact candidate, dogfood every core and failure flow, close release defects | R2A–R2D | Internal beta exit report |
| R4 · External TestFlight | Complete beta review information, keep services live, validate reviewer account and operational SLO | R3, D10–D12 | External beta exit and cross-functional sign-off |
| R5 · App Review | Freeze build/services/flags, complete metadata and evidence packet, submit, answer review | R4 | Apple approval with no unresolved compliance exception |
| R6 · Public release | Manual/phased release, monitor rollback triggers and support, expand rollout only after health checks | R5 | Launch record, monitoring report, rollback readiness |

The critical path is `R0 → R1 → (R2A + R2B + R2C + R2D) → R3 → R4 → R5 → R6`.
Parallel R2 work does not waive dependencies: QA evidence against preview
services, for example, cannot qualify the production backend.

## Release evidence binder

Create one access-controlled, immutable binder per candidate at
`release-evidence/<version>-<build>/`. Do not commit credentials, certificates,
personal data, or reviewer passwords to this repository. The manifest may be
committed; sensitive artifacts belong in approved release storage.

| Folder | Required contents | Sign-off |
|---|---|---|
| `00-scope/` | Release owner/roles, D01–D12, feature matrix, flags, dependency/merge manifest | Product + Release |
| `01-binary/` | Xcode/SDK version, source commit, dependency lock/SBOM, build settings, archive validation, entitlements, manifest report, symbol/upload receipt | iOS + Security |
| `02-privacy/` | Data-flow inventory, public-policy revision, App Privacy answers, required-reason report, consent captures, retention/export/deletion matrix | Privacy/legal |
| `03-account-commerce/` | Login/sign-out/deletion evidence, StoreKit matrix or free/enterprise rationale, entitlement truth, terms/EULA decisions | Account + Payments |
| `04-ai-safety/` | Provider/rights inventory, 4.7 analysis, adversarial results, report/block/moderation evidence, Presenter/Director authorization tests | AI + Trust & Safety |
| `05-quality/` | Unit/UI/a11y results, physical-device/permission/file/network matrix, performance/energy, crash/hang results, open-defect export | QA + Accessibility |
| `06-storefront/` | App record, metadata, screenshots, rating, export/trader/regional answers, support/privacy URLs, reviewer-notes packet | App Store Connect owner |
| `07-beta-review/` | Internal/external TestFlight exits, reviewer account validation record, backend/SLO snapshot, Apple correspondence | QA + Release |
| `08-launch/` | Approval, release decision, rollout checkpoints, monitoring, incidents, rollback or expansion decision | Release DRI |

Every gate below names evidence and a pass condition. A checkbox without the
named artifact and accountable sign-off is not completion.

## Gate sequence

### G0 — Freeze the submittable product

**Owners:** Product + Release DRI

- [ ] Define public-v1 features as included, disabled, or removed.
- [ ] Choose one business model: StoreKit consumer subscription, free companion
      without a purchase CTA, or organization-only service.
- [ ] Decide whether hosted Claude/Codex agents are in v1. If enabled, treat
      their data transfer as third-party AI and assess chatbot/software
      classification under Guideline 4.7.
- [x] Disable Showcase in the current Release channel; keep it off unless hosted
      filtering, report, block, moderation, contact, retention, and deletion are
      operating.
- [x] Keep sample accounts, agents, billing, comments, tasks, repos, and outcomes
      out of reachable Release UI. They remain labeled Debug fixtures until the
      scope owner decides whether to remove them from the compiled target.
- [ ] Prefer a live synthetic reviewer tenant. A fully-featured demo mode may be
      used only with the review posture Apple permits and must not hide missing
      production functionality.
- [ ] Record why Drive is a useful native product: native file picker/local AI,
      approvals, target-aware chat, typed shared surface, calls, accessibility,
      and offline/degraded behavior—not a thin website wrapper.
- [ ] Write the Guideline 4.7 architecture note: agents execute on an authorized
      host; iOS downloads/executes no generated code; native permissions are not
      delegated; the client receives schema-validated typed events, never
      pixels. If selectable agents are treated as offered software, supply the
      required index, metadata, universal links, consent, moderation, and age
      controls.

**Evidence:** signed feature matrix, monetization ADR, 4.7 note, reviewer-data
decision.  
**Pass:** every visible feature has production behavior, an honest description,
and an assigned compliance posture.

### G1 — Distribution identity and uploadable archive

**Owners:** iOS lead + App Store Connect owner

- [ ] Register the final App ID and App Store Connect record, then set the
      matching production bundle id.
- [ ] Confirm the legal seller, Apple Developer Program membership, agreements,
      App Store Connect roles, certificates, and—if paid—tax/banking setup.
- [ ] Configure team, signing, profiles, Release configuration, and only the
      entitlements actually used.
- [ ] Build submissions using Xcode 26 or later and the iOS 26 SDK or later, as
      required since April 28, 2026.
- [ ] Set final version/build values from one build-setting source.
- [ ] Move the icon to an asset catalog or Icon Composer and provide required
      iPhone/iPad treatments with no alpha-channel validation errors.
- [ ] Audit iPhone/iPad packaging: supported orientations, multitasking/Stage
      Manager behavior, device family, launch assets, display name, purpose
      strings, capabilities, and any iPad-specific Info.plist keys.
- [ ] Remove debug URLs, hard-coded accounts, developer controls/instructions,
      and preview-only services from Release.
- [x] Enforce the initial runtime/plist boundary: no reachable seeded account or
      work data, fake sign-in/billing, Showcase, feedback experiments, loopback
      writer, developer writer UI, or local-network Release keys.
- [ ] Provide an authenticated, reviewer-reachable HTTPS staging tenant with
      production-equivalent behavior. Review must not require Bun, a developer
      Mac, a fixed port, or a local scratchpad.
- [ ] If LAN hosting ships, add a precise local-network purpose string,
      authenticated pairing, denial/revocation UI, and hardware tests. Keep ATS
      exceptions no broader than necessary.
- [ ] Archive for a generic iOS device, validate in Organizer, upload, and treat
      all processing warnings as release findings.
- [ ] Make the candidate reproducible from an immutable source commit and lock
      file; record Xcode/SDK versions and emit the archive from CI or a documented
      controlled release machine.
- [ ] Inspect the uploaded build metadata: bundle/version, device family,
      minimum OS, architectures, icons, entitlements, manifest, and symbols.

References:
[prepare for distribution](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution),
[archive and release](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases),
and [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds).

**Evidence:** signed archive, validation report, entitlement dump, accepted
upload and build metadata.  
**Pass:** App Store Connect accepts the Release archive without binary, signing,
manifest, entitlement, icon, or processing errors.

### G2 — Privacy, security, and data truth

**Owners:** Privacy/legal + Security + iOS + AI platform

Create one inventory row for every flow:

`source → data → purpose → destination/controller → processor/model → retention → deletion → label → consent`

Include account identity, chats/commands, typed events, repo metadata, selected
files/source, prompts/responses, title history, purchase history, feedback,
Showcase/relationships if enabled, diagnostics/server logs, and local-only
preferences/intent/presets/local-AI files.

- [x] Add a target-bundled `PrivacyInfo.xcprivacy`.
- [x] Declare `NSPrivacyAccessedAPICategoryUserDefaults` with the approved reason
      matching app-private preference use (currently expected to be `CA92.1`).
- [ ] Audit the Release binary for every required-reason API and future SDK.
- [x] Declare tracking false for the current no-tracking Release; do not add
      tracking domains as decoration.
- [ ] Generate and retain Xcode's aggregated privacy report; validate the
      manifest with `plutil` and an uploaded build.
- [ ] Require signatures/manifests for future SDKs on Apple's
      [third-party SDK requirements list](https://developer.apple.com/support/third-party-SDK-requirements/).
- [ ] Publish durable HTTPS Privacy Policy, Privacy Choices, and Support URLs;
      replace placeholder contact details with monitored channels.
- [ ] Publish Terms of Use/EULA and retention/deletion/export instructions when
      the account or commerce posture requires them.
- [ ] Make the public policy, in-app text, backend, manifest, and App Store
      privacy label agree. Candidate label types depend on final behavior and
      may include contact info, identifiers, user content, purchases, usage
      data, and diagnostics.
- [ ] Before first hosted-AI transfer, identify provider/provider class, exact
      data, purpose, execution location, retention/training posture; obtain
      explicit permission; support refusal/withdrawal and material-change
      re-consent. Guideline 5.1.2 expressly covers third-party AI.
- [ ] Threat-model account takeover, malicious file/repo prompt injection,
      writer impersonation, title escalation, event leakage, and URL tampering.
- [ ] Put credentials in Keychain, authenticate/authorize mutations server-side,
      keep Director/model/tool internals non-exportable, and scan the final
      archive for secrets/dependencies.

References:
[manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy),
[App Review privacy rules](https://developer.apple.com/app-store/review/guidelines/),
and [add a privacy manifest](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk).

**Evidence:** data-flow map, manifest/report, labels worksheet, public URLs,
consent captures, threat model, retention/deletion tests.  
**Pass:** Privacy/legal signs that behavior, disclosures, labels, manifest,
consent, retention, and deletion tell the same story.

### G3 — Accounts, login, deletion, and commerce

**Owners:** Backend/account + Payments + iOS

- [ ] Replace hard-coded account state with authenticated truth or remove
      account UI from v1.
- [ ] Let people use meaningful non-account functionality without login when
      the core does not require an account.
- [ ] Implement Sign Out with local and server token invalidation.
- [ ] Implement Settings → Privacy & account → Delete Account: explain scope,
      confirm intent/identity, initiate full deletion without support email,
      clear local/Keychain/hosted data, expose pending/success/failure, and link
      directly to any unavoidable web completion step.
- [ ] Distinguish Drive-controlled data from events/files in the user's own
      infrastructure, and explain subscription cancellation separately.
- [ ] If Google, GitHub, or another social/third-party service authenticates the
      primary account, provide the equivalent privacy-preserving login required
      by Guideline 4.8 (normally Sign in with Apple), unless an enumerated
      exception applies. If adopted, handle server validation, revocation, and
      deletion-time token revocation.

Apple requires in-app account-deletion initiation when account creation exists:
[account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

Choose and document one commerce route:

1. **StoreKit consumer subscription:** ongoing value, minimum seven-day period,
   cross-device entitlement, clear price/term/renewal/trial disclosure,
   purchase/pending/cancel/refund/revoke/upgrade/grace handling, restore/manage,
   verified transactions, server notifications, sandbox/TestFlight coverage,
   and first subscription submitted with the app.
2. **Free companion:** no IAP and no prohibited external purchase CTA; reviewer
   notes explain the valid companion/business-service posture.
3. **Organization-only:** existing organizational accounts only; no consumer or
   single-user sale in the app.

Do not expose card/payment-method management for consumer digital AI services
without a confirmed storefront/entitlement basis. Reference
[Guideline 3.1](https://developer.apple.com/app-store/review/guidelines/) and
[StoreKit purchases](https://developer.apple.com/documentation/storekit/offering-completing-and-restoring-in-app-purchases).

**Evidence:** auth/deletion audit, login posture, monetization ADR, StoreKit
configuration and transaction matrix.  
**Pass:** no fake account/commerce state remains and each lifecycle completes
end to end.

### G4 — AI, agents, chatbots, UGC, and moderation

**Owners:** AI platform + Trust & Safety + Privacy/legal

- [ ] Inventory every selectable agent/model family, provider, location,
      capability, input/output, retention, consent, and age posture.
- [ ] Keep persona names separate from allowlisted family/location badges; keep
      exact models, keys, endpoints, prompts, tools, scoring, and routing hidden.
- [ ] Retain authorization/trademark evidence for Cline, Claude, Codex, GitHub,
      and any other displayed third-party service.
- [ ] Add agent-output reporting, refusal behavior, rate limiting, abuse
      detection, and monitored support.
- [ ] Adversarially test prompt injection, secret extraction, harassment,
      sexual/self-harm/illegal content, malware requests, and attempts to inherit
      iOS permissions.
- [ ] Verify Presenter grants are exclusive, temporary, scoped, replayable, and
      incapable of pixel capture; reconcile leave/end cleanup across Cline and
      the standalone Harness.
- [ ] If Showcase/comments ship, meet Guideline 1.2: objectionable-content
      filtering, report and timely response, block, published contact, owner
      moderation/unpublish, moderation console/SLA/escalation/audit.
- [ ] If agents fall under Guideline 4.7, add the required indexed catalog,
      metadata/universal links, explicit per-agent permission sharing, and age
      controls.
- [ ] Complete the updated age-rating questionnaire conservatively.

References:
[Guidelines 1.2, 4.7, 5.1 and 5.2](https://developer.apple.com/app-store/review/guidelines/)
and [age ratings](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating).

**Evidence:** provider/rights inventory, consent records, adversarial evaluation,
moderation runbook and screen recording, rating worksheet.  
**Pass:** enabled AI/UGC can be consented to, refused, reported, blocked,
moderated, audited, and deleted.

### G5 — Permissions, files, background behavior, accessibility, quality

**Owners:** iOS + QA + Accessibility

- [ ] Request microphone, notifications, local network, and file access only at
      point of use; test first request, allow, deny, restrict, revoke, and retry.
- [ ] Keep notifications optional and omit sensitive repo/session details from
      lock-screen content by default.
- [ ] Either make microphone input deliver actual chat/call value or remove the
      “talk” claim and unnecessary permission.
- [ ] Keep polling paused in background. Do not add a background mode to keep a
      connection alive; use only purpose-specific audio/task/notification APIs.
- [ ] Implement any Live Activity through WidgetKit/ActivityKit rather than
      continuous app execution.
- [ ] Preserve out-of-process file picking, bounded reads, scoped start/stop,
      and honest revoked access. Directory targets require scoped URLs/bookmarks
      and must never imply whole-filesystem access.
- [ ] Show selected file/folder and on-device/hosted destination. Hosted transfer
      requires separate explicit consent.
- [ ] Test iCloud Drive/Files/third-party providers, moved/deleted/revoked files,
      offline provider, large/non-UTF-8 files, cancellation, memory pressure, and
      prompt injection.
- [ ] Test Foundation Models on eligible/ready, unsupported, Apple Intelligence
      off, model not ready, iOS 17–25, offline, unsupported language, refusal,
      context overflow, cancellation, thermals, battery, and memory.
- [x] Add an XCUITest target with production-channel Home/Work/Profile smoke and
      `XCUIApplication.performAccessibilityAudit` coverage for Home and Work.
- [ ] Extend UI and accessibility coverage to every root/modal and critical
      connected/error flow.
- [ ] Manually test common tasks with VoiceOver, Voice Control, Switch Control or
      keyboard on iPad, Dynamic Type through AX5, Reduce Motion, Increase
      Contrast, Differentiate Without Color, light/dark, portrait/landscape, and
      iPad split view/Stage Manager.
- [ ] Test minimum iOS 17 and current OS, oldest supported class, large-screen
      iPhone/iPad, Wi‑Fi/cellular/offline/IPv6-only, low storage, memory warning,
      force quit, upgrade/reinstall, time-zone change, and backend restart.

Apple permits background services only for intended purposes and requires all
common tasks to work before an Accessibility Nutrition Label claim:
[background strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app),
[accessibility criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/),
and [Foundation Models limits](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models).

**Evidence:** UI/a11y results, Inspector report, device recordings, permission
matrix, performance/energy report, crash metrics.  
**Pass:** zero P0/P1 defects, common tasks accessible, and every failure state
truthful.

### G6 — TestFlight qualification

**Owners:** QA + Release DRI

- [ ] Upload the exact Release configuration intended for App Review.
- [ ] Complete beta description, feedback email, what-to-test, review contact,
      credentials, and export answers.
- [ ] Run internal dogfood, then external TestFlight review.
- [ ] Maintain a non-expiring synthetic reviewer account/tenant and all backend
      dependencies throughout beta and review.
- [ ] Run the account deletion, commerce, provider consent, moderation, file,
      local AI, permission, call/Presenter, and offline/recovery matrices.
- [ ] Track crashes/hangs/launch failures, deletion failures, entitlement
      mismatches, moderation SLA, and backend availability.

Exit thresholds: zero unresolved P0/P1, 100% deletion/entitlement pass, agreed
backend SLO, all permission/fallback tests pass, zero privacy/metadata drift,
and sign-off from Release, Privacy, T&S, Payments, Accessibility, and QA.

**Evidence:** uploaded build id, TestFlight review status, tester/coverage
matrix, defect export, crash/hang and backend-SLO report, cross-functional
sign-off.  
**Pass:** every exit threshold above is met on the exact candidate build.

References:
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
and [test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/).

### G7 — Metadata, export, and submission packet

**Owners:** App Store Connect owner + Marketing + Release DRI

- [ ] Complete name/subtitle/description/keywords/category, final bundle/SKU,
      rights/copyright, updated rating, public privacy/choices/support URLs,
      accessibility labels/URL, trader/regional declarations, storefronts,
      review contact/credentials, and release mode.
- [ ] Limit launch languages/storefronts to those with reviewed metadata,
      policies, support, pricing, ratings, and regional declarations; validate
      every localization in App Store Connect.
- [ ] Capture real in-use iPhone and iPad screenshots—never only splash/login,
      never real-person data, and never claims absent from the uploaded build.
- [ ] Complete IAP/subscription metadata and review screenshots if applicable.
- [ ] Answer export-compliance questions for TLS and any cryptography. If exempt,
      record the signed determination and set
      `ITSAppUsesNonExemptEncryption` correctly; do not guess.
- [ ] Have a second person compare every metadata/privacy claim with the
      installed uploaded build and the evidence binder.

References:
[platform metadata](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/),
[screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/),
[export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance),
and [submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app).

**Evidence:** exported metadata/privacy/rating answers, localized product-page
capture, rights/export determinations, screenshots, reviewer packet, and
second-person comparison record.  
**Pass:** the exact uploaded build and all App Store Connect claims agree and a
second reviewer signs the packet.

### G8 — Review and release operations

**Owner:** Release DRI

- [ ] Freeze build, reviewer account, fixtures, flags, providers, and backend.
- [ ] Monitor messages and answer quickly with reproducible steps/evidence.
- [ ] Map any rejection to the guideline/evidence matrix, reproduce, fix, and
      respond factually through App Store Connect.
- [ ] Prefer manual or phased release for v1.
- [ ] Monitor crashes, launch/auth/deletion, payments, providers, moderation,
      privacy incidents, backend availability, and support after release.

Rollback on any deletion failure, purchase-without-entitlement, undisclosed
provider transfer, consent bypass, unavailable moderation, threshold crash or
backend failure, leaked source/secret/pixels, or title grant exceeding scope.

**Evidence:** submission/approval correspondence, signed release decision,
deployment record, monitoring dashboards, staffed support/escalation roster,
and tested rollback instructions.  
**Pass:** Apple approved the frozen candidate, release proceeded under the
recorded rollout plan, and no rollback trigger is active.

## Guideline-to-evidence coverage

| Apple area | Drive risk | Owning gate/evidence |
|---|---|---|
| 1.2 UGC | Showcase/comments and agent output could expose abusive content | G0 exclusion or G4 filter/report/block/moderation evidence |
| 2.1 completeness | Preview data, localhost dependency, incomplete accounts/services | G0 feature freeze, G1 accepted build, G6 reviewer flow |
| 2.2 beta testing | Preview behavior cannot be submitted as a finished public app | G6 TestFlight qualification before G7/G8 |
| 2.3 metadata | Seeded identities or unsupported “talk,” analytics, local-AI, or call claims | G7 second-person build-to-claim audit |
| 2.4/2.5 performance and background | Local AI, microphone, polling, thermals, iPad behavior | G5 physical-device, energy, lifecycle, and background evidence |
| 3.1 purchases | Digital hosted-agent access and account credits | G0 D02 plus G3 StoreKit or documented permitted posture |
| 4.7 offered software/chatbots | Selectable agents and remote software behavior | G0 classification note plus G4 catalog/consent/safety evidence if applicable |
| 4.8 login | Third-party/social primary authentication | G3 login-method analysis and Sign in with Apple evidence if required |
| 5.1 privacy | Repo/file/message transfer, hosted AI, identifiers, usage, deletion | G2 inventory/manifest/labels/consent plus G3 deletion |
| 5.2 intellectual property | Cline, Claude, Codex, GitHub, fonts, icons, sample repos | G4 rights inventory and G7 content-rights declaration |
| App Store Connect submission requirements | Xcode/SDK, identity, signing, privacy answers, export, rating, screenshots | G1 accepted archive and G7 storefront packet |

The Release DRI calls **GO** only when G0–G7 have pass evidence, all required
sign-offs are present, the exact submitted build is frozen, and no rollback
trigger is already true. Apple approval alone is not permission to release a
different build, change provider/data behavior, or enable an unevaluated flag.

## Release automation

Add to CI/release jobs:

- clean Release build and generic-device archive with stable Xcode 26+;
- unit tests plus XCUITest smoke and accessibility audits;
- `plutil -lint` for Info.plist and `PrivacyInfo.xcprivacy`;
- archive assertions for manifest, icons, dSYM, bundle/version, and expected
  entitlements;
- scans for `.preview`, localhost, hard-coded email/fake billing, seed/demo
  strings, developer commands, secrets, and private endpoints;
- dependency/SBOM and third-party manifest/signature checks;
- App Store Connect upload validation with warnings treated as findings;
- auth/deletion/account/writer/title/StoreKit/consent/report/block/retention
  contract tests;
- network evidence that local mode does not egress file/audio/code;
- deterministic screenshot capture on required iPhone/iPad sizes.

Keep manual gates for permission allow/deny/revoke, StoreKit lifecycle, account
deletion with/without subscription, Sign in with Apple revocation if applicable,
moderation, assistive technologies, local AI availability/refusal/offline,
physical-device layouts, memory/energy, and every product-page claim.

## Risk register

| Risk | Impact | Likelihood now | Owner | Closure evidence |
|---|---:|---:|---|---|
| Preview/demo submitted as final | Critical | Certain | Product | Scope freeze, real services/reviewer tenant, Release scan |
| Manifest/reasons/labels differ from final behavior | Critical | High | iOS/privacy | Final API inventory, approved reasons, privacy report, accepted upload |
| Fake account/no deletion | Critical | Certain | Account | Auth, sign-out, deletion audit |
| Reviewer cannot reach Hub/writer | Critical | High | Backend | HTTPS tenant, monitor, non-expiring access |
| Undisclosed third-party AI transfer | Critical | High | AI/privacy | Just-in-time consent and provider data contract |
| Consumer billing bypasses IAP | Critical | Medium | Payments | Monetization ADR; StoreKit or valid exception |
| UGC/chatbots lack moderation | Critical | High if enabled | T&S | Disable or ship filter/report/block/SLA |
| Policy/label/behavior mismatch | Critical | High | Privacy | One signed data inventory |
| LAN purpose/auth missing | High | High if enabled | iOS/security | Purpose string, pairing, device tests |
| Guideline 4.7 classification surprise | High | Medium | Product/legal | Architecture note, index/links if required |
| No UI/accessibility/device proof | High | Certain | QA/a11y | XCUITest, audits, physical pass |
| Microphone claim has no product value | High | High | Product/iOS | Implement value or remove permission/copy |
| Legacy icon packaging rejected | Medium | High | Design/iOS | Asset catalog/Icon Composer, validation |
| Local-model availability/quality drift | Medium | High | AI/QA | Availability matrix, bounded tasks, no hidden fallback |
| Third-party brand rights unclear | High | Medium | Legal | Rights/terms and approved brand use |
| Presenter policy diverges across hosts | High | High | Platform | Canonical leave/end rules and cross-host tests |

## App Review notes template

```text
Drive for iOS — Review Notes
Build: [version (build)]
Review contact: [name, email, phone]
Support: [URL]
Privacy policy: [URL]
Privacy choices/account deletion: [URL]

PURPOSE
Drive is a native iPhone/iPad client for working with user-authorized software
agents. It renders schema-validated plans, edits, test results, approvals, and
presentation beats. Agents run on an authorized host. iOS does not download or
execute generated code and does not capture or stream host pixels.

REVIEW ACCESS
Username: [non-expiring synthetic account]
Password/login: [instructions]
MFA: [review-safe process]
Tenant: [synthetic reviewer workspace]
All services and providers remain available throughout review.

CORE FLOW
1. Sign in.
2. Open Work and select [synthetic target].
3. Send [deterministic prompt]; expect [result].
4. Tap Call and use preset [name].
5. Transfer Presenter from [agent] to [agent]. Only typed stage content changes;
   no screen/pixel capture occurs.
6. Inspect Settings → Billing, Usage, Analytics, Agents, and On-device AI.
7. Use a secondary account to test Delete Account.
8. [If IAP] Purchase [product] and Restore Purchases.
9. [If UGC] Report [fixture] and block [test user].

PERMISSIONS
Microphone: [exact value; whether audio leaves device]
Notifications: optional [purpose]
Local network: optional authenticated user-owned Hub/writer connection
Files: explicit system picker; hosted transfer needs separate consent

AI AND DATA
Hosted providers: [providers]
On-device: Apple SystemLanguageModel for bounded read-only tasks
Hosted consent shows data, destination, purpose, retention/training posture.
Local mode has no cloud fallback. Withdrawal path: [path].

SAFETY
Filtering/report/block: [paths and behavior]
Moderation contact/SLA: [values]

BUSINESS MODEL
[StoreKit subscription / free companion / organization-only explanation]
Products/manage/restore: [details]

BACKGROUND
[No background mode] OR [precise permitted audio/notification/Activity use]

NON-OBVIOUS DETAILS
- Spotlight is a typed shared surface; Presenter is a temporary exclusive title.
- Director policy is signed, host-side, versioned, and non-exportable.
- Runtime badges are allowlisted families/locations, not exact model IDs.
- The Apple system model can be unavailable; the app reports that honestly.
- Reviewer data is entirely synthetic.

ATTACHMENTS
[architecture/data flow]
[privacy/consent]
[deletion/StoreKit]
[moderation/accessibility]
```
