# Subagent statusline repairs

**English** | [简体中文](subagent-statusline.zh-CN.md)

This 2026-11-19 feature delivery updates subagent names, timer composition and effort display. The work creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Identity | Prefer the explicit name, formatted `agentType`, formatted task type, then the localized agent label. Remove a duplicate task title using the resolved name. [#221](https://github.com/fbincon/claude-code-statusline/issues/221) |
| Composition | Enable and order `status-elapsed`, `status` and `elapsed` independently in the CLI and both editors. The shared group, spacer and width rules still apply. [#222](https://github.com/fbincon/claude-code-statusline/issues/222) |
| Effort | Opt in to session fallback per subagent `model-with-effort` instance. Explicit task effort takes priority. Otherwise, a fresh observation for the same session and raw model ID displays with `~`. Diagnosis reports the source for each instance and task. Previews use fixed sample data. [#237](https://github.com/fbincon/claude-code-statusline/issues/237) |

## Source identities

- Baseline before the task was `51d1e019ddb11d77f510d212c5a3ccc9f79561a6`.
- Implementation and installed acceptance candidate used `61266d9d0b8198e01aeabd78d075cd07b9184682`. The two clean builds produced package SHA-256 `49c8301de695299d9421fe093e0b68e05a28f525acb8d9b7060c22677cdff076`. The candidate verifier checked 1,102 files against that source.
- The Linux host binary was Claude Code 2.1.322 with SHA-256 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`.
- Final head and scoped checks are recorded in [PR #277](https://github.com/fbincon/claude-code-statusline/pull/277).

## Validation and limits

| Check | Actual result |
| --- | --- |
| CLI, rendering and diagnostics | Focused tests cover legacy and malformed host fields, CLI round trips, duplicate instances, cache expiry and invalidation, model and session matching, narrowing, read-only diagnosis and preview, and NDJSON. Resource generation checks and complete accepted coverage for all twelve languages passed. |
| Installed candidate in a Linux PTY | Claude Code 2.1.322 called both statuslines. Two parallel unnamed agents displayed `Inherited Probe` and `Configured Probe` with their own task titles and all three timer components. The parent reported `high`. The same-model agent without effort displayed `sonnet-4-6/~high`. The other displayed its explicit `sonnet-4-6/low`. |
| Editor save and reopen | The installed external TUI and the Native host test each saved and reopened the three timers and the fallback option. The Native suite passed 356 tests on 2.1.322. Native type and strict plugin validation passed. |
| Frozen replay | All 161 frozen cases passed with the existing three wording exceptions. The comparator accepts only the intended subagent catalog fields and retains the original catalog reader. Historical case identifiers and the Python archive were preserved. |
| Isolation and cost | The installed probe used an isolated configuration and a loopback model simulator for all four requests. Cost was USD 0. Eight real Claude and statusline paths retained their original fingerprints or absence. The test removed its installed fixture. |

The PTY and Native checks provide automated Linux host evidence. The full product matrix and the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are outside this validation. Claude Code removed `subagentStatusLine` in [2.1.323](https://github.com/anthropics/claude-code/releases/tag/v2.1.323). Host capability detection is separate work.
