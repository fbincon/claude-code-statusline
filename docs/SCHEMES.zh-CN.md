# 完整显示方案

[English](SCHEMES.md) | **简体中文**

在任一编辑器用 Ctrl+P 打开快速配置，或运行[首次设置向导](SETUP.zh-CN.md)。选择方案、查看来源要求、预览主栏／子代理行，并调整外观。审阅页可继续编辑、保存当前目标或另存命名副本。另存副本保留原有未保存草稿；保存共享方案时显示关联项目数量及路径。

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

六种原有预设也继续可用：`minimal`、`developer`、`monitoring`、`multi-agent`、`left-right`、`repeated-metrics`。它们与完整方案的区别是保留已选择的全局主题及分隔符。**命名方案（profile）**是用户保存的显示配置，可从任一类型开始，再分享或绑定项目。[方案行为](PROFILES.zh-CN.md)。

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

当前生成文件使用单方案格式 1 和显示 schema 17，不包含项目绑定、采集开关、宿主偏好或外部能力授权。导入保存为命名方案；激活与项目绑定仍需明确执行。旧捕获方案文件的格式及产物身份保留在[首次设置图库](images/setup-appearance/README.zh-CN.md)和[自适应场景图库](images/adaptive-row-scenarios/README.zh-CN.md)。
