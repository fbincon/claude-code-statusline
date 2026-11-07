# 开发指南

[English](README.md) | **简体中文**

本页说明 TypeScript 工作区准备、检查选择与安装候选构建。日常使用见[使用指南](../USER_GUIDE.zh-CN.md)、[CLI 参考](../reference/cli.zh-CN.md)和[操作演示](../SHOWCASE.zh-CN.md)。

开发和构建使用 [`.node-version`](../../.node-version) 固定的 Node 和 [`package.json`](../../package.json) 的 `packageManager` 指定的 npm。成品支持 Node 22／24。

## 技术文档导航

### 当前开发

| 任务 | 入口 |
| --- | --- |
| 遵循工作区与贡献约定 | 仅维护英文的 [AGENTS.md](../../AGENTS.md) · [贡献指南](../../CONTRIBUTING.zh-CN.md) · [仓库治理](repository-governance.zh-CN.md) |
| 理解实现 | [架构](architecture.zh-CN.md) · [共享契约](contracts.zh-CN.md) · [渲染与 Unicode](rendering.zh-CN.md) |
| 选择验证与 CI 证据 | [测试与验收](testing.zh-CN.md) · [影响检查](impact-checks.zh-CN.md) · [CI 维护／晋级](ci-maintenance.zh-CN.md) · [CI 实测耗时](ci-efficiency.zh-CN.md) |
| 维护宿主接入 | [原生编辑器](native.zh-CN.md) · [容量／恢复](native-capacity.zh-CN.md) · [任务计时](timer.zh-CN.md) · [实时指标](live.zh-CN.md) |
| 维护语言 | [翻译指南](i18n.zh-CN.md) · [多语言工作流](i18n-workflow.zh-CN.md) |
| 制作与核验媒体 | [图片索引](../images/README.zh-CN.md) · [SHOWCASE-01 采集步骤](showcase.zh-CN.md#collection) |
| 准备发布 | [发布流程](../RELEASING.zh-CN.md#current-typescript-publication) |

共同设计约定、验收和交接见[开发计划](development-plan.zh-CN.md#work-index)。[路线图](roadmap.zh-CN.md)维护优先级和工作包状态，其中[候选池](roadmap.zh-CN.md#candidates)记录未选定的方向及进入条件。

### 迁移与交付记录

[开发历史索引](history/README.zh-CN.md)汇集[已交付设计](history/README.zh-CN.md#completed-work-designs)、各版交付记录、迁移阶段、性能报告和历史验证流程。

## 文档导航

- [开发与测试](#开发与测试)
- [内部命令](#内部命令)
- [实现说明](#实现说明)

<a id="附录开发与测试"></a>

## 开发与测试

### 准备开发环境

安装上述版本的 Node、npm 以及 Git、Git LFS。在仓库根目录运行以下命令。Git 策略回归会在隔离仓库执行真实 LFS 转换。

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

开发环境独立于已安装产品。默认流程不需要 Python、pip、Ruff、wheel 或原生编译器。

### 运行检查

按实际变更职责选择检查：

| 变更 | 本地入口 |
| --- | --- |
| 现行文档／模板 | `npm run docs:check` 和 `git diff --check` |
| 已提交维护，含媒体／工具 | `npm run ci:plan` 与所选 `npm run ci:check` 任务；涉及包内容的计划需 `--compare` |
| 核心产品行为 | `npm run check` 和 `git diff --check` |
| 规范生成源 | `npm run generate` 后执行 `npm run generate:check`，并执行上方适用检查 |

按[影响检查](impact-checks.zh-CN.md)使用不可变提交和新报告路径。混合变更合并检查要求；归属未知或比较未解决时阻断。本地检查不能替代最终 head 的 `Complete candidate evidence` 门禁及 main 晋级核验。[CI 分流](ci-maintenance.zh-CN.md)。

`npm run check` 覆盖真实 Node 并发、故障、终端、固定案例、生成资源、文档及职责台账。`tools/generation/` 维护当前语言／Mod／技能输出，不重新生成 Python 归档。构建后可在受支持 Node 下用 `npm run test:runtime` 测试编译产品，无需重新构建。

完整产品验收包含八个安装目标、32 个 Node 用例、十六个固定宿主组合及适用的 Native 容量案例，使用匹配产物。2.1.296 类型声明缺口单独保留；执行共享、草稿检查和诊断的含义不同，见[测试与验收](testing.zh-CN.md)。

### 清理编译输出

删除或移动源码后，可以先预览，再清理旧编译文件并重新构建：

```bash
npm run clean -- --dry-run
npm run clean
npm run build
```

清理固定的六个输出目录：四个产品包 `packages/{core,platform,cli,tui}/dist`、测试支持包 `tools/testing/dist` 和工具目录 `dist/typescript`，包括其中的构建缓存。命令直接使用 Node，无需先构建；目录缺失时可重复执行。任何输出目录或其仓库内父目录为符号链接时，命令会在删除前拒绝执行。

源码、Node 依赖、归档、发布包和验收记录保留，根目录其余 `dist` 内容也保留。普通 `npm run build` 继续使用增量构建。

### 从源码构建与安装

按[候选包构建与隔离安装](testing.zh-CN.md#candidate-build-and-isolated-installation)从固定提交构建、验证并安装到临时 prefix。

### 隔离测试与人工验收

安装包、固定宿主、终端、电源和付费检查的选择与证据要求见[测试与验收](testing.zh-CN.md)。冻结的 Python 实现有[独立验证流程](../../archive/python/README.zh-CN.md)。

<a id="附录内部命令"></a>

## 内部命令

以下命令主要由 Claude Code 和安装的接入调用，不作为日常配置入口：

### `render`

从 stdin 读取 Claude Code statusline JSON，根据当前配置向 stdout 输出一行或多行状态栏文本。无效输入时保持静默，以免错误内容污染 Claude Code UI。

可以使用模拟输入做基础排查。Linux / WSL / macOS（按 120 列渲染）：

```bash
printf '%s\n' '{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"/tmp"}}' \
  | COLUMNS=120 claude-statusline render
```

Windows PowerShell：

```powershell
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.cmd render
```

这些示例会读取当前配置目录中的 `claude-statusline.json`，输出取决于当前启用项。自动化检查应将 `CLAUDE_CONFIG_DIR` 指向临时目录。

### `render-subagents`

从 stdin 读取 Claude Code 官方 `subagentStatusLine` JSON，并把每个有效 task 渲染为一行 `{"id":"...","content":"..."}` NDJSON。顶层 JSON、`tasks` 或单项字段损坏时静默降级且退出码仍为 0；stdout 只包含协议结果，renderer 不扫描 transcript、Git、网络或运行状态。

Linux / WSL / macOS：

```bash
printf '%s\n' '{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' \
  | claude-statusline render-subagents
```

Windows PowerShell：

```powershell
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.cmd render-subagents
```

### `hook`

从 stdin 读取 Claude Code 生命周期事件，静默更新本地 prompt 计时状态。它被设计为即使输入损坏也不阻塞 Claude Code 回合。

### `slash-hook`

从 stdin 读取 `UserPromptExpansion` 事件。它处理名为 `statusline-config` 且带参数的本地快捷命令，也处理已启用的无参数 `statusline-configure` 启动请求。前者无参数时放行给问答 skill；后者一经识别始终输出一个 `decision: "block"` JSON，子进程退出码只转换为结果文本。无关事件和损坏输入会静默放行。

### `ui` / `runtime`

`ui [--config-dir PATH]` 为编辑器后端处理一次内部 JSON 配置请求，`runtime [--config-dir PATH]` 处理一次独立实时观测请求。二者从 stdin 读取、向 stdout 返回协议响应，属于接入接口，不是交互编辑器；使用匹配的软件包与 Mod 资源。详见[共享协议](contracts.zh-CN.md)及[实时协议](live.zh-CN.md)。

<a id="附录实现说明"></a>

## 实现说明

当前 TypeScript 实现使用绝对 Node/JS argv、原生文件锁及独立的平台适配器。应用服务、终端桥和恢复事务见[架构](architecture.zh-CN.md)和[共享契约](contracts.zh-CN.md)。

早期 Python 版本见[历史实现说明](history/python-implementation.zh-CN.md)。

- <a id="平台执行与文件安全"></a>[平台执行与文件安全](history/python-implementation.zh-CN.md#平台执行与文件安全)
- <a id="配置写入与并发"></a>[配置写入与并发](history/python-implementation.zh-CN.md#配置写入与并发)
- <a id="实验启动器与结果回传"></a><a id="外部启动器与结果回传"></a>[外部启动器与结果回传](history/python-implementation.zh-CN.md#外部启动器与结果回传)
- <a id="组件实例与布局"></a>[组件实例与布局](history/python-implementation.zh-CN.md#组件实例与布局)

## 公开包交付

现行步骤见[发布指南](../RELEASING.zh-CN.md#current-typescript-publication)。用户可从[安装指南](../USER_GUIDE.zh-CN.md#安装与接入)获取公开包。
