# Editor, source and diagnosis correctness

**English** | [简体中文](correctness-maintenance.zh-CN.md)

FIX-01, FIX-02, FIX-03, FIX-04 and I18N-01 started from main `43487131476018c1f21857623ec9db8f015e01f5`. They are accepted and published in v3.9.2. Publication and source-bound channel evidence are recorded separately below; a local check is not a release gate.

## Shared draft protection — FIX-01

The shared Editor retains the submitted draft, revision, target and installation identity. Its pending/unknown state guards display mutations in forms, composition, sources, profiles, import and Quick setup. Managers already open before an unresolved save use the same guard. Asynchronous source/profile responses must still match the mutation generation before changing the draft or its baseline.

Native recovery keeps its existing read-only saved-state check. The external TUI adds Ctrl+K while the outcome is unknown. A read distinguishes the submitted configuration being saved, no commit, conflict and a still-unavailable result. It never submits another apply. Confirmed results unlock editing; conflict retains the draft and old baseline. Interruption restores the terminal and reports an unresolved outcome instead of claiming that nothing changed. Read-only source inspection remains available. Display Save, independent source authorization and host Apply keep separate transactions.

## Indicator composition — FIX-02

Core composes the bar, owned label, icon and localized percentage/direction before styling. Legacy bar output stays compatible; hidden, short and custom labels occur once. Both scopes share this path. Numeric defaults, thresholds, rounding, zero/missing semantics, graphemes and width omission remain unchanged. Adaptive bars are still APPEARANCE-07 work.

## Execution and consumer lifecycle — FIX-03

GitHub jobs coalesce only for the same refresh identity. Jobs v3 retain immutable origin `owner`/`trigger` and persist manual `consumers: [{owner,expires_at}]`; each expires at the original job deadline. Joining twice with one owner is idempotent. Applicable automatic policy/session leases supply automatic interest independently of origin. Automatic scheduling still requires separate approval and an active session.

Editor close and CLI interruption release only that consumer. `source_release {id,owner}` is idempotent; the last release cancels an execution only when no applicable automatic interest remains. `source cancel` explicitly cancels the entire execution. Automatic disablement/lease expiry preserves manual consumers; source edit/disable/removal invalidates old work. Process cancellation and final revision/context/authentication checks prevent late publication. `--no-wait` retains its bounded interest after returning. Command sources retain their single-running-job restriction.

Closing a source manager also covers in-flight requests: a delayed context response cannot start a refresh, and a delayed refresh response releases the departed owner immediately. Reopening a manager does not adopt the earlier request. A native close refused because of an unresolved save retains the manager's consumers.

Jobs v1/v2 are normalized on read without rewriting bytes. A running legacy job cannot be joined or taken over by the new generation; it may complete, expire or be explicitly cancelled. Display schema 15, source registry 2, observation 1, runtime 3 and UI preferences 1 are unchanged. Editor protocol 25 requires matching frontend/backend resources.

## Historical extension evidence — FIX-04

Historical diagnosis filters both current and last-good observations before choosing values, evaluates TTL at input time and excludes later values and supporting fields. Untimestamped values cannot establish historical applicability. Their time remains unknown, and they do not enter historical output. Ordinary live rendering retains its unknown-freshness behavior.

Evidence accumulates once per component-instance/agent pair. Values shared by several agents or component copies no longer overwrite evidence. Diagnosis does not execute Git to discover today's identity for an old input; unavailable repository/input associations stay unavailable. Input-only mode never reads extension sources. Input time, diagnosis time and observation time remain separate, and reads do not publish/prune caches.

## Task language — I18N-01

UI preferences are resolved before task command descriptions and the first pane title. Task reads cannot discard a successfully loaded language. Refresh/reopen rereads preferences, checks command ownership and ignores late generations. Failed preference reads use English with guidance; task reads still proceed. Task errors retain semantic localization, with external details kept as details.

The plain task Pane also preflights its complete output against the existing native budgets, reducing visible height and then width when required. It retains the full report and uses the accepted page capacity for navigation. Wrapped lines are cached only for the same report, language and width, so height reduction and paging do not repeatedly wrap a large report. Refresh and language changes invalidate that presentation cache. This does not change task attribution, timing or the version-1 task read model.

