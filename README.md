# Claude Code Statusline

这是一个面向 Linux 的 Claude Code CLI 状态栏工具。它显示主 Agent 的模型、工作目录、Git、上下文、限额、session token 和端到端 prompt 用时，并通过 Claude Code 官方 `subagentStatusLine` 为每个普通子 Agent 显示独立状态、模型/effort、上下文占比、用时和任务。显示项、顺序和样式可以通过独立交互式 TUI、`/statusline-config`、实验性的 `/statusline-configure` 启动器或本地 CLI 配置。

运行时只使用 Python 标准库；Git 段需要系统中的 `git`。状态栏在本地执行，不会自行发起网络请求。

完整的命令、显示项、配置选项和排障说明见 [README_DETAILED.md](README_DETAILED.md)。

## 本地构建与安装

```bash
cd /home/fbincon/coding/claude-code-statusline
uv build
pipx install dist/claude_code_statusline-0.6.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

安装器会合并而不是覆盖 `settings.json`，并在每次实际修改前把原配置备份到：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/backups/statusline/
```

`install` 还会在用户配置目录中安装 personal skill `/statusline-config`。Claude Code 2.1.258 及以上版本使用 `UserPromptExpansion` 本地 hook 处理带参数的快捷命令；旧版仍可使用相同 skill，但命令会经过一个 Claude 回合。

Claude Code 升级或降级跨过 2.1.258 时，重新运行一次 `claude-statusline install`，让安装器增加或移除本地 fast hook。

Claude Code 2.1.205 及以上版本会默认安装 `subagentStatusLine` 以及 `SubagentStart`、`SubagentStop` hooks。2.1.205–2.1.213 的 payload 没有 effort 时会自然省略；2.1.214+ 显示完整模型/effort。版本过旧或无法检测时，主状态栏仍正常安装，子 Agent 设置和 hooks 会安全暂挂；升级后重跑 `install` 即恢复。

如果已有不属于本工具的主 statusline、`subagentStatusLine` 或同名 skill，安装器会在备份和写入前拒绝整次安装。确认需要全部接管时才使用：

```bash
claude-statusline install --force
```

若要保留第三方 `subagentStatusLine`，先执行 `claude-statusline config set subagent-statusline off`，再运行 `install`。

可以先预览是否会改变配置：

```bash
claude-statusline install --dry-run
```

实验性 `/statusline-configure` 首次安装默认关闭。显式启用或永久关闭：

```bash
claude-statusline install --experimental-slash-tui
claude-statusline install --no-experimental-slash-tui
```

启用偏好保存在 `~/.claude/claude-statusline-features.json` 并在卸载/重装间保留。显式启用要求 Claude Code 2.1.258+；已启用后降级时，普通 `install` 会保留偏好、移除活动入口并将其暂挂，升级后再运行 `install` 即恢复。

## 命令

