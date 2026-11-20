# 香港术语归一化

[English](zh-hk-terminology.md) | **简体中文**

本次 2026-11-21 功能交付将 `zh-HK` 归一化到已记录的香港用词，并为变更消息记录新的结构化验收。交付范围仅限源码和文档；不创建版本、标签、Release 或 npm 发布。[Issue #234](https://github.com/fbincon/claude-code-statusline/issues/234)

## 变更

| 领域 | 结果 |
| --- | --- |
| 术语 | 全部 68 个受影响键遵循已记录的香港用词。数据来源使用 `數據來源`，元数据使用 `元數據`，身份数据使用 `識別資訊`，消费者使用 `使用方`。JSON 标题和检查列表截断提示使用 `詳情`。 |
| 验收 | 68 条变更翻译已完成结构化校验、上下文审阅和验收；`zh-HK` 保持 2,345/2,345 已验收，无英文回退。 |
| 重新生成 | 规范资源包、生成的 Node/Native 字典及验收／历史／来源证据一并重新生成；`zh-TW` 和基线快照未变。 |
| 回归覆盖 | 生成测试拒绝 `zh-HK` 中的四个台湾变体，并断言 `zh-TW` 保持自身用词；CLI 地区语言测试覆盖代表性消息。 |
| 文档 | 翻译指南记录一致的香港规范、标准替代词和既有的母语审阅限制。 |
| 专项检查 | 超出预算的维护任务在检查族之间拆分。每个任务沿用原定的平台和宿主，早期源码保留原有任务清单。 |

## 源码身份

- 下方初版检查在 head `6f7b7ec06216c087c05a709a1845fbb2054dfe56` 上运行，基线为 `db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`。
- 完成合并前的更新纳入 `main` 提交 `cf6d115ab07d0e362805e5446368e3cd28ee43dc`。最终 head、包比较身份和专项检查结果记录在 [PR #285](https://github.com/fbincon/claude-code-statusline/pull/285)。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `node --test dist/typescript/tools/generation/test/i18n-terminology.test.js packages/cli/dist/test/regional-language.test.js` | 六项专项回归测试通过。 |
| `npm run generate` / `generate:check` | 119 个资源已重新生成并校验；未出现容量夹具变化。 |
| `npm run languages:coverage` | `zh-HK` 2,345/2,345 原始、当前和已验收，零回退；开发和发布就绪均为真。 |
| `npm run languages -- release-check --format text` | 十二种语言完整；开发和公开发布就绪。 |
| `npm run check` | 通过；597 项产品测试，591 项通过，六项平台相关跳过；1,248 项工具测试；文档链接和锚点无错误。 |
| `claude plugin test mods/statusline-native` | 45 个文件中的 357 项测试通过，包括已注册的语言循环。 |
| 外部语言测试 | 34 项测试通过，包括全部 144 个界面／状态栏语言组合和实际渲染。 |
| `npm run docs:check` / 已注册内容测试 | 7,436 个链接零错误；37 项内容和示例测试通过。 |
| 初版 `npm run ci:plan -- --compare` | 包比较显示等价。原 Linux 任务预算为 377 分钟，调度拒绝了该任务。 |
| `git diff --check` | 无错误。 |

完成合并前的更新显式校验并验收两处译文，核对了 119 个生成资源。规划器、历史证据、双语文档和区域语言测试在最终提交前共通过 69 项。

验收记录仅为结构化和上下文审阅，不代表母语审阅。自动化编辑器测试覆盖两个编辑器，但未进行真人视觉或实体桌面采样。`zh-TW` 术语未改变。既有 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项平台缺口仍未验证，未进行付费模型调用。
