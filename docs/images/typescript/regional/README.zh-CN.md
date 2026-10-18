# 台湾与香港地区界面捕获

[English](README.md) | **简体中文**

图片来自已安装的 v3.1.0 包，源码 `10de45895d2734a8ab1eacec09b57bc89417be51`，tgz SHA-256 为 `000ddea0e995034ec8040691e21c9cf3119e18b6508c4870bc55b95247591011`。这些是经 agent 检查的终端单元格重建图，不是操作系统截图，也不代表新增人工桌面验收。[机器可读来源](provenance.json) · [验证与交付](../../../development/node-regional-languages.zh-CN.md)。

| 语言 | 原生 Client，深色／浅色 | 外部编辑器深色页面 | 外部最小／常用浅色 |
| --- | --- | --- | --- |
| 繁體中文（台灣） | [深色](native/zh-TW/dark.png)／[浅色](native/zh-TW/light.png) | [主栏](external/zh-TW/main.png)、[子代理](external/zh-TW/subagents.png)、[设置](external/zh-TW/settings.png)、[布局](external/zh-TW/layout.png) | [64×18](external/zh-TW/minimum.png)／[80×24](external/zh-TW/light.png) |
| 繁體中文（香港） | [深色](native/zh-HK/dark.png)／[浅色](native/zh-HK/light.png) | [主栏](external/zh-HK/main.png)、[子代理](external/zh-HK/subagents.png)、[设置](external/zh-HK/settings.png)、[布局](external/zh-HK/layout.png) | [64×18](external/zh-HK/minimum.png)／[80×24](external/zh-HK/light.png) |

## 捕获范围

环境为 Linux x64、Node 24.21.0。外部图片来自实际安装编辑器的 120×32、80×24 和 64×18 PTY；取消会话不改写设置／显示文件，并恢复终端属性。界面与样例输出语言一致，使用主目录相对路径和固定生产预览样例，不含真实账户数据。边界图片按终端背景选择生产渲染的浅色／深色主题。

原生常用尺寸图片来自官方 Claude 2.1.294 中实际安装的 Client，宿主 PTY 为 120×36；仅保留右侧 72×29 单元格的 Client，排除对话、输入框及宿主实际状态栏。捕获使用隔离临时配置、合成密钥和不可达的回环 API。浅色图片把独立预览背景切为浅色。先用 `@xterm/headless 6.0.0` 解码 ANSI，再用仓库 TypeScript 渲染器生成图片；没有付费模型调用或个人配置改动。

下列原生 32×12 边界图依据合成视图状态重建已安装组件，属于组件证据，与上述真实宿主 PTY 区分。官方 Client 测试也覆盖这些边界。最小尺寸保留分页、简写提示及完整字素省略行为；未观察到新增错位或 Unicode 损坏。

| 语言 | 原生组件最小尺寸，深色／浅色 |
| --- | --- |
| 繁體中文（台灣） | [深色](native/zh-TW/minimum-dark.png)／[浅色](native/zh-TW/minimum-light.png) |
| 繁體中文（香港） | [深色](native/zh-HK/minimum-dark.png)／[浅色](native/zh-HK/minimum-light.png) |

最终包的完整捕获集包含 24 张外部页面、32 张外部边界、20 张原生组件及 4 张真实宿主原生图；本图库选取其中 20 张。地区搜索、保存／取消／重开、写入失败和 36 种独立语言组合有另行自动化覆盖。既有实机、桌面和精确声明缺口继续在交付报告披露。宿主传输可能量化深色原生预览颜色，这些观察不更改桌面主题。原始 ANSI、单元格、收集脚本和回执保留在仓库之外。较早的 [Python 多语言图](../../languages/README.zh-CN.md)及 [TypeScript 准备图](../README.zh-CN.md)保留各自原始来源。

## PNG 完整性

