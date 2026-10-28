# Source operations, command scheduling and package execution

**English** | [简体中文](source-command-package-management.zh-CN.md)

v3.12.0 implements SOURCES-01 slices 1–3, COMMAND-02 and UPDATE-02 slices 2/3. Status is **IN_PROGRESS** until final acceptance and publication. [Source guide](../EXTENSIONS.md) · [Package guide](../PACKAGE_MANAGEMENT.md) · [Roadmap](roadmap.md).

## Ownership and compatibility

Core owns readable summaries, check/binding pages, execution/history contracts and both editors' interaction state. CLI source and management services enforce authorization, revision, scope and reference rules. Platform adapters retain ordinary/private file readers, literal processes, identity, locks and deletion effects. Generated Native resources share core rules; the runtime Mod supplies confirmed lifecycle contexts.

Editor protocol 28 requires matching Mods. Display schema stays 16; source registry 3 permits separately reviewed command automation, jobs 4 carry bounded result summaries, observation/command output stay 1 and runtime stays 3. Older records read without rewriting or granting permission. Missing historical result fields mean unknown. Old packages that cannot read current sources/display are refused during rollback review.

The #173 repair uses the bounded ordinary-file reader for npm manifests, preserving link/reparse, size and identity checks. Private recovery journals and snapshots retain strict permission checks. Regressions assert actual version, compatibility/reasons, bytes, modes and unchanged configuration for `0600`, `0644` and `0664`. Root AGENTS.md records the durable reader-selection and read-only assertion rule.

Mutable private package progress/installation records use bounded snapshots that retry only file-identity/content races while retaining owner, private-mode, size and no-follow checks. Immutable recovery journals and snapshots retain strict readers.

## Source lifecycle and references

Execution permission and automatic permission are reviewed independently. Commands start automatic policy at 300 seconds, adjustable 60–86400 separately from TTL. Active host leases renew every five seconds and expire after fifteen. Applicable projects, sessions and confirmed local agents participate; unknown ownership waits. Same-source commands run serially, equal effective input shares work and distinct contexts rotate fairly. Busy ticks do not accumulate work. Temporary failures back off; program/configuration/identity failures pause. Source edits revoke old permission and late result publication.

Readable summaries separate current failure from retained-success freshness. GitHub detail pages read stored checks and their own captured context/time; unavailable states do not become passing. Binding reuses compatible records and reviews unused/duplicate records. Defaults, all named profiles and project associations, registered unsaved drafts and recovery snapshots protect references. Cleanup rechecks full references/revision under lock; uncertainty preserves records. Closed-draft tombstones reject late registration. Crashed owners can be explicitly released after handling their draft.

## Safe package handoff

A compatible verified review is required. Draft save must complete or reconcile; export stays dirty, discard is explicit and cancellation retains edits. Saving changes requires fresh review. Execution checks installation/configuration/target identity again before mutation. The executor and controls live outside the package being replaced; persistent IDs, stages and process identity distinguish package, integration and configuration outcomes. Interactive persistent TUI processes also copy their runtime before native modules load, allowing Windows npm replacement.

Accepted handoff makes the old editor read-only. Closing detaches without cancelling. Retained controls remain usable through downgrade/upgrade and unfinished execution can be rediscovered. Package recovery and configuration restoration remain independent. History is prefix-filtered before pagination; cleanup protects running/unknown processes, pending transactions, current/previous rollback inputs, attached controls and required snapshots.

## Acceptance and delivery

Required local checks: generate, generate:check, check and diff whitespace. Focused tests cover ordinary/private permissions, shared consumers, multi-context leases, retry/pause, stored GitHub pages, draft reservations, cross-profile references, review invalidation, unknown saves, stage results and cleanup conflicts.

Installed acceptance retains the original real-npm historical transitions, then adds reviewed editor downgrade/upgrade through retained controls, detach, old-protocol refusal, interrupted-package recovery, separate restoration and protected cleanup against a controlled loopback registry. Installed source checks add separate automatic approval, default interval/TTL independence, non-Git contexts, manual-interest preservation, retained success and binding cleanup.

Final immutable candidate gates retain eight installation targets, 32 Node combinations, sixteen fixed hosts and the original 197 capacity assertions. Twenty additional bounded source/package pages share the same actual-host run (217 total); receipts retain separate baseline/additional counts and case-name digests. A baseline count is not presented as a separate execution. Final PR evidence is promoted through main/tag using the original artifacts. Supplement with both-editor PTYs and real local Claude 2.1.312, without model calls. Record actual IDs/digests after acceptance; no publication has been claimed here.

Issue #157 is closed with verified v3.11.0 tag/OIDC/provenance and public-download evidence in [the issue comment](https://github.com/fbincon/claude-code-statusline/issues/157#issuecomment-6472495690). Account macOS quota/runner supply remains unverified. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted, not new automated failures. After v3.12.0 publication, new local findings are filed as issues; the approved release stays unchanged.

Pre-publication local validation: the installed candidate `25b47a17b14e812f74c324b4e30bbd2feaaaf5d7` passed all 25 installed tests, including real npm editor transitions and source operations. Claude 2.1.312 passed all 217 capacity assertions after the read-only package projection repair. The five test files retain the original assertions and keep host failure reports bounded. Final immutable PR/main/tag and channel records are still pending.
