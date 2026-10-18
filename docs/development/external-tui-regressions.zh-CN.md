# 外部 TUI 迁移回归修复

[English](external-tui-regressions.md) | **简体中文**

更新日期：**2026-10-19**（Asia/Shanghai）。已交付：**v3.1.2**。状态：按本版维护者决定为 **DONE**。

## 基线与范围

独立审查固定 Python v2.0.0 为 `9b6d2fab4bf165be280d428a874521bfbf02c7e1`，TypeScript v3.1.1 为干净 `main` 的 `fb07615bb041d4433865f20317a6eb85d988e4a4`。Python 源码直接导出自该提交，不默认当前归档完全相同。[v3.1.1 交付记录](external-tui-parity.zh-CN.md)作为历史保留，不作为所有交互均正确的证明。

维护者批准修复六项已确认回归并正式交付 npm／GitHub／Gitee。公共命令、协议 12、显示 schema 8 及各自独立的 Save／偏好契约保持兼容。两个基线共有的尾部文字编辑、搜索长度／字素边界限制保留为遗留问题。Python 归档、冻结 fixture 和比较豁免均保持原样；README 继续承担产品介绍。

## 修复与回归证据

| 回归及最小操作 | 修复和断言 |
| --- | --- |
| Main Ctrl+A，选 `task-active-timer`，Ctrl+E；Subagents 中用 `status`：说明页可能解引用缺失实例并关闭编辑器 | 选择器说明及标题按目录作用域／类型解析，省略实例字段，真实实例表单单独处理。绘制全部目录类型，覆盖缺失实例、自定义 ID 重名、六语言和边界尺寸；断言草稿、磁盘字节和后端预览次数不变。 |
| 添加文字组件，Ctrl+E、Enter：首次编辑误改标签而非正文 | 按实际字段选择文字正文、普通组件标签或说明。两个作用域均通过按键覆盖中日韩、组合字符和 ZWJ 原始输入、生产预览、取消、保存及重开。 |
| Settings Home、Down ×15、Tab、Shift+Tab：Labels 与滚动位置丢失 | 独立记忆 Settings／Layout 字段，详情使用临时焦点，替换草稿后归一化已失效字段。断言双向往返、详情导航、带未提交输入的 resize 及布局引用删除。 |
| Settings Home、PgDn，64×18 时跳过 Statusline theme；其他表单也受影响 | 按分组视口实际容纳的字段翻页，反向同样计入标题占行。断言 64×18、80×24、120×30 的固定 Python 目标、Layout／详情目标及列表原有翻页行为。 |
| `TERM=vt100`、`vt220`、`xterm-mono` 仍输出显式颜色 | 在 COLORTERM 提示前识别单色，保留 NO_COLOR 存在即优先、linux 八色及既有 16／256 色映射；检查 ANSI reset、产品样式和实际安装包 CLI PTY。 |
| Warning 89／Critical 90，Right 后 Left：有效值 88 仍残留错误 | 共享内部调整函数返回成功状态；外部状态仅在成功后清除对应的本地化表单错误。重绘、失败修改及无关后端／审阅通知保留应有消息。 |

新增产品测试先在未修改实现上出现八项失败。修复后，外部产品测试 22 项和定向协议／发布／CI 测试本地全部通过。完整最终提交验收及公开交付结果记录在下方，定向通过没有替代完整门槛。

安装包 `capture:editor -- --extended` 采集器新增两个作用域的选择器说明、文字正文／预览、Settings／Layout 焦点恢复及四种单色 TERM；保留样式单元断言、审阅状态、七种边界尺寸、六语言、配置字节和终端恢复检查。明暗图像使用固定字体重建记录的终端单元，不作为操作系统截图或实机／人工验收。

首轮 PR 捕获已完成全部六语言／页面序列及三种单色 PTY，随后因采集器错误地等待 `TERM=dumb` 的 TUI 首帧而失败。既有 POSIX 入口会在 raw mode 前明确拒绝该终端；采集器已改为要求 ANSI／VT 提示、退出码 2、配置不变及终端属性恢复，vt100、vt220、xterm-mono 仍要求真实帧和正常取消。失败记录单独保留，只有最终源码完整捕获通过才计入验收。

## CI 与发布边界

