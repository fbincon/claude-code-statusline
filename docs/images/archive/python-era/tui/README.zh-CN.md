# Python 时代 TUI 终端重建

[English](README.md) | **简体中文**

**状态：** 冻结的 Python 时代归档（v1.6.1–v1.8.0 重建）；不是当前产品验收。这些图片从顶层 TUI 页面移入；图片字节和哈希保持不变。返回 [Python 时代归档](../README.zh-CN.md)及[图片索引](../../../README.zh-CN.md)。

## 主题终端捕获

2026-10-09 从真实 Claude Code 2.1.294 truecolor PTY 单元格重建两张 Linux 图片，仅裁出原生编辑器区域。已完成代理视觉检查；与 21 张原始系统截图、真人验收分别记录。源码提交：`bb687df044d7e875c4817d9b1fc8c905749834bc`；视口 120×30；系统 Linux x86_64。四页、表单和独立主题 Apply 在 120×30 与 80×48 均检查。原始单元格与私有会话日志保留在忽略目录。

| 主题 | 捕获 | 尺寸 | PNG SHA-256 | 单元格 SHA-256 |
| --- | --- | --- | --- | --- |
| light | [main-light.png](native/linux/themes/main-light.png) | 888×576 | `08eee7ab45ad74814280c770c2c51c4772456382e1d80ff7c75edcb166205b11` | `0d74c602d9b8dc21e05349fcb9c1be65eba07b79c1518d85705b3a082f19686d` |
| dark | [main-dark.png](native/linux/themes/main-dark.png) | 888×576 | `ec5292f49b7adc18089d02ea94dab021c25a01e025ef5ea5177c36183da9908b` | `1bed1c71d5956fe7a4b3eab602bc2ed4b2b57d85db77523babb7038684807433` |

## 外部终端配色捕获

这些图片重建源码提交 `416862536f775f603a83812283ea2ea104a81699` 的实际外部 TUI 输出。2026-10-09 在独立浅色／深色 GNOME Terminal 3.58.0／VTE 0.84.0 配置中捕获，连接隔离的 tmux 3.6 服务器。已安装 1.7.7 wheel 从该固定提交构建，运行于 Linux x86_64／Python 3.14.4，每个 pane 为 120×30。

浅色配置使用 `#17191e` 前景和 `#ffffff` 背景，深色使用 `#dedee7` 与 `#17191e`。两组都复制原默认配置的 GNOME ANSI 调色板，关闭 bold-is-bright，并在捕获中记录颜色值。预览沿用终端背景和所选生产配色，default 与 ANSI 图片显示实际差异，RGB 样例按能力量化。ANSI 在未保存草稿中选择，随后取消，配置字节保持不变。主界面和反色选择通过 4.5:1 对比度检查；样例保留原色，让用户看到对比度不足并比较配色。

这些是终端重建图，不代表系统截图或真人验收；GNOME Shell 拒绝了此前的截图 API 尝试。原始 ANSI、解码单元格和报告留在忽略的 `dist/validation/v1.7.7-terminal-source/gnome`，由 `archive/python/tools/render_native_capture.py` 读取记录的默认色及 ANSI 调色板绘制。另行运行的五尺寸浅色／深色 PTY 套件检查四页／表单、切换配色、Colors off 和保存后的 ANSI 生产输出。临时终端配置、窗口和服务器已移除，原默认配置保留。后续仅文档提交保留已测试实现。

| 终端／配色 | 图片 | 捕获 JSON SHA-256 | PNG SHA-256 |
| --- | --- | --- | --- |
| light / default | [PNG](external/linux/themes/main-light.png) | `1bb05a06b8bf6f2467c796b82660945cac875cee0e129787fe99a8a7a6d5920c` | `caa98e74e0a80184d56f02289e3778cd2f713604b027bca83a2ca1686fb45af9` |
| light / ansi | [PNG](external/linux/themes/main-light-ansi.png) | `6c0bddf026f8ff427f3b38a8c245c2b7b6268ddea87c04ff2e79b6b52406949e` | `ea5fb0ccfba335d9be038279a0dd4ed298b2eb7d4c38e4c3b19f682401771a0e` |
| dark / default | [PNG](external/linux/themes/main-dark.png) | `02bd6e45ae4efcf5979074866abc5b51d50ebe6a0594fe71f8972ee8a9668261` | `cedcc3feab9b0033ed72a6cc82033b4230af92523ec722fff837b257f28fe59a` |
| dark / ansi | [PNG](external/linux/themes/main-dark-ansi.png) | `80b25a3042908729de992824766213ac3fe9afe0eb5851c803553d3ae1f60c47` | `12d8ce4335261e9d06b9f3d83bb7ce709b56d6deff222563388f3866e5b5aa38` |

## 原生预览背景捕获

