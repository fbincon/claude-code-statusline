# Claude Code Statusline

[English](README.md) | **简体中文**

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[![Native Mod](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/native.yml)
[PyPI](https://pypi.org/project/fbincon-claude-code-statusline/)
[MIT License](LICENSE)

面向 Linux、WSL、Windows 和 macOS 的 Claude Code 状态栏，集中显示模型与思考强度（effort）、工作目录、Git、上下文、使用限额、token 和任务用时。主状态栏与子 Agent 独立行可通过会话内编辑器、终端交互界面（TUI）、问答向导或 CLI 配置。

[功能概览](#功能概览) · [界面预览](#界面预览) · [快速安装](#快速安装) · [常用配置](#常用配置) · [使用指南](docs/USER_GUIDE.zh-CN.md) · [故障排查](docs/USER_GUIDE.zh-CN.md#故障排查)

<a id="v161外部-tui-栏目层级"></a>
<a id="正式-v150-的-phase-4-功能"></a>
<a id="正式-v160-的-phase-5-功能"></a>

## 功能概览

- **自由组合状态栏：** 在两种编辑器中新增、复制和排列独立组件，插入纯文本及左右对齐留白。详见[组件组合指南](docs/COMPOSITION.zh-CN.md)。

- **条件显示与外观：** 隐藏确认的空闲／干净状态，设置用量阈值、逐项前景／背景色和主题，按需启用基础 [Powerline](docs/APPEARANCE.zh-CN.md)。
- **独立选择语言：** 界面和实际状态栏均支持 English / 简体中文 / 繁體中文 / 日本語 / 한국어；界面语言立即保存，状态栏语言随显示设置保存。 参见[多语言图像](docs/images/languages/README.zh-CN.md)。
- **查找显示项目：** 60 个主栏指标和 14 个子代理指标，以及文本与弹性留白组件，支持五种语言的分级搜索、分类筛选及来源／启用条件说明。
- **区分统计范围：** 提供会话累计 token、各子 Agent 任务行，以及包含排队、子 Agent 和主 Agent 收尾的任务总耗时；可选执行耗时排除已核实的用户等待。
- **调整显示样式：** 支持模型与数字格式、标签、内置图标、颜色、目录样式，以及带优先级和宽度限制的自动或显式分行。
- **保留完整字符：** 组合 emoji、组合字符和 CJK 文本在换行、裁切和预览中保持完整。
- **审阅配置改动：** 六种预设可展开编辑，支持可移植 JSON；导入时先查看差异和候选预览，再接受草稿并单独保存。
- **选择配置界面：** Main、Subagents、Settings、Layout 四页共享同一配置；Claude 外观及行为偏好使用独立 Apply 操作。
- **跟随 Claude 主题：** 会话内编辑器按实际主题显示文字、快捷键与选中行；样例预览在单独选择的浅色／深色底色上保留生产配色。
- **适配终端配色：**外部 TUI 文字与粗体快捷键使用终端默认色，预览在当前终端背景上显示所选配色。
- **按需开启实时指标：** 运行状态、代理数量、工具进度、请求用时和逐任务用量需主动启用；缺失数据和部分观测分别标记。

状态栏渲染读取 Claude Code 输入和本地状态，不自行发起网络请求或使用模型 token。问答向导使用 Claude 模型回合。数据来源与可用条件见[显示项与指标定义](docs/DISPLAY_ITEMS.zh-CN.md)。

## 界面预览

[组件实例、复制与左右布局图像](docs/images/composition/README.zh-CN.md)。

[搜索、分类、来源说明与导入审阅画面](docs/images/README.zh-CN.md#discovery-and-import-review)。


会话底部主状态栏显示实际数据，配置 Preview 使用固定样例。字体、颜色和宽度随终端设置变化。[图片来源与归档索引](docs/images/README.zh-CN.md)。

<details>
<summary>English / 简体中文配置界面</summary>

Linux 终端采集展示共享语言选项与中文界面。图片由真实 PTY 单元格重建，预览使用固定样例；[来源与完整四页](docs/images/README.zh-CN.md#双语终端采集)。

![英文原生语言选项](docs/images/tui/native/linux/languages/settings-en.png)

![简体中文原生语言选项](docs/images/tui/native/linux/languages/settings-zh-CN.png)

![简体中文外部语言选项](docs/images/tui/external/linux/languages/settings-zh-CN.png)

</details>

### 会话内 TUI

在当前 Claude Code 会话运行 `/statusline-configure-native`，先点击 Client 区域一次，再使用键盘。 界面跟随 Claude 主题，按终端深浅选择预览背景，并比较所选配色。[比较终端／主题组合](docs/development/native.zh-CN.md#终端背景预览)。

**Linux：Main 与主状态栏**

![Linux 会话内 TUI Main 页与实际主状态栏](docs/images/tui/native/linux/main.png)

<details>
<summary>Linux：Subagents、Settings、Layout</summary>

**Subagents：选择子 Agent 行的条目与顺序。**

![Linux 会话内 TUI Subagents 配置页与样例预览](docs/images/tui/native/linux/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![Linux 会话内 TUI Settings 配置页与样例预览](docs/images/tui/native/linux/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![Linux 会话内 TUI Layout 配置页与样例预览](docs/images/tui/native/linux/layout.png)

</details>

<details>
<summary>Linux：浅色和深色主题</summary>

较早的主题捕获采用深色预览，当前编辑器支持单独选择浅色／深色预览背景。图片根据实际终端单元格重建。[捕获来源](docs/images/README.zh-CN.md#主题终端捕获)。

![Linux 浅色主题原生编辑器](docs/images/tui/native/linux/themes/main-light.png)

![Linux 深色主题原生编辑器](docs/images/tui/native/linux/themes/main-dark.png)

</details>

<details>
<summary>Windows：Main、Subagents、Settings、Layout</summary>

**Main：选择主状态栏条目并调整顺序。**

![Windows 会话内 TUI Main 配置页与样例预览](docs/images/tui/native/windows/main.png)

**Subagents：选择子 Agent 行的条目与顺序。**

![Windows 会话内 TUI Subagents 配置页与样例预览](docs/images/tui/native/windows/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![Windows 会话内 TUI Settings 配置页与样例预览](docs/images/tui/native/windows/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![Windows 会话内 TUI Layout 配置页与样例预览](docs/images/tui/native/windows/layout.png)

</details>

<details>
<summary>macOS：Main</summary>

本批次仅提供 Main 截图。已有输入限制与检查建议见 [macOS 鼠标报告与 Client 焦点](docs/USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)。

**Main：选择主状态栏条目并调整顺序。**

![macOS 会话内 TUI Main 配置页与样例预览](docs/images/tui/native/macos/main.png)

</details>

### 外部 TUI

在 Claude Code 中运行 `/statusline-configure`，或在独立终端运行 `claude-statusline configure`。

<details>
<summary>Linux：浅色／深色背景与配色比较</summary>

预览使用当前终端背景和所选配色，`default` 显得过淡时可在 Settings 比较 `ansi`。图片为独立 GNOME 配置的终端输出重建，见[捕获来源](docs/images/README.zh-CN.md#外部终端配色捕获)。

**浅色背景，Palette: default**

![Linux 浅色终端与 default 配色](docs/images/tui/external/linux/themes/main-light.png)

**浅色背景，Palette: ansi**

![Linux 浅色终端与 ANSI 配色](docs/images/tui/external/linux/themes/main-light-ansi.png)

**深色背景，Palette: default**

![Linux 深色终端与 default 配色](docs/images/tui/external/linux/themes/main-dark.png)

</details>

<details>
<summary>Linux：Main、Subagents、Settings、Layout</summary>

**Main：选择主状态栏条目并调整顺序。**

![Linux 外部 TUI Main 配置页与样例预览](docs/images/tui/external/linux/main.png)

**Subagents：选择子 Agent 行的条目与顺序。**

![Linux 外部 TUI Subagents 配置页与样例预览](docs/images/tui/external/linux/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![Linux 外部 TUI Settings 配置页与样例预览](docs/images/tui/external/linux/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![Linux 外部 TUI Layout 配置页与样例预览](docs/images/tui/external/linux/layout.png)

</details>

<details>
<summary>Windows：Main、Subagents、Settings、Layout</summary>

**Main：选择主状态栏条目并调整顺序。**

![Windows 外部 TUI Main 配置页与样例预览](docs/images/tui/external/windows/main.png)

**Subagents：选择子 Agent 行的条目与顺序。**

![Windows 外部 TUI Subagents 配置页与样例预览](docs/images/tui/external/windows/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![Windows 外部 TUI Settings 配置页与样例预览](docs/images/tui/external/windows/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![Windows 外部 TUI Layout 配置页与样例预览](docs/images/tui/external/windows/layout.png)

</details>

<details>
<summary>macOS：Main、Subagents、Settings、Layout</summary>

**Main：选择主状态栏条目并调整顺序。**

![macOS 外部 TUI Main 配置页与样例预览](docs/images/tui/external/macos/main.png)

**Subagents：选择子 Agent 行的条目与顺序。**

![macOS 外部 TUI Subagents 配置页与样例预览](docs/images/tui/external/macos/subagents.png)

**Settings：调整外观、刷新行为和格式。**

![macOS 外部 TUI Settings 配置页与样例预览](docs/images/tui/external/macos/settings.png)

**Layout：设置分行、逐项优先级与最大宽度。**

![macOS 外部 TUI Layout 配置页与样例预览](docs/images/tui/external/macos/layout.png)

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
pipx install fbincon-claude-code-statusline
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

当前 main 的源码开发使用 Node 与 TypeScript，步骤见[源码开发指南](docs/development/README.zh-CN.md#从源码构建与安装)。已发布 Python 产品的固定标签和 Release wheel 安装见安装指南。

下载校验和平台步骤见[安装指南](docs/USER_GUIDE.zh-CN.md#安装与接入)，源码构建见[开发指南](docs/development/README.zh-CN.md#从源码构建与安装)。

</details>

## 常用配置

[查找项目、了解来源条件与审阅导入](docs/USER_GUIDE.zh-CN.md#item-discovery-import-review)。


| 入口 | 用途 |
| --- | --- |
| `/statusline-configure-native` | 当前会话内的 Client TUI，见[原生配置编辑器](docs/USER_GUIDE.zh-CN.md#原生配置编辑器) |
| `/statusline-configure` | 由受支持的外部终端承载 TUI，见[外部入口](docs/USER_GUIDE.zh-CN.md#外部终端入口-statusline-configure) |
| `claude-statusline configure` | 当前独立终端中的完整 TUI |
| `/statusline-config` | Claude 问答向导；支持的带参数命令在兼容宿主本地执行 |
| `claude-statusline config ...` | 检查配置、设置精确顺序或从脚本配置 |

<a id="v130a2外部-tui-与会话内-client"></a>

### 界面语言

两个编辑器的设置页均提供**界面语言（立即保存）**，选项始终显示 **English / 简体中文 / 繁體中文 / 日本語 / 한국어**；默认英文。切换保留当前页面、选中项、搜索与未保存显示修改，取消显示修改也保留语言选择。其他已打开窗口在重开或重新加载时读取新偏好。

```text
claude-statusline config language set ja
claude-statusline config language show
claude-statusline config language reset
claude-statusline --language en --help
```

`--language en|zh-CN|zh-Hant|ja|ko` 放在子命令前，只影响本次调用；用于 `configure` 时设置初始语言。命令、ID、配置值和自定义文字保持原值；界面语言不改变状态栏语言。详见[语言设置](docs/USER_GUIDE.zh-CN.md#界面语言)。

### 状态栏语言

在任一编辑器选择**状态栏语言（随显示设置保存）** → **English / 简体中文 / 繁體中文 / 日本語 / 한국어**。预览立即切换，保存后主状态栏与子代理行在下次刷新时生效，取消则放弃草稿。默认英文。

```text
claude-statusline config set statusline-language zh-Hant
claude-statusline config set statusline-language en
```

![英文状态栏输出](docs/images/statusline/linux/en.png)

![简体中文状态栏输出](docs/images/statusline/linux/zh-CN.png)

图片来自[固定输入的真实 CLI 终端采集](docs/images/README.zh-CN.md#状态栏语言采集)。

翻译内置标签和已知状态，保留技术单位、模型名称、分支、路径和自定义文字。详见[状态栏语言](docs/USER_GUIDE.zh-CN.md#状态栏语言)。

### 原生配置编辑器

先点击 Client 区域一次，再用 Tab 切页、Space 勾选、方向键选择或排序、Ctrl+E 打开逐项格式、`/` 搜索、Ctrl+F 分类筛选；筛选时暂不排序。`S` 保存留页，`F` 保存并退出，`Q` 丢弃未保存修改，小写字母同样有效。底部快捷键随页面或输入状态变化；Ctrl+G 取消输入。Claude 偏好使用独立 Apply 操作。

### 外部与独立终端 TUI

用 Tab 切页、Space 勾选、方向键选择或排序。完成字段输入后用 Ctrl+S 保存；项目页及原有设置行的 Enter 用于保存，高级字段的 Enter 用于编辑或确认输入。Esc 先取消输入，再取消编辑器；Ctrl+C 中断且不保存。最低终端尺寸为 64×18。

外部入口在 Linux 使用 tmux 或 GNOME Terminal，在 macOS 使用 tmux 或 Terminal.app，在 Windows 使用系统新控制台启动器。SSH 或启动器不可用时，在当前终端运行 `claude-statusline configure`。

定义精简主栏：

```text
claude-statusline config set-items model-with-effort current-dir git context-remaining task-timer
claude-statusline config set directory-style home
claude-statusline config show
```

配置按用户生效。`set-items` 替换启用集合，`enable`、`disable` 用于增量调整。更多操作见[配置配方](docs/USER_GUIDE.zh-CN.md#常用配置配方)、[格式与布局](docs/USER_GUIDE.zh-CN.md#formatting-layout-presets)和 [CLI 参考](docs/reference/cli.zh-CN.md)。

<a id="升级到-v161"></a>

## 升级与卸载

升级软件包并同步接入，然后重启 Claude Code：

```text
pipx upgrade fbincon-claude-code-statusline
claude-statusline install
claude-statusline doctor
```

本仓库已有 wheel 安装请先按[软件包名称迁移](docs/USER_GUIDE.zh-CN.md#迁移旧分发名称)操作。保留显示配置、运行状态和接入偏好。旧显示 schema 与软件包降级操作见[版本兼容](docs/USER_GUIDE.zh-CN.md#版本兼容)。

先移除 Claude 接入，再卸载软件包：

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
pipx uninstall fbincon-claude-code-statusline
```

显示配置与备份继续保留，详见[卸载](docs/USER_GUIDE.zh-CN.md#卸载)。

## 项目结构

```text
claude-code-statusline/
├── .github/workflows/
│   ├── ci.yml                    # 统一候选构建、八目标安装与十三主机组合
│   └── reference.yml             # 手动 Python 历史验证
├── packages/                     # 四个业务包
│   ├── core/src/                 # 配置、协议、纯状态、渲染与 Unicode
│   │   └── i18n/                 # 五种语言的生成模块；资源在 core/resources
│   ├── platform/src/             # 文件、锁、进程、时钟及终端适配
│   ├── cli/                      # 命令、集成、运行时与恢复
│   │   ├── src/                  # 安装与编辑器协议实现
│   │   └── resources/            # 两个配置技能模板
│   └── tui/src/                  # 独立终端编辑器
├── mods/
│   ├── statusline-native/        # 会话内编辑器：hooks、lib、ui、tests
│   └── statusline-runtime/       # 计时与可选实时指标
├── tests/fixtures/               # 共享契约、Unicode 与冻结参考数据
├── tools/
│   ├── generation/               # 共享资源生成
│   ├── checks/                   # 文档、归档及统一检查
│   ├── build/                    # 固定提交、通用离线包和摘要
│   ├── acceptance/               # 安装、Mod、终端、电源和显式预算验收
│   ├── benchmarks/               # 功能夹具与可选描述性测量
│   ├── release/                  # 候选证据与发布说明准备
│   ├── migration/                # 阶段台账、固定参考及兼容测试
│   ├── testing/                  # 仅开发使用的测试支持包
│   ├── typescript/               # 运行时约束与测试入口
│   └── unicode/                  # 固定数据、来源及许可证
├── archive/python/               # 冻结 Python 实现、测试、工具及旧发布工作流
├── docs/                         # 使用、开发、迁移和历史发布文档
│   ├── reference/                # CLI 与配置参考
│   ├── development/              # 架构、测试与阶段记录
│   ├── images/                   # 界面截图与历史归档
│   └── releases/                 # 历史发布说明
├── package.json / package-lock.json
├── tsconfig*.json / .node-version
├── README.md / README.zh-CN.md
├── CHANGELOG.md / CHANGELOG.zh-CN.md
└── LICENSE
```

## 文档与帮助

- [使用指南](docs/USER_GUIDE.zh-CN.md)：安装、编辑器、配方、升级与排障。
- [CLI 参考](docs/reference/cli.zh-CN.md)：命令、选项、字段、文件和退出码。
- [显示项与指标定义](docs/DISPLAY_ITEMS.zh-CN.md)：作用域、数据来源和可用条件。
- [开发指南](docs/development/README.zh-CN.md) · [发布流程](docs/RELEASING.zh-CN.md)。
- [变更记录](CHANGELOG.zh-CN.md) · [GitHub Releases](https://github.com/fbincon/claude-code-statusline/releases)。
- [GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues)：附版本、复现步骤与诊断结果，移除私有路径和会话内容。

## 许可证

[MIT License](LICENSE)，Copyright (c) 2026 [fbincon](https://github.com/fbincon)。

随包 Unicode 数据保留 [Unicode License v3](tools/unicode/UNICODE-LICENSE.txt) 与 [wcwidth MIT 声明](tools/unicode/WCWIDTH-LICENSE.txt)。
