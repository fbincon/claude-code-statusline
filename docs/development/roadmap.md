# Development roadmap

**English** | [简体中文](roadmap.zh-CN.md)

Updated: **2026-10-23** (Asia/Shanghai) · Product baseline: **v3.6.0** · Planning baseline: **`2bdf429d3356796232efff926235617cdab4f430`**

Claude Code Statusline focuses on clear task, subagent, project and usage information, with shared configuration behavior across the CLI and both editors. First-use setup, complete display schemes and explicitly enabled extensions are delivered. The next product sequence is graphical indicators → component groups → GitHub automatic refresh → cost rates → homepage demonstrations. Git invocation review is an independent maintenance package. M4–M7 are selected for v3.7.0; M4 is VALIDATING. Other unstarted work retains its scope; CI-01 remains complete.

This page owns product direction, priorities and work-package status. The [development plan](development-plan.md) defines scope, dependencies and acceptance; the linked delivery records preserve implementation and publication evidence. Publishing these planning documents does not start a feature or change its status.

**Navigation:** [Baseline](#baseline) · [References and acknowledgements](#reference) · [Stages](#milestones) · [Candidates](#candidates) · [Work packages](#packages) · [Acceptance](#acceptance) · [Delivery history](#delivery-history) · [Maintenance](#maintenance)

<a id="baseline"></a>

## Current baseline and product direction

| Area | Delivered capability | Planning implication |
| --- | --- | --- |
| Configuration entry points | First-use setup wizard, in-session editor, external TUI, CLI, conversational guide and Quick setup | Reuse delivered configuration journeys in demonstrations |
| Display composition | Six existing presets, three complete schemes, component instances, duplication/reordering, text, spacers, import review, colors and five Powerline controls | Demonstrate existing schemes and extend them for concrete needs |
| Tasks and projects | Task timing, separate subagent rows, read-only task details, named profiles and project-root bindings | Make task and multi-agent scenarios prominent |
| Languages | `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`; independent UI and output languages | Maintain six-language coverage for new interactions and guidance |
| Display catalog | 64 main metrics and 15 subagent metrics; 66/17 types including text and spacers | Preserve IDs and metric definitions when adding items |
| Existing data | Host `pr` number/review state, linked-worktree fallback and cache-cause diagnosis/display | Keep host metrics and external observations distinguishable |
| Extension data | Local JSON, manually refreshed GitHub PR/CI and explicit command sources; both editors and CLI; optional OSC 8 links | Keep authorization separate from display schemes and remove local bindings on import |
| Interfaces | Display schema 10, editor protocol 17, source registry/observation 1, runtime 2, lifecycle 4, portable 1, UI preferences 1; profile collection/export 1 | Explain compatibility for each interface independently |
| Support boundaries | Linux/WSL, Windows, macOS; Node 22/24 product runtimes | Preserve supported environments and record actual verification |

Sources: [v3.6.0 release](../releases/v3.6.0.md), [extension delivery](extensions.md), [catalog](../../packages/core/src/config/catalog-data.ts), [editor protocol](../../packages/core/src/contracts/ui.ts), [profiles](../PROFILES.md), [task details](../TASK_DETAILS.md) and [architecture](architecture.md). The planning baseline includes delivery documentation after the release source; exact release identities belong in the delivery record.

Default capabilities use Claude input and local state. Network lookup and custom commands require separate enablement; importing a scheme, binding a project or selecting a preset cannot enable them.

The six historical gaps tracked in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) remain **unverified**. Version-specific acceptance, including the [v3.6.0 decision](../releases/approvals/v3.6.0.json), records permission to release with those gaps; it does not establish that the missing checks passed or waive new failures.

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

### Planned mainline

