# Development plan

**English** | [简体中文](development-plan.zh-CN.md) · [Roadmap](roadmap.md) · [Development guide](README.md)

Updated: **2026-10-28** (Asia/Shanghai) · Product baseline: **v3.9.1** · Planning baseline: **`0f5638f613c8ffc9588a50d30ebc51f14549b1fb`**

This plan defines work-package scope, dependencies, slices and functional acceptance. The [roadmap](roadmap.md#milestones) owns current priority and status. M1–M12 remain delivered, and [v3.9.1 native capacity and recovery](native-capacity.md) is the current product baseline. The formal follow-up contains eighteen new packages and SHOWCASE-01. FIX-01–FIX-04 and I18N-01 are implemented and validating for v3.9.2; the [correctness record](correctness-maintenance.md) owns actual interfaces and evidence. Remaining unstarted entries have no assigned versions or dates.

Completed sections retain historical designs and acceptance intent. Their proposed fields and evidence requirements describe the original plan; current behavior, identities and verification limits remain in the linked user guides and delivery records. The previous planning snapshot at `f68d26eeddda98ab4041d2b9e873ade556fa1909` is historical. The six [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified; the [v3.9.1 decision](../releases/approvals/v3.9.1.json) records acceptance for that release without passing those missing observations.

**Navigation:** [Index](#work-index) · [Shared design](#design-rules) · [Review baseline](#review-baseline) · [Future work](#future-work) · [Git review](#git-01) · [Windows previews](#terminal-01) · [First entry](#setup-02) · [Version management](#update-01) · [Selective import](#import-01) · [Gradients](#appearance-04) · [Alignment](#composition-03) · [Demonstrations](#showcase-01) · [Candidates](#candidate-boundaries) · [M4–M7 designs](#appearance-03) · [Earlier designs](#delivered-designs) · [Acceptance](#acceptance-matrix) · [Handoff](#handoff)

<a id="work-index"></a>

## Work package index

### Planned work

| Batch | Work packages and slices | Scope and real prerequisites |
| --- | --- | --- |
| 1 Correctness/maintenance | [FIX-01](#fix-01), [FIX-02](#fix-02), [FIX-03](#fix-03), [FIX-04](#fix-04), [I18N-01](#i18n-01) | Existing save, render, source, diagnosis and task-language gaps; independent regression cases |
| 2 Appearance/understanding | [APPEARANCE-05](#appearance-05), [PREVIEW-01](#preview-01), [EXPLAIN-02](#explain-02) | Reuse current appearance, sample renderer and explanation; extension diagnosis depends on FIX-04 |
| 3 Entry points | [TASK-02](#task-02), [UPDATE-02](#update-02) slice 1 | Existing task model and package-review services; task language follows I18N-01 |
| 4 Execution | [SOURCES-01](#sources-01) slices 1/2, [COMMAND-02](#command-02), [UPDATE-02](#update-02) slice 2 | Shared refresh lifecycle follows FIX-03; package execution follows review and safe draft/process handoff |
| 5 Continuous gradients | [APPEARANCE-06](#appearance-06) | Existing final layout, groups, Powerline and alignment |
| Later, interleavable | [APPEARANCE-07](#appearance-07), [UX-03](#ux-03), [IMPORT-02](#import-02), [COMPOSITION-04](#composition-04), SOURCES-01 slice 3, UPDATE-02 slice 3, [PROFILE-02](#profile-02) | Respective shared rules; scene schemes depend only on the capabilities they use |
| Final | [SHOWCASE-01](#showcase-01) | Acceptance of all eighteen new packages and every slice, followed by matching installed artifacts |

The roadmap is the current status register. Batches are scheduling preferences, not an extra dependency chain. UPDATE-02 and SOURCES-01 each retain one package identity across slices; record slice completion in handoffs and complete the package only after all its slices are accepted. Remaining candidates do not block this mainline. Keep M1–M12 numbering and prior M13/SHOWCASE-01 scheduling in their historical context.

### Delivered work

| Stage | Work package | Dependencies and scheduling | Status |
| --- | --- | --- | --- |
| M1 | [SETUP-01](#setup-01) | Existing installation transactions, Quick setup and editors | DONE |
| M2 | [APPEARANCE-01](#appearance-01) | Existing presets, profiles and project bindings | DONE |
| M2 | [APPEARANCE-02](#appearance-02) | Actual APPEARANCE-01 display scenarios | DONE |
| M3 | [EXTENSIONS-01](#extensions-01) | Existing diagnosis, instances and local-file adapters | DONE |
| M3 | [LINKS-01](#links-01) | Existing text and layout rules; no network dependency | DONE |
| M3 | [WORKFLOW-01](#workflow-01) | EXTENSIONS-01; LINKS-01 is optional | DONE |
| M3 | [COMMAND-01](#command-01) | EXTENSIONS-01; can ship independently of WORKFLOW-01 | DONE |
| M4 | [APPEARANCE-03](#appearance-03) | Existing context/quota observations, formatting and layout | DONE |
| M5 | [COMPOSITION-02](#composition-02) | Existing instances, visibility and Powerline; independent of M4 | DONE |
| M6 | [WORKFLOW-02](#workflow-02) | Delivered EXTENSIONS-01 and WORKFLOW-01; GitHub only | DONE |
| M7 | [METRICS-01](#metrics-01) | Existing session cost and duration fields; independent of M6 | DONE |
| Independent maintenance | [GIT-01](#git-01) | Existing Git/process adapters; independent of product order | DONE |
| Independent maintenance | [TERMINAL-01](#terminal-01) | Existing terminal detection/launch paths; inform affected Windows acceptance | DONE |
| M8 | [SETUP-02](#setup-02) | Delivered SETUP-01 and installation/recovery mechanisms | DONE |
| M9 | [UPDATE-01](#update-01) | SETUP-02 installation identity and existing compatibility/recovery rules | DONE |
| M10 | [IMPORT-01](#import-01) | Existing import review, instances, groups, layouts and profile transactions | DONE |
| M11 | [APPEARANCE-04](#appearance-04) | Existing color, Powerline, group and editor rules | DONE |
| M12 | [COMPOSITION-03](#composition-03) | Existing explicit layout, groups, Unicode width and fitting | DONE |
| As needed | [CAPABILITIES-01](#capabilities-01) | Include when related features expose specific duplicate or inconsistent metadata | DONE |
| Maintenance | [CI-01](#ci-01) | Independent maintenance; does not block M1/M2/M3 | DONE |

M1 → M2 → M3 → M4–M7 records the historical delivery sequence. SHOWCASE-01 was originally scheduled with M2, M8 and M13; its retained ID now follows all selected improvement packages. Documentation updates do not change feature statuses. CI-01 includes weekly Dependabot proposals for same-major Actions updates. See [implementation and validation](ci-maintenance.md).

<a id="design-rules"></a>

## Shared design rules

- **Product focus:** the status line presents tasks, agents, projects and usage clearly; existing on-demand entry points provide detail and explanation. Preserve real zero and distinct missing, stale, partial or unsupported states. Do not infer task outcomes without evidence.
- **Shared implementation:** core owns pure configuration, catalog, Unicode, layout and explanation; platform owns files, processes and terminals; cli orchestrates services; tui and native Mods adapt interactions. Reuse existing transactions and task stores. [Current architecture](architecture.md).
- **Configuration boundaries:** UI language saves immediately, display language and appearance follow display Save, and Claude preferences retain separate Apply. Preview, import review and scheme selection produce candidate drafts. Make user default, named profile and project editing targets clear. [Profile semantics](../PROFILES.md).
- **Compatibility:** the current baseline is display schema 15, editor protocol 25, source registry 2/jobs 3, source observation 1, runtime 3, lifecycle 4, portable 1, UI preferences 1 and profile collection/export 1. These interfaces evolve independently. Specify added fields and the interpretation of old data before assigning versions. Reading old files does not silently rewrite them; migrations use existing backup and recovery mechanisms.
- **Extension authorization:** default capabilities use host input and local state. External file sources, network providers and commands are separately enabled and registered in user configuration. A display scheme may reference a source, but import, preset selection and project binding cannot grant execution or network access.
- **Scope boundaries:** the formal follow-up is listed above. Existing setup, selective import, static component gradients, explicit row alignment, GitHub automatic refresh and CLI version management remain delivered. Further providers, data and longer-term directions retain separate entry conditions in the [candidate pool](roadmap.md#candidates). Reuse existing global-appearance import; component-style and group reuse belong to IMPORT-02.
- **Future interfaces:** describe configuration intent, data flow and compatibility before assigning future schema/protocol versions or public command spellings. Reuse catalog capabilities and generated editor resources. New options must survive preview, save/reopen, profile selection, import/export and conflict handling; reading an old configuration does not enable new behavior.
- **Native presentation:** preserve v3.9.1's host-retained complete state and bounded visible frames. New managers, task details, histories and previews must budget outbound props, the outer Pane and the Client tree independently, including plain Pane paths. Keep paging, selected content, whole graphemes and colored previews; shrink presentation rather than stored configuration. Recovery stays outside a rejected tree, retains the draft and distinguishes saved, pending and unknown outcomes. Use the existing [capacity and recovery](native-capacity.md) rules and applicable actual-host coverage.
- **Frontend capability:** both editors use the same business rules and principal capabilities, with platform-appropriate layouts and controls. Page long lists/details; keep libraries, candidate drafts and undo history in the host. Read-only views and review must preserve their side-effect boundaries.
- **Focused validation:** select a changed user journey and adjacent regression combinations from the affected rules. Extend existing suites without requiring a new complete journey, separate PR or Cartesian matrix per slice. Ready product PRs and candidate promotion retain their current [CI requirements](ci-maintenance.md); this planning update changes no acceptance policy.

<a id="review-baseline"></a>

## Review baseline and evidence limits

The [discussion](https://chatgpt.com/share/6ae0c882-881c-83ee-9ef1-ee77a1f69e3b) was checked against `0f5638f613c8ffc9588a50d30ebc51f14549b1fb`, product v3.9.1, on 2026-10-28. The following probes used synthetic inputs and in-memory storage/backend substitutes; they did not write the user's configuration, launch source commands or establish installed-host acceptance. Rendering/source/diagnosis probes used the existing compiled implementation checked against the corresponding source; the native key probe loaded the TypeScript handler directly.

| Finding | Evidence at the planning baseline | Follow-up |
| --- | --- | --- |
| Unknown save permits source-manager entry | An isolated `handleKey` call with `uncertain=true` accepts Ctrl+Y. Source inspection confirms unbind mutates the draft and successful reconciliation replaces it. The complete host save-loss journey was not rerun. | FIX-01; [key dispatch](../../mods/statusline-native/lib/client/keys.ts), [shared source manager](../../packages/core/src/editor/source-manager.ts), [reconciliation](../../mods/statusline-native/hooks/register.ts) |
| Bar labels are decorated incorrectly | Production render with 50% remaining and labels off yields `[####----] Context 50% left`; custom `CTX` yields `CTX [####----] Context 50% left`. Numeric presentation removes/replaces the legacy label correctly. | FIX-02; [indicator](../../packages/core/src/rendering/indicators.ts), [decoration](../../packages/core/src/rendering/preferences.ts) |
| Refresh cancellation crosses consumers | Two in-memory GitHub refresh requests reuse one job owned by editor A; closing A requests cancellation of the same job returned to B. This did not execute a real worker. | FIX-03; [source service](../../packages/cli/src/sources/service.ts), shared source-manager close |
| Extension diagnosis uses later data and overwrites agent evidence | An 11:00 input includes a supplied source view observed at 12:00 as `observed/current` and renders its value. Two agents both request a source, but final evidence contains only the second. | FIX-04; [diagnosis adapter](../../packages/cli/src/diagnostics/service.ts) |
| Task language depends on successful details | Source initializes English, opens/registers the title before preference loading and assigns the loaded preference only after task reading succeeds. Failure-path behavior was source-confirmed, not a new host reproduction. | I18N-01; native task registration and refresh |
| Missing UI/extension capabilities | Source and maintained guides show four themes, three gradient presets, existing GitHub automatic refresh, manual command refresh, CLI package management and native/CLI task details. External interactive task details, editor package pages and cross-block gradients are proposed additions. | APPEARANCE-05/06, TASK-02, UPDATE-02, COMMAND-02 |

[#154](https://github.com/fbincon/claude-code-statusline/issues/154) and [#155](https://github.com/fbincon/claude-code-statusline/issues/155) are closed with separate [v3.9.1 delivery evidence](native-capacity.md). Preserve their transport/tree distinction as a design constraint; do not reopen them by treating their original reports as the current implementation. New package acceptance remains to be performed. The six #96 gaps retain their original unverified status.

<a id="future-work"></a>

## Mainline product and maintenance packages

Entries without an implementation record remain proposed work; current package status is maintained only in the [roadmap](roadmap.md#milestones). Each implementation records its starting main, selected slice, interface decisions and actual results. Apply focused package acceptance with the shared [acceptance matrix](#acceptance-matrix). Exact future command names, schema/protocol numbers and color values are decided with their implementation; they are not current public interfaces.

<a id="fix-01"></a>

## FIX-01 Protect drafts while save results are unknown

**Goal and scope.** Prevent a pending save's later reconciliation from overwriting intervening display edits. Keep read-only source/status inspection available, while every display mutation follows one shared permission rule across pages, shortcuts and buttons. Source authorization and host Apply retain their own commit semantics.

**Ownership and compatibility.** Core owns the draft-mutation guard; native hooks own pending-save identity and read-only reconciliation. Apply the same rule to shared source/profile/import/group/alignment edits and external recovery where applicable. Preserve the submitted snapshot, revision checks, locks and backups; no display-format change is presumed.

**Slices.** Inventory display mutations → centralize the guard and wire callers → verify reconciliation and continued editing after a definitive result.

**Acceptance.** An unknown save blocks bind/unbind, replacement and structural edits even through an already-open manager. Test saved, not committed, concurrent-conflict and still-unknown readbacks. Inspection remains usable; recovery/retry does not repeat a write or erase the retained draft. Add an applicable native interaction regression to the existing suite.

<a id="fix-02"></a>

## FIX-02 Compose bars and labels consistently

**Goal and scope.** Apply label rules exactly once to main and subagent indicators. Organize bar, label, numeric value and used/remaining direction before final styling instead of recovering a label from a bar-prefixed string.

**Ownership and compatibility.** Core rendering/formatting owns the composition; CLI and both editors consume it. Preserve current numeric/bar options, metric definitions, thresholds, explicit zero and missing-data behavior. Adaptive fitting is a separate APPEARANCE-07 addition.

**Slices.** Establish expected numeric/bar labels → repair shared composition → add targeted main/subagent regressions.

**Acceptance.** Cover legacy, hidden, short and custom labels with icons, thresholds and all six languages. Assert retained percentage/direction, absence of duplicate labels, intact graphemes and color resets, and existing width limits. Do not treat a width-only assertion as proof of correct content.

<a id="fix-03"></a>

## FIX-03 Separate refresh execution from waiting consumers

**Goal and scope.** Distinguish a shared refresh job from the editor, CLI or automatic policy waiting for it. Leaving or interrupting one consumer releases only its interest. Keep explicit whole-job cancellation a separate operation; cancel an unneeded execution only after its last applicable interest is gone.

**Ownership and compatibility.** Cli source services own durable execution/consumer lifecycle; platform handles process termination; core contracts and shared managers express join/release/status. Specify old-job interpretation and migration before changing source-job interfaces. Preserve source revision, context identity and automatic/manual attribution.

**Slices.** Define ownership and last-consumer rules → update service, editor close and CLI signal paths → verify manual/automatic overlap and expiry.

**Acceptance.** Cover two editors, editor plus CLI, and manual plus automatic refresh sharing one identity. One exit preserves the remaining consumer; last-consumer release, explicit cancel, source disable/edit and lease expiry have distinct outcomes. Late results cannot publish to another revision or context.

<a id="fix-04"></a>

## FIX-04 Make extension diagnosis time- and agent-applicable

**Goal and scope.** Apply the supplied input's observation time to extension values and supporting fields. Exclude later evidence from historical reconstruction; keep absent timestamps unknown. Preserve evidence for every component-instance/agent pair rather than overwriting by instance ID.

**Ownership and compatibility.** Cli observation adapters and core diagnosis share temporal/status rules. Keep current live-render behavior distinct from explicit historical diagnosis, and retain the input time separately from diagnosis time. Review any diagnosis-result interface extension for existing consumers.

**Slices.** Define applicability and evidence identity → filter source views and accumulate agent evidence → verify rendering and machine-readable explanations together.

**Acceptance.** Cover earlier/equal/later/unknown observation times, stale and partial data, explicit zero, multiple agents sharing a component and separate component copies. A later value or auxiliary PR/check field cannot affect historical output or be reported as current evidence. Input-only diagnosis remains read-only and source-free.

<a id="i18n-01"></a>

## I18N-01 Initialize task-detail language independently

**Goal and scope.** Resolve available UI preferences before generating task command descriptions, initial pane titles and results. A failed task read must not discard a successfully loaded language preference. Use the documented fallback when preferences themselves cannot be read.

**Ownership and compatibility.** Native registration/refresh owns sequencing; shared core messages remain canonical. Preserve command ownership and task identity checks. TASK-02 reuses the same preference behavior.

**Slices.** Separate preference and task-result initialization → localize first presentation and retry → cover failure transitions.

**Acceptance.** Exercise all six languages for first open, no data, task failure, retry and reopening after a language change; include preference-read failure and a successful preference read followed by task failure. Verify title, description, controls and guidance rather than message-key coverage alone.

<a id="appearance-05"></a>

## APPEARANCE-05 Expand themes and gradient selection

**Goal and scope.** Provide distinct additional themes and curated cold, warm, muted and soft gradient choices. Keep semantic themes, gradient color stops and complete display schemes separate. Select the concrete palette set in the implementation review and preserve the four existing theme identities.

**Ownership and interfaces.** Core maintains one theme definition source for choices, validation and actual foreground/Powerline colors; generated resources feed both editors. Show names with actual color bands and foreground/background suitability. Support reversing stops, restoring inheritance and editing individual colors. Cross-component style copying belongs to IMPORT-02; global appearance reuse already exists in IMPORT-01.

**Slices.** Consolidate theme registration → add reviewed palettes/presets → add bounded selectors and gradient edits. Saved gradients continue to contain concrete colors, preserving effects if preset names change. Specify compatibility for new theme values before choosing format versions.

**Acceptance.** Compare text, block backgrounds, warning/critical overrides and inherited/custom choices in main/subagent output, previews and both editors. Cover no color, terminal/ANSI fallback, save/reopen and selective appearance import without replacing components/layout. Native selectors send only the visible color choices.

<a id="preview-01"></a>

## PREVIEW-01 Select sample scenarios

**Goal and scope.** Offer normal, warning, critical, missing/stale/failed-source, long-path/label, clean/modified/conflicted-Git and no/few/many-agent sample scenarios with width choices. Keep the sample identity visible; switching scenarios changes observation input rather than the saved display.

**Ownership and interfaces.** Core sample definitions and production rendering supply both editors and applicable preview entry points; cli injects observations. Use a bounded scenario ID/selection in the existing preview flow and define backward-compatible defaults. Preview never starts a command, network request or live collector.

**Slices.** Define named deterministic observations → connect selectors to shared rendering → add scenario-specific presentation checks.

**Acceptance.** Confirm unchanged configuration on selection/cancel, identical renderer rules, real zero versus absence, conditional hiding, groups, alignment and applicable color overrides. Exercise targeted narrow/ordinary/wide cases and large agent lists without transporting hidden previews or the whole scenario library to the Client.

<a id="explain-02"></a>

## EXPLAIN-02 Explain inactive configuration and explicit input

**Goal and scope.** Explain background gradients outside Powerline, group-owned backgrounds, threshold overrides, disabled/converted colors and enabled sources without an applicable session/integration. Add an explicit file-input diagnosis entry distinct from sample explanation.

**Ownership and interfaces.** Core reason codes follow the actual render/availability decision; cli reuses existing read-only diagnose/file validation; editors choose sample explanation or a user-selected input. Retain source/time labels and input-only behavior. Define minimal protocol extensions when implemented; FIX-04 precedes claims about extension historical evidence.

**Slices.** Add missing reasons → expose the explicit file path and review context → present localized paged explanations and failure guidance.

**Acceptance.** Each reason matches the same configuration/input's output; an override cannot be described as a missing observation. Invalid/unreadable files, scope mismatch, missing time and source failure remain distinct. Diagnosis does not enable collection, save a draft or execute a source. Large reports preserve native capacity and return to the same draft.

<a id="task-02"></a>

## TASK-02 External read-only task details

**Goal and scope.** Add a standalone external task viewer and an entry from the external configuration editor. Select session/task identity explicitly and keep it visible. Reuse the existing `task_details` model/service for summary, agents, known parent relations, checklist progress and timing evidence; preserve `task show` semantics. A new interactive command remains proposed until its spelling is implemented.

**Ownership and interfaces.** Cli selects identity and reads known task state; core owns view/navigation rules and tui handles terminals. Do not infer names or outcomes unavailable outside the native host. Return from the viewer to the retained configuration draft and editing target.

**Slices.** First deliver read-only browsing, paging, manual refresh, exit, six-language and resize behavior. Then add shared status filtering, name/ID search, expand/collapse, summary/evidence layers and stable selection/reading position. I18N-01 supplies initial/failure language behavior.

**Acceptance.** Cover no/partial/stale data, missing parents, identity conflicts, large agent lists, resize and refresh failure. Retain the last successful report with its time on failure and preserve reading position where its item still exists. No transcript scan, source execution, model call or background polling is introduced. Both frontends retain bounded presentation and read-only evidence semantics.

<a id="update-02"></a>

## UPDATE-02 Version review, execution and protected history

**Goal and ownership.** Both editors expose the existing package-management capabilities through shared cli services, with platform package/process effects and core review models. Entering the page reads local identity/history; network checks and package changes require explicit actions. Reuse UPDATE-01 compatibility, prefix ownership, locks, external recovery runner and stage journal.

**Slice 1 — status and review, batch 3.** Show installed version, actual prefix/entry, configuration directory, channel, Node/host compatibility, prior successful version, available backups and unfinished transactions. An explicit metadata check distinguishes unverified artifacts from a downloaded/verified dry-run review. Review current/target identity and recovery options without replacing the package or configuration.

**Slice 2 — execution and recovery, batch 4.** Follow the accepted review with a fresh identity/revision check. Before execution require saved, explicitly exported, explicitly discarded or retained-by-cancelling draft handling; export does not mark a draft saved. Run long work outside the replaced package and expose persistent progress by transaction identity instead of keeping an ordinary native backend call open. Lock the old editor against further writes/duplicate execution. Closing detaches the view; durable stage state and process identity determine recovery. Show completed/remaining stages and require reopening the external editor or restarting Claude to load matching resources. Review package rollback and configuration restoration separately. FIX-01 protections apply during unresolved saves.

**Slice 3 — history and cleanup, later.** List transaction outcomes and retained recovery materials. Explicitly review cleanup of completed, unreferenced records. Preserve pending transactions, running executors, previous-version rollback inputs and required configuration snapshots; ambiguous ownership/reference checks prevent deletion.

**Interfaces and acceptance.** Extend shared review/job-status interfaces only as needed, with old Mod/backend mismatch and partially replaced installations handled explicitly. Test no-network page entry, failed checks, incompatible targets, dirty/unknown drafts, concurrent managers, window closure, interruption, package success followed by integration failure, reattach/recover and protected cleanup. Keep stage outcomes truthful, preserve unrelated configuration and source authorization, and never auto-elevate. Native status/history pages remain bounded.

<a id="sources-01"></a>

## SOURCES-01 Readable source operations and binding maintenance

**Goal and ownership.** Shared source services/models drive localized editor summaries and applicable CLI output. Keep raw JSON as advanced details while showing enabled/automatic state, running/waiting/paused status, last success/failure, next execution, project/branch/session ownership and actionable failure reasons. FIX-03 supplies consumer-aware lifecycle semantics.

**Slice 1 — operations, batch 4.** Clearly separate cancel-current, disable-automatic and disable-source actions. Retain a bounded execution result/error summary and last successful observation with current failure/staleness visible. COMMAND-02 adds its source-specific scheduling state through this shared view.

**Slice 2 — GitHub details, batch 4.** Preserve relevant failed/pending check names and validated links, tied to the selected repository/branch/HEAD and observation time. Paginate details; do not query merely to open a review or replace unknown/missing checks with success.

**Slice 3 — bindings, later.** Inventory unused/duplicate binding records, reuse compatible existing bindings and provide explicit reviewed cleanup. Check user defaults, named profiles, project bindings and known pending drafts/transactions under revision protection; uncertainty prevents deletion. Cancelling a display edit does not grant source execution permission.

**Interfaces and acceptance.** Specify additional observation/job-summary fields and old-record defaults before versioning. Cover localized failure states, source edits and late results, multiple check pages, no data, stale success after failure, repeated bind/unbind/cancel and references outside the active profile. Cleanup preserves live references and source definitions/authorization; valid large libraries remain operable in Native.

<a id="command-02"></a>

## COMMAND-02 Commands scheduled by active sessions

**Goal and scope.** Extend the delivered manual COMMAND-01 capability with separately reviewed periodic execution during applicable active sessions. Execution permission and automatic permission are distinct; no applicable live lease pauses dispatch. This first version uses existing session lifecycle integration and does not install a system daemon.

**Ownership and interfaces.** Cli reuses suitable scheduler/lease logic after FIX-03; platform retains literal executable/argv, cancellation and child cleanup; core describes policies and states. The interval is independent of observation TTL. Allow at most one running job per command source and skip a busy tick. Result identity includes source ID/revision, declared scope and the actual project/session/agent inputs used. Preserve GitHub-specific authorization/identity rules when sharing scheduling code.

**Slices.** Define authorization/lifecycle/identity rules → add periodic dispatch and invalidation → connect SOURCES-01 review, status and stop controls. Source changes invalidate prior automatic approval; old jobs cannot publish into the new definition.

**Acceptance.** Distinguish cancel-current, stop-automatic and disable-source. Stopping automatic work releases its interest while preserving applicable manual consumers; disabling a source blocks new work and cancels its unfinished jobs. Cover lease expiry, overlapping sessions, missing executable, nonzero exit, timeout, output limit/format failures, backoff/pause, edits and late completion. Retain last success only with explicit failure/stale state; imports/previews cannot start work or grant permission.

<a id="appearance-06"></a>

## APPEARANCE-06 Continuous backgrounds within a row

**Goal and scope.** Add an opt-in background gradient spanning adjacent Powerline blocks of one final displayed row. Existing `color_mode=continuous` is palette-sequence continuity and keeps its meaning. Preserve APPEARANCE-04's completed per-component gradients.

**Rules and ownership.** Core finishes visibility, grouping, wrapping and width fitting before coloring by final visible terminal-cell position. Recalculate after hidden/omitted components; restart each row. A spacer breaks the colored run and stays uncolored; alignment padding is uncolored and excluded. A shared-background group is one block. An explicitly assigned component/group background, including an individual background gradient, overrides the row gradient and creates a run boundary. Keep warning/critical priority and readable foregrounds; separators and caps use adjacent blocks' actual edge colors.

**Slices.** Define the opt-in scope/precedence → implement coloring after final layout → expose matching preview/editor/import/explanation support. Cross-row continuation is outside this first version. Choose compatible configuration/protocol extensions at implementation; old configurations retain their rendering.

**Acceptance.** Cover targeted group, hidden middle item, spacer, alignment, unequal width, clipping, automatic/explicit rows and main/subagent combinations, including Chinese/emoji, links and ANSI/no-color fallback. Verify color boundaries and semantic warnings as well as width, round-trip and Native presentation budgets.

<a id="appearance-07"></a>

## APPEARANCE-07 Adaptive bars that preserve numeric meaning

**Goal and scope.** Add an explicit adaptive representation for narrow rows after FIX-02. Fit in this order: shorten an eligible label, shorten the bar, use numeric presentation, then apply existing component-priority omission. Preserve the percentage and used/remaining meaning in every retained representation.

**Ownership and interfaces.** Core fitting works from structured indicator content; both editors and CLI expose the same opt-in choice. Retain existing explicit numeric/bar behavior and custom labels unless the adaptive policy permits their reviewed shortening. Declare compatibility for the new option.

**Slices.** Define semantic fallbacks → integrate fitting with shared layout → expose and explain the adaptive choice.

**Acceptance.** Test boundaries around each fallback with main/subagent indicators, six languages, custom labels/icons, grouping, thresholds and explicit spacer rows. A retained bar must not hide its number through arbitrary string clipping; at widths where even the minimal numeric form cannot fit, omit the component through the existing policy. Reopening/exporting retains the choice.

<a id="ux-03"></a>

## UX-03 Shared draft history and external recovery

**Goal and scope.** Provide bounded undo/redo for display-draft actions, a reviewable change summary and stronger external-editor conflict recovery. One logical copy/delete/group/import/apply-style action is one history entry. UI-language saves, source authorization and host Apply retain independent persistence semantics.

**Ownership and interfaces.** Core owns draft history and semantic changes; hosts retain that history, while cli supplies revision-bound read/reload/export. Native transports only visible summaries. New edits after undo discard the redo branch. A definitive save establishes a new baseline/history boundary; undo cannot revert already committed external effects. FIX-01 freezes history mutations during unresolved saves.

**Slices.** Add shared history and change summary → connect editor controls → add external compare-current, export-draft, explicit reload/discard and safe retry after review. Preserve the draft after failed/conflicting saves; never silently merge or overwrite concurrent changes.

**Acceptance.** Cover undo/redo around structural edits, style/group import, cancellation, history bounds and save boundaries. Verify independent immediate writes remain intact. A conflict permits comparison/export without losing the draft; reloading requires explicit discard, and a later save uses the newly reviewed revision. Native recovery and both editors retain target identity.

<a id="import-02"></a>

## IMPORT-02 Reuse styles and complete groups

**Goal and scope.** Extend delivered whole-section import with selected visual-style copying and complete-group reuse. Style copying preserves the destination's metric, source binding, position, priority and visibility; copy only the reviewed visual fields such as colors/gradients, label/icon and formatting. Existing global-appearance import remains available.

**Ownership and interfaces.** Core computes candidate changes and reference closure; cli reuses portable/profile review and transactions; editors show the selected effect. Whole-group import maps instance/group IDs and applicable internal layout/alignment references together. Review or reject references outside the selection; never silently discard them or replace unrelated rows. Imported local bindings become unresolved references and require explicit binding to a compatible local source, without importing authorization.

**Slices.** First add style-field selection and paste → add complete-group import with ID/reference review → guide explicit local-source rebinding. Integrate each accepted candidate as one draft action with UX-03 history when available.

**Acceptance.** Verify preserved destination identity, unrelated configuration and unselected fields; duplicate IDs, missing/outside references, linked/shared-background groups and alignment relationships receive explicit outcomes. Cancel/import review is side-effect-free; save/reopen/export remain consistent, and source enablement never follows a portable import.

<a id="composition-04"></a>

## COMPOSITION-04 Review alignment repairs with structural edits

**Goal and scope.** When deleting a referenced component, dissolving a group or changing layout would break alignment, offer a reviewable structural-edit proposal including affected relationships. Keep refusal available when the user does not accept the proposed adjustment.

**Ownership and interfaces.** Core computes a complete candidate and validates references before one draft transition; both editors/CLI review the same affected IDs and relationships. Preserve current alignment protection until acceptance, then apply the structural edit and its approved reference changes together. It is one undoable action when UX-03 is available.

**Slices.** Define impact/proposal results → connect review/accept/cancel → add combined structural/reference regressions. Any protocol addition describes the proposal rather than weakening stored configuration validation.

**Acceptance.** Cover referenced/unreferenced deletion, group dissolution, layout changes, multiple relationships, stale proposals and cancellation. Rejected or invalid proposals leave all state untouched; accepted ones preserve unrelated references and survive preview/save/reopen/import/export with valid IDs.

<a id="profile-02"></a>

## PROFILE-02 Scenario schemes using delivered capabilities

**Goal and scope.** Add reviewed schemes for Powerline daily work, multi-agent tasks, quota/cost monitoring, narrow terminals and light/high-contrast reading. Use the delivered progress, gradient, group and alignment choices appropriate to each scene; preserve the existing three complete schemes and their identities.

**Ownership and interfaces.** Core preset/profile definitions remain canonical and feed Quick setup, CLI and both editors. Depend only on capabilities a scheme actually uses. Schemes change display intent and cannot install tools, bind local credentials or enable sources; external components remain clearly unresolved until locally bound.

**Slices.** Select scene intent and required delivered features → build/review matching configurations → verify selection, partial appearance reuse and provenance. SHOWCASE-01 records their final presentation after all formal packages finish.

**Acceptance.** Use PREVIEW-01 cases to inspect ordinary, risk, missing-source, narrow and multi-agent states. Verify six-language labels, readable warning colors, terminal fallbacks, cancel, save/reopen, import/export and preservation of source authorization. State the compatible product versions; samples are identified as samples.

<a id="delivered-mainline"></a>

## Delivered mainline designs

The following sections retain their original design and acceptance intent; the linked delivery records establish current behavior and actual results. Their historical version numbers and requested checks are not new planning decisions.

<a id="git-01"></a>

## GIT-01 Git invocation review and necessary protections

**Status: DONE.** Started from `d2975e8` for v3.8.0. The shared invocation policy is implemented; platform and installed-artifact acceptance are tracked in [the delivery record](m8-m9-delivery.md).

**Existing observation and limits.** On 2026-10-24, the [GitCollector before this implementation](https://github.com/fbincon/claude-code-statusline/blob/d3c95232a18cb297bbd836c4deda117749e90ee4/packages/cli/src/runtime/git.ts) was exercised on Linux with Git 2.53.0 and Node 24.21.0 in temporary repositories. Repository-level `core.fsmonitor` invoked a harmless marker program. A local clean filter also invoked its marker when a tracked file changed content without changing length; a different-length change did not trigger that fixture. Explicitly disabling the respective setting for the control invocation prevented the marker, and repository configuration bytes stayed unchanged. Reproduce these conditions before choosing a policy. This does not establish that ordinary cloning transfers local configuration, nor cover all worktree/bare repositories, filters, indirect provider calls or Windows/macOS behavior. The historical observation is separate from the current implementation status above.

**Problem and goal.** Passing literal argv to Git does not alone determine which programs Git may start from repository configuration. Establish what the current collectors actually execute and correct verified gaps without changing metric meaning or modifying user repositories.

**Scope and flow.** Inventory direct Git calls and Git invoked through provider tools. Review fsmonitor, local/worktree filter commands and implicit bare-repository discovery. In isolated fixtures, compare current behavior with a proposed invocation policy, record whether a change is necessary, then apply only necessary protections. Preserve legitimate Git LFS and other supported user-managed filters through an explicit compatibility table; do not blanket-disable every global/system setting or weaken Git's ownership checks.

**Data and modules.** Start with [GitCollector](../../packages/cli/src/runtime/git.ts), source context/provider orchestration in cli, and platform process adapters. Use one shared invocation policy for affected entry points; keep parsing and metric rendering in core. Diagnosis reports unavailable/blocked results without exposing credentials, running test programs in real repositories or rewriting `.git/config`.

**Interface and compatibility.** Preserve existing item IDs, status meanings and source identities. No new user command or display schema is presumed necessary. Specify repository-local versus user-level configuration, known filter compatibility and indirect Git environment before implementing a correction. If a metric cannot be collected under the chosen policy, retain an explicit unavailable reason rather than a normal zero or clean result.

**Implementation slices.** Inventory and isolated reproduction → behavior/compatibility table → shared policy and affected call sites if needed → regressions and diagnosis guidance. A no-change conclusion must retain the reproduction and rationale.

**Functional acceptance.** Cover repository-controlled fsmonitor/filter invocation, local/worktree versus global/system settings, known filters, indirect provider calls, bare and linked worktrees, Chinese/space paths, invocation failures and ordinary clean/dirty repositories. Prove the selected policy prevents unintended program execution, preserves supported metric semantics and leaves repository/user configuration unchanged. Keep the investigation outcome distinct from any corrected defect.

<a id="terminal-01"></a>

## TERMINAL-01 Windows preview consistency

**Status: DONE.** Priority independent maintenance, tracking [issue #130](https://github.com/fbincon/claude-code-statusline/issues/130).

**Problem and goal.** The issue reports different external-editor preview colors from setup, standalone configure and the slash launcher on the same Windows terminal. The baseline's [color-capability function](https://github.com/fbincon/claude-code-statusline/blob/d2975e8a4561371b5d32bec136400963dbccd97f/packages/tui/src/session.ts) returns 16 for Windows Terminal markers alone and 256 for `TERM=xterm-256color`. This pure-function observation is not a new Windows desktop verification. Make detected capability consistent where the terminal is the same, or explain supported differences accurately.

**Scope and flow.** Reproduce all three entry paths with one installed artifact and display configuration; identify environment and console differences; correct or document capability selection; reopen each entry and compare preview and actual output. Preserve explicit `NO_COLOR`, monochrome terminals and user capability choices. Native editor theme behavior is a distinct surface and is not required to imitate external TUI colors.

**Data and modules.** Tui owns shared preview/session decisions, platform owns terminal/console capability and environment transport, and cli owns launcher orchestration. Core retains common color conversion and Unicode rendering. Reuse a single capability policy rather than assigning independent defaults in each entry.

**Interface and compatibility.** No display migration or new command is presumed necessary. Saved appearance, language, source authorization and host settings remain intact. Report unavailable capability evidence without claiming unsupported color modes. Any user-facing guidance must have six-language coverage.

**Implementation slices.** Installed Windows reproduction → shared capability/entry policy → focused correction and regressions → supported behavior and capture evidence.

**Functional acceptance.** Cover Windows Terminal and supported console hosts, PowerShell/CMD/Git Bash entry environments, unset/explicit color variables, no-color/monochrome behavior and all three entry paths. Verify resizing, cancellation, terminal restoration, save/reopen and preview/actual output with unchanged configuration. Pure tests complement actual Windows captures; record unverified cases honestly and carry outcomes into APPEARANCE-04, COMPOSITION-03 and SHOWCASE-01 acceptance.

<a id="setup-02"></a>

## SETUP-02 First entry and durable installation

**Status: DONE.** M8; extends delivered SETUP-01.

**Problem and goal.** Setup already connects configuration and integration, but package acquisition and the initial command remain separate decisions. Provide a no-argument/npx first entry that leads to a durable installation and the existing setup journey.

**Scope and flow.** On an interactive terminal, inspect the current package, Node/npm, global prefix, permissions and existing integration; show the exact target version and persistent location; explicitly approve product-managed npm global installation if needed; verify its executable and transfer to existing setup. npm's initial npx download is separate from this product-managed installation step. Reuse a matching persistent installation; do not silently upgrade or downgrade a different existing version. Non-TTY entry must not wait for interaction or mutate installation/configuration and must print actionable guidance.

**Data and modules.** Cli coordinates entry dispatch, installation identity and setup; platform provides executable/prefix/permission checks and literal process arguments; core/tui provide shared review state and localized guidance. Reuse installation ownership, locking, journals and backups. Do not bind Claude to a disposable npx cache path or introduce a separate managed-version directory as the default installation strategy.

**Interface and compatibility.** No-argument behavior is an intended future public change; existing explicit commands retain their meanings. Separate package installation, display Save and Claude integration commit points. No automatic privilege escalation, account login or collection enablement is included. Existing preferences, profiles, project bindings and independent opt-outs survive. Cancellation after a completed stage reports that stage instead of promising whole-flow rollback.

**Implementation slices.** Entry/installation identity and review contract → exact-version global installation and durable handoff → existing setup integration and failure guidance → installed cross-platform journeys.

**Functional acceptance.** Cover a new install, matching/different installed versions, multiple prefixes, npx cache removal after installation, non-writable prefixes, missing tools, non-TTY use, Unicode/space paths, cancellation, interruption and network/npm failures. Recheck ownership and revisions before integration; retain recoverable partial outcomes and unaffected user settings. Verify the durable entry after restart and actual display, separately from fixed previews, with six-language guidance on supported platforms.

<a id="update-01"></a>

## UPDATE-01 Explicit upgrades and rollback

**Status: DONE.** M9; uses SETUP-02 installation identity and existing compatibility/recovery rules.

**Problem and goal.** Let users inspect available versions, deliberately upgrade or return to a prior version, and understand package and configuration recovery separately.

**Scope and flow.** A user-requested check reads version metadata and shows installed/target identity and compatibility. Review an exact selected version and npm global target before changing it. Validate the new package and matching integration resources before reporting success. Retain the previous version identity and applicable configuration backups. A rollback reviews the target version and configuration compatibility first; compatible current settings stay, while restoring an older snapshot requires a separate review of what will be replaced.

**Data and modules.** Cli orchestrates registry checks, version selection, package transitions and integration/recovery. Platform owns bounded npm execution and installation checks; core owns review/compatibility outcomes and localized explanations. Reuse the existing recovery journal and ownership rules, distinguishing external npm outcomes from configuration commits.

**Interface and compatibility.** Define the management interface during implementation without presenting a proposed command as currently available. Checks, upgrades and rollback are explicit; rendering and previews never query for or apply updates. Do not silently change release channels, elevate privileges, downgrade schemas by editing version numbers or overwrite newer user edits. Detect unsupported Node/host/configuration combinations and explain supported recovery before mutation. Uncertain npm results require inspection before retry.

**Implementation slices.** Read-only version/compatibility review → explicit upgrade and installed verification → version rollback with separately reviewed configuration restoration → interruption/concurrency recovery and guidance.

**Functional acceptance.** Cover current/available/unavailable versions, malformed or failed metadata, exact-version selection, permissions, supported and unsupported runtime/host combinations, package success followed by integration failure, interruption and retry. Cover rollback with compatible settings, incompatible newer settings, user edits since backup, missing backups and concurrent editors. Confirm retained profiles/bindings/opt-outs, correct resources, restart/actual display and truthful partial outcomes. Package replacement and configuration restoration must have separate evidence.

<a id="import-01"></a>

## IMPORT-01 Selective configuration reuse

**Status: DONE.** M10; two required slices, first global appearance and then complete display sections.

**Problem and goal.** Users should reuse selected appearance or display areas without replacing unrelated configuration or losing instance/group relationships.

**Scope and flow.** First select independent global appearance settings, such as palette/theme and Powerline controls, from a supported import. Then support complete main/subagent display sections with their instances, groups, options and layout references. Choose the target, preview selected differences, accept the candidate draft, and save through the existing revision-checked transaction. Arbitrary single-component or field-by-field merging is outside these first two slices. Both slices must pass before this package is complete.

**Data and modules.** Core owns selection, reference closure, ID remapping, validation and differences. Cli applies existing import/profile/storage transactions; both editors expose the same selection and review rules. Use the existing portable and single-profile formats through their appropriate entry points rather than conflating their envelopes.

**Interface and compatibility.** Preserve unselected sections, selected target identity, profile collection and project bindings. Collision handling must map imported instance/group identities consistently and rebuild every affected row/group reference; reject incomplete references without changing the draft. Imported local source bindings remain stripped, while untouched local sections retain theirs. Import cannot enable sources, automatic refresh or commands. Host Apply stays separate from display Save. Later gradient/alignment options must participate in the same round trips; assign interface versions only when their concrete fields are implemented.

**Implementation slices.** Global-appearance selection/review → complete-section reference/remapping rules → both editors/CLI and profile workflows → migration/conflict/cancel acceptance for both slices.

**Functional acceptance.** Cover global-only, main-only, subagent-only and combined selection, old supported imports, duplicate IDs, groups, explicit rows, spacers and missing references. Compare preview with saved/reopened actual output; verify untouched sections and bindings, source authorization removal, cancel/no-write behavior, invalid inputs, stale drafts, recovery and six-language parity. Adding future options cannot silently widen an earlier import selection.

<a id="appearance-04"></a>

## APPEARANCE-04 Static foreground and Powerline-background gradients

**Status: DONE.** M11; both foreground and background are required scope.

**Problem and goal.** Provide expressive, configurable color transitions without obscuring metric meaning or breaking existing groups, separators and terminal fallbacks.

**Scope and flow.** Select a component foreground or Powerline block background, choose a preset or custom colors, preview, save and reopen. First delivery is static; animation is outside scope. Describe how the gradient spans visible text/block cells, how clipping affects its endpoints, and how continuous/restarted cross-line color modes apply. A foreground-only slice does not complete this package.

**Data and modules.** Core owns gradient validation, shared formatting, grapheme/cell rendering and Powerline transitions. Shared catalog/editor fields expose valid targets and options; cli, tui and native editors consume the same draft. TERMINAL-01 outcomes inform Windows preview verification, without changing actual metric collection.

**Interface and compatibility.** Existing solid colors remain the default. Define interactions with warning/critical threshold colors so decorative gradients do not hide configured warnings. Shared groups retain the primary-owned background model and preserve member overrides for separate blocks. Separator/cap backgrounds must follow adjacent block edges without color leakage; spacer gaps and no-color output retain their existing meaning. Preserve Unicode clusters, limited-color conversion and plain output. Store new choices in display configuration, including profile/import/export; this plan reserves no field spelling or schema/protocol version.

**Implementation slices.** Foreground/background contracts and fixed samples → pure text/block/separator rendering → presets/custom controls across both editors and CLI → complete round-trip, terminal and actual-output acceptance.

**Functional acceptance.** Cover presets/custom values, old solid configurations, labels/icons, threshold warnings, shared/separate groups, hidden/empty items, first/last blocks, caps, spacers and cross-line modes. Check 40/80/120 columns, clipping, CJK/combining/joined emoji, supported color depths and no color. Verify draft cancellation, invalid input, conflicts, migration/recovery, profile copying and selective import in six languages. Both foreground and background must match saved actual output; missing observations cannot become invented values.

<a id="composition-03"></a>

## COMPOSITION-03 Alignment across explicit main rows

**Status: DONE.** M12; only explicit main-line rows are in the first version.

**Problem and goal.** Keep corresponding parts of an explicitly composed multi-line main statusline aligned as visible content changes, without sacrificing meaningful content at narrow widths.

**Scope and flow.** Select participating explicit main rows and corresponding component/group positions, preview automatic alignment within those relationships, then save/reopen. Define column widths, hidden-position gaps and the interaction with the existing per-row spacer. A group is an indivisible alignment unit. Do not align automatic wrapping, separate Agents or main/subagent areas in this version; unchanged configurations retain current fitting.

**Data and modules.** Core owns alignment references, shared column calculation, group-aware fitting and Unicode cell widths. Cli persists the shared draft; tui/native editors and CLI expose equivalent controls and explanations. Existing observations and visibility rules remain the source of content.

**Interface and compatibility.** Validate references to instances/groups and explicit rows; copy/remap/delete/import operations must preserve valid relationships or report the affected change before saving. Define hidden positions without printing empty rows or orphan decorations. At insufficient width, collapse optional alignment space and use existing priority/clipping rules, explaining when alignment cannot fit. Do not split graphemes, break OSC 8 links, add continuation rows or change metric order. Include interactions with Powerline/gradients, source bindings and later selective imports; no future schema version is assigned here.

**Implementation slices.** Participating-row/reference and width contract → pure alignment/fitting with deterministic samples → both editors/CLI and configuration round trips → hidden/narrow/Unicode and installed-output acceptance.

**Functional acceptance.** Cover different row lengths, repeated types, disabled/hidden items, entirely hidden rows, groups, spacers, unknown data and long labels. Verify 40/80/120 columns and resize, priority omission, normal/Powerline/gradient output and six languages. Cover copy/delete/reorder, rejected dangling references, selective import, old files, conflicts, cancellation and recovery. Preview and actual output agree; automatic layout and subagent rows retain their prior behavior.

<a id="appearance-03"></a>

## APPEARANCE-03 Graphical context and quota indicators

**Status: DONE (v3.7.0).** [Implementation and delivery](m4-m7-delivery.md). First in product order; uses existing observations without enabling collection.

**Problem and goal.** Help users read context and quota levels at a glance while retaining existing number-based display and data definitions.

**Scope and flow.** Add an explicit short-bar option to main context-used/context-remaining, five-hour, weekly and spending-limit percentages, and subagent context-used/context-remaining. Users select an eligible instance, choose numeric or bar presentation and bar width, preview, save and reopen. Numeric presentation remains the default. Used/remaining direction is labeled and matches the existing selection; a bar does not imply time elapsed, task completion or a budget forecast. Time cursors and automatic representation switching remain candidates.

**Data and modules.** Core formats the same validated raw percentages used by existing indicators and visibility rules. Shared catalog capabilities/editor fields expose only supported options; cli, external TUI and native Mod consume the same draft. Terminal handling uses existing color/character fallbacks. Samples remain fixed and do not read external sources.

**Interface and compatibility.** Plan per-instance presentation/width options with shared CLI/editor validation, persistence, import review and explanation. Assign exact fields and schema/protocol changes in the implementation's compatibility record. Existing configurations, instance IDs and numeric output retain their behavior. Provide Unicode and ASCII bars, label plus percentage, and existing unavailable-state handling; never draw a missing value as a zero bar. Fit/clipping includes the bar, label and number without splitting graphemes.

**Implementation slices.** Eligible-component and display contract → pure formatting and width/fallback behavior → both editors/CLI and configuration round trips → samples and functional guidance.

**Functional acceptance.** Cover zero, full and fractional percentages, used/remaining direction, invalid/missing/expired observations and independent subagent values. Verify unchanged default numeric output, visibility thresholds using raw values, repeated instances with different modes, 40/80/120-column output, Powerline/spacers, no color, ASCII and joined emoji/CJK labels. Save, reopen, copy, profile binding and import/export preserve options across all six interface/output languages.

<a id="composition-02"></a>

## COMPOSITION-02 Component groups and linked visibility

**Status: DONE (v3.7.0).** [Implementation and delivery](m4-m7-delivery.md). Second in product order; independent of APPEARANCE-03.

**Problem and goal.** Avoid orphaned decorative text/icons when a metric disappears, and let related instances share one Powerline block without changing their data scope.

**Scope and flow.** Users select continuous instances in one scope, designate one metric as primary, and choose linked decoration visibility and optional shared Powerline presentation. The first version is single-level, cannot cross an explicit row boundary or spacer, and does not nest groups. Automatic layout treats a group as a unit. Decorative text follows the primary metric's final visibility, including layout omission; unknown data follows the primary's existing visible/unavailable behavior. Other metric members retain their own conditions and cannot create values for the primary.

**Data and modules.** Core owns group references, validation, visibility resolution and ordinary/Powerline drawing. The primary supplies a shared block's background; member foreground and threshold colors remain effective, and member background options remain saved for use when sharing is off. Cli configuration/profile services persist drafts; both editors offer create/edit/ungroup operations from shared rules. No extra collection or source authorization is introduced.

**Interface and compatibility.** Add group-to-instance references and shared editor/CLI operations; record exact wire fields and version changes before implementation. Ungrouped old configurations retain their output. Copying a whole group creates new identities and remaps references; deleting its primary dissolves the group while preserving surviving instances/options. Invalid moves across a row/spacer or into a noncontinuous/nested group are rejected without losing the draft. Ordinary separators, shared blocks and narrow-row omission/clipping must not leave decorations behind. Portable export includes display grouping only and never grants source access.

**Implementation slices.** Group/reference and primary-visibility contract → pure validation and layout → both editors/CLI and profile/import operations → examples and diagnosis explanations.

**Functional acceptance.** Cover a primary hidden by a condition, absent data or layout, visible unknown/partial states, disabled members, multiple metrics and completely hidden groups. Check shared/separate blocks, color reset, auto/explicit rows, spacer boundaries, narrow rows and independent agent groups. Copy/delete/ungroup, rejected reorder, save conflicts, import/export and profile binding preserve identities or report invalid references. Preview and actual output share the same rules in six languages.

<a id="workflow-02"></a>

## WORKFLOW-02 Opt-in automatic GitHub PR/CI refresh

**Status: DONE (v3.7.0).** [Implementation and delivery](m4-m7-delivery.md). Third in product order; depends on delivered EXTENSIONS-01 and WORKFLOW-01.

**Problem and goal.** Keep an enabled GitHub source current during an active session without repeatedly opening manual refresh.

**Scope and flow.** Cover GitHub PR/CI only. Existing sources remain manual by default. After source review/enablement, the user separately selects automatic refresh, reviews its period and active project/session, and saves the local policy. The proposed default period follows that source's configured validity period and can be changed explicitly. Active-session lifecycle events arrange due refreshes through independent tasks; no persistent system service is installed. Contexts without supported lifecycle evidence remain manual and explain why. Stop starting automatic tasks when the associated context ends. Turning automatic refresh off cancels its automatic work while retaining manual refresh and cached observations; source disable/edit/delete retains existing cancellation and re-review rules.

**Data and modules.** Cli orchestrates lifecycle eligibility, due-task dispatch and existing source jobs; platform owns process cancellation and context identity. Core exposes policy/status/explanation, and both editors/CLI provide configure, inspect and stop operations. Rendering reads published observations; it does not run `gh` or start network queries. Preview, scheme import and project binding do not dispatch work. Command and JSON sources do not gain automatic execution.

**Interface and compatibility.** Store automatic policy with local source management, separately from portable display schemes; enabling a source does not itself enable repetition. Define policy revision, active-context association and task-origin information before assigning wire versions. Reuse source/host/account/repository/branch/HEAD and authentication identity checks; deduplicate concurrent attempts for one source/context and reject late results after policy/context changes. Preserve the last valid value only under existing freshness/error markings; never show an old identity's result. Preserve distinct no-PR/no-checks/pending/failure/unknown states and keep credentials in `gh` authentication.

**Implementation slices.** Policy and lifecycle/stop contract → independent task dispatch and cancellation → both editors/CLI and diagnosis → isolated lifecycle journeys and authorized provider validation.

**Functional acceptance.** Cover default manual behavior, opt-in, first/due refresh, concurrent sessions, manual refresh during automatic operation, policy changes, source edit/disable/delete, session exit and unsupported hosts. Repository/worktree/branch/HEAD/account switches and late results must not cross identities. Cover authentication/network failures, no PR, ambiguous PRs and mixed checks. Closing policy editing without saving cannot enable repetition; imports/previews do not query; stopping automatic work leaves manual refresh available. Use isolated fixtures; live queries require the concrete future task's authorized scope.

<a id="metrics-01"></a>

## METRICS-01 Session cost rate

**Status: DONE (v3.7.0).** [Implementation and delivery](m4-m7-delivery.md). Fourth in product order; independent of automatic refresh.

**Problem and goal.** Explain existing session spending as an hourly rate with an explicit denominator, without inventing billing or task measurements.

**Scope and flow.** Add an optional main-line cost-rate component, unselected by default. In item details users choose session time (default) or API cumulative time, preview, save and reopen. Compute `total_cost_usd / (duration_ms / 3600000)` from corresponding official session fields. Display the selected denominator clearly; API time is not `task-active-timer`. Require at least 60,000 ms of the chosen duration; shorter/missing/invalid durations make the rate unavailable. Valid zero cost over sufficient observed time yields a visible zero rate.

**Data and modules.** Core validates/formats existing `cost.total_cost_usd`, `cost.total_duration_ms` and `cost.total_api_duration_ms`. Catalog capabilities, fixed samples and explanation share the definition. Cli and both editors reuse normal instance selection, formatting and persistence; no new collector, pricing table, transcript estimate or network source is needed.

**Interface and compatibility.** Plan one new main metric and a per-instance denominator choice across CLI, both editors, import/export and profiles. Confirm the final ID, options and any schema/protocol impact in the implementation record before coding. Do not alter session-cost, session/API duration or task-timer semantics. Labels identify an estimate derived from session fields, not an invoice or future spending prediction. Daily budgets and quota pacing stay in the candidate pool.

**Implementation slices.** Definition/denominator and availability contract → pure calculation, sample and explanation → both editors/CLI and round trips → metric guide and acceptance examples.

**Functional acceptance.** Cover both denominators, the one-minute boundary, zero cost, missing/negative/nonfinite values, zero duration and incomplete field combinations. Known inputs verify the formula, independently configured repeated instances and clear six-language labels. Selection, cancellation, save/reopen, import/export and project profiles preserve the intended denominator without enabling collection or changing existing metrics.

<a id="candidate-boundaries"></a>

## Candidate boundaries

The [roadmap pool](roadmap.md#candidates) retains unselected functional, supporting and longer-term directions with entry conditions. Automatic command execution is now COMMAND-02; all other selected improvements are formal packages above. Contribution guidance, the Bug form and blank question/feature Issues already exist and remain maintenance. Token/cache additions preserve existing definitions; budgets and pacing require verified amounts, scope and time. Other providers, service status and Voice/Sandbox hints require their own source/availability decisions. Migration guidance, JJ, other clients, a marketplace, script downloads and general Shell mode remain unselected and do not add SHOWCASE-01 prerequisites.

<a id="delivered-designs"></a>

## Delivered designs and retained demonstration package

Completed work below retains historical scope and evidence. SHOWCASE-01 keeps its original anchor; its updated prerequisites are the eighteen formal improvement packages and every slice.

<a id="setup-01"></a>

## SETUP-01 First use and configuration entry

**Delivered in v3.5.0 — DONE.** This section preserves historical scope and acceptance intent. See [setup](../SETUP.md) for current usage and [delivery evidence](setup-appearance.md) for verified behavior and limitations.

**Problem and goal.** Quick setup already exists, but package installation, Claude integration, checking and opening an editor are separate steps. Take a new user from “the package runs” to “integration has a clear outcome and I know how to configure and verify it.” Existing `install`, `doctor`, `configure` and configuration CLI commands retain their purposes.

**Scope and flow.** Delivered interactive entry: `claude-statusline setup`. Check Node/Claude/config directory and existing integration → retain the current display or choose a scenario → use shared Quick setup for preview → review display and integration changes → explicitly apply → check written resources and show next actions. New users target the user default. Existing project bindings are explained, and their profiles and bindings are retained by default.

**Data and modules.** Environment and resource state come from existing [doctor](../../packages/cli/src/integration/doctor.ts), [install](../../packages/cli/src/integration/install.ts) and [configuration services](../../packages/cli/src/config/service.ts). Reuse [Quick setup](../../packages/core/src/editor/quick-setup.ts), the [external editor](../../packages/cli/src/integration/configure.ts) and shared drafts. Main implementation areas are cli/integration, core/editor and tui; native entry points continue using existing configuration editing.

**Interfaces and commit semantics.** Delivered `setup --dry-run` provides read-only checks and a step list, without inventing a candidate configuration before the user selects one. A normal non-TTY invocation explains the existing step-by-step commands and exits with code 2. Package download, automatic upgrades, font installation and account login are outside the first version. Identify separate commit points for display save, integration writes and independent host actions; reuse journal/backup/revision mechanisms. Cancellation must explain which actions already committed. Selecting a scheme does not enable collection, and saved opt-outs remain effective.

**Original implementation slices.**

1. Specify flows and commit boundaries for new/existing installations, invalid configuration and integration conflicts.
2. Implement read-only checks, draft orchestration and terminal interaction.
3. Connect existing save/install/recovery services.
4. Complete six-language text, CLI help and the first-use guide. Each slice has a reviewable result; the package completes only when the full journey passes.

**Original acceptance criteria.** Cover new installation, repeated invocation, customized profiles, project bindings, missing Claude, unknown/unsupported hosts, non-TTY use, paths with Chinese characters or spaces, damaged files, resources owned by another integration, save conflicts and intermediate failures. Cancellation before apply leaves display and integration unchanged; UI language retains its existing immediate-save rule. Cancellation after apply must not claim rollback. Actual display requiring a Claude restart stays pending verification; a fixed sample is not evidence of successful live operation. Evidence includes journey cases, transaction failures, six-language terminal walkthroughs and actual outcomes on supported hosts.

<a id="appearance-01"></a>

## APPEARANCE-01 Complete display schemes

**Delivered in v3.5.0 — DONE.** This section preserves historical scope and acceptance intent. See [schemes](../SCHEMES.md) for current usage and [delivery evidence](setup-appearance.md) for verified behavior and limitations.

**Problem and goal.** Six presets and named profiles exist, but users still assemble appearance and main/subagent layouts themselves. Provide three complete schemes that can be previewed, adjusted, saved and shared directly.

| Scenario | Main status line | Subagents and unavailable data | Delivered samples |
| --- | --- | --- | --- |
| Daily development | Model/effort, directory, Git, context and task timing; optional cost on a second line | Existing agent template without requiring additional collection | 80/120 columns; light, dark and terminal colors |
| Multi-agent tasks | Main task, context and repository summary | Emphasize name, state, model, context and task; keep failures visible and distinguish task from agent durations | No agents, running, completed and failed |
| Quota monitoring | Context, five-hour/weekly quotas and reset times; spending and cache when supplied | Missing or expired data cannot become zero; show source requirements before selection | Complete observations, missing fields and expired windows |

**Scope and interaction.** Define layout, labels, number formats, colors, hiding conditions, priorities and paired main/subagent presentation for each scheme. Offer light, dark or terminal-color choices within a scheme. Retain all six existing preset IDs. New schemes use existing candidate drafts and named profiles. Users preview first, then save to the current target or save a copy; explain the impact when several projects share a profile.

**Data and modules.** Reuse [presets](../../packages/core/src/config/presets.ts), [display instances](../../packages/core/src/config/instances.ts), [profile services](../../packages/cli/src/config/profiles.ts), [preview](../../packages/core/src/rendering/preview.ts) and [six-language resources](../../packages/core/resources/i18n). Fixed payloads drive examples; actual display uses existing metric sources without new calculation formulas.

**Interfaces and compatibility.** Schemes are delivered with display schema 9 and separate built-in metadata from saved user configuration. Built-in updates do not overwrite saved copies or change existing defaults automatically. Scheme exports exclude project paths, collection switches, host preferences and external-capability authorization. First-version sharing uses existing single-profile JSON with accompanying guidance.

**Original implementation slices.**

1. Define three scenarios and paired main/subagent examples.
2. Implement schemes and appearance choices through existing configuration.
3. Connect Quick setup, profile preview and Save as.
4. Deliver shareable files, guidance and installed-artifact screenshots.

**Original acceptance criteria.** Both editors produce equivalent drafts. Show explicit 80/120-column examples and retain correct clipping/hiding at 40 columns. Cover six languages, joined emoji, limited color, no color and missing Powerline fonts. Import, export, reopen, profile copying and project binding preserve instance identity and options; cancel retains saved profiles. Import cannot enable collection or extensions. Evidence includes configuration round trips, rendering examples, both editor journeys and artifact captures.

<a id="appearance-02"></a>

## APPEARANCE-02 Appearance controls and boundaries

**Delivered in v3.5.0 — DONE.** This section preserves historical scope and acceptance intent. See [appearance](../APPEARANCE.md) for current usage and [delivery evidence](setup-appearance.md) for verified behavior and limitations.

**Problem and goal.** Basic Powerline has fixed padding and limited glyph choices. Use concrete needs from the three schemes to select exposed controls while preserving structure with narrow windows and hidden components.

**First-version scope.** Add global padding side selection (none/left/right/both), controlled separators and end decorations, and continuous versus restarted colors across lines. Existing appearance remains the default for old configurations. Automatic column alignment across lines, gradients and arbitrary decoration templates remain candidates rather than dependencies of this control set.

**Interaction and source.** Both editors derive controls from one field description; preview shows the draft directly and CLI uses the same validation. Values come from display configuration without a new collector. Theme changes retain item overrides. No-color or unsupported-font output uses documented plain-text/ASCII behavior.

**Modules and interfaces.** Areas include [format configuration](../../packages/core/src/config/formatting.ts), [editor fields](../../packages/core/src/config/editor-fields.ts), [Powerline](../../packages/core/src/rendering/powerline.ts), [layout](../../packages/core/src/rendering/layout.ts) and generated native resources. Delivered `display.powerline` fields are `padding`, `separator`, `start_cap`, `end_cap` and `color_mode`, shared by CLI and both editors. Display schema is 9 and editor protocol is 16; portable remains 1, with migration, import and recovery guidance.

**Original implementation slices.**

1. Specify controls, old-value mapping and color/font fallback.
2. Implement pure rendering and width rules.
3. Integrate both editors, CLI, import review and explanations.
4. Update scheme examples and functional documentation.

**Original acceptance criteria.** Cover hiding first/middle/last components, fully hidden lines, empty text, repeated instances, spacers, automatic/explicit lines, subagent rows and narrow windows. No dangling separators, empty status rows or color leakage; decoration counts toward actual width and graphemes remain intact. Save/load, migration, draft cancellation and reopening preserve selections. Evidence includes rendering boundaries, migration round trips and both editor displays.

<a id="showcase-01"></a>

## SHOWCASE-01 Homepage and usage demonstrations

**Scheduling.** Keep the existing ID and use the [roadmap](roadmap.md#milestones) for status. Begin only after all eighteen formal follow-up packages and every UPDATE-02/SOURCES-01/TASK-02 and other package slice are accepted. This supersedes the earlier M13 placement after M8–M12. Unselected candidates add no prerequisites.

**Goal and scope.** Give users reproducible installation, configuration, task-viewing, version-management, source-operation and appearance examples with the final accepted artifacts. Preserve the SETUP-01/APPEARANCE-01/APPEARANCE-02 journeys and add PROFILE-02 scene configurations, richer previews, reuse and continuous-gradient examples where applicable.

**Ownership and interfaces.** Maintain bilingual homepage/quick-start narratives and the image index only when this package is implemented. Demonstrations describe implemented public behavior and compatible versions; they add no command, protocol or default change. Keep concise homepage material linked to complete walkthroughs and troubleshooting.

**Slices.** Verify all prerequisite acceptance references → fix scripts against matching installed artifacts → capture demonstrations and scene configurations → update bilingual navigation and inspect links, alternate text and reproducibility. Use applicable TERMINAL-01 outcomes and native capacity/recovery behavior.

**Acceptance.** Every shown operation is reproducible with its named package/version. Document cancellation, failure and partial completion without implying automatic rollback. Record platform, terminal width, theme, source/input identity and sanitized provenance for screenshots/video/configuration. Distinguish real terminal captures, PTY reconstruction, agent observation and human acceptance. Include the formal packages' acceptance references, readable scene variants and troubleshooting; retain #96 limitations. This package's completion does not establish a new human usability study.

<a id="extensions-01"></a>

## EXTENSIONS-01 Local JSON data foundation

**Delivered in v3.6.0 — DONE.** This section preserves historical scope and acceptance intent. See [extensions](../EXTENSIONS.md) for current usage and [delivery evidence](extensions.md) for verified behavior and limitations.

**Problem and goal.** Users want to display local results produced by other tools. Establish a separate source and display contract first, so later network and command components share availability explanations.

**First-version scope and interaction.** A user registers a source ID, explicit file location, field selection and scope on the local machine, then explicitly enables it. Editors add components referencing that source. The picker and diagnosis explain source, observation time and applicable project/session. User tools may produce the file; preview, import and display do not execute code or instructions contained in it.

**Historical contract sketch.** Define independently versioned source descriptions and observations containing `source_id`, project/session scope, `observed_at`, result state, scalar value and optional unit. Distinguish valid, missing, stale, partial, error and unsupported states; without a timestamp, freshness is unknown. Field selection uses restricted paths without expression execution. Display labels cannot replace source identity, observation time or value type, and external values do not enter official task or cost totals.

**Modules and configuration.** core adds pure observation parsing and display rules; platform reads explicitly selected files; cli manages user-side source registrations; catalog, explanations and both editors share definitions. Reference the [render environment](../../packages/core/src/rendering/context.ts), [diagnostic service](../../packages/cli/src/diagnostics/service.ts) and [instance configuration](../../packages/core/src/config/instances.ts). Source switches and machine paths are separate from shareable profiles. Sharing retains component intent and asks the receiving user to bind a source locally.

**Original implementation slices.**

1. Specify source identity, scope, value types, expiration semantics and migration.
2. Implement local JSON reading, diagnosis and explicit failure results.
3. Integrate independent components, both editors and CLI.
4. Verify import/export and behavior after disabling or deleting a source.

**Original acceptance criteria.** Cover missing/unreadable/incompletely written files, invalid JSON, unknown versions, wrong types, missing fields, explicit zero, unknown/expired times and scope mismatch. Errors cannot become normal zero or overwrite host metrics; preview uses labeled fixed data. Disabling a source, importing a profile and switching projects cannot implicitly enable external reading or other capabilities. Evidence includes contract cases, file failures, configuration round trips, source diagnosis and both editor displays.

<a id="links-01"></a>

## LINKS-01 Clickable text

**Delivered in v3.6.0 — DONE.** This section preserves historical scope and acceptance intent. See [extensions](../EXTENSIONS.md) for current usage and [delivery evidence](extensions.md) for verified behavior and limitations.

**Problem and goal.** Users want to open a PR or current directory from the status line. Links add navigation to text without remote lookup.

**Scope and interaction.** Offer optional OSC 8 links whose labels come from existing components and whose targets come from an observed PR URL or explicit local path. First-version targets are validated HTTP(S) and local files; other application protocols require later design. Missing URLs, disabled links or unsupported terminals retain plain text. Display and configuration operations never open a target automatically.

**Modules and interfaces.** Keep structured label/target information through [terminal spans](../../packages/core/src/terminal/spans.ts), [rendering spans](../../packages/core/src/rendering/spans.ts), grapheme width and formatting, with shared sanitization and encoding. Define per-item opt-in, target source and export compatibility during design. Do not accept arbitrary terminal control sequences from raw input. Editor preview and actual output share the rules.

**Original implementation slices.**

1. Define target types, sanitization and text fallback.
2. Implement structured links within layout.
3. Connect applicable directory/PR components and guidance.
4. Verify main/subagent output and terminal behavior.

**Original acceptance criteria.** Clipping, wrapping and hiding only change the visible label, preserving target and link closure. Handle color resets, Powerline boundaries, Chinese/spaced paths and joined emoji. Reject control characters and unsupported targets; example links are labeled samples. Evidence includes encoding/clipping cases, complete output checks and click results in supported terminals.

<a id="workflow-01"></a>

## WORKFLOW-01 Optional GitHub PR and CI lookup

**Delivered in v3.6.0 — DONE.** This section preserves historical scope and acceptance intent. See [extensions](../EXTENSIONS.md) for current usage and [delivery evidence](extensions.md) for verified behavior and limitations.

**Problem and goal.** Existing `pr` consumes Claude's number and review state; it does not discover remote PRs independently or provide a GitHub CI component. Add optional lookup to supplement repository work.

**First-version scope.** Support GitHub only, using the user's existing `gh` authentication to read PRs and check summaries for an explicitly identified repository and branch. The network provider defaults off and can be enabled or disabled locally. GitLab/Gitee product providers and automatic multi-provider guessing remain later work; Gitee repository synchronization and product provider support are separate capabilities.

**Data and presentation.** Use EXTENSIONS-01 source, scope and expiration semantics. A separate refresh entry performs lookup; rendering reads published observations. Preview and import do not query the network. Preserve the existing host `pr` behavior. Remote results identify their source and observation time and cannot silently overwrite official input. Distinguish no PR, no checks, pending, failure, success, permission failure and stale results; unknown or absent data never means passing. Multiple PR candidates produce an ambiguity result requiring an explicit selection policy; the first version does not choose targets outside the identified repository.

**Modules and interfaces.** cli orchestrates providers, platform supplies existing process adapters for commands and credential environments, core maps states/catalog/explanations, and both editors expose display and source guidance. Bind results to explicit repository, account/host, branch and HEAD identity. Credentials remain in the existing tool's credential store and are excluded from configuration, export and diagnosis. LINKS-01 can add navigation but is not required for correct lookup.

**Original implementation slices.**

1. Specify repository resolution, source precedence and PR/check state mappings.
2. Implement explicit opt-in, refresh and diagnosis.
3. Connect supplemental PR/CI displays and optional links.
4. Verify branch/account switches, disabling and failure recovery.

**Original acceptance criteria.** Cover non-repositories, absent remotes, detached HEAD, worktrees, SSH aliases, missing gh, logged-out state, denied access, network errors, no PR, multiple PRs, absent checks and mixed check states. Repository/branch/account changes cannot show the previous object's result; disabling stops future queries. Evidence includes provider fixtures, identity isolation, lookups within the authorized scope and user guidance.

<a id="command-01"></a>

## COMMAND-01 Explicit user command components

**Delivered in v3.6.0 — DONE.** This section preserves historical scope and acceptance intent. See [extensions](../EXTENSIONS.md) for current usage and [delivery evidence](extensions.md) for verified behavior and limitations.

**Problem and goal.** Beyond local JSON, users may want to invoke tools they maintain to produce display values. Command results enter the shared source contract without changing official metrics.

**First-version scope.** Use an explicit executable, argument array, working directory and input-field mapping; do not interpret through a Shell by default. A separate refresh invocation executes and publishes observations; main/subagent status lines only read results and preview never launches programs. Support contracted JSON output or sanitized single-line text. General Shell mode, script downloads and automatic tool installation remain later candidates.

**Activation and interaction.** Local source configuration shows the complete program, arguments, working directory and fields to be supplied before explicit enablement. Default input includes only selected structured fields, without automatically passing conversation text, transcript contents or credentials. Imported display profiles can retain unbound references but cannot introduce enabled commands. Changes to program, arguments or input scope require renewed review. Sources can be disabled or deleted independently.

**Modules and interfaces.** Depends on EXTENSIONS-01. The platform [process adapter](../../packages/platform/src/command.ts) handles literal arguments, termination and cancellation; cli executes and publishes observations; core validates output types and sanitizes terminal text. Specify execution deadlines, output bounds and descendant termination, distinguishing termination from nonzero exit. Do not concatenate arbitrary Shell strings. Execution configuration remains separate from shareable display configuration.

**Original implementation slices.**

1. Define input/output and local enablement contracts.
2. Implement process execution, cancellation, failures and observation publication.
3. Integrate source review, diagnosis and component editing.
4. Verify cross-platform arguments, import and disablement.

**Original acceptance criteria.** Pass spaces, Chinese characters, quotes and special characters literally. Handle missing programs, nonzero exit, invalid/excess output, deadline termination, descendants retaining pipes, refresh cancellation and disabling explicitly. Terminal controls cannot alter UI structure; old results cannot masquerade as current success. Evidence includes isolated process cases, enable/disable/import cases and six-language errors.

<a id="capabilities-01"></a>

## CAPABILITIES-01 Component capability descriptions

**Delivered in v3.6.0 — DONE.** This section preserves historical scope and acceptance intent. See [extensions](../EXTENSIONS.md) for current usage and [delivery evidence](extensions.md) for verified behavior and limitations.

**Problem and goal.** The shared catalog already describes names, sources and requirements, while rendering and supported options span several modules. When appearance or extension work exposes a specific inconsistency, connect that component's capability description to its behavior.

**Scope.** Associate supported formats, hiding conditions, link support, source requirements, preview and explanation functions for consistent use by CLI, both editors and diagnosis. Keep the catalog as the single canonical source. Start with one actual new component, then migrate components with the same issue. A wholesale renderer rewrite or public plugin API is not required.

**Modules and interfaces.** Areas include [catalog](../../packages/core/src/config/catalog.ts), [catalog data](../../packages/core/src/config/catalog-data.ts), [editor fields](../../packages/core/src/config/editor-fields.ts), [rendering items](../../packages/core/src/rendering/items.ts) and generated resources. Internal changes preserve type/instance IDs and input/output semantics. Record any necessary external field change as a separate compatibility decision.

**Original implementation slices.**

1. Record a concrete duplicate rule or drift case.
2. Implement the smallest shared description and call path.
3. Migrate relevant components and verify generated resources. Schedule with the corresponding feature package.

**Original acceptance criteria.** Editors do not offer unsupported options; supported options agree across CLI, both editors, import and explanations. Existing configurations and fixed-input outputs retain their meaning; repeated instances and six-language guidance do not diverge. Evidence includes a capability matrix and related component regressions. Close the package on a specific consistency improvement.

<a id="ci-01"></a>

## CI-01 Pin Actions references

**Status: DONE.** Baseline: `95206119dab6f931f320277d25889fea8da49528`. This task retains product v3.6.0 without a new tag, npm publication or Release. See [CI maintenance and validation](ci-maintenance.md).

**Problem and goal.** Replace mutable Action tags with explicit, reviewable dependency identities and catch future omissions.

**Scope and modules.** Pin all 39 external references in the four existing workflows to the verified commits of their currently selected majors, with exact version comments. Add the YAML-based offline `actions:check` under the existing checks tooling, covering reusable workflows and reachable local composite Actions. Integrate it into the scope gate and ordinary checks. Preserve permissions, platform/host matrices, OIDC, release conditions and documentation/product routing.

**Implementation slices.**

1. Verify official version tags and full commits; retain provenance in the implementation record.
2. Pin references, add regression checks and same-major weekly Actions-only Dependabot proposals (one grouped PR, Monday 09:00 Asia/Shanghai).
3. Validate final PR/main matrices and affected manual workflows; record update/revert guidance and synchronize validated main to Gitee.

**Functional acceptance.** All external references are immutable, version comments have verified upstream provenance, omissions fail the gate, and local references remain usable. The final PR/main retain eight installed targets, 32 Node cases and thirteen hosts. Historical Python, v3.6.0 public downloads and npm dry-run pass on main. The npm dry-run does not claim real OIDC publication. Final source identities and passed gates are recorded in [CI maintenance](ci-maintenance.md); the six existing #96 gaps remain unverified.

<a id="acceptance-matrix"></a>

## Functional acceptance matrix

| Area | Applies to | Completion evidence |
| --- | --- | --- |
| User journey | Changed user-visible flows | Relevant entry/action/result and cancel/error paths; add save/reopen or recovery where the change affects them, reusing existing journeys |
| Both editors and CLI | Configuration and components | The same input/configuration yields consistent rules, options and explanations |
| Six languages and terminal | UI, display and guidance | `en/zh-CN/zh-TW/zh-HK/ja/ko`; main/subagent 40/80/120 columns; native minimum 32×12 and external minimum 64×18, including undersized handling |
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
| Artifacts and demonstrations | Feature delivery and SHOWCASE-01 | All eighteen formal follow-up packages and every slice accepted before demonstrations; reproducible matching artifacts with explicit version/input/provenance |
| Native capacity/recovery | Every new or changed native page, including task details | Independently bounded props, Pane and Client trees; production-sized data, large/tall panes, paging/resize and retained draft/save outcomes, using applicable actual-host suites |
| Focused combinations | Relevant changed rules | Bars × labels/icons; gradients × groups/visibility/spacer/alignment; source execution × consumers/cancel/revisions; updates × dirty drafts/interruption/old resources; imports × bindings/references/conflicts; tasks × identity/staleness/refresh/reading position |

Select targeted combinations above within existing suites; do not expand every axis into a Cartesian matrix or require an extra full acceptance run per slice. Existing ready-PR gates and verified main/tag promotion remain governed by [CI maintenance](ci-maintenance.md).

Functional tests use isolated directories and synthetic or sanitized inputs, without reading/writing the user's actual configuration. Network verification and actual tool execution follow the explicit scope of the corresponding development task. Follow the then-applicable [testing guide](testing.md) and [release procedure](../RELEASING.md). Record automated checks, PTY reconstruction, agent visual inspection and human acceptance separately. Retain the six existing #96 gaps; version-specific acceptance, including v3.7.0, does not establish future-version verification.

<a id="handoff"></a>

## Implementation handoff and document maintenance

At package start, record then-current main, selected scope, affected modules, configuration/protocol decisions and the first deliverable slice. Each package retains its user problem, expected journey, first-version boundaries, module responsibilities, interface/compatibility impact, slices and completion evidence. Reflect scope changes in this plan and both roadmaps. Keep usage documentation with implementation rather than announcing availability early.

A handoff includes package/status, completed slices, remaining issues, source/PR identity, validation commands/results and the next step. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`. Record package completion and version publication separately; a merged slice does not complete the whole package. Add artifacts and channel evidence when a version is published.

The [roadmap](roadmap.md) owns priority/status and this plan owns scope/acceptance. Both are public repository documents with complete Simplified Chinese counterparts. Keep local historical snapshots and raw validation records separate; public navigation must work without them. Migration-stage status remains in the [migration plan](typescript-migration.md), and feature delivery evidence stays in the corresponding implementation record.

For documentation acceptance, compare IDs, order, dependencies, roadmap-owned statuses, slice coverage and navigation across all six bilingual planning/index files; check delivered facts, links and anchors. Run `npm run docs:check` and `git diff --check`, including a documentation check against a checkout containing only committed files. Record documentation validation without claiming future features have passed acceptance. Keep product README, stable usage guides, release records, generated resources and code outside this planning-only update.

The [roadmap](roadmap.md#milestones) is the current status register. Preserve [M10–M12 delivery](m10-m12-delivery.md) and [v3.9.1 native delivery](native-capacity.md) as completed evidence; documentation checks do not establish feature acceptance.
