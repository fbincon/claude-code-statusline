# PR 模板与 Issue 路由治理

[English](pr-issue-template-governance.md) | **简体中文**

本次 2026-11-14 的文档与检查交付为单文件双语 PR 模板增加结构检查，将过时的 `preview-feedback.yml` 路由替换为顶层 Issue 表单通配，并修正开发 README 中的登记说明。产品行为、命令、公共接口、存储格式与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| PR 模板 | `checkPullRequestTemplate` 按精确行校验四个双语标题、四个按需事项标签、贡献指南链接与脱敏提示；`checkCommunity` 在 Issue 模板目录早退之前执行，仓库自检要求规范模板存在。 |
| Issue 路由 | `documentationOnly` 与 `createImpactPlan` 接受任意顶层 `.github/ISSUE_TEMPLATE/*.yml`/`.yaml` 表单并拒绝嵌套表单；移除失效的 `preview-feedback.yml` 白名单项。 |
| 测试 | community、ci-scope 与 impact-plan 测试覆盖合法/非法模板、`.yaml` 表单、嵌套表单及真实仓库模板。 |
| 文档 | 贡献指南、代理指引、仓库治理、CI 维护、影响检查与模板/检查登记表描述新边界。 |
| 登记说明 | 开发 README 改为引用实际的 `checkDocumentationRegistration` 白名单与 `DOCUMENT_CONTENT_PATHS`，不再引用不存在的 `UNREGISTERED_CURRENT_PAGES`。 |

## 源码身份

- 任务前基线：`6c7e321b`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,298 个链接，0 错误 |
| `community.test.js` + `ci-scope.test.js` + `impact-plan.test.js` | 36/36 通过 |
| `npm run check` | 585/591 通过，6 个平台跳过，0 失败；118 个生成资源 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

冻结的 `docs/releases/v3.0.0-beta.1.md` 保留历史 `preview-feedback.yml` 链接；本次不回溯冻结发布页。未新增 feature request 表单或 advisory PR 标题检查，也未执行产品、安装、平台或付费验收。