```text
claude-statusline render
claude-statusline render-subagents
claude-statusline hook
claude-statusline slash-hook
claude-statusline configure [--config-dir PATH]
claude-statusline config [--config-dir PATH] show [--json]
claude-statusline config [--config-dir PATH] list-items [--json]
claude-statusline config [--config-dir PATH] set-items [ITEM...]
claude-statusline config [--config-dir PATH] enable ITEM...
claude-statusline config [--config-dir PATH] disable ITEM...
claude-statusline config [--config-dir PATH] order [ITEM...]
claude-statusline config [--config-dir PATH] subagents list-items [--json]
claude-statusline config [--config-dir PATH] subagents set-items [ITEM...]
claude-statusline config [--config-dir PATH] subagents enable ITEM...
claude-statusline config [--config-dir PATH] subagents disable ITEM...
claude-statusline config [--config-dir PATH] subagents order [ITEM...]
claude-statusline config [--config-dir PATH] set OPTION VALUE
claude-statusline config [--config-dir PATH] apply ...
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force]
  [--experimental-slash-tui | --no-experimental-slash-tui]
  [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

`render`、`render-subagents`、`hook` 和 `slash-hook` 由 Claude Code 调用，通常无需手工运行。`install` 默认配置一秒主栏刷新和主生命周期 hooks：`SessionStart`、`UserPromptSubmit`、`Stop`、`StopFailure`、`SessionEnd`；支持版本还安装 `SubagentStart` 和 `SubagentStop`。

## 独立交互式配置

安装完成后，在真实终端中运行：

```bash
claude-statusline configure
```

全屏英文界面包含 Main、Subagents 和 Settings 三个页签。Main 与 Subagents 分别维护启用项、搜索、滚动和排序；Settings 可编辑颜色、palette、目录与分隔符样式、范围标签、自定义子 Agent 行、padding、刷新间隔和 Claude Code 内建 Vim 指示器。Tab/Shift+Tab 循环切换，Enter 通过一次 `config apply` 原子保存全部草稿，Esc 无写入退出。

底部的 `Preview (sample data)` 会随每次按键更新。它只使用固定样例，不读取、缓存或写入当前 Claude 会话、Git、transcript 或计时状态。该命令仅支持 Linux，要求 stdin 和 stdout 都是 TTY、终端至少为 `64x18`，并要求本工具已经接管 `statusLine`；窗口过小时会等待调整尺寸，不会立即退出。

自定义配置目录的参数直接跟在命令后：

```bash
claude-statusline configure --config-dir /path/to/claude-config
```

如果编辑期间配置被另一个进程修改，保存会在创建备份或写文件前拒绝并提示重新打开编辑器。

## 实验性 slash TUI 启动器

启用后，在 Claude Code 中输入：

```text
/statusline-configure
```

hook 会优先在当前 tmux 客户端打开 `90% × 90%` popup；不在可访问的 tmux pane 中时，若存在图形会话与 `gnome-terminal`，就在最近的 GNOME Terminal 窗口打开活动新标签页。两者都不可用时，命令会被本地阻断，不调用模型，并提示使用 `claude-statusline configure` 或 `/statusline-config`。本版本不支持其他终端启动器。

这是 launcher，不是 Claude Code 原生 TUI 扩展，也没有通过 `/dev/tty` 绕过官方 hook 隔离。两条路径都运行同一个 `claude-statusline configure`。Claude hook 最长 600 秒，TUI 在 570 秒先行超时，launcher 在 585 秒结束等待；保存、无变化、取消、中断、超时和错误都回传到原 Claude 对话。`/statusline-configure` 只接受空参数，帮助参数只显示用法。

若 `disableAllHooks` 阻止 hook，fallback skill 不会用 Bash 启动 curses，只会提示独立命令或 `/statusline-config`；这个例外可能消耗一个极短模型回合。GNOME 路径始终是新标签页，只有 tmux popup 接近同 pane 弹窗。

## 在 Claude Code 中配置

输入不带参数的命令，Claude 会显示分组的多选问答向导：

```text
/statusline-config
```

带参数的命令适合快速、确定性地修改或检查配置：

```text
/statusline-config show
/statusline-config list-items
/statusline-config set-items model-with-effort current-dir git context-remaining
/statusline-config enable prompt-timer
/statusline-config enable version session cost prompt-cache
/statusline-config disable tokens
/statusline-config order current-dir git model-with-effort context-remaining prompt-timer
/statusline-config subagents list-items
/statusline-config subagents set-items status name model-with-effort context-used elapsed task
/statusline-config subagents enable tokens
/statusline-config subagents order status name elapsed model-with-effort tokens task
/statusline-config set colors off
/statusline-config set palette ansi
/statusline-config set directory-style home
/statusline-config set separator-style compact
/statusline-config set padding 2
/statusline-config set refresh-interval event
/statusline-config set hide-vim-mode-indicator on
/statusline-config set subagent-statusline off
/statusline-config set scope-labels always
/statusline-config reset
```

配置作用于该用户的所有 Claude Code 项目。不要使用 Claude Code 内建的 `/statusline` 重建脚本；该命令可能替换本工具的 `statusLine.command`。

## 配置文件和显示项

显示配置保存在：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/claude-statusline.json
```

未创建该文件时，输出与 0.1.0 相同。可排序的显示项为：

- `model-with-effort`
- `current-dir`
- `git`
- `context-remaining`
- `context-window-size`
- `five-hour-limit`
- `weekly-limit`
- `spend-limit`
- `tokens`，继续整体显示 `hit · miss · out`
- `prompt-timer`

以下条目来自 Claude Code 2.1.258 及以上版本的公开 statusline payload，**默认不显示**，用 `/statusline-config enable` 开启：

- `version`：Claude Code 版本，如 `v2.1.258`
- `session`：会话名称（`/rename` 设置后），否则显示会话 ID 前 8 位，如 `Session explain prompt-cache`
- `cost`：会话金额、API 时长与增删行数，如 `Total $0.12 · 12m 30s · +156/-23`（第三方 API 下金额为估算值）
- `prompt-cache`：缓存命中率与写入 token，如 `cache 91% · 352K w`（首次 API 响应后才有数据）
- `fast-mode`：fast mode 开启时显示 `fast`
- `agent`：`--agent` 会话的 agent 名称
- `vim-mode`：vim mode 开启时的当前模式，如 `vim NORMAL`
- `thinking`：扩展思考启用时显示 `thinking`
- `pr`：当前分支的 open PR/MR，如 `PR #1234 · approved`（GitLab 显示 `MR !1234`）
- `worktree`：`--worktree` 会话的 worktree 名称
- `repo`：origin remote 的仓库，如 `Repo owner/name`

