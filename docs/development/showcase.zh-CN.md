# SHOWCASE-01 实现与证据

[English](showcase.md) | **简体中文**

[路线图](roadmap.zh-CN.md#milestones)负责工作包状态，[开发计划](development-plan.zh-CN.md#showcase-01)负责范围与验收。本记录分开展示验收和文档维护验收；公开入口为[用户走查](../SHOWCASE.zh-CN.md)与[图库](../images/showcase/README.zh-CN.md)。

维护者批准实施计划后，工作从 main `91133d20e8d961934465a440a11c0ca073b60ba2` 开始。本次围绕既有版本维护，不新增产品版本、标签、Release 或 npm 发布。公开命令、格式和默认行为不变。

<a id="baseline"></a>

## 固定产品与采集身份

| 身份 | 值 |
| --- | --- |
| 产品 | `@fbincon/claude-code-statusline` 3.16.0 |
| 产品源码 | `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` |
| 公开安装包 SHA256 | `2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a` |
| 既有发布证据 | [v3.16.0 交付](language-expansion.zh-CN.md#final-release) |
| 格式 | 显示 schema 17；编辑器协议 31；单方案格式 1 |
| 起始机器 | Linux／Node 24.21.0／npm 11.19.0／Claude Code 2.1.314；实际素材元数据记录完整环境 |

采集前必须核对产品包与安装文件清单。新采集工具的提交／文件摘要与产品源码、包摘要分别记录。现有采集套件保留严格的 `sourceHashes()` 匹配，使用时在精确源码检出目录运行。新展示回执不是原产品完整验收回执，后续文档提交也不重新标记旧素材。

<a id="prerequisites"></a>

## 十八个前置工作包与全部切片

下列记录建立已接受的前置交付链，保留原 PR／main／tag、产物、失败及重试身份。历史语言／矩阵数量描述当时版本，不是 SHOWCASE-01 的新执行。

| 工作包 | 已接受切片覆盖 | 原验收 |
| --- | --- | --- |
| FIX-01 | 修改入口盘点 → 共享未知保存保护 → 核对及继续编辑 | [v3.9.2 正确性](correctness-maintenance.zh-CN.md#最终稳定版交付)，PR #166 |
| FIX-02 | 数字／条语义 → 共享标签组合 → 主栏／子代理回归 | [v3.9.2 正确性](correctness-maintenance.zh-CN.md#最终稳定版交付)，PR #166 |
| FIX-03 | 消费者归属 → 服务／编辑器／CLI 生命周期 → 重叠与过期 | [v3.9.2 正确性](correctness-maintenance.zh-CN.md#最终稳定版交付)，PR #166 |
| FIX-04 | 时间／证据身份 → 适用来源过滤 → 渲染／诊断一致性 | [v3.9.2 正确性](correctness-maintenance.zh-CN.md#最终稳定版交付)，PR #166 |
| I18N-01 | 偏好／任务初始化分离 → 首次／重试本地化 → 失败转换 | [v3.9.2 正确性](correctness-maintenance.zh-CN.md#最终稳定版交付)，PR #166 |
| APPEARANCE-05 | 共享主题 → 已审查调色板／渐变 → 有界选择及编辑 | [v3.10.0 源码与门禁](appearance-preview-diagnosis.zh-CN.md#源码与必需门禁)，PR #169 |
| PREVIEW-01 | 确定性场景 → 共享选择器／渲染 → 显示检查 | [v3.10.0 源码与门禁](appearance-preview-diagnosis.zh-CN.md#源码与必需门禁)，PR #169 |
| EXPLAIN-02 | 样式／来源原因 → 明确输入文件 → 分页解释与错误 | [v3.10.0 源码与门禁](appearance-preview-diagnosis.zh-CN.md#源码与必需门禁)，PR #169 |
| TASK-02 | 第一片：外部只读浏览／分页／刷新／缩放；第二片：共享筛选／搜索／展开／证据／阅读位置 | [v3.11.0 已接受交付](task-version-review.zh-CN.md#已接受源码与不可变交付物)，PR #172 |
| UPDATE-02 | 第一片：本地状态及已校验审查；第二片：执行／分离／恢复；第三片：受保护历史清理 | [v3.11.0 第一片](task-version-review.zh-CN.md#已接受源码与不可变交付物)，PR #172；[v3.12.0 第二／三片](source-command-package-management.zh-CN.md#v3120-交付记录)，PR #175 |
| SOURCES-01 | 第一片：不同停止动作及保留结果；第二片：已存 GitHub 检查分页；第三片：绑定复用和受保护清理 | [v3.12.0 交付](source-command-package-management.zh-CN.md#v3120-交付记录)，PR #175 |
| COMMAND-02 | 单独自动授权 → 活跃会话调度 → 取消／修订／生命周期验证 | [v3.12.0 交付](source-command-package-management.zh-CN.md#v3120-交付记录)，PR #175 |
| UX-03 | 共享历史／变更审查 → 编辑器控件 → 比较／导出／重载／重试恢复 | [v3.13.0 交付](draft-history-and-reuse.zh-CN.md#交付证据)，PR #177 |
| IMPORT-02 | 选定视觉字段 → 整组／引用导入 → 明确本地重绑定 | [v3.13.0 交付](draft-history-and-reuse.zh-CN.md#交付证据)，PR #177 |
| COMPOSITION-04 | 结构候选 → 审查／接受／取消 → 组合引用回归 | [v3.13.0 交付](draft-history-and-reuse.zh-CN.md#交付证据)，PR #177 |
| APPEARANCE-06 | 作用域／优先级 → 最终行背景着色 → 预览／编辑器／导入／解释 | [v3.14.0 交付](adaptive-row-scenarios.zh-CN.md#最终来源与发布身份)，PR #184 |
| APPEARANCE-07 | 语义回退 → 共享宽度／布局 → 编辑器选项及解释 | [v3.14.0 交付](adaptive-row-scenarios.zh-CN.md#最终来源与发布身份)，PR #184 |
| PROFILE-02 | 场景意图 → 匹配配置 → 选择／部分复用／来源 | [v3.14.0 交付](adaptive-row-scenarios.zh-CN.md#最终来源与发布身份)，PR #184 |

原 SETUP-01／APPEARANCE-01／APPEARANCE-02 流程继续以[首次配置与完整外观](setup-appearance.zh-CN.md)为依据。[Git 与终端交付](m8-m9-delivery.zh-CN.md)提供适用 TERMINAL-01 结果；[Native 容量与恢复](native-capacity.zh-CN.md)保留传输／Pane／Client 的独立边界。I18N-02 及之后的语言扩展已交付，但不增加前置条件。候选项不扩大本任务。

<a id="collection"></a>

## 采集与复现

五个可下载方案通过已安装产品从原方案派生，使用紧凑分隔符并清除不生效的行背景渐变／共享 Powerline 色块。日常方案添加普通前景渐变和会话费用；其他场景意图、联动可见性及额度对齐保留。见[方案映射](../SHOWCASE.zh-CN.md#scenes)。不编辑生成的内置方案，导入不能授予来源权限。

采集入口明确接收已校验 tgz、产品提交、新输出目录和字体文件。产品模块从安装包加载，录制器及依赖保留独立采集身份。场景检查覆盖英文／简体中文、40／80／120 列，以及深色／浅色／无色变体。浅色覆盖变体使用适合浅背景的前景渐变，明确记为变体，不悄然替换可下载方案。

`samples-v3` 通过 **540 个案例**：五场景 × 两语言 × 三宽度 × 三外观 × 六样本（`normal`、`warning`、`critical`、`zero`、`missing`、`long-content`）。五个方案均通过导入 dry-run、导入导出相等、预览只读及激活读回。生成十张 PNG，零模型调用，隔离安装已移除。采集器为 `9b9788e10b5b6d71f36698751b22af0a908ab819`；后续工具变更不改变该原身份。

先使用固定开发工具链构建，再运行采集工具：

```sh
npm run build
node dist/typescript/tools/acceptance/showcase.js \
  --artifact /absolute/fbincon-claude-code-statusline-3.16.0.tgz \
  --commit c89a2ca088099ccd3ceb76baf59ecf11d84b08f0 \
  --output /absolute/new-showcase-output \
  --font /absolute/terminal-font.ttf
```

采集默认零模型调用。[素材清单](../images/showcase/captures.json)将每个公开文件绑定至配置／输入、产品／工具身份、尺寸、主题、语言、字体、转换及摘要。原凭据、账户配置、转录和原始私有日志不进入公开跟踪文件。脱敏及裁切应记录；合成或回放值不得标成实时观察。

独立的公开命令走查使用 `showcase-operations.js`，同样传入 `--artifact`、`--commit` 和新的 `--output`。可选的 `--claude /absolute/claude` 只执行宿主版本检测；夹具安装关闭两个编辑器的宿主集成及两项运行时采集。`--github fbincon/claude-code-statusline` 明确允许在检查既有 `gh` 账户及仓库读取权限后执行只读查询，不传此参数就不查询 GitHub。`--previous-artifact /absolute/public-3.15.0.tgz` 另外启用公开 npm registry 上的精确版本教程；旧包 SHA256 固定为 `9064fa583037b57c3b3d0c876fabe6dd15e63c4a9b8e52446e1a2ef9dcabe683`。

系统临时文件系统配额不足时，将 `TMPDIR` 指向自己拥有且空间充足的目录。夹具及 npm 缓存保持隔离。配置快照要求普通自有文件；安装快照单独记录 npm bin 链接目标而不跟随。全部自有夹具通过平台适配器移除，并断言实际不存在。

证据类别保持独立：

| 类别 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 原生窗口采集 | 从指定桌面窗口取得的像素／帧 | 真人验收或未观察的平台 |
| 真实会话 PTY 重建 | 真实终端输出，使用明确字体和时序重建 | 实体桌面截图 |
| 真实输入回放 | 生产管线对已录输入的渲染及明确转换 | 新发生的实时交互 |
| 固定样本 | 指定观察值的生产渲染器可复现示例 | 账户用量、账单、当前 GitHub 检查或真实任务执行 |
| 代理视觉检查 | 对已生成图片／帧的检查记录 | 新的真人可用性研究 |

实际编辑器素材使用已批准的 PTY 重建路线。GIF 选择已观察关键帧，每帧停留 **1.4 秒**，属于编辑后的操作演示，不是实时录屏或性能测量。任务蒙太奇组合两个明确来源：先通过已安装渲染器回放已完成任务观察值，再接实际任务查看器读取复制状态的 PTY 帧；清单保留双方身份。全部新视觉素材不用 Powerline。APPEARANCE-06 连续背景需要彩色 Powerline，因此本组场景解释并链接其能力，不启用它。

`replay-04` 采集器为 `4f94f96911f20313b5a16e330b38b6e91f539b71`，英中回放通过，原始观察值不变，重复渲染的冻结结果相同。图中主任务已完成 14 秒，两个代理为 5／7 秒。模型身份及会话费用明确派生自实际 CLI init／result，**不是**原 statusline 回调。该并发会话的 CLI 费用是 0.00199048 美元，生产格式保留两位小数显示 `$0.00`，不代表免费。任务查看器的 `active_unknown`、`runtime_disabled`、`incomplete` 证据仍可见，不被改写成完整活跃计时覆盖。

版本图裁切终端单元格 `[0,12,120,11]` 的操作／诊断区，不展示完整前缀或当前版本页首。多个前缀的警告保持可见。来源记录保留完整帧及裁切边界，用户指南要求明确选择目标 `--prefix`。

<a id="budget-and-restoration"></a>

## 付费调用与本机恢复

维护者为本任务授权最多 **10 美元**。普通配置／编辑器／来源／版本检查不调用模型。必要普通任务和双代理观察使用同一个新任务账本，复用现有预留／结算规则，不重置历史账本。失败、重试和子代理共同计费；费用未知时保留预留并阻止新调用。

Claude 的 `--max-budget-usd` 只作用于非交互入口。因此付费提示使用受预算控制的入口；交互编辑器／窗口采集不发送无预算限制的提示。CLI／提供方估算费用与独立核验的服务商账单分开报告。

`paid-01` 完成两项受预算限制的任务：

| 任务 | 预留上限（美元） | CLI 记账费用（美元） | 离线观察 |
| --- | ---: | ---: | --- |
| 普通任务 | 1 | 0.00025330 | 出现指定标记，无代理 |
| 并发任务 | 2 | 0.00199048 | 恰好两个代理并发完成，执行两条获准 sleep |
| 合计 | 共同授权：10 | **0.00224378** | 费用均已知，无未结预留 |

费用来自 Claude CLI `total_cost_usd`，未独立核验服务商账单。这是两项顶层任务，不是模型／API 请求次数；并发任务包含其子代理。离线核对未发起新模型调用。原采集器在首次提交前执行，精确源码／编译快照保存在 `paid-01/collector.json`（SHA256 `ea098519db1f6b8d811da543f6ad7872869dff4390b548e49873044a1683523a`）。两项任务使用记录的 CLI 费用上限，**没有使用之后新增的 supervisor**；后续监督器回归是独立证据，不能追认为原执行已有的保护。认证副本清理另有记录，移除了本任务安装备份中复制的认证字段，没有修改原机器设置，也没有重标付费尝试。

本机九条跟踪路径恢复通过：原字节、权限及不存在状态完全一致，包含 `settings.json`；独立检查的 runtime 偏好文件仍不存在。产品保持 3.16.0。`preferences-exact-comparison.json` 的 SHA256 为 `b391c5a8ce0eaf01540a89fbb8b68a20944cd2e2a7458230f245bf0f640ebf3c`。实际配置命令及已安装渲染器随后通过 72 个**夹具**案例（十二语言 × 三宽度 × 主栏／子代理），未写偏好。这是已安装渲染器观察，不是 72 次新付费或实体会话。

收尾再次比较，九条路径仍完全匹配。两个付费会话夹具安装已在逐字节保留 24 份原始证据文件后移除，未发现仍引用它们的活动进程。私有会话、快照及日志保留在忽略目录。最终账本仍为 0.00224378 美元，未结预留为零；收尾和 CI 没有增加付费调用。

<a id="validation"></a>

## 分开的验收记录

| 验收线 | 必需观察 | 当前记录 |
| --- | --- | --- |
| SHOWCASE 包／操作 | 精确公开字节及安装清单；安装／配置／任务／来源／版本走查；保存重开、取消、失败及部分结果 | 已通过：本地操作、真实任务观察、六条最终编辑器／查看器走查、恢复、安装复用及最终 PR／main 证据 |
| SHOWCASE 配置 | 五个可导入方案；非 Powerline 断言；来源权限隔离；宽度／主题／无色及往返检查 | 已通过：540 案例、五项方案走查、十张样本 PNG |
| SHOWCASE 素材 | 十张场景 PNG、六段双语 GIF、四张来源／版本 PNG；完整解码、关键帧检查、来源及隐私检查 | 已通过：14 张 PNG、六段 GIF；完整 GIF 解码、来源摘要、关键帧与隐私已检查 |
| 工具回归 | 错误包身份、错误来源标签、Powerline 拒绝、恢复失败及既有预算未知费用行为 | `test-showcase-tools-04.log` 的 22 项专项测试通过，无失败／跳过 |
| 文档 | 当前事实盘点、双语语义、导航、保留锚点、文档／空白检查及仅提交文件检出 | 已通过：22 对更新、七对保留；48 份修改 Markdown 的原锚点全部保留；最终实施检出的 4,368 链接及空白检查通过 |

文档盘点覆盖首页、用户指南、专题指南、命令参考、图像索引及开发导航。修正当前数量、语言、方案、格式说明和项目绑定，保留原历史证据。既有目录与图片路径不迁移，重排章节保留公共锚点。公开导航不依赖忽略目录的本地证据文件。

语义／锚点盘点记录在 `documentation-audit.json`，SHA256 `ff210542b82e84b8de3f0ee586b0a846ef3640b7937f7147649b93b7363453a4`。它明确所审查的工作树字节，并排除另行编写的 SHOWCASE 文件。当时文档检查正确保留了尚未公开的媒体链接缺失，不改记为最终干净检出检查。

本地 `operations-02` 的六组走查通过，零模型调用：setup／install／doctor、JSON 观察、命令生命周期、导入授权隔离、3.15.0 → 3.16.0 教程和明确 GitHub 查询。它核对了 1,091 个安装负载文件及 candidate 身份清单。setup／install 演练保留不存在／已有配置；非 TTY setup 返回 2 且不保存；doctor 不留下持久文件变更。JSON 检查保留明确零值，并单独报告缺失、过期、非法和文件缺失。命令检查在退出码 7 后保留最后成功值，区分整作业取消，在关闭自动策略后保留手动执行，禁用来源后拒绝刷新。方案传输未在接收端创建来源授权。

教程用离线 npm、关闭脚本安装已核对的公开 3.15.0 tgz，再以已校验 3.16.0 管理入口访问公开 registry：升级 dry-run 保留目标，明确升级得到与公开 3.16.0 完全相同的文件，回退 dry-run 保留该安装。未重复独立的崩溃／恢复套件。GitHub 对 `docs/showcase-01` 在 `9b9788e10b5b6d71f36698751b22af0a908ab819` 的只读结果是 **valid／无 PR**，`ci=no_pr`，观察时间为 `2026-10-30T10:55:11.659Z`；这不代表检查通过。之后禁用来源并移除了隔离安装。

私有摘要：`dist/validation/showcase-01/operations-02/summary.json`，SHA256 `dc774d27e841f337c59edb3dbe4a1b09e4a4e3eed48aa2d731f569efec975b84`。它保留采集工具文件及编译摘要，包括当时工具未提交的标记。此前 `operations-01` 是采集器失败：把仅适用于配置的快照用于安装目录，误拒绝普通 npm bin 符号链接，而产品安装已经成功。修正安装快照及三项专项回归后通过。原失败及成功清理结果保留，不改记为产品验收。

精确 `c89a2ca` 版本管理套件另行通过从 3.7.0 和 3.8.0 出发的各七个案例，使用同一公开 3.16.0 字节。真实 npm 和受控本地 registry 验证升级／回退、包校验后中断、包恢复及独立配置恢复，包含保留编辑器控制入口和受保护清理。该套件使用仅返回版本的宿主夹具，零模型调用，不是实体编辑器运行。`version-roundtrips.json` 保留原匹配产品／采集器源码。

`installed-reuse-02` 在已安装模块上通过十二语言、40／80／120 列的历史、原子结构修复、视觉字段、整组引用闭包、未绑定来源、冲突重试、未知保存核对和保存重开。首次复用尝试遗漏夹具安装，正确触发 owned-renderer 保护；该准备失败独立保留，无须产品改动。

本机版本 check／dry-run 明确使用正确持久前缀 `/home/fbincon/.local`：当前和目标均为 3.16.0，兼容性通过，原因／冲突为空；dry-run 返回 `unchanged: true` 和 **`artifact_verified: false`**。同版本结果没有下载校验升级包。另行安装清单核验建立全部 1,092 文件与公开包相同的证据。早前临时目录配额和错误默认前缀诊断保留；后者是目标选择错误，不代表正常安装缺失。

`journeys-06` 通过六条真实编辑器／查看器 PTY 走查。之后独立复核加强了详情断言、来源摘要及清理检查，因此其成功画面保留原采集器身份。最终加固采集由新的执行提供，旧运行不重标为该新执行。

最终 `journeys-final-02` 使用干净采集器 `7081c45acbc60dbe60526dcdd723d3125205ddef` 和原公开包。英中外部、Native、只读查看器共六条走查全部通过；终端模式均恢复，已确认所属进程组结束，并在发布成功前移除隔离安装。任务投影与原流绑定，验证一个已完成主任务及恰好两个已完成代理。回执 SHA256：`bb1761079dde2f46e3af13ed329bc8097ec6e68565246f52fd22f71e6f52023e`。此前采集准备、方案文件格式、隐私裁切及任务事件筛选过宽等断言失败仍保留；它们是采集工具修正，不是产品改动。

[公开清单](../images/showcase/captures.json) 包含 20 个素材（14 张 PNG、六段 GIF，共 1,257,840 字节），完整 GIF 解码与关键帧检查通过。任务动图组合干净采集器 `4f94f96911f20313b5a16e330b38b6e91f539b71` 的回放和实际任务查看器帧，清单保留两种来源及每帧 1.4 秒的编辑停留。其他动图使用真实编辑器关键帧，包含明确保存后的重新打开。Native 裁切排除周围宿主内容；版本图保留动作／诊断区并排除私有路径。代理视觉检查不等于真人／实体验收。

复现组合任务动图时，先运行 `showcase-replay` 和 `showcase-journeys`，将回放 PNG 复制到新帧目录并命名 `frame-000.png`，再按 `receipt.json` 中该语言 browse 帧的顺序复制为 `frame-001.png` 等。调用 `showcase-journeys.js` 导出的 `encodeKeyframes(directory, frameNames, absoluteOutput)`，沿用记录的 128 色 Bayer 调色、1.4 秒停留、无限循环及完整解码检查。发布时保留原帧字节摘要、来源集合和编辑时间标记，不插入未观察到的中间状态。

运行 `npm run docs:check` 和 `git diff --check`。针对实际已提交差异运行 `ci:plan` 及全部选中的 `ci:check` 任务，要求包比较时使用 `--compare`。文档／媒体、示例及验收工具保留各自检查并取并集。归属或比较未解决时阻塞。本地回执不是 Actions 验收；最终 PR **Complete candidate evidence** 和适用 main 验证仍必需。本次不降低 CI 分类或保护。

<a id="delivery"></a>

## 交付与完成

**于 2026-10-30（Asia/Shanghai）验收。** SHOWCASE-01 与文档整理分别通过验收。[PR #192](https://github.com/fbincon/claude-code-statusline/pull/192) 交付工具、五套方案、20 件素材、双语走查及现行文档修正。证据跟进记录结果并将路线图标记为 DONE，不改变产品及原始采集身份。

| 交付身份 | 已验证结果 |
| --- | --- |
| 最终实施 head | `b61627e9983fea63ba79883e23446063382ff031` |
| 最终 PR CI | [运行 41049771362，第 1 次尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/41049771362)：Linux、Windows、macOS 专项检查、证据核验及 **Complete candidate evidence** 通过 |
| 实施 main | `258559d981eac20a7e5a6169d2d712e9ce196338`，正常双父提交合并 PR #192 |
| main CI | [运行 41050797157，第 1 次尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/41050797157)：已接受基线校验器核验复用的 PR 维护证据，**Complete candidate evidence** 通过 |
| Gitee 实施 main | `258559d981eac20a7e5a6169d2d712e9ce196338`，从原 main `91133d20e8d961934465a440a11c0ca073b60ba2` 以明确非强制 refspec 推送后核对一致 |

不可变实施计划在 Linux 选择 `acceptance`、`actions`、`assets`、`core`、`docs`，在 Windows／macOS 选择 `acceptance`。最终 head 的本地 Linux 回执通过，CI 提供其余平台执行。本次维护差异未选中包比较或完整产品矩阵。main 通过已接受第一父提交中的校验器复用原执行；其有意跳过不算新的执行样本，也不代表漏验。未修改分类器或保护规则。

在 `b61627e9983fea63ba79883e23446063382ff031` 创建仅含已提交文件的独立检出，关闭生命周期脚本安装锁定依赖后，`docs:check` 通过：**4,368 个链接，零错误**。空白检查及双语语义／锚点复核也通过。该干净检出结果与此前工作树盘点及其历史媒体缺失诊断分开记录。

纯文档收尾遵循同一受保护 PR／main 流程和自己的实际影响计划。最终合并与已核对的 Gitee 同步身份写入交接报告，不递归新增证据 PR。Gitee 仅在检查分歧后接收已验证 main；已发布版本引用／资产保持不变。

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项缺口保持**未验证**：macOS 实体休眠恢复；macOS 14 Intel 桌面／电源；Windows 10 桌面／双编辑器／焦点／中断／恢复；WSL 桌面启动／焦点／弹窗；其他目标平台电源／真人视觉覆盖；Claude 2.1.296 精确声明不可用。演示不使其通过，也不豁免新失败。采集发现的产品缺陷记录影响及是否阻塞；产品修复须另行确定范围。
