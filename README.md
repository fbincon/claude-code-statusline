# Claude Code Statusline

面向 Linux、WSL 和 Windows 的 Claude Code 状态栏。它为主会话显示模型、目录、Git、上下文、限额、token 和逐轮用时，也通过 Claude Code 的 `subagentStatusLine` 为子 Agent 显示独立状态、模型/effort、上下文、用时与任务。

显示项、顺序和样式可以通过全屏 TUI、`/statusline-config`、实验性的 `/statusline-configure`，或完整的 `config` CLI 修改。显示配置 schema v2、feature schema v1、token/cache 和生命周期状态格式与 0.x 保持兼容。

## 支持范围

- Linux 原生与 WSL，Python 3.10+。
- Windows 10/11 原生，CPython 3.10–3.14，x86 与 x64。
- Claude Code 2.1.205+ 才启用 `subagentStatusLine`；2.1.258+ 才启用本地 slash fast hook。旧版本保持原有降级语义。
- Windows 会通过条件依赖自动安装 [`windows-curses>=2.4.2`](https://pypi.org/project/windows-curses/)。
- macOS 明确不支持。Windows ARM64 原生 Python 暂不承诺；ARM 设备请使用 x64 Python 仿真。

## 构建与安装

### Linux / WSL（Bash）

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
pipx install dist/claude_code_statusline-1.0.0-py3-none-any.whl
pipx ensurepath
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

### Windows（PowerShell）

```powershell
py -3.10 -m venv .venv-build
.\.venv-build\Scripts\Activate.ps1
python -m pip install --upgrade build
python -m build
pipx install .\dist\claude_code_statusline-1.0.0-py3-none-any.whl
pipx ensurepath
claude-statusline.exe install --dry-run
claude-statusline.exe install
claude-statusline.exe doctor
```

重新打开 shell 后再执行安装命令，确保 pipx 的 Scripts/bin 目录已经在 `PATH` 中。Windows 安装器要求能够从 `PATH` 解析到 `claude-statusline.exe`，因为写入 Claude settings 的命令是可由 Git Bash 与 PowerShell 共同执行的裸命令：

```text
claude-statusline.exe render
claude-statusline.exe render-subagents
claude-statusline.exe hook
claude-statusline.exe slash-hook
```

Linux 继续写入带 POSIX 引号的绝对可执行文件路径；已有 Linux 安装重新执行 `install` 时不会改变该命令格式。

安装器只合并本工具拥有的设置。遇到第三方 `statusLine`、`subagentStatusLine` 或同名 skill 时会在写入前拒绝；只有确认要接管时才使用 `--force`。每次真实变更都会先备份到：

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

## 配置

独立 TUI 使用当前终端，不创建新窗口：

```bash
claude-statusline configure
```

```powershell
claude-statusline.exe configure
```

Linux 与 Windows 共用 Main、Subagents、Settings 三页界面、sample preview 和同一原子保存事务。最低尺寸为 `64x18`；Esc 不写入，Enter 一次保存，Ctrl+C 中断且不写入。

常用 CLI：

```text
claude-statusline config show [--json]
claude-statusline config list-items [--json]
claude-statusline config set-items [ITEM...]
claude-statusline config enable ITEM...
claude-statusline config disable ITEM...
claude-statusline config order [ITEM...]
claude-statusline config subagents list-items|set-items|enable|disable|order ...
claude-statusline config set OPTION VALUE
claude-statusline config apply ...
claude-statusline config reset
```

Windows 可把上面的命令名替换为 `claude-statusline.exe`。Claude Code 内也可以使用 `/statusline-config`；Windows skill 只预授权 `Bash(claude-statusline.exe config *)` 和 `PowerShell(claude-statusline.exe config *)`，Linux skill 继续只允许安装时的 Bash 绝对路径。

显示配置位于 `<CLAUDE_CONFIG_DIR>/claude-statusline.json`，仍使用严格 schema v2；未创建时保留原有十项默认输出。feature 偏好位于 `claude-statusline-features.json`，仍使用 schema v1。不会执行数据迁移。

## 实验性的 `/statusline-configure`

首次安装默认关闭：

```bash
claude-statusline install --experimental-slash-tui
claude-statusline install --no-experimental-slash-tui
```

```powershell
claude-statusline.exe install --experimental-slash-tui
claude-statusline.exe install --no-experimental-slash-tui
```

启用后：

- Linux 优先打开当前 tmux 的 `90% × 90%` popup，否则使用 GNOME Terminal 新标签页。
- Windows 使用 [`CREATE_NEW_CONSOLE`](https://learn.microsoft.com/en-us/windows/console/creation-of-a-console) 启动当前虚拟环境的 `python -m claude_statusline configure`。系统默认终端负责承载窗口；若 Windows Terminal 是默认终端，它会自然接管。
- TUI deadline 为 570 秒，launcher 最长等待 585 秒，Claude hook timeout 为 600 秒。
- 保存、无变化、取消、中断、超时、关窗和异常退出都通过私有 schema v1 结果桥返回原对话。

fallback skill 同时禁止 Bash 与 PowerShell，防止 fast hook 失效时模型自行启动 curses。该功能不是 Claude Code 原生 TUI 扩展。

## Windows 执行与安全模型

Claude Code 在 Windows 上优先通过 Git Bash 执行 statusline 命令，缺少 Git Bash 时使用 PowerShell；因此安装器不把带反斜杠的绝对路径写入 `command`。参见 [Claude Code Statusline 文档](https://code.claude.com/docs/en/statusline)。

配置、token cache、Git cache 和 turn ledger 使用同目录临时文件、文件 `fsync` 与原子替换。Windows 对短暂 sharing violation/access denied 做有上限的重试，并使用 `msvcrt` 固定字节锁避免并发丢失更新。Linux 继续使用 `fcntl.flock`、`0600/0700` 和父目录 `fsync`。

Windows 的 NTFS `st_mode` 不是可靠的 POSIX 权限信息，`doctor` 会报告 mode 检查不适用；文件安全依赖用户 Claude 配置目录继承的 Windows ACL。slash TUI 结果桥仍会拒绝 symlink、junction、其他 reparse point、越界路径、非普通文件和超过 16 KiB 的结果。

## 升级

### Linux / WSL

```bash
pipx install --force dist/claude_code_statusline-1.0.0-py3-none-any.whl
claude-statusline install
claude-statusline doctor
```

### Windows

```powershell
pipx install --force .\dist\claude_code_statusline-1.0.0-py3-none-any.whl
claude-statusline.exe install
claude-statusline.exe doctor
```

`install` 幂等，不会重复 hooks。显示偏好、feature 偏好、token、Git cache 与计时状态都位于 Claude 配置目录，不会随 pipx 环境替换而删除。

## 自定义配置目录与环境变量

Linux / WSL：

```bash
export CLAUDE_CONFIG_DIR=/path/to/claude-config
export CLAUDE_STATUSLINE_RUNTIME_DIR=/path/to/runtime
claude-statusline install
```

Windows PowerShell：

```powershell
$env:CLAUDE_CONFIG_DIR = 'C:\Path With Spaces\Claude 配置'
$env:CLAUDE_STATUSLINE_RUNTIME_DIR = 'C:\Path With Spaces\Statusline Runtime'
claude-statusline.exe install
```

`CLAUDE_STATUSLINE_SESSIONS_DIR` 可以覆盖 Claude session registry 的读取目录。高频 renderer/hook 对损坏或暂时不可用的输入静默容错；`install`、`doctor`、`configure` 和 `config` 返回明确错误。

## 卸载

Linux / WSL：

```bash
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

Windows：

```powershell
claude-statusline.exe uninstall --dry-run
claude-statusline.exe uninstall
pipx uninstall claude-code-statusline
```

卸载器只删除本工具拥有的主/子栏、hooks、skills 和 owner marker；显示配置、状态缓存、生命周期 ledger、备份与实验偏好保留。

## 开发与测试

Linux / WSL：

```bash
python -m pip install -e .
python -m unittest discover -s tests -v
ruff check --select F,E9 src tests
python -m build
```

Windows PowerShell：

```powershell
python -m pip install -e .
python -m unittest discover -s tests -v
ruff check --select F,E9 src tests
python -m build
```

GitHub Actions 覆盖 `ubuntu-latest` 与 `windows-latest`、Python 3.10 与 3.14，并另行检查 sdist/wheel 内容、Windows PowerShell/Git Bash smoke 和 Linux installer/render smoke。

自动测试与本地 smoke 必须使用临时 `CLAUDE_CONFIG_DIR`，不接触真实 `~/.claude`。真实多 Agent 视觉验收会产生模型费用，因此不会自动执行。详细命令、配置字段、诊断与故障排查见 [README_DETAILED.md](README_DETAILED.md)。
