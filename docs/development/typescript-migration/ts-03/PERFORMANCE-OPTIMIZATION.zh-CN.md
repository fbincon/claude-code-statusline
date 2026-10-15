# TS-03 性能优化

[English](PERFORMANCE-OPTIMIZATION.md) | **简体中文**

状态：**IN_PROGRESS**。批准的两轮优化及各自原 D06 全量测量均已完成，第二轮为 **104 通过／60 失败／28 不确定**；本次实施停止，进入专项评审。保留[原 03-F 失败](PERFORMANCE.zh-CN.md)和[原始摘要](performance.03-f.json)作为历史证据。本任务不调整 TS-04 准入，也不切换已安装后端。

## 范围与复现

起点：`f7cf0e1`。分支：`fbincon/ts-03-performance`。显式使用 Node 24.21.0、npm 11.19.0、Python 3.14.4，不使用 shell 默认 Node。Python 基线：`9b6d2fab4bf165be280d428a874521bfbf02c7e1`。D06 策略、夹具、每侧 50 个样本、三轮交替、独立字节码模式、真实峰值 RSS、输出哈希及精确采集次数均不变，继续禁用编译缓存。

开发期诊断覆盖 transcript 冷读／热读／追加、复合渲染、hook、Git 命中和 32 Agent 渲染。CPU、分配和 GC 采样只用于定位。优化前全部 32 种负载通过夹具验证。首次诊断因堆采样器在退出前输出 GC 行而未能提取 worker JSON；修正后按实际 JSON 记录提取，两次诊断均保留在私有目录。这不是正式 D06 测量失败或重测。

## 第一轮：暂存式流式归并与缓存分配

内部 JSON 读取器对可安全分类的普通数据使用原生解析，对特殊数值类型和有序成员名单遍精确解析，消除数值占位对象与整树还原。公共严格解析和 Python 诊断保持不变。保序字典仅在数字／符号键需要时建立插入顺序索引，计数遍历避免中间数组。缓存序列化保持 Python 格式及数值拼写。

完整字节行到达时立即归并 usage，仅保留计数、各费用字段快照之后的增量和精简生命周期事件。读取失败时丢弃暂存结果，不发布部分游标、计数或任务状态。保留生命周期排序、分字段快照增量、ID 压缩、历史版本一次性重扫、锁顺序和磁盘格式。

新增回归覆盖 2^53 附近整数精度、非法 JSON 诊断、后续数字／符号键插入、有效行之后发生读取错误，以及对照固定 Python 实现的 72 组随机部分快照／重复消息序列。

## 验收及后续

