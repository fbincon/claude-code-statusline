# Development plan

**English** | [简体中文](development-plan.zh-CN.md) · [Roadmap](roadmap.md) · [Development guide](README.md)

Use this plan to define work-package scope, dependencies, implementation slices and functional acceptance. The [roadmap](roadmap.md) owns priorities and status. The [history index](history/README.md#delivery-records) links implementation, publication and validation evidence. See the [user guide](../USER_GUIDE.md) for current usage and the [translation guide](i18n.md) for language maintenance.

<a id="work-index"></a>

## Work package index

- **Current planning** · [Unselected candidates and entry conditions](roadmap.md#candidates) · [Shared design rules](#design-rules) · [Acceptance matrix](#acceptance-matrix) · [Handoff](#handoff)
- **Delivered work** · [Original designs](history/work-package-designs.md#completed-designs) · [Delivery and verification records](history/README.md#delivery-records)

<a id="design-rules"></a>

## Shared design rules

- **Product focus:** the status line presents tasks, agents, projects and usage clearly; existing on-demand entry points provide detail and explanation. Preserve real zero and distinct missing, stale, partial or unsupported states. Do not infer task outcomes without evidence.
- **Shared implementation:** core owns pure configuration, catalog, Unicode, layout and explanation; platform owns files, processes and terminals; cli orchestrates services; tui and native Mods adapt interactions. Reuse existing transactions and task stores. [Current architecture](architecture.md).
- **Configuration boundaries:** UI language saves immediately, display language and appearance follow display Save, and Claude preferences retain separate Apply. Preview, import review and scheme selection produce candidate drafts. Make user default, named profile and project editing targets clear. [Profile semantics](../PROFILES.md).
- **Compatibility.** Interfaces evolve independently. Use the [shared contracts](contracts.md) for current versions. Specify added fields and the interpretation of old data before assigning versions. Keep reads read-only and use the existing backup and recovery mechanisms for migrations.
- **Extension authorization:** default capabilities use host input and local state. External file sources, network providers and commands are separately enabled and registered in user configuration. A display scheme may reference a source, but import, preset selection and project binding cannot grant execution or network access.
- **Scope boundaries:** select the work package from the roadmap before defining its scope. Existing setup, selective import, static component gradients, explicit row alignment, GitHub automatic refresh and CLI version management remain delivered. Further providers, data and longer-term directions retain separate entry conditions in the [candidate pool](roadmap.md#candidates). Reuse existing global-appearance import; component-style and group reuse belong to IMPORT-02.
- **Future interfaces:** describe configuration intent, data flow and compatibility before assigning future schema/protocol versions or public command spellings. Reuse catalog capabilities and generated editor resources. New options must survive preview, save/reopen, profile selection, import/export and conflict handling; reading an old configuration does not enable new behavior.
- **Localization:** follow the [state, release and reuse rules](i18n-workflow.md): complete A languages during development, safe current-English B fallback, and complete A/B public releases. Keep translation-bound acceptance, shared message origins, independent UI/output persistence and existing Native boundaries.
- **Native presentation:** preserve v3.9.1's host-retained complete state and bounded visible frames. New managers, task details, histories and previews must budget outbound props, the outer Pane and the Client tree independently, including plain Pane paths. Keep paging, selected content, whole graphemes and colored previews; shrink presentation rather than stored configuration. Recovery stays outside a rejected tree, retains the draft and distinguishes saved, pending and unknown outcomes. Use the existing [capacity and recovery](native-capacity.md) rules and applicable actual-host coverage.
- **Frontend capability:** both editors use the same business rules and principal capabilities, with platform-appropriate layouts and controls. Page long lists/details; keep libraries, candidate drafts and undo history in the host. Read-only views and review must preserve their side-effect boundaries.
- **Focused validation:** select a changed user journey and adjacent regression combinations from the affected rules. Extend existing suites without requiring a new complete journey, separate PR or Cartesian matrix per slice. Ready product PRs and candidate promotion retain their current [CI requirements](ci-maintenance.md); this planning update changes no acceptance policy.

<a id="acceptance-matrix"></a>

## Functional acceptance matrix

| Area | Applies to | Completion evidence |
| --- | --- | --- |
| User journey | Changed user-visible flows | Relevant entry/action/result and cancel/error paths; add save/reopen or recovery where the change affects them, reusing existing journeys |
| Both editors and CLI | Configuration and components | The same input/configuration yields consistent rules, options and explanations |
| Registered languages and terminal | UI, display and guidance | `en/zh-CN/zh-TW/zh-HK/ja/ko/es/fr/de/pt-BR/ru/id`; main/subagent 40/80/120 columns; native minimum 32×12 and external minimum 64×18, including undersized handling |
| Translation lifecycle | I18N-02 | All four source changes, translation-bound acceptance, safe deterministic fallback and truthful search; strict release readiness for all official languages plus compatible original-evidence reuse |
| Data sources | Extensions, tasks and diagnosis | Distinguishable sample/actual, source/scope and zero/missing/stale/partial/error states |
| Save and recovery | Installation and persistence | Old configuration, instance identity, project bindings, concurrent revisions, migration backups, cancellation and failure recovery |
| External capabilities | EXTENSIONS-01/WORKFLOW-01/COMMAND-01 | Off by default, explicitly enabled and independently disabled; import/preview cannot execute or access the network |
| Indicators/groups/rates | APPEARANCE-03/COMPOSITION-02/METRICS-01 | Unchanged defaults, explicit instance choices, trustworthy data meaning, linked visibility and valid configuration round trips |
| Automatic lifecycle | FIX-03/COMMAND-02/SOURCES-01; delivered WORKFLOW-02 | Consumer-aware release, explicit whole-job cancel, separate automatic approval, active-session leases, revision/context isolation and late-result rejection |
| Windows preview consistency | TERMINAL-01 and affected appearance/demonstrations | Same artifact/configuration across setup, configure and slash paths; actual console evidence, explicit capability overrides and terminal restoration |
| Durable installation and version transitions | SETUP-02/UPDATE-01 | Reviewed exact version/prefix, persistent binding, no automatic elevation, explicit stage outcomes and separate package/configuration recovery |
| Selective reuse | IMPORT-01 and later display options | Both slices accepted; unselected state preserved, reference closure/ID mapping valid, no imported source authorization, preview/save/reopen parity |
| Gradients and alignment | APPEARANCE-04/COMPOSITION-03 | Foreground and background both verified; warnings and group edges intact; explicit main-row relationships, narrow fitting and terminal fallbacks correct |
| Platforms and hosts | Features affecting them | Existing Node 22/24, supported platforms and applicable host verification; gaps retain their actual status |
| Artifacts and demonstrations | Feature delivery and SHOWCASE-01 | The original eighteen formal follow-up packages and every slice accepted before demonstrations; reproducible matching artifacts with explicit version/input/provenance |
| Native capacity/recovery | Every new or changed native page, including task details | Independently bounded props, Pane and Client trees; production-sized data, large/tall panes, paging/resize and retained draft/save outcomes, using applicable actual-host suites |
| Focused combinations | Relevant changed rules | Bars × labels/icons; gradients × groups/visibility/spacer/alignment; source execution × consumers/cancel/revisions; updates × dirty drafts/interruption/old resources; imports × bindings/references/conflicts; tasks × identity/staleness/refresh/reading position |

Select targeted combinations above within existing suites; do not expand every axis into a Cartesian matrix or require an extra full acceptance run per slice. Existing ready-PR gates and verified main/tag promotion remain governed by [CI maintenance](ci-maintenance.md).

Functional tests use isolated directories and synthetic or sanitized inputs, without reading/writing the user's actual configuration. Network verification and actual tool execution follow the explicit scope of the corresponding development task. Follow the then-applicable [testing guide](testing.md) and [release procedure](../RELEASING.md). Record automated checks, PTY reconstruction, agent visual inspection and human acceptance separately. Retain the six existing #96 gaps; version-specific acceptance, including v3.7.0, does not establish future-version verification.

<a id="handoff"></a>

## Implementation handoff and document maintenance

At package start, record then-current main, selected scope, affected modules, configuration/protocol decisions and the first deliverable slice. Each package retains its user problem, expected journey, first-version boundaries, module responsibilities, interface/compatibility impact, slices and completion evidence. Reflect scope changes in both languages of this plan and the roadmap. Keep usage documentation with implementation rather than announcing availability early.

A handoff includes package/status, completed slices, remaining issues, source/PR identity, validation commands/results and the next step. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`. Record package completion and version publication separately; a merged slice does not complete the whole package. Add artifacts and channel evidence when a version is published.

The [roadmap](roadmap.md) owns priority/status and this plan owns scope/acceptance. Both are public repository documents with complete Simplified Chinese counterparts. Keep local historical snapshots and raw validation records separate; public navigation must work without them. Migration-stage status remains in the [migration plan](typescript-migration.md), and feature delivery evidence stays in the corresponding implementation record.

For documentation acceptance, compare IDs, order, dependencies, roadmap-owned statuses, slice coverage and navigation across the bilingual planning/index files and linked translation guide/workflow; check delivered facts, links and anchors. The earlier I18N-02 design-only update covered five pairs and kept proposed behavior separate from the then-current guide. Implementation and publication now have their own linked evidence. Run `npm run docs:check` and `git diff --check`, including a documentation check against a checkout containing only committed files. Documentation checks do not establish feature acceptance; keep later documentation-only maintenance separate from runtime changes.

<a id="completed-designs"></a>

## Delivered work package designs

The [work package design archive](history/work-package-designs.md#completed-designs) holds the original designs, schedules and acceptance criteria. The links below open individual sections.

| Former section | Original design |
| --- | --- |
| <a id="review-baseline"></a><a id="review-baseline-and-evidence-limits"></a>Review baseline and evidence limits | [Archived section](history/work-package-designs.md#review-baseline) |
| <a id="original-work-package-schedules"></a>Original work package schedules | [Archived section](history/work-package-designs.md#original-work-package-schedules) |
| <a id="candidate-boundaries"></a>Candidate boundaries | [Archived section](history/work-package-designs.md#candidate-boundaries) |
| <a id="future-work"></a><a id="mainline-product-and-maintenance-packages"></a><a id="delivered-follow-up-packages"></a>Delivered follow-up packages | [Archived section](history/work-package-designs.md#mainline-product-and-maintenance-packages) |
| <a id="delivered-mainline"></a><a id="delivered-mainline-designs"></a>Delivered mainline designs | [Archived section](history/work-package-designs.md#delivered-mainline) |
| <a id="delivered-designs"></a><a id="delivered-designs-and-retained-demonstration-package"></a>Delivered designs and retained demonstration package | [Archived section](history/work-package-designs.md#delivered-designs) |

<details>
<summary>Expand the work-package index retained for older links</summary>

| Work package / entry | Archive |
| --- | --- |
| <a id="planned-work"></a><a id="follow-up-schedule"></a>Follow-up schedule | [Original design](history/work-package-designs.md#planned-work) |
| <a id="delivered-work"></a><a id="earlier-milestones-and-maintenance-schedule"></a>Earlier milestones and maintenance schedule | [Original design](history/work-package-designs.md#delivered-work) |
| <a id="i18n-02"></a><a id="i18n-02-incremental-multilingual-development-and-release-readiness"></a>I18N-02 Incremental multilingual development and release readiness | [Original design](history/work-package-designs.md#i18n-02) |
| <a id="fix-01"></a><a id="fix-01-protect-drafts-while-save-results-are-unknown"></a>FIX-01 | [Original design](history/work-package-designs.md#fix-01) |
| <a id="fix-02"></a><a id="fix-02-compose-bars-and-labels-consistently"></a>FIX-02 | [Original design](history/work-package-designs.md#fix-02) |
| <a id="fix-03"></a><a id="fix-03-separate-refresh-execution-from-waiting-consumers"></a>FIX-03 | [Original design](history/work-package-designs.md#fix-03) |
| <a id="fix-04"></a><a id="fix-04-make-extension-diagnosis-time--and-agent-applicable"></a>FIX-04 | [Original design](history/work-package-designs.md#fix-04) |
| <a id="i18n-01"></a><a id="i18n-01-initialize-task-detail-language-independently"></a>I18N-01 Initialize task-detail language independently | [Original design](history/work-package-designs.md#i18n-01) |
| <a id="appearance-05"></a><a id="appearance-05-expand-themes-and-gradient-selection"></a>APPEARANCE-05 | [Original design](history/work-package-designs.md#appearance-05) |
| <a id="preview-01"></a><a id="preview-01-select-sample-scenarios"></a>PREVIEW-01 | [Original design](history/work-package-designs.md#preview-01) |
| <a id="explain-02"></a><a id="explain-02-explain-inactive-configuration-and-explicit-input"></a>EXPLAIN-02 | [Original design](history/work-package-designs.md#explain-02) |
| <a id="task-02"></a><a id="task-02-external-read-only-task-details"></a>TASK-02 | [Original design](history/work-package-designs.md#task-02) |
| <a id="update-02"></a><a id="update-02-version-review-execution-and-protected-history"></a>UPDATE-02 | [Original design](history/work-package-designs.md#update-02) |
| <a id="sources-01"></a><a id="sources-01-readable-source-operations-and-binding-maintenance"></a>SOURCES-01 | [Original design](history/work-package-designs.md#sources-01) |
| <a id="command-02"></a><a id="command-02-commands-scheduled-by-active-sessions"></a>COMMAND-02 | [Original design](history/work-package-designs.md#command-02) |
| <a id="appearance-06"></a><a id="appearance-06-continuous-backgrounds-within-a-row"></a>APPEARANCE-06 | [Original design](history/work-package-designs.md#appearance-06) |
| <a id="appearance-07"></a><a id="appearance-07-adaptive-bars-that-preserve-numeric-meaning"></a>APPEARANCE-07 | [Original design](history/work-package-designs.md#appearance-07) |
| <a id="ux-03"></a><a id="ux-03-shared-draft-history-and-external-recovery"></a>UX-03 | [Original design](history/work-package-designs.md#ux-03) |
| <a id="import-02"></a><a id="import-02-reuse-styles-and-complete-groups"></a>IMPORT-02 | [Original design](history/work-package-designs.md#import-02) |
| <a id="composition-04"></a><a id="composition-04-review-alignment-repairs-with-structural-edits"></a>COMPOSITION-04 | [Original design](history/work-package-designs.md#composition-04) |
| <a id="profile-02"></a><a id="profile-02-scenario-schemes-using-delivered-capabilities"></a>PROFILE-02 | [Original design](history/work-package-designs.md#profile-02) |
| <a id="git-01"></a><a id="git-01-git-invocation-review-and-necessary-protections"></a>GIT-01 | [Original design](history/work-package-designs.md#git-01) |
| <a id="terminal-01"></a><a id="terminal-01-windows-preview-consistency"></a>TERMINAL-01 | [Original design](history/work-package-designs.md#terminal-01) |
| <a id="setup-02"></a><a id="setup-02-first-entry-and-durable-installation"></a>SETUP-02 | [Original design](history/work-package-designs.md#setup-02) |
| <a id="update-01"></a><a id="update-01-explicit-upgrades-and-rollback"></a>UPDATE-01 | [Original design](history/work-package-designs.md#update-01) |
| <a id="import-01"></a><a id="import-01-selective-configuration-reuse"></a>IMPORT-01 | [Original design](history/work-package-designs.md#import-01) |
| <a id="appearance-04"></a><a id="appearance-04-static-foreground-and-powerline-background-gradients"></a>APPEARANCE-04 | [Original design](history/work-package-designs.md#appearance-04) |
| <a id="composition-03"></a><a id="composition-03-alignment-across-explicit-main-rows"></a>COMPOSITION-03 | [Original design](history/work-package-designs.md#composition-03) |
| <a id="appearance-03"></a><a id="appearance-03-graphical-context-and-quota-indicators"></a>APPEARANCE-03 | [Original design](history/work-package-designs.md#appearance-03) |
| <a id="composition-02"></a><a id="composition-02-component-groups-and-linked-visibility"></a>COMPOSITION-02 | [Original design](history/work-package-designs.md#composition-02) |
| <a id="workflow-02"></a><a id="workflow-02-opt-in-automatic-github-prci-refresh"></a>WORKFLOW-02 | [Original design](history/work-package-designs.md#workflow-02) |
| <a id="metrics-01"></a><a id="metrics-01-session-cost-rate"></a>METRICS-01 | [Original design](history/work-package-designs.md#metrics-01) |
| <a id="setup-01"></a><a id="setup-01-first-use-and-configuration-entry"></a>SETUP-01 | [Original design](history/work-package-designs.md#setup-01) |
| <a id="appearance-01"></a><a id="appearance-01-complete-display-schemes"></a>APPEARANCE-01 | [Original design](history/work-package-designs.md#appearance-01) |
| <a id="appearance-02"></a><a id="appearance-02-appearance-controls-and-boundaries"></a>APPEARANCE-02 | [Original design](history/work-package-designs.md#appearance-02) |
| <a id="showcase-01"></a><a id="showcase-01-homepage-and-usage-demonstrations"></a>SHOWCASE-01 | [Original design](history/work-package-designs.md#showcase-01) |
| <a id="extensions-01"></a><a id="extensions-01-local-json-data-foundation"></a>EXTENSIONS-01 | [Original design](history/work-package-designs.md#extensions-01) |
| <a id="links-01"></a><a id="links-01-clickable-text"></a>LINKS-01 | [Original design](history/work-package-designs.md#links-01) |
| <a id="workflow-01"></a><a id="workflow-01-optional-github-pr-and-ci-lookup"></a>WORKFLOW-01 | [Original design](history/work-package-designs.md#workflow-01) |
| <a id="command-01"></a><a id="command-01-explicit-user-command-components"></a>COMMAND-01 | [Original design](history/work-package-designs.md#command-01) |
| <a id="capabilities-01"></a><a id="capabilities-01-component-capability-descriptions"></a>CAPABILITIES-01 | [Original design](history/work-package-designs.md#capabilities-01) |
| <a id="ci-01"></a><a id="ci-01-pin-actions-references"></a>CI-01 | [Original design](history/work-package-designs.md#ci-01) |

</details>
