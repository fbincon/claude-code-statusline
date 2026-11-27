# External editor refresh

**English** | [简体中文](external-editor-live-refresh.zh-CN.md)

This 2026-11-27 feature delivery covers task reports, package and source progress, and list reloads in the external terminal editor. It creates no product version, tag, Release or npm publication. [PR #305](https://github.com/fbincon/claude-code-statusline/pull/305)

## Changes

| Area | Result |
| --- | --- |
| Task reports | Settings and standalone `task view` check running tasks every 2 s and idle or completed tasks every 10 s. A failed read keeps the last report. The refresh key reads immediately, and the Native pane reads on demand. |
| Package and source jobs | The visible page follows the selected job and pauses automatic reads during input or confirmation. After package handoff, the editor queries progress through the original control entry. Reading source progress never starts the provider again. |
| Lists and layout | Profile and source lists reread saved definitions on entry, return or manual reload. Embedded task and version pages use the space normally reserved for the sample preview. |

## Source identities

- The baseline was `6f9bfb981a804468220455ca3622fa17f4baec24`.
- The product implementation is `3ec60959111f42133a4430f437d43935e44f0470`. Commit `9e8ac25cc6367a7a1518ecf6a9026adb04e8d8ca` corrects the installation receipt producer. The reviewed source is `e5a0612c3ea50e592303834f3f73a1031e6f9247`, which also verifies asynchronous process termination. The final PR head adds the delivery record and index entries.
- Reviewed private engineering package SHA-256 `0d013764f0f4c01ffd1ebbe22bc7d37493803f75398fa2c1bb54dd08a7f036eb`. The hosted installation tests used a package built with the public npm name and SHA-256 `4b226c1dbbd9be6d772927dfcf1635c0f67d845cba73249069cef6a451a83fb3`. Both builds used the source archive with SHA-256 `dc4b720227106f6bb2b058d48ecea22eefa7ce00bacf88c5d462eda90d4a7ac0`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Local product | `npm run check` passed 1,930 tests with six platform skips on Linux x64, Node 24.21.0. All 121 generated resources matched. The 37 source-backed documentation and example tests passed. The five new messages passed language validation and acceptance across 12 registered languages. |
| Candidate | Two independent builds produced the same 5,365,161-byte package. Verification covered 1,146 files and four targets. The package, source archive and manifest matched their SHA-256 checksums. All 1,144 members outside the two candidate identity manifests matched the original implementation package in bytes and mode. |
| Report layout | At 64×18, 80×24 and 120×40, the embedded task and package pages gained 3, 5 and 7 content rows respectively. Navigation tests covered resizing, paging and returning to the original Settings selection. |
| Receipt compatibility | The first hosted run rejected installation receipts on Linux, macOS and Windows because the task-viewer summary had an extra field. The corrected producer preserves the five-field summary and records POSIX terminal timings separately. The regression exercises the historical reader for both POSIX and Windows. [First diagnostic run](https://github.com/fbincon/claude-code-statusline/actions/runs/46013680370) |
| Cancellation | The second Windows run observed a still-live version probe in a single sample immediately after closing its supervisor. The revised test checks the original PID and creation identity for confirmed exit within 2.5 s of cancellation. It also detects a probe that keeps doing work. A Linux negative control that removed the abort signal but retained the 5 s timeout failed as expected. [Windows job](https://github.com/fbincon/claude-code-statusline/actions/runs/46016627030/job/140566077410) |
| Hosted platforms | Installation passed on Ubuntu 24.04 x64, macOS 15 Intel and Windows 11 Arm with x64 Node 22.0.0. The Windows runtime passed the version-probe cancellation test. Linux and macOS exercised the two task PTYs. The run also records the Windows language and history jobs and the two pinned Claude hosts. [Final platform diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/46020875921) |
| Installed Linux task viewers | On Node 24.21.0 both PTYs showed completion within 2.165 s and continuation of the same task within 10.001 s without keyboard input. Within 2.016 s of a change to the current prompt, the embedded view followed the new prompt and the fixed view showed the original task as completed. Both restored the terminal, and returning to Settings preserved the selected field and undoable draft. The selected installed case passed, covering 12 languages and 36 report views. |
| Local installation from the hosted package | The complete `installed` stage on Ubuntu 26.04 x64 passed all 26 tests. The historical reader accepted the 25 installation check flags and the five-field task-viewer summary. The separate terminal measurements recorded 2.160 s to completion, 10.016 s to continuation and 2.012 s to switch prompts. |
| Source and package progress | The source ran once and displayed its durable result without input. Package metadata review made one request to a loopback registry and downloaded no package. Both views kept focus. For the reconnect check, a private execution record used a distinct Node path and the retained runner from the earlier implementation commit. The page followed two stages and detached on close. |
| Concurrent list edits | A second CLI renamed a source. The idle list produced no output for 10.3 s, then adopted the new name on explicit reload and on return, preserving the selected ID. Draft binding bytes, file identity, timestamp and mode stayed intact. A concurrent profile rename produced the expected revision conflict and preserved the winning edit. |
| Read and render costs | Three unchanged files with a combined size of 2,243 bytes requested 2,246 bytes of Buffer capacity per task read, down from 100,663,299. In the original installed implementation candidate, ten timer-only updates to a 250,122-byte report with 256 Unicode agent names took 0.36–1.07 ms each to apply. None wrote a screen frame while the 64-column view was scrolled to the end. These measurements cover buffer requests and in-process layout respectively. |
| Actual Claude Code | On Linux, Claude Code 2.1.332 passed isolated installation, repeat installation, doctor, Native protocol save, opt-out and owned-file removal. Its Native task pane held the original running state for 4.2 s after completion was published and showed completion after a manual read. Model calls were zero. |
| Native host tests | All 363 official tests in 46 files passed on Claude Code 2.1.332. TypeScript passed against that host’s exact declarations. The ordinary validator exited 0. The strict validator exited 1 with the same per-file warnings as the baseline (477 TS5097 and one TS2307). |
| Impact routing | The product plan selected the full product checks. The combined Linux scoped job estimated 477 minutes against the 360-minute limit and was not admitted. Local product results and hosted platform diagnostics are recorded separately. |

The timed journeys used isolated task state and a Linux PTY. The reconnect journey used a controlled execution record. Physical acceptance keeps the six previously recorded gaps. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
