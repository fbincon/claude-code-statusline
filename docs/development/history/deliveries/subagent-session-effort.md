# Subagent session effort

**English** | [简体中文](subagent-session-effort.zh-CN.md)

This 2026-11-19 feature delivery defaults both subagent effort components to session fallback, following [PR #277](https://github.com/fbincon/claude-code-statusline/pull/277). The scope is code and documentation only, with no version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Instance configuration | Subagent `model-with-effort` and `effort` use `session` when `effort_fallback` is omitted. The CLI and both editors can persist `off` for a single instance. An old saved instance with the field omitted also uses the new default. |
| Rendering and diagnosis | Configured effort takes priority. A missing value can use a main observation from the same session and exact model ID within 15 seconds, with a `~` marker. Diagnosis reports provenance per task and instance. The two editors use a fixed preview task that matches the sample session model. |

## Source identities

- Baseline before the task: `dc939ef08e247e0574a75c678a3ea9ba2037c09d`.
- Implementation commit: `c90a15c37b768de42263b21d69ece2c26b8a6af5`. The final reviewed head is recorded in the PR.
- Engineering candidate SHA-256: `8f8dc8de31750ce6fa38c85e4ac0f00d7b3d504c2857fbb6836138e148c9fdb7`.
- Linux x64 host: Node 24.21.0 and Claude Code 2.1.322. Claude binary SHA-256: `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local repository checks | `npm run check` passed 1,815 tests with six platform skips, including all 161 frozen replay cases. Generation verified 119 resources. Language coverage and 35 source-backed documentation and example tests passed. |
| Candidate build and Linux installation | Two independent builds produced identical bytes. Candidate verification checked 1,102 files. Offline installation, `doctor`, rendering, configuration read/write and uninstall smoke passed. |
| Installed Claude Code callbacks | Four PTY sessions showed `sonnet-4-6/~high` and `~high` by default, suppressed only the selected instance's fallback when either was switched to `off`, and displayed both again after setting `session`. The configured agent displayed `sonnet-4-6/low` and `low` in all four sessions. |
| Editors | The installed external TUI saved and reopened both values for both components. The identical Native Mod source tree passed 356 official tests across 45 files, strict plugin validation and type checking with declarations produced by the exact host. |
| Settings and cost | All 16 model requests used a local loopback responder with USD 0 charged. The four runs confirmed the fingerprints or absence of eight real paths and removed their isolated installations. |

This delivery used Linux checks and PTY evidence. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
