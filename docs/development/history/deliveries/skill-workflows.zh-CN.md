# 内置配置技能工作流

[English](skill-workflows.md) | **简体中文**

> **历史记录（冻结于 v3.16.3，2026-11-05）。** 当前行为见[开发指南](../../README.zh-CN.md)及[路线图](../../roadmap.zh-CN.md)；当前接口版本见 [CLI 参考](../../../reference/cli.zh-CN.md#协议与-schema-版本)。

<a id="final-release"></a>

## 验证与发布证据

本记录跟踪 v3.16.3 对 `packages/cli/resources` 中两份规范 skill 模板的修复。

已于 **2026-11-05** 发布：[npm 3.16.3](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.16.3)、[GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.3) 和 [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.3)。产品源码 `0d8b928fd7ff6b83af49e9c590c01087021a6a20` 通过 [PR #206](https://github.com/fbincon/claude-code-statusline/pull/206) 验收。双父 main 合并提交为 `4791ea88157ae696097b63a9c0158ef7c0df9956`，树相同。注释标签 `v3.16.3` 对象为 `830e3afa65428b0bc5ab84dc9709e4eb97623073`，按完整源码发布路线指向验收通过的产品源码。本文档收尾不改变已发布标签、字节或原始验收。

### 原始检查与证据晋级

| 证据 | 已核验结果与身份 |
| --- | --- |
| 本地检查 | `npm run check` 共 1,671 项，1,665 通过、六项预期平台跳过；技能专项回归 21/21。生成 118 份输出。生成一致性、文档（4,518 个链接）、whitespace 和冻结归档检查均通过。 |
| 最终产品 PR | [运行 41960181915，第 1 次](https://github.com/fbincon/claude-code-statusline/actions/runs/41960181915)成功；必需汇总 `127061199788`，候选制品 `13384712855`，验收制品 `13389767502`。 |
| 完整产品义务 | 八个安装目标、32 个 Node 用例、十六个固定宿主、每个适用宿主 313 项容量用例，十二种语言各 2,324 个键全部验收通过。全部 56 项安装／运行时／宿主历史义务保留完整深度，`stable_ready` 为 true。 |
| main 集成 | [运行 41972029217，第 1 次](https://github.com/fbincon/claude-code-statusline/actions/runs/41972029217)成功；必需汇总 `127063627383`，晋级制品 `13390371812`。集成冒烟与字节核验保留原始 PR 执行身份。 |
| 注释标签 | [运行 41972672998，第 1 次](https://github.com/fbincon/claude-code-statusline/actions/runs/41972672998)成功；必需汇总 `127064993023`，晋级制品 `13390666471`。共同核验源码、main、标签对象和原始覆盖。 |
| 可复现交付 | 两次独立候选构建，以及从交付源码进行的两次构建，四件文件均逐字节复现原始 CI 文件。 |
| 公开验证 | [运行 41975586480](https://github.com/fbincon/claude-code-statusline/actions/runs/41975586480)七个作业全部通过：签名／来源证明，以及 Linux、Windows、macOS 的 Node 22／24 下载与安装。 |

候选和验收制品 ZIP 的 SHA-256 分别为 `42867b78d5e5f65c042cce1cc20bbc5ad828a2d7ee44ebd4b39da6789176764e`、`2eb6a602e89e208bef2a9c8b579a0f889a78333de2dd48b8671ef8bbb94e6c5d`。main 和标签晋级 ZIP 分别为 `add3363dfad3c955cb95cf5585eadde97bc4e7854b8bc704687f17aa36ed27f9`、`77466f62d0c9b44f6a3b9590b4cb83782bff5aa4fd3b8a4dcb2542719bbdee61`。原始源码验收记录的 SHA-256 为 `84093a8d59779f2de4ccee4d478582bde1fe29ba2bdfe84268ada413cd5b13d0`。已被替代的源码运行及手动诊断不能替代这些身份。六项本地场景在冻结的最终源码上全部通过，当时已在运行的完整矩阵随后完成；私有驱动修正没有再次触发产品矩阵。

### 实际安装后的技能调用

六项场景均在同一源码／安装包、Claude Code **2.1.318** 上通过。任务专用私有驱动以 SDK **0.3.296** 控制答案和观测，实际调用已安装的 slash 技能，没有粘贴模板正文。命令记录、配置字节／权限及备份证明结果，模型叙述不作为保存证据。

| 场景 | 问题数；Bash／Read／Ask 调用 | Apply／新增备份 | 观测结果 |
| --- | --- | --- | --- |
| 英文保存 | 42 问，全部 32 个指标页各一次；9／3／11 | 1／1 | 保存所选用户默认／宿主变化；绑定方案的字节／权限、已有顺序、自定义标签和未询问外观均保留。所选页之外的当前语言被保留，关闭颜色后仍保留 ANSI palette。 |
| 中文保存 | 42 问，全部 32 个指标页各一次；9／1／12 | 1／1 | 中文问答保存韩文输出语言并追加 hostname，其余字段、palette 和子 Agent 选择保留。 |
| 取消 | 4 问；6／3／1 | 0／0 | 原配置字节、权限和缺省文件状态保留。 |
| 组件组 | 0 问；2／0／0 | 0／0 | 提问前停止，分组结构及原字节／权限保留。 |
| 跨行对齐 | 0 问；2／0／0 | 0／0 | 提问前停止，对齐结构及原字节／权限保留。 |
| 禁用 Hook 后的外部回退 | 0 问；0／0／0 | 0／0 | 实际 `/statusline-configure` 回退给出终端指引，没有工具调用或写入。 |

私有六场景摘要 SHA-256 为 `f32e3a1c413c447c09ad3036a11d25d6acd54d5d1d8f616949cd6c70555c1350`，绑定每份报告、驱动、源码、宿主、包及请求身份；原始日志保持私有。此前模型及私有驱动失败仍作为独立失败诊断保留在共用账本中。驱动修正涵盖本地化答案、palette 问题分类及 Bash 字面引用，私有检查和重放验证通过，没有修改冻结的产品源码。

### 发布字节与 npm 来源证明

| 原始交付文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.16.3.tgz` | 5,173,691 | `7b5d8c122b074937ded4d574cfbf0fcac5b76df6d420622cc4ef69f3283c733c` |
| `claude-code-statusline-3.16.3-source.tar.gz` | 36,870,359 | `dbf1ce5d12cf840e7db67808d9ea3ea6457afcb6574f2002149b157abd76cd09` |
| `build-manifest.json` | 955 | `6af8efcfeebf07027523b04d05236742c876ddd26f5f99bb767271ff84704cdb` |
| `SHA256SUMS` | 304 | `768250bb41afdbab02be41e07b2c1e4036444d933366d4af5cd64da223c4048c` |

[npm 准备 dry-run 41973758527](https://github.com/fbincon/claude-code-statusline/actions/runs/41973758527)通过。[实际 OIDC 运行 41974310603](https://github.com/fbincon/claude-code-statusline/actions/runs/41974310603)第 1 次、发布作业 `127069916672` 上传原始 CI 包并签署来源证明（[透明日志 3692636488](https://search.sigstore.dev/?logIndex=3692636488)）。npm 已接受上传，但公开可见性超过核验器三分钟窗口。匿名元数据、精确包字节／integrity 和选择器核验后，只重试失败的发布作业。第 2 次、作业 `127072319582` 以 `already-published` 通过，没有再次上传，记录 `oidc_verified: false`。已有版本路径未生成新的 npm-publication 回执。原始 OIDC 发布／日志与仅核验的重试各自保留身份。

公开 npm 包等于原始 CI tgz；`latest` 为 `3.16.3`，`beta` 保持 `3.0.0-beta.1`。GitHub Release `434811210` 于 **2026-11-05 05:41:21 UTC** 发布，正式版／Latest 已核验。认证草稿下载及新鲜匿名公开下载均匹配四份原始文件。Gitee Release `1275524` 使用同一源码／标签，四份附件的匿名下载均等于 GitHub 和原始 CI 字节。两个自动源码归档不计入交付文件。Gitee 说明由公开 GitHub Release 及实际附件地址渲染，更新后回读核验元数据、正文和未变的附件身份。明确 main／tag refspec 同步核验 main `4791ea88157ae696097b63a9c0158ef7c0df9956`、标签对象及解引用源码。桌面 MCP 连接失败后，先精确确认 Release 不存在，再通过新鲜官方 MCP 成功创建一次；保留 CDN 超时／不支持续传的诊断，随后以新鲜 DNS／本机接口、正常 TLS 校验完成下载核验。

### 本机核验与预算

安装后的产品管理器在通过只读审查后，将本机从 **3.16.2 升至 3.16.3**，通过正常事务、锁及保留的恢复入口完成包／集成核验。全部 **1,093 个安装文件**匹配公开制品。重复安装两次均保留归属文件、权限、缺省状态和备份清单。配置 JSON 读取通过。Claude Code 在隔离网络进程中通过初始化发现两个已安装技能：**零条提示消息、零次模型请求**。

升级前新鲜快照保护十一处偏好路径，包含两处 Claude 用户状态。原字节、权限和缺省状态均已核验／恢复，仅允许归属 Native 的 `backendVersion` 升至 3.16.3；单独核验的安装绑定也只改变后端版本。个人显示、语言及方案选择保留。`doctor` 有 23 项 OK，一项明确的 Native 会话加载警告；不声称实际交互 Native 加载或物理验收已完成。发布后没有付费请求。

所有调用、失败和重试共用 **30 美元**授权（2026-11-05 明确增加），发布前分配 24 美元，发布后分配 6 美元。最终账本共 **241 次尝试：236 次已知、五次未明**。已知用量保守上界估算 **2.5123041 美元**，保留未知预留 **5 美元**，总上界 **7.5123041 美元**，向上取整为 **7.52 美元**。四次 TLS 未明尝试和一次 POST 断连各保留 1 美元，没有退还预留或按零计费。已知用量按提供商峰时输入／输出费率、缓存输入也按未命中保守计算（[提供商价格](https://api-docs.deepseek.com/quick_start/pricing/)）；SDK 估算仅为辅助，该数字不是账单。付费调用已禁用，任务拥有的模型进程均已退出。

本补丁不改变显示 schema 17、编辑器协议 31 和既有存储格式。此前接受的 [issue #96 六项缺口](https://github.com/fbincon/claude-code-statusline/issues/96)仍未验证，不豁免新自动化失败。[发布说明](../../../releases/v3.16.3.zh-CN.md) · [版本决策](../../../releases/approvals/v3.16.3.json)
