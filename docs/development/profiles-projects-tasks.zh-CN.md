<a id="显示方案项目选择与任务检查"></a>

# 方案、项目选择与任务检查

[English](profiles-projects-tasks.md) | **简体中文**

用户契约见[方案管理](../PROFILES.zh-CN.md)和[任务详情](../TASK_DETAILS.zh-CN.md)。原始实现与发布证据见[交付记录](history/deliveries/profiles-projects-tasks.zh-CN.md#显示方案项目选择与任务检查)。

## 架构与契约

Core 定义完整显示方案、稳定身份、编辑目标、共享编辑器管理器及纯任务详情投影。Platform 解析原生目录身份并提供有界只读文件能力。CLI 协调既有配置事务和读取模型。外部 TUI 与原生 Client 适配同一个方案管理器；原生任务详情使用独立窗格，仍属于既有 native Mod。

`profiles_read`、`profiles_apply`、`profile_import`、`profile_export` 和 `task_details` 可接收显式目标，结果包含编辑目标、匹配根、回退原因及共享绑定。原有不带目标的操作维持用户默认行为。生成的原生请求／解析器对全部操作进行实际后端验收。

版本 1 集合在同一个用户文件内保存方案和项目绑定。方案仅保存 DisplayDraft；既有默认文件保留独立快照和降级路径。新增文件纳入现有恢复允许列表及导出保护。

目标 revision 覆盖方案库、选定配置、安装身份和目标。另存为与绑定在同一次事务中完成；读取不创建方案库。渲染解析不加载管理模块，不查询 Git 或网络。关闭自定义代理显示时不输出覆盖行，即使其他项目需要共用入口，也保留宿主默认行。

## 只读任务证据

检查通过有界诊断文件能力读取已知会话的任务／运行状态文件，再复用生命周期解码、快照指标及计时规则。不调用采集器、不协调绑定、不建立新的生命周期存储。

会话身份必须明确；当前指针、唯一 prompt 别名和已发布归属决定选择。缺失／歧义关联、未来快照、等待不完整和计时未知保持可区分。父子关系来自可归属元数据，缺失或循环关系不会被构造成完整树；每个来源保留自身观测时间。

原生按需代理名称单独提供，只与可归属 ID 关联且不持久化。跨文件快照非原子，既有有界存储不代表完整历史；界面支持按各终端宿主验证。

完整的[交付记录](history/deliveries/profiles-projects-tasks.zh-CN.md#显示方案项目选择与任务检查)已归入开发历史。下方链接直达迁移章节。

- <a id="验证记录"></a><a id="验证与交付记录"></a>[验证与交付记录](history/deliveries/profiles-projects-tasks.zh-CN.md#验证与交付记录)
- <a id="修正与恢复"></a>[修正与恢复](history/deliveries/profiles-projects-tasks.zh-CN.md#修正与恢复)
- <a id="既有缺口"></a>[既有缺口](history/deliveries/profiles-projects-tasks.zh-CN.md#既有缺口)
