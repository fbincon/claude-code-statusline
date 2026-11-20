# 权限快照与主状态栏样式

[English](permission-mode-and-render-styles.md) | **简体中文**

本次 2026-11-21 维护交付恢复权限快照和主状态栏样式。交付范围为源码和文档，工程候选包用于本地验证。 [Issue #209](https://github.com/fbincon/claude-code-statusline/issues/209) · [Issue #216](https://github.com/fbincon/claude-code-statusline/issues/216)

## 变更

| 领域 | 结果 |
| --- | --- |
| 权限模式 | 启用实时指标且原生心跳有效时，已安装的 `UserPromptSubmit` 设置 hook 可记录主会话观测到的模式。记录使用现有会话锁，15 秒后过期。同一时间或更早的快照不能覆盖现有快照，已验证的实时值优先。 |
| 来源与指标样式 | 外部来源和 GitHub 项获得调色板前景色与加粗。自适应进度条及数字回退沿用普通进度条的样式与阈值颜色。主栏标签和图标跟随组件样式，复合值保留各段样式。 |

## 源码身份

- 基线为 `326a7cb7aeed1fac524269f1dcf593498e6f3b75`，实现和工程候选包源码为 `25266c0da7ed3b928a16c3cdf1cb4f651a3e2c25`。PR 记录最终审阅提交。
- 工程包 SHA-256 为 `e9155e4e2bbe4950866ca79c2b183703b7baaa169fb375bd617ce4432cd8879e`。
- Linux x64 验证使用 Node 24.21.0 与 npm 11.19.0。Claude Code 2.1.319 二进制 SHA-256 为 `dabafec82ca1319fa43d8be36a10fc61b1d11821cb98ad5df04ad95e199b8eed`。2.1.322 二进制 SHA-256 为 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 本地产品检查 | 六项回归在基线上复现缺陷，修复后均通过。`npm run check` 通过 1,837 项测试，另有六项按平台跳过。核对 119 项生成资源，37 项源码绑定文档与示例测试通过。 |
| 影响范围与候选包 | `ci:plan` 判定为 product 路线，涵盖 CLI、文档、生成资源、Native 与仓库检查。两次独立构建产出的包字节一致，`candidate:verify` 核验全部 1,102 个文件。 |
| 安装后的 Claude Code 2.1.319 和 2.1.322 | 两次 PTY 会话均记录 `cc-plugin-sec-default` 跳过 Mod 的 `classic.UserPromptSubmit`。设置 hook 使状态栏显示 `Mode plan*`，到期后恢复 `Mode —`，原生心跳仍有效。安装后的命令使用固定输入确认完整自适应进度条与数字回退均显示危险红色并加粗。宿主中的本地 JSON 来源值显示为加粗渐变。 |
| 安装后的编辑器预览 | 七次生产预览调用覆盖 40、80、120 列的警告和危险场景及数字回退，并核对来源项加粗和 GitHub 链接。 |
| Runtime Mod | 两个已测试宿主版本均通过严格插件验证、精确宿主类型检查及八个文件的 18 项官方测试。 |
| Native Mod | Claude Code 2.1.322 通过严格插件验证、精确宿主类型检查及 45 个文件的 357 项官方测试。 |
| Native 预览容量 | Claude Code 2.1.322 通过七个官方测试文件的全部 313 项用例，覆盖重新生成的预览数据。 |
| 配置与费用 | 两次模型请求均使用本地回环响应，费用为 0 美元。清理后核对 11 个配置及可执行文件路径，指纹或缺失状态与原先一致。 |

证据限于 Linux x64 和 PTY 会话。六项既有平台验证缺口仍未验证。 [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
