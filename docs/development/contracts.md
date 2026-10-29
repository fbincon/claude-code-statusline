# Shared catalog and JSON configuration protocol

**English** | [简体中文](contracts.zh-CN.md)


[Draft history, structural review and reuse](draft-history-and-reuse.md) documents UX-03, COMPOSITION-04 and IMPORT-02, editor protocol 29 and their acceptance.

Current native capacity and recovery use bounded visible frames and add three-platform Claude 2.1.310 gates; see [implementation and acceptance](native-capacity.md).


[Extension implementation and validation](extensions.md) covers local JSON, GitHub, commands, links and shared component capabilities.

[First-use setup](../SETUP.md) and [complete schemes](../SCHEMES.md).

For named display schemes, user-side project bindings and read-only task inspection, see [profiles](../PROFILES.md) and [task details](../TASK_DETAILS.md).

Protocol v29 is the internal interface for the bundled/source native frontend. Display persistence uses schema v16, including in-memory v1–v15 migration; it evolves independently from the protocol. Use frontend and backend resources from the same package version.

## Catalog

`packages/core/src/config/catalog.ts` defines the 67 main and 17 subagent types (65/15 data items plus text and spacer in each scope) by `(scope, id)`. Definitions carry labels, descriptions, groups, sources, examples, default positions, format options, exclusions and unavailable-reason codes. Legacy catalog dictionaries and default tuples are derived views; existing IDs, descriptions, default selections and ordering are preserved. CLI JSON listings add metadata without removing their existing enabled/position fields. The external TUI and the installed wizard consume the same definitions and exclusions.

Minimum versions are verified only where evidence exists. The 2.1.205 subagent minimum denotes row support, not every optional field: effort requires 2.1.214. Independent agent effort declares 2.1.214. New independent metrics are opt-in and can coexist with compounds; see [display definitions](../DISPLAY_ITEMS.md). Cache metrics declare 2.1.251; optional gateway dollar/period metrics declare 2.1.284 on both host and gateway. Unverified main-field minima remain `null`/`unknown` instead of guessed dates. `not_observed` means the interface has not inspected live data, `unsupported_host` means a verified version boundary, `unknown_host_version` means detection failed, `source_unavailable` means a source cannot be read, and `condition_not_met` covers items such as Git outside a repository or fast mode while inactive. These are definitions of possible reasons; opening configuration does not collect live field availability or disable selections for missing observations.

## Transport and operations

Catalog entries also expose a `guidance` object containing source-kind codes,
measurement scope, requirement codes and setup/diagnostic commands. These are
static definitions from `packages/core`, with shared multilingual messages and generated
TypeScript vocabulary. Inspecting an item's Sources and requirements page does
not query live data, enable collectors or change its selection. Known minimum
host versions remain separate from actual observations; unknown minima stay
unknown. Possible unavailable reasons are explanations, not diagnoses of the
current session. `config list-items --json` exposes the same additive metadata.

Run `claude-statusline ui --config-dir PATH` (Windows npm shim: `claude-statusline.cmd`). One process reads one UTF-8 JSON object to EOF and writes exactly one JSON response and a newline. Stdout is reserved for the envelope; unexpected failures are diagnosed on stderr. Success exits 0 and rejected requests exit 2.

```json
{"protocol_version":29,"operation":"read","payload":{}}
```

Success is `{"protocol_version":29,"result":{...}}`; failure is `{"protocol_version":29,"error":{"code":"...","message":"...","localization":null}}`. Envelope and payload keys are checked. Duplicate JSON keys, non-finite constants, wrong versions/types, unknown operations and invalid drafts are refused.

