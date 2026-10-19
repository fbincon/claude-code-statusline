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

[v3.2.0 专属决定](../releases/approvals/v3.2.0.json)仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 中原有六项缺口，不豁免新增失败。最终交付要求最终提交/合并/标签 CI、八安装目标、32 个 Node 用例、十三固定宿主、独立构建及源码重建一致性，以及 npm/GitHub/Gitee 下载核验。完成这些门槛后补记实际发布身份和证据。
