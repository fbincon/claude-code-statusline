# 编辑器、来源与诊断正确性修复

[English](correctness-maintenance.md) | **简体中文**

FIX-01、FIX-02、FIX-03、FIX-04、I18N-01 从 main `43487131476018c1f21857623ec9db8f015e01f5` 开始，已在 v3.9.2 完成验收与发布。发布及绑定源码的渠道证据在下方单独记录；本地检查不等于发布门禁。

## 共享草稿保护——FIX-01

共享 Editor 保留已提交草稿、revision、目标和安装身份。保存进行中／结果未知时，表单、组合、来源、方案、导入与快速配置均通过同一守卫修改显示草稿，已经打开的管理器也不例外。异步来源／方案响应修改草稿或基线前，必须仍匹配修改代次。

Native 沿用只读保存状态核对；外部 TUI 在结果未知时增加 Ctrl+K。读取区分已提交配置已保存、未提交、冲突和结果仍不可读，不再次发送 apply。结果确定后恢复编辑；冲突保留草稿和旧基线。中断恢复终端，并如实报告未确定结果，不声称没有更改。来源只读检查仍可使用。显示 Save、独立来源授权与宿主 Apply 保持各自事务边界。

## 进度条组合——FIX-02

Core 在样式处理前组合进度条、自有标签、图标及本地化百分比／方向。legacy 输出保持兼容，隐藏、短标签和自定义标签只处理一次，两个作用域共用该路径。数字默认值、阈值、舍入、零／缺失语义、完整字素和宽度省略保持不变；自适应进度条仍属于 APPEARANCE-07。

## 执行与消费者生命周期——FIX-03

GitHub 仅合并刷新身份一致的任务。任务 v3 保留不可变的初始 `owner`／`trigger`，持久化手动 `consumers: [{owner,expires_at}]`，有效期截至原任务 deadline。同一 owner 重复加入具有幂等性；适用的自动策略／会话租约独立提供自动需求。自动调度仍需单独审核和活跃会话。

编辑器关闭、CLI 中断仅释放自身消费者。`source_release {id,owner}` 幂等，最后一个消费者离开且无适用自动需求时才取消执行；`source cancel` 明确取消整项执行。自动关闭／租约到期保留手动消费者；来源编辑、禁用、删除使旧任务失效。进程取消和最终 revision／上下文／认证检查阻止迟到结果发布。`--no-wait` 返回后保留有界需求；命令来源继续限制每个来源只有一个运行任务。

v1／v2 任务只读归一化，不改写字节。运行中的旧任务不被新一代加入或接管，可完成、到期或被明确取消。显示 schema 15、来源注册表 2、观测 1、runtime 3、UI preferences 1 不变；编辑器协议 25 要求匹配前后端资源。

关闭源管理器也覆盖进行中的请求：迟到的上下文响应不能启动刷新，迟到的刷新响应会立即释放已离开的消费者。重新打开管理器不会接管先前请求。原生编辑器因保存尚未确定而拒绝关闭时，保留管理器的消费者。

## 扩展历史证据——FIX-04

历史诊断在选择值之前同时过滤 current 和 last-good，按输入时刻计算 TTL，排除之后的值及附属字段。无时间戳的值不能证明历史适用性，时间继续未知，也不参与历史输出；普通实时渲染继续保留时效未知行为。

证据按组件实例／代理组合累积一次。多个代理或组件副本共享值时不再覆盖彼此证据。诊断不执行 Git，以免把今天的身份用于旧输入；无法建立仓库／输入关联时保持不可用。仅输入模式不读取扩展来源。输入时间、诊断时间、观测时间分别保留，读取不发布或清理缓存。

## 任务语言——I18N-01

生成任务命令描述和首次窗格标题前解析 UI 偏好，任务读取失败不丢弃已成功加载的语言。刷新／重开重新读取偏好，检查命令归属并忽略旧代次响应。偏好读取失败时提示并回退英语，仍继续读取任务。任务错误保留语义化本地化，外部详情按原详情处理。

任务的普通 Pane 同样依据既有 Native 预算预检完整输出，必要时先缩小可见高度、再缩小宽度。完整报告留在宿主，导航使用最终接受的分页容量。只为同一报告、语言与宽度缓存换行结果，缩小高度和翻页不再反复对大报告换行；刷新或切换语言使展示缓存失效。不改变任务归属、计时或版本 1 任务读模型。

## 验收与交付

