# PERF-01 — 迁移后的性能专项

[English](perf-01.md) | **简体中文**

状态：**IN_PROGRESS**。建立日期：**2026-10-15**；启动日期：**2026-10-19**（Asia/Shanghai）。
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

下一步：完成探索基线，选择低风险实现，并在本文保留实际验证及交付证据。
