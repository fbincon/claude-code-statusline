# 外观、样例场景与显式文件诊断

[English](appearance-preview-diagnosis.md) | **简体中文**

本页说明外观归属、确定性预览场景与显式文件诊断。原始实现与发布证据见[交付记录](history/deliveries/appearance-preview-diagnosis.zh-CN.md#外观样例场景与显式文件诊断)。

## 职责与行为

Core 维护主题注册表、渐变预设、会话内预览选择、配色候选、文件诊断展示及渲染决策。Platform 保留有界只读文件访问；CLI 解析指定文件并编排诊断。双编辑器适配相同纯状态。原生投影仅发送可见文本和样式片段，候选、场景定义和完整报告留在宿主。

八个主题保留 `classic`、`dark`、`light`、`terminal`，新增 `ocean`、`ember`、`slate`、`blossom`。十一个渐变保留原有三个，新增 `glacier`、`lagoon`、`flame`、`copper`、`steel`、`sage`、`petal`、`twilight`。预设保存展开后的 RGB 色标。颜色候选先预览，接受仅改变显示草稿；显示 Save 与宿主偏好及来源授权继续独立。

十四个确定性场景替换观测：正常、警告、严重、零值、缺失、来源过期／失败、长内容、三种 Git 状态以及零／二／24 个代理。Ctrl+V 切换场景，Ctrl+W 切换自动／40／80／120 列，Ctrl+N 推进预览行。实际宽度不超过预览空间。场景不改变草稿，不启用采集。

`diagnose_file` 使用当前草稿、所选作用域、可选采集时间读取明确指定的路径，默认 `include_local:false`。已有 CLI `diagnose` 保留默认加入缓存及 `--input-only` 开关。文件操作不保存、不采集、不修复、不启动来源。报告标明来源、输入／诊断时间、会话身份和证据范围。Esc 从报告返回表单，再返回保留的编辑器。

## 接口与兼容

主题、样例预览与文件诊断使用当前显示 schema 和编辑器协议。`diagnose_file` 支持 preview／explain 的可选 `scenario` 元数据，以及逐行可选 `style_reasons`，携带稳定原因码及背景主实例身份。Portable／profile 封装、来源存储、runtime 和 UI preferences 保持各自版本。旧 schema 读取只在内存中规范化，显式保存保留备份／迁移；旧 schema 不接受新主题。升级时安装匹配的前后端资源；降级前恢复兼容备份。当前接口版本见 [CLI 参考](../reference/cli.zh-CN.md#协议与-schema-版本)；历史引入值见[交付记录](history/deliveries/appearance-preview-diagnosis.zh-CN.md#验证与交付)。

样式原因来自生产渲染，区分颜色关闭、背景渐变不适用、组主实例控制背景、阈值前景、ANSI 转换及中性背景对比度保护。样例证据始终是合成数据，不证明现场可用性。文件诊断保留既有的历史时间过滤和逐代理证据规则。

完整的[交付记录](history/deliveries/appearance-preview-diagnosis.zh-CN.md#外观样例场景与显式文件诊断)已归入开发历史。下方链接直达迁移章节。

- <a id="验证与交付"></a>[验证与交付](history/deliveries/appearance-preview-diagnosis.zh-CN.md#验证与交付)
- <a id="源码与必需门禁"></a>[源码与必需门禁](history/deliveries/appearance-preview-diagnosis.zh-CN.md#源码与必需门禁)
- <a id="本地观察与测试机恢复"></a>[本地观察与测试机恢复](history/deliveries/appearance-preview-diagnosis.zh-CN.md#本地观察与测试机恢复)
- <a id="已发布渠道"></a>[已发布渠道](history/deliveries/appearance-preview-diagnosis.zh-CN.md#已发布渠道)
