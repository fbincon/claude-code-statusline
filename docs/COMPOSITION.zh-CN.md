# 组件与布局

[English](COMPOSITION.md) | **简体中文**


共享撤销／重做、当前文件比较、对齐修复审阅及样式／整组复用见[草稿历史与复用](DRAFT_HISTORY.zh-CN.md)。

组件类型描述一个值，例如模型或 token 数量；实例决定这个组件如何出现在状态栏中。
同一类型可以添加多次，每个实例独立设置标签、格式、颜色、条件和宽度。
保存、重新打开和导出会保留每份实例的身份与设置。

升级和新安装均沿用现有默认展示。可选择“左右布局”或“重复指标”预设体验新布局；
在编辑器中展开预设只替换草稿，保存后才生效。

## 使用任一编辑器

在 Claude Code 中打开 `/statusline-configure-native`，或在终端运行
`claude-statusline configure`。主状态栏和子代理页面显示已配置的实例，包括禁用项。
同一类型的多个实例以 `(2)` 等序号区分，序号随当前顺序变化。

| 主状态栏／子代理页面操作 | 原生 / 外部 |
| --- | --- |
| 打开组件选择器 | A / Ctrl+A |
| 复制选中实例 | D / Ctrl+D |
| 从草稿中移除选中实例 | X / Ctrl+X |
| 启用或禁用 | Space |
| 编辑选中实例 | Ctrl+E |
| 移动选中实例 | 左／右方向键 |
| 搜索／选择分类 | `/`／Ctrl+F |

选择器支持全部已注册语言的名称、说明和分类搜索。Enter 将选中类型添加到原选中实例之后；
添加前可按 Ctrl+E 查看来源与要求，Ctrl+G 返回或取消选择器。添加成功后清除原列表筛选，
以便显示新实例。排序需要先清除筛选。

复制保留全部选项并生成新身份；禁用保留行内位置；移除同时清理行引用和空行。
这些操作都只修改草稿。原生界面按 S／F、外部界面按 Ctrl+S 保存；原有关闭／取消操作
放弃未保存的编辑。Claude 宿主偏好仍单独 Apply。缩放窗口、切换语言或保存冲突均保留草稿。

原生界面使用 A／D／X 字母键，避免宿主截获 Ctrl+D 等控制键；搜索和文本输入期间字母仍按原文输入。

类型互斥规则仍然有效，例如启用独立 `status` 或 `elapsed` 前需先禁用 `status-elapsed`。
发生冲突的添加或复制会说明原因，并保留原草稿。

## 静态文字与弹性留白

`text` 原样显示最多 256 个 Unicode 码点的文字，可设置标签、图标、前景／背景颜色、
优先级和最大宽度。不接受换行、终端转义和其他控制字符。`${model}` 等内容作为原文保留，
不会执行替换或翻译。

`spacer` 填充适配内容后的剩余宽度。放在两组内容中间可分隔左右内容，放在开头可使内容
右对齐，放在末尾可使内容左对齐。留白没有颜色、指标条件或宽度覆盖选项。

- 主状态栏自动布局支持文字，继续自动换行；添加留白前需在布局页面切换为显式分行。
- 每个显式主行和单行子代理模板最多一个留白，禁用的留白也计入此限制。
  切换回自动布局前需先移除主状态栏留白。
- 每个实例只有一个位置；需要再次显示时请复制。行边界保留禁用实例，重新启用时恢复原位；
  添加实例会扩展它插入的那一行。
- 窄窗口先压缩留白，再按优先级、最大宽度和完整字素裁剪内容。对齐不会额外产生续行，
  也不会改变 Agent 顺序。
- 隐藏项、空文字和仅含留白的行不会产生空白状态栏行；非空文字可以独立显示。
  Powerline 会在适配后重新计算边界，弹性间隔采用终端默认背景。

