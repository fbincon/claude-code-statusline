# 主状态栏语义分隔符

[English](semantic-group-separators.md) | **简体中文**

本次 2026-11-20 功能交付恢复主状态栏的语义分隔符。此次仅交付源码与文档，不创建版本或标签，不发布 Release 或 npm 包。[Issue #210](https://github.com/fbincon/claude-code-statusline/issues/210)

## 变更

| 范围 | 结果 |
| --- | --- |
| Classic 与 Compact 行 | 可见、相邻且同组的独立项用 `·` 连接。显式组成员之间用空格，组与邻项之间使用所选样式的顶层分隔符。 |
| 指标与宽度拟合 | 数值、条形和自适应指标使用相同的上下文或配额组。省略条目后重新计算相邻关系，弹性留白两侧分别处理。 |
| 对齐行 | 列对齐时使用相同的语义分隔规则，并保留列位置、填充和隐藏条目占位。窄屏折叠对齐时使用普通行的拟合逻辑。 |
| Powerline | 独立项各用一个色块。显式组可以共享以主指标为背景的色块。 |

## 源码身份

- 任务基线为 `93e4916772178fcf7fcb693da10aca72b570d595`。
- 实现和工程候选包源码为 `636ba1f73b75cb805baa80bd6806becb65643178`。最终审阅 head 记录在 PR 中。
- 工程候选包的 SHA-256 为 `66bd73d34ebfe50e789aa125ff4765fb638e4de4a94a661eb8053a0e4f1a0f1a`。
- 验证环境为 Linux x64、Node 24.21.0、npm 11.19.0 和 Claude Code 2.1.322。Claude 二进制的 SHA-256 为 `bfb3703ad5380242328459bc62ada4bde8ae7ba57c6e1eeadb9c00e08874c478`。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 渲染回归 | 6 项新用例在基线复现失败，修复后通过。94 项专项测试覆盖分组渲染、指标、对齐、Powerline、渐变和解释输出。 |
| `npm run check` | 1,831 项通过，6 项按平台跳过。包含双语渲染示例、生成资源核验和冻结参考用例。 |
| `npm run docs:check` 与 `git diff --check` | 双语文档、链接和空白检查通过。 |
| `npm run ci:plan` | 归入产品改动，无未知路径或附加产品检查。 |
| 候选包构建与核验 | 两次独立构建的字节一致。包校验覆盖 1,102 个文件，安装冒烟使用同一份包。 |
| 已安装 CLI 与 Claude Code PTY | 四组固定输入检查在有无显式组的宽屏和窄屏下均匹配 CLI 渲染与预览。真实宿主在 122 列显示 `Project issue-210-fixture · issue-210-fixture \| HOST v2.1.322`，在 52 列省略显式组后仍以 `·` 连接位置项。 |
| Claude Code 2.1.322 的 Native Mod | 严格校验、用该宿主生成的声明进行的类型检查，以及 45 个文件中的 357 项官方测试均通过。 |
| Claude Code 2.1.322 的 Native 容量 | 刷新后的预览样例通过了七个官方测试文件中的全部 313 项容量用例。 |
| 隔离与费用 | 临时安装已移除。检查的 11 个 Claude 与 statusline 路径均与原有指纹或缺失状态一致。付费模型调用为零。 |

本次执行覆盖 Linux 本地检查及 Claude Code 2.1.322 的 PTY 操作。六项既有验证缺口仍未验证。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
