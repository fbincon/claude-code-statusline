# Testing and acceptance

**English** | [简体中文](testing.zh-CN.md)

Run all ordinary validation with temporary Claude configuration. The tests do not install into a user's real settings or call models.

## Local checks

Shared catalog/protocol tests include strict input, Unicode paths and no-live-I/O sample previews. Run `python tools/generate_ui_contracts.py --check` to verify generated TypeScript agrees with Python; the native workflow also runs these contract tests. See [protocol details](contracts.md).

`tests/ui/test_apply_protocol.py` covers complete draft validation before locking, two editors, ownership changes during a lock wait, same-named foreign installs, unrelated settings merges, rollback, v1 migration, repeat saves and CLI/curses/JSON equivalence. It also exercises the installed source CLI with Unicode/special-character paths. Official Mod tests cover process refusal/timeout, invalid envelopes, protocol mismatches, apply results, preview retry, cached redraws and responses finishing after resize or close. Use `{ deny: 'reason' }` to simulate a failed Mod API call; a throwing test stub is skipped by the host.

From the repository root, create a virtual environment and install the project plus development tools:

Editor tests cover Main/Subagents/Settings/Layout and scoped forms, full saves and new revisions, cancel/reopen, numeric boundaries, narrow panes, catalog exclusions and ordering, actual host rows, locks/refusals/partial success, conflicts, uncertain saves, write locks and stale responses. Run `claude plugin test mods/statusline-native` after preparing exact-host declarations; these checks make no model calls.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e . ruff build twine 'readme-renderer[md]'
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -t . -v
.venv/bin/ruff check --select F,E9 src tests tools
.venv/bin/python tools/check_docs.py
git diff --check
```

On Windows use `.venv\Scripts\python.exe` and `.venv\Scripts\ruff.exe`. Set `PYTHONUTF8=1` for UTF-8 terminal output. Linux/macOS terminal integration tests require native curses and tmux. Platform-specific skips are reported; a Linux run does not replace Windows or macOS CI.

Tests are grouped by implementation subsystem. CLI, installation and PTY/tmux/shell scenarios live under `tests/integration`; lifecycle and concurrency tests live under `tests/runtime`. `tests/support.py` locates source paths independently of nested test directories. Compatibility tests exercise original module execution paths and shared callable/type identities.

## Installed package checks

The native workflow checks Linux 2.1.287/2.1.288/2.1.289/2.1.294 plus Windows/macOS 2.1.288/2.1.289/2.1.294 with exact-build declarations, official plugin validation/tests and TypeScript. `tools/native_install_smoke.py` validates real official marketplace installation, absolute backend binding, complete protocol saves, repeat install, explicit plugin disable, compatibility restoration and uninstall without credentials/model calls. Opt-in PTY/manual procedures are in [native integration](native.md); callback tests do not establish terminal focus or visual correctness.

Use the [release guide](../RELEASING.md) to build in a fresh directory from a fixed commit. The build job creates local-only fixtures before building, then checks that they are excluded:

```bash
python tools/inspect_dist.py --write-exclusion-fixtures
python -m build
python tools/inspect_dist.py --check-long-description
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
  --budget-usd 10 --budget-ledger dist/validation/task-timer/budget.json \
  --report-dir dist/validation/live-timer
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

The v1.4.0 installed wheel from clean `9c9d553` passed core/official-installation smoke and saved the complete scoped catalog. Persistent Linux Claude Code 2.1.289 PTYs passed defaults and a 27-item selection (three existing plus all 24 new main fields) at 120×30 and 80×48. Agent inspection used reconstructed captured cells; `manual_visual_acceptance` remains false. Raw reports stay in ignored dist/validation.

## Display metric checks and performance

Token-counter regressions also cover partial input/output observations, explicit zero, invalid fields, counter-specific cost-snapshot deltas, nested-agent attribution, collapsed IDs and one-time older-cache recovery without a repeat scan. The final local suite ran 478 tests: 470 passed and eight expected platform skips.

Independent metric tests use fixed clocks, strict missing/zero input, per-scope sources and side-effect-free previews. Git/transcript collectors are lazy and shared within a refresh. Record startup and collection separately using isolated local fixtures (no model calls):

```text
python tools/benchmark_render.py --samples 30 --report dist/validation/display-performance.json
```

