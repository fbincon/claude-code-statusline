# 截图

[English](README.md) | **简体中文**

当前图库包含 21 张 2026-10-07 提供的原始截图：会话内 TUI 9 张、外部 TUI 12 张。原 README 的 18 张图片与更早记录保留在[归档](archive/README.zh-CN.md)。

PNG 字节、尺寸、颜色及元数据保持不变。会话底部主状态栏显示会话数据；配置 Preview 使用固定样例，不能作为真实 token 用量或并行代理验收证据。

## 目录结构

```text
images/
├── tui/
│   ├── native/
│   │   ├── linux/
│   │   │   ├── main.png
│   │   │   ├── subagents.png
│   │   │   ├── settings.png
│   │   │   ├── layout.png
│   │   │   └── themes/
│   │   │       ├── main-light.png
│   │   │       └── main-dark.png
│   │   ├── windows/
│   │   │   ├── main.png
│   │   │   ├── subagents.png
│   │   │   ├── settings.png
│   │   │   ├── layout.png
│   │   │   └── themes/
│   │   │       ├── main-light.png
│   │   │       └── main-dark.png
│   │   └── macos/
│   │       └── main.png
│   └── external/
│       ├── linux/
│       │   ├── main.png
│       │   ├── subagents.png
│       │   ├── settings.png
│       │   ├── layout.png
│       │   └── themes/
│       │       ├── main-light.png
│       │       ├── main-light-ansi.png
│       │       ├── main-dark.png
│       │       └── main-dark-ansi.png
│       ├── windows/
│       │   ├── main.png
│       │   ├── subagents.png
│       │   ├── settings.png
│       │   ├── layout.png
│       │   └── themes/
│       │       ├── main-light.png
│       │       ├── main-light-ansi.png
│       │       ├── main-dark.png
│       │       └── main-dark-ansi.png
│       └── macos/
│           ├── main.png
│           ├── subagents.png
│           ├── settings.png
│           └── layout.png
└── archive/
    ├── screenshots/
    │   └── replaced-2026-10-07/
    └── reconstructions/
```

## 当前图片

| 入口 | 平台 | Main | Subagents | Settings | Layout |
| --- | --- | --- | --- | --- | --- |
| 会话内 | Linux | [PNG](tui/native/linux/main.png) | [PNG](tui/native/linux/subagents.png) | [PNG](tui/native/linux/settings.png) | [PNG](tui/native/linux/layout.png) |
| 会话内 | Windows | [PNG](tui/native/windows/main.png) | [PNG](tui/native/windows/subagents.png) | [PNG](tui/native/windows/settings.png) | [PNG](tui/native/windows/layout.png) |
| 会话内 | macOS | [PNG](tui/native/macos/main.png) | 未提供 | 未提供 | 未提供 |
| 外部 | Linux | [PNG](tui/external/linux/main.png) | [PNG](tui/external/linux/subagents.png) | [PNG](tui/external/linux/settings.png) | [PNG](tui/external/linux/layout.png) |
| 外部 | Windows | [PNG](tui/external/windows/main.png) | [PNG](tui/external/windows/subagents.png) | [PNG](tui/external/windows/settings.png) | [PNG](tui/external/windows/layout.png) |
| 外部 | macOS | [PNG](tui/external/macos/main.png) | [PNG](tui/external/macos/subagents.png) | [PNG](tui/external/macos/settings.png) | [PNG](tui/external/macos/layout.png) |

## 会话内 Client 截图

会话截图中可见 Claude Code 2.1.292：Linux 和 Windows 为停靠式区域，macOS 为内嵌区域。Linux、Windows 各提供四页，macOS 仅提供 Main。对话、此前命令结果和连接消息保留原貌。

