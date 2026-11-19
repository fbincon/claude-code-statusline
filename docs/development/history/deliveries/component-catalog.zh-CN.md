# 组件目录状态与连续添加

[English](component-catalog.md) | **简体中文**

本次 2026-11-19 功能交付修复外部 TUI 和原生编辑器的组件查找与启用操作，交付范围为 GitHub 与 Gitee 源码。版本、标签、Release 和 npm 发布由独立的发布流程处理。[Issue #212](https://github.com/fbincon/claude-code-statusline/issues/212) · [Issue #213](https://github.com/fbincon/claude-code-statusline/issues/213)

## 变更

| 领域 | 结果 |
| --- | --- |
| 目录状态 | 两个编辑器均按当前作用域的实例识别已启用、全部禁用和未配置类型。同类型的实例总数含禁用项。 |
| 草稿编辑 | Enter 和 Space 添加未配置类型，或启用首个禁用实例。连续新增按操作顺序插入，每次接受的编辑记入草稿历史。 |
| 导航 | 目录继承已配置列表的筛选，再独立维护筛选和选中项。Ctrl+G 返回已配置列表，在列表再次按 Ctrl+G 清除筛选。 |

## 源码身份

- 任务前基线为 `c638208acf33d2200476b9a602b525c7acc9ca39`。
- 本机验证的实现和候选包源提交为 `537a5f6a703bb498415c31367f51faf960e1c20e`。
- 工程包 `0.0.0-ts05.g537a5f6a703b` 的 SHA-256 为 `2c087f54e13043a5e4e32581b03e05dbd523bbb318e91081859612bb9261a6ba`。
- 源码归档的 SHA-256 为 `11604ba495e9f03abebc84c5920575cd1fb16ecfea3ab873cfd83d2342f3cb90`。
- PR 记录最终提交的 CI 与集成证据。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 资源生成和语言校验 | 118 个生成资源一致。12 种界面语言均覆盖目录变更，语言就绪报告显示英文回退为零。 |
| 文档内容与示例 | 34 项测试通过，链接和空白检查通过。 |
| 冻结兼容性回放 | 首次合并运行超时，隔离重跑完成全部 161 个用例。 |
| 原生宿主声明与定向官方测试 | Claude Code 2.1.322 生成了对应声明。类型检查通过，六个定向文件共 69 项测试通过。 |
| `candidate:build` 与 `candidate:verify` | 两轮独立构建产出逐字节相同的包，源码和包身份验证通过。 |
| `capture:native-capacity -- --component-picker` | Linux x64 下四条 PTY 流程通过。两个编辑器均覆盖 Main 和 Subagents、筛选恢复、连续新增和重新启用。保存后用两个作用域的 `config list-items` 回读，放弃流程保留文件内容和权限。 |

本机安装态验收使用 Claude Code 2.1.322、Node 24.21.0、临时安装和隔离配置。证据来自自动 PTY，模型调用为零。物理验收沿用 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 记录的六项既有缺口。
