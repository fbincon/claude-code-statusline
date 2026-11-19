# Task timer lifecycle repair

**English** | [简体中文](task-timer-lifecycle.zh-CN.md)

This 2026-11-19 feature delivery repairs the task timer lifecycle for [issue #223](https://github.com/fbincon/claude-code-statusline/issues/223) only. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Local editor | Mark the matched `/statusline-configure` run ignored before returning the block decision, without ending the previous human task. |
| Agents and completion | Separate active work, expected background reports and delivery. Read queued-command attachments, reconcile ownership and retire stale snapshot-only work. Only new, attributable continuation can resume a completed task. |
| Diagnosis and storage | Report the wait reason, counts and last available ending evidence without writing. Retain the schema-1 mirror, lifecycle v4 and public protocols. |

## Source identities

- Baseline before the task: `1761b38b9015425486f3b7f7cb72ea28aeaef7d4`.
- Implementation and local host candidate: `5ef1a978ffc8e5463c976fbcb1064235c8603600`; identical package SHA-256 from two clean builds: `b5e8bef62cf632d052600385bcd6da55a5940172666d272ed15eba3623fd0233`.
- The final reviewed head, impact receipts and full GitHub Actions matrix identities are recorded in [PR #276](https://github.com/fbincon/claude-code-statusline/pull/276).

## Validation and limits

| Check | Actual result |
| --- | --- |
| Targeted regression and frozen replay | Cover cases A–E, save and cancellation, stale and duplicate events, the 31 ms delivery boundary and read-only diagnostics. All 161 frozen cases pass with the same three wording exceptions; only the named lifecycle comparisons project or validate the new timing evidence. The frozen fixtures and Python archive are unchanged. |
| Local product and documentation checks | Implementation checkout: `npm run check`, documentation checks and source-backed document tests pass. The exact final-head results are in the PR. |
| Installed candidate on Claude Code 2.1.322 (Linux) | With live metrics and native timing enabled in a network-isolated tmux PTY, save changes the fixture and cancellation preserves it. In both cases, the task timer runs while the editor is open. The first completed render after the hook returns hides the timer, at 940 ms for save and 845 ms for cancel. |
| Budgeted mixed-agent probe on the same installation | One synchronous and one background Agent, three allowed sleep calls, a verified background delivery and 67 active running samples. Two final renders 1.308 s apart both show `✓ 0m 48s`, with zero active agents or pending reports. The host reports USD 0.074673 on one attempt; the USD 2 reservation is settled, with no retries or unknown cost against the shared USD 10 authorization. This is not an invoice. |
| Configuration isolation | Twelve tracked real user paths retain their original byte fingerprints, modes, symlink targets or absence. The installed production binding is not changed. |

The real-host checks are automated, not human physical-terminal acceptance. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new automated failures.
