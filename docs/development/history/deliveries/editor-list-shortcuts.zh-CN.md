# 组件列表快捷键

[English](editor-list-shortcuts.md) | **简体中文**

本次 2026-11-27 交付统一外部终端和会话内编辑器的组件列表操作。本次在正式发布前合入源码，未创建产品版本、标签、Release 或 npm 发布。[PR #303](https://github.com/fbincon/claude-code-statusline/pull/303)

## 变更

| 范围 | 结果 |
| --- | --- |
| 组件列表 | Main 和 Subagents 上的 Enter 和 Space 均切换选中实例。外部编辑器用当前保存键提交草稿并退出。 |
| 页脚 | 导航和选择优先于次要操作。紧凑页脚保留主要按键，终端状态行可补充页脚放不下的筛选操作。 |
| 快捷键面板 | 常用编辑器和列表动作在各自分组中优先列出。保存详情标明原有终端设置行的额外 Enter 键。 |

## 源码身份

- 基线 `03901f353f2c0f8c2d626eb9a7fd896d701d7862`。
- 实现提交 `0135013ce1a96ebf1eb90b72bc536e8f333b6886`。容量夹具修复提交为 `d1bbb239f4bfcb06a590839f39755977c2c42314`。[PR](https://github.com/fbincon/claude-code-statusline/pull/303) 记录最终审阅的 head 和跨平台诊断。
- 工程候选包 `0.0.0-ts05.gd1bbb239f4bf` 的 SHA-256 为 `98ef9c837a1f3e8982d2388330fa3045424e2ed067cf996ca38b58cc101e555f`。
- 源码归档 SHA-256 为 `436bc1418e411f274cd6dbfb7a72bf30b309632cc563f6a2bb49dbf3e176a005`。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 本地编辑器检查 | 65 项外部编辑器测试和 14 项核心快捷键测试通过。最小尺寸布局断言覆盖全部 12 种注册语言。 |
| Native 宿主 | Claude Code 2.1.332 的 46 个文件共 363 项官方测试通过。使用 2.1.330 和 2.1.332 各自的精确声明进行类型检查均通过。2.1.332 常规校验通过并有警告，严格校验报告基线已有的 TS5097 和 TS2307。 |
| 生成与文档 | 48 项语言条目经验证并完成验收。生成校验及 37 项依照源码的文档内容和示例测试通过。 |
| 本地工程候选包 | 两次独立构建逐字节一致。产物校验覆盖 1,122 个文件和四个打包目标。 |
| Linux 安装态 PTY | Claude Code 2.1.332 的快捷键流程通过 83 步，四条组件目录流程均通过。Enter 产生一次撤销历史，显式保存前没有 apply 请求。保存恰好写入一次，重开可读到已提交的状态。模型调用为零。 |
| Native 容量夹具 | 首次固定宿主诊断发现序列化的快捷键状态覆盖了实际控制器。修复后，313 个夹具完成生产绘制与预算核对。首次失败保留在[原诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/45995746808)。 |
| Linux 影响路由 | 不可变源码比对判定为产品改动。合并后的 Linux 专项任务估算 408 分钟，超出托管的 360 分钟上限。完整本地产品检查和[平台诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/45997836363)分别记录。 |

PTY 和托管测试验证自动化的编辑器、安装和输入行为。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 中已接受的六项实机缺口仍待验证。
