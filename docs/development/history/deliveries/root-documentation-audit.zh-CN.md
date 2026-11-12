# 根目录文档准确性与编排

[English](root-documentation-audit.md) | **简体中文**

本记录对应 2026-11-12 对十三篇根目录专题指南、文档索引和用户指南的维护。此次维护修正了与 3.16.3 实现不一致的表述，同步了两种语言，并把重复的预设细节移交给对应专题页。产品命令、编辑器行为、协议、存储和发布身份保持原有契约。

## 内容与归属

- `DISPLAY_ITEMS` 不再承诺全局终端文本净化，可用性规则改为遵循各数值项自己的校验。主栏 `context-remaining` 记录当前有限数值行为；产品侧范围决策由 issue [#231](https://github.com/fbincon/claude-code-statusline/issues/231) 跟踪。渲染硬化由私有安全公告跟踪。
- `COMPOSITION` 的复制示例改用受支持的实例选项，说明数值格式仅适用于支持的组件，并澄清自动与显式分组行及组内复制的插入位置。
- `SCHEMES` 不再声称应用预设会保留已禁用的子代理行；它保留采集偏好和子代理启用开关，然后重建行内容。六种原有预设的汇总表现由本页维护。
- `EDITORS` 区分终端编辑器与 Client 的撤销键，澄清只有 slash 命令接受 `help` 参数，并记录 Claude 偏好待 Apply 的例外。
- `PROFILES`、`EXTENSIONS`、`SETUP`、`SHOWCASE`、`DIAGNOSTICS`、`PACKAGE_MANAGEMENT`、`TASK_DETAILS`、`APPEARANCE` 和 `DRAFT_HISTORY` 按审查结果修正了事实、前置条件、版本基线和排障说明。
- 文档索引增加用户指南整页入口，区分引导式首次设置与手动安装，并把草稿历史归入显示编排。`USER_GUIDE` 保留受测试约束的锚点和安装组合表，同时链接预设汇总、编辑器键位和完整指标目录。
- `PROFILES` 与 `SCHEMES` 使用不同标题，并保留旧标题锚点。主要专题页按需增加目录或相关指南。
- 中文版本在同一次变更中同步。删除了重复的 `diagnose` 命令块，正文术语统一为“子代理”，界面标签沿用既有中文表述；旧锚点仍可用。

历史 v3.7.0 → v3.8.0 包示例和 v3.16.0 SHOWCASE 录制基线继续保留，并补充了明确的适用范围说明；它们不是当前版本建议。

## 来源与核验

基线为 `80f541e6`；实现提交为 `a98d3e23`，位于 `docs/root-documentation-audit`。后续记录／索引提交不包含产品代码。

| 实现阶段检查 | 实际结果 |
| --- | --- |
| Node 24.21.0 / npm 11.19.0 构建 | 通过 |
| 本机文档链接与空白检查 | 5,962 个链接，无错误；`git diff --check` 通过 |
| 文档内容、示例与锚点测试 | 31/31 通过 |
| 双语结构 | 13 对专题页的标题层级序列全部一致 |
| 不可变影响计划 | 维护路线；Linux：actions/checks/docs；Windows 与 macOS：checks；无未知路径或包比较 |
| 本机 Linux 定向回执 | `a98d3e23` 的 actions/checks/docs 通过 |

源内容测试读取实际 Markdown 中带标记的 `docs-example` 代码块，并在临时目录执行选定 CLI 流程；预设／导入 dry-run、锚点位置和双语目标继续受覆盖。这是文档与源码核对，不是交互式编辑器验收。

最终 head 的定向回执、必需的 **Complete candidate evidence**、合并身份和 main 晋升由交付 PR 单独记录。GitHub 为主仓；仅在检查分歧后把已验证 main 同步到 Gitee，并核验远端 SHA。

## 限制

未执行已安装产品、实体编辑器／焦点、真实 GitHub 来源或付费模型验收。既有 issue #96 缺口仍未验证。本次维护不引入产品版本、标签、Release、npm 发布、截图或 Python 归档变更。私有安全公告和 issue #231 跟踪产品侧后续事项；本记录不修改产品代码或测试。
