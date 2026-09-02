# Claude Code Statusline

这是一个面向 Linux 的 Claude Code CLI 状态栏工具。它显示当前模型和 effort、实时工作目录、Git 分支与变更、上下文余量、Claude 使用限额、会话 token 以及当前 prompt 用时。显示项、顺序和样式可以通过 `/statusline-config` 或本地 CLI 配置。

运行时只使用 Python 标准库；Git 段需要系统中的 `git`。状态栏在本地执行，不会自行发起网络请求。

完整的命令、显示项、配置选项和排障说明见 [README_DETAILED.md](README_DETAILED.md)。

## 本地构建与安装

```bash
cd /home/fbincon/coding/claude-code-statusline
uv build
pipx install dist/claude_code_statusline-0.3.1-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

安装器会合并而不是覆盖 `settings.json`，并在每次实际修改前把原配置备份到：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/backups/statusline/
```

`install` 还会在用户配置目录中安装 personal skill `/statusline-config`。Claude Code 2.1.258 及以上版本使用 `UserPromptExpansion` 本地 hook 处理带参数的快捷命令；旧版仍可使用相同 skill，但命令会经过一个 Claude 回合。

Claude Code 升级或降级跨过 2.1.258 时，重新运行一次 `claude-statusline install`，让安装器增加或移除本地 fast hook。

如果已有不属于本工具的 statusline 或同名 skill，安装器会拒绝覆盖。确认需要替换时才使用：

```bash
claude-statusline install --force
```

可以先预览是否会改变配置：

```bash
claude-statusline install --dry-run
```

## 命令

```text
claude-statusline render
claude-statusline hook
claude-statusline slash-hook
claude-statusline config [--config-dir PATH] show [--json]
claude-statusline config [--config-dir PATH] list-items [--json]
claude-statusline config [--config-dir PATH] set-items [ITEM...]
claude-statusline config [--config-dir PATH] enable ITEM...
claude-statusline config [--config-dir PATH] disable ITEM...
claude-statusline config [--config-dir PATH] order [ITEM...]
claude-statusline config [--config-dir PATH] set OPTION VALUE
claude-statusline config [--config-dir PATH] apply ...
claude-statusline config [--config-dir PATH] reset
claude-statusline install [--dry-run] [--force] [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

`render`、`hook` 和 `slash-hook` 由 Claude Code 调用，通常无需手工运行。`install` 默认配置一秒刷新和以下生命周期 hooks：`SessionStart`、`UserPromptSubmit`、`Stop`、`StopFailure`、`SessionEnd`。

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
/statusline-config set colors off
/statusline-config set palette ansi
/statusline-config set directory-style home
/statusline-config set separator-style compact
/statusline-config set padding 2
/statusline-config set refresh-interval event
/statusline-config set hide-vim-mode-indicator on
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
- `session`：会话名称（`/rename` 设置后），否则显示会话 ID 前 8 位，如 `session explain prompt-cache`
- `cost`：会话金额、API 时长与增删行数，如 `$0.12 · 12m 30s · +156/-23`（第三方 API 下金额为估算值）
- `prompt-cache`：缓存命中率与写入 token，如 `cache 91% · 352K w`（首次 API 响应后才有数据）
- `fast-mode`：fast mode 开启时显示 `fast`
- `agent`：`--agent` 会话的 agent 名称
- `vim-mode`：vim mode 开启时的当前模式，如 `vim NORMAL`
- `thinking`：扩展思考启用时显示 `thinking`
- `pr`：当前分支的 open PR/MR，如 `PR #1234 · approved`（GitLab 显示 `MR !1234`）
- `worktree`：`--worktree` 会话的 worktree 名称
- `repo`：origin remote 的仓库，如 `repo owner/name`

`set-items` 不带条目时会隐藏全部状态行内容。`order` 必须恰好列出当前启用的所有条目一次。

其他设置：

- `colors`: `on` 或 `off`
- `palette`: `default` 或使用终端调色板的 `ansi`
- `directory-style`: `full`、`home`、`project-relative` 或 `basename`
- `separator-style`: `classic` 或 `compact`
- `padding`: 0 到 32
- `refresh-interval`: `event` 或 1 到 3600 秒
- `hide-vim-mode-indicator`: `on` 或 `off`

`padding`、刷新间隔和 Vim 指示器属于 Claude Code 原生 `statusLine` 设置；其余选项保存在本工具自己的严格 JSON 配置中。关闭定时刷新后，`prompt-timer` 只会在其他状态事件触发时更新。

## 升级

构建新版本 wheel 后，让 pipx 替换现有环境，再重复执行安装命令。该命令是幂等的，不会产生重复 hooks：

```bash
pipx install --force dist/claude_code_statusline-0.3.1-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

显示配置、token、Git 缓存和逐轮计时状态保留在 Claude 配置目录中，不随 pipx 环境更新而删除。

## 卸载

先只移除本工具写入 Claude Code 的配置，再删除 pipx 包：

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

卸载器只删除本工具拥有的 statusline、hooks、`/statusline-config` skill 及所有权标记，不删除其他 hooks，也不删除显示配置或运行状态。

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