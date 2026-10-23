# M4–M7 implementation and delivery

**English** | [简体中文](m4-m7-delivery.zh-CN.md)

The maintainer approved four sequential feature PRs and one v3.7.0 release PR. Research baseline: `a882bd1942d0a59e24e1536779fa283fd1f63c1b`. Publication requires the final PR/main/tag automated gates. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted; they remain unverified. New failures are not waived.

| Package | State | Interface decision |
| --- | --- | --- |
| APPEARANCE-03 | VALIDATING | Display 11, editor 18; optional per-instance presentation/width/characters |
| COMPOSITION-02 | NOT_STARTED | Planned display 12, editor 19; single-level groups |
| WORKFLOW-02 | NOT_STARTED | Planned editor 20, source registry/jobs 2, runtime 3; persistent local opt-in |
| METRICS-01 | NOT_STARTED | Planned display 13, editor 21; session/API cost-rate denominator |

## APPEARANCE-03

Canonical controls live in core/editor; generated Mod copies are never edited independently. Rendering is pure and numeric defaults retain their existing path. Bars preserve observed percentage/direction, missing and stale semantics, raw visibility thresholds and Unicode cell boundaries. The core catalog advertises eligible components; both editors, CLI, imports and profile persistence use the same options.

Local `npm run check` passed (1,135 tests, five platform skips); generated resources, docs and responsibility inventories passed. Claude 2.1.294 native Mod tests passed 130/130 and exact-host TypeScript checking passed. A follow-up focused check also passed after preserving the legacy subagent half-percentage rounding. PR/main installation and host matrices remain pending. Source tests cover boundaries, repeated instances, six output languages, both editor shared forms, independent agent values and old configurations. Installed receipts additionally require three indicator cases (default/opt-in, subagents, portable round trip). No release or platform acceptance is claimed by this record yet.

## Remaining delivery

Implement grouping, automatic refresh and rates in roadmap order. Automatic refresh is remembered locally until disabled and runs only in supported active sessions; it does not enable metric sampling. Final delivery includes immutable builds, full matrices, installed terminal verification, npm OIDC, GitHub/Gitee assets and public download checks. README changes remain feature introductions, with version notes in releases.
