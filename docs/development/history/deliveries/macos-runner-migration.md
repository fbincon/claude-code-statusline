# macOS runner migration

**English** | [简体中文](macos-runner-migration.zh-CN.md)

This 2026-11-19 CI maintenance delivery migrates the Apple Silicon job from the retired macOS 14 runner. The scope is hosted CI policy and evidence verification. Product versioning, version tags, GitHub Releases and npm publication are outside this delivery.

## Changes

| Area | Result |
| --- | --- |
| Runner inventory | macOS 15 ARM takes over the full Node 22.0.0 history alongside its existing full Node 24.0.0 history. The current grid has seven installations, 28 Node cases and 16 fixed Claude hosts. |
| Evidence | Earlier source commits retain their original runner inventory, history depths and coverage digest. Promotions and release preparation report coverage from the accepted source. |

## Source identities

- Baseline before the task is `c638208a`.
- The implementation commit, final head and hosted checks are recorded in the maintenance PR.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Existing hosted candidate | [Job 135029165885](https://github.com/fbincon/claude-code-statusline/actions/runs/44367581196/job/135029165885) was canceled before execution because the macOS 14 runner configuration was unavailable. [GitHub retirement notice](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/) |
| Focused regression checks | 36 tests passed across runtime resolution, original and migrated coverage plans, physical evidence verification, bilingual content and release preparation. |
| `npm run actions:check` | Workflow identity check passed. |

This delivery verifies hosted scheduling and evidence contracts. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) tracks the existing physical acceptance gaps.
