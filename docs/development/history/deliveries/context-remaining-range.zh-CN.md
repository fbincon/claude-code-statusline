# context-remaining 范围校验

[English](context-remaining-range.md) | **简体中文**

本次 2026-11-21 功能交付省略无效的 `context-remaining` 百分比，并与现有 `context-used` 的可用性规则保持一致。交付范围仅限源码和文档；不创建版本、标签、Release 或 npm 发布。[Issue #231](https://github.com/fbincon/claude-code-statusline/issues/231)

## 变更

| 领域 | 结果 |
| --- | --- |
| 上下文条目 | `context-remaining` 现在省略缺失、bool、非数字、非有限数、负数和超过 100 的值，不再渲染这些值；数字字符串和 bool 不再被强制转换为百分比。 |
| 回归覆盖 | 取整和无效值用例与 `context-used` 对齐；原先可能到达 `roundedInteger` 的 `Infinity` 路径已关闭。 |
| 文档 | `DISPLAY_ITEMS` 在英文和中文中记录闭区间 `0–100` 可用性规则。 |

## 源码身份

- 任务前基线：`db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`。
- 实现提交和最终 head 由 CI 后的 PR 描述记录。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `node --test packages/cli/dist/test/render-items.test.js` | 41 项测试通过，包括新增的 `context-remaining` 取整和无效值用例。 |
| CLI 复现 | `-5`、`150` 和 `true` 不渲染上下文条目；`42` 渲染 `Context 42% left`。 |
| `npm run check` | 通过；597 项测试，六项平台相关跳过，生成资源已验证，文档链接和锚点无错误。 |
| `npm run docs:check` | 检查 7,436 个链接，零错误。 |
| `git diff --check` | 无错误。 |

行为在 Linux x64 和 Node 24.21.0 上验证。既有 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项平台缺口仍未验证。未进行付费模型调用。
