# Editor, source and diagnosis correctness

**English** | [简体中文](correctness-maintenance.zh-CN.md)

FIX-01, FIX-02, FIX-03, FIX-04 and I18N-01 started from main `43487131476018c1f21857623ec9db8f015e01f5`. They are implemented for v3.9.2 and undergoing candidate validation. Publication and source-bound channel evidence are recorded separately below; a local check is not a release gate.

## Shared draft protection — FIX-01

The shared Editor retains the submitted draft, revision, target and installation identity. Its pending/unknown state guards display mutations in forms, composition, sources, profiles, import and Quick setup. Managers already open before an unresolved save use the same guard. Asynchronous source/profile responses must still match the mutation generation before changing the draft or its baseline.

Native recovery keeps its existing read-only saved-state check. The external TUI adds Ctrl+K while the outcome is unknown. A read distinguishes the submitted configuration being saved, no commit, conflict and a still-unavailable result. It never submits another apply. Confirmed results unlock editing; conflict retains the draft and old baseline. Interruption restores the terminal and reports an unresolved outcome instead of claiming that nothing changed. Read-only source inspection remains available. Display Save, independent source authorization and host Apply keep separate transactions.

## Indicator composition — FIX-02

Core composes the bar, owned label, icon and localized percentage/direction before styling. Legacy bar output stays compatible; hidden, short and custom labels occur once. Both scopes share this path. Numeric defaults, thresholds, rounding, zero/missing semantics, graphemes and width omission remain unchanged. Adaptive bars are still APPEARANCE-07 work.

## Execution and consumer lifecycle — FIX-03

GitHub jobs coalesce only for the same refresh identity. Jobs v3 retain immutable origin `owner`/`trigger` and persist manual `consumers: [{owner,expires_at}]`; each expires at the original job deadline. Joining twice with one owner is idempotent. Applicable automatic policy/session leases supply automatic interest independently of origin. Automatic scheduling still requires separate approval and an active session.

Editor close and CLI interruption release only that consumer. `source_release {id,owner}` is idempotent; the last release cancels an execution only when no applicable automatic interest remains. `source cancel` explicitly cancels the entire execution. Automatic disablement/lease expiry preserves manual consumers; source edit/disable/removal invalidates old work. Process cancellation and final revision/context/authentication checks prevent late publication. `--no-wait` retains its bounded interest after returning. Command sources retain their single-running-job restriction.

Closing a source manager also covers in-flight requests: a delayed context response cannot start a refresh, and a delayed refresh response releases the departed owner immediately. Reopening a manager does not adopt the earlier request.

Jobs v1/v2 are normalized on read without rewriting bytes. A running legacy job cannot be joined or taken over by the new generation; it may complete, expire or be explicitly cancelled. Display schema 15, source registry 2, observation 1, runtime 3 and UI preferences 1 are unchanged. Editor protocol 25 requires matching frontend/backend resources.

## Historical extension evidence — FIX-04

Historical diagnosis filters both current and last-good observations before choosing values, evaluates TTL at input time and excludes later values and supporting fields. Untimestamped values cannot establish historical applicability. Their time remains unknown, and they do not enter historical output. Ordinary live rendering retains its unknown-freshness behavior.

Evidence accumulates once per component-instance/agent pair. Values shared by several agents or component copies no longer overwrite evidence. Diagnosis does not execute Git to discover today's identity for an old input; unavailable repository/input associations stay unavailable. Input-only mode never reads extension sources. Input time, diagnosis time and observation time remain separate, and reads do not publish/prune caches.

## Task language — I18N-01

UI preferences are resolved before task command descriptions and the first pane title. Task reads cannot discard a successfully loaded language. Refresh/reopen rereads preferences, checks command ownership and ignores late generations. Failed preference reads use English with guidance; task reads still proceed. Task errors retain semantic localization, with external details kept as details.

The plain task Pane also preflights its complete output against the existing native budgets, reducing visible height and then width when required. It retains the full report and uses the accepted page capacity for navigation. Wrapped lines are cached only for the same report, language and width, so height reduction and paging do not repeatedly wrap a large report. Refresh and language changes invalidate that presentation cache. This does not change task attribution, timing or the version-1 task read model.

## Validation and delivery

Focused checks cover six-language indicator content, historical/unknown/partial/zero evidence, all agents and copies, both editors' save reconciliation and late manager responses, consumer overlap and old-job interpretation. Real detached workers and a CLI signal exercise release and child termination; Windows uses an IPC-delivered signal event because native `kill()` force-terminates Node there. Frozen reference adaptation permits exactly the current canonical operation list; the Python archive and original three wording exceptions are unchanged.

Candidate validation retains the existing eight installations, 32 Node runtime cases, sixteen fixed hosts and 197 native capacity cases, plus applicable installed terminal journeys. Raw attempts remain in ignored validation storage. No paid model tests or new human desktop/power acceptance are performed. Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted and remain unverified.

Publication is pending. See [v3.9.2 notes](../releases/v3.9.2.md), the [version-specific approval](../releases/approvals/v3.9.2.json), [CI evidence policy](ci-maintenance.md) and [release procedure](../RELEASING.md).
