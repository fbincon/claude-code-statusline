# Task browsing and version review

**English** | [简体中文](task-version-review.zh-CN.md)

Implementation target: v3.11.0. TASK-02 includes its basic and enhanced reading slices; UPDATE-02 includes only slice 1. Publication evidence will be recorded after the final gates. [Task usage](../TASK_DETAILS.md) · [Package management](../PACKAGE_MANAGEMENT.md).

## Responsibilities and interfaces

Core owns task reading/navigation, package review state, localized presentation and response validation. CLI supplies known task files, local package inspection and the existing UPDATE-01 review service. Platform owns detached worker launch, package copying and bounded npm processes. TUI owns terminal I/O; Native keeps full task reports in the host and sends only bounded presentation/input frames to the Client.

The independent `task view` entry requires an explicit session; the external editor offers the same view through Settings. Prompt omission retains published current-pointer semantics. Both readers share agent status filtering, case-insensitive name/ID search, ancestor context, expand/collapse, evidence visibility and stable row anchors. No additional collection, transcript scan, model call or background task polling is introduced. A failed read retains the last successful report and capture time. UI preferences initialize independently from task reads.

Editor protocol 27 adds local `package_status` and owner-bound `package_review_start`, `package_review_status`, `package_review_cancel`. See [contracts](contracts.md#task-browsing-and-package-review-protocol-27). Task details remain version 1; display schema 16 and existing persistent formats do not change.

## Review and failure behavior

Opening the package page is local. Explicit metadata checks remain unverified; download/staging dry runs verify the selected artifact and integration preflight. The following verification pins the metadata result's exact version and integrity. Review snapshots bind installation identity, prefix, configuration directory, saved configuration hashes, channel/history and host identity. A changed snapshot invalidates the result. A configuration restoration review is separate from a package rollback and does not imply an artifact check.

Long reviews use private temporary jobs and, for installed packages, an independent copy of the current package. Each job accepts only check/dry-run operations, has an owner and deadline, and uses the established bounded literal-argv npm adapter with lifecycle scripts disabled. Progress is queried explicitly. Closing cancels only that view's job; a late start is also cancelled. Cancellation waits within a short request budget for verified process exit before removing its runner. An unconfirmed stop retains the files and blocks a replacement review. Temporary review files never become installation transactions or recovery history. Existing CLI execution, locking, snapshots and recovery remain in UPDATE-01.

Damaged history and snapshots are reported without repair. History presentation reads at most 16 records per page; a pending operation is shown separately. Package execution/recovery UI and protected history cleanup remain UPDATE-02 slices 2/3. Reviews never save an editor draft or restore source grants.

## Validation and delivery

Required coverage includes six languages, empty/partial/stale/conflicting task data, parent gaps, large lists, Unicode resizing, stable selection, refresh failure, saved/unsaved/unknown-save editor states, local-only page entry, metadata versus verified artifacts, incompatible targets, integrity/identity changes and view-owned cancellation. Existing upgrade/rollback/recovery checks remain required.

Installed controlled-registry acceptance exercises local inspection without registry traffic, metadata checks, verified upgrade/rollback dry runs, separate configuration-restore review and cancellation while comparing installation/configuration bytes. The release verifier requires these receipts in both installation and official-host version-management results. Existing 8 installation targets, 32 Node cases, 16 fixed hosts and 197 Native capacity cases remain mandatory, together with new installed/PTY journeys.

The test machine's Claude 2.1.312 observations are supplemental. They do not replace fixed-host receipts or establish physical/human acceptance. The same six [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps remain accepted and unverified. No paid model tests are part of this work.
