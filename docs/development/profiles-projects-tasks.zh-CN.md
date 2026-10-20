# 显示方案、项目选择与任务检查

[English](profiles-projects-tasks.md) | **简体中文**

实现基线为 v3.3.0 交付后的 `58cafcc1f85aadd566a1c926549880814d3722a2`。用户契约见[方案管理](../PROFILES.zh-CN.md)和[任务详情](../TASK_DETAILS.zh-CN.md)。

## 架构与契约

Core 定义完整显示方案、稳定身份、编辑目标、共享编辑器管理器及纯任务详情投影。Platform 解析原生目录身份并提供有界只读文件能力。CLI 协调既有配置事务和读取模型。外部 TUI 与原生 Client 适配同一个方案管理器；原生任务详情使用独立窗格，仍属于既有 native Mod。

编辑器协议 15 增加 `profiles_read`、`profiles_apply`、`profile_import`、`profile_export` 和 `task_details`。`read`、`apply` 可接收显式目标，结果包含编辑目标、匹配根、回退原因及共享绑定。原有不带目标的操作维持用户默认行为。生成的原生请求／解析器对全部操作进行实际后端验收。

版本 1 集合在同一个用户文件内保存方案和项目绑定。显示 schema 8、运行协议 2、生命周期 4、portable 1 及 UI 偏好 1 不变。方案仅保存 DisplayDraft；既有默认文件保留独立快照和降级路径。新增文件纳入现有恢复允许列表及导出保护。

目标 revision 覆盖方案库、选定配置、安装身份和目标。另存为与绑定在同一次事务中完成；读取不创建方案库。渲染解析不加载管理模块，不查询 Git 或网络。关闭自定义代理显示时不输出覆盖行，即使其他项目需要共用入口，也保留宿主默认行。

## 只读任务证据

检查通过有界诊断文件能力读取已知会话的任务／运行状态文件，再复用生命周期解码、快照指标及计时规则。不调用采集器、不协调绑定、不建立新的生命周期存储。

会话身份必须明确；当前指针、唯一 prompt 别名和已发布归属决定选择。缺失／歧义关联、未来快照、等待不完整和计时未知保持可区分。父子关系来自可归属元数据，缺失或循环关系不会被构造成完整树；每个来源保留自身观测时间。

原生按需代理名称单独提供，只与可归属 ID 关联且不持久化。跨文件快照非原子，既有有界存储不代表完整历史；界面支持按各终端宿主验证。

<a id="验证记录"></a>

## 验证与交付记录

于 2026-10-21（Asia/Shanghai）发布 [v3.4.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.4.0)。[实现 PR #117](https://github.com/fbincon/claude-code-statusline/pull/117) 与[任务证据修复 #118](https://github.com/fbincon/claude-code-statusline/pull/118)交付源码 `ea2dbde01808dbc85472e70d3d7cb994aa2b2d7e`；附注标签对象为 `aa2434de27aee31d81e03e6292b8df80403dc7e0`。

最终修复的本地 `npm run check` 共 1,076 项测试：1,072 通过、4 项平台跳过、零失败。41 个生成资源、2,567 个文档链接、历史归档完整性及迁移台账均通过。公开安装包使用 Node 24.21.0/npm 11.19.0 构建。

| 最终门禁 | 证据 | 结果 |
| --- | --- | --- |
| 修复 PR 头提交 `605ae945aae329f64965d3683a8ca22954455972` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39460986472) | 第三次尝试通过 |
| 合并主线 `ea2dbde01808dbc85472e70d3d7cb994aa2b2d7e` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39468216307) | 第二次尝试通过 |
| v3.4.0 附注标签 | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39475852091) | 首次尝试通过 |
| npm OIDC 演练／发布 | [演练](https://github.com/fbincon/claude-code-statusline/actions/runs/39479689073) · [发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39480001991) | registry 处理完成后通过；已存在的包字节验证一致 |
| GitHub/npm 公开下载验收 | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39481989578) | 六个作业通过；十二次初始空缓存安装通过 |

每次最终完整 CI 均要求八个安装目标、32 个 Node 22/24 用例、十三个固定 Claude 宿主及汇总验收。代码／标签运行中的纯文档作业按设计不适用。稳定版准备检查将所有回执绑定到精确源码和安装包，并读取本版本六项缺口决定。

两次独立构建、交付源码归档的两次重建及 main／tag CI 包所得安装包／源码／清单／校验文件逐字节一致。此前一次本地打包遇到 registry TLS 连接重置；失败文件和日志已保留，后续通过既有代理重建完成，证书验证保持不变。四个 GitHub 草稿附件在发布前重新下载并验证。本地、草稿下载包和 Gitee 下载包分别通过十项安装检查，涵盖已安装产品中的方案／项目／任务场景。

最终安装包在 Linux Claude Code 2.1.294 上通过严格验证、精确宿主声明、124 项原生测试及 14 项运行测试。实际终端走查打开方案管理、返回编辑器、保存／完成，再打开只读任务窗格，模型调用为零。终端解析补充了水平绝对光标定位，原生增量重绘能在重建证据中正确显示。