| 文件 | 像素 | SHA-256 |
| --- | --- | --- |
| [external/zh-TW/main.png](external/zh-TW/main.png) | 1464×792 | `e575309c00e18b8018cf9a93ecff62d46705d585779569a7b9c0c18dc21f7d8f` |
| [external/zh-TW/subagents.png](external/zh-TW/subagents.png) | 1464×792 | `4a18a0cc93bb00d7b66978f927ad936b856c84e31919de624a802c302608c6df` |
| [external/zh-TW/settings.png](external/zh-TW/settings.png) | 1464×792 | `68dd68d92420e190fbcca67d416fe8ed21bba92fe8a0fdf29266e73a4b505db4` |
| [external/zh-TW/layout.png](external/zh-TW/layout.png) | 1464×792 | `a2e97de81040be4fc2a002835e387254a28b1d0f86140cae4186107bee8e28bb` |
| [external/zh-TW/minimum.png](external/zh-TW/minimum.png) | 792×456 | `f584eb1d9fc2cb0aeadd94bfa77cec2b6b85d83e125dc85ab6e04b9fd9b773a6` |
| [external/zh-TW/light.png](external/zh-TW/light.png) | 984×600 | `35ecfdee70dd02edc8ca40b95e2a0c6963966c347493beff9bbb9c0825edba5d` |
| [native/zh-TW/dark.png](native/zh-TW/dark.png) | 888×720 | `9398a01279bcb1b1f45c49e17a235f39aa9bb4b70fe9347f94d1ca8d13f1dbbc` |
| [native/zh-TW/minimum-dark.png](native/zh-TW/minimum-dark.png) | 408×312 | `74c00ac5ea134b9af555d48b7495de546ff5babf56c4180f3aef2c7a7d289773` |
| [native/zh-TW/light.png](native/zh-TW/light.png) | 888×720 | `1b0d46929b9b1a7af48b99734b04a84bbf86ae80c590e21b7876475e0e11045f` |
| [native/zh-TW/minimum-light.png](native/zh-TW/minimum-light.png) | 408×312 | `a8cdfd7aa3ec65000a5315ac5e2afc91a176eb1946a8b5326c87280cc4a4f643` |
| [external/zh-HK/main.png](external/zh-HK/main.png) | 1464×792 | `7dea82c34867365b4d7585c8b27c0df68e98822139db13b9d9dc540b04c4e2ee` |
| [external/zh-HK/subagents.png](external/zh-HK/subagents.png) | 1464×792 | `e4fff0185db938f2bc5425eb041b6051740239cb28c33726ceef9436262de506` |
| [external/zh-HK/settings.png](external/zh-HK/settings.png) | 1464×792 | `82ff691a3c9102c81e3eb2327a9b85f6f4613876bfd2d27b1ebec37fcfd51979` |
| [external/zh-HK/layout.png](external/zh-HK/layout.png) | 1464×792 | `910558e715f3194bdbae03f0eff5423e5a63a44320113565bd7a7f14a0ad9fcb` |
| [external/zh-HK/minimum.png](external/zh-HK/minimum.png) | 792×456 | `07d07ffa78a8ffba1fb3840a4f6dd3e51920136e716d2b372d59e91997c9871e` |
| [external/zh-HK/light.png](external/zh-HK/light.png) | 984×600 | `0de6db178032f7e50ed4e74ecdbea7fc079055eaf893c69bea4d42f85275c108` |
| [native/zh-HK/dark.png](native/zh-HK/dark.png) | 888×720 | `def38ad79b4b7cea8118a435d0430153608cc630c7b7401f640244e753dd9c5f` |
| [native/zh-HK/minimum-dark.png](native/zh-HK/minimum-dark.png) | 408×312 | `809aea1fb31dd783c7f807b194c945366a1c7cca361c0f7faf340eaa714dd528` |
| [native/zh-HK/light.png](native/zh-HK/light.png) | 888×720 | `4b72f2a1386a57552456f4ff95cdf2b4580f21642964eb2ede5a37058df50d4a` |
| [native/zh-HK/minimum-light.png](native/zh-HK/minimum-light.png) | 408×312 | `a83359851626dfd4328c88378a01fd3d2cb8456977a24f8a2a297f4370b9d1c6` |
