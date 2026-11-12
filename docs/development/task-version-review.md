# Task browsing and version review

**English** | [简体中文](task-version-review.zh-CN.md)

This page describes task browsing and read-only task evidence, local package review, and their shared editor and Native presentation. Original v3.11.0 implementation and release evidence is in the [delivery record](history/deliveries/task-version-review.md#task-browsing-and-version-review). [Task usage](../TASK_DETAILS.md) · [Package management](../PACKAGE_MANAGEMENT.md).

## Responsibilities and interfaces

Core owns task reading/navigation, package review state, localized presentation and response validation. CLI supplies known task files, local package inspection and the existing UPDATE-01 review service. Platform owns detached worker launch, package copying and bounded npm processes. TUI owns terminal I/O; Native keeps full task reports in the host and sends only bounded presentation/input frames to the Client.

The independent `task view` entry requires an explicit session; the external editor offers the same view through Settings. Prompt omission retains published current-pointer semantics. Both readers share agent status filtering, case-insensitive name/ID search, ancestor context, expand/collapse, evidence visibility and stable row anchors. No additional collection, transcript scan, model call or background task polling is introduced. A failed read retains the last successful report and capture time. UI preferences initialize independently from task reads.

## Review and failure behavior

Opening the package page is local. Explicit metadata checks remain unverified; download/staging dry runs verify the selected artifact and integration preflight. The following verification pins the metadata result's exact version and integrity. Review snapshots bind installation identity, prefix, configuration directory, saved configuration hashes, channel/history and host identity. A changed snapshot invalidates the result. A configuration restoration review is separate from a package rollback and does not imply an artifact check.

Long reviews use private temporary jobs and, for installed packages, an independent copy of the current package. Each job accepts only check/dry-run operations, has an owner and deadline, and uses the established bounded literal-argv npm adapter with lifecycle scripts disabled. Progress is queried explicitly. Closing cancels only that view's job; a late start is also cancelled. Cancellation waits within a short request budget for verified process exit before removing its runner. An unconfirmed stop retains the files and blocks a replacement review. Temporary review files never become installation transactions or recovery history. Existing CLI execution, locking, snapshots and recovery remain in UPDATE-01.

Damaged history and snapshots are reported without repair. History presentation reads at most 16 records per page; a pending operation is shown separately. Reviews never save an editor draft or restore source grants.

The full [delivery record](history/deliveries/task-version-review.md#task-browsing-and-version-review) is in the development history. The links below open its moved sections.

- <a id="validation-and-delivery"></a>[Validation and delivery](history/deliveries/task-version-review.md#validation-and-delivery)
- <a id="accepted-source-and-immutable-delivery"></a>[Accepted source and immutable delivery](history/deliveries/task-version-review.md#accepted-source-and-immutable-delivery)
- <a id="local-and-terminal-verification"></a>[Local and terminal verification](history/deliveries/task-version-review.md#local-and-terminal-verification)
- <a id="published-channels-and-test-machine"></a>[Published channels and test machine](history/deliveries/task-version-review.md#published-channels-and-test-machine)
- <a id="deferred-package-page-warning"></a>[Deferred package-page warning](history/deliveries/task-version-review.md#deferred-package-page-warning)
