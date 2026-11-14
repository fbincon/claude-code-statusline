# 后续性能报告模板

[English](performance-report-template.md) | **简体中文**

本次 2026-11-14 的文档交付在当前测试指南中增加后续性能报告模板。五份历史性能报告保持冻结。产品行为、命令、公共接口与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 模板 | `docs/development/testing.md#future-performance-reports` 为新报告定义状态、基线来源、产物身份、方法、结果与限制。 |
| 边界 | 性能索引中链接的五份历史报告保持冻结；模板不回填它们。 |
| 方法归属 | 模板链接 PERF-01 与既有 benchmark 说明，不复制安装计时规则。 |
| 检查器 | 不新增检查器；`docs:check` 与已登记内容/示例测试覆盖该页。 |

## 源码身份

- 任务前基线：`98c4f26f`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,321 个链接，0 错误 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 隔离组 1,185/1,185 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

模板仅面向后续报告；不修改历史报告、benchmark 工具或产品行为，也未执行产品、安装、平台或付费验收。