The default warm mode primes an isolated bytecode directory once; `--bytecode-mode cold` uses an empty directory without writing bytecode. This makes old/new startup measurements comparable even when source files have changed. Compare P50/P95 on the same machine and Python before/after changes; results include the tested commit. Cold transcript cases use distinct sessions; warm cases reuse state. Treat these small fixtures as a reproducible baseline, not a bound on large repositories or session histories.

Measured on Linux x86_64 / Python 3.14.4, 50 samples with isolated warm bytecode: baseline `0670e0d`, completed display code `50eb39f`, identical benchmark SHA256 `8917e61f6e01a3c527fb94054af6c69d99d5d8805416707a48c039bc9054884e`. Small local fixtures and scheduler noise limit conclusions; the render case selects only model-with-effort.

| Metric (ms) | Before P50 / P95 | After P50 / P95 |
| --- | --- | --- |
| Python startup | 15.529 / 24.098 | 17.438 / 24.191 |
| Model-only render process | 48.119 / 59.094 | 50.133 / 59.574 |
| Git cold | 2.730 / 2.952 | 2.901 / 3.243 |
| Git warm | 0.010 / 0.016 | 0.036 / 0.048 |
| Transcript cold | 0.403 / 0.532 | 0.483 / 0.822 |
| Transcript warm | 0.126 / 0.153 | 0.141 / 0.165 |

## Phase 4 verification

Advanced form regressions cover scoped text/format input, numeric bounds, field cancellation, layout partitioning and portable actions that never save until requested. Native tests cover literal shortcut input, actual host row aliases, unsupported/missing/locked rows, changed types/options, per-row partial results and tool-save/host-apply independence. Strict Unicode text validation matches Python and counts code points for the 256-character limit.

Use the installed wheel for `tools/native_mod_acceptance.py --persistent --advanced --report-dir dist/validation/<new-directory>`. Ctrl+S is checked inside the real curses popup, along with Client save/readback, CJK files, import errors, export of unsaved drafts, cancellation and explicit layout at both terminal sizes. The maintainer confirmed Phase 4 human acceptance on 2026-10-05; macOS acceptance covers standalone TUI/CLI. CI adds a fixed Linux 2.1.289 job while retaining the existing platform matrix.

### v1.5.0a1 candidate evidence