定向检查覆盖六语言进度条内容、历史／未知／partial／零值证据、全部代理与副本、双编辑器保存核对和管理器迟到响应、消费者重叠与旧任务解释。真实脱离 worker 和 CLI 信号验证释放及子进程终止；Windows 通过 IPC 递送信号事件，因为原生 `kill()` 会强制终止 Node。等待中的 CLI 在创建消费者前注册信号；确定性的注册期间立即中断还验证 start 调用返回后释放刚创建的消费者。冻结对照适配只接受当前 canonical 操作清单，Python 归档及原三项措辞例外保持不变。

候选验收保留八安装目标、32 项 Node 用例、十六固定宿主及 197 项 Native 容量用例，并运行适用的安装后终端场景。原始尝试留在忽略的验证目录。不运行付费模型测试，也不新增真人桌面／电源验收声明。仅接受 [issue #96 的六项既有缺口](https://github.com/fbincon/claude-code-statusline/issues/96)，继续标记为未验证。

实现与渠道验收均已完成。参见 [v3.9.2 说明](../releases/v3.9.2.md)、[版本专项批准](../releases/approvals/v3.9.2.json)、[CI 证据策略](ci-maintenance.zh-CN.md)及[发布流程](../RELEASING.zh-CN.md)。

## 最终稳定版交付

于 2026-10-28（Asia/Shanghai）完成。[PR #166](https://github.com/fbincon/claude-code-statusline/pull/166)从 main `43487131476018c1f21857623ec9db8f015e01f5` 交付五项修复。接受的发布源码为 [`c25e3a39e7b5fdf315d0eec68d16b5336837cbaa`](https://github.com/fbincon/claude-code-statusline/commit/c25e3a39e7b5fdf315d0eec68d16b5336837cbaa)，同树合并提交为 `4d1fa2ed42b4d4a600bfa56bccae5340245aeec1`。注解标签 `v3.9.2` 对象为 `9c66dc651dc2fe5f65b0c4614894ebc296d80e2b`，指向经该合并可达的已接受 PR 源码。

| 门禁 | 最终结果 |
| --- | --- |
| [最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40571508835) | 第一次运行通过：60 个成功任务，6 个不适用诊断／草稿任务跳过，Complete candidate evidence 通过 |
| [合并 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40578011705) | 第一次运行通过完整验收、影子证据提升及三系统集成冒烟（64 成功任务，4 个不适用跳过） |
| [注解标签](https://github.com/fbincon/claude-code-statusline/actions/runs/40583997603) | 第一次运行通过绑定源码的证据提升及 Complete candidate evidence（3 成功任务，10 个不适用执行分支跳过） |
| 稳定版就绪 | 八安装目标、32 项 Node 用例、十六固定宿主及 197 项 Native 容量用例绑定原始源码和包 |
| [OIDC 演练](https://github.com/fbincon/claude-code-statusline/actions/runs/40584508954) | 精确标签、main／tag 门禁、原始产物、批准及注册表检查通过 |
| [npm 发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40584822657) | 第一次运行通过 OIDC 发布新版本，注册表字节及选择器核验通过 |
| [公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/40585511195) | Linux／Windows／macOS × Node 22.23.4／24.22.1 六任务通过，包含十二次精确版本／latest 安装 |

登记版本专项批准改变了验收策略摘要，因此 main 同时运行完整验收和影子证据提升，并执行三系统真实安装冒烟。提升核验合并父提交、PR head／base、树／策略及原始回执／产物摘要。标签和 npm 沿已验证链读取原始 PR 产物 `12764209606`，没有将 main 回执或重建包重新标记为 PR 源码。原始产物 ZIP SHA-256 为 `4e828f1477fe0813c2cde326613a17eedbc350dfe76aeafca3901cfc3acbc3c8`。

| 工作包 | 已接受的回归证据 |
| --- | --- |
| FIX-01 | 双编辑器冻结保存进行中／未知时的显示修改，包括已打开管理器及迟到响应。已保存、未提交、冲突、不可读四类核对保留草稿且只提交一次。四项安装版外部保存回复丢失 PTY 验证 Ctrl+K 只读核对及恢复编辑。 |
| FIX-02 | 六语言覆盖两个作用域、四种标签、图标、阈值、零／缺失值、ANSI 复位与完整字素，同时检查内容和 40／80／120 单元格预算。 |
| FIX-03 | 独立编辑器／CLI 与自动需求共享一次执行；释放、最后需求、取消、策略／租约到期及来源变更分别断言。真实脱离 worker 与子进程拒绝迟到发布，十次立即／真实信号回归通过。 |
| FIX-04 | 早于／等于／晚于／未知时间、TTL 边界、partial／零值、附属字段及每个组件实例／代理组合，同时核对渲染及 JSON 证据。仅输入模式和诊断文件保全断言通过。 |
| I18N-01 | 六语言首次打开、失败、重试、重开检查真实命令描述、标题、控件及指导文字；偏好失败使用英语提示，任务失败保留成功加载的语言。大任务报告保留完整数据并采用有界展示。 |

最终本地 `npm run check` 通过 1,294 项测试，另有六项平台条件跳过。生成、63 资源一致性、文档链接与空白检查通过。两个官方 Mod、153 项 Native 产品测试、可用的 Claude 2.1.310 精确声明、全部 197 项真实宿主容量用例及 23 类安装检查通过。最终安装包另通过十七项原生／外部 PTY 场景、四项保存恢复 PTY、792 张六语言明暗捕获与四项单色终端控制。终端／配置恢复断言通过；代理检查五张原生和四张外部终端单元格重建图，它们不是操作系统截图或真人桌面验收。

早期候选 CI 暴露大任务窗格重复换行（[运行 40566004274](https://github.com/fbincon/claude-code-statusline/actions/runs/40566004274)），以及真实 macOS 信号早于消费者注册完成（[运行 40568823995](https://github.com/fbincon/claude-code-statusline/actions/runs/40568823995)）。按同一报告／语言／宽度缓存展示，以及启动消费者前注册信号修复了问题，保留原断言和时限。最终接受源码通过必需矩阵；早期尝试继续记录，不计为通过。

两次独立构建、两次交付源码重建、原始 CI 包、下载的 GitHub 草稿文件及匿名 GitHub／Gitee 下载，四文件均一致：

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.2.tgz` | `659091fa5068bdb5060e6bddd8c1b9e8b36f1eace6f7fcc3955d61f0a8e528e1` |
| `claude-code-statusline-3.9.2-source.tar.gz` | `74e05bc27c03da46e632aa9313a8c7487d04fcb5c37fb33bac5bb62de7387856` |
| `build-manifest.json` | `f0e12f7e1cae30d465e9cc9129b378fc31645a07d87982bb1d913532e27e4884` |
| `SHA256SUMS` | `b80a0f7cd7c8d908d82d8b10ce95d4e98e73b41ba6e8be8275ea2dd4625302ca` |

npm OIDC 第一次运行即成功发布新版本。公开注册表字节匹配 SHA-256／SHA-512，npm 来源证明记录已接受源码、`refs/tags/v3.9.2`、发布工作流及运行 40584822657 的第一次尝试。npm `latest` 为 `3.9.2`，`beta` 保持 `3.0.0-beta.1`。

[GitHub v3.9.2](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.2)为稳定／Latest，附件不可变。[Gitee v3.9.2](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.2)分发相同注解标签、源码及四附件，说明根据已发布 GitHub 元数据生成。npm 精确版本／latest 安装和匿名下载 Gitee 包的空缓存离线安装通过。检查分歧后，以明确 refspec 同步已验证 main 和原始标签对象。

Linux 测试机通过支持的 update 命令由 3.9.1 升级为 3.9.2，已安装源码摘要、doctor 及实际配置的 statusline 命令通过。真实安装版外部入口和 Claude 2.1.310 原生入口均打开快速配置并取消、不保存。显示配置和 UI 偏好与受保护的初始快照逐字节一致，集成设置仅改变自有后端版本。测试产生的宿主启动／API-key 确认状态已按受保护的宿主配置快照恢复。保留升级后的正式安装。

早期本机采集探针继承了 `TERM=dumb`，或选择了另一份 Claude 启动配置。为真实 PTY 选择 ANSI 环境，并使用本机已完成引导的常规配置后，安装版场景通过，无需修改产品。未成功的采集探针与最终通过回执分别保留，并保存各版采集器及摘要。

原始日志、私有配置快照和回执留在忽略的验证目录。不运行付费模型测试，终端捕获不调用来源提供者，也不新增真人桌面／物理验收声明。[v3.9.2 决定](../releases/approvals/v3.9.2.json)仅接受 [issue #96 六项既有缺口](https://github.com/fbincon/claude-code-statusline/issues/96)，继续未验证；不豁免任何新增自动化失败或缺失证据。
