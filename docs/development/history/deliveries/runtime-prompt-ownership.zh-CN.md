# 实时提示词归属与状态交付

[English](runtime-prompt-ownership.md) | **简体中文**

本次 2026-11-27 功能交付修复主状态栏的任务计时与实时提示词归属。同一条用户消息在 transcript 和原生事件中共享任务身份，原生快照滞后时状态栏可恢复显示当前阶段。本次不创建产品版本、标签、Release 或 npm 发布。[Issue #297](https://github.com/fbincon/claude-code-statusline/issues/297) · [Issue #299](https://github.com/fbincon/claude-code-statusline/issues/299)

## 变更

| 范围 | 结果 |
| --- | --- |
| 任务身份 | 使用同条真实用户 transcript 记录的 `promptId` 和消息 `uuid` 恢复一个任务。旧缓存补扫保留已确认的时长。缺少用于修复的 transcript 时，计时器可通过只读回退显示更新且独立核验过的当前任务。 |
| 当前状态 | 状态栏先扫描生命周期证据，再选择实时快照，仅配置 State 和 Tool 时也适用。原生数据滞后时可显示当前任务已核验的阶段。工具项显示归属明确的最近工具，空闲时保留已归属的终态历史。 |
| Runtime Mod | 提示词、turn 和工具事件唤起有界写入队列。确认后串行处理余下批次，失败后保留原身份供重试。切换会话时隔离迟到的写入结果。 |
| 文档 | 中英文显示项、计时与实时观测指南同步说明证据和空闲显示规则。 |

## 源码身份

- 基线 `f134398fd43898dff9f50a039b49f5c386b36fa0`，已安装产品为 3.16.5。
- 实现及工程候选包源码 `a17e7e304c9a99bfd5c08fa3702aded7225bf967`。
- 候选包 `0.0.0-ts05.ga17e7e304c9a` 的 SHA-256 为 `e8a61bff938122494810bda1b37b3cf1c649425b4fe7345b6984e8741fce7ecd`。
- 源码归档 SHA-256 为 `1c8dea10f99d465561b0ae76b590fcd75d5aa71bc80b67bda642ed6a9c24d289`。
- PR 记录最终审阅的 head 及其文档检查结果。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run check` | 实现提交上有 1,860 项测试通过、6 项跳过。Actions、生成资源、归档完整性和职责清单检查通过。 |
| 运行时回归及冻结对照 | 旧 156 ms 记录的两种 ID 与缺省 ID、明确别名修复、当前任务回退、排队及未归属的 turn、仅实时项渲染和任务写入失败重试均通过。运行时动作序列与冻结对照一致。 |
| 文档 | `docs:check`、空白检查及全部 37 项源码内容与示例测试通过。 |
| 候选构建与安装 | 两次独立构建得到字节一致的包。`candidate:verify` 通过，已验证的包安装到临时 npm 前缀。Claude Code 2.1.310 和 2.1.330 上的官方宿主安装冒烟均通过。 |
| 宿主验证 | Linux 上 2.1.289、2.1.294、2.1.296 和 2.1.310 的影响检查均通过，每个宿主通过 20 项 Runtime Mod 测试。2.1.296 的精确声明仍不可用。2.1.330 的普通验证、20 项官方 Runtime Mod 测试及宿主生成的精确声明类型检查通过。严格验证在 3.16.5 和候选上均报告相同的既有 TypeScript 扩展名警告。 |
| Claude Code 2.1.330 终端对比 | 两次隔离终端运行各使用四次本地可控响应，宿主均跳过 Mod 的 classic 和 telemetry hook。基线在两轮运行中已有原生工具记录，State 和 Tool 均显示不可用。候选首轮显示 `State main` 和 `Bash started`。第二轮开始显示 `Tool —`，随后显示 `Read success`。退出并执行 `--resume` 后，记录的两次空闲帧均显示 `✓ 0m 06s`、`State completed` 和 `Tool Read success`。 |
| 付费 Claude Code 验证与配置 | 一次隔离的 Haiku 请求通过。CLI 估算费用为 0.014045 美元，无剩余预留。配置后的状态栏显示 `✓ 0m 02s` 和 `State completed`。验证结束后，原 `settings.json`、显示配置和运行时配置的文件摘要及权限均与开始时一致。 |

运行环境为 Linux x64 和 Node 24.21.0。#299 的分钟级写入滞后和 #297 的短时重复记录通过确定性回放验证。本机终端会话确认了 hook 被跳过的条件及这些回合的界面结果。原现场的长时间滞后、物理桌面和电源状态未通过本次终端验证。已接受的六项缺口保持待验证。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
