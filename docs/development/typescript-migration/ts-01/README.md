# TS-01 frozen reference and behavioral inventory

**English** | [简体中文](README.zh-CN.md)

The [migration plan](../../typescript-migration.md) owns stage status. This record
explains the frozen reference, portable cases, verification and evidence. TS-01
does not implement a TypeScript backend or decide D01–D06.

## Reference and coverage

The Python oracle is **v2.0.0**, commit
`9b6d2fab4bf165be280d428a874521bfbf02c7e1`. GitHub `main` matched that commit
when implementation started on 2026-10-11 (Asia/Shanghai). The reference is kept
in Git, exported into an isolated tree when needed. Production code and package
versions are unchanged by this stage.

The [baseline inventory](../../../../tests/fixtures/migration/ts-01/baseline.json)
records 153 source Python files, 96 test Python files, **815 static test methods
and 815 discovered test IDs**, 42 Python tool files plus the build entry, 24
existing TypeScript test modules, public command/argument trees, environment
reads, protocols and persistence versions. Static counts are not test results.
Every Python module/test has a behavior family, disposition, reason and stage;
test-module production imports link assertions to source boundaries.

Join `behavior` on module/test/tool rows to `behaviors[].id`, and then to
`cases[].behaviors` in the [case definitions](../../../../tests/fixtures/migration/ts-01/cases.json).
The family supplies the contract document and migration stage. A case is additional
replay evidence, not a claim that its family or all 815 tests have already been
ported. Native test modules remain in TypeScript and retain their existing checks.

Dispositions are `port_behavior`, `reuse_fixture`, and `retire_python_detail`.
Only the Python forwarded-object identity assertion is classified for retirement;
its D05 dependency remains open. Module execution and user-facing compatibility
still require explicit transition decisions. No test is deleted by TS-01.
Generated resources remain data to reproduce, not completed backend migration.
Every existing tool has a replacement capability and stage; new TS-01 tools are
also inventoried for TS-05. Benchmark scripts stay available as comparison
references during migration.

The [platform inventory](../../../../tests/fixtures/migration/ts-01/platforms.json)
separates advertised support, configured CI, local evidence and remaining gaps.
Windows x86, WSL, macOS 14 and real desktop/suspend cases are not inferred from
other runners. Windows native ARM64 Python remains outside the existing support
contract; x64 emulation is a distinct supported configuration awaiting probe evidence.

## Fixed cases and comparison rules

The corpus contains **161 synthetic cases** and 84 complete configurations:

- Separate sample previews for all 62 main and 16 subagent catalog types.
- Production main/subagent rendering in all five languages at 40/80/120 columns,
  including duplicate instances, literal CJK/combining/emoji text, a spacer and
  ANSI/Powerline output.
- CLI streams/exits and quiet malformed input; editor/runtime envelopes,
  duplicate fields, versions, missing/null/zero values and runtime v1 reads.
- Display schemas 1–8, disabled-option retention, portable export/import/review,
  a successful save, exact revisions, stale-save rejection, backups and opt-outs.
- Task continuation, parallel agents and report delivery, interruption/failure,
  late native duration, frozen values, overlapping waits, reboot degradation,
  integer nanoseconds above JavaScript's safe range and UTF-8 byte cursors across
  append, partial lines, truncation and replacement.

Inputs are JSON, including raw request strings for malformed JSON. The
[expected results](../../../../tests/fixtures/migration/ts-01/expected.json)
retain text/ANSI bytes, structured responses, file contents and lifecycle state.
Comparison ignores object-key ordering only for parsed objects; lists, string
contents, types, missing fields, booleans, integers and null remain exact.
JSON contained inside a wire string or persisted-file snapshot is byte-sensitive.
TypeScript consumers must preserve integer lexemes before constructing `bigint`;
`JSON.parse` followed by `BigInt` would already have rounded large values.

Each case runs in a new child process with independent temporary configuration,
runtime and session directories. The child receives no model credentials and no
host executables on PATH (only an isolated reference CLI launcher). Time, home, host version and cursor filesystem identity
are explicit injected observations in the case definitions. Only the temporary
case-root prefix becomes `<CASE>` in output. Revisions and numeric fields are
never normalized. The fake backend path is `/ts01/claude-statusline`.

Configuration snapshots expose existing lock-file creation where it occurs;
“read-only” means user configuration bytes are not rewritten, rather than hiding
the lock artifact. Cursor identity and modification time are injected before
calling production code; their persisted fields are retained in results.

The canonical replay environment is Linux/Python 3.14.4. Other platform behavior is
covered by the existing native CI matrix, not a claim that every POSIX fixture
has identical Windows bytes. Python adapters call the frozen production boundaries;
the future TypeScript adapter must consume the same inputs and return the same
observable results without importing Python.

