# 文档页面与登记治理

[English](documentation-registration-governance.md) | **简体中文**

本次 2026-11-14 的文档与检查维护新增现行页面清单、模板／检查登记表，以及针对已登记页面的结构、索引可达性及顶层登记的窄范围检查。同时把本地文件豁免改为显式路径，并修正 Native 中文页面的语言导航行。产品行为、命令、公开接口、存储格式及已发布版本均不变；不创建版本、tag、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 清单 | `docs/development/README.zh-CN.md#新增现行文档页面` 及英文版定义配对、导航、索引插入、登记、风格与交付步骤。 |
| 登记表 | `docs/development/README.zh-CN.md#模板与检查登记表` 列出维护中的模板、检查及边界；`impact-checks.zh-CN.md` 链接该表。 |
| 页面检查 | `checkDocumentationPages` 校验已登记页面的 H1、语言导航及索引可达性。 |
| 登记检查 | `checkDocumentationRegistration` 要求每个现行顶层指南已登记或显式列入白名单；六个尚未具备源码事实的现行指南带原因列入。 |
| 范围 | `LOCAL_ONLY` 改为显式 `docs/` 路径，嵌套的 `docs/notes/ROADMAP.md` 不再豁免。 |
| 导航 | `docs/development/native.zh-CN.md` 改用标准 `[English](native.md) | **简体中文**` 行。 |

## 源码身份

- 任务前基线：`d960a99e`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,290 个本地链接，0 错误（基线 7,265） |
| `npm run build` | 通过 |
| `docs.test.js` | 54/54 通过，含页面、登记及嵌套 ROADMAP 用例 |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 通过 |
| `npm run check` | 585/591 通过，6 项平台跳过，0 失败；118 个生成资源 |
| `git diff --check` | 通过 |
| 影响计划与定向检查 | 选中任务及结果在 CI 后记录于 PR 描述 |

本次仅修改文档与检查，不为六个白名单指南新增源码事实检查，不校验正文风格，也未执行安装产品、编辑器、平台、模型提供方或付费验收。issue #96 的六个既有缺口仍未验证。
