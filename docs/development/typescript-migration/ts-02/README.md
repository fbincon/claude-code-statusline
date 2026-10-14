# TS-02 platform probes and decision evidence

**English** | [简体中文](README.zh-CN.md)

2026-10-14: [Linux integration, physical acceptance and approved release deferrals](LINUX-20261014.md).

Updated: **2026-10-14** (Asia/Shanghai). The [migration plan](../../typescript-migration.md)
owns stage status. TS-02 is **DONE**, D01–D06 are **DECIDED**, and TS-03 is ready
to begin but has not started. Integrated CI and this physical Linux power/desktop
acceptance passed. The maintainer explicitly moved unavailable external physical/
desktop checks to the [release-before checklist](LINUX-20261014.md#approved-stage-and-release-gates);
they remain unverified and platform support promises are unchanged.

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
The initial probe delivery changed no production Python, Mod entry point, package
version, public configuration schema or frozen TS-01 expectation. The Windows
clock correction following the local failure below was explicitly requested by
the maintainer; the immutable oracle and fixed expectations remain preserved.

| Decision | State | Direction and outstanding evidence |
| --- | --- | --- |
| [D01](D01.md) | DECIDED | Node 24.21.0/npm/ESM; 64-bit TS, eight-target native/install matrix and explicit release-before coverage disposition. |
| [D02](D02.md) | DECIDED | Koffi clocks/identities and strict lossless bigint boundary; corrected Windows and real Linux power evidence, macOS guest reboot; physical macOS sleep deferred. |
| [D03](D03.md) | DECIDED | Compatible kernel locks and durable replacement validated on all eight native targets; full store transactions remain TS-03. |
| [D04](D04.md) | DECIDED | Raw TTY/VT/shared Unicode; actual Windows console, macOS Terminal.app/popup and Linux GNOME/popup evidence; remaining external coverage deferred. |
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

Initial probes are tracked in [PR #76](https://github.com/fbincon/claude-code-statusline/pull/76);
[PR #77](https://github.com/fbincon/claude-code-statusline/pull/77) integrates local platform evidence, closes decisions and records final checks/merge/synchronization.
The [initial machine-readable summary](validation.json) records tested commits, hashes,
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

The [2026-10-14 integration](LINUX-20261014.md) closes the amended TS-02 gate:
the repaired matrix and physical Linux sleep/reboot/GNOME/popup pass. Remaining
external coverage is required before a TS release; it is not counted as passed.
Full installation/recovery remains TS-04 and full performance acceptance TS-05.
TS-03 can begin; this probe delivery is not a release.

## Test-tool handoff

The new Python `scripts/oracle.py` is a comparison-only adapter and retires with
the oracle in TS-05. Port `scripts/mod-smoke.py` to the selected Node PTY tooling
in TS-05 while retaining real host process-API coverage. Neither is a production
call-through. The selected render input/output comes from `cli-render-bom`; its
explicit narrow configuration is TS-01 `main-model`, also passed to the Python
configured-rows adapter. This is deliberately not the full default CLI profile.

The initial PR #76 Linux suite had 33 cases: 31 pass and two Windows-only cases skip.
The final probe implementation `1e9b16c` passes the [eight-target CI matrix](https://github.com/fbincon/claude-code-statusline/actions/runs/38161869092):
each POSIX target has 31 passes / 2 skips, each Windows target 25 passes / 8 skips,
with no failures. This includes native Windows architecture evidence and cleanup
after logging failure; the earlier failed attempts remain recorded separately.
The final reviewed head, CI checks, merge commit and Gitee synchronization are
recorded in the PR; earlier receipts are not relabeled as final-head runs.
At that initial delivery, the Python suite passed 819 cases with eight platform skips (827 total).
Both real-host argv probes pass on 2.1.294 and 2.1.296. At that initial delivery, the rebuilt Python wheel
had 217 byte-identical entries relative to TS-01; the expanded source archive
contains the probe and evidence, with dependency/build directories excluded.

The following dated follow-ups preserve their original scope and stage state.
Current decisions and approved release deferrals are recorded above.

## Local Windows follow-up, 2026-10-12

The merged commit `7f2a418` was checked on a physical Windows 11 Home build 26300,
Intel x64 machine with Node 24.21.0, npm 11.19.0 and Python 3.14.4. The
[local machine summary](validation.windows-local-20261012.json) binds results to
raw logs and hashes. Production sources, the TS-01 oracle and performance budgets are unchanged.

- Elevated Windows run: 25 passes and 8 platform skips out of 33; the complete
  installation probe and receipt verifier pass. The initial unprivileged result
  remains 24 passes / 1 failure / 8 skips: creating the file-symlink fixture raised
  `EPERM`. That failure was neither skipped nor resolved by changing system policy.
  PowerShell / Git Bash installation entry points and a separate directory-junction
  check pass; the existing `.cmd` special-path failure remains recorded.
- Local WSL2 Ubuntu 24.04.4 x64: 31 passes / 2 platform skips, with installation
  and receipt verification passing. This covers native APIs, PTYs and tmux sessions,
  without claiming GUI or popup human acceptance.
- Python: 799 passes / 28 platform or permission skips out of 827; all five shared
  resource checks, Ruff and Windows curses checks pass. Both Mods pass official
  validation, 112 + 10 tests and installation smoke on 2.1.294 and 2.1.296.
  Exact declarations and typechecking pass only on 2.1.294; the 2.1.296 gap is unchanged.
- Human-operated Windows console: all arrow keys, CJK / combining characters /
  emoji, small and normal window sizes, Ctrl+S / Ctrl+C, recovery after a logging
  failure and visual confirmation are complete. Two incomplete attempts remain;
  cumulative acceptance is checked against their original events and the follow-up.
- Fixed minimal-render performance: 600 render samples and 200 control samples;
  all six warm/cold latency and RSS metrics pass without budget changes or repeats.
  Warm Python / TS P50 is 275.46 / 119.60 ms; cold P50 is 425.74 / 112.98 ms.
- Physical S0 Modern Standby / resume passes: OS events establish about 60.48 seconds
  in standby, the boot identity stays unchanged, and both Node and the fixed Python
  oracle include sleep in their boot clocks. This host does not cover S3 or
  hibernation.
- **Physical reboot acceptance fails:** shutdown/startup events at 04:01 on
  2026-10-12 (Asia/Shanghai), together with uptime falling from 2059.515 to
  160.312 seconds, establish a real restart. However, Node and the frozen Python
  reference retain exactly the same `boot_id`. An independent ctypes query also
  returns that GUID. Replaying the captured pair through both unchanged clock
  implementations yields an unavailable elapsed delta. Candidate/reference parity
  does not establish reboot identity. The public summary retains results and
  evidence hashes; the separate evidence archive retains the full diagnosis and
  raw snapshots. That validation run changed neither production code nor TS-01 expectations.

Applicable local verification has finished with the explicit failure above;
this is not an all-pass acceptance. This record is limited to this Windows x64 host and its WSL environment. Other
targets and GUI / popup gates remained outstanding at this historical checkpoint.
TS-02 was VALIDATING, D01/D02/D04 were OPEN and TS-03 was NOT_STARTED; the current
disposition is the 2026-10-14 Linux integration above.

## Windows reboot identity correction

The maintainer subsequently requested a fix for the failure above. Working Python
clock sources and the TS probe implement [D02's v2 boot identity and legacy
degradation rules](D02.md#windows-boot-identity-v2-correction). The [new fix record](validation.windows-boot-fix-20261012.json)
is separate from the historical validation: failed receipts and the frozen TS-01
oracle are retained, and the real reboot sample is a regression fixture. This
correction neither releases a product nor starts TS-03. Physical revalidation
and outstanding evidence for other platforms are recorded separately.

The corrected S0 standby/resume check passes, with an OS event interval of about
112.70 seconds. Both implementations retain boot sequence 1301 and pass
suspend-aware elapsed/trusted-domain checks. A subsequent real reboot changes
both Python and Node sequences from **1301 to 1302**. Cross-boot elapsed falls
back to wall-clock difference with execution coverage degraded. Source/runtime
hashes and OS startup events verify successfully; the Windows blocker is fixed
and physically verified on this host.

The corrected Python suite has 806 passes / 28 skips out of 834. The Windows
probe has 27 passes / 8 skips; WSL has 33 passes / 2 skips. Installation and
receipt checks pass. Another 600 render and 200 control samples satisfy the
unchanged budgets. The original failure and the initial test failure involving
an outdated mock remain preserved, without relabeling them as passing runs.

## Windows to macOS to Linux handoff

The [2026-10-13 handoff manifest](handoff.windows-20261013.json) pins the local
implementation commit and Windows evidence archive hash. The two committed Windows
JSON files are public summaries (schema 2). Full records, historical failures and
tested source bytes are in the separate, untracked
`dist/handoff/ts02-windows-20261013/windows-evidence.zip`. Its adjacent
`verify_handoff.py` verifies the ZIP and its files with Python on any platform;
it never executes archived code. Original receipts still identify their tested
`7f2a418` base plus dirty worktree and source hashes; they are not relabeled as
new runs of the subsequent local commits.

Copy `.git`, every committed file and the entire
`dist/handoff/ts02-windows-20261013/` directory. That directory also contains an
offline Git bundle, final revision/checksum metadata and a macOS task handoff.
Windows dependencies, environments, runtimes and generated directories remain
platform-specific. Install the pinned native dependencies and rebuild on macOS.
For a clean native checkout, clone the bundle into a new directory while retaining
the original copied directory and evidence archive.

Use a new macOS branch/output directory to validate this revision, recording host
and process architecture, native APIs, real sleep/reboot, Terminal.app launch/focus,
keys/resize/recovery and supported tmux popup behavior. The Windows power-check tool
does not apply to macOS. Commit additional fixes and summaries separately; retain
raw macOS evidence without overwriting Windows records or moving the TS-01 oracle.

Linux then integrates the commits through Git, preserves both platforms' evidence,
assesses any macOS changes against the Windows results, runs the updated full matrix,
and finishes Linux GUI/popup and support-scope dispositions. Update TS-02/TS-03
state only after the remaining foundational gates are closed.

The [2026-10-14 macOS acceptance](MACOS-20261014.md) covers a macOS 14.5 x86_64 VMware guest:
automatic checks, fixed budgets, human Terminal/popup and a real guest reboot have evidence;
sleep was explicitly skipped by the maintainer. The POSIX host-probe cleanup fix, original incomplete
attempts and supplements remain distinct. Physical-hardware and global gates stay open for Linux aggregation.
