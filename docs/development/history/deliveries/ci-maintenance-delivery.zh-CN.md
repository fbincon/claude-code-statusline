# CI 优化与 Actions 固定的交付记录

[English](ci-maintenance-delivery.md) | **简体中文** · [现行指南](../../ci-maintenance.zh-CN.md)

本页保留 Issue #157 的分阶段实测，以及产品基线 v3.6.0 上 CI-01 的初始清单与验证。各结果对应记录中的源码和运行。

<a id="ci-rollout"></a>

## Issue #157 优化交付

### Issue #157 的实测交付记录

下列完整运行均保留 8/32/16 覆盖及适用的 197 项 Native 检查。总耗时包含排队与重跑间隔；累计任务分钟统计实际执行，包含失败执行，但排除 GitHub 在后续 attempt 中复制、执行时间戳不变的成功任务。最长排队和最长执行是分别统计的单任务最大值，可能来自不同任务，不能据此直接从总耗时中相减。

| 完整运行 | 总耗时 | 最长任务排队 | 最长任务执行 | 累计任务分钟 | macOS 分钟 | 重跑次数 |
| --- | --- | --- | --- | ---: | ---: | ---: |
| [基线 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40336709149) | 56m40s | 38m14s | 32m31s | 598.35 | 221.43 | 0 |
| [基线 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40346292097) | 67m23s | 39m46s | 34m28s | 626.33 | 235.07 | 1 |
| [基线 tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40357902282) | 73m28s | 45m17s | 33m59s | 636.23 | 236.50 | 1 |
| [第二阶段最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40402431203) | 41m53s | 34m28s | 21m17s | 459.37 | 161.97 | 0 |
| [第二阶段 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40408875074) | 66m53s | 57m58s | 20m27s | 473.70 | 174.80 | 0 |
| [阶段 A 最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40409378646) | 70m55s | 62m45s | 19m47s | 462.07 | 170.42 | 0 |

第二阶段最终 PR 相比基线 PR，总耗时减少 26.1%，累计任务分钟减少 23.2%，macOS 分钟减少 26.9%。随后两轮交付验收同时运行、共享托管 runner 配额，更长排队掩盖了执行工作量的降低。这些是具名实测结果，不是延迟保证或受控基准。该历史交付当时对启用策略变化执行完整 PR/main 矩阵。当前路由表已取代这种自动联动；现在等价集成即使改变策略也复用原验收。新 tag 触发与真实 npm/OIDC provenance 留待下一次正式发布记录；本次维护不创建版本或测试 tag。

稳定性证据包括 [Windows x64/ARM 宿主安装诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40392875032)：两轮诊断中的同机监督进程启动中位数降低 68–76%，该比例仅描述启动耗时。[macOS Intel/ARM 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40395043483) 各通过 1,000 次身份比较和 20 次相关事务流程。第二阶段最终 PR 中，Windows Claude 2.1.289、2.1.294 各通过十次原长场景重复；最大耗时为 4.079 秒／2.434 秒，距未改变的 20 秒超时最少仍有 15.921 秒／17.566 秒余量。

