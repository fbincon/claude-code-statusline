# 完整显示方案

[English](SCHEMES.md) | **简体中文**

在任一编辑器用 Ctrl+P 打开快速配置，或运行[首次设置向导](SETUP.zh-CN.md)。选择方案、查看来源要求、预览主栏／子代理行，并调整外观。审阅页可继续编辑、保存当前目标或另存命名副本。另存副本保留原有未保存草稿；保存共享方案时会显示关联项目数量及路径。

| ID／可分享 JSON | 主栏 | 子代理与要求 |
| --- | --- | --- |
| [`daily-development`](../examples/schemes/daily-development.json) | 模型／推理强度、目录、Git、上下文与任务计时；第二行会话费用默认关闭，可自行启用 | 使用现有代理模板；依赖 Claude 输入、本地 Git 与任务观测 |
| [`agent-focus`](../examples/schemes/agent-focus.json) | 任务计时、上下文、Git；有数据时显示运行状态、任务进度与代理数量 | 状态、名称、模型、上下文、代理耗时、任务；隐藏已完成代理、保留失败代理、不限制行数 |
| [`quota-watch`](../examples/schemes/quota-watch.json) | 上下文、五小时／周额度及重置时间；另行展示可用的费用、开销与缓存 | 需要已观测的宿主字段；缺失／过期额度省略，绝不转换成零 |

新方案默认短标签、紧凑数字、终端配色和紧凑分隔。快速配置可选深色／浅色／终端主题，也可在设置中调整。Powerline 为可选项，默认不需要特殊字体。ASCII 任务／代理标记保留状态含义（`ok`、`run`、`fail`、`stop`、`pending`、`wait`）；任务计时与代理耗时属于不同范围。

每套方案展开为普通可编辑实例，具有稳定身份、优先级与宽度限制。选择方案保留输出语言、子代理启用选择与 Git 比较基线；不会开启采集、添加网络或命令来源、改变独立宿主偏好或替换项目绑定。运行状态／进度／数量需要单独开启实时指标。内置方案更新不会覆盖已保存副本。

原六种预设 ID 与展开行为继续保留：`minimal`、`developer`、`monitoring`、`multi-agent`、`left-right`、`repeated-metrics`。新的完整方案额外定义全局外观；明确保存前不会改变用户默认。

## CLI 与分享

```sh
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set theme dark
claude-statusline config set palette default
claude-statusline config enable session-cost
```

CLI 预设应用仍要求当前程序已接入并拥有宿主配置。接入前保存请使用 `setup`。编辑器保存遵循页面显示的用户／方案／项目目标。

从上表仓库链接下载 JSON 文件，审阅后使用既有单方案导入／导出命令：

```sh
claude-statusline config profile import daily-development.json --dry-run
claude-statusline config profile import daily-development.json
claude-statusline config profile activate daily-development
claude-statusline config profile export daily-development my-scheme.json
```

示例使用单方案格式 1 和显示 schema 9，不包含项目绑定、采集开关、宿主偏好或外部能力授权。导入保存为命名方案；激活与项目绑定仍需明确执行。参见[方案行为](PROFILES.zh-CN.md)、[外观控制](APPEARANCE.zh-CN.md)及[安装产物样例来源](images/setup-appearance/README.zh-CN.md)。
