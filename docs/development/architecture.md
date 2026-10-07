# Architecture and repository layout

**English** | [简体中文](architecture.zh-CN.md)

The Python package keeps the existing CLI, configuration formats and storage locations. Implementation is grouped by responsibility and retains lazy compatibility modules at the original Python paths.

```text
src/claude_statusline/
  cli.py, __main__.py, _version.py   CLI dispatch and version
  config/                           Display/features, host settings, models,
                                    shared storage, transactions and commands
  rendering/                        Formatting, palette, layout, items,
                                    timer, main/subagent output and preview
  runtime/                          Paths, caches, registry, transcript,
                                    usage, Git and task lifecycle
    live/                           Independent timing/metrics observations
    timing/                         Immutable pause/resume clock and samples
    tasks/                          Task ownership, lifecycle, indexed evidence,
                                    native adapter, collection and locked store
    turns/                          Compatibility aliases to tasks/
  integration/                      Ownership, capabilities, resources,
                                    installation plan/commit, doctor,
                                    hooks, launcher and result bridge
  ui/                               External terminal editor and JSON backend
    models.py                       Terminal bounds, outcomes and stable field keys
    editor.py, forms.py              Draft state, grouped fields and pure edits
    layout.py                       Panel geometry and grouped viewport budgets
    drawing.py, keys.py              Terminal drawing and keyboard dispatch
    session.py                      Terminal lifecycle, saves/cancel and file effects
    protocol.py, contracts.py        JSON backend and generated wire contracts
  platforms/                        OS detection, files, processes, clocks
                                    and the Terminal.app adapter
  resources/                        Bundled configuration skill templates
  *.py                              Legacy compatibility entry points

tests/{config,rendering,runtime,integration,ui,platforms}/
tests/support.py                    Stable source locations for subprocess tests
tools/                              Validation and opt-in acceptance commands
docs/development/                   Architecture, testing and timer contracts
```

## Dependencies and boundaries

The bundled TypeScript Client editor lives in `mods/statusline-native`, split into a statically inspectable host entry, pure draft and host-row logic, strict protocol bridge, generated contracts, page rendering and official tests. Python remains the configuration/rendering owner. Source distributions retain Mod development files; `src/build_native.py` copies only runtime manifests/modules into the wheel, with a generated hash/version/protocol inventory. The installer owns a local directory marketplace and uses official plugin commands, separately from its compatibility file transaction. See [native integration](native.md).

`config.catalog` defines scoped items and derived legacy views. `ui.contracts` defines the generated frontend wire types, `ui.protocol` owns JSON describe/read/preview/apply transport and `rendering.spans` converts production samples to drawable output. `config.revisions` supplies the installation-aware semantic revision for locked reads and shared JSON/curses saves. Apply reuses the configuration service transaction and returns its committed snapshot. See [shared contracts](contracts.md).

Platform adapters provide locking, atomic writes, process identity and suspend-aware clocks. Runtime collectors use those adapters; renderers consume collected data and display configuration. UI drafts save through the configuration service. Installation and configuration share the same storage lock and ownership helpers, preserving rollback and semantic conflict detection.

```mermaid
flowchart LR
    CLI[Lazy CLI dispatch] --> R[Rendering]
    CLI --> H[Lifecycle hooks]
    CLI --> I[Installation and configuration]
    CLI --> U[Terminal editor]
    U --> C[Configuration service]
    U --> P[Sample preview]
    R --> RT[Runtime collection]
    H --> T[Turn reducer and store]
    I --> S[Shared storage and ownership]
    C --> S
    RT --> A[Platform adapters]
    T --> A
    S --> A
```

`render`, `render-subagents` and `hook` keep terminal editors and launchers out of their startup paths. Package initializers do not eagerly import the subsystems. Optional frontend imports remain at their use sites; sample preview uses fixed data without transcript/Git collection or persistence.

The main renderer reads official JSON on stdin and writes formatted text. The subagent renderer writes NDJSON with the existing `id`/`content` protocol. Hooks remain silent and successful when input or state is unavailable. Administrative command errors continue to use stderr and existing exit codes.

## Compatibility and resources

Original modules such as `claude_statusline.statusline`, `turn_state`, `installer`, `interactive_config` and `_platform` forward attribute reads to canonical implementations. Function, exception and model identities are shared; there is no second lifecycle store or transaction implementation. Existing module execution paths, including `python -m claude_statusline.macos_terminal`, remain usable.

Tests patch the canonical module that owns a function or constant. Assigning private globals on a compatibility module is not a configuration interface; use the documented environment variables for runtime locations.

Resources continue to load through `importlib.resources` from `claude_statusline/resources`. Terminal child processes locate Python through the root package rather than assumptions about a moved adapter's parent directories.

## Persistence

Current display schema v5 evolves independently from feature schema v1, the schema-1 runtime mirror and lifecycle schema v4; historical display v1/v2/v3/v4/v3 is normalized in memory until saving. Optional `duration_source` distinguishes frozen task elapsed time from legacy native evidence; new native turn duration is stored separately. Optional agent history, continuation prompt aliases and pending reports preserve a human task across host-generated result notifications. They remain bounded and do not change configuration formats. Timing transcript scan version 6 rechecks old caches without resetting cumulative usage.

Keep local ROADMAP files and raw acceptance records out of distributions. Release archives originate from a fixed verified commit; package inspection checks all canonical Python modules, compatibility entry points, resources, tests, tools and bilingual documents.

See [testing](testing.md), the [timer contract](timer.md) and the [release guide](../RELEASING.md).

## Native editor structure