On 2026-10-05, the preview suite passed 507 tests (499 pass, eight platform skips) and 40 official Mod tests. Installed clean `07804ba` v1.5.0a1 wheel passed core and actual official-installation smoke plus advanced persistent 120×30 / 80×48 PTYs, including theme/turn-duration Apply/reload and independent tool saves. The rebased `e978411` source tree is byte-identical. Agent capture inspection is recorded in the [image index](../images/archive/README.md#v150a1-phase-4-captures); human acceptance was pending at the capture and was confirmed on 2026-10-05 (macOS standalone TUI/CLI).

Same machine, Python 3.14.4 and benchmark SHA-256 prefix `0f299dcff19d`, 50 samples with isolated warm bytecode, baseline `6c7826e` and formatter `a040243`:

| Metric (ms) | Before P50 / P95 | After P50 / P95 |
| --- | --- | --- |
| Python startup | 15.879 / 23.208 | 14.793 / 20.556 |
| Model-only render process | 51.170 / 61.929 | 55.245 / 63.612 |
| Git cold | 2.712 / 3.209 | 3.006 / 5.517 |
| Git warm | 0.036 / 0.053 | 0.010 / 0.014 |
| Transcript cold | 0.458 / 0.618 | 0.451 / 0.582 |
| Transcript warm | 0.142 / 0.162 | 0.139 / 0.150 |

The model-only P50 rises about 4.1 ms (8%); P95 rises about 1.7 ms. Five-item formatted/explicit cases measure 52.690/60.660 and 53.498/62.186 ms and are different fixtures from the baseline. Scheduling noise, small fixture size and cache state limit conclusions; these are measurements, not a performance bound. Use `--display-case legacy|formatted|explicit` to reproduce; the baseline uses the identical newer harness with its original runtime source. Lazy collectors remain covered by regressions.

## v1.5.0 stable acceptance

On 2026-10-05 the maintainer confirmed Phase 4 human acceptance on Linux and Windows and on macOS through the standalone TUI/CLI. Exact OS, architecture, terminal and host versions were not supplied. This confirmation does not declare the earlier macOS in-session Client input problem fixed.

Stable changes package/Mod versions and release defaults; formatting, layout, portable files, host application and accepted input behavior remain those of the verified preview. Automated CI/PTYs and agent capture inspection remain independent evidence. Historical preview images keep their a1 filenames, capture hashes and original source commits.

## Independent runtime checks

Run `python tools/generate_runtime_contracts.py --check`, `python -m unittest tests.runtime.live.test_protocol tests.runtime.live.test_store tests.integration.test_runtime_installer`, and the fixed 2.1.289 runtime Mod validation/tests/typecheck. `python tools/runtime_install_smoke.py --report PATH` uses only temporary configuration and no models. The CI matrix retains all older editor checks and adds Windows/macOS 2.1.289. Mocked protocol heartbeats verify the bridge, not actual session loading. See [live contracts](live.md).

## Phase 5 metric migration

Display schema v4 adds nullable `metrics.branch_diff_base_ref`; configuration protocol v3 preserves it across both editors, conflicts, previews and portable files. V1/v2/v3 reads have no write effects; a real save backs up and migrates. Runtime observation protocol remains independently v1. Committed branch comparisons and frozen ended-agent durations are documented in [metric definitions](../DISPLAY_ITEMS.md).

## Real Phase 5 acceptance

Use `tools/live_metrics_acceptance.py --root dist/validation/phase5/CASE --case single|single-agent|parallel --budget-ledger dist/validation/phase5/budget.json --run-real-calls`. The existing ledger must authorize exactly USD 10 and all attempts/retries share its locked reservations. Unknown cost retains the full cap. Omitting --run-real-calls revalidates captured records without model calls. Do not create a new ledger to reset spending. The harness isolates config, limits tools to Agent and sleep, checks real request sums/latest timing, main wrap-up and repeated frozen agent rendering, and leaves exporters unchanged. Headless checks do not establish human or Windows/macOS session interaction acceptance.

## v1.6.0 stable acceptance

On 2026-10-05 the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS. Exact OS, architecture, terminal and host versions were not supplied. This is the new Phase 5 acceptance record, separate from historical editor confirmation and automated/headless/PTY evidence. The existing macOS Client input limitation remains documented. Stable v1.6.0 retains the accepted runtime implementation, display schema v4, configuration protocol v3 and runtime protocol v1. Editor entries default on for compatible hosts, preserving explicit false; live collection remains independently opt-in and preserves its preference.

Promotion rechecks stable defaults, a1 upgrade preference preservation, both Mod/backend version bindings, all platform CI and installed distributions/PTYs. Captured single-agent/parallel/main-wrap observations can be revalidated without model calls. This version/default-only change does not reset the original USD 10 ledger or repeat the paid suite.

## v1.6.1 external TUI grouping checks

Local validation passed 561 Python tests (553 passed, eight expected platform skips), 41 native and eight runtime official Mod tests, both TypeScript projects, generated contracts and Ruff. Added UI checks cover contiguous groups, stable field keys, nonselectable headings, grouped paging, CJK/combining text, 0/8/16/256 colors and drawing bounds on every page. 64×18/19 uses compact separators; frames start at 64×20.

Install the matching wheel and `pyte` into an isolated environment, then run the free PTY helper below with a fresh report directory. It checks four pages, detail forms, resizing during input, byte-identical cancellation and regrouped numeric save/readback at 64×18, 64×20, 80×24, 120×30 and 80×48:

```bash
python tools/external_tui_acceptance.py --backend /absolute/venv/bin/claude-statusline \
  --report-dir dist/validation/external-tui-NEW --commit SOURCE_COMMIT
```

Use `tools/render_native_capture.py --surface external --bounds 0 0 COLUMNS ROWS --commit SOURCE_COMMIT` to reconstruct the real capture JSON; Pillow/fonts are documentation dependencies only. Raw cells, isolated configuration and builds stay in ignored dist/validation; distributions contain only public PNGs and sanitized provenance. Record automated PTYs, agent inspection and human acceptance separately; historical confirmations are not new acceptance of this presentation change. Matching-wheel persistent advanced PTYs must also check external saves and Client readback. All 20 PR/merge/tag jobs and release artifact gates remain required.

## Task timing preview validation

The task-clock preview passed 590 Python tests (582 passed, eight expected platform skips), 41 native and 10 runtime official Mod tests, both TypeScript projects, official static validation, generated contracts, Ruff and documentation links. Installer checks cover default metadata-only timing, persistent explicit opt-out, independent timing/metrics overrides, backed-up installation migrations and matching diagnostic bindings. Regressions include Stop continuation, late native endings, unclosed/overlapping waits, clock loss/reboot/Windows wall adjustments, retained historical values, report/message aliases and indexed submission append/replacement.

Real Linux x86_64 / Python 3.14.4 / Claude Code 2.1.289 probes passed single-agent and parallel wrap-up, blocked Stop continuation, automated SDK question waiting/interruption, default native timing and disabled compatibility collection. Both production timers freeze when available; incomplete execution evidence is hidden. A parallel task retained about 14.1 seconds while its final native turn reported 3.7 seconds. All attempts/retries share the original USD 10 ledger; initial evidence spent USD 0.801859 with zero unknown costs. SDK responses are controlled inputs, not new human acceptance. Real machine suspend and real Windows/macOS model-session acceptance remain pending; CI and simulated clocks are distinct evidence.

Use the existing ledger and a new case directory. Do not initialize another ledger to reset spending. The `wait` and `interrupt` cases additionally need the optional acceptance dependency `claude-agent-sdk`; the SDK uses the actual host on PATH. Omit `--run-real-calls` to revalidate captures without spending:

```bash
.venv/bin/python tools/task_timer_acceptance.py \
  --root dist/validation/task-timer/parallel \
  --case parallel --backend /absolute/venv/bin/claude-statusline \
  --budget-ledger dist/validation/task-timer/budget.json \
  --cap-usd 1 --run-real-calls
```

Cases are `single`, `single-agent`, `parallel`, `stop-continue`, `wait`, `interrupt` and `compat`. Unknown costs retain their full cap and block all new paid attempts. The legacy timer runner also requires this ledger; its capture verification remains available. Keep raw streams, SDK inputs and private configuration under ignored `dist/validation`.

Run `tools/benchmark_task_timer.py --samples 30 --report PATH` under the same interpreter and each source's PYTHONPATH. Baseline `4268743` and the task-clock implementation used identical script SHA256 `808a8b5224fa52584bfa0b9ac09ee052e64dac2b186391af1a0fa5fbcfbf6b4f`, machine and fixtures: 100/10,000/100,000 history rows with one/32 tasks, plus a one-prompt production renderer startup fixture.

| Metric (ms) | Before P50 / P95 | After P50 / P95 |
| --- | --- | --- |
| Python startup | 15.548 / 18.292 | 13.667 / 18.026 |
| Timer imports | 40.502 / 50.502 | 40.548 / 51.444 |
| Timer render process | 51.673 / 60.577 | 53.221 / 62.110 |
| Hot refresh: 100,000 rows, 32 tasks | 0.001 / 0.009 | 0.001 / 0.002 |
| Terminal: 100 rows, 32 tasks | 0.021 / 0.023 | 0.048 / 0.056 |
| Terminal: 10,000 rows, 32 tasks | 0.861 / 0.893 | 0.048 / 0.061 |
| Terminal: 100,000 rows, 32 tasks | 9.486 / 9.595 | 0.048 / 0.061 |

Unchanged hot refresh performs no transcript reads; ending lookup reuses the bounded cursor index. At 100,000 rows/32 tasks (16.6 MB), first submission indexing was 9.84 ms before and 22.44 ms after; it still scans the source once. Timer renderer startup increased by approximately 1.5 ms at P50. Measurements are local fixtures with scheduler/cache noise, not performance bounds. The source/report paths and raw histories remain private.

## v1.7.0 stable acceptance

On 2026-10-07 the maintainer confirmed the v1.7.0a1 preview had been validated on Linux, macOS and Windows. Exact OS, architecture, terminal and Claude Code versions were not supplied. This confirms platform acceptance; automated CI, SDK-controlled scenarios and hardware sleep/resume evidence remain separate records.

Stable 1.7.0 keeps the accepted task timing code and contracts. Validate stable editor defaults, saved opt-outs, compatible/unknown hosts, and a1-to-stable resource/backend upgrades with the installed package. The existing 590-test Python suite, 51 official Mod tests, generated contracts, TypeScript, Ruff, documentation and all PR/merge/tag CI gates apply. Revalidate the six captured scenarios with the stable wheel without paid calls, preserve the original USD 0.801859 ledger, and verify independent rebuilds, both editor PTYs, draft/public assets and URL installations. See the [stable Release record](../releases/v1.7.0.md).

## TUI polish acceptance

Grouped-page regressions cover actual visible rows, repeated group context, non-orphan headings, boundary paging and retained field offsets. Drawing checks all four pages and item details at 32×12, 64×18, 64×20, 80×24, 120×30 and 80×48, including selected keys and input buffers across resize. Shortcut checks verify regular descriptions, separate bold keys (host theme text in Client), whole-group clipping, CJK/combining text and external 0/8/16/256 colors.

Run all checks above, both official Mod validators/tests and TypeScript. Use new report directories for the external five-size PTY helper and installed `native_mod_acceptance.py --persistent --advanced` checks covering both editors, formatting, layout, portable files and host preferences. The acceptance runner locates fields by stable identity and records source and host version. Inspect raw captures privately; retain gallery PNGs and their provenance. Automated results do not establish new human acceptance.

## Client footer and letter controls

Native regressions check the theme-accent Configure Status Line heading, uppercase key/lowercase description styles, Tab-first order on all pages, conditional H/A/search/input/recovery controls, complete-group wrapping, actual one-row sample previews and shared footer/paging budgets. Sizes include 32×12, 32×13, 48×12, 64×18, 64×20, 80×24, 120×30 and 80×48, with fields, paths, numeric/search input, expanded preferences and busy/unknown states. Case tests preserve mixed-case text, CJK and combining marks, Ctrl/Meta boundaries, Ctrl+E/G/U and Shift+Tab. Official mounted tests also exercise uppercase controls and literal mixed-case text.

The installed persistent PTY helper checks the new title against Preview's real terminal color, S save key/description styles and ordered page controls. It exercises uppercase save/finish/discard/preference operations and mixed-case item text alongside the existing editing, resizing and shared-configuration checks. Use fresh ignored reports and inspect reconstructed terminal captures; preserve historical galleries and distinguish automation from human/platform acceptance. Follow the release guide for complete PR/merge/tag CI and installed distributions.

## Native theme acceptance

Run each supported theme in a new ignored report directory:

```bash
.venv/bin/python tools/native_mod_acceptance.py --theme light --theme-only \
  --report-dir dist/validation/theme-light
```

Repeat for dark, light-daltonized, dark-daltonized, light-ansi, dark-ansi, auto and `custom:statusline-validation-light` on a host that supports them. The custom fixture uses a light base with explicit text/inverse/inactive/accent overrides. Each run captures four pages and an item form at 120×30 and 80×48, checks primary key/description contrast against decoded backgrounds, and verifies unsaved theme edits and separate successful Apply without saving the tool draft. Theme reads prefer current settings over legacy global storage. Run full persistent/advanced acceptance separately for saving and cross-editor readback.

`tools/terminal_colors.py` resolves foreground and background defaults separately before reverse video; both acceptance and capture rendering use it. RGB cells are exact; named ANSI colors use the documented capture palette and do not establish a physical terminal’s custom ANSI definitions. Reconstructed images are terminal evidence, separate from OS screenshots or human acceptance.

## External terminal color acceptance

`ui.theme` uses terminal-default chrome, bold keys/headings, regular descriptions and reversed selection. Tests exercise four pages and item forms with 0/8/16/256 colors, color-start/default-color/base-pair failures, bounded color-pair allocation, ANSI/RGB sample mapping and complete preview fill. The external minimum remains 64×18; 32×12 validates resize/cancel guidance, while all working sizes check cell bounds, CJK/combining text and state retention.

Run the installed wheel in both terminal-default fixtures, each with a new ignored report directory:

```bash
.venv/bin/python tools/external_tui_acceptance.py \
  --backend /path/to/installed/claude-statusline --commit COMMIT_HASH \
  --terminal-theme light --report-dir dist/validation/external-light
```

Repeat with `--terminal-theme dark` and another report directory. This option supplies defaults for capture analysis and does not configure a physical terminal. Both fixtures exercise 64×18, 64×20, 80×24, 120×30 and 80×48, four pages, item forms, numeric input/errors, resize, byte-identical cancel and save/readback. Each capture checks default chrome and reversed selections at contrast ≥4.5:1, bold keys/regular descriptions, explicit preview foregrounds and full dark backgrounds. Capture metadata records the default foreground/background and xterm ANSI palette; the image renderer consumes that palette. Real terminal profiles and human acceptance remain separate evidence.

For this patch, local Python checks passed 657 tests (649 passes, eight expected platform skips); Claude Code 2.1.295 official Mod tests passed 59 native and ten runtime tests. Both TypeScript projects use exact 2.1.294 generated declarations: the 2.1.295 unauthenticated type-load path stopped at login before emitting declarations. Fixed CI hosts retain their existing versions and 13 Python/build plus ten Mod gates.
