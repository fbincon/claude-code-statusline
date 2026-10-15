# TS-04 editors, installation and recovery

**English** | [简体中文](README.zh-CN.md)

State: **IN_PROGRESS**, 2026-10-15 (Asia/Shanghai). Worker: Codex.
The [migration plan](../../typescript-migration.md) owns stage status.
The approved execution plan uses isolated packages/configuration only and retains
the maintainer's installed Python product. Recovery is an explicit command;
doctor remains read-only. No release version or tag is assigned here.

## Batches

| Batch | Deliverable | State |
| --- | --- | --- |
| 04-A | Complete responsibility ledger, shared editor rules and production Mod argv binding | DONE; [PR #87](https://github.com/fbincon/claude-code-statusline/pull/87) |
| 04-B | External raw-TTY/VT editor, terminal launchers and result bridge | VALIDATING; `fbincon/ts-04-external-editor` |
| 04-C | Install, uninstall, doctor, ownership and resources | NOT_STARTED |
| 04-D | Persistent transaction checkpoints and explicit recovery | NOT_STARTED |
| 04-E | Installed candidate acceptance, CI, documentation and closure | NOT_STARTED |

## Responsibility and architecture

The [ledger](../../../../tools/migration/ts-04/coverage.json) includes 212 tests
originally assigned to TS-04, 45 complete tests transferred from TS-03 and eight
remaining mixed-test assertions: **265 distinct responsibilities**. Frozen
baseline and TS-03 handoff records remain historical evidence. The new inventory
rejects omitted/duplicate IDs, changed responsibility, missing replacement tests
and undocumented retirement. `--complete` additionally rejects pending entries;
04-A started with 265 pending. 04-B has 152 ported, eight retired with replacement
evidence and 105 pending installation/recovery responsibilities. Platform-specific
tests still require their target CI results; this is not a stage completion claim.

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

## Validation and next work

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

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04
```

Next: complete PR checks for 04-B and implement installation and recovery. The final stage requires
installed-package editor and recovery coverage on the existing target matrix.
Physical/desktop checks already deferred until before release retain that status.
Performance remains in PERF-01; timeout, resource-bound and stability contracts
remain required. Private captures belong under ignored
`dist/validation/typescript-migration/ts-04/`.