普通 PR／push 仅修改根目录 README／CHANGELOG Markdown 及 `docs/**/*.md` 时，运行文档链接／双语及空白校验。未知路径、可执行文件、生成资源、版本身份、批准 JSON、工作流、标签和手动运行均要求完整候选矩阵。重命名检查两侧路径，缺失／无效 revision 默认完整矩阵。既有 Complete candidate evidence 门槛拒绝分类失败、缺失／跳过／失败的产品检查及失败文档检查；纯文档运行不产生发布回执。

v3.1.2 要求最终 head、合并和标签验收：八安装目标、32 项 Node 22／24 和十三固定宿主均绑定相同包摘要。独立双构建、源码包重建、安装包 PTY、草稿附件和公开下载继续作为门槛。批准日期／路径逐版本严格匹配，跨版本批准、日期错误或扩大缺口范围均拒绝。

[v3.1.2 专属批准](../releases/approvals/v3.1.2.json)接受相同六项既有缺口：macOS 实机睡眠、macOS 14 Intel 桌面／电源、Windows 10 桌面、WSL 桌面／弹窗、其他目标人工／电源检查、Claude 2.1.296 精确声明。仍为未验证／不可用，不豁免新增功能或自动化失败。D06 保持 **FAIL**；PERF-01 保持 **NOT_STARTED**。

## 最终源码验收与身份

