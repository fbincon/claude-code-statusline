# 仓库维护

[English](repository-governance.md) | **简体中文**

## 协作与安全

[GitHub](https://github.com/fbincon/claude-code-statusline)是 Issues、PR、CI 和安全报告的主要位置，Gitee 分发同步后的代码与发布。开发和反馈从[贡献指南](../../CONTRIBUTING.zh-CN.md)开始，私有漏洞报告遵循[安全政策](../../SECURITY.zh-CN.md)。通用双语 Bug 表单替换迁移预览表单，空白 Issue 继续用于提问和功能建议。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)保留既有平台验收跟踪用途。

根目录政策使用英文和简体中文对应文件，仅维护英文的[项目级代理指引](../../AGENTS.md)除外。该文件记录共享开发规则；个人偏好、机器配置和凭据处理保留在用户级指引中。GitHub 表单与 PR 模板各使用单个双语文件。项目 README 聚焦介绍与使用，维护证据放在本文或交付报告中。

## 主线保护与检查

2026-10-26 核验已启用的 [main-required-ci 规则集](https://github.com/fbincon/claude-code-statusline/rules/25857226)匹配 `refs/heads/main`。所有变更必须经过 PR，分支与主线同步，且来自 GitHub Actions 的 `Complete candidate evidence` 检查成功。包括无法归属的变更在内，必需审批人数均为 0；维护者和自动化账号均无 bypass 条目。禁止强推与删除，保留 merge commit，不要求线性历史。

明确白名单内的文档／模板要求文档检查成功，其他变更要求完整适用产品矩阵。scope 失败、证据缺失／失败／取消，以及非预期跳过均不能通过汇总门禁。路径、本地命令和分类器回归见 [CI 维护](ci-maintenance.zh-CN.md)。不得为了完成失败 PR 而放宽规则或换用其他状态来源。

PR 成功合并后，在 GitHub 允许时自动删除其来源分支；保留所有历史分支。初始盘点中，131 个非 main 分支头已可从主线到达，另外三个不能到达；这些只是将来的核对候选，并非删除授权。后续清理前仍须检查活跃 PR、固定提交身份和文档引用。

## 依赖与发布维护

启用 Dependabot alerts、依赖图与安全更新。安全更新 PR 仍需正常审阅和 CI，不自动合并。既有每周 Actions 版本更新配置保持不变，不增加 npm 定期版本更新。依赖修复可能需要同步修改固定版本清单、lockfile、打包器与验包器。密钥扫描和推送保护继续启用。

2026-10-26 首次扫描在 `tools/acceptance/package-lock.json` 和 `tools/migration/ts-05/reference-requirements.txt` 中发现六条告警（一条高危、两条中危、三条低危）。Dependabot 分别创建了 [setuptools #149](https://github.com/fbincon/claude-code-statusline/pull/149)、[body-parser #150](https://github.com/fbincon/claude-code-statusline/pull/150) 和 [fast-uri #151](https://github.com/fbincon/claude-code-statusline/pull/151) 修复 PR。此前根工作区的 npm audit 未覆盖这些独立依赖文件。修复仍须单独审阅和检查，本次维护不更新依赖版本。#96 的平台验收豁免不适用于依赖告警。

Release immutability 面向未来 GitHub 正式发布。先在草稿中准备并验证全部四项附件，再正式发布。已发布包的修复通过新版本交付，不替换附件或移动关联标签。不重建历史发布，也不新增覆盖全部 `v*` 的规则集。Gitee 副本须独立核对摘要，详见[发布流程](../RELEASING.zh-CN.md)。

Homepage 指向 npm 包，Topics 描述当前 TypeScript/Node CLI 和支持平台。关闭空 Wiki，保留 Projects。CodeQL、npm 定期更新及其他社区服务不属于本次维护范围。

## 验证记录

检查器实现为 [PR #148](https://github.com/fbincon/claude-code-statusline/pull/148)，head 为 `a800be3114065464e88f8648fd70534b3c67cf19`，合并提交为 `eefdd59baf41b5800639b6fa8da2424a883b4670`。本地检查通过 1,248 项测试，另有五项平台限定跳过；3,245 处文档链接、生成资源、归档完整性及完整职责台账检查通过。另有十一项 scope／门禁／社区／文档定向测试通过。

[最终 PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40263118059)完成 56 项适用任务，文档任务按设计跳过。首次执行中，Windows／Claude 2.1.289 的一个集成测试超过既有 20 秒上限；用户在相同 head 上重跑失败任务后，第二次执行通过。原始失败证据保留在该运行中。[合并 main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40268711351)首次执行通过全部 56 项适用任务，文档任务按设计跳过，然后才配置仓库设置并提交社区内容 PR。

内容 PR 仅使用轻量路径。设置修改通过 API 回读和公开入口检查验收，不尝试破坏性推送／标签操作，不提交虚构报告或测试发布。最终 PR/main 身份、设置核验和显式 Gitee 同步结果记录于本任务交付报告。本次不创建产品版本、tag、Release 或 npm 发布。#96 原有六项缺口保持已接受但未验证，不能豁免新的自动化失败。