| Operation | Payload | Result |
| --- | --- | --- |
| `describe` | `{}` | Catalog, option choices/ranges, formatting choices, editor field descriptors, presets, capabilities, backend version and supported operations |
| `read` | `{}` | `draft`, `revision`, `installed`, `installation`, capabilities and backend version |
| `preview` | `{"draft": {...}, "width": 80}` | `sample: true`, `main` and `subagents` rows of drawable spans |
| `apply` | `{"draft": {...}, "expected_revision": "<read revision>"}` | Saved read snapshot, `changed`, and `backup_dir` (a path or `null`) |
| `read_ui_preferences` | `{}` | `{schema_version:1,ui_language,warning}` |
| `set_ui_language` | `{ui_language}` | `{schema_version:1,ui_language,warning:null}` |
| `preset` | `{draft,preset}` | Validated expanded `{draft}` |
| `import` | `{draft,path,selection?}` | Validated imported `{draft}` |
| `review_import` | `{draft,path,selection?}` | Validated candidate `{draft,changes}` compared with the supplied unsaved draft |
| `export` | `{draft,path,overwrite}` | Export destination `{path}` |
| `explain` | `{draft,scope,width}` | Configuration reasons and per-instance sample outcomes, with `actual_availability:"not_observed"` |
| `diagnose` | `{draft,input,scope,width,source?,observed_at?,include_local?}` | Real input, attributable evidence and fitted per-instance outcomes; `sample:false`, no writes or collection |

| `profiles_read` | `{}` | Version-1 collection and opaque revision |
| `profiles_apply` | `{action,expected_revision,...}` | Saved collection, revision, changed flag and backup path |
| `profile_import` | `{path}` or `{path,draft,selection}` | Validated named display candidate; no writes |
| `profile_export` | `{name,display,path,overwrite}` | Version-1 named scheme export destination |
| `task_details` | `{session_id,prompt_id?,host_agents?}` | Read-only version-1 task projection with per-source evidence and limitations |

`read` and `apply` also accept an optional `target`: `{kind:"user"}`, `{kind:"profile",id}` or `{kind:"project",path}`. Scoped reads use bounded read-only snapshots and return `configuration` selection metadata. Scoped revisions cover the collection, target, resolved binding and base configuration; writes re-read these under the existing lock and preserve renderer ownership checks. Unscoped requests retain their existing contract. Both editors open the current project and pin the selected target for the draft. See [scheme and project contracts](profiles-projects-tasks.md).

`profiles_apply.action` is `save`, `rename`, `delete`, `activate`, `bind` or `unbind`; destructive replacement requires explicit `overwrite:true`, referenced schemes cannot be deleted, and save plus `bind_path` is a single transaction. `activate` copies a display snapshot to the independent default. Schemes exclude host and runtime preferences. The editor activation workflow instead loads a default-target draft for ordinary Save. Task details require an explicit session, never collect or repair, and do not imply an atomic cross-file snapshot.

`draft` has exactly `display` (the effective schema-v16 display object) and `host` (`padding`, `refresh_interval`, `hide_vim_mode_indicator`); every field is required. JSON host booleans/numbers are strict: padding 0–32, refresh 1–3600 or `"event"`; strings such as `"off"` and fractional numbers are rejected. Reading a supported display v1–v15 file normalizes it in memory without migrating its file. Preview also accepts a complete v1 display object. Apply requires the complete schema-v16 draft returned by read, so legacy input cannot silently replace newer settings. Preview width is an integer 2–10000.

Unscoped `read` acquires the existing installation lock for a coherent snapshot and may create its runtime lock directory. `describe` does not create configuration files. `preview` never reads settings, detects the host, collects Git/transcripts or writes caches/locks; it uses production formatting/layout and fixed samples. Missing observations are not zero. Each span has `text`, `bold`, `foreground` and `background` (`null`, `{"kind":"rgb","value":"#rrggbb"}` or `{"kind":"ansi","value":0..255}`). There are no raw ANSI escapes. Both main and subagent rows are returned; an empty selection/disabled subagent display stays empty.

Capabilities report the detected host version separately from observed Mod loading. `native_mod` is `unsupported`, `unknown` or `unverified`; `native_mod_loaded` is `null` because a backend process cannot prove what a session loaded. Successful actual Mod callbacks/PTY interactions provide that evidence.

## Revision and frontend generation

The opaque SHA-256 revision covers canonical effective display and host configuration plus normalized `type`/command identities and ownership classifications of `statusLine` and `subagentStatusLine`. Array order is meaningful. Whitespace/key order and unrelated settings do not conflict. Installation commands are tokenized/normalized, never executed while computing the revision.

