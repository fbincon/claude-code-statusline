# 扩展实现与验收

[English](extensions.md) | **简体中文**

本页说明扩展注册、校验、数据源管理、命令执行与链接处理契约。配置与示例见[扩展指南](../EXTENSIONS.zh-CN.md)；原始实现与发布证据见[交付记录](history/deliveries/extensions.zh-CN.md#扩展实现与验收)。

## 职责与契约

- core 验证独立版本的数据源、标量观测、范围、受限 JSON Pointer 与新鲜度。显示引用使用不透明本机绑定，便携导入导出明确清除绑定 ID。
- 现有组件目录统一声明受影响组件的能力，共享表单、CLI 字段校验及配置解释使用相同描述；旧有无作用格式覆盖保持可读。
- platform 限制文件读取及进程输出。POSIX 使用进程组，Windows 使用关闭即终止的 Job Object，并在挂起状态将工具进程加入后恢复执行；静态监督程序不把参数插入 Shell 源码。
  POSIX 通过 `execve` 交接执行，避免 `execvp` 在无法识别可执行格式时隐式回退至 `/bin/sh`；旧 Node 运行时也使用相同规则，参见 [exec 接口契约](https://man7.org/linux/man-pages/man3/exec.3.html)。
  Windows 监督程序使用独立 Node 进程和现有原生适配器，避免每条命令启动 PowerShell 并编译 C#。用户命令通过独立序列化的环境块获得最小环境及调用方的 HOME，不继承完整宿主环境。包管理先进入独立恢复副本再加载原生代码，替换原安装时不会锁住自身适配器。
- cli 管理独立注册表事务、有时限的刷新任务、修订检查、观测缓存和 GitHub 查询。每个任务有独占执行标记、期限、取消状态与源修订。渲染不启动刷新；本地 JSON 渲染可维护最后已知值缓存，诊断只读且不发布缓存。
- 双编辑器复用同一数据源状态机，前端只适配绘制与通信。源保存、显示 Save 和宿主 Apply 分开。
- 链接目标附着于带样式的字素与预览片段，截断和换行重新构造闭合 OSC 8 区间；分隔符与装饰不继承前一链接。外部输入不能注入原始控制序列。

完整的[交付记录](history/deliveries/extensions.zh-CN.md#扩展实现与验收)已归入开发历史。下方链接直达迁移章节。

- <a id="已完成的验收与交付"></a>[已完成的验收与交付](history/deliveries/extensions.zh-CN.md#已完成的验收与交付)
- <a id="源码与自动化门禁"></a>[源码与自动化门禁](history/deliveries/extensions.zh-CN.md#源码与自动化门禁)
- <a id="安装行为与证据边界"></a>[安装行为与证据边界](history/deliveries/extensions.zh-CN.md#安装行为与证据边界)
- <a id="公开交付"></a>[公开交付](history/deliveries/extensions.zh-CN.md#公开交付)
- <a id="修正与恢复"></a>[修正与恢复](history/deliveries/extensions.zh-CN.md#修正与恢复)
