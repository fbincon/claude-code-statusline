# Source operations, command scheduling and package execution

**English** | [简体中文](source-command-package-management.zh-CN.md)

v3.12.0 implements SOURCES-01 slices 1–3, COMMAND-02 and UPDATE-02 slices 2/3. Final acceptance and publication are complete; status is **DONE**. [Source guide](../EXTENSIONS.md) · [Package guide](../PACKAGE_MANAGEMENT.md) · [Roadmap](roadmap.md).

## Ownership and compatibility

Core owns readable summaries, check/binding pages, execution/history contracts and both editors' interaction state. CLI source and management services enforce authorization, revision, scope and reference rules. Platform adapters retain ordinary/private file readers, literal processes, identity, locks and deletion effects. Generated Native resources share core rules; the runtime Mod supplies confirmed lifecycle contexts.

Editor protocol 28 requires matching Mods. Display schema stays 16; source registry 3 permits separately reviewed command automation, jobs 4 carry bounded result summaries, observation/command output stay 1 and runtime stays 3. Older records read without rewriting or granting permission. Missing historical result fields mean unknown. Old packages that cannot read current sources/display are refused during rollback review.

The #173 repair uses a shared bounded ordinary-file reader for authoritative npm-manifest checks in inspection, staging, update/recovery and Mod transitions, preserving link/reparse, size and identity checks. Bootstrap keeps its preliminary identity probe free of native effects before copying the worker. Private recovery journals and snapshots retain strict permission checks. Regressions assert actual version, compatibility/reasons, bytes, modes and unchanged configuration for `0600`, `0644` and `0664`. Root AGENTS.md records the durable reader-selection and read-only assertion rule.

Mutable private package progress/installation records use bounded snapshots that retry only file-identity/content races while retaining owner, private-mode, size and no-follow checks. Immutable recovery journals and snapshots retain strict readers.

Interactive bootstrap inspects the command before creating terminal streams. Runtime/UI pipes keep blocking input even when the producer writes after the reader starts. Real delayed-pipe regressions assert protocol success, the published observation and read-only describe behavior; concurrent runtime writers retain all agents and sessions.

Windows historical package journeys run sequentially to avoid competing npm/copy fixtures. All historical versions, transitions and crash/recovery assertions remain. Each original journey retains its 900-second budget (1,200 seconds with an official host); the additional editor-execution journey has a separate 900/1,200-second budget. Phase timers and release validation prevent one phase borrowing another's time; enclosing budgets sum the required phases. Product subprocess deadlines remain unchanged. The crash fixture propagates a pre-checkpoint management failure and retains its bounded output, so an earlier timeout cannot masquerade as successful execution or as an injected crash.

Owned Unicode fixture deletion uses the existing platform tree-removal adapter. The [Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40756220503) reproduced Node 24.0.0 returning from `rmSync` with the execution directory still present on x64 and ARM-host/x64. Tests assert actual absence before reviewing references, and retain foreign-file and stale-review refusal checks. The diagnostic source probe repeats cleanup twenty times per environment; it is separate from release acceptance.

## Source lifecycle and references

Execution permission and automatic permission are reviewed independently. Commands start automatic policy at 300 seconds, adjustable 60–86400 separately from TTL. Active host leases renew every five seconds and expire after fifteen. Applicable projects, sessions and confirmed local agents participate; unknown ownership waits. Same-source commands run serially, equal effective input shares work and distinct contexts rotate fairly. Busy ticks do not accumulate work. Temporary failures back off; program/configuration/identity failures pause. Source edits revoke old permission and late result publication.

Readable summaries separate current failure from retained-success freshness. GitHub detail pages read stored checks and their own captured context/time; unavailable states do not become passing. Binding reuses compatible records and reviews unused/duplicate records. Defaults, all named profiles and project associations, registered unsaved drafts and recovery snapshots protect references. Cleanup rechecks full references/revision under lock; uncertainty preserves records. Closed-draft tombstones reject late registration. Crashed owners can be explicitly released after handling their draft.

## Safe package handoff

