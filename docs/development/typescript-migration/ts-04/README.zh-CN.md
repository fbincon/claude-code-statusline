# TS-04 双编辑器、安装与恢复

[English](README.md) | **简体中文**

状态：**IN_PROGRESS**，2026-10-15（Asia/Shanghai）；执行者：Codex。
[迁移总计划](../../typescript-migration.zh-CN.md)维护阶段状态。
已批准的执行计划只使用隔离包与配置，保留维护者现用 Python 安装；恢复使用显式命令，
doctor 保持只读。本阶段不分配发行版本或标签。

## 实施批次

| 批次 | 交付物 | 状态 |
| --- | --- | --- |
| 04-A | 完整责任台账、共享编辑器规则及生产 Mod argv 绑定 | VALIDATING；`fbincon/ts-04-editor-foundation` |
| 04-B | 外部 raw-TTY/VT 编辑器、终端启动器与结果桥 | NOT_STARTED |
| 04-C | 安装、卸载、doctor、归属与资源 | NOT_STARTED |
| 04-D | 持久化事务检查点与显式恢复 | NOT_STARTED |
| 04-E | 已安装候选包验收、CI、文档及收口 | NOT_STARTED |

## 责任与架构

[台账](../../../../tools/migration/ts-04/coverage.json)包含原分配 TS-04 的 212 个测试、
TS-03 转交的 45 个完整测试及八项混合测试剩余断言，共 **265 项独立责任**。
冻结基线及 TS-03 交接文件保留为历史证据。新审计拒绝遗漏／重复 ID、责任变化、
缺少替代测试和无理由退役；`--complete` 还拒绝待完成条目。
04-A 明确保留 265 项 pending，不宣称编辑器／安装对等完成。

`core/editor` 统一维护可复用的草稿、实例、搜索、数值控制、指引、导入审查和协议响应逻辑。
生成器将纯模块同步到自包含的 Mod 资源并检查漂移；Node 与两个 Mod 共用纯 argv 绑定。
manifest 新增可选字符串数组 `backendArgs`；缺省表示无参数前缀的旧可执行文件。
可执行文件环境覆盖会替换完整绑定，宿主调用继续留在 hooks。

## 验证与下一步

04-A 本地检查：Node 24.21.0／npm 11.19.0；TS 560 通过／1 项平台跳过；
Claude Code 2.1.296 原生 Mod 114/114、runtime Mod 12/12；两个严格验证器及已有声明
类型检查通过。2.1.296 运行测试不代表该版本精确声明检查。
46 项生成资源及原 516 项 TS-03 审计通过；收口前补记最终测试／合并提交及 CI 证据。

```bash
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04
```

下一步：完成 04-A PR 检查，继续实施 04-B。阶段最终需要在既有目标矩阵上完成真实候选包
编辑器与恢复验收。已批准延至发布前的实体／桌面补验维持原状态。
性能归 PERF-01；超时、资源上限与稳定性契约仍为必需。
原始证据置于忽略目录 `dist/validation/typescript-migration/ts-04/`。
