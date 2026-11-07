# Architecture and repository layout

**English** | [简体中文](architecture.zh-CN.md)

Current native capacity and recovery use bounded visible frames and add three-platform Claude 2.1.310 gates; see [implementation and acceptance](native-capacity.md).


[Extension implementation and validation](extensions.md) covers local JSON, GitHub, commands, links and shared component capabilities.

[Setup and complete appearance implementation](setup-appearance.md) covers first use, built-in schemes, schema 9, protocol 16 and their acceptance.

For named display schemes, user-side project bindings and read-only task inspection, see [profiles](../PROFILES.md) and [task details](../TASK_DETAILS.md).

For explicit real-input diagnosis and cache causes, see [input diagnosis](../DIAGNOSTICS.md) and [implementation and acceptance](real-input-diagnostics.md).

Shared cursor editing, scenario-based quick setup and the read-only `explain` operation are documented in [configuration experience and validation](configuration-experience.md).

Current timing provenance, exact replay deduplication and cache compatibility are documented in [post-migration repairs](post-migration-fixes.md).

The production package is TypeScript, retaining the existing CLI, configuration formats and storage locations. Implementation separates pure rules, platform effects, application services and terminal UI.

<a id="typescript-migration-workspace"></a>

## Current TypeScript workspace

TS-03 adds `packages/core` (pure configuration, protocol, localization, Unicode, rendering and runtime rules), `packages/platform` (Node/native I/O) and `packages/cli` (application services). TS-04 adds `packages/tui`, installed integration and durable recovery. The workspaces are private implementation packages bundled into the public npm product.

The canonical catalog is TypeScript data. Item IDs and preset descriptions are derived rather than separately edited in frontend contracts. Canonical languages live under `packages/core/resources/i18n`; the TypeScript generator emits Node and Mod resources, without regenerating the Python archive. Mod copies contain only supported pure modules, with host effects in their existing entries. See [TS-03 implementation and acceptance](typescript-migration/ts-03/README.md).

The migrated runtime uses `core/runtime/{tasks,live}`, `core/timing` and pure usage/Git parsers, coordinated by `cli/runtime`. Explicit `RuntimeContext`, `RuntimeIO` and `CommandRunner` boundaries supply clocks, process identity, private file publication and Git argv execution. Task history remains lifecycle schema 4 with its schema-1 compatibility mirror. Live writers acquire live then task locks; usage writers acquire cache then task locks. Task writers never acquire live/cache locks. Complete UTF-8 byte cursors, bounded histories and immutable frozen results survive mixed-version disk access. The development `runtime`/`hook` entry points do not switch installed commands or Mod bindings.

The TypeScript layout separates reusable rules, OS effects and application work:


Bare runtime protocol dispatch uses a read-only preference adapter without loading
management storage, display rules or UI locale data. Usage indexing retains an
at-most-32-MiB serialized overlay within one cache lock. Final pages are durably
published before the manifest and atomic state; overflow flushes use the same
publication adapter. Cleanup remains after the successful state commit. Persisted
formats and exact replay accounting are unchanged. See [PERF-01](performance/perf-01.md).

```text
packages/
  core/
    src/editor/                    Shared drafts, forms, search and response rules
    src/integration/               Pure executable/argv binding
    resources/i18n/                Canonical translations
  platform/
    src/terminal/                  Raw mode, VT input/output, launchers and bridge
    src/plugin-host.ts             Bounded official CLI transport
  cli/
    src/config/                    Configuration and UI protocol services
    src/integration/               Ownership, resources, installation and doctor
    src/recovery/                  Journals, file restore and official reconciliation
    resources/                     Canonical skill templates
  tui/
    src/                           External editor state, layout, drawing and session
    src/drawing/                   Bounded canvas/ANSI, presentation, shortcuts and pages
    test/                          Pure external-editor product regressions
tools/migration/ts-04/
  package.ts                       Private installed acceptance archive
  installed.ts                     Eight-target installed entry/editor/recovery gate
  official-installed.ts            Fixed-host installation gate
  host-smoke.ts                     Local real-host editor/runtime interaction
  test/                            Named responsibility and process/terminal tests
```

