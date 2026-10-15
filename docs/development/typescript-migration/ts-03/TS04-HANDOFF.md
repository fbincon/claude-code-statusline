# TS-04 interface and assertion handoff

**English** | [简体中文](TS04-HANDOFF.zh-CN.md)

TS-03 remains **IN_PROGRESS**: [D06 failed](PERFORMANCE.md) with 69 failed and 32 inconclusive metrics. The initial 03-F head passed 43 CI jobs; final head verification is recorded in [PR #83](https://github.com/fbincon/claude-code-statusline/pull/83). Performance remediation remains owned by TS-03. This document records the interfaces TS-04 will consume; it does not switch the installed Python product or claim external-editor acceptance.

Admission update (2026-10-15): after two performance rounds D06 still fails (104 pass / 60 fail / 28 inconclusive). This handoff does not authorize TS-04 implementation; first address the [TS-03 focused review](PERFORMANCE-OPTIMIZATION.md).

## Backend entry and ownership

Build with the private workspace's pinned Node 24.21.0, then invoke `node packages/cli/dist/src/entry.js`. The internal binding is `LaunchSpec { executable, args }`: the executable is the fixed Node binary and args begins with the compiled entry. Configuration ownership compares the complete binding; canonical legacy single-executable bindings remain readable. Preserve Windows v2 reboot-domain identities from TS-02.

The backend provides all configuration commands, UI protocol 11, runtime protocol 2 with v1 reads/observations, main rendering, subagent NDJSON, lifecycle hooks and slash hooks. Display schema 8, lifecycle schema 4 and existing storage formats remain unchanged. UI preferences and statusline languages are independent. Read/preview/dry-run do not rewrite configuration; apply checks revisions and ownership after acquiring the transaction lock, and no-op saves create no backup.

## Editor and installation work

- Adapt both installed Mod bindings to pass executable plus args. The current manifests and installed Python bindings remain unchanged. Temporary test bindings already connect both original Mod protocol libraries and the Claude Code 2.1.296 host process API to TS.
- Implement the real external terminal adapter for `EditorLauncher`. Preserve updated/current/cancelled/interrupted/timed-out/error results, bounded subprocess handling, terminal restoration and the caller's backend/configuration binding.
- Migrate install/doctor/uninstall, settings/resources/marketplace ownership, launcher selection and result bridges. Verify clean/repeated install, Python upgrades, interrupted updates, recovery, uninstall and downgrade with unrelated settings preserved.
- Reuse the existing Client's pure editor logic. Keep Node filesystem/process access in backend or host hooks, outside Client modules.

## Test responsibility

The [machine-readable handoff](../../../../tools/migration/ts-03/ts04-handoff.json) contains **45 complete external TUI/installation/terminal tests** and **eight remaining integration assertions from mixed tests**. Every entry retains its frozen test ID, owner and exact pending assertion. The corresponding TS-03 backend assertions are already tested; these deferrals do not mark the terminal behavior as passed.

Cover real editor save/cancel/conflicts, import-review acceptance and scrolling, localized search/forms, 25 language combinations, keyboard selection after rejected edits, resize, color negotiation/defaults, capture cell colors and PTY stream boundaries. Verify both editors against the installed TS backend, including stale responses and uncertain save outcomes.

## Evidence and release gates

Use [the TS-03 record](README.md), its source-bound validation summaries and the named replacement tests. Repeat `npm test`, `npm run generate:check`, `npm run migration:inventory -- --complete`, both official Mod suites and required cross-platform CI. The full D06 report must retain every failed/inconclusive result; a single-sample `--validate` report is fixture evidence only.

Physical device, sleep and human desktop checks retain their approved release-before status. Claude Code 2.1.296 runtime tests do not establish unavailable exact-build host declaration checks. No TS version tag or Release is created in TS-03.