八张原生编辑器 PNG 于 2026-10-09 从 Linux x86_64／Python 3.14.4／Claude Code 2.1.295 的实际终端单元格重建，源码提交为 `12fbbdc9054b33875179b4feb94639b1872d9e13`。每次 120×30 捕获裁剪为 888×576 编辑器图片；另以 80×48 内嵌布局检查紧凑绘制。终端默认前景／背景及 xterm ANSI 调色板为明确的分析夹具，与 Claude 主题独立。通过实际 UI 选择匹配的预览背景，检查 default／ANSI、Colors off、所有页面／表单、偏好记忆及主题单独 Apply。图片属于终端重建，不是系统截图、物理配置测量或新的真人验收。原始日志与单元格保存在忽略的 `dist/validation/v1.7.8-preview-*`；后续仅文档提交保留相同运行源码。

| 终端／主题／配色 | 图片 | 单元格 JSON SHA-256 | PNG SHA-256 |
| --- | --- | --- | --- |
| light / light / default | [light-terminal-light-theme-default.png](native/linux/preview-backgrounds/light-terminal-light-theme-default.png) | `e911e3f5013863220c9a2a75e0d1db2bb084d89230a6f2f5bc69b1dbe29d8a91` | `86b63f913fa2d7444f4aa59136a13b3b11554e1660af204f11994a5baf22c4b1` |
| light / light / ansi | [light-terminal-light-theme-ansi.png](native/linux/preview-backgrounds/light-terminal-light-theme-ansi.png) | `2fba1791bf0da4e140db326109e58ed6d78fb181cf2b53cdb58e0ac5f6d9ea4a` | `52af8ac4e6121de77dcd9b0c616b3dc61ae8dcff0c61bf440c9168a76531ac3d` |
| light / dark / default | [light-terminal-dark-theme-default.png](native/linux/preview-backgrounds/light-terminal-dark-theme-default.png) | `6b1cd7496a47d67dd9a447ef316e4df9bee775265ae361813e88cb623d1d56b9` | `220c0026f7fbe37c011af6cc6e0c4f29d844c98645c8aa97f8bd0d284fee0fcc` |
| light / dark / ansi | [light-terminal-dark-theme-ansi.png](native/linux/preview-backgrounds/light-terminal-dark-theme-ansi.png) | `9e7085ed93622cf54701ef09bcd4d34cb970a2439e928582880fe5152f4be628` | `3a14cd386343854cebbcd26f47dca4a696a95f15cbad37b23622bcdd7b298795` |
| dark / light / default | [dark-terminal-light-theme-default.png](native/linux/preview-backgrounds/dark-terminal-light-theme-default.png) | `7ab437cba95320c5fb6b875713ff6ab837c5713915065c9ea392d35808791da5` | `b33f7aff1f6c9cab403a1ed875ef8f9842903d01bc2d3adcfbc2caa8b4a930bd` |
| dark / light / ansi | [dark-terminal-light-theme-ansi.png](native/linux/preview-backgrounds/dark-terminal-light-theme-ansi.png) | `2b6bafc7e024791d07eb8cbc4ded4c7d725bd784c5a1ac9a5093b67f68601703` | `e6a7681d2aee8a4a58f2dc4b5f84f4ef01ad98eadc88b2aec402a37c6e05b67e` |
| dark / dark / default | [dark-terminal-dark-theme-default.png](native/linux/preview-backgrounds/dark-terminal-dark-theme-default.png) | `5b3e2d51cd720749b66e6b6360bae31d4546eff4cbce006628e3d07f9bc90a5f` | `768290a494ec034306b8175ef05a61beb47cce960375e7c316658eb994cf36b3` |
| dark / dark / ansi | [dark-terminal-dark-theme-ansi.png](native/linux/preview-backgrounds/dark-terminal-dark-theme-ansi.png) | `aff6d18cf76c41674ff1d4cc8fd5703cd95595d3fe8e4ad81c8038f858fd5508` | `67c58224889ab4e2429552b4697cd0a4041d00e6eebab3aa3303c9d37339d024` |

## 双语终端采集

`{native,external}/linux/languages/` 下十张图片重建安装包的真实 PTY 输出，采集于 2026-10-09，源为 `19c74739a5bc45ec93258a52dcc0a800228497d5`。实现候选在发行版本提升前仍报告 1.7.8，界面实现保留于 1.8.0。环境为 Linux 7.0.0-38-generic x86_64、CPython 3.14.4、Claude Code 2.1.295，使用 pyte 解码及 `archive/python/tools/render_native_capture.py`；终端 120×30，原生停靠区域裁剪 72 列，外部完整裁剪。原有 21 张物理截图与历史 PNG 保留原字节。

