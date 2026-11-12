# CI 验收实测

[English](ci-efficiency.md) | **简体中文**

## 失败基线

旧安装套件的 55 分钟总时限曾提前终止仍在自身期限内的外观场景。#190 的 Windows ARM／x64 Node 已执行 4.64 秒，#198 为 52.86 秒，两份日志均已有 26 项测试通过。#198 的 Windows ARM／Node 22.0.0 单项重跑耗时 52 分 28 秒。#198 最终 head 的另一次失败发生在 Intel Mac 产品断言通过后的制品上传。该运行首轮墙钟为 2 小时 03 分 16 秒，60 个作业未加权 runner 执行合计 1,389 分 13 秒，最长排队 99 分 20 秒。Intel 作业和依赖门禁重跑另花 24 分 31 秒 runner 时间。[#190 超时](https://github.com/fbincon/claude-code-statusline/actions/runs/41007969032/job/123908643050) · [#198 超时重跑](https://github.com/fbincon/claude-code-statusline/actions/runs/41168202931/job/124463172951) · [#198 最终源码各轮运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268)

## 安装包语言验收

每台 runner 使用同一 v3.16.1 压缩包，SHA-256 为 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c`，交错执行三组新旧对照。每个样本检查全部 144 对 UI／输出语言。旧执行启动 879 次候选 Node，新执行启动 231 次。组合顺序、断言及内容摘要均一致，每行一个冷启动对照，输出语言轮换，合计 12 个组合仍通过真实 CLI 管道覆盖全部 UI 语言和输出语言。下表时间单位为秒。[托管对照与原始制品](https://github.com/fbincon/claude-code-statusline/actions/runs/41262274958) · [预算与语言改动](https://github.com/fbincon/claude-code-statusline/pull/200)

| 实际 runner 与 x64 Node | 旧样本 | 新样本 | 中位耗时降幅 | 制品 ID |
| --- | --- | --- | ---: | --- |
| Ubuntu 24.04，24.21.0 | 124.64、122.04、120.86 | 38.84、38.76、36.90 | 68.2% | 13065399693 |
| macOS 15 Intel，24.21.0 | 412.69、301.69、287.21 | 114.69、110.84、88.19 | 63.3% | 13066266349 |
| Windows 11 ARM，24.21.0 | 817.71、799.49、798.97 | 243.53、244.13、246.61 | 69.5% | 13066224589 |
| Windows 11 ARM，22.0.0 | 1038.46、1000.83、965.94 | 308.85、308.04、285.49 | 69.2% | 13067218164 |

该诊断含输入准备及新旧驱动，未加权 runner 时间共 155 分 15 秒，墙钟 68 分 30 秒，作业排队 2–3 秒。

## 历史深度与定向重跑

在同一台 Linux x64／Node 24.21.0 机器上，各档位使用同一候选包，SHA-256 为 `cecd4b540a09a0c316dc27562ae6c4e50baf7ff59b4e9c6b4ab5e0b773dc50b1`。每个宿主／档位各取一个样本，计时包括历史事务，不含最初安装夹具。每份原始回执都由已接受的 `4cb8db1` 验证器读取。[读取端部署](https://github.com/fbincon/claude-code-statusline/pull/201) · [历史与分片实现](https://github.com/fbincon/claude-code-statusline/pull/202)

| 宿主 | 完整历史 | 短历史 |
| --- | ---: | ---: |
| 版本夹具 | 90.96 秒 | 13.47 秒 |
| 官方 Claude 2.1.310 | 165.09 秒 | 78.78 秒 |
| 官方 Claude 2.1.288，仅 Native | — | 40.40 秒 |

下列七个托管作业验证提交 `7039eb8`，候选包 SHA-256 为 `207aff4c6c0ca65e4423f03f0f37c7d243aafb694deec609186c2208041ae7c7`。诊断墙钟 26 分 54 秒，计入准备与汇总作业后，未加权 runner 时间共 135 分 24 秒。作业排队 2 至 7 秒。[七个原始执行](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/attempts/1)

| 物理作业 | 验收步骤 | 整个作业 |
| --- | ---: | ---: |
| Windows ARM／x64 Node 22.0.0，语言 | 5分53秒 | 7分18秒 |
| Windows ARM／x64 Node 22.0.0，完整历史 | 21分47秒 | 23分05秒 |
| Windows ARM／x64 Node 22.0.0，其余安装与源测 | 19分20秒 | 20分46秒 |
| Ubuntu x64 安装，完整历史 | 11分55秒 | 12分14秒 |
| Intel macOS 安装，短历史 | 22分03秒 | 23分04秒 |
| Linux Claude 2.1.296，短历史 | 21分24秒 | 21分48秒 |
| Linux Claude 2.1.310，完整历史 | 24分04秒 | 24分28秒 |

原生定向重跑只实际执行了 ARM 语言作业 6 分 57 秒和依赖汇总 16 秒，产生新作业 `124746022304` 与制品 `13069512605`。其余六条执行记录的原 ID、attempt、时间、摘要完全一致，两轮独立汇总的不可变制品已另行下载并比较。[定向重跑](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/attempts/2)

## Worker 输入与制品恢复

第三阶段的原完整候选 ZIP 为 41,887,915 字节。以原包和经过核验的 worker 清单生成的无压缩轻量 ZIP 为 5,167,748 字节，每个普通 worker 少传 36,720,167 字节（87.66%）。在 Linux x64 的热文件缓存下，交错进行 9 轮新目录测量，读取并校验 CRC 解包的中位耗时由 32.568 ms 降至 3.163 ms。若计入进程启动、清单校验和还原测试输入，轻量路径共花 87.113 ms。恢复后的包通过原验证器的 1,092 文件检查。本机测量不含网络耗时。[原完整制品](https://github.com/fbincon/claude-code-statusline/actions/runs/41270059909/artifacts/13068638321)

传输 Action 在每台 runner 使用自己的完整性锁定 SDK。同一 Linux 机器单次冷准备为 4.586 秒，npm 缓存占用 28 MiB，runner 临时目录安装 187 MiB。使用热 npm 缓存、换新临时目录时为 1.424 秒，重用初始化后的目录约 1 ms。普通本地开发和包构建仍使用独立的仓库根锁。

在 Windows 11 ARM 镜像 `20261025.196.1` 上，下载第一个制品前，SDK 安装触及 90 秒上限。镜像 `20261026.197.1` 上的诊断使用原生 ARM64 Action Worker，运行 Node 24.22.1，并调用 x64 Node 24.21.0 工具链中的 npm 11.19.0。安装锁定的 266 个包，空 npm 缓存耗时 94.903 秒，已有依赖压缩包但换新安装目录耗时 85.728 秒。复用已完成的安装目录仅需 1–2 毫秒。Windows ARM64 Action Worker 的 SDK 安装限时为 180 秒，其他平台为 90 秒。[原始超时](https://github.com/fbincon/claude-code-statusline/actions/runs/41282500996/job/124778016949) · [Windows ARM 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/41283455910/job/124779900376)

托管探测在 `b2f9af7` 上实际生成了 41,997,730 字节的完整 ZIP（制品 `13070430658`）和 5,225,964 字节的轻量 ZIP（`13069489705`），实测减少 87.56%。Linux 上模拟丢失上传确认后，在 14.205 秒内找回第一次成功的原制品。轻包提交前模拟断连，两次调用共用 5.457 秒。Windows 首读完整输入耗时 16.002 秒，读取轻包时注入中断，恢复共用 1.433 秒。各步骤包含的初始化与恢复工作不同。摘要不符、HTTP 403 和上传对象歧义均在第一次操作直接失败，持续 503 两次后终止。两个作业各排队 2 秒，runner 时间合计 169 秒，墙钟 175 秒。[托管探测](https://github.com/fbincon/claude-code-statusline/actions/runs/41273837453) · [诊断回执](https://github.com/fbincon/claude-code-statusline/actions/runs/41273837453/artifacts/13070182754)

首次 Windows 探测在 SDK 准备阶段发现 Node Worker 对 runner 的 `Path` 按大小写查找的问题。修复后，另在本地回读两个托管 ZIP，核对服务端 SHA-256，用完整候选重新生成清单。还原的压缩包 `3c9ebd6dbcd3f4e92d9f9dfe0463bd4f7fe527cf2716642ab5e9bfdea6685373` 通过了离线安装、doctor、渲染、配置读写及卸载保留检查。[首次 Windows 准备失败](https://github.com/fbincon/claude-code-statusline/actions/runs/41273548069/job/124751285890) · [传输改动](https://github.com/fbincon/claude-code-statusline/pull/203)

## 解读口径

Runner 时间按作业求和，包含并行执行。墙钟还受依赖关系与可用容量影响。无模型诊断可验证 worker、恢复行为及专项耗时。[PR #204](https://github.com/fbincon/claude-code-statusline/pull/204) 的[完整运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41291221369)于 2026-11-01 09:00:45–10:55:52Z 完成，墙钟约 115 分钟，对照 70 分钟目标。六项既有物理与宿主声明缺口继续绑定原发布记录。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
