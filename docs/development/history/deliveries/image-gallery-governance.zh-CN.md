# 图片图库模板与清单 schema

[English](image-gallery-governance.md) | **简体中文**

本次 2026-11-14 的文档与检查维护新增新图库 README 模板、采集清单 schema 2，以及针对新图库与图库索引成员关系的结构检查。既有图库、清单及归档媒体保留原布局。产品行为、命令、公开接口、存储格式及已发布版本均不变；不创建版本、tag、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 模板 | `docs/images/README.zh-CN.md#图库模板` 及英文版定义 README 顺序、状态行、来源／采集方法／证据限制章节及索引回链。 |
| 清单 | `docs/images/README.zh-CN.md#采集清单-schema-2` 定义 schema 2：源码提交、包身份或 `null`、模型调用、实体视觉验收，以及带摘要、尺寸和字节数的捕获行。 |
| 检查 | `checkImageGalleries` 要求新图库提供 schema 2 清单与 README 模板，校验行和引用图片，并要求每个图库在英文和中文索引中各出现恰好一行。 |
| 集成 | 检查同时从 `checkAssets`（媒体变更）和 `checkDocs`（仅 README／索引变更）运行。 |
| 历史 | 12 个现行非归档图库、既有 v1 清单及 `docs/images/archive/**` 保持豁免。 |

## 源码身份

- 任务前基线：`39393cb0`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,265 个本地链接，0 错误（基线 7,261） |
| `npm run build` | 通过 |
| `docs.test.js` | 50/50 通过 |
| `impact-assets.test.js` | 13/13 通过，含新增图库 schema 用例 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 585/591 通过，6 项平台跳过，0 失败；118 个生成资源 |
| `git diff --check` | 通过 |
| 影响计划与定向检查 | 选中任务及结果在 CI 后记录于 PR 描述 |

本次仅修改文档与检查，不重新捕获、重新编码或改写既有图片，也未执行安装产品、编辑器、平台、实体、模型提供方或付费验收。检查验证结构，不验证视觉质量。issue #96 的六个既有缺口仍未验证。
