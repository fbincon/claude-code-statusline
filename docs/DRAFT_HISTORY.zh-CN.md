# 草稿历史、结构审阅与配置复用

[English](DRAFT_HISTORY.md) | **简体中文**

`claude-statusline configure` 与 `/statusline-configure-native` 使用相同草稿规则。外部编辑器用 **Ctrl+Z** 撤销；Native 用 **Ctrl+_**（通常为 Ctrl+Shift+-）。两端均用 **Ctrl+R** 重做、**Ctrl+T** 或设置中的**变更与历史**打开审阅，该页面也提供 **U** 撤销、**R** 重做。这些操作在没有活动文本输入或其他管理器时生效。

Claude 的 Unix 宿主会在 Native 收到 Ctrl+Z 前挂起整个进程；本机 2.1.312 已观察到这一行为，参见 [Claude 终端冲突说明](https://code.claude.com/docs/en/keybindings#terminal-conflicts)。Native 保留宿主能够转发时的 Ctrl+Z 处理；安装程序不会修改 Claude 的全局按键配置。

## 历史与变更审阅

每次确认的组件、表单、颜色、布局、分组、预设或导入操作计为一步。数值输入可以临时预览；Enter 确认只记一步，取消恢复原值。无变化操作和取消审阅不新增记录。撤销后重新编辑会清除重做分支。

历史仅属于当前编辑会话与目标，最多保留 100 步、16 MiB 序列化快照；超限会移除最早记录并提示。确认保存成功或明确丢弃并重载会建立新边界，重新打开编辑器没有旧历史。界面语言、数据源授权、命令执行及 Claude 独立 Apply 均为独立操作，撤销不能逆转这些外部效果。

审阅比较保存基线和未保存草稿。Enter 展开区段，Page Up/Down 翻阅详情。预览使用生产渲染器及示例观测，打开审阅不会保存配置。

## 并发修改与未知保存

保存冲突保留草稿和历史。**C** 读取相同目标的当前配置，**Tab** 在“基线 → 草稿”“基线 → 当前文件”“当前文件 → 草稿”之间切换。**E** 将草稿导出到新的便携文件，并清除机器授权绑定。

明确选定的用户默认、命名方案或项目目标发生并发修改时，直接打开此冲突审阅。写入已被拒绝，结果明确：本地草稿与另一编辑器已保存的配置都保留。审阅中读取当前目标失败，不会把已知拒绝变为保存结果未知。

**L** 请求丢弃并重载，必须再按 Enter 明确确认。**K** 保留草稿并采用审阅过的修订，随后使用正常保存操作重试；再次发生并发修改仍拒绝保存。目标身份、解析到的方案或安装归属变化时禁止这种重试，可改为导出或明确重载。

保存结果未知时，草稿和历史变更冻结，直到现有已保存状态检查给出明确结果。仍可比较和导出。重试及重载都不能绕过归属、修订、事务或恢复检查。

## 结构调整与对齐

删除被引用组件、解组、把对齐实例组成组或修改行布局，可能打开结构审阅。页面列出受影响关系，并预览完整有效候选。失效引用及不足两个引用的列会被移除；仍违反同行、spacer 侧向或顺序约束的关系会明确建议移除。无关关系保留，不猜测替代组件。

**A** 将结构操作及引用修复一起接受为一次可撤销操作，**Q** 或 Escape 取消。草稿变化后提案失效。CLI 结构命令保留默认拒绝行为，提供明确审阅：

```bash
claude-statusline config instance main remove b --dry-run
claude-statusline config instance main remove b \
  --expected-revision TARGET_REV --accept-alignments table
```

把 `TARGET_REV` 与 `table` 替换为审阅返回的修订及精确受影响关系 ID。`config group`、`config layout` 提供相同控制，最终修订检查在配置锁内执行。

## 复制视觉样式

打开目标组件详情中的**复制／粘贴视觉样式**，选择当前草稿、便携文件、方案导出文件或已保存方案作为来源，再选择来源组件及要复制的视觉字段。不兼容字段可见但不可勾选。

v3.13.0 Native 简中界面的此入口曾未翻译（[#180](https://github.com/fbincon/claude-code-statusline/issues/180)）；[v3.14.0 已修复并验证实际样式／分组／历史入口](development/adaptive-row-scenarios.zh-CN.md)。历史截图保留原软件包身份。

白名单包含前景／背景色、两类渐变、标签、图标及支持的格式覆盖；来源继承值会恢复目标继承。目标指标类型、数据源绑定、文字内容、顺序、优先级、宽度及可见性保留。审阅差异后按 **A** 接受，再单独保存。

```bash
claude-statusline config import source.json \
  --style-from main:source --style-to main:destination \
  --style-fields foreground,background,label --dry-run
```

实际应用时重复同一选择，并增加审阅返回的 `--expected-revision TARGET_REV --source-revision SOURCE_REV`。来源文件或目标修订变化均会拒绝。单方案文件使用 `--profile-file`，或对应的 `config profile import` 入口。目标参数为 `--user`、`--profile NAME` 或 `--project PATH`。

## 复用完整分组

设置中的**复用完整分组**会为所选组的组件、分组及对齐关系分配新 ID，保留主组件、联动可见性、共享 Powerline 背景和必要行／spacer。已有显式行保留，导入片段追加在后。

组外引用必须明确处理：**X** 在待审阅、扩选依赖和排除组外对齐之间切换。需要自动转显式布局时，**L** 单独允许转换。没有这些明确选择时，不完整候选不能接受。**Tab** 切换 ID／依赖与语义差异，两者均可翻页。**A** 接受为一次草稿操作，**Backspace** 返回选择。

```bash
claude-statusline config import source.json --groups main:group-id \
  --references expand --explicit-layout --dry-run
```

实际应用同样需要审阅返回的目标修订及来源修订。跨配置导入清除本机来源绑定，并列出未解决引用。接受后按 **B** 打开现有来源管理器，明确选择类型、作用域兼容的本机来源，也可暂时保留未绑定。绑定不会启用来源、批准自动执行或触发刷新。同一草稿内的普通整组复制保留既有本地绑定行为。

另见[组件组合](COMPOSITION.zh-CN.md)、[外观](APPEARANCE.zh-CN.md)、[来源](EXTENSIONS.zh-CN.md)、[CLI 参考](reference/cli.zh-CN.md)及[终端示例与来源记录](images/draft-history-reuse/README.zh-CN.md)。
