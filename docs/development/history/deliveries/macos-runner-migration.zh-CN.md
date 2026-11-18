# macOS runner 迁移

[English](macos-runner-migration.md) | **简体中文**

本次 2026-11-19 CI 维护交付将 Apple Silicon 任务迁出已退役的 macOS 14 runner。交付范围是托管 CI 策略和证据验证。产品版本、版本标签、GitHub Release 和 npm 发布均在本次交付范围之外。

## 变更

| 领域 | 结果 |
| --- | --- |
| Runner 矩阵 | macOS 15 ARM 接管 Node 22.0.0 的完整历史验收，同时执行其已有的 Node 24.0.0 完整历史验收。当前矩阵包含 7 个安装目标、28 个 Node 用例和 16 个固定 Claude 宿主。 |
| 证据 | 早期源码提交保留原 runner 矩阵、历史深度和覆盖摘要。证据晋级和发布准备报告已验收源码的覆盖范围。 |

## 源码身份

- 任务开始前的基线为 `c638208a`。
- 维护 PR 记录实施提交、最终分支头和托管检查。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 既有托管候选 | [任务 135029165885](https://github.com/fbincon/claude-code-statusline/actions/runs/44367581196/job/135029165885) 因 macOS 14 runner 配置不可用，在执行前取消。[GitHub 退役公告](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/) |
| 定向回归检查 | 36 项测试通过，覆盖运行时解析、原有与迁移后的覆盖计划、物理证据验证、双语内容以及发布准备。 |
| `npm run actions:check` | 工作流身份检查通过。 |

本次交付验证托管调度和证据契约。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 记录既有的物理验收缺口。
