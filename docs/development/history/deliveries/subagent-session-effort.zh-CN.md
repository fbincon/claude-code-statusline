# 子代理会话强度

[English](subagent-session-effort.md) | **简体中文**

本次 2026-11-19 功能交付在 [PR #277](https://github.com/fbincon/claude-code-statusline/pull/277) 的基础上，为两个子代理强度组件默认开启会话回退。交付限于代码和文档，未新增版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 实例配置 | 子代理 `model-with-effort` 和 `effort` 缺省 `effort_fallback` 时使用 `session`。CLI 和两个编辑器均可按实例保存 `off`。字段缺省的旧实例也采用新默认。 |
| 渲染与诊断 | 显式强度优先。字段缺失时可使用 15 秒内同会话且原始模型 ID 完全一致的主栏观测，用 `~` 标记。诊断按任务和实例报告来源。两个编辑器的预览用固定任务匹配示例会话模型。 |

## 源码身份

- 任务开始前的基线为 `dc939ef08e247e0574a75c678a3ea9ba2037c09d`。
- 实现提交为 `c90a15c37b768de42263b21d69ece2c26b8a6af5`。最终审阅的 head 在 PR 中记录。
- 工程候选包 SHA-256 为 `8f8dc8de31750ce6fa38c85e4ac0f00d7b3d504c2857fbb6836138e148c9fdb7`。
- Linux x64 使用 Node 24.21.0 和 Claude Code 2.1.322。Claude 二进制 SHA-256 为 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 本地仓库检查 | `npm run check` 通过 1,815 项测试，6 项因平台跳过，161 个冻结用例全部重放通过。119 项生成资源一致。语言覆盖检查和 35 项源码支持的文档与示例测试通过。 |
| 候选包构建与 Linux 安装 | 两次独立构建字节一致。候选包核验检查了 1,102 个文件。离线安装、`doctor`、渲染、配置读写和卸载冒烟均通过。 |
| 已安装 Claude Code 的回调 | 四次 PTY 会话验证了默认显示 `sonnet-4-6/~high` 和 `~high`、设为 `off` 时仅关闭指定实例的回退，以及恢复 `session` 后重新显示两项。显式配置的代理在四次会话中始终显示 `sonnet-4-6/low` 和 `low`。 |
| 编辑器 | 已安装的外部 TUI 为两个组件分别保存并重开两种选项。源码目录相同的 Native Mod 通过 45 个文件中的 356 项官方测试、严格插件校验和实际宿主生成声明的类型检查。 |
| 配置与费用 | 16 次模型请求全部由本地回环响应，费用为 0 美元。四次运行均核对八个真实路径的指纹或缺失状态，并移除隔离安装目录。 |

本次交付使用 Linux 检查和 PTY 证据。[issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口仍未验证。
