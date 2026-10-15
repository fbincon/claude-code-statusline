# TS-04 双编辑器、安装与恢复

[English](README.md) | **简体中文**

状态：**IN_PROGRESS**，2026-10-15（Asia/Shanghai）；执行者：Codex。
[迁移总计划](../../typescript-migration.zh-CN.md)维护阶段状态。
已批准的执行计划只使用隔离包与配置，保留维护者现用 Python 安装；恢复使用显式命令，
doctor 保持只读。本阶段不分配发行版本或标签。

## 实施批次

| 批次 | 交付物 | 状态 |
| --- | --- | --- |
| 04-A | 完整责任台账、共享编辑器规则及生产 Mod argv 绑定 | DONE；[PR #87](https://github.com/fbincon/claude-code-statusline/pull/87) |
| 04-B | 外部 raw-TTY/VT 编辑器、终端启动器与结果桥 | VALIDATING；`fbincon/ts-04-external-editor` |
| 04-C | 安装、卸载、doctor、归属与资源 | NOT_STARTED |
| 04-D | 持久化事务检查点与显式恢复 | NOT_STARTED |
| 04-E | 已安装候选包验收、CI、文档及收口 | NOT_STARTED |

## 责任与架构

[台账](../../../../tools/migration/ts-04/coverage.json)包含原分配 TS-04 的 212 个测试、
TS-03 转交的 45 个完整测试及八项混合测试剩余断言，共 **265 项独立责任**。
冻结基线及 TS-03 交接文件保留为历史证据。新审计拒绝遗漏／重复 ID、责任变化、
缺少替代测试和无理由退役；`--complete` 还拒绝待完成条目。
04-A 从 265 项 pending 起步。04-B 为 152 项迁移、八项有替代证据的退役及 105 项待完成的
安装／恢复责任。平台限定测试仍需目标 CI 结果；该台账不代表阶段完成。

`core/editor` 统一维护可复用的草稿、实例、搜索、数值控制、指引、导入审查和协议响应逻辑。
生成器将纯模块同步到自包含的 Mod 资源并检查漂移；Node 与两个 Mod 共用纯 argv 绑定。
manifest 新增可选字符串数组 `backendArgs`；缺省表示无参数前缀的旧可执行文件。
可执行文件环境覆盖会替换完整绑定，宿主调用继续留在 hooks。

`packages/tui` 维护外部编辑器状态、几何、终端单元格绘制与会话；共享表单、完整字素文本
和样式片段服务两个编辑器。`platform/terminal/session` 独占 raw mode，在保存、取消、
信号、超时与错误时恢复终端。输入／输出队列、捕获尺寸和启动期限均受限；CLI 按需加载编辑器。

启动器选择已验证的 tmux 弹窗、本地 macOS Terminal、GNOME Terminal 或 Windows 原生
控制台，以独立 argv 传递绝对 Node 路径及 JS 入口。私有请求／结果文件绑定配置、后端 argv、
nonce 和父进程身份；获取配置锁后再次检查请求撤销，防止延迟编辑器保存。
原六种结果与旧结果路径环境变量保持兼容。

## 验证与下一步

04-A 本地检查：Node 24.21.0／npm 11.19.0；TS 560 通过／1 项平台跳过；
Claude Code 2.1.296 原生 Mod 114/114、runtime Mod 12/12；两个严格验证器及已有声明
类型检查通过。2.1.296 运行测试不代表该版本精确声明检查。
46 项生成资源及原 516 项 TS-03 审计通过。最终 head `caf28a9` 的 43 项 CI 和八份源码
回执通过，合并提交 `264fd8a` 已同步 Gitee。详见[04-A 机器可读证据](validation.04-a.json)，
保留 Windows 换行回执失败及修复记录，没有新增比较豁免。

04-B 本地验证：TS 730/733 通过，三项 Windows 限定跳过；原生 Mod 114/114 与严格验证
通过；48 项生成资源无漂移。真实 PTY 覆盖保存／取消／冲突、缩放、Unicode、信号、超时、
父请求撤销及等待配置锁后的撤销，另有真实 tmux 弹窗输入隔离测试。Windows 控制台测试由
Windows CI 执行。独立 VT 捕获校验可见单元格、完整字素、预览色及界面色。
原 CLI-help 豁免随批准新增的 `configure` 刷新；161 个固定重放案例仍仅使用原三项豁免。

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04
```

下一步：完成 04-B PR 检查，实施安装与恢复。阶段最终需要在既有目标矩阵上完成真实候选包
编辑器与恢复验收。已批准延至发布前的实体／桌面补验维持原状态。
性能归 PERF-01；超时、资源上限与稳定性契约仍为必需。
原始证据置于忽略目录 `dist/validation/typescript-migration/ts-04/`。
