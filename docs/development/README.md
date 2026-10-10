# Development guide

**English** | [简体中文](README.zh-CN.md)

Start here to set up a development environment, run checks and build the package. User-facing workflows are in the [user guide](../USER_GUIDE.md); public commands are in the [CLI reference](../reference/cli.md).

## Technical documentation

- [Architecture](architecture.md) and [shared contracts](contracts.md).
- [Translation contribution guide](i18n.md).
- [Testing and acceptance](testing.md).
- [Native editor integration](native.md).
- [Task timing](timer.md) and [live metrics](live.md).
- [Release process](../RELEASING.md).


## Contents

- [Development and testing](#development-and-testing)
- [Internal commands](#internal-commands)
- [Implementation notes](#implementation-notes)

<a id="appendix-development-and-testing"></a>
<a id="附录开发与测试"></a>

## Development and testing

<a id="准备开发环境"></a>

### Prepare a development environment

Clone the repository and enter the project root (Bash / PowerShell):

```text
git clone https://github.com/fbincon/claude-code-statusline.git
cd claude-code-statusline
```

For an existing checkout, enter its root directly. The development environment is independent of the user's pipx installation.

Linux / WSL / macOS:

```bash
python3 -m venv .venv-dev
source .venv-dev/bin/activate
python -m pip install -e . ruff build twine 'readme-renderer[md]'
```

Windows PowerShell, using an installed supported Python (3.10 here):

```powershell
py -3.10 -m venv .venv-dev
.\.venv-dev\Scripts\python.exe -m pip install -e . ruff build twine 'readme-renderer[md]'
```

<a id="运行检查"></a>

### Run checks

On Linux / WSL / macOS, run in the activated development environment:

```bash
python -m unittest discover -s tests -t . -v
python -m ruff check --select F,E9 src tests tools
python tools/generate_i18n.py --check
python tools/check_docs.py
git diff --check
python -m build
```

On Windows PowerShell, call the virtual-environment interpreter directly without an activation script:

```powershell
.\.venv-dev\Scripts\python.exe -m unittest discover -s tests -t . -v
.\.venv-dev\Scripts\python.exe -m ruff check --select F,E9 src tests tools
.\.venv-dev\Scripts\python.exe tools/check_docs.py
git diff --check
.\.venv-dev\Scripts\python.exe -m build
```

GitHub Actions runs on push and pull requests across `ubuntu-latest`, `windows-latest`, `macos-15-intel`, `macos-15`, `macos-26-intel`, and `macos-26`, covering Python 3.10/3.14 with explicit native architectures; ARM64 Python 3.10 is pinned to 3.10.11. Windows checks `windows-curses` and runs PowerShell/Git Bash smoke tests. Linux/macOS prepare tmux and run PTY/popup integration plus installed-package CLI smoke tests. macOS also runs native PTY lifecycle tests for the Terminal helper; desktop Terminal.app smoke is explicit and default tests do not open desktop windows. The build job checks versions, conditional dependencies, platform/Terminal modules, skills, and all platform screenshots. Refer to [Actions for the relevant commit](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml) for results.

<a id="从源码构建与安装"></a>

### Build and install from source

Run in the project root; an independent build environment is sufficient when only building packages.

Linux / WSL / macOS:

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
pipx install dist/fbincon_claude_code_statusline-1.10.0-py3-none-any.whl
pipx ensurepath
```

Windows PowerShell:

```powershell
py -3.10 -m venv .venv-build
.\.venv-build\Scripts\python.exe -m pip install --upgrade build
.\.venv-build\Scripts\python.exe -m build
pipx install .\dist\fbincon_claude_code_statusline-1.10.0-py3-none-any.whl
pipx ensurepath
```

These filenames correspond to stable v1.10.0; use the actual generated filenames for other versions. Replace existing packages using the [upgrade steps](../USER_GUIDE.md#upgrading). After `pipx ensurepath`, reopen the terminal and complete [Claude Code integration](../USER_GUIDE.md#integrate-with-claude-code).

In an activated build environment, inspect the wheel with `python -m zipfile -l dist/fbincon_claude_code_statusline-1.10.0-py3-none-any.whl`; on Windows, use `.\.venv-build\Scripts\python.exe`. Confirm `_platform.py`, `macos_terminal.py`, `resources/statusline-config/SKILL.md`, and `resources/statusline-configure/SKILL.md`. The source distribution should also contain this guide, the release guide, and `images/` screenshots. See the [release guide](../RELEASING.md) for the complete process.

<a id="隔离测试与人工验收"></a>

### Isolated testing and manual acceptance

On macOS, explicitly run the Terminal.app smoke test in a Python virtual environment with the current wheel installed:

```bash
.venv-wheel-check/bin/python tools/macos_terminal_smoke.py
```

This opens Terminal.app and uses temporary configuration with shortened deadlines in the production TUI to check terminal behavior, result bridging, and cleanup, without calling the Claude API.

Automated acceptance should run install dry-run, install, doctor, idempotent reinstall, conflict rollback, and uninstall against temporary `CLAUDE_CONFIG_DIR`, never real configuration. After code and installation transactions pass, the user decides whether to install the wheel into real configuration.

Real multi-agent visual checks incur model costs and are not started automatically. User-assisted final acceptance should verify: owned default `subagentStatusLine` and two unique hooks; correct main line without subagents; correct rows for two concurrent agents with distinct model/effort; timer progression through agent count and `main wrap-up`; a main Stop candidate followed by confirmed completion freezing total duration; global `Main/Session` scope when viewing a subagent transcript; final `doctor`; and `uninstall --dry-run` matching only owned configuration.

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
'{"model":{"id":"test-model"},"effort":{"level":"high"},"workspace":{"current_dir":"C:\\demo"}}' | claude-statusline.exe render
```

These examples read `claude-statusline.json` from the current configuration directory, so output depends on enabled items. Automated checks should point `CLAUDE_CONFIG_DIR` to a temporary directory.

### `render-subagents`

Read official Claude Code `subagentStatusLine` JSON from stdin and render each valid task as one `{"id":"...","content":"..."}` NDJSON line. Invalid top-level JSON, `tasks`, or individual fields degrade silently with exit code 0. Stdout contains only protocol results; the renderer does not scan transcripts, Git, the network, or runtime state.

Linux / WSL / macOS:

```bash
printf '%s\n' '{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' \
  | claude-statusline render-subagents
```

Windows PowerShell:

```powershell
'{"columns":80,"tasks":[{"id":"demo","name":"Explore","type":"local_agent","status":"running","startTime":1788400000000,"model":"claude-sonnet-5","tokenCount":84000,"contextWindowSize":200000}]}' | claude-statusline.exe render-subagents
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

<a id="平台执行与文件安全"></a>

### Platform execution and file safety

On Linux/macOS, the installer writes absolute executable paths with POSIX quoting into Claude Code settings. Windows writes command names executable through both Git Bash and PowerShell, requiring `claude-statusline.exe` on `PATH`:

```text
claude-statusline.exe render
claude-statusline.exe render-subagents
claude-statusline.exe hook
claude-statusline.exe slash-hook
```

The Windows skill uses `claude-statusline.exe config ...`, preauthorizing only `Bash(claude-statusline.exe config *)` and `PowerShell(claude-statusline.exe config *)`. Linux/macOS authorize only Bash commands for the installed absolute path. Claude Code prefers Git Bash for Windows status-line commands and falls back to PowerShell, so all four internal commands use bare `.exe` names rather than backslash-containing absolute paths that Git Bash would interpret as escapes. See [Claude Code's Windows status-line conventions](https://code.claude.com/docs/en/statusline).

NTFS `st_mode` on Windows is not reliable POSIX permission information; `doctor` reports mode checks as inapplicable. File safety relies on inherited Windows ACLs in the user's Claude configuration directory. Result bridging still rejects symlinks, junctions, other reparse points, paths outside the expected directory, nonregular files, and results above 16 KiB.

<a id="配置写入与并发"></a>

### Configuration writes and concurrency

Configuration, token caches, Git caches, and per-turn state use same-directory temporary files, file `fsync`, and atomic replacement. Linux/macOS apply `0600/0700`, sync parent directories, and use `fcntl.flock`. Windows uses inherited user ACLs and `msvcrt` fixed-byte locks, with bounded retries for transient sharing violations/access denied. Concurrent configuration commands share one cross-platform lock to avoid lost updates.

If macOS parent-directory sync returns `EINVAL` or `ENOTSUP/EOPNOTSUPP`, file `fsync` and atomic replacement remain, and `doctor`/CI report degradation. Other I/O or permission errors propagate. No additional `F_FULLFSYNC` is used.

macOS session process identity uses `/bin/ps -o lstart= -p PID` with `LC_ALL=C` and `TZ=UTC`, preserving internal spaces. Matching sessions are filtered before process queries; a 1-second timeout or query failure makes the registry record untrusted. Timing uses integer conversion of LibSystem `mach_continuous_time()` and `mach_timebase_info()`, plus `kern.bootsessionuuid` for cross-process reboot detection. If any interface is unavailable, the whole group falls back to wall-clock time.

Global Enter calls the existing atomic configuration transaction once. No changes means no backup; changes use one backup, two-file writes, and rollback on failure. The TUI records a semantic baseline at startup and checks display, host, and installation ownership within the same installation lock before saving. External changes during editing are rejected before backup or writing. Unrelated `settings.json` changes do not conflict and are preserved by merging into the latest file under the lock.

<a id="实验启动器与结果回传"></a>

<a id="experimental-launchers-and-result-bridging"></a>

### External launchers and result bridging

The external `/statusline-configure` is a terminal launcher and does not bypass hook terminal isolation. Claude Code 2.1.259 command hooks run in a new session without a controlling terminal: hooks and children cannot open `/dev/tty`, and `terminalSequence` cannot draw curses. The slash command therefore serves only as a local launcher for existing `claude-statusline configure` in another supported terminal. It reuses the existing state machine, sample preview, concurrency detection, and atomic save.

Linux chooses launchers in this order:

1. If `TMUX` and `TMUX_PANE` shaped as `%<digits>` are valid, `tmux` is executable, and a read-only preflight check resolves the pane in the current server within 2 seconds, open a `90% × 90%` popup titled `Configure Status Line` in the current client. tmux pauses underlying pane updates while the popup exists, and closes it automatically when the child exits.
2. If tmux is unavailable or preflight fails, but `DISPLAY`/`WAYLAND_DISPLAY` and executable `gnome-terminal` are available, open an active tab in the most recently used GNOME Terminal window. GNOME may create a window if none exists. `--wait` waits for the tab's TUI to exit.
3. If neither is available, block slash expansion without calling the model and suggest terminal `claude-statusline configure` or `/statusline-config`.

macOS prefers the same tmux path. Without a valid server/pane or after failed preflight, a read-only `launchctl print gui/<uid>` check with a 2-second limit verifies the local graphical session, alongside system Terminal.app and `open`. SSH does not launch desktop Terminal, and macOS never selects GNOME.

The Terminal path uses `/usr/bin/open -b com.apple.Terminal` to open a private `0700` `.command` file, which starts the current Python and the package's internal helper. Python, CLI, configuration directory, and working directory are absolute; PATH and package search paths are explicit, and all shell values are quoted. `open` returning success means only that the launch request was handled. A 30-second startup handshake verifies editor process identity, then the existing schema v1 result bridge waits for TUI completion. No AppleScript automation permission is required, and Terminal window preferences are not modified.

The editor periodically checks parent-call process identity, request file, and deadline, and rechecks them before saving under the configuration transaction lock. Window closure, interruption, parent-call exit, revocation, or timeout prevents further draft saves. Cleanup verifies PID and start identity and handles only this editor; after reading the result, it removes this call's script, request, handshake, and result files. Terminal's window closure or retention follows user preferences.

Windows does not probe tmux/GNOME. It starts an actual Python child with the current virtual environment's `sys.executable -m claude_statusline configure --config-dir ...` and [`CREATE_NEW_CONSOLE`](https://learn.microsoft.com/en-us/windows/console/creation-of-a-console), without redirecting stdin/stdout/stderr, so curses has a real console. The current system default terminal hosts it; Windows Terminal handles it naturally when set as default. The launcher retains the child handle, so window closure or abnormal exit immediately returns an error, and timeouts terminate and reap the child.

Only tmux popup resembles a popup in the same pane; GNOME uses a new tab. There are no automatic launchers for `x-terminal-emulator`, Konsole, Kitty, WezTerm, or iTerm2; use standalone `configure` there. Hook payload `cwd` is used only when it is an existing absolute directory, otherwise the user's home is used. Command arguments and cwd are never concatenated into unescaped shell text.

`/statusline-configure` accepts no arguments. `help`, `-h`, and `--help` return only `Usage: /statusline-configure`; other arguments are rejected. None of these argument cases starts a TUI, writes configuration, or calls the model.

Each call creates a random directory under `statusline_runtime/slash_tui/` in the Claude configuration directory. Linux/macOS verify directory `0700` and write results with `0600`; Windows does not interpret simulated POSIX mode. Result reads verify exact parent-child paths, regular files, and a 16 KiB limit, rejecting symlinks, junctions, and other reparse points throughout the path chain. Only the current call is cleaned up after reading. Hook-captured tmux/GNOME client stdout/stderr is length-limited; Terminal.app and Windows console TUIs use their own real terminal streams.

Claude's hook timeout is 600 seconds. The bridged TUI times out after 570 seconds without saving; the launcher waits at most 585 seconds, leaving time for validation and hook return. Saving, no changes, cancellation, signal interruption, timeout, and errors produce a short result in the original Claude conversation. Once tmux is chosen, failure inside its popup never starts another terminal.

If global `disableAllHooks` or similar settings prevent the local hook, the fallback skill explains that it did not run and suggests the standalone command or `/statusline-config`. It prohibits launching curses through both Bash and PowerShell. This exception may still use a very short model turn, which the plugin cannot avoid.
