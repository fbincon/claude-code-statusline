# TS-04 interface and assertion handoff

**English** | [简体中文](TS04-HANDOFF.zh-CN.md)

Admission update (2026-10-15): **TS-03/03-F are DONE; TS-04 is NOT_STARTED**.
The [closure record](README.md#closure-2026-10-15) binds existing functional,
CI and source evidence. Under the [D06 amendment](../ts-02/D06.md#applicability-amendment-2026-10-15),
performance no longer blocks entry. The latest D06 remains **FAIL: 104 pass /
60 fail / 28 inconclusive**; further optimization belongs to [PERF-01](../../performance/perf-01.md)
after TS-06.

This document records interfaces and outstanding assertions for a later TS-04
task. The planning change starts no implementation, switches no installed Python
product and does not claim external-editor or installation acceptance.

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

When TS-04 is implemented, use [the TS-03 record](README.md), its source-bound validation summaries and the named replacement tests. Run `npm test`, `npm run generate:check`, `npm run migration:inventory -- --complete`, both official Mod suites and required cross-platform CI, with new editor/install/recovery coverage. Exact collection counts, existing timeout and bounded-resource contracts remain functional/stability requirements.

Full D06 measurement and passing budgets are not TS-04 prerequisites or exit conditions. Preserve every historical failed/inconclusive result; a single-sample `--validate` report remains fixture evidence only. This documentation-only task does not run these local implementation suites or a benchmark.

Physical device, sleep and human desktop checks retain their approved release-before status. Claude Code 2.1.296 runtime tests do not establish unavailable exact-build host declaration checks. No TS version tag or Release is created in TS-03.
