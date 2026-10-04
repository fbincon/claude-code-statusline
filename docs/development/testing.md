# Testing and acceptance

**English** | [简体中文](testing.zh-CN.md)

Run all ordinary validation with temporary Claude configuration. The tests do not install into a user's real settings or call models.

## Local checks

Shared catalog/protocol tests include strict input, Unicode paths and no-live-I/O sample previews. Run `python tools/generate_ui_contracts.py --check` to verify generated TypeScript agrees with Python; the native workflow also runs these contract tests. See [protocol details](contracts.md).

`tests/ui/test_apply_protocol.py` covers complete draft validation before locking, two editors, ownership changes during a lock wait, same-named foreign installs, unrelated settings merges, rollback, v1 migration, repeat saves and CLI/curses/JSON equivalence. It also exercises the installed source CLI with Unicode/special-character paths. Official Mod tests cover process refusal/timeout, invalid envelopes, protocol mismatches, apply results, preview retry, cached redraws and responses finishing after resize or close. Use `{ deny: 'reason' }` to simulate a failed Mod API call; a throwing test stub is skipped by the host.

From the repository root, create a virtual environment and install the project plus development tools:

Editor tests cover all three pages, full saves and new revisions, cancel/reopen, numeric boundaries, narrow panes, catalog exclusions and ordering, actual host rows, locks/refusals/partial success, conflicts, uncertain saves, write locks and stale responses. Run `claude plugin test mods/statusline-native` after preparing exact-host declarations; these checks make no model calls.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e . ruff build
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -t . -v
.venv/bin/ruff check --select F,E9 src tests tools
.venv/bin/python tools/check_docs.py
git diff --check
```

On Windows use `.venv\Scripts\python.exe` and `.venv\Scripts\ruff.exe`. Set `PYTHONUTF8=1` for UTF-8 terminal output. Linux/macOS terminal integration tests require native curses and tmux. Platform-specific skips are reported; a Linux run does not replace Windows or macOS CI.

Tests are grouped by implementation subsystem. CLI, installation and PTY/tmux/shell scenarios live under `tests/integration`; lifecycle and concurrency tests live under `tests/runtime`. `tests/support.py` locates source paths independently of nested test directories. Compatibility tests exercise original module execution paths and shared callable/type identities.

## Installed package checks

The native workflow checks Linux 2.1.287/2.1.288 plus Windows/macOS 2.1.288 with exact-build declarations, official plugin validation/tests and TypeScript. `tools/native_install_smoke.py` validates real official marketplace installation, absolute backend binding, complete protocol saves, repeat install, explicit plugin disable, compatibility restoration and uninstall without credentials/model calls. Opt-in PTY/manual procedures are in [native integration](native.md); callback tests do not establish terminal focus or visual correctness.

Use the [release guide](../RELEASING.md) to build in a fresh directory from a fixed commit. The build job creates local-only fixtures before building, then checks that they are excluded:

```bash
python tools/inspect_dist.py --write-exclusion-fixtures
python -m build
python tools/inspect_dist.py
```

Run fixture creation only in a disposable exported source tree; it refuses existing target files. Inspection also accepts `--source PATH --dist PATH`. It checks version agreement, English README metadata, platform requirements, all Python package files, both skill templates, bilingual documentation, tests and maintenance tools. The wheel must contain exactly the source runtime Mod files and matching resource inventory, excluding tests, development dependencies and host declarations. The sdist includes `src/build_native.py` and developer Mod files so rebuilding produces identical package contents. Local ROADMAP files, acceptance notes, bytecode and caches must be absent.

After installing a wheel in an isolated environment, run outside the source directory with that environment's CLI on PATH:

```bash
python /path/to/source/tools/ci_smoke.py --report /path/to/report.json
```

The smoke suite checks install dry-run, installation, doctor, idempotent reinstall, conflict rollback, rendering and uninstall using temporary paths containing spaces and Chinese characters. macOS desktop acceptance remains opt-in through `tools/macos_terminal_smoke.py` and requires a real Terminal.app session.

## Real timer acceptance

This command makes paid Claude calls. It requires explicit invocation and a total budget; it is never run by ordinary tests or CI:

```bash
.venv/bin/python tools/live_timer_acceptance.py \
  --budget-usd 10 --report-dir dist/validation/live-timer
