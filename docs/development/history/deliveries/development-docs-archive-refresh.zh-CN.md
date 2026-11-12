# 开发文档归档与导航刷新

[English](development-docs-archive-refresh.md) | **简体中文**

本次 2026-11-13 维护把当前开发指引与冻结的交付记录分开：历史页面移入 `docs/development/history/`，兼容存根保留旧路径与锚点，当前页保留行为与契约。产品行为、接口、存储格式和命令输出均未改变。

## 归档边界

| 领域 | 结果 |
| --- | --- |
| 完整迁移 | `correctness-maintenance`、`draft-history-and-reuse`、`external-tui-parity`、`external-tui-regressions` 与 TypeScript 迁移计划移入 `history/deliveries/` 或 `history/migration/`；双语存根保留全部旧章节锚点。 |
| 混合页面 | 十二个“当前＋交付”页面拆为当前页与 `history/deliveries/` 历史记录。当前行为留在旧路径；被移动章节保留标题与锚点，并在当前页保留桥接锚点。 |
| 导航 | 开发索引与历史索引说明当前指南、冻结记录和兼容存根；被移动记录链接其当前所有者。 |
| 单一来源 | 测试文档负责验收矩阵，CLI 参考负责当前接口版本，两份语言指南分别负责写作与策略／生命周期。 |
| 外部 TUI | Native 指南新增当前 External TUI 章节，链接当前用户操作与两份历史迁移记录。 |
| 历史参考 | 验收与发布档案新增目录／版本门户；工作包覆盖边界、Python 重复章节及发布版本缺口在不重写证据的前提下修正。 |
| 参考细节 | 实时保留上限、Native 控制顺序、采集参数、媒体前置条件、协议历史、tools 树、CI 宿主标签、存根锚点、showcase 合并身份及术语得到修正。 |

## 来源与验证

基线为 `2a1ef056`。实现提交如下：

| 阶段 | 提交 |
| --- | --- |
| 迁移历史记录 | `ef4b0dd9` |
| 拆分当前指南 | `c741b1c0` |
| 集中导航与参考 | `28258242` |

交付提交加入本记录与历史索引项。

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 6,864 个本地链接，0 错误 |
| `git diff --check` | 通过 |
| 双语配对与标题层级 | 118 对，0 缺失对应文件，0 层级不匹配 |
| 相对基线的锚点保留 | 检查 2,458 个锚点，0 缺失 |
| 构建与文档测试 | `docs-content.test.js` 与 `docs-examples.test.js`：28/28 通过 |
| 交付 JSON 身份 | `external-tui-parity.delivery.json` 与 `node-regional-languages.delivery.json` 未变 |
| 不可变影响计划 | 由交付 PR 记录 |
| 本机 Linux scoped receipt | 由交付 PR 记录 |

内容测试读取实际 Markdown 中的标记代码块，并在临时目录执行选定 CLI 工作流。这是文档与源码检查，不是已安装产品、编辑器焦点、物理或付费模型验收。

## 边界

未执行已安装产品、物理编辑器、终端、实时服务或付费模型验收。既有六项 issue #96 缺口仍未验证。本次维护不包含产品版本、tag、Release、npm 发布、截图或 Python 归档变更。zh-HK 术语不一致仍由 issue #234 跟踪。把开发页面注册进源码驱动内容检查仍是独立后续工作。

最终 head 的 **Complete candidate evidence**、合并身份和 main 晋级由交付 PR 记录。GitHub 仍是主仓库；验证后的 main 在检查分叉后同步到 Gitee，并核对远端 SHA。
