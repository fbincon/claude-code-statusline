<a id="完整显示方案"></a>

# 内置显示方案

[English](SCHEMES.md) | **简体中文**

安装后可在任一编辑器或 CLI 中选择方案或预设；候选配置在保存显示草稿后生效。

## 区分方案、预设与 Profile

| 概念 | 用途与关系 |
| --- | --- |
| 内置完整方案 | 同时设置布局和全局外观的八套起点；展开为可编辑显示配置 |
| 原始预设 | 六种兼容起点；保留当前全局主题与分隔样式 |
| 命名显示方案（Profile） | 你保存的具名显示配置，可从上述任一起点建立，再用于分享或项目绑定 |
| 用户默认配置 | 独立保存的默认显示快照，项目没有匹配绑定时使用；Profile 后续编辑不会自动修改它 |
| 项目绑定 | 用户侧项目根目录到 Profile 的关联；不是另一份显示配置，也不授予来源权限 |

选择内置方案或预设生成候选；在编辑器中接受后，再对当前目标保存。[编辑目标、默认激活和项目匹配规则](PROFILES.zh-CN.md#选择编辑目标)。

<a id="editor-quick-setup"></a>

## 在编辑器中使用快速配置

在 `/statusline-configure-native` 或 `claude-statusline configure` 中按 **Ctrl+P**，或在设置页选择“快速配置”。依次选择用途、外观和示例。用上下键和 Enter 选择，左右键调整外观，Tab 切换主行与子代理示例，PgUp/PgDn 滚动来源要求。需要审阅和安装 Claude 接入时，使用独立的[首次设置向导](SETUP.zh-CN.md)。

在审阅页选择操作。

- **接受候选并继续微调**将候选配置作为当前草稿。
- **保存候选配置**对当前目标执行版本检查、备份和事务保存。审阅共享方案时会显示绑定项目的数量和路径。
- **另存为命名方案**单独保存方案，并保留原有未保存草稿。

Backspace 返回上一步。Ctrl+G 取消并保留进入快速配置前的草稿，外部编辑器也可按 Esc 取消。选择预设或方案时保留已有采集偏好与子代理启用开关；子代理行内容按所选预设或方案重建。显式切换界面语言会立即保存，输出语言随显示草稿保存，Claude 偏好通过独立的 Apply 生效。

## 内置方案

下方八套完整方案会展开为普通可编辑实例、布局及外观设置。[使用演示](SHOWCASE.zh-CN.md)提供完整操作流程和不使用 Powerline 的变体；直接选择内置方案则采用表中默认外观。

| ID／可分享 JSON | 主栏与默认外观 | 子代理与要求 |
| --- | --- | --- |
| [`daily-development`](../examples/schemes/daily-development.json) | 模型／推理强度、目录、Git、上下文与任务计时；紧凑分隔和终端主题。第二行会话费用默认关闭 | 默认代理模板；Claude 输入、本地 Git 与任务观测 |
| [`agent-focus`](../examples/schemes/agent-focus.json) | 任务计时、上下文、Git，以及有观测时的运行状态、进度和代理数量；紧凑分隔和终端主题 | 状态、名称、模型、上下文、耗时和任务；隐藏已完成代理、保留失败代理、不限制行数 |
| [`quota-watch`](../examples/schemes/quota-watch.json) | 上下文、五小时／周额度及重置时间，随后显示已观测的费用／开销／缓存；紧凑分隔和终端主题 | 宿主额度与费用字段；缺失或过期额度省略，绝不转换成零 |
| [`powerline-daily`](../examples/schemes/powerline-daily.json) | 两行模型、目录、Git、上下文、任务计时与费用；ocean 主题、自适应指标和 Powerline 行渐变 | 状态、名称、模型、上下文、耗时和任务；费用需宿主观测 |
| [`agent-workbench`](../examples/schemes/agent-workbench.json) | 任务／上下文／Git 加联动活动组；slate 主题、自适应指标和 Powerline 行渐变 | 隐藏已完成代理、保留失败代理、最多六行；实时活动需单独开启采集 |
| [`quota-cost`](../examples/schemes/quota-cost.json) | 对齐的额度／重置列、上下文／开销及费用／速率行；ember 主题、自适应指标和 Powerline 行渐变 | 宿主额度与费用观测；费用速率保留其规定的时间口径 |
| [`narrow-terminal`](../examples/schemes/narrow-terminal.json) | 模型、短目录、上下文和任务计时；自动布局、紧凑分隔和终端主题 | 状态、名称、上下文和耗时；短自适应指标及优先级适配 |
| [`light-readable`](../examples/schemes/light-readable.json) | 两行模型、目录、Git、上下文、任务计时与费用；light 主题、自适应指标和 Powerline 行渐变 | 状态、名称、模型、上下文、耗时和任务；适配浅色终端背景 |

方案包含紧凑数字、稳定实例 ID、优先级及宽度限制，保留输出语言、子代理启用选择和 Git 比较基线。它们不会开启采集、授权外部来源、改变独立宿主偏好或替换项目绑定。内置更新不覆盖已保存副本；实时／宿主数据缺失时保留各组件原有的不可用处理。

Powerline 是显示选项，不是必要条件。希望保留所选方案的组件和颜色而使用紧凑分隔时，可在保存前设置 `separator-style compact`；此时 Powerline 背景不生效，普通前景色及适用的前景渐变仍生效。终端背景和字体独立控制。[外观设置](APPEARANCE.zh-CN.md)。

六种原有预设也继续可用：`minimal`、`developer`、`monitoring`、`multi-agent`、`left-right`、`repeated-metrics`。它们保留已选择的全局主题及分隔符，与上方概念表一致。

<a id="原有预设"></a>

### 原有预设

| 预设 | 适用场景 | 主栏布局 | 子代理默认 |
| --- | --- | --- | --- |
| `minimal` | 精简日常视图 | 自动：模型／effort、目录、上下文剩余、任务计时 | 原有五项 |
| `developer` | Git、累计用量和会话费用 | 两行：模型／目录／Git；上下文剩余／tokens／计时／费用 | 原有五项 |
| `monitoring` | 检查额度、重置、缓存和会话统计 | 三行：上下文／额度；重置／缓存／TTL；费用／时长／API 时长／请求／缓存未命中 | 原有五项 |
| `multi-agent` | 有界代理行及任务标签 | 两行：模型／目录／Git；上下文剩余／tokens／计时 | 原有五项，隐藏 completed，最多六行，任务宽度 48 |
| `left-right` | 左右分区 | 一行：模型／effort、Git、spacer、上下文剩余 | status、name、spacer、elapsed |
| `repeated-metrics` | 比较同一指标的两种格式 | 两份输入 token 实例，分别为完整／紧凑格式 | 原有五项 |

这些预设保留已选择的全局主题及分隔符，并按默认值重建子代理行。预设与完整方案都会展开为可编辑配置；可选数据仍可能不可用。

## CLI 与分享

```sh
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set theme dark
claude-statusline config set separator-style compact
claude-statusline config enable session-cost
```

CLI 预设应用修改用户默认，并要求当前程序已接入且拥有 Claude 配置。接入前保存请使用 `setup`。编辑器保存遵循页面显示的用户／方案／项目目标。

下载上表链接的 JSON 文件，审阅后使用单方案导入／导出命令：

```sh
claude-statusline config profile import daily-development.json --dry-run
claude-statusline config profile import daily-development.json
claude-statusline config profile activate daily-development
claude-statusline config profile export daily-development my-scheme.json
```

当前生成文件使用当前单方案格式与显示 schema，不包含项目绑定、采集开关、宿主偏好或外部能力授权。当前版本见[协议与 schema 版本](reference/cli.zh-CN.md#协议与-schema-版本)。导入保存为命名方案；激活与项目绑定仍需明确执行。旧捕获方案文件的格式及产物身份保留在[首次设置图库](images/setup-appearance/README.zh-CN.md)和[自适应场景图库](images/adaptive-row-scenarios/README.zh-CN.md)。

## 相关指南

- [命名方案与项目绑定](PROFILES.zh-CN.md)
- [外观](APPEARANCE.zh-CN.md)
- [配置编辑器](EDITORS.zh-CN.md)
