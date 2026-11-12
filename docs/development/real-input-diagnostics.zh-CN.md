# 真实输入诊断与宿主字段覆盖

[English](real-input-diagnostics.md) | **简体中文**

本页说明真实输入诊断、宿主字段解释与诊断证据边界。[用户指南](../DIAGNOSTICS.zh-CN.md)定义命令契约；原始交付证据见[交付记录](history/deliveries/real-input-diagnostics.zh-CN.md#真实输入诊断与宿主字段覆盖)。

## 架构与契约

core 负责宿主字段解释、配置原因、中性的渲染追踪和真实输入报告组装；既有示例适配器把中性布局结果转换为示例专用原因码，生产渲染仍按需开启追踪。cli 负责显式输入解析、显示／设置只读访问及现有存储适配；platform 提供有大小限制的文件读取，不提供写入或进程能力。

诊断不调用会创建安装锁的 `ConfigurationService.read`，而是独立只读显示和设置文件。运行时适配器不调用 collector、事务服务、目录扫描、协调、子进程或网络客户端。已发布的请求／费用关联有独立的纯快照解析器；普通采集继续保留现有协调行为。已有任务快照可以直接使用生产计时格式化逻辑，无须采集转录。

两个工作树字段共存时保留既有会话名称优先级，普通 Git 工作树使用独立标签。缓存原因仍是宿主判断的可能原因，详细数量和时间保留在诊断报告中。

## 证据与边界

合成的[宿主输入样本](../../tests/fixtures/diagnostics/host-input.json)依据 2026-10-19 检查的官方状态栏文档，不含真实会话数据。冻结 Python 样本与归档证据不变；比较器只在明确路径接受新增操作、工作树元数据变化和新增原因组件。

测试覆盖 CLI／文件／stdin／后端、当前全部语言、重复实例及布局、缺失／无效／零值、会话与 prompt 隔离、陈旧／未来证据及读取前后存储内容一致。当前语言覆盖由[翻译指南](i18n.zh-CN.md)维护。真实与示例输出复用拟合实现；另行验证生成的 Mod 协议解析及编辑器保存新增组件的通用流程。

已知限制：跨来源快照不是全局原子的，用量缓存没有采集时间，不刷新转录或重建历史；缺少提交对身份时无法读取 branch-diff。[#96](https://github.com/fbincon/claude-code-statusline/issues/96)既有实机／桌面／精确宿主声明缺口仍未验证。版本专属验收决定记录在交付记录中；任何新增功能或自动化失败仍阻断发布。

完整的[交付记录](history/deliveries/real-input-diagnostics.zh-CN.md#真实输入诊断与宿主字段覆盖)已归入开发历史。下方链接直达迁移章节。

- <a id="验收记录"></a>[验收记录](history/deliveries/real-input-diagnostics.zh-CN.md#验收记录)
- <a id="工程候选"></a>[工程候选](history/deliveries/real-input-diagnostics.zh-CN.md#工程候选)
- <a id="发布验收--2026-10-20"></a>[发布验收 — 2026-10-20](history/deliveries/real-input-diagnostics.zh-CN.md#发布验收--2026-10-20)
- <a id="公开交付"></a>[公开交付](history/deliveries/real-input-diagnostics.zh-CN.md#公开交付)