## Validation and delivery

Focused checks cover six-language indicator content, historical/unknown/partial/zero evidence, all agents and copies, both editors' save reconciliation and late manager responses, consumer overlap and old-job interpretation. Real detached workers and a CLI signal exercise release and child termination; Windows uses an IPC-delivered signal event because native `kill()` force-terminates Node there. Waiting CLI signals are registered before consumer creation. A deterministic immediate signal during registration also verifies that the new consumer is released when the start call returns. Frozen reference adaptation permits exactly the current canonical operation list; the Python archive and original three wording exceptions are unchanged.

Candidate validation retains the existing eight installations, 32 Node runtime cases, sixteen fixed hosts and 197 native capacity cases, plus applicable installed terminal journeys. Raw attempts remain in ignored validation storage. No paid model tests or new human desktop/power acceptance are performed. Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted and remain unverified.

Implementation and channel acceptance are complete. See [v3.9.2 notes](../releases/v3.9.2.md), the [version-specific approval](../releases/approvals/v3.9.2.json), [CI evidence policy](ci-maintenance.md) and [release procedure](../RELEASING.md).

## Final stable delivery

Completed on 2026-10-28 (Asia/Shanghai). [PR #166](https://github.com/fbincon/claude-code-statusline/pull/166) delivered the five repairs from main `43487131476018c1f21857623ec9db8f015e01f5`. Accepted release source is [`c25e3a39e7b5fdf315d0eec68d16b5336837cbaa`](https://github.com/fbincon/claude-code-statusline/commit/c25e3a39e7b5fdf315d0eec68d16b5336837cbaa); its equal-tree merge is `4d1fa2ed42b4d4a600bfa56bccae5340245aeec1`. The annotated `v3.9.2` tag has object `9c66dc651dc2fe5f65b0c4614894ebc296d80e2b` and points to the accepted PR source, reachable through that merge.

| Gate | Final result |
| --- | --- |
| [Final PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40571508835) | Attempt 1 passed: 60 successful jobs, six non-applicable diagnostic/draft jobs skipped; Complete candidate evidence passed |
| [Merged main](https://github.com/fbincon/claude-code-statusline/actions/runs/40578011705) | Attempt 1 passed full acceptance, shadow promotion and three-platform integration smokes (64 successful jobs, four non-applicable skips) |
| [Annotated tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40583997603) | Attempt 1 passed source-bound promotion and Complete candidate evidence (three successful jobs, ten non-applicable execution branches skipped) |
| Stable readiness | Eight installation targets, 32 Node cases, sixteen fixed hosts and 197 native capacity cases bound to the original source and package |
| [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/40584508954) | Exact tag, main/tag gates, original artifacts, approval and registry checks passed |
| [npm publication](https://github.com/fbincon/claude-code-statusline/actions/runs/40584822657) | Attempt 1 published a new version with OIDC and verified registry bytes/selectors |
| [Public downloads](https://github.com/fbincon/claude-code-statusline/actions/runs/40585511195) | Six Linux/Windows/macOS × Node 22.23.4/24.22.1 jobs passed, including twelve exact-version/latest installations |

Registering the version-specific approval changed the acceptance-policy digest. Main therefore ran complete acceptance and shadow promotion, including three real platform installation smokes. Promotion verified merge parents, PR head/base, tree/policy and original receipt/artifact digests. The tag and npm followed that verified chain to original PR artifact `12764209606`; no main receipt or rebuilt package was relabelled as the PR source. Original artifact ZIP SHA-256 is `4e828f1477fe0813c2cde326613a17eedbc350dfe76aeafca3901cfc3acbc3c8`.

| Package | Accepted regression evidence |
| --- | --- |
| FIX-01 | Both editors freeze pending/unknown display mutations, including already-open managers and late responses. Saved, not-committed, conflict and unavailable reads preserve drafts and submit once. Four installed external save-reply-loss PTYs exercised read-only Ctrl+K and resumed editing. |
| FIX-02 | All six languages cover both scopes, four label modes, icons, thresholds, zero/missing values, ANSI resets and complete graphemes; content and 40/80/120-cell budgets are checked together. |
| FIX-03 | Independent editors/CLI and automatic interest share one execution. Release, last interest, cancel, policy/lease expiry and source changes have separate assertions. Real detached workers and child processes reject late publication; ten repeated immediate/real signal regressions passed. |
| FIX-04 | Earlier/equal/later/unknown times, TTL boundaries, partial/zero data, auxiliary fields and every component-instance/agent pair are checked against rendered and JSON evidence. Input-only and diagnosis file-preservation assertions passed. |
| I18N-01 | All six first-open/failure/retry/reopen languages check actual command descriptions, titles, controls and guidance. Preference failure uses English guidance; task failure preserves the loaded preference. Large task reports retain full data and bounded presentation. |

Final local `npm run check` passed 1,294 tests with six platform-specific skips. Generation, the 63-resource verification, documentation links and whitespace checks passed. Both official Mod suites, 153 native product tests, available exact Claude 2.1.310 declarations, all 197 actual-host capacity cases and 23 installed categories passed. The final installed package also passed seventeen native/external PTY journeys, four save-recovery PTYs, 792 light/dark six-language captures and four monochrome controls. Terminal/configuration restoration assertions passed. Five native and four external terminal-cell reconstructions were inspected by the agent; these are not OS screenshots or human desktop acceptance.

Earlier candidate CI exposed repeated wrapping in a large task pane ([run 40566004274](https://github.com/fbincon/claude-code-statusline/actions/runs/40566004274)) and a real macOS signal arriving before consumer registration completed ([run 40568823995](https://github.com/fbincon/claude-code-statusline/actions/runs/40568823995)). Caching presentation for the same report/language/width and registering signals before starting the consumer fixed them. Assertions and deadlines were retained. The final accepted source passed the required matrix; earlier attempts remain recorded and are not counted as passes.

Two independent builds, two delivered-source rebuilds, the original CI bundle, downloaded GitHub draft files and anonymous GitHub/Gitee downloads matched all four files:

| Delivery file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.2.tgz` | `659091fa5068bdb5060e6bddd8c1b9e8b36f1eace6f7fcc3955d61f0a8e528e1` |
| `claude-code-statusline-3.9.2-source.tar.gz` | `74e05bc27c03da46e632aa9313a8c7487d04fcb5c37fb33bac5bb62de7387856` |
| `build-manifest.json` | `f0e12f7e1cae30d465e9cc9129b378fc31645a07d87982bb1d913532e27e4884` |
| `SHA256SUMS` | `b80a0f7cd7c8d908d82d8b10ce95d4e98e73b41ba6e8be8275ea2dd4625302ca` |

npm OIDC published the new version successfully on its first attempt. Public registry bytes match SHA-256/SHA-512; npm provenance identifies the accepted source, `refs/tags/v3.9.2`, the publishing workflow and attempt 1 of run 40584822657. npm `latest` is `3.9.2`; `beta` remains `3.0.0-beta.1`.

[GitHub v3.9.2](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.2) is stable/Latest with immutable assets. [Gitee v3.9.2](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.2) distributes the same annotated tag, source and four attachments, with notes rendered from the published GitHub metadata. Exact-version/latest npm installations and an empty-cache offline installation of the anonymously downloaded Gitee package passed. Validated main and the original tag object were synchronized with explicit refspecs after divergence checks.

The Linux test machine upgraded from 3.9.1 to 3.9.2 through the supported update command. Installed source hashes, doctor and the actual configured statusline command passed. Real installed external and Claude 2.1.310 native entries opened Quick setup and cancelled without saving. Display and UI-preference files remain byte-identical to the protected initial snapshots. The only integration-settings change is the managed backend version. Test-only host startup/API-key acknowledgements were restored from the protected host-profile snapshot. The upgraded formal installation remains in place.

Initial machine collector probes inherited `TERM=dumb` or selected an alternate Claude startup profile. Selecting the real ANSI PTY environment and the machine's normal, already-onboarded profile completed the installed journeys without product changes. These unsuccessful collector probes remain separate from the final passing receipt; their collector versions and hashes are retained.

Raw logs, private configuration snapshots and receipts remain in ignored validation storage. No paid model tests, source-provider calls during terminal captures or new human desktop/physical acceptance were performed. Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted by the [v3.9.2 decision](../releases/approvals/v3.9.2.json); they remain unverified. No new automated failure or missing evidence was waived.
