# Testing and acceptance

**English** | [简体中文](testing.zh-CN.md)

Run all ordinary validation with temporary Claude configuration. The tests do not install into a user's real settings or call models.

## Local checks

Shared catalog/protocol tests include strict input, Unicode paths and no-live-I/O sample previews. Run `python tools/generate_ui_contracts.py --check` to verify generated TypeScript agrees with Python; the native workflow also runs these contract tests. See [protocol details](contracts.md).

From the repository root, create a virtual environment and install the project plus development tools:

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

The separate Linux native workflow checks Claude Code 2.1.287 and 2.1.288 with exact-build declarations, official plugin validation/tests and TypeScript. Opt-in PTY/manual procedures are in [native integration](native.md); callback tests do not establish terminal focus or visual correctness.

Use the [release guide](../RELEASING.md) to build in a fresh directory from a fixed commit. The build job creates local-only fixtures before building, then checks that they are excluded:

```bash
python tools/inspect_dist.py --write-exclusion-fixtures
python -m build
python tools/inspect_dist.py
```

Run fixture creation only in a disposable exported source tree; it refuses existing target files. Inspection also accepts `--source PATH --dist PATH`. It checks version agreement, English README metadata, platform requirements, all Python package files, both skill templates, bilingual documentation, tests and maintenance tools. Local ROADMAP files, acceptance notes, bytecode and caches must be absent.

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

All release gates, including the real timer evidence, must pass before publication. See the [timer contract](timer.md) and [architecture](architecture.md).
