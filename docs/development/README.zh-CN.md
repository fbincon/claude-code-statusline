# 开发指南

[English](README.md) | **简体中文**

本页说明 TypeScript 工作区准备、检查选择与安装候选构建。日常使用见[使用指南](../USER_GUIDE.zh-CN.md)、[CLI 参考](../reference/cli.zh-CN.md)和[操作演示](../SHOWCASE.zh-CN.md)。

开发／构建使用 Node 24.21.0、npm 11.19.0，固定值来自 [`.node-version`](../../.node-version) 和 [`package.json`](../../package.json)；成品运行支持 Node 22／24。普通开发不需要 Python，[冻结的 Python 参考](../../archive/python/README.zh-CN.md)有独立手动验证流程。

## 技术文档导航

### 当前开发

| 任务 | 入口 |
| --- | --- |
| 遵循工作区与贡献约定 | 仅维护英文的 [AGENTS.md](../../AGENTS.md) · [贡献指南](../../CONTRIBUTING.zh-CN.md) · [仓库治理](repository-governance.zh-CN.md) |
| 理解实现 | [架构](architecture.zh-CN.md) · [共享契约](contracts.zh-CN.md) · [渲染与 Unicode](rendering.zh-CN.md) |
| 选择验证与 CI 证据 | [测试与验收](testing.zh-CN.md) · [影响检查](impact-checks.zh-CN.md) · [CI 维护／晋级](ci-maintenance.zh-CN.md) |
| 维护宿主接入 | [原生编辑器](native.zh-CN.md) · [容量／恢复](native-capacity.zh-CN.md) · [任务计时](timer.zh-CN.md) · [实时指标](live.zh-CN.md) |
| 维护语言 | [翻译指南](i18n.zh-CN.md) · [多语言工作流](i18n-workflow.zh-CN.md) |
| 制作与核验媒体 | [图片索引](../images/README.zh-CN.md) · [SHOWCASE-01 证据](showcase.zh-CN.md) |
| 准备发布 | [发布流程](../RELEASING.zh-CN.md) |

