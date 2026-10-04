# 界面截图

[English](README.md) | **简体中文**

截图在[项目首页](../../README.zh-CN.md#界面预览)展示。主状态栏图片来自实际 Claude 会话；配置页中的 `Preview (sample data)` 使用固定样例，Subagents 配置页的两条预览不代表真实并行 Agent 的验收结果。

## 文件索引

| 平台 | 主状态栏 | Main | Subagents | Settings |
| --- | --- | --- | --- | --- |
| Linux | [statusline.png](statusline.png) | [configure-main.png](configure-main.png) | [configure-subagents.png](configure-subagents.png) | [configure-settings.png](configure-settings.png) |
| macOS | [statusline-macos.png](statusline-macos.png) | [configure-main-macos.png](configure-main-macos.png) | [configure-subagents-macos.png](configure-subagents-macos.png) | [configure-settings-macos.png](configure-settings-macos.png) |
| Windows | [statusline-windows.png](statusline-windows.png) | [configure-main-windows.png](configure-main-windows.png) | [configure-subagents-windows.png](configure-subagents-windows.png) | [configure-settings-windows.png](configure-settings-windows.png) |

## 会话内 Client 截图

以下实际终端截图由维护者于 2026-10-04 提供，展示现有 Claude Code 会话内的 Client Main 配置页，以及对话区、输入区和主状态栏。三张截图均可见 Claude Code 2.1.289。未提供后端版本、源码提交、准确系统版本、架构和终端版本，相关信息保持未知。

| 平台 | 截图 | 尺寸 | 维护者交互反馈 |
| --- | --- | --- | --- |
| Linux | [client-session-linux.png](client-session-linux.png) | 1414×874 | 可以正常操作 |
| Windows | [client-session-windows.png](client-session-windows.png) | 1792×1202 | 可以正常操作 |
| macOS | [client-session-macos.png](client-session-macos.png) | 1347×892 | 面板可以打开；交互异常；有效配置尚未验证 |

原文件名依次为 `linux.png`、`windows.png` 和 `macOS.png`。保留 PNG 原始字节、尺寸和颜色，不裁剪或重绘；会话原文中的先前命令及连接消息同样保留。Client Preview 使用固定样例数据。截图用于展示布局，交互结论来自维护者另行反馈。macOS 检查建议见[使用指南](../USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)；本次反馈与历史验收分别记录在[原生编辑器开发说明](../development/native.zh-CN.md#claude-code-21289-交互反馈)。

## 展示说明

Linux、macOS 与 Windows 均展示主状态栏和 Main、Subagents、Settings 三页配置界面。macOS / Windows 图片使用平台后缀，PNG 内容、尺寸和颜色保持原样。

macOS 图片展示 Terminal.app 中的界面，Windows 图片展示 Windows Terminal 中的界面。

截图展示各自终端的会话、布局和设置，显示项、调色板、字体与窗口宽度可能不同。

## 更新约定

- 使用 PNG 和小写英文文件名，平台图片使用 `-macos` / `-windows` 后缀。
- 保留可读的状态栏或配置页面，更新时同步首页引用和文件索引。
- 源码分发包通过 `MANIFEST.in` 收录本目录的 Markdown 和 PNG，CI 检查打包完整性。

## 原生编辑器画面

### v1.3.0a1 预览画面

[Main](native-main-v1.3.0a1-linux.png) · [Subagents](native-subagents-v1.3.0a1-linux.png) · [Settings](native-settings-v1.3.0a1-linux.png)

三张 PNG 重建真实 Linux x86_64、Claude Code 2.1.288、后端 1.3.0a1、官方持久插件的解码 cells，干净源码提交为 `4cd97dd480aa0025fb9edc7644b872bf3fa6336b`（2026-10-04）。停靠终端尺寸 120×30，同一自动运行另检查 80×48 的内嵌操作。渲染器裁去会话/输入区并内嵌提交与原始画面哈希；数值为生产样例，是终端重建，不是 OS 逐像素截图或 mockup。原始来源仅留在忽略的 `dist/validation/native-usability-capture-288`。维护者随后确认 a1 三平台真人验收通过；a2 Client 真人验收单独记录。

### v1.2.0 画面

[Main](native-main-linux.png) · [Subagents](native-subagents-linux.png) · [Settings](native-settings-linux.png)

三张 PNG 来自真实 Linux x86_64 Claude Code 2.1.288、120 列终端的解码 cells，使用官方持久插件接入及后端 1.2.0a1，干净代码提交 `db4129b75dcc3aa20fc24bbb09946e249038ee2e`（2026-10-04）。`tools/render_native_capture.py` 裁掉会话区和输入框，用文档字体及默认颜色绘制原始文本和属性；它们是终端画面重建，不是操作系统逐像素截图或构造的 mockup。PNG 内嵌提交和原始画面 SHA256。

状态行数值为生产样例预览。Settings 下方内容通过宿主滚动/Tab 查看。画面及 120/80 列自动保存取消检查不表示真人验收通过，私有 cells/debug 在忽略的 `dist/validation/phase2-editor-pty-fixed`。`configure-*-macos.png` 与 `configure-*-windows.png` 是兼容 TUI 图片；该版本发布时未提供这两个平台的原生截图，维护者已另行确认 Windows 11、macOS 14.5 真人结果。

### v1.3.0a2 Client 画面

[Main](client-main-v1.3.0a2-linux.png) · [Subagents](client-subagents-v1.3.0a2-linux.png) · [Settings](client-settings-v1.3.0a2-linux.png)

三张 PNG 重建 Linux x86_64、Claude Code 2.1.288 交互宿主、后端 1.3.0a2 和持久安装 Mod 的真实终端 cells。固定源码提交 `2ed1f3ae306776caeffe6a27205a4d680cb8e472`，运行时资源与本次候选一致。120×30 PTY 使用私有 tmux server，另验证 80×48 内嵌布局。图片裁去会话、输入区和真实状态栏，Preview 为固定生产样例；不是 OS 像素截图或设计 mockup。图片内嵌提交与原始画面 SHA256，原始数据留在忽略的 `dist/validation/client-a2-fixed-288`。这些自动画面不计为真人验收。2026-10-04 维护者另行确认 a2 在 Linux、Windows、macOS 真人验收通过，未附终端/架构/宿主详细元数据。正式 v1.3.0 沿用其 Client 交互模块，仅更新版本/描述等元数据；图片保留 a2 文件名和原始来源。

### v1.5.0a1 Phase 4 终端重建画面

[逐项格式](client-format-v1.5.0a1-linux.png) · [Layout](client-layout-v1.5.0a1-linux.png) · [紧凑 Layout](client-layout-compact-v1.5.0a1-linux.png) · [预设预览](client-preset-v1.5.0a1-linux.png) · [Claude 偏好](client-preferences-v1.5.0a1-linux.png)

以上 PNG 来自已安装 v1.5.0a1 wheel、Mod 1.5.0-alpha.1、Claude Code 2.1.289 的真实终端单元格，环境为 Linux x86_64／Python 3.14.4。两种持久入口在 120×30／80×48 高级 PTY 中通过。捕获源为干净本地提交 `07804ba23f98396b1bbb67b795efd9ccf8e6fab3`；发布分支重定基后，公开候选 `e978411ab92b99b44cf99d42f8dfce9eba3cf415` 的源文件树完全一致（`ff77dc8b4b0fa3264b2344a38c98a1786b27e0ee`）。图片元数据保留原捕获提交／哈希；运行 Mod 指纹为 `06510b1cbfc9c28c175cb3fc3a2268cb312de93c5e3f128b3e4effa52158ab10`。

重建工具裁去对话／输入框／实时状态和私有路径，紧凑页使用明确的单元格裁剪范围，并保留 CJK 续列背景。Preview 为生产样例。代理检查确认格式／布局／宿主控件与中文可读；画面属于终端重建，不是系统像素截图或人工验收。原始记录仅保留在忽略的 `dist/validation/phase4/preview-candidate-r2-pty`。Linux／Windows Phase 4 及 macOS 可用入口人工验收待确认，macOS Client 输入问题继续保留。
