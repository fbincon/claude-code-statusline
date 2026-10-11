# TS-02 platform probes and decision evidence

**English** | [简体中文](README.zh-CN.md)

Updated: **2026-10-12** (Asia/Shanghai). The [migration plan](../../typescript-migration.md)
owns stage status. TS-02 is **VALIDATING**, not DONE; TS-03 has not started.
The approved scope allows automated validation first and explicitly retains
unverified physical/desktop gates. Preferred designs do not close missing evidence.

## Deliverables and decisions

The private [probe package](../../../../tools/migration/ts-02/package.json) uses
Node **24.21.0**, npm (local **11.19.0**), TypeScript **5.9.3**, Koffi **3.3.3**
and lossless-json **4.3.1**. Runtime archives are pinned by official SHA-256;
npm dependencies by exact versions and lockfile integrity. Both new dependencies
are MIT. Copied Unicode sources and licenses are build artifacts; their original
owners remain unchanged. Actual npm archives, MIT licenses and lockfile SHA-512
were reviewed for both libraries and four target prebuilt packages. Koffi places
its binaries in the corresponding optional `@koromix/koffi-*` package; Windows
ARM uses the x64 package. See [Koffi support](https://koffi.dev/) and the
[lossless JSON interface](https://github.com/josdejong/lossless-json).
No production Python, Mod entry point, package version,
public configuration schema or frozen TS-01 expectation is changed.

| Decision | State | Direction and outstanding evidence |
| --- | --- | --- |
| [D01](D01.md) | OPEN | Node 24/npm/ESM; 64-bit future TS release. Native installation matrix passes; WSL/older desktop coverage remains unresolved. |
| [D02](D02.md) | OPEN | Native OS clocks/identities and lossless integer literals. Physical suspend/reboot evidence remains missing. |
| [D03](D03.md) | DECIDED | Compatible kernel locks and durable replacement validated on all eight native targets; full store transactions remain TS-03. |
| [D04](D04.md) | OPEN | Raw TTY/VT/shared Unicode. Real Windows keys, GUI launch/focus and tmux popup evidence remain missing. |
| [D05](D05.md) | DECIDED | npm entry retirement, argv-prefix binding and transactional upgrade strategy fixed; complete implementation remains TS-04. |
| [D06](D06.md) | DECIDED | Budget frozen before measurement; minimal render is measured separately from full migration acceptance. |

The maintainer approved a future major-release transition away from Windows x86,
Python imports, `python -m`, pipx installation and the old Windows `.exe` name.
Historical Python releases remain available for existing users and compatible
rollback; this does not promise a newly maintained legacy branch. The root README
continues to describe the current released Python product.

## Reproduce

Use the exact locked Node and a Python 3.14.4 interpreter for the test-only oracle.
`TS02_PYTHON` may select its absolute path. Run from the repository root:

```bash
npm ci --prefix tools/migration/ts-02 --ignore-scripts --no-audit --no-fund
npm run --prefix tools/migration/ts-02 build
npm run --prefix tools/migration/ts-02 typecheck
npm test --prefix tools/migration/ts-02
npm run --prefix tools/migration/ts-02 probe -- /absolute/new-evidence-directory
npm run --prefix tools/migration/ts-02 verify-evidence -- /absolute/new-evidence-directory/evidence.json
npm run --prefix tools/migration/ts-02 benchmark -- /absolute/new-benchmark-directory
```

Choose new output directories; existing directories are refused. POSIX terminal
tests require tmux. The candidate installation uses only Node/npm and prebuilt
native modules; Python is exclusively a reference/test adapter at this stage.
`exportReference` reads immutable Git blobs from `9b6d2fa`, avoiding checkout or
archive newline conversion. Do not change the TS-01 reference to fix a probe.

For a free, real-host argv smoke on Linux/macOS, run the test-only helper with
absolute paths to a fixed Claude host and the locked Node executable:

```bash
python tools/migration/ts-02/scripts/mod-smoke.py --claude /path/to/claude --node /path/to/node --output /absolute/new-mod-evidence-directory
```

It creates temporary copies of both Mods with an additional `backendArgs`
manifest field (`type: string`, `multiple: true`). A synthetic key and unreachable
loopback API prevent model calls; only a local slash command is sent. Receipts
must include **both** `ui` and `runtime`. This proves actual process invocation,
not complete backend responses, editor parity or human visual acceptance.

## Evidence and limitations

Delivery is tracked in [PR #76](https://github.com/fbincon/claude-code-statusline/pull/76).
The [machine-readable summary](validation.json) records tested commits, hashes,
counts and CI links. Raw logs remain in ignored
`dist/validation/typescript-migration/ts-02/`; native CI uploads per-target receipts.
Each receipt binds source and policy hashes, test counts, installed tarball hash,
host/process architecture and log hashes. Verification rejects missing logs,
changed budgets, changed sources, tampered captures and inconsistent counts.

The matrix retains the existing Python and both-Mod checks and adds Linux x64,
Windows x64, **x64 Node/Python on Windows ARM**, macOS 14 ARM, and macOS 15/26
Intel/ARM, using the [GitHub runner labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). A process architecture alone is not the physical host architecture;
both are recorded. POSIX PTYs on Windows are explicit skips. PowerShell and Git
Bash installation shims are separate checks; `.cmd` is not used as the Mod's
shell-free executable.

Important findings retained rather than normalized away:

- `lossless-json` accepts equal duplicate keys even with a duplicate callback.
  The strict adapter uses native source lexemes plus explicit key scanning.
- Windows can expose an exited process's creation token while handles keep its
  process object alive. Identity is not liveness. The launcher prototype checks
  process state separately; the frozen Python token is not silently redefined.
- Integer-only canonical hashing matches Python; arbitrary float canonicalization
  is explicitly unsupported by the probe and must be completed during TS-03.
- The minimal render compares a configured-rows adapter serialized as UTF-8 LF
  with the canonical Linux TS-01 output. This is not a claim about every Windows
  production CLI newline or diagnostic.
- Kill-before/after-replace tests establish complete old/new bytes and lock
  release, not power-loss durability. Orphans left by abrupt death are cleaned
  only inside the isolated test directory.
- GNOME argv and macOS command-file tests establish construction, not desktop
  launch/focus. A new Windows console/raw-mode probe is distinct from keyboard,
  resize and visual acceptance. tmux session launch is distinct from popup focus.

The existing declaration boundary is preserved: 2.1.294 generates exact-build
official declarations and typechecks both Mods. Version 2.1.296 loads, tests and
installs Mods, but the current generation flow does not emit its declarations;
no exact-build typecheck pass is claimed. Real argv receipts do not fill that gap.
See [Native Mod CI](../../../../.github/workflows/native.yml).

## Performance interpretation and next gate

The policy was committed at `3c448b8` before the first implementation measurement.
The minimal profile reads and validates a supported model configuration, parses
the actual stdin, clips through the fixed Unicode kernel and emits ANSI. Mutated
input changes output; unsupported profiles fail instead of silently dropping
production behavior. Both sides start a fresh process and assert matching bytes.

The 600-sample comparison at `f891065` (plus 200 startup control samples)
passed its fixed latency/RSS budgets, but Node's
peak RSS was close to the allowed Python-plus-32-MiB limit. It is a feasibility
result for **one minimal profile**, not a whole-backend speedup or memory claim.
The complete collector/Agent/hook/in-process matrix remains unmeasured. New
measurements preserve prior raw results and the frozen budget.

The values below are medians of the three round statistics; latency is in ms
and RSS in MiB. The machine-readable summary retains the per-metric dispositions.

| Python bytecode | Python / TS P50 | Python / TS P95 | Python / TS peak RSS | TS RSS limit |
| --- | --- | --- | --- | --- |
| Warm | 106.59 / 40.75 | 115.31 / 47.54 | 26.52 / 58.19 | 58.52 |
| Cold | 233.46 / 41.33 | 245.48 / 47.67 | 27.68 / 58.23 | 59.68 |

Required follow-up: supply physical suspend/reboot, WSL, Windows desktop keyboard/resize, macOS 14 Intel and
GUI terminal/popup evidence. Keep affected decisions OPEN and TS-03 NOT_STARTED
until the foundational gates are satisfied or the maintainer explicitly resolves
a support change. Full installation/recovery remains TS-04 and full performance
acceptance remains TS-05; this probe delivery is not a release.

## Test-tool handoff

The new Python `scripts/oracle.py` is a comparison-only adapter and retires with
the oracle in TS-05. Port `scripts/mod-smoke.py` to the selected Node PTY tooling
in TS-05 while retaining real host process-API coverage. Neither is a production
call-through. The selected render input/output comes from `cli-render-bom`; its
explicit narrow configuration is TS-01 `main-model`, also passed to the Python
configured-rows adapter. This is deliberately not the full default CLI profile.

The current Linux suite has 33 cases: 31 pass and two Windows-only cases skip.
The final probe implementation `1e9b16c` passes the [eight-target CI matrix](https://github.com/fbincon/claude-code-statusline/actions/runs/38161869092):
each POSIX target has 31 passes / 2 skips, each Windows target 25 passes / 8 skips,
with no failures. This includes native Windows architecture evidence and cleanup
after logging failure; the earlier failed attempts remain recorded separately.
The final reviewed head, CI checks, merge commit and Gitee synchronization are
recorded in the PR; earlier receipts are not relabeled as final-head runs.
The existing Python suite passes 819 cases with eight platform skips (827 total).
Both real-host argv probes pass on 2.1.294 and 2.1.296. The rebuilt Python wheel
has 217 byte-identical entries relative to TS-01; the expanded source archive
contains the probe and evidence, with dependency/build directories excluded.
