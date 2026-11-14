# 验收生产者登记

[English](acceptance-producer-registry.md) | **简体中文**

本次 2026-11-14 的文档与工具交付登记 `tools/acceptance` 下所有非测试顶层模块，并新增带双语投影的阻断式 registry 检查。不改变任何 acceptance producer 的生产逻辑、CI 证据格式、产品行为、命令、公共接口、存储格式或已发布 Release；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 登记 | `tools/checks/acceptance-producers.ts` 定义 `ACCEPTANCE_PRODUCERS` 共 60 项：21 个 producer、3 个 diagnostic、30 个 helper、4 个 wrapper、2 个 driver。 |
| 检查 | `checkAcceptanceProducers` 校验文件系统清单、条目规则、固定例外及双语表投影；`validateKnownExceptions` 锁定敏感决策。 |
| 执行 | `tools/checks/docs.ts` 调用该检查，`npm run docs:check` 与 `npm run check` 阻断漂移；`tools/acceptance/test/acceptance-producers.test.ts` 补齐 acceptance 家族 scoped route。 |
| 文档 | `docs/development/testing.md#acceptance-receipt-producers` 记录政策、token 词表、例外与登记；模板/检查登记表与 `AGENTS.md` 链接该节。 |
| 边界 | 未改任何 producer 逻辑、`ci-fragment` schema 2、complete evidence、scoped/maintenance receipt、release binding、`official-tests` schema 或 `integration-smoke` schema。 |

## 源码身份

- 任务前基线：`86bd098b`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,340 个链接，0 错误 |
| `acceptance-producers.test.js` | 6/6 通过 |
| acceptance 家族 `acceptance-producers.test.js` | 1/1 通过 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 隔离组 1,192/1,192 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| `npm run generate:check` | 通过；118 个生成资源，check true |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

本次未在更多 producer 接入 envelope，未迁移 physical fragment schema，未执行付费或手动验收，未改写冻结记录。Registry 只分类源码文件；coverage-plan 计数、producer/job 身份、receipt 文件集合与 release binding 仍由既有检查负责。改变锁定例外的重分类还必须更新 `validateKnownExceptions` 与 `PLANNED_ALLOWED`。当 `tools/acceptance` 或任一 testing 指南缺失时，registry 检查为空操作；这些结构性失败由其他构建、验收与双语检查覆盖。
