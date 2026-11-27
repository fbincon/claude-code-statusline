# CI 维护与 Actions 身份

[English](ci-maintenance.md) | **简体中文**

普通合并采用[本地影响检查](impact-checks.zh-CN.md)。发布和诊断各有 GitHub 工作流。

实测记录包含同包语言对照、历史耗时、制品大小、排队时间与原生单作业重跑的 runner 开销。[CI 验收实测](ci-efficiency.zh-CN.md)

## 语言证据兼容

I18N-02 将产品验收与语言发布就绪分开。已接受基线导出器包含纯构建期语言分析器；完整和维护记录将版本化语言报告绑定原始来源及全部声明输入。main 可以复用安全 B 回退的验收，但完整来源和维护来源的公开发布均要求 A/B 全部完成。启用后缺失报告不能回退到 v3.15 前的兼容路径。语言元数据归构建职责，要求生成、消费方检查及实际包比较；仅在生成副本和来源规则完全匹配时，将生成的回退成员视作展示数据。原来源／策略摘要含义和回执身份不变。参见[实现](history/deliveries/i18n-02-delivery.zh-CN.md)及[维护流程](i18n.zh-CN.md#增量维护)。

## 完整证据的版本

双读验证器通过 main 门禁后才启用版本化生产端。原 v1 收据表示每个安装、Node 和宿主组合都完成了完整历史验收。v2 读取端从不可变源码和激活历史确定契约，用冻结的 Node 输入和已验证的比较基线重建应有义务。清单标明承担各项义务的实际执行，以及各 Windows ARM 阶段的归属。删除激活标记、对已激活提交递交 v1 收据、用早先成功作业替代最新失败，都会阻断晋升。

验证器核对原始 run、attempt、作业 ID 与时间、制品 ID 与摘要、候选包、runner 和可执行文件身份、历史深度及分项结果。对当前十二语言源码，v2 验证每宿主 313 个容量场景。v1 中的 197 字段沿用历史含义。Actions 定向重跑保留的其他作业沿用原始身份。已接受的首父在恢复候选编译输出前完成复核。历史自动完整验收使用 v2，手动完整诊断继续使用该覆盖计划。

### 历史深度与 Windows ARM 作业

每个逻辑目标用要求的运行时实际安装并运行候选，或明确引用身份一致的原始执行。短历史从固定的 3.8.0 升级到候选，再回退到 3.8.0，检查实际版本、入口、配置与必要的恢复。官方宿主另验 marketplace、后端绑定、显式禁用和第三方设置。完整历史再覆盖 3.7.0、完整性拒绝、故障注入、编辑器执行，以及独立包恢复和配置恢复。

| Runner | 历史 v2 基线中执行完整历史的组合 |
| --- | --- |
| Ubuntu 24.04 x64 | 四个 Node 选择器和开发 Node |
| Windows 2025 x64 | 22.x、24.0.0 |
| Windows 11 ARM，x64 Node | 22.0.0、24.x |
| macOS 15 ARM | 22.0.0 和 24.0.0 |
| macOS 15 Intel | 22.x |
| macOS 26 ARM／Intel | 均为 24.x |
| 固定 Claude 宿主（9 条完整／13 条短历史） | Linux 2.1.287 和 2.1.326、Windows 2.1.288，以及三个系统上的 2.1.289 和 2.1.310 |

当前 v2 基线的 35 项逻辑安装／Node 义务包含 14 条完整和 21 条短历史，22 个宿主的基线深度如表。手动全量运行采用保守计划，每项义务都执行完整历史。精确声明、Mod 测试、容量与 Windows 稳定性仍在适用宿主上验证。Node 别名只有在实际二进制和输入都相同时才共享执行。Windows ARM 的语言、历史、其余安装作业分别使用自己的安装目录、配置与缓存。目录迁移及依赖迁移入口的 shell、编辑器与恢复检查保持同片。每个固定宿主均有能力边界、保护的回归及替换条件，调整清单前先用固定版本探测并评审。[覆盖策略](../../tools/checks/ci-coverage.ts)

GitHub 于 2026-11-02 退役 macOS 14 runner。Runner 迁移将原来在该镜像执行的 Node 22.0.0 完整历史移至 macOS 15 ARM，早期证据保留各自的 runner 矩阵、历史深度和策略摘要。[GitHub 退役公告](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/)

## CI 耗时与稳定性优化

### 候选包在 PR、main 与 tag 之间晋级

普通 PR 与其 `main` 合并走本地检查。发布 CI 处理本仓库面向 `main` 的非草稿 `release/` PR、对应的合并事件和版本 tag 推送。普通 PR 可显示跳过状态，项目 runner 数为零。

### 路由表与阻断条件

完整候选阶段包括 17 项发版 PR 作业。引入 AgentRow 前的源码沿用原有宿主组合与回执读取规则。

| 事件 | 执行内容 |
| --- | --- |
| 待审查发版 PR | 一个 Linux 开发与可复现构建作业、六次安装包冒烟、每个系统三项官方宿主验证，以及 `Accept release candidate` 汇总 |
| 发版 PR 合并到 `main` | 首父独立校验、三系统安装包冒烟及 `Accept release integration` |
| 带注释的版本 tag | 一个验证作业将候选、集成和原始交付文件绑定到标签 |
| 手动派发 | 发布 CI 以诊断模式运行同一候选作业。CI diagnostics 提供全量和专项探针。 |

发版分支采用通用命名，例如 `release/next-patch`。同步主线，等待最终 head 通过后用双父 merge commit 合并。head 更新后须重新检查。若合并基线或 tree 发生变化，重新准备与主线同步的发版 PR，验收通过后再打标签。

### 独立校验与 main/tag 专项义务

发版 PR 合并事件固定实际 merge SHA。候选源码须匹配实际第二父提交和集成 tree。受保护 `main` 的合并历史确立首父身份，独立 TypeScript 验证器由实际首父导出。集成作业核对摘要后安装 PR 原包。

不可变源码选择证据格式。回执绑定工作流、原始 run、attempt、作业、制品摘要和候选原字节。定向重跑复用原作业时保留原身份。最新适用运行失败、取消或未完成时阻断，证据过期、缺失或身份不符也阻断。留存期为 30 天。优先重试适用的原运行。上游回执变化后刷新引用它的后续阶段。无法重跑时重新准备发版 PR。

带注释的 tag 指向从 `main` 可达的已验 PR head。标签核对完整证据链和原始四件文件。npm 准备阶段重验这条链，再把精确 tgz 交给 OIDC。旧完整及维护证据由历史源码的启用规则选择读取器。[发布指南](../RELEASING.zh-CN.md#绑定源码的-ci-证据晋级)。

### 发布数据与验收策略

逐版本批准登记放在[批准登记表](../releases/approvals/registry.json)，与各版本批准 JSON 放在一起。新增版本时登记版本号、批准路径和精确批准日期，无需修改 `tools/release/approval.ts`。两个数据文件都是绑定源码的发布输入，纳入 Git tree、源码归档和候选包身份；不属于可执行规则，不进入策略摘要。`tools/release/` 可执行文件及未来新增校验器仍纳入摘要；摘要与已验收源码比较，不因旧 main 不同触发矩阵。

`release:prepare` 和晋级从已核验源码归档读取登记与批准，不读取当前 checkout。登记要求唯一稳定版本／路径及有效日历日期；批准必须匹配版本／日期、维护者、权限、引用及精确六项既有缺口。原验收回执记录两个文件的摘要。缺少登记表的历史归档可读取原字面量登记表而不执行源码；新登记表损坏时不得回退。决定文件与登记行按[审批决定模板](../RELEASING.zh-CN.md#审批决定模板)编写。参见[发布准备](../RELEASING.zh-CN.md#绑定源码的-ci-证据晋级)及[分流回归](testing.zh-CN.md#发布批准与-ci-分流)。

### 安装验收时限

安装测试按实际工作顺序计算时限。串行阶段累加各自上限，并发的历史过渡取最长分支。监督进程另给准备、子进程退出、清理和写回执留出时间。每个场景独立计时，外观场景开始后拥有完整的 120 秒。进度消息注明当前阶段，不会延长截止时间。

两次 Windows ARM 宿主上的 x64 作业展示了外层预算的影响。PR #190 的首个外观场景只执行了 4.64 秒，PR #198 的最后一个场景只执行了 52.86 秒，就分别触及原来的 55 分钟总上限。两个日志均已记录 26 个通过的测试。#198 最终提交另一次故障发生在产品测试通过后的制品上传阶段。诊断时需区分失败阶段，并保留原始失败和重跑身份。[PR #190 超时](https://github.com/fbincon/claude-code-statusline/actions/runs/41007969032/job/123908643050) · [PR #198 超时](https://github.com/fbincon/claude-code-statusline/actions/runs/41168202931/job/124441167592) · [PR #198 上传](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268/job/124477485935)。

### 制品传输的恢复

常规安装、Node 与 Mod worker 按生产作业给出的不可变制品 ID 获取原始压缩包与校验清单，核对源码、原完整制品、包摘要和冻结清单后再执行候选代码。完整候选仍保留四件交付文件，供独立发布校验和晋升。适用事件复用执行时，保留原 run、attempt、作业和制品身份。

临时连接故障、适用的服务端错误和限流，允许在同一 runner 的传输期限内恢复。上传客户端内建恢复结束后，最多额外补传一次。确认结果不明时，先查同一 run 和原生产 attempt 的对象并核对实际文件。权限错误、ZIP 损坏、摘要冲突、输入缺失或对象歧义都会阻断。若 runner 丢失，等 GitHub 允许重跑后选择失败的物理作业，依赖汇总由 Actions 一并调度。[GitHub 单作业重跑](https://docs.github.com/en/rest/actions/workflow-runs#re-run-a-job-from-a-workflow-run)

结合步骤名、阶段回执和原始错误区分故障。子阶段仍有合法时间却被父级截断属于编排缺陷。产品断言失败要检查对应断言和输入。runner 丢失或平台前置条件缺失属于环境故障。断言通过后制品传输失败，记录为传输故障。证据不足的退出保留待查。`ci:watch` 按 attempt 区分新增 runner 执行秒数、排队秒数和沿用的成功作业。

### 开发与执行路径

在 Actions 的 [CI diagnostics](../../.github/workflows/ci-diagnostics.yml) 选择分支及 `validation`。完整档覆盖额外系统镜像、Node、历史恢复、原生容量和额外宿主。涉及安装、恢复、原生集成或对应不确定性时，可以单独运行相关任务。平台、语言和制品传输探针保留各自诊断回执。

用 `npm run ci:watch -- --run RUN_ID --head FULL_SHA --watch --report dist/validation/ci/RUN_ID.json` 记录原始作业和时长。汇总区分队列、实际执行和重试保留的作业。分平台记录失败阶段，使用原运行重试。

## 本地与 CI 检查

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` 使用固定的仅开发依赖 `yaml` 解析 `.github/workflows/**/*.yml` 和 `.yaml`，检查步骤 Action、任务级可复用工作流及可达本地 Action 清单。外部仓库引用必须使用完整 40 位提交 SHA 与语义版本注释；Docker 步骤必须使用完整 SHA-256 digest。本地 `./` 引用保留相对检出根目录的正常语义，定义必须存在于仓库内，每个本地组合依赖文件检查一次。

检查器支持带引号的键、行内映射、别名和折叠标量，忽略脚本／注释示例；YAML 错误、重复键、无法解析的引用或空工作流清单均失败。诊断包含文件与行号，并以非零状态退出。离线检查验证引用和注释格式，审查者通过官方上游来源核对实际版本与提交的对应关系。

在本地运行工作流身份和契约回归。发版候选作业通过 `npm run check` 再核对构建。

### 社区文档检查

文档／媒体检查覆盖维护中的 Markdown、社区模板和已登记文档资源，包含截图元数据及 Mod／package README。产品技能指令仍属于执行输入。混合维护合并必要检查，产品行为执行完整矩阵，未知修订或职责阻断。详见[影响归属规则](impact-checks.zh-CN.md#职责与检查)。

`npm run docs:check` 检查 Markdown、单文件双语 PR 模板、Issue 表单 Markdown 内容和入口链接中的本地目标及锚点。它还校验 PR 模板必需的双语标题、按需事项和指南链接，影响计划将 `.github/ISSUE_TEMPLATE/` 下的任意顶层 `.yml`/`.yaml` 表单按文档路由。根目录政策文件需要独立的英文／中文文件，根目录 `AGENTS.md` 除外：它只维护英文，仍检查链接和锚点；该例外不适用于 `docs/` 下的同名文件。PR 模板和表单在同一文件中包含双语。复用既有仅开发 YAML 解析器，检查表单结构、显式且唯一的字段 ID、必填标志、下拉选项，以及联系入口的名称、HTTP(S) 地址和说明。这是针对本仓库所维护字段的离线检查，不代替 GitHub 渲染；合并后仍应检查实际入口与模板。参见 [GitHub 表单语法](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)。

按[路由表](#路由表与阻断条件)记录 release PR、main 和 tag 的发布回执。

## 每周更新与审查步骤

[Dependabot 配置](../../.github/dependabot.yml)仅检查 `github-actions`，按 `Asia/Shanghai` 每周一 09:00 调度。次版本／补丁更新归为一组，同时最多保留一个版本更新 PR；忽略主版本更新。PR 面向默认分支，仍需正常审查和 CI。参见 [GitHub 配置参考](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)。首次扫描没有符合条件的新版本时无需产生 PR。

每次自动或手动更新均执行：

1. 阅读官方发布说明，比较固定源码与拟议提交。保留当前主版本；运行时、runner 或权限变化另行评估。
2. 在官方 Action 仓库解析精确版本标签，例如：

   ```bash
   gh api --hostname github.com repos/actions/checkout/git/ref/tags/v4.4.0 \
     --jq '{ref: .ref, type: .object.type, sha: .object.sha}'
   ```

   若对象为附注标签，继续读取 Git 标签对象直到提交；在 PR 中记录完整提交、版本及官方来源，不通过打印 token 获取凭据。
3. 同步更新该 Action 所有位置的 SHA 与精确版本注释。运行 `actions:check`、专项回归、影响计划检查和空白校验；检查权限、触发条件、矩阵及发布条件的差异。
4. 最终已审查 PR head 的 CI 成功后合并，并验证合并后的 main。相关手动工作流引用变化时运行对应工作流；纯文档证据补充采用正常文档分流。

若更新导致工作流回归，通过 PR 回退该项更新，恢复之前验证的 SHA／注释，再验证受影响工作流；保留既有发布标签与 npm 选择器。本流程不强制更新已发布版本的身份。

## 历史交付记录

- <a id="issue-157-的实测交付记录"></a>[Issue #157 的实测交付记录](history/deliveries/ci-maintenance-delivery.zh-CN.md#issue-157-的实测交付记录)
- <a id="ci-01-实现"></a>[CI-01 实现](history/deliveries/ci-maintenance-delivery.zh-CN.md#ci-01-实现)
- <a id="初始引用清单与来源"></a>[初始引用清单与来源](history/deliveries/ci-maintenance-delivery.zh-CN.md#初始引用清单与来源)
- <a id="验证与完成证据"></a>[验证与完成证据](history/deliveries/ci-maintenance-delivery.zh-CN.md#验证与完成证据)
