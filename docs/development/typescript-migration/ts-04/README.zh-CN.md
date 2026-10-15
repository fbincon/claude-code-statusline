# TS-04 双编辑器、安装与恢复

[English](README.md) | **简体中文**

状态：**VALIDATING**，2026-10-15（Asia/Shanghai）；执行者：Codex。
[迁移总计划](../../typescript-migration.zh-CN.md)维护阶段状态。
已批准的执行计划只使用隔离包与配置，保留维护者现用 Python 安装；恢复使用显式命令，
doctor 保持只读。本阶段不分配发行版本或标签。

## 实施批次

| 批次 | 交付物 | 状态 |
| --- | --- | --- |
| 04-A | 完整责任台账、共享编辑器规则及生产 Mod argv 绑定 | DONE；[PR #87](https://github.com/fbincon/claude-code-statusline/pull/87) |
| 04-B | 外部 raw-TTY/VT 编辑器、终端启动器与结果桥 | DONE；[PR #88](https://github.com/fbincon/claude-code-statusline/pull/88) |
| 04-C | 安装、卸载、doctor、归属与资源 | DONE；[PR #89](https://github.com/fbincon/claude-code-statusline/pull/89) |
| 04-D | 持久化事务检查点与显式恢复 | DONE；[PR #90](https://github.com/fbincon/claude-code-statusline/pull/90) |
| 04-E | 已安装候选包验收、CI、文档及收口 | VALIDATING; `fbincon/ts-04-installed-acceptance` |

## 责任与架构

[台账](../../../../tools/migration/ts-04/coverage.json)包含原分配 TS-04 的 212 个测试、
TS-03 转交的 45 个完整测试及八项混合测试剩余断言，共 **265 项独立责任**。
冻结基线及 TS-03 交接文件保留为历史证据。新审计拒绝遗漏／重复 ID、责任变化、
缺少替代测试和无理由退役；`--complete` 还拒绝待完成条目。
04-A 从 265 项 pending 起步。04-E 现为 **252 项迁移、13 项有明确替代证据的退役、
零项 pending**。退役遵循已批准的 D05 入口决策；平台验收仍以目标 CI 为准。

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

安装服务先只读准备，再获取共同文件锁、备份变更文件；独立的官方插件阶段失败时保留基础
配置。更新或卸载前核验 Mod 源码／缓存哈希、scope、marketplace 身份及历史清单。
同版本资源变化使用核验后的官方重装；用户明确关闭在刷新后保留，仅工具引起的暂挂会自动
恢复。运行偏好和两个编辑器保持独立。

安装在 `statusline_runtime/installation.json` 记录精确 Node／JS 绑定；升级识别该历史
绑定及旧 Python 入口。doctor 报告 PATH／Python 冲突，不卸载环境。官方插件 CLI 以 JSON
字符串传递多值输入；两个 Mod 同时解码并校验这种形式及数组默认值。技能模板的唯一编辑源
迁至 `packages/cli/resources`，生成器维护保留的 Python 副本。04-D 增加持久恢复，04-E 在真实安装包中验证。

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
`73262a9` 的 43 项 CI 全部通过，八份回执匹配全部 346 个源码文件。
合并提交为 `c9709d1`，详见[04-B 证据](validation.04-b.json)。

04-C 本地检查：TS 830/833 通过，三项 Windows 限定跳过；官方原生／runtime Mod 测试
115/14 通过，两个验证器、声明类型检查及 50 项生成资源检查通过。真实 Claude Code
2.1.296 在含中文及特殊字符的隔离目录安装两个 Mod，重复安装无变更，doctor 无错误，
卸载成功清理所属集成；未调用模型、未修改维护者安装。当批台账为 251 项迁移、九项退役、
五项交接 04-E。最终 `18a1275` 的 43 项 CI 通过，八份回执精确匹配 363 个源码文件；
合并为 `daaaccd`，详见[04-C 证据](validation.04-c.json)。

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04 -- --complete
```

04-D 新增显式 `recover [--config-dir PATH] [--dry-run]`、已同步且不可覆盖的原始快照、
带版本的日志检查点及待恢复写保护。恢复前核验全部原始／目标文件，并通过实际库存核对
结果不明的官方操作，不盲目重放写入。持久刷新意图在成功卸载与重装之间被强制终止时仍能
保留用户禁用选择。详见[恢复流程](recovery.zh-CN.md)。

04-D 本地 TS 853/856 通过（三项 Windows 限定跳过），Python 847/856 通过（九项平台
跳过），24 项恢复场景（包含真实进程中断）与 50 项生成资源检查通过。真实隔离的官方安装／重装／doctor／
卸载流程通过，无残留待恢复日志。最终 `35c1702` 的 43 项 CI 通过，八份回执匹配
370 个源码文件；合并为 `acdf5f9`，详见[04-D 证据](validation.04-d.json)。

04-E 将私有候选在仓库外离线安装，覆盖双编辑器、原生依赖、15 个固定渲染案例、
Windows 双 shell、目录迁移重绑、强制中断恢复及旧 Python 入口升级。固定宿主矩阵
新增真实安装包集成验收。本地完整 TS 857/860 通过（三项平台跳过），10 项安装验收
全部通过，包含缓存内部链接回归。真实 2.1.296 宿主已打开安装后的原生编辑器并保存，
runtime 也调用了已安装后端，无模型调用。详见[候选验收与复现](candidate.zh-CN.md)。

首轮 04-E Windows CI 发现验收脚本将 C 盘临时安装误判成位于 D 盘仓库内。修正后先规范化两个路径前缀并识别跨盘路径，未改变产品行为或新增验收豁免。

下一步：完成 04-E 最终目标 CI、逐字节回执核验及阶段关闭。已批准延至发布前的
实体／桌面补验维持原状态；TS-05／TS-06 与 PERF-01 尚未开始。超时、资源上限与
稳定性契约仍为必需，历史 D06 FAIL 保留。原始证据置于忽略目录
`dist/validation/typescript-migration/ts-04/`。
