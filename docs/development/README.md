# Development guide

**English** | [简体中文](README.zh-CN.md) · [Documentation index](../README.md)

Start here to set up the TypeScript workspace, select checks and build an installed candidate. Daily use is covered by the [user guide](../USER_GUIDE.md), [CLI reference](../reference/cli.md) and [usage demonstrations](../SHOWCASE.md).

Development and builds use the Node version in [`.node-version`](../../.node-version) and the npm version in the [`package.json`](../../package.json) `packageManager` field. Product runtimes support Node 22 and 24.

## Technical documentation

### Current development

| Task | Entry points |
| --- | --- |
| Follow workspace and contribution rules | [AGENTS.md](../../AGENTS.md), maintained in English · [Contributing](../../CONTRIBUTING.md) · [Repository governance](repository-governance.md) |
| Understand the implementation | [Architecture](architecture.md) · [Shared contracts](contracts.md) · [Rendering and Unicode](rendering.md) |
| Select validation and CI evidence | [Testing and acceptance](testing.md) · [Impact checks](impact-checks.md) · [CI maintenance/promotion](ci-maintenance.md) · [Measured CI costs](ci-efficiency.md) |
| Work on host integrations | [Native editor](native.md) · [Capacity/recovery](native-capacity.md) · [Task timing](timer.md) · [Live metrics](live.md) |
| Maintain languages | [Translation guide](i18n.md) · [Multilingual workflow](i18n-workflow.md) |
| Produce and verify media | [Image index](../images/README.md) · [SHOWCASE-01 capture procedure](showcase.md#collection) |
| Prepare a publication | [Release process](../RELEASING.md#current-typescript-publication) |

Use the [development plan](development-plan.md#work-index) for shared design rules, acceptance and handoff. The [roadmap](roadmap.md) owns priorities and work-package status. Its [candidate pool](roadmap.md#candidates) lists unselected directions and their entry conditions.

<a id="documentation-ownership"></a>

### Where to update documentation

| Information | Where to maintain it |
| --- | --- |
| How users install, configure and troubleshoot | [User guide](../USER_GUIDE.md) for entry points and common operations, [topic guides](../README.md#configure-and-troubleshoot) for detailed workflows and [CLI reference](../reference/cli.md) for command syntax |
| Current implementation, interfaces and validation rules | [Architecture](architecture.md), [shared contracts](contracts.md) and the applicable technical guide above. [Testing and acceptance](testing.md) and [impact checks](impact-checks.md) describe how to verify changes. |
| Current interface and format versions | [CLI reference](../reference/cli.md#protocol-and-schema-versions) for version numbers and read ranges; [shared contracts](contracts.md) for operations and compatibility behavior |
| Priorities, candidates, dependencies between stages and work-package status | [Roadmap](roadmap.md) |
| Work-package scope, implementation slices and required acceptance | [Development plan](development-plan.md#work-index) |
| Original designs, source identities, delivery results and evidence limits | [Development history](history/README.md). Find user-facing changes by version in the [changelog](../../CHANGELOG.md) and [release notes](../releases/README.md). |

Update the affected current pages in both languages in the feature PR. Keep detailed steps and rules in the guide responsible for them and link to that guide from summaries. At delivery, record the version or stage, source and applicable artifact identities, actual checks, results and limits in development history. Add the record to the [delivery index](history/README.md#delivery-records).

Preserve original evidence, commands and results when archiving. Update navigation and leave a link at the old path and section anchor for each moved section. Check both languages and the old and new links with `npm run docs:check` and `git diff --check`.

### Migration and delivery records

The [development history index](history/README.md) links the [work package design archive](history/work-package-designs.md#completed-designs), versioned delivery records, migration stages, performance reports and historical validation procedures.

## Contents

- [Development and testing](#development-and-testing)
- [Internal commands](#internal-commands)
- [Implementation notes](#implementation-notes)

<a id="appendix-development-and-testing"></a>
<a id="附录开发与测试"></a>

## Development and testing

<a id="准备开发环境"></a>

### Prepare a development environment

Install the pinned Node and npm versions along with Git and Git LFS. Run the following command from the checkout root. Git policy regressions exercise real LFS transformations in isolated repositories.

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

Development is independent of the installed product. Normal workflows need no Python, pip, Ruff, wheel or native compiler.

<a id="运行检查"></a>

### Run checks

Select checks from the actual responsibilities changed:

| Change | Local entry |
| --- | --- |
| Maintained documentation/templates | `npm run docs:check` and `git diff --check` |
| Committed maintenance, including media/tools | `npm run ci:plan` and the selected `npm run ci:check` tasks; package-sensitive plans require `--compare` |
| Core product behavior | `npm run check` and `git diff --check` |
| Canonical generated resources | `npm run generate` followed by `npm run generate:check`, plus the applicable checks above |

Use immutable commits and new report paths as described in [impact checks](impact-checks.md). Mixed changes combine their obligations; unknown ownership or unresolved comparisons block. Local checks do not replace the final-head `Complete candidate evidence` gate or verified main promotion. [CI routing](ci-maintenance.md).

`npm run check` covers real Node contention, failures, terminals, frozen cases, generated resources, documentation and responsibility ledgers. `tools/generation/` owns current language/Mod/skill outputs and never regenerates the Python archive. After building, `npm run test:runtime` tests compiled products under a supported Node without rebuilding.

Complete product acceptance includes eight installed targets, 32 Node cases, sixteen fixed host combinations and applicable native-capacity cases consuming matching artifacts. Missing 2.1.296 declarations remain explicit. Execution sharing, draft checks and diagnostics retain separate meanings; see [testing and acceptance](testing.md).

<a id="documentation-content-checks"></a>

### Check documentation content

`docs:check` remains a lightweight link, anchor and bilingual/template check. For the registered current guides, also run the source-backed content and example tests:

```bash
npm run build
node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js
```

The tests read the marked `docs-example` fences in the actual Markdown, validate JSON with production parsers, compare catalog/language/preset/interface facts with core, and run selected CLI workflows in temporary directories. The CLI option table is compared with production `OPTIONS`; sorting, layout compatibility, Profile targets/reset, source/target revision refusals, recovery preview and diagnostic/task JSON have targeted coverage. Only documented path/revision/instance/session placeholders are substituted. The command example runs Node to print `42`; GitHub uses an injected offline runner, and local JSON source cases verify subagent observation-cache publication. This does not establish live GitHub, interactive PowerShell or physical editor acceptance, or validate every prose statement.

The [registered page list](../../tools/checks/impact-documentation.ts) selects the existing `checks` family alongside `docs` when those pages change, including deletion/rename. `checks` retains Linux, Windows and macOS execution. Keep registration and example markers with a moved current page; historical sources predating the suite retain their original obligations. The list is part of the immutable impact-policy digest. Use the selected `ci:plan`/`ci:check` tasks for committed acceptance.

### Clean compiled outputs

After deleting or moving source files, preview the cleanup, remove stale compiled files and rebuild:

```bash
npm run clean -- --dry-run
npm run clean
npm run build
```

Cleanup targets six fixed output directories: the four product packages' `packages/{core,platform,cli,tui}/dist`, test support's `tools/testing/dist` and tools' `dist/typescript`, including their build caches. The command runs directly with Node and needs no prior build; missing directories are harmless on repeated runs. A linked output directory or parent inside the checkout is rejected before any deletion.

Source, Node dependencies, archives, release packages and acceptance records remain, including all other root `dist` contents. Ordinary `npm run build` continues to build incrementally.

<a id="从源码构建与安装"></a>

### Build and install from source

Follow [candidate build and isolated installation](testing.md#candidate-build-and-isolated-installation) to build and verify a fixed commit and install the candidate into a temporary prefix.

<a id="隔离测试与人工验收"></a>

### Isolated testing and manual acceptance

See [testing and acceptance](testing.md) for installed, fixed-host, terminal, power and paid checks. The frozen Python implementation has a [separate verification procedure](../../archive/python/README.md).

<a id="appendix-internal-commands"></a>
<a id="附录内部命令"></a>

## Internal commands

These commands are primarily called by Claude Code and the installed integrations, rather than used for daily configuration:

### `render`

Read Claude Code status-line JSON from stdin and output one or more status-line text rows to stdout using current configuration. Invalid input is silent so errors do not pollute the Claude Code UI.

Use simulated input for basic troubleshooting. Linux / WSL / macOS, rendered at 120 columns:

```bash
printf '%s\n' '{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"/tmp"}}' \
  | COLUMNS=120 claude-statusline render
```

Windows PowerShell:

```powershell
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.cmd render
```

These examples read `claude-statusline.json` from the current configuration directory, so output depends on enabled items. Automated checks should point `CLAUDE_CONFIG_DIR` to a temporary directory.

### `render-subagents`

Read official Claude Code `subagentStatusLine` JSON from stdin and render each valid task as one `{"id":"...","content":"..."}` NDJSON line. Invalid top-level JSON, `tasks`, or individual fields degrade silently with exit code 0. Stdout contains only protocol results. Ordinary payload metrics do not scan transcripts or query the network; completed timing can read existing local end evidence. Enabled, bound external values may read selected JSON, inspect local Git identity and save observation caches; command/GitHub providers are not executed during rendering. See [CLI rendering boundaries](../reference/cli.md#subagent-rows-and-the-three-scopes).

Linux / WSL / macOS:

```bash
printf '%s\n' '{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' \
  | claude-statusline render-subagents
```

Windows PowerShell:

```powershell
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.cmd render-subagents
```

### `hook`

Read Claude Code lifecycle events from stdin and silently update local prompt-timing state. Corrupted input is designed not to block Claude Code turns.

### `slash-hook`

Read `UserPromptExpansion` events from stdin. Handle local `statusline-config` shortcuts with arguments and enabled no-argument `statusline-configure` launch requests. No-argument `statusline-config` passes through to the wizard skill; recognized `statusline-configure` always emits a `decision: "block"` JSON, translating child exit codes only into result text. Unrelated events and corrupted input pass through silently.

### `ui` / `runtime`

`ui [--config-dir PATH]` serves one internal JSON configuration request for the editor backend. `runtime [--config-dir PATH]` serves one independent live-observation request. Both read stdin and return protocol responses on stdout; they are integration interfaces, not interactive editors. Use matching package/Mod resources. See [shared contracts](contracts.md) and [live protocol](live.md).

<a id="appendix-implementation-notes"></a>
<a id="附录实现说明"></a>

## Implementation notes

The current TypeScript implementation uses absolute Node/JS argv, native file locks and dedicated platform adapters. The [architecture](architecture.md) and [shared contracts](contracts.md) describe application services, terminal bridging and recovery transactions.

See the [historical implementation notes](history/python-implementation.md) for earlier Python versions.

- <a id="平台执行与文件安全"></a><a id="platform-execution-and-file-safety"></a>[Platform execution and file safety](history/python-implementation.md#platform-execution-and-file-safety)
- <a id="配置写入与并发"></a><a id="configuration-writes-and-concurrency"></a>[Configuration writes and concurrency](history/python-implementation.md#configuration-writes-and-concurrency)
- <a id="实验启动器与结果回传"></a><a id="experimental-launchers-and-result-bridging"></a><a id="external-launchers-and-result-bridging"></a>[External launchers and result bridging](history/python-implementation.md#external-launchers-and-result-bridging)
- <a id="component-instances-and-layout"></a>[Component instances and layout](history/python-implementation.md#component-instances-and-layout)

## Public package delivery

See the [release guide](../RELEASING.md#current-typescript-publication) for the current process and the [installation guide](../USER_GUIDE.md#installation-and-integration) for public packages.