A compatible verified review is required. Draft save must complete or reconcile; export stays dirty, discard is explicit and cancellation retains edits. Saving changes requires fresh review. Execution checks installation/configuration/target identity again before mutation. The executor and controls live outside the package being replaced; persistent IDs, stages and process identity distinguish package, integration and configuration outcomes. Interactive persistent TUI processes also copy their runtime before native modules load, allowing Windows npm replacement.

Accepted handoff makes the old editor read-only. Closing detaches without cancelling. Retained controls remain usable through downgrade/upgrade and unfinished execution can be rediscovered. Package recovery and configuration restoration remain independent. History is prefix-filtered before pagination; cleanup protects running/unknown processes, pending transactions, current/previous rollback inputs, attached controls and required snapshots.

Unverifiable executors retain their records, report unknown liveness and block package recovery/replacement until exit or a different process identity is confirmed. This also applies when observing child completion or waiting for the original Windows caller. A denied-identity regression reproduces the former unsafe recovery, then asserts refusal and unchanged transaction/configuration bytes.

## Acceptance and delivery

Required local checks: generate, generate:check, check and diff whitespace. Focused tests cover ordinary/private permissions, shared consumers, multi-context leases, retry/pause, stored GitHub pages, draft reservations, cross-profile references, review invalidation, unknown saves, stage results and cleanup conflicts.

Installed acceptance retains the original real-npm historical transitions, then adds reviewed editor downgrade/upgrade through retained controls, detach, old-protocol refusal, interrupted-package recovery, separate restoration and protected cleanup against a controlled loopback registry. Installed source checks add separate automatic approval, default interval/TTL independence, non-Git contexts, manual-interest preservation, retained success and binding cleanup.

Final immutable candidate gates retain eight installation targets, 32 Node combinations, sixteen fixed hosts and the original 197 capacity assertions. Twenty additional bounded source/package pages share the same actual-host run (217 total); receipts retain separate baseline/additional counts and case-name digests. A baseline count is not presented as a separate execution. Final PR evidence is promoted through main/tag using the original artifacts. Supplement with both-editor PTYs and real local Claude 2.1.312, without model calls. Actual identities, digests and publication results are recorded below.

Issue #157 is closed with verified v3.11.0 tag/OIDC/provenance and public-download evidence in [the issue comment](https://github.com/fbincon/claude-code-statusline/issues/157#issuecomment-6472495690). Account macOS quota/runner supply remains unverified. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted, not new automated failures. After v3.12.0 publication, new local findings are filed as issues; the approved release stays unchanged.

Earlier pre-publication snapshot: installed candidate `25b47a17b14e812f74c324b4e30bbd2feaaaf5d7` passed all 25 installed tests, including real npm editor transitions and source operations. Claude 2.1.312 passed all 217 capacity assertions after the read-only package projection repair. The five test files retained the original assertions and bounded host failure reports. Final immutable PR/main/tag and channel records were pending at that snapshot; the completed delivery follows.


## v3.12.0 delivery record