原生采集采用明确浅色终端／背景样本、Claude light 主题及 tmux 3.6；该路径宿主输出量化的 256 色样例。外部使用深色终端默认色样本及已记录 xterm 调色板。这些分析样本不读取物理终端的准确默认色。预览为不随翻译改变的固定数据。外部 PNG 元数据记录源提交、采集 SHA-256 和单元格裁剪范围；原生 PNG 元数据记录源提交和采集 SHA-256。字体为 DejaVu Sans Mono、Noto Sans CJK、Noto Sans Symbols 2。原生 transcript／输入框／私有路径已裁去。代理画面检查确认选中字段、分组页面、语言自称和快捷键行对齐，完整重绘后没有旧语言残留。自动／代理检查与人类及 Windows／macOS 终端验收分别记录。

| 界面／页面／语言 | 图片 | PNG SHA-256 |
| --- | --- | --- |
| native/main-zh-CN | [PNG](native/linux/languages/main-zh-CN.png) | `31f213011e040b1452966b603153393b39ce0ce9d33301a8059eea6a0daceeb2` |
| native/subagents-zh-CN | [PNG](native/linux/languages/subagents-zh-CN.png) | `994a981a60de6195fc2108b77cbd6ee3abd1fdd72c6e18a18d8d73b1e21fe868` |
| native/settings-zh-CN | [PNG](native/linux/languages/settings-zh-CN.png) | `b77825bdf985cdb484cb0b5b5c7de41bc1198ae8262409b4f8cb9cca5717be35` |
| native/layout-zh-CN | [PNG](native/linux/languages/layout-zh-CN.png) | `39c7a16f648c7c783474a837962a4b42a604a20ba948461235e619ff2de537db` |
| native/settings-en | [PNG](native/linux/languages/settings-en.png) | `933b3fc7d7951d76fb42a1220142fb50ef6e3530ce4c72f9dc2d42e2a08c2a7a` |
| external/main-zh-CN | [PNG](external/linux/languages/main-zh-CN.png) | `41e68336970c0e3ad000b9f41db00f9699fb24264fa8aa7a3626dd88f05d9384` |
| external/subagents-zh-CN | [PNG](external/linux/languages/subagents-zh-CN.png) | `8c3574a8e8bffb30eea7ffba960ff37d4885fdded4d5a640418bfdbbb5472149` |
| external/settings-zh-CN | [PNG](external/linux/languages/settings-zh-CN.png) | `113166e0bb2d6c70d52d324107c311f5d9691e8380d4e4d9af3f4779c656c53c` |
| external/layout-zh-CN | [PNG](external/linux/languages/layout-zh-CN.png) | `e8c04500d3a099ef51bbcbae34249a7561f3fe75c325122f0e555c9dc1f747eb` |
| external/settings-en | [PNG](external/linux/languages/settings-en.png) | `2e12522cf59a1fd4403d07b4e0c194870f51156041fa81ba804b8169a25888c8` |

原始采集／报告私有保存在忽略的 `dist/validation/i18n`；图片为输出重建，不是新增 OS 截图。外部英文选项在中文切回英文、强制完整重绘后采集。[行为与命令](../../../../USER_GUIDE.zh-CN.md#界面语言)。

## 状态栏语言采集

六张编辑器图片重建真实终端单元格，采用固定数据，不代表用户实时观测。后端 UI／渲染源码 `0786ad2` 打包为开发版 1.8.0；原生验收工具 `bc50d80` 在 Linux x86_64／CPython 3.14.4／固定 Claude Code 2.1.294 下通过。原生图片从 120×30 浅色终端裁剪配置区域，复用器将 RGB 量化为 256 色；外部图片保留 120×30 深色终端全幅、关闭颜色。两张实际 CLI 输出图片见 [statusline/README.zh-CN.md](../statusline/README.zh-CN.md)。英文界面配中文输出体现两种语言独立。代理画面检查与人类或 Windows／macOS 终端验收分开记录；原始日志和单元格继续忽略。

| 采集 | PNG SHA-256 |
| --- | --- |
| [原生主栏／英文输出](native/linux/statusline-languages/main-en.png) | `033434791c721d6b50bf580f6ab3325898d0cb627d8f0865f13651f226e6c135` |
| [原生主栏／中文输出](native/linux/statusline-languages/main-zh-CN.png) | `f349a37ddf851da1e7de0c255c9f7ce949cc783688848f9ea8ae6b5913b131a9` |
| [原生输出语言／英文](native/linux/statusline-languages/settings-en.png) | `0d0c53b9d7158696510c668c4c1fdd5d376ec039055d087ef5e1609efa20f130` |
| [原生输出语言／中文](native/linux/statusline-languages/settings-zh-CN.png) | `3ea6894f3d820d3aba9b5339851b65d4b0077da739c900090ea0061c6f580188` |
| [外部输出语言／英文](external/linux/statusline-languages/settings-en.png) | `fe5f01fb644d33bfdcb61aa49aa932c80151364b89f08650857517607df02749` |
| [外部输出语言／中文](external/linux/statusline-languages/settings-zh-CN.png) | `2dc86d94fdfadc9dc9d76f61c4fa28ab0d8721d8735d2cf8e479650c9b23e85d` |
