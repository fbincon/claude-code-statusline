# v3.16.0 语言编辑器图像

[English](README.md) | **简体中文**

这九张图像重建了在隔离 Linux x64 PTY 中运行的 v3.16.0 候选安装包输出：六张外部设置页和三张 Native 设置页。每张 PNG 都经过独立于自动化行为检查的画面检查。它们是终端重建图，不是操作系统截图，也不构成新增真人桌面／电源验收。

采集日期为 2026-10-30，源码为 [`6e86031ff1bfeb900c9c38dee58ca10194ab936d`](https://github.com/fbincon/claude-code-statusline/commit/6e86031ff1bfeb900c9c38dee58ca10194ab936d)。候选包：`fbincon-claude-code-statusline-3.16.0.tgz`，SHA-256 为 `6d6d955e3850e25c36705927e97ba8522d0bde83d60f1de32b8d229458501b68`。后续文档或发布提交不会改变这一采集身份。[图片、单元格、采集器、渲染器、字体与验证摘要](provenance.json) · [语言扩展交付记录](../../../development/language-expansion.zh-CN.md)。

| 语言 | 外部设置页 | Native 设置页 |
| --- | --- | --- |
| Español | [PNG](external/es/settings.png) | — |
| Français | [PNG](external/fr/settings.png) | [PNG](native/fr/settings.png) |
| Deutsch | [PNG](external/de/settings.png) | — |
| Português (Brasil) | [PNG](external/pt-BR/settings.png) | — |
| Русский | [PNG](external/ru/settings.png) | [PNG](native/ru/settings.png) |
| Bahasa Indonesia | [PNG](external/id/settings.png) | [PNG](native/id/settings.png) |

## 采集边界

环境为 Node 24.21.0、Claude Code 2.1.312、编辑器协议 31 和 200×50 单元的 `xterm-256color` 终端。外部图像保留完整视口，尺寸为 2424×1224 像素。Native 图像从零起点坐标 `(128, 4)` 裁出 72×40 单元的编辑器区域，尺寸为 888×984 像素。裁剪保留设置页、样例预览及全部页脚行，排除宿主会话正文、输入框、实际宿主状态栏和私人路径。

界面语言与样例输出语言相互独立。这些设置页图像有意保留英文输出，同时展示所选界面语言。样例通过生产预览渲染器和固定观测数据生成，目录仅显示基本名称，不反映真实账户用量。长标签和预览标题保留编辑器现有的完整字素截断和省略号。

记录的文字和样式保持不变。重建采用声明的深色终端默认值（前景 `#dedee7`、背景 `#17191e`）、渲染器的 rich ANSI 调色板，以及 DejaVu Sans Mono 常规／粗体、Noto Sans CJK 常规／粗体和 Noto Sans Symbols2。这些是明确的分析夹具，不是实体终端配色测量。

## 验证范围

同一候选包通过了 1,092 个安装文件的完整清单及字节一致性检查，以及两套编辑器各自的取消、保存、恢复共六条路径。每套编辑器的取消路径均遍历十二种界面语言，检查本地化目录搜索和有效的生产预览，并验证界面立即持久化与显示草稿相互独立。Native 还对每种语言检查了显示方案／项目及版本／安装入口的译文。保存、重新打开、读回与取消均已验证，全部六条路径均恢复了终端属性。

九个隔离偏好路径恢复了原始字节、权限及不存在状态。另行执行的只读 CLI 检查覆盖十二种输出语言、40／80／120 列的主栏与子代理行，共 72 组，另加已配置的状态栏命令。成功后临时夹具已删除。Native 子进程使用合成认证，在已验证无外部路由的网络命名空间中运行；记录的模型请求尝试与模型调用均为零。

这些安装包 PTY 观测及九张 agent 检查的图像，与完整 UI／输出组合矩阵、官方宿主容量测试、平台安装检查和真人实体验收分别记录。不声称经过母语者审校。已接受的 [issue #96 六项缺口](https://github.com/fbincon/claude-code-statusline/issues/96)仍未验证；发布身份与必需 CI 门禁由上方交付记录维护。

## 示例

![巴西葡萄牙语外部设置页](external/pt-BR/settings.png)

![法语 Native 设置页](native/fr/settings.png)

![俄语 Native 设置页](native/ru/settings.png)

## 重建与历史

使用已核验的源码、包、捕获单元矩阵和五种已记录字体，通过规范渲染器 `tools/acceptance/render-capture.ts` 重建。其编译后入口接受 `CAPTURE_JSON OUTPUT_PNG --commit FULL_SHA --bounds X,Y,WIDTH,HEIGHT --font FONT`，为五个字体文件分别重复 `--font`。外部图像使用裁剪范围 `0,0,200,50`，Native 图像使用 `128,4,72,40`。本次专用 PTY 驱动、原始 ANSI、完整单元格、合成宿主配置和恢复快照保留在被忽略的私有验证输出中，不包含在仓库克隆中。公开来源记录仅包含摘要与所选图像元数据，不包含私人绝对路径或会话正文。

[此前的六语言图库](../v3.1.1/README.zh-CN.md)、[地区图库](../regional/README.zh-CN.md)及[历史 Python 语言图像](../../languages/README.zh-CN.md)保留原始图片与证据。