All three SOURCES-01 slices, COMMAND-02 and UPDATE-02 slices 2/3 passed acceptance and publication; the three packages are **DONE**. Feature [PR #175](https://github.com/fbincon/claude-code-statusline/pull/175) used normal merge commit `99edd1d8d2684a852bb0c719fd6a92cdcf4259e5`. Immutable release source: `2461105f3e1fcd2927a2f343b8a316d5dae30ce2`; annotated tag object: `83cec9d0d97f2ef2c253ba3ed008f2ce2c8c12d9`. Published at `2026-10-28T22:11:09Z`.

The final PR covers 8 installation targets, 32 Node combinations and 16 fixed hosts. Each applicable host preserves the original 197 plus 20 additional capacity assertions in one identified execution (217 total), with separate counts/name digests. Main's independent accepted-base verification, three installation smokes and tag promotion retain original PR artifacts without rebuilding or relabeling receipts. Local complete checks pass 1,392 tests with six platform-only skips; 78 generated resources, documentation and whitespace checks pass. The final candidate passes 25 local installed categories and 34 both-editor PTYs; the real Claude 2.1.312 controlled-session command asserts actual source value and execution result, with zero model calls.

Six-language/two-background extended captures total 948 images and retain earlier source `d16dacb5b6b937c4f04925b05047dd53538e3206`; they are not relabeled as final artifact or physical acceptance.

[npm 3.12.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.12.0), [GitHub stable Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.12.0) and [Gitee Release 1251340](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.12.0) carry the verified npm package and the same four GitHub/Gitee delivery files. OIDC [signed provenance](https://search.sigstore.dev/?logIndex=3550334517) identifies the same release source. npm `latest=3.12.0` preserves `beta=3.0.0-beta.1`. All six public-download jobs and anonymous Gitee attachment digests pass; validated main and the tag were synchronized with explicit refspecs.

The test machine upgraded from 3.11.0 to 3.12.0 through transaction `pkg-310635db-0b1c-4cfc-91ca-292d1f9ddd43`. The actual package page, unchanged ordinary manifest bytes/mode, statusline output, external version page/draft cancellation/terminal restoration and doctor pass. Original display/UI bytes, modes and optional-source absence were checked, preserving required new integration changes.

The installed manifest additionally passes `0600`, `0644` and `0664` probes: each reports current `3.12.0`, compatible with no reasons, and preserves bytes, mode, file identity and configuration during the read. The probe restores its original mode. Display/UI bytes and modes remain identical, profiles/sources remain absent, and the sole settings change is Native `backendVersion` from `3.11.0` to `3.12.0`; unrelated settings are unchanged.

Registry signatures and the publish/SLSA attestations pass npm's verifier scoped to the published package, followed by Sigstore verification of the exact GitHub workflow/tag certificate identity and issuer against trusted TUF material. The generic tree-wide `npm audit signatures` diagnostic requested private bundled workspace `0.0.0` packages and returned 404; that result is retained. The successful public-package check verifies the integrity covering all bundled bytes.

The first supplemental local PTY inherited `TERM=dumb` and `NO_COLOR=1`, producing the expected ANSI-terminal refusal. With an explicit VT PTY environment, the installed editor's version page, retained dirty draft, cancellation and terminal restoration pass. This harness correction establishes no physical acceptance and required no product change. No new post-publication product issue was confirmed.

The first attempt failed two jobs: Windows ARM/x64 Node 24.0.0 exceeded the existing 60-second system PowerShell preparation before invoking candidate code; macOS 26 Intel Node 24.0.0 returned `interrupted` during a historical rollback review, whose cause is not established by the available receipt. The [complete rerun of failed jobs](https://github.com/fbincon/claude-code-statusline/actions/runs/40759928021/attempts/2) passed on the same source with unchanged assertions and deadlines. Final aggregation retains original successful executions and new successful retry receipts; first failures remain recorded without waiver or relabeling.

Issue #157 retains its actual v3.11.0 tag/OIDC/provenance closure evidence; feature PR #175 closes #173. Only the six existing #96 gaps remain unverified; they are not passed and do not waive new automated failures. New local findings after publication are filed as issues, keeping v3.12.0 unchanged.

| Gate / 门禁 | Result / 结果 |
| --- | --- |
| [Final PR / 最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40759928021) | Passed / 通过 |
| [Main integration / main 集成](https://github.com/fbincon/claude-code-statusline/actions/runs/40774605697) | Passed / 通过 |
| [Annotated tag / 注释标签](https://github.com/fbincon/claude-code-statusline/actions/runs/40775183960) | Passed / 通过 |
| [OIDC dry run / OIDC 演练](https://github.com/fbincon/claude-code-statusline/actions/runs/40776119637) | Passed / 通过 |
| [OIDC publication / OIDC 发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40776458624) | Passed / 通过 |
| [Public downloads / 公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/40777988443) | Passed / 通过 |

| Original file / 原始文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.12.0.tgz` | `96dfcb89fbf514c913762df89ec5c1a104981e5b601d2f4c39f50cd3aaeb7030` |
| `claude-code-statusline-3.12.0-source.tar.gz` | `aff60716c80345bb22e9adc42a7a9d0918d87dccf6ac88aadefeb527abac7870` |
| `build-manifest.json` | `14e85af1d4530501b2589839c50e1694dd32faabbe3cfd71c73527ed1fec41dd` |
| `SHA256SUMS` | `e699ae8d3f3aa0a5e77fc2b5201b95aefb254712f6152056411f3ac4408d5310` |
