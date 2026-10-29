# 自适应指标、连续行背景与场景方案

[English](adaptive-row-scenarios.md) | **简体中文**

v3.14.0 实现 APPEARANCE-07、APPEARANCE-06、PROFILE-02，以及 [#178](https://github.com/fbincon/claude-code-statusline/issues/178)、[#180](https://github.com/fbincon/claude-code-statusline/issues/180)。开发起点为 `7dc3beec326f87864dc2401a18dffe45b7f93da3`。最终 PR／main／tag 门禁、公开渠道与实际机器验证均已通过；下文最终证据保留各自原始来源身份。

## 共享表示与最终着色

显示 schema 17 增加 `presentation=adaptive` 与可选的 `powerline.row_background_gradient`；编辑器协议 30 传输对应描述。portable／profile 外层格式保持版本 1。旧文件只在内存中规范化，读取不写入，也不会启用新行为。更早 schema 拒绝新选项；显式写入保留修订检查、锁、备份和原子发布。

自适应指标保留结构化百分比及已用／剩余文本。固定行依次缩短可缩减的内置标签、将条缩至四格、转数字，再按既有优先级省略；各阶段先缩减低优先级项。自定义标签和图标保持完整，数字表示仍放不下则省略。`max_width`、分组和两个作用域共用规则。自动布局保留正常换行，仅对超过整行宽度的单元缩减。真实输入诊断和样例解释同样记录组件自身宽度限制下的缩减阶段；整项省略记为 `width_omitted`，而不是数据为空。

连续背景须显式开启，只在有色 Powerline 输出中生效。既有 `color_mode=continuous` 继续表示调色板序列连续。背景在可见性、拟合、分组和换行确定后着色。共享背景组作为一个块；组件／主项显式背景及独立背景渐变覆盖行渐变并切断区段。spacer 切断区段，对齐补白不着色、不占渐变长度。对齐单元保留色块元数据，最后对整行着色。分隔符与端帽使用实际边缘颜色；告警前景优先并受对比度保护，链接和完整字素保持完整。

## 显示场景

新增五个稳定身份，将原有九项选择扩充为十四项：

| ID | 显示意图 |
| --- | --- |
| `powerline-daily` | ocean 日常工作、连续背景与自适应上下文 |
| `agent-workbench` | slate 任务／活动分组和代理行 |
| `quota-cost` | ember 配额／重置对齐、上下文／支出分组和费用速率 |
| `narrow-terminal` | 紧凑 ASCII 显示、正常换行与四格自适应条 |
| `light-readable` | light 主题、浅色连续背景与受保护的告警颜色 |

Core 定义统一供安装引导、双编辑器、CLI 及[可移植示例](../../examples/schemes/)使用。选择预览候选，接受作为一次草稿历史操作；保留当前显示语言和子代理启用状态。方案不安装工具、不导入凭据、不绑定本地来源、不启用采集。缺失观测保持缺失；原三个完整方案的身份和显示选择保留。

[安装产物渲染样例](../images/adaptive-row-scenarios/README.zh-CN.md)展示全部五个场景。窄终端方案使用紧凑 ASCII 标识，不再叠加标签，使实际目录值在 40 列仍可见；四格自适应条保留完整百分比及剩余含义。

## Native 显示与本地化

完整编辑状态留在宿主。props、外层 Pane 和 Client 绘制树分别保留 48,000 字符／10,000 值／深度 16 的预检，保留可见分页、选中内容、Unicode 和有色预览。容量清单保留原 243 项并新增 28 项场景／颜色／指标案例，合计 271 项实际宿主案例。新增六语言测试检查实际样式／分组／历史入口标题，不仅检查资源存在。保存成功、等待及未知结果恢复与绘制失败保持独立。

## 受支持的签名验证

使用固定开发工具链与下载的精确版本包：

```bash
npm run release:signatures -- --version 3.14.0 --commit FULL_SOURCE_SHA --artifact /path/to/fbincon-claude-code-statusline-3.14.0.tgz --output /path/to/new-signatures.json
```

工具复用 npm 11.19.0 的 TUF、registry 签名和 Sigstore 验证，检查包 SHA-512 与所有文件，并把 provenance 绑定到精确仓库、源提交、tag 和发布工作流。六个内置公开依赖分别验证签名和完整性，所带文件与签名上游归档逐项比较。四个私有工作区包由签名外层归档和完整文件清单覆盖，不将它们当作未发布 registry 版本查询。依赖未发布 provenance 时明确记录缺失，外层产品包则必须有源证明。

这是明确限定范围的专用流程。原生 `npm audit signatures` 仍会遍历私有内置工作区依赖，可能返回 E404，不记作通过。公开发布新增固定工具链签名任务，与原六项公开下载任务并列。

## 验收与交付

专项验证覆盖六语言、40／80／120 列、语义回退、分组／spacer／对齐边界、告警、ANSI／无色、持久化与传输。候选验收保留八个安装目标、32 项 Node、十六个固定宿主、271 项容量案例及安装产物编辑器／PTY 流程。[发布流程](../RELEASING.zh-CN.md)通过最终 PR／main／tag 的不可变原始证据提升；失败或缺失门禁阻断发布。仅接受仍未验证的 [#96 六项既有缺口](https://github.com/fbincon/claude-code-statusline/issues/96)。

真实 v3.13.0 基线验证已通过：外层包两项签名、两份证明包和全部六个公开依赖，包括上游文件对比。候选验证、源身份和渠道回执与对应 CI 运行及 [v3.14.0 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.14.0)关联。不需要付费模型测试；自动宿主测试、PTY 和代理检查截图不能建立新的物理／人工验收。发布后本机新发现只提 issue，保留已发版本。

## 本地候选证据

本地候选 `492d3d50c8d0d72b6230aff956425958b86f5417` 两次构建字节一致，SHA-256 为 `8fd4b89d82446ab2185fbf12181d324aedc6a68f28c4c3261b2a63b6cdd0abff`。源码检查通过 1,440 项测试，六项仅适用其他平台的跳过；92 份生成资源、冻结归档和完整迁移清单通过。安装验收全部 27 项测试、26 类必需检查通过，包括五个新方案的六语言、40／80／120 列、语义拟合、传输及保存重开。Claude Code 2.1.312 的全部 42 项已安装 Native／外部 PTY 流程通过，模型调用为零。

较早诊断单独保留：`/tmp` 配额错误中断了夹具解包；随后把临时根目录放到仓库内，被安装隔离检查正确拒绝。成功运行使用仓库外私有磁盘目录。中间不可变构建因一份容量生成文件陈旧被阻断，重新生成后通过。采集检查器现仅允许文字和背景均匹配独立生产渲染结果的预览色块，任意预览／界面底色仍失败。这些失败尝试不作为发布证据。

截图检查还消除了配额／重置的重复内置标签，并使窄终端实际目录值可见。[保留的五张样例](../images/adaptive-row-scenarios/README.zh-CN.md)标明原始候选、渲染器、字体及摘要，不改标为最终公开产物。最终 PR／main／tag 验收及公开字节验证仍为独立必需条件。

完整安装产物样例采集完成 732 张重建图片。之后固定宿主重跑发现通用测试夹具缺少 `source_draft` 响应，错误地把绑定引用保护请求当作预览处理。夹具现返回该操作的实际结果形状，未知保存测试还明确要求当前绑定继续受到引用保护；Claude 2.1.310 的全部三项来源集成案例通过。失败重跑仍与验收分开记录。

[首次 PR 执行的 Windows ARM／Node 22.0.0 任务](https://github.com/fbincon/claude-code-statusline/actions/runs/40864428819/job/123417364443)通过前 26 项安装测试，随后新增整组外观案例达到 120 秒上限。该案例在一个子进程中执行 450 次预览和三十次保存重开。验收现按完整场景分别执行，保留每个场景的六语言、五种样例、三种宽度、持久化／传输断言及原 120 秒子进程上限；汇总仍要求五份精确回执，并记录各次执行的耗时与状态，不扩大任何产品命令期限。本地专项执行五组全部通过，合计约 51.5 秒，最长约 16.5 秒；该诊断明确不可提升为发布证据，最终头提交仍必须通过完整 CI。

一次扩展图片采集在最后一种语言期间被 SIGTERM 终止，没有通过回执。部分图片保留为诊断，完整原版采集器独立重跑。上述已通过的 42 项 PTY 和 732 张样例执行保留原始身份。

发布前 macOS Intel 验收暴露包审阅完成竞态。原始 `75128bf` 候选的诊断观察到私有结果在 `15:10:19.506Z` 已完成，随后 `15:10:19.607Z` 却派生出中断：状态查询确认进程退出时仍持有较早的“运行中”快照。状态现于判定中断前重新读取有界私有记录，并再次检查所属编辑器、配置修订和存活状态。原子发布回归覆盖完成、失败、取消及存活未知结果，以及所属编辑器／配置变化和修订冲突。现有启动、总体及测试期限均不扩大；此诊断与最终源验收分别记录。

初版回归夹具在读取句柄仍打开时尝试发布，被 Windows／Node 22.0 正确拒绝并返回 EPERM。可移植夹具改为读取旧快照并关闭句柄后、检查存活状态前发布；旧产品仍复现相同失败，修复后的断言和期限均保留。此夹具修正不改变产品行为。

## 最终来源与发布身份

于 **2026-10-30**（Asia/Shanghai）完成。[PR #184](https://github.com/fbincon/claude-code-statusline/pull/184) 交付来源 `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0`。普通双父 main 合并为 `dc76c3c426956d1a3238e5e0d3397f6c65acb93d`，两者树完全相同。带注释 `v3.14.0` tag 对象为 `b52fb1672056a33f553787e7e911df639dac755f`，指向原产品来源。后续文档维护保留包、tag 与 npm provenance 的原始来源身份。

| 门禁 | 结果与原始证据 |
| --- | --- |
| 最终 PR | [第 2 次通过](https://github.com/fbincon/claude-code-statusline/actions/runs/40905911155/attempts/2)：60 个成功任务、11 个预期路由跳过；8 个安装目标、32 个 Node 案例、16 个固定宿主、271 项容量案例 |
| main 集成 | [第 2 次通过](https://github.com/fbincon/claude-code-statusline/actions/runs/40927143667/attempts/2)；保留原三平台集成 smoke 与独立的已接受基线验证器 |
| 带注释 tag | [通过](https://github.com/fbincon/claude-code-statusline/actions/runs/40928310893)；提升同一来源与原始候选文件 |
| npm OIDC | [发布及后续验证](https://github.com/fbincon/claude-code-statusline/actions/runs/40930105973)：第 1 次完成新版本发布，第 2 次验证已发布版本 |
| 公开发布 | [7 项全部通过](https://github.com/fbincon/claude-code-statusline/actions/runs/40931917519)：6 个 OS／Node 下载安装任务与固定工具链签名验证 |

原始候选附件 `12912685067` 的 ZIP SHA-256 为 `a822d710b3a581b93f08b8c4afe9d7bf46bcffa72d14bdfb5a3a914ef217dc9d`。四项文件与两次独立构建、交付源码包重建完全一致；发布验证覆盖全部 1,062 个文件与四个产品目标。最终验收附件 `12920128077` 的 ZIP SHA-256 为 `001ab7e32a3fa899d2abaf3e2f8879f606f307a615fccafa6fdc5ddb65f6ddc8`；main／tag 提升附件为 `12921691677`／`12922090837`。

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.14.0.tgz` | `67ea588312c9f4dbb1927f2eb56de312f67a4d9981e78bc059fbcc785ae5c552` |
| `claude-code-statusline-3.14.0-source.tar.gz` | `644ffe7e387a941ccc8ee3108dc038ba212a431fde32586e07a7f41cfe26b1f6` |
| `build-manifest.json` | `a3bf7671baa7bd7af1151f66b545efec252feea21754ce0cc2fdc4d1f628b54d` |
| `SHA256SUMS` | `1252604ec30d65648ee7598407ed6275d0d9004e376dd9560c33cd8b3858e112` |

### 检查、重试与证据边界

最终来源的 `npm run check` 通过 1,443 项测试、6 项仅其他平台适用的跳过、92 项生成资源、3,881 个文档链接、冻结归档及完整迁移清单核验。精确最终 tgz 通过 27 项安装测试／26 个必需类别，以及 Claude Code 2.1.312 上全部 42 项已安装 Native／外部 PTY 流程，模型调用为零。五份完整场景回执分别保留六语言、五种样例、三种宽度及持久化／传输断言，并保持每场景原有 120 秒上限。

早期图像保留实际来源：`492d3d5` 对应 732 项样例重建与五张文档图；`ce1e159` 对应固定 2.1.310 的 Mod／类型／容量／安装／版本检查、1,080 项深浅色图像及四项单色检查。`75128bf` 与 `ee39ca5` 各自独立完成 1,080 项图像与四项单色检查，恢复终端状态且零模型调用。`ee39ca5` 的全部 1,061 个产品文件与最终候选相同，仅来源身份清单不同；不将这些图像改记为最终来源的执行。

上文保留发布前失败及修复。原合并场景进程超过 120 秒；拆为完整独立场景后保留每项断言与原进程上限。macOS 诊断证实，包审查已完成时，早先的运行中快照仍可能导致误报中断；产品修复重读有界状态，保留归属、修订、未知存活状态与期限检查。可移植 Windows 回归在关闭旧快照后发布，仍能使旧产品失败、修复后产品通过。

最终 PR 第 1 次记录 55 个成功任务、4 个失败验收任务及被阻断的聚合。四项均在同一来源上通过正式重试，断言和期限不变：

| 执行 | 原始失败 | 正式重试 |
| --- | --- | --- |
| Windows 2025／Claude 2.1.310 | 175 项 Native 测试与类型检查通过后，容量子进程失败 | 完整 Mod／类型／安装／版本流程与全部 271 项容量通过；附件 `12918912507` |
| macOS 15／Claude 2.1.294 | 未知保存结果测试超过 5,000 ms | 同一案例 1,669.58 ms 通过，完整宿主检查通过；附件 `12916953686` |
| Windows ARM 安装 | 独立管理器清理时 Koffi 模块被锁定 | 27 项安装测试与完整平台套件通过；附件 `12921240856` |
| Windows ARM／Node 22.x | 历史 3.8.0 基线阶段超过 900,000 ms | 基线 431,933.92 ms、编辑器执行 532,396.44 ms，均低于原上限；附件 `12919224115` |

[独立诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40908901263) 与[完整上下文诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40910688447) 也分别在 280,916／283,763 ms 内通过未修改的 271 项容量子进程，保持原 300,000 ms 上限。它们仅为不可提升的诊断；正式重试聚合 `123633695079` 提供验收。main 第 1 次保留三项成功集成 smoke，但在内容断言之前因 GitHub `UND_ERR_SOCKET` 响应失败；同源失败任务重试通过。未豁免任何失败或缺失门禁。

### 发布、签名与公开字节

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/40929421880/attempts/2) 通过；第 1 次在准备包之前因 GitHub HTTP 502 中断，仅建立准备证据。新版本发布于 `2026-10-29T18:23:48Z` 被接受；验证后的证明指向[第 1 次执行](https://github.com/fbincon/claude-code-statusline/actions/runs/40930105973/attempts/1)、来源 `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0` 与透明日志项 `3573461773`。

注册表最初对刚接受的 tarball 返回 404，导致发布后验证失败；没有重复发布。匿名读取确认精确 tarball 于 `18:31:05Z` 可下载，SHA-256／SHA-512 与原始 CI 包一致。失败任务重试成功，日志明确为 `already-published` 与 `oidc_verified:false`：它验证已有字节，不建立第二次 OIDC 发布。第 1 次在写入 `npm-publication` 回执之前结束；已接受发布日志和已验证公开证明保留真实发布身份。

[GitHub immutable stable／Latest Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.14.0) 于 `18:33:21Z` 发布，匿名下载核验全部四项原始附件。本地公开下载检查还通过空缓存精确版本与 `latest` 安装。npm `latest` 为 `3.14.0`，`beta` 保持 `3.0.0-beta.1`。

本地公开字节验证与公开签名任务均使用 npm 11.19.0 通过：外层两个注册表签名、两个证明 bundle、精确来源／tag／工作流、完整清单，以及六个精确公开上游与签名归档文件比对。上游未提供证明时明确记为缺失。公开签名附件 `12922498508` 的 ZIP SHA-256 为 `97305f22b8af7bf6067e497f481b11481f862d8db0db31fdbacb7b100a6b0ccd`。真实 3.13.0 基线也通过；受控失败拒绝损坏签名（`EINTEGRITYSIGNATURE`）、Sigstore 验证失败（`EATTESTATIONVERIFY`）、来源／摘要不符及清单遗漏。原生全树 `npm audit signatures` 仍无法遍历随包私有工作区，不声称全树审计通过。

[Gitee stable Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.14.0)（ID `1254758`）保留相同 tag／来源及四项显式上传文件；逐项匿名下载均与上表一致。Gitee 自动提供的两个源码归档与四项交付附件分别记录。原已验证 main 与带注释 tag 使用显式非强制 refspec 同步并核验远端；后续文档维护仅同步已验证 main，已发布 tag 对象与附件字节不变。

### 实际机器与收尾

本机经已验证、无冲突的 dry-run 后，由 3.13.0 升级至 3.14.0；全部 1,062 个已安装文件与验证后的公开包逐字节一致。Claude Code 2.1.312 上，实际外部编辑器（英语，120 × 32）与 Native 编辑器（简体中文，200 × 50）均通过五场景预览／取消／接受、行背景渐变编辑／取消、草稿导出、撤销重做及本地化样式／分组／历史管理器流程。Native 使用无外部路由的 Linux 用户／网络命名空间，核验 `ENETUNREACH`，模型请求尝试为零。九项原显示／界面／方案／来源／宿主偏好路径恢复并保留字节、权限及缺失状态，仅将项目拥有的后端版本升至 `3.14.0`。随后实际配置的 statusline 命令通过样例渲染，模型 ID、目录与上下文剩余含义符合预期，并再次核验偏好。本次发版后验证未发现新的产品问题。

[#178](https://github.com/fbincon/claude-code-statusline/issues/178) 与 [#180](https://github.com/fbincon/claude-code-statusline/issues/180) 已以 completed 关闭，并关联公开签名及实际机器证据。#179 在本轮范围外，保留原有 `closed / not_planned` 状态。仅沿用六项既有 [#96 缺口](https://github.com/fbincon/claude-code-statusline/issues/96)，仍为接受但未验证。自动终端和代理检查的重建图不代表物理验收或新增人工验收。SHOWCASE-01 保持 NOT_STARTED。发版后新增本机发现另提 issue 并保留 v3.14.0，本轮不追加修补版本。
