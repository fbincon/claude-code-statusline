# 验收回执 envelope

[English](acceptance-receipt-envelope.md) | **简体中文**

本次 2026-11-14 的文档与工具交付定义共享验收回执 envelope，增加校验器与单元测试，并在 showcase 和 editor-capture 回执生产者中以增量字段应用。既有 CI 证据格式不变；`official-tests` 保持自身 schema。产品行为、命令、公共接口、存储格式与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Envelope 契约 | `tools/checks/receipt.ts` 定义 `AcceptanceEnvelope`、`createAcceptanceEnvelope` 与 `validateAcceptanceEnvelope`；要求源码 commit 与文件摘要、产物身份、运行时身份、至少一个通过检查及明确的限制。 |
| 试点 | `tools/acceptance/showcase.ts` 与 `tools/acceptance/editor-capture.ts` 增加嵌套 `envelope`，不改变既有顶层字段；collector 身份覆盖 `tools/checks/receipt.ts`。 |
| CI 边界 | `tools/checks/ci-fragment.ts` schema 2、`tools/checks/impact-product.ts` schema 1、发布绑定与 `tools/acceptance/official-tests.ts` 保持权威且不变。 |
| 测试 | `tools/checks/test/receipt.test.ts` 覆盖试点形状、official-tests 兼容形状、未知扩展键及非法身份/检查/限制用例。 |
| 文档 | `docs/development/testing.md#acceptance-receipt-envelope` 记录契约与仅试点边界；模板/检查登记表链接该节。 |

## 源码身份

- 任务前基线：`9c9c565a`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,304 个链接，0 错误 |
| `receipt.test.js` | 2/2 通过 |
| `npm run check` | 隔离组 1,184/1,184 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

本次不改造其余 acceptance 脚本，不改变既有 CI 证据身份，也未执行产品、安装、平台或付费验收。本地诊断保留自身格式，且不可晋升。
