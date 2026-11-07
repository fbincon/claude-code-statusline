# Development roadmap

**English** | [简体中文](roadmap.zh-CN.md)

This roadmap owns product direction, priorities and work-package status. The [development plan](development-plan.md#work-index) explains how to define scope, dependencies, slices and acceptance. The [history index](history/README.md#delivery-records) links implementation and publication evidence.

M1–M12 and the eighteen selected follow-up packages are delivered. [SHOWCASE-01](showcase.md#delivery) demonstrates those workflows using the recorded package and capture inputs. The candidate pool below lists possible future work.

[Candidates](#candidates) · [Planning baseline](#baseline) · [References and acknowledgements](#reference) · [Delivered milestones](#milestones) · [Work packages](#packages) · [Acceptance](#acceptance) · [Delivery history](#delivery-history) · [Maintenance](#maintenance)

<a id="candidates"></a>

## Candidate pool and entry conditions

The [delivered mainline](#milestones) covers the previously selected improvements, including automatic command refresh under [COMMAND-02](development-plan.md#command-02). Existing IMPORT-01, APPEARANCE-04 and COMPOSITION-03 remain delivered. The pool below contains only unselected directions.

### Functional candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| Additional token-rate views | Compare observed session or recent-window token throughput; select one scope first | Define duration, token inclusion, replay deduplication and main/agent scope; preserve existing latest-request `output-rate` meaning |
| Additional cache views | Inspect read/write amounts or ratios for a selected request/session scope | Existing `prompt-cache` already exposes hit ratio/write tokens; require a distinct need, authoritative fields and an explicit denominator |
| Daily remaining budget | Show a verified daily allowance remainder or a clearly identified user budget | Reliable amounts, currency, freshness, full period boundaries and timezone; a `monthly` label alone is insufficient |
| Quota consumption pacing and time cursors | Compare quota consumption with verified window progress | Establish window boundaries, elapsed-time meaning and unknown behavior; distinguish countdown, consumption and estimates |
| GitLab provider | Inspect a branch's merge request and CI; begin with manual read-only lookup | Actual demand, authoritative fields, existing authentication and repository/branch/HEAD identity; define GitLab-specific states |
| Gitee provider | Inspect a branch's pull request and CI; begin with manual read-only lookup | Actual demand, authoritative fields and provider-specific authentication/identity; repository mirroring is separate |
| Service status | Show a selected service's published status and freshness | Reliable source and distinct unavailable/stale states; global service status does not establish personal request or gateway health |
| Voice configuration hint | Indicate observed voice-input configuration | Verify configuration precedence and availability; configured enablement does not establish active recording |
| Sandbox configuration hint | Indicate observed sandbox configuration | Verify managed/CLI overrides and availability; configured enablement does not establish active isolation |

### Supporting candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| Migration guidance | Help a user map an existing setup to this product | Verified source/target versions, capability mapping, manual steps and recovery; do not promise lossless automatic conversion |

The [contribution guide](../../CONTRIBUTING.md), [bilingual Bug form](../../.github/ISSUE_TEMPLATE/bug_report.yml) and blank question/feature Issues are already available; see [repository maintenance](repository-governance.md). They are maintained entry points, rather than new development candidates.

### Longer-term candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| JJ | Show Jujutsu state for a real user's repository | Identified demand, reliable output and availability/identity semantics; select read-only fields first |
| Other clients | Reuse a selected capability with a named client | A verified input/lifecycle contract and a concrete integration/support boundary |
| Plugin marketplace | Discover and manage third-party components | Actual extension use plus a selected distribution, trust, compatibility and lifecycle model |
| Automatic script downloads | Obtain a named external component | A separately selected source, integrity, review, installation and removal design |
| General Shell mode | Support a concrete command requiring Shell interpretation | A separate interaction and execution-authorization design beyond the existing executable/argv source |

Candidates have no assigned version or date. Listing one does not start development or make it a prerequisite for the formal packages or SHOWCASE-01. Promote a candidate only through an explicit scope decision and a corresponding work-package update. Evaluate distinct user needs and data definitions rather than component counts.

<a id="baseline"></a>

<a id="current-baseline-and-product-direction"></a>

## Planning baseline and product direction

The planning snapshot on **2026-10-30** (Asia/Shanghai) uses [v3.16.0](language-expansion.md#final-release) as its product baseline. The original planning source is `0f5638f613c8ffc9588a50d30ebc51f14549b1fb`.

The table describes the capabilities used to plan from v3.16.0. See the [user guide](../USER_GUIDE.md) for current procedures and the [changelog](../../CHANGELOG.md) for changes since that baseline.

| Area | Delivered capability | Planning implication |
| --- | --- | --- |
| Configuration entry points | First-use setup wizard, in-session editor, external TUI, CLI, conversational guide and Quick setup | Reviewed durable entry and explicit upgrade/rollback/recovery are delivered |
| Display composition | Six existing presets, eight complete schemes, component instances, duplication/reordering, text, spacers, import review, colors, six Powerline controls, optional/adaptive percentage bars, linked groups, selective import, static foreground/Powerline-background gradients, continuous final-row backgrounds and explicit main-row alignment | Extend themes, gradients and reuse while preserving existing display choices |
| Appearance review | Eight themes, eleven gradient presets, visible color editing, fourteen sample scenarios, session-only widths and explicit file diagnosis using the unsaved draft | Extend reuse without changing source authorization |
| Tasks and projects | Task timing, separate subagent rows, both-editor read-only task browsing, named profiles and project-root bindings | Preserve evidence attribution while extending configuration reuse |
| Languages | `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`, `id`; independent UI and output languages | I18N-02 provides incremental maintenance, A-development completeness and strict readiness for every official language |
| Display catalog | 65 main metrics and 15 subagent metrics; 67/17 types including text and spacers | Preserve IDs and metric definitions when adding items |
| Existing data | Host `pr` number/review state, linked-worktree fallback, prompt-cache hit ratio/write tokens, cache state/expiry/miss causes and latest-request output rate | Keep existing scopes and definitions when considering additional metrics |
| Extension data | Local JSON, GitHub PR/CI and commands; readable state, check pagination, reference-protected bindings and separately reviewed active-session refresh; optional OSC 8 links | Keep authorization separate from display schemes; clear local bindings only in imported sections |
| Native presentation | Host-retained editing state, bounded visible frames, independent capacity checks and recoverable save outcomes | Apply these boundaries to every new page; see [capacity and recovery](native-capacity.md) |
| Interfaces | Display schema 17, editor protocol 31, source registry 3/jobs 4, observation 1, runtime 3, lifecycle 4, portable 1, UI preferences 1; profile collection/export 1 | Explain compatibility for each interface independently |
| Support boundaries | Linux/WSL, Windows, macOS; Node 22/24 product runtimes | Preserve supported environments and record actual verification |

The [review baseline](development-plan.md#review-baseline) separates isolated reproductions, source-confirmed gaps and proposed capabilities. The previous planning snapshot is `f68d26eeddda98ab4041d2b9e873ade556fa1909`. See the [catalog](../../packages/core/src/config/catalog-data.ts), [editor protocol](../../packages/core/src/contracts/ui.ts), [architecture](architecture.md) and [delivery index](history/README.md#delivery-records) for the corresponding definitions and evidence.

Default capabilities use Claude input and local state. Network lookup and custom commands require separate enablement; importing a scheme, binding a project or selecting a preset cannot enable them.

The six historical gaps tracked in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) remain **unverified**. Version-specific acceptance, including the [v3.9.2 decision](../releases/approvals/v3.9.2.json), records permission to release with those gaps; it does not establish that the missing checks passed or waive new failures.

<a id="reference"></a>

## Reference projects and acknowledgements

Thank you to Matthew Breedlove ([sirmalloc](https://github.com/sirmalloc)) and the contributors to [ccstatusline](https://github.com/sirmalloc/ccstatusline) for their open-source work. Its configuration experience, presentation controls and widget interfaces provided useful design references when preparing this roadmap.

The references below use the inspected [ccstatusline v2.2.32 snapshot](https://github.com/sirmalloc/ccstatusline/tree/bed850187783904a9affcaba1dd80e967622e70b). They identify the material considered and the related work in this project; implementation decisions follow this project's user needs and architecture.

| Reference material | Related work in this project |
| --- | --- |
| [Entry and installation guidance](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/README.md) | SETUP-01: connect checks, preview, integration and next actions |
| [Powerline and presentation controls](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/docs/USAGE.md) | APPEARANCE-01/02 and SHOWCASE-01: complete schemes, appearance controls and demonstrations |
| [Widget capability interface](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/types/Widget.ts) | CAPABILITIES-01: consistent catalog, editor options and rendering descriptions |
| [Links, PR/CI and command widgets](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/docs/USAGE.md) | LINKS-01, WORKFLOW-01 and COMMAND-01: optional navigation and external sources |
| [Pinned Actions references](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/.github/workflows/ci.yml) | CI-01: reviewable dependency identities and omission checks |
| [Git invocation hardening](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-hardening.ts) | GIT-01: investigate repository-controlled program execution and necessary protections |
| [Context bar](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/widgets/ContextBar.ts) and [rendering composition](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/renderer.ts) | APPEARANCE-03 and COMPOSITION-02: optional graphical indicators and grouped presentation |
| [PR/CI cache refresh](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-review-cache.ts) | WORKFLOW-02: separately enabled GitHub refresh with explicit lifecycle and identity |
| [Session cost rate](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/widgets/SessionCostRate.ts) | METRICS-01: explain hourly cost using existing session and API durations |

Keep the original project and authors credited when discussing these references. Any reuse of source or documentation must retain the applicable copyright and license notices; the inspected project includes an [MIT license](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/LICENSE).

<a id="milestones"></a>

## Stages and dependencies

These records preserve the status, original dependencies and scheduling of delivered work. See [delivery history](#delivery-history) for versions and evidence.

<a id="planned-mainline"></a>

### Delivered mainline

<details>
<summary>View delivered mainline packages, dependencies and scheduling</summary>

| Batch | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| Language workflow | [I18N-02](development-plan.md#i18n-02) | Current-source language fallback during development and complete six-language releases | All three slices, compatible PR/main/tag verification and public delivery; [v3.15.0 evidence](i18n-02-delivery.md#final-release) | DONE |
| 1 Correctness | [FIX-01](development-plan.md#fix-01) | Protect every display-draft edit while a save outcome is unknown | Existing save/reconciliation state and shared editor actions | DONE |
| 1 Correctness | [FIX-02](development-plan.md#fix-02) | Consistent hidden, short and custom labels with percentage bars | Shared indicator and decoration rules | DONE |
| 1 Correctness | [FIX-03](development-plan.md#fix-03) | Leaving one refresh consumer preserves other consumers' work | Shared source jobs, editor close and CLI cancellation | DONE |
| 1 Maintenance | [FIX-04](development-plan.md#fix-04) | Time-applicable extension diagnosis with evidence for every agent | Existing diagnosis and source observation contracts | DONE |
| 1 Maintenance | [I18N-01](development-plan.md#i18n-01) | Correct task-detail language on first open, failure and retry | Existing UI preferences and task pane | DONE |
| 2 Appearance | [APPEARANCE-05](development-plan.md#appearance-05) | More themes/gradient presets, visible color selection and gradient edits | Existing appearance rules; shared theme registration | DONE |
| 2 Understanding | [PREVIEW-01](development-plan.md#preview-01) | Selectable sample states for appearance and layout review | Production renderer with injected observations | DONE |
| 2 Understanding | [EXPLAIN-02](development-plan.md#explain-02) | Explain inactive styles/sources and explicitly diagnose an input file | Existing explanation/diagnosis; FIX-04 for trustworthy extension evidence | DONE |
| 3 Task entry | [TASK-02](development-plan.md#task-02) | External read-only task browsing, then shared reading controls | Existing task model/service and I18N-01 language handling | DONE |
| 3/4/later Versions | [UPDATE-02](development-plan.md#update-02) | Status/review, execution/recovery and protected history cleanup | Existing UPDATE-01; execution follows review and safe draft/process handoff | DONE |
| 4 Source operations | [SOURCES-01](development-plan.md#sources-01) | Readable state, saved GitHub check pages, compatible binding reuse and protected cleanup | Existing source services; FIX-03 lifecycle rules | DONE |
| 4 Scheduling | [COMMAND-02](development-plan.md#command-02) | Separately approved periodic commands during applicable active sessions | FIX-03; existing command execution and active-session leases | DONE |
| 5 Continuous color | [APPEARANCE-06](development-plan.md#appearance-06) | Continuous backgrounds across adjacent blocks of one displayed row | Existing fitting, groups, alignment and Powerline edge colors | DONE |
| Later, interleavable | [APPEARANCE-07](development-plan.md#appearance-07) | Optional narrow-row bars that retain numeric meaning | FIX-02 and existing fitting/priorities | DONE |
| Later, interleavable | [UX-03](development-plan.md#ux-03) | Shared undo/redo, change review and external conflict recovery | FIX-01 and existing revision-bound save/reload/export | DONE |
| Later, interleavable | [IMPORT-02](development-plan.md#import-02) | Style copying, whole-group reuse and explicit local-source rebinding | Existing IMPORT-01 and reference validation | DONE |
| Later, interleavable | [COMPOSITION-04](development-plan.md#composition-04) | Review and atomically adjust affected alignment references | Existing group/alignment invariants and shared edits | DONE |
| Later, interleavable | [PROFILE-02](development-plan.md#profile-02) | Scenario schemes that demonstrate delivered new capabilities | Only the appearance/composition capabilities each scheme uses | DONE |
| Final demonstration | [SHOWCASE-01](development-plan.md#showcase-01) | Bilingual demonstrations, configurations and reproducible journeys | The original eighteen follow-up packages and every slice accepted; matching installed artifacts | DONE |

Batches express delivery preference, not extra technical dependencies. Themes, task browsing and version review can progress independently after their own prerequisites. UPDATE-02 and SOURCES-01 retain one package identity across their separately deliverable slices; a package completes only when all its slices are accepted. Later improvements can be interleaved under their own dependencies, preserving the delivered binding and history protections.

SHOWCASE-01 retains its historical ID. Its earlier M13 placement is superseded by the maintainer's decision to wait for the original eighteen formal packages and their slices, including later improvements. I18N-02 was scheduled separately and does not add a prerequisite for SHOWCASE-01; remaining candidates do not add prerequisites either. M1–M12 retain their historical numbering and delivery evidence.

SHOWCASE-01 is delivered using the published v3.16.0 package with non-Powerline demonstrations. [Prerequisites, collection and separate acceptance records](showcase.md) retain the original product/evidence identities; [the user walkthrough](../SHOWCASE.md) owns reproducible usage.

GIT-01 and TERMINAL-01 remain delivered. Reuse applicable Windows preview outcomes and the shared Git policy from [M8–M9 delivery](m8-m9-delivery.md), and preserve the native boundaries established by [v3.9.1](native-capacity.md). Current validation routes remain defined in [CI maintenance](ci-maintenance.md).

</details>

### Delivered stages

<details>
<summary>View earlier milestones and independent maintenance</summary>

| Stage | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| M1 First use | [SETUP-01](development-plan.md#setup-01) | A connected flow from checks to configuration, integration and next steps | Existing installation transactions and Quick setup | DONE |
| M2 Appearance | [APPEARANCE-01](development-plan.md#appearance-01) | Three complete schemes for daily development, multi-agent work and quota monitoring | Existing presets and profile management | DONE |
| M2 Appearance | [APPEARANCE-02](development-plan.md#appearance-02) | Configurable padding, separators and end decorations | Concrete APPEARANCE-01 scenarios | DONE |
| M3 Extensions | [EXTENSIONS-01](development-plan.md#extensions-01) | Opt-in local JSON data components and a source contract | Existing diagnosis and component instances | DONE |
| M3 Extensions | [LINKS-01](development-plan.md#links-01) | Clickable PR/directory text with plain-text fallback | Existing text and layout rules | DONE |
| M3 Extensions | [WORKFLOW-01](development-plan.md#workflow-01) | Optional GitHub PR lookup and CI status | EXTENSIONS-01; LINKS-01 is optional | DONE |
| M3 Extensions | [COMMAND-01](development-plan.md#command-01) | Explicitly configured external command components | EXTENSIONS-01 | DONE |
| M4 Graphical indicators | [APPEARANCE-03](development-plan.md#appearance-03) | Optional short bars for context and quotas, with readable text fallback | Existing observed percentages, component options and layout | DONE |
| M5 Component groups | [COMPOSITION-02](development-plan.md#composition-02) | Decorations hide with their metric; groups can share a Powerline block | Existing instances, visibility and Powerline | DONE |
| M6 GitHub refresh | [WORKFLOW-02](development-plan.md#workflow-02) | Separately enabled automatic PR/CI refresh with visible state and stop controls | Delivered EXTENSIONS-01 and WORKFLOW-01 | DONE |
| M7 Derived metrics | [METRICS-01](development-plan.md#metrics-01) | Hourly cost with an explicit session-time or API-time denominator | Existing observed session cost and duration fields | DONE |
| Independent maintenance | [GIT-01](development-plan.md#git-01) | Verified direct/indirect Git behavior and necessary protections with supported-filter compatibility | Existing Git collectors, source identity and process adapters | DONE |
| Independent maintenance | [TERMINAL-01](development-plan.md#terminal-01) | Consistent or explicitly explained Windows preview colors across setup, configure and slash entry | Existing terminal detection/launch paths; [issue #130](https://github.com/fbincon/claude-code-statusline/issues/130) | DONE |
| M8 First entry | [SETUP-02](development-plan.md#setup-02) | No-argument/npx entry connects npm global installation, a durable binding and existing setup | Delivered SETUP-01 and installation/recovery mechanisms | DONE |
| M9 Version management | [UPDATE-01](development-plan.md#update-01) | Explicit version checks, upgrades, rollback and failure recovery | SETUP-02 installation identity and existing compatibility/recovery rules | DONE |
| M10 Configuration reuse | [IMPORT-01](development-plan.md#import-01) | Select global appearance first, then complete main/subagent sections for import | Existing import review, instances, groups, layouts and profile transactions | DONE |
| M11 Gradients | [APPEARANCE-04](development-plan.md#appearance-04) | Static component-foreground and Powerline-background gradients with presets and custom colors | Existing color, Powerline, group and editor rules | DONE |
| M12 Cross-line alignment | [COMPOSITION-03](development-plan.md#composition-03) | Aligned explicit main rows with defined hidden/group/spacer/narrow-row behavior | Existing explicit layout, groups, Unicode width and fitting | DONE |
| Engineering as needed | [CAPABILITIES-01](development-plan.md#capabilities-01) | Consistent supported options and explanations for components | Specific metadata needs exposed by appearance or extensions | DONE |
| Independent maintenance | [CI-01](development-plan.md#ci-01) | Pinned Actions references with reviewable updates | Current workflow inventory | DONE |

M1 → M2 → M3 → M4–M7 records the historical delivery sequence, retaining completed IDs and evidence. SHOWCASE-01 was originally listed with M2, then M8 and M13; its final prerequisites are in the delivered mainline. CI-01 is complete as independent maintenance; its weekly Dependabot proposals and validation are tracked in [CI maintenance](ci-maintenance.md).

</details>

<a id="packages"></a>

## Using work packages

Use the [development plan](development-plan.md) for the user problem, scope, module responsibilities, compatibility, implementation slices and functional acceptance of each package. Start later implementation from the then-current `main`, selecting a concrete package and delivery scope.

Unstarted entries describe design intent. Completed entries preserve historical scope; current behavior and interfaces are documented in the user guides and linked implementation records. Keep display Save, separate host Apply and source enablement semantics explicit.

<a id="acceptance"></a>

## Stage completion requirements

- **Relevant journeys:** verify the changed user flow and its cancel/error outcomes. Select adjacent combinations from the changed rules; reuse existing suites and avoid a new complete journey or Cartesian matrix for every slice.
- **Consistent behavior:** share core rules across both editors and CLI; cover all registered languages, Unicode graphemes, font/color fallback and relevant platforms.
- **Trustworthy data:** distinguish samples from actual input, and zero from missing, stale, partial or unsupported observations; explain source and scope.
- **Compatibility and recovery:** preserve instance/profile identity, project bindings and preferences; verify import, migration, concurrent edits and recovery.
- **Delivery evidence:** record feature merge, package completion and version publication separately, with applicable installed-artifact and host checks. Accepted gaps remain disclosed with their actual verification status.

Native changes preserve separate props, Pane and Client-tree checks, bounded visible pages, retained drafts and save-result recovery. Use applicable actual-host coverage; local serialization lengths alone do not establish host acceptance. Existing required product gates and verified candidate promotion remain unchanged.

See the [acceptance matrix](development-plan.md#acceptance-matrix), [testing guide](testing.md) and [release procedure](../RELEASING.md). Documentation-only maintenance uses necessary documentation checks; it does not provide product-release acceptance evidence.

<a id="delivery-history"></a>

## Delivered work and historical evidence

Use the [version-to-work-package index](history/README.md#delivery-by-version) for work-package mappings through the planning baseline, and the [topic index](history/README.md#delivery-records) for later records and migration evidence. The [changelog](../../CHANGELOG.md) leads to version-specific user-facing notes.

[CI-01 validation and update procedure](ci-maintenance.md) records the final PR/main matrices, manual workflow checks and retained failures for that repository-maintenance delivery.

<a id="maintenance"></a>

## Document maintenance and handoff

Maintain this roadmap and the [development plan](development-plan.md) with their Simplified Chinese counterparts. Update stages and status here, scope and acceptance in the plan, and actual implementation/publication evidence in the relevant delivery record. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`; a documentation edit does not advance a feature's status.

Keep future plans separate from stable usage instructions. Update both languages together, preserve work-package IDs and section anchors, and explain scope or dependency changes. Link new delivery evidence from the [delivery index](history/README.md#delivery-records).

Run `npm run docs:check` and `git diff --check`. Compare bilingual IDs, dependencies, statuses and delivered facts, and verify links from a checkout containing only committed files. Local planning archives and raw validation records remain private and are not dependencies of these public documents.

The [stage tables](#milestones) record completed work-package status. See the [delivered designs](development-plan.md#completed-designs) for original scope, slices and acceptance.
