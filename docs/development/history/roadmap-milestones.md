# Delivered roadmap stages and original planning baseline

**English** | [简体中文](roadmap-milestones.zh-CN.md) · [Current guide](../roadmap.md)

This record preserves the v3.16.0 planning snapshot, reference projects and the status and dependencies of delivered stages. Find delivery and verification evidence in the [development history index](README.md#delivery-records).

<a id="baseline"></a>

<a id="current-baseline-and-product-direction"></a>

## Planning baseline and product direction

The planning snapshot on **2026-10-30** (Asia/Shanghai) uses [v3.16.0](deliveries/language-expansion.md#final-release) as its product baseline. The review on 2026-10-28 used source `0f5638f613c8ffc9588a50d30ebc51f14549b1fb`, which was product v3.9.1.

The table describes the capabilities used to plan from v3.16.0. See the [user guide](../../USER_GUIDE.md) for current procedures and the [changelog](../../../CHANGELOG.md) for changes since that baseline.

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
| Native presentation | Host-retained editing state, bounded visible frames, independent capacity checks and recoverable save outcomes | Apply these boundaries to every new page; see [capacity and recovery](../native-capacity.md) |
| Interfaces | Display schema 17, editor protocol 31, source registry 3/jobs 4, observation 1, runtime 3, lifecycle 4, portable 1, UI preferences 1; profile collection/export 1; [current versions](../../reference/cli.md#protocol-and-schema-versions) | Explain compatibility for each interface independently |
| Support boundaries | Linux/WSL, Windows, macOS; Node 22/24 product runtimes | Preserve supported environments and record actual verification |

The [review baseline](work-package-designs.md#review-baseline) separates isolated reproductions, source-confirmed gaps and proposed capabilities. The previous planning snapshot is `f68d26eeddda98ab4041d2b9e873ade556fa1909`. See the [catalog](../../../packages/core/src/config/catalog-data.ts), [editor protocol](../../../packages/core/src/contracts/ui.ts), [architecture](../architecture.md) and [delivery index](README.md#delivery-records) for the corresponding definitions and evidence.

Default capabilities use Claude input and local state. Network lookup and custom commands require separate enablement; importing a scheme, binding a project or selecting a preset cannot enable them.

The six historical gaps tracked in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) remain **unverified**. Version-specific acceptance, including the [v3.9.2 decision](../../releases/approvals/v3.9.2.json), records permission to release with those gaps; it does not establish that the missing checks passed or waive new failures.

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

These records preserve the status, original dependencies and scheduling of delivered work. See the [work packages by version](README.md#delivery-by-version) and [delivery records by topic](README.md#delivery-records) for versions and evidence.

<a id="planned-mainline"></a>

### Delivered mainline

<details>
<summary>View delivered mainline packages, dependencies and scheduling</summary>

| Batch | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| Language workflow | [I18N-02](work-package-designs.md#i18n-02) | Current-source language fallback during development and complete six-language releases | All three slices, compatible PR/main/tag verification and public delivery; [v3.15.0 evidence](deliveries/i18n-02-delivery.md#final-release) | DONE |
| 1 Correctness | [FIX-01](work-package-designs.md#fix-01) | Protect every display-draft edit while a save outcome is unknown | Existing save/reconciliation state and shared editor actions | DONE |
| 1 Correctness | [FIX-02](work-package-designs.md#fix-02) | Consistent hidden, short and custom labels with percentage bars | Shared indicator and decoration rules | DONE |
| 1 Correctness | [FIX-03](work-package-designs.md#fix-03) | Leaving one refresh consumer preserves other consumers' work | Shared source jobs, editor close and CLI cancellation | DONE |
| 1 Maintenance | [FIX-04](work-package-designs.md#fix-04) | Time-applicable extension diagnosis with evidence for every agent | Existing diagnosis and source observation contracts | DONE |
| 1 Maintenance | [I18N-01](work-package-designs.md#i18n-01) | Correct task-detail language on first open, failure and retry | Existing UI preferences and task pane | DONE |
| 2 Appearance | [APPEARANCE-05](work-package-designs.md#appearance-05) | More themes/gradient presets, visible color selection and gradient edits | Existing appearance rules; shared theme registration | DONE |
| 2 Understanding | [PREVIEW-01](work-package-designs.md#preview-01) | Selectable sample states for appearance and layout review | Production renderer with injected observations | DONE |
| 2 Understanding | [EXPLAIN-02](work-package-designs.md#explain-02) | Explain inactive styles/sources and explicitly diagnose an input file | Existing explanation/diagnosis; FIX-04 for trustworthy extension evidence | DONE |
| 3 Task entry | [TASK-02](work-package-designs.md#task-02) | External read-only task browsing, then shared reading controls | Existing task model/service and I18N-01 language handling | DONE |
| 3/4/later Versions | [UPDATE-02](work-package-designs.md#update-02) | Status/review, execution/recovery and protected history cleanup | Existing UPDATE-01; execution follows review and safe draft/process handoff | DONE |
| 4 Source operations | [SOURCES-01](work-package-designs.md#sources-01) | Readable state, saved GitHub check pages, compatible binding reuse and protected cleanup | Existing source services; FIX-03 lifecycle rules | DONE |
| 4 Scheduling | [COMMAND-02](work-package-designs.md#command-02) | Separately approved periodic commands during applicable active sessions | FIX-03; existing command execution and active-session leases | DONE |
| 5 Continuous color | [APPEARANCE-06](work-package-designs.md#appearance-06) | Continuous backgrounds across adjacent blocks of one displayed row | Existing fitting, groups, alignment and Powerline edge colors | DONE |
| Later, interleavable | [APPEARANCE-07](work-package-designs.md#appearance-07) | Optional narrow-row bars that retain numeric meaning | FIX-02 and existing fitting/priorities | DONE |
| Later, interleavable | [UX-03](work-package-designs.md#ux-03) | Shared undo/redo, change review and external conflict recovery | FIX-01 and existing revision-bound save/reload/export | DONE |
| Later, interleavable | [IMPORT-02](work-package-designs.md#import-02) | Style copying, whole-group reuse and explicit local-source rebinding | Existing IMPORT-01 and reference validation | DONE |
| Later, interleavable | [COMPOSITION-04](work-package-designs.md#composition-04) | Review and atomically adjust affected alignment references | Existing group/alignment invariants and shared edits | DONE |
| Later, interleavable | [PROFILE-02](work-package-designs.md#profile-02) | Scenario schemes that demonstrate delivered new capabilities | Only the appearance/composition capabilities each scheme uses | DONE |
| Final demonstration | [SHOWCASE-01](work-package-designs.md#showcase-01) | Bilingual demonstrations, configurations and reproducible journeys | The original eighteen follow-up packages and every slice accepted; matching installed artifacts | DONE |

Batches express delivery preference, not extra technical dependencies. Themes, task browsing and version review can progress independently after their own prerequisites. UPDATE-02 and SOURCES-01 retain one package identity across their separately deliverable slices; a package completes only when all its slices are accepted. Later improvements can be interleaved under their own dependencies, preserving the delivered binding and history protections.

SHOWCASE-01 retains its historical ID. Its earlier M13 placement is superseded by the maintainer's decision to wait for the original eighteen formal packages and their slices, including later improvements. I18N-02 was scheduled separately and does not add a prerequisite for SHOWCASE-01; remaining candidates do not add prerequisites either. M1–M12 retain their historical numbering and delivery evidence.

SHOWCASE-01 is delivered using the published v3.16.0 package with non-Powerline demonstrations. [Prerequisites, collection and separate acceptance records](../showcase.md) retain the original product/evidence identities; [the user walkthrough](../../SHOWCASE.md) owns reproducible usage.

GIT-01 and TERMINAL-01 remain delivered. Reuse applicable Windows preview outcomes and the shared Git policy from [M8–M9 delivery](deliveries/m8-m9-delivery.md), and preserve the native boundaries established by [v3.9.1](../native-capacity.md). Current validation routes remain defined in [CI maintenance](../ci-maintenance.md).

</details>

### Delivered stages

<details>
<summary>View earlier milestones and independent maintenance</summary>

| Stage | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| M1 First use | [SETUP-01](work-package-designs.md#setup-01) | A connected flow from checks to configuration, integration and next steps | Existing installation transactions and Quick setup | DONE |
| M2 Appearance | [APPEARANCE-01](work-package-designs.md#appearance-01) | Three complete schemes for daily development, multi-agent work and quota monitoring | Existing presets and profile management | DONE |
| M2 Appearance | [APPEARANCE-02](work-package-designs.md#appearance-02) | Configurable padding, separators and end decorations | Concrete APPEARANCE-01 scenarios | DONE |
| M3 Extensions | [EXTENSIONS-01](work-package-designs.md#extensions-01) | Opt-in local JSON data components and a source contract | Existing diagnosis and component instances | DONE |
| M3 Extensions | [LINKS-01](work-package-designs.md#links-01) | Clickable PR/directory text with plain-text fallback | Existing text and layout rules | DONE |
| M3 Extensions | [WORKFLOW-01](work-package-designs.md#workflow-01) | Optional GitHub PR lookup and CI status | EXTENSIONS-01; LINKS-01 is optional | DONE |
| M3 Extensions | [COMMAND-01](work-package-designs.md#command-01) | Explicitly configured external command components | EXTENSIONS-01 | DONE |
| M4 Graphical indicators | [APPEARANCE-03](work-package-designs.md#appearance-03) | Optional short bars for context and quotas, with readable text fallback | Existing observed percentages, component options and layout | DONE |
| M5 Component groups | [COMPOSITION-02](work-package-designs.md#composition-02) | Decorations hide with their metric; groups can share a Powerline block | Existing instances, visibility and Powerline | DONE |
| M6 GitHub refresh | [WORKFLOW-02](work-package-designs.md#workflow-02) | Separately enabled automatic PR/CI refresh with visible state and stop controls | Delivered EXTENSIONS-01 and WORKFLOW-01 | DONE |
| M7 Derived metrics | [METRICS-01](work-package-designs.md#metrics-01) | Hourly cost with an explicit session-time or API-time denominator | Existing observed session cost and duration fields | DONE |
| Independent maintenance | [GIT-01](work-package-designs.md#git-01) | Verified direct/indirect Git behavior and necessary protections with supported-filter compatibility | Existing Git collectors, source identity and process adapters | DONE |
| Independent maintenance | [TERMINAL-01](work-package-designs.md#terminal-01) | Consistent or explicitly explained Windows preview colors across setup, configure and slash entry | Existing terminal detection/launch paths; [issue #130](https://github.com/fbincon/claude-code-statusline/issues/130) | DONE |
| M8 First entry | [SETUP-02](work-package-designs.md#setup-02) | No-argument/npx entry connects npm global installation, a durable binding and existing setup | Delivered SETUP-01 and installation/recovery mechanisms | DONE |
| M9 Version management | [UPDATE-01](work-package-designs.md#update-01) | Explicit version checks, upgrades, rollback and failure recovery | SETUP-02 installation identity and existing compatibility/recovery rules | DONE |
| M10 Configuration reuse | [IMPORT-01](work-package-designs.md#import-01) | Select global appearance first, then complete main/subagent sections for import | Existing import review, instances, groups, layouts and profile transactions | DONE |
| M11 Gradients | [APPEARANCE-04](work-package-designs.md#appearance-04) | Static component-foreground and Powerline-background gradients with presets and custom colors | Existing color, Powerline, group and editor rules | DONE |
| M12 Cross-line alignment | [COMPOSITION-03](work-package-designs.md#composition-03) | Aligned explicit main rows with defined hidden/group/spacer/narrow-row behavior | Existing explicit layout, groups, Unicode width and fitting | DONE |
| Engineering as needed | [CAPABILITIES-01](work-package-designs.md#capabilities-01) | Consistent supported options and explanations for components | Specific metadata needs exposed by appearance or extensions | DONE |
| Independent maintenance | [CI-01](work-package-designs.md#ci-01) | Pinned Actions references with reviewable updates | Current workflow inventory | DONE |

M1 → M2 → M3 → M4–M7 records the historical delivery sequence, retaining completed IDs and evidence. SHOWCASE-01 was originally listed with M2, then M8 and M13; its final prerequisites are in the delivered mainline. CI-01 is complete as independent maintenance; its weekly Dependabot proposals and validation are tracked in [CI maintenance](../ci-maintenance.md).

</details>
