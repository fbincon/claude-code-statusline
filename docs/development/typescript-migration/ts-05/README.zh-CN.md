# TS-05 工具链、CI 与工程候选

[English](README.md) | **简体中文**

状态：**IN_PROGRESS**，2026-10-16（Asia/Shanghai）。执行者：Codex。
分支：`fbincon/ts-05-candidate`。[迁移总计划](../../typescript-migration.zh-CN.md)
维护阶段状态。已批准交付通用离线工程候选包、验证后的 CI 制品和仓库内隔离的 Python 归档。
公开标签、预览/正式发布及剩余实机/桌面验收属于 TS-06。保留已安装的 Python 产品。

## 实施批次

| 批次 | 交付内容 | 状态 |
| --- | --- | --- |
| 05-A | 现存 Windows ARM 失败与完整责任台账 | DONE；[PR #92](https://github.com/fbincon/claude-code-statusline/pull/92) |
| 05-B | 维护工具与无 Python 测试替代 | VALIDATING；[PR #93](https://github.com/fbincon/claude-code-statusline/pull/93) |
| 05-C | 可复现的通用离线候选包 | VALIDATING；两次本地构建一致 |
| 05-D | CI 切换与 Python 归档 | VALIDATING；独立历史验证通过 |
| 05-E | 候选验收、文档与阶段收尾 | IN_PROGRESS；最终目标 CI 待验 |

## 责任基线

[快照](../../../../tools/migration/ts-05/snapshot.json)固定 TS-05 开始前的提交
`748cc79840cd08280da4ab7ab8ef3dea7dee9873`：856 个 Python 测试方法、62 个工具/构建入口，
以及全部 318 个 Python 源文件哈希。这里是静态清点数量，不是运行测试的结果。
冻结的 v2.0.0 参考与 161 个案例保持不变。

[台账](../../../../tools/migration/ts-05/coverage.json)承接 TS-03/04 的 715 项已移植测试和
13 项有依据的退役项；初始仍有 128 项测试及 62 项工具待处理。每项需要替代验证证据，
或明确的历史保留/退役说明，归档本身不代表兼容完成。
`npm run migration:inventory:ts05 -- --complete` 拒绝仍有待处理项的台账。

## Windows ARM 入口失败

TS-05 开始前 main 的[运行记录](https://github.com/fbincon/claude-code-statusline/actions/runs/38765422139/job/116527230758)
有九项安装测试通过，PowerShell 案例约 21 秒后返回空退出状态。原报告没有保存进程错误
和信号，不能仅凭该断言确定根因。验收器现显式关闭 stdin、以非交互方式运行 PowerShell，
并保存可执行文件、操作、耗时、超时限制、退出状态、信号、错误码和 stderr。
原有 20 秒限制及 stdout 精确比较保留。首轮诊断确认是 `ETIMEDOUT`/`SIGTERM`，
不是渲染器主动退出。现先创建隔离 HOME，在 PowerShell 管道之前读取输入，并记录四个检查点。
[Windows ARM 重验](https://github.com/fbincon/claude-code-statusline/actions/runs/38780352740/job/116578626507)
在 `665f273` 全部十项安装测试通过：首次 PowerShell 渲染 14788 ms，子 Agent 渲染
1387 ms，两次检查点均完整。这只是一次初步通过，尚不能证明启动问题已稳定解决。
四组 PR 工作流通过，重复 push 工作流被取消、不计为通过。
PR #92 合并为 `bc424e3ec8e4734b7c29bbf734b9328ecfc42ba3`。

[05-B ARM 复验](https://github.com/fbincon/claude-code-statusline/actions/runs/38785440463/job/116596113070)
随后在首个脚本检查点前超时。伪造用户目录中的空命令也超时，系统用户目录启动和直接 Node
诊断则通过。现让 PowerShell 以 `-NoProfile` 和有效系统用户目录启动，再在脚本内恢复临时
产品路径，保留原超时限制。最终跨平台确认仍待完成。

## 完成条件

日常构建、测试、生成、文档和候选流程不依赖 Python。保留原生并发、失败恢复和终端测试；
固定参考结果携带来源、运行时和验收器哈希。固定提交的两次干净构建必须生成相同候选字节。
八目标安装和十三个固定主机组合使用同一制品。保留可用的精确构建声明检查及 2.1.296 的声明限制。

显示 schema 8、UI 协议 11、运行时协议 2/v1 兼容和任务 schema 4 不变。
D06 的历史 FAIL 保留，PERF-01 在 TS-06 后进行。普通验收不调用付费模型。
原始证据保存在忽略目录 `dist/validation/typescript-migration/ts-05/`。

## 05-A 本地验证

Node 24.21.0/npm 11.19.0：864 项 TS 测试，861 项通过、三项仅 Windows 运行而跳过；
独立安装的十项测试全部通过。50 项生成资源、1714 个文档链接及双语配对通过。目标 CI 结果见上文。

## 05-B 实施证据

普通测试以十二个带哈希锁的 Python 3.14.4 预期文件验证数值、Unicode、JSON、CLI 和状态兼容，
保留参考提交及采集提交。真实 Node 子进程继续验证锁、写入进程终止、原子替换和终端恢复。
Python 混合比较保留独立历史责任，05-D 将完成归档执行入口。

Node 维护工具现覆盖文档链接、发布 Markdown/Gitee 说明、精确主机 Mod 类型准备、终端图像重建、
人工终端/电源证据、描述性基准和显式预算验收。`tools/acceptance/package.json` 将可选 SDK
固定到 2.1.296 主机；普通依赖安装和产品包不包含它。新调用须显式指定 `--run-real-calls`、
新证据目录和已有的共享 10 美元账本。费用未知时保留全部额度并阻止下一次调用。

本地证据：预加载拒绝 Python/编译器子进程时，918 项测试中 915 项通过、三项仅 Windows 跳过；
十三个小型基准案例完成功能检查，没有运行 D06 测量。既有单任务/并行任务和单 Agent/并行
指标记录的副本经 Node 重验通过，指标分别包含 5/7 个请求和 1/2 个 Agent。
没有新增付费调用，也不据此宣称实机验收通过。该批检查点时，候选打包、剩余台账映射及 CI/归档切换仍待完成。

## 05-C/05-D 本地验证

[候选指南](candidate.zh-CN.md)是当前开发、构建和安装入口。台账已闭环：测试 **808 项移植、
19 项退役、29 项历史保留**，工具 **45 项替代、17 项历史保留**，每个原责任项均保留。
历史项由独立参考入口执行验证，不能只凭移动文件认定兼容完成。

源码 `38ff85b75c936201764c64f80b8fff96f091e176` 的两次干净构建得到相同的
3317861 字节通用包，SHA-256 为
`f72e8a04e17e22c3a0a4dddbc9468cdb441b0bf741d335fa34c96a93aab17a7f`。
十项源码之外的安装测试通过，使用空 npm 缓存、离线模式、禁用生命周期脚本和仅含 Node
的 PATH。本地官方主机 2.1.294 的两个 Mod、精确声明和安装绑定通过；2.1.296 的两个 Mod
及绑定通过，声明缺失明确记录为不可用。

归档切换后的本地 `check` 完成 **932 项测试，929 项通过、三项 Windows 跳过**，
33 项有效生成资源及 1729 个文档链接通过；随后新增的 PowerShell 启动回归也在本地通过。
归档核验覆盖 318 个 Python 源文件和 361 个映射文件。独立重建完成 856 项 Python 测试
（九项平台跳过）、161 个冻结案例、十二个精确预期重采、真实混合版本锁和 Python 兼容回退。
没有新增付费会话或完整 D06 测量。最终 CI 及 main/Gitee 同步完成前，不标记 TS-05 DONE。
