# Component catalog states and continuous additions

**English** | [简体中文](component-catalog.zh-CN.md)

This 2026-11-19 feature delivery repairs component discovery and activation in the external TUI and Native editor. It covers source on GitHub and Gitee. Versioning, tags, Releases and npm publication belong to a separate release. [Issue #212](https://github.com/fbincon/claude-code-statusline/issues/212) · [Issue #213](https://github.com/fbincon/claude-code-statusline/issues/213)

## Changes

| Area | Result |
| --- | --- |
| Catalog status | Both editors show enabled, disabled-only and unconfigured types from their scoped instances. Duplicate counts include disabled instances. |
| Draft editing | Enter and Space add a type or enable its first disabled instance. Consecutive additions keep their insertion order and each accepted edit has a history entry. |
| Navigation | The catalog inherits the configured list's filters, then tracks its own filters and selection. Ctrl+G returns to the configured list and clears filters when pressed there. |

## Source identities

- Baseline before the task: `c638208acf33d2200476b9a602b525c7acc9ca39`.
- Local implementation and candidate source: `537a5f6a703bb498415c31367f51faf960e1c20e`.
- Engineering package `0.0.0-ts05.g537a5f6a703b` SHA-256: `2c087f54e13043a5e4e32581b03e05dbd523bbb318e91081859612bb9261a6ba`.
- Source archive SHA-256: `11604ba495e9f03abebc84c5920575cd1fb16ecfea3ab873cfd83d2342f3cb90`.
- The pull request records final-head CI and integration evidence.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Resource generation and language validation | 118 generated resources matched. All 12 interface languages covered the catalog changes with zero English fallbacks in the language readiness report. |
| Documentation content and examples | 34 tests passed. Link and whitespace checks passed. |
| Frozen compatibility replay | All 161 replay cases completed on the isolated rerun after a timeout in the first combined run. |
| Native exact-host declarations and targeted official tests | Claude Code 2.1.322 emitted its declarations. Type checking and all 69 tests across six scoped test files passed. |
| `candidate:build` and `candidate:verify` | Two independent builds produced identical package bytes. Candidate source and package identities verified. |
| `capture:native-capacity -- --component-picker` | Four Linux x64 PTY journeys passed. Both editors exercised Main and Subagents, filter restoration, continuous additions and reactivation. Saving was verified through `config list-items` in both scopes, and discarding preserved file bytes and mode. |

The local installed evidence uses Claude Code 2.1.322, Node 24.21.0, a temporary installation and isolated settings. It records automated PTY results and zero model calls. Physical acceptance retains the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96).
