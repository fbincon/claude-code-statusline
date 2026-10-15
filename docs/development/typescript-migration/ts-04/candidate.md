# Installed TypeScript candidate acceptance

**English** | [简体中文](candidate.zh-CN.md)

The private `@fbincon/statusline-ts04-candidate` archive is an acceptance artifact,
not a published package or release. It contains compiled CLI/core/platform/TUI
packages, both self-contained Mods, skill templates, licenses and pinned prebuilt
dependencies. Node 24.21.0/npm 11.19.0 are required. The archive is specific to the
build platform and process architecture; Windows ARM hosts currently run the
validated x64 candidate. Final distributable packaging belongs to TS-05.

## Reproduce

From the repository root, with the pinned runtime on PATH:

```bash
npm ci --ignore-scripts
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04 -- --complete
npm run migration:installed
npm run migration:official:ts04
```

The last command needs a supported fixed Claude Code host. To retain an archive,
run `npm run migration:pack:ts04 -- /absolute/output/directory`. No registry
publication is performed. The acceptance harness installs the archive offline
with lifecycle scripts disabled into a temporary directory outside the checkout,
copies Node to an independent path, and isolates HOME and `CLAUDE_CONFIG_DIR`.
The candidate process PATH excludes Python and compilers. The Windows Git Bash
shim check additionally exposes Git's shell utilities. Repository tooling and the
historical Python comparisons still need their development dependencies.

| Gate | Evidence |
| --- | --- |
| Package and entry points | Compiled installed modules, resource manifests, licenses, native dependency loading, npm shim invocation and moved-prefix rebinding. |
| Frozen rendering | Fifteen production render cases compared byte-for-byte with the immutable reference. |
| Both editors | Installed UI protocol describe/read/preview/revision-bound apply/export; external save/cancel in an actual POSIX PTY or Windows console, terminal-mode restoration and independent visible-cell capture. |
| Recovery and upgrade | Hard termination during installed editor publication, dry-run and idempotent recovery; historical Python-command rebinding, preserved old environment, opt-outs and compatible backup bytes, followed by explicit backup restoration and replay with the frozen Python reference. |
| Official integration | Actual fixed-host install/reinstall, cache and binding verification, installed UI save, user-disabled state, uninstall and no unresolved journal. |

The eight-target TypeScript workflow emits `ts04-installed-*` receipts and the
existing source receipts. The 13 fixed-host Native Mod jobs include
`ts04-official-installed.json` alongside the retained Python integration evidence.
Every candidate receipt binds source hashes and archive SHA-256. Verify archive
digests and source bytes against the reviewed PR head before closing the stage.
CI checkout merge commits may differ from the PR head; source bytes must match.

## Real host interaction and limits

On a local POSIX system with the supported host, `npm run migration:host:ts04`
opens the real host in a PTY, invokes the installed native editor, focuses its
Client region and saves. It verifies completed backend calls and installed
runtime dispatch. This probe uses synthetic credentials and an unreachable
loopback API; it requires no model request. The recorded terminal geometry is
specific to the observed fixed host and is not a portable desktop interaction
test. Private receipts and captures are under ignored
`dist/validation/typescript-migration/ts-04/04-e/`.

Automated console/PTY checks do not replace the previously deferred physical
suspend/reboot, desktop focus/input and visual acceptance before release. Node
launch uses explicit executable/argv bindings; the historical Windows `.cmd`
limitation is not reclassified as passing. The released Python installation is
retained. [Recovery](recovery.md) covers interrupted transactions; arbitrary
historical backup selection remains a deliberate manual rollback.

The complete ledger has 265 responsibilities: 252 ported and 13 retired with
explicit replacement evidence under the approved D05 entry-point decision. There
are no pending IDs. Display schema 8, UI protocol 11 and runtime protocol 2 with
v1 compatibility are unchanged. All 161 frozen replay cases retain exactly the
three approved human CLI text exemptions. Historical D06 performance remains
FAIL; PERF-01 follows TS-06 and is not part of this acceptance gate.
