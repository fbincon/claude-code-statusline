# Claude Code Statusline

[English](README.md) | **简体中文**

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[![Native Mod](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml)
[MIT License](LICENSE)

面向 Linux、WSL、Windows 和 macOS 的 Claude Code 状态栏，集中显示模型与思考强度（effort）、工作目录、Git、上下文、使用限额、token 和任务用时。主状态栏与子 Agent 独立行可通过会话内编辑器、终端交互界面（TUI）、问答向导或 CLI 配置。

[功能概览](#功能概览) · [界面预览](#界面预览) · [快速安装](#快速安装) · [常用配置](#常用配置) · [使用指南](docs/USER_GUIDE.zh-CN.md) · [故障排查](docs/USER_GUIDE.zh-CN.md#故障排查)

<a id="v161外部-tui-栏目层级"></a>
<a id="正式-v150-的-phase-4-功能"></a>
<a id="正式-v160-的-phase-5-功能"></a>

## 功能概览

- **选择显示内容：** 支持 60 个主栏条目和 14 个子 Agent 条目，可启用、隐藏、筛选和排序。
- **区分统计范围：** 提供会话累计 token、各子 Agent 任务行，以及包含子 Agent 工作和主 Agent 收尾的完整任务计时。
- **调整显示样式：** 支持模型与数字格式、标签、内置图标、颜色、目录样式，以及带优先级和宽度限制的自动或显式分行。
- **从预设开始：** minimal、developer、monitoring、multi-agent 四种预设可展开编辑，支持可移植 JSON 导入和导出。
- **选择配置界面：** Main、Subagents、Settings、Layout 四页共享同一配置；Claude 外观及行为偏好使用独立 Apply 操作。
- **按需开启实时指标：** 运行状态、代理数量、工具进度、请求用时和逐任务用量需主动启用；缺失数据和部分观测分别标记。

状态栏渲染读取 Claude Code 输入和本地状态，不自行发起网络请求或使用模型 token。问答向导使用 Claude 模型回合。数据来源与可用条件见[显示项与指标定义](docs/DISPLAY_ITEMS.zh-CN.md)。

## 界面预览

主状态栏使用实际会话数据，配置界面的 Preview 使用固定样例。图片为实际终端示例，沿用原始捕获与来源记录。字体、颜色与显示宽度随终端设置变化。[图片来源与归档索引](docs/images/README.zh-CN.md)。

**Linux 主状态栏**

![Linux Claude Code 主状态栏：模型与 effort、目录、Git、上下文、token 和任务用时](docs/images/statusline/linux.png)

<details>
<summary>会话内配置 TUI：Linux、Windows 与 macOS 的实际终端截图</summary>

在当前 Claude Code 会话内运行 `/statusline-configure-native`，先点击 Client 区域一次，再使用键盘。以下图片均可见 Claude Code 2.1.289。

**Linux**

![Linux Claude Code 会话中的停靠式 Client Main 配置页与主状态栏](docs/images/tui/native/linux/session.png)

**Windows**

![Windows Terminal 中 Claude Code 会话的停靠式 Client Main 配置页与主状态栏](docs/images/tui/native/windows/session.png)

**macOS**

![macOS Terminal.app 中 Claude Code 会话的内嵌 Client Main 配置页与主状态栏](docs/images/tui/native/macos/session.png)

已有 macOS Client 交互限制与检查建议见 [macOS 鼠标报告与 Client 焦点](docs/USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)。

</details>

<details>
<summary>Linux：Main、Subagents、Settings 和 Layout 配置界面</summary>

以下页面由外部 `/statusline-configure` TUI 提供。

**Main：选择主状态栏条目并调整顺序。**

![Linux 外部 TUI Main 页：显示项、说明与样例预览](docs/images/tui/external/linux/main.png)

**Subagents：选择子 Agent 行的条目与顺序。**

![Linux 外部 TUI Subagents 页：运行中与已完成代理的样例预览](docs/images/tui/external/linux/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![Linux 外部 TUI Settings 页：分组设置与样例预览](docs/images/tui/external/linux/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![Linux 外部 TUI Layout 页：模式、行边界与逐项优先级及宽度](docs/images/tui/external/linux/layout.png)

</details>

<details>
<summary>macOS：Terminal.app 中的主状态栏与四页配置界面</summary>

**主状态栏**

![macOS Terminal.app 中的 Claude Code 主状态栏](docs/images/statusline/macos.png)

**Main**

![macOS Terminal.app 外部 TUI Main 配置页](docs/images/tui/external/macos/main.png)

**Subagents**

![macOS Terminal.app 外部 TUI Subagents 配置页](docs/images/tui/external/macos/subagents.png)

**Settings**

![macOS Terminal.app 外部 TUI Settings 配置页](docs/images/tui/external/macos/settings.png)

**Layout**

![macOS Terminal.app 外部 TUI Layout 页：模式、行边界与逐项优先级及宽度](docs/images/tui/external/macos/layout.png)

</details>

<details>
<summary>Windows：Windows Terminal 中的主状态栏与四页配置界面</summary>

**主状态栏**

![Windows Terminal 中的 Claude Code 主状态栏](docs/images/statusline/windows.png)

**Main**

![Windows Terminal 外部 TUI Main 配置页](docs/images/tui/external/windows/main.png)

**Subagents**

![Windows Terminal 外部 TUI Subagents 配置页](docs/images/tui/external/windows/subagents.png)

**Settings**

![Windows Terminal 外部 TUI Settings 配置页](docs/images/tui/external/windows/settings.png)

**Layout**

![Windows Terminal 外部 TUI Layout 页：模式、行边界与逐项优先级及宽度](docs/images/tui/external/windows/layout.png)

</details>

旧截图与终端重建画面见[归档索引](docs/images/archive/README.zh-CN.md)。

## 支持范围

| 平台 | 支持环境 |
| --- | --- |
| Linux / WSL | Python 3.10+ |
| Windows 10/11 | CPython 3.10–3.14，x86/x64；自动安装 `windows-curses>=2.4.2` |
| macOS 14+ | CPython 3.10–3.14，Intel / Apple Silicon |

Windows ARM 设备可使用 x64 Python 仿真；原生 ARM64 Python 暂不在支持范围。Git 信息需要系统中存在 `git`。

Claude Code 功能门槛：子 Agent 行需 2.1.205+，带参数配置的本地执行与外部 TUI 入口需 2.1.258+，会话内 Client 需 2.1.287+，原生计时和高级实时指标采集需 2.1.289+。版本不兼容或无法识别时，对应接入暂挂。详见[运行要求](docs/USER_GUIDE.zh-CN.md#运行要求)。

<a id="从-release-安装推荐"></a>
<a id="从固定标签源码安装"></a>
<a id="从当前源码安装"></a>

## 快速安装

先准备 Python、Claude Code CLI 和 [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html)。支持平台共用同一个 wheel。

### 安装软件包

Bash、Zsh、PowerShell 通用：

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.7.1/claude_code_statusline-1.7.1-py3-none-any.whl"
pipx ensurepath
```

### 接入 Claude Code

重新打开终端，让 PATH 设置生效，再执行：

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows 使用 `claude-statusline.exe`。接入后在受信任终端重启 Claude Code。

两个编辑器在兼容宿主默认启用，保留已保存的关闭偏好；Claude Code 2.1.289+ 默认采集原生计时元数据，高级实时指标仍按需启用。软件包安装与 Claude 接入是两个步骤，`install` 不会打开编辑器。已有冲突资源需按[冲突处理说明](docs/USER_GUIDE.zh-CN.md#处理已有-statusline-或同名-skill)操作。

<details>
<summary>其他安装方式</summary>

从固定发布标签安装源码，需要 Git：

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.7.1"
```

使用 `@main` 跟踪当前开发源码；本地检出可在仓库根目录执行 `pipx install .`。随后运行 `pipx ensurepath`，并完成上面的接入步骤。

下载校验和平台步骤见[安装指南](docs/USER_GUIDE.zh-CN.md#安装与接入)，源码构建见[开发指南](docs/development/README.zh-CN.md#从源码构建与安装)。

</details>

## 常用配置

| 入口 | 用途 |
| --- | --- |
| `/statusline-configure-native` | 当前会话内的 Client TUI，见[原生配置编辑器](docs/USER_GUIDE.zh-CN.md#原生配置编辑器) |
| `/statusline-configure` | 由受支持的外部终端承载 TUI，见[外部入口](docs/USER_GUIDE.zh-CN.md#外部终端入口-statusline-configure) |
| `claude-statusline configure` | 当前独立终端中的完整 TUI |
| `/statusline-config` | Claude 问答向导；支持的带参数命令在兼容宿主本地执行 |
| `claude-statusline config ...` | 检查配置、设置精确顺序或从脚本配置 |

<a id="v130a2外部-tui-与会话内-client"></a>

### 原生配置编辑器

先点击 Client 区域一次，再用 Tab 切页、方向键选择或排序、Space 勾选、`/` 搜索。`s` 保存留页，`f` 保存并退出，`q` 丢弃未保存修改。Ctrl+E 打开逐项格式表单，Ctrl+G 取消输入。Claude 偏好使用独立 Apply 操作。

### 外部与独立终端 TUI

用 Tab 切页、Space 勾选、方向键选择或排序。完成字段输入后用 Ctrl+S 保存；项目页及原有设置行的 Enter 用于保存，高级字段的 Enter 用于编辑或确认输入。Esc 先取消输入，再取消编辑器；Ctrl+C 中断且不保存。最低终端尺寸为 64×18。

外部入口在 Linux 使用 tmux 或 GNOME Terminal，在 macOS 使用 tmux 或 Terminal.app，在 Windows 使用系统新控制台启动器。SSH 或启动器不可用时，在当前终端运行 `claude-statusline configure`。

定义精简主栏：

```text
claude-statusline config set-items model-with-effort current-dir git context-remaining prompt-timer
claude-statusline config set directory-style home
claude-statusline config show
```

配置按用户生效。`set-items` 替换启用集合，`enable`、`disable` 用于增量调整。更多操作见[配置配方](docs/USER_GUIDE.zh-CN.md#常用配置配方)、[格式与布局](docs/USER_GUIDE.zh-CN.md#formatting-layout-presets)和 [CLI 参考](docs/reference/cli.zh-CN.md)。

<a id="升级到-v161"></a>

## 升级与卸载

升级软件包并同步接入，然后重启 Claude Code：

```text
pipx install --force "https://github.com/fbincon/claude-code-statusline/releases/download/v1.7.1/claude_code_statusline-1.7.1-py3-none-any.whl"
claude-statusline install
claude-statusline doctor
```

保留显示配置、运行状态和接入偏好。旧显示 schema 与软件包降级操作见[版本兼容](docs/USER_GUIDE.zh-CN.md#版本兼容)。

先移除 Claude 接入，再卸载软件包：

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall claude-code-statusline
```

显示配置与备份继续保留，详见[卸载](docs/USER_GUIDE.zh-CN.md#卸载)。

## 项目结构

```text
claude-code-statusline/
├── README.md / README.zh-CN.md
├── docs/
│   ├── USER_GUIDE.md / USER_GUIDE.zh-CN.md
│   ├── reference/                  # CLI 与配置参考
│   ├── images/                     # 当前截图与归档
│   ├── development/                # 开发、架构与验证
│   └── releases/                   # 历史发布说明
├── src/claude_statusline/
│   ├── config/
│   ├── integration/
│   ├── platforms/
│   ├── rendering/
│   ├── runtime/
│   └── ui/
├── mods/
│   ├── statusline-native/
│   └── statusline-runtime/
├── tests/
│   ├── config/
│   ├── integration/
│   ├── platforms/
│   ├── rendering/
│   ├── runtime/
│   └── ui/
├── tools/
└── pyproject.toml
```

## 文档与帮助

- [使用指南](docs/USER_GUIDE.zh-CN.md)：安装、编辑器、配方、升级与排障。
- [CLI 参考](docs/reference/cli.zh-CN.md)：命令、选项、字段、文件和退出码。
- [显示项与指标定义](docs/DISPLAY_ITEMS.zh-CN.md)：作用域、数据来源和可用条件。
- [开发指南](docs/development/README.zh-CN.md) · [发布流程](docs/RELEASING.zh-CN.md)。
- [变更记录](CHANGELOG.zh-CN.md) · [Releases](https://github.com/fbincon/claude-code-statusline/releases)。
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues)：附版本、复现步骤与诊断结果，移除私有路径和会话内容。

## 许可证

[MIT License](LICENSE)，Copyright (c) 2026 [fbincon](https://github.com/fbincon)。
