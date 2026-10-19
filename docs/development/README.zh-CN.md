# 开发指南

[English](README.md) | **简体中文**

共享光标编辑、场景化快速配置和只读 `explain` 操作见[配置体验实现与验收](configuration-experience.zh-CN.md)。

成品运行环境支持 Node 22／24，开发和构建仍固定 Node 24.21.0/npm 11.19.0。`npm run build` 后可在受支持 Node 下运行 `npm run test:runtime`，该命令只测试已编译产品，不重新构建。发布还要求八目标 × 四个 Node 案例共 32 项回执，见[运行环境与地区语言后续工作](node-regional-languages.zh-CN.md)。

本页说明开发环境、检查、构建和内部实现。日常使用见[使用指南](../USER_GUIDE.zh-CN.md)，公开命令见[CLI 参考](../reference/cli.zh-CN.md)。

私有 TS-03 workspace 使用固定 Node 24.21.0／npm 11.19.0，在仓库根目录运行 `npm ci --ignore-scripts`、`npm test` 和 `npm run generate:check`。Python 3.14.4 继续作为隔离对照解释器，参见 [TS-03 记录](typescript-migration/ts-03/README.zh-CN.md)。

## 技术文档导航

- [迁移后修复与交付](post-migration-fixes.zh-CN.md)：全部十一项问题、精确用量身份及 v3.1.3 证据。
- [迁移后审查问题与文档更新清单](post-migration-review.zh-CN.md)：四个 session 的六项迁移问题、五项基线问题或共同风险，以及五类文档冲突。
- [外部 TUI 回归修复](external-tui-regressions.zh-CN.md)：v3.1.2 目录说明、文字、导航、颜色和通知修复。

- [外部 TUI 呈现修复](external-tui-parity.zh-CN.md)：v3.1.1 绘制、上下文操作与源码绑定验收。
- [架构](architecture.zh-CN.md)与[共享协议](contracts.zh-CN.md)。
- [TypeScript 重构计划与进度](typescript-migration.zh-CN.md)：当前状态、范围、阶段、决策、验收及会话交接。
- [PERF-01 迁移后性能专项](performance/perf-01.zh-CN.md)：TS-06 后的独立工作、保留的 D06 目标及历史证据；尚未开始。
- [TS-01 固定参考与清单](typescript-migration/ts-01/README.zh-CN.md)：可复现样例、核验工具及验证证据。
- [TS-02 平台探针与决策](typescript-migration/ts-02/README.zh-CN.md)：原生适配、安装实验、性能策略及剩余门槛。
- [TS-03 共享核心与后端](typescript-migration/ts-03/README.zh-CN.md)：workspace、六批实施、兼容差异与验收。
- [TS-04 双编辑器、安装与恢复](typescript-migration/ts-04/README.zh-CN.md)：[安装候选验收](typescript-migration/ts-04/candidate.zh-CN.md)与[显式恢复](typescript-migration/ts-04/recovery.zh-CN.md)。
- [Linux 整合、实体机验收及已批准的发布前补验](typescript-migration/ts-02/LINUX-20261014.zh-CN.md).
- [翻译贡献指南](i18n.zh-CN.md)。
- [测试与验收](testing.zh-CN.md)。
- [v1.13.0 多语言性能](performance-v1.13.0.zh-CN.md)：按需语言加载、预建搜索与 2/5/10 语言资源对照。
- [v1.12.0 性能对照](performance-v1.12.0.zh-CN.md)：默认路径复测、保留的小幅开销与开启外观功能的成本。
- [v1.11.0 性能对照](performance-v1.11.0.zh-CN.md)：完整场景、原始数据来源与补充复查。
- [原生编辑器接入](native.zh-CN.md)。
- [任务计时](timer.zh-CN.md)与[实时指标](live.zh-CN.md)。
- [发布流程](../RELEASING.zh-CN.md)。


## 文档导航

- [开发与测试](#开发与测试)
- [内部命令](#内部命令)
- [实现说明](#实现说明)

<a id="附录开发与测试"></a>

## 开发与测试

### 准备开发环境

安装固定的 Node 24.21.0/npm 11.19.0 后，在仓库根目录运行：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

开发环境独立于已有 pipx 产品。默认流程不需要 Python、pip、Ruff、wheel 或原生编译器。

### 运行检查

`npm run check` 运行真实 Node 并发、故障、终端、冻结案例、生成资源、文档与完整责任台账检查。
六种语言、两个 Mod 和技能模板由 `tools/generation/` 维护，归档 Python 副本不再生成。
八目标安装和十三个固定主机组合都使用同一个通用候选 tgz。2.1.296 的声明缺失单独记录。

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
终端、电源和付费验收均显式调用；普通 CI 不产生付费会话。保留旧 Python 产品及真实配置。

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
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.exe render
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
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.exe render-subagents
```

### `hook`

从 stdin 读取 Claude Code 生命周期事件，静默更新本地 prompt 计时状态。它被设计为即使输入损坏也不阻塞 Claude Code 回合。

### `slash-hook`

从 stdin 读取 `UserPromptExpansion` 事件。它处理名为 `statusline-config` 且带参数的本地快捷命令，也处理已启用的无参数 `statusline-configure` 启动请求。前者无参数时放行给问答 skill；后者一经识别始终输出一个 `decision: "block"` JSON，子进程退出码只转换为结果文本。无关事件和损坏输入会静默放行。

### `ui` / `runtime`

`ui [--config-dir PATH]` 为编辑器后端处理一次内部 JSON 配置请求，`runtime [--config-dir PATH]` 处理一次独立实时观测请求。二者从 stdin 读取、向 stdout 返回协议响应，属于接入接口，不是交互编辑器；使用匹配的软件包与 Mod 资源。详见[共享协议](contracts.zh-CN.md)及[实时协议](live.zh-CN.md)。

<a id="附录实现说明"></a>

## 实现说明

以下为已发布 Python 产品的历史实现说明。当前 TypeScript 的绝对 Node/JS argv、原生锁、恢复与布局见[候选指南](typescript-migration/ts-05/candidate.zh-CN.md)和[TS-04 记录](typescript-migration/ts-04/README.zh-CN.md)。

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

## 公开包交付

见 [TS-06](typescript-migration/ts-06/README.zh-CN.md)、[安装指南](../USER_GUIDE.zh-CN.md#安装与接入)与[发布流程](../RELEASING.zh-CN.md)。工程候选与公开包身份保持区分。