## Reproduce and review

Use a development virtual environment with the repository installed and the
existing test dependencies (`wcwidth==0.9.1`, `pyte`). Run from the repository root:

```bash
python -m tools.migration inventory --output /tmp/ts01-inventory-new.json
python -m tools.migration capture --output-dir /tmp/ts01-capture-new
python -m tools.migration verify --capture-dir /tmp/ts01-capture-new
python -m tools.migration verify
python -m unittest tests.migration.test_baseline -v
```

Choose new output paths. `inventory` refuses an existing output file; `capture`
refuses an existing directory. Without `--source-root`, tools export the exact Git
commit into temporary storage. `--source-root PATH` accepts an existing reference
export only after byte checks; changed, missing or extra Python modules are
rejected. `--python PATH` selects an interpreter while retaining virtual-environment
identity. Python 3.14.4 is required for the canonical byte-level replay. The first CI run on
3.14.8 differed in two argparse diagnostic strings; the dedicated job now pins
the reference interpreter and uploads synthetic captures for inspection. Other
supported Python versions remain in the ordinary CI matrix. The fixed commit must be available locally; the dedicated CI job fetches
history explicitly.

The [lock](../../../../tests/fixtures/migration/ts-01/lock.json) fixes fixture and
adapter hashes. `verify` checks the lock, recomputes the inventory, checks discovered
test coverage and either replays cases or verifies a saved receipt and output.
It exits nonzero on differences and **never updates expectations**. Tests ensure
the verifier rejects missing mappings, wrong commits, modified inputs, changed
outputs and numeric/type coercion; two captures use different temporary roots.

To intentionally change the reference or adapter, document the reason and affected
contracts in the migration plan, retain the old revision in history, capture into
new directories, inspect differences and rerun affected validation before explicitly
replacing reviewed JSON/lock files. There is no automatic “accept all” switch.

Performance source files and parameters are frozen in the inventory: 50 samples,
three alternating rounds, small/medium/large profiles and cold/warm bytecode. No
new performance claim or acceptance budget is made here; measurement, RSS gaps
and D06 decisions belong to TS-02.

## Validation and limitations

Fresh reference validation on Linux x86_64 / Python 3.14.4:

| Check | Result |
| --- | --- |
| Reference unittest suite | 815 run: 807 passed, 8 expected native Windows/macOS skips |
| Ruff F/E9 | Passed with `--no-respect-gitignore` for the exported tree |
| Generated i18n, Unicode, UI contracts, editor fixtures, runtime contracts | All five `--check` commands passed |
| Reference documentation | Relative links and bilingual pairs passed |
| Wheel/sdist inspection and strict Twine metadata | Passed; 217 wheel / 741 sdist entries |
| Installed wheel CLI smoke outside source | Install dry run, repeat install, ownership conflict/rollback, rendering and uninstall passed |
| Native/runtime Mod tests on each of 2.1.294 and 2.1.296 | 112 native + 10 runtime passed per host |
| Exact-build declarations and both typechecks, 2.1.294 | Passed |
| Both official installation/bridge smokes, both hosts | Passed; no model calls |
| Corrected external TUI script | All five existing sizes passed |
| Installed grapheme/style PTYs | Six cases passed |
| Persistent native composition PTYs on 2.1.296 | English/Chinese at 120×30 and 80×48 passed |

Validation summaries, dependency versions, hashes and subsequent CI evidence are
in [validation.json](../../../../tests/fixtures/migration/ts-01/validation.json).
Private raw logs and captures remain under a new ignored
`dist/validation/typescript-migration/ts-01/` run directory. Reports are evidence of
automated checks, not human visual acceptance.

Two existing-tool issues have explicit dispositions:

1. The original external TUI script waited for the internal `current-dir Priority`
   label although the screen displayed `Directory Priority`. The corrected tool
   uses presented labels and passes all five sizes against the unchanged reference
   wheel. The original failure remains recorded; it is not a production defect or
   a silently moved reference.
2. The legacy native PTY tool records the caller's enclosing Git checkout identity
   when invoked from an archive nested under that checkout. Its raw `commit` and
   dirty flag therefore describe the caller. The validation receipt separately binds
   the checked source and installed wheel hashes to the reference commit. Do not
   use that legacy field alone to identify the tested package.

Claude Code 2.1.296 has runtime/installation checks but no exact-build declaration
coverage through the current preparation flow. The agreed TS-01 scope excludes
new paid model calls and cross-platform human desktop acceptance. Physical sleep,
reboot, power-loss durability and uncovered architecture/terminal combinations
remain explicit TS-02/TS-06 work. D01–D06 remain OPEN.