Apply validates the full draft and a 64-character lowercase hexadecimal revision before acquiring the shared installation lock. Under the lock, the configuration service rereads both files, compares the revision, checks ownership, then uses the existing backup, atomic-write and rollback transaction. The external TUI passes its opening snapshot to the same service and uses the same revision check. The returned revision is computed from the committed snapshot within the lock; apply does not perform a separate unlocked read.

An explicitly configured absolute renderer path must match the selected backend. Canonical PATH commands remain compatible with Windows and older installations; the resolved command identity participates in the revision. JSON invocation through a bound console-script path uses that entry's identity even if PATH contains another installation. A foreign main or subagent renderer is refused, including a same-named executable in another directory or a non-command setting. An absent subagent renderer is permitted. Apply edits display selections and the owned main renderer's host options; it does not install a renderer or take over a foreign one.

Unrelated settings are merged from the latest locked snapshot. A write failure restores both original files and reports any rollback failure. The first save may create a missing display file or migrate older schemas to v16; repeating the returned draft/revision makes no writes or backup when the persisted configuration is already identical. `backup_dir` is present only when the transaction changes files. No model call is needed.

| Error code | Meaning and recovery |
| --- | --- |
| `invalid_json`, `invalid_request`, `invalid_configuration` | Fix the malformed envelope, payload or draft; invalid apply input makes no configuration writes |
| `unsupported_protocol`, `unsupported_operation` | Use a matching frontend/backend protocol and supported operation |
| `configuration_conflict` | Another editor or installation changed the configuration; reread and reconcile the draft |
| `not_installed` | The main renderer is absent; install the selected backend before saving |
| `ownership_mismatch` | A renderer belongs to another installation or owner; resolve ownership before saving |
| `io_error` | A file operation failed; examine the message and any rollback diagnostic |
| `internal_error` | An unexpected backend failure; inspect stderr |

Canonical protocol types, catalog and resource generation live in `packages/core` and `tools/generation/resources.ts`. Run `npm run generate` to regenerate and `npm run generate:check` to reject drift. The Python declarations and generator remain frozen comparison evidence under `archive/python`. Do not maintain another catalog or edit generated Mod types. The Mod uses `$.process.run` with argument arrays and JSON stdin; set `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` to an absolute backend executable if PATH is unsuitable. `CLAUDE_CONFIG_DIR` is passed explicitly when present. No shell interpolation is used.

The TypeScript backend serves runtime protocol 3 with v1/v2 observe/read compatibility through `node packages/cli/dist/src/entry.js runtime --config-dir PATH`. It validates a whole observation batch before writing and emits one JSON response on stdout, with status 2 for invalid observations or unavailable state. Its 1 MiB input limit, duplicate-field rejection, non-finite rejection and preference semantics match the Python boundary. `hook` keeps silent success semantics. Runtime reads never persist binding repair; task/live schemas remain unchanged. TS-04 installation binds both Mods through the shared executable/argv contract.

The bridge rejects malformed or truncated responses, protocol mismatches and nonzero exits, preserving structured backend errors such as conflicts. Process start/refusal errors use `backend_process`; timeout errors use `backend_timeout`. The host process call has a 30-second timeout. The editor displays failures and offers a preview retry; reopening reloads configuration after an opening failure.

The Client editor reads descriptions/configuration on its first opening, retains a complete draft and numeric buffers, and requests preview only when draft or width changes. Ordinary redraws reuse preview. Saving sends the baseline revision and retains the pane after updating the committed snapshot. Conflicts retain the draft for explicit discard/reload; ambiguous outcomes require a read check before retry. Closing invalidates outstanding responses and discards pending changes. Host preferences use separate actual-row API calls and per-row results. Generated descriptions cover catalog, choices, ranges and capabilities; the bridge rejects incomplete or duplicate catalog entries, unsupported choices and unsafe display text.

See [architecture](architecture.md), [native validation](native.md), and [testing](testing.md).


