# PERF-01 — 迁移后的性能专项

[English](perf-01.md) | **简体中文**

状态：**DONE**。关闭日期：**2026-10-19**；建立日期：**2026-10-15**；启动日期：**2026-10-19**（Asia/Shanghai）。
本专项独立于 [TypeScript 迁移计划](../typescript-migration.zh-CN.md)，不新增第七个迁移阶段。
维护者已于 2026-10-19 确认实施以下有界计划。

## 维护者修订，2026-10-19

功能正确是硬门槛，性能优化仅为尝试：本轮不设最低收益，不要求优于 Python。
原 D06 策略、参考实现、测试器和失败结果保留；本轮结项不代表 D06 通过。
新的已安装 TypeScript 对照具有独立身份，不替换历史测量或其方法。

最多两轮实现，依次关注启动／常用命令和测量确认的用量索引／资源热点。
可靠退化，或收益不明确且不值得增加维护成本的改动撤回。有可保留的运行时改进时，
经 PR／CI、npm OIDC、GitHub 和 Gitee 交付稳定版 v3.1.4。维护者仅为 v3.1.4
接受原有六项缺口，不豁免新增功能或自动化失败。没有运行时改动时，仅合并必要的
基准工具和报告、同步 Gitee，不发布空补丁版本。不包括付费调用或个人安装切换。

## 启动条件与归属

TS-06 已 DONE。执行者：Codex；分支：`fbincon/perf-01`；起始 main：
`732a95bb31acab4fa62b7cccc191b4348e5b25c2`。基线：已发布 v3.1.3，源码
`05c5328d5d13488f3366ae6fdd30af4a55b3b22c`，安装包 SHA-256
`fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0`。
起始 main 相比该版本仅有文档变化。迁移总计划继续作为 TS-01～TS-06 状态的唯一来源；
本文负责 PERF-01。

[v3.1.3 交付记录](../post-migration-fixes.zh-CN.md)保留源码、产物及已知限制。
性能测量使用这些已发布字节的隔离解包，不使用个人 Claude 配置。

## 保留的证据与目标

