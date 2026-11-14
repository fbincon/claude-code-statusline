# 发布资产 schema 文档

[English](release-asset-schema.md) | **简体中文**

本次 2026-11-14 的文档交付在发布指南中记录发布资产 schema，并从候选构建章节链接。产品行为、命令、公共接口与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Manifest | `docs/RELEASING.md#release-asset-schemas` 记录 `build-manifest.json` 字段：schema、commit、channel、版本、candidate/source 身份、逐字节一致构建及两条构建记录。 |
| 校验和 | 同一节记录 `SHA256SUMS` 行格式、三文件范围及 `npm run release:verify` 清单/摘要检查。 |
| 源码归档 | `statusline-source/.candidate-source.json` 记录为归档内清单，不是第五个上传资产；`build-report.json` 不是发布资产。 |
| 候选指南 | `docs/development/testing.md` 链接字段级 schema，保留既有四文件候选说明。 |
| 检查器 | 不新增检查器；发布构建与 verify 工具仍是权威。 |

## 源码身份

- 任务前基线：`826bc27b`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,327 个链接，0 错误 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 隔离组 1,185/1,185 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

本次不修改 `tools/build/candidate.ts`、`verify.ts` 或 `files.ts`，不重写已发布 Release 或其附件，也未执行产品、安装、平台或付费验收。