失败历史继续保留。[第二阶段较早的完整运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40397874104) 在双 worker 调度下出现四个 Windows Git 测试时序失败后取消。将这些资源敏感测试放回串行组，保留全部断言和超时；[四种相关 Windows/Node 组合](https://github.com/fbincon/claude-code-statusline/actions/runs/40401253349) 随后通过完整运行时套件和十次 Git 套件直接重复，再通过最终完整验收。[真实草稿运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40401259200) 的快检成功、必需汇总检查失败；ready/converted/synchronize 转换和取消也已实际执行。取消或诊断运行不计为完整验收；issue #96 既有六项缺口仍未验证。

随后，[阶段 A main 的 macOS 26 / Node 22.x 任务](https://github.com/fbincon/claude-code-statusline/actions/runs/40418420063/job/121907456214) 暴露了历史版本命令提前关闭 stdin 时未处理的 `EPIPE`。验收 worker 现在先注册管道错误处理再写入：成功仍由退出码与命令输出断言决定，其他流错误会失败并终止命令。真实子进程回归覆盖提前关闭后的成功／失败退出码、Unicode 输入完整性和其他流错误，并在每个运行时源码套件中串行执行。[当时运行中的阶段 B PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40418703438) 因这次修复取消，不计入上表的成功运行。

[下一轮阶段 B 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40421822049) 暴露了该新增夹具的 Windows 特有问题：关闭文件描述符 0 并未关闭所有继承的 stdin 句柄，导致夹具握手超时。夹具现改为在有界写入等待期间让真实子进程退出，仍要求观察到管道关闭错误（`EPIPE`，或 Windows 的 `EOF`）、保留原退出码，且不改变超时。[Windows 定向诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40424220219) 确认了 Windows 的 `EOF` 形式；其他输入错误仍会失败。这些失败／取消运行与成功验收分别保留。

<a id="ci-01"></a>

## CI-01 实现

**状态：DONE。** 实施基线：`95206119dab6f931f320277d25889fea8da49528`（2026-10-23）。产品基线保持 v3.6.0；本次维护不创建版本、标签、npm 发布或 Release。

CI-01 固定现有 Actions 主版本，增加离线身份检查，并启用每周 Actions 更新提议。保留现有工作流触发条件、权限、Node／构建版本、平台与宿主矩阵、OIDC 和发布条件。[路线图](../../roadmap.zh-CN.md#milestones) · [范围与验收](../work-package-designs.zh-CN.md#ci-01)。

## 初始引用清单与来源

四个工作流共有 39 处外部引用：CI 24 处、npm 发布 7 处、公开下载 4 处、历史 Python 参照 4 处。下列精确版本标签已于 2026-10-23 通过官方仓库的 Git 引用 API 解析，均直接指向提交；规划阶段也核对了对应主版本标签。每个 `uses:` 保留精确的 `# vX.Y.Z` 注释。

| 官方 Action 与版本标签 | 完整提交 SHA | 引用数 |
| --- | --- | --- |
| [checkout v4.4.0](https://github.com/actions/checkout/tree/v4.4.0) | `11d5960a326750d5838078e36cf38b85af677262` | 10 |
| [setup-node v4.4.0](https://github.com/actions/setup-node/tree/v4.4.0) | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 13 |
| [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/tree/v4.6.2) | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 9 |
| [download-artifact v4.3.0](https://github.com/actions/download-artifact/tree/v4.3.0) | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | 6 |
| [setup-python v5.6.0](https://github.com/actions/setup-python/tree/v5.6.0) | `a26af69be951a213d495a4c3e4e4022e16d87065` | 1 |

此表保留为首次交付证据，后续更新 PR 单独提供已审查的版本／SHA 来源。固定范围包括工作流直接引用和可达的本地组合 Action；远程 Action 内部依赖仍由上游实现管理。参见 [GitHub 安全使用指引](https://docs.github.com/en/actions/reference/security/secure-use)。

## 验证与完成证据

本地验证通过：`actions:check` 检查四个文件、39 处引用且零错误；检查器及分流专项 17 项通过；`npm run check` 的 1,136 项测试中 1,131 项通过、5 项平台相关跳过，生成资源、文档、归档及完整责任清单通过。四个工作流与实施基线的 YAML 结构对比确认，除引用替换及 scope 校验接入外，其余结构一致；`git diff --check` 通过。

[首次 PR 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39941449719)发现 macOS 14／15 临时目录的 `/var` → `/private/var` 别名会使检查器误判仓库边界。已先解析检出根目录的真实路径，并增加目录别名回归测试；旧运行已取消，修正后的最终 head 随后通过了完整矩阵。

实现 [PR #126](https://github.com/fbincon/claude-code-statusline/pull/126) 已合并。最终审查 head 为 `7888e4af798ec795b90f4b374633e6fa4fb67335`，合并后的实现 main 为 `8a6a081426f463157df308f6ef1d15a15b5901aa`。

最终 head 的首轮执行中，Windows／Claude 2.1.289 的既有原生 Mod 测试报告 128 项通过、1 项失败，具体失败用例不在保留的输出尾部中。整轮结束后，仅重试该任务及依赖它的汇总门禁，提交和断言均未改变；第二次执行的最终结果为 56 项成功、1 项按预期跳过的纯文档任务。失败历史保留在同一运行中，未以 #96 豁免。

main 首轮的 Windows 11 ARM/x64、Node 22.x 出现命令夹具的 15 秒超时；Node 24.0.0 与 24.x 则在调用候选包前，系统 PowerShell 就绪检查触及 60 秒超时（`candidate_invoked=false`）。源码、超时及断言均未修改；第二次执行中，这三个用例及汇总验收全部通过。最终 main 同样为 56 项成功、1 项按预期跳过的纯文档任务。

| 验证 | 结果与证据 |
| --- | --- |
| 最终 PR | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39942651085)：八安装目标、32 项 Node 用例、十三宿主和汇总验收 |
| 实现 main | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946518666)：八安装目标、32 项 Node 用例、十三宿主和汇总验收 |
| 历史 Python 参照 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946731889)：冻结参照与混合运行时恢复 |
| v3.6.0 公开下载 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946736835)：三系统 × Node 22／24 的六项检查 |
| npm dry-run | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946741308)：prepare 成功，publish 按预期跳过 |
| Dependabot 首次扫描 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946535839)：GitHub 接受并执行 Actions 更新配置 |

所有 main／手动验证使用上面的实现 main。npm dry-run 验证已有发布输入、准备过程和 registry 字节，不申请 npm 发布凭据，也不验证真实 OIDC 发布。本次不创建新版本标签、npm 发布或 Release，既有 v3.6.0 身份保留。

main 与手动验证均已通过。纯文档证据收尾采用正常文档分流，并从仅含已提交文件的检出校验链接；最终 main 在文档门禁通过后，检查分支差异并通过显式 refspec 同步至 Gitee。[Issue #96 的六项缺口](https://github.com/fbincon/claude-code-statusline/issues/96)继续未验证，本任务接受这些缺口，不豁免新增自动化失败，也不将 dry-run 当作发布证据。