第一轮完整 D06 **失败：97 通过、64 失败、31 不确定**，19,200 个样本的输出与采集次数均匹配。测量提交 `821915520b47e0f7a9dfa99c764c1d379a23a4da`；[完整摘要](performance.optimization-01.json)、[功能与 CI 证据](validation.optimization-01.json)、[PR #84](https://github.com/fbincon/claude-code-statusline/pull/84)。43 项 PR 检查通过，8 个证据包各自匹配 298 个源码哈希、固定运行时以及与 PR head 相同的测试合并树。4 个重复 push 运行已取消并单独记录，不计作通过。本地验证：TS **553/554 通过**（1 项 Windows 专用跳过），全部 **161 个固定用例**匹配且保留原三项 CLI 文案差异，**516-ID 审计**通过，Python **847/856 通过**（9 项平台跳过），官方 Claude Code 2.1.294 Mod 测试 **112 native / 10 runtime** 通过。两个 Mod 类型检查与严格验证、34 个生成资源、5 个保留只读生成检查及文档检查通过。首次系统 Python 环境缺少已安装 CLI 入口，出现 1 失败、11 跳过；改用仓库现有 Python 3.14.4 虚拟环境后全套通过，未因此修改源码或豁免测试。诊断结果不作为性能通过。第一轮后依据残余失败选择第二轮启动／原生绑定、Git 缓存、渲染或残余缓存优化。最多执行两个代码变更轮次；只有不确定项且没有失败项时，才可按原策略额外进行一次同代码完整噪声复测。

适用功能检查与 D06 全部通过前，TS-03 保持 IN_PROGRESS。若第二轮仍失败或不确定，保留阶段状态并提交专项评审；预算调整、第三轮实现、更换运行时或架构扩展均不自动执行。

私有证据目录：`dist/validation/typescript-migration/ts-03/perf-opt-*`。脱敏结果将分别记录测量提交与合并提交。

## 第一轮结果及第二轮重点

以下为暖字节码模式三轮中位数；预算依据本轮 Python 基线计算。

| 指标 | 原 TS 候选 | 第一轮 TS | 本轮预算 | 判定 |
| --- | ---: | ---: | ---: | --- |
| `in-process/large/transcript/cold` peak_rss (MiB) | 848.98 | 445.04 | 519.81 | pass |
| `in-process/large/transcript/cold` p50 (ms) | 1361.33 | 900.68 | 1843.23 | pass |
| `in-process/medium/transcript/cold` peak_rss (MiB) | 326.38 | 265.99 | 100.96 | fail |
| `in-process/large/transcript/warm` p50 (ms) | 139.13 | 124.29 | 59.54 | fail |
| `command/large/render-composite` p50 (ms) | 275.06 | 288.16 | 148.83 | fail |
| `command/large/render-composite` p95 (ms) | 294.13 | 346.67 | 170.16 | fail |
| `command/hook` p50 (ms) | 77.72 | 77.22 | 54.93 | fail |

没有原通过项变为失败，但原不确定项出现了新的失败，不能以总通过数增加掩盖它们。大型完整命令延迟退化也单独保留。第二轮优先恢复大缓存普通字典的原生解析效率，减少中型冷读分配，并处理 hook 依赖、原生绑定和多 Agent 重复布局。保留预算，不对本次含失败的代码原样重测。


## 第二轮：减少重复初始化与渲染工作

第二轮分支 `fbincon/ts-03-performance-round-2`，测量提交 `93384f573ddb02b4067947493b6d89a64b276341`，对应 [PR #85](https://github.com/fbincon/claude-code-statusline/pull/85)。大型普通 `ids` 子树独立使用原生 JSON 解析；数值筛选限定合法 token 起点，避免把 `agent-0-…` 误判为负零。大整数、浮点类型、重复／转义／数字形键和异常语法继续走精确路径。安全整数汇总在溢出之前将原始操作数转为 BigInt。

运行时目录辅助函数与配置管理依赖拆开；原生模块、结构类型和函数绑定按需初始化，复用成功绑定，时钟／进程观察值与失败不缓存。hook 仅对 SubagentStart/Stop 加载 Agent 时长服务，并在异步导入前取得原时点。Git 命中路径使用精确快速解析，仍验证版本、cwd、500 ms 有效期及结果结构。单次 Agent 渲染准备格式、配置索引、调色板和最多 1,024 项完整字符串宽度；只计算启用组件，不跨请求保留配置或文本缓存。

本地验证：**556/557 TS 测试通过，1 项平台跳过**；161 个固定用例、516-ID 审计、Python **847/856（9 跳过）**、Mod **112/10**、两个类型检查／严格清单、34 项资源、五项只读生成检查全部通过。新测试覆盖大型 JSON 子树、整数汇总越过安全边界、0/8/32 Agent 与渲染间配置变更。源码提交的 **43 项 PR CI 成功**；八份摘要校验后的证据分别匹配 298 个源码哈希、固定运行时及相同的测试合并树。证据见 [validation.optimization-02.json](validation.optimization-02.json)。文档补充提交的最终 CI、head、合并 SHA 和 Gitee 同步确认登记于 PR #85；这些集成提交与测量提交明确分开。

## 两轮结束后的正式结果

**第二轮仍为 FAIL：104 通过、60 失败、28 不确定。** 每轮各 19,200 个正式样本、192 项判定，两个字节码模式均完成三轮交替；所有输出、采集次数和测量前后源码／夹具哈希一致。两轮均含失败，均未使用同代码噪声复测。原始 `performance.03-f.json` 保留不变。

| 版本 | 测量提交 | 通过 | 失败 | 不确定 |
| --- | --- | ---: | ---: | ---: |
| 原 03-F | `1fddaa6` | 91 | 69 | 32 |
| 优化第一轮 | `8219155` | 97 | 64 | 31 |
| 优化第二轮 | `93384f5` | 104 | 60 | 28 |

[第二轮完整摘要](performance.optimization-02.json)和[全部 192 项前后对比](performance.optimization-comparison.json)记录每个判定、各轮数据和预算差距。下表为暖字节码三轮中位数；负差距表示中位数低于预算，不能覆盖跨轮的 `inconclusive` 判定。

| 负载 / 指标 | 原 TS | 第一轮 | 第二轮 | 本轮预算 | 剩余差距 | 判定 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `in-process/large/transcript/cold` peak_rss (MiB) | 848.98 | 445.04 | 436.88 | 520.12 | -83.24 (-16.0%) | pass |
| `in-process/large/transcript/cold` p50 (ms) | 1361.33 | 900.68 | 925.44 | 1776.89 | -851.46 (-47.9%) | pass |
| `in-process/medium/transcript/cold` peak_rss (MiB) | 326.38 | 265.99 | 262.51 | 100.91 | +161.60 (+160.1%) | fail |
| `in-process/medium/transcript/warm` peak_rss (MiB) | 190.02 | 152.82 | 130.91 | 100.82 | +30.09 (+29.8%) | fail |
| `in-process/large/transcript/warm` p50 (ms) | 139.13 | 124.29 | 114.80 | 57.90 | +56.90 (+98.3%) | fail |
| `command/large/render-composite` p50 (ms) | 275.06 | 288.16 | 247.53 | 144.04 | +103.49 (+71.8%) | fail |
| `command/large/render-composite` p95 (ms) | 294.13 | 346.67 | 258.79 | 159.49 | +99.30 (+62.3%) | fail |
| `command/large/render-composite` peak_rss (MiB) | 136.98 | 127.50 | 122.62 | 76.66 | +45.96 (+60.0%) | fail |
| `command/hook` p50 (ms) | 77.72 | 77.22 | 68.94 | 52.05 | +16.89 (+32.5%) | fail |
| `in-process/medium/git/hit` p50 (ms) | 0.33 | 0.29 | 0.15 | 0.17 | -0.02 (-11.5%) | inconclusive |
| `in-process/large/agents` p50 (ms) | 5.84 | 5.61 | 2.79 | 2.45 | +0.34 (+13.8%) | fail |
| `command/runtime-observe` p50 (ms) | 96.99 | 99.09 | 97.56 | 91.87 | +5.69 (+6.2%) | fail |

大型冷读 RSS 从原候选 848.98 MiB 降至 436.88 MiB（约 48.5%）；大型完整渲染 p95 从第一轮 346.67 ms 降至 258.79 ms，恢复了第一轮的退化，但仍高于预算。32 Agent p50 从 5.61 ms 降至 2.79 ms，仍高于 2.45 ms 预算。以上是各次测量的观察值，不能代替逐轮判定。

## 逐项退化审查

相对第一轮：没有 pass→fail，**5 项 pass→inconclusive、10 项 inconclusive→fail**，全部列于下表。10 项新增失败的 TS 中位耗时实际均低于第一轮，但相应 Python 基线／跨轮超限情况变化，因此保留失败，不将它们解释为通过。相对原 03-F，**`command/runtime-observe` 暖模式 p50 从 pass 变为 fail**：TS 96.99→97.56 ms，Python 91.11→83.51 ms，预算 100.23→91.87 ms；本次三轮都超限。

| 负载 | 模式 | 指标 | 第一轮 → 第二轮 | TS 第一轮 → 第二轮 (ms) |
| --- | --- | --- | --- | ---: |
| `command/medium/render-composite` | warm | p95 | inconclusive → fail | 129.188 → 117.641 |
| `command/runtime-observe` | warm | p50 | inconclusive → fail | 99.090 → 97.557 |
| `in-process/small/transcript/cold` | warm | p50 | pass → inconclusive | 2.819 → 2.964 |
| `in-process/small/transcript/append` | warm | p50 | inconclusive → fail | 2.736 → 2.339 |
| `in-process/small/transcript/append` | warm | p95 | inconclusive → fail | 4.031 → 3.229 |
| `in-process/small/git/expired` | warm | p95 | inconclusive → fail | 10.742 → 8.317 |
| `in-process/medium/git/miss` | warm | p95 | pass → inconclusive | 23.671 → 16.264 |
| `in-process/large/git/expired` | warm | p50 | pass → inconclusive | 42.923 → 39.205 |
| `in-process/small/transcript/cold` | cold | p50 | pass → inconclusive | 3.072 → 2.802 |
| `in-process/small/transcript/cold` | cold | p95 | pass → inconclusive | 5.322 → 3.720 |
| `in-process/small/transcript/append` | cold | p95 | inconclusive → fail | 2.997 → 2.721 |
| `in-process/small/git/miss` | cold | p95 | inconclusive → fail | 8.414 → 8.155 |
| `in-process/small/git/expired` | cold | p50 | inconclusive → fail | 8.307 → 7.458 |
| `in-process/small/git/expired` | cold | p95 | inconclusive → fail | 9.160 → 8.297 |
| `in-process/medium/git/expired` | cold | p50 | inconclusive → fail | 14.072 → 13.575 |

全部 192 项中有 22 项 TS 原始中位数高于第一轮，对比 JSON 逐项保留。较明显的变化包括小型暖模式冷读 p50 2.819→2.964 ms（+5.1%，变为不确定）；中型冷读 p50 暖／冷模式分别 +2.3%／+4.0%；大型冷读 p50 分别 +2.7%／+2.9%，这些中大型冷读延迟仍通过。Unicode 冷模式 p50 0.0366→0.0411 ms（+12.4%）仍通过；其 p95 继续失败。没有仅用总通过数评价收益。

## 停止点与专项评审入口

已完成批准的**两轮实施及各自完整 D06**；TS-03 保持 **IN_PROGRESS**。已验证的总体收益可按 PR 检查流程集成，但不代表阶段准入通过。第一轮测量 `8219155`、最终证据 head `735ff9c`、合并 `b8e1b296e47e1b3de2a50afc0c9bb8b2b506d357` 已分别核对，GitHub／Gitee main 曾独立确认一致；第二轮测量 `93384f5` 的最终集成记录见 PR #85。

下一步先做专项评审，再决定是否授权第三轮：

1. **缓存与内存。** 中型冷读 RSS 比预算高约 161.60 MiB，大型热读 p50 高约 56.90 ms。CPU／堆采样仍指向 JSON 解析、缓存序列化、字典遍历和 GC；在保持 ID 压缩、未知字段及磁盘 schema 的前提下，评估更紧凑的内存计数表示与序列化方案。不要通过跳过持久化、重扫或校验获得成绩。
2. **启动与 hook。** hook p50 仍高约 16.89 ms。启动对照显示暖模式空 Node p50 30.90 ms、空 Python 16.91 ms；这只是控制数据，不是性能豁免。评审剩余模块图和加载成本是否能在既定运行时内消除。
3. **Agent／Unicode 与 Git。** 32 Agent p50 仅剩约 0.34 ms 差距，Unicode／grapheme 布局仍是渲染采样热点；Git 未命中和过期路径仍包含进程启动、解析、原子写与 fsync。评估后续工作时继续保持 Unicode、锁、500 ms TTL、采集次数和持久性语义。

[诊断摘要](diagnostics.optimization.json)保留七类负载的 CPU、堆采样、GC、峰值 RSS、输出与采集次数及原文件摘要。堆采样是采样到的存活分配，不是精确累计分配量；包含 profiler 开销和准备过程，不能用于验收。原始 profile、日志、构建产物和 38,400 个两轮样本保留在忽略目录 `dist/validation/typescript-migration/ts-03/perf-opt-*`。

预算变更、架构调整、更换运行时、第三轮实施另行评审。本任务不执行 TS-04、安装切换或发布；[既有 TS-04 交接](TS04-HANDOFF.zh-CN.md)继续等待 TS-03 全部门槛。
