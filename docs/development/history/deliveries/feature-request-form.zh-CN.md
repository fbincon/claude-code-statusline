# 功能建议表单

[English](feature-request-form.md) | **简体中文**

本次 2026-11-14 的文档交付新增双语功能建议 Issue 表单，将功能建议引导至该表单、提问继续使用空白 Issue，并同步贡献指南、治理页面、模板登记表及交付历史。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Issue 表单 | 新增 `.github/ISSUE_TEMPLATE/feature_request.yml`，包含必填的问题／使用场景与建议方案、选填的备选方案及补充信息，并自动应用 `enhancement` 标签。`blank_issues_enabled` 保持 `true`。 |
| 贡献入口 | 在 `CONTRIBUTING.md` 与 `CONTRIBUTING.zh-CN.md` 中拆分功能建议与提问；功能建议使用新表单，提问使用空白 Issue。 |
| 治理页面 | 更新 `docs/development/repository-governance.md`、`docs/development/repository-governance.zh-CN.md`、`docs/development/roadmap.md` 与 `docs/development/roadmap.zh-CN.md`，使文档与新入口一致。 |
| 模板登记 | 在 `docs/development/README.md` 与 `docs/development/README.zh-CN.md` 中新增使用 `checkCommunity` 的 Issue 表单行。 |
| 文档索引 | 在两个开发历史索引中登记本双语记录。 |

## 源码身份

- 任务前基线：`cd6ee50f`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,374 个链接，0 个错误。 |
| `git diff --check` | 通过。 |
| `npm run build` | 通过。 |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 个测试通过，0 个失败。 |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 个测试通过，0 个失败。 |

范围化影响计划与 CI 证据记录于 PR 描述。本次未运行产品、安装、官方宿主、终端、物理或付费验收；该文档变更不改变产品行为。GitHub 负责渲染表单并应用标签，本地检查仅验证 YAML 结构与链接，未提交测试 Issue。未改动冻结的历史记录、发布说明、根目录 README 及产品代码。