v1.3.0 retains JSON protocol v1 and the display schema. External curses and Client save their opening revisions. The internal Mod/Client port uses epochs, increasing sequences, cumulative pending keys and acknowledgements: coalesced frames retain earlier keys and saves execute in order. Snapshots are deep copies; generation numbers reject stale props. This port is not a new CLI/public API.

## Structured formatting

Protocol v27 returns complete schema-v16 drafts. `formatting` contains shared choices and thresholds, each `instances` entry owns its scoped options, label/icon, priority and maximum width, and `layout` contains auto/explicit rows. Subagent drafts include visibility, completed hiding, row limit and task width. `describe.formatting_options` shares core definitions with generated frontend constants. Missing required current fields and old protocol requests are refused; reinstall matching frontend/backend resources. Complete Client/TUI saves preserve the new fields under the existing revision and transaction.

## Draft transfer operations

`review_import` reads the file once, uses the same strict portable/legacy parser,
and returns a complete candidate without locks, backups, collection or writes.
Each change includes `section`, `kind`, `(scope,item_id)`, a canonical `path`,
`before`, `after` and a localized `label`. Sections cover main/subagent selection,
formatting/overrides, layout, output language and the three statusline host
settings. Reordering compares retained IDs, so insertions/deletions alone are not
reported as moves. Display-only imports preserve the supplied draft's host values.

