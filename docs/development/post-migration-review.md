# Post migration findings and documentation updates

**English** | [简体中文](post-migration-review.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). The four reviews contain **6 TypeScript migration findings, 5 Python baseline defects or shared risks, and 5 categories of conflicting documentation**. Five migration findings were reproduced by execution. The Windows impact of the bridge finding is a static inference that still requires a physical Windows check.

The original consolidation below records pending findings at its baseline. The subsequent [v3.1.3 repair record](post-migration-fixes.md) tracks implementation, validation and release state for R01–R06, B01–B05 and D01–D05. Original priorities and evidence remain unchanged; missing physical/human acceptance is recorded separately.

## Baselines and sources

All four sessions fixed TypeScript at clean `main` commit `1fa57c9ebfbb6ee76a1258939c3211145d55f719` and Python at v2.0.0 commit `9b6d2fab4bf165be280d428a874521bfbf02c7e1`. Repository HEAD was still that TypeScript commit during consolidation. Source line references describe that baseline. Referenced archived Python files were checked byte for byte against the Python commit.

| Source session | ID | Migration findings | Baseline defects or shared risks |
| --- | --- | ---: | ---: |
| [03_审查任务计时和生命周期状态机](codex://threads/01a151a0-b1e0-7950-bebe-3a0470ad7dcf) | `01a151a0-b1e0-7950-bebe-3a0470ad7dcf` | 0 | 2 |
| [04_审查指标采集和原始数据解释](codex://threads/01a151b2-e68d-7da1-af9b-1cae492330f4) | `01a151b2-e68d-7da1-af9b-1cae492330f4` | 1 | 2 |
| [05_审查CLI、外部 TUI、原生编辑器与后端的端到端接线](codex://threads/01a151c0-9757-7fd0-b9e2-dc3925318dae) | `01a151c0-9757-7fd0-b9e2-dc3925318dae` | 2 | 0 |
| [06_发行包和安装生命周期](codex://threads/01a151d7-4bd0-7a41-9c05-2b34f3487193) | `01a151d7-4bd0-7a41-9c05-2b34f3487193` | 3 | 1 |

Counts represent independent finding groups. R03 groups three missing `doctor` checks. R02's PATH command ownership failure and R06's PATH collision warning remain separate because they affect different paths and outcomes. Original experiments and passing test counts are historical session evidence; this consolidation reran none of those reproductions and does not add potentially overlapping test counts.

## TypeScript migration findings

| ID | Priority | Finding and user impact | Evidence | Source |
| --- | --- | --- | --- | --- |
| R01 | P1 | Inconsistent Windows device identifiers can make the external editor bridge reject a valid file, preventing handshake or result reads | Static Windows inference; injected difference reproduced in a Linux package | 06 |
| R02 | P2 | A renderer configured by its PATH command is classified as foreign, blocking editor opening and saving | Execution | 05 |
| R03 | P2 | `doctor` misses damaged skills, an unwritable runtime directory and invalid host fields, incorrectly returning success | Linux installed-package comparison | 06 |
| R04 | P3 | An invalid `prompt_id` type becomes a current-task fallback and borrows another task's state and tokens | Real CLI execution | 04 |
| R05 | P3 | Combining `--language` with `--version` changes success to exit 2, breaking version detection | Real CLI execution | 05 |
| R06 | P3 | `doctor` reports a PATH collision for a healthy npm installation | HEAD package and public npm 3.1.2 package execution | 06 |

### R01 Windows external editor bridge rejects valid files

- **Trigger and difference:** The original review identifies Windows/Node 24.0.0 conditions in which path statistics can return `dev=0` while handle statistics return a nonzero volume identifier. TS compares them directly and can classify the same file as replaced. Python uses CPython file identity checks. Injecting the difference into a Linux installed package consistently produced `Invocation file changed while opening`.
- **Location:** TS [bridge.ts:67](../../packages/platform/src/terminal/bridge.ts#L67); Python [bridge.py:296](../../archive/python/src/claude_statusline/integration/bridge.py#L296). See the existing [Windows statistics compatibility record](node-regional-languages.md). The exact affected Windows patch versions and volume conditions remain undetermined.
- **Coverage gap and minimum regression:** Windows package tests start `configure` directly rather than exercising request/started/result bridging. On real Windows and Node 24.0.0, start and cancel the editor through its installed external entry and verify handshake and result reads. Keep a control that rejects actual file replacement. Linux injection is not physical Windows acceptance.

### R02 PATH renderer configuration blocks editing and saving

- **Trigger and difference:** Set `statusLine.command = "claude-statusline render"` in `settings.json`, with PATH selecting the current Node/JS installation. Python reports `installed: true`, reads the host fields correctly, and supports opening, saving and reopening. TS renders successfully but reports `installed: false` and default host values. The external TUI exits 2, saves fail with `ownership_mismatch`, and old disk values remain. The subagent renderer has the same failure; the native editor shares the backend rejection.
- **Location:** TS [commands.ts:96](../../packages/platform/src/commands.ts#L96), [host.ts:30](../../packages/cli/src/config/host.ts#L30); Python [ownership.py:128](../../archive/python/src/claude_statusline/integration/ownership.py#L128). TS rejects the argument count for its Node/JS prefix before reaching canonical PATH compatibility. The [shared contract](contracts.md) still promises that compatibility.
- **Coverage gap and minimum regression:** Ownership tests use a legacy binding with empty `args`; actual CLI tests configure the complete Node/JS command. Cover the missing combination through a real PATH entry: read host fields, open the editor, save and reopen. Retain rejection of a different absolute installation path.

### R03 Doctor returns success for unusable installations

Each condition below was introduced separately into healthy installations and compared by execution:

| Condition | Python | TypeScript |
| --- | --- | --- |
| Damaged skill body with a valid ownership marker | Exit 1 | Exit 0 and skill OK |
| Readable `statusline_runtime` that the current user cannot write | Exit 1 and an unwritable-directory diagnosis | Exit 0 |
| Invalid host fields, such as `padding=true` or `refreshInterval=0` | Exit 1 | Exit 0 and statusline owned |

- **Impact and location:** Diagnostics can miss a damaged configuration skill, an installation unable to persist runtime state and invalid host settings. TS [doctor.ts:64](../../packages/cli/src/integration/doctor.ts#L64) checks command ownership, [doctor.ts:88](../../packages/cli/src/integration/doctor.ts#L88) checks skill existence and markers, and the corresponding runtime-directory write check is absent. Python checks are at [doctor.py:192](../../archive/python/src/claude_statusline/integration/doctor.py#L192), [243](../../archive/python/src/claude_statusline/integration/doctor.py#L243) and [668](../../archive/python/src/claude_statusline/integration/doctor.py#L668).
- **Coverage gap and minimum regression:** Existing tests cover absent skills, damaged display configuration and feature-file permissions, not these three states. Assert exit 1, an accurate reason and unchanged configuration for each. The write-permission case needs actual current-user permission conditions.
- **Documentation:** D05. Close the implementation and diagnostic-description gap together; deleting the documented promise alone does not restore the missing checks.

### R04 Invalid prompt IDs borrow current task metrics

- **Trigger and difference:** Enable advanced collection. Current task `p` has input 2, cache creation 3, cache reads 5 and output 7. With `prompt_id:42`, Python renders `State — · Prompt in — · Prompt out —`; TS renders `State completed · Prompt in 10 · Prompt out 7`. The `10=2+3+5` belongs to task `p`, but the invalid ID does not establish ownership. Nonempty objects and arrays also reproduce it. Valid strings, unknown strings and `null` retain matching behavior. Whether a real host sends these invalid types is unconfirmed.
- **Location:** TS [environment.ts:77](../../packages/cli/src/rendering/environment.ts#L77) converts invalid values to `null`, then [snapshot.ts:17](../../packages/core/src/runtime/live/snapshot.ts#L17) selects the current task. Python retains the original value at [items.py:229](../../archive/python/src/claude_statusline/rendering/items.py#L229) and selects at [snapshot.py:63](../../archive/python/src/claude_statusline/runtime/live/snapshot.py#L63).
- **Coverage gap and minimum regression:** Existing live tests pass strings or `null` directly to the parser, bypassing rendering-environment conversion. Send numbers, objects and arrays through the complete `render` path and assert that current-task metrics are not borrowed. Keep valid and absent-ID controls.

### R05 Language options break version queries

- **Trigger and difference:** Run `claude-statusline --language en --version` or `claude-statusline --language=en --version`. Python prints the version to stdout, leaves stderr empty and exits 0. TS leaves stdout empty, writes `unknown command: --version` to stderr and exits 2. Scripts that consistently add a language option can no longer query the version.
- **Location:** TS [main.ts:31](../../packages/cli/src/main.ts#L31), [main.ts:99](../../packages/cli/src/main.ts#L99) handle only standalone `--version` early and do not handle it again after removing language options. Python [cli.py:34](../../archive/python/src/claude_statusline/cli.py#L34) uses a global version action.
- **Coverage gap and minimum regression:** [Existing version tests](../../packages/cli/test/final-cli.test.ts#L5) cover only the standalone option. Add separated and equals-form language options combined with version, checking exit status and both streams. Approved human-readable CLI wording differences do not cover this exit-status change.

### R06 Healthy npm entries produce a false PATH warning

- **Trigger and difference:** Put the npm global command directory first in PATH, install through that command and run `doctor`. TS reports `PATH selects another entry` while naming the same entry just invoked; exit status remains 0. Python reports a healthy executable correctly. Both the HEAD package and public npm 3.1.2 package reproduced the warning.
- **Location:** TS [doctor.ts:23](../../packages/cli/src/integration/doctor.ts#L23) compares the PATH command with internal JS arguments. The [outer npm bin](../../tools/build/pack.ts#L65) and [internal entry.js binding](../../packages/cli/src/main.ts#L107) are different files by design. Python comparison: [doctor.py:155](../../archive/python/src/claude_statusline/integration/doctor.py#L155).
- **Coverage gap and minimum regression:** Package acceptance mainly calls `node entry.js` without placing the npm command directory in PATH. Test PATH selecting the current npm entry and selecting a separate retained Python entry: only the latter should produce the appropriate collision warning. This warning and R02's save rejection need separate assertions.

## Python baseline defects and shared risks

These five findings were also pending at the review baseline, with their existing classification retained rather than being called new migration regressions. Their current repair and delivery state is recorded in the [v3.1.3 follow-up](post-migration-fixes.md).

| ID | Original priority | Finding and user impact | Source |
| --- | --- | --- | --- |
| B01 | P2 | A forward wall-clock change during a wait understates active execution and marks the result complete | 03 |
| B02 | P2 | A missing `turn_start` becomes an exact zero execution time instead of unknown | 03 |
| B03 | P2 | Replacing a transcript with a larger file at the same path retains the old cursor and skips tokens | 04 |
| B04 | P2 | Message-ID compaction discards deduplication identity, allowing replay to count tokens twice | 04 |
| B05 | Unrated | A preexisting symlink at the backup root allows snapshots outside the configuration directory before rejection | 06 |

### B01 Forward wall time understates active execution

Explicitly enable native timing, retain the same boot and continuous event sequence, and declare `wait_coverage=true` at completion. Times are seconds:

| Event | Wall time | Actual boot time |
| --- | ---: | ---: |
| Submit task | 1 | 1 |
| Native turn starts | 2 | 2 |
| Wait starts | 3 | 3 |
| Wait ends after a 10-second forward wall adjustment | 16 | 6 |
| Turn completes | 30 | 20 |

Both implementations infer a false `boot=16` at wait end, freeze and render `Active 0m 05s`, and persist `active_coverage="complete"` with `reason=null`. Trusted boundaries imply `(3−2)+(20−6)=15` seconds of active execution. Total task time remains `20−1=19` seconds, and the reported native 1,500 ms remains independent.

Locations: TS [tasks/native.ts:9](../../packages/core/src/runtime/tasks/native.ts#L9), Python [tasks/native.py:11](../../archive/python/src/claude_statusline/runtime/tasks/native.py#L11). Wait sampling reaches the `starting=true` branch and constructs boot time using a wall offset. Existing tests usually advance both clocks together or supply correct boot samples directly. Cover the production wait adapter, storage, reload and CLI rendering. Expect 15 seconds when supported by trusted samples; insufficient evidence must not produce a trusted 5 seconds.

### B02 Missing execution start becomes zero

Use `heartbeat(seq=0,t=0)` → `prompt(seq=1,t=1)` → `turn_end(seq=2,t=9,duration_ms=1500,wait_coverage=true)`, without `turn_start`. Both implementations create a turn at its ending event, set start and end to 9 seconds, persist `active_coverage="complete"` and `frozen_ns=0`, and render `Active 0m 00s`. Total task time of 8 seconds and native duration of 1,500 ms remain correct.

Locations: TS [live/reducer.ts:113](../../packages/core/src/runtime/live/reducer.ts#L113), [tasks/native.ts:92](../../packages/core/src/runtime/tasks/native.ts#L92); Python [live/reducer.py:162](../../archive/python/src/claude_statusline/runtime/live/reducer.py#L162), [tasks/native.py:143](../../archive/python/src/claude_statusline/runtime/tasks/native.py#L143). Existing tests usually provide a start and focus missing-event checks on sequence gaps or waits. Continuous sequence numbers do not prove that execution start was observed. Assert an unavailable reason through persistence, reload and rendering; do not invent a start from zero or the native duration.

B01 and B02 conflict with the [task timing contract](timer.md) requiring unavailable or degraded results when evidence is insufficient. Keep them as implementation defects rather than changing metric definitions to fit them.

### B03 Larger transcript replacement skips tokens

Without an authoritative `cost-state` snapshot, first read message A with one input token. Atomically replace the same path with a larger file containing equal-length records B=2 and C=3. Both implementations continue from the old byte cursor, skip B and render `in 4`; another render still shows 4. Distinct message identities imply `1+2+3=6`.

Locations: TS [CLI usage.ts:106](../../packages/cli/src/runtime/usage.ts#L106), Python [usage.py:325](../../archive/python/src/claude_statusline/runtime/usage.py#L325). UsageCollector does not identify this replacement by file identity. Partial-line, shorter-rewrite and separate SubmissionIndex tests do not cover it. The minimum regression is the A→B/C sequence with totals and repeated rendering both remaining 6.

### B04 Replaying compacted messages double counts tokens

Without a `cost-state` snapshot, read 5,001 distinct messages with one input token each, trigger ID compaction, then append the first message's identical record. Both implementations change `in 5001` to `in 5002`; without new consumption, the total should remain 5,001.

Locations: TS [core usage.ts:232](../../packages/core/src/runtime/usage.ts#L232), Python [usage.py:428](../../archive/python/src/claude_statusline/runtime/usage.py#L428). Moving old contributions into `base` also removes their deduplication identities. The [existing compaction test](../../packages/cli/test/usage.test.ts#L151) uses zero values and deletes the transcript without replaying a compacted ID. Use positive values and assert unchanged raw and rendered totals after replay.

### B05 Backup root symlinks allow writes before rejection

Before installing, point `backups/statusline` to an isolated directory outside the configuration directory. Both implementations first write `.before`, `.absent` and `metadata.json` into the target. Python completes installation. TS later rejects the symlink and exits 2, but the external snapshots remain. Execution confirmed the shared risk; the original review assigned no priority.

Locations: TS [storage.ts:68](../../packages/cli/src/config/storage.ts#L68) and subsequent [transaction path validation](../../packages/cli/src/recovery/files.ts#L100); Python [storage.py:50](../../archive/python/src/claude_statusline/config/storage.py#L50). Existing symlink tests mainly replace snapshots during recovery. Set the symlink before installation and assert that rejection leaves no new files in its target.

## Existing documentation updates

These five categories were explicitly identified in the sessions and remained locatable during consolidation. Check English and Chinese together. Correct current guidance while retaining history that has an explicit version context.

| ID | Files to update | Current conflict | Required correction |
| --- | --- | --- | --- |
| D01 | [DISPLAY_ITEMS.md](../DISPLAY_ITEMS.md), [Chinese](../DISPLAY_ITEMS.zh-CN.md); approximately English L101–116 and Chinese L93–105 | Calls display schema v5/configuration protocol v4 current and retains old migration guidance | Align current schema v8/protocol v12 and read/save/downgrade guidance with the [shared contract](contracts.md); retain independently versioned runtime and other formats |
| D02 | [native.md](native.md), [Chinese](native.zh-CN.md); approximately L57 | Claims adjacent visible items can be reordered while filtered | State that search/category filters disable reordering until cleared, matching both implementations and the user guide |
| D03 | [native.md](native.md), [Chinese](native.zh-CN.md); approximately L19–23 and L87 | Current development steps still use `.venv/bin/python tools/prepare_mod_types.py`, a `.venv` backend and `tools/native_mod_acceptance.py` | Check each step against current [development entry points](README.md), update Node/npm, Mod type preparation, backend bindings and acceptance commands, and label historical Python instructions |
| D04 | [USER_GUIDE.md](../USER_GUIDE.md) approximately L793, [Chinese](../USER_GUIDE.zh-CN.md) approximately L767 | Windows troubleshooting still requires a `windows-curses backend` diagnostic | Match the current Node raw TTY implementation and real diagnostic output; remove obsolete diagnostic names without inventing replacement OK rows |
| D05 | [USER_GUIDE.md](../USER_GUIDE.md) approximately L701 and its [Chinese Doctor section](../USER_GUIDE.zh-CN.md) | English promises `writable state` checks; Chinese broadly lists state-directory checks, while R03 confirms missing runtime writability and other validation | Coordinate with R03: describe restored checks after repair; before repair, identify diagnostic gaps without claiming that a successful result verifies these conditions |

The following known-issue explanations also need to remain consistent before and after repairs. These are additional documentation tasks proposed by this consolidation, outside the five explicitly reported conflict categories:

- [Task timing](timer.md) and [live metrics](live.md): connect B01/B02 to inaccurate active execution at known boundaries. Preserve separate definitions for total task time, active execution and native reported duration.
- [Metric definitions](../DISPLAY_ITEMS.md) and live metrics: connect B03/B04/R04 to rotation and replay without authoritative snapshots, and to invalid ownership. Unknown observations must not become true zero values or current-task data.
- [User guide](../USER_GUIDE.md), [CLI reference](../reference/cli.md) and native integration: connect R01/R02/R03/R05/R06/B05 to real entry points, diagnostic coverage, permissions and backup boundaries. Keep inferred Windows impact separate from physical results.
- Update the Chinese counterparts too. Close each finding with its repair commit and corresponding validation evidence before changing its status.

## Classification boundaries and remaining questions

- **Approved differences are excluded:** Node/npm distribution and retirement of Python entry points; the current Node 22/24 and architecture boundaries; absolute Node/JS argv bindings; protocol 12, six languages and `zh-Hant → zh-TW` compatibility; Windows boot identity v2; native timing defaulting off while explicit preferences remain preserved. Historical decisions remain in the [migration record](typescript-migration.md) and its linked records.
- **Other existing limitations:** Append-only text editing and search-length/grapheme limitations already appear in the [external TUI regression record](external-tui-regressions.md). They are not counted again as new findings. Its six repaired v3.1.2 external TUI regressions are also excluded from this pending list.
- **Timing question:** In a synthetic out-of-order stream, a subagent `turn_start` arriving after task completion clears the active-time frozen value and returns `incomplete` in both implementations. A real host sequence is needed to establish whether this can happen and whether it represents permitted resumed activity. It is outside the 11 confirmed finding groups.
- **Platform and human evidence:** R01 requires a real Windows external-entry test. The four sessions did not collectively establish physical results for every Windows file-lock/reparse replacement condition, macOS Terminal.app, GNOME desktop launch, WSL, actual sleep/reboot/clock adjustment or native pane focus. Isolated adapters, Linux PTYs and automated passes cannot establish those results.

## Organizing follow up repairs

D01–D04 can be corrected independently; coordinate D05 with R03. Queue implementation work by the original priorities above. R01 also needs Windows evidence, while B05 needs an impact assessment before assigning a priority. Related cases can share validation setup while retaining distinct assertions: R02/R06 for real PATH entries, R03/B05 for installation and file boundaries, B01/B02 for timing trust, and B03/B04 for incremental usage accounting.

Close each item with its minimum trigger, repair commit and validation result. Keep unverified platform conditions separate. This list does not automatically change historical TS-01–TS-06 DONE, D06 FAIL or PERF-01 NOT_STARTED states.