静态截图更新布局示例，不另行证明保存、键盘焦点或已解决历史 macOS 输入问题。排查与历史反馈见[用户指南](../USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)和[原生编辑器记录](../development/native.zh-CN.md#claude-code-21289-交互反馈)。

## 来源与哈希

源目录按入口和平台分类；原始文件名记录 2026-10-07。各平台截图按 Main、Subagents、Settings、Layout 顺序对应；macOS 会话内仅有 Main。精确 OS、架构、终端版本及后端提交未随图片提供。

<details>
<summary>原始文件名、仓库路径、尺寸和 PNG SHA-256</summary>

| 原始来源路径 | 仓库文件 | 尺寸 | PNG SHA-256 |
| --- | --- | --- | --- |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-36-44.png` | [tui/native/linux/main.png](tui/native/linux/main.png) | 1009×729 | `7e83baab8ce567609978d9047b91ba0c7ba8d251b366350d1698f9c1f9e09298` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-36-54.png` | [tui/native/linux/subagents.png](tui/native/linux/subagents.png) | 1009×729 | `d197811741c03a2b3132a0fdbcdbabbb4050bff304f5b0727422f9c0898c6eb5` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-37-00.png` | [tui/native/linux/settings.png](tui/native/linux/settings.png) | 1009×729 | `20119c8cd5ee120fe105ecd525a821da7ad39cf1c9ca3b43ef46dec25b6a83cb` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-37-08.png` | [tui/native/linux/layout.png](tui/native/linux/layout.png) | 1009×729 | `b18a6d0625c30245efdff61bc11580cf49da1498d8da2164df05234f310fe3ea` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195919.png` | [tui/native/windows/main.png](tui/native/windows/main.png) | 1634×1165 | `3f3e8e079c2cb347c0ccead1134748fa7e77d4bddae3c3028a6b595e58631cd8` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195934.png` | [tui/native/windows/subagents.png](tui/native/windows/subagents.png) | 1629×1160 | `41c9a07bad74b88f7f1cbc0a5aaa84c3a85bf389b5613940c929f74227622261` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195951.png` | [tui/native/windows/settings.png](tui/native/windows/settings.png) | 1629×1167 | `7a64fd05dfd96a5ed0a9d9c8e5e0fcc165facf4cd811496744ac91742cc00f3b` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 200002.png` | [tui/native/windows/layout.png](tui/native/windows/layout.png) | 1628×1159 | `4d5f47308447b73b8a7e326157354b2a3ff1fd3f3ce3842376aa2ed3a16fdb16` |
| `statusline-configure-native打开的内部TUI展示/macOS/屏幕截图 2026-10-07 203809.png` | [tui/native/macos/main.png](tui/native/macos/main.png) | 1278×931 | `154cdd288166e0c440a76259ae735bc8ad2a08141253d44fd0bb5f2349b0e26e` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-20.png` | [tui/external/linux/main.png](tui/external/linux/main.png) | 1079×732 | `43c46bc311172520832b5752547a9c6a5126eefdc97c44cb1ce5231e9db5b263` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-26.png` | [tui/external/linux/subagents.png](tui/external/linux/subagents.png) | 1079×732 | `6265f3cdf3ce6eaa28111da2f20f0b1fa8b5d6404d1af59142be2f3c35b49f86` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-32.png` | [tui/external/linux/settings.png](tui/external/linux/settings.png) | 1079×732 | `0ff095e837fcf80941d6dae0636e8c2a2a3761ebc4311dba4673e54b74996cdc` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-37.png` | [tui/external/linux/layout.png](tui/external/linux/layout.png) | 1079×732 | `cd6199536efe9904f0d1c861e01538bf5e7783313d01de9faca8c30274b7ba20` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200100.png` | [tui/external/windows/main.png](tui/external/windows/main.png) | 1632×1163 | `fcb2139cdc67938b51b5bca2cb8687a0471636c15e31d45a99d2d8e3b727e0c2` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200110.png` | [tui/external/windows/subagents.png](tui/external/windows/subagents.png) | 1629×1163 | `f72372ea786a5a3fa1f008cf4a9bc2b590c31aadc138318fcd45d80cf61e4c50` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200120.png` | [tui/external/windows/settings.png](tui/external/windows/settings.png) | 1629×1162 | `448fe8539f791b98009196d5fb42028f892466cb378811b4ee306475e985bfb9` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200137.png` | [tui/external/windows/layout.png](tui/external/windows/layout.png) | 1625×1163 | `bc400e643217e9b1f1cf365478b80d8f1bfa2f2f1c0e9a30b408f6db25bb22aa` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203857.png` | [tui/external/macos/main.png](tui/external/macos/main.png) | 1292×842 | `1822b19c3807cc4a3b84c69cc42441dcade2f8891c56a42627dbf07a1f280969` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203909.png` | [tui/external/macos/subagents.png](tui/external/macos/subagents.png) | 1287×848 | `33f6dc1501a6aa394561e2f1febf6a8290a2983ca1d7bc8e4e4482090b1b2109` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203920.png` | [tui/external/macos/settings.png](tui/external/macos/settings.png) | 1289×846 | `207637fb8365b339ab054e83e4428c417aac4b2e9b910bffd1173e5a1f4e1c81` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203930.png` | [tui/external/macos/layout.png](tui/external/macos/layout.png) | 1291×843 | `dbdb3d1f0d9e820f23059deadd20f3da0c7edc7df425fd59ceaeecd5a49aa741` |

</details>

## 更新约定

- 使用小写英文文件名，按入口、平台和页面分类。
- 同步双语 README、相关指南、索引和哈希；保留源文件，归档被替换的截图。
- 保留历史捕获版本、文件名、提交及元数据；替换批次日期不代表捕获日期。
- `MANIFEST.in` 包含 Markdown 和 PNG，分发检查验证源码包完整性。

<a id="display-notes"></a>
<a id="external-tui-v161"></a>
<a id="file-index"></a>
<a id="interface-screenshots"></a>
<a id="native-editor-captures"></a>
<a id="v120-captures"></a>
<a id="v130a1-preview-captures"></a>
<a id="v130a2-client-captures"></a>
<a id="v150-stable-acceptance"></a>
<a id="v150a1-phase-4-captures"></a>
<a id="v160-stable-acceptance"></a>
<a id="v161-external-tui-captures"></a>
<a id="展示说明"></a>
<a id="文件索引"></a>
<a id="更新约定"></a>
<a id="界面截图"></a>
<a id="current-images"></a>

## 历史来源

旧链接对应的原始捕获、哈希与验收范围见[归档索引](archive/README.zh-CN.md)。

## 主题终端捕获

2026-10-09 从真实 Claude Code 2.1.294 truecolor PTY 单元格重建两张 Linux 图片，仅裁出原生编辑器区域。已完成代理视觉检查；与 21 张原始系统截图、真人验收分别记录。源码提交：`bb687df044d7e875c4817d9b1fc8c905749834bc`；视口 120×30；系统 Linux x86_64。四页、表单和独立主题 Apply 在 120×30 与 80×48 均检查。原始单元格与私有会话日志保留在忽略目录。

| 主题 | 捕获 | 尺寸 | PNG SHA256 | 单元格 SHA256 |
| --- | --- | --- | --- | --- |
| light | [main-light.png](tui/native/linux/themes/main-light.png) | 888×576 | `08eee7ab45ad74814280c770c2c51c4772456382e1d80ff7c75edcb166205b11` | `0d74c602d9b8dc21e05349fcb9c1be65eba07b79c1518d85705b3a082f19686d` |
| dark | [main-dark.png](tui/native/linux/themes/main-dark.png) | 888×576 | `ec5292f49b7adc18089d02ea94dab021c25a01e025ef5ea5177c36183da9908b` | `1bed1c71d5956fe7a4b3eab602bc2ed4b2b57d85db77523babb7038684807433` |

## 外部终端配色捕获

这些图片重建源码提交 `416862536f775f603a83812283ea2ea104a81699` 的实际外部 TUI 输出。2026-10-09 在独立浅色／深色 GNOME Terminal 3.58.0／VTE 0.84.0 配置中捕获，连接隔离的 tmux 3.6 服务器。已安装 1.7.7 wheel 从该固定提交构建，运行于 Linux x86_64／Python 3.14.4，每个 pane 为 120×30。

浅色配置使用 `#17191e` 前景和 `#ffffff` 背景，深色使用 `#dedee7` 与 `#17191e`。两组都复制原默认配置的 GNOME ANSI 调色板，关闭 bold-is-bright，并在捕获中记录颜色值。预览沿用终端背景和所选生产配色，default 与 ANSI 图片显示实际差异，RGB 样例按能力量化。ANSI 在未保存草稿中选择，随后取消，配置字节保持不变。主界面和反色选择通过 4.5:1 对比度检查；样例保留原色，让用户看到对比度不足并比较配色。

这些是终端重建图，不代表系统截图或真人验收；GNOME Shell 拒绝了此前的截图 API 尝试。原始 ANSI、解码单元格和报告留在忽略的 `dist/validation/v1.7.7-terminal-source/gnome`，由 `tools/render_native_capture.py` 读取记录的默认色及 ANSI 调色板绘制。另行运行的五尺寸浅色／深色 PTY 套件检查四页／表单、切换配色、Colors off 和保存后的 ANSI 生产输出。临时终端配置、窗口和服务器已移除，原默认配置保留。后续仅文档提交保留已测试实现。

| 终端／配色 | 图片 | 捕获 JSON SHA256 | PNG SHA256 |
| --- | --- | --- | --- |
| light / default | [PNG](tui/external/linux/themes/main-light.png) | `1bb05a06b8bf6f2467c796b82660945cac875cee0e129787fe99a8a7a6d5920c` | `caa98e74e0a80184d56f02289e3778cd2f713604b027bca83a2ca1686fb45af9` |
| light / ansi | [PNG](tui/external/linux/themes/main-light-ansi.png) | `6c0bddf026f8ff427f3b38a8c245c2b7b6268ddea87c04ff2e79b6b52406949e` | `ea5fb0ccfba335d9be038279a0dd4ed298b2eb7d4c38e4c3b19f682401771a0e` |
| dark / default | [PNG](tui/external/linux/themes/main-dark.png) | `02bd6e45ae4efcf5979074866abc5b51d50ebe6a0594fe71f8972ee8a9668261` | `cedcc3feab9b0033ed72a6cc82033b4230af92523ec722fff837b257f28fe59a` |
| dark / ansi | [PNG](tui/external/linux/themes/main-dark-ansi.png) | `80b25a3042908729de992824766213ac3fe9afe0eb5851c803553d3ae1f60c47` | `12d8ce4335261e9d06b9f3d83bb7ce709b56d6deff222563388f3866e5b5aa38` |