子代理模板对每个 Agent 独立生效。模板实例 ID 与宿主协议中的 Agent ID 相互独立。
重复组件共享原始观测、分别格式化，因此复制不会重复扫描会话、执行 Git 或累计用量。

## CLI

命令使用与编辑器相同的配置校验与事务。`main`、`subagent` 表示作用域。
实例 ID 的具体格式无需解析，可通过 `list --json` 获取；类型名称和 ID 均不翻译。

```sh
claude-statusline config preset left-right
claude-statusline config instance main list --json
claude-statusline config instance main copy context-remaining
```

复制命令在保存结果后输出新 ID。将下列 `INSTANCE_ID` 替换为实际值：

```sh
claude-statusline config instance main set INSTANCE_ID label 上下文
claude-statusline config instance main set INSTANCE_ID number-format full
claude-statusline config instance main disable INSTANCE_ID
claude-statusline config instance main enable INSTANCE_ID
claude-statusline config instance main move INSTANCE_ID --before git
claude-statusline config instance main remove INSTANCE_ID
claude-statusline config instance main add text --text '项目 ◆'
```

`add TYPE_ID [--after INSTANCE_ID] [--text TEXT]` 未指定参照时追加到末尾；
`copy INSTANCE_ID` 紧接原实例插入；`move` 必须且只能指定 `--before` 或 `--after`。
`set` 支持已有组件选项，以及文字组件的 `text` 内容。将作用域改为 `subagent` 即可编辑其单行模板。

主状态栏可使用 `config layout --by-instance explicit ROW...` 指定行，每个参数以逗号分隔 ID。
全部已配置实例（包括禁用项）必须按实例顺序各出现一次。也可以在编辑器中调整行边界。
例如刚应用、尚未修改的左右布局预设可执行：

```sh
claude-statusline config layout --by-instance explicit model-with-effort,git,spacer,context-remaining
```

旧类型命令继续支持唯一匹配的指标，遇到多个匹配时明确报错。
批量类型选择、排序和布局命令不接受含重复类型、文字或留白的配置，请改用实例命令或编辑器，
以完整保留布局。类型目录 JSON 新增 `instance_ids`、`enabled_instance_ids`、`instance_only`；
没有唯一启用位置时，`position` 为 null。

在显式行或组件组合中，按唯一类型启禁用会保留已有位置。简单自动布局的旧类型选择仍沿用启用时追加到末尾的行为；实例启禁用命令始终保留位置。

## 迁移、导入导出与恢复

显示 schema 15 保存有序实例、分组及可选显式行对齐；编辑器协议 24 要求 TypeScript 后端与原生资源版本匹配。
Portable／方案外层格式和界面偏好仍为 v1，runtime 观测协议仍为 v3。

旧显示 schema 在内存中规范化，每个作用域内的规范类型 ID 作为确定性迁移身份。
启用顺序、显式行、语言和已禁用类型的自定义选项均保留。
读取、预览和导入审阅不迁移已保存文件；实际保存或安装通过既有备份及原子事务写入新格式。

导出保留 ID、选项和行引用。导入审阅区分新增、移除、启停、排序和选项变化；接受导入只替换
草稿，保存仍检查最初读取的配置版本。其他编辑器已修改配置时，需先协调或重新加载。

