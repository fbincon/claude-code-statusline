# Main statusline semantic separators

**English** | [简体中文](semantic-group-separators.zh-CN.md)

This 2026-11-20 feature delivery restores semantic separators in the main statusline. Delivery includes source and documentation only, with no version, tag, Release or npm publication. [Issue #210](https://github.com/fbincon/claude-code-statusline/issues/210)

## Changes

| Area | Result |
| --- | --- |
| Classic and compact rows | Visible standalone neighbors in the same semantic group join with `·`. Explicit groups use spaces inside and keep their configured top-level boundary. |
| Indicators and fitting | Numeric, bar and adaptive indicators use the same context or limits group. Fitting reevaluates neighbors after omission and keeps each side of a spacer separate. |
| Aligned rows | Semantic separators follow the same rule while column positions, padding and hidden slots retain their layout. Narrow rows use the ordinary fitting path when alignment collapses. |
| Powerline | Standalone items retain their blocks. An explicit group can share a block using the primary's background. |

## Source identities

- Baseline before the task is `93e4916772178fcf7fcb693da10aca72b570d595`.
- Implementation and engineering candidate source are `636ba1f73b75cb805baa80bd6806becb65643178`. The PR records the final reviewed head.
- Engineering candidate SHA-256 is `66bd73d34ebfe50e789aa125ff4765fb638e4de4a94a661eb8053a0e4f1a0f1a`.
- Validation used Linux x64, Node 24.21.0, npm 11.19.0 and Claude Code 2.1.322. The Claude binary SHA-256 is `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Rendering regressions | Six new cases failed on the baseline and passed after the fix. The 94 focused tests covered grouped rendering, indicators, alignment, Powerline, gradients and explain output. |
| `npm run check` | 1,831 tests passed with six platform-specific skips. This included both documented rendering examples, generated-resource verification and frozen reference coverage. |
| `npm run docs:check` and `git diff --check` | Bilingual documentation, links and whitespace passed. |
| `npm run ci:plan` | Product route with no unknown paths or supplementary product checks. |
| Candidate build and verification | Two independent builds produced identical bytes. Package verification checked 1,102 files and the installed smoke used the same tarball. |
| Installed CLI and Claude Code PTY | Four fixed-input checks matched CLI rendering and preview at wide and narrow widths with and without an explicit group. The real host showed `Project issue-210-fixture · issue-210-fixture \| HOST v2.1.322` at 122 columns and kept the dotted location pair after omitting the group at 52 columns. |
| Native Mod on Claude Code 2.1.322 | Strict validation, type checking with declarations emitted by the exact host, and 357 official tests across 45 files passed. |
| Native capacity on Claude Code 2.1.322 | The regenerated previews passed all 313 capacity cases across seven official test files. |
| Isolation and cost | The temporary installation was removed. All 11 checked Claude and statusline paths matched their original fingerprints or absence. Zero paid model calls. |

Execution covered local Linux checks and PTY operation of Claude Code 2.1.322. The six existing validation gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
