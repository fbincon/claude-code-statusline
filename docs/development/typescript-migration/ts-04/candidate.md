# Installed TypeScript candidate acceptance

**English** | [简体中文](candidate.zh-CN.md)

> **Historical TS-04 evidence.** This installed-candidate acceptance record is frozen at TS-04 delivery and is not current guidance. The `migration:pack:ts04` packaging command was removed; current candidate builds use `npm run candidate:build`, as described in the [testing and acceptance guide](../../testing.md#candidate-build-and-isolated-installation) and the [TS-05 candidate guide](../ts-05/candidate.md).

The private `@fbincon/statusline-ts04-candidate` archive was an acceptance artifact,
not a published package or release. It contained compiled CLI/core/platform/TUI
packages, both self-contained Mods, skill templates, licenses and pinned prebuilt
dependencies. Node 24.21.0/npm 11.19.0 were required. The archive was specific to the
build platform and process architecture; Windows ARM hosts ran the
validated x64 candidate. Final distributable packaging belonged to TS-05.

## Reproduce

From the repository root, with the pinned runtime on PATH, the historical workflow was:

```bash
npm ci --ignore-scripts
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04 -- --complete
npm run migration:installed
npm run migration:official:ts04
```

The last command needed a supported fixed Claude Code host. To retain an archive,
the historical workflow ran `npm run migration:pack:ts04 -- /absolute/output/directory`;
that command has since been removed, and current candidate builds use
`npm run candidate:build` (see the [testing and acceptance guide](../../testing.md#candidate-build-and-isolated-installation)).
No registry publication was performed. The acceptance harness installed the archive offline
with lifecycle scripts disabled into a temporary directory outside the checkout,
copied Node to an independent path, and isolated HOME and `CLAUDE_CONFIG_DIR`.
The candidate process PATH excluded Python and compilers. The Windows Git Bash
shim check additionally exposed Git's shell utilities. Official macOS host checks
also exposed `/usr/bin/security` through a private tool directory because the host
needed it to load its configuration store; they did not expose the rest of `/usr/bin`.
Repository tooling and the
historical Python comparisons still needed their development dependencies.

| Gate | Evidence |
| --- | --- |
| Package and entry points | Compiled installed modules, resource manifests, licenses, native dependency loading, npm shim invocation and moved-prefix rebinding. |
| Frozen rendering | Fifteen production render cases compared byte-for-byte with the immutable reference. |
| Both editors | Installed UI protocol describe/read/preview/revision-bound apply/export; external save/cancel in an actual POSIX PTY or Windows console, exact Win32 input/output mode restoration or POSIX terminal attributes, and independent visible-cell capture. |
| Recovery and upgrade | Hard termination during installed editor publication, dry-run and idempotent recovery; historical Python-command rebinding, preserved old environment, opt-outs and compatible backup bytes, followed by explicit backup restoration and replay with the frozen Python reference. |
| Official integration | Actual fixed-host install/reinstall, cache and binding verification, installed UI save, user-disabled state, uninstall and no unresolved journal. |

The eight-target TypeScript workflow emitted `ts04-installed-*` receipts and the
existing source receipts. The 13 fixed-host Native Mod jobs include
`ts04-official-installed.json` alongside the retained Python integration evidence.
Every candidate receipt bound source hashes and archive SHA-256. Archive
digests and source bytes were verified against the reviewed PR head before closing the stage.
CI checkout merge commits could differ from the PR head; source bytes had to match.

## Real host interaction and limits

On a local POSIX system with the supported host, `npm run migration:host:ts04`
opened the real host in a PTY, invoked the installed native editor, focused its
Client region and saved. It verified completed backend calls and installed
runtime dispatch. This probe used synthetic credentials and an unreachable
loopback API; it required no model request. The recorded terminal geometry was
specific to the observed fixed host and is not a portable desktop interaction
test. Private receipts and captures are under ignored
`dist/validation/typescript-migration/ts-04/04-e/`.

Automated console/PTY checks did not replace the previously deferred physical
suspend/reboot, desktop focus/input and visual acceptance before release. Node
launch used explicit executable/argv bindings; the historical Windows `.cmd`
limitation was not reclassified as passing. The released Python installation was
retained. [Recovery](recovery.md) covered interrupted transactions; arbitrary
historical backup selection remained a deliberate manual rollback.

The complete ledger has 265 responsibilities: 252 ported and 13 retired with
explicit replacement evidence under the approved D05 entry-point decision. There
are no pending IDs. At TS-04, display schema 8, UI protocol 11 and runtime protocol 2 with
v1 compatibility were unchanged; these are historical stage values, and current
versions are in the [protocol and schema versions](../../../reference/cli.md#protocol-and-schema-versions).
All 161 frozen replay cases retained exactly the
three approved human CLI text exemptions. Historical D06 performance remains
FAIL; PERF-01 followed TS-06 and was not part of this acceptance gate.