降级前使用 `recover --restore-config TRANSACTION_ID` 显式恢复兼容配置备份。版本管理器拒绝新 schema，
并在交接已校验的 Mod 资源及绑定后运行旧版安装器。如果计划再次升级，请另行保留当前配置。重复实例和弹性布局无法无损转换为旧格式，
请勿手改 schema 数字。具体步骤见[升级指南](USER_GUIDE.zh-CN.md#升级)。

## 组件分组

在任一编辑器的设置中打开**组件分组**，或按 **Ctrl+B**。选择主行或子代理模板，设置首个、末尾成员及主指标。方向键选择和调整，在**应用到草稿**上按 Enter 预览；关闭面板后使用原有显示保存操作。取消表单保留之前的草稿。

分组至少包含同一作用域、同一显式行内的两个连续实例，不能重叠、嵌套或包含 spacer。装饰默认跟随主指标的最终可见性（含布局省略）；其他指标保留自身条件。关闭联动后装饰独立显示。自动布局将组保留在同一行，先缩减装饰和次要指标再处理主指标。整组的省略优先级取自主指标。

共享 Powerline 使用主指标背景形成一个色块，各成员前景和阈值色保留。成员背景配置继续保存，关闭共享后恢复。普通分组成员之间以空格连接。操作包括编辑、整组移动、分配新 ID 的整组复制及解组。删除主指标会解组并保留其他实例；单项复制在原组之后插入独立副本。非法移动保留草稿。

```bash
claude-statusline config group main list --json
claude-statusline config group main create cost-block --members LABEL_ID,COST_ID --primary COST_ID --powerline on
claude-statusline config group main set cost-block linked on
claude-statusline config group main copy cost-block
claude-statusline config group main move cost-block --before OTHER_ID
claude-statusline config group main ungroup cost-block
```

将大写占位符替换为 `config instance main list` 中的实例 ID；`subagent` 使用同样操作。`set` 支持 `primary`、逗号分隔的 `members`、`linked on|off`、`powerline on|off`。方案保存/复制及导入导出保留分组，不授予来源访问或自动刷新权限。[实现与验收](development/m4-m7-delivery.zh-CN.md)。

## 显式主行的对应列对齐

在 **Layout（布局）→ 对齐显式主行** 中创建关系，为每列选择各参与行中的一个组件或整个组。左右键选择，使用“添加列”增加下一列，“应用到草稿”接受关系，再用原有保存操作持久化。取消不改变已有草稿。选项显示稳定 ID，因此重复组件类型仍可独立选择。

每列至少包含两个不同的显式主行，每行至多一个单位，各行列顺序必须一致。组成员只能以整组参与，单位不能重复用于其他列。一个关系占用参与行对应的左侧或右侧，同一侧不允许多个关系重叠。自动换行、子代理模板及跨作用域关系不参与对齐。

先按可见性和组件最大宽度测量，再使用每列可见成员的最大宽度。其他可见行仍需要该列时，隐藏成员保留列位；整列隐藏时收起，整行隐藏时不输出。spacer 两侧独立计算，剩余宽度交给 spacer，右侧列保持靠右。Powerline 单位保留完整色块与端帽，单位之间使用终端默认背景留白，隐藏项不留下孤立分隔符或端帽。

若新增留白使任一参与行超宽，该帧的关联行取消对齐留白，再执行原有优先级、装饰收缩及完整字素裁剪。结构中的 spacer 被禁用时也采用此回退。解释／诊断会报告 `alignment_collapsed`，宽度足够时报告 `alignment_active`。共享同一物理行的关系共同使用宽度预算，也共同回退。

```sh
claude-statusline config alignment list
claude-statusline config alignment set summary --columns 'instance:ROW1_MODEL,instance:ROW2_MODEL;group:ROW1_USAGE,group:ROW2_USAGE'
claude-statusline config alignment remove summary
```

将大写占位符替换为实际单位 ID。逗号连接同列成员，分号分隔各列。普通组件／组复制不自动加入对齐；完整方案复制和主区导入保持引用与单位一致。删除、移动、解组或调整行／布局模式导致关系失效时，保存前拒绝修改并指出关系 ID，请先修改或移除该关系。默认布局及预设不会自动开启对齐。

显示配置使用 schema 15，编辑器协议为 24；portable／方案外层格式和界面偏好仍为 1，运行时观察协议仍为 3。旧配置读取和预览仅在内存迁移，实际保存或安装才备份并升级。降级前使用 `recover --restore-config TRANSACTION_ID` 显式恢复兼容备份；版本管理器拒绝新 schema，并负责交接已校验的旧版 Mod 资源及绑定，不能手改 schema 数字伪装迁移。
