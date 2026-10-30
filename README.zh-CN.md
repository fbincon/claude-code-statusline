# Claude Code Statusline

[English](README.md) | **简体中文**

[![CI](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/fbincon/claude-code-statusline/actions/workflows/ci.yml)
[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline) · [MIT License](LICENSE)

适用于 Linux、WSL、Windows 和 macOS 的可配置 Claude Code 状态栏。一眼查看模型与推理强度、项目、Git、上下文、用量和任务计时；通过会话内编辑器、终端编辑器或 CLI 配置主栏与独立的子代理行。

[使用演示](docs/SHOWCASE.zh-CN.md) · [快速安装](#快速安装) · [常用配置](#常用配置) · [使用指南](docs/USER_GUIDE.zh-CN.md) · [故障排查](docs/USER_GUIDE.zh-CN.md#故障排查)

<a id="v161外部-tui-栏目层级"></a>
<a id="正式-v150-的-phase-4-功能"></a>
<a id="正式-v160-的-phase-5-功能"></a>

## 功能概览

- **选择所需信息：** 65 个主栏指标、15 个子代理指标，以及文本和弹性留白；可跨十二种语言搜索名称、ID 与说明。[指标定义](docs/DISPLAY_ITEMS.zh-CN.md)。
- **组合清晰布局：** 独立组件副本、联动分组、显式行、左右布局、条件显示、颜色、渐变和自适应百分比指标。[组件与布局](docs/COMPOSITION.zh-CN.md) · [外观](docs/APPEARANCE.zh-CN.md)。
- **从方案开始：** 八套完整显示方案与六种原有预设均可继续编辑；支持命名方案、项目绑定及选择性样式／整组复用。[完整方案](docs/SCHEMES.zh-CN.md) · [项目绑定](docs/PROFILES.zh-CN.md)。
- **先审阅再保存：** 样例场景、宽度预览、导入差异、共享撤销／重做和当前文件比较帮助核对草稿。[草稿历史与复用](docs/DRAFT_HISTORY.zh-CN.md)。
- **跟踪任务和代理：** 区分会话与单代理指标，任务计时覆盖子代理工作及主代理收尾，并提供可搜索的任务证据查看器。[任务详情](docs/TASK_DETAILS.zh-CN.md)。
- **接入明确的数据源：** 本地 JSON、GitHub 检查与命令值，分别审阅启用、刷新及可选链接。[扩展指南](docs/EXTENSIONS.zh-CN.md)。
- **分别选择界面与输出语言：** English、简体中文、繁體中文（台灣）、繁體中文（香港）、日本語、한국어、Español、Français、Deutsch、Português (Brasil)、Русский 和 Bahasa Indonesia。
- **诊断与恢复：** 检查明确提供的输入、审阅软件包变更，并显式恢复兼容配置备份。[输入诊断](docs/DIAGNOSTICS.zh-CN.md) · [版本管理](docs/PACKAGE_MANAGEMENT.zh-CN.md)。

渲染读取 Claude Code 输入和本地状态，不发网络请求或使用模型 token。可选来源刷新单独执行；问答向导使用 Claude 模型回合。缺失观测不会被当作零。

## 界面预览

[完整使用演示](docs/SHOWCASE.zh-CN.md)将场景配置与设置、编辑、任务、来源及版本审阅步骤配对。视觉基线使用经典分隔符和柔和明亮的前景渐变，不使用 Powerline。同一组件在主栏和子代理行保持相同配色；浅色场景采用同色相的深色版本。每份素材的软件包、输入和捕获类型见[演示图片索引](docs/images/showcase/README.zh-CN.md)，固定样例与已记录任务观测分别标明。

![使用经典分隔符和不同前景渐变的日常开发状态栏](docs/images/showcase/zh-CN/daily.png)

![包含彩色状态栏预览与变更审阅的配置流程](docs/images/showcase/zh-CN/configure.gif)

动图先复制一个指标，再演示撤销、重做、保存和重新打开。重复项仅用于这段练习，完成后恢复原始日常场景。

### 会话内 TUI

在 Claude Code 中运行 `/statusline-configure-native`，先单击 Client 区域再使用键盘。[编辑流程](docs/USER_GUIDE.zh-CN.md#原生配置编辑器)。

### 外部 TUI

在终端运行 `claude-statusline configure`，或在 Claude Code 中运行 `/statusline-configure` 打开受支持的外部终端。[终端流程](docs/USER_GUIDE.zh-CN.md#独立交互式-tui)。

[当前与历史图片](docs/images/README.zh-CN.md)保留各自原始来源。历史跨平台截图不代表较新软件包已经验收；[issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)原有六项缺口仍未验证。

## 支持范围

| 平台 | 支持环境 |
| --- | --- |
| Linux / WSL | Node 22.x 或 24.x，x64 |
| Windows 10/11 | Node 22.x 或 24.x，x64 |
| macOS 14+ | Node 22.x 或 24.x，Intel / Apple Silicon |

Windows ARM 设备使用模拟 x64 Node；原生 Windows ARM64 与 32 位运行时不在支持范围。Git 字段需要 Git。Claude Code 条件按功能区分：子代理行 2.1.205+，本地 slash 参数／外部入口 2.1.258+，会话内编辑器 2.1.287+，原生计时／实时指标 2.1.289+。[运行要求与限制](docs/USER_GUIDE.zh-CN.md#运行要求)。

<a id="从-release-安装推荐"></a>
<a id="从固定标签源码安装"></a>
<a id="从当前源码安装"></a>

## 快速安装

准备 Node 22.x 或 24.x、npm 和 Claude Code CLI。安装包包含受支持的原生依赖，无需 Python 或编译器。

### 安装软件包

交互终端中的 `npx @fbincon/claude-code-statusline` 会先审阅持久安装，再打开设置向导。也可以明确安装软件包：

```text
npm install --global --ignore-scripts @fbincon/claude-code-statusline
```

### 接入 Claude Code

确认 npm 命令目录位于 PATH 后运行：

```text
claude-statusline --version
claude-statusline setup --dry-run
claude-statusline setup
claude-statusline doctor
```

Windows 使用 `claude-statusline.cmd`，或用 Node 调用安装后的 JavaScript 入口。接入后在受信任终端重启 Claude Code。软件包安装、显示保存与 Claude 接入是不同阶段；后续阶段失败时，向导会报告已完成部分。

兼容宿主上两个编辑器默认启用，并保留已保存选择。原生计时和高级实时指标需明确启用。参见[首次设置](docs/SETUP.zh-CN.md)、[离线／固定版本安装](docs/USER_GUIDE.zh-CN.md#安装与接入)、[冲突处理](docs/USER_GUIDE.zh-CN.md#处理已有-statusline-或同名-skill)和 [Python 迁移](docs/USER_GUIDE.zh-CN.md#从-python-迁移)。

## 常用配置

| 入口 | 用途 |
| --- | --- |
| `/statusline-configure-native` | 在当前 Claude 会话内编辑 |
| `/statusline-configure` | 在受支持的外部终端启动编辑器 |
| `claude-statusline configure` | 在当前终端编辑，包括 SSH |
| `/statusline-config` | Claude 问答向导；受支持的带参数命令在本地执行 |
| `claude-statusline config ...` | 检查设置或通过脚本指定准确值 |

在任一编辑器按 **Ctrl+P** 打开快速配置，选择方案、检查要求并预览草稿。保存应用到当前显示的用户／方案／项目目标；取消放弃待保存的显示修改。[操作演示与可复用场景](docs/SHOWCASE.zh-CN.md) · [全部方案](docs/SCHEMES.zh-CN.md)。

<a id="v130a2外部-tui-与会话内-client"></a>

### 界面语言

设置共享界面偏好，或仅覆盖本次调用：

```text
claude-statusline config language set zh-CN
claude-statusline --language en configure
```

界面语言立即保存，取消显示修改后仍保留。[语言选项](docs/USER_GUIDE.zh-CN.md#界面语言)。

### 状态栏语言

单独设置输出语言：

```text
claude-statusline config set statusline-language zh-CN
```

在编辑器中，该选择先影响预览，保存显示后才影响实际主栏／子代理输出。技术 ID、路径及自定义文本保留原值。[输出语言](docs/USER_GUIDE.zh-CN.md#状态栏语言)。

### 原生配置编辑器

先单击 Client 区域。Tab 切页，Space 启停，Ctrl+E 打开组件详情，`/` 搜索，Ctrl+F 切换分类。`S` 保存并停留，`F` 保存并关闭，`Q` 放弃草稿；Ctrl+G 取消字段输入。[操作与恢复](docs/USER_GUIDE.zh-CN.md#原生配置编辑器)。

### 外部与独立终端 TUI

Tab 切页，Space 启停，完成字段输入后用 Ctrl+S 保存。Esc 先取消字段输入，再取消编辑器；Ctrl+C 中断且不保存。最小尺寸为 64×18。[操作与终端启动器](docs/USER_GUIDE.zh-CN.md#独立交互式-tui)。

从内置方案开始，使用经典分隔符：

```text
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set separator-style classic
```

应用前先审阅：预设会替换显示选择与布局。[配置配方](docs/USER_GUIDE.zh-CN.md#常用配置配方) · [CLI 参考](docs/reference/cli.zh-CN.md)。

<a id="升级到-v161"></a>

## 升级与卸载

审阅并执行软件包变更，然后重启 Claude Code：

```text
claude-statusline update --check
claude-statusline update
claude-statusline doctor
```

[版本管理](docs/PACKAGE_MANAGEMENT.zh-CN.md)说明精确版本、prefix、回退及独立的配置恢复。卸载软件包前先移除 Claude 接入：

```text
claude-statusline uninstall --dry-run
claude-statusline uninstall
npm uninstall --global @fbincon/claude-code-statusline
```

显示设置与备份保留。[卸载说明](docs/USER_GUIDE.zh-CN.md#卸载)。

## 项目结构

TypeScript workspace 分为纯规则（`packages/core`）、平台副作用（`packages/platform`）、应用服务（`packages/cli`）和终端编辑器（`packages/tui`）。`mods` 包含官方宿主接入，`tools` 包含生成、打包和验收工具，`archive/python` 保留冻结的历史实现。[架构](docs/development/architecture.zh-CN.md) · [开发环境](docs/development/README.zh-CN.md)。

## 文档与帮助

| 目标 | 入口 |
| --- | --- |
| 体验完整流程 | [使用演示](docs/SHOWCASE.zh-CN.md) · [首次设置](docs/SETUP.zh-CN.md) |
| 配置显示 | [使用指南](docs/USER_GUIDE.zh-CN.md) · [完整方案](docs/SCHEMES.zh-CN.md) · [外观](docs/APPEARANCE.zh-CN.md) · [布局](docs/COMPOSITION.zh-CN.md) |
| 复用设置 | [方案与项目](docs/PROFILES.zh-CN.md) · [草稿历史与复用](docs/DRAFT_HISTORY.zh-CN.md) |
| 理解数据 | [指标定义](docs/DISPLAY_ITEMS.zh-CN.md) · [任务详情](docs/TASK_DETAILS.zh-CN.md) · [扩展](docs/EXTENSIONS.zh-CN.md) |
| 排错或自动化 | [故障排查](docs/USER_GUIDE.zh-CN.md#故障排查) · [输入诊断](docs/DIAGNOSTICS.zh-CN.md) · [CLI 参考](docs/reference/cli.zh-CN.md) |
| 开发或核对证据 | [开发指南](docs/development/README.zh-CN.md) · [图片来源](docs/images/README.zh-CN.md) |
| 跟进计划或发布 | [路线图](docs/development/roadmap.zh-CN.md) · [开发计划](docs/development/development-plan.zh-CN.md) · [更新日志](CHANGELOG.zh-CN.md) |

[GitHub Issues](https://github.com/fbincon/claude-code-statusline/issues)接受可复现缺陷、问题及功能建议。请提供版本、步骤和相关诊断，并移除私人路径及会话内容。

## 贡献与安全

开发、翻译及反馈参见[贡献指南](CONTRIBUTING.zh-CN.md)。潜在漏洞通过[安全政策](SECURITY.zh-CN.md)私下报告。

## 许可证

[MIT License](LICENSE)，Copyright (c) 2026 [fbincon](https://github.com/fbincon)。

内置 Unicode 数据保留 [Unicode License v3](tools/unicode/UNICODE-LICENSE.txt) 和 [wcwidth MIT 声明](tools/unicode/WCWIDTH-LICENSE.txt)。
