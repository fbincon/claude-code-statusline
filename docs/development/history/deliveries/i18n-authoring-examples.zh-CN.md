# i18n 维护输入示例

[English](i18n-authoring-examples.md) | **简体中文**

本次 2026-11-14 的文档交付增加 i18n 维护输入的字段级示例，并修正纯文档验证说明。产品行为、命令、公共接口、存储格式与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Context 示例 | `docs/development/i18n.md#authoring-input-examples` 展示完整 `context.json` 形状及 `schema_version`、`entries`、`version`、`description`、`terms` 与可选 `cell_budget`。 |
| Terminology 示例 | 同一节展示完整 `terminology.json` 形状，并说明语言字段属于维护约定而非校验 schema；未被引用的条目不校验。 |
| 验证说明 | 纯文档章节现在说明：已登记的现行指南还需执行影响计划选中的构建、源码内容与示例测试。 |
| 边界 | 不新增检查器；既有分析器与 language 命令仍是权威。 |

## 源码身份

- 任务前基线：`ea0644ab`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,315 个链接，0 错误 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 隔离组 1,185/1,185 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

示例仅作说明，不向原始包填入英文，也不替代 `languages` 命令。本次不新增检查器，也未执行产品、安装、平台或付费验收。
