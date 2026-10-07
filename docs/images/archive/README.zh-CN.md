# 历史截图与终端捕获

[English](README.md) | **简体中文**

本页保留此前文档使用的 51 张图片和原来源记录。当前展示使用的新会话内与外部 TUI 截图见[当前图片索引](../README.zh-CN.md)。以下历史反馈按原日期和范围保留；不会因文件迁移而成为新的验收结论。

截图在[项目首页](../../../README.zh-CN.md#界面预览)展示。主状态栏图片来自实际 Claude 会话；配置页中的 `Preview (sample data)` 使用固定样例，Subagents 配置页的两条预览不代表真实并行 Agent 的验收结果。

## 文件索引

| 平台 | 主状态栏 | Main | Subagents | Settings |
| --- | --- | --- | --- | --- |
| Linux | [statusline.png](screenshots/replaced-2026-10-07/statusline/linux.png) | [configure-main.png](screenshots/external/linux/main.png) | [configure-subagents.png](screenshots/external/linux/subagents.png) | [configure-settings.png](screenshots/external/linux/settings.png) |
| macOS | [statusline-macos.png](screenshots/replaced-2026-10-07/statusline/macos.png) | [configure-main-macos.png](screenshots/external/macos/main.png) | [configure-subagents-macos.png](screenshots/external/macos/subagents.png) | [configure-settings-macos.png](screenshots/external/macos/settings.png) |
| Windows | [statusline-windows.png](screenshots/replaced-2026-10-07/statusline/windows.png) | [configure-main-windows.png](screenshots/external/windows/main.png) | [configure-subagents-windows.png](screenshots/external/windows/subagents.png) | [configure-settings-windows.png](screenshots/external/windows/settings.png) |

## 会话内 Client 截图

以下实际终端截图由维护者于 2026-10-04 提供，展示现有 Claude Code 会话内的 Client Main 配置页，以及对话区、输入区和主状态栏。三张截图均可见 Claude Code 2.1.289。未提供后端版本、源码提交、准确系统版本、架构和终端版本，相关信息保持未知。

| 平台 | 截图 | 尺寸 | 维护者交互反馈 |
| --- | --- | --- | --- |
| Linux | [client-session-linux.png](screenshots/native/linux/session.png) | 1414×874 | 可以正常操作 |
| Windows | [client-session-windows.png](screenshots/native/windows/session.png) | 1792×1202 | 可以正常操作 |
| macOS | [client-session-macos.png](screenshots/native/macos/session.png) | 1347×892 | 面板可以打开；交互异常；有效配置尚未验证 |

原文件名依次为 `linux.png`、`windows.png` 和 `macOS.png`。保留 PNG 原始字节、尺寸和颜色，不裁剪或重绘；会话原文中的先前命令及连接消息同样保留。Client Preview 使用固定样例数据。截图用于展示布局，交互结论来自维护者另行反馈。macOS 检查建议见[使用指南](../../USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)；本次反馈与历史验收分别记录在[原生编辑器开发说明](../../development/native.zh-CN.md#claude-code-21289-交互反馈)。

## 展示说明

Linux、macOS 与 Windows 均展示主状态栏和 Main、Subagents、Settings 三页配置界面。macOS / Windows 图片使用平台后缀，PNG 内容、尺寸和颜色保持原样。

macOS 图片展示 Terminal.app 中的界面，Windows 图片展示 Windows Terminal 中的界面。

截图展示各自终端的会话、布局和设置，显示项、调色板、字体与窗口宽度可能不同。

## 更新约定

以下文件名约定对应归档资产，新截图遵循[当前目录约定](../README.zh-CN.md#更新约定)。

- 使用 PNG 和小写英文文件名，平台图片使用 `-macos` / `-windows` 后缀。
- 保留可读的状态栏或配置页面，更新时同步首页引用和文件索引。
- 源码分发包通过 `MANIFEST.in` 收录本目录的 Markdown 和 PNG，CI 检查打包完整性。

## 原生编辑器画面

### v1.3.0a1 预览画面

[Main](reconstructions/v1.3.0a1/linux/native-main-v1.3.0a1-linux.png) · [Subagents](reconstructions/v1.3.0a1/linux/native-subagents-v1.3.0a1-linux.png) · [Settings](reconstructions/v1.3.0a1/linux/native-settings-v1.3.0a1-linux.png)

三张 PNG 重建真实 Linux x86_64、Claude Code 2.1.288、后端 1.3.0a1、官方持久插件的解码 cells，干净源码提交为 `4cd97dd480aa0025fb9edc7644b872bf3fa6336b`（2026-10-04）。停靠终端尺寸 120×30，同一自动运行另检查 80×48 的内嵌操作。渲染器裁去会话/输入区并内嵌提交与原始画面哈希；数值为生产样例，是终端重建，不是 OS 逐像素截图或 mockup。原始来源仅留在忽略的 `dist/validation/native-usability-capture-288`。维护者随后确认 a1 三平台真人验收通过；a2 Client 真人验收单独记录。

### v1.2.0 画面

[Main](reconstructions/v1.2.0a1/linux/native-main-linux.png) · [Subagents](reconstructions/v1.2.0a1/linux/native-subagents-linux.png) · [Settings](reconstructions/v1.2.0a1/linux/native-settings-linux.png)

三张 PNG 来自真实 Linux x86_64 Claude Code 2.1.288、120 列终端的解码 cells，使用官方持久插件接入及后端 1.2.0a1，干净代码提交 `db4129b75dcc3aa20fc24bbb09946e249038ee2e`（2026-10-04）。`tools/render_native_capture.py` 裁掉会话区和输入框，用文档字体及默认颜色绘制原始文本和属性；它们是终端画面重建，不是操作系统逐像素截图或构造的 mockup。PNG 内嵌提交和原始画面 SHA256。

状态行数值为生产样例预览。Settings 下方内容通过宿主滚动/Tab 查看。画面及 120/80 列自动保存取消检查不表示真人验收通过，私有 cells/debug 在忽略的 `dist/validation/phase2-editor-pty-fixed`。`configure-*-macos.png` 与 `configure-*-windows.png` 是兼容 TUI 图片；该版本发布时未提供这两个平台的原生截图，维护者已另行确认 Windows 11、macOS 14.5 真人结果。

### v1.3.0a2 Client 画面

[Main](reconstructions/v1.3.0a2/linux/client-main-v1.3.0a2-linux.png) · [Subagents](reconstructions/v1.3.0a2/linux/client-subagents-v1.3.0a2-linux.png) · [Settings](reconstructions/v1.3.0a2/linux/client-settings-v1.3.0a2-linux.png)

三张 PNG 重建 Linux x86_64、Claude Code 2.1.288 交互宿主、后端 1.3.0a2 和持久安装 Mod 的真实终端 cells。固定源码提交 `2ed1f3ae306776caeffe6a27205a4d680cb8e472`，运行时资源与本次候选一致。120×30 PTY 使用私有 tmux server，另验证 80×48 内嵌布局。图片裁去会话、输入区和真实状态栏，Preview 为固定生产样例；不是 OS 像素截图或设计 mockup。图片内嵌提交与原始画面 SHA256，原始数据留在忽略的 `dist/validation/client-a2-fixed-288`。这些自动画面不计为真人验收。2026-10-04 维护者另行确认 a2 在 Linux、Windows、macOS 真人验收通过，未附终端/架构/宿主详细元数据。正式 v1.3.0 沿用其 Client 交互模块，仅更新版本/描述等元数据；图片保留 a2 文件名和原始来源。

### v1.5.0a1 Phase 4 终端重建画面

[逐项格式](reconstructions/v1.5.0a1/linux/client-format-v1.5.0a1-linux.png) · [Layout](reconstructions/v1.5.0a1/linux/client-layout-v1.5.0a1-linux.png) · [紧凑 Layout](reconstructions/v1.5.0a1/linux/client-layout-compact-v1.5.0a1-linux.png) · [预设预览](reconstructions/v1.5.0a1/linux/client-preset-v1.5.0a1-linux.png) · [Claude 偏好](reconstructions/v1.5.0a1/linux/client-preferences-v1.5.0a1-linux.png)

以上 PNG 来自已安装 v1.5.0a1 wheel、Mod 1.5.0-alpha.1、Claude Code 2.1.289 的真实终端单元格，环境为 Linux x86_64／Python 3.14.4。两种持久入口在 120×30／80×48 高级 PTY 中通过。捕获源为干净本地提交 `07804ba23f98396b1bbb67b795efd9ccf8e6fab3`；发布分支重定基后，公开候选 `e978411ab92b99b44cf99d42f8dfce9eba3cf415` 的源文件树完全一致（`ff77dc8b4b0fa3264b2344a38c98a1786b27e0ee`）。图片元数据保留原捕获提交／哈希；运行 Mod 指纹为 `06510b1cbfc9c28c175cb3fc3a2268cb312de93c5e3f128b3e4effa52158ab10`。

重建工具裁去对话／输入框／实时状态和私有路径，紧凑页使用明确的单元格裁剪范围，并保留 CJK 续列背景。Preview 为生产样例。代理检查确认格式／布局／宿主控件与中文可读；画面属于终端重建，不是系统像素截图或人工验收。原始记录仅保留在忽略的 `dist/validation/phase4/preview-candidate-r2-pty`。Linux／Windows Phase 4 及 macOS 独立 TUI／CLI 人工验收已于 2026-10-05 确认，macOS Client 输入问题继续保留。

## v1.5.0 正式验收

2026-10-05，维护者确认 Phase 4 在 Linux、Windows，以及 macOS 的独立 TUI／CLI 入口人工验收通过；未提供具体 OS、架构、终端和宿主版本。本次确认不表示此前 macOS 会话内 Client 输入问题已修复。

正式版调整包／Mod 版本及发布默认值，格式、布局、可移植文件、宿主应用与已验收输入行为沿用已验证预览。自动 CI／PTY 与代理视觉检查分别记录；历史图片保留 a1 文件名、捕获哈希及原始源码提交。

## v1.6.0 正式版验收

2026-10-05，维护者确认 v1.6.0a1 在 Linux、Windows、macOS 验收通过；未提供具体 OS、架构、终端和宿主版本。这是新增的 Phase 5 验收记录，与历史编辑器确认及自动／headless／PTY 证据分开记录。已有 macOS Client 输入限制继续保留。正式 v1.6.0 沿用已验收运行实现、显示 schema v4、配置协议 v3 和运行协议 v1；兼容宿主的编辑器默认启用并保留明确 false，实时采集继续独立默认关闭并保留偏好。

## 图库替换批次

[2026-10-07 替换的 18 张图库图片](screenshots/replaced-2026-10-07/README.zh-CN.md)保留原主状态栏、会话内 Main 截图和外部四页图库，以及原文件名和 PNG 哈希。替换日期不改变捕获日期或验收结论。

<a id="external-tui-v161"></a>

## v1.6.1 外部 TUI 捕获

这七张 PNG 从已安装 wheel 的真实 curses PTY 单元格重建。源提交为 `ceb70bb127eb33d6257d47498b947f1f4c57a7f2`，后端与双 Mod 版本为 1.6.1；环境为 Linux x86_64（kernel 7.0.0-38-generic）、Python 3.14.4、xterm-256color PTY 和 pyte 0.8.2。五个独立尺寸通过四页／详情、输入中缩放、取消字节一致、重排后的数值保存／回读。捕获保存在忽略的 `dist/validation/tui-sections-candidate/external-pty`。

80×24 展示 Main、Subagents、Settings、Layout 和格式详情；64×18 展示紧凑 Settings 与 Layout。截图 fixture 选择三个主显示项以展示分组；详情的中文与组合字符来自真实输入，Preview 为生产固定样例。图片显示终端文本／属性的重建画面，使用文档字体与颜色；它们不是 OS 像素截图或设计稿。PNG 元数据嵌入源提交和捕获 SHA256，完整捕获哈希如下。

代理目视检查确认七个画面的标题、表头、分组、选中行、Preview 与操作区可辨；自动报告的 `manual_visual_acceptance` 保持 false。本次没有新增维护者真人验收，历史三平台确认保留原范围。独立 TUI 捕获不声称来自 Claude 会话；真实双入口命令／配置互读另由官方持久 PTY 验证。

| 图片 | 终端单元格 | 捕获 JSON SHA256 |
| --- | --- | --- |
| [external-main-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-main-v1.6.1-linux.png) | 80x24 | `d7309f186324c8859ec727531d0579ed1c2f04e9848bf3fc7d5d202b67fcea4f` |
| [external-subagents-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-subagents-v1.6.1-linux.png) | 80x24 | `1fc7f0d99f0c147430a0c64affde00b9f882a7e5d15f80b1988d633e0053b39a` |
| [external-settings-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-v1.6.1-linux.png) | 80x24 | `4efee90b89d03ea6c2c2eae20c2cdc9ad7fd83031db74bc59938cc170e77f594` |
| [external-layout-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-v1.6.1-linux.png) | 80x24 | `35a984e75835c49bbc7f6fc3787882c572501f742c9e229c176cda352f2bb8a8` |
| [external-format-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-format-v1.6.1-linux.png) | 80x24 | `05bc122708050434348990c38049c30ce524b5d65657e181062ec8419f403063` |
| [external-settings-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-compact-v1.6.1-linux.png) | 64x18 | `bec340ec3d1160d87e0a7d977460ee5eb446cf9cdf87f5ee17866b2c9b9d1819` |
| [external-layout-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-compact-v1.6.1-linux.png) | 64x18 | `2ac330a789c6d0d8f7065e7876cc319198586c97edaf4419a0590a2939abe077` |

<details>
<summary>归档文件清单、尺寸与 PNG SHA-256</summary>

| 原仓库路径 | 归档文件 | 尺寸 | PNG SHA-256 |
| --- | --- | --- | --- |
| `docs/images/client-format-v1.5.0a1-linux.png` | [client-format-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-format-v1.5.0a1-linux.png) | 888×552 | `b3299dcfd96b7b53b0cda11f71bc3ff618b6d6c57660ca159637ea79fc187784` |
| `docs/images/client-layout-compact-v1.5.0a1-linux.png` | [client-layout-compact-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-layout-compact-v1.5.0a1-linux.png) | 984×336 | `03bbe2baeb1e92beefe8ffa8c6f0525c17ec34ebc17f8c719d253b2665ff86d8` |
| `docs/images/client-layout-v1.5.0a1-linux.png` | [client-layout-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-layout-v1.5.0a1-linux.png) | 888×552 | `46e0dc2f088f787f1d53ffcdca8ab494df61f18a2cfb4d68eb7344d302bb03fd` |
| `docs/images/client-main-v1.3.0a2-linux.png` | [client-main-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-main-v1.3.0a2-linux.png) | 888×552 | `8f20a96115934ce61b9c508466da10becbe6f0f0abf9dfbbcff21530fde36e99` |
| `docs/images/client-preferences-v1.5.0a1-linux.png` | [client-preferences-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-preferences-v1.5.0a1-linux.png) | 888×576 | `95da985dafd29b402540644d5a72b4031c95afeea4fe523b6088140065305d09` |
| `docs/images/client-preset-v1.5.0a1-linux.png` | [client-preset-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-preset-v1.5.0a1-linux.png) | 888×576 | `499905fdfab747c32e3f29072303ae7132cca485b8f643968fb9f31528d3b164` |
| `docs/images/client-session-linux.png` | [session.png](screenshots/native/linux/session.png) | 1414×874 | `98624732a495c811fc024b04818e87d3965dabf28001768a3e587e95fab339be` |
| `docs/images/client-session-macos.png` | [session.png](screenshots/native/macos/session.png) | 1347×892 | `a7b33951a7973165062f441f7f554c5228f950fb1069ef0cbbe9ae87916735a6` |
| `docs/images/client-session-windows.png` | [session.png](screenshots/native/windows/session.png) | 1792×1202 | `7f10a719a3db89d15e5a869955046e49eb279214e1b1baf4aa571cd5bdc7e483` |
| `docs/images/client-settings-v1.3.0a2-linux.png` | [client-settings-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-settings-v1.3.0a2-linux.png) | 888×552 | `fa61c28e28e64e196fcb76ce3cbbc082e8d44d9331061690759f13d7452fb079` |
| `docs/images/client-subagents-v1.3.0a2-linux.png` | [client-subagents-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-subagents-v1.3.0a2-linux.png) | 888×552 | `4c8fcb0d62c42cd843b391a90e46f02379b2d9d9dc73befadc39b0b524ab87cc` |
| `docs/images/configure-main-macos.png` | [main.png](screenshots/external/macos/main.png) | 931×509 | `5a83c868a9a7c79e12acf85c945d050f4ad61761113e9236792f468d34381550` |
| `docs/images/configure-main-windows.png` | [main.png](screenshots/external/windows/main.png) | 1750×950 | `dccd1d37fd6c95f40de143206b30fca0bc619ac03b6e92abc5091f57122ee059` |
| `docs/images/configure-main.png` | [main.png](screenshots/external/linux/main.png) | 1191×790 | `c99b5accf4443f5eaa5fb643c0f26c736200926d06bcb3e955d87b668c1e3345` |
| `docs/images/configure-settings-macos.png` | [settings.png](screenshots/external/macos/settings.png) | 934×515 | `e23d86483c1d36001fe72a00fe367f57d70f94367b753a4f6d52a7471266d369` |
| `docs/images/configure-settings-windows.png` | [settings.png](screenshots/external/windows/settings.png) | 1749×947 | `84e041bc444359374a654f2675b916a02b4b9f1d8d113ac890087f191fc6b85a` |
| `docs/images/configure-settings.png` | [settings.png](screenshots/external/linux/settings.png) | 1191×790 | `4924b2d547aca1f719b65ac07644845d76a8ada605ae8436f71ee48a02d2d5b1` |
| `docs/images/configure-subagents-macos.png` | [subagents.png](screenshots/external/macos/subagents.png) | 939×513 | `22f54e310ebc374c91faef0250058ab5ee072e0a8fc7de4f7d44e57636e74d5b` |
| `docs/images/configure-subagents-windows.png` | [subagents.png](screenshots/external/windows/subagents.png) | 1751×956 | `ac6885089a858f0ea3b4615e201bb27ef2df45e4a61fda70315ee6e91cb8ee80` |
| `docs/images/configure-subagents.png` | [subagents.png](screenshots/external/linux/subagents.png) | 1191×790 | `7abed4cee329eb534f8621a6da9ff4ac4c9fa6f1becbe954545cd59b6ca256dc` |
| `docs/images/external-format-v1.6.1-linux.png` | [external-format-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-format-v1.6.1-linux.png) | 984×600 | `15a89fbeb4c005b1042251eb248f919567c0229e9e0d0390dbdfe9179aab4b62` |
| `docs/images/external-layout-compact-v1.6.1-linux.png` | [external-layout-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-compact-v1.6.1-linux.png) | 792×456 | `6d34337140b299543d95300632a3cba489bc59f999c56a597e4254b64dfc0297` |
| `docs/images/external-layout-v1.6.1-linux.png` | [external-layout-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-v1.6.1-linux.png) | 984×600 | `1f8e0aba8e3d9d9765e1ffad78e99ad34077987e3387d21a833c1b4523c25d8b` |
| `docs/images/external-main-v1.6.1-linux.png` | [external-main-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-main-v1.6.1-linux.png) | 984×600 | `d4bf69c5f661923bbb8dfd7ebea8927535d321f9d43d386c8b749ce86982e62d` |
| `docs/images/external-settings-compact-v1.6.1-linux.png` | [external-settings-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-compact-v1.6.1-linux.png) | 792×456 | `358a7edf5e7743851586f06ca27782d4ef4f791d8c709cfc98e83e9810e7f4a3` |
| `docs/images/external-settings-v1.6.1-linux.png` | [external-settings-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-v1.6.1-linux.png) | 984×600 | `0f91b2baa6c044a5627e08e475ab0390028ca3132b2ab3efaf959644bb564d4f` |
| `docs/images/external-subagents-v1.6.1-linux.png` | [external-subagents-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-subagents-v1.6.1-linux.png) | 984×600 | `c4baee897762f39422868354e4c733cf2267ae8cb0adfd643895d5875c2e271c` |
| `docs/images/native-main-linux.png` | [native-main-linux.png](reconstructions/v1.2.0a1/linux/native-main-linux.png) | 612×576 | `49076d8513f4d265d415263407164f8dbb3fc411fba5a2e2dab1b863591ee876` |
| `docs/images/native-main-v1.3.0a1-linux.png` | [native-main-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-main-v1.3.0a1-linux.png) | 888×576 | `50643eef8fdb2cc40ce5dec9e7b149988da6c0e1377749003cc81b1fce267dea` |
| `docs/images/native-settings-linux.png` | [native-settings-linux.png](reconstructions/v1.2.0a1/linux/native-settings-linux.png) | 612×576 | `46d11563f9ba160114b84c5a9593423ac499de02215da6291f3cc718f7372585` |
| `docs/images/native-settings-v1.3.0a1-linux.png` | [native-settings-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-settings-v1.3.0a1-linux.png) | 888×576 | `d1ed32200ad2f095a04e5d6542938834436dff86f4977fc6d790f1614eb63c06` |
| `docs/images/native-subagents-linux.png` | [native-subagents-linux.png](reconstructions/v1.2.0a1/linux/native-subagents-linux.png) | 612×576 | `ab4c58e7d8339d9496ee47f691e18f6a1b9398e629d72430be6e40bf66701919` |
| `docs/images/native-subagents-v1.3.0a1-linux.png` | [native-subagents-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-subagents-v1.3.0a1-linux.png) | 888×576 | `3a757011ea615775e018baff254af197d6e0d9362db86152e96f55bd9a00e146` |

</details>

以上摘要对应 PNG 文件；历史捕获表中的 Capture JSON SHA256 对应原始终端记录，二者不是同一种摘要。
