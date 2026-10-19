# 迁移后修复与交付

[English](post-migration-fixes.md) | **简体中文**

更新日期：**2026-10-19**（Asia/Shanghai）。已交付：**v3.1.3**。状态：按版本专属维护者决定 **DONE**。基线：`1fa57c9ebfbb6ee76a1258939c3211145d55f719`。[审查报告](post-migration-review.zh-CN.md)保留原触发条件、优先级及冻结 Python 参考。

## 修复覆盖

| 问题 | 实现及回归证据 |
| --- | --- |
| R01 | 私有桥接读取使用 bigint 及既有 Windows 原生卷／文件索引检查。Windows 安装包保存／取消现在传递请求、nonce、结果环境，并读取真实握手／结果文件；仍拒绝替换和重解析点。 |
| R02、R06 | 共用入口识别，把内置 npm bootstrap／shim 对应到自身绝对后端，不执行 PATH 程序来判断归属。当前安装的 PATH 入口可用，其他绝对安装绑定仍不属于当前安装。 |
| R03 | Doctor 校验 skill 完整字节、宿主选项和当前用户运行目录写入能力，清理私有探测文件，复用六语言诊断。 |
| R04、R05 | 非法任务 ID 类型经完整绘制路径仍不可用，缺省 ID 保持当前任务选择。两种语言参数写法均保留版本查询成功及空 stderr。 |
| B01、B02 | 等待边界使用当前 boot 采样，缺少执行开始证据不能成为可信零执行时间；测试分别检查总时间、原生时间、持久化、重载及绘制。 |
| B03、B04 | 文件替换后根据身份重置游标。精确磁盘身份在热窗口压缩及重启后保留，重放仅计入各字段真实新增值。 |
| B05 | mkdir／chmod／快照写入前检查备份祖先链，预置链接导致拒绝且不产生外部快照。 |
| D01–D05 | 双语对齐当前 schema／协议、筛选时禁止排序、Node 开发／验收、raw TTY 排查及 doctor 覆盖；明确版本的历史步骤仍保留历史语境。 |

