# 仓库维护

[English](repository-governance.md) | **简体中文**

## 协作与安全

[GitHub](https://github.com/fbincon/claude-code-statusline)是 Issues、PR、CI 和安全报告的主要位置，Gitee 分发同步后的代码与发布。开发和反馈从[贡献指南](../../CONTRIBUTING.zh-CN.md)开始，私有漏洞报告遵循[安全政策](../../SECURITY.zh-CN.md)。通用双语 Bug 表单替换迁移预览表单，空白 Issue 继续用于提问和功能建议。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)保留既有平台验收跟踪用途。

根目录政策使用英文和简体中文对应文件，仅维护英文的[项目级代理指引](../../AGENTS.md)除外。该文件记录共享开发规则；个人偏好、机器配置和凭据处理保留在用户级指引中。GitHub 表单与 PR 模板各使用单个双语文件。项目 README 聚焦介绍与使用，维护证据放在本文或交付报告中。

## 主线保护与检查

2026-10-26 核验已启用的 [main-required-ci 规则集](https://github.com/fbincon/claude-code-statusline/rules/25857226)匹配 `refs/heads/main`。所有变更必须经过 PR，分支与主线同步，且来自 GitHub Actions 的 `Complete candidate evidence` 检查成功。包括无法归属的变更在内，必需审批人数均为 0；维护者和自动化账号均无 bypass 条目。禁止强推与删除，保留 merge commit，不要求线性历史。

PR 检查依据不可变[影响计划](impact-checks.zh-CN.md)：文档／媒体、呈现数据、测试、工具、CI 及发布数据采用专项检查，核心行为与运行依赖采用完整产品矩阵；混合职责合并检查要求。归属未知或包比较未解决时阻断。草稿快检不能通过 `Complete candidate evidence`。

等价 main 合并通过适用的产品或维护路线复用已验证的最终 PR 证据。已接受 base 独立核验源码、合并／tree、原始执行及产物，产品晋级还要求集成冒烟。改变的集成重新分类；证据不可用、过期、失败、取消及非预期跳过均保持阻断。准确路线和期限由 [CI 维护](ci-maintenance.zh-CN.md)负责。不得为完成失败 PR 而放宽分类、仓库保护或状态来源。

PR 成功合并后，在 GitHub 允许时自动删除其来源分支；保留所有历史分支。2026-10-26 盘点记录了 131 个可从主线到达及三个不可到达的非 main 分支头；该历史盘点不是删除授权。后续清理前仍须检查活跃 PR、固定提交身份和文档引用。

## 依赖与发布维护

启用 Dependabot alerts、依赖图与安全更新。安全更新 PR 仍需正常审阅和 CI，不自动合并。既有每周 Actions 版本更新配置保持不变，不增加 npm 定期版本更新。依赖修复可能需要同步修改固定版本清单、lockfile、打包器与验包器。密钥扫描和推送保护继续启用。

2026-10-26 首次扫描在 `tools/acceptance/package-lock.json` 和 `tools/migration/ts-05/reference-requirements.txt` 中发现六条告警（一条高危、两条中危、三条低危）。Dependabot 分别创建了 [setuptools #149](https://github.com/fbincon/claude-code-statusline/pull/149)、[body-parser #150](https://github.com/fbincon/claude-code-statusline/pull/150) 和 [fast-uri #151](https://github.com/fbincon/claude-code-statusline/pull/151) 修复 PR。此前根工作区的 npm audit 未覆盖这些独立依赖文件。这些修复当时安排为单独审阅和检查；该盘点是历史快照，不代表当前告警或 PR 状态。#96 的平台验收豁免不适用于依赖告警。

Release immutability 面向未来 GitHub 正式发布。先在草稿中准备并验证全部四项附件，再正式发布。已发布包的修复通过新版本交付，不替换附件或移动关联标签。不重建历史发布，也不新增覆盖全部 `v*` 的规则集。Gitee 副本须独立核对摘要，详见[发布流程](../RELEASING.zh-CN.md)。

该维护任务配置的仓库元数据将 Homepage 指向 npm 包，Topics 描述 TypeScript/Node CLI，关闭空 Wiki 并保留 Projects。CodeQL、npm 定期更新及其他社区服务不在当时范围内。

## 验证记录

下方记录 2026-10-26 的治理交付，任务数量、来源身份与当时路线均为历史证据；当前工作使用上方政策及所链接的 CI 指南。

检查器实现为 [PR #148](https://github.com/fbincon/claude-code-statusline/pull/148)，head 为 `a800be3114065464e88f8648fd70534b3c67cf19`，合并提交为 `eefdd59baf41b5800639b6fa8da2424a883b4670`。本地检查通过 1,248 项测试，另有五项平台限定跳过；3,245 处文档链接、生成资源、归档完整性及完整职责台账检查通过。另有十一项 scope／门禁／社区／文档定向测试通过。

[最终 PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40263118059)完成 56 项适用任务，文档任务按设计跳过。首次执行中，Windows／Claude 2.1.289 的一个集成测试超过既有 20 秒上限；用户在相同 head 上重跑失败任务后，第二次执行通过。原始失败证据保留在该运行中。[合并 main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40268711351)首次执行通过全部 56 项适用任务，文档任务按设计跳过，然后才配置仓库设置并提交社区内容 PR。

内容 PR 使用当时适用的轻量路线。设置修改通过 API 回读和公开入口检查验收，没有破坏性推送／标签探针或测试发布。该任务未创建产品版本、tag、Release 或 npm 发布。#96 原有六项缺口保持已接受但未验证，不能豁免新增自动化失败。
