# 技能资源骨架与检查

[English](skill-resource-skeleton.md) | **简体中文**

本次 2026-11-14 的文档与检查交付增加规范技能资源骨架、占位符容忍的结构检查和双语指引。`packages/cli/resources/*/SKILL.md` 规范产品输入、产品行为、命令、公共接口与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 骨架 | `docs/development/skill-workflows.md#canonical-resource-skeleton` 记录 frontmatter 字段、name/目录一致性、argument hint、工具 archetype、占位符处理及必需正文结构。 |
| 检查 | `tools/checks/skill-resources.ts` 导出 `checkSkillResources`；校验安装器已知占位符 token、拒绝外部技能中的占位符、校验两种工具 archetype，并在 fenced code 之外按 ATX/setext 统计唯一 H1；由 `checkDocs` 调用。 |
| 测试 | `tools/checks/test/skill-resources.test.ts` 覆盖两种真实 archetype、非法 frontmatter、name/description/hint/flag/tool 失败、未知/畸形/外部占位符、fenced code、setext 标题、缺失或多个 H1、空正文、CRLF 及真实仓库文件。 |
| 登记 | 模板/检查登记表与代理指引链接骨架和检查。 |
| 边界 | 该检查是开发契约；`packages/cli/resources` 仍是产品执行输入，变更时保留完整产品矩阵。 |

## 源码身份

- 任务前基线：`6beb1379`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,311 个链接，0 错误 |
| `skill-resources.test.js` | 1/1 通过 |
| `npm run check` | 隔离组 1,185/1,185 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

本次不编辑任何规范 `SKILL.md`，不改变打包白名单，也不运行产品矩阵。新增的是开发结构检查；不验证付费模型行为、已安装技能或物理终端。
