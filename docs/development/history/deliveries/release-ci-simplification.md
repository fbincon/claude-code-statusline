# Release CI simplification

**English** | [简体中文](release-ci-simplification.zh-CN.md)

This 2026-11-19 CI maintenance delivery moves ordinary merge validation to local checks and exercises a smaller release matrix. Product versions, repository version tags, Releases and npm publication are outside this delivery.

## Changes

| Area | Result |
| --- | --- |
| Ordinary PR and main | Local results attach to the reviewed head. Project CI allocates zero runners. The main ruleset requires PRs and blocks force pushes and deletions. |
| Release candidate and promotion | An owned `release/` PR builds the four delivery files once and runs the focused package and host matrix. Main verifies the original evidence using its first parent and runs three package smokes. Tag and npm preparation verify and reuse the PR files. |
| Diagnostics | Full historical coverage and targeted probes run by manual dispatch in CI diagnostics. |

## Source identities

- Baseline before the task is `8a4b30522c837fa13a8b9c88edf968c9637496a3`.
- The tested implementation is `f2b9842a418ca2b13983d287801a011cb27c4fea`. The [delivery PR](https://github.com/fbincon/claude-code-statusline/pull/275) records the final head, merge, ruleset readback and Gitee synchronization.
- The [hosted delivery artifact](https://github.com/fbincon/claude-code-statusline/actions/runs/44438451670/artifacts/14489607633) has ZIP SHA-256 `412db00ec0bacb519dbed9bd473dd7163252d1110defcfcc82b2ba6b43b61e6b`. The package SHA-256 is `7ecfbe054d9229b06e8f9a1876065460d540d66464b788c5c88be6a32ccb2e15`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` | 1,784 passed, six platform-specific skips, zero failures. Generation, documentation, archive and responsibility checks passed. |
| Scoped Linux and workflow checks | The applicable acceptance, Action, checks, documentation and release families passed on `a0ef4b47`. Workflow validation with actionlint v1.7.12 and the source-backed documentation tests passed. |
| Hosted candidate matrix | [Run 44438451670, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/44438451670/attempts/1) passed all 11 executed jobs in 20 minutes 21 seconds from first job start to last completion. The four files match the independent local build byte for byte. |
| PR → main → tag and npm preparation | An isolated Git repository and mocked Actions/registry replay accepted the real four-file bundle. The regressions also rejected changed merge provenance, a failed latest execution, an expired artifact and changed delivery bytes. |

[Earlier run 44436913455](https://github.com/fbincon/claude-code-statusline/actions/runs/44436913455) found a Node 22.0.0 startup failure in the smoke driver. The driver now imports the shared Git reader directly and passed on the actual minimum runtime. CodeQL flagged two checkout inputs in the relocated diagnostics workflow. Pinning checkout to the dispatch SHA cleared the PR scan. The hosted run was a diagnostic, and the release promotions and npm preparation were exercised in isolation. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) retain their accepted, unverified status.
