# SHOWCASE-01 图库

[English](README.md) | **简体中文**

[操作指南](../../SHOWCASE.zh-CN.md)使用已发布的 **v3.16.0** 复现这些场景。先下载、检查并导入对应方案，预览后再激活。已批准的视觉基线使用经典分隔符和默认调色板，各类型采用不同的柔和前景渐变，不用 Powerline。深色背景采用 Classic 主题，浅色背景采用 Light。保留原始模型名、legacy 格式及有实际含义的状态符号，去掉额外的 `M`／`D`／`G` 装饰。[采集清单](captures.json)记录产品／工具身份、输入、方式、尺寸、字体、转换及文件摘要；[验收记录](../../development/showcase.zh-CN.md)与图片本身分开。

[视觉修订记录](../../development/showcase.zh-CN.md#visual-refinement)跟踪全部 14 张 PNG 和六段 GIF 的重新采集与验证，记录新采集自己的状态和回执，同时保留之前的采集身份。同类型组件在不同场景、主栏和子代理行共用渐变；浅色变体加深相同色相。方案的具体选择见[格式基线](../../SHOWCASE.zh-CN.md#visual-baseline)。

## 五套显示场景

十张中英文场景图使用已安装生产渲染器处理明确的固定观察值，不表示真实账户用量。窄终端图刻意使用 40 列，其他精选图使用其记录宽度。深色／浅色／无色验证变体见清单。

### 日常开发

![中文四行日常状态栏，使用经典分隔符，为模型、目录、Git、上下文、额度、token 和任务时间设置不同渐变](zh-CN/daily.png)

[方案](../../../examples/showcase/daily.json) · [英文图片](en/daily.png)。派生自 `daily-development`，十项指标分四行；模型的 Petal、目录的 Sunset 和剩余上下文的 Ocean 是统一组件配色的三个基准，本场景未启用会话费用。

### 代理工作台

![中文任务及活动组，使用经典分隔符，独立子代理行按相同组件类型共用渐变](zh-CN/agents.png)

[方案](../../../examples/showcase/agents.json) · [英文图片](en/agents.png)。派生自 `agent-workbench`；任务时间与代理计时保持不同作用域。

### 额度与成本

![中文额度和重置时间行，使用经典分隔符，包含彩色的上下文、花费及费用速率分组](zh-CN/quota.png)

[方案](../../../examples/showcase/quota.json) · [英文图片](en/quota.png)。派生自 `quota-cost`；额度值及阈值颜色是样本，不是账单证据。其他普通场景保留组件渐变。

### 窄终端

![中文四十列状态栏，三条主行带经典分隔符、自适应上下文指示及独立目录行](zh-CN/narrow.png)

[方案](../../../examples/showcase/narrow.json) · [英文图片](en/narrow.png)。派生自 `narrow-terminal`；进度条缩短时仍保留可读数值含义。

### 浅色终端

![中文浅色背景状态栏，使用经典分隔符及统一前景渐变的深色版本](zh-CN/light.png)

[方案](../../../examples/showcase/light.json) · [英文图片](en/light.png)。派生自 `light-readable`；相同组件色相为浅色背景加深，使用 Light 主题和默认调色板，不启用 Powerline 背景。

## 简短操作演示

编辑器动图重建实际已安装编辑器的 PTY 关键帧，彩色预览使用固定样本，控件保持中性。每个选中帧停留 **1.4 秒**，属于编辑后的操作演示，不是实时录屏或性能测量。

### 配置与保存

![中文配置演示，复制一个指标、撤销和重做后保存并重新打开，保留彩色状态栏预览](zh-CN/configure.gif)

[英文动图](en/configure.gif) · [步骤与取消行为](../../SHOWCASE.zh-CN.md#edit)。

这段练习通过复制模型指标展示撤销和重做，再保存并重新打开该草稿。重复项仅属于这段教程；完成后恢复原始日常场景，再进行其他走查。

### 复用与历史

![中文编辑器演示，展示彩色状态栏预览、视觉复用及草稿历史控件](zh-CN/reuse.gif)

[英文动图](en/reuse.gif) · [样式和整组复用](../../DRAFT_HISTORY.zh-CN.md)。

### 任务与子代理

![中文蒙太奇：已完成任务输入回放后接离线任务查看器，保留两个已完成代理及不可用的活跃计时证据](zh-CN/tasks.gif)

[英文动图](en/tasks.gif) · [任务查看步骤](../../SHOWCASE.zh-CN.md#tasks)。

任务蒙太奇有两个独立归属的来源：先通过已安装渲染器回放完成任务观察值，再接实际查看器读取复制状态的 PTY 帧。主任务结束于 14 秒，代理为 5／7 秒。这不是原 statusline 回调。查看器保留已观察到的 `active_unknown`、`runtime_disabled` 和 `incomplete`。实际 CLI 会话费用为 0.00199048 美元；显示 `$0.00` 是保留两位小数的结果，不是免费声明。[清单](captures.json)记录双方来源、转换及关键帧时序。

## 来源与版本

![中文来源管理页，以中性控件显示隔离来源状态、明确审查和刷新动作，下方为彩色固定样本状态栏预览](zh-CN/sources.png)

[英文来源页](en/sources.png) · [来源走查](../../SHOWCASE.zh-CN.md#sources)。

![中文版本操作和诊断，以及彩色固定样本状态栏预览](zh-CN/versions.png)

[英文版本图](en/versions.png) · [版本走查](../../SHOWCASE.zh-CN.md#versions)。彩色预览旁的版本控件保持中性；精确范围及可能的组合记录在清单中。遇到多个前缀的警告时，应明确选择目标 `--prefix`。在原始已是当前 3.16.0 的安装中，另行 dry-run 返回 `unchanged: true` 和 `artifact_verified: false`；彩色预览不证明新下载包检查通过。

## 来源与限制

公开包源码为 `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0`，tgz SHA256 为 `2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a`。采集工具身份独立保留。原始私有会话日志、凭据和偏好不公开；输入脱敏和渲染转换均记录。

本次视觉修订复用保留的任务观察，不计划新增付费调用。原始两项顶层任务按 CLI 报告合计 0.00224378 美元，仍属于原执行证据。先前 CLI 灰色输出继承了 `NO_COLOR=1`；重新采集彩色素材只在隔离录制环境中移除该继承设置，产品的 `NO_COLOR` 行为不变。

任何图片都不会授予来源权限或启用采集。连续行背景需要彩色 Powerline，见[外观指南](../../APPEARANCE.zh-CN.md)，本图库不采用该视觉选择。旧截图在[图片索引](../README.zh-CN.md)中保留原文件和身份。

自动断言、代理视觉检查、终端重建及真人／实体验收分开记录。本图库不构成新的真人可用性研究；[issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口仍未验证。
