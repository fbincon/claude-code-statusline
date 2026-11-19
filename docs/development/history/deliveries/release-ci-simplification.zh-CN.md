# 精简发布 CI

[English](release-ci-simplification.md) | **简体中文**

本次 2026-11-19 CI 维护交付将日常合并验证移至本地，并实测精简发布矩阵。产品版本、仓库版本标签、Release 和 npm 发布均在本次交付范围之外。

## 变更

| 领域 | 结果 |
| --- | --- |
| 日常 PR 和 main | 本地结果记录于审核 head。项目 CI 分配零个 runner。主线规则要求经过 PR，并禁止强推和删除。 |
| 发版候选及晋升 | 仓库内 `release/` PR 生成四件交付文件并执行精简安装和宿主矩阵。main 从首父独立校验原始证据并执行三系统原包冒烟。tag 和 npm 准备阶段重新核对并复用原文件。 |
| 诊断 | 完整历史矩阵和专项探针通过 CI diagnostics 手动派发。 |

## 源码身份

- 任务前基线为 `8a4b30522c837fa13a8b9c88edf968c9637496a3`。
- 已验证的实现提交为 `f2b9842a418ca2b13983d287801a011cb27c4fea`。[交付 PR](https://github.com/fbincon/claude-code-statusline/pull/275)记录最终 head、合并结果、规则集回读及 Gitee 同步。
- [托管交付制品](https://github.com/fbincon/claude-code-statusline/actions/runs/44438451670/artifacts/14489607633)的 ZIP SHA-256 为 `412db00ec0bacb519dbed9bd473dd7163252d1110defcfcc82b2ba6b43b61e6b`。tgz SHA-256 为 `7ecfbe054d9229b06e8f9a1876065460d540d66464b788c5c88be6a32ccb2e15`。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run check` | 1,784 项通过，6 项按平台条件跳过，零失败。生成、文档、归档和职责检查通过。 |
| Linux 专项和工作流 | `a0ef4b47` 的验收、Action、检查器、文档及发布专项通过。actionlint v1.7.12 和依照源码的文档测试通过。 |
| 托管候选矩阵 | [运行 44438451670 第 1 次尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/44438451670/attempts/1)中 11 个实际作业全部通过。首个作业启动至最后一个完成耗时 20 分 21 秒。四件交付文件与本地独立构建逐字节一致。 |
| PR → main → tag 及 npm 准备 | 在隔离 Git 仓库中用模拟的 Actions 与 registry 回放真实四件文件，正向核验通过。回归同时拒绝了变更的合并关系、失败的最新执行、过期制品和更改的交付字节。 |

[前一轮诊断 44436913455](https://github.com/fbincon/claude-code-statusline/actions/runs/44436913455)发现冒烟驱动在 Node 22.0.0 上无法启动。改为直接导入共享 Git 读取器后，最低 Node 版本复测通过。CodeQL 标记了移出的诊断工作流两处 checkout 输入，固定到派发 SHA 后扫描通过。托管结果是诊断证据。发布晋升与 npm 准备在隔离环境验证。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)的六项既有缺口沿用接受的未验证状态。
