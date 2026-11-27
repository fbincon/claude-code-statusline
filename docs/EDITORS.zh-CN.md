# 配置编辑器

[English](EDITORS.md) | **简体中文** · [使用指南](USER_GUIDE.zh-CN.md) · [文档中心](README.zh-CN.md)

终端编辑器与会话内 Client 编辑同一份显示配置，各自保留草稿。先完成[安装与接入](USER_GUIDE.zh-CN.md#安装与接入)；准确命令语法见 [CLI 参考](reference/cli.zh-CN.md)。

## 文档导航

- [打开编辑器](#open-an-editor)
- [页面与导航](#pages-and-navigation)
- [键盘操作](#keyboard-controls)
- [自定义快捷键](#customize-keyboard-shortcuts)
- [文本输入](#text-input)
- [查找显示项与查看条件](#find-items-and-inspect-requirements)
- [格式与布局](#formats-and-layouts)
- [预设、导入审阅与导出](#presets-import-review-and-export)
- [样例预览与颜色](#sample-preview-and-colors)
- [保存、取消与恢复](#save-cancel-and-recover)
- [Claude 偏好独立应用](#claude-preferences-apply-separately)

<a id="open-an-editor"></a>

## 打开编辑器

| 入口 | 运行位置 | 条件 |
| --- | --- | --- |
| `claude-statusline configure` | 当前终端，包括 SSH | 配置有效、当前 CLI 接管安装、stdin/stdout 为 TTY 且 ANSI/VT 可用；最低 64×18 |
| `/statusline-configure` | 从 Claude 启动的受支持终端 | Claude Code 2.1.258+ 且外部接入已启用；同样满足终端编辑器条件 |
| `/statusline-configure-native` | 当前 Claude 会话内的 Client 面板 | Claude Code 2.1.287+、原生接入已启用且加载匹配资源；Client 正文最低 32×12 |

Windows 在终端运行 `claude-statusline.cmd configure`。外部启动器在 Linux 使用 tmux 或 GNOME Terminal，在 macOS 使用 tmux 或 Terminal.app，在 Windows 使用系统新控制台。没有受支持启动器时直接运行 `configure`。slash 启动的编辑器在 570 秒后取消且不保存，独立 `configure` 没有自动超时。保存、取消及错误返回原会话的简短结果；slash 命令 `/statusline-configure` 接受 `help`／`-h`／`--help`，拒绝其他参数；独立命令 `claude-statusline configure` 不接受 `help`。终端小于最低尺寸时等待放大，仍可取消。

接入变化后，在受信任终端重启 Claude Code。先点击 Client 正文再使用键盘；重复运行原生命令聚焦现有面板并保留草稿。Esc 由宿主管理焦点，之后可能关闭面板；取消 Client 输入用 Ctrl+G。macOS 会话内交互仍未验证，见[焦点检查与替代入口](USER_GUIDE.zh-CN.md#macos-鼠标报告与-client-焦点)。

检查标题中的编辑目标。通过**设置 → 显示方案与项目**或 Ctrl+O 选择用户默认、命名方案或项目目标；终端 `configure` 也接受明确的目标参数。见[方案与项目绑定](PROFILES.zh-CN.md)。两种接入独立启用的规则见[安装组合与宿主兼容性](USER_GUIDE.zh-CN.md#编辑器安装组合与兼容性)。

<a id="pages-and-navigation"></a>

## 页面与导航

| 页面 | 配置内容 |
| --- | --- |
| Main / Subagents | 已配置组件实例，包含禁用项；选择、排序与逐项详情 |
| Settings | 外观、刷新／显示行为、Git 指标、格式、风险颜色、子代理可见性、预设／文件与管理器；Client 还提供独立 Claude 偏好 |
| Layout | 自动／显式分行、行边界及逐项适配 |
| 逐项详情（Ctrl+E） | 来源与启用条件、标签／图标、格式、宽度、优先级及组件支持的其他控制 |

非输入编辑状态下用 Tab / Shift+Tab 切页。切页和缩放保留草稿、选择、筛选与输入缓冲。分组标题不可选中。方向键选择字段，Page Up/Down 移动一页，Home/End 到首尾字段；Settings、Layout 和逐项详情分页会计算分组标题占用的行。

<a id="terminal-page-regions-and-footer"></a>

### 终端页面区域与底部提示

内容和 `Preview (sample data)` 使用独立区域，64×20 起使用边框，64×18–19 使用紧凑分隔。Main/Subagents 显示 `ON`、`ITEM`、`DESCRIPTION`，设置及表单显示 `OPTION`、`VALUE`。

底部提示随当前操作变化。组件列表优先显示切页、选择和切换。保存区显示当前的保存并退出键。筛选时提供清除筛选的入口，隐藏排序提示。输入字段显示接受／取消及光标／删除控制，选择器显示选择控制。仅打开字段或修改文件路径不改变显示草稿；配置文本尚未接受时，也可能在标题中标记为已修改。

<a id="client-pagination-and-footer"></a>

### Client 分页与底部提示

64×20 起用边框分隔内容和预览，紧凑面板使用带标题分隔线。活动页签、分组标题和选中字段有不同样式。保存和关闭与页面控制分组显示。组件列表优先显示切页、选择和切换。Settings 显示 H 展开 Claude 偏好，在展开后显示 A。

输入时普通快捷键替换为接受／取消／清空／删除；忙碌或保存结果不明时仅显示适用控制。提示按完整“按键＋说明”换行。32×12 下缩短说明、减少详情行，保留选择、基本操作和样例预览，必要时省略次要提示。缩放重新计算字段分页，保留选中字段和输入缓冲。

<a id="keyboard-controls"></a>

## 键盘操作

下表描述编辑器主界面。活动字段、选择器、审阅页和管理器各自处理按键，以其底部提示和所链接的专题为准。Client 字母快捷键显示大写，非输入状态下大小写均可。

### 终端编辑器

| 按键 | 操作 |
| --- | --- |
| Tab / Shift+Tab | 非输入状态下循环 Main、Subagents、Settings、Layout |
| Enter / Space | 在 Main／Subagents 列表勾选或取消当前组件 |
| ↑ / ↓；PgUp / PgDn；Home / End | 选择、翻页、首尾条目或字段 |
| ← / → | 调整组件和整组的顺序，或调整设置。排序前请清除筛选。 |
| `/`；可打印字符；Backspace / Ctrl+U | 进入或更新项目搜索；删除／清空 |
| Ctrl+F | 选择分类 |
| Ctrl+E / Ctrl+G | 打开逐项详情／返回、取消输入或清除列表筛选 |
| Ctrl+A / Ctrl+D / Ctrl+X | 在组件页打开目录／复制／移除实例 |
| Enter | 操作选中的设置行，或打开及接受字段编辑 |
| E | 将选中的刷新间隔设为仅事件刷新，写入草稿 |
| Ctrl+S | 非输入状态下保存显示草稿并退出 |
| Ctrl+K | 保存结果不明时核对保存状态 |
| Esc | 取消字段或子页面。顶层关闭干净草稿，有修改时确认是否放弃，默认继续编辑。改绑关闭键后仍可使用。 |
| Ctrl+C | 恢复终端、以 130 退出并放弃未保存显示修改 |

在 **刷新间隔** 行按 Enter，会打开预填当前值的编辑框。按 Ctrl+U 清空后，输入 1 到 3600 之间的整数秒数或 `event`，再按 Enter 确认到草稿。使用当前 **保存** 快捷键提交草稿。**设为仅事件刷新** 默认使用 E，也可改绑到其他可用键。这一行保留 Enter 用于编辑。

### 会话内 Client

| 按键 | 操作 |
| --- | --- |
| Tab / Shift+Tab；1 / 2 / 3 / 4 | 非输入状态下切换 Main、Subagents、Settings、Layout |
| ↑ / ↓；PgUp / PgDn；Home / End | 选择、翻页、首尾条目或字段 |
| ← / → | 调整组件和整组的顺序，或调整设置。排序前请清除筛选。 |
| Enter / Space | 切换组件、操作设置或打开及接受字段编辑 |
| `/`；Ctrl+U；Ctrl+G | 进入搜索；清空输入；取消并恢复原状态 |
| Ctrl+F | 选择分类 |
| Ctrl+E / Ctrl+G | 打开逐项详情／从表单返回或清除列表筛选 |
| A / D / X | 在组件页打开目录／复制／移除实例 |
| S / F / Q | 保存继续／保存成功后退出／放弃未保存显示修改并退出 |
| H / A | 在 Settings 展开 Claude 偏好／独立 Apply |
| R / K / V | 放弃重载／核对结果不明的保存／重试样例预览 |
| Esc | 归还焦点给 Claude；取消 Client 输入用 Ctrl+G |

### 共享工具与预览控制

| 操作 | 终端 / Client | 详细流程 |
| --- | --- | --- |
| 快速配置 | 两种编辑器在逐项详情外均用 Ctrl+P | [方案与预设](SCHEMES.zh-CN.md#editor-quick-setup) |
| 撤销 | 终端编辑器用 Ctrl+Z。Client 用 Ctrl+/，也接受 Ctrl+_。 | [历史与终端冲突](DRAFT_HISTORY.zh-CN.md) |
| 重做；变更与历史 | Ctrl+R；Ctrl+T | [草稿历史与审阅](DRAFT_HISTORY.zh-CN.md#历史与变更审阅) |
| 组件分组 | Ctrl+B | [组件组合](COMPOSITION.zh-CN.md#组件分组) |
| 方案及项目目标 | 逐项详情外用 Ctrl+O | [方案](PROFILES.zh-CN.md) |
| 来源 | Ctrl+Y | [来源管理](EXTENSIONS.zh-CN.md#使用两个编辑器配置) |
| 诊断输入文件 | Ctrl+L | [输入诊断](DIAGNOSTICS.zh-CN.md#在双编辑器中诊断文件) |
| 样例场景／宽度／下一预览行 | Ctrl+V / Ctrl+W / Ctrl+N | [样例预览](#sample-preview-and-colors) |

使用草稿历史前，先从管理器返回主编辑器。Unix 上 Claude 可能拦截 Ctrl+Z 并挂起进程，因此 Client 使用上表中的撤销键。在 GNOME Terminal 中使用 Client 时，Ctrl+Shift+- 也发送撤销键，而 Ctrl+- 缩小字体。宿主限制详见历史指南。

<a id="customize-keyboard-shortcuts"></a>

## 自定义快捷键

在任一编辑器中打开 **设置 → 快捷键**。使用方向键和翻页键浏览操作。按 `/` 可按操作名称或 ID 筛选，Enter 接受筛选，Ctrl+G 恢复原筛选和选中项。编辑筛选文字时，Ctrl+U 可清空。每项显示当前绑定，方括号内显示预设。内置和外部编辑器共享这份设置，预设不同的操作会显示各自的键。打开后的快捷键面板可在 32×12 下使用。

1. 选中操作并按 Enter，然后按下新键。Ctrl+G 取消录入。Delete 将选中操作恢复为预设。
2. 用 Tab 切换到操作菜单，再用方向键选中 **保存快捷键** 并按 Enter。要恢复整套预设，在菜单中选择 **恢复全部** 后保存。
3. 遇到冲突时，根据提示调整涉及的操作。可以先交换两项的键，再一起保存。同一键可用于互斥页面。Ctrl+G 返回，有暂存修改时会先询问是否放弃。

保存后当前编辑器立即使用新绑定。另一个已打开的编辑器可在快捷键面板选择 **读取已保存**，也可关闭后重开。两个编辑器同时修改时，先保存的改动受到保护。后保存的一端会收到冲突提示，可先读取已保存的设置。快捷键作为本机界面偏好独立保存，显示草稿继续通过原有的保存和撤销流程管理。[存储格式](reference/cli.zh-CN.md#editor-shortcut-preferences)

支持 ASCII 字母、数字、符号和可辨识的 Ctrl+字母。字母大小写等效。Space、Enter 和左右方向键可在没有固定用途冲突的场景使用。来源表单的保存快捷键须用 Ctrl+字母，以保留文字输入。Claude 可能截获 Ctrl+D、Ctrl+X 和 Ctrl+Z，因此只可为外部编辑器专属操作绑定这三个组合键。快捷键偏好无效时，编辑器会提示并加载预设。Claude 新增保留键的兼容规则仍会加载可用的改绑。选择 **保存快捷键** 可写入当前偏好。

改绑保存键会替换保存预设，Enter 仍可确认菜单选项。外部编辑器的自定义关闭键和 Esc 都可以关闭编辑器。在外部组件列表和目录中，已绑定的字符执行相应操作，未绑定的字符直接筛选。要搜索已绑定的字母或符号，先用界面显示的 **搜索** 键进入输入框，预设键为 `/`。

本页的按键表列出预设。改键后可查看编辑器页脚和快捷键面板。终端与宿主需要把按键送达编辑区，才能录入或触发。内置 Client 对宿主以单字符按键转发的粘贴无法区分。

<a id="text-input"></a>

## 文本输入

文本、搜索、数值和文件路径支持 ←/→、Home/End、光标处插入、Backspace 和 Delete，长内容水平滚动。`▏` 标识光标，删除保留完整字素簇。Ctrl+U 清空，Enter 接受，Ctrl+G 取消；终端 Esc 也可取消，Client Esc 由宿主管理。刷新接受数字或 `event`。

文本／搜索最多 256 个 Unicode 码点，路径最多 4096。padding／refresh 数值缓冲最多 32，其他字段还会校验自身值域。超长或含控制字符的插入整体拒绝并提示，保留原值。字段中的普通字符作为输入，不执行字母快捷键。

终端括号粘贴和可识别的 Client 多字符文本不执行快捷命令。Client 单键 API 没有粘贴来源标记，宿主已拆成单键的粘贴无法与键入可靠区分。请先进入字段再粘贴。见 [Unicode 与终端列宽](COMPOSITION.zh-CN.md#unicode-text-and-terminal-widths)。

<a id="find-items-and-inspect-requirements"></a>

## 查找显示项与查看条件

Main/Subagents 按 `/` 输入查询，Enter 确认，Ctrl+U 清空，Ctrl+G 恢复原查询。终端编辑器也支持直接输入，Esc 取消显式搜索。任一界面语言均可检索 ID、全部十二种语言的名称和说明、自定义标签及分类。优先级为精确、前缀、英文首字母缩写（如 `mwe`）、连续子串、有序子序列，同级保留原顺序。高亮标出实际匹配，必要时显示另一语言片段。

Ctrl+F 打开分类选择器，方向键选择，Enter 确认。选择**全部分类**可清除分类。在已配置列表按 Ctrl+G 清除搜索和分类，恢复排序。目录打开时继承列表的查询和分类，可在目录内按 Ctrl+U 清搜索或按 Ctrl+F 切换分类，改动只在本次目录中生效。Enter 或 Space 在草稿中添加或启用选中的类型，目录保持打开。[组件目录和实例操作](COMPOSITION.zh-CN.md#使用任一编辑器)

查看来源与条件：Ctrl+E 打开逐项详情，选择顶部**来源与启用条件**，按 Enter。方向键或 Page Up/Down 滚动，Ctrl+G 返回（终端 Esc 也可）。说明包含作用域、来源字段、已核实宿主要求、可选采集及不可用原因，不探测实时数据或启用采集。未观测项目仍可选择，预览保持固定样例。

<a id="formats-and-layouts"></a>

## 格式与布局

Main/Subagents 选择组件后按 Ctrl+E，编辑标签、图标、优先级、最大宽度和受支持的格式。Ctrl+G 返回，Enter 打开或接受文本／整数输入。`inherit` 清除覆盖，空标签／图标隐藏它，`none` 清除可选宽度／限制。Unicode/ASCII 图标使用内置字符，无需额外字体。

Layout 选择 auto/explicit，通过 **New row before** 设置全部已配置主实例（含禁用项）的行边界。较高优先级优先保留，默认 50；最大宽度按终端列计算。排序维持有效分行。显式行过窄时，作用域装饰先让位给实际项目，随后压缩宽度并可能隐藏低优先级项目。显式布局移除空行且不新增续行，自动布局继续折行。见[组件、分组与对齐](COMPOSITION.zh-CN.md)。

<a id="presets-import-review-and-export"></a>

## 预设、导入审阅与导出

Settings 选择 Preset，再激活 **Expand selected preset**，替换显示草稿，保存前仍可编辑。Ctrl+P 打开[快速配置](SCHEMES.zh-CN.md#editor-quick-setup)，取消保留原草稿，不启用采集。

Import 输入路径后，与**当前未保存草稿**比较。分区涵盖项目选择、保留项目顺序、格式／覆盖、布局、状态栏语言和宿主状态栏设置。方向键选分区，Enter 展开详情，Page Up/Down 滚动，Tab 切换主栏／子代理候选预览。**A 仅接受到草稿，保存是独立操作。** Client 用 Ctrl+G 或 Q 取消审阅，终端用 Esc 或 Ctrl+G。

输入无效或取消保留原草稿。接受使用已读取的候选，源文件后续变化不改变它，并保留原保存 revision。完整导入替换完整草稿；选择性导入初始不勾选，支持明确的全局选项、完整主区及／或完整子代理区，未选设置及其本地绑定保持原样。见[选择与目标规则](PROFILES.zh-CN.md#选择性导入)。

Export 将当前草稿（含未保存修改）写入新的可移植文件，不保存设置。相对路径以宿主／终端工作目录为准，`~` 展开到主目录。错误保留草稿。两个编辑器均拒绝覆盖已有导出文件；可换路径或通过 CLI 的 `--overwrite` 明确替换。可移植文件不含界面语言、采集开关和独立 Claude 偏好。见 [CLI 导入导出与安装归属](USER_GUIDE.zh-CN.md#预设与可移植配置)。

<a id="sample-preview-and-colors"></a>

## 样例预览与颜色

Preview 使用生产渲染器与固定观测，不采集实时 Git、transcript 或账户指标。Ctrl+V 换场景，Ctrl+W 换预览宽度，Ctrl+N 滚动预览行；Settings 也提供这些选项。控制仅属于当前编辑会话，样例不能证明实际字段可用或接入成功。

选择组件，Ctrl+E 后打开**配置与示例说明**。说明区分草稿开关、已知本地安装／采集条件、条件隐藏、裁剪及宽度省略；重复类型按实例 ID 对应，子代理样例逐行说明。面板放不下与渲染省略不同。上下或 PgUp/PgDn 滚动，Ctrl+G 返回。说明不写文件或锁，不启动采集。实际捕获输入使用[输入诊断](DIAGNOSTICS.zh-CN.md)。

<a id="terminal-colors"></a>

### 终端颜色

编辑器使用终端默认前景／背景、ANSI 青色加粗标题和反色选择。预览使用终端背景及所选 Palette；浅色终端中 `default` 过淡时，在 Settings 比较 `ansi`。显示调色板变化立即预览，保存后影响实际输出。见[颜色能力、NO_COLOR 与回退规则](APPEARANCE.zh-CN.md#terminal-color-capability)。

<a id="client-preview-background"></a>

### Client 预览底色

Client 控件跟随 Claude 已应用主题。**Preview background (UI only)** 独立选择 `light`（`#ffffff`）或 `dark`（`#17191e`），默认深色，修改立即记住，写入失败恢复原选择。该偏好不属于显示草稿、可移植文件或 Palette。面板不能查询终端精确 RGB 背景，需要时比较 `default` 与 `ansi`；取消显示修改不会还原此界面偏好。见[显示外观](APPEARANCE.zh-CN.md)。

<a id="save-cancel-and-recover"></a>

## 保存、取消与恢复

| 操作 | 终端编辑器 | Client |
| --- | --- | --- |
| 保存显示 | 非输入时 Ctrl+S 保存并退出。 | S 保存并继续。F 保存成功后关闭。若 Claude 偏好仍有待应用修改，面板保留以单独 Apply。 |
| 取消显示修改 | 顶层 Esc，有修改时确认**放弃更改并关闭** | Q 放弃未保存显示修改并关闭 |
| 保存结果不明 | Ctrl+K 核对已提交快照 | K 核对已提交快照 |

字段内 Enter 接受字段，导入审阅内 A 接受到草稿，均不代表最终保存。实际保存检查目标 revision 和安装归属，备份真实修改并原子提交；无变化不创建备份。界面语言、来源操作及 Claude Apply 是独立效果，不随显示取消或撤销。

两个编辑器可以同时打开，先保存者成功，旧 revision 被拒绝且不覆盖新设置。冲突审阅保留草稿，可比较、导出、明确审阅后重试或放弃重载。见[并发编辑流程](DRAFT_HISTORY.zh-CN.md#并发修改与未知保存)；普通重载丢弃草稿，不合并修改。

保存进行中或结果不明时，禁止显示／历史修改和普通关闭，包括已打开的来源／方案管理器。保存状态核对只读取已提交快照，不重复保存；结果明确后解锁，冲突保留草稿。来源只读检查仍可使用。Client 故障时，通过面板外的 Retry/Close 恢复，保留宿主已接收的草稿。窄宽度下标题在控件前省略编辑目标。见[故障排查](USER_GUIDE.zh-CN.md#故障排查)。

<a id="claude-preferences-apply-separately"></a>

## Claude 偏好独立应用

Client Settings 按 H 展开 **Claude preferences**。外观、时间／标题及行为行采用当前宿主实际提供的类型／选项；模型、effort、thinking、fast mode 与状态栏同名显示开关独立。缺失行显示适用的官方入口，如 `/config`、`/model`、`/effort`、`/fast`。

编辑实际值后用 A 独立 Apply，逐行结果涵盖拒绝、锁定、外部修改及部分成功。Save/Finish 和可移植文件不应用这些偏好，显示撤销无法还原 Apply。Reload 明确放弃待处理编辑；恢复后继续用键盘前再次点击 Client。终端编辑器管理工具配置，不能调用 Claude 宿主偏好 API。

## 相关指南

- [草稿历史与复用](DRAFT_HISTORY.zh-CN.md)
- [命名方案与项目绑定](PROFILES.zh-CN.md)
- [输入诊断](DIAGNOSTICS.zh-CN.md)
