# Live observation contracts

**English** | [简体中文](live.zh-CN.md)

The bundled `statusline-runtime` Mod supports verified Claude Code 2.1.289+ hosts. Native task timing defaults on; advanced live metrics remain opt-in. These preferences are independent of the editor and of the visible item selection.

`claude-statusline-runtime.json` uses schema 2: `native_timing` defaults to true and `live_metrics` to false. A schema-1 explicit false keeps both disabled; explicit true keeps both enabled. Reinstall retains saved choices. `install --native-timing` / `--no-native-timing` controls timing; `--live-metrics` enables complete observations and `--no-live-metrics` preserves the old all-off behavior. An explicit timing switch in the same command controls timing separately. Unsupported/unknown hosts suspend the Mod without changing preferences.

## Runtime transport

`claude-statusline runtime --config-dir PATH` receives one UTF-8 JSON object and
returns one JSON response. Runtime protocol **2** evolves independently from the
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

## Requests

Runtime v1 adds request_start/first/end, turn_usage and request_cost. Local request IDs include turn/agent/step, and official cost IDs deduplicate server requests independently. Typed usage requires all four nonnegative integer counters. Engine references distinguish real and synthetic stream content. Iterator next/return/throw, chunks and results are passed through unchanged; observation failure is isolated.

Python retains unbound turns/requests/spawns/tools and reconciles only unique completed lifecycle intervals with explicit spawn parents. No advanced metric writes lifecycle state. Unowned workflows/forks are excluded; task token sums include verified nested agents and main wrap-up, and turn.complete totals only check coverage. Conflicting duplicates invalidate their request; missing usage is unknown, zero is real. TTFT and output-rate refer to the latest main request and reject backward/zero duration clocks. Existing api_request collector records may provide an attributed estimated-cost subtotal; unjoined coverage remains partial.

Official user_prompt telemetry links prompt.id to message.uuid explicitly; differing UUIDs and delayed cost records never use text or token-count matching. Unbound costs remain unavailable until the linked message belongs to a verified executing/completed task.

## v1.6.0 stable acceptance

On 2026-10-05 the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS. Exact OS, architecture, terminal and host versions were not supplied. This is the new Phase 5 acceptance record, separate from historical editor confirmation and automated/headless/PTY evidence. The existing macOS Client input limitation remains documented. Stable v1.6.0 retains the accepted runtime implementation, display schema v4, configuration protocol v3 and runtime protocol v1. Editor entries default on for compatible hosts, preserving explicit false; live collection remains independently opt-in and preserves its preference.

## Task timing integration

Protocol v2 adds native reported duration, wait start/end and explicit coverage metadata. V1 requests remain readable but cannot establish complete execution-time coverage. Timing-only mode suppresses advanced persistence while still tracking sequence continuity. The live observation lock precedes the task lock; task writers never acquire a live lock. Retries preserve identities and remain idempotent.

Official prompt-ID/message-UUID links can promote a uniquely verified lifecycle owner when print/SDK mode omitted session.append. Unbound live turns stay unbound. Completion recorded before session exit remains completed when its batch arrives late. Message aliases and background-report aliases are distinct. See [task clocks](timer.md).

`runtime read` includes `task-active-timer`; unavailable reasons include `native_timing_disabled`, `wait_coverage_missing`, `incomplete`, `stale` and `abnormal_clock`. The current host conservatively hides execution time for permission/question/MCP waiting whose exact boundaries cannot be proved.
