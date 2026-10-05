# 界面截图

[English](README.md) | **简体中文**

本目录收录当前展示的 18 张截图：三张保留的主状态栏图、三张新会话内 Client 图和十二张新外部配置页。历史图片与捕获记录见[归档索引](archive/README.zh-CN.md)。

截图保持原始 PNG 字节、尺寸、颜色与元数据。主状态栏使用实际会话数据；配置界面的 `Preview (sample data)` 使用固定样例，不表示实际 token 用量或真实并行代理。

## 目录布局

```text
images/
├── statusline/{linux,macos,windows}.png
├── tui/native/{linux,macos,windows}/session.png
├── tui/external/{linux,macos,windows}/{main,subagents,settings,layout}.png
└── archive/
    ├── screenshots/{native,external}/{linux,macos,windows}/
    └── reconstructions/<source-version>/linux/
```

## 当前图片

| 平台 | 主状态栏 | 会话内 Client | Main | Subagents | Settings | Layout |
| --- | --- | --- | --- | --- | --- | --- |
| Linux | [PNG](statusline/linux.png) | [PNG](tui/native/linux/session.png) | [PNG](tui/external/linux/main.png) | [PNG](tui/external/linux/subagents.png) | [PNG](tui/external/linux/settings.png) | [PNG](tui/external/linux/layout.png) |
| macOS | [PNG](statusline/macos.png) | [PNG](tui/native/macos/session.png) | [PNG](tui/external/macos/main.png) | [PNG](tui/external/macos/subagents.png) | [PNG](tui/external/macos/settings.png) | [PNG](tui/external/macos/layout.png) |
| Windows | [PNG](statusline/windows.png) | [PNG](tui/native/windows/session.png) | [PNG](tui/external/windows/main.png) | [PNG](tui/external/windows/subagents.png) | [PNG](tui/external/windows/settings.png) | [PNG](tui/external/windows/layout.png) |

## 会话内 Client 截图

新截图由维护者提供，均可见 Claude Code 2.1.289；Linux 和 Windows 显示停靠面板，macOS 显示内嵌面板。截图中的对话、之前的命令结果和连接消息按原样保留。

