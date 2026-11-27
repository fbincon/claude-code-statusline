# AgentRow and legacy subagent rows

**English** | [简体中文](agent-row-compatibility.zh-CN.md)

This 2026-11-28 feature delivery adds Claude Code's AgentRow Mod alongside the existing subagent status-line command. Both integrations use the same display configuration. This delivery creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Installation | `install --subagent-renderer auto\|mod\|legacy` saves the local preference. Automatic selection uses the command on Claude Code 2.1.205–2.1.322 and prefers the independent Mod from 2.1.326. Versions 2.1.323–2.1.325 display built-in rows. [Host requirements](../../../USER_GUIDE.md#requirements) |
| Rendering | Both paths share the 17 subagent component types, project Profile, colors and ordered row fitting. The Mod accounts for nesting in each row's width and applies row limits across the panel. [Rendering rules](../../rendering.md) |
| Handover and recovery | When an owned legacy command is present, installation retains it until the Mod verifies its first applicable batch in a live session. The handover rechecks ownership. `doctor` reports the installed renderer, session load and first-batch evidence separately. Package downgrade removes the owned row plugin before handing control to an older installation. [Package management](../../../PACKAGE_MANAGEMENT.md) |

## Source identities

- The starting commit was `3faa811c8a6010e02dac48784b5945d78534a13b`.
- The initial Linux host matrix used `15bbbee2833b06a4d18b5d9d7a4b57afe4176b6d` and package SHA-256 `42243735ae1e96681cdf40c578acb9959755ba2cbbaa73ed3915f89dc75ce7d7`.
- The paid host check used `4cdf95b27067c80a8c10a85e3da6bef84a45f146`. Two builds produced the same package SHA-256, `e24f04f4689492145baceef0233d418137ea0e4bed425edca04d80df7c1f86c5`.
- The functional changes and recovery regressions are in `18dcc27ab1edddbbfb4027a9d9577af4b5bfd34f`. Two clean builds produced package SHA-256 `c24ba1ef45f0962500816975a97d75bae5fc54334188caf6f4456ff0d834ca99`. The PR is the audit trail for the final reviewed head, integration and installed package. [PR #307](https://github.com/fbincon/claude-code-statusline/pull/307)

## Validation and limits

| Check | Actual result |
| --- | --- |
| Final candidate and installed integration, `18dcc27a` | The candidate verifier checked 1,183 files. All seven installed integration smoke checks passed. |
| Final Linux x64 PTY matrix, `18dcc27a` | Node 24.21.0 ran all 14 scenarios on official hosts 2.1.322, 2.1.323, 2.1.325, 2.1.326 and 2.1.332. The host started 28 agents and made 28 requests to the loopback model service. External model requests and cost were zero. Terminal output confirmed both renderers, built-in rows on the two gap hosts, filtering, migration and host downgrade. A separate 2.1.332 scenario preserved a third-party callback. The source-bound receipt SHA-256 is `f5383316614361f6b3d994b09e663b08bc8320eb07a868770f2b6cf05149f360`. |
| Terminal styles, `18dcc27a` | The legacy and Mod rows matched cell by cell for the bold agent name, its foreground `#14afd2` and background `#312a70`, and Chinese text rendered in the successive gradient colors `#ff006e`, `#af309e` and `#5e60ce`. |
| Initial cross-version run, `15bbbee2` | The initial candidate also passed its 14 Linux PTY scenarios with 28 agents and zero external model calls. |
| Claude Code 2.1.332 plugin tests, `4cdf95b2` | The official host suite passed 366 Native editor tests, 20 runtime tests and nine AgentRow tests. The Mods also passed their type checks against declarations from that build. |
| Paid provider on 2.1.332 | One model request reported 615 input tokens and three output tokens. The host raised five AgentRow events. The terminal displayed the configured text and color. The actual provider charge was unavailable, so USD 0.25 remains reserved against the USD 10 total budget. |
| Package and configuration recovery | Installed-package downgrade to v3.7.0 preserved manual plugin disablement and a third-party environment setting. The recovery and installer regression checks passed 52 tests and the prefix-alias regression passed. |

Compatibility for 2.1.324 comes from its shipped settings declaration. The PTY runs checked the two neighboring versions, 2.1.323 and 2.1.325. [SDK settings for 2.1.324](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.324/sdk.d.ts)

The PTY and plugin tests provide automated host evidence. The paid check covers one request on a single host. The six previously accepted [issue #96 validation gaps](../../testing.md#known-validation-gaps) remain unverified.
