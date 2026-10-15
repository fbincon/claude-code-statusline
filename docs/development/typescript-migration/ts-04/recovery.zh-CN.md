# TypeScript 候选实现恢复

[English](recovery.md) | **简体中文**

本流程适用于私有 TS-04/TS-05 候选实现。已发布 Python 包及维护者现用安装保持不变；正式发布验收
批准切换前，应始终显式指定隔离配置目录。


TS-05 的离线安装、制品哈希和独立 Python 回退验证见[工程候选指南](../ts-05/candidate.zh-CN.md)。
## 检查与恢复

```bash
node packages/cli/dist/src/entry.js doctor --config-dir /absolute/isolated/config
node packages/cli/dist/src/entry.js recover --config-dir /absolute/isolated/config --dry-run
node packages/cli/dist/src/entry.js recover --config-dir /absolute/isolated/config
```

`doctor` 只报告未完成工作，不修复文件。`recover --dry-run` 检查路径、归属、快照及当前
内容，不修改候选实现的文件。未解决检查点会阻止普通配置保存、界面语言修改及新安装事务；
渲染和运行观测继续可用。恢复必须显式执行，不会在渲染器启动时自动运行。

| 检查点 | 恢复行为 |
| --- | --- |
| 文件阶段已准备或部分写入 | 先验证全部目标与备份，再恢复原始字节、原先不存在的状态及适用的 POSIX 权限。 |
| 文件阶段已持久提交 | 确认新字节后清除检查点，保留已完成变更。 |
| 回滚途中退出 | 使用同一份不可覆盖快照幂等恢复。 |
| 官方插件操作结果不明 | 只读查询官方库存、已验证缓存与绑定；确认请求状态或证实原状态未变后再清除检查点，不直接重放记录的写入 argv。 |
| 用户禁用插件的刷新中断 | 跨卸载／重装保留禁用意图；完成结果核对后继续所属安装并恢复禁用。dry-run 显示 `restore-disabled`。 |
| 外部修改、备份变化、未知日志版本或插件状态仍不明确 | 在恢复写入前停止，保留证据供检查。 |

普通文件阶段与官方插件操作保持独立。Mod 操作失败时，基础集成配置可能已正常安装；恢复
不会回滚无关的已完成阶段或抹去明确关闭偏好。插件操作核对为 `not-applied` 后，可重跑
普通 `install`；安装器会重新读取实际库存再决定下一步。

## 证据与归属

私有日志位于 `statusline_runtime/transactions/txn-*.json`；原始快照保留在
`backups/statusline/cli-*`。快照以排他方式创建、同步并绑定哈希，之后才发布事务意图。
恢复拒绝链接／reparse point、越界路径、重复字段、未知 schema 以及不符合记录前后状态的
内容变化；不会接管身份仍有效的活动进程。共同安装锁串行化文件发布，额外管理锁串行化
跨阶段的插件操作。

`statusline_runtime/installation.json` 记录 Node／JS 绑定，仅在中断刷新期间附带插件
禁用意图。doctor 将其报告为未完成工作；普通配置写入等待恢复，install／recover 可以
完成已核验的刷新。资源目录中的未知文件始终保留。

迁移期间保留原 Python 环境。安装器识别历史所属命令并报告 PATH 冲突，不卸载 Python，
也不会在缺少既有显式 `--force` 选择时覆盖第三方渲染器。已完成升级保留兼容原始备份；
`recover` 处理未完成事务，不用于任意选择旧备份版本。人工回退应检查备份，并同时恢复
匹配的历史包与后端绑定。

测试在准备、每个文件边界、提交、回滚、Mod staging、官方操作返回及禁用插件刷新间隙
强制终止真实子进程。这些是进程中断测试，不宣称完成硬件断电测试。父目录同步沿用平台
适配器；不支持目录同步的文件系统／Windows 行为仍属于明确的平台限制。

官方状态不明确时，在相同 `CLAUDE_CONFIG_DIR` 下使用 `claude plugin list --json`、
`claude plugin marketplace list --json` 和 `claude plugin configure PLUGIN --json`
检查。解决报告的归属或绑定差异后重新运行恢复；不要通过删除日志绕过保护，也不要直接
修改 Claude 的插件注册表文件。
