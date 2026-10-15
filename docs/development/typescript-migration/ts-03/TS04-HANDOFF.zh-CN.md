# TS-04 接口与断言交接

[English](TS04-HANDOFF.md) | **简体中文**

准入更新（2026-10-15）：**TS-03／03-F 为 DONE；TS-04 为 NOT_STARTED**。
[关闭记录](README.zh-CN.md#closure-2026-10-15)绑定既有功能、CI 和源码证据。
按 [D06 修订](../ts-02/D06.zh-CN.md#applicability-amendment-2026-10-15)，性能不再阻塞准入。
最新 D06 仍为 **FAIL：104 通过／60 失败／28 不确定**；后续优化归入 TS-06 之后的
[PERF-01](../../performance/perf-01.zh-CN.md)。

本文为后续 TS-04 任务记录接口及剩余断言。本次计划调整不启动实现、不切换已安装的 Python
产品，也不代表外部编辑器或安装流程已验收。

## 后端入口与所有权

使用私有 workspace 固定的 Node 24.21.0 构建，执行 `node packages/cli/dist/src/entry.js`。内部绑定为 `LaunchSpec { executable, args }`：executable 指向固定 Node，args 以编译后入口开始。配置所有权比较完整绑定，继续读取规范的旧单可执行文件绑定。保留 TS-02 的 Windows v2 重启域标识。

后端提供全部配置命令、UI protocol 11、runtime protocol 2 及 v1 读取／观察兼容、主行渲染、子代理 NDJSON、生命周期 hook 和 slash hook。保持 display schema 8、生命周期 schema 4 及现有存储格式。界面偏好与输出语言独立；读取／预览／dry-run 不重写配置，apply 在获取事务锁后检查修订及所有权，重复保存不产生备份。

## 编辑器与安装工作

- 将两个已安装 Mod 的绑定调整为 executable 加 args。当前清单及已安装 Python 绑定保持原样；临时测试绑定已验证两个 Mod 的原始协议模块以及 Claude Code 2.1.296 主机进程 API 能连接 TS。
- 为 `EditorLauncher` 实现真实外部终端适配，保留更新／无变化／取消／中断／超时／错误结果、有界子进程处理、终端恢复以及调用方的后端／配置目录绑定。
- 迁移 install/doctor/uninstall、设置／资源／marketplace 所有权、启动器选择与结果桥接；验证新装／重复安装、Python 升级、中断更新、恢复、卸载和降级，并保留无关设置。
- 复用现有 Client 的纯编辑器逻辑；Node 文件及进程操作放在后端或主机 hooks，不能进入 Client 模块。

## 测试责任

[机器可读交接清单](../../../../tools/migration/ts-03/ts04-handoff.json)包含 **45 项完整的外部 TUI／安装／终端测试**，以及 **八项混合测试中剩余的集成断言**。每项保留固定基线测试 ID、责任阶段和具体待验证行为。对应 TS-03 后端断言已有测试，这些延期不能记为终端行为通过。

需要验证真实编辑器保存／取消／冲突、导入审阅接受及滚动、本地化搜索／表单、25 种语言组合、拒绝编辑后的键盘选择、尺寸变化、颜色能力／默认色、截屏单元格颜色和 PTY 字节流边界。两个编辑器均需连接已安装的 TS 后端，包括过期响应及保存结果不确定的处理。

## 证据与发布门槛

后续实施 TS-04 时，参照 [TS-03 实施记录](README.zh-CN.md)、其中绑定源码的验证摘要及具名替代测试。执行 `npm test`、`npm run generate:check`、`npm run migration:inventory -- --complete`、两个官方 Mod 测试及必需的跨平台 CI，并补齐编辑器／安装／恢复覆盖。精确采集次数、现有超时和资源有界契约仍属于功能／稳定性要求。

完整 D06 测量及预算达标不再作为 TS-04 准入或退出条件。保留历史失败／不确定结果；单样本 `--validate` 报告仍只证明夹具有效。本次纯文档任务不运行上述本地实施套件或基准。

实体设备、休眠和人工桌面检查继续作为已批准的发布前门槛。Claude Code 2.1.296 运行验证不能代替仍不可用的精确主机构建类型声明检查。TS-03 不创建 TS 版本标签或 Release。
