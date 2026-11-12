# 内置配置技能工作流

[English](skill-workflows.md) | **简体中文**

`packages/cli/resources` 中的两份规范 skill 模板是已安装产品的执行指令。虽然源码格式为 Markdown，变更仍需适用的产品检查及发布证据；Python 归档继续作为历史参考。原始 v3.16.3 修复与发布证据见[交付记录](history/deliveries/skill-workflows.zh-CN.md#内置配置技能工作流)。

## 范围与命令边界

`statusline-config/SKILL.md` 描述模型问答的用户默认配置流程，以及带参数命令的回退。兼容宿主上的本地 `UserPromptExpansion` hook 处理受支持的参数调用，无参数向导交给模型。`parseSlashArguments` 委托 `parseConfig`，支持十九项顶层动作：`show`、`list-items`、`set-items`、`enable`、`disable`、`order`、`subagents`、`set`、`apply`、`item`、`instance`、`group`、`alignment`、`layout`、`preset`、`import`、`export`、`language`、`reset`。受支持参数保留共享解析器的行为。`profile`／`project` 管理是独立的终端／编辑器入口，slash 不转发任意终端命令。

模型回退必须解析字面参数，并按所选 shell 对每个值分别引用，不能插入原始调用文本。保留值内的空格、Unicode、空值和 shell 元字符，不执行命令替换、变量、通配符、管道、重定向或命令串联。只让已安装配置命令验证一次动作，并报告精确结果。

每次 shell 调用都仅限该已安装配置命令。Claude Code 将较大的目录结果保存到文件时，技能允许只读的 `Read` 工具查看该命令的输出文件。不得为处理输出而运行工具程序、辅助脚本或读取无关文件；必需数据仍无法获得时，停止流程且不写入。

向导修改活动 Claude 配置目录中的用户默认显示。命名方案的项目绑定可以选择其他显示配置，宿主设置仍是该目录内共用的用户级设置。向导不得声称所有项目显示都会改变，不得静默选择其他目标或修改方案绑定。

`statusline-configure/SKILL.md` 是本地拦截未处理调用时显示的简短回退。外部编辑器是稳定的 Node 终端 TUI，历史 `--experimental-slash-tui` 偏好名因兼容性保留。回退说明未能启动而不推断原因，建议使用终端 `configure` 或问答向导，Windows 使用 `.cmd`。保留 `disable-model-invocation: true`、Bash／PowerShell 排除项，以及禁止通过任何模型工具启动终端界面的约束。

## 向导问答契约

问答路径先读取界面语言偏好、当前配置和两份实时条目目录。已保存值确定当前选择，不能用目录的 `default_enabled` 值替换。显示语言继续独立于界面语言。

预检检查两个范围的实例列表和分组列表，以及主布局的对齐。重复指标类型、text／spacer、分组或对齐存在时，基于类型的表单在任何写入前停止，指向支持实例的编辑器或明确的结构命令。不得通过简化结构使其适配表单。

未安装接入或子代理 renderer 归属其他工具时也停止预检。不得替换或关闭其他 renderer 以继续向导。

每个生成的指标页最多包含三个指标 ID，再添加一个本地化且互斥的“本页全不选”选项，使每问具有二到四个选项。该答案只清空本页，矛盾答案仍视为未解决。主栏／子代理流程中的每个指标页只问一次，合并所有分页选择，保留已有条目的相对顺序，再按目录顺序追加新启用项。一次 `AskUserQuestion` 调用不超过四问。

语言选择按每页最多三个语言代码连续分组，再显示所选页的原生语言名称及明确的“保留当前值”选项。十二种语言因此可以使用四页选择器。标量选项同样以已保存值为起点。主题选项由规范主题注册表生成；向导保存保留主题及表单以外的其他外观设置。

取消或仍有未解决答案时不保存配置。所有答案解决后重新读取 `config show --json`，将显示、宿主、安装状态和子代理归属与初始快照比较。发生变化时停止，由用户明确重新开始，不自动重启或覆盖。这是尽力而为的复核，因为 `config apply` 没有修订号参数，不能原子比较原始快照。复核一致后只执行一次 `config apply`，随后通过 `config show --json` 核对结果。应用或验证失败时如实报告，不通过拆分或减少答案重试写入。[用户流程](../USER_GUIDE.zh-CN.md#statusline-config-问答向导) · [CLI 支持](../reference/cli.zh-CN.md#slash-命令支持范围)

## 源码维护与回归覆盖

CLI 安装器针对已安装的精确可执行文件渲染规范模板，保留路径和参数的字面内容。条目分组、语言及主题选项来自共享注册表，不手工维护副本。同步更新规范资源和生成器，再执行生成和影响计划选中的检查。不要编辑已安装技能，也不要重新生成 Python 归档资源。

回归覆盖需检查生成页大小、指标完整且唯一覆盖、语言／外观注册表一致、当前值指引、复杂组合拒绝、取消及单次保存指令、受支持 slash 动作，以及外部回退的工具限制。模板检查证明指令契约，不能证明付费模型遵守了全部问题，也不能证明物理终端表现。[测试与验收](testing.zh-CN.md) · [影响检查](impact-checks.zh-CN.md)

完整的[交付记录](history/deliveries/skill-workflows.zh-CN.md#内置配置技能工作流)已归入开发历史。下方链接直达迁移章节。

- <a id="final-release"></a><a id="验证与发布证据"></a>[验证与发布证据](history/deliveries/skill-workflows.zh-CN.md#验证与发布证据)
- <a id="原始检查与证据晋级"></a>[原始检查与证据晋级](history/deliveries/skill-workflows.zh-CN.md#原始检查与证据晋级)
- <a id="实际安装后的技能调用"></a>[实际安装后的技能调用](history/deliveries/skill-workflows.zh-CN.md#实际安装后的技能调用)
- <a id="发布字节与-npm-来源证明"></a>[发布字节与 npm 来源证明](history/deliveries/skill-workflows.zh-CN.md#发布字节与-npm-来源证明)
- <a id="本机核验与预算"></a>[本机核验与预算](history/deliveries/skill-workflows.zh-CN.md#本机核验与预算)
