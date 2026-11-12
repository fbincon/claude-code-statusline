# Claude Code Statusline 使用指南

[English](USER_GUIDE.md) | **简体中文** · [文档中心](README.zh-CN.md)

本指南说明安装、编辑器操作、日常配置、可选实时指标及恢复。 新安装从[快速开始](#快速开始)进入；完整键位与编辑流程见[配置编辑器](EDITORS.zh-CN.md)。[使用演示](SHOWCASE.zh-CN.md)提供完整操作流程；准确命令语法与文件格式见 [CLI 参考](reference/cli.zh-CN.md)。

| 任务 | 专题指南 |
| --- | --- |
| 安装并接入 Claude Code | [安装与接入](#安装与接入) · [首次设置](SETUP.zh-CN.md) |
| 首次运行 | [快速开始](#快速开始) · [首次设置](SETUP.zh-CN.md) |
| 选择配置方式 | [编辑器、向导与 CLI](#选择配置入口) |
| 从方案或配方开始 | [完整方案](SCHEMES.zh-CN.md) · [常用配置配方](#常用配置配方) |
| 布局、颜色与草稿复用 | [组件与布局](COMPOSITION.zh-CN.md) · [外观](APPEARANCE.zh-CN.md) · [草稿历史与复用](DRAFT_HISTORY.zh-CN.md) |
| 跨项目分享设置 | [方案与项目绑定](PROFILES.zh-CN.md) |
| 理解任务和测量值 | [任务详情](TASK_DETAILS.zh-CN.md) · [指标定义](DISPLAY_ITEMS.zh-CN.md) |
| 添加来源 | [扩展](EXTENSIONS.zh-CN.md) |
| 诊断接入或输出问题 | [故障排查](#故障排查) · [输入诊断](DIAGNOSTICS.zh-CN.md) |
| 升级、回退或恢复 | [版本管理](PACKAGE_MANAGEMENT.zh-CN.md) |

配置保存在当前用户目录，项目绑定可选择命名显示方案。渲染读取 Claude 输入、本地 Git、transcript 和状态，不发网络请求或使用模型 token；明确的来源刷新单独执行。问答向导使用模型回合。

通用单行 CLI 示例适用于 Bash、Zsh 和 PowerShell。Windows 使用 `claude-statusline.cmd`，或用 Node 调用安装后 JavaScript 入口的绝对路径。`<CLAUDE_CONFIG_DIR>` 表示环境变量 `CLAUDE_CONFIG_DIR` 的值，未设置时为 `~/.claude`；这是路径占位符，不要原样输入。

当前使用 TypeScript npm 分发；已有 Python 环境可保留用于显式回退，见[升级](#升级)。开发与构建步骤见[开发指南](development/README.zh-CN.md)。

## 文档导航

- **开始使用**
  - [快速开始](#快速开始)
  - [功能概览](#功能概览)
  - [运行要求](#运行要求)
  - [安装与接入](#安装与接入)
  - [选择配置入口](#选择配置入口)
  - [语言与保存行为](#语言与保存行为)
- **配置**
  - [常用配置配方](#常用配置配方)
  - [终端编辑器](#终端编辑器)
  - [会话内编辑器（Client）](#原生配置编辑器)
  - [`/statusline-config` 问答向导](#statusline-config-问答向导)
  - [查找显示项与审阅导入](#查找显示项与审阅导入)
  - [组件组合](#组件组合)
  - [格式、布局与预设](#格式布局与预设)
  - [快速配置、文本编辑与说明](#快速配置文本编辑与说明)
  - [Unicode 文本与终端列宽](#unicode-文本与终端列宽)
  - [设置与配置文件](#设置与配置文件)
- **理解与诊断**
  - [理解显示数据](#理解显示数据)
  - [`doctor` 诊断](#doctor-诊断)
  - [故障排查](#故障排查)
  - [退出码](#退出码)
  - [当前边界](#当前边界)
- **维护**
  - [升级](#升级)
  - [卸载](#卸载)
  - [备份与回滚](#备份与回滚)
- **附录**
  - [相关文档](#相关文档)

## 快速开始

准备 Node 22 或 24、npm 和 Claude Code CLI，在交互式终端运行。Windows 将下列 `claude-statusline` 命令改为 `claude-statusline.cmd`；完整平台与宿主条件见[运行要求](#运行要求)。

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
claude-statusline setup --dry-run
claude-statusline setup
```

<a id="在受信任终端重启-claude-code然后"></a>

确认 setup 的接入结果后，**在受信任终端重启 Claude Code**，再运行：

```text
claude-statusline doctor
```

后续调整显示时，在 Claude 中打开 `/statusline-configure-native`，或在终端运行 `claude-statusline configure`。按 Ctrl+P 选择方案或预设，检查样例预览，再保存。详见[编辑器操作](EDITORS.zh-CN.md)。

首次设置的 TTY 条件、预演、分阶段保存与恢复见[首次设置](SETUP.zh-CN.md)；离线安装、直接 `install` 及已有接入冲突见[安装与接入](#安装与接入)。

## 功能概览

[条件显示、逐项颜色、主题与 Powerline](APPEARANCE.zh-CN.md)说明共享设置、原始观测规则和迁移恢复。

主栏支持 65 个主栏指标，子代理行支持 15 个子代理指标，两个作用域均支持文本和弹性留白，默认启用 10 个主栏条目和 5 个子代理条目。终端编辑器与会话内编辑器（Client）均提供 Main、Subagents、Settings、Layout 四页、固定样例预览、格式设置、八套完整显示方案与六种原有预设及可移植 JSON 文件。

主栏显示主会话数据，各子代理行显示自己的任务数据；任务计时包含子代理工作和主代理收尾。[显示项与指标定义](DISPLAY_ITEMS.zh-CN.md)说明数据来源、作用域、缺失观测和指标边界。

## 运行要求

| 平台 | 环境 |
| --- | --- |
| Linux / WSL | Node 22.x 或 24.x，x64 |
| Windows 10/11 | Node 22.x 或 24.x，x64 |
| macOS 14+ | Node 22.x 或 24.x，Intel / Apple Silicon |

准备 Claude Code CLI 和 npm，验证工具链固定为 npm 11.19.0。Git 字段和源码构建需要 Git。Windows ARM 设备使用模拟 x64 Node；原生 Windows ARM64 与 32 位运行时暂不在支持范围。安装包已包含原生依赖，无需 Python 或编译器。

六项既有验证缺口仍未验证；接受范围与历史发布决策见[测试与验收](development/testing.zh-CN.md#known-validation-gaps)。

| 功能 | Claude Code 版本条件 |
| --- | --- |
| 主栏、CLI、终端编辑器、问答向导 | 旧版或未知版本仍可使用，缺失数据省略 |
| 子代理行及生命周期 hooks | 2.1.205+；逐任务 effort 需 2.1.214+ |
| 带参数 slash 命令的本地执行、外部入口 | 2.1.258+ |
| 会话内 Client 编辑器 | 2.1.287+ |
| 原生计时及高级实时指标采集 | 2.1.289+ |

外部启动器在 Linux 使用 tmux 或 GNOME Terminal，在 macOS 使用 tmux 或 Terminal.app，在 Windows 使用系统新控制台。其他终端环境可直接运行终端编辑器。升级或降级跨过功能门槛后，重新运行 `install` 和 `doctor`。

## 安装与接入

### 安装 npm 包

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
```

如需从 npm 安装指定正式版，在包名后加 `@VERSION`，版本取所选标签去掉开头的 `v`。安装软件包与接入 Claude 分两步。确认 npm 命令目录位于 PATH。Windows 的 npm 包装入口为 `.cmd` 和 `.ps1`，Claude 接入绑定绝对 Node 可执行文件及 JavaScript 入口。

### 离线安装

从发行列表选定准确的正式版标签，将该标签的四个附件下载到同一目录。附件包括 `fbincon-claude-code-statusline-VERSION.tgz`、可重建的 `claude-code-statusline-VERSION-source.tar.gz`、`build-manifest.json` 和 `SHA256SUMS`。安装前核验 `SHA256SUMS` 列出的三个文件。[GitHub 发行列表](https://github.com/fbincon/claude-code-statusline/releases) · [Gitee 发行列表](https://gitee.com/fbincon/claude-code-statusline/releases)

在 Linux 或 WSL 的示例中，将 `VERSION` 替换为所选标签的版本号。

```bash
sha256sum -c SHA256SUMS &&
  npm install --global --offline --ignore-scripts "./fbincon-claude-code-statusline-VERSION.tgz"
```

macOS 使用 `shasum -a 256 -c SHA256SUMS` 校验。PowerShell 用 `Get-FileHash -Algorithm SHA256 -LiteralPath FILE` 逐项与 `SHA256SUMS` 比较。摘要一致后用相同的 npm 参数安装已验证的本地 tgz。从源码构建时，使用 Release 的可重建源码附件。[源码构建](development/README.zh-CN.md#从源码构建与安装)

### 接入 Claude Code

确认 npm 命令目录位于 PATH。新安装建议先按[快速开始](#快速开始)运行引导式设置，完整过程见[首次设置](SETUP.zh-CN.md)。直接接入可用以下命令：

```text
claude-statusline --version
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Windows 使用 `claude-statusline.cmd`，或明确的 Node/JavaScript 入口。随后在受信任终端重启 Claude Code，加载安装的插件和命令。如需引导式预览和接入审核，使用[首次设置](SETUP.zh-CN.md)。

### `install` 会做什么

安装器将本工具拥有的状态栏命令、计时及子代理 hooks、配置 skills 和兼容的编辑器接入合并到用户配置中，保留无关设置与 hooks。实际修改前创建备份，并通过原子写入保存；重复安装是幂等的。

没有保存偏好时，两个编辑器入口默认启用。显式参数优先于已保存偏好，已保存偏好优先于默认值；不兼容的接入暂挂，但保留偏好。原生计时和高级实时采集分别管理偏好；新安装默认关闭两种采集；用 `install --native-timing` 显式启用计时，或用 `install --live-metrics` 启用完整采集。现有有效的 padding、刷新间隔和 Vim 指示器选项保留；首次安装默认每秒刷新。

### 安装前预览

`claude-statusline install --dry-run` 只报告是否需要修改，不写入配置、资源或备份。

### 处理已有 statusline 或同名 skill

第三方状态栏设置或同名 skill 冲突会在写入前阻止安装。先检查具体冲突；确实要替换这些资源时才使用 `claude-statusline install --force`。Native 命令及插件身份冲突需要解决归属，不能强制接管。

保留第三方子代理 renderer 时，先运行 `claude-statusline config set subagent-statusline off`，再运行普通 `install`。安装参数与归属规则见 [CLI 参考](reference/cli.zh-CN.md#安装与诊断)。

### macOS 安装与验证边界

macOS 使用相同 npm 包和安装流程，包内包含 Intel 与 Apple Silicon 原生依赖。外部桌面启动器支持 Terminal.app，有可用 tmux 时优先使用 popup。SSH 或无图形桌面的会话使用终端编辑器或 CLI。

当前示例见[使用演示](SHOWCASE.zh-CN.md)，[图片索引](images/README.zh-CN.md)按软件包与平台区分当前及历史捕获。已有会话内 Client 输入限制与主栏、终端编辑器分别记录，见[焦点检查](#macos-鼠标报告与-client-焦点)。

## 选择配置入口

| 入口 | 适用场景 |
| --- | --- |
| `claude-statusline setup [--dry-run]` | [引导式显示预览与接入审核](SETUP.zh-CN.md) |
| `/statusline-configure-native` | [在当前 Claude 会话内配置](#原生配置编辑器) |
| `/statusline-configure` | [从 Claude 启动受支持的外部终端](#外部终端入口-statusline-configure) |
| `claude-statusline configure` | [直接在当前终端配置，包括 SSH](#独立交互式-tui) |
| `/statusline-config` | [使用 Claude 模型回合进行问答配置](#statusline-config-问答向导) |
| `claude-statusline config ...` | [精确设置或自动化配置](reference/cli.zh-CN.md#配置命令详解) |

各入口共享用户配置。两个编辑器同时打开时分别保留草稿，旧草稿无法覆盖已保存的新 revision。

## 语言与保存行为

| 设置 | 影响范围 | 保存时机 | 随显示草稿取消？ |
| --- | --- | --- | --- |
| 界面语言 | CLI、编辑器和向导提示 | 设置中立即保存；`--language` 仅覆盖当前调用 | 否 |
| 状态栏语言 | 内置输出标签、已知状态和样例 | 编辑器随显示保存；CLI 明确写入 | 是，仅限尚未保存的显示修改 |
| Claude 宿主偏好 | Claude 自身外观与行为 | 单独 Apply | 否 |

<a id="native-editor-preview"></a>

<a id="原生编辑器预览"></a>

<a id="会话内编辑器预览"></a>

<a id="v130a2外部-tui-与会话内-client"></a>

### 界面语言

语言代码为 `en`（英文）、`zh-CN`（简体中文）、`zh-TW`（繁体中文，台湾）、`zh-HK`（繁体中文，香港）、`ja`（日语）、`ko`（韩语）、`es`（西班牙语）、`fr`（法语）、`de`（德语）、`pt-BR`（巴西葡萄牙语）、`ru`（俄语）、`id`（印度尼西亚语）。语言由用户明确选择，不跟随系统区域设置；代码区分大小写，支持 `pt-BR`，`pt` 和 `pt-br` 不是别名；左右方向键按此顺序循环切换。旧 `zh-Hant` 参数及配置继续接受并映射到台湾；读取不改写文件，显式保存与导出使用 `zh-TW`。

成品运行范围为 `^22.0.0 || ^24.0.0`；源码开发与可复现发布构建仍固定 Node 24.21.0/npm 11.19.0。升级后重新运行 `claude-statusline install` 并重启 Claude Code，以更新编辑器协议 31 及配套资源。降级前通过当前软件包的恢复流程还原升级前的兼容显示备份；若旧版不支持所选语言，先将界面语言和状态栏语言设为英文，再恢复该备份。

CLI、终端编辑器和会话内 Client 默认英文。在设置页选择**界面语言（立即保存）** → **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어 / Español / Français / Deutsch / Português (Brasil) / Русский / Bahasa Indonesia**。两个编辑器与 CLI 共用此偏好，与 Claude 自身的主题和语言设置独立。

```text
claude-statusline config language show
claude-statusline config language show --json
claude-statusline config language set zh-CN
claude-statusline config language set en
claude-statusline config language reset
claude-statusline --language zh-CN configure
claude-statusline --language en config --help
```

前两行读取已保存偏好；`--json` 输出稳定的偏好对象。`reset` 保存英文。可选的 `--language` 放在子命令前，仅在当前调用中覆盖已保存偏好，不写入文件；使用该参数打开的编辑器仍可在设置页保存新的语言。独立配置目录示例：`claude-statusline config --config-dir /path/to/config language set zh-CN`。

切换立即保存，保留当前页面、选中字段、搜索、输入内容和显示草稿，重新计算终端布局并绘制翻译文字。保存／取消继续只控制显示修改；语言写入失败时保留上一次语言并显示错误。其他窗口在重开或执行现有重新加载操作时读取新偏好。任一语言下均可搜索稳定 ID、全部十二种语言的名称与说明，以及自定义标签。

偏好文件为 `<CLAUDE_CONFIG_DIR>/statusline-ui.json`，schema v1。缺失或无效偏好回退英文，读取不修复文件。显式 set/reset 会备份并修复损坏文件，但拒绝覆盖未来 schema。重装、升级、普通卸载、显示 reset、预设及可移植导入／导出均保留此独立偏好。

界面语言不改变实际状态栏样例／输出。模型名称、路径、分支、命令、ID、配置值和自定义标签保留原值。模型问答向导每次读取界面偏好，并使用 CLI 提供的翻译说明；机器可读目录保留英文基准元数据及稳定 ID。

### 状态栏语言

独立的显示选项默认 `en`。在任一编辑器选择**状态栏语言（随显示设置保存）**，选项始终为 **English / 简体中文 / 繁體中文（台灣） / 繁體中文（香港） / 日本語 / 한국어 / Español / Français / Deutsch / Português (Brasil) / Русский / Bahasa Indonesia**。预览立即采用草稿语言；保存时与其他显示设置一起持久化，取消则放弃修改。实际输出在下次刷新时生效，无需重启 Claude。

例如，界面使用西班牙语、输出使用巴西葡萄牙语。以下显式 CLI 写入分别保存两个设置：

<!-- docs-example: guide-language -->

```text
claude-statusline config language set es
claude-statusline config set statusline-language pt-BR
claude-statusline config show --json
```

同时控制主栏和全部自定义子代理行。翻译内置短语及已知生命周期／权限／强度／缓存／审核值；未知值、用户标签／图标、模型名称、路径、分支及任务／工具名称保留原文。数字、货币、`K/M`、`d/h/m/s`、`tok/s`、Git、PR 等技术单位保持原样。null 标签继承翻译后的默认标签，空标签隐藏标签，自定义标签优先。

`statusline_language` 属于显示 schema v17，参与 revision、预览及可移植导出。读取或导入历史 v1–v5 默认英文，不改写源文件；显式保存先备份再迁移。预设保留语言，完整导入采用文件语言；选择性导入仅在勾选显示语言时修改它，显示 reset 恢复英文。`--statusline-language` 仅是完整 `config apply` 调用中的可选参数；完整调用还需提供条目选择，并要求本工具接管已安装状态栏。省略该参数保留当前值。单独修改语言请使用 `claude-statusline config set statusline-language <代码>`（见 [状态栏语言参考](reference/cli.zh-CN.md#状态栏语言)）。界面偏好和运行观测继续独立。

降级到不支持所选语言的版本前，先运行 `config language reset` 和 `config set statusline-language en`，将两种语言恢复为英文，并重新安装匹配的原生资源。显示 schema 17 与界面偏好 schema 1 独立演进；编辑器协议 31 会拒绝新旧前后端混用。

<a id="常用配置配方"></a>

## 常用配置配方

`config set-items` 替换完整的启用集合；`config enable`／`config disable` 只增删单个条目，不改动其他条目。简单自动布局中重新启用原已禁用条目会追加到末尾；需要精确顺序时使用 `order` 或 `set-items`。

### 精简开发视图

<!-- docs-example: guide-recipes -->

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

<!-- docs-example: guide-context -->

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

<a id="恢复出厂显示配置但保留安装"></a>
<a id="reset-display-defaults-while-keeping-the-installation"></a>

### 恢复显示与宿主默认值但保留安装

`config reset` 恢复显示默认值；本工具接管安装时，还会把宿主 padding、刷新间隔和 Vim 指示器恢复为默认值。

```bash
claude-statusline config reset
claude-statusline config show
```

<a id="terminal-editor"></a>

## 终端编辑器

`claude-statusline configure` 与 `/statusline-configure` 打开相同的终端 TUI，共享配置、键位与保存行为。完整操作见[配置编辑器](EDITORS.zh-CN.md)。

<a id="独立交互式-tui"></a>

### 独立入口：`claude-statusline configure`

在 Claude Code 外的真实终端中运行：

```text
claude-statusline configure
```

Windows 使用 `claude-statusline.cmd configure`。要求当前 CLI 接管安装、配置有效、stdin/stdout 为 TTY，最低 64×18。Tab 切页、Space 勾选、Ctrl+E 编辑详情、Ctrl+S 保存；顶层 Esc 在有修改时确认是否放弃。详见[打开条件](EDITORS.zh-CN.md#open-an-editor)与[完整键位](EDITORS.zh-CN.md#keyboard-controls)。

<a id="外部终端入口-statusline-configure"></a>

### 外部入口：`/statusline-configure`

在 Claude Code 中无参数运行 `/statusline-configure`，需 2.1.258+ 和受支持的启动器。它与会话内入口独立启用，见[安装组合](#编辑器安装组合与兼容性)。保存、取消或错误会返回原会话中的简短结果；启动器及超时条件见[打开编辑器](EDITORS.zh-CN.md#open-an-editor)。启动失败时可直接在终端运行 `claude-statusline configure`。

<a id="external-tui-sections"></a>
<a id="外部-tui-的分组与页面层级"></a>

### 终端编辑器的分组与页面层级

内容和固定样例预览分区显示，底部提示随当前操作变化。详见[终端页面区域与底部提示](EDITORS.zh-CN.md#terminal-page-regions-and-footer)。

<a id="外部终端配色"></a>

### 终端编辑器配色

界面跟随终端默认前景／背景；预览采用所选显示调色板。详见[终端颜色](EDITORS.zh-CN.md#terminal-colors)与[颜色能力](APPEARANCE.zh-CN.md#terminal-color-capability)。

<a id="原生配置编辑器"></a>

## 会话内编辑器（Client）

`/statusline-configure-native` 在当前 Claude Code session 内打开 Client TUI，不另开终端。它与外部 `/statusline-configure` 共用配置、目录、catalog、互斥规则和原子保存服务，各自保留草稿。正式版默认启用两者；安装完成后在受信任终端重启 Claude Code。

### 打开、导航与编辑

```text
/statusline-configure-native
```

先点击 Client 正文再用键盘。Tab 切页、Space 勾选，S 保存继续、F 保存成功后关闭，Q 放弃显示草稿。Esc 由宿主管理，取消字段用 Ctrl+G。详见[打开条件](EDITORS.zh-CN.md#open-an-editor)与[完整键位](EDITORS.zh-CN.md#keyboard-controls)。

### 保存、冲突与恢复

保存拒绝旧 revision，冲突时保留草稿；保存结果不明时用 K 核对，不重复写入。Claude 偏好使用独立 Apply。详见[保存、取消与恢复](EDITORS.zh-CN.md#save-cancel-and-recover)。macOS Client 交互仍未验证，见[焦点检查](#macos-鼠标报告与-client-焦点)。

### 页面层级与分页

页面、字段分页和底部提示随面板尺寸及输入状态变化。详见[Client 分页与底部提示](EDITORS.zh-CN.md#client-pagination-and-footer)。

### 预览背景与颜色

Client 跟随 Claude 已应用主题，预览底色是独立界面偏好。详见[Client 预览底色](EDITORS.zh-CN.md#client-preview-background)。

### 编辑器安装组合与兼容性

没有已保存偏好时，`claude-statusline install` 默认启用两个入口。要明确选择组合：

| 安装组合 | 命令 |
| --- | --- |
| 两个入口 | `claude-statusline install --native-editor --experimental-slash-tui` |
| 仅会话内 Client | `claude-statusline install --native-editor --no-experimental-slash-tui` |
| 仅终端编辑器 | `claude-statusline install --no-native-editor --experimental-slash-tui` |
| 基础接入，不安装两个 TUI 入口 | `claude-statusline install --no-native-editor --no-experimental-slash-tui` |

Windows 使用 `claude-statusline.cmd`，或用 Node 调用安装后 JavaScript 入口的绝对路径。两组参数相互独立，`--experimental-slash-tui` 的历史名称继续保留。显式参数优先于已保存偏好，已保存偏好优先于默认值；用户在宿主中主动禁用的插件不会自动启用。

| Claude Code 版本 | 外部 `/statusline-configure` | 会话内 `/statusline-configure-native` |
| --- | --- | --- |
| 2.1.287+ | 默认启用 | 默认启用 |
| 2.1.258–2.1.286 | 默认启用 | 暂挂 |
| 更低或版本无法识别 | 暂挂 | 暂挂 |

表中默认仅适用于未明确关闭的入口。不兼容的入口不阻止基础安装或另一入口，显式启用也保留偏好并暂挂。升级或降级宿主后重新运行 `install` 和 `doctor`；支持恢复后按偏好重新接入，只有工具记录的暂挂才自动恢复。暂挂期间使用 `claude-statusline configure`、`claude-statusline config ...` 或 `/statusline-config` 向导；向导使用模型回合。

## `/statusline-config` 问答向导

无参数运行 `/statusline-config`，按问答选择主栏、子代理条目和显示选项。向导使用 Claude 模型回合，保留仍启用条目的相对顺序，将新条目追加到末尾；全部选择完成后调用一次原子 `config apply`，中途取消不保存。

下文的问答分页与保存前重读从软件包 v3.16.3 起适用。升级后重新运行 `claude-statusline install`，再重启 Claude Code 以加载匹配的技能。[v3.16.3 发布说明](releases/v3.16.3.zh-CN.md)

向导修改所选 Claude 配置目录中的用户默认配置。绑定命名方案的项目继续使用各自显示配置，宿主设置仍在该目录内共用。管理方案及项目绑定时，使用编辑器的目标选择器或终端 `config profile`／`config project` 命令。向导先读取已保存的界面语言、当前设置和两份条目目录，以当前值为起点，将较多选项拆成有界问答页，并在翻页时保留已有答案。某页的“本页全不选”仅清空该页条目，明确的“保留当前值”选项保留已保存值；取消或仍有未解决答案时不执行最终保存。

重复指标、text／spacer 实例、分组或主行对齐规则需要使用支持实例的编辑器，或明确的 instance／group／alignment 命令。向导在提问前检测这些结构，停止且不修改它们；接入尚未安装或其他工具拥有子代理 renderer 时也停止。向导表单以外的外观设置保持不变；当前主题及高级外观选项以命令帮助或编辑器为准。

保存前，向导重新读取显示、宿主及归属状态。若这些状态在问答期间变化，先检查变更，再重新运行向导。这是尽力而为的复核：最终 `config apply` 不接受修订号参数，因此读取与写入之间仍可能发生变化。

支持的带参数操作为 `show`、`list-items`、`set-items`、`enable`、`disable`、`order`、`subagents`、`set`、`apply`、`item`、`instance`、`group`、`alignment`、`layout`、`preset`、`import`、`export`、`language`、`reset`：

```text
/statusline-config set-items model-with-effort current-dir git context-remaining task-timer
/statusline-config show
```

在 2.1.258+ 且 hooks 启用时，由本地 hook 执行以上操作，不进入模型回合；旧版、未知版本或 hook 被禁用时，通过 skill 使用模型回合。slash 与终端 CLI 共用这些操作的解析，包括受支持的 dry-run 和结构审阅参数。`profile`／`project` 管理仍使用终端 CLI 或编辑器；slash 不接受任意终端命令，也不接受前置 `--config-dir`。详见 [slash 执行范围](reference/cli.zh-CN.md#slash-命令支持范围)。

配置本工具请使用本工具的命令；Claude 内建 `/statusline` 可能将 `statusLine.command` 替换为其他实现。

<a id="item-discovery-import-review"></a>

<a id="查找项目与审阅导入"></a>

## 查找显示项与审阅导入

Main/Subagents 用 `/` 搜索、Ctrl+F 选择分类、Ctrl+E 查看逐项详情。筛选时可勾选或设置格式，排序需先清除筛选。完整搜索规则与只读条件说明见[查找显示项](EDITORS.zh-CN.md#find-items-and-inspect-requirements)。

Settings 导入先与未保存草稿比较，A 仅接受到草稿，随后单独保存。取消保留原草稿；详见[导入审阅与导出](EDITORS.zh-CN.md#presets-import-review-and-export)。CLI 导入的安装前提与预演示例见[预设与可移植配置](#预设与可移植配置)。

## 组件组合

Main 和 Subagents 显示已配置实例；会话内 A／终端编辑器 Ctrl+A 打开组件目录，会话内 D／终端编辑器 Ctrl+D 复制，会话内 X／终端编辑器 Ctrl+X 移除。每个副本独立设置格式、颜色和显示条件。文本与弹性留白用于符号及左右布局，默认显示不变。详见[组件与布局](COMPOSITION.zh-CN.md)，包含完整快捷键、实例 CLI、迁移与降级恢复。

<a id="formatting-layout-presets"></a>

<a id="格式布局与预设v160"></a>

## 格式、布局与预设

默认设置保留现有外观。使用 Settings 统一设置格式，通过 Ctrl+E 表单覆盖单个条目，保存前检查 Preview。

Settings 可调整模型名、数字、标签、图标、剩余额度或使用比例、重置时间样式与风险颜色。完整值域与默认值见[显示选项参考](reference/cli.zh-CN.md#显示与宿主选项)。

阈值默认关闭，warning-threshold 默认 70、critical-threshold 默认 90，警告必须低于严重阈值。

```bash
claude-statusline config set model-name short
claude-statusline config set number-format grouped
claude-statusline config set threshold-colors on
```

风险颜色默认关闭，警告 70%、严重 90%，始终按实际使用比例判断，包括显示剩余额度时。缺失观测保持不可用，零值保留，过期额度／重置数据隐藏。预设展开为普通可编辑配置，保留颜色、调色板、目录／分隔符风格、刷新选项及当前子代理启用状态。

<a id="显式布局与子-agent-显示条件"></a>

### 显式布局与子代理显示条件

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

六种原始预设及其布局汇总见[原有预设](SCHEMES.zh-CN.md#原有预设)。另有同时设置全局外观的[八套完整方案](SCHEMES.zh-CN.md)。展开后都可继续编辑，可选数据仍可能不可用。

预设改变显示草稿，不开启采集；保留输出／界面语言和宿主设置，重建逐项覆盖，保存前可继续编辑。

minimal/developer/monitoring/multi-agent 预设展开为可编辑草稿，使用模型简称与紧凑数字，保留颜色／调色板／目录样式和刷新选项，重建逐项覆盖，并按预设顺序分配递减的保留优先级。`--dry-run` 输出已验证草稿，不保存。导入接受可移植文件或兼容的仅显示配置文件；仅显示文件保留当前刷新选项。

实际的 `config preset` 与 `config import` 写入会随草稿保存宿主设置，因此要求本工具接管已安装状态栏；请先运行 `claude-statusline install`。`--dry-run` 与 `config export` 不需要归属。

<!-- docs-example: guide-preset-import -->

```bash
claude-statusline config preset developer --dry-run
claude-statusline config export statusline.json
claude-statusline config import statusline.json --dry-run
```

`install` 建立归属后，省略 `--dry-run` 即可保存预设或导入：

```bash
claude-statusline config preset developer
claude-statusline config import statusline.json
```

可移植文件用于共享显示设置及工具管理的 padding／刷新／Vim 选项，不含安装、运行状态、接入偏好和 Claude 外观及行为偏好。先导出到独立文件，用 `--dry-run` 校验导入，再执行导入；已有导出文件需 CLI 明确传入 `--overwrite` 才能替换。详见[传输格式、校验及受保护目标](reference/cli.zh-CN.md#portable-import-export)。

保存进行中或结果未知时，两个编辑器都会阻止草稿修改，包括已经打开的来源／方案管理器。终端编辑器的 Ctrl+K、会话内编辑器的 K 只读核对已提交快照，不重复保存；确定结果后恢复编辑，冲突保留草稿。来源只读检查仍可使用。参见[保存与恢复](development/correctness-maintenance.zh-CN.md#共享草稿保护fix-01)。

### 两种编辑器中的格式与布局操作

Main/Subagents 用 Ctrl+E 设置逐项格式，Layout 设置自动／显式分行及行边界。完整操作见[格式与布局](EDITORS.zh-CN.md#formats-and-layouts)，组件、分组和对齐规则见[组件与布局](COMPOSITION.zh-CN.md)。保存、取消和结果核对见[保存与恢复](EDITORS.zh-CN.md#save-cancel-and-recover)。

### Claude 宿主偏好独立应用

Client Settings 用 H 展开 Claude 偏好，A 独立 Apply；显示 Save/Finish 不隐式应用这些偏好。详见[Claude 偏好独立应用](EDITORS.zh-CN.md#claude-preferences-apply-separately)。

<a id="phase-5-预览安装"></a>
<a id="phase-5-正式版安装"></a>

<a id="quick-setup-and-explanation"></a>

## 快速配置、文本编辑与说明

### 快速配置

在 `/statusline-configure-native` 或 `claude-statusline configure` 中按 **Ctrl+P**，或在设置页选择“快速配置”。选择、预览、保存或取消候选的步骤见[方案指南](SCHEMES.zh-CN.md#editor-quick-setup)。

### 文本输入

Enter 接受字段，Ctrl+G 取消；Client 的 Esc 由宿主管理。光标编辑、长度限制和粘贴注意事项见[文本输入](EDITORS.zh-CN.md#text-input)。

### 示例说明

Ctrl+E 后选择“配置与示例说明”，查看草稿设置如何影响固定样例；它不读取真实会话或启用采集。详见[样例预览与说明](EDITORS.zh-CN.md#sample-preview-and-colors)。

## Unicode 文本与终端列宽

换行、截断和文本删除保留完整字素，实际字形取决于终端和字体。详细列宽与截断规则见[组件与布局](COMPOSITION.zh-CN.md#unicode-text-and-terminal-widths)。

## 设置与配置文件

### 显示与宿主选项

通过 Settings 或 `config set OPTION VALUE` 调整外观、目录、分隔符、作用域标签、刷新和子代理可见性。宿主选项 `padding`、`refresh-interval`、`hide-vim-mode-indicator` 要求当前接入归属本工具。完整值域与默认值见[选项参考](reference/cli.zh-CN.md#显示与宿主选项)。

`refresh-interval event` 只随 Claude 事件刷新，运行中的计时器不会逐秒变化。使用 `claude-statusline config set refresh-interval 1` 恢复持续刷新。

### 配置文件

使用 CLI 或编辑器修改当前配置。显示设置和会话内 Client 偏好分别存放在 `claude-statusline.json` 和 `claude-statusline-native.json` 等文件。路径、格式及完整文件清单见[配置参考](reference/cli.zh-CN.md#配置文件)。恢复旧文件前查看[版本兼容步骤](#版本兼容)。

### 自定义配置目录与环境变量

管理命令使用 `--config-dir`；对于 `config`，该参数位于操作前：

```text
claude-statusline config --config-dir /path/to/claude-config show
claude-statusline configure --config-dir /path/to/claude-config
```

显式目录优先于 `CLAUDE_CONFIG_DIR`，最后使用默认 `~/.claude`。启动 Claude Code 和管理接入时使用同一目录。[环境变量及 shell 示例](reference/cli.zh-CN.md#自定义配置目录与环境变量)。

## 理解显示数据

### 可配置显示项

查询受支持的 ID 和当前启用状态：

```text
claude-statusline config list-items
claude-statusline config subagents list-items
```

在编辑器中选择条目或按 ID 启用。下表列出常用的可选主栏条目。

| 分组 | 可选 ID |
| --- | --- |
| 身份与会话 | `project-name`、`hostname`、`version`、`session`、`agent` |
| 运行模式 | `fast-mode`、`thinking`、`vim-mode` |
| 仓库 | `pr`、`repo`、`worktree` |
| 上下文与用量 | `context-used`、`cost`、`prompt-cache` |

完整目录、宿主要求和缺值处理见[常用可选主栏条目](DISPLAY_ITEMS.zh-CN.md#常用可选主栏条目)、[主栏显示项](DISPLAY_ITEMS.zh-CN.md#主栏显示项)和[子代理显示项](DISPLAY_ITEMS.zh-CN.md#子-agent-显示项)。脚本查询见[目录命令](reference/cli.zh-CN.md#可配置显示项)。

### 主状态栏显示含义

[Git 标记](DISPLAY_ITEMS.zh-CN.md#git-markers)与 [Token 字段](DISPLAY_ITEMS.zh-CN.md#token-fields)解释主栏各项含义。排查 `Git!` 时，见 [Git 故障排查](#git-信息缺失或显示-git)。

<a id="任务计时预览"></a>
<a id="任务计时"></a>
<a id="prompt-计时标记"></a>

#### 任务总耗时与执行耗时

`task-timer` 显示任务总耗时，`task-active-timer` 显示执行耗时。详见[计时定义、标记与可用性](DISPLAY_ITEMS.zh-CN.md#timer-definitions)。

如需显示执行耗时，在 Claude Code 2.1.289+ 上执行以下命令。

```text
claude-statusline install --native-timing
claude-statusline config enable task-active-timer
claude-statusline doctor
```

改变采集器接入后重启 Claude Code。执行耗时仍未显示时，先检查 `doctor` 的接入结果，再按[执行耗时的观测要求](DISPLAY_ITEMS.zh-CN.md#timer-definitions)核对覆盖情况。

<a id="子-agent-行与三种作用域"></a>

### 子代理行与三种作用域

子代理行显示单个任务。理解主栏和代理行上的同名字段时，见[显示作用域](DISPLAY_ITEMS.zh-CN.md#display-scopes)。行缺失或被第三方接管时，见[子代理行排查](#子-agent-行不显示或发生所有权冲突)。

### 可选实时状态

采集与显示选择是两个步骤。先启用独立采集器，再选择需要的字段：

```text
claude-statusline install --live-metrics
claude-statusline config enable run-state permission-mode active-agents task-progress last-tool
claude-statusline doctor
```

重启 Claude Code 加载采集器。其他采集条目为 `ttft`、`output-rate`、`prompt-input-tokens`、`prompt-output-tokens`、`prompt-cost`，通过任一编辑器或 `config enable` 选择。它们都不在默认启用集合中，实时采集需 Claude Code 2.1.289+，只启用编辑器不会开启采集。

`claude-statusline install --no-live-metrics` 保留原先同时关闭计时和高级采集的选择；加上 `--native-timing` 可保留计时元数据。普通重装保留已保存选择。缺失实时观测显示 `—`，有限覆盖或最近观测可附 `*`。采集口径和请求覆盖见[指标定义](DISPLAY_ITEMS.zh-CN.md#实时状态项)，采集问题见[运行诊断](development/live.zh-CN.md)。

`branch-diff` 是独立的默认未选中项，数据来自本地 Git，无需原生采集器。使用 `claude-statusline config enable branch-diff` 选择，再通过 `claude-statusline config set branch-diff-base auto` 或安全的本地 Git ref 设置已提交分支比较。它不包含未提交工作树修改，也不 fetch 远程，详见[分支与已结束代理定义](DISPLAY_ITEMS.zh-CN.md#分支基准与已结束代理)。

## `doctor` 诊断

```text
claude-statusline doctor
```

Doctor 检查平台与 Node、PATH、配置有效性、命令归属、hooks、编辑器偏好及资源、宿主兼容、启动条件、实时采集和状态目录写入能力。Skill 检查比较完整正文与当前内置模板，宿主检查校验 padding、刷新间隔及 Vim 指示器的类型／范围；运行目录用私有临时文件探测写入能力并立即清理。它不重写配置、不打开编辑器窗口；macOS 可检查父目录同步能力。诊断通过不另行证明 GUI 焦点或人工交互有效。

`[OK]` 表示通过，`[WARN]` 表示降级但仍可返回 0，存在 `[ERROR]` 时返回 1。接入过时先运行 `install`、再次 `doctor`，然后重启 Claude Code。归属冲突先检查具体目标，再决定是否使用 `--force`。

已有显示配置文件时，schema 检查报告程序支持的版本，当前为 `[OK] display config schema: v17`。有效旧文件改为提示，例如：

```text
[WARN] display config schema v4 is valid and will migrate to v17 on the next configuration save
```

此警告不会迁移文件：诊断与读取保留原字节，实际配置保存才备份并迁移。显示 schema 与配置协议 v31、运行协议 v3 分别管理版本。

## 故障排查

### 状态栏不显示

1. 运行 `claude-statusline doctor`。
2. 确认 `claude-statusline` 位于 PATH。
3. 确认没有通过 `config set-items` 把 `items` 设为空。
4. 查看 `settings.json` 中是否存在指向本工具的 `statusLine.command`。
5. 如果 Claude Code 提示 statusline 因 trust 被跳过，重启 Claude Code 并接受对应信任提示。
6. 检查是否启用了会统一禁用 hooks/statusline 的 Claude Code 设置。

<a id="子-agent-行不显示或发生所有权冲突"></a>

### 子代理行不显示或发生所有权冲突

先运行 `claude --version` 和 `claude-statusline doctor`。Claude Code 低于 2.1.205 或版本不可识别时，主栏可用但子代理设置/hooks 会暂挂；升级并重跑 `claude-statusline install`。如果 `doctor` 报告 `foreign`，选择其一：

<a id="明确接管第三方子-agent-行"></a>

```bash
# 明确接管第三方子代理行
claude-statusline install --force

# 保留第三方实现，只关闭本工具的自定义行目标
claude-statusline config set subagent-statusline off
claude-statusline install
```

若 `subagents.instances` 为空或 `subagents.enabled` 为 false，本工具的 renderer 会按协议返回空 content。进入子代理 transcript 后底部全局栏仍属于主代理/session，这是 Claude 未提供当前焦点 ID 的既定边界。

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
4. 保存冲突时草稿保留，确认后用 `R` 放弃草稿并重新加载。保存结果不明时用 `K` 核对，失败时使用 Retry／Close。
5. 版本或资源不匹配时，在同一 prefix 重装匹配的 npm 包。通过该入口运行 `claude-statusline install` 和 `claude-statusline doctor`，再重启 Claude Code。[安装已验证软件包](#离线安装)

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

macOS Terminal 路径要求本地图形会话、系统 Terminal.app、`/usr/bin/open` 和可用的进程启动标识。启动后 30 秒内没有握手会返回错误；先检查窗口是否打开，以及安装后的 Node 入口能否在该终端运行 `configure`。`doctor` 只检查条件，不打开窗口。SSH 中改用独立命令；Terminal 窗口在结束后仍保留时，按 Terminal 的窗口关闭偏好处理。

GNOME 路径要求 `DISPLAY` 或 `WAYLAND_DISPLAY`、可执行的 `gnome-terminal` 和可用的用户 D-Bus/图形会话。D-Bus 启动错误会作为短错误返回原 Claude 对话。Linux 两种启动器都不可用，或 macOS 没有有效 tmux 及本地 Terminal.app 条件时，直接在终端运行：

```bash
claude-statusline configure
```

Windows 使用系统默认终端承载 `CREATE_NEW_CONSOLE`。若关窗、子进程异常退出或未生成可信结果，原对话会立即收到错误；直接排查时在 PowerShell 中运行 `claude-statusline.cmd configure`。编辑器使用 Node raw TTY／VT 输入输出。检查已安装入口是否运行在真实控制台，以及 `doctor` 报告的资源、绑定和运行目录写入能力；当前不会输出已退役的 curses 诊断行。

若 hook 在 600 秒结束，TUI 通常应已在 570 秒自行超时。检查 `<CLAUDE_CONFIG_DIR>/statusline_runtime/slash_tui/` 时，不要手工跟随或删除不明符号链接；工具只自动清理超过 24 小时、符合自身命名前缀且不含符号链接的残留。

若启用了 `disableAllHooks`，本地启动器不会运行。本地拦截不可用时，回退 skill 会说明未能启动编辑器，建议在终端运行 `claude-statusline configure`（Windows 使用 `claude-statusline.cmd configure`）或使用 `/statusline-config`。它禁止通过 Bash／PowerShell 或其他模型工具启动终端界面；该例外可能产生一个极短模型回合。检查 hooks 设置后新开会话再试。

### 带参数的 slash 命令仍进入模型

这通常表示 Claude Code 版本低于 2.1.258、版本无法识别，或本地快捷 hook 未同步。检查：

```bash
claude --version
claude-statusline doctor
claude-statusline install
```

旧版由模型回合执行配置命令是预期的兼容行为，不会改变命令语义。

### 配置命令提示 statusLine 不属于本工具

`padding`、`refresh-interval`、`hide-vim-mode-indicator`、完整 `apply`，以及实际 `preset`／`import` 写入会保存 Claude Code 宿主设置。为保护其他 statusline，这些操作要求当前 `statusLine.command` 指向当前可执行文件；否则会报告未安装或归属其他工具。`config preset --dry-run` 和 `config import --dry-run` 仅预览，不写入；`config apply` 与 `config set` 不支持 `--dry-run`。

先检查：

```bash
claude-statusline config show
claude-statusline doctor
```

如果确实要让本工具接管 statusline，再运行 `claude-statusline install`。显示项、颜色、palette、目录和分隔符则可以在安装前配置。

### JSON 配置损坏

用户默认显示文件无效时，渲染先使用内建用户默认设置，之后仍可选择有效的项目 Profile；诊断和普通写命令会报告文件错误。以下操作恢复用户默认，保留 Profile 及项目绑定：

```bash
claude-statusline config reset
claude-statusline doctor
```

如需保留手工配置内容，先从最近的备份中恢复或修正 JSON，再运行 doctor。

### Git 信息缺失或显示 `Git!`

Linux、WSL 或 macOS 上用 `command -v git` 检查 PATH，PowerShell 中用 `Get-Command git`。非 Git 目录会省略工作树状态项。`Git!` 表示未取得工作树状态，也可能是采集策略拒绝。从项目目录运行 `claude-statusline doctor` 查看过滤器策略。[Git 采集策略](DIAGNOSTICS.zh-CN.md#git-采集策略)

停用渲染器的内置 Git 查询，需要关闭组合项、独立状态项和已提交分支比较。对于按类型配置的用户默认显示，执行以下命令。

```bash
claude-statusline config disable git git-branch git-changes git-ahead-behind branch-diff
```

如果项目选用了命名方案，或显示中有重复实例，在编辑器中选择对应目标并关闭上述条目的所有启用实例。

### Token 或计时器暂时不显示

这些条目依赖 Claude Code 提供的 session ID、transcript 路径和生命周期事件。在第一次真实模型响应前、特殊本地命令期间或 transcript 尚未产生时，暂时省略是正常行为。

若计时器存在但运行中数字不连续变化，检查是否使用了事件刷新：

```bash
claude-statusline config show
claude-statusline config set refresh-interval 1
```

### 输出在窄终端中换成多行

自动布局会按宽度折行；显式布局则按最大宽度截短并按优先级隐藏条目，不增加续行。增大终端宽度、使用 `compact` 分隔符、选择更短的目录样式，或隐藏次要条目可以减少换行。

### macOS 鼠标报告与 Client 焦点

macOS 上会话内 Client 可能打开但鼠标或键盘焦点不可靠；该问题仍未验证。主状态栏与终端编辑器仍可使用。见[验收记录](development/native.zh-CN.md#claude-code-21289-交互反馈)。

Terminal.app 用户可按以下步骤检查：

1. 在运行 Claude Code 的终端窗口中选择**显示 → 允许鼠标报告**（View → Allow Mouse Reporting），确认菜单项旁有勾号。Apple 说明新窗口默认勾选此项，因此应检查当前窗口的实际状态。见 [Apple 官方鼠标报告说明](https://support.apple.com/zh-cn/guide/terminal/trmlc69728a5/mac)。
2. 运行 `/statusline-configure-native`，用鼠标点击 **Client 正文区域**一次，再检查 Tab 是否切页、方向键是否移动选择、Space 是否勾选条目。若按键仍进入会话输入框，说明 Client 尚未获得焦点。Client 可以收键后，用 `Q` 丢弃测试修改并退出。
3. 若仍不能正常操作，记录 macOS 版本、终端名称与版本、`claude --version` 输出、是否经过 tmux 或 SSH，以及哪些点击或按键无效。运行 `claude-statusline doctor` 检查接入与后端绑定；诊断结果不代表鼠标事件或 Client 焦点已验证。排查期间可在独立终端运行 `claude-statusline configure`，或使用 `claude-statusline config ...` 配置。

**以上是检查建议，尚未在维护者反馈的 macOS 环境验证有效。** Apple 说明“允许鼠标报告”只允许事件传递给应用，应用本身还须启用鼠标报告；仅勾选菜单不能启用应用的鼠标报告行为，也不保证 Client 获得焦点。Apple 还列出 Command+R 为[切换此选项的快捷键](https://support.apple.com/zh-cn/guide/terminal/trmlshtcts/mac)，使用后应确认菜单实际状态。

若使用 **iTerm2**，检查 **Settings → Profiles → Terminal → Enable mouse reporting** 和 **Report mouse clicks & drags**；后者需允许点击传递给应用，才能检查点击聚焦。按住 Option 会临时绕过鼠标报告，测试时应直接点击。见 [iTerm2 官方终端配置说明](https://iterm2.com/documentation-preferences-profiles-terminal.html)。这些 iTerm2 检查项同样尚未针对维护者反馈的问题验证。

## 退出码

管理命令通常成功返回 0，参数、配置或归属错误返回 2；`doctor` 错误及受阻的设置检查返回 1。详见[各命令的退出码参考](reference/cli.zh-CN.md#退出码)。TUI 中断使用 130 或 `128 + signal`，恢复终端且不保存草稿。

## 当前边界

- 配置和项目绑定保存在用户目录。[项目绑定](PROFILES.zh-CN.md)可选择命名显示方案，仓库文件不提供可执行配置；不提供拖放或自定义快捷键。
- macOS 会话内 Client 交互问题仍有记录，可使用终端编辑器或 CLI。
- 外部桌面启动器支持列明的平台终端；其他终端可使用独立 `configure` 或 tmux。IDE、print 模式、Web 会话和全局禁用 hooks 不保证能打开终端编辑器。
- 可选实时字段需独立采集和有效观测，不推定缺失测量或当前焦点代理。
- 子代理行提供当前任务字段，不提供历史账本、逐代理 Git、缓存或会话聚合。
- 完成判定要求确认结束证据、代理任务与报告已处理、主代理收尾完成；超时或心跳过期不会推定完成。详见[计时定义](DISPLAY_ITEMS.zh-CN.md#timer-definitions)。
- 状态栏输出使用所选显示配色；会话内编辑器的文字和控件跟随 Claude 已应用主题。

## 升级

### 审核包变更

在任一编辑器中打开 **设置 → 版本与安装**，或用 `claude-statusline update --check` 开始 CLI 元数据审核。软件包回退和配置还原分别审核。[升级、回退与恢复步骤](PACKAGE_MANAGEMENT.zh-CN.md)

### 手动 npm 替换

使用相同的全局或显式 prefix，按[npm 安装](#安装-npm-包)或[离线安装](#离线安装)步骤安装所需版本，再同步接入。

### 同步 Claude Code 接入

```text
claude-statusline --version
claude-statusline install
claude-statusline doctor
claude-statusline config show
```

随后重启 Claude Code。安装器同步命令路径、skill 模板、hooks、插件和兼容设置，保留显示配置、独立偏好、缓存与任务状态。历史外部入口关闭操作可能删除偏好文件；缺失偏好时，如需继续关闭该入口，应明确传入 `--no-experimental-slash-tui`。

### 版本兼容

显示 schema 17 使用实例 ID 记录顺序和行边界。读取兼容的旧格式时在内存转换，实际保存或安装执行迁移前会备份原字节。使用匹配的编辑器资源和后端，切换版本前核对目标包支持的格式与条目。[配置格式](reference/cli.zh-CN.md#配置文件) · [组合迁移与恢复](COMPOSITION.zh-CN.md#迁移导入导出与恢复)

降级前使用新版关闭或移除旧版无法管理的接入，包括适用的实时采集和会话内编辑器。根据备份 `metadata.json` 恢复兼容显示文件，或在 schema 兼容时移除不支持的条目 ID。随后安装旧包、运行 `install` 和 `doctor`，并重启 Claude Code。可移植导出可另行保留当前显示选择，供以后恢复。

Claude 宿主版本跨过功能门槛时，各接入独立按偏好暂挂或恢复；明确关闭及宿主中主动禁用的插件保持关闭。历史变化见[变更记录](../CHANGELOG.zh-CN.md)。

<a id="迁移旧分发名称"></a>

### 从 Python 迁移

切换写入实现前停止活动 Claude 会话并备份配置目录。记录原 Python 命令的绝对路径和版本，保留其环境以便回退。选定正式版并按[离线安装步骤](#离线安装)核验同版附件。从准备长期保留的目录把已核验的 tgz 安装到独立 prefix，再用其 Node 入口。将 `VERSION` 替换为已核验版本。

```text
npm install --prefix ./statusline-node --offline --ignore-scripts "./fbincon-claude-code-statusline-VERSION.tgz"
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js --version
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js install --dry-run
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js install
node ./statusline-node/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js doctor
```

接入期间保留安装目录与 Node 可执行文件。隔离测试时给接入和检查命令传入相同的 `--config-dir`。接入保留已有显示、明确的采集和编辑器偏好及无关设置。未保存采集偏好时两种采集默认关闭。保留原 PATH 入口的归属，继续通过绝对 Node/JS 入口调用新的包。历史分发名见 [v2.0.0 指南](https://github.com/fbincon/claude-code-statusline/blob/v2.0.0/docs/USER_GUIDE.zh-CN.md)。

回退时停止 Claude，使用 Node 入口执行 `install --no-native-timing --no-live-metrics` 和 `uninstall`，从切换前的备份恢复兼容配置或原本不存在的状态。再用保留的 Python 入口执行 `install` 与 `doctor`，按原记录恢复 PATH。

## 卸载

在 CLI 仍可用时先移除接入：

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
npm uninstall --global @fbincon/claude-code-statusline
```

Windows 使用 `claude-statusline.cmd`，或用 Node 调用安装后 JavaScript 入口的绝对路径。卸载只移除归属本工具的命令、hooks、skills、插件和资源，第三方设置保留。显示文件、编辑器及实时偏好、缓存、任务状态和备份保留供重装复用。如需重装后继续关闭某项接入，先明确保存对应 `install --no-...` 偏好。

## 备份与回滚

安装、卸载和配置实际修改时，在以下目录创建备份：

```text
<CLAUDE_CONFIG_DIR>/backups/statusline/cli-<action>-<timestamp>/
```

`metadata.json` 记录操作、时间、原绝对路径及原文件是否存在。`.before` 保存修改前字节，`.absent` 表示目标原本不存在。手工回滚前退出受影响的 Claude 会话及编辑器，再将 `.before` 恢复到记录的目标，对 `absent` 目标恢复为不存在。事务失败会尝试回滚，备份继续保留。

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
