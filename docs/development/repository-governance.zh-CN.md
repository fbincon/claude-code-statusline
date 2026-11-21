# 仓库维护

[English](repository-governance.md) | **简体中文**

## 协作与安全

[GitHub](https://github.com/fbincon/claude-code-statusline)是 Issues、PR、CI 和安全报告的主要位置，Gitee 分发同步后的代码、发布说明和两个发布元数据资产。开发和反馈从[贡献指南](../../CONTRIBUTING.zh-CN.md)开始，私有漏洞报告遵循[安全政策](../../SECURITY.zh-CN.md)。通用双语 Bug 表单替换迁移预览表单；双语功能建议表单用于收集功能建议，空白 Issue 继续用于提问。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)保留既有平台验收跟踪用途。

根目录政策使用英文和简体中文对应文件，仅维护英文的[项目级代理指引](../../AGENTS.md)除外。该文件记录共享开发规则；个人偏好、机器配置和凭据处理保留在用户级指引中。GitHub 表单与 PR 模板各使用单个双语文件。`docs:check` 校验 PR 模板必需的双语章节，`.github/ISSUE_TEMPLATE/` 下的任意顶层表单按文档路由。项目 README 聚焦介绍与使用，维护证据放在本文或交付报告中。

## 主线保护与检查

[主线规则集](https://github.com/fbincon/claude-code-statusline/rules/25857226)覆盖 `refs/heads/main`，要求经 PR 合并并禁止强推和删除。必需审批人数为零，维护者和自动化没有 bypass 条目。允许 merge commit。

合并前核对分支已同步主线，PR 记录最终 head 的本地检查。普通 PR 和 `main` 合并分配零个项目 CI runner。发布候选使用仓库内的 `release/` 分支，按 [CI 晋升流程](ci-maintenance.zh-CN.md#候选包在-prmain-与-tag-之间晋级)等待最终候选和原包集成验证。

PR 成功合并后，在 GitHub 允许时自动删除其来源分支。2026-11-13 核实时，`origin` 上仅有 `main`。2026-10-26 盘点记录了 131 个可从主线到达及三个不可到达的非 main 分支头；该历史盘点不是删除授权。后续清理前仍须检查活跃 PR、固定提交身份和文档引用。

## 依赖与发布维护

启用 Dependabot alerts、依赖图与安全更新。安全更新 PR 仍需正常审阅和本地检查，不自动合并。既有每周 Actions 版本更新配置保持不变，不增加 npm 定期版本更新。依赖修复可能需要同步修改固定版本清单、lockfile、打包器与验包器。密钥扫描和推送保护继续启用。

2026-10-26 首次扫描在 `tools/acceptance/package-lock.json` 和 `tools/migration/ts-05/reference-requirements.txt` 中发现六条告警（一条高危、两条中危、三条低危）。Dependabot 分别创建了 [setuptools #149](https://github.com/fbincon/claude-code-statusline/pull/149)、[body-parser #150](https://github.com/fbincon/claude-code-statusline/pull/150) 和 [fast-uri #151](https://github.com/fbincon/claude-code-statusline/pull/151) 修复 PR。此前根工作区的 npm audit 未覆盖这些独立依赖文件。这些修复当时安排为单独审阅和检查；该盘点是历史快照，不代表当前告警或 PR 状态。#96 的平台验收豁免不适用于依赖告警。

Release immutability 面向未来 GitHub 正式发布。先在 GitHub 草稿中准备并验证全部四项附件，再正式发布。已发布包的修复通过新版本交付，不替换附件或移动关联标签。不重建历史发布，也不新增覆盖全部 `v*` 的规则集。当前 TypeScript 版本由 Gitee 镜像代码、带注释标签和发布说明，并仅附加 `build-manifest.json` 和 `SHA256SUMS`；受 Gitee 仓库附件配额限制，包和源码归档保留在 GitHub。两个 Gitee 元数据副本须独立核对摘要，包和源码归档链接须解析到固定版本的 GitHub 原件。Python 时代版本继续在 Gitee 保留 wheel、sdist 和 `SHA256SUMS`。详见[发布流程](../RELEASING.zh-CN.md)。

该维护任务配置的仓库元数据将 Homepage 指向 npm 包，Topics 描述 TypeScript/Node CLI，关闭空 Wiki 并保留 Projects。npm 定期更新及其他社区服务仍不在该任务范围内。

## CodeQL 与代码扫描

已为 GitHub Actions 和 JavaScript/TypeScript 启用 CodeQL 默认配置。Python 保持关闭，因为 Python 实现作为冻结归档保留。配置使用标准 GitHub runner、默认查询集和 remote-sources 威胁模型；扫描推送到 `main` 和受保护分支的变更、针对这些分支的 PR，以及每周计划任务。CodeQL 按独立安全扫描配置运行。

`2c2044d0` 上的首次扫描无分析错误，产生 29 个告警。全部告警均已分诊并按记录的理由关闭：14 个测试／工具类告警按 used in tests 或 false positive 关闭；15 个 `actions/cache-poisoning` 告警按 false positive 关闭，因为候选任务使用只读权限、Actions 缓存按分支隔离，且工作流由维护者手动派发，不接受任意 commit 输入。当前无开放告警。新告警应在 Security 页面分诊；未核对路径和信任模型前不得关闭。参见 [CodeQL 默认配置交付记录](history/deliveries/codeql-default-setup.zh-CN.md)。

## 验证记录

下方记录 2026-10-26 的治理交付，任务数量、来源身份与当时路线均为历史证据；当前工作使用上方政策及所链接的 CI 指南。

检查器实现为 [PR #148](https://github.com/fbincon/claude-code-statusline/pull/148)，head 为 `a800be3114065464e88f8648fd70534b3c67cf19`，合并提交为 `eefdd59baf41b5800639b6fa8da2424a883b4670`。本地检查通过 1,248 项测试，另有五项平台限定跳过；3,245 处文档链接、生成资源、归档完整性及完整职责台账检查通过。另有十一项 scope／门禁／社区／文档定向测试通过。

[最终 PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40263118059)完成 56 项适用任务，文档任务按设计跳过。首次执行中，Windows／Claude 2.1.289 的一个集成测试超过既有 20 秒上限；用户在相同 head 上重跑失败任务后，第二次执行通过。原始失败证据保留在该运行中。[合并 main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40268711351)首次执行通过全部 56 项适用任务，文档任务按设计跳过，然后才配置仓库设置并提交社区内容 PR。

内容 PR 使用当时适用的轻量路线。设置修改通过 API 回读和公开入口检查验收，没有破坏性推送／标签探针或测试发布。该任务未创建产品版本、tag、Release 或 npm 发布。#96 原有六项缺口保持已接受但未验证，不能豁免新增自动化失败。
