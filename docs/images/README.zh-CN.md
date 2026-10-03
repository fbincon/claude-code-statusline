# 界面截图

[English](README.md) | **简体中文**

截图在[项目首页](../../README.zh-CN.md#界面预览)展示。主状态栏图片来自实际 Claude 会话；配置页中的 `Preview (sample data)` 使用固定样例，Subagents 配置页的两条预览不代表真实并行 Agent 的验收结果。

## 文件索引

| 平台 | 主状态栏 | Main | Subagents | Settings |
| --- | --- | --- | --- | --- |
| Linux | [statusline.png](statusline.png) | [configure-main.png](configure-main.png) | [configure-subagents.png](configure-subagents.png) | [configure-settings.png](configure-settings.png) |
| macOS | [statusline-macos.png](statusline-macos.png) | [configure-main-macos.png](configure-main-macos.png) | [configure-subagents-macos.png](configure-subagents-macos.png) | [configure-settings-macos.png](configure-settings-macos.png) |
| Windows | [statusline-windows.png](statusline-windows.png) | [configure-main-windows.png](configure-main-windows.png) | [configure-subagents-windows.png](configure-subagents-windows.png) | [configure-settings-windows.png](configure-settings-windows.png) |

## 展示说明

Linux、macOS 与 Windows 均展示主状态栏和 Main、Subagents、Settings 三页配置界面。macOS / Windows 图片使用平台后缀，PNG 内容、尺寸和颜色保持原样。

macOS 图片展示 Terminal.app 中的界面，Windows 图片展示 Windows Terminal 中的界面。

截图展示各自终端的会话、布局和设置，显示项、调色板、字体与窗口宽度可能不同。

## 更新约定

- 使用 PNG 和小写英文文件名，平台图片使用 `-macos` / `-windows` 后缀。
- 保留可读的状态栏或配置页面，更新时同步首页引用和文件索引。
- 源码分发包通过 `MANIFEST.in` 收录本目录的 Markdown 和 PNG，CI 检查打包完整性。

## 原生编辑器画面

[Main](native-main-linux.png) · [Subagents](native-subagents-linux.png) · [Settings](native-settings-linux.png)

三张 PNG 来自真实 Linux x86_64 Claude Code 2.1.288、120 列终端的解码 cells，使用官方持久插件接入及后端 1.2.0a1，干净代码提交 `db4129b75dcc3aa20fc24bbb09946e249038ee2e`（2026-10-04）。`tools/render_native_capture.py` 裁掉会话区和输入框，用文档字体及默认颜色绘制原始文本和属性；它们是终端画面重建，不是操作系统逐像素截图或构造的 mockup。PNG 内嵌提交和原始画面 SHA256。

状态行数值为生产样例预览。Settings 下方内容通过宿主滚动/Tab 查看。画面及 120/80 列自动保存取消检查不表示真人验收通过，私有 cells/debug 在忽略的 `dist/validation/phase2-editor-pty-fixed`。上面的 macOS/Windows 图片是兼容 TUI；未提供其原生截图，维护者已另行确认 Windows 11、macOS 14.5 真人结果。
