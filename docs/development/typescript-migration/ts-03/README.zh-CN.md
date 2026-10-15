# TS-03 共享核心与后端迁移

[English](README.md) | **简体中文**

[总体迁移计划](../../typescript-migration.zh-CN.md)负责阶段状态。TS-03 从
`9b121e0` 开始，当前为 **IN_PROGRESS**。维护者已批准全部六批、逐批 PR、检查通过后
合并并同步 Gitee。本阶段不新增版本、不发布、不切换已安装后端，也不实现外部编辑器。

两轮性能优化已完成：[第一轮 PR #84](https://github.com/fbincon/claude-code-statusline/pull/84)、[第二轮 PR #85](https://github.com/fbincon/claude-code-statusline/pull/85)。第二轮完整 D06 **104 通过／60 失败／28 不确定**；TS-03 保持 IN_PROGRESS，第三轮实施需专项评审。输出／采集次数全部匹配，原预算、已安装后端及 TS-04 准入不变。[完整结果、退化与剩余差距](PERFORMANCE-OPTIMIZATION.zh-CN.md).

## 实施顺序

| 批次 | 交付 | 状态 |
| --- | --- | --- |
| 03-A | 私有 workspace、正式平台原语、无损 JSON、规范修订及对照框架 | DONE；[PR #78](https://github.com/fbincon/claude-code-statusline/pull/78) |
| 03-B | 配置核心、实例、目录、语言、Unicode 与生成归属 | DONE；[PR #79](https://github.com/fbincon/claude-code-statusline/pull/79) |
| 03-C | 加锁配置服务、偏好及管理命令 | DONE；[PR #80](https://github.com/fbincon/claude-code-statusline/pull/80) |
| 03-D | 采集、缓存、计时、任务、观察及 hooks | DONE；[PR #81](https://github.com/fbincon/claude-code-statusline/pull/81) |
| 03-E | 渲染、预览及完整后端协议 | DONE — PR #82 |
| 03-F | 整体等价、Mod 检查、CI、性能及 TS-04 交接 | IN_PROGRESS |

当前分支：`fbincon/ts-03-performance-round-2`。03-A／03-B／03-C／03-D 分别合并为 `21fb21d`／`f1363e3`／`0faa639`／`dc2e218`，每次合并后均验证 GitHub／Gitee main 一致。测试／合并提交和 PR 在验证后记录。
workspace 包为 0.0.0 私有开发包；现有 Python 应用仍为 2.0.0。

## 边界与复现

`packages/core` 存放可移植规则，其生产编译不引入 Node 全局类型；
`packages/platform` 负责 Node／原生 I/O，依赖纯核心类型；`packages/cli` 负责应用编排。
测试使用独立 Node 类型声明。包通过子路径导出，避免汇总入口提前加载全部模块。
两个现有 Mod 与 TS-02 探针保留独立构建。

使用 Node **24.21.0**、npm **11.19.0** 和用于对照的 Python **3.14.4**。
运行时压缩包校验值保留在 [TS-02 锁文件](../../../../tools/migration/ts-02/runtime-lock.json)。
默认 `python3` 不适用时，以 `TS03_PYTHON` 指定现有解释器。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run migration:inventory
npm run migration:capture -- /absolute/new-output-directory
npm run migration:compare -- /absolute/new-output-directory/results.json
```

capture 拒绝已存在的输出目录。每个已实现案例在新 Node 进程中执行，配置、运行态和
会话目录独立，不继承模型凭据，PATH 隔离；仅归一化案例根路径。缺少适配器记为待完成，
退出码为 2，不计入等价通过。03-A 交接时全部 161 个功能适配器及 516 项 TS-03 测试待迁移；03-B 实现了 8 个 schema 读取案例和 24 项具名替代测试，尚有 153 个案例和 492 个测试 ID 等待后续批次；
基础测试是新增证据，不能替代这些案例。`npm run migration:inventory -- --complete`
必须拒绝未完成状态。

原始参考提交、夹具、期望、适配器哈希和 D06 预算保持不变。Windows v2 启动标识继承
已批准的 D02 修正。整数字面量无损读取；浮点规范化遵循 Python 有限 binary64 表示、
指数阈值和负零，按 Unicode 码点排序键并以 UTF-8 计算现有语义修订。
跨进程锁保留 Python 命名空间，同步事务拒绝递归或异步锁回调。原子发布保证单文件
完整旧／新值；中断安装的跨文件恢复仍属 TS-04。

## 已批准差异与验收

维护者允许调整人类可读的 CLI 帮助和参数诊断。正常命令输出、协议消息／代码、
stdout／stderr 分工和退出码仍兼容。准确的文字变化通过案例、字段及新旧内容哈希记录在
[differences.json](../../../../tools/migration/ts-03/differences.json)；过期、重复或扩大范围
的例外均验证失败。当前准确记录三处帮助／参数诊断文字，不豁免协议、数值、文件或退出码差异。

[覆盖台账](../../../../tools/migration/ts-03/coverage.json)包含基线中归属 TS-03 的全部
516 个测试 ID。迁移项须关联替代测试路径；推迟到 TS-04 的项目须注明具体原因。
混合的编辑器／安装断言按行为拆分，不能通过重命名测试类别丢弃。

03-A 本地基础验证：28 项测试，27 通过，Linux 上跳过 1 项 Windows 共享冲突测试；
编译通过。包括与 Python 对照的确定性有限 IEEE-754 数值、16 个混合写入者、双向锁持有者
死亡、发布异常／崩溃、原生时钟／进程身份及 argv 保真。跨平台检查在既有 TS-02 八目标
运行正式适配器。实体设备电源／桌面补验和 2.1.296 宿主声明缺口继续保持原有明确限制。

原始证据存放在被忽略的 `dist/validation/typescript-migration/ts-03/` 下。
提交脱敏结果，记录源码／运行时哈希、命令、计数、失败／跳过及准确 CI／PR 链接。
只有 TS-03 全部验收完成才闭合阶段。

## 03-B 配置与资源归属

核心现已校验并迁移显示 schema 1–8，保留禁用实例选项，协调显式行布局，编辑作用域表单／实例，展开预设，校验可移植草稿并生成语义导入审阅。配置服务与文件操作归 03-C，渲染归 03-E。全部 84 份固定渲染配置通过校验；8 个 schema 案例在独立 Node 进程回放，原始语义状态及文件字节完全一致，无例外。

`tools/generation/resources.ts` 统一生成 34 个资源。项目 ID 和预设来自 TS 定义，语言来自规范 JSON，Unicode 表和夹具来自固定源数据及许可证；两个 Mod 和 Python 兼容资源一并生成。旧 Python 生成命令保留只读检查，历史 Python 基准须使用固定参考导出。移除语言会识别过期的生成模块和兼容资源，不删除无归属文件。`npm run languages:coverage` 只报告缺译，不写入。

03-A 产物审计最初因 Windows 将 10 个根配置／工具文件转为 CRLF 而拒绝其哈希。已逐项验证差异恰为该换行转换，记录在[验收记录](validation.03-a.json)，未发现其他差异。03-B 为这些文件固定 LF。失败检查已明确记录，平台原始记录继续保留在忽略目录；03-A 的 43 项 PR 检查均在受 head SHA 保护的合并前通过。

## 03-C 配置服务与命令

开发入口为 `node packages/cli/dist/src/entry.js`，提供全部 `config` 子命令与配置 UI 服务；成功的正式预览渲染在 03-E 接入。已安装的 Python 命令保持现状。评估 TS 入口时使用隔离的 `--config-dir`。后端绑定完整 `LaunchSpec` 并拒绝另一渲染器，保留规范旧单可执行文件命令兼容。

事务在既有安装锁内重读、比较语义修订、合并无关设置，只备份变化的文件，写入失败时回滚，并在锁内返回提交后快照。重复保存不新增备份。读取、dry-run 和导入审阅保持配置字节，便携导出保护实时配置与受管理支持目录。UI 偏好和运行／编辑器开关彼此独立。JSON 保留数值类型与精度，数字形式的对象键保留输入顺序，公开的非法 JSON／UTF-8 诊断与固定 Python 3.14 对照一致。

03-C 交接时台账映射 516 项基线测试中的 78 项，Linux 重放覆盖 161 个固定案例中的 26 个，仅有三处获准文字差异。43 项 PR 检查全部通过；八目标产物的 106 个源码哈希均精确一致。CI 同时运行 Python／TS 混合配置及语言偏好写入者。源码、CI、合并与同步记录见 [validation.03-c.json](validation.03-c.json)。03-B 的八个 ZIP 摘要及源码哈希全部精确核对，无需换行归一化例外；重复 push 工作流的一次 Mod 超时及同提交 PR 成功结果均见 [validation.03-b.json](validation.03-b.json)。

## 03-D 采集与运行逻辑

TS 入口已接入 `runtime [--config-dir PATH]` 和 `hook`。运行协议 v2 与 v1 使用原有偏好和磁盘 schema；整批观察先完整校验再发布。读取、关闭采集和损坏状态检查不修复文件。Hook 保持静默，即使无法记录证据也成功退出；已安装后端继续使用 Python。

`core/runtime`、`core/timing` 的纯模块负责任务转换、身份关联、原生／等待覆盖、用量规则与 Git 解析；`cli/runtime` 的应用服务负责共享缓存、会话注册表、transcript／提交游标、任务／实时账本和传统 Agent 时长证据。`RuntimeContext`、`RuntimeIO`、`CommandRunner` 注入时钟、进程身份、文件系统和 Git 执行。文件操作沿用平台锁与原子发布：实时观察先取 live 锁，再取 task 锁；用量可以先取 cache 锁，再取 task 锁；任务写入者不反向获取 live 或 cache 锁。最终证据需要时，在任务转换内部取得有界提交索引锁。

用量保留逐消息最大值、缺失与明确零的区分、各计数器独立快照增量、5,000 个 ID 折叠及 100 个会话上限。UTF-8 游标仅越过完整字节行。Git 状态保留 500 ms 缓存，分支差异使用不可变提交键及共享超时。计时保留 Stop／续接、通知别名、重叠等待、重启降级和冻结结果。运行协议最多读取 1 MiB 加一个字节；另独立验证 Python 兼容浮点除法、补偿求和、ISO 时间与字节文件编码识别。

本地 TS 验证：276 项测试，275 通过，1 项 Windows 共享冲突测试在 Linux 跳过。台账核销 **206/516** 项，**310** 项待完成；10 项混合 token 测试已具备 TS 采集断言，但渲染输出断言明确留在 03-E，尚不记为完整迁移。固定重放通过 **45/161** 个案例，仅保留原三处 CLI 文字差异；**116** 个渲染／预览／slash 案例待完成。另以 24 个会话的动作序列逐步对照原始 TS-01 Python 导出，比较结果、最终 JSON 状态及数值类型。实际多进程测试覆盖 20 个 live 写入者、8 个 Agent 启动、4 个有界账本写入者及 6 个用量缓存写入者；Git 集成覆盖 worktree、submodule、浅克隆和分支分歧。最终渲染、两个 Mod 绑定 TS、性能验收及完整台账核销继续归 03-E/F。源码绑定的本地证据见 [validation.03-d.json](validation.03-d.json)，其中记录全部 43 项成功 PR 检查。八目标干净产物分别精确匹配 161 个源码哈希及固定运行时哈希，随后完成受 head SHA 保护的合并及 Gitee 一致性核验。

## 03-E 渲染与完整后端接口

`core/rendering` 提供实际主／子行、预览、样式、Unicode 拟合、阈值、独立实例格式和 Powerline；`cli/rendering` 通过 `RenderEnvironment` 按需连接来源，`platform/presentation` 负责词法路径、日期和主机名操作。私有开发入口现已支持计划内的全部后端命令和 UI v11 操作。UTF-8／BOM、NDJSON 任务 ID、空行、冻结计时及 stdout／stderr 契约均有回归覆盖。重复指标共享原始快照，预览替换所有实时来源。

生成器继续维护 34 项资源。Core 与 Client 共享延迟初始化的 Unicode 表访问器，ASCII 渲染不分配表数组；状态栏小语言包按语言加载，不将 UI 词库带入渲染路径。大小写折叠／首字母大写及数字文本解析针对 Node 新版数据库差异显式保留 Python 3.14 UCD 16 语义，资源生成不调用 Python 业务逻辑。

编辑器请求／结果接口保留 `LaunchSpec` 和 cwd，检查命令前置条件、限制结果文字并映射全部结束状态。测试注入适配器，开发后端在 TS-04 接入真实终端前返回既有不可用提示。现有 Python 安装和 Mod 绑定保持原状。

全部 **161/161** 个固定案例通过，仅有原先三项 CLI 文案差异。本地 TS **455 项中 454 通过**（一项 Windows 平台跳过），Python **856 项中 847 通过**（九项平台跳过），native Mod **112/112**、runtime Mod **10/10**。台账达到 **389/516** 项已迁移，仍有 **127** 项 pending，`--complete` 仍须失败。[验证证据](validation.03-e.json)绑定源码和固定运行时。剩余工作归 03-F：全台账审计、跨模块及 Mod 到 TS 验证、D06 性能／无 Python 验收和 TS-04 交接。本批不将 TS-03 标记为 DONE。


## 03-F 整体验收进行中

03-E 在 43 项 PR 检查通过后合并为 `10c6348aef1fcd1d2a1681aa808a842e0d883b56`。八份平台证据分别匹配 201 个源码原始哈希及固定运行时；GitHub、Gitee main 均独立核验为该合并提交。首次 Windows CRLF 差异在合并前被拒绝并修正；[03-E 证据](validation.03-e.json)保留两次尝试。

516 项清单现为 **471 项已迁移、45 项外部 TUI／安装／终端测试交接 TS-04、零 pending**。[断言交接清单](../../../../tools/migration/ts-03/ts04-handoff.json)逐项列出延期测试及八项混合测试中的剩余断言，后端部分均有 TS 证据。`migration:inventory -- --complete` 同时校验两份台账并拒绝缺少责任归属；CI 现要求完整核销。

新进程测试覆盖五种输出语言，每次只加载所选小语言包，不加载其他语言或 UI 目录。CLI 帮助及参数错误遵循已解析的界面偏好和显式语言覆盖；机器目录不受界面语言影响。仅为已获准的帮助文案调整更新了 `cli-help` stdout 精确哈希，原始 Python 期望及另外两项诊断例外保持原样。

两个 Mod 的原始纯逻辑模块被编译到临时测试树，通过空 PATH 环境连接真实 Node 后端。native 解析器校验全部十项 UI v11 操作、保存／无变化／过期修订、导入审阅、样式片段及错误；runtime 队列验证 v2 确认、重试／去重、v1 读取、禁用／仅计时模式及有界批次。同一环境还执行 render、子代理 NDJSON、hook 和 slash-hook，无 Python 调用。另以 Claude Code 2.1.296 PTY 和临时 Mod 绑定验证真实主机进程 API：两个严格清单通过，配置 describe/read/preview/preferences 和 runtime observe 成功，无模型调用且清理完成。这是自动主机证据，既定实体设备／桌面发布前门槛继续保留。

[性能工具](../../../../tools/migration/ts-03/performance/benchmark.ts)覆盖十项完整命令和 22 项进程内负载：三种固定 transcript／Agent／Git 规模、冷／热／追加游标、Git 未命中／命中／过期、重复指标、Unicode 排版、代理、hook、预览及 runtime observe。夹具和字节码预热不计入测量；每个样本核对输出及采集次数。新缓存保留基线的一次生命周期／用量迁移扫描，热刷新不再读取 transcript。正式 D06 要求干净已提交的源码，每侧 50 次、三轮交替、Python 冷／热字节码分开；记录 P50/P95、真实峰值 RSS、策略／运行时／源码哈希并执行一次噪声复测规则。`--validate` 只校验夹具，不能记为性能通过。干净提交 `1fddaa6ea1fef7f631e51641f15214cbddd7ec08` 的正式测量已完成，结论为 **失败**：91 项通过、69 项失败、32 项不确定。19,200 个样本的输出及采集次数全部一致。[完整 D06 记录](PERFORMANCE.zh-CN.md)保留所有判定及源码／运行时／策略哈希。

本地验收通过 TS 550 项中的 549 项（一项平台跳过）、Python 856 项中的 847 项（九项平台跳过）、两个 Mod 测试（112/10）、两个 Mod 类型／严格校验、34 项生成资源、五项保留的只读生成检查及完整 516 项台账。[03-F 验证](validation.03-f.json)记录精确源码和日志；[TS-04 交接](TS04-HANDOFF.zh-CN.md)记录编辑器／安装剩余断言。首个提交已通过 43 项 PR 检查，八目标产物分别精确匹配 296 项源码。最终帮助参数差异矩阵修正无效命令／缺失选项／互斥参数的退出码，保留已批准的帮助文案差异。最终 head／检查／产物核验记录于 [PR #83](https://github.com/fbincon/claude-code-statusline/pull/83)。**D06 失败，TS-03 保持 IN_PROGRESS。** 性能整改继续归本阶段；合并实现与证据不豁免此门槛。
