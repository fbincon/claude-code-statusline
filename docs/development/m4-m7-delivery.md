# M4–M7 implementation and delivery

**English** | [简体中文](m4-m7-delivery.zh-CN.md)

The maintainer approved four sequential feature PRs and one v3.7.0 release PR. Research baseline: `a882bd1942d0a59e24e1536779fa283fd1f63c1b`. Publication requires the final PR/main/tag automated gates. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted; they remain unverified. New failures are not waived.

| Package | State | Interface decision |
| --- | --- | --- |
| APPEARANCE-03 | VALIDATING | Display 11, editor 18; optional per-instance presentation/width/characters |
| COMPOSITION-02 | IN_PROGRESS | Planned display 12, editor 19; single-level groups |
| WORKFLOW-02 | NOT_STARTED | Planned editor 20, source registry/jobs 2, runtime 3; persistent local opt-in |
| METRICS-01 | NOT_STARTED | Planned display 13, editor 21; session/API cost-rate denominator |

## APPEARANCE-03

Canonical controls live in core/editor; generated Mod copies are never edited independently. Rendering is pure and numeric defaults retain their existing path. Bars preserve observed percentage/direction, missing and stale semantics, raw visibility thresholds and Unicode cell boundaries. The core catalog advertises eligible components; both editors, CLI, imports and profile persistence use the same options.

Local `npm run check` passed (1,135 tests, five platform skips); generated resources, docs and responsibility inventories passed. Claude 2.1.294 native Mod tests passed 130/130 and exact-host TypeScript checking passed. A follow-up focused check also passed after preserving the legacy subagent half-percentage rounding. PR/main installation and host matrices remain pending. Source tests cover boundaries, repeated instances, six output languages, both editor shared forms, independent agent values and old configurations. Installed receipts additionally require three indicator cases (default/opt-in, subagents, portable round trip). No release or platform acceptance is claimed by this record yet.

## Remaining delivery

Implement grouping, automatic refresh and rates in roadmap order. Automatic refresh is remembered locally until disabled and runs only in supported active sessions; it does not enable metric sampling. Final delivery includes immutable builds, full matrices, installed terminal verification, npm OIDC, GitHub/Gitee assets and public download checks. README changes remain feature introductions, with version notes in releases.

M4 candidate `abb2192f337d8fc985c1b2c304a97deaae31937f` built twice with identical SHA-256 `559e6e185990cce24d71b34b920c121c7e41b1103625288137ae57464e709163`; all 13 isolated Linux installation cases passed, including the three required indicator scenarios. Five focused indicator tests additionally cover Powerline/spacers down to four cells. These local receipts do not replace final-head CI or release artifacts. [Feature PR #129](https://github.com/fbincon/claude-code-statusline/pull/129).

PR run `39964870238` retained Windows ARM system-shell readiness timeouts before candidate invocation, and command-source timeouts at the fixture’s 15-second budget. A failed-job retry passed the Node 24.0 case but reproduced the command timeout on Node 22.x. The installed functional fixture now explicitly selects the already-supported 30-second command budget; production defaults, deadline enforcement and short cancellation tests are unchanged. Final-head validation remains required.

## COMPOSITION-02

Preparation starts from M4 head `74f70eb9f85af44a2b80b462a3f6f9755374aef9` in an isolated worktree; the feature PR will use validated M4 main as its base. Group rules and editor transitions live in shared core modules, with a separate group renderer to retain ungrouped output. Tests cover linked omission, unknown/absent values, layout, colors, remapped copies, deletion, rejected edits, both editors and persistence. Installed acceptance adds four group scenarios; validation is in progress.

M5 local full checks passed (1,143 tests, five platform skips), with eight focused grouping cases after the final anchor validation fix. Native Mod tests passed 131/131 and exact Claude 2.1.294 TypeScript checking passed. Immutable package and PR matrices remain pending.

M5 candidate `e6d63cda7940de1058c2f314af53c56819a0644b` built twice with identical SHA-256 `544f1f94e6ce2ca8ad71041bf84e02c7994c9163aefc0a1bc373d1cdb3c6de00`; all 14 isolated Linux installed checks passed, including four group cases. PR/main gates remain pending.
