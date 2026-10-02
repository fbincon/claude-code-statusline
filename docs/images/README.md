# 界面截图

截图在[项目首页](../../README.md#界面预览)展示。主状态栏图片来自实际 Claude 会话；配置页中的 `Preview (sample data)` 使用固定样例，Subagents 配置页的两条预览不代表真实并行 Agent 的验收结果。

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
