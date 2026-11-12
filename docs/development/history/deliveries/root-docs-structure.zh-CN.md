# 根目录文档结构与版本归属

[English](root-docs-structure.md) | **简体中文**

本次 2026-11-13 维护完成[根目录文档审计](root-documentation-audit.zh-CN.md)之后的结构整理：拆分独立主栏大表、重排扩展指南，并把 CLI 参考设为当前版本的唯一登记处。产品行为、协议、存储格式和命令输出均未改变。

## 内容变更

| 领域 | 结果 |
| --- | --- |
| 显示项 | 原 39 行独立／实时主栏表拆为 5 个同级 H3 分表：模型／上下文／额度（7）、会话用量（13）、会话身份／仓库（9）、实时执行状态（5）和请求指标（5）。旧 `independent-and-live-main-items` 锚点保留。 |
| 扩展 | 指南按“数据源／权限 → 编辑器 → 来源类型 → 自动化 → Windows 路径 → 新鲜度／链接 → 操作／故障排查 → 兼容”排序。重复的租约与失败规则合并到一个共享小节；Windows H3 提升为 H2；新增紧凑故障排查索引。六个 `docs-example` 标记和四个外部入站锚点保持不变。 |
| 版本归属 | `docs/reference/cli.md` 现在负责当前接口与存储格式版本、读取范围、包兼容值及未版本化的宿主所有契约。COMPOSITION、EXTENSIONS、APPEARANCE、DIAGNOSTICS、USER_GUIDE、PACKAGE_MANAGEMENT、PROFILES、SCHEMES 和 TASK_DETAILS 改为链接，不再重复当前数字；开发文档的归属句指向同一章节。 |
| 检查 | `tools/checks/docs-content.ts` 要求集中章节存在，并要求 COMPOSITION 与 EXTENSIONS 包含链接；负向测试改为变异集中值并删除链接。 |

## 来源与验证

基线为 `607841a2`。实现提交如下：

| 阶段 | 提交 |
| --- | --- |
| 拆分独立显示项分表 | `2cce2042` |
| 重排扩展指南 | `db775e22` |
| 集中接口版本 | `e4ae1031` |

交付提交加入本记录、历史索引项和评审修正。

| 检查 | 实际结果 |
| --- | --- |
| 最终 head 的 `npm run docs:check` | 6,116 个本地链接，0 错误 |
| `git diff --check` | 通过 |
| 构建与文档测试 | `docs-content.test.js` 与 `docs-examples.test.js`：28/28 通过 |
| 双语标题层级 | DISPLAY_ITEMS、EXTENSIONS 和 reference/cli 三对一致 |
| 分表清单 | 两种语言均为 39 个唯一条目行；六个 docs-example 标记各恰好一次 |
| 不可变影响计划 | maintenance；Linux：actions/checks/docs；Windows 与 macOS：checks；无未知路径或比较 |
| 本机 Linux scoped receipt | `e4ae1031` 的 actions/checks/docs 通过 |

内容检查读取实际 Markdown 中的标记代码块，并在临时目录执行选定 CLI 工作流。这是文档与源码检查，不是已安装产品、编辑器焦点、物理或付费模型验收。

## 边界

不包含产品版本、tag、Release、npm 发布、截图或 Python 归档变更。开发子目录除版本归属句、CLI 参考章节和本记录外未做审计。历史交付记录和预览快照保留原始版本。既有六项 issue #96 缺口仍未验证。

最终 head 的 scoped receipts、所需的 **Complete candidate evidence**、合并身份和 main 晋级由交付 PR 记录。GitHub 仍是主仓库；验证后的 main 在检查分叉后同步到 Gitee，并核对远端 SHA。
