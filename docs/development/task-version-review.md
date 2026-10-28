# Task browsing and version review

**English** | [简体中文](task-version-review.zh-CN.md)

TASK-02 and UPDATE-02 slice 1 are delivered in v3.11.0, published on 2026-10-28. TASK-02 includes both reading slices; UPDATE-02 slices 2/3 remain unstarted. The maintainer requested keeping 3.11.0 and deferring the observed package-page permission warning to [issue #173](https://github.com/fbincon/claude-code-statusline/issues/173). [Task usage](../TASK_DETAILS.md) · [Package management](../PACKAGE_MANAGEMENT.md).

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

## Accepted source and immutable delivery

[PR #172](https://github.com/fbincon/claude-code-statusline/pull/172) delivers source `d49547efd52cfe9a786b7291cfc0cf28828e8246`. Main merge `f72fe3dcfb9c70aa67d2a972ea0edcc97d484c15` has the same tree. Annotated tag `v3.11.0`, object `cd07a2a152a88a7e8a3e26aea80d5301eccb0b84`, points to the accepted PR source reachable from main.

| Gate | Result |
| --- | --- |
| [Final PR 40681624434](https://github.com/fbincon/claude-code-statusline/actions/runs/40681624434) | Complete candidate evidence passed; 8 installation targets, 32 Node cases, 16 fixed hosts and 197 Native capacity cases |
| [Main 40689472382](https://github.com/fbincon/claude-code-statusline/actions/runs/40689472382) | Original evidence verification and Linux/Windows/macOS installation smokes passed |
| [Tag 40690205648](https://github.com/fbincon/claude-code-statusline/actions/runs/40690205648) | Original source promotion and Complete candidate evidence passed |
| [npm dry run 40692422132](https://github.com/fbincon/claude-code-statusline/actions/runs/40692422132) | Passed against the exact tag and original package |
| [npm publication 40692928066](https://github.com/fbincon/claude-code-statusline/actions/runs/40692928066) | New OIDC publication and registry verification passed |

Original candidate artifact `12813002893` supplies the four delivery files. Acceptance artifact `12815224448` records 56 original executions and 66 receipt hashes. Independent local builds and a rebuild from the delivered source archive reproduce all four files exactly; main and tag reuse the original bytes.

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.11.0.tgz` | `bb9545b8f6da203f90da5a06694f86ae4e457d21514db9e736c9a6716f387d99` |
| `claude-code-statusline-3.11.0-source.tar.gz` | `6794411a91e6fe3577aae88cbcf0fb3ab54180f12d704c1a3d08c5681c4d6abe` |
| `build-manifest.json` | `e7cc136cd4bac57e3613f95c811470061937889b5e2f5e6f1ea83119552f62ff` |
| `SHA256SUMS` | `b036efaef60df4761490df81cd892beb781014dceb8f64807cee4fa246365559` |

## Local and terminal verification

The final source passes `npm run check`: 1,364 tests pass, six existing platform cases skip and none fail. Generation checks cover 70 owned resources; documentation, archive and responsibility checks pass. The fixed Claude 2.1.310 Native suite passes all 164 tests and exact-host type checks.

Installed acceptance now has 24 categories, including six-language task reading and the metadata/verified-artifact distinction. The four downloaded GitHub draft attachments match the original CI files, and a fresh offline installation of that downloaded package passes all 24 categories. Configuration and package bytes remain unchanged during reviews.

The final package passes 27 real Linux Native/external PTY journeys. Extended external capture records 924 light/dark frames across six languages and four monochrome/dumb-terminal controls, with restored terminals and unchanged configuration. Task summary, evidence, explicit identity, standalone entry and local package pages were visually inspected. Capture sources are [the external collector](../../tools/acceptance/editor-capture.ts) and [the Native/external journey collector](../../tools/acceptance/native-capacity-pty.ts); their reports retain exact source, package, font and frame hashes. These are terminal-cell reconstructions using synthetic task evidence. The isolated local package-page captures intentionally show an unknown persistent prefix; they do not claim a managed global installation.

Acceptance found and fixed a cancellation cleanup race and repeated Unicode scans during large-report Native paging. Cancellation now confirms worker exit before cleanup. Paging reuses already wrapped rows and indexed parent relations; the existing 5-second host test remains unchanged. Earlier failed, interrupted and partial-transfer receipts remain separate from passing evidence. Raw logs, cell captures and rendered images stay under ignored `dist/validation/v3.11.0/`.

## Published channels and test machine

[npm 3.11.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.11.0) is public: `latest=3.11.0`, while `beta=3.0.0-beta.1` is preserved. The OIDC publication receipt records the original package hash and source above.

[GitHub v3.11.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.11.0) is immutable, stable and Latest, published at `2026-10-28T13:15:20Z`. [Public downloads 40694759092](https://github.com/fbincon/claude-code-statusline/actions/runs/40694759092) passed all six Linux/Windows/macOS × Node 22/24 jobs, including exact-version and latest installations.

[Gitee v3.11.0](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.11.0), Release `1250326`, distributes the same annotated tag and four verified files. All four manual attachments were downloaded anonymously with normal TLS verification and match the original bytes. The two automatically generated archives are not substituted for the verified source archive. An empty-cache offline installation of the downloaded package passes version, rendering, task JSON and standalone task PTY/cancellation checks. Release notes were rendered from GitHub metadata and actual Gitee attachment URLs, then read back. Validated main and the exact tag were synchronized with explicit refspecs after checking ancestry.

The actual test installation was upgraded from 3.10.0 to 3.11.0 through the supported package manager, with snapshot `pkg-a9d5b015-a091-4dd5-b390-56d59a870238`. Package/integration verification and doctor pass. A supplemental actual-installation PTY probe opens the external package page, task summary/evidence and standalone task viewer, retains an unsaved draft, exits with restored terminal attributes and makes no model call. It explicitly records the warning below instead of claiming that package compatibility inspection passed. Native resource ownership and the installed backend binding remain verified by doctor; this is not a new human/physical acceptance claim.

Configuration-restoration review found no display changes to restore. Original display/UI preference bytes, POSIX modes and optional-file absence match the pre-upgrade snapshot. Unrelated Claude settings are unchanged; the sole settings difference is the managed Native backend version changing from 3.10.0 to 3.11.0. The installed package remains 3.11.0.

## Deferred package-page warning

[Issue #173](https://github.com/fbincon/claude-code-statusline/issues/173) records a confirmed post-publication defect: the package page reads ordinary npm manifests through the private recovery-artifact reader, so POSIX modes such as `0644`/`0664` can produce `io_error` and false local compatibility. Version, prefix and previous-version identification still work. Existing CLI package reviews remain available; installation permissions must not be changed merely to suppress the warning.

On 2026-10-28 the maintainer explicitly requested keeping 3.11.0 and leaving this issue for subsequent development. The uncommitted corrective patch was withdrawn; no 3.11.1 tag or publication was created. This known defect is separate from the six still-unverified issue #96 gaps and is not reported as a passing check. TASK-02 is delivered; UPDATE-02 slice 1 is delivered with this separately tracked issue, while slices 2/3 remain unstarted.
