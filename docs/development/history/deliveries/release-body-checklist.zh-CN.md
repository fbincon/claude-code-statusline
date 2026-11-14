# 公开发布正文清单

[English](release-body-checklist.md) | **简体中文**

本次 2026-11-14 的文档交付在发布指南中增加公开发布正文清单。它区分仓库内发布说明页面与 GitHub/Gitee Release 正文，并记录标题、双语正文、必需块、四件附件、证据边界及 Gitee renderer/回读要求。产品行为、命令、公共接口与已发布 Release 不变；不创建版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 清单 | `docs/RELEASING.md#public-release-body-checklist` 覆盖英文标题、双语正文惯例、必需块与四件附件链接。 |
| 页面/正文区分 | 清单区分 `docs/releases/vX.Y.Z.md`、`.zh-CN.md` 与外部 GitHub/Gitee Release 正文。 |
| Gitee | 清单要求 `release:gitee-notes`、追加的 Gitee／原始发布章节、避免保留标题，以及元数据/附件回读。 |
| 检查器 | 不新增检查器；发布说明检查与 Gitee renderer 仍是权威。 |

## 源码身份

- 任务前基线：`c87f8c13`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,331 个链接，0 错误 |
| `docs.test.js` | 54/54 通过 |
| `npm run check` | 隔离组 1,185/1,185 通过；串行组 585/591 通过，6 个平台跳过；0 失败 |
| `npm run build` | 通过 |
| `git diff --check` | 通过 |
| 影响计划与专项检查 | CI 后记录于 PR 描述 |

本次不新增发布正文校验器，不修改已发布 Release 或其附件，也未执行产品、安装、平台或付费验收。