`set-items` 不带条目时会隐藏全部状态行内容。`order` 必须恰好列出当前启用的所有条目一次。

子 Agent 行的条目目录是 `status`、`name`、`model-with-effort`、`context-used`、`elapsed`、`task`、`tokens` 和 `current-dir`；前六项默认开启。`subagents set-items` 传空列表会按照 Claude 的 NDJSON 协议为每个有效任务返回空 `content`，从而隐藏所有自定义行。

三类信息的口径不同：全局底栏属于主 Agent，`tokens` 仍是主 Agent 与可发现子 Agent 的 session 累计，官方子 Agent 行只使用各自 `tasks[].tokenCount`。默认 `scope-labels=when-subagents` 会在当前 prompt 曾经启动过子 Agent 时给主栏前置固定的 `Main/Session`；也可设为 `off` 或 `always`。Claude Code 没有提供当前焦点 Agent 标识，因此进入子 Agent transcript 后，最底部全局栏仍明确表示主/session 范围，不会声称跟随焦点。

`prompt-timer` 从原始用户提交开始持续到主 Agent 最终 `Stop`。主 Agent 等待子 Agent 时显示 `⏳ N agents`，最后一个 Agent 结束后显示 `⏳ main wrap-up`；若最终主 `Stop` 缺失，它不会根据超时猜测完成。后台 shell、server、monitor 和 workflow 不会阻止计时结束。

其他设置：

- `colors`: `on` 或 `off`
- `palette`: `default` 或使用终端调色板的 `ansi`
- `directory-style`: `full`、`home`、`project-relative` 或 `basename`
- `separator-style`: `classic` 或 `compact`
- `scope-labels`: `off`、`when-subagents` 或 `always`
- `subagent-statusline`: `on` 或 `off`
- `padding`: 0 到 32
- `refresh-interval`: `event` 或 1 到 3600 秒
- `hide-vim-mode-indicator`: `on` 或 `off`

`padding`、刷新间隔和 Vim 指示器属于 Claude Code 原生 `statusLine` 设置；其余选项保存在本工具自己的严格 schema v2 JSON 配置中。schema v1 可只读迁移，render、doctor 和 install 不会重写；第一次真实配置保存会在同一事务中备份原字节并写出 canonical v2。关闭定时刷新后，`prompt-timer` 只会在其他状态事件触发时更新。

## 升级

构建新版本 wheel 后，让 pipx 替换现有环境，再重复执行安装命令。该命令是幂等的，不会产生重复 hooks：

```bash
pipx install --force dist/claude_code_statusline-0.6.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

显示配置、token、Git 缓存和逐轮计时状态保留在 Claude 配置目录中，不随 pipx 环境更新而删除。

降级到 0.5.0 时，旧程序不能编辑 schema v2，会回退到默认显示；若需要继续用旧版编辑自定义配置，请恢复升级前备份的 schema v1 文件。

## 卸载

先只移除本工具写入 Claude Code 的配置，再删除 pipx 包：

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

卸载器只删除本工具拥有的 `statusLine`、`subagentStatusLine`、hooks、`/statusline-config`、`/statusline-configure` skill 及所有权标记；第三方子 Agent 行会保留，也不删除显示配置、运行状态或实验启用偏好。使用 `install --no-experimental-slash-tui` 可永久关闭该偏好。

## 回滚

安装、卸载和配置更新产生的备份位于 `~/.claude/backups/statusline/cli-*`。一个备份目录可能同时包含 `settings.json`、显示配置和 skill 的修改前内容。需要回滚时，退出 Claude Code 会话，把对应文件恢复到元数据记录的位置。

## 自定义配置目录

工具遵循 Claude Code 的 `CLAUDE_CONFIG_DIR`。也继续支持原实现的：

- `CLAUDE_STATUSLINE_RUNTIME_DIR`
- `CLAUDE_STATUSLINE_SESSIONS_DIR`

## 开发与测试

```bash
PYTHONPATH=src PYTHONDONTWRITEBYTECODE=1 \
  python3 -m unittest discover -s tests -v
```

项目要求 Python 3.10 或更高版本，目前只支持 Linux。
