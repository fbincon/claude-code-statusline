# TS-05 tooling, CI and engineering candidate

**English** | [简体中文](README.zh-CN.md)

State: **IN_PROGRESS**, 2026-10-16 (Asia/Shanghai). Worker: Codex.
Branch: `fbincon/ts-05-candidate`. The [migration plan](../../typescript-migration.md)
owns stage status. The approved deliverable is one universal offline engineering
candidate, verified CI artifacts and an isolated in-repository Python archive.
Public tags, preview/stable publication and the remaining physical/desktop gates
belong to TS-06. The installed Python product remains intact.

## Batches

| Batch | Deliverable | State |
| --- | --- | --- |
| 05-A | Existing Windows ARM failure and complete responsibility ledger | VALIDATING; diagnostics in [PR #92](https://github.com/fbincon/claude-code-statusline/pull/92), final Windows acceptance pending |
| 05-B | Maintained tools and Python-free test replacements | DONE; [PR #93](https://github.com/fbincon/claude-code-statusline/pull/93), all 43 checks passed |
| 05-C | Reproducible universal offline candidate | VALIDATING; two local builds identical |
| 05-D | CI cutover and Python archive | VALIDATING; independent historical verification passed |
| 05-E | Candidate acceptance, documentation and closure | IN_PROGRESS; final target CI pending |

## Responsibility baseline

The [snapshot](../../../../tools/migration/ts-05/snapshot.json) pins pre-TS-05
commit `748cc79840cd08280da4ab7ab8ef3dea7dee9873`: 856 Python test methods,
62 tool/build entry files and all 318 Python source file hashes. These are static
inventory counts, not executed-test results. The frozen v2.0.0 oracle and its
161 cases remain unchanged.

The [ledger](../../../../tools/migration/ts-05/coverage.json) inherits 715 ported
tests and 13 justified retirements from TS-03/04. Initially 128 tests and 62 tools
remain pending. Each remaining responsibility needs verified replacement evidence
or a named historical/retirement disposition. Archiving alone does not establish
parity. `npm run migration:inventory:ts05 -- --complete` rejects pending entries.

## Windows ARM entry failure

The pre-TS-05 main-branch [run](https://github.com/fbincon/claude-code-statusline/actions/runs/38765422139/job/116527230758)
passed nine of ten installed tests; the PowerShell shell case returned a null
exit status after about 21 seconds. The original report omitted the process error
and signal, so its root cause cannot be determined from that assertion alone.
The harness now closes stdin explicitly, runs PowerShell noninteractively and
records executable, operation, elapsed time, timeout, exit status, signal, error
code and stderr. The 20-second shell bound and exact stdout assertions remain.
The first diagnostic run identified `ETIMEDOUT`/`SIGTERM`, not a renderer exit.
The isolated HOME is now created before shell startup; the script reads input
before entering the PowerShell pipeline and records four checkpoints. The
[Windows ARM rerun](https://github.com/fbincon/claude-code-statusline/actions/runs/38780352740/job/116578626507)
passed all ten installed tests at `665f273`: first PowerShell render 14,788 ms,
subagent render 1,387 ms, both with all checkpoints complete. This was an initial
passing run, not proof of a stable startup fix.
All four PR workflows passed; duplicate push runs were cancelled, not counted
as passes. PR #92 merged as `bc424e3ec8e4734b7c29bbf734b9328ecfc42ba3`.

The [05-B ARM rerun](https://github.com/fbincon/claude-code-statusline/actions/runs/38785440463/job/116596113070)
later failed before the first script checkpoint. An empty command under the
fabricated user profile also timed out; OS-profile startup and direct Node
diagnostics succeeded. PowerShell now bootstraps with valid OS profile folders
under `-NoProfile`, restores isolated product paths inside the command and retains
the existing timeout. Final cross-platform confirmation is pending.

The shared-candidate [run at `bfd4639`](https://github.com/fbincon/claude-code-statusline/actions/runs/38794199753)
passed twenty jobs but both Windows shell cases timed out after `encoding`, before
`read`; empty startup probes passed. Preserving cache folders alone did not fix
the command-module lookup. The harness now explicitly loads the built-in Management
module needed by npm's unchanged `.ps1` shim, keeps valid OS folder variables and
reads input with `.NET File.ReadAllText` so shell metacharacters remain literal.
It removes inherited PowerShell 7 module paths in accordance with
[Microsoft's startup documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath).
The next run reached `read` but native stdin formatting still stalled. PowerShell's
[native command processor](https://github.com/PowerShell/PowerShell/blob/master/src/System.Management.Automation/engine/NativeCommandProcessor.cs)
also invokes Utility's `Out-String`; both system modules are now explicit and
automatic module search is disabled so a missing dependency fails immediately.
All module loading remains within the same 20-second bound; CI verification is pending.

## Completion gates

Normal build/test/generation/documentation/candidate workflows must require no
Python. Preserve native concurrency, failure/recovery and terminal tests; fixed
oracle outputs retain source/runtime/harness hashes. Two clean builds of a fixed
commit must produce identical candidate bytes. All eight target installations
and thirteen fixed-host combinations consume that same artifact. Keep exact-build
type checks where available and retain the 2.1.296 declaration limitation.

Do not change display schema 8, UI protocol 11, runtime protocol 2/v1 compatibility
or task schema 4. D06's historical FAIL remains; PERF-01 follows TS-06. Ordinary
acceptance makes no paid model calls. Raw evidence stays under ignored
`dist/validation/typescript-migration/ts-05/`.

## 05-A local validation

Node 24.21.0/npm 11.19.0: 864 TS tests, 861 passed and three Windows-only
skips; all ten separately installed tests pass. Fifty generated resources and
1,714 documentation links/bilingual pairs pass. Target CI passed as recorded above.

## 05-B implementation evidence

The ordinary suite uses twelve hash-locked Python 3.14.4 expectation files for
numeric, Unicode, JSON, CLI and state parity. Their reference and capture commits
remain recorded. Real Node child processes still exercise locking, killed writers,
atomic replacement and terminal recovery. Python comparisons remain a separate
historical responsibility until the archive runner is completed in 05-D.

Maintained Node tools now cover documentation links, release Markdown/Gitee notes,
exact-host Mod type preparation, terminal capture reconstruction, manual terminal
and power evidence, descriptive benchmarks and explicitly budgeted acceptance.
`tools/acceptance/package.json` pins the optional SDK to the 2.1.296 host; it is
excluded from ordinary dependency installation and product packaging. New calls
require `--run-real-calls`, a new evidence directory, and the existing shared
USD 10 ledger. Unknown cost reserves the full cap and blocks another call.

Local evidence: 918 tests, 915 passed / three Windows-only skips with a preload
that rejects Python/compiler subprocesses; thirteen small-profile benchmark
fixtures validated without a D06 measurement. Copies of existing single/parallel
task records and single-agent/parallel metrics records revalidated with Node
(respectively 5/7 requests and 1/2 agents). No paid calls or physical acceptance
claims were made. Candidate packaging, remaining ledger mappings and CI/archive
cutover were still pending at this batch checkpoint.

## 05-C/05-D local validation

The [candidate guide](candidate.md) is the current development/build/installation
entry. The ledger is closed: **808 ported / 19 retired / 29 historical tests**,
and **45 replaced / 17 historical tools**. Every original responsibility remains
listed. Historical entries execute through the independent reference runner;
moving their files alone does not establish parity.

At source `38ff85b75c936201764c64f80b8fff96f091e176`, two clean builds produced
the same 3,317,861-byte universal package, SHA-256
`f72e8a04e17e22c3a0a4dddbc9468cdb441b0bf741d335fa34c96a93aab17a7f`.
All ten outside-checkout installed tests passed with an empty npm cache, offline
mode, disabled lifecycle scripts and a Node-only PATH. Local official host
2.1.294 passed both Mods, exact-host types and installed binding; 2.1.296 passed
both Mods and binding with its declaration gap explicitly unavailable.

After archive cutover, local `check` passed **932 tests: 929 pass, three Windows
skips**, 33 active generated resources and 1,729 documentation links; the later
PowerShell bootstrap regression also passed locally. Archive validation checked
318 Python sources and 361 mapped files. Independent reconstruction ran all
856 Python tests (nine platform skips), 161 frozen cases, twelve exact oracle
recaptures, real mixed-version locks and Python-compatible rollback successfully.
No paid session or full D06 measurement ran. Final CI and main/Gitee synchronization
remain required before TS-05 can be marked DONE.

At `bfd4639`, a restricted PATH containing Node, Git, shell utilities and tmux,
but no Python or compilers, passed **936 tests: 933 pass / three Windows skips**,
33 generated resources and 1,731 documentation links. Two builds from the CI
source archive exactly matched CI's candidate, source archive, build manifest and
checksums: candidate SHA-256 `5cff3e20d248bfc575fa00ae77e2fda335bdd1d26797458713cc496cd49b6c69`.
The initial restricted PATH lacked Git's POSIX helper utilities; that failed
environment probe was corrected before this passing run and is not counted as a pass.
