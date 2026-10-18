# 多语言终端图像

[English](README.md) | **简体中文**

当前 TypeScript 包分别提供台湾／香港语言，最终发布包的两个编辑器图片见 [v3.1.0 地区图库](../typescript/regional/README.zh-CN.md)。下方历史 Python 图片保留原语言名称与源码身份。

这些图像由 2026-10-11 在 Linux 上使用已安装 v1.13.0 wheel 捕获的真实终端单元格重建，源码为 `1134aee5425ed50fa0ca936321abb246e011b6b0`。图像已经 agent 检查，属于终端重建图，不是桌面截图，也不代表新增真人平台验收。[原有跨平台图库](../README.zh-CN.md)独立保留。

| 语言 | 原生浅色 | 外部深色 | 外部最小尺寸 |
| --- | --- | --- | --- |
| 繁體中文 | [主状态栏](native/zh-Hant-light.png) | [主状态栏](external/zh-Hant-dark.png) | [设置](external/zh-Hant-minimum.png) |
| 日本語 | [主状态栏](native/ja-light.png) | [主状态栏](external/ja-dark.png) | [设置](external/ja-minimum.png) |
| 한국어 | [主状态栏](native/ko-light.png) | [主状态栏](external/ko-dark.png) | [设置](external/ko-minimum.png) |

## 来源与验收范围

环境为 Linux x86_64、Python 3.14.4、Claude Code 2.1.294 和 `xterm-256color` PTY。原生图像来自已安装的持久 Mod 与实际 Client 输出，从 120 列宿主裁出右侧编辑器；外部图像来自安装后的 curses 入口，尺寸为 120×30 和 64×18。预览使用固定样本，不代表真实账户用量。最小尺寸设置图有意展示“已切换界面语言、输出仍为英文”的独立状态，尚未修改输出语言草稿。长标签按完整字素截断，较宽尺寸可以显示全文。

三语言完整矩阵通过 30 组外部验收（五尺寸 × 两背景 × 三语言）和 12 组原生验收（80/120 列 × 两背景 × 三语言），覆盖真实按键、双向切换、界面立即保存、草稿取消、保存、重新打开及实际状态栏输出。本页九张图使用上述干净固定源码重新捕获；较早矩阵凭据分别记录自己的源码提交。原生 32×12 等视口边界由官方 Client 测试覆盖，不标注为 32×12 宿主 PTY 验收。

终端默认调色板来自明确的捕获分析夹具，不会修改实体桌面主题。在持久 tmux 深色路径中，宿主可能把原生预览背景转换为 ANSI-256 索引 17（`#00005f`）；验收工具记录并仅接受这个已观测的转换，直接 truecolor 检查仍保持严格。这是捕获传输限制，不是新增颜色选项。

`tools/render_native_capture.py` 使用 DejaVu Sans Mono、Noto Sans CJK 和 Noto Symbols 2 渲染真实单元格。原生裁剪排除了会话正文、输入框和私人配置路径。PNG 元数据保留源码提交及原始捕获 SHA256。原始 PTY／配置凭据保存在被忽略的 `dist/validation/final-gallery-*`，不进入发行包。不声称进行了付费模型调用、新增 Windows/macOS 真人终端验收或母语者审校。

## PNG 完整性

| 文件 | 像素 | SHA256 |
| --- | --- | --- |
| [external/ja-dark.png](external/ja-dark.png) | 1464×744 | `7b3e64e2f689378c4547d98b81c2ee10ca60a380413041fb98c2e46b9ade89d4` |
| [external/ja-minimum.png](external/ja-minimum.png) | 792×456 | `84edfc9fb17ff11a6366ca4280cd5536a6e0dfdc06633cd0772f4aee68d7a920` |
| [external/ko-dark.png](external/ko-dark.png) | 1464×744 | `2ed8ac37ed458de3bf142497c31f38c5c74f68759bad3e4edc87584b8de4377b` |
| [external/ko-minimum.png](external/ko-minimum.png) | 792×456 | `cf1cd9615fb24ab140ccc350a52e6c49fde15f303e36b64e12b361db9d97e114` |
| [external/zh-Hant-dark.png](external/zh-Hant-dark.png) | 1464×744 | `be66e829a04a562a6537c91b43729f9dad9609da52d0d83dead475423c794eac` |
| [external/zh-Hant-minimum.png](external/zh-Hant-minimum.png) | 792×456 | `4797c50aa361fafac059db25033be78775ffbe65ccc069c02b0549e4b64b2bc9` |
| [native/ja-light.png](native/ja-light.png) | 888×600 | `6c1b328fc11c8952ebab2d19fe981008174fa3ff7cb77f47a3838138295dd8a4` |
| [native/ko-light.png](native/ko-light.png) | 888×600 | `f0c8d2d616db42fd75d42d7c0374f6702d7f079aeccbb2ae64bd2ed14c77e0ce` |
| [native/zh-Hant-light.png](native/zh-Hant-light.png) | 888×600 | `8b7a18983c944c13a8d50f39398a588b0bfbd62fb0316a17eea7c594618c0c69` |
