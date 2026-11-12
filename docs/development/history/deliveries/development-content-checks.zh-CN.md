# 开发文档内容检查与登记

[English](development-content-checks.md) | **简体中文**

本次 2026-11-13 维护把当前 `docs/development` 指南登记进源驱动文档测试，并新增与生产定义比对的事实规则。产品行为、接口、存储格式和命令输出均未改变。

## 登记与规则

| 领域 | 结果 |
| --- | --- |
| 登记页面 | 29 个当前开发指南 × 英中双语（58 个精确路径）。历史记录和旧路径兼容存根不登记。 |
| 通用规则 | 当前页禁止冻结历史横幅、历史交付口吻、已知过期接口版本、未知 `npm run` 脚本，以及同名交付记录存在时缺少链接。 |
| 接口版本 | 正文中的显示 schema、编辑器协议和运行协议数字必须等于 core 常量；兼容范围和协议历史表除外。 |
| 验收矩阵 | `testing` 与 `node-regional-languages` 对照 8 安装／32 Node 用例／16 宿主注册表；`testing` 另检查 27 类安装检查。 |
| 目录与操作 | `contracts` 对照当前 41 项操作及 67／17 目录类型数量。 |
| 语言 | `i18n` 与 `node-regional-languages` 必须列出注册表全部选择器；`i18n-workflow` 必须保留 144 组语言组合。 |
| 运行时与 Native | `live` 对照 turn／tool／task／request 上限；`native` 必须保留当前 External TUI 章节与 `A/D/X` 控制顺序。 |
| CI 与工具 | `ci-maintenance` 对照 40 项逻辑义务、16 个固定宿主及 8／8 历史拆分；`architecture` 必须列出全部 `tools/` 目录；`README` 必须保留规范技能路径。 |
| 技能与来源默认值 | `skill-workflows` 必须匹配规范技能模板的动作清单；`source-command-package-management` 必须保留自动间隔与租约默认值。 |

## 来源与验证

基线为 `a624ed35`；实现提交为 `abb0cb17`。

| 检查 | 实际结果 |
| --- | --- |
| 构建 | 通过 |
| `docs-content.test.js` | 5/5 通过 |
| `docs-examples.test.js`、`impact-plan.test.js`、`ci-scope.test.js` | 54/54 通过 |
| `npm run check` | 通过：585/591 项测试，6 项平台跳过，0 失败；118 项生成资源 |
| `npm run docs:check` | 6,868 个本地链接，0 错误 |
| `git diff --check` | 通过 |
| 不可变影响计划 | 由交付 PR 记录 |
| 本机 Linux scoped receipt | 由交付 PR 记录 |

负向测试会改变每个登记事实，并注入历史横幅、历史口吻、过期接口版本和未知 npm 脚本；每种变更都必须让对应页面失败。CRLF 覆盖沿用既有全页面测试。

## 边界

这是文档检查工具，不是已安装产品、物理编辑器、终端、实时服务或付费模型验收。本次不修改新登记的当前页；指南措辞更新可另行提交。既有六项 issue #96 缺口仍未验证。

最终 head 的 **Complete candidate evidence**、合并身份和 main 晋级由交付 PR 记录。GitHub 仍是主仓库；验证后的 main 在检查分叉后同步到 Gitee，并核对远端 SHA。