```

Use a new report directory each time. The Linux tool preserves only authentication, gateway environment and model selection in private temporary configuration, binds the tested CLI explicitly through PATH, and replaces owned lifecycle hooks with a recorder that calls the production reducer. It creates a single-agent case and two parallel-agent cases. Agent probes can run only the requested small sleep commands; they do not need repository data.

Each invocation passes the remaining allowance to Claude's `--max-budget-usd`. Known costs accumulate across cases; when a final cost is unavailable, the entire invocation cap is reserved and the suite stops. Include earlier attempts when choosing the next invocation's budget. Claude's cap includes subagent spend; resumed prior totals do not automatically count, so independent cumulative accounting is required. See the [official CLI reference](https://code.claude.com/docs/en/cli-reference).

The report records OS, Python, package and Claude versions, hook sequence, real agent starts/stops, waiting/wrap-up phases, terminal evidence, native duration availability and frozen production rendering. Raw streams, hook payloads and isolated settings stay in the ignored report directory. Publish only sanitized facts. Print-mode lifecycle acceptance establishes event ordering, not interactive terminal visuals; native duration availability must be reported honestly.

An individual parallel run can finish its agents before the first main Stop and skip waiting. The complete suite still requires at least one real waiting → wrap-up sequence, and every run must preserve the original task and frozen rendering. Captured sessions can be rechecked without paid calls:

```bash
.venv/bin/python tools/live_timer_acceptance.py verify-existing dist/validation/live-timer
```

Timer releases require all applicable gates, including real timer evidence, before publication; this UI promotion does not invoke that paid suite. See the [timer contract](timer.md) and [architecture](architecture.md).

## Client and external-entry checks

v1.3.0 checks all four installation combinations, independent disablement, restoration of old owned external resources, foreign command collisions, reinstall, downgrade and uninstall. Python tests exercise both external/Client save orders, asserting stale drafts cannot overwrite or create backups and unrelated settings survive.

Fixed-host official tests exercise actual Client modules, Space/Tab/arrows, search shortcut isolation, Ctrl+G, numeric boundaries, acknowledged/deduplicated/gapped batches, fast same-frame input, frozen port snapshots, old epochs, repeated opening, saving locks/reconciliation, Client recovery, cached previews and late responses. Layout covers 32×12, grouped borders, CJK and combining characters.

Automated Linux PTYs check initial click, three pages, save/cancel, Esc and continuing the same session at 120×30 docked and 80×48 inline sizes. Persistent mode uses a private tmux server with both entries installed and verifies Client reads a value saved by the original external popup. Run `tools/native_mod_acceptance.py --persistent --report-dir dist/validation/<new-directory>`; keep raw data private and outside distributions. Wheel/sdist/rebuilt-wheel checks verify Client inventories. Ordinary checks make no paid model calls.

On 2026-10-04 the maintainer confirmed a2 Client human acceptance on Linux, Windows and macOS, separately from the earlier a1 result. Stable promotion keeps the accepted interaction; automated checks validate the installation policy and release assets separately. New tests cover both stable defaults, persistent false, boundary versions 2.1.257/258/286/287/288, unknown versions, explicit enablement on old hosts, rollback of version suspension and preserving user plugin disablement. The official installation smoke also checks actual default installation and disablement followed by reinstall. No paid model/timer suite is run.

## Display metric checks and performance

Independent metric tests use fixed clocks, strict missing/zero input, per-scope sources and side-effect-free previews. Git/transcript collectors are lazy and shared within a refresh. Record startup and collection separately using isolated local fixtures (no model calls):

```text
python tools/benchmark_render.py --samples 30 --report dist/validation/display-performance.json
```

The default warm mode primes an isolated bytecode directory once; `--bytecode-mode cold` uses an empty directory without writing bytecode. This makes old/new startup measurements comparable even when source files have changed. Compare P50/P95 on the same machine and Python before/after changes; results include the tested commit. Cold transcript cases use distinct sessions; warm cases reuse state. Treat these small fixtures as a reproducible baseline, not a bound on large repositories or session histories.