The sole editor Mod source remains `mods/statusline-native`. Host APIs stay in `hooks/register.ts`, draft/numeric rules in `lib/editor/`, validated batches/keys/settings in `lib/client/`, and independent port snapshots in `lib/session.ts`. `ui/client/` owns Client input/drawing, `ui/components/` reusable sections, and `ui/layout.ts` the body budget. Tests mirror backend, client, editor, integration and UI.

The external `/statusline-configure` Python curses UI/platform launcher remains separate. Mod registers only `/statusline-configure-native`. Both can install/open together and use the same configuration service, revision checks and transaction lock. Client neither accesses files nor starts processes: cumulative ordered messages reach the host, copied snapshots isolate recursive host freezing, and sequence acknowledgements/deduplication plus epochs reject repeated/late input. Recursive packaging includes Client modules and excludes tests, host declarations, dependencies and raw validation reports.

config.editor_defaults shares stable editor defaults while each preference stays independent and explicit flags win. Installation, slash execution and doctor agree on external defaults: absence defaults on and explicit false persists off. Host thresholds are 2.1.258 external and 2.1.287 Client; unsupported/unknown versions suspend independently. Verified owned plugins suspend through locked, backed-up settings/owner transactions with rollback, without newer host APIs; only tool suspension automatically restores after compatibility returns.

## Independent display metrics

`rendering.metrics` owns strict numeric/context parsing, reset countdowns and session component formatting. The main render state shares a raw integer usage snapshot without additional I/O, captures one clock per refresh and memoizes live collectors; deterministic previews supply a fixed clock and sample values. Scoped catalog additions flow through generated contracts, both editors and the wizard without a schema/protocol change. See [display metric definitions](../DISPLAY_ITEMS.md).

Usage state keeps optional input/output observation flags alongside the existing integer accounting. Usage scan version 3 recovers these flags once for older sessions, including nested agents, without re-adding collapsed message IDs. Sparse cost-state snapshots update only observed counters; each counter keeps its own main/subagent delta anchor. The formatted collector interface and timer lifecycle remain compatible.

## Phase 4 configuration boundaries

Python `config.formatting`, `advanced`, `presets`, `transfer` and `editor_fields` own format rules, pure draft edits, preset expansion, portable files and shared form descriptors. Display schema v5 and protocol v4 evolve independently from editor enablement, runtime mirrors and lifecycle state. Both editors save a complete draft through the existing configuration service; legacy commands retain advanced fields and explicit reset restores defaults.

Curses `ui.forms` and Client `lib/client/forms.ts` expose scoped formats, Layout fitting and global settings from the canonical descriptors. Native hooks alone perform backend/file effects; `lib/preferences.ts` owns actual-row descriptions and supported controls, with separate Claude API application. Production and sample rendering share formatting and explicit layout; lazy Git/transcript collection is retained. No Phase 5 runtime indicators are added.

## Independent runtime collection

The opt-in `mods/statusline-runtime` is separate from the Client editor. Both Mods use explicit identities in the shared owned-plugin installer and resource inventory. `runtime/live/` owns the strict runtime protocol, per-session locks, atomic observation state and bounded history; configuration transactions and `runtime/turns` remain separate. The collector publishes only metadata, keeps exact retry identities, renews its session binding after resumes and reports stale or incomplete evidence. See [live contracts](live.md).

## Phase 5 metric migration

Display schema v4 adds nullable `metrics.branch_diff_base_ref`; configuration protocol v3 preserves it across both editors, conflicts, previews and portable files. V1/v2/v3 reads have no write effects; a real save backs up and migrates. Runtime observation protocol v2 accepts v1 without execution coverage. Committed branch comparisons and frozen ended-agent durations are documented in [metric definitions](../DISPLAY_ITEMS.md).

## External editor structure (v1.6.1)

`ui.layout` computes geometry and grouped windows without terminal/file effects. Headings consume screen rows without becoming selectable fields. `ui.forms` reuses canonical descriptors, gives legacy/portable controls stable keys and groups, and projects a contiguous external display order. `ui.editor`/`ui.keys` dispatch by field identity; drawing owns terminal output. JSON descriptors, Client ordering and wire contracts remain compatible, independent of external presentation order.

Content and Preview use their actual inner widths; resizing preserves drafts and input buffers. Tests follow the existing UI/integration layout, and the standalone PTY helper lives under tools. Production rendering, installation, runtime observation and compatibility entry points retain their responsibilities.

## Task clock structure

The canonical task implementation lives in `runtime/tasks`: model, reducer, agents, native adaptation, incremental evidence, collection and read-only views each have one responsibility. `runtime/timing` contains the pure serializable clock. The former `runtime/turns` modules alias the canonical modules, preserving Python entry points, shared function identity and the existing on-disk location.

Runtime collection has two independent modes. Native timing defaults on for compatible installations; advanced metrics remain opt-in. Both consume bounded, deduplicated metadata. Only the canonical task store decides task outcomes; advanced views derive their ownership from explicit links and verified lifecycle evidence. Formatting does not mutate task state; collection/reconciliation happens before formatting. Display schema 5, configuration protocol 4, runtime protocol 2 and runtime preference schema 2 evolve separately.

## TUI layout and shortcuts

Client `ui/layout.ts` budgets content, Preview and two action rows from terminal dimensions. The shared section component paints its title on the frame edge, with a one-row heading in compact mode. `lib/editor/navigation.ts` packs actual fields and group headings into pages; drawing and page keys share that calculation. Stable field keys retain selection through resize and headings are nonselectable. Layout expands mode and all row boundaries before item fitting in main-line order; item details keep format and fitting groups contiguous.

Each editor has a pure shortcut-segment helper that fits complete key/action groups before Client Text or curses draws white bold keys and regular dim descriptions. Narrow viewports use shorter labels and omit incomplete groups. External forms retain the existing grouped scrolling window; h still unfolds host preferences with separate Apply. Drawing performs no file or host effects.
