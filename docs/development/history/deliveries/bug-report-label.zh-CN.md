# Bug 报告标签

[English](bug-report-label.md) | **简体中文**

本次 2026-11-14 的文档交付为双语 Bug 报告 Issue 表单添加 `bug` 标签，使新的 Bug Issue 自动进入分类。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Issue 表单 | 在 `.github/ISSUE_TEMPLATE/bug_report.yml` 增加顶层 `labels: [bug]`；既有双语字段和必填校验不变。 |
| 文档索引 | 在两个开发历史索引中登记本双语记录。 |

## 源码身份

- 任务前基线：`578c18c4`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,378 个链接，0 个错误。 |
| `git diff --check` | 通过。 |

范围化影响计划与 CI 证据记录于 PR 描述。本次未运行产品、安装、官方宿主、终端、物理或付费验收；该文档变更不改变产品行为。GitHub 在提交表单时应用标签，本地检查仅验证 YAML 结构，未提交测试 Issue。未改动冻结的历史记录、发布说明、根目录 README 及产品代码。