[D06 修订](../typescript-migration/ts-02/D06.zh-CN.md#applicability-amendment-2026-10-15)
已将性能测量和预算达标移出迁移／发布门槛。其数值预算、负载规模、样本数、交替轮次、
字节码模式及有界噪声复测规则对历史 D06 比较保持不变。
上述修订单独授权本轮安装包 TS→TS 测量，不设数值性能门槛。

| 证据 | 测量提交 | 通过／失败／不确定 |
| --- | --- | --- |
| [原 03-F](../typescript-migration/ts-03/performance.03-f.json) | `1fddaa6ea1fef7f631e51641f15214cbddd7ec08` | 91／69／32 |
| [优化第一轮](../typescript-migration/ts-03/performance.optimization-01.json) | `821915520b47e0f7a9dfa99c764c1d379a23a4da` | 97／64／31 |
| [优化第二轮](../typescript-migration/ts-03/performance.optimization-02.json) | `93384f573ddb02b4067947493b6d89a64b276341` | 104／60／28 |

最新测量仍为 **FAIL**。保留[全部 192 项对比](../typescript-migration/ts-03/performance.optimization-comparison.json)、
[诊断摘要](../typescript-migration/ts-03/diagnostics.optimization.json)及
[两轮优化评审](../typescript-migration/ts-03/PERFORMANCE-OPTIMIZATION.zh-CN.md)。
已完成的两轮属于历史工作，不代表新增实施授权。

在隔离对照环境中保留 Python 参考 `9b6d2fab4bf165be280d428a874521bfbf02c7e1`、冻结夹具及原始
测试器／来源记录。迁移完成后，正常运行、构建、测试和发布流程不再依赖 Python；历史对照
位于这些流程之外。工具退役时不能删除证据或静默替换参考实现。

## 当前实施与验证

1. 在 `tools/benchmarks` 增加安装包模式，保留历史入口和原始结果。命令计时直接运行
   安装包 bin，采集次数另行诊断。样本间恢复包含身份页在内的完整缓存；每次测量使用
   新进程，预热在其他进程完成。Linux GNU time 提供真实子进程峰值 RSS。
   冷缓存指产品缓存为空，不清理操作系统页缓存。
2. 复用 32 项负载，增加四项中／大型重放及单字段递增场景。同时记录输出、采集次数、
   I/O 和 P50／P95／RSS。探索采样用于定位热点；有保留候选时，使用同一固定测试器、
   相同夹具路径、关闭编译缓存，每场景 50 样本、三轮交替比较基线与候选。
3. 最多两轮实现，保留公开 CLI、格式、精确计数、原子发布、锁、时钟及资源有界契约。
   完成适用功能、安装和 Node 22／24 验证；纯 Markdown 收尾只执行必要文档／空白校验。

结项要求是完成有界尝试、适用正确性验证及真实证据／交付，不要求提速。
无变化、退化及不确定测量继续保留；诊断不能建立 D06 性能通过结论。

## 基准命令

使用固定开发 Node／npm。`--artifact` 选择 Linux 安装包测量；省略时保留旧工作区诊断，
不能称为已安装产品耗时。安装包模式在解包前和测量后核对每个包内文件。
`--validate` 允许在未提交的测试器上探索，并在结果中明确标记。

```bash
npm run benchmark -- --artifact BASELINE.tgz --output NEW_DIRECTORY --profiles small,medium,large --samples 2 --validate
npm run benchmark:compare -- --baseline-artifact BASELINE.tgz --candidate-artifact CANDIDATE.tgz --output NEW_DIRECTORY --profiles small,medium,large --samples 50
```

安装包比较逐个场景连续运行基线／候选，在三轮的中间一轮反转顺序。完整进程耗时包含
GNU time 外部监督程序；进程内延迟仅计 action。RSS 包含该新进程模块初始化，但不包含
其他进程的缓存预热。计数插桩不进入测量样本。补丁版本间仅归一化响应的
`result.backend_version`；hook 校验已发布记录数量、状态和 prompt ID。
原始数据保存在忽略目录 `dist/validation/perf-01`。

## 边界与证据

现有超时、资源有界、锁、原子写、时钟精度和采集次数契约仍为必须满足项。
宿主超时、事件丢失、保存失败、内存耗尽属于功能失败。保留历史结果，在中英文本文
记录源码／产物／测试器／夹具身份、检查、PR 和下一步，提交可独立阅读的摘要，不提交原始日志。

下一步：本次有界任务已关闭，保留测量结果，后续优化另定范围。


## 保留的实现

[PR #111](https://github.com/fbincon/claude-code-statusline/pull/111)仅保留两轮运行实现：

1. [启动轮](https://github.com/fbincon/claude-code-statusline/commit/611ad6a9840ded4dc516a4b8ab54f844143476a7)：只读运行偏好和 schema 校验避开显示／编辑器依赖。只有裸 `runtime` 使用快速分发；异常 CLI 失败才延迟加载本地化。输入上限、协议错误、配置目录解析及符号链接行为均有回归覆盖。
2. [索引轮](https://github.com/fbincon/claude-code-statusline/commit/a84f50092865156ec26bb0a39531aa7e221b9f48)：在既有用量缓存锁内暂存最新序列化不可变页，上限 32 MiB，每次采集统一发布；溢出时仍持久化写页。先页、后 manifest，再原子提交主状态，成功后才清理旧文件。磁盘格式、锁、整数计数和精确消息身份不变。测试覆盖立即／缓冲发布最终格式逐字节一致、溢出、重启、重放、增量、读取错误，以及页／manifest 失败重试且不推进已提交游标。

启动结果仅适用于**不带 CLI 参数**的 `runtime`。已安装 Mod 显式传入 `--config-dir`，继续使用既有管理命令路由，因此本次不能证明 Mod 端到端启动提速。索引合并适用于正常用量采集。未尝试第三轮实现。

## 正式安装包比较，2026-10-19

同一测试器测量 36 个负载 × 50 样本 × 两个包 × 三轮交替运行，共 **10,800 次计时操作**。每次计时输出均匹配独立诊断；各场景基线／候选的输出及用量／transcript／Git 采集次数一致。安装清单和测试器哈希最终检查通过；夹具 transcript 哈希、Git HEAD、受跟踪文件数及预期脏状态在测后保持不变。准备、预热、插桩和完整缓存恢复不进入 action 计时，也不与另一侧计时操作并行。正式测量期间本机没有并行运行构建或测试。

| 身份 | 提交 | npm 归档 SHA-256 |
| --- | --- | --- |
| 已发布基线 v3.1.3 | `05c5328d5d13488f3366ae6fdd30af4a55b3b22c` | `fe0617ee8c82015cc179dc202c41e6c72403ca5688fba4ada105f5437e812ea0` |
| 实测候选 v3.1.4 | `307d1a8baf076edd0eac7eb979f90e67de3ea68f` | `907dfd2d0de0edf509e5e983c00fcd9652234c195ad3fba2f3eea70ecea68ef2` |
| 发布 v3.1.4 | `e05149829492a8f24bcadaa335f973c9c396483a` | `ff3ba18f309b42b6bc54dce992e7530d17985ab79964c3b35cb8c49a22f673cd` |

测试器提交：`307d1a8baf076edd0eac7eb979f90e67de3ea68f`。合并源码树相同，实测包与发布包的全部 678 个产品文件逐字节一致，仅 `candidate.json` 来源元数据不同。构建工具链为 Node 24.21.0、npm 11.19.0、TypeScript 5.9.3。测量主机为 Linux x64、内核 `7.0.0-38-generic`、Intel Core i5-13500H；Node 可执行文件 SHA-256 为 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`。

未修改的[夹具生成器](../../../tools/migration/ts-03/performance/fixtures.ts)为每个 agent 提供 100 行。按键排序、紧凑 JSON 的完整夹具清单 SHA-256 为 `a483f236d0b3f2eaea781cdc039d4db6c75c6b36852210239a8e26401e73bac8`，包含所有 agent transcript 哈希。保留的原始比较报告 SHA-256 为 `65c543ac6ca5c08a8aacca0be69bd63456f8009895925ad2157df9e941b01307`。

| 规模 | 主记录行／agent／Git 文件 | Git 夹具提交 | 主 transcript SHA-256 |
| --- | ---: | --- | --- |
| small | 100 / 0 / 32 | `ebc1f898a08c64342730af0118276639366709c5` | `50b7fd01d1bf90b25f872c946a7352efa61d54cd673c4e01f32ceebeb71b7b71` |
| medium | 10000 / 8 / 1000 | `cfcfd309fe63517f25a2ea711fdfb455f2f9d342` | `15c134b9c5fbc08ab95ddfe90952537b4bbab6b6e0180fa386fd5d9fae234893` |
| large | 100000 / 32 / 10000 | `714581ea8b719dc4aef0e6de55b753ecd854e6aa` | `183a70d72228a56437d148a875f4b57b12d36f3671b81959bf9ea4faf7d243ab` |

每个单元格是**三轮指标的中位数**，不合并样本计算分位数：每轮分别提供 50 样本的 P50、P95 或新进程最大 RSS。这是单机描述性结果，不是跨平台性能保证，也不是 D06 比较。

| 负载 | P50 ms，优化前 → 后 | P95 ms，优化前 → 后 | 峰值 RSS MiB，优化前 → 后 |
| --- | ---: | ---: | ---: |
| `command/render-model` | 69.562 → 69.157 | 78.583 → 78.187 | 61.492 → 61.418 |
| `command/small/render-composite` | 91.493 → 91.681 | 100.781 → 97.541 | 67.340 → 67.434 |
| `command/small/render-subagents` | 69.656 → 68.694 | 78.267 → 76.353 | 61.582 → 61.715 |
| `command/medium/render-composite` | 96.226 → 96.724 | 102.574 → 104.464 | 68.566 → 68.688 |
| `command/medium/render-subagents` | 75.681 → 77.048 | 85.256 → 84.167 | 64.004 → 64.016 |
| `command/large/render-composite` | 95.681 → 95.467 | 106.973 → 105.561 | 69.164 → 69.332 |
| `command/large/render-subagents` | 80.834 → 80.511 | 88.478 → 88.250 | 64.453 → 64.176 |
| `command/hook` | 71.388 → 71.368 | 79.169 → 78.610 | 64.289 → 64.207 |
| `command/ui-preview` | 99.239 → 101.395 | 109.900 → 108.273 | 71.617 → 71.562 |
| `command/runtime-observe` | 105.534 → 87.381 | 117.138 → 91.622 | 72.734 → 65.957 |
| `in-process/small/transcript/cold` | 19.041 → 18.916 | 21.289 → 21.713 | 66.102 → 66.234 |
| `in-process/small/transcript/warm` | 7.490 → 7.503 | 7.764 → 7.985 | 65.320 → 65.199 |
| `in-process/small/transcript/append` | 19.414 → 19.860 | 21.361 → 21.000 | 66.238 → 66.219 |
| `in-process/small/git/miss` | 15.901 → 14.589 | 20.478 → 21.002 | 64.336 → 64.562 |
| `in-process/small/git/hit` | 6.129 → 6.114 | 6.316 → 6.331 | 64.141 → 64.277 |
| `in-process/small/git/expired` | 14.903 → 14.828 | 16.732 → 16.608 | 64.422 → 64.441 |
| `in-process/small/agents` | 0.130 → 0.130 | 0.138 → 0.141 | 63.672 → 63.469 |
| `in-process/medium/transcript/cold` | 961.207 → 638.229 | 1013.981 → 653.763 | 132.957 → 136.406 |
| `in-process/medium/transcript/warm` | 13.168 → 13.144 | 14.190 → 14.148 | 66.555 → 66.508 |
| `in-process/medium/transcript/append` | 34.587 → 35.008 | 39.429 → 39.933 | 70.676 → 70.711 |
| `in-process/medium/git/miss` | 20.409 → 21.112 | 30.356 → 30.907 | 64.574 → 64.473 |
| `in-process/medium/git/hit` | 6.145 → 6.143 | 6.399 → 6.309 | 64.355 → 64.367 |
| `in-process/medium/git/expired` | 22.203 → 18.545 | 26.579 → 27.631 | 64.527 → 64.539 |
| `in-process/medium/agents` | 6.991 → 6.989 | 7.873 → 8.711 | 65.750 → 66.090 |
| `in-process/large/transcript/cold` | 12942.434 → 6794.214 | 16736.656 → 6908.401 | 521.938 → 548.070 |
| `in-process/large/transcript/warm` | 14.774 → 14.774 | 16.157 → 16.622 | 66.801 → 66.781 |
| `in-process/large/transcript/append` | 36.647 → 37.167 | 39.247 → 41.239 | 71.273 → 71.203 |
| `in-process/large/git/miss` | 44.800 → 48.883 | 61.031 → 60.917 | 64.520 → 64.516 |
| `in-process/large/git/hit` | 6.118 → 6.143 | 6.273 → 6.338 | 64.270 → 64.336 |
| `in-process/large/git/expired` | 47.553 → 45.194 | 61.240 → 61.562 | 64.570 → 64.445 |
| `in-process/large/agents` | 11.075 → 11.111 | 13.635 → 13.570 | 69.598 → 69.504 |
| `in-process/unicode-composition` | 2.445 → 2.442 | 2.516 → 2.551 | 63.574 → 63.805 |
| `in-process/medium/transcript/replay` | 29.438 → 29.820 | 31.122 → 32.575 | 70.809 → 70.629 |
| `in-process/medium/transcript/increment` | 34.448 → 35.185 | 42.011 → 37.604 | 70.582 → 70.859 |
| `in-process/large/transcript/replay` | 34.421 → 34.382 | 38.722 → 37.858 | 71.051 → 71.102 |
| `in-process/large/transcript/increment` | 35.915 → 36.551 | 38.925 → 39.287 | 71.004 → 71.156 |

### 收益与代价复核

中／大型冷缓存采集 P50 分别下降 33.6%／47.5%。插桩索引文件写入从 **153 → 17**、**2,930 → 257**，transcript 读取仍分别为 **19**、**67** 次，用量采集仍为一次，保留持久化与精确统计。裸 runtime P50 下降 17.2%，约 18.2 ms，适用范围见上文。常见渲染、hook 和编辑器预览命令没有明显一致收益。

保留有界索引暂存存在可测代价。大型冷缓存峰值 RSS 从 **521.938 → 548.070 MiB**，增加 26.133 MiB／5.0%；32 MiB 约束序列化暂存，不是总 RSS 上限。大型追加 P50／P95 从 **36.647 → 37.167 ms／39.247 → 41.239 ms**（+1.4%／+5.1%）；中型重放 P50 从 **29.438 → 29.820 ms**（+1.3%）；中型字段增量 P50 从 **34.448 → 35.185 ms**（+2.1%），RSS 从 **70.582 → 70.859 MiB**（+0.4%）。按测试器的描述性标记，这六项指标在每轮配对中的增幅均超过基线三轮的完整极差；它们是保留的代价，不作为噪声忽略，也不宣称通过性能预算。按已批准的正确性优先尝试，冷缓存采集收益足以支持此有界取舍。上表保留其他变慢、不变和波动结果，例如大型 Git miss 汇总 P50 更高，但未满足上述一致性标记。

没有接受功能失败、放宽超时、跳过采集或降低持久化要求。不宣称所有场景降内存／延迟、优于 Python 或历史 D06 通过。

<a id="delivery-v314"></a>

## Delivery v3.1.4

PERF-01 按维护者 2026-10-19 批准的有界尝试标记 **DONE**，正式 v3.1.4 已交付三个渠道。这关闭的是已批准的尝试与交付，不改变历史 D06 **FAIL：104 通过／60 失败／28 不确定**。

发布源码：`e05149829492a8f24bcadaa335f973c9c396483a`；附注标签对象：`c473f4bb0f06ad1b598c0503e095cffc30d59592`。实现 [PR #111](https://github.com/fbincon/claude-code-statusline/pull/111) 最终 head 为 `307d1a8baf076edd0eac7eb979f90e67de3ea68f`；文档后续分支为 `fbincon/perf-01-evidence`。

| 源码绑定 CI | 结果 |
| --- | --- |
| [PR 最终 head](https://github.com/fbincon/claude-code-statusline/actions/runs/39211727341) | 56 项必需作业通过 |
| [合并／main](https://github.com/fbincon/claude-code-statusline/actions/runs/39213551892) | 56 项必需作业通过 |
| [附注标签，最终第 2 次尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/attempts/2) | 56 项必需作业通过，条件性纯文档作业跳过 |

每组完整矩阵提供 **8 个安装目标、32 个 Node 运行用例、13 个固定宿主**。同一标签安装包与全部 53 份凭据通过 stable readiness。本地开发阶段 `npm run check` 为 1,019 项中 1,015 通过、4 项原生平台跳过；随后可移植路径断言修正的 6 项定向测试通过，以上最终源码 CI 已包含该修正。资源、归档／台账和文档检查通过。

[标签首轮 Windows 作业](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/job/117954676878)因既有 hard-kill 恢复子进程超过 15 秒上限而失败。相同未修改测试在 main CI 约 0.996 秒通过；[定向重跑](https://github.com/fbincon/claude-code-statusline/actions/runs/39220269377/job/117961101153)保留同一源码、原上限和完整断言，以 1.754 秒通过，依赖聚合门槛随后通过。原始失败日志及凭据分别保留，没有增加超时或功能失败豁免。

两次干净独立构建、两次从交付源码包重建的以下四个文件逐字节一致。main／tag CI 包、GitHub 草稿下载、OIDC dry-run bundle 和实际发布 bundle 均匹配。草稿包全部 679 个文件通过验证，十项隔离离线安装检查通过。六语言扩展安装包 PTY 验收完成 **336 张单元格重建及 4 项单色检查**，终端恢复，模型调用为零。代理检查了代表性捕获；它们是重建单元格，不是 OS 截图，也不作为新的真人／字体／平台验收。

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.1.4.tgz` | `ff3ba18f309b42b6bc54dce992e7530d17985ab79964c3b35cb8c49a22f673cd` |
| `claude-code-statusline-3.1.4-source.tar.gz` | `2016debb13c285488b11acf4577844b093af379c65f5b2daeb2fbcf9ca12926c` |
| `build-manifest.json` | `fea0264c543f25b8acf5df75e31f6279807a4173b655ed81e5e531f42d61af1c` |
| `SHA256SUMS` | `d92380462727c2728730c529836bc6869d0726c26a065f8b4de00012ee99fbbf` |

| 公开渠道 | 验证结果 |
| --- | --- |
| [npm v3.1.4](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.4) | [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39223388162)与[新版本实际发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39223742547)通过；公开 SHA-256／SHA-512 字节匹配，`latest=3.1.4`、`beta=3.0.0-beta.1` |
| [GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.4) | Release 417047094，发布于 `2026-10-19T08:39:27Z`，非草稿／非预览，四个公开附件匹配 |
| [公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/39224323474) | Linux／Windows／macOS × Node 22／24 的六项作业及十二次固定版本／latest 安装通过，实际运行时为 22.23.3、24.22.0；本机 Node 24.21.0 固定版本／latest 安装也通过 |
| [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.4) | Release 1218541，同一源码与附注标签非强制同步；四个匿名 HTTPS 下载匹配上表，十项离线安装检查通过。说明使用实际附件 URL，保留 GitHub 原始发布时间 |

[v3.1.4 专属批准](../../releases/approvals/v3.1.4.json)仅保留原六项未验证缺口：macOS 实体休眠、macOS 14 Intel 桌面电源、Windows 10 桌面、WSL 桌面弹窗、其余目标电源／真人视觉检查、Claude 2.1.296 精确声明；本次没有将其改为通过。未调用付费模型，也未切换个人现用安装。纯 Markdown 收尾只做必要文档／空白检查及纯文档 CI，不再运行发布矩阵。
