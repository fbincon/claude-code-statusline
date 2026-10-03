# Shared catalog and JSON configuration protocol

**English** | [简体中文](contracts.zh-CN.md)

Protocol v1 is an internal interface for the source-native frontend. Display persistence stays at schema v2, including existing v1 reads; it evolves independently from the protocol. No native editor is installed by the released wheel.

## Catalog

`claude_statusline.config.catalog` defines the 24 main and 10 subagent items by `(scope, id)`. Definitions carry labels, descriptions, groups, sources, examples, default positions, format options, exclusions and unavailable-reason codes. Legacy catalog dictionaries and default tuples are derived views; existing IDs, descriptions, default selections and ordering are preserved. CLI JSON listings add metadata without removing their existing enabled/position fields. Curses and the installed wizard consume the same definitions and exclusions.

Minimum versions are verified only where evidence exists. The 2.1.205 subagent minimum denotes row support, not every optional field: effort requires 2.1.214. Main-field minima remain `null`/`unknown` instead of guessed dates. `not_observed` means the interface has not inspected live data, `unsupported_host` means a verified version boundary, `unknown_host_version` means detection failed, `source_unavailable` means a source cannot be read, and `condition_not_met` covers items such as Git outside a repository or fast mode while inactive. These are definitions of possible reasons; opening configuration does not collect live field availability or disable selections for missing observations.

## Transport and operations

Run `claude-statusline ui --config-dir PATH` (Windows: `claude-statusline.exe`). One process reads one UTF-8 JSON object to EOF and writes exactly one JSON response and a newline. Stdout is reserved for the envelope; unexpected failures are diagnosed on stderr. Success exits 0 and rejected requests exit 2.

```json
{"protocol_version":1,"operation":"read","payload":{}}
```

Success is `{"protocol_version":1,"result":{...}}`; failure is `{"protocol_version":1,"error":{"code":"...","message":"..."}}`. Envelope and payload keys are checked. Duplicate JSON keys, non-finite constants, wrong versions/types, unknown operations and invalid drafts are refused.

| Operation | Payload | Result |
| --- | --- | --- |
| `describe` | `{}` | Catalog, configuration option choices/ranges, capabilities, backend version and supported operations |
| `read` | `{}` | `draft`, `revision`, `installed`, `installation`, capabilities and backend version |
| `preview` | `{"draft": {...}, "width": 80}` | `sample: true`, `main` and `subagents` rows of drawable spans |

`draft` has exactly `display` (the effective v2 display object) and `host` (`padding`, `refresh_interval`, `hide_vim_mode_indicator`). JSON host booleans/numbers are strict: padding 0–32, refresh 1–3600 or `"event"`; strings such as `"off"` and fractional numbers are rejected. Existing display v1 input is normalized in memory, without migrating its file. Preview width is an integer 2–10000.

`read` acquires the existing installation lock for a coherent snapshot and may create its runtime lock directory. `describe` does not create configuration files. `preview` never reads settings, detects the host, collects Git/transcripts or writes caches/locks; it uses production formatting/layout and fixed samples. Missing observations are not zero. Each span has `text`, `bold`, and `foreground` (`null`, `{"kind":"rgb","value":"#rrggbb"}` or `{"kind":"ansi","value":0..15}`). There are no raw ANSI escapes. Both main and subagent rows are returned; an empty selection/disabled subagent display stays empty.

Capabilities report the detected host version separately from observed Mod loading. `native_mod` is `unsupported`, `unknown` or `unverified`; `native_mod_loaded` is `null` because a Python process cannot prove what a session loaded. Successful actual Mod callbacks/PTY interactions provide that evidence.

## Revision and frontend generation

The opaque SHA-256 revision covers canonical effective display and host configuration plus normalized `type`/command identities and ownership classifications of `statusLine` and `subagentStatusLine`. Array order is meaningful. Whitespace/key order and unrelated settings do not conflict. Installation commands are tokenized/normalized, never executed while computing the revision.

Python wire types in `claude_statusline.ui.contracts` generate `lib/generated-contracts.ts`. Run `tools/generate_ui_contracts.py` to regenerate and `--check` to reject drift. Do not maintain a second item catalog or edit generated types. The Mod uses `$.process.run` with argument arrays and JSON stdin; set `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` to an absolute backend executable if PATH is unsuitable. `CLAUDE_CONFIG_DIR` is passed explicitly when present. No shell interpolation is used.

The native probe reads descriptions/configuration when opened, keeps the draft in TypeScript and requests preview when it changes or resizes. Closing invalidates outstanding responses. Colors remain transient; save UI is Phase 2. `apply` and shared editor revision validation are introduced by the next Phase 1 change.

See [architecture](architecture.md), [native validation](native.md), and [testing](testing.md).
