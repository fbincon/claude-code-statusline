# Source operations, command scheduling and package execution

**English** | [简体中文](source-command-package-management.zh-CN.md)

This page describes source operations, command scheduling and safe package execution contracts. [Source guide](../EXTENSIONS.md) · [Package guide](../PACKAGE_MANAGEMENT.md) · [Roadmap](roadmap.md) · [Delivery record](history/deliveries/source-command-package-management.md#source-operations-command-scheduling-and-package-execution).

## Ownership and compatibility

Core owns readable summaries, check/binding pages, execution/history contracts and both editors' interaction state. CLI source and management services enforce authorization, revision, scope and reference rules. Platform adapters retain ordinary/private file readers, literal processes, identity, locks and deletion effects. Generated Native resources share core rules; the runtime Mod supplies confirmed lifecycle contexts.

The editor requires matching Mods. Source registry 3 permits separately reviewed command automation, jobs 4 carry bounded result summaries, observation/command output stay 1 and runtime stays 3. Older records read without rewriting or granting permission. Missing historical result fields mean unknown. Old packages that cannot read current sources/display are refused during rollback review. Current editor protocol and display schema are in the [CLI reference](../reference/cli.md#protocol-and-schema-versions).

A shared bounded ordinary-file reader covers authoritative npm-manifest checks in inspection, staging, update/recovery and Mod transitions, preserving link/reparse, size and identity checks. Bootstrap keeps its preliminary identity probe free of native effects before copying the worker. Private recovery journals and snapshots retain strict permission checks. Regressions assert actual version, compatibility/reasons, bytes, modes and unchanged configuration for `0600`, `0644` and `0664`. Root AGENTS.md records the durable reader-selection and read-only assertion rule.

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

The full [delivery record](history/deliveries/source-command-package-management.md#source-operations-command-scheduling-and-package-execution) is in the development history. The links below open its moved sections.

- <a id="acceptance-and-delivery"></a>[Acceptance and delivery](history/deliveries/source-command-package-management.md#acceptance-and-delivery)
- <a id="v3120-delivery-record"></a>[v3.12.0 delivery record](history/deliveries/source-command-package-management.md#v3120-delivery-record)
