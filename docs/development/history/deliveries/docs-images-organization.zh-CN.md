# docs/images 索引整理与 Python 时代归档

[English](docs-images-organization.md) | **简体中文**

本次 2026-11-13 维护将图片文档整理为当前索引、本地图库索引和冻结的 Python 时代归档。产品行为、公共接口、存储格式及所有图片字节保持不变；不创建版本、tag、Release 或 npm 发布。

## 变更

| 轮次 | 结果 |
| --- | --- |
| 内容修正 | 增加 `setup-appearance` 逐图来源记录；修正过期渲染器路径、归档快照措辞、归档打包／项目首页声明、根导航标签、双语元数据范围及 showcase／draft／TypeScript 措辞；统一 `SHA-256` 标签。 |
| 索引重构 | 将 251 行根证据台账替换为 17 行图库索引、状态／版本列、完整目录树、维护约定及保留的旧锚点。新增 `tui/`、`appearance/`、`statusline/`、`discovery/` 双语本地索引；为每个图库增加状态行。 |
| Python 时代归档 | 将 59 张图片及索引移入 `archive/python-era/`：外观 2 张、状态栏 2 张、查找 16 张、语言 9 张、TUI 重建 30 张；21 张原始物理截图保留在 `tui/`。同步更新 `APPEARANCE`、`development/native`、`v1.13.0` 及 TypeScript 图库中的直接链接。 |
| 校验工具 | 扩展 `tools/checks/impact-assets.ts`，校验顶层 `captures`、`images`、`frames`、`records` 数组、`file`／`name` 解析、`png_sha256`／`sha256`、尺寸和字节数；增加针对性测试。 |

## 来源身份

- 任务前基线：`67924b19`。
- PR1 内容修正：合并提交 `9d615fdd2f81937f6af6504f0a42dc0cf9f7c54d`（PR #242）。
- PR2 索引重构：合并提交 `f3d1437a1b96b84869a87466a0454e95b707d2ae`（PR #243）。
- 本记录前的 PR3 实现 head：`2beb494b`；最终 head、PR 号、CI 结果及合并／Gitee 身份记录在 PR 描述和评论中。

移动保留可审查的重命名：59 张 PNG 均为 100% 相似；21 张原始 PNG 保留在 `tui/`；既有归档 51 张加 Python 时代 59 张，共 110 张归档图片。文档中的 SHA-256 多重集在移动前后均为 1,590 条。

## 验证与限制

- 每轮均通过 `npm run docs:check` 和 `git diff --check`；图片引用审计报告 293/293 张图片被引用、0 孤儿、0 断链。
- PR1 影响路线为 `maintenance`，Linux 执行 `actions`、`assets`、`docs`；PR2 为 `maintenance`，Linux 执行 `actions`、`docs`；PR3 修改 README 链接、媒体路径及 `tools/checks`，其最终 head 的影响计划与定向回执记录在 PR 中，包括注册开发指南变更选中的 Windows／macOS `checks` 任务。
- 新增资产测试 4/4 通过，既有 impact-plan 测试 21/21 通过。
- 不重拍、不重新编码任何图片；历史字节、文件名和哈希保持不变。不声称新增真人、物理平台、付费模型或安装验收。
- GitHub issue [#241](https://github.com/fbincon/claude-code-statusline/issues/241) 记录当前 Native 标题与 Retry／Close 重叠；归档记录历史 discovery 描述截断，但因当前 TypeScript 已加入省略号，不提交产品 issue。
