# 自适应指标、连续行背景与场景方案

[English](adaptive-row-scenarios.md) | **简体中文**

本页说明自适应指标适配、连续行背景与五个显示场景。实现与发布证据见[交付记录](history/deliveries/adaptive-row-scenarios.zh-CN.md#自适应指标连续行背景与场景方案)。

## 共享表示与最终着色

显示 schema 17 增加 `presentation=adaptive` 与可选的 `powerline.row_background_gradient`；编辑器协议传输对应描述。portable／profile 外层格式保持版本 1。旧文件只在内存中规范化，读取不写入，也不会启用新行为。更早 schema 拒绝新选项；显式写入保留修订检查、锁、备份和原子发布。

自适应指标保留结构化百分比及已用／剩余文本。固定行依次缩短可缩减的内置标签、将条缩至四格、转数字，再按既有优先级省略；各阶段先缩减低优先级项。自定义标签和图标保持完整，数字表示仍放不下则省略。`max_width`、分组和两个作用域共用规则。自动布局保留正常换行，仅对超过整行宽度的单元缩减。真实输入诊断和样例解释同样记录组件自身宽度限制下的缩减阶段；整项省略记为 `width_omitted`，而不是数据为空。

连续背景须显式开启，只在有色 Powerline 输出中生效。既有 `color_mode=continuous` 继续表示调色板序列连续。背景在可见性、拟合、分组和换行确定后着色。共享背景组作为一个块；组件／主项显式背景及独立背景渐变覆盖行渐变并切断区段。spacer 切断区段，对齐补白不着色、不占渐变长度。对齐单元保留色块元数据，最后对整行着色。分隔符与端帽使用实际边缘颜色；告警前景优先并受对比度保护，链接和完整字素保持完整。

## 显示场景

新增五个稳定身份，将原有九项选择扩充为十四项：

| ID | 显示意图 |
| --- | --- |
| `powerline-daily` | ocean 日常工作、连续背景与自适应上下文 |
| `agent-workbench` | slate 任务／活动分组和代理行 |
| `quota-cost` | ember 配额／重置对齐、上下文／支出分组和费用速率 |
| `narrow-terminal` | 紧凑 ASCII 显示、正常换行与四格自适应条 |
| `light-readable` | light 主题、浅色连续背景与受保护的告警颜色 |

Core 定义统一供安装引导、双编辑器、CLI 及[可移植示例](../../examples/schemes/)使用。选择预览候选，接受作为一次草稿历史操作；保留当前显示语言和子代理启用状态。方案不安装工具、不导入凭据、不绑定本地来源、不启用采集。缺失观测保持缺失；原三个完整方案的身份和显示选择保留。

[安装产物渲染样例](../images/adaptive-row-scenarios/README.zh-CN.md)展示全部五个场景。窄终端方案使用紧凑 ASCII 标识，不再叠加标签，使实际目录值在 40 列仍可见；四格自适应条保留完整百分比及剩余含义。

## Native 显示与本地化

完整编辑状态留在宿主。props、外层 Pane 和 Client 绘制树分别保留 48,000 字符／10,000 值／深度 16 的预检，保留可见分页、选中内容、Unicode 和有色预览。容量与语言覆盖分别由 [native-capacity.md](native-capacity.zh-CN.md) 和 [i18n.md](i18n.zh-CN.md) 维护。保存成功、等待及未知结果恢复与绘制失败保持独立。

## 受支持的签名验证

使用固定开发工具链与下载的精确版本包：

```bash
npm run release:signatures -- --version 3.14.0 --commit FULL_SOURCE_SHA --artifact /path/to/fbincon-claude-code-statusline-3.14.0.tgz --output /path/to/new-signatures.json
```

工具复用 npm 11.19.0 的 TUF、registry 签名和 Sigstore 验证，检查包 SHA-512 与所有文件，并把 provenance 绑定到精确仓库、源提交、tag 和发布工作流。六个内置公开依赖分别验证签名和完整性，所带文件与签名上游归档逐项比较。四个私有工作区包由签名外层归档和完整文件清单覆盖，不将它们当作未发布 registry 版本查询。依赖未发布 provenance 时明确记录缺失，外层产品包则必须有源证明。

这是明确限定范围的专用流程。原生 `npm audit signatures` 仍会遍历私有内置工作区依赖，可能返回 E404，不记作通过。公开发布新增固定工具链签名任务，与原六项公开下载任务并列。

完整的[交付记录](history/deliveries/adaptive-row-scenarios.zh-CN.md#自适应指标连续行背景与场景方案)已归入开发历史。下方链接直达迁移章节。

- <a id="验收与交付"></a>[验收与交付](history/deliveries/adaptive-row-scenarios.zh-CN.md#验收与交付)
- <a id="本地候选证据"></a>[本地候选证据](history/deliveries/adaptive-row-scenarios.zh-CN.md#本地候选证据)
- <a id="最终来源与发布身份"></a>[最终来源与发布身份](history/deliveries/adaptive-row-scenarios.zh-CN.md#最终来源与发布身份)
- <a id="检查重试与证据边界"></a>[检查、重试与证据边界](history/deliveries/adaptive-row-scenarios.zh-CN.md#检查重试与证据边界)
- <a id="发布签名与公开字节"></a>[发布、签名与公开字节](history/deliveries/adaptive-row-scenarios.zh-CN.md#发布签名与公开字节)
- <a id="实际机器与收尾"></a>[实际机器与收尾](history/deliveries/adaptive-row-scenarios.zh-CN.md#实际机器与收尾)
