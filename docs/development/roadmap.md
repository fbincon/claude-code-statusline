# Development roadmap

**English** | [简体中文](roadmap.zh-CN.md)

Updated: **2026-10-24** (Asia/Shanghai) · Product baseline: **v3.7.0** · Planning baseline: **`d3c95232a18cb297bbd836c4deda117749e90ee4`**

Claude Code Statusline focuses on clear task, subagent, project and usage information, with shared configuration behavior across the CLI and both editors. First-use setup, complete display schemes, explicitly enabled extensions and M4–M7 are delivered. The next product sequence is first-entry installation, version management, selective import, gradients, explicit-row alignment and then demonstrations (M8–M13). Git invocation review and Windows preview consistency are priority independent maintenance. GIT-01, TERMINAL-01 and SETUP-02 are VALIDATING for v3.8.0; the other five future packages remain NOT_STARTED; delivered packages, including CI-01, remain DONE.

This page owns product direction, priorities and work-package status. The [development plan](development-plan.md) defines scope, dependencies and acceptance; the linked delivery records preserve implementation and publication evidence. Publishing these planning documents does not start a feature or change its status.

**Navigation:** [Baseline](#baseline) · [References and acknowledgements](#reference) · [Stages](#milestones) · [Candidates](#candidates) · [Work packages](#packages) · [Acceptance](#acceptance) · [Delivery history](#delivery-history) · [Maintenance](#maintenance)

<a id="baseline"></a>

## Current baseline and product direction

| Area | Delivered capability | Planning implication |
| --- | --- | --- |
| Configuration entry points | First-use setup wizard, in-session editor, external TUI, CLI, conversational guide and Quick setup | Connect package installation and a durable entry to existing setup; add explicit version management |
| Display composition | Six existing presets, three complete schemes, component instances, duplication/reordering, text, spacers, import review, colors, five Powerline controls, optional percentage bars and linked groups | Add selective reuse, static foreground/Powerline-background gradients and explicit main-row alignment |
| Tasks and projects | Task timing, separate subagent rows, read-only task details, named profiles and project-root bindings | Make task and multi-agent scenarios prominent |
| Languages | `en`, `zh-CN`, `zh-TW`, `zh-HK`, `ja`, `ko`; independent UI and output languages | Maintain six-language coverage for new interactions and guidance |
| Display catalog | 65 main metrics and 15 subagent metrics; 67/17 types including text and spacers | Preserve IDs and metric definitions when adding items |
| Existing data | Host `pr` number/review state, linked-worktree fallback, prompt-cache hit ratio/write tokens, cache state/expiry/miss causes and latest-request output rate | Keep existing scopes and definitions when considering additional metrics |
| Extension data | Local JSON, GitHub PR/CI with separately reviewed automatic refresh, and explicit command sources; both editors and CLI; optional OSC 8 links | Keep authorization separate from display schemes and remove local bindings on import |
| Interfaces | Display schema 13, editor protocol 21, source registry/jobs 2, observation 1, runtime 3, lifecycle 4, portable 1, UI preferences 1; profile collection/export 1 | Explain compatibility for each interface independently |
| Support boundaries | Linux/WSL, Windows, macOS; Node 22/24 product runtimes | Preserve supported environments and record actual verification |

Sources: [v3.7.0 release](../releases/v3.7.0.md), [M4–M7 delivery](m4-m7-delivery.md), [extension delivery](extensions.md), [catalog](../../packages/core/src/config/catalog-data.ts), [editor protocol](../../packages/core/src/contracts/ui.ts), [profiles](../PROFILES.md), [task details](../TASK_DETAILS.md) and [architecture](architecture.md). The planning baseline is main before this documentation revision; v3.7.0 publication identities and validation limits remain in the delivery record.

Default capabilities use Claude input and local state. Network lookup and custom commands require separate enablement; importing a scheme, binding a project or selecting a preset cannot enable them.

The six historical gaps tracked in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) remain **unverified**. Version-specific acceptance, including the [v3.7.0 decision](../releases/approvals/v3.7.0.json), records permission to release with those gaps; it does not establish that the missing checks passed or waive new failures.

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
| Priority independent maintenance | [GIT-01](development-plan.md#git-01) | Verified direct/indirect Git behavior and necessary protections with supported-filter compatibility | Existing Git collectors, source identity and process adapters | VALIDATING |
| Priority independent maintenance | [TERMINAL-01](development-plan.md#terminal-01) | Consistent or explicitly explained Windows preview colors across setup, configure and slash entry | Existing terminal detection/launch paths; [issue #130](https://github.com/fbincon/claude-code-statusline/issues/130) | VALIDATING |
| M8 First entry | [SETUP-02](development-plan.md#setup-02) | No-argument/npx entry connects npm global installation, a durable binding and existing setup | Delivered SETUP-01 and installation/recovery mechanisms | VALIDATING |
| M9 Version management | [UPDATE-01](development-plan.md#update-01) | Explicit version checks, upgrades, rollback and failure recovery | SETUP-02 installation identity and existing compatibility/recovery rules | NOT_STARTED |
| M10 Configuration reuse | [IMPORT-01](development-plan.md#import-01) | Select global appearance first, then complete main/subagent sections for import | Existing import review, instances, groups, layouts and profile transactions | NOT_STARTED |
| M11 Gradients | [APPEARANCE-04](development-plan.md#appearance-04) | Static component-foreground and Powerline-background gradients with presets and custom colors | Existing color, Powerline, group and editor rules | NOT_STARTED |
| M12 Cross-line alignment | [COMPOSITION-03](development-plan.md#composition-03) | Aligned explicit main rows with defined hidden/group/spacer/narrow-row behavior | Existing explicit layout, groups, Unicode width and fitting | NOT_STARTED |
| M13 Demonstration | [SHOWCASE-01](development-plan.md#showcase-01) | Homepage, scheme gallery and reproducible journeys for the accepted new capabilities | All M8–M12 packages completed and accepted; a matching installed artifact | NOT_STARTED |

M8 → M9 → M10 → M11 → M12 → M13 is the selected product order. Scheduling does not create technical dependencies: import does not require version management, and alignment does not require gradients. Each package may ship in bounded slices; later options must retain import/export compatibility. SHOWCASE-01 retains its ID and waits for all selected M8–M12 functionality, including both IMPORT-01 slices, to be completed and accepted. Further candidates do not block it.

GIT-01 and TERMINAL-01 run independently with priority. Incorporate TERMINAL-01 outcomes into affected Windows preview and demonstration acceptance. GIT-01 has a shared invocation policy under validation; see the [implementation and compatibility record](m8-m9-delivery.md). Historical isolated observations remain separate from completed platform and artifact acceptance.

M4–M7 shipped in v3.7.0 through four feature PRs and a final release PR. [Implementation and validation](m4-m7-delivery.md) records the starting commits, interface decisions and actual evidence; package completion and publication remain separate.

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
| M4 Graphical indicators | [APPEARANCE-03](development-plan.md#appearance-03) | Optional short bars for context and quotas, with readable text fallback | Existing observed percentages, component options and layout | DONE |
| M5 Component groups | [COMPOSITION-02](development-plan.md#composition-02) | Decorations hide with their metric; groups can share a Powerline block | Existing instances, visibility and Powerline | DONE |
| M6 GitHub refresh | [WORKFLOW-02](development-plan.md#workflow-02) | Separately enabled automatic PR/CI refresh with visible state and stop controls | Delivered EXTENSIONS-01 and WORKFLOW-01 | DONE |
| M7 Derived metrics | [METRICS-01](development-plan.md#metrics-01) | Hourly cost with an explicit session-time or API-time denominator | Existing observed session cost and duration fields | DONE |
| Engineering as needed | [CAPABILITIES-01](development-plan.md#capabilities-01) | Consistent supported options and explanations for components | Specific metadata needs exposed by appearance or extensions | DONE |
| Independent maintenance | [CI-01](development-plan.md#ci-01) | Pinned Actions references with reviewable updates | Current workflow inventory | DONE |

M1 → M2 → M3 → M4–M7 records the historical delivery sequence, retaining completed IDs and evidence. SHOWCASE-01 was originally listed with M2, then M8; it remains unstarted and is now M13 after the selected new functionality. CI-01 is complete as independent maintenance; its weekly Dependabot proposals and validation are tracked in [CI maintenance](ci-maintenance.md).

<a id="candidates"></a>

## Candidate pool and entry conditions

Selective import, gradients and explicit main-row alignment have moved into [IMPORT-01](development-plan.md#import-01), [APPEARANCE-04](development-plan.md#appearance-04) and [COMPOSITION-03](development-plan.md#composition-03). Their scope/status is maintained in the mainline and work packages, not duplicated below.

### Functional candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| Additional token-rate views | Compare observed session or recent-window token throughput; select one scope first | Define duration, token inclusion, replay deduplication and main/agent scope; preserve existing latest-request `output-rate` meaning |
| Additional cache views | Inspect read/write amounts or ratios for a selected request/session scope | Existing `prompt-cache` already exposes hit ratio/write tokens; require a distinct need, authoritative fields and an explicit denominator |
| Daily remaining budget | Show a verified daily allowance remainder or a clearly identified user budget | Reliable amounts, currency, freshness, full period boundaries and timezone; a `monthly` label alone is insufficient |
| Quota consumption pacing and time cursors | Compare quota consumption with verified window progress | Establish window boundaries, elapsed-time meaning and unknown behavior; distinguish countdown, consumption and estimates |
| Automatic command-source refresh | Repeat one explicitly selected bounded command during its chosen context | A separate decision on recurring execution authorization, inputs, interval, concurrency, start/stop and failure outcomes; TTL is not execution permission |
| GitLab provider | Inspect a branch's merge request and CI; begin with manual read-only lookup | Actual demand, authoritative fields, existing authentication and repository/branch/HEAD identity; define GitLab-specific states |
| Gitee provider | Inspect a branch's pull request and CI; begin with manual read-only lookup | Actual demand, authoritative fields and provider-specific authentication/identity; repository mirroring is separate |
| Service status | Show a selected service's published status and freshness | Reliable source and distinct unavailable/stale states; global service status does not establish personal request or gateway health |
| Voice configuration hint | Indicate observed voice-input configuration | Verify configuration precedence and availability; configured enablement does not establish active recording |
| Sandbox configuration hint | Indicate observed sandbox configuration | Verify managed/CLI overrides and availability; configured enablement does not establish active isolation |

### Supporting candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| Contribution guide | Help a contributor complete one bounded change | A reproducible path through module ownership, applicable checks, translations and generated resources; reuse existing guides |
| General issue/feature templates | Capture actionable reports beyond preview feedback | Minimum version/environment/reproduction fields and a clear distinction between a bug and a requested capability |
| Migration guidance | Help a user map an existing setup to this product | Verified source/target versions, capability mapping, manual steps and recovery; do not promise lossless automatic conversion |

### Longer-term candidates

| Candidate | User scenario and minimum slice | Evidence and entry condition |
| --- | --- | --- |
| JJ | Show Jujutsu state for a real user's repository | Identified demand, reliable output and availability/identity semantics; select read-only fields first |
| Other clients | Reuse a selected capability with a named client | A verified input/lifecycle contract and a concrete integration/support boundary |
| Plugin marketplace | Discover and manage third-party components | Actual extension use plus a selected distribution, trust, compatibility and lifecycle model |
| Automatic script downloads | Obtain a named external component | A separately selected source, integrity, review, installation and removal design |
| General Shell mode | Support a concrete command requiring Shell interpretation | A separate interaction and execution-authorization design beyond the existing executable/argv source |

Candidates have no assigned version or date. Listing one does not start development or make it a completion condition for M8–M13. Promote a candidate only through an explicit scope decision and a corresponding work-package update. Evaluate distinct user needs and data definitions rather than component counts.

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
| v3.7.0 | APPEARANCE-03, COMPOSITION-02, WORKFLOW-02, METRICS-01 | DONE | [Indicators, groups, refresh and rates](m4-m7-delivery.md) |

The linked records retain source/tag identities, checksums, CI results, channel verification, recovery details and delivery-time limitations. Historical statements about future candidates retain their original context; the stage table above gives their planning status at this page's update date. Earlier migration milestones remain in the [TypeScript migration plan](typescript-migration.md). Release notes are maintained under [releases](../releases).

CI-01 is complete as repository maintenance without a new product version. Its [validation and update procedure](ci-maintenance.md) records the final PR/main matrices, manual workflow checks and retained failure history.

<a id="maintenance"></a>

## Document maintenance and handoff

Maintain this roadmap and the [development plan](development-plan.md) with their Simplified Chinese counterparts. Update stages and status here, scope and acceptance in the plan, and actual implementation/publication evidence in the relevant delivery record. Use `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE`; a documentation edit does not advance a feature's status.

Keep future plans separate from stable usage instructions. Update both languages together, preserve work-package IDs and section anchors, and explain scope or dependency changes. Add links from the development guide when a new record becomes useful to contributors.

Run `npm run docs:check` and `git diff --check`. Compare bilingual IDs, dependencies, statuses and delivered facts, and verify links from a checkout containing only committed files. Local planning archives and raw validation records remain private and are not dependencies of these public documents.
