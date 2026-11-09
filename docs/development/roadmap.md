# Development roadmap

**English** | [简体中文](roadmap.zh-CN.md)

This roadmap owns product direction, priorities and work-package status. The [development plan](development-plan.md#work-index) explains how to define scope, dependencies, slices and acceptance. The [history index](history/README.md#delivery-records) links implementation and publication evidence.

[Development status](#status) · [Candidates](#candidates) · [Stages and dependencies](#milestones)

<a id="status"></a>

## Current development status

M1–M12 and the eighteen selected follow-up packages are delivered. [SHOWCASE-01](showcase.md#delivery) demonstrates those workflows using the published v3.16.0 package. See the [release notes](../releases/README.md) for subsequent versions and fixes.

<a id="delivery-history"></a><a id="delivered-work-and-historical-evidence"></a>

The [work packages by version](history/README.md#delivery-by-version) index records deliveries. The [topic index](history/README.md#delivery-records) links implementation and verification evidence.

- <a id="planning-baseline-and-product-direction"></a><a id="baseline"></a><a id="current-baseline-and-product-direction"></a>[Planning baseline and product direction](history/roadmap-milestones.md#baseline)
- <a id="reference-projects-and-acknowledgements"></a><a id="reference"></a>[Reference projects and acknowledgements](history/roadmap-milestones.md#reference)

<a id="candidates"></a>

## Candidate pool and entry conditions

The [delivered mainline](history/roadmap-milestones.md#planned-mainline) covers the previously selected improvements, including automatic command refresh under [COMMAND-02](history/work-package-designs.md#command-02). Existing IMPORT-01, APPEARANCE-04 and COMPOSITION-03 remain delivered. The pool below contains only unselected directions.

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

<a id="milestones"></a>

## Stages and dependencies

M1 → M2 → M3 → M4–M7 records the early delivery sequence. SHOWCASE-01 followed acceptance of the original eighteen formal follow-up packages and all their slices. I18N-02 had a separate schedule. The archived tables preserve the original dependencies and scheduling.

After selecting a candidate, start from the then-current `main`, verify its entry conditions and define dependencies and delivery scope in the work package. Track `NOT_STARTED` → `IN_PROGRESS` → `VALIDATING` → `DONE` and record feature merge, package completion and publication separately.

- <a id="delivered-mainline"></a><a id="planned-mainline"></a>[Delivered mainline](history/roadmap-milestones.md#planned-mainline)
- <a id="delivered-stages"></a>[Delivered stages](history/roadmap-milestones.md#delivered-stages)
- <a id="packages"></a><a id="using-work-packages"></a>[Work package scope and slices](development-plan.md#work-index)
- <a id="acceptance"></a><a id="stage-completion-requirements"></a>[Functional acceptance matrix](development-plan.md#acceptance-matrix) · [Testing and acceptance](testing.md)
- <a id="maintenance"></a><a id="document-maintenance-and-handoff"></a>[Documentation ownership](README.md#documentation-ownership) · [Work package handoff](development-plan.md#handoff)
