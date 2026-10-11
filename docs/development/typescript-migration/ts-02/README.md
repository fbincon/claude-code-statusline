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
owners remain unchanged. No production Python, Mod entry point, package version,
public configuration schema or frozen TS-01 expectation is changed.

| Decision | State | Direction and outstanding evidence |
| --- | --- | --- |
| [D01](D01.md) | OPEN | Node 24/npm/ESM; 64-bit future TS release. Close native installation matrix and explicitly resolve WSL/older desktop coverage. |
| [D02](D02.md) | OPEN | Native OS clocks/identities and lossless integer literals. Physical suspend/reboot evidence remains missing. |
| [D03](D03.md) | OPEN | Compatible kernel locks and durable replacement; native Windows matrix is required before closing. |
| [D04](D04.md) | OPEN | Raw TTY/VT/shared Unicode. Real Windows keys, GUI launch/focus and tmux popup evidence remain missing. |
| [D05](D05.md) | OPEN | npm entry retirement, argv-prefix binding and transactional upgrade strategy; finish installed-shell/host evidence. |
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
Intel/ARM. A process architecture alone is not the physical host architecture;
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

## Performance interpretation and next gate

The policy was committed at `3c448b8` before the first implementation measurement.
The minimal profile reads and validates a supported model configuration, parses
the actual stdin, clips through the fixed Unicode kernel and emits ANSI. Mutated
input changes output; unsupported profiles fail instead of silently dropping
production behavior. Both sides start a fresh process and assert matching bytes.

The first 600-sample comparison passed its fixed latency/RSS budgets, but Node's
peak RSS was close to the allowed Python-plus-32-MiB limit. It is a feasibility
result for **one minimal profile**, not a whole-backend speedup or memory claim.
The complete collector/Agent/hook/in-process matrix remains unmeasured. New
measurements preserve prior raw results and the frozen budget.

Required follow-up: finish all automated native/install checks, then supply
physical suspend/reboot, WSL, Windows desktop keyboard/resize, macOS 14 Intel and
GUI terminal/popup evidence. Keep affected decisions OPEN and TS-03 NOT_STARTED
until the foundational gates are satisfied or the maintainer explicitly resolves
a support change. Full installation/recovery remains TS-04 and full performance
acceptance remains TS-05; this probe delivery is not a release.