| Priority | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| Independent maintenance | [GIT-01](development-plan.md#git-01) | Verified Git invocation behavior and any necessary protections | Existing Git collectors, source identity and process adapters | NOT_STARTED |
| M4 Graphical indicators | [APPEARANCE-03](development-plan.md#appearance-03) | Optional short bars for context and quotas, with readable text fallback | Existing observed percentages, component options and layout | VALIDATING |
| M5 Component groups | [COMPOSITION-02](development-plan.md#composition-02) | Decorations hide with their metric; groups can share a Powerline block | Existing instances, visibility and Powerline | IN_PROGRESS |
| M6 GitHub refresh | [WORKFLOW-02](development-plan.md#workflow-02) | Separately enabled automatic PR/CI refresh with visible state and stop controls | Delivered EXTENSIONS-01 and WORKFLOW-01 | NOT_STARTED |
| M7 Derived metrics | [METRICS-01](development-plan.md#metrics-01) | Hourly cost with an explicit session-time or API-time denominator | Existing observed session cost and duration fields | NOT_STARTED |
| M8 Demonstration | [SHOWCASE-01](development-plan.md#showcase-01) | Focused homepage, scheme gallery and reproducible usage demonstrations | Accepted functionality and its matching installed artifact | NOT_STARTED |

M4 → M5 → M6 → M7 → M8 is the selected product order. Scheduling does not create technical dependencies: grouping does not require graphical indicators, and cost rates do not require automatic refresh. Each package may ship in bounded slices. SHOWCASE-01 retains its existing ID and moves after the functional work; demonstrations use accepted functionality and do not require every future candidate to be implemented. GIT-01 runs independently. The static comparison identified a protection difference to investigate, not a confirmed vulnerability; investigation and any necessary correction belong to that future task.

The approved M4–M7 implementation targets v3.7.0 through separate feature PRs and a final release PR. [Implementation and validation](m4-m7-delivery.md) records the starting commits, interface decisions and actual evidence; package completion and publication remain separate.

### Delivered stages

| Stage | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| M1 First use | [SETUP-01](development-plan.md#setup-01) | A connected flow from checks to configuration, integration and next steps | Existing installation transactions and Quick setup | DONE |
| M2 Appearance | [APPEARANCE-01](development-plan.md#appearance-01) | Three complete schemes for daily development, multi-agent work and quota monitoring | Existing presets and profile management | DONE |
| M2 Appearance | [APPEARANCE-02](development-plan.md#appearance-02) | Configurable padding, separators and end decorations | Concrete APPEARANCE-01 scenarios | DONE |
| M3 Extensions | [EXTENSIONS-01](development-plan.md#extensions-01) | Opt-in local JSON data components and a source contract | Existing diagnosis and component instances | DONE |
| M3 Extensions | [LINKS-01](development-plan.md#links-01) | Clickable PR/directory text with plain-text fallback | Existing text and layout rules | DONE |
| M3 Extensions | [WORKFLOW-01](development-plan.md#workflow-01) | Optional GitHub PR lookup and CI status | EXTENSIONS-01; LINKS-01 is optional | DONE |
| M3 Extensions | [COMMAND-01](development-plan.md#command-01) | Explicitly configured external command components | EXTENSIONS-01 | DONE |
| Engineering as needed | [CAPABILITIES-01](development-plan.md#capabilities-01) | Consistent supported options and explanations for components | Specific metadata needs exposed by appearance or extensions | DONE |
| Independent maintenance | [CI-01](development-plan.md#ci-01) | Pinned Actions references with reviewable updates | Current workflow inventory | DONE |

M1 → M2 → M3 records the historical delivery sequence, retaining completed IDs and evidence. SHOWCASE-01 was originally listed with M2 and remains unstarted under the new M8 scheduling. CI-01 is complete as independent maintenance; its weekly Dependabot proposals and validation are tracked in [CI maintenance](ci-maintenance.md).

<a id="candidates"></a>

## Candidate pool and entry conditions

| Candidate | Required basis before promotion |
| --- | --- |
| Automatic cross-line alignment and gradients | A concrete multi-line or color use case; define behavior with hidden items, groups and narrow rows |
| Selective configuration import/merge | Specify which sections can be selected and how instance IDs, row references, profiles and local bindings are preserved |
| Daily remaining budget | Reliable amount, full period boundaries and timezone; a `monthly` label alone is insufficient |
| Quota consumption pacing and time cursors | Verified window boundaries, elapsed-time meaning and behavior when timing evidence is absent |
| Automatic command-source refresh | A separate decision on recurring execution authorization, inputs, start/stop behavior and failure outcomes |
| GitLab/Gitee data providers | Actual product demand, authoritative provider fields, existing authentication and identity rules; repository mirroring is separate |
| JJ and service-status components | An identified user scenario and a reliable source with explicit availability semantics |
| Other clients, a plugin marketplace, automatic script downloads and general Shell mode | A separately selected scope and interaction/authorization design |

Candidates have no assigned version or date. Listing one does not start development or make it a completion condition for the six planned packages. Promote a candidate through an explicit scope decision and a corresponding work-package update.

<a id="packages"></a>

## Using work packages

Use the [development plan](development-plan.md) for the user problem, scope, module responsibilities, compatibility, implementation slices and functional acceptance of each package. Start later implementation from the then-current `main`, selecting a concrete package and delivery scope.

Unstarted entries describe design intent. Completed entries preserve historical scope; current behavior and interfaces are documented in the user guides and linked implementation records. Keep display Save, separate host Apply and source enablement semantics explicit.

<a id="acceptance"></a>

## Stage completion requirements

- **Complete journeys:** verify entry, editing, preview, save, reopen and actual display, including cancellation and failure outcomes.
- **Consistent behavior:** share core rules across both editors and CLI; cover six languages, Unicode graphemes, font/color fallback and relevant platforms.
- **Trustworthy data:** distinguish samples from actual input, and zero from missing, stale, partial or unsupported observations; explain source and scope.
- **Compatibility and recovery:** preserve instance/profile identity, project bindings and preferences; verify import, migration, concurrent edits and recovery.
- **Delivery evidence:** record feature merge, package completion and version publication separately, with applicable installed-artifact and host checks. Accepted gaps remain disclosed with their actual verification status.

See the [acceptance matrix](development-plan.md#acceptance-matrix), [testing guide](testing.md) and [release procedure](../RELEASING.md). Documentation-only maintenance uses necessary documentation checks; it does not provide product-release acceptance evidence.

<a id="delivery-history"></a>

## Delivered work and historical evidence

| Version | Work packages | Status | Implementation and delivery record |
| --- | --- | --- | --- |
| v3.2.0 | UX-01, UX-02, EXPLAIN-01 | DONE | [Configuration experience](configuration-experience.md) |
| v3.3.0 | DIAG-01, INPUT-01 | DONE | [Real-input diagnosis](real-input-diagnostics.md) |
| v3.4.0 | PROFILE-01, PROJECT-01, TASK-01 | DONE | [Profiles, projects and task details](profiles-projects-tasks.md) |
| v3.5.0 | SETUP-01, APPEARANCE-01, APPEARANCE-02 | DONE | [Setup and complete appearances](setup-appearance.md) |
| v3.6.0 | EXTENSIONS-01, LINKS-01, WORKFLOW-01, COMMAND-01, CAPABILITIES-01 | DONE | [Extensions and workflows](extensions.md) |

The linked records retain source/tag identities, checksums, CI results, channel verification, recovery details and delivery-time limitations. Historical statements about future candidates retain their original context; the stage table above gives their planning status at this page's update date. Earlier migration milestones remain in the [TypeScript migration plan](typescript-migration.md). Release notes are maintained under [releases](../releases).

CI-01 is complete as repository maintenance without a new product version. Its [validation and update procedure](ci-maintenance.md) records the final PR/main matrices, manual workflow checks and retained failure history.

<a id="maintenance"></a>

## Document maintenance and handoff

Maintain this roadmap and the [development plan](development-plan.md) with their Simplified Chinese counterparts. Update stages and status here, scope and acceptance in the plan, and actual implementation/publication evidence in the relevant delivery record. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`; a documentation edit does not advance a feature's status.

Keep future plans separate from stable usage instructions. Update both languages together, preserve work-package IDs and section anchors, and explain scope or dependency changes. Add links from the development guide when a new record becomes useful to contributors.

Run `npm run docs:check` and `git diff --check`. Compare bilingual IDs, dependencies, statuses and delivered facts, and verify links from a checkout containing only committed files. Local planning archives and raw validation records remain private and are not dependencies of these public documents.
