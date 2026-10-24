# Git, terminal, first entry and version management delivery

**English** | [简体中文](m8-m9-delivery.zh-CN.md)

Target: v3.8.0. Start: `d2975e8a4561371b5d32bec136400963dbccd97f`. Publication is pending. The maintainer approved four feature PRs and a release PR, final PR/main/tag gates and GitHub/npm/Gitee byte verification. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted; they remain unverified.

| Package | State | Evidence |
| --- | --- | --- |
| GIT-01 | VALIDATING | Shared policy and isolated regressions; platform/installed receipts pending |
| TERMINAL-01 | VALIDATING | Windows capability consistency |
| SETUP-02 | NOT_STARTED | Durable npm first entry |
| UPDATE-01 | NOT_STARTED | Explicit CLI version transitions from v3.7.0 |

## Git invocation policy

Platform owns bounded direct Git calls and inherited provider policy. Runtime status, commit diffs, source identity and GitHub refresh use it. Calls disable fsmonitor and implicit bare discovery without relaxing ownership checks. Status preflights filters and initialized submodules, retaining submodule dirty detection. Unknown or conflicting repository commands stop collection before scanning tracked contents. The two-second status budget includes inspection. Each command has a 4 MiB output bound; recursion is limited to 64 repositories.

| Configuration | Behavior |
| --- | --- |
| User/system filters outside repository-controlled paths | Preserve user transformations |
| Standard local Git LFS commands | Pin an executable outside the repository and Git directories |
| Standard local git-crypt clean/smudge | Require an existing external absolute executable and supported literal arguments |
| Other local/worktree commands, unsafe names or conflicting submodule definitions | Return `filter_blocked` or `policy_unavailable`, never clean/zero |
| fsmonitor in any scope | Disabled for these observations only |
| Implicit bare repositories | Refused; no `safe.directory` override |

Git status cache version is 3; display and editor interfaces are unchanged. Localized `doctor` guidance and cached diagnosis report policy failures without printing filter commands or credentials. Direct arguments and both runtime environment configuration mechanisms carry the policy, preserving unrelated entries. This is not a sandbox against another process concurrently rewriting repository files or trusted executable installations.

Isolated regressions cover same-length clean-filter invocation, fsmonitor, global filters, includes, linked worktrees, submodules, bare repositories, Unicode/space paths and unchanged configuration bytes. The review considered Matthew Breedlove (sirmalloc) and contributors' [ccstatusline design](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-hardening.ts); this implementation also stops when transformation semantics cannot be preserved and checks submodules. See [Git configuration documentation](https://git-scm.com/docs/git-config).

## Validation and publication

Record local checks before each feature PR. Add CI/installed receipts, immutable identities and public channel results as completed. Pending platform, human or publication checks are not passes.

Local development checks passed: 1,167 tests passed and five existing platform skips; generated resources, 3,150 documentation links, archive integrity and migration inventories passed. Subsequent policy/diagnosis/release-gate regressions were rerun after the installed receipt was added. Four installed Git scenarios are now mandatory in release readiness. Full artifact/platform results remain pending.

The first PR matrix exposed a macOS `/var` versus `/private/var` root alias and an index-timestamp-dependent global-filter fixture. Roots now canonicalize at the policy boundary and the fixture explicitly invalidates its file timestamp. Installed Git checks run in a separate Node process so the harness does not load two native adapter installations. The first failed matrix is retained as evidence; replacement gates must pass.

## Windows preview policy

TERMINAL-01 adds a single platform capability decision and a ready callback shared by setup and configure, including the slash bridge. Actual Windows console handles enable/verify VT processing and preserve their original input/output modes. Explicit no-color and terminal choices take priority; inherited Windows Terminal markers alone do not select a palette. Setup no longer recalculates capability on each frame. Doctor guidance covers all six languages.

Installed acceptance adds 15 native Windows-console cases (three entries × five environments), deliberately clears the initial VT output bit, captures the emitted palette and verifies restoration and unchanged settings. Other platforms check three installed policy scenarios alongside their existing PTY journeys. These are automated console observations, not human Windows Terminal screenshots. The #96 physical/human gaps remain unchanged.

The GIT-01 intermediate artifact from `2545ee2bea2ae05260c9cd1d824f85ac0472d06d` passed independent byte-identical builds and all 17 local installed checks, including four Git scenarios. It was not published.