Both editors show expandable sections and candidate sample previews. Enter expands
details, arrows select sections, Page Up/Down scrolls, and Tab switches the preview
scope. A accepts the in-memory candidate into the draft; cancelling keeps the
previous draft. Acceptance does not reread the file or change the opening revision.
Saving remains a separate revision-checked transaction. Interface preferences,
independent host preferences and collection switches are outside portable files.
Section selection retains its explicit global whitelist and complete main/subagent sections. Protocol 29 also provides reviewed visual-style and complete-group reuse through `review_reuse`; see [draft reuse](../DRAFT_HISTORY.md). Unselected state and local source bindings remain intact. See [selective import](#selective-import-contract). The original `import`
operation remains available to matching protocol clients. Protocol v27 and display
schema v16 evolve independently; reinstall matching frontend/backend resources.

`preset`: payload `{draft,preset}` returns `{draft}` expanded by the shared core. `import`: payload `{draft,path,selection?}` returns a validated `{draft}` without saving; current host options supply defaults for display-only files. `export`: payload `{draft,path,overwrite}` writes a portable file and returns `{path}`. Export is an explicit file action independent of settings Save. These operations do not change installation or the opening revision; subsequent apply uses the original revision. `describe.presets` is generated from the canonical core presets.

## Shared editor forms and host preferences

`packages/core/src/config/editor-fields.ts` defines global and scoped form descriptors, including kind, choices, bounds and nullable behavior. `describe.editor_fields` and generated `EDITOR_FIELDS` share these definitions. Client changes are validated locally before production preview/apply; the backend remains the final validator. The external TUI uses the same descriptors and pure edits. Import/preset replaces only the draft; export can include unsaved edits. Neither changes the opening revision or applies Claude preferences.

Native file operations are effects handled by the hooks module through the Node backend, with argument arrays and JSON stdin. Client modules do not access files. Pending transfer/apply blocks edits and ordinary close; epochs reject late results. Text input reserves printable shortcuts. Ctrl+G cancels an input or leaves the item form; the external TUI uses raw terminal input so Ctrl+S reaches its save handler.

`lib/preferences.ts` maps supported preference concepts to actual menu row IDs, such as `turnDuration`, `reduceMotion`, `tips`, `progressBar` and `notifChannel`. Runtime values, kinds, choices, providers and locks come from `$.config.list()`. Separate Apply rechecks each row before calling `$.config.set()`, retains partial results beside the corresponding row and refuses changed kinds/owners/values or invalid choices. Missing/locked/unsupported rows show official entry guidance. Model/effort/thinking/fast behavior is grouped separately from tool display formats. No persisted Claude key is written directly.

## Phase 5 metric migration

Display schema v16 preserves nullable `metrics.branch_diff_base_ref`; configuration protocol v27 preserves it across both editors, conflicts, previews and portable files. V1/v2/v3/v4/v5 reads have no write effects; a real save backs up and migrates. Runtime protocol v3 retains v1/v2 observe/read; v1 does not claim execution coverage. Committed branch comparisons and frozen ended-agent durations are documented in [metric definitions](../DISPLAY_ITEMS.md).

## UI preference and message operations

`read_ui_preferences` accepts `{}` and returns `schema_version:1`, `ui_language` (a registered language code) and `warning` (`null` or a localized message). Missing/invalid reads fall back to English without repairing bytes. `set_ui_language` accepts exactly `{ui_language}` with a supported code, saves under the existing lock with backup/atomic write and returns the same shape with a null warning. Future preference schemas refuse overwrite. These operations do not change display/host drafts, revisions or installation.

Errors retain stable `code` and English `message`; `localization` is null or `{key,params,fallback}`. Parameters can contain nested message objects as well as scalar values. Frontends validate this shape and render in their current language; external program details stay unchanged. Decisions use codes/keys instead of translated text. `describe` and existing machine-readable catalogs retain English baseline metadata. Generated contracts, strict TypeScript validation and the bundled resource inventory all use configuration protocol v27; UI preference schema v1 and runtime protocol v3 remain independent.

See [translation architecture and contribution rules](i18n.md).

## Statusline language

Display schema v16 includes required `statusline_language` (`en` / `zh-CN` / `zh-TW` / `zh-HK` / `ja` / `ko`), defaulting to English for reads/imports of v1–v5. Reads do not migrate bytes; explicit saves back up and migrate. Configuration protocol v27 requires complete current drafts and includes the language in revisions, previews and portable exports. UI preference schema v1 and runtime protocol v3 remain independent. Presets retain the language, reset restores English, and `config apply --statusline-language` is optional and preserves the current value when omitted.

Protocol v27 retains the independent background channel. Null foreground/background restore the respective terminal or preview-surface defaults. Complete graphemes are styled and clipped as described in [rendering contracts](rendering.md). Display schema v16, portable v1, interface preferences v1 and runtime v3 remain independent; changing the preview surface does not migrate display files.

## Appearance contract

Schema 15 carries the fields documented in [appearance](../APPEARANCE.md). `ItemOptions` and the scoped visibility registry are canonical core definitions; generated defaults, types and shared validation fixtures drive the native editor. CLI and both forms reject unsupported scoped rules. Production and fixed previews use the same visibility, style and block composition; observations and collectors remain separate. Portable v1 and runtime v3 are unchanged.

## Instance identities and drafts

Display schema 16 stores ordered `instances` instead of the legacy wire `items`/`item_options` projection. Each entry has `id`, `type_id`, `enabled`, `options`, and `text`, plus optional local `source` references; IDs are unique per scope, and add/copy generate new identities. Layout rows reference all instances, including disabled ones, with at most one spacer per row. The catalog retains type definitions; configured editor rows derive metadata from those types. Portable envelopes remain v1 and runtime protocol is v3. See [composition](../COMPOSITION.md).

Reading v1–v7 maps canonical type IDs deterministically and retains disabled overrides. Import review compares instance IDs for additions, removals, enablement, retained ordering, options and text. Applying a complete schema-15 draft bypasses legacy type-selection projections.

TS configuration services use the unchanged installation lock and display schema 16, UI protocol 28, semantic revision version 1 and independent preference files. Saves re-read and check ownership/revision under lock; no-op saves do not back up. JSON/UTF-8 diagnostics and integer-like object member ordering are compared with Python 3.14.4. Both editors use the production preview pipeline. Explicit installation records the selected Node/JS binding; ordinary protocol reads do not rewrite it.

## TypeScript backend binding

The bundled compiled ESM backend implements every UI v26 operation, including preview spans, plus runtime v3 with v1/v2 observe/read compatibility, `config`, `render`, `render-subagents`, `hook` and `slash-hook`. Schemas and stdout/stderr roles are unchanged. UI previews and dry-runs do not rewrite live configuration. Direct slash mutations use the same locked configuration service and localize the final block decision in the stored interface language.

For `/statusline-configure`, the application passes `{configDir, backend: LaunchSpec, cwd}` to an injected editor launcher. Results cover updated, already-current, cancelled, interrupted, timed-out and error; recognized commands always block model expansion. Result text is bounded by Unicode characters. TS-04 selects the native terminal launcher and binds a private result lease to the parent identity, backend argv, configuration and nonce. The save guard is rechecked under the configuration lock after waiting. Tests cover real isolated PTYs, tmux popups and Windows consoles as well as injected launchers.

TS-03 configuration help and parser diagnostics resolve the interface preference before display, including an explicit configuration directory. Literal values after `--` cannot act as help or redirect storage. Machine JSON catalogues and output-language selection remain independent of the interface language. Exact human-wording exceptions are recorded per field in the migration comparator.


## Candidate installation and recovery

The TS candidate adds `install`, `uninstall`, read-only `doctor` and explicit
`recover [--config-dir PATH] [--dry-run]`. File phases use version-1 journals and
hash-bound before-images; interrupted work blocks new configuration writes while
rendering/runtime observations remain available. Recovery validates every target
before restoring bytes/absence/modes, or retains a confirmed committed phase.
Official mutation outcomes are reconciled from actual inventory, cache hashes
and argv binding; recovery never blindly replays recorded mutating arguments.
The durable refresh intent preserves an explicitly disabled plugin across the
uninstall/reinstall gap. These artifacts do not change display/UI/runtime wire
schemas. See the [candidate recovery contract](typescript-migration/ts-04/recovery.md).


## Configuration and sample explanation protocol

`explain` accepts `{draft, scope, width}`; scope is `main` or `subagent` and width is an integer from 2 through 10000. It returns `sample:true`, scope, width, `actual_availability:"not_observed"`, the same `preview` as the preview operation, and `instances` keyed by instance ID. Each instance has its type, enablement, reasons with origins and per-sample-row outcomes. `truncated` records clipping separately; final outcomes distinguish visible, condition-hidden, priority-omitted, width-omitted, empty, hidden-agent-row and spacer. Sample outcomes are always synthetic evidence, never live observations.

`reasons.origin` distinguishes draft configuration, local configuration, known host capability and unknown evidence. Unreadable ownership/runtime preferences remain unknown; normally absent runtime preferences retain their existing disabled default. `explain` takes no installation lock, creates no directories and repairs no files. It never reads transcripts, task/usage caches or Git. Existing `read` still locks its coherent snapshot and may create the lock directory; `preview` remains independent of settings and host detection.

`describe.presets` adds `purpose_key`, `requirements_key` and `example`, presenting four use cases before two examples. Preset IDs and expansion semantics remain compatible. Protocol 26 requires matching frontend/backend resources; display schema 16, runtime protocol 3, portable 1 and UI preferences 1 remain independent.

## Setup and complete appearance contracts

The new `display.powerline` object has closed choices and legacy defaults; schema 16 and editor protocol 28 require matching resources. `describe.options` and `editor_fields` expose the five Powerline controls from the same descriptors. The existing preset registry adds three complete schemes without adding a second registry. Setup uses a separate read-only inspection and display-only save service; it does not add an editor-protocol installation operation. [Implementation and acceptance](setup-appearance.md).

## Source operations

`sources_read`, `sources_apply`, `source_review`, `source_context`, `source_refresh`, `source_status`, `source_release`, `source_cancel`, `source_diagnose` expose registry management, independent review and cancellable refresh. `sources_apply` checks the registry revision and commits independently. `source_refresh` returns a job without waiting for execution. Display references contain no executable or file path; portable exports clear binding IDs, and selective imports clear them only in imported sections.


`source_release` accepts `{id,owner}` and returns the job after an idempotent single-consumer release; `source_cancel` remains an explicit whole-job cancellation. Jobs v3 preserve origin owner/trigger and add `consumers:[{owner,expires_at}]`. Applicable automatic leases supply independent interest; only an execution with no interest is cancelled. Jobs v1/v2 remain read-only compatible and running legacy jobs cannot be joined. Both editors share the unresolved-save guard and submitted snapshot; the external TUI uses Ctrl+K for read-only reconciliation. See [correctness interfaces and validation](correctness-maintenance.md).

## Feature contract evolution

The versions below identify each feature’s introduction. The current protocol is 25 and display schema is 15; earlier protocol clients must use matching package resources.

### Indicator contract

Display schema 11 / editor protocol 18 adds optional `presentation`, `bar_width`, and `bar_style` on eligible instances. Omission means numeric, 8 cells and auto. Backend and both editors share eligibility and validation; unsupported types reject these fields. Versions 1–10 read without rewriting files; the next save uses the existing backup/revision transaction. Runtime 2, lifecycle 4, portable 1 and source registry/observations 1 are unchanged. [Delivery record](m4-m7-delivery.md).

### Group contract

Display schema 12 / editor protocol 19 adds `groups` to the main display and subagent template. Each group has `id`, ordered `member_ids`, `primary_id`, `link_visibility` and `shared_powerline`. Old schemas migrate to empty groups without writes. Shared rules reject overlaps, spacers, noncontinuous references and explicit-row crossings. Copy remaps members; deleting a primary dissolves its group. `group_hidden` is an explicit layout/sample reason. Other interface versions remain unchanged.

### WORKFLOW-02 automatic policy

Editor protocol 20 keeps display schema 12. Source registry v2 adds local `automatic` policies: `{source_id,enabled,review_revision,interval_seconds,auth_revision}`; v1 reads as an empty policy list without rewriting. Jobs v2 add `trigger` and `identity`; v1 jobs read as manual. Observation schema remains 1. Runtime v3 adds `source_lifecycle` with `{session_id,epoch,seq,project,host_version,event}` (`tick|end`); v1/v2 observe/read remain supported. Lifecycle dispatch is independent of metric preferences and refuses older lifecycle protocol versions. Policy writes use the existing revision lock; rendering cannot renew leases or start jobs. `source_diagnose.automatic` reports scheduling state and timestamps.

### METRICS-01

Display schema 13 / editor protocol 21 adds the optional main `session-cost-rate` type and optional instance `cost_rate_basis: session|api` (session by omission). Core calculation requires finite nonnegative cost and at least 60,000 ms of the chosen official duration. Units and the estimate marker remain with labels off; source evidence names only the selected denominator. Old display files migrate without enabling this type or rewriting bytes. Source, runtime, portable and UI preference versions remain unchanged from WORKFLOW-02.

### Selective import contract

Editor protocol 22 retains display schema 13. `import` and `review_import` accept an optional `selection` array alongside `draft` and `path`; `profile_import` accepts optional `draft` and `selection` together. An omitted selection retains the original full-import contract. An empty selection produces an unchanged draft. Unknown/duplicate selections and invalid source references are refused. The existing matching envelope parser runs before the shared selector; no target write occurs until the existing revision-checked apply transaction. Selection and differences share core implementations generated into the native editor.

### Gradient contract

Display schema 14 and editor protocol 23 add optional `foreground_gradient` and `background_gradient` arrays to instance options. Each is null/off or 2–5 RGB colors. Missing fields remain disabled; lower source schemas cannot claim these new fields. Presets expand before persistence. Rendering carries internal paint callbacks through fitting and semantic wrapping; these callbacks never enter the wire format. Existing preview spans remain unchanged.


### Explicit-row alignment / COMPOSITION-03

Display schema 15 and editor protocol 24 add optional `layout.alignments`:
`[{"id":"summary","columns":[[{"kind":"instance","id":"a"},{"kind":"group","id":"g"}]]}]`.
References resolve to complete main units in current explicit rows; IDs, row uniqueness,
side, ordering and non-overlap are validated before persistence. Older schemas reject
this field. Two-phase layout measures once, retains hidden slots, then draws with
one shared color cursor and observation cache. Width fallback keeps the original
fitting path; explain/diagnose adds `alignment_active` / `alignment_collapsed`
reason codes without changing response envelopes. The Layout manager is generated
from core for both editors; pending manager state crosses the native Client port.

## Appearance and diagnosis protocol 26

Display schema 16 retains all earlier fields and adds `ocean`, `ember`, `slate`, `blossom` theme values. Schemas 1–15 normalize in memory without writing; new values require schema 16. Explicit saves retain existing ownership, revisions, locks, backups and recovery. Matching protocol-27 frontend/backend resources are required.

`preview` and `explain` accept optional `scenario`; absence means `normal`. Production previews return `scenario` metadata. Valid IDs are `normal`, `warning`, `critical`, `zero`, `missing`, `source-stale`, `source-failed`, `long-content`, `git-clean`, `git-modified`, `git-conflicted`, `no-agents`, `few-agents`, `many-agents`. Scenario selection changes only injected observations. Width selection and row browsing are session-only UI state.

`diagnose_file` accepts `{draft,path,scope,width,observed_at?,include_local?}`. It reads the explicit path through the same UTF-8/BOM/32-MiB/strict-JSON validation as CLI diagnosis and returns `DiagnoseResult`; `include_local` defaults to false. Relative paths resolve against the backend working directory. Existing `diagnose` retains supplied JSON and its existing defaults. Scope mismatch, invalid input/time and unreadable files remain structured failures. No operation collects or writes display/runtime state.

Sample and diagnosis rows can include `style_reasons:[{code,owner_id}]`. Codes are `colors_disabled`, `background_gradient_requires_powerline`, `group_background_owned`, `threshold_warning`, `threshold_critical`, `color_quantized`, `contrast_protected`. Owners identify the primary instance where applicable. Reasons are traced from production rendering and remain separate from missing-observation evidence. Native presentation budgets props, Pane and Client tree independently and transports only visible report/selector content.

## Task browsing and package review protocol 27

`task_details` keeps its version-1 response and explicit session/prompt semantics. `task view` and both reading frontends share session-only search, filters, tree expansion, evidence visibility and row anchors; none changes the task store.

Protocol 27 adds `package_status` (`prefix: string|null`, `offset: nonnegative integer`), `package_review_start` (`owner`, `request`), and `package_review_status` / `package_review_cancel` (`id`, `owner`). A request contains `action` (`check`, `update`, `rollback`, `recover-package`, `restore-config`), `prefix`, `expected_revision`, and nullable `target`, `channel`, `backup_id`, `expected_integrity`. Metadata checks and verified dry runs are distinct. Restoration returns its own file review and does not claim artifact verification.

Status includes the current backend version, installed identity, compatibility reasons, pending operation and at most 16 history records per page. Jobs have version 1 and running/complete/failed/cancelled states. Their temporary files are separate from installation journals; polling is explicit, cancellation is owner-bound, and identity/revision changes invalidate results. Matching frontend/backend resources are required. Display schema 16, task details 1 and existing runtime, source, profile and preference formats are unchanged.

## Source operations and package execution protocol 28

Editor protocol 28 adds `source_inspect`, `source_bindings_review/cleanup`, `source_draft`, `package_execute_start/status/detach` and `package_cleanup_review/apply`. Core defines bounded summaries/pages and shared interaction states; CLI enforces revision, identity, permission and reference rules; platform owns file/process/delete effects. Mod resources are generated from these canonical contracts.

Source registry 3 extends automatic policies to commands. Old registries remain read-only compatible and do not grant new permission. Job 4 adds optional bounded execution result; jobs 1–3 read missing results as unknown. Observations keep version 1 with optional checks/execution fields. Command output protocol stays v1; runtime stays v3 with optional confirmed local-agent contexts. Effective scheduling identity includes source revision, declared scope and actual inputs. Five-second renewal and fifteen-second expiry remain unchanged.

Package execution records have independent version 1 and retained controls. Progress reads never rewrite records; verified process identity distinguishes stopped from unknown. Package-history/pending `running` is `true`, `false` or `null` (unverifiable). Unknown executors retain their records and block recovery/replacement until exit or a different identity is confirmed. Cleanup is revision-bound and conservative. Source registry 3 or newer display configuration may prevent an old package reading current files; rollback review must reject incompatible configuration before replacement. Do not edit schema numbers to force rollback.