File publication records immutable before-images and durable checkpoints before
mutation. The shared installation lock protects file commits; an administration
lock serializes official integration phases. Explicit recovery verifies all
recorded states, reconciles uncertain host outcomes and preserves plugin opt-outs.
See [recovery](typescript-migration/ts-04/recovery.md) and
[installed acceptance](typescript-migration/ts-04/candidate.md).

## Current application services

The development CLI binds filesystem transactions and host identity through `ConfigurationService`/`Storage`. Its private ESM entry is `packages/cli/src/entry.ts`; configuration and protocol code reside under `config/` and `ui/`. The `render`, `render-subagents`, `hook` and `slash-hook` fast dispatches precede management-resource imports. Explicit `LaunchSpec` prefixes distinguish the TypeScript development backend from installed renderers.

`core/rendering` owns main/subagent composition, formatting, styles, Powerline and deterministic previews. `RenderEnvironment` supplies selected-language presentation and synchronous observation interfaces; `cli/rendering/environment.ts` imports selected collectors and connects runtime services. A frame caches each source and raw task snapshot before independently formatting repeated instances. `platform/presentation.ts` supplies lexical paths, local/UTC dates and hostname. Preview adapters substitute every observation; they do not collect or write runtime evidence. `packages/tui` implements the external editor over the shared editor core and an injected protocol backend. `platform/terminal` owns raw mode, incremental UTF-8/VT input, bounded output, launcher selection and private request/result files; `cli/integration` connects these adapters and rechecks request revocation under the configuration lock. See [TS-04](typescript-migration/ts-04/README.md).

The internal usage/transcript JSON path preserves numeric lexemes and falls back to the exact parser for ordered numeric keys and legacy constants. Mutable ID dictionaries keep Python insertion order with bounded deletion cost; native cache serialization retains Python spacing, ASCII escapes and numeric spellings. Public configuration/protocol parsing remains strict. These optimizations change no disk schema.

`cli/recovery` owns versioned file and official-operation journals. Configuration and installation services publish immutable before-images before mutations; incomplete journals block configuration writes until explicit recovery. Plugin refresh intent preserves manual disablement across uninstall/reinstall. Doctor only inspects. See [candidate recovery](typescript-migration/ts-04/recovery.md).

[Source and package execution boundaries and additional acceptance](source-command-package-management.md) document protocol 28, separate command approval, retained controls and protected cleanup.

## Historical Python architecture

See the [historical Python architecture](history/python-implementation.md#python-architecture) for the original layout, version constraints and implementation details. These links preserve the previous section anchors.

- <a id="dependencies-and-boundaries"></a>[Dependencies and boundaries](history/python-implementation.md#dependencies-and-boundaries)
- <a id="compatibility-and-resources"></a>[Compatibility and resources](history/python-implementation.md#compatibility-and-resources)
- <a id="persistence"></a>[Persistence](history/python-implementation.md#persistence)
- <a id="native-editor-structure"></a>[Native editor structure](history/python-implementation.md#native-editor-structure)
- <a id="independent-display-metrics"></a>[Independent display metrics](history/python-implementation.md#independent-display-metrics)
- <a id="phase-4-configuration-boundaries"></a>[Phase 4 configuration boundaries](history/python-implementation.md#phase-4-configuration-boundaries)
- <a id="independent-runtime-collection"></a>[Independent runtime collection](history/python-implementation.md#independent-runtime-collection)
- <a id="phase-5-metric-migration"></a>[Phase 5 metric migration](history/python-implementation.md#phase-5-metric-migration)
- <a id="external-editor-structure-v161"></a>[External editor structure (v1.6.1)](history/python-implementation.md#external-editor-structure-v161)
- <a id="task-clock-structure"></a>[Task clock structure](history/python-implementation.md#task-clock-structure)
- <a id="tui-layout-and-shortcuts"></a>[TUI layout and shortcuts](history/python-implementation.md#tui-layout-and-shortcuts)
- <a id="shared-interface-language"></a>[Shared interface language](history/python-implementation.md#shared-interface-language)
- <a id="independent-statusline-language"></a>[Independent statusline language](history/python-implementation.md#independent-statusline-language)
- <a id="component-instances-and-layout"></a>[Component instances and layout](history/python-implementation.md#python-architecture-component-instances-and-layout)
