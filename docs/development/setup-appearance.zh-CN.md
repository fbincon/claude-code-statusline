# 首次设置与完整外观实现

[English](setup-appearance.md) | **简体中文**

本页说明设置服务、共享设置 reducer、完整外观预设及 Powerline 规则。原始验收与发布证据见[交付记录](history/deliveries/setup-appearance.zh-CN.md#首次设置与完整外观实现)。

## 实现

- CLI 设置服务以无写入探针、无安装锁的方式检查文件，对已审阅资源记录指纹，先保存用户默认显示，再独立应用接入。`ConfigurationService.saveDisplay` 无需已有接入，也不应用宿主偏好。安装器在文件锁内复核审阅资源，持久化备份与恢复日志准确保留部分提交结果。
- 共享纯状态设置 reducer 与现有 Quick setup reducer 驱动终端向导。两种配置编辑器共用另存副本流程与所有外观字段，原生副本由生成器产生。宿主 Apply 保持独立，共享方案保存展示关联项目。
- 既有预设注册表扩展三套完整方案，单方案 JSON 示例由生成器确定性输出，不包含项目绑定、宿主偏好或采集授权。已保存副本保留独立身份，不随内置方案自动刷新。
- 显式行、自动换行、spacer 与子代理共用 Powerline 几何规则。颜色序列在宽度适配后分配，作用域限定在一次渲染中。默认保留旧语义配色与几何行为；ASCII 任务／代理标记保留可区分的状态含义。

## 接口与兼容

当前显示 schema 与编辑器协议版本见[协议与 schema 版本](../reference/cli.zh-CN.md#协议与-schema-版本)。

完整的[交付记录](history/deliveries/setup-appearance.zh-CN.md#首次设置与完整外观实现)已归入开发历史。下方链接直达迁移章节。

- <a id="验证与交付"></a>[验证与交付](history/deliveries/setup-appearance.zh-CN.md#验证与交付)
- <a id="发行身份与自动化门槛"></a>[发行身份与自动化门槛](history/deliveries/setup-appearance.zh-CN.md#发行身份与自动化门槛)
- <a id="安装产物与捕获证据"></a>[安装产物与捕获证据](history/deliveries/setup-appearance.zh-CN.md#安装产物与捕获证据)
- <a id="公开交付"></a>[公开交付](history/deliveries/setup-appearance.zh-CN.md#公开交付)
- <a id="修正与恢复"></a>[修正与恢复](history/deliveries/setup-appearance.zh-CN.md#修正与恢复)