[路线图](roadmap.zh-CN.md#milestones)负责当前优先级与工作包状态，[开发计划](development-plan.zh-CN.md#future-work)负责范围、依赖、切片及验收；[候选池](roadmap.zh-CN.md#candidates)记录尚未选定的想法。规划修改与历史交付记录不宣布新行为可用。

### 迁移与交付记录

这些记录保留功能引入版本、源码身份、原始检查及限制。当前行为以用户指南和共享契约为准；后续文档修改不改变既有验收结果。

| 领域 | 交付记录 |
| --- | --- |
| v3.16.1 正确性修复 | [运行身份、来源超时与保存冲突](runtime-source-save-fixes.zh-CN.md#final-release)，已发布并完成本机核验 |
| 语言 | [十二语言扩展](language-expansion.zh-CN.md) · [I18N-02 生命周期](i18n-02-delivery.zh-CN.md) · [Node 与地区语言](node-regional-languages.zh-CN.md) |
| 外观、草稿与复用 | [自适应行与场景](adaptive-row-scenarios.zh-CN.md) · [草稿历史与复用](draft-history-and-reuse.zh-CN.md) · [外观／预览／诊断](appearance-preview-diagnosis.zh-CN.md) |
| 任务、来源与软件包 | [任务／版本审阅](task-version-review.zh-CN.md) · [来源／命令／包执行](source-command-package-management.zh-CN.md) · [扩展](extensions.zh-CN.md) |
| 设置与配置 | [首次设置／完整方案](setup-appearance.zh-CN.md) · [配置体验](configuration-experience.zh-CN.md) · [方案／项目／任务](profiles-projects-tasks.zh-CN.md) · [真实输入诊断](real-input-diagnostics.zh-CN.md) |
| 早期里程碑及修复 | [M4–M7](m4-m7-delivery.zh-CN.md) · [M8–M9](m8-m9-delivery.zh-CN.md) · [M10–M12](m10-m12-delivery.zh-CN.md) · [正确性维护](correctness-maintenance.zh-CN.md) |
| 迁移后审查 | [问题盘点](post-migration-review.zh-CN.md) · [修复](post-migration-fixes.zh-CN.md) · [外部 TUI 一致性](external-tui-parity.zh-CN.md) · [外部 TUI 回归](external-tui-regressions.zh-CN.md) |
| 性能 | [已完成 PERF-01](performance/perf-01.zh-CN.md) · [v1.13.0](performance-v1.13.0.zh-CN.md) · [v1.12.0](performance-v1.12.0.zh-CN.md) · [v1.11.0](performance-v1.11.0.zh-CN.md) |
| 展示交付 | [SHOWCASE-01](showcase.zh-CN.md) |

[TypeScript 迁移计划](typescript-migration.zh-CN.md)链接已完成阶段：[TS-01 参考](typescript-migration/ts-01/README.zh-CN.md)、[TS-02 探针](typescript-migration/ts-02/README.zh-CN.md)、[TS-03 核心／后端](typescript-migration/ts-03/README.zh-CN.md)、[TS-04 编辑器／恢复](typescript-migration/ts-04/README.zh-CN.md)、[TS-05 候选](typescript-migration/ts-05/README.zh-CN.md)、[TS-06 发布](typescript-migration/ts-06/README.zh-CN.md)。原 [TS-04 候选](typescript-migration/ts-04/candidate.zh-CN.md)、[恢复](typescript-migration/ts-04/recovery.zh-CN.md)和 [Linux 实机／延期验收](typescript-migration/ts-02/LINUX-20261014.zh-CN.md)保留为历史证据。

## 文档导航

- [开发与测试](#开发与测试)
- [内部命令](#内部命令)
- [实现说明](#实现说明)

<a id="附录开发与测试"></a>

## 开发与测试

### 准备开发环境

安装固定的 Node 24.21.0/npm 11.19.0、Git 和 Git LFS 后，在仓库根目录运行。Git 策略回归会在隔离仓库执行真实 LFS 转换：

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

```bash
SOURCE_COMMIT=$(git rev-parse HEAD)
npm run candidate:build -- --commit "$SOURCE_COMMIT" --output /absolute/new-candidate
```

构建执行两次独立干净重建并要求字节一致。输出候选包、源码包、SHA256SUMS 和构建清单。
临时安装、PowerShell/直接 Node 入口、升级和恢复步骤见[候选指南](typescript-migration/ts-05/candidate.zh-CN.md)。
不要从当前 main 执行 pipx 源码安装；已发布 Python 产品仍可按固定标签或 wheel 安装。

### 隔离测试与人工验收

`test:installed` 接收制品、固定提交和报告路径，在源码之外使用空缓存、离线模式、禁用生命周期脚本，
且 PATH 不包含 Python/编译器。`test:mods` 验证固定官方主机与实际安装绑定。
`reference:verify` 是独立的手动 Python 历史入口。详见[测试指南](testing.zh-CN.md)。
终端、电源和付费验收均显式调用；普通 CI 不产生付费会话。保留日常安装产品及真实配置。

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

当前 TypeScript 实现使用绝对 Node/JS argv、原生文件锁及独立的平台适配器。应用服务、终端桥和恢复事务见[当前架构](architecture.zh-CN.md)、[候选指南](typescript-migration/ts-05/candidate.zh-CN.md)和[TS-04 记录](typescript-migration/ts-04/README.zh-CN.md)。

<details>
<summary>历史 Python 实现说明</summary>

以下保留已发布 Python 产品的实现说明与原有锚点，源码冻结在 [Python 归档](../../archive/python/README.zh-CN.md)。其中的 Python 路径、锁实现和 Windows `.exe` 命令仅适用于历史版本。

### 平台执行与文件安全

Linux/macOS 安装器向 Claude Code 设置写入带 POSIX 引号的绝对可执行文件路径。Windows 写入可由 Git Bash 与 PowerShell 执行的命令名，因此必须能从 `PATH` 解析 `claude-statusline.exe`：

```text
claude-statusline.exe render
claude-statusline.exe render-subagents
claude-statusline.exe hook
claude-statusline.exe slash-hook
```

Windows skill 使用 `claude-statusline.exe config ...`，只预授权 `Bash(claude-statusline.exe config *)` 与 `PowerShell(claude-statusline.exe config *)`；Linux/macOS skill 仅预授权安装时绝对路径对应的 Bash 命令。Claude Code 在 Windows 上优先通过 Git Bash、缺失时通过 PowerShell 执行 statusline 命令，所以 settings 中四个内部命令统一使用裸 `.exe`，不写入会被 Git Bash 解释为转义符的反斜杠绝对路径。参见 [Claude Code Statusline 的 Windows 约定](https://code.claude.com/docs/en/statusline)。

Windows 的 NTFS `st_mode` 不是可靠的 POSIX 权限信息，`doctor` 会报告 mode 检查不适用；文件安全依赖用户 Claude 配置目录继承的 Windows ACL。结果回传仍会拒绝符号链接、junction、其他 reparse point、越界路径、非普通文件和超过 16 KiB 的结果。

### 配置写入与并发

配置、token 缓存、Git 缓存与逐轮状态写入使用同目录临时文件、文件 `fsync` 和原子替换。Linux/macOS 应用 `0600/0700`、同步父目录，并使用 `fcntl.flock`；Windows 使用继承的用户 ACL、`msvcrt` 固定字节锁，并对短暂 sharing violation/access denied 做有上限的重试。多个并发配置命令共享同一把跨平台文件锁，避免后写入者丢失先写入者的变更。

macOS 文件系统对父目录同步返回 `EINVAL`、`ENOTSUP/EOPNOTSUPP` 时，保留文件 `fsync` 与原子替换并由 `doctor` 和 CI 报告降级；其他 I/O 或权限错误继续传播。不额外调用 `F_FULLFSYNC`。

macOS 的会话进程标识使用 `/bin/ps -o lstart= -p PID`，固定 `LC_ALL=C` 与 `TZ=UTC`，保留输出内部空格；先筛选匹配会话再查询进程，超时 1 秒或查询失败时不信任该注册记录。计时使用 LibSystem 的 `mach_continuous_time()` 与 `mach_timebase_info()` 整数换算，结合 `kern.bootsessionuuid` 检查跨进程重启；任一接口不可用时整组回退墙钟。

全局 Enter 只调用一次现有原子配置事务。无变化不会创建备份；有变化时仍使用单次备份、双文件写入与失败回滚。TUI 启动时记录语义基准，保存时在同一安装锁内检查 display、host 和安装归属；编辑期间如被其他进程修改，会在创建备份和写文件前拒绝。`settings.json` 中与 statusline 无关的字段变化不构成冲突，并会基于锁内最新文件合并保留。

<a id="实验启动器与结果回传"></a>

### 外部启动器与结果回传

外部 `/statusline-configure` 沿用终端启动器，没有绕过 hook 的终端隔离；会话内 Client 由另一条 Mod 命令提供。Claude Code 2.1.259 的 command hook 在没有控制终端的新 session 中执行，hook 及其子进程不能打开 `/dev/tty`，`terminalSequence` 也不能绘制 curses 界面。因此本工具只把 slash command 用作本地启动器，并在另一个受支持的终端环境中运行已经存在的 `claude-statusline configure`；状态机、样例预览、并发检测和原子保存没有复制实现。

Linux 启动器按以下顺序选择：

1. `TMUX` 与形如 `%<数字>` 的 `TMUX_PANE` 都有效、`tmux` 可执行，且最长 2 秒的只读预检查能在当前 server 中解析该 pane 时，在当前客户端打开标题为 `Configure Status Line` 的 `90% × 90%` popup。popup 存在期间 tmux 暂停底层 pane 更新，子进程退出后自动关闭。
2. tmux 不可用或预检查失败，但存在 `DISPLAY`/`WAYLAND_DISPLAY` 且可执行 `gnome-terminal` 时，在最近使用的 GNOME Terminal 窗口打开活动新标签页；没有现存窗口时 GNOME 可以创建窗口。命令使用 `--wait` 等待标签页中的 TUI 退出。
3. 两者都不可用时阻断 slash expansion，不调用模型，并提示在终端运行 `claude-statusline configure` 或改用 `/statusline-config`。

macOS 优先复用上述 tmux 路径；缺少有效 server/pane 或预检查失败时，通过最长 2 秒的 `launchctl print gui/<uid>` 只读检查验证本地图形会话，并检查系统 Terminal.app 与 `open`。SSH 会话不启动桌面 Terminal，macOS 不选择 GNOME。

Terminal 路径使用 `/usr/bin/open -b com.apple.Terminal` 打开私有 `0700` 的 `.command` 文件，文件启动当前 Python 和包中的内部辅助模块。Python、CLI、配置目录与工作目录使用绝对路径，PATH 和包搜索路径显式传递，所有 shell 值均引用。`open` 的退出码仅表示启动请求已处理；30 秒启动握手确认编辑器进程身份，随后通过现有 schema v1 结果桥等待 TUI 完成。无需 AppleScript 自动化授权，也不修改 Terminal 的窗口偏好。

编辑器定时检查父调用的进程身份、请求文件和调用期限，并在配置事务锁内保存前再次核对。关窗、中断、父调用退出、撤销请求或超时不会继续保存草稿。回收前核对 PID 与启动标识，仅处理本次编辑器；读取结果后清理本次调用的启动脚本、请求、握手和结果文件。Terminal 窗口关闭或保留由用户的 Terminal 设置决定。

Windows 不探测 tmux/GNOME。它使用当前虚拟环境的 `sys.executable -m claude_statusline configure --config-dir ...`，并通过 [`CREATE_NEW_CONSOLE`](https://learn.microsoft.com/en-us/windows/console/creation-of-a-console) 创建实际 Python 子进程；不重定向 stdin/stdout/stderr，使 curses 获得真实控制台。系统当前默认终端负责承载这个新控制台，Windows Terminal 设为默认终端时会自然接管。启动器保留子进程句柄，因此关窗或异常退出会立即返回错误，超时会终止并回收子进程。

只有 tmux popup 接近“同 pane 弹窗”；GNOME 路径明确是新标签页。当前版本不提供 `x-terminal-emulator`、Konsole、Kitty、WezTerm 或 iTerm2 自动启动器；这些终端中可使用独立 `configure`。hook payload 的 `cwd` 只有在它是存在的绝对目录时才作为启动目录，否则使用用户 home。启动器不拼接 command 参数或 cwd 到未转义 shell 文本。

`/statusline-configure` 只接受空参数。`help`、`-h`、`--help` 只返回 `Usage: /statusline-configure`；其他参数会被拒绝，均不启动 TUI、不写配置且不调用模型。

每次运行在 Claude 配置目录的 `statusline_runtime/slash_tui/` 下创建一个随机调用目录。Linux/macOS 验证调用目录 `0700`，结果以 `0600` 写出；Windows 不解释伪 POSIX mode。结果读取验证精确父子关系、普通文件、16 KiB 上限，并拒绝路径链中的 symlink、junction 和其他 reparse point。读取后只清理本次调用。tmux/GNOME client 的 stdout/stderr 会被 hook 捕获并限长；Terminal.app 和 Windows 新控制台的 TUI 使用各自的真实终端流。

Claude hook timeout 为 600 秒。桥接 TUI 在 570 秒主动超时且不保存，启动器最长等待 585 秒，为结果校验和 hook 返回预留时间。保存、无变化、取消、信号中断、超时和错误都会在原 Claude 对话区显示一条短结果。tmux 一旦选中，即使 popup 内部失败也不会再启动其他终端。

如果全局 `disableAllHooks` 等设置阻止本地 hook，回退 skill 只会说明 hook 未运行，并提示独立命令或 `/statusline-config`；它同时禁止通过 Bash 和 PowerShell 启动 curses。此时可能仍消耗一个极短模型回合，这是插件侧无法避免的例外。

- [渲染与 Unicode 契约](rendering.zh-CN.md)

## 组件实例与布局

`config/instances.py` 负责实例身份、旧配置映射和纯草稿编辑；`instance_commands.py` 提供确定性 CLI。`rendering/components.py` 统一主／子行的文本和单一 spacer 拟合；观察值在当前帧复用，各副本分别格式化。原生纯编辑位于 `lib/editor/instances.ts`，协议由 Python 生成。详见[组件组合](../COMPOSITION.zh-CN.md)与[共享契约](contracts.zh-CN.md)。

</details>

## 公开包交付

见 [TS-06](typescript-migration/ts-06/README.zh-CN.md)、[安装指南](../USER_GUIDE.zh-CN.md#安装与接入)与[发布流程](../RELEASING.zh-CN.md)。工程候选与公开包身份保持区分。

[M4–M7 实现与交付](m4-m7-delivery.zh-CN.md)。
