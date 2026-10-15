# TS-04 editors, installation and recovery

**English** | [简体中文](README.zh-CN.md)

State: **DONE**, 2026-10-15 (Asia/Shanghai). Worker: Codex.
The [migration plan](../../typescript-migration.md) owns stage status.
The approved execution plan uses isolated packages/configuration only and retains
the maintainer's installed Python product. Recovery is an explicit command;
doctor remains read-only. No release version or tag is assigned here.

## Batches

| Batch | Deliverable | State |
| --- | --- | --- |
| 04-A | Complete responsibility ledger, shared editor rules and production Mod argv binding | DONE; [PR #87](https://github.com/fbincon/claude-code-statusline/pull/87) |
| 04-B | External raw-TTY/VT editor, terminal launchers and result bridge | DONE; [PR #88](https://github.com/fbincon/claude-code-statusline/pull/88) |
| 04-C | Install, uninstall, doctor, ownership and resources | DONE; [PR #89](https://github.com/fbincon/claude-code-statusline/pull/89) |
| 04-D | Persistent transaction checkpoints and explicit recovery | DONE; [PR #90](https://github.com/fbincon/claude-code-statusline/pull/90) |
| 04-E | Installed candidate acceptance, CI, documentation and closure | DONE; [PR #91](https://github.com/fbincon/claude-code-statusline/pull/91) |

## Responsibility and architecture

The [ledger](../../../../tools/migration/ts-04/coverage.json) includes 212 tests
originally assigned to TS-04, 45 complete tests transferred from TS-03 and eight
remaining mixed-test assertions: **265 distinct responsibilities**. Frozen
baseline and TS-03 handoff records remain historical evidence. The new inventory
rejects omitted/duplicate IDs, changed responsibility, missing replacement tests
and undocumented retirement. `--complete` additionally rejects pending entries;
04-A started with 265 pending. 04-E now has **252 ported, 13 retired with explicit
replacement evidence and zero pending**. Retirements follow the approved D05
entry-point decision; target CI remains required for platform acceptance.

`core/editor` now owns the reusable draft, instance, search, numerical controls,
guidance, import-review and protocol-response logic. The generator copies these
pure modules into self-contained Mod resources and checks drift. Node and both
Mods share the same pure argv binding. `backendArgs` is an optional string-array
manifest field; absence means a legacy executable with no prefix. Executable
environment overrides replace the entire binding. Host calls stay in hooks.

`packages/tui` owns the external editor state, geometry, cell drawing and session.
Shared forms, complete-grapheme text and spans serve both editors. The sole raw
mode owner is `platform/terminal/session`; it restores terminal modes on saves,
cancellation, signals, timeouts and errors. Input/output queues, capture sizes and
launch deadlines are bounded. The CLI loads editor modules only when needed.

The launcher chooses a verified tmux popup, local macOS Terminal, GNOME Terminal
or a native Windows console. It passes the absolute Node executable and JS entry
as separate argv values. Private request/result files bind the configuration,
backend argv, nonce and parent process identity. A revoked request is checked
again after acquiring the configuration lock, so a delayed editor cannot save.
The six existing outcomes and legacy result-path environment remain compatible.

The installation service prepares read-only before taking the common file lock,
backs up changed artifacts, and preserves compatibility configuration when a
separate official plugin phase fails. Mod source and cache hashes, scope,
marketplace identity and prior inventory are checked before updates or removal.
Same-version resource changes use a verified official reinstall. Explicit plugin
disablement survives refresh; only tool-owned suspension is automatically undone.
Runtime preferences and the two editors remain independent.

Installation records the exact Node/JS binding in
`statusline_runtime/installation.json`; upgrades recognize that prior binding and
the historical Python entries. Doctor reports PATH/Python collisions without
uninstalling either environment. The official plugin CLI accepts multiple inputs
as serialized JSON strings; both Mods decode and validate this form as well as
array-valued defaults. Skill templates now live in `packages/cli/resources`; the
generator maintains the retained Python copies. 04-D adds persistent interrupted recovery; 04-E verifies it in an installed package.

## Validation and closure

04-A local checks: Node 24.21.0/npm 11.19.0; TS 560 passed / 1 platform skip;
Claude Code 2.1.296 native Mod 114/114 and runtime Mod 12/12; both strict validators
and existing declaration typechecks passed. A 2.1.296 test is not an exact-build
declaration check. All 46 generated resources and the existing 516-ID TS-03 audit
pass. All 43 CI jobs and eight source-bound receipts passed for final head
`caf28a9`; merge `264fd8a` is synchronized to Gitee. See the machine-readable
[04-A evidence](validation.04-a.json), including the corrected Windows line-ending
receipt failure rather than a new comparison exemption.

04-B local checks: TS 730/733 passed with three Windows-only skips; native Mod
114/114 and strict validation passed; 48 generated resources pass drift checks.
The external editor has real PTY save/cancel/conflict, resize, Unicode, signal,
timeout, parent revocation and post-lock revocation tests, plus a real tmux popup
input-isolation test. Windows console tests run only on Windows CI. Independent
VT capture verifies visible cells, complete graphemes, preview color and chrome.
The existing CLI-help exemption is refreshed for the approved `configure`
addition; all 161 frozen replay cases retain the original three exemptions.
All 43 CI jobs passed for `73262a9`; eight receipts match all 346 source files.
Merge `c9709d1` and detailed results are recorded in [04-B evidence](validation.04-b.json).

04-C local checks: 830/833 TS tests passed, with three Windows-only skips;
official native/runtime Mod tests passed 115/14, both validators and declaration
typechecks passed, and 50 generated resources are current. Real Claude Code
2.1.296 installed both Mods in an isolated Unicode/special-character path,
reinstalled without changes, returned no doctor errors and uninstalled owned
integration successfully. No model request or maintainer installation change was
needed. That batch had 251 ported, nine retired and five entries assigned to 04-E.
Final head `18a1275` passed 43 CI jobs; eight receipts match all 363 source files.
Merge `daaaccd` is recorded in [04-C evidence](validation.04-c.json).

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04 -- --complete
```

04-D adds explicit `recover [--config-dir PATH] [--dry-run]`, immutable synced
before-images, versioned journal checkpoints and pending-write guards. Recovery
checks every original/target before restoration and reconciles uncertain official
operations from inventory without blindly replaying writes. A durable refresh
intent preserves user-disabled plugins even across a kill between successful
uninstall and reinstall. See the [recovery procedure](recovery.md).

Local 04-D tests: 853/856 TS passed (three Windows-only skips), 847/856 Python
passed (nine platform skips), 24 recovery scenarios including real process interruption and 50 generated
resources passed. The real isolated official install/reinstall/doctor/uninstall
flow passed with no pending journals. Final head `35c1702` passed 43 CI jobs;
eight receipts match all 370 source files. Merge `acdf5f9` is recorded in
[04-D evidence](validation.04-d.json).

04-E installs a private candidate offline outside the checkout and covers both
editors, native dependencies, 15 frozen render cases, both Windows shells,
relocation/rebinding, hard-interruption recovery and historical Python upgrades.
The fixed-host matrix gains real installed-package integration acceptance.
Local TS passed 858/861 with three platform skips, including the cache-link
regression. All ten separate installed tests passed. Real host 2.1.296 opened the installed
native editor and saved, and runtime dispatched to the installed backend without
a model call. See [candidate acceptance and reproduction](candidate.md).

Initial 04-E Windows CI exposed a harness ancestry check that treated a C-drive temporary installation as inside the D-drive checkout. The corrected guard canonicalizes both prefixes and accepts cross-drive paths; no product behavior or acceptance exemption changed.

Further Windows installed acceptance caught two production boundaries: an npm POSIX shim could precede its `.cmd` sibling during host discovery, and JavaScript replacement-string syntax could expand literal `$` sequences in launch paths. Host discovery now resolves the matching Windows package entry without a shell; skill substitution uses a single literal callback pass. Regression checks cover both cases without relaxing installed acceptance.

The installed Windows console then detected that [libuv normal-mode restoration](https://github.com/libuv/libuv/blob/v1.51.0/src/win/tty.c#L341) changed the original input flags from 503 to 7. The terminal owner now captures and restores complete Win32 input/output masks and verifies restoration; installed save/cancel asserts both masks exactly. The fixed-host Windows integration checks had already passed.

The macOS diagnostic receipts confirmed a successfully installed/enabled plugin but empty configuration inputs. The isolated host PATH omitted the system `security` executable used by the official configuration store. Official-host acceptance now exposes only that macOS system utility alongside Node, retaining the Python/compiler exclusion and strict binding confirmation.

## Closure evidence: 2026-10-15

Head `f37e5f5` passed **all 43 PR checks**. Eight source receipts, eight installed
receipts and 13 official-host receipts were downloaded: all 29 archive SHA-256
values and all **380 source files** match exactly. The eight targets cover Linux,
Windows x64, x64 on a Windows ARM host, and the existing macOS 14/15/26 ARM64/Intel
matrix. Every target passes the separate ten-check installed suite.

| Gate | Completed evidence |
| --- | --- |
| Responsibility and compatibility | 265 IDs: 252 ported, 13 named retirements, zero pending; 161 frozen cases retain exactly three approved CLI text exemptions. |
| Both editors | Shared rules and official Mod checks; installed UI protocol saves; real PTY/Windows console save/cancel, complete mode restoration and visible-cell capture. |
| Installation and recovery | Offline package/prebuilt dependencies, relocation/rebinding, explicit opt-outs, hard termination, explicit recovery, uninstall and compatible-backup replay by the frozen Python reference. |
| Fixed hosts | Thirteen official install/reinstall, binding, save, disabled-preference and uninstall flows, with no pending journal. |
| Real host interaction | Clean-source 2.1.296 native editor save and installed runtime dispatch, without a model request; physical/visual acceptance is not claimed. |

[04-E machine evidence](validation.04-e.json) and the [real-host receipt](validation.04-e.host.json)
pin sources, digests and outcomes. [PR #91](https://github.com/fbincon/claude-code-statusline/pull/91)
records the final documentation head, merge and GitHub/Gitee synchronization;
documentation-only closure must retain the same reviewed source hashes.

TS-04/04-A–04-E are complete. TS-05/TS-06 and PERF-01 remain NOT_STARTED. The
existing Python installation is not switched and this stage creates no release.
Previously approved physical/desktop checks remain due before release. Historical
D06 FAIL is preserved; timeout, resource-bound and stability contracts still
apply. Raw captures stay under ignored `dist/validation/typescript-migration/ts-04/`.
