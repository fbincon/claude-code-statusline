# SHOWCASE-01 实现与证据

[English](showcase.md) | **简体中文**

[路线图](roadmap.zh-CN.md#milestones)负责工作包状态，[开发计划](development-plan.zh-CN.md#showcase-01)负责范围与验收。本页分开展示验收和文档维护验收；公开入口为[用户走查](../SHOWCASE.zh-CN.md)与[图库](../images/showcase/README.zh-CN.md)。

维护者批准实施计划后，工作从 main `91133d20e8d961934465a440a11c0ca073b60ba2` 开始。本次围绕既有版本维护，不新增产品版本、标签、Release 或 npm 发布。公开命令、格式和默认行为不变。

初次[交付记录](history/deliveries/showcase.zh-CN.md#交付与完成)仍作为 PR #192／#193 及 main `d409503491177542b6cb8834a83888649731bf28` 的历史证据。其紧凑方案、灰白编辑器帧、裁切边界、采集器身份及原验证结果不随后续视觉工作重标。当前经典彩色呈现见[经典彩色视觉修订](history/deliveries/showcase.zh-CN.md#经典彩色视觉修订)；旧素材字节及清单仍保留在原 Git 树中。

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

初次五个可下载方案通过已安装产品从原方案派生，使用紧凑分隔符并清除不生效的行背景渐变／共享 Powerline 色块。日常方案添加普通前景渐变和会话费用；其他场景意图、联动可见性及额度对齐保留。当前[方案映射](../SHOWCASE.zh-CN.md#scenes)遵循后续视觉修订。不编辑生成的内置方案，导入不能授予来源权限。

采集入口明确接收已校验 tgz、产品提交、新输出目录和字体文件。产品模块从安装包加载，录制器及依赖保留独立采集身份。场景检查覆盖英文／简体中文、40／80／120 列，以及深色／浅色／无色变体。浅色覆盖变体使用适合浅背景的前景渐变，明确记为变体，不悄然替换可下载方案。

`samples-v3` 通过 **540 个案例**：五场景 × 两语言 × 三宽度 × 三外观 × 六样本（`normal`、`warning`、`critical`、`zero`、`missing`、`long-content`）。五个方案均通过导入 dry-run、导入导出相等、预览只读及激活读回。生成十张 PNG，零模型调用，隔离安装已移除。采集器为 `9b9788e10b5b6d71f36698751b22af0a908ab819`；后续工具变更不改变该原身份。

先在固定采集工具提交中使用规定工具链构建，再运行采集。复现旧采集须使用其记录的工具提交；当前工具采用后续视觉配方：

```sh
npm run build
node dist/typescript/tools/acceptance/showcase.js \
  --artifact /absolute/fbincon-claude-code-statusline-3.16.0.tgz \
  --commit c89a2ca088099ccd3ceb76baf59ecf11d84b08f0 \
  --output /absolute/new-showcase-output \
  --font /absolute/terminal-font.ttf
```

采集还要求 `PATH` 中有 `ffmpeg` 与 `ffprobe`，用于 GIF 编解码；记录的采集使用 ffmpeg 8.0.1。采集默认零模型调用。[素材清单](../images/showcase/captures.json)将每个公开文件绑定至配置／输入、产品／工具身份、尺寸、主题、语言、字体、转换及摘要。原凭据、账户配置、转录和原始私有日志不进入公开跟踪文件。脱敏及裁切应记录；合成或回放值不得标成实时观察。

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

初版版本图裁切终端单元格 `[0,12,120,11]` 的操作／诊断区，不展示完整前缀或当前版本页首。多个前缀的警告保持可见。来源记录保留完整帧及裁切边界，用户指南要求明确选择目标 `--prefix`。

完整的[交付记录](history/deliveries/showcase.zh-CN.md#showcase-01-实现与证据)已归入开发历史。下方链接直达迁移章节。

- <a id="baseline"></a><a id="固定产品与采集身份"></a>[固定产品与采集身份](history/deliveries/showcase.zh-CN.md#固定产品与采集身份)
- <a id="budget-and-restoration"></a><a id="付费调用与本机恢复"></a>[付费调用与本机恢复](history/deliveries/showcase.zh-CN.md#付费调用与本机恢复)
- <a id="validation"></a><a id="分开的验收记录"></a>[分开的验收记录](history/deliveries/showcase.zh-CN.md#分开的验收记录)
- <a id="delivery"></a><a id="交付与完成"></a>[交付与完成](history/deliveries/showcase.zh-CN.md#交付与完成)
- <a id="visual-refinement"></a><a id="经典彩色视觉修订"></a>[经典彩色视觉修订](history/deliveries/showcase.zh-CN.md#经典彩色视觉修订)
- <a id="参考与组件色标"></a>[参考与组件色标](history/deliveries/showcase.zh-CN.md#参考与组件色标)
- <a id="采集边界"></a>[采集边界](history/deliveries/showcase.zh-CN.md#采集边界)
- <a id="已验证修订产物"></a>[已验证修订产物](history/deliveries/showcase.zh-CN.md#已验证修订产物)