[PR #107](https://github.com/fbincon/claude-code-statusline/pull/107) 合并为 `ac64af37775d80a80063ff98bb23dd1e6e8c7b0c`。注释标签 `v3.1.2` 的对象为 `8c8f1f1e973d6531fd87c61170d7ed025c1c021a`，指向该源码。[最终 head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39156249499)、[合并 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39157934989)和[标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39159653022)要求同一完整矩阵。三轮最终源码运行各通过 56 项必需作业，仅跳过不适用的纯文档作业；八目标／32 运行时／十三宿主矩阵及汇总均首轮通过。

本地检查 987 项：983 通过、4 项预期平台跳过、无失败；36 项生成资源、2,215 条文档链接、冻结归档和三份职责台账通过。新增 18 项测试覆盖产品行为、真实协议持久化和 CI 分流。32 项运行时回执使用 Node 22.0.0、22.23.3、24.0.0、24.22.0。本版批准 SHA-256：`9dec23ed27353c6e01732688c1b8323fb37fa964444e3198eca42b7b43fd26ef`。

干净双构建及交付源码包的两次独立重建，四个文件逐字节一致；合并 CI 候选文件及下载的 GitHub 草稿附件也一致。下载的草稿 tgz 核验 670 个包文件，十项隔离离线安装检查通过。构建身份保持 Node 24.21.0／npm 11.19.0，最终文件摘要见下表。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.2.tgz` | 3,451,682 | `34a07be584e657052402f6d874d83217c659d26f49fad2e0c53c8a0a49c815e3` |
| `claude-code-statusline-3.1.2-source.tar.gz` | 23,707,948 | `dea3f134b00d05857a934ff862b7efae19059cba0667603bb6739537bf79e1c4` |
| `build-manifest.json` | 952 | `2a5aef16253a7801591900b38e1cdac078acd8211c2cef285ed25de23f29df7e` |
| `SHA256SUMS` | 302 | `3a78a8093d1d57fe827eecca238484a57dc43723f104508809b138ba808a3b31` |

npm integrity：`sha512-kFjPdlknTk7fRb5kg1cUcLVuFS0AArKXHi1h+o7GSYNHmtdrcE16HTdFgAJZ7fT/5WZquEbUzb7MbQG001MTtA==`。SHA256SUMS 列出其他三个文件，其自身摘要记录在表中。

## 安装包终端与状态覆盖

最终源码采集通过 168 张实际页面／状态帧、336 张明暗重建图，覆盖六语言、四页面、两个作用域的选择器说明、文字正文／预览、详情／编辑／搜索／分类／数字／审阅状态和七种边界尺寸。额外三组 PTY 验证 vt100／vt220／xterm-mono 在真彩提示下仍不输出显式颜色，第四组验证既有 POSIX dumb 终端拒绝。配置字节及终端属性保持原样。最终采集报告 SHA-256：`08c3307b4d23fe5215846fa49deea5d008a4214a94524bb4b90d0979930d12d6`。

采集环境为 Linux x64、kernel 7.0.0-38-generic、xterm-256color，字体为 DejaVu Sans Mono 常规／粗体、Noto Sans CJK 常规／粗体及 Noto Sans Symbols2，记录字体摘要并使用固定明暗重建配色。这些字体在 SVG 重建中存在 emoji 缺字；码点、字素边界和终端单元另有断言，不据此宣称所有实际终端／字体或实机／人工验收通过。原始流、单元、图像和回执保留在隔离临时证据中，不进入源码或 Release 附件。

与最终 PR 捕获相比，324 张图像字节一致；12 张展开审阅图因新实例 ID 及换行而变化，六语言归一化审阅内容一致。最终图像和具体单元样式另行抽查；没有新增通用图片全等豁免，也未改变冻结 fixture。

安装包 `/statusline-configure` slash-hook → tmux 弹窗通过普通取消及 Main／Subagents 选择器说明流程；每次均保持配置不变、清除租约，底层终端可继续使用且属性恢复。宿主只提供合成版本信息，并非真实桌面对话；模型调用为零。协议测试及操作回放还覆盖预设、立即保存的 UI 语言偏好、导出、导入审查接受／取消、实例身份／覆盖／布局保存、revision 冲突及预览重试。

| 范围 | 证据 | 保留边界 |
| --- | --- | --- |
| Main／Subagents／Settings／Layout 及上下文状态 | 产品回归、安装包 PTY 单元及源码绑定矩阵 | 代表性组合，不宣称完整笛卡尔积穷举 |
| 样式、整条分隔线、选中和溢出 | 样式跨度、完整终端线段／单元、单色／基础色断言及重建抽查 | 终端色板／字体及人工桌面检查仍按缺口处理 |
| 按键、焦点、翻页及原始文字 | 精确目标字段、两个文字作用域、resize／输入保留及安装包按键流程 | 双方共有的尾部编辑／搜索限制保持遗留分类 |
| 草稿、预览及持久化 | 协议／磁盘／重开断言、保存失败／冲突／恢复测试和隔离安装检查 | 未使用个人安装或配置 |
| 语言及 Unicode | 六语言边界捕获和 Unicode 一致性／产品断言 | SVG emoji 回退不作为真实字体效果验证 |
| 入口／生命周期／平台 | 直接 CLI、合成 slash／tmux、信号／resize／清理、八目标／32 Node／十三宿主 | 六项本版本接受缺口保持未验证／不可用 |

## 公开交付

另通过实际安装的公共 `.bin/claude-statusline` 启动器，在真实 PTY 中打开选择器说明并取消，配置字节及终端属性均保持原样。

| 渠道 | 核验结果 |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.2) | `2026-10-18T20:04:48.077Z` 公开；latest=3.1.2，beta=3.0.0-beta.1；匿名下载 SHA-256／SHA-512 一致 |
| [GitHub stable／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.2) | Release 416660752，`2026-10-18T20:07:27Z` 公开；四个附件一致，非草稿、非预览 |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.2) | Release 1216983，`2026-10-19T04:08:21+08:00` 创建；同一注释标签，四个匿名下载附件一致，十项离线安装检查通过 |
| [公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39161871568) | Linux x64／Windows x64／macOS ARM64 的 Node 22.23.3／24.22.0 六项全部通过，每项用新缓存、禁用脚本安装固定 3.1.2 和 latest |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39161352173) 先通过，[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39161493210)随后通过。发布回执记录 published、源码／标签 CI 及精确包摘要，无需重复发布；本地公开下载另行通过两种选择器及 GitHub／npm 文件核验。

Gitee 自动仓库归档与交付的四个附件分开核验。首次说明 PATCH 因漏传 API 必需的 tag_name 返回 400，未改变元数据；读取现有 Release 确认正文未变，补齐原 tag_name 和正式版标志后，双语说明成功更新。标签对象及附件保持一致，没有重复上传。

GitHub 保持主仓库。检查 main 无分歧后，用明确的非强制 refspec 同步 Gitee main 和同一注释标签；交付文档后续提交不移动公开标签，也不替换附件。项目 README、历史发布、beta 和个人安装保留。六项接受缺口保持未验证／不可用；D06 继续 **FAIL：104 通过／60 失败／28 不确定**，PERF-01 继续 **NOT_STARTED**。
