# Development history

**English** | [简体中文](README.zh-CN.md)

Find original designs, versioned delivery records, migration stages and validation evidence. For current procedures, see the [development guide](../README.md), [testing and acceptance](../testing.md) and [release guide](../../RELEASING.md#current-typescript-publication).

<a id="completed-work-designs"></a>

## Delivered work package designs

The [work package design archive](work-package-designs.md#completed-designs) preserves the original scope, slices and acceptance criteria. The [delivered milestones](roadmap-milestones.md#milestones) record package status and dependencies. Use the records below for the corresponding implementation and verification results.

<a id="delivery-records"></a>

## Delivery records by topic

Each record preserves the feature-introduction version, source identity, checks and delivery limits.

| Area | Delivery records |
| --- | --- |
| Documentation maintenance | [Reader-oriented content organization and bilingual checks](deliveries/documentation-content-organization.md) |
| v3.16.3 configuration skills | [Question paging, scope and fallback workflows](../skill-workflows.md#final-release) |
| v3.16.2 editor controls | [Keyboard, draft protection and release verification](deliveries/editor-input-delivery.md#final-release) |
| v3.16.1 correctness repairs | [Runtime identity, source timeout and save conflicts](deliveries/runtime-source-save-fixes.md#final-release) |
| Languages | [Twelve-language expansion](deliveries/language-expansion.md) · [I18N-02 lifecycle](deliveries/i18n-02-delivery.md) · [Node and regional languages](../node-regional-languages.md) |
| CI maintenance | [Issue #157 measurements](deliveries/ci-maintenance-delivery.md#ci-rollout) · [CI-01 Action pinning](deliveries/ci-maintenance-delivery.md#ci-01) |
| Appearance, drafts and reuse | [Adaptive rows and scenes](../adaptive-row-scenarios.md) · [Draft history and reuse](../draft-history-and-reuse.md) · [Appearance/previews/diagnosis](../appearance-preview-diagnosis.md) |
| Tasks, sources and packages | [Task/version review](../task-version-review.md) · [Source/command/package execution](../source-command-package-management.md) · [Extensions delivery](../extensions.md#completed-validation-and-delivery) |
| Setup and configuration | [Setup/complete schemes](../setup-appearance.md) · [Configuration experience](../configuration-experience.md) · [Profiles/projects/tasks](../profiles-projects-tasks.md) · [Real-input diagnosis](../real-input-diagnostics.md) |
| Earlier milestones and repairs | [M4–M7](deliveries/m4-m7-delivery.md) · [M8–M9](deliveries/m8-m9-delivery.md) · [M10–M12](deliveries/m10-m12-delivery.md) · [Correctness maintenance](../correctness-maintenance.md) |
| Post-migration review | [Findings](migration/post-migration-review.md) · [Repairs](migration/post-migration-fixes.md) · [External TUI parity](../external-tui-parity.md) · [External TUI regressions](../external-tui-regressions.md) |
| Performance | [Reports by version](#performance-reports) |
| Demonstration delivery | [SHOWCASE-01](../showcase.md#delivery) |

<a id="delivery-by-version"></a>

## Work packages by version

<details>
<summary>Expand the v3.2.0 through v3.16.0 delivery mapping</summary>

| Version | Work packages | Status | Implementation and delivery record |
| --- | --- | --- | --- |
| v3.2.0 | UX-01, UX-02, EXPLAIN-01 | DONE | [Configuration experience](../configuration-experience.md) |
| v3.3.0 | DIAG-01, INPUT-01 | DONE | [Real-input diagnosis](../real-input-diagnostics.md) |
| v3.4.0 | PROFILE-01, PROJECT-01, TASK-01 | DONE | [Profiles, projects and task details](../profiles-projects-tasks.md) |
| v3.5.0 | SETUP-01, APPEARANCE-01, APPEARANCE-02 | DONE | [Setup and complete appearances](../setup-appearance.md) |
| v3.6.0 | EXTENSIONS-01, LINKS-01, WORKFLOW-01, COMMAND-01, CAPABILITIES-01 | DONE | [Extensions and workflows](../extensions.md) |
| v3.7.0 | APPEARANCE-03, COMPOSITION-02, WORKFLOW-02, METRICS-01 | DONE | [Indicators, groups, refresh and rates](deliveries/m4-m7-delivery.md) |
| v3.8.0 | GIT-01, TERMINAL-01, SETUP-02, UPDATE-01 | DONE | [Git, terminal and M8–M9](deliveries/m8-m9-delivery.md) |
| v3.9.0 | IMPORT-01, APPEARANCE-04, COMPOSITION-03 | DONE | [Selective import, gradients and alignment](deliveries/m10-m12-delivery.md) |
| v3.9.1 | #154 transport capacity, #155 render-tree capacity and save-result recovery | DONE | [Native capacity delivery](deliveries/native-capacity-v3.9.1.md#final-stable-delivery) |
| v3.9.2 | FIX-01–FIX-04, I18N-01: drafts, indicators, refresh consumers, historical diagnosis and task language | DONE | [Correctness delivery and publication](../correctness-maintenance.md) |
| v3.10.0 | APPEARANCE-05, PREVIEW-01, EXPLAIN-02: themes, color editing, sample scenarios and file diagnosis | DONE | [Appearance, previews and diagnosis delivery](../appearance-preview-diagnosis.md) |
| v3.11.0 | TASK-02, UPDATE-02 slice 1 | DONE | [Task browsing and version review](../task-version-review.md) |
| v3.12.0 | SOURCES-01, COMMAND-02, UPDATE-02 slices 2/3; #173 | DONE | [v3.12.0 delivery](../source-command-package-management.md) |
| v3.13.0 | All UX-03, COMPOSITION-04 and IMPORT-02 slices | DONE | [Draft history, repairs and reuse delivery](../draft-history-and-reuse.md) |
| v3.14.0 | APPEARANCE-07, APPEARANCE-06, PROFILE-02; #178/#180 | DONE | [Adaptive appearance and scenario delivery](../adaptive-row-scenarios.md) |
| v3.15.0 | All I18N-02 slices; incremental six-language maintenance | DONE | [Incremental language workflow delivery](deliveries/i18n-02-delivery.md#final-release) |
| v3.16.0 | Six additional UI/statusline languages; editor protocol 31 | DONE | [Twelve-language delivery](deliveries/language-expansion.md#final-release) |

</details>

<a id="technical-references-with-delivery-records"></a>

## Current technical references

The [development guide](../README.md) indexes current references, including [Native capacity and recovery](../native-capacity.md#presentation-boundary), [CI maintenance](../ci-maintenance.md) and [extension responsibilities and contracts](../extensions.md#responsibilities-and-contracts).

## TypeScript migration stages

The [TypeScript migration plan](../typescript-migration.md) links the completed stages: [TS-01 reference](../typescript-migration/ts-01/README.md), [TS-02 probes](../typescript-migration/ts-02/README.md), [TS-03 core/backend](../typescript-migration/ts-03/README.md), [TS-04 editors/recovery](../typescript-migration/ts-04/README.md), [TS-05 candidates](../typescript-migration/ts-05/README.md) and [TS-06 publication](../typescript-migration/ts-06/README.md). Original [TS-04 candidate](../typescript-migration/ts-04/candidate.md), [recovery](../typescript-migration/ts-04/recovery.md) and [Linux physical/deferred acceptance](../typescript-migration/ts-02/LINUX-20261014.md) remain historical evidence.

<a id="performance-reports"></a>

## Performance reports by version

| Version | Implementation | Report |
| --- | --- | --- |
| v3.1.4 | TypeScript | [PERF-01 post-migration performance](performance/perf-01.md) |
| v2.0.0 | Python | [Component-instance rendering](performance/performance-v2.0.0.md) |
| v1.13.0 | Python | [Language and search performance](performance/performance-v1.13.0.md) |
| v1.12.0 | Python | [Rendering and opt-in feature costs](performance/performance-v1.12.0.md) |
| v1.11.0 | Python | [Rendering performance comparison](performance/performance-v1.11.0.md) |

## Historical procedures and evidence

- [Release procedures](release-procedures.md) cover past releases, the TS-06 first release and Python/PyPI publishing.
- [Acceptance records](acceptance-records.md) retain Python and migration-stage commands, results and limitations.
- [Python implementation notes](python-implementation.md) preserve the [historical architecture](python-implementation.md#python-architecture), file safety, launchers and component layout.
- The [frozen Python archive](../../../archive/python/README.md) provides fixed sources and a separate verification procedure.
