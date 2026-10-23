# Development plan

**English** | [简体中文](development-plan.zh-CN.md) · [Roadmap](roadmap.md) · [Development guide](README.md)

Updated: **2026-10-23** (Asia/Shanghai) · Product baseline: **v3.6.0** · Planning baseline: **`2bdf429d3356796232efff926235617cdab4f430`**

This plan defines work-package scope, dependencies, implementation slices and acceptance intent. The [roadmap](roadmap.md) owns product priority and current status. The selected product order is APPEARANCE-03 → COMPOSITION-02 → WORKFLOW-02 → METRICS-01 → SHOWCASE-01, with GIT-01 as independent maintenance. These six packages are **NOT_STARTED**, without assigned versions or delivery dates. CI-01 remains **DONE**. This documentation update starts no implementation and publishes no product version.

Completed sections preserve historical design scope and acceptance criteria. Proposed fields, implementation slices and requested evidence in those sections describe the original plan; current commands, interfaces and verification limits are documented in the linked user guides and delivery records. A completed package does not mean that every physical or human check was verified. The six historical [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified; the [v3.6.0 decision](../releases/approvals/v3.6.0.json) records their acceptance for that release.

**Navigation:** [Index](#work-index) · [Shared design](#design-rules) · [Future packages](#future-work) · [Git review](#git-01) · [Graphical indicators](#appearance-03) · [Groups](#composition-02) · [Automatic refresh](#workflow-02) · [Cost rate](#metrics-01) · [Demonstrations](#showcase-01) · [Candidates](#candidate-boundaries) · [Delivered designs](#delivered-designs) · [First use](#setup-01) · [Complete schemes](#appearance-01) · [Appearance controls](#appearance-02) · [Local data](#extensions-01) · [Links](#links-01) · [PR and CI](#workflow-01) · [Commands](#command-01) · [Capabilities](#capabilities-01) · [CI maintenance](#ci-01) · [Acceptance matrix](#acceptance-matrix) · [Handoff](#handoff)

<a id="work-index"></a>

## Work package index

### Planned work

| Stage | Work package | Dependencies and scheduling | Status |
| --- | --- | --- | --- |
| Independent maintenance | [GIT-01](#git-01) | Existing Git/process adapters; independent of product order | NOT_STARTED |
| M4 | [APPEARANCE-03](#appearance-03) | Existing context/quota observations, formatting and layout | NOT_STARTED |
| M5 | [COMPOSITION-02](#composition-02) | Existing instances, visibility and Powerline; independent of M4 | NOT_STARTED |
| M6 | [WORKFLOW-02](#workflow-02) | Delivered EXTENSIONS-01 and WORKFLOW-01; GitHub only | NOT_STARTED |
| M7 | [METRICS-01](#metrics-01) | Existing session cost and duration fields; independent of M6 | NOT_STARTED |
| M8 | [SHOWCASE-01](#showcase-01) | Accepted features and a matching installed artifact; retain the existing ID | NOT_STARTED |

M4 → M5 → M6 → M7 → M8 expresses product priority, not additional technical prerequisites. Select a package and bounded slices before implementing it. GIT-01 is an investigation and any necessary protection work; this plan does not establish a vulnerability. See the [candidate pool](roadmap.md#candidates) for items outside the mainline.

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
| As needed | [CAPABILITIES-01](#capabilities-01) | Include when related features expose specific duplicate or inconsistent metadata | DONE |
| Maintenance | [CI-01](#ci-01) | Independent maintenance; does not block M1/M2/M3 | DONE |

M1 → M2 → M3 records the historical delivery sequence. SHOWCASE-01 was originally scheduled with M2 and remains unstarted under M8. Documentation updates do not change feature statuses. CI-01 includes weekly Dependabot proposals for same-major Actions updates. See [implementation and validation](ci-maintenance.md).

<a id="design-rules"></a>

## Shared design rules

- **Product focus:** the status line presents tasks, agents, projects and usage clearly; existing on-demand entry points provide detail and explanation. Preserve real zero and distinct missing, stale, partial or unsupported states. Do not infer task outcomes without evidence.
- **Shared implementation:** core owns pure configuration, catalog, Unicode, layout and explanation; platform owns files, processes and terminals; cli orchestrates services; tui and native Mods adapt interactions. Reuse existing transactions and task stores. [Current architecture](architecture.md).
- **Configuration boundaries:** UI language saves immediately, display language and appearance follow display Save, and Claude preferences retain separate Apply. Preview, import review and scheme selection produce candidate drafts. Make user default, named profile and project editing targets clear. [Profile semantics](../PROFILES.md).
- **Compatibility:** display schema 10, editor protocol 17, runtime 2, lifecycle 4, portable 1, UI preferences 1 and profile collection/export 1 evolve independently. Specify added fields and the interpretation of old data before assigning versions. Reading old files does not silently rewrite them; migrations use existing backup and recovery mechanisms.
- **Extension authorization:** default capabilities use host input and local state. External file sources, network providers and commands are separately enabled and registered in user configuration. A display scheme may reference a source, but import, preset selection and project binding cannot grant execution or network access.
- **Scope boundaries:** complete the selected packages' concrete journeys. Bars are an explicit display choice; automatic representation switching remains outside the first version. Daily budgets, time cursors, gradients, cross-line alignment, selective import/merge, automatic command execution and additional providers require separate scope decisions. See [candidate boundaries](#candidate-boundaries).
- **Future interfaces:** describe configuration intent, data flow and compatibility before assigning future schema/protocol versions or public command spellings. Reuse catalog capabilities and generated editor resources. New options must survive preview, save/reopen, profile selection, import/export and conflict handling; reading an old configuration does not enable new behavior.

<a id="future-work"></a>

## Future work packages

These sections describe planned behavior, not available commands or completed checks. Each future implementation records its starting `main`, interface decisions and first deliverable slice. Apply the shared [acceptance matrix](#acceptance-matrix) alongside the package-specific criteria.

<a id="git-01"></a>

## GIT-01 Git invocation review and necessary protections

**Status: NOT_STARTED.** Independent maintenance; the static comparison found a protection difference that has not been reproduced as a vulnerability.

**Problem and goal.** Passing literal argv to Git does not alone determine which programs Git may start from repository configuration. Establish what the current collectors actually execute and correct verified gaps without changing metric meaning or modifying user repositories.

**Scope and flow.** Inventory direct Git calls and Git invoked through provider tools. Review fsmonitor, local/worktree filter commands and implicit bare-repository discovery. In isolated fixtures, compare current behavior with a proposed invocation policy, record whether a change is necessary, then apply only necessary protections. Preserve legitimate Git LFS and other supported user-managed filters through an explicit compatibility table; do not blanket-disable every global/system setting or weaken Git's ownership checks.

**Data and modules.** Start with [GitCollector](../../packages/cli/src/runtime/git.ts), source context/provider orchestration in cli, and platform process adapters. Use one shared invocation policy for affected entry points; keep parsing and metric rendering in core. Diagnosis reports unavailable/blocked results without exposing credentials, running test programs in real repositories or rewriting `.git/config`.

**Interface and compatibility.** Preserve existing item IDs, status meanings and source identities. No new user command or display schema is presumed necessary. Specify repository-local versus user-level configuration, known filter compatibility and indirect Git environment before implementing a correction. If a metric cannot be collected under the chosen policy, retain an explicit unavailable reason rather than a normal zero or clean result.

**Implementation slices.** Inventory and isolated reproduction → behavior/compatibility table → shared policy and affected call sites if needed → regressions and diagnosis guidance. A no-change conclusion must retain the reproduction and rationale.

**Functional acceptance.** Cover repository-controlled fsmonitor/filter invocation, local/worktree versus global/system settings, known filters, indirect provider calls, bare and linked worktrees, Chinese/space paths, invocation failures and ordinary clean/dirty repositories. Prove the selected policy prevents unintended program execution, preserves supported metric semantics and leaves repository/user configuration unchanged. Keep the investigation outcome distinct from any corrected defect.

<a id="appearance-03"></a>

## APPEARANCE-03 Graphical context and quota indicators

**Status: VALIDATING.** First in product order; uses existing observations without enabling collection.

**Problem and goal.** Help users read context and quota levels at a glance while retaining existing number-based display and data definitions.

**Scope and flow.** Add an explicit short-bar option to main context-used/context-remaining, five-hour, weekly and spending-limit percentages, and subagent context-used/context-remaining. Users select an eligible instance, choose numeric or bar presentation and bar width, preview, save and reopen. Numeric presentation remains the default. Used/remaining direction is labeled and matches the existing selection; a bar does not imply time elapsed, task completion or a budget forecast. Time cursors and automatic representation switching remain candidates.

**Data and modules.** Core formats the same validated raw percentages used by existing indicators and visibility rules. Shared catalog capabilities/editor fields expose only supported options; cli, external TUI and native Mod consume the same draft. Terminal handling uses existing color/character fallbacks. Samples remain fixed and do not read external sources.

**Interface and compatibility.** Plan per-instance presentation/width options with shared CLI/editor validation, persistence, import review and explanation. Assign exact fields and schema/protocol changes in the implementation's compatibility record. Existing configurations, instance IDs and numeric output retain their behavior. Provide Unicode and ASCII bars, label plus percentage, and existing unavailable-state handling; never draw a missing value as a zero bar. Fit/clipping includes the bar, label and number without splitting graphemes.

**Implementation slices.** Eligible-component and display contract → pure formatting and width/fallback behavior → both editors/CLI and configuration round trips → samples and functional guidance.

**Functional acceptance.** Cover zero, full and fractional percentages, used/remaining direction, invalid/missing/expired observations and independent subagent values. Verify unchanged default numeric output, visibility thresholds using raw values, repeated instances with different modes, 40/80/120-column output, Powerline/spacers, no color, ASCII and joined emoji/CJK labels. Save, reopen, copy, profile binding and import/export preserve options across all six interface/output languages.

<a id="composition-02"></a>

## COMPOSITION-02 Component groups and linked visibility

**Status: NOT_STARTED.** Second in product order; independent of APPEARANCE-03.

**Problem and goal.** Avoid orphaned decorative text/icons when a metric disappears, and let related instances share one Powerline block without changing their data scope.

**Scope and flow.** Users select continuous instances in one scope, designate one metric as primary, and choose linked decoration visibility and optional shared Powerline presentation. The first version is single-level, cannot cross an explicit row boundary or spacer, and does not nest groups. Automatic layout treats a group as a unit. Decorative text follows the primary metric's final visibility, including layout omission; unknown data follows the primary's existing visible/unavailable behavior. Other metric members retain their own conditions and cannot create values for the primary.

**Data and modules.** Core owns group references, validation, visibility resolution and ordinary/Powerline drawing. The primary supplies a shared block's background; member foreground and threshold colors remain effective, and member background options remain saved for use when sharing is off. Cli configuration/profile services persist drafts; both editors offer create/edit/ungroup operations from shared rules. No extra collection or source authorization is introduced.

**Interface and compatibility.** Add group-to-instance references and shared editor/CLI operations; record exact wire fields and version changes before implementation. Ungrouped old configurations retain their output. Copying a whole group creates new identities and remaps references; deleting its primary dissolves the group while preserving surviving instances/options. Invalid moves across a row/spacer or into a noncontinuous/nested group are rejected without losing the draft. Ordinary separators, shared blocks and narrow-row omission/clipping must not leave decorations behind. Portable export includes display grouping only and never grants source access.

**Implementation slices.** Group/reference and primary-visibility contract → pure validation and layout → both editors/CLI and profile/import operations → examples and diagnosis explanations.

**Functional acceptance.** Cover a primary hidden by a condition, absent data or layout, visible unknown/partial states, disabled members, multiple metrics and completely hidden groups. Check shared/separate blocks, color reset, auto/explicit rows, spacer boundaries, narrow rows and independent agent groups. Copy/delete/ungroup, rejected reorder, save conflicts, import/export and profile binding preserve identities or report invalid references. Preview and actual output share the same rules in six languages.

<a id="workflow-02"></a>

## WORKFLOW-02 Opt-in automatic GitHub PR/CI refresh

**Status: NOT_STARTED.** Third in product order; depends on delivered EXTENSIONS-01 and WORKFLOW-01.

**Problem and goal.** Keep an enabled GitHub source current during an active session without repeatedly opening manual refresh.

**Scope and flow.** Cover GitHub PR/CI only. Existing sources remain manual by default. After source review/enablement, the user separately selects automatic refresh, reviews its period and active project/session, and saves the local policy. The proposed default period follows that source's configured validity period and can be changed explicitly. Active-session lifecycle events arrange due refreshes through independent tasks; no persistent system service is installed. Contexts without supported lifecycle evidence remain manual and explain why. Stop starting automatic tasks when the associated context ends. Turning automatic refresh off cancels its automatic work while retaining manual refresh and cached observations; source disable/edit/delete retains existing cancellation and re-review rules.

**Data and modules.** Cli orchestrates lifecycle eligibility, due-task dispatch and existing source jobs; platform owns process cancellation and context identity. Core exposes policy/status/explanation, and both editors/CLI provide configure, inspect and stop operations. Rendering reads published observations; it does not run `gh` or start network queries. Preview, scheme import and project binding do not dispatch work. Command and JSON sources do not gain automatic execution.

**Interface and compatibility.** Store automatic policy with local source management, separately from portable display schemes; enabling a source does not itself enable repetition. Define policy revision, active-context association and task-origin information before assigning wire versions. Reuse source/host/account/repository/branch/HEAD and authentication identity checks; deduplicate concurrent attempts for one source/context and reject late results after policy/context changes. Preserve the last valid value only under existing freshness/error markings; never show an old identity's result. Preserve distinct no-PR/no-checks/pending/failure/unknown states and keep credentials in `gh` authentication.

**Implementation slices.** Policy and lifecycle/stop contract → independent task dispatch and cancellation → both editors/CLI and diagnosis → isolated lifecycle journeys and authorized provider validation.

**Functional acceptance.** Cover default manual behavior, opt-in, first/due refresh, concurrent sessions, manual refresh during automatic operation, policy changes, source edit/disable/delete, session exit and unsupported hosts. Repository/worktree/branch/HEAD/account switches and late results must not cross identities. Cover authentication/network failures, no PR, ambiguous PRs and mixed checks. Closing policy editing without saving cannot enable repetition; imports/previews do not query; stopping automatic work leaves manual refresh available. Use isolated fixtures; live queries require the concrete future task's authorized scope.

<a id="metrics-01"></a>

## METRICS-01 Session cost rate

**Status: NOT_STARTED.** Fourth in product order; independent of automatic refresh.

**Problem and goal.** Explain existing session spending as an hourly rate with an explicit denominator, without inventing billing or task measurements.

**Scope and flow.** Add an optional main-line cost-rate component, unselected by default. In item details users choose session time (default) or API cumulative time, preview, save and reopen. Compute `total_cost_usd / (duration_ms / 3600000)` from corresponding official session fields. Display the selected denominator clearly; API time is not `task-active-timer`. Require at least 60,000 ms of the chosen duration; shorter/missing/invalid durations make the rate unavailable. Valid zero cost over sufficient observed time yields a visible zero rate.

**Data and modules.** Core validates/formats existing `cost.total_cost_usd`, `cost.total_duration_ms` and `cost.total_api_duration_ms`. Catalog capabilities, fixed samples and explanation share the definition. Cli and both editors reuse normal instance selection, formatting and persistence; no new collector, pricing table, transcript estimate or network source is needed.

**Interface and compatibility.** Plan one new main metric and a per-instance denominator choice across CLI, both editors, import/export and profiles. Confirm the final ID, options and any schema/protocol impact in the implementation record before coding. Do not alter session-cost, session/API duration or task-timer semantics. Labels identify an estimate derived from session fields, not an invoice or future spending prediction. Daily budgets and quota pacing stay in the candidate pool.

**Implementation slices.** Definition/denominator and availability contract → pure calculation, sample and explanation → both editors/CLI and round trips → metric guide and acceptance examples.

**Functional acceptance.** Cover both denominators, the one-minute boundary, zero cost, missing/negative/nonfinite values, zero duration and incomplete field combinations. Known inputs verify the formula, independently configured repeated instances and clear six-language labels. Selection, cancellation, save/reopen, import/export and project profiles preserve the intended denominator without enabling collection or changing existing metrics.

<a id="candidate-boundaries"></a>

## Candidate boundaries

The [roadmap candidate pool](roadmap.md#candidates) records unscheduled options and promotion conditions. Daily budgets require authoritative full period boundaries and timezone; a spending label is insufficient. Time cursors/pacing, cross-line alignment, gradients, selective import/merge, command repetition and GitLab/Gitee providers are outside these first versions. JJ, service-status components and the previously deferred broader integrations likewise require actual user demand. Candidates are not mainline implementation dependencies or acceptance conditions.

<a id="delivered-designs"></a>

## Delivered designs and retained demonstration package

Completed packages below retain historical scope and evidence. SHOWCASE-01 remains a future package at its existing anchor; its current scheduling is M8.

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

**Status: NOT_STARTED.**

**Scheduling.** M8, after the functional mainline in product order. Retain the existing ID and delivered SETUP-01/APPEARANCE-01/APPEARANCE-02 journeys; show later features only after acceptance and from the matching artifact. Candidates do not block this package. This planning update does not edit the product homepage, create media or run demonstration sessions.

**Problem and goal.** The homepage already contains many platform screenshots and feature explanations. Let visitors first see task/subagent strengths, available schemes and entry points, then reach detailed platform guides as needed.

**Page design.** Start README with one product sentence, a short demonstration, three scenario schemes, the recommended installation/setup path and documentation links. Retain platform images and provenance in the corresponding image index or collapsed sections; English and Chinese convey the same information. Unreleased commands stay in development guidance rather than stable installation instructions.

| Demonstration part | User action | Verifiable result |
| --- | --- | --- |
| Integration | Run delivered setup, inspect and select a scheme | Show review before apply, integration outcome and restart guidance |
| Adjustment | Edit a label, duplicate/reorder a component and change appearance | Draft preview changes and saved actual display agree |
| Multi-agent work | Show task/agent states with explicit provenance and open task details | Main task and agents remain distinct; sources and coverage are understandable |
| Reuse | Save a profile copy and bind an example project | Reopening identifies the target and selected profile clearly |

**Data and modules.** Later production uses a functionally accepted installed package, [terminal capture tools](../../tools/acceptance) and the [image provenance index](../images/README.md). Label fixed samples and actual sessions separately. Distinguish human desktop captures, PTY reconstructions and manually composed material. Record filenames, version, platform, terminal width, colors and input source; remove private paths and session content from actual captures.

**Implementation slices.**

1. Freeze text and scripts against the selected accepted feature set and matching installed artifact, retaining SETUP-01/APPEARANCE-01/APPEARANCE-02 journeys.
2. Record the main demonstration and three scheme views.
3. Update bilingual README, quick-start guidance and image index.
4. Verify installation steps, links, alternative text, collapsed reading and provenance. Keep version and update notes in release documentation.

**Functional acceptance.** Every demonstrated operation is reproducible in the named version; installation commands and support claims agree. Samples are not represented as actual user results. A new reader can locate installation, configuration, the three schemes and troubleshooting from the homepage. Evidence includes script walkthroughs, screenshot/video provenance and bilingual link checks. Completion does not automatically establish that human usability research passed.

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
| User journey | Every user-visible package | Entry → edit/select → preview → apply → reopen/actual result, including complete cancel/error paths |
| Both editors and CLI | Configuration and components | The same input/configuration yields consistent rules, options and explanations |
| Six languages and terminal | UI, display and guidance | `en/zh-CN/zh-TW/zh-HK/ja/ko`; main/subagent 40/80/120 columns; native minimum 32×12 and external minimum 64×18, including undersized handling |
| Data sources | Extensions, tasks and diagnosis | Distinguishable sample/actual, source/scope and zero/missing/stale/partial/error states |
| Save and recovery | Installation and persistence | Old configuration, instance identity, project bindings, concurrent revisions, migration backups, cancellation and failure recovery |
| External capabilities | EXTENSIONS-01/WORKFLOW-01/COMMAND-01 | Off by default, explicitly enabled and independently disabled; import/preview cannot execute or access the network |
| Future indicators/groups/rates | APPEARANCE-03/COMPOSITION-02/METRICS-01 | Unchanged defaults, explicit instance choices, trustworthy data meaning, linked visibility and valid configuration round trips |
| Future lifecycle and Git policy | WORKFLOW-02/GIT-01 | Separate automatic enablement, visible stop/failure behavior, identity isolation and verified invocation compatibility |
| Platforms and hosts | Features affecting them | Existing Node 22/24, supported platforms and applicable host verification; gaps retain their actual status |
| Artifacts and demonstrations | Feature delivery and SHOWCASE-01 | Reproducible installed-artifact behavior and explicit demonstration provenance, version and input |

Functional tests use isolated directories and synthetic or sanitized inputs, without reading/writing the user's actual configuration. Network verification and actual tool execution follow the explicit scope of the corresponding development task. Follow the then-applicable [testing guide](testing.md) and [release procedure](../RELEASING.md). Record automated checks, PTY reconstruction, agent visual inspection and human acceptance separately. Retain the six existing #96 gaps; version-specific acceptance, including v3.6.0, does not establish future-version verification.

<a id="handoff"></a>

## Implementation handoff and document maintenance

At package start, record then-current main, selected scope, affected modules, configuration/protocol decisions and the first deliverable slice. Reflect scope changes in this plan and both roadmaps. Keep usage documentation with implementation rather than announcing availability early.

A handoff includes package/status, completed slices, remaining issues, source/PR identity, validation commands/results and the next step. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`. Record package completion and version publication separately; a merged slice does not complete the whole package. Add artifacts and channel evidence when a version is published.

The [roadmap](roadmap.md) owns priority/status and this plan owns scope/acceptance. Both are public repository documents with complete Simplified Chinese counterparts. Keep local historical snapshots and raw validation records separate; public navigation must work without them. Migration-stage status remains in the [migration plan](typescript-migration.md), and feature delivery evidence stays in the corresponding implementation record.

For documentation acceptance, compare IDs, order, dependencies and statuses across the four active planning files and navigation in both development guides; check delivered facts, links and anchors. Run `npm run docs:check` and `git diff --check`, including a documentation check against a checkout containing only committed files. Record documentation validation without claiming future features have passed acceptance. Keep product README, stable usage guides, release records, generated resources and code outside this planning-only update.
