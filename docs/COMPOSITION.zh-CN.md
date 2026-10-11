# 组件与布局

[English](COMPOSITION.md) | **简体中文**

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

选择器支持五种语言的名称、说明和分类搜索。Enter 将选中类型添加到原选中实例之后；
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

显示 schema 8 保存有序实例；编辑器协议 11 要求 Python 和原生资源版本匹配。
Portable 外层格式仍为 v1、界面偏好仍为 v1、runtime 观测协议仍为 v2。

显示 schema 1–7 在内存中规范化，每个作用域内的规范类型 ID 作为确定性迁移身份。
启用顺序、显式行、语言和已禁用类型的自定义选项均保留。
读取、预览和导入审阅不迁移已保存文件；实际保存或安装通过既有备份及原子事务写入新格式。

导出保留 ID、选项和行引用。导入审阅区分新增、移除、启停、排序和选项变化；接受导入只替换
草稿，保存仍检查最初读取的配置版本。其他编辑器已修改配置时，需先协调或重新加载。

降级前先用当前软件移除不兼容的原生编辑器资源，再恢复升级前的兼容配置备份，安装旧软件和
匹配资源。如果计划再次升级，请另行保留当前配置。重复实例和弹性布局无法无损转换为旧格式，
请勿手改 schema 数字。具体步骤见[升级指南](USER_GUIDE.zh-CN.md#升级)。
