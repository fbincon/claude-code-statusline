# 子代理状态栏修复

[English](subagent-statusline.md) | **简体中文**

本次 2026-11-19 的功能交付更新子代理名称、计时组件组合和推理强度显示。本次不创建产品版本、标签或 Release，也不发布 npm。

## 变更

| 领域 | 结果 |
| --- | --- |
| 名称 | 依次使用显式名称、格式化后的 `agentType`、格式化后的任务类型、本地化的代理名称。用最终名称去除重复任务标题。[#221](https://github.com/fbincon/claude-code-statusline/issues/221) |
| 组合 | CLI 和两个编辑器均可独立启用及排序 `status-elapsed`、`status` 与 `elapsed`。继续适用共用的分组、spacer 和宽度规则。[#222](https://github.com/fbincon/claude-code-statusline/issues/222) |
| 推理强度 | 子代理的每个 `model-with-effort` 实例可以开启会话回退。显式任务强度优先，回退值须来自同一会话、相同原始模型 ID 的近期观测，并用 `~` 标记。诊断逐实例和任务报告来源，预览使用固定样本。[#237](https://github.com/fbincon/claude-code-statusline/issues/237) |

## 源码身份

- 任务开始前的基线为 `51d1e019ddb11d77f510d212c5a3ccc9f79561a6`。
- 实现和安装验收候选包使用 `61266d9d0b8198e01aeabd78d075cd07b9184682`。两次干净构建得到相同的包 SHA-256 `49c8301de695299d9421fe093e0b68e05a28f525acb8d9b7060c22677cdff076`。候选校验核对了 1,102 个文件及对应源码。
- Linux 上的宿主为 Claude Code 2.1.322，二进制 SHA-256 为 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`。
- [PR #277](https://github.com/fbincon/claude-code-statusline/pull/277) 记录最终 head 及专项检查。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| CLI、渲染和诊断 | 专项测试覆盖旧宿主和异常字段、CLI 配置往返、重复实例、缓存过期与失效、模型及会话匹配、窄屏、只读诊断和预览以及 NDJSON。生成资源检查和十二种语言的完整验收覆盖均通过。 |
| Linux PTY 中的已安装候选包 | Claude Code 2.1.322 调用了两种状态栏回调。两个并行的未命名代理显示 `Inherited Probe` 和 `Configured Probe`，保留各自的任务标题并同时显示三个计时组件。主会话报告 `high`，同模型且未声明强度的代理显示 `sonnet-4-6/~high`，另一代理显示显式的 `sonnet-4-6/low`。 |
| 编辑器保存后重开 | 已安装的外部 TUI 与 Native 宿主测试均保存并重新打开三个计时组件和回退选项。Native 测试在 2.1.322 上通过 356 项。Native 类型校验和严格插件校验通过。 |
| 冻结回放 | 161 个冻结用例全部通过，沿用原有的三处文案例外。目录比较仅接受本次约定的子代理字段变更，并保留原目录读取能力。历史用例标识及 Python 归档均获保留。 |
| 隔离和费用 | 已安装候选包使用隔离配置，四次请求均由本地回环模拟后端响应，实际费用为 0 美元。核对了八个真实 Claude 与状态栏路径的原有指纹或缺失状态，并清除了测试安装目录。 |

PTY 和 Native 测试提供 Linux 宿主的自动化证据。本次未运行完整产品矩阵，[issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口仍未验证。Claude Code 从 [2.1.323](https://github.com/anthropics/claude-code/releases/tag/v2.1.323) 起移除了 `subagentStatusLine`。宿主能力检测另行处理。
