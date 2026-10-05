# Live observation contracts

**English** | [简体中文](live.zh-CN.md)

Phase 5 source development adds an independent, opt-in `statusline-runtime` Mod.
It requires a verified Claude Code 2.1.289 build and does not depend on the native
editor preference. `install --live-metrics` enables it; `--no-live-metrics` retains
an explicit disabled choice. Absence defaults off for previews and stable releases.
The separate schema-1 `claude-statusline-runtime.json` is not imported/exported as
display configuration. Official installation, ownership checks, backups, rollback,
version suspension and removal share the editor's parameterized implementation.

## Runtime transport

`claude-statusline runtime --config-dir PATH` receives one UTF-8 JSON object and
returns one JSON response. Runtime protocol **1** evolves independently from the
configuration protocol. Stdout contains only `{protocol_version,result}` or
`{protocol_version,error}`; success exits 0, refused requests exit 2. Duplicate
fields, unsafe identities, nonfinite/negative numbers, unknown fields and requests
larger than 1 MiB are rejected. `observe` validates the complete batch before writes.

| Operation | Payload | Behavior |
| --- | --- | --- |
| `observe` | `{observations:[...]}` | At most 256 strict records; accepted/ignored counts and backend version. Disabled collection has no persistence effects. |
| `read` | `{session_id,prompt_id}` | Session-isolated state, current prompt, freshness and unavailability reason; no repair or persistence. `prompt_id` may be null. |

Every observation includes `session_id`, `epoch`, `seq`, `observed_at_ms`, `source`,
`kind`, nullable `prompt_id`, `turn_id`, `agent_id`, `parent_agent_id`, `request_id`,
and a kind-specific `payload`. Python owns validation and produces the TypeScript
definition through `tools/generate_runtime_contracts.py`; frontend bindings do not
maintain a separate contract. Foundation kinds are heartbeat, invalidation, prompt,
permission snapshot and agent start/end. Only a verified change feed can claim a
live permission value. A hook snapshot is explicitly an observation, not settings
`defaultMode` or proof that the mode has remained unchanged.

## Ownership and persistence

Each session has a hashed filename under `statusline_runtime/live`, or `live` under
`CLAUDE_STATUSLINE_RUNTIME_DIR`. A fixed per-session lock spans read/merge/atomic
publication; files are private on POSIX. Stores retain up to 100 sessions, 32 epochs,
32 prompts and 256 agents. Each epoch retains a 4096-sequence deduplication window
and rejects older sequences below its retained floor. Sequence gaps mark incomplete
coverage. Missing or ambiguous ownership is not attached to the current prompt.

A native heartbeat bootstraps an epoch and updates every 5 seconds. It becomes
stale after 15 seconds, and backward clocks are unavailable. A newer load resets
live bindings and invalidates unfinished coverage; old epochs can retain attributed
history but cannot replace current observations. Resume/clear/end invalidate live
state. The Mod refreshes its session binding after these boundaries.

Observation hooks pass their input/result through unchanged. A bounded queue batches
publication outside routine event handling, retries exact identities after refusal,
and preserves the bootstrap heartbeat during overflow. Collector failure does not
alter model requests or timer completion. `runtime/live` never writes `runtime/turns`.
The installer does not enable or redirect telemetry exporters or retain prompts,
answers or arbitrary tool arguments in this store.

## Validation

Run Python live-protocol/store and independent-installation regressions, generated
runtime contract checks, exact-build declarations, strict official validation,
official Mod tests and TypeScript. `tools/runtime_install_smoke.py --report PATH`
checks actual installation, both Mods together, read/observe, repeat installation,
older-host suspension/restoration, independent disable and uninstall in temporary
configuration without model calls. The native workflow retains older editor jobs
and adds Windows/macOS 2.1.289 alongside Linux 2.1.289. Installation and a mocked
heartbeat do not establish real-session loading or human interaction acceptance.

See [architecture](architecture.md), [testing](testing.md),
[official Mods events](https://code.claude.com/docs/en/plugins/mods/reference), and
[official telemetry](https://code.claude.com/docs/en/monitoring-usage).

## State views

Turn IDs bind main tools and agent spawns to the executing task, independently of a newly queued prompt. Native spawn results establish parent/child ownership; unknown loop IDs remain unavailable. Task/Todo snapshots and updates are kept per prompt and reset on reload. Successful empty snapshots represent 0/0, distinct from no observation. The newest started main tool wins even if an older parallel tool finishes later. Terminal state and results remain readable after heartbeat expiration; unfinished live observations do not.

## State views

Turn IDs bind main tools and agent spawns to the executing task, independently of a newly queued prompt. Native spawn results establish parent/child ownership; unknown loop IDs remain unavailable. Task/Todo snapshots and updates are kept per prompt and reset on reload. Successful empty snapshots represent 0/0, distinct from no observation. The newest started main tool wins even if an older parallel tool finishes later. Terminal state and results remain readable after heartbeat expiration; unfinished live observations do not.
