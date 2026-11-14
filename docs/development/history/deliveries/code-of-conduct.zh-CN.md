# 双语行为准则

[English](code-of-conduct.md) | **简体中文**

本次 2026-11-14 的文档交付新增 Contributor Covenant 2.1 行为准则的英文和简体中文版本，并从贡献指南链接。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 社区政策 | 新增 `CODE_OF_CONDUCT.md` 与 `CODE_OF_CONDUCT.zh-CN.md`，包含 Contributor Covenant 2.1 文本和维护者联系方式。 |
| 贡献入口 | 在 `CONTRIBUTING.md` 与 `CONTRIBUTING.zh-CN.md` 中增加行为准则链接。 |
| 文档索引 | 在历史索引中登记本双语记录。 |

## 源码身份

- 任务前基线：`0f286e37`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,348 个链接，0 个错误。 |
| `git diff --check` | 通过。 |
| `npm run build` | 通过。 |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 个测试通过，0 个失败。 |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 个测试通过，0 个失败。 |

范围化影响计划与 CI 证据记录于 PR 描述。本次未运行产品、安装、官方宿主、终端、物理或付费验收；该文档变更不改变产品行为。未改动冻结的历史记录和发布说明。
