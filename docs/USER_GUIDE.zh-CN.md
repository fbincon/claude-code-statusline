# Claude Code Statusline 使用指南

[English](USER_GUIDE.md) | **简体中文**

本指南说明安装、编辑器操作、常用配置、可选实时指标和恢复流程。完整命令及配置文件说明见 [CLI 参考](reference/cli.zh-CN.md)，开发与构建步骤见[开发指南](development/README.zh-CN.md)。

配置对当前用户的 Claude Code 项目生效。状态栏渲染读取 Claude 输入、本地 Git、transcript 和状态文件，不自行发起网络请求或使用模型 token；问答向导使用模型回合。

通用单行 CLI 示例适用于 Bash、Zsh 和 PowerShell，Windows 使用 `claude-statusline.exe`。`<CLAUDE_CONFIG_DIR>` 表示环境变量 `CLAUDE_CONFIG_DIR` 的值，未设置时为 `~/.claude`；这是路径占位符，不要原样输入。

## 文档导航

- [功能概览](#功能概览)
- [运行要求](#运行要求)
- [安装与接入](#安装与接入)
- [选择配置入口](#选择配置入口)
- [界面语言](#界面语言)
- [原生配置编辑器](#原生配置编辑器)
- [独立交互式 TUI](#独立交互式-tui)
- [外部终端入口 `/statusline-configure`](#外部终端入口-statusline-configure)
- [`/statusline-config` 问答向导](#statusline-config-问答向导)
- [常用配置配方](#常用配置配方)
- [格式、布局与预设](#格式布局与预设)
- [可选实时状态](#可选实时状态)
- [可配置显示项](#可配置显示项)
- [主状态栏显示含义](#主状态栏显示含义)
- [子 Agent 行与三种作用域](#子-agent-行与三种作用域)
- [显示与宿主选项](#显示与宿主选项)
- [配置文件](#配置文件)
- [自定义配置目录与环境变量](#自定义配置目录与环境变量)
- [升级](#升级)
- [卸载](#卸载)
- [备份与回滚](#备份与回滚)
- [`doctor` 诊断](#doctor-诊断)
- [故障排查](#故障排查)
- [退出码](#退出码)
- [当前边界](#当前边界)
- [相关文档](#相关文档)

## 功能概览

主栏支持 60 个条目，子 Agent 行支持 14 个条目，默认分别启用 10 项和 5 项。两种编辑器均提供 Main、Subagents、Settings、Layout 四页、固定样例预览、格式设置、四种可编辑预设及可移植 JSON 文件。

主栏显示主会话数据，各子 Agent 行显示自己的任务数据；任务计时包含子 Agent 工作和主 Agent 收尾。[显示项与指标定义](DISPLAY_ITEMS.zh-CN.md)说明数据来源、作用域、缺失观测和指标边界。

## 运行要求

| 平台 | 环境 |
| --- | --- |
| Linux / WSL | Python 3.10+ |
| Windows 10/11 | CPython 3.10–3.14，x86/x64；条件依赖 `windows-curses>=2.4.2` |
| macOS 14+ | 提供 curses 的 CPython 3.10–3.14，Intel / Apple Silicon |

准备 Claude Code CLI 和 [pipx](https://pipx.pypa.io/latest/how-to/install-pipx.html)。显示 Git 字段或从源码安装时需要 Git。Windows ARM 设备可使用 x64 Python 仿真，原生 ARM64 Python 暂不在支持范围。

| 功能 | Claude Code 版本条件 |
| --- | --- |
| 主栏、CLI、独立 TUI、问答向导 | 旧版或未知版本仍可使用，缺失数据省略 |
| 子 Agent 行及生命周期 hooks | 2.1.205+；逐任务 effort 需 2.1.214+ |
| 带参数 slash 命令的本地执行、外部 TUI 入口 | 2.1.258+ |
| 会话内 Client 编辑器 | 2.1.287+ |
| 原生计时及高级实时指标采集 | 2.1.289+ |

外部启动器在 Linux 使用 tmux 或 GNOME Terminal，在 macOS 使用 tmux 或 Terminal.app，在 Windows 使用系统新控制台。其他终端环境可直接运行独立编辑器。升级或降级跨过功能门槛后，重新运行 `install` 和 `doctor`。

## 安装与接入

### 安装 Python 包

从 [PyPI](https://pypi.org/project/fbincon-claude-code-statusline/) 安装稳定包：

```text
pipx install fbincon-claude-code-statusline
pipx ensurepath
```

分发名为 `fbincon-claude-code-statusline`，命令仍为 `claude-statusline`，Python 导入名仍为 `claude_statusline`。本仓库旧安装按[迁移步骤](#迁移旧分发名称)操作。[v1.7.6 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.7.6) 提供相同的 wheel 与源码包。

也可从该 Release 下载 wheel、源码包和 `SHA256SUMS`，将下载文件的 SHA-256 与对应条目比较：

```bash
# Linux / WSL
sha256sum fbincon_claude_code_statusline-1.7.6-py3-none-any.whl
# macOS
shasum -a 256 fbincon_claude_code_statusline-1.7.6-py3-none-any.whl
```

```powershell
Get-FileHash .\fbincon_claude_code_statusline-1.7.6-py3-none-any.whl -Algorithm SHA256
Get-Content .\SHA256SUMS
```

已下载校验文件列出的全部资产时，Linux/WSL 使用 `sha256sum -c SHA256SUMS`，macOS 使用 `shasum -a 256 -c SHA256SUMS`。安装本地 wheel 使用 `pipx install ./fbincon_claude_code_statusline-1.7.6-py3-none-any.whl`，PowerShell 路径为 `.\fbincon_claude_code_statusline-1.7.6-py3-none-any.whl`。

固定标签源码安装需要 Git：

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.7.6"
pipx ensurepath
```

使用 `@main` 获取开发源码，本地检出可运行 `pipx install .`。自行构建见[开发指南](development/README.zh-CN.md#从源码构建与安装)。

### 接入 Claude Code

运行 `pipx ensurepath` 后重新打开终端，再执行：

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows 使用 `claude-statusline.exe`，并确保该可执行文件位于 PATH。随后在受信任终端重启 Claude Code，加载安装的插件和命令。

### `install` 会做什么

安装器将本工具拥有的状态栏命令、计时及子 Agent hooks、配置 skills 和兼容的编辑器接入合并到用户配置中，保留无关设置与 hooks。实际修改前创建备份，并通过原子写入保存；重复安装是幂等的。

没有保存偏好时，两个编辑器入口默认启用。显式参数优先于已保存偏好，已保存偏好优先于默认值；不兼容的接入暂挂，但保留偏好。原生计时和高级实时采集分别管理偏好；兼容宿主新安装默认开启计时元数据，高级指标默认关闭。现有有效的 padding、刷新间隔和 Vim 指示器选项保留；首次安装默认每秒刷新。

### 安装前预览

`claude-statusline install --dry-run` 只报告是否需要修改，不写入配置、资源或备份。

### 处理已有 statusline 或同名 skill

第三方状态栏设置或同名 skill 冲突会在写入前阻止安装。先检查具体冲突；确实要替换这些资源时才使用 `claude-statusline install --force`。Native 命令及插件身份冲突需要解决归属，不能强制接管。

保留第三方子 Agent renderer 时，先运行 `claude-statusline config set subagent-statusline off`，再运行普通 `install`。安装参数与归属规则见 [CLI 参考](reference/cli.zh-CN.md#安装与诊断)。

### macOS 安装与验证边界

macOS 使用相同 wheel 和安装流程，CPython 需要提供 curses。外部桌面启动器支持 Terminal.app，有可用 tmux 时优先使用 popup。SSH 或无图形桌面的会话使用独立编辑器或 CLI。

当前布局见 [README 图库](../README.zh-CN.md#界面预览)和[图片索引](images/README.zh-CN.md)。已有会话内 Client 输入限制与主栏、外部编辑器分别记录，见[焦点检查](#macos-鼠标报告与-client-焦点)。

## 选择配置入口

| 入口 | 适用场景 |
| --- | --- |
| `/statusline-configure-native` | 在当前 Claude 会话内配置 |
| `/statusline-configure` | 从 Claude 启动受支持的外部终端 |
| `claude-statusline configure` | 直接在当前终端配置，包括 SSH |
| `/statusline-config` | 使用 Claude 模型回合进行问答配置 |
| `claude-statusline config ...` | 精确设置、自动化与脚本 |

各入口共享用户配置。两个编辑器同时打开时分别保留草稿，旧草稿无法覆盖已保存的新 revision。

<a id="native-editor-preview"></a>

<a id="原生编辑器预览"></a>

<a id="v130a2外部-tui-与会话内-client"></a>

## 界面语言

CLI、外部／独立 curses 编辑器和会话内 Client 默认英文。在设置页选择**界面语言（立即保存）** → **English / 简体中文**。两个编辑器与 CLI 共用此偏好，与 Claude 自身的主题和语言设置独立。

```text
claude-statusline config language show [--json]
claude-statusline config language set zh-CN
claude-statusline config language set en
claude-statusline config language reset
claude-statusline --language zh-CN configure
claude-statusline --language en config --help
```

使用 `--json` 时不要输入方括号。`reset` 保存英文。可选的 `--language` 放在子命令前，仅在当前调用中覆盖已保存偏好，不写入文件；使用该参数打开的编辑器仍可在设置页保存新的语言。独立配置目录示例：`claude-statusline config --config-dir /path/to/config language set zh-CN`。

切换立即保存，保留当前页面、选中字段、搜索、输入内容和显示草稿，重新计算终端布局并绘制翻译文字。保存／取消继续只控制显示修改；语言写入失败时保留上一次语言并显示错误。其他窗口在重开或执行现有重新加载操作时读取新偏好。任一语言下均可搜索稳定 ID、中英文名称与说明，以及自定义标签。

偏好文件为 `<CLAUDE_CONFIG_DIR>/statusline-ui.json`，schema v1。缺失或无效偏好回退英文，读取不修复文件。显式 set/reset 会备份并修复损坏文件，但拒绝覆盖未来 schema。重装、升级、普通卸载、显示 reset、预设及可移植导入／导出均保留此独立偏好。

实际状态栏样例／输出、模型名称、路径、分支、命令、ID、配置值和自定义标签保持原值。模型问答向导跟随对话语言；此设置翻译工具自身界面。机器可读目录与现有 JSON 接口保留英文基准元数据及稳定字段。

## 原生配置编辑器

`/statusline-configure-native` 在当前 Claude Code session 内打开 Client TUI，不另开终端。它与外部 `/statusline-configure` 共用配置、目录、catalog、互斥规则和原子保存服务，各自保留草稿。正式版默认启用两者；安装完成后在受信任终端重启 Claude Code。

编辑器跟随 Claude 实际应用的主题，包括浅色／深色、色弱及宿主支持的 auto／自定义主题。在 Settings 将 **Preview background (UI only)** 设为 `light` 或 `dark`，匹配终端背景的深浅；该选择独立于 Claude 主题，立即记住，丢弃配置编辑也会保留。默认沿用原来的深色预览。两种标准底色为 `#ffffff` 与 `#17191e`，编辑器不查询终端背景的精确 RGB。无色文字使用终端默认前景。标题显示所选背景及 Palette 或 Colors: off；颜色难以辨认时，可比较 `default` 与 `ansi`。样例保留生产 RGB 和终端 ANSI 色槽，保存只把显示配置应用到实际状态栏。Claude 主题草稿仍通过独立 Apply 生效。

### 页面层级与分页

主题强调色大标题 **Configure Status Line** 与内容、Preview 标题颜色一致。较大窗口将栏目标题放在框线中，较小窗口使用紧凑标题。活动页签、分组标题和选中字段分别显示；快捷键使用当前主题的主要文字色并保持加粗，作用说明使用小写、主题辅助色和普通字重。按可读性验收，不限定具体颜色。字母快捷键显示大写，非输入编辑状态下大小写均有效。

页面快捷键集中到底部，保存／完成／退出／预览另成一组；各页都以 `Tab page` 开头：

| 页面 | 底部展示顺序 |
| --- | --- |
| Main / Subagents | `Tab page · Space toggle · ↑↓ select · ←→ order · Ctrl+E format · / search` |
| Settings | `Tab page · ↑↓ select · ←→ adjust · Enter edit · H show/hide preferences · A apply separately · R reload` |
| Layout | `Tab page · ↑↓ select · ←→ adjust · Enter edit` |
| 逐项格式 | `Tab page · ↑↓ select · ←→ adjust · Enter edit · Ctrl+G back` |

Settings 非编辑时显示 H，展开 Claude preferences 后才显示 A。`/ search` 保留在 Filter 旁，也在未编辑的条目页底部显示。编辑时改为接受／取消／清空／删除提示；Esc 仍表示宿主焦点操作。忙碌与保存结果不明时只显示对应控制。快捷键按完整的“按键＋说明”换行；32×12 下缩短说明、减少详情行，保留选中项、基本操作和样例预览，必要时省略预览／重载／焦点等次要提示。

Settings、Layout 和逐项格式详情按分组标题与字段实际占用的行数填满后分页。上下键只选择字段；PageUp／PageDown 切换页面并尽量保留页内位置，Home／End 到首尾。缩放后重新计算页面，保留草稿、选中字段和输入缓冲。Layout 按布局模式、行边界、逐项适配连续排列。

### 编辑器安装组合与兼容性

没有已保存偏好时，`claude-statusline install` 默认启用两个入口。要明确选择组合：

| 安装组合 | 命令 |
| --- | --- |
| 两个入口 | `claude-statusline install --native-editor --experimental-slash-tui` |
| 仅会话内 Client | `claude-statusline install --native-editor --no-experimental-slash-tui` |
| 仅外部 TUI | `claude-statusline install --no-native-editor --experimental-slash-tui` |
| 基础接入，不安装两个 TUI 入口 | `claude-statusline install --no-native-editor --no-experimental-slash-tui` |

Windows 使用 `claude-statusline.exe`。两组参数相互独立，`--experimental-slash-tui` 的历史名称继续保留。显式参数优先于已保存偏好，已保存偏好优先于默认值；用户在宿主中主动禁用的插件不会自动启用。

| Claude Code 版本 | 外部 `/statusline-configure` | 会话内 `/statusline-configure-native` |
| --- | --- | --- |
| 2.1.287+ | 默认启用 | 默认启用 |
| 2.1.258–2.1.286 | 默认启用 | 暂挂 |
| 更低或版本无法识别 | 暂挂 | 暂挂 |

表中默认仅适用于未明确关闭的入口。不兼容的入口不阻止基础安装或另一入口，显式启用也保留偏好并暂挂。升级或降级宿主后重新运行 `install` 和 `doctor`；支持恢复后按偏好重新接入，只有工具记录的暂挂才自动恢复。暂挂期间使用 `claude-statusline configure`、`claude-statusline config ...` 或 `/statusline-config` 向导；向导使用模型回合。

### 打开、导航与编辑

```text
/statusline-configure-native
```

先点击 Client 区域一次，再用键盘；重复运行命令聚焦现有面板并保留草稿。Esc 属于宿主，通常先退出区域焦点，再关闭面板；取消当前输入使用 Ctrl+G。

| 按键 | 操作 |
| --- | --- |
| Tab / Shift+Tab；1 / 2 / 3 / 4 | 切换 Main、Subagents、Settings、Layout |
| Ctrl+E / Ctrl+G | 打开所选项目的格式表单／返回项目列表 |
| ↑ / ↓；PgUp / PgDn；Home / End | 选择、翻页、首尾 |
| ← / → | 调整条目顺序；改变设置值 |
| Space / Enter | 勾选条目；操作设置或进入／确认数值编辑 |
| `/`；Ctrl+U；Ctrl+G | 进入搜索；清空输入；取消并恢复输入前状态 |
| `S` / `F` / `Q` | 保存留页／保存成功后退出／丢弃未保存修改退出 |
| `H` / `A` | 展开 Claude 高级偏好／独立 Apply |
| `R` / `K` / `V` | 丢弃重载／核对保存状态／重试预览 |

搜索或字段编辑期间普通字符作为输入，暂停字符快捷键；刷新设置接受数字或 `event`。启用和未启用条目都能排序，筛选后移动相邻可见条目，保留隐藏项的相对顺序。切页、缩放和预览刷新保留草稿与选择。仅启用项顺序写入配置。

Settings 区分外观、刷新与显示行为、Git 指标、格式、风险颜色、子 Agent 可见性、预设／可移植文件和 Claude 偏好〔高级〕。面板正文最小 32×12；≥64×20 使用完整分组边框，紧凑空间使用标题分隔线。样例预览使用固定数据，不采集实时 Git、transcript 或模型信息。

### macOS 鼠标报告与 Client 焦点

2026-10-04 维护者提供了显示 Claude Code 2.1.289 的截图，并反馈 Linux、Windows 会话内 Client 可以正常操作；macOS 面板可以打开，但交互不正常，尚未找到并验证有效的鼠标配置。本次反馈针对 `/statusline-configure-native`；主状态栏与独立配置入口仍可使用。见[截图说明](images/archive/README.zh-CN.md#会话内-client-截图)与[验收记录](development/native.zh-CN.md#claude-code-21289-交互反馈)。

Terminal.app 用户可按以下步骤检查：

1. 在运行 Claude Code 的终端窗口中选择**显示 → 允许鼠标报告**（View → Allow Mouse Reporting），确认菜单项旁有勾号。Apple 说明新窗口默认勾选此项，因此应检查当前窗口的实际状态。见 [Apple 官方鼠标报告说明](https://support.apple.com/zh-cn/guide/terminal/trmlc69728a5/mac)。
2. 运行 `/statusline-configure-native`，用鼠标点击 **Client 正文区域**一次，再检查 Tab 是否切页、方向键是否移动选择、Space 是否勾选条目。若按键仍进入会话输入框，说明 Client 尚未获得焦点。Client 可以收键后，用 `Q` 丢弃测试修改并退出。
3. 若仍不能正常操作，记录 macOS 版本、终端名称与版本、`claude --version` 输出、是否经过 tmux 或 SSH，以及哪些点击或按键无效。运行 `claude-statusline doctor` 检查接入与后端绑定；诊断结果不代表鼠标事件或 Client 焦点已验证。排查期间可在独立终端运行 `claude-statusline configure`，或使用 `claude-statusline config ...` 配置。

**以上是检查建议，尚未在维护者反馈的 macOS 环境验证有效。** Apple 说明“允许鼠标报告”只允许事件传递给应用，应用本身还须启用鼠标报告；仅勾选菜单不能启用应用的鼠标报告行为，也不保证 Client 获得焦点。Apple 还列出 Command+R 为[切换此选项的快捷键](https://support.apple.com/zh-cn/guide/terminal/trmlshtcts/mac)，使用后应确认菜单实际状态。

若使用 **iTerm2**，检查 **Settings → Profiles → Terminal → Enable mouse reporting** 和 **Report mouse clicks & drags**；后者需允许点击传递给应用，才能检查点击聚焦。按住 Option 会临时绕过鼠标报告，测试时应直接点击。见 [iTerm2 官方终端配置说明](https://iterm2.com/documentation-preferences-profiles-terminal.html)。这些 iTerm2 检查项同样尚未针对维护者反馈的问题验证。

### 保存、冲突与恢复

两个编辑器可以同时打开；先保存者生效，旧 revision 保存被拒绝，不覆盖新配置。Client 保留冲突草稿；`R` 明确丢弃并重新加载后编辑。保存中或结果不明时阻止普通关闭；用 `K` 检查已保存状态，再决定重试或退出。故障时使用面板外的 Retry／Close，保留宿主已接收草稿。

Claude 高级偏好独立 Apply；保存或 Finish 不隐式应用这些偏好。退出后继续原 session。完整开发与验收记录见[原生编辑器](development/native.zh-CN.md)。

## 独立交互式 TUI

在 Claude Code 外的真实终端中运行：

```text
claude-statusline configure
```

Windows 使用 `claude-statusline.exe configure`。stdin、stdout 必须都是 TTY，curses 能初始化，配置有效，且已安装状态栏由当前 CLI 接管。最低尺寸为 64×18；窗口更小时等待放大，仍可取消。

| 按键 | 操作 |
| --- | --- |
| Tab / Shift+Tab | 非字段输入状态下循环 Main、Subagents、Settings、Layout |
| Space | 勾选或取消当前条目 |
| ↑ / ↓；PgUp / PgDn；Home / End | 选择、翻页、首尾 |
| ← / → | 调整条目顺序或设置值 |
| 可打印字符；Backspace / Ctrl+U | 筛选条目 ID 和说明；删除或清空搜索 |
| Ctrl+E / Ctrl+G | 打开逐项格式；退出表单或取消输入 |
| Enter | 项目及原有设置行保存；高级字段编辑或确认输入 |
| Ctrl+S | 非字段输入状态下保存完整草稿 |
| Esc | 先取消当前输入；否则丢弃草稿并关闭 |
| Ctrl+C | 恢复终端、以 130 退出、不保存 |

切页和缩放保留各页草稿、选择、搜索和滚动位置。筛选排序保留隐藏项目的相对顺序；保存前检查当前 revision，无改动不创建备份。

<a id="external-tui-sections"></a>

### 外部 TUI 的分组与页面层级

内容和 `Preview (sample data)` 使用独立区域：64×20 起使用边框，64×18–19 使用紧凑分隔。Main/Subagents 显示 `ON`、`ITEM`、`DESCRIPTION`，设置及表单显示 `OPTION`、`VALUE`。

Settings 按外观、刷新与行为、Git 指标、格式、风险颜色、子 Agent 可见性、预设与文件操作分组。Layout 按模式、行边界、逐项适配分组，标题不可选中。固定样例预览复用生产渲染，不读取实时 Git 或 transcript。[当前页面截图](images/README.zh-CN.md#当前图片)。

### 外部终端配色

外部编辑器使用终端默认前景与背景，标题和快捷键加粗，说明保持普通字重。活动页签及选中行反转默认颜色，并保留选择标记。界面随浅色／深色终端配置显示，独立于 Claude 实际应用的主题。

样例预览使用当前终端背景和所选 `Palette`，标题显示当前选择。无色文字、颜色重置、空行和行尾空格使用终端默认色。curses 按终端能力量化 RGB 样例，ANSI 样例使用终端配置的 ANSI 颜色。浅色终端中若 `Palette: default` 显得过淡，可在 Settings 比较 `Palette: ansi`；修改立即更新预览，保存后应用到实际状态栏。预览保留原有配色，使比较反映终端实际显示效果。默认色不支持、无色终端以及样例颜色对失败／不足时回退到默认文字。


## 外部终端入口 `/statusline-configure`

在 Claude Code 中无参数运行 `/statusline-configure`。该入口需 2.1.258+，按平台在 tmux popup、GNOME Terminal、Terminal.app 或 Windows 新控制台中打开相同的 curses TUI。

外部入口和会话内 Client 的偏好相互独立。只启用或关闭外部入口使用：

```text
claude-statusline install --experimental-slash-tui
claude-statusline install --no-experimental-slash-tui
```

以上命令二选一。省略两参数时保留已保存偏好，缺失偏好时默认启用。接入变化后重启 Claude Code。

保存、取消或错误会返回原会话中的简短结果。外部 TUI 在 570 秒后取消且不保存，独立 `configure` 无自动超时。`help`、`-h`、`--help` 返回用法，其他参数拒绝。启动器不可用时使用独立编辑器或向导。详见[启动器实现](development/README.zh-CN.md#外部启动器与结果回传)。

## `/statusline-config` 问答向导

无参数运行 `/statusline-config`，按问答选择主栏、子 Agent 条目和显示选项。向导使用 Claude 模型回合，保留仍启用条目的相对顺序，将新条目追加到末尾；全部选择完成后调用一次原子 `config apply`，中途取消不保存。

支持的带参数操作为 `show`、`list-items`、`set-items`、`enable`、`disable`、`order`、`subagents`、`set`、`apply`、`reset`：

```text
/statusline-config set-items model-with-effort current-dir git context-remaining task-timer
/statusline-config show
```

在 2.1.258+ 且 hooks 启用时，由本地 hook 执行以上操作，不进入模型回合；旧版或未知版本通过 skill 使用模型回合。高级 `preset`、`import`、`export`、`item`、`layout` 操作使用终端 CLI 或编辑器，详见 [slash 执行范围](reference/cli.zh-CN.md#slash-命令支持范围)。

配置本工具请使用本工具的命令；Claude 内建 `/statusline` 可能将 `statusLine.command` 替换为其他实现。

## 常用配置配方

### 精简开发视图

```bash
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config set directory-style home
claude-statusline config set separator-style compact
```

### 只保留限额与 token

```bash
claude-statusline config set-items five-hour-limit weekly-limit spend-limit tokens
```

### 显示项目、本机和两种上下文百分比

```bash
claude-statusline config enable project-name hostname context-used
```

保留默认上下文条目时会同时显示 `Context N% left`、`Context N% used` 和窗口大小；如只需要其中一种，可独立 `disable context-remaining` 或 `disable context-used`。

### 关闭颜色，适配基础终端或日志录制

```bash
claude-statusline config set colors off
```

### 使用标准 ANSI 色而不是 24 位 RGB

```bash
claude-statusline config set colors on
claude-statusline config set palette ansi
```

### 临时隐藏一个条目，之后追加恢复

```bash
claude-statusline config disable tokens
claude-statusline config enable tokens
```

注意第二条命令会把 `tokens` 追加到末尾，而不是恢复它之前的位置。需要恢复精确位置时使用 `order` 或重新运行 `set-items`。

### 恢复出厂显示配置但保留安装

```bash
claude-statusline config reset
claude-statusline config show
```

<a id="formatting-layout-presets"></a>

<a id="格式布局与预设v150"></a>

## 格式、布局与预设

默认设置保留现有外观。使用 Settings 统一设置格式，通过 Ctrl+E 表单覆盖单个条目，保存前检查 Preview。

Settings 可调整模型名、数字、标签、图标、剩余额度或使用比例、重置时间样式与风险颜色。完整值域与默认值见[显示选项参考](reference/cli.zh-CN.md#显示与宿主选项)。

阈值默认关闭，warning-threshold 默认 70、critical-threshold 默认 90，警告必须低于严重阈值。

```bash
claude-statusline config set model-name short
claude-statusline config set number-format grouped
claude-statusline config set threshold-colors on
```

### 显式布局与子 Agent 显示条件

`config layout auto` 保留原有折行。显式逗号分隔行必须按顺序展平为当前启用项目。`config item main|subagent ID OPTION VALUE` 修改标签、图标、优先级（0–100）、max-width（2–10000 或 none）或格式选项；inherit 清除文本／格式覆盖。显式布局先截短宽度，再隐藏低优先级项目；同级从右向左精简，不增加续行。

```bash
claude-statusline config set-items model current-dir context-used
claude-statusline config layout explicit model,current-dir context-used
claude-statusline config item main model priority 100
claude-statusline config item main current-dir max-width 32
claude-statusline config set subagent-hide-completed on
claude-statusline config set subagent-row-limit 6
claude-statusline config set subagent-task-max-width 48
```

subagent-visibility 接受 all/running。行数／任务宽度接受 none 恢复默认；行数 0 隐藏全部自定义行。隐藏 completed 不隐藏失败。筛选与限制沿用宿主输入顺序，对隐藏 ID 输出空内容；省略 ID 会恢复宿主默认行。

### 预设与可移植配置

minimal/developer/monitoring/multi-agent 预设展开为可编辑草稿，使用模型简称与紧凑数字，保留颜色／调色板／目录样式和刷新选项，重建逐项覆盖，并按预设顺序分配递减的保留优先级。`--dry-run` 输出已验证草稿，不保存。导入接受可移植文件或兼容的仅显示配置文件；仅显示文件保留当前刷新选项。

```bash
claude-statusline config preset developer --dry-run
claude-statusline config preset developer
claude-statusline config export ./statusline.json
claude-statusline config import ./statusline.json --dry-run
claude-statusline config import ./statusline.json
```

可移植文件用于共享显示设置及工具管理的 padding／刷新／Vim 选项，不含安装、运行状态、接入偏好和 Claude 外观及行为偏好。先导出到独立文件，用 `--dry-run` 校验导入，再执行导入；已有导出文件需 CLI 明确传入 `--overwrite` 才能替换。详见[传输格式、校验及受保护目标](reference/cli.zh-CN.md#portable-import-export)。

### 两种编辑器中的格式与布局操作

在 Main/Subagents 选择项目后按 Ctrl+E，编辑标签、图标、保留优先级、最大宽度和继承的格式选项；Ctrl+G 返回项目列表。Enter 打开或接受文本／整数输入。`inherit` 清除覆盖，空标签／图标将其隐藏，`none` 清除可选宽度／限制。Unicode/ASCII 图标使用内置字符，无需额外字体。

Layout 选择 auto/explicit，通过“New row before”设置启用主项目的行边界。较高优先级优先保留，默认 50；最大宽度按终端列计算，包括 CJK 与组合字符。项目排序会同步维护分行。显式行过窄时，范围装饰优先让位给实际项目。 显式布局移除空行且不增加续行，自动布局继续折行。

Settings 提供全局格式、风险阈值、子 Agent 显示条件与文件操作。先选择 Preset，再激活 Expand selected preset。Import 输入路径后只替换草稿，检查 Preview 后保存或取消。Export 将当前草稿（含未保存改动）写入新文件，不保存设置。相对路径以宿主／终端工作目录为基准，`~` 展开为用户主目录。出错保留现有草稿；两种编辑器均拒绝覆盖已有导出文件，可换路径，或使用 CLI `--overwrite` 明确替换。

Client 用 `S` 保存并继续、`F` 保存并关闭、`Q` 放弃草稿。curses 用 Ctrl+S 从任意页保存；项目页及原有设置仍用 Enter 保存，新字段的 Enter 用于编辑／接受字段。新表单用 Ctrl+U 清空、Ctrl+G 取消输入；原有 padding／refresh 数字编辑保留 Backspace 删除与 Esc 恢复，编辑以外的 Esc 放弃 curses 编辑器。字段／路径输入期间 s/f/q 等普通字符只作为文本。

| 预设 | 主状态栏布局 | 子 Agent 默认 |
| --- | --- | --- |
| minimal | 自动：模型／effort、目录、上下文剩余、任务计时 | 原有五项 |
| developer | 两行：模型／目录／Git；上下文剩余／tokens／计时／会话费用 | 原有五项 |
| monitoring | 三行：上下文／三种额度；两种重置／缓存状态／TTL；会话费用／时长／API 时长／请求／缓存未命中 | 原有五项 |
| multi-agent | 两行：模型／目录／Git；上下文剩余／tokens／计时 | 原有五项，隐藏 completed，最多六个宿主行，任务宽度 48 |

风险颜色默认关闭，警告 70%、严重 90%，始终按实际使用比例判断，包括显示剩余额度时。缺失观测保持不可用，零值保留，过期额度／重置数据隐藏。预设展开为普通可编辑配置，保留颜色、调色板、目录／分隔符风格、刷新选项及当前子 Agent 启用状态。

### Claude 宿主偏好独立应用

在 Client Settings 按 `H`（Claude preferences）展开／收起 Claude 外观、时间／标题及行为分组。主题、verbose、逐轮计时、减少动画、提示、进度条与通知使用当前宿主实际提供的配置行；适用的时间／标题行也会纳入，缺失行显示官方入口。模型、effort、thinking、fast mode 单列为行为分组，与同名状态栏显示开关独立。

按实际类型／选项编辑后用 `A` Apply。每行保留应用结果，涵盖宿主拒绝、锁定、外部修改与部分成功。工具 Save/Finish 和可移植文件不应用宿主偏好；Reload 明确放弃待处理编辑，继续使用键盘前点击恢复后的 Client 区域。宿主可能改变类型或不提供某行，此时使用提示的 `/config`、`/model`、`/effort`、`/fast` 等官方入口。独立 TUI 只管理工具配置，不能调用 Claude 宿主 API。

<a id="phase-5-预览安装"></a>
<a id="phase-5-正式版安装"></a>

## 可选实时状态

采集与显示选择是两个步骤。先启用独立采集器，再选择需要的字段：

```text
claude-statusline install --live-metrics
claude-statusline config enable run-state permission-mode active-agents task-progress last-tool
claude-statusline doctor
```

重启 Claude Code 加载采集器。其他采集条目为 `ttft`、`output-rate`、`prompt-input-tokens`、`prompt-output-tokens`、`prompt-cost`，通过任一编辑器或 `config enable` 选择。它们都不在默认启用集合中，实时采集需 Claude Code 2.1.289+，只启用编辑器不会开启采集。

`claude-statusline install --no-live-metrics` 保留原先同时关闭计时和高级采集的选择；加上 `--native-timing` 可保留计时元数据。普通重装保留已保存选择。缺失实时观测显示 `—`，有限覆盖或最近观测可附 `*`。采集口径和请求覆盖见[指标定义](DISPLAY_ITEMS.zh-CN.md#实时状态项)，采集问题见[运行诊断](development/live.zh-CN.md)。

`branch-diff` 是独立的默认未选中项，数据来自本地 Git，无需原生采集器。使用 `claude-statusline config enable branch-diff` 选择，再通过 `claude-statusline config set branch-diff-base auto` 或安全的本地 Git ref 设置已提交分支比较。它不包含未提交工作树修改，也不 fetch 远程，详见[分支与已结束代理定义](DISPLAY_ITEMS.zh-CN.md#分支基准与已结束代理)。

## 可配置显示项

查询受支持的 ID 和当前启用状态：

```text
claude-statusline config list-items
claude-statusline config subagents list-items
```

主栏目录共 60 项，默认启用十项：`model-with-effort`、`current-dir`、`git`、`context-remaining`、`context-window-size`、`five-hour-limit`、`weekly-limit`、`spend-limit`、`tokens`、`task-timer`。

常用可选项按下表分组，通过 ID 启用或在编辑器中选择。

| 分组 | 可选 ID |
| --- | --- |
| 身份与会话 | `project-name`、`hostname`、`version`、`session`、`agent` |
| 运行模式 | `fast-mode`、`thinking`、`vim-mode` |
| 仓库 | `pr`、`repo`、`worktree` |
| 上下文与用量 | `context-used`、`cost`、`prompt-cache` |

子 Agent 目录共 14 项，默认启用五项：`status-elapsed`、`name`、`model-with-effort`、`context-remaining`、`task`。组合项 `status-elapsed` 与独立 `status`、`elapsed` 互斥。完整目录和缺失数据行为见[字段参考](reference/cli.zh-CN.md#可配置显示项)及[指标定义](DISPLAY_ITEMS.zh-CN.md)。

## 主状态栏显示含义

Git 使用 `↑N`、`↓N` 表示与上游的提交差距，`● N`（Linux/macOS）或 `●N`（Windows/WSL）表示暂存文件，`~N` 表示未暂存，`!N` 表示冲突，`?N` 表示未跟踪。`Git!` 表示查询失败，非 Git 目录省略该项。

Token 为会话累计：`hit` 是缓存读取输入，`miss` 是普通输入与缓存创建之和，`out` 是输出。统计包含可发现的子 Agent transcript，与上下文占用或限额口径不同。

### 任务总耗时与执行耗时

`task-timer` 从最近一次人类任务最早可信提交开始计时，包含排队、用户等待、所属子 Agent 和主 Agent 收尾，默认启用。`prompt-timer` 作为兼容别名继续被配置命令和导入接受，保存后的配置使用 `task-timer`。

计时使用 `⏱` 表示运行、`✓` 表示成功、`■` 表示中断、`✗` 表示失败；结束未确认时显示 `? <elapsed>+`。有子 Agent 时可显示 `⏳ 2 agents · <elapsed>` 或 `⏳ main wrap-up · <elapsed>`。传统 `Stop` 是结束候选，可信继续活动保留原任务和时钟；完成需要可靠结束证据、所属代理及必要报告已处理、主 Agent 收尾完成。已接受的终态值冻结。详见[标记与计时范围](reference/cli.zh-CN.md#prompt-计时标记)。

`task-active-timer` 为可选项，默认未选中；从开始执行后累计耗时，排除已核实的用户等待，并行工作不会重复累加。它需要 Claude Code 2.1.289+ 的原生计时及完整任务／等待观测，可这样启用：

```text
claude-statusline install --native-timing
claude-statusline config enable task-active-timer
claude-statusline doctor
```

改变采集器接入后重启 Claude Code。兼容宿主新安装已默认开启原生计时，已保存的显式关闭仍受尊重；高级实时指标独立管理，此计时项无需开启它们。缺失观测、等待覆盖不完整、状态过期或时钟不可信时隐藏执行耗时，不把未知等待当作零。原生单轮耗时、会话运行时间和累计 API 耗时是独立指标，不校准两个任务时钟，详见[计时契约](development/timer.zh-CN.md)。

## 子 Agent 行与三种作用域

```text
⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow
```

- 全局底栏属于主会话；任务启动过代理后，可用 `Main/Session` 标记范围。
- 主栏 `tokens` 聚合整个会话，包括可发现的代理用量。
- 每条代理行描述自己的任务，代理 `tokens` 表示上下文占用，不是累计 API 用量。

切换到代理 transcript 不会改变全局栏范围，因为 Claude Code 未提供当前焦点代理 ID。能够确定结束的代理用时会冻结，详见[行字段及宽度规则](reference/cli.zh-CN.md#子-agent-行与三种作用域)。

## 显示与宿主选项

通过 Settings 或 `config set OPTION VALUE` 调整外观、目录、分隔符、作用域标签、刷新和子 Agent 可见性。宿主选项 `padding`、`refresh-interval`、`hide-vim-mode-indicator` 要求当前接入归属本工具。完整值域与默认值见[选项参考](reference/cli.zh-CN.md#显示与宿主选项)。

`refresh-interval event` 只随 Claude 事件刷新，运行中的计时器不会逐秒变化。使用 `claude-statusline config set refresh-interval 1` 恢复持续刷新。

## 配置文件

| `<CLAUDE_CONFIG_DIR>` 下的文件 | 用途 |
| --- | --- |
| `claude-statusline.json` | 显示项、顺序、格式、布局和子 Agent 可见性 |
| `claude-statusline-features.json` | 外部编辑器的独立偏好 |
| `claude-statusline-native.json` | 会话内 Client 的独立偏好 |
| `claude-statusline-runtime.json` | 原生计时和高级采集的独立偏好 |
| `settings.json` | 本工具接入的 Claude 命令、hooks 和宿主状态栏选项 |

通过 CLI 或编辑器修改。显示 schema v5 支持读取兼容的旧 schema，读取不写入，实际保存才备份迁移。严格 JSON 拒绝未知字段、重复字段、错误值和不支持的版本，详见[文件格式](reference/cli.zh-CN.md#配置文件)。

## 自定义配置目录与环境变量

管理命令使用 `--config-dir`；对于 `config`，该参数位于操作前：

```text
claude-statusline config --config-dir /path/to/claude-config show
claude-statusline configure --config-dir /path/to/claude-config
```

显式目录优先于 `CLAUDE_CONFIG_DIR`，最后使用默认 `~/.claude`。启动 Claude Code 和管理接入时使用同一目录。[环境变量及 shell 示例](reference/cli.zh-CN.md#自定义配置目录与环境变量)。

## 升级

### 迁移旧分发名称

本仓库 1.7.3 及更早 Release wheel 使用分发名 `claude-code-statusline`；PyPI 上该名称属于另一个项目。移除前先用 `pipx list --json` 和 `claude-statusline --version` 确认旧安装来自本仓库。索引安装与后续升级使用新名称。

迁移时先关闭 Claude Code。移除旧 pipx 环境，安装新分发包并同步接入：

```text
pipx uninstall claude-code-statusline
pipx install fbincon-claude-code-statusline
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

pipx 软件包移除会保留 Claude 显示配置、接入偏好、运行状态和备份；重新接入更新命令路径与 Mod 后端绑定，之后重启 Claude Code。配置归属标记和可移植导出格式保持兼容。确认 `claude-statusline --version` 为 1.7.6，且 `pipx list` 中该工具仅保留新分发包。迁移未完成时，可重新安装本仓库已验证的原始 wheel，再运行 `install` 和 `doctor`。

### 替换 Python 包

```text
pipx upgrade fbincon-claude-code-statusline
```

本地 wheel 或源码安装使用 `pipx install --force`，参数为更新或构建后的原文件、固定标签 Git URL 或本地检出目录。

### 同步 Claude Code 接入

```text
claude-statusline --version
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

随后重启 Claude Code。安装器同步命令路径、skill 模板、hooks、插件和兼容设置，保留显示配置、独立偏好、缓存与任务状态。历史外部入口关闭操作可能删除偏好文件；缺失偏好时，如需继续关闭该入口，应明确传入 `--no-experimental-slash-tui`。

### 版本兼容

当前显示 schema v5、配置协议 v5、独立运行协议 v2 要求前后端资源匹配。兼容的显示 v1/v2/v3/v4 文件读取时不重写，实际保存才备份原字节并迁移为 v5；更高版本或错误内容拒绝。旧包不一定识别新 schema 或新显示项 ID。

降级前使用新版关闭或移除旧版无法管理的接入，包括适用的实时采集和原生编辑器。根据备份 `metadata.json` 恢复兼容显示文件，或在 schema 兼容时移除不支持的条目 ID。随后安装旧包、运行 `install` 和 `doctor`，并重启 Claude Code。可移植导出可另行保留当前显示选择，供以后恢复。

Claude 宿主版本跨过功能门槛时，各接入独立按偏好暂挂或恢复；明确关闭及宿主中主动禁用的插件保持关闭。历史变化见[变更记录](../CHANGELOG.zh-CN.md)。

## 卸载

在 CLI 仍可用时先移除接入：

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall fbincon-claude-code-statusline
```

Windows 使用 `claude-statusline.exe`。卸载只移除归属本工具的命令、hooks、skills、插件和资源，第三方设置保留。显示文件、编辑器及实时偏好、缓存、任务状态和备份保留供重装复用。如需重装后继续关闭某项接入，先明确保存对应 `install --no-...` 偏好。

## 备份与回滚

安装、卸载和配置实际修改时，在以下目录创建备份：

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

`metadata.json` 记录操作、时间、原绝对路径及原文件是否存在。`.before` 保存修改前字节，`.absent` 表示目标原本不存在。手工回滚前退出受影响的 Claude 会话及编辑器，再将 `.before` 恢复到记录的目标，对 `absent` 目标恢复为不存在。事务失败会尝试回滚，备份继续保留。

## `doctor` 诊断

```text
claude-statusline doctor
```

Doctor 检查平台与 Python、PATH、配置有效性、命令归属、hooks、编辑器偏好及资源、宿主兼容、启动条件、实时采集和状态目录。它不重写配置、不打开编辑器窗口；macOS 可检查父目录同步能力。诊断通过不另行证明 GUI 焦点或人工交互有效。

`[OK]` 表示通过，`[WARN]` 表示降级但仍可返回 0，存在 `[ERROR]` 时返回 1。接入过时先运行 `install`、再次 `doctor`，然后重启 Claude Code。归属冲突先检查具体目标，再决定是否使用 `--force`。

已有显示配置文件时，schema 检查报告程序支持的版本，当前为 `[OK] display config schema: v5`。有效旧文件改为提示，例如：

```text
[WARN] display config schema v4 is valid and will migrate to v5 on the next configuration save
```

此警告不会迁移文件：诊断与读取保留原字节，实际配置保存才备份并迁移。显示 schema 与配置协议 v5、运行协议 v2 分别管理版本。

## 故障排查

### 状态栏不显示

1. 运行 `claude-statusline doctor`。
2. 确认 `claude-statusline` 位于 PATH。
3. 确认没有通过 `config set-items` 把 `items` 设为空。
4. 查看 `settings.json` 中是否存在指向本工具的 `statusLine.command`。
5. 如果 Claude Code 提示 statusline 因 trust 被跳过，重启 Claude Code 并接受对应信任提示。
6. 检查是否启用了会统一禁用 hooks/statusline 的 Claude Code 设置。

### 子 Agent 行不显示或发生所有权冲突

先运行 `claude --version` 和 `claude-statusline doctor`。Claude Code 低于 2.1.205 或版本不可识别时，主栏可用但子 Agent 设置/hooks 会暂挂；升级并重跑 `claude-statusline install`。如果 `doctor` 报告 `foreign`，选择其一：

```bash
# 明确接管第三方子 Agent 行
claude-statusline install --force

# 保留第三方实现，只关闭本工具的自定义行目标
claude-statusline config set subagent-statusline off
claude-statusline install
```

若 `subagents.items` 为空或 `subagents.enabled` 为 false，本工具的 renderer 会按协议返回空 content。进入子 Agent transcript 后底部全局栏仍属于主 Agent/session，这是 Claude 未提供当前焦点 ID 的既定边界。

### `/statusline-config` 不可见

```bash
claude-statusline install
claude-statusline doctor
```

确认 doctor 中 `/statusline-config skill` 为 OK。若安装是在当前 Claude Code 会话启动后完成，可新开一个会话再次检查命令发现情况。

### `/statusline-configure-native` 缺失、无键盘输入或保存失败

1. 运行 `claude-statusline doctor`，核实宿主 2.1.287+、插件资源及后端绑定；低版本暂挂属于兼容处理。
2. 确认没有明确关闭 Native、宿主主动禁用插件、safe/bare 或策略限制；按需要运行 `install --native-editor` 后在受信任终端重启 Claude Code。
3. 面板打开后先点击 Client 区域；macOS 参照[鼠标报告与 Client 焦点检查](#macos-鼠标报告与-client-焦点)，最新反馈中的有效配置仍未验证。取消输入用 Ctrl+G；Esc 仍由宿主处理。
4. 保存冲突保留草稿，`R` 明确丢弃重载；保存结果不明先 `K` 核对，故障用 Retry／Close。版本／资源不匹配时重新安装匹配 wheel 并重装接入，不手工接管外来缓存。

### `/statusline-configure` 不可见或显示 suspended

先检查宿主版本与已保存偏好；正式版默认启用，可用以下命令显式恢复：

```bash
claude --version
claude-statusline install --experimental-slash-tui
claude-statusline doctor
```

版本低于 2.1.258 或无法识别时，显式启用保留偏好并暂挂，不阻止基础安装。已启用后发生降级时，普通 `install` 保留偏好但暂挂并移除活动 skill/hook，所以 slash 菜单中不会显示该命令。升级到兼容版本后重新运行普通 `install`，再新开 Claude Code 会话。

<a id="实验入口无法打开新终端"></a>

### 外部入口无法打开新终端

tmux 路径要求 hook 环境中同时存在有效的 `TMUX`、形如 `%<数字>` 的 `TMUX_PANE`，且 2 秒预检查能访问目标 server/pane。Linux 目标失效时会尝试 GNOME；macOS 改为检查本地图形会话和 Terminal.app；缺少条件时提示独立命令。若已成功选择 tmux，popup 内失败不会二次启动其他终端。

macOS Terminal 路径要求本地图形会话、系统 Terminal.app、`/usr/bin/open` 和可用的进程启动标识。启动后 30 秒内没有握手会返回错误；先检查窗口是否打开以及 Python 是否提供 curses。`doctor` 只检查条件，不打开窗口。SSH 中改用独立命令；Terminal 窗口在结束后仍保留时，按 Terminal 的窗口关闭偏好处理。

GNOME 路径要求 `DISPLAY` 或 `WAYLAND_DISPLAY`、可执行的 `gnome-terminal` 和可用的用户 D-Bus/图形会话。D-Bus 启动错误会作为短错误返回原 Claude 对话。Linux 两种启动器都不可用，或 macOS 没有有效 tmux 及本地 Terminal.app 条件时，直接在终端运行：

```bash
claude-statusline configure
```

Windows 使用系统默认终端承载 `CREATE_NEW_CONSOLE`。若关窗、子进程异常退出或未生成可信结果，原对话会立即收到错误；直接排查时在 PowerShell 中运行 `claude-statusline.exe configure`。确认 `doctor` 的 `windows-curses backend` 与 `Windows system new-console launcher` 均为 OK。

若 hook 在 600 秒结束，TUI 通常应已在 570 秒自行超时。检查 `<CLAUDE_CONFIG_DIR>/statusline_runtime/slash_tui/` 时，不要手工跟随或删除不明符号链接；工具只自动清理超过 24 小时、符合自身命名前缀且不含符号链接的残留。

若启用了 `disableAllHooks`，本地启动器不会运行。回退 skill 会提示这一点，并禁止 Bash/PowerShell 自行启动 curses；该例外可能产生一个极短模型回合。重新启用 hooks 后新开会话再试。

### 带参数的 slash 命令仍进入模型

这通常表示 Claude Code 版本低于 2.1.258、版本无法识别，或本地快捷 hook 未同步。检查：

```bash
claude --version
claude-statusline doctor
claude-statusline install
```

旧版由模型回合执行配置命令是预期的兼容行为，不会改变命令语义。

### 配置命令提示 statusLine 不属于本工具

`padding`、`refresh-interval`、`hide-vim-mode-indicator` 和完整 `apply` 需要修改 Claude Code 的 `settings.json`。为保护其他 statusline，这些操作要求当前 `statusLine.command` 指向当前可执行文件。

先检查：

```bash
claude-statusline config show
claude-statusline doctor
```

如果确实要让本工具接管 statusline，再运行 `claude-statusline install`。显示项、颜色、palette、目录和分隔符则可以在安装前配置。

### JSON 配置损坏

renderer 会继续使用默认显示，但诊断和普通写命令会报错。恢复默认配置：

```bash
claude-statusline config reset
claude-statusline doctor
```

如需保留手工配置内容，先从最近的备份中恢复或修正 JSON，再运行 doctor。

### Git 信息缺失或显示 `Git!`

Linux / WSL / macOS：

```bash
command -v git
git -C /path/to/project status --porcelain=v2 --branch --ahead-behind
```

Windows PowerShell：

```powershell
Get-Command git
git -C 'C:\Path With Spaces\project' status --porcelain=v2 --branch --ahead-behind
```

非 Git 目录不显示 Git 项是正常行为。`Git!` 表示 Git 调用缺失、超时或结果无法解析。禁用 `git` 后 renderer 不再执行 Git 查询：

```bash
claude-statusline config disable git
```

### Token 或计时器暂时不显示

这些条目依赖 Claude Code 提供的 session ID、transcript 路径和生命周期事件。在第一次真实模型响应前、特殊本地命令期间或 transcript 尚未产生时，暂时省略是正常行为。

若计时器存在但运行中数字不连续变化，检查是否使用了事件刷新：

```bash
claude-statusline config show
claude-statusline config set refresh-interval 1
```

### 输出在窄终端中换成多行

自动布局会按宽度折行；显式布局则按最大宽度截短并按优先级隐藏条目，不增加续行。增大终端宽度、使用 `compact` 分隔符、选择更短的目录样式，或隐藏次要条目可以减少换行。

## 退出码

管理命令成功返回 0，doctor 错误返回 1，已捕获的参数、配置或归属错误返回 2。未捕获 CLI 异常也可返回 1，详见[退出码参考](reference/cli.zh-CN.md#退出码)。TUI 中断使用 130 或 `128 + signal`，恢复终端且不保存草稿。

## 当前边界

- 配置按用户生效，暂不提供项目覆盖、拖放或自定义快捷键。
- macOS 会话内 Client 交互问题仍有记录，可使用独立 TUI 或 CLI。
- 外部桌面启动器支持列明的平台终端；其他终端可使用独立 `configure` 或 tmux。IDE、print 模式、Web 会话和全局禁用 hooks 不保证能打开外部编辑器。
- 可选实时字段需独立采集和有效观测，不推定缺失测量或当前焦点代理。
- 子 Agent 行提供当前任务字段，不提供历史账本、逐代理 Git、缓存或会话聚合。
- 完成判定需要已确认的结束证据、普通 Agent 任务及报告已处理、主 Agent 收尾完成。传统 Stop 只是候选，超时或心跳过期不会推定完成；后台 shell/server/monitor/workflow 与 agent-team 账本不阻塞完成。
- 配色不跟随 Claude `/theme`，默认 palette 使用固定项目颜色。

## 相关文档

- [项目 README](../README.zh-CN.md)与[图片索引](images/README.zh-CN.md)。
- [CLI 参考](reference/cli.zh-CN.md)与[显示项及指标定义](DISPLAY_ITEMS.zh-CN.md)。
- [开发指南](development/README.zh-CN.md)、[测试](development/testing.zh-CN.md)与[发布指南](RELEASING.zh-CN.md)。
- [Claude Code 状态栏文档](https://code.claude.com/docs/en/statusline)与 [hooks 参考](https://code.claude.com/docs/en/hooks)。

<details>
<summary>原章节链接与详细参考</summary>

<a id="cli-总览"></a>

[CLI 总览](reference/cli.zh-CN.md#cli-总览)

<a id="config-apply"></a>
<a id="config-disable-item"></a>
<a id="config-enable-item"></a>
<a id="config-list-items"></a>
<a id="config-order-item"></a>
<a id="config-reset"></a>
<a id="config-set-items-item"></a>
<a id="config-set-option-value"></a>
<a id="config-show"></a>
<a id="config-subagents-"></a>
<a id="配置命令详解"></a>
<a id="错误clock-不是受支持的条目"></a>
<a id="错误git-重复出现"></a>

[配置命令详解](reference/cli.zh-CN.md#配置命令详解)

<a id="git-标记"></a>
<a id="prompt-计时标记"></a>
<a id="token-含义"></a>

[主状态栏显示含义](reference/cli.zh-CN.md#主状态栏显示含义)

<a id="分隔符和语义分组"></a>
<a id="刷新间隔"></a>
<a id="只在-claude-code-事件发生时刷新"></a>
<a id="目录格式"></a>
<a id="降低刷新频率"></a>
<a id="颜色"></a>
<a id="默认每秒刷新"></a>

[显示与宿主选项](reference/cli.zh-CN.md#显示与宿主选项)

<a id="claude-code-宿主配置"></a>
<a id="实验功能偏好"></a>
<a id="显示配置"></a>
<a id="编辑器启用偏好"></a>

[配置文件](reference/cli.zh-CN.md#配置文件)

<a id="从源码构建与安装"></a>
<a id="准备开发环境"></a>
<a id="运行检查"></a>
<a id="附录开发与测试"></a>
<a id="隔离测试与人工验收"></a>

[附录：开发与测试](development/README.zh-CN.md#附录开发与测试)

<a id="hook"></a>
<a id="render"></a>
<a id="render-subagents"></a>
<a id="slash-hook"></a>
<a id="附录内部命令"></a>

[附录：内部命令](development/README.zh-CN.md#附录内部命令)

<a id="外部启动器与结果回传"></a>
<a id="实验启动器与结果回传"></a>
<a id="平台执行与文件安全"></a>
<a id="配置写入与并发"></a>
<a id="附录实现说明"></a>

[附录：实现说明](development/README.zh-CN.md#附录实现说明)

<a id="statusline-config-的执行方式"></a>
<a id="使用方式"></a>
<a id="启用与关闭"></a>
<a id="外部-tui-的分组与页面层级v161"></a>
<a id="实验入口-statusline-configure"></a>
<a id="格式布局与预设v161"></a>

[当前配置与兼容说明](#版本兼容)。

</details>

<a id="任务计时预览"></a>

## 任务计时

[v1.7.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.7.0) 已包含任务计时。升级稳定软件包：

```bash
pipx upgrade fbincon-claude-code-statusline
claude-statusline install
claude-statusline config enable task-active-timer
```

`task-timer` 默认显示任务总耗时，旧命令和旧配置仍可使用 `prompt-timer`。可选 `task-active-timer` 只在原生执行／等待证据完整时出现。原始 Stop 未确认时显示下界 `? ...+`，可信续跑继续同一任务；原生单轮耗时不缩短总耗时，会话和 API 耗时分别定义。

兼容宿主的新安装默认采集计时元数据，高级指标仍需 `install --live-metrics`。`install --no-native-timing` 关闭原生计时，`install --no-live-metrics` 保留原先的全部关闭行为；仅计时模式可明确使用 `install --no-live-metrics --native-timing`。旧显式关闭偏好和已禁用插件保持关闭。当前宿主的权限、问题或 MCP 等待可能使执行耗时不可用，`doctor` 说明覆盖情况。

降级前运行 `claude-statusline install --no-native-timing --no-live-metrics`，旧版不能管理编辑器时也先移除对应原生编辑器，并恢复迁移前显示／运行偏好备份；然后安装旧包和接入。读取不重写旧配置，实际保存使用 schema 5 并备份。覆盖限制与验证证据见 Release 和[计时契约](development/timer.zh-CN.md)。
