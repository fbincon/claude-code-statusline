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
| 04-A | Complete responsibility ledger, shared editor rules and production Mod argv binding | VALIDATING; `fbincon/ts-04-editor-foundation` |
| 04-B | External raw-TTY/VT editor, terminal launchers and result bridge | NOT_STARTED |
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
04-A intentionally has 265 pending and does not claim editor/install parity.

`core/editor` now owns the reusable draft, instance, search, numerical controls,
guidance, import-review and protocol-response logic. The generator copies these
pure modules into self-contained Mod resources and checks drift. Node and both
Mods share the same pure argv binding. `backendArgs` is an optional string-array
manifest field; absence means a legacy executable with no prefix. Executable
environment overrides replace the entire binding. Host calls stay in hooks.

## Validation and next work

04-A local checks: Node 24.21.0/npm 11.19.0; TS 560 passed / 1 platform skip;
Claude Code 2.1.296 native Mod 114/114 and runtime Mod 12/12; both strict validators
and existing declaration typechecks passed. A 2.1.296 test is not an exact-build
declaration check. All 46 generated resources and the existing 516-ID TS-03 audit
pass. Final tested/merged commits and CI evidence will be recorded before closure.

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04
```

Next: complete PR checks for 04-A, then implement 04-B. The final stage requires
installed-package editor and recovery coverage on the existing target matrix.
Physical/desktop checks already deferred until before release retain that status.
Performance remains in PERF-01; timeout, resource-bound and stability contracts
remain required. Private captures belong under ignored
`dist/validation/typescript-migration/ts-04/`.
