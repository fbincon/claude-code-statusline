# Runtime identity, source timeout and save-conflict repairs

**English** | [简体中文](runtime-source-save-fixes.zh-CN.md)

This record covers the approved v3.16.1 repairs for [#197](https://github.com/fbincon/claude-code-statusline/issues/197), [#195](https://github.com/fbincon/claude-code-statusline/issues/195) and [#196](https://github.com/fbincon/claude-code-statusline/issues/196). Implementation and acceptance are in progress. No final candidate, passing release gate or completed publication is claimed here.

## Behavior and boundaries

| Issue | Defect | Repair contract |
| --- | --- | --- |
| #197 | `turn.start` discarded the agent ID, creating a running main entry beside the completed agent entry; delayed terminal batches could settle main before its agents | Preserve agent-scoped identity independently of main and reconcile pending terminal observations by observed completion time |
| #195 | Deadline expiry removed manual interest before a timeout result could be published | Record a failed timeout and retain execution diagnostics/error observation when manual interest remains; explicit release/cancel and obsolete identities keep their existing boundaries |
| #196 | Explicit-target `profile_conflict` refusals entered unknown-save protection | Share conflict classification with `configuration_conflict`; ordinary Save opens same-target changes review while retaining the draft/history and winning saved bytes |

The fixes use existing runtime, source-job, configuration-transaction and editor boundaries. They do not infer missing token coverage, force-complete old turns, add a provider or grant source execution. Other profile errors retain their existing classification. Ambiguous writes still require the read-only saved-state check; retry never bypasses revision, ownership or recovery checks.

Runtime reconciliation orders retained terminal observations by their observed end time, preserving agent completion before later main wrap-up even when delivered together. Delayed batches do not manufacture monotonic clock evidence; an unprovable active-time interval remains unavailable with its abnormal-clock reason.

Source settlement distinguishes the execution deadline from explicit withdrawal of interest. Already-expired work is not launched and cannot synthesize a command result, exit status or measured duration. A superseded job may retain its own terminal diagnostics but cannot overwrite a newer job's observation.

Display schema 17, editor protocol 31, source registry 3/jobs 4, source observation 1, runtime 3, lifecycle 4, portable/profile 1 and UI preferences 1 retain their formats. Old files remain readable without migration on read. Updating the installed runtime integration requires restarting Claude Code; incomplete historical observations retain their original evidence.

Native retains complete editing state in the host. Props, the enclosing Pane and Client drawing each keep the independent 48,000-character, 10,000-value and depth-16 preflights, including non-ASCII escape expansion. Same-target conflict review uses bounded visible frames and preserves 32×12 operation, paging, selected content, complete graphemes and preview colors. Recovery remains outside a rejected Client tree and keeps saved, pending and unknown outcomes distinct. See [Shared design rules](development-plan.md#shared-design-rules) and [capacity/recovery](native-capacity.md).

## Required acceptance

- Runtime producer/consumer regressions cover no-agent, single-agent, nested and parallel agent turns, main continuation, reordered/replayed observations and missing/ambiguous evidence. Assert one correct lifecycle identity per actual turn and truthful coverage; a numeric token sum alone is insufficient.
- Installed source regressions cover successful commands, 250/1000 ms timeouts against longer commands, waiting and `--no-wait` consumers, explicit cancellation/release, overlapping manual/automatic interest, source edits and late results. Assert terminal state/reason, execution diagnostics, retained observation and terminated work.
- Both-editor regressions cover concurrent explicit user/profile/project targets, immediate conflict review, failed review reads, retained draft/history and winner bytes, reviewed retry/reload/export, plus genuine unknown-save reconciliation and normal close/cancel. Native checks retain capacity fitting and host-only recovery.
- Run generation/checks when canonical generated sources change, `npm run check`, documentation checks and `git diff --check`. Final ready-PR product acceptance retains eight installations, 32 Node cases, sixteen fixed hosts, all 313 existing capacity cases and twelve-language readiness, including 144 UI/output combinations. Main/tag promotion must verify original immutable source and evidence; local diagnostics cannot substitute.

The approved real-session supplement uses installed candidate bytes on the actual interactive Claude host: a no-agent control, one agent and two background agents followed by main wrap-up. Compare observer lifecycle identities and completed prompt totals with independent request/transcript usage, check sequence continuity, and confirm ended timing remains frozen across subsequent renders. Permission/wait/cost availability remains conditional on actual evidence. The historical SDK harness pinned to Claude 2.1.296 does not establish interactive 2.1.314 acceptance.

All paid attempts and retries share this task's USD 10 total authorization: reserve USD 8 for prepublication checks and USD 2 for actual-machine checks, with at most USD 2 per scenario. Reserve a justified worst-case bound before each request and settle verified actual cost. TLS failures or unknown final costs retain conservative reservations; the maintainer authorized continuing without another confirmation only when the gate can guarantee that known costs plus every outstanding reservation and the next request remain within the total budget. Keep raw prompts, responses, settings, captures and budget records in private ignored validation storage. Reports identify source/artifact/host identities and distinguish automated PTYs and agent inspection from human desktop or physical acceptance.

## Publication and actual-machine verification

The [version decision](../releases/approvals/v3.16.1.json) accepts only the same six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96); they remain unverified and do not waive new automated failures. Follow the [release process](../RELEASING.md) after final PR/main/tag gates, reproducible independent/source rebuilds, complete language readiness and four verified delivery files pass. Publish the identical package through npm OIDC and GitHub, verify public downloads/signatures, then synchronize validated explicit Gitee refs and identical attachments.

Rehearse changed journeys before publication with the immutable candidate. After publication, upgrade and exercise the actual test installation and configured statusline, restore original user preferences while retaining the product upgrade, and record actual results separately. If completed publication is followed by a new local product finding, keep v3.16.1 and file an issue; do not publish another patch as part of this task.

Actual source/commit, candidate digest, paid costs, gate URLs, channel verification and restored-machine outcomes will be added only after those operations complete. Existing v3.16.0 and earlier records retain their source identities, results and limitations.

[Release notes](../releases/v3.16.1.md) · [Source behavior](../EXTENSIONS.md) · [Draft conflict review](../DRAFT_HISTORY.md) · [Runtime contract](live.md).