已有反馈记录为：Linux、Windows Client 可以操作，macOS 面板可以打开但存在交互问题。新静态截图只更新布局展示，不另行证明保存、键盘焦点或交互问题已修复。检查方法见[使用指南](../USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)，历史反馈见[原生编辑器记录](../development/native.zh-CN.md#claude-code-21289-交互反馈)。

## 来源与摘要

新外部截图的原文件名记录日期为 2026-10-05，依次对应 Main、Subagents、Settings、Layout。macOS 图片展示 Terminal.app，Windows 图片展示 Windows Terminal；未提供准确系统、架构、终端版本或后端提交。保留的主状态栏图来自旧仓库，原记录未提供拍摄日期。

<details>
<summary>原文件名、目标路径、尺寸与 PNG SHA-256</summary>

| 原来源路径 | 仓库文件 | 尺寸 | PNG SHA-256 |
| --- | --- | --- | --- |
| 原仓库：`docs/images/statusline-macos.png` | [statusline/macos.png](statusline/macos.png) | 936×498 | `3c2c286af82268dbbf8e599c9ce236a75c7897eca9093a2d43eb48cfab04e3d8` |
| 原仓库：`docs/images/statusline-windows.png` | [statusline/windows.png](statusline/windows.png) | 1708×985 | `874efc5bfac0128e70c224c799eef4c441da21623d8bee8076c797e3c2993093` |
| 原仓库：`docs/images/statusline.png` | [statusline/linux.png](statusline/linux.png) | 1191×790 | `07d3a28c82e1b4fb099da5ac8a758c1fc1d1f3bbd712d85f812a7a3ad858d035` |
| 提供目录：`statusline-configure-native打开的内部TUI展示/Linux.png` | [tui/native/linux/session.png](tui/native/linux/session.png) | 1105×714 | `6e9b4974de7ae5c04b54d15a23bd53ecda6706a894f67c480db8fce293315f31` |
| 提供目录：`statusline-configure-native打开的内部TUI展示/Windows.png` | [tui/native/windows/session.png](tui/native/windows/session.png) | 1831×1197 | `9316798d77190af04031dc84cba3788aee517674cad184623621180c9b59a6ae` |
| 提供目录：`statusline-configure-native打开的内部TUI展示/macOS.png` | [tui/native/macos/session.png](tui/native/macos/session.png) | 1161×933 | `610a1908dc7596bea234eec6171082628792c345818b54dbb5fa00a4d88c658b` |
| 提供目录：`statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-20.png` | [tui/external/linux/main.png](tui/external/linux/main.png) | 1110×757 | `10d8ed857c17e4bb22ebebbd2b5e4bc95a79358f728306722baec170695c607f` |
| 提供目录：`statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-27.png` | [tui/external/linux/subagents.png](tui/external/linux/subagents.png) | 1110×757 | `5f55a2d58fa635dbfd127b6c5ddebd9f938e4949325f88cd25374d3e9edb3779` |
| 提供目录：`statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-39.png` | [tui/external/linux/settings.png](tui/external/linux/settings.png) | 1110×757 | `c4bf0164906dcfaf85052705c32be32ed570b4bfa6367a254598c26556162a4d` |
| 提供目录：`statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-45.png` | [tui/external/linux/layout.png](tui/external/linux/layout.png) | 1110×757 | `740fb59a8c98f81367639425cb2e59ed46cd24107c5a7eb8b2f9ac15cbb8956d` |
| 提供目录：`statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 174922.png` | [tui/external/windows/main.png](tui/external/windows/main.png) | 1826×1193 | `443fb7fbe8df82bb221f9fc878e2061f98ec04a551fb2c24785017a021d566f0` |
| 提供目录：`statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175019.png` | [tui/external/windows/subagents.png](tui/external/windows/subagents.png) | 1826×1192 | `f0d3e194fbbd7c8a8e6b85b132992c0cc3c80b1424125685db03e2cdb4404e55` |
| 提供目录：`statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175031.png` | [tui/external/windows/settings.png](tui/external/windows/settings.png) | 1825×1193 | `0fccc6e38cc58bd399e6b929b1181de9772eddd6861a5a4e791122e98ed8e633` |
| 提供目录：`statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175039.png` | [tui/external/windows/layout.png](tui/external/windows/layout.png) | 1828×1194 | `868d8923e1b074ae80e8b79981da26a9645bfde59aab1a469ea95e080ff97837` |
| 提供目录：`statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180915.png` | [tui/external/macos/main.png](tui/external/macos/main.png) | 1138×723 | `0e6b9cb93766c3729933610f75df8a516a84254ab014273f6df98014f6b891b2` |
| 提供目录：`statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180940.png` | [tui/external/macos/subagents.png](tui/external/macos/subagents.png) | 1140×725 | `26ef13f510806ad9e3f1065ad8fb1114b5ec5d315c4cb5399ce4fe8ab473de42` |
| 提供目录：`statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180956.png` | [tui/external/macos/settings.png](tui/external/macos/settings.png) | 1141×725 | `467deebb5acd95d970f22aa0a48a09d119f1087d48b34852dcb310e8afe5b034` |
| 提供目录：`statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 181009.png` | [tui/external/macos/layout.png](tui/external/macos/layout.png) | 1137×724 | `0b0e37797e2c4122a22fa8689a3a7764bef4b5ff6dbd423d9709495e3b329e17` |

</details>

## 更新约定

- 当前图片使用小写英文文件名，按入口、平台与页签归类。
- 更新图片时同步中英文 README、使用指南、索引和摘要；保留原图，归档被替换的截图。
- 历史重建图保留来源版本、原文件名、捕获提交与元数据，不标记为新版本截图。
- `MANIFEST.in` 递归收录 Markdown 和 PNG；构建检查核对源码分发包是否完整。

<a id="external-tui-v161"></a>
<a id="v120-画面"></a>
<a id="v130a1-预览画面"></a>
<a id="v130a2-client-画面"></a>
<a id="v150-正式验收"></a>
<a id="v150a1-phase-4-终端重建画面"></a>
<a id="v160-正式版验收"></a>
<a id="v161-外部-tui-捕获"></a>
<a id="原生编辑器画面"></a>
<a id="展示说明"></a>
<a id="文件索引"></a>

## 历史来源入口

旧链接的来源记录迁入[归档索引](archive/README.zh-CN.md)，包括旧会话截图、原生编辑器预览、格式与布局预览及外部 TUI 捕获。历史提交、原始捕获摘要与验收范围在归档中完整保留。
