# Shared catalog and JSON configuration protocol

**English** | [简体中文](contracts.zh-CN.md)

Protocol v1 is the internal interface for the bundled/source native frontend. Display persistence stays at schema v2, including existing v1 reads; it evolves independently from the protocol. Stable v1.1.1 does not include this interface; the v1.2.0a1 candidate wheel bundles the matching Mod.

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
| `apply` | `{"draft": {...}, "expected_revision": "<read revision>"}` | Saved read snapshot, `changed`, and `backup_dir` (a path or `null`) |

`draft` has exactly `display` (the effective v2 display object) and `host` (`padding`, `refresh_interval`, `hide_vim_mode_indicator`); every field is required. JSON host booleans/numbers are strict: padding 0–32, refresh 1–3600 or `"event"`; strings such as `"off"` and fractional numbers are rejected. Reading an existing display v1 file normalizes it in memory without migrating its file. Preview also accepts a complete v1 display object. Apply requires the complete v2 draft returned by read, so legacy input cannot silently replace newer settings. Preview width is an integer 2–10000.

`read` acquires the existing installation lock for a coherent snapshot and may create its runtime lock directory. `describe` does not create configuration files. `preview` never reads settings, detects the host, collects Git/transcripts or writes caches/locks; it uses production formatting/layout and fixed samples. Missing observations are not zero. Each span has `text`, `bold`, and `foreground` (`null`, `{"kind":"rgb","value":"#rrggbb"}` or `{"kind":"ansi","value":0..15}`). There are no raw ANSI escapes. Both main and subagent rows are returned; an empty selection/disabled subagent display stays empty.

Capabilities report the detected host version separately from observed Mod loading. `native_mod` is `unsupported`, `unknown` or `unverified`; `native_mod_loaded` is `null` because a Python process cannot prove what a session loaded. Successful actual Mod callbacks/PTY interactions provide that evidence.

## Revision and frontend generation

The opaque SHA-256 revision covers canonical effective display and host configuration plus normalized `type`/command identities and ownership classifications of `statusLine` and `subagentStatusLine`. Array order is meaningful. Whitespace/key order and unrelated settings do not conflict. Installation commands are tokenized/normalized, never executed while computing the revision.

Apply validates the full draft and a 64-character lowercase hexadecimal revision before acquiring the shared installation lock. Under the lock, the configuration service rereads both files, compares the revision, checks ownership, then uses the existing backup, atomic-write and rollback transaction. Curses passes its opening snapshot to the same service and uses the same revision check. The returned revision is computed from the committed snapshot within the lock; apply does not perform a separate unlocked read.

An explicitly configured absolute renderer path must match the selected backend. Canonical PATH commands remain compatible with Windows and older installations; the resolved command identity participates in the revision. JSON invocation through a bound console-script path uses that entry's identity even if PATH contains another installation. A foreign main or subagent renderer is refused, including a same-named executable in another directory or a non-command setting. An absent subagent renderer is permitted. Apply edits display selections and the owned main renderer's host options; it does not install a renderer or take over a foreign one.

Unrelated settings are merged from the latest locked snapshot. A write failure restores both original files and reports any rollback failure. The first save may create a missing display file or migrate v1 to v2; repeating the returned draft/revision makes no writes or backup when the persisted configuration is already identical. `backup_dir` is present only when the transaction changes files. No model call is needed.

| Error code | Meaning and recovery |
| --- | --- |
| `invalid_json`, `invalid_request`, `invalid_configuration` | Fix the malformed envelope, payload or draft; invalid apply input makes no configuration writes |
| `unsupported_protocol`, `unsupported_operation` | Use a matching frontend/backend protocol and supported operation |
| `configuration_conflict` | Another editor or installation changed the configuration; reread and reconcile the draft |
| `not_installed` | The main renderer is absent; install the selected backend before saving |
| `ownership_mismatch` | A renderer belongs to another installation or owner; resolve ownership before saving |
| `io_error` | A file operation failed; examine the message and any rollback diagnostic |
| `internal_error` | An unexpected backend failure; inspect stderr |

Python wire types in `claude_statusline.ui.contracts` generate `lib/generated-contracts.ts`. Run `tools/generate_ui_contracts.py` to regenerate and `--check` to reject drift. Do not maintain a second item catalog or edit generated types. The Mod uses `$.process.run` with argument arrays and JSON stdin; set `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` to an absolute backend executable if PATH is unsuitable. `CLAUDE_CONFIG_DIR` is passed explicitly when present. No shell interpolation is used.

The bridge rejects malformed or truncated responses, protocol mismatches and nonzero exits, preserving structured backend errors such as conflicts. Process start/refusal errors use `backend_process`; timeout errors use `backend_timeout`. The host process call has a 30-second timeout. The editor displays failures and offers a preview retry; reopening reloads configuration after an opening failure.

The native editor reads descriptions/configuration when opened, retains a complete draft and numeric buffers, and requests preview only when draft or width changes. Ordinary redraws reuse preview. Saving sends the baseline revision and retains the pane after updating the committed snapshot. Conflicts retain the draft for explicit discard/reload; ambiguous outcomes require a read check before retry. Closing invalidates outstanding responses and discards pending changes. Host preferences use separate actual-row API calls and per-row results. Generated descriptions cover catalog, choices, ranges and capabilities; the bridge rejects incomplete or duplicate catalog entries, unsupported choices and unsafe display text.

See [architecture](architecture.md), [native validation](native.md), and [testing](testing.md).
