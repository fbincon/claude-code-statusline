# TypeScript 安装候选验收

[English](candidate.md) | **简体中文**

私有 `@fbincon/statusline-ts04-candidate` 归档用于验收，不是已发布的包或
release。它包含编译后的 CLI／core／platform／TUI、两个自包含 Mod、技能模板、
许可证和固定版本的预编译依赖。要求 Node 24.21.0／npm 11.19.0。归档对应构建平台
和进程架构；Windows ARM 宿主目前运行已验证的 x64 候选。最终分发打包归 TS-05。

## 复现

在仓库根目录，将固定运行时加入 PATH 后执行：

```bash
npm ci --ignore-scripts
npm test
npm run generate:check
npm run migration:inventory -- --complete
npm run migration:inventory:ts04 -- --complete
npm run migration:installed
npm run migration:official:ts04
```

最后一条命令需要受支持的固定 Claude Code 宿主。需要保留归档时，执行
`npm run migration:pack:ts04 -- /absolute/output/directory`，不会发布到 registry。
验收程序在仓库外临时目录中离线安装归档，禁用生命周期脚本，复制独立 Node，隔离
HOME 和 `CLAUDE_CONFIG_DIR`。候选进程的 PATH 不含 Python 和编译器；Windows
Git Bash 入口检查额外提供 Git 的 shell 工具。仓库工具和历史 Python 对比仍需
开发依赖。

| 门槛 | 证据 |
| --- | --- |
| 包和入口 | 实际安装模块、资源清单、许可证、原生依赖加载、npm 入口与目录移动后重绑。 |
| 固定渲染 | 15 个生产渲染案例与不可变参考逐字节比较。 |
| 双编辑器 | 安装后 UI 协议 describe／read／preview／基于修订的 apply／export；真实 POSIX PTY 或 Windows 控制台中的外部编辑器保存／取消、完整 Win32 输入／输出模式或 POSIX 终端属性恢复和独立可见单元格检查。 |
| 恢复与升级 | 安装后编辑器写入中强制终止，dry-run 与幂等恢复；历史 Python 命令重绑、旧环境保留、关闭偏好与兼容备份字节，随后显式还原备份并用冻结 Python 参考回放。 |
| 官方集成 | 真实固定宿主安装／重复安装、缓存与绑定校验、已安装 UI 保存、用户禁用状态、卸载及无遗留 journal。 |

八目标 TypeScript 工作流输出 `ts04-installed-*` 和既有源码回执。13 个固定宿主的
Native Mod 作业在保留 Python 集成证据的同时，加入 `ts04-official-installed.json`。
候选回执绑定源码哈希和归档 SHA-256。关闭阶段前，必须将下载归档摘要及源码字节与
已审查 PR head 核对。CI 检出的合并提交可与 PR head 不同，但源码字节必须相同。

## 真实宿主交互及边界

在有受支持宿主的本地 POSIX 系统中，`npm run migration:host:ts04` 在 PTY 中启动
真实宿主，调用已安装原生编辑器，聚焦 Client 区域并保存，验证后端调用已完成及
已安装 runtime 分派。探针使用合成凭据和不可达的本地 API，无需模型请求。记录的
终端几何尺寸对应实际观察到的固定宿主，不是通用桌面交互测试。私有回执和终端
采集保存在已忽略的 `dist/validation/typescript-migration/ts-04/04-e/`。

自动控制台／PTY 检查不能替代此前已批准延期至发布前的物理休眠／重启、桌面
焦点／输入及视觉验收。Node 使用独立 executable／argv 绑定；历史 Windows `.cmd`
限制没有改判为通过。现用 Python 安装保留。[恢复流程](recovery.zh-CN.md)处理
中断事务；任意历史备份的选择仍需有意进行手动回退。

完整台账包含 265 项责任：252 项迁移、13 项按已批准 D05 入口决策退役并具备明确
替代证据，无待办 ID。显示 schema 8、UI 协议 11、runtime 协议 2 及 v1 兼容不变。
161 个固定回放案例仍仅保留原三项人工 CLI 文案豁免。历史 D06 性能结果仍为 FAIL；
PERF-01 在 TS-06 后执行，不属于本次验收门槛。
