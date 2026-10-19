# 配置体验：共享编辑、快速配置与说明

[English](configuration-experience.md) | **简体中文**

实现基于 `844ce521e5c6e3a43d7120e99a7724ef35ab899a`，交付 UX-01、UX-02 和 EXPLAIN-01。公开入口继续使用 `configure` 和 `/statusline-configure-native`。见[用户流程](../USER_GUIDE.zh-CN.md#quick-setup-and-explanation)及[协议](contracts.zh-CN.md#配置与示例解释协议)。

## 职责与行为

- `core/editor/text-input` 管理原始文本、字素边界、插入删除和可见光标窗口；TUI 与 Client 负责输入适配和绘制。含非法控制字符或超过字段上限的整段插入被拒绝。
- `core/config/presets` 提供有序用途元数据；`core/editor/quick-setup` 管理候选和状态转换，既有后端负责预设展开。两套编辑器共享菜单和可滚动要求说明。打开或退出流程不替换待保存草稿、不安装集成、不启用采集。
- `core/rendering/trace` 在既有主行、子代理、组件和 Powerline 渲染中记录决策，普通路径不构造记录；`core/rendering/explain` 将示例判断与明确配置事实组合。
- `cli/ui/explain` 无锁、只读地检查安装归属和采集偏好。宿主能力与真实字段观察分开，不可读来源保持未知。解释不读取转录、运行时存储，不查询 Git 或网络。
- `core/editor/explanation` 为两套界面格式化逐实例证据。原生响应保留 epoch、宽度和草稿身份校验；TUI 按草稿、范围、实例和宽度缓存。原生副作用留在 hooks，外部副作用留在 Session。

新共享模块生成到自包含的原生 Mod，不独立维护生成副本。测试按业务包归属组织，端到端 PTY 用例放在既有 acceptance 工具目录。

## 兼容性与限制

编辑器协议 **13** 新增 `explain` 和预设用途元数据。显示 schema **8**、运行协议 **2**、portable envelope **1** 和 UI preferences **1** 保持不变。保存继续执行版本、归属、备份和回滚检查；外部保存失败时保留终端和草稿。界面语言持久化与 Claude 偏好 Apply 继续独立。

原生 Client 的单键 API 不提供粘贴来源标记。可识别的多字符输入作为整段文本处理，输入队列溢出会提示；宿主已拆成单字符的粘贴无法可靠识别。原生 Escape 仍用于交还焦点。这些限制如实披露，不列为已经解决的改进。

示例结果区分关闭实例、条件隐藏、裁剪、优先级/传统宽度省略、空值、间隔以及隐藏代理示例行。自动换行保留内容，预览面板可容纳的行数是独立界面限制。本功能不宣称诊断真实数据可用性。

## 验收与发布证据

覆盖字素/Unicode 输入和缩放、六语言候选流程、未保存草稿取消、冲突、失败恢复、只读 I/O、重复实例身份，以及 40/80/120 列下预览和解释一致性。已安装包扩展捕获包括快速配置各步骤、文本中间光标编辑和解释。产物关联固定源码及包摘要；PTY 单元格重建不等同于桌面截图或真人验收。

[v3.2.0 专属决定](../releases/approvals/v3.2.0.json)仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 中原有六项缺口，不豁免新增失败。下方记录已完成的源码绑定验收和公开渠道验证。

## 发布验收 — 2026-10-19

[实现 PR #113](https://github.com/fbincon/claude-code-statusline/pull/113) 合并为 `a2006c91bb62ac2a07ac12195bd66820c84d1a56`。附注标签 `v3.2.0` 的对象为 `c60da8135d9e3e15d41b946b6c04f7edeead17c7`，指向该提交。

| 门禁 | 证据 | 结果 |
| --- | --- | --- |
| 最终 PR 提交 `cde5416` | [CI 39253844841](https://github.com/fbincon/claude-code-statusline/actions/runs/39253844841) | 56 项成功；按规则跳过纯文档任务 |
| 合并后的 main | [CI 39256749031](https://github.com/fbincon/claude-code-statusline/actions/runs/39256749031) | 相同完整矩阵及稳定版准备检查通过 |
| 版本标签 | [CI 39260071350，第 2 次](https://github.com/fbincon/claude-code-statusline/actions/runs/39260071350/attempts/2) | 相同完整矩阵及稳定版准备检查通过 |
| 本地开发检查 | `npm run check` | 1,040 项测试：1,036 通过、零失败、4 项平台跳过；生成、链接、冻结归档及职责清单通过 |
| 补充本地原生检查 | Claude 2.1.302 | 120 项原生官方测试通过；保留的类型声明来自 2.1.294，不宣称验证了 2.1.302 精确声明 |
| 安装后的终端流程 | 最终包六语言扩展 PTY | 396 个记录；快速配置、文本光标、解释、保存/重开及终端恢复通过 |

每轮完整矩阵要求八个离线安装目标、全部 32 个 Node 运行时用例和十三个固定宿主组合。Claude 2.1.296 的精确类型声明仍按本版本批准记录标为不可用。

[标签第 1 次验收](https://github.com/fbincon/claude-code-statusline/actions/runs/39260071350/attempts/1) 有两项准备阶段失败。Windows ARM / Node 24.22.0 的 595 项产品测试通过，但系统 PowerShell 准备超过 60 秒，尚未执行候选包安装。macOS 14 / Node 24.22.0 在产物下载后缺少候选 tgz，验证在产品测试前停止。Windows 失败记录已备份，再清理其产物名称供重跑使用。相同提交和包的两个受影响任务及汇总检查在第 2 次通过，超时及验收条件未调整。

两次本地独立构建、交付源码重建、main CI 包及标签 CI 包的四个交付文件逐字节一致。安装包 SHA-256：`11489adac35f7723b441e04a5af70ec221e1f2770872ebebfbc3dafe1845e541`。源码归档 SHA-256：`33a013ac6b5fd85385052d9ef41be95a871fe57ab2d558a4321e87fd6d0a05c5`。

本地证据保存在忽略目录 `dist/validation/v3.2.0/`。最终 `release-captures/editor-capture.json` 摘要为 `df75b66273171c8e08bf56c2f7c9db896a856478fe79f45224b9ba35aaed4e63`。Agent 已目视检查部分重建画面，字形外观取决于记录的字体；这些证据与真人易用性、宿主桌面及物理电源验收分开，已披露的未验证范围继续保留。

## 已发布交付

- [GitHub 稳定版 / Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.2.0)，Release `417353430`，发布时间为 `2026-10-19T14:18:31Z`。发布前已重新下载并核验四个草稿附件；[SHA256SUMS](https://github.com/fbincon/claude-code-statusline/releases/download/v3.2.0/SHA256SUMS) 标识交付的安装包、源码及清单。
- [npm 3.2.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.2.0)：[OIDC 预演](https://github.com/fbincon/claude-code-statusline/actions/runs/39266709975)与[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39267068047)通过。回执记录同一提交和包的 `published` 结果；`latest=3.2.0`，保留 `beta=3.0.0-beta.1`。
- [公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39267776555)的 Linux/Windows/macOS × Node 22/24 六项任务全部通过。固定版本和 `latest` 共十二次空缓存安装通过，生命周期脚本关闭，GitHub/npm 包字节与注册表 integrity 一致。
- [Gitee 稳定版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.2.0)，Release `1219646`：核对祖先关系后，按显式 refspec 同步验收过的 main 和附注标签。四个交付附件均已匿名下载并比对一致，下载包通过十项本地离线安装检查。自动仓库归档与可重建源码附件分开。

后续纯文档改动记录上述结果并修正当前协议归属，只需文档、链接和空白校验；发行标签和安装包继续绑定上方实现提交。本地路线将 UX-01、UX-02 和 EXPLAIN-01 标为 DONE，后续工作及六项已披露验收缺口继续保留。
