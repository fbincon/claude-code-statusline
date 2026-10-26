# M10–M12 实施与交付

[English](m10-m12-delivery.md) | **简体中文**

IMPORT-01、APPEARANCE-04、COMPOSITION-03 已随 **v3.9.0** 交付，并于 2026-10-26（Asia/Shanghai）完成 GitHub／npm／Gitee 发布及公开核验。实施顺序为三个功能 PR 后接一个发布 PR；起点 main 为 `7d73a2c9f7418f59f781fe71a0e9e66f4db18a2a`。最终证据见下文，历史准备记录另行保留。

## 最终源码与发布门禁

[发布 PR #146](https://github.com/fbincon/claude-code-statusline/pull/146) 审阅 head 为 `ac9ff6fb6e3ae61776a66fdc2d56c7909cf7458b`，合并提交为 `dc8732fb3605db0f4d9e918ceebc9aeb7e8dca8f`。附注标签 `v3.9.0` 的对象为 `38900d7552d8103a0d24f3b09504936cec1b8f75`，指向该合并提交。当前显示 schema 15、编辑器协议 24；portable／方案外层格式保持 1，来源及 runtime 格式不变。

| 门禁 | 源码 | 结果 |
| --- | --- | --- |
| [发布 PR CI 40235603129](https://github.com/fbincon/claude-code-statusline/actions/runs/40235603129) | `ac9ff6f` | 56 个适用任务全部通过 |
| [最终 main CI 40239423724](https://github.com/fbincon/claude-code-statusline/actions/runs/40239423724) | `dc8732f` | 56 个适用任务全部通过 |
| [最终 tag CI 40239517617](https://github.com/fbincon/claude-code-statusline/actions/runs/40239517617) | `dc8732f` | 56 个适用任务全部通过 |

每组门禁独立覆盖 8 个安装目标、32 个 Node 场景、13 个固定宿主及源码／汇总检查。main 与 tag 的汇总报告绑定同一安装包和准确的六项已接受缺口，报告 SHA-256 均为 `96790b5abc8849037ff2e9524b663503f902bd1d2946e9b6fd8c5ebf6c7ef97b`。真实已发布 v3.7.0、v3.8.0 历史序列覆盖升级、schema 13 → 15 迁移、不兼容 schema 拒绝、显式备份恢复、回滚及进程中断恢复。

## 可复现产物与安装版终端证据

本地两次独立构建、交付源码归档的完整重建，以及最终 main／tag CI 构建，四个文件均逐字节一致。构建身份保持 Node 24.21.0／npm 11.19.0。发布前重新下载了四个 GitHub 草稿附件并比对；下载包还通过空缓存、禁用生命周期脚本的隔离离线安装。

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.0.tgz` | `1b337f4ff36426e989cfa9682927968c3450baca05f187dfd59636ebfe77197c` |
| `claude-code-statusline-3.9.0-source.tar.gz` | `403257e53bffe2ebbe054b511cb3adea0eb6b17d418e868348a296a993ba5fcc` |
| `build-manifest.json` | `1bacd973c1ae98d6f3bbc0011d77ec0a8e57d3e878db3bb6ba1c0fdd1593109e` |
| `SHA256SUMS` | `c40b78feec7aa56a87e6eb0a15fb823e42e2003bd41e5ac574a44be4c0ac0503` |

最终安装产物通过 792 张六语言明暗主题 PTY 终端单元格重建图（每种语言 132 张）、四项单色／不支持终端场景及终端恢复，模型调用为 0。报告 SHA-256 为 `a99098d15f68a5856322c7a2c89b325e1304bec135019181e6af22e44cf2d3ea`。代理已查看六语言代表界面及 40 列联合重建图；自动化安装验收覆盖六语言 × 40／80／120 列，并验证保存重开、预览与实际渲染一致。原始 CJK、组合字符、emoji 字素和链接与字体外观分开验证；本地指定字体不能完整呈现联合样例中的复杂 emoji。上述画面属于 PTY 重建，人工与实体机检查保留实际状态。

## 发布与公开验证

[npm 3.9.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.9.0)、[GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.0)及 [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.0)均已发布并核验。GitHub 发布时间为 `2026-10-25T23:55:28Z`，Asia/Shanghai 日期为 2026-10-26。

[OIDC 预演 40246377282](https://github.com/fbincon/claude-code-statusline/actions/runs/40246377282)及[从标签触发的正式发布 40246617447](https://github.com/fbincon/claude-code-statusline/actions/runs/40246617447)均通过；npm `latest=3.9.0`，保留 `beta=3.0.0-beta.1`。[首次从 main 触发的正式运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40246483060)被既有标签保护检查拒绝，publish 步骤跳过，没有写入注册表。改从 `v3.9.0` 触发同一工作流后成功，没有放宽门禁。

[公开下载 CI 40246908215](https://github.com/fbincon/claude-code-statusline/actions/runs/40246908215) 的 Linux／Windows／macOS × Node 22／24 六项全部通过，分别核验 GitHub／npm 公开字节及精确版本／latest 的空缓存安装，实际运行时为 Node 22.23.4、24.22.1。已验证六份原始 ZIP 摘要及报告的源码／包身份。Gitee 四个交付附件均匿名 HTTPS 下载并匹配上表，下载包通过空缓存离线安装及版本／配置／渲染检查；Gitee 自动生成的两个仓库归档不计入这四个附件。检查分歧后，已用明确 refspec 同步验证后的 main 与相同附注标签对象，GitHub 保持主仓库。

仅依据 [v3.9.0 批准记录](../releases/approvals/v3.9.0.json)接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项既有缺口，并继续标记为未验证。自动化、PTY、代理视觉检查和人工／实体机证据分别记录，不豁免新增失败或缺失的自动化门禁。SHOWCASE-01 保持 NOT_STARTED。

文档收尾保存上述证据，将当前指南／示例／契约统一到 schema 15／协议 24，并将 M10–M12 移入已交付规划表；功能引入时的历史版本继续保留。本次没有在 README 加入版本或更新说明，收尾按纯文档范围校验。

## IMPORT-01

[PR #143](https://github.com/fbincon/claude-code-statusline/pull/143) 已合并为 `e4f3e7b3266aae7d35d579a233e2e9c58b5d7b3b`，head 为 `69ad4485c5f03e43845864a82968ba938f7c1b92`。[CI 40218297344](https://github.com/fbincon/claude-code-statusline/actions/runs/40218297344) 的 56 个适用任务全部通过：8 个安装目标、32 个 Node 场景、13 个固定宿主以及源码／汇总门禁。IMPORT-01 功能状态为 DONE，已包含在上述已核验 v3.9.0 发布中。

协议 22 为既有导入操作增加可选精确选择键；显示 schema 保持 13，portable／单方案外层格式保持 1。共享选择及差异逻辑由 core 生成到原生编辑器。完整作用域保留内部身份和引用，主区与子代理 ID 命名空间独立；不进行任意组件拼接或 host 授权转移。

CLI 和双编辑器支持全局项、完整分区两个切片；方案及项目保存复用版本校验事务，保留身份和绑定。安装验收在原有二十类之外新增四个选择性导入场景。参见[使用与目标规则](../PROFILES.zh-CN.md#选择性导入)。

本地源码检查通过 1,218 项，明确跳过 5 项；生成资源、文档链接和迁移清单检查通过。本机官方原生 Mod 测试通过 133 项。回滚修复前的 21 类安装验收全部通过；修复后的安装包已在固定 Claude Code 2.1.296 下通过真实 npm 3.7.0／当前版本往返、进程中断恢复和显式配置恢复。最终功能 CI 矩阵已按上述记录通过，这些本地结果先于本页顶部的最终发布门禁。

固定宿主矩阵发现了回滚缺陷：旧版所有权读取器不识别新版编辑器协议，官方插件更新还可能保留较新的缓存。当前包现先校验并暂存目标版本的真实 Mod 资源，降级时重装已确认归属的缓存，保留显式禁用及无关设置，再通过独立进程运行目标安装器。资源摘要、后端绑定与 doctor 结果仍为必要条件。这是新增自动化失败的修复，不属于六项已接受历史缺口。

## 发布边界

三个工作包均已完成功能验收，渐变／对齐的 schema／协议分别为 14／23、15／24。SHOWCASE-01 不属于本次交付。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项历史缺口继续未验证；已批准本版本在最终自动化门禁全部通过后仅接受这六项缺口发布。

## APPEARANCE-04

[PR #144](https://github.com/fbincon/claude-code-statusline/pull/144) 已合并为 `0c0200240292dc912f635cccffd6a4c53a08c58a`，head 为 `564915a847fea0575d785644115261691b7318ee`。[CI 40225167655](https://github.com/fbincon/claude-code-statusline/actions/runs/40225167655) 全部 56 个适用任务通过，覆盖 8 个安装目标、32 个 Node 场景、13 个固定宿主及源码／汇总门禁。APPEARANCE-04 功能状态为 DONE，已包含在上述已核验 v3.9.0 发布中。

实现基于已验收的 IMPORT-01。Schema 14／协议 23 增加可选标准化 RGB 数组，共享表单支持轮换预设或编辑自定义色点。前景在拟合后着色并保留语义换行中的组件边界；背景包含 padding，再据最终边缘决定分隔颜色。两个作用域复用纯插值逻辑，阈值优先且采集行为不变。针对性测试覆盖字素端点、链接、裁剪、分组和六语言表单。源码检查通过 1,227 项，明确跳过 5 项，随后补充的告警对比度测试也通过。源码 `8fa8bc9` 对应包通过全部 22 类安装验收；固定 Claude Code 2.1.296 在源码 `21da545` 上通过两套官方 Mod 测试、安装集成，以及真实 npm schema 升级／拒绝／恢复／回滚。最终功能矩阵已通过，如上所述。

PTY 视觉复核发现渐变标签存在歧义，已统一双编辑器：六种语言均显示明确的本地化关闭状态和预设名称，可编辑底层值保持规范标识。外部 TUI 与原生 Mod 的针对性测试覆盖上述显示规则。

## COMPOSITION-03

[PR #145](https://github.com/fbincon/claude-code-statusline/pull/145) 已合并为 `9e4a049a1f8198a190f1e8a20adf0092864c161b`，head 为 `cdbe9d1a2dc89e19ee5e6901cff968f84809c364`。[CI 40229051764](https://github.com/fbincon/claude-code-statusline/actions/runs/40229051764) 最终 56 个适用任务全部通过，覆盖 8 个安装目标、32 个 Node 场景、13 个固定宿主及源码／汇总门禁。第 1 次运行中，macOS 26 Intel／Node 24.x 在源码检出前连续三次无法解析 github.com；同一 head 的第 2 次运行重试及汇总通过。产品和测试门槛均未改变。COMPOSITION-03 功能状态为 DONE。

Schema 15／协议 24 增加显式主行对应列的可选稳定单位引用。共享 Layout 管理、CLI 事务、导入校验及两条诊断路径采用一致规则。两阶段渲染共享观察与颜色游标，保留隐藏列位；关联行超宽时取消对齐留白。破坏引用的结构修改在保存前指出具体关系。核心／CLI／TUI 针对性测试通过 13 项，本机宿主 2.1.310 原生 Mod 测试通过 136 项（额外本地证据，不替代固定宿主矩阵）。安装验收新增四个必需场景，扩展 PTY 捕获包含关系管理表单。源码 `9f3a30a` 的完整检查通过 1,238 项、明确跳过 5 项，23 类安装验收全部通过；固定宿主 2.1.296 的官方 Mod、安装集成及 schema 升级／恢复／回滚通过。新增联合测试覆盖六语言、40／80／120 列、Unicode、链接和颜色回退，并确认预览与实际渲染一致。最终功能矩阵已通过，如上所述。

整合后的源码 `281e559` 通过 1,241 项测试，明确跳过 5 项，生成资源与文档检查均通过。其中包含渐变本地化显示修正、对齐阶段单次观察和范围标签回归。被替代的渐变 CI 已取消，合并仅以最终 head 的完整矩阵为准。#143 后的中间 main CI 在确认与已全绿 PR 的 Git 树相同后取消，不作为发布证据；最终发布 PR／main／tag 仍分别运行完整必需门禁。

首轮对齐矩阵 [40228240870](https://github.com/fbincon/claude-code-statusline/actions/runs/40228240870) 在真实宿主 TypeScript 门禁中拒绝了新增原生集成测试：Client 端口数据为 `unknown`，测试未先使用既有 `ClientProps` 类型便访问其字段。现已使用该导出类型，运行时断言保持不变。固定 Claude Code 2.1.294 的真实声明类型校验及全部 137 项原生测试在本地通过。产品行为和门禁均未放宽，修正后的 head 随后通过完整功能矩阵，如上所述。

## 统一发布准备

源码 `de7f1a2` 的 v3.9.0 候选通过本地 1,239 项测试（明确跳过 5 项）、全部 23 类安装验收及官方 Claude Code 2.1.296 的 Mod／集成验收。已发布 v3.7.0 与 v3.8.0 归档均固定 SHA-256，验收真实 npm 升级、schema 13 → 15 迁移、不兼容回滚拒绝、显式备份恢复、回滚、进程中断及恢复。随后新增的已安装联合矩阵要求六语言 × 40／80／120 列共 18 个场景，并检查保存重开和预览／渲染一致。该中间本地候选未用于公开发布，最终源码及三渠道证据见本页顶部。

整合发布源码 `aa090e0` 通过 1,242 项测试，明确跳过 5 项平台场景；56 项生成资源检查和 3,229 条文档链接通过。#144 后的中间 main 运行 [40228151865](https://github.com/fbincon/claude-code-statusline/actions/runs/40228151865) 在核对 Git 树 `cd2d526565ca3a0e2516ca0804e8b3f1e59801d1` 与全绿功能 head 一致后取消，该已取消运行不作为发布证据。

候选源码 `f5bb3da` 的两次独立构建字节一致；安装版 PTY 复核通过 792 张六语言明暗主题重建图（每种语言 132 张）和四项单色／不支持终端场景，取消保护及终端恢复通过，模型调用为 0。六语言代表画面已查看，已安装的联合输出在 40／80／120 列均通过；原始 ANSI 保留完整字素。报告 SHA-256 为 `83458ad60112fa4546035583a202e0b43049dd7c77cfd978f41b54ae8b87127b`，包 SHA-256 为 `5092e30c454d7a6e3b830ea0ed3398d078e672e96c33dd80efaf8264d03bf137`。这属于发布前复核，不是 OS 截图或人工／实体机证据；本页顶部绑定最终产物的证据用于发布，取代这些中间文件。

#145 后的中间 main 运行 [40232707528](https://github.com/fbincon/claude-code-statusline/actions/runs/40232707528) 在确认 Git 树 `84ca377515098595000ec751576371ff8d2c4306` 与全绿功能 head 相同后取消。最终 v3.9.0 发布 PR、main、tag 随后均通过本页顶部记录的完整自动化验收。

首轮发布矩阵 [40232974157](https://github.com/fbincon/claude-code-statusline/actions/runs/40232974157) 的 Windows 2025、Windows ARM／Node 22.0.0 在正常 v3.7.0 升级及回滚成功后，于中断注入加载阶段失败。新增历史目录层级延长了恢复包清单路径。[独立路径诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40234895182) 在两个 Windows 目标复现：Node 22.0.0 可加载原 241 字符路径和独立 239 字符路径，却将新增 262 字符路径中的 .js 模块识别错误，尽管 type=module 清单可正常读取；.mjs 和 Node 22.23.4 对照均正常，ASCII 与 Unicode 路径结果一致。现每条历史序列使用原深度的独立、规范化 Unicode／特殊字符临时工作区，并清理自建目录；同时要求恢复前确已持久化 package_verified 中断点。本地两条真实 npm 历史序列各 22 项操作通过，8 项发布凭据测试通过。[不改变产物的 Windows 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40235365958) 及修正后的完整矩阵均已通过，随后又通过本页顶部的最终发布 PR／main／tag 门禁。Node 最低版本、产品时限及所有升级／回滚／恢复断言均保留。
