# Claude Code Statusline

这是一个面向 Linux 的 Claude Code CLI 状态栏工具。它显示当前模型和 effort、实时工作目录、Git 分支与变更、上下文余量、Claude 使用限额、会话 token 以及当前 prompt 用时。

运行时只使用 Python 标准库；Git 段需要系统中的 `git`。状态栏在本地执行，不会自行发起网络请求。

## 本地构建与安装

```bash
cd /home/fbincon/coding/claude-code-statusline
uv build
pipx install dist/claude_code_statusline-0.1.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

安装器会合并而不是覆盖 `settings.json`，并在每次实际修改前把原配置备份到：

```text
${CLAUDE_CONFIG_DIR:-~/.claude}/backups/statusline/
```

如果已有不属于本工具的 statusline，安装器会拒绝覆盖。确认需要替换时才使用：

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
claude-statusline install [--dry-run] [--force] [--config-dir PATH]
claude-statusline uninstall [--dry-run] [--config-dir PATH]
claude-statusline doctor [--config-dir PATH]
claude-statusline --version
```

`render` 和 `hook` 由 Claude Code 调用，通常无需手工运行。`install` 配置一秒刷新和以下生命周期 hooks：`SessionStart`、`UserPromptSubmit`、`Stop`、`StopFailure`、`SessionEnd`。

## 升级

构建新版本 wheel 后，让 pipx 替换现有环境，再重复执行安装命令。该命令是幂等的，不会产生重复 hooks：

```bash
pipx install --force dist/claude_code_statusline-0.1.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

token、Git 缓存和逐轮计时状态保留在 Claude 配置目录中，不随 pipx 环境更新而删除。

## 卸载

先只移除本工具写入 Claude Code 的配置，再删除 pipx 包：

```bash
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

卸载器只删除指向 `claude-statusline render` 和 `claude-statusline hook` 的条目，不删除其他 hooks，也不删除运行状态。

## 回滚

安装和卸载产生的配置备份位于 `~/.claude/backups/statusline/cli-*/settings.json.before`。本机首次迁移还会创建独立的 `package-migration-*` 完整备份；需要回滚时，退出 Claude Code 会话，把对应备份中的 `settings.json` 恢复到 Claude 配置目录，并恢复其中的旧脚本。

## 自定义配置目录

工具遵循 Claude Code 的 `CLAUDE_CONFIG_DIR`。也继续支持原实现的：

- `CLAUDE_STATUSLINE_RUNTIME_DIR`
- `CLAUDE_STATUSLINE_SESSIONS_DIR`

## 开发与测试

```bash
PYTHONPATH=src PYTHONDONTWRITEBYTECODE=1 \
  python3 -m unittest discover -s tests -v
```

项目要求 Python 3.10 或更高版本，首版只支持 Linux。