最终安装包生成 **444** 个六语言扩展 PTY 捕获，其中 48 个覆盖方案管理。报告验证终端恢复及设置／显示／方案文件字节不变；最终方案切换和任务窗格的选定画面经过检查。自动捕获和 Agent 画面检查与真人桌面、实体电源验收分开记录。捕获报告 SHA-256 为 `d5460d0641d07e0bfe0294c45744c6d1901cbea0f1303816cc861860e191692e`。

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.4.0.tgz` | `373e73191e75d5e18dfe5f9372b25ee69c85fb3af713650f7fb7c5e84ddf53c7` |
| `claude-code-statusline-3.4.0-source.tar.gz` | `096ec316d0847bdec61550613da92afeb42b7121b532def364d7f45170c77977` |
| `build-manifest.json` | `679618805e8710a835c4d50e95140d9ede8d761d367d3e4d00abc1e46505a5f1` |
| `SHA256SUMS` | `e1eb8d2d8c61cecc1b6f64266de319914c6655ec2a507af0d91ddd99cbc7d240` |

[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.4.0)、[GitHub](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.4.0) 和 [Gitee](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.4.0)交付相同安装包字节。GitHub Release `418602053` 于 `2026-10-20T19:16:04Z` 公开，Gitee Release 为 `1224016`。npm `latest` 指向 3.4.0，`beta` 保持 3.0.0-beta.1。Gitee 四个附件通过匿名下载、正常 TLS 证书验证、逐字节比较及仓库外安装。

### 修正与恢复

公开发布前检查首个合并候选（`3bfad2ba6c30bbdd3f5a210f9617c1167ab973a1`）时，发现其他任务的心跳可能刷新旧的未完成任务并继续累加耗时。该候选没有公开发布，标签 CI [39454778493](https://github.com/fbincon/claude-code-statusline/actions/runs/39454778493)已取消，#118 补充来源范围、新鲜度、未来观测及终态事件优先级检查。新最终门禁通过后替换未发布标签及私有草稿；旧候选回执保留为已被替代的证据。

修复 PR 首次运行只剩 Node 24.0.0／macOS 26 ARM64 未完成，其等待 runner 超过 25 分钟。随后取消该次尝试并只重新调度未完成工作，保留已通过检查。第二次尝试中，GitHub 明确报告托管 macOS ARM64 容量不足，在执行前取消该作业；汇总门禁正确拒绝缺失证据。第三次尝试获得 runner，在相同源码和安装包上通过缺失用例及汇总检查，未放宽任何检查。

最终 main 首次尝试中的 macOS 26 Intel 安装作业，在隔离安装通过后停滞。完整检查步骤运行已超过 30 分钟，多次读取实时页面时，日志末尾均为 README 格式测试，尚无结束汇总。普通取消未能完成，随后通过强制结束请求关闭运行。GitHub 未提供完整日志归档，因此保留实时页面可见摘要和作业元数据；重试前该目标没有部分产物。第二次尝试通过了完整安装作业和汇总门禁，源码、安装包和验收规则不变。

npm 在 `2026-10-20T19:03:19Z` 接受 OIDC 上传并签署[来源证明](https://search.sigstore.dev/?logIndex=3342264198)。registry 于 `2026-10-20T19:07:29.384Z` 完成公开处理，晚于发布脚本的有界等待窗口，因此首次作业在上传后可见性检查处失败，没有生成 publication JSON 产物。随后独立匿名下载核对了 SHA-256／SHA-512，并确认 `latest=3.4.0`、`beta` 不变。成功的工作流重试识别了已存在的相同版本（`already-published`），未再次上传，也不宣称重新验证了 OIDC 身份认证。原始上传日志和 `npm-registry-verification.json` 分别保留上传与验证证据。

#117 较早一次 Windows 运行中，CLI help 断言已通过，随后文件级 Node 测试进程失败，日志未提供退出原因。后续最终 Windows 运行通过，未减少检查；原始日志保留，不推断未知原因。

首次 Gitee 上传已完成安装包，随后源码归档传输遇到 TLS 错误。检查远端确认只有安装包附件存在；新客户端补传了三个缺失文件，没有替换已有安装包。传输使用当时的原生网络接口、重新解析的公网地址及正常证书验证。四个匿名下载文件均一致，下载包通过全部十项隔离安装检查。

原始报告、已替代候选及回执保存在 Git 忽略的 `dist/validation/v3.4.0/`。发布后纯文档补录只执行必要链接／格式检查，不重跑平台矩阵。本地路线历史归档保持原始字节。

## 既有缺口

[v3.4.0 专项维护者决定](../releases/approvals/v3.4.0.json)仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有观察。它们保持未验证；新增功能、失败检查和缺失自动化回执不被豁免。CI、PTY 重建、Agent 视觉检查、真人桌面及实体电源证据继续分别记录。
