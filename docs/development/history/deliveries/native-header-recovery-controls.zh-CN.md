# 原生标题与恢复控件间距

[English](native-header-recovery-controls.md) | **简体中文**

本次 2026-11-21 功能交付使原生编辑器标题栏避开宿主 Retry/Close 控件。交付范围仅限源码和文档；不创建版本、标签、Release 或 npm 发布。[Issue #241](https://github.com/fbincon/claude-code-statusline/issues/241)

## 变更

| 领域 | 结果 |
| --- | --- |
| 标题预算 | `ui/layout.ts` 统一持有 20 列恢复控件宽度和 `headerColumns` 预算；宿主控件盒与 Client 标题栏使用同一值。 |
| 标题绘制 | Client 首个标题行按 `headerColumns` 裁剪，长目标标签在控件前省略，不再绘制到控件下方。 |
| 回归覆盖 | 在 32、72、73 和 120 列检查长标题；全语言视口测试在窄宽度下改为期望裁剪后的标题。 |
| 文档 | 原生及编辑器指南在英文和中文中记录预留的控件区域。 |

## 源码身份

- 任务前基线：`db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`。
- 实现提交和最终 head 由 CI 后的 PR 描述记录。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `claude plugin test mods/statusline-native` | 45 个文件中的 359 项测试全部通过。 |
| `npm run test:native-capacity -- --output dist/validation/native-capacity/header-fix` | 七个文件中的 313 个用例通过；使用实际宿主，零模型调用。 |
| `npm run check` | 通过；597 项测试，591 项通过，六项平台相关跳过。 |
| `npm run docs:check` | 检查 7,436 个链接，零错误。 |
| 已注册的文档内容和示例测试 | 37 项通过。 |
| `git diff --check` | 无错误。 |

证据为宿主测试引擎、绘制层和 PTY 容量证据，不是实体桌面截图。历史 native-capacity 与 draft-history 图库保留原有 #241 说明，因为它们描述记录的 v3.9.1/v3.13.0 版本。既有 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项平台缺口仍未验证。未进行付费模型调用。
