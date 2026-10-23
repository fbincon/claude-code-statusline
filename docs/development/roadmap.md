# Development roadmap

**English** | [简体中文](roadmap.zh-CN.md)

Updated: **2026-10-23** (Asia/Shanghai) · Product baseline: **v3.6.0** · Planning baseline: **`aa4ae982747feed476cca9d81a8df9a967b92400`**

Claude Code Statusline focuses on clear task, subagent, project and usage information, with shared configuration behavior across the CLI and both editors. First-use setup, complete display schemes and explicitly enabled extensions are delivered. Demonstrations and maintenance remain candidates, without assigned versions or delivery dates.

This page owns product direction, priorities and work-package status. The [development plan](development-plan.md) defines scope, dependencies and acceptance; the linked delivery records preserve implementation and publication evidence. Publishing these planning documents does not start a feature or change its status.

**Navigation:** [Baseline](#baseline) · [References and acknowledgements](#reference) · [Stages](#milestones) · [Work packages](#packages) · [Acceptance](#acceptance) · [Delivery history](#delivery-history) · [Maintenance](#maintenance)

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

Keep the original project and authors credited when discussing these references. Any reuse of source or documentation must retain the applicable copyright and license notices; the inspected project includes an [MIT license](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/LICENSE).

<a id="milestones"></a>

## Stages and dependencies

| Stage | Work package | User-visible result | Implementation dependencies | Status |
| --- | --- | --- | --- | --- |
| M1 First use | [SETUP-01](development-plan.md#setup-01) | A connected flow from checks to configuration, integration and next steps | Existing installation transactions and Quick setup | DONE |
| M2 Appearance | [APPEARANCE-01](development-plan.md#appearance-01) | Three complete schemes for daily development, multi-agent work and quota monitoring | Existing presets and profile management | DONE |
| M2 Appearance | [APPEARANCE-02](development-plan.md#appearance-02) | Configurable padding, separators and end decorations | Concrete APPEARANCE-01 scenarios | DONE |
| M2 Demonstration | [SHOWCASE-01](development-plan.md#showcase-01) | Focused homepage, scheme gallery and reproducible usage demonstrations | SETUP-01, APPEARANCE-01 | NOT_STARTED |
| M3 Extensions | [EXTENSIONS-01](development-plan.md#extensions-01) | Opt-in local JSON data components and a source contract | Existing diagnosis and component instances | DONE |
| M3 Extensions | [LINKS-01](development-plan.md#links-01) | Clickable PR/directory text with plain-text fallback | Existing text and layout rules | DONE |
| M3 Extensions | [WORKFLOW-01](development-plan.md#workflow-01) | Optional GitHub PR lookup and CI status | EXTENSIONS-01; LINKS-01 is optional | DONE |
| M3 Extensions | [COMMAND-01](development-plan.md#command-01) | Explicitly configured external command components | EXTENSIONS-01 | DONE |
| Engineering as needed | [CAPABILITIES-01](development-plan.md#capabilities-01) | Consistent supported options and explanations for components | Specific metadata needs exposed by appearance or extensions | DONE |
| Independent maintenance candidate | [CI-01](development-plan.md#ci-01) | Pinned Actions references with reviewable updates | Current workflow inventory | NOT_STARTED |

M1 → M2 → M3 records the product priority used for these stages. The dependencies above distinguish implementation prerequisites from scheduling. SHOWCASE-01 remains a follow-up for delivered functionality; CI-01 is independent and does not block a product stage. Automatic dependency updates, including Dependabot, remain an unstarted candidate to evaluate within the CI maintenance task.

Other clients, a plugin marketplace, automatic script downloads, general Shell mode, gradients, automatic cross-line alignment and selective configuration merging remain unscheduled candidates. They are outside the completion requirements of the work packages above.

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

<a id="maintenance"></a>

## Document maintenance and handoff

Maintain this roadmap and the [development plan](development-plan.md) with their Simplified Chinese counterparts. Update stages and status here, scope and acceptance in the plan, and actual implementation/publication evidence in the relevant delivery record. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`; a documentation edit does not advance a feature's status.

Keep future plans separate from stable usage instructions. Update both languages together, preserve work-package IDs and section anchors, and explain scope or dependency changes. Add links from the development guide when a new record becomes useful to contributors.

Run `npm run docs:check` and `git diff --check`. Compare bilingual IDs, dependencies, statuses and delivered facts, and verify links from a checkout containing only committed files. Local planning archives and raw validation records remain private and are not dependencies of these public documents.