主要修复在 `de9bf27`；`77b7ae9` 进一步要求执行开始时钟证据足够新、识别 npm bootstrap 绝对路径，并隔离 Windows 桥接采集器与安装包原生适配器。文档整理在 `f4af8d1`，版本专属发行身份在 `2044540`。以上通过 [PR #109](https://github.com/fbincon/claude-code-statusline/pull/109) 合并。

## 精确用量缓存与兼容

`statusline_usage_v2/state.json` 独立于旧 `statusline_state.json`，只读迁移旧文件。仍保留的精确 ID 可迁移；旧正数压缩基数已丢失身份，继续标记 `usage_incomplete`，采集返回不可用，避免把猜测值当精确总量。新会话建立完整新账本；安装无需恢复或删除旧缓存。

每个保留会话使用按内容寻址的哈希树分页，每页最多 5,000 个消息身份，保存消息 ID 及各字段精确整数最大值。热缓存最多 5,000 个 ID，保留 100 个会话。磁盘随保留的消息历史增长，会话淘汰时回收；不用概率过滤器或新增运行依赖。

分页及清单不可变，已有缓存锁内的原子缓存提交同时发布清单引用、总量和字节游标。缓存提交失败仅留下不可达分页，重试仍从上次已提交游标开始；提交成功后清理。转录不变时无需额外读取身份分页，重复显示项仍共享一次采集。

功能压力检查采集 100,000 条不同的正用量消息，压缩并重载后重放，总量仍为 100,000；热窗口保留 3,126 个 ID，精确索引使用 256 页。此检查验证计数及边界，不替代 D06 或 PERF-01 测量。

公共显示 schema 8、配置协议 12、运行协议 2、生命周期 schema 4 独立演进。内部 `start_observed` 将旧记录缺失的开始证据视为未知，不重写冻结任务总时间。Python oracle 保持冻结；完整开始事件对照先断言新增证据正确，再仅从历史格式比较中移除该内部字段。

## 验证与发布门禁

本地开发检查共 1,001 项测试：997 项通过、4 项原生平台跳过；生成资源、双语文档、归档完整性及三份责任清单均通过。下述三轮源码绑定 CI 的完整矩阵均已通过，运行时回执使用 Node 22.0.0、22.23.3、24.0.0、24.22.0。

要求本地 `npm run check`、最终 PR head／main／tag CI、八个安装目标、32 个 Node 环境及十三个正式宿主。Windows 安装包桥接必须通过 Node 24.0.0 及其他选定运行时；Linux 注入及 PTY 不代表 Windows 桌面或人工验收。

[v3.1.3 专属决定](../releases/approvals/v3.1.3.json)仅接受原有六项缺口，决定的 SHA-256 为 `7a43f5080f3fb32252b5ce1f225f719a7135112cc66d9619cb50939d608e5d13`；本地 stable readiness 使用最终标签的 53 份安装／运行时／宿主回执通过核验。新增功能失败仍阻止发布。TS-01–TS-06 保持 DONE，D06 保持 FAIL，PERF-01 保持 NOT_STARTED。本轮不调用付费模型或切换个人安装。

已按[发布流程](../RELEASING.zh-CN.md)验证两次独立构建／源码重建、草稿附件，使用 OIDC 发布 npm，发布 GitHub stable／Latest，并以显式非强制 refspec 同步 Gitee。最终源码、CI、产物摘要及下载证据见下文。纯文档回执不能替代发行矩阵。

## 最终源码及产物身份

已审查 PR head 为 `77b7ae962ba9648234b719de5cbc6785cf71338d`。发行源码为合并提交 `05c5328d5d13488f3366ae6fdd30af4a55b3b22c`；注释标签 `v3.1.3` 的对象为 `d5e7cb5f22a78c2f45109c0adad5846b9e2193f8`，指向该提交。[最终 head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39193260622)、[合并 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39194981198) 和[标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39195509842) 每轮均通过全部 56 项必需作业，仅跳过不适用的纯文档作业；每轮包含八个安装目标、32 个运行时环境、十三个宿主及汇总门禁。

最终标签的 Windows 2025 x64／Node 24.0.0 回执确认真实 request、started、result、save、cancel 全部通过，并绑定发行源码包摘要。这是 Windows 安装包 CI 证据，单独披露的桌面／人工缺口继续保持未验证。

已替代的[初次 PR 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39192772373)因 Windows 采集器父进程同时加载工作区及安装包的 Koffi 适配器而失败。采集器现使用源码适配器，子进程执行安装包桥接；最终 head 已通过真实 request／started／result 及保存／取消流程。失败运行单独保留，不计为通过证据。

两次干净构建和两次从交付源码独立重建的四个文件逐字节一致，合并 CI、标签 CI 候选包、GitHub 草稿回下载及 OIDC dry-run 包与本地产物相同。草稿包的 673 个文件校验及十项隔离离线安装检查全部通过。构建身份为 Node 24.21.0／npm 11.19.0。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.3.tgz` | 3,458,440 | `fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0` |
| `claude-code-statusline-3.1.3-source.tar.gz` | 23,717,106 | `90ddbe59d39203345b68c8168091d704c642b26714f59d0d2e665962021d2751` |
| `build-manifest.json` | 952 | `a237053d1f7b7e978ea701e62b65855886e8c3a8a597b40b626ba545ecdb5b08` |
| `SHA256SUMS` | 302 | `02c2703ad8b247204c09f7ae78b990a83df215a7449f740440fc9329b624fe94` |

npm integrity：`sha512-0e94wUauEg/9nyF3ERTExxM26biKLwhnPtSsCf9iKNlN/E0KPsFncWH/Nc3FHFnABjiMwVF1v1c/d05/iLrOTA==`。SHA256SUMS 列出另外三个文件，其自身摘要见上表。

## 安装包终端证据

最终源码扩展采集器通过 168 个真实安装包页面／状态帧及 336 张明暗重建图，覆盖六语言、四页面和七种边界尺寸，包括选择器引导、正文／预览、详情／编辑／搜索／分类／数字／审查状态，以及 vt100／vt220／xterm-mono 禁色和原有 dumb 终端拒绝行为。配置字节及终端属性保持正确，模型调用为零。采集报告 SHA-256：`7fc46e41448d3c7b2b09e765eb94f6ee2fd11deb7c168bfa1716fc0be4e0af7f`。

这是 Linux x64 使用固定 DejaVu Sans Mono 和 Noto Sans CJK 字体的终端单元格重建，不代表桌面截图或人工验收。已抽查重建帧；重建字体的 emoji 缺字与代码点、字素及终端单元格断言分别记录。原始流、单元格、图片及回执位于忽略的验收目录，不进入发行附件。

## 公开交付

| 渠道 | 核验结果 |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.3) | 元数据时间 `2026-10-19T04:08:43.129Z`；latest=3.1.3、beta=3.0.0-beta.1；公开 SHA-256／SHA-512 一致 |
| [GitHub stable／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.3) | Release 416878136，发布于 `2026-10-19T04:09:50Z`；四附件一致，非草稿、非预发布 |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.3) | Release 1217595，创建于 `2026-10-19T12:10:10+08:00`；四份匿名下载逐字节一致，673 个包文件校验及十项离线安装检查通过 |
| [公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39198087057) | Linux x64／Windows x64／macOS ARM64 在 Node 22.23.3／24.22.0 上六项全部通过；每项以空缓存、禁生命周期脚本安装精确 3.1.3 及 latest |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39197699186)通过后执行[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39197845754)，实际回执记录 `published`、发行源码、标签 CI 及精确包摘要，无需发布重试。本地公开下载检查另行验证两个选择器，并核对 GitHub／npm 的全部交付字节。

Gitee 双语说明使用真实附件地址，保留 GitHub 原始发布时间。元数据更新包含原标签／名称及 stable 标记，重新读取已确认正文、身份及附件清单一致。

GitHub 保持主仓库。Gitee 同步先检查祖先关系，再使用显式非强制 main／tag refspec；标签对象及剥离后的源码与 GitHub 相同。Gitee 自动生成的仓库归档与四个交付附件分别核对。交付文档后续 PR 不移动公开标签或替换附件。原有六项实机／桌面／声明缺口继续保持未验证／不可用；D06 保持 **FAIL**，PERF-01 保持 **NOT_STARTED**。
