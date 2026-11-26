# Runtime prompt ownership and status delivery

**English** | [简体中文](runtime-prompt-ownership.zh-CN.md)

This 2026-11-27 feature delivery repairs task timing and live prompt ownership in the main status line. A single human message now has one task identity across transcript and native events, and the footer can recover its current phase when a live snapshot is late. This delivery creates no product version, tag, Release or npm publication. [Issue #297](https://github.com/fbincon/claude-code-statusline/issues/297) · [Issue #299](https://github.com/fbincon/claude-code-statusline/issues/299)

## Changes

| Area | Result |
| --- | --- |
| Task identity | Explicit `promptId` and message `uuid` from the same human transcript row restore one task. Legacy rescans preserve accepted terminal times. A read-only timer fallback can select an independently verified newer task when a superseded record cannot be repaired from a transcript. |
| Current state | The footer scans lifecycle evidence before selecting a live snapshot, including when State and Tool are the only configured items. It displays the verified current task phase while native data catches up, and the latest tool with confirmed ownership. Idle display preserves attributed terminal history. |
| Runtime Mod | Prompt, turn and tool events wake the bounded writer. Batch acknowledgements drain pending events serially. Failures retain the original identities for retry, and session rebinding isolates late results. |
| Documentation | The English and Chinese display, timing and live-observation guides describe the new evidence and the idle behavior. |

## Source identities

- Baseline `f134398fd43898dff9f50a039b49f5c386b36fa0`, installed product 3.16.5.
- Implementation and engineering candidate source `a17e7e304c9a99bfd5c08fa3702aded7225bf967`.
- Candidate `0.0.0-ts05.ga17e7e304c9a` SHA-256 `e8a61bff938122494810bda1b37b3cf1c649425b4fe7345b6984e8741fce7ecd`.
- Source archive SHA-256 `1c8dea10f99d465561b0ae76b590fcd75d5aa71bc80b67bda642ed6a9c24d289`.
- The PR records the final reviewed head and its documentation checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed on the implementation commit with 1,860 tests passed and six skips. Actions, generated resources, archive integrity and the responsibility inventories passed. |
| Runtime regressions and frozen comparison | Passed the legacy 156 ms case with both IDs and no ID, explicit alias repair, current-task fallback, queued and unowned turns, live-only rendering, and retry after a task-store write failure. The frozen runtime action traces matched. |
| Documentation | `docs:check`, whitespace checks and all 37 source-backed content and example tests passed. |
| Candidate build and installation | Independent builds produced byte-identical packages. `candidate:verify` passed, and the verified artifact installed in a temporary npm prefix. Official installed smoke passed on Claude Code 2.1.310 and 2.1.330. |
| Host validation | The Linux impact tasks passed on 2.1.289, 2.1.294, 2.1.296 and 2.1.310, with 20 Runtime Mod tests per host. Exact 2.1.296 declarations remain unavailable. On 2.1.330, normal validation, all 20 official Runtime Mod tests and the generated exact-build declarations typecheck passed. Strict validation reports the same pre-existing TypeScript-extension warnings on 3.16.5 and the candidate. |
| Claude Code 2.1.330 terminal comparison | Each of the two isolated terminal runs used four controlled loopback responses. The host skipped the Mod's classic and telemetry hooks in both runs. The baseline showed unavailable State and Tool for both active prompts despite stored native tools. The candidate showed `State main` and `Bash started` on the first prompt. The second prompt began with `Tool —` and then showed `Read success`. After exit and `--resume`, the candidate displayed `✓ 0m 06s`, `State completed` and `Tool Read success` on both captured idle frames. |
| Paid Claude Code probe and configuration | One isolated Haiku request passed with a CLI estimate of USD 0.014045 and no outstanding reservation. The configured footer rendered `✓ 0m 02s` and `State completed`. After the probes, the original `settings.json`, display configuration and runtime preferences matched their starting file digests and modes. |

The run covers Linux x64 with Node 24.21.0. Deterministic regressions cover the minute-scale publication delay in #299 and the short duplicate turn in #297. The local terminal sessions confirm the skipped hooks and the observed footer results. The original delay remains unreproduced on this host. Physical desktop and power acceptance remain pending, including the six previously accepted gaps. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
