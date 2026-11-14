# 开发指南

[English](README.md) | **简体中文** · [文档中心](../README.zh-CN.md)

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
| 配置与显示 | [首次设置与外观](setup-appearance.zh-CN.md) · [方案、项目与任务](profiles-projects-tasks.zh-CN.md) · [配置体验](configuration-experience.zh-CN.md) |
| 渲染、预览与诊断 | [自适应行](adaptive-row-scenarios.zh-CN.md) · [外观／预览诊断](appearance-preview-diagnosis.zh-CN.md) · [真实输入诊断](real-input-diagnostics.zh-CN.md) |
| 扩展来源、任务与工作流 | [扩展](extensions.zh-CN.md#职责与契约) · [来源／命令／包管理](source-command-package-management.zh-CN.md) · [任务与版本审阅](task-version-review.zh-CN.md) · [内置技能工作流](skill-workflows.zh-CN.md) |
| 维护语言 | [翻译指南](i18n.zh-CN.md) · [多语言工作流](i18n-workflow.zh-CN.md) · [Node 与地区语言](node-regional-languages.zh-CN.md) |
| 制作与核验媒体 | [图片索引](../images/README.zh-CN.md) · [SHOWCASE-01 采集步骤](showcase.zh-CN.md#collection) |
| 准备发布 | [发布流程](../RELEASING.zh-CN.md#current-typescript-publication) |

共同设计约定、验收和交接见[开发计划](development-plan.zh-CN.md#work-index)。[路线图](roadmap.zh-CN.md)维护优先级和工作包状态，其中[候选池](roadmap.zh-CN.md#candidates)记录未选定的方向及进入条件。

<a id="documentation-ownership"></a>

### 文档更新责任

| 信息 | 维护位置 |
| --- | --- |
| 如何安装、配置和排障 | [使用指南](../USER_GUIDE.zh-CN.md)维护入口与常用操作，[专题指南](../README.zh-CN.md#配置与排障)维护详细流程，[CLI 参考](../reference/cli.zh-CN.md)维护命令语法 |
| 当前实现、接口与验证规则 | [架构](architecture.zh-CN.md)、[共享契约](contracts.zh-CN.md)及上方对应技术指南。验证方法见[测试与验收](testing.zh-CN.md)和[影响检查](impact-checks.zh-CN.md)。 |
| 当前接口与格式版本 | [CLI 参考](../reference/cli.zh-CN.md#协议与-schema-版本)维护版本数字与读取范围；[共享契约](contracts.zh-CN.md)维护操作与兼容行为 |
| 优先级、候选方向、阶段依赖和工作包状态 | [路线图](roadmap.zh-CN.md) |
| 工作包范围、实施切片与验收要求 | [开发计划](development-plan.zh-CN.md#work-index) |
| 原始设计、源码身份、交付结果及证据限制 | [开发历史](history/README.zh-CN.md)。面向用户的版本变更见[变更日志](../../CHANGELOG.zh-CN.md)和[发布说明](../releases/README.zh-CN.md)。 |

在功能 PR 中同步更新受影响的中英文现行页面。详细步骤和规则由对应指南维护，摘要链接到该指南。交付时在开发历史记录版本或阶段、源码及适用产物身份、实际检查、结果和限制，并登记到[交付索引](history/README.zh-CN.md#delivery-records)。

归档时保留原始证据、命令和结果。更新导航，为移走的每个章节保留原路径、原锚点及指向新位置的链接。用 `npm run docs:check` 和 `git diff --check` 检查双语页面以及新旧链接。

### 新增现行文档页面

1. **配对与导航。** 新增 `docs/<page>.md` 与 `docs/<page>.zh-CN.md`。以一个 H1 和现有语言导航行开头；除既有历史锚点外，不要把锚点放在 H1 之前。
2. **范围与索引。** 添加简短范围段落，将页面加入所属索引，并按[文档更新责任](#documentation-ownership)选择维护位置。长页面可加 `## 文档导航`；短页面无需添加。
3. **登记。** 若页面包含源码事实或 `docs-example` 标记，在 `tools/checks/impact-documentation.ts` 中登记并运行内容与示例测试。若页面属于现行但尚未具备源码事实，在 `tools/checks/docs.ts` 的 `checkDocumentationRegistration` 显式白名单中登记，并在交付记录中说明原因；在具备源码事实前不要加入 `DOCUMENT_CONTENT_PATHS`。不得让新页面同时绕过两者。
4. **风格。** 保持单一事实来源：链接[协议与 schema 版本](../reference/cli.zh-CN.md#协议与-schema-版本)，不重复版本号；链接详细流程，不复制内容。与 shell 无关的命令块使用 `text`，需要区分 shell 时使用 `bash` 或 `powershell`；较长指南末尾保留一行相关指南链接。冻结页面沿用既有历史／状态提示措辞。
5. **交付。** 新增双语交付记录与历史索引条目，然后运行 `docs:check`、已登记的内容与示例测试及 `git diff --check`。

### 模板与检查登记表

| 产物 | 模板 | 检查 | 边界 |
| --- | --- | --- | --- |
| 交付记录 | [交付记录模板](history/README.zh-CN.md#交付记录模板) | `checkDeliveryRecords` | 2026-11-14 起的记录 |
| 发布说明 | [发布说明模板](../RELEASING.zh-CN.md#发布说明模板) | `checkReleases` | 当前时代；3.16.4 起更严格 |
| 变更日志 | [变更日志模板](../RELEASING.zh-CN.md#变更日志模板) | `checkChangelog` | 3.16.4 起的条目 |
| 审批决定 | [审批决定模板](../RELEASING.zh-CN.md#审批决定模板) | `checkApprovalData` | 已登记决定 |
| 图片图库 | [图库模板](../images/README.zh-CN.md#图库模板) · [清单 schema 2](../images/README.zh-CN.md#采集清单-schema-2) | `checkImageGalleries` | 新图库及 schema 2 |
| 文档页面 | 本节 | `checkDocumentationPages` · `checkDocumentationRegistration` | 当前已登记页面 |
| PR 模板 | [`.github/pull_request_template.md`](../../.github/pull_request_template.md) | `checkPullRequestTemplate` | 单文件双语模板 |
| 验收回执 | [回执 envelope](testing.zh-CN.md#acceptance-receipt-envelope) | `validateAcceptanceEnvelope` | 试点脚本；CI 绑定格式不变 |
| 技能资源 | [资源骨架](skill-workflows.zh-CN.md#canonical-resource-skeleton) | `checkSkillResources` | `packages/cli/resources/*/SKILL.md` |

### 迁移与交付记录

[开发历史索引](history/README.zh-CN.md)汇集[工作包设计档案](history/work-package-designs.zh-CN.md#completed-designs)、各版交付记录、迁移阶段、性能报告和历史验证流程。

## 文档导航

- [技术文档导航](#技术文档导航)
- [开发与测试](#开发与测试)
- [内部命令](#内部命令)
- [实现说明](#实现说明)
- [公开包交付](#公开包交付)

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

`npm run check` 覆盖真实 Node 并发、故障、终端、固定案例、生成资源、文档及职责台账。`tools/generation/` 维护当前语言／Mod 输出，不重新生成 Python 归档，也不维护技能输出。状态栏技能资源以 `packages/cli/resources/statusline-config/SKILL.md` 和 `packages/cli/resources/statusline-configure/SKILL.md` 为规范源，单独维护。构建后可在受支持 Node 下用 `npm run test:runtime` 测试编译产品，无需重新构建。

完整产品验收义务由[测试与验收](testing.zh-CN.md#当前-typescript-检查)维护；2.1.296 类型声明缺口单独保留。执行共享、草稿检查和诊断的含义不同。

<a id="documentation-content-checks"></a>

### 检查文档内容

`docs:check` 继续提供轻量的链接、锚点及双语／模板检查。对已登记的现行指南，另运行依照源码的内容与示例测试：

```bash
npm run build
node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js
```

| 检查 | 能证明的内容 |
| --- | --- |
| `docs:check` | 本地链接、锚点及双语／模板结构正确。 |
| `docs-content.test.js` | 根目录及现行开发指南中已登记的事实与来源定义一致；格式错误或相互矛盾的数字声明会失败。 |
| `docs-examples.test.js` | 选定的标记 CLI 示例在隔离临时目录中成功运行，并满足预期效果及拒绝行为。 |
| `Complete candidate evidence` | 最终不可变 PR head 具备影响计划要求的证据；本地文档检查本身不能证明这一点。 |

内容规则比较完整数值，支持千分位、英文数字词及中文计数，不查找预期数字子串。目录、语言、预设、接口及实时上限来自 core；矩阵数量、Node 选择器及宿主历史拆分来自现有 CI 注册表。来源自动刷新的默认值／范围、租约期限、Mod 续租定时器及安装检查类别，则使用现有 TypeScript 解析器读取对应执行定义或验收清单，不执行这些源码文件。定义缺失、定位不唯一、语法无法解析或相关定义不一致时明确失败，不回退到旧字面值。

当前运行传输／请求声明必须与 core 一致，包含加粗及带 `v` 的版本写法。明确的历史引入说明、兼容范围及协议历史表格保留原始版本。行内代码及 `bash`、`sh`、`shell`、`powershell`、`ps1`、`console`、`text` 代码块中的字面 `npm run` 命令均与根清单对照，覆盖参数、受支持的 npm 选项及 shell 续行。此静态检查不执行命令，也不解释任意 shell 程序。

示例测试读取实际 `docs-example` 代码块，并用生产解析器验证 JSON。CLI 选项表与生产 `OPTIONS` 对照；排序、布局兼容、Profile 目标／重置、来源及目标修订拒绝、恢复预演和诊断／任务 JSON 均有定向覆盖。仅替换文档声明的路径／修订／实例／会话占位符；命令示例实际运行 Node 输出 `42`，GitHub 使用注入的离线 runner，本地 JSON 用例验证子代理观测缓存发布。这不代表真实 GitHub、交互式 PowerShell 或实体编辑器验收。未登记的事实及说明文字不在自动内容检查范围内。

[登记页面清单](../../tools/checks/impact-documentation.ts)使相关页面变更（含删除／重命名）在 `docs` 之外选择现有 `checks` 测试族，后者保留 Linux、Windows、macOS 执行。新增或移动现行页面时，同步维护登记和示例标记。修改已登记事实时，更新英中两版及其源码对照规则，补充能在源码变化后拒绝旧文档、接受正确新文档的回归测试；识别的执行结构变化时，明确更新源码读取器。早于此测试的历史源码保留原有义务。清单进入不可变影响政策摘要。已提交验收仍使用所选 `ci:plan`／`ci:check` 任务。

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

从 stdin 读取 Claude Code 官方 `subagentStatusLine` JSON，并把每个有效 task 渲染为一行 `{"id":"...","content":"..."}` NDJSON。顶层 JSON、`tasks` 或单项字段损坏时静默降级且退出码仍为 0；stdout 只包含协议结果；普通 payload 指标不扫描 transcript 或查询网络，终态计时可以读取已有本地结束证据。启用并绑定的外部值可以读取选定 JSON、检查本地 Git 身份并保存观测缓存；命令／GitHub provider 不在渲染过程中执行。详见 [CLI 渲染边界](../reference/cli.zh-CN.md#子-agent-行与三种作用域)。

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
