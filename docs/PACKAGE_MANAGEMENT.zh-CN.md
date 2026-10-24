# 包升级、回退与恢复

[English](PACKAGE_MANAGEMENT.md) | **简体中文**

版本管理由 CLI 显式发起。渲染及双编辑器不会检查新包。请使用持久 npm 全局安装；[首次入口](SETUP.zh-CN.md#首次入口与-npm-持久安装)可审核并创建该安装。源码仓库和工程候选包使用显式开发命令。

## 检查与审核

```text
claude-statusline update --check --json
claude-statusline update --dry-run
claude-statusline update
claude-statusline rollback
```

检查使用 npm 配置的 scoped registry，未指定时使用默认 registry。稳定版默认选择 `latest`，有记录的渠道沿用原渠道；来源不明的预发布安装须指定 `--version 精确版本` 或 `--channel latest|beta`。渠道先解析为精确版本，再进行审核。`update --version` 拒绝降级；降级使用 `rollback`。回退未指定版本时，选择该 prefix 与配置目录记录的上一成功产物，并核对已记录的完整性或清单身份。

审核列出当前／目标版本、registry、prefix、绝对 Node/JS 入口、Node／宿主兼容性、配置格式及产物完整性。`--check` 只报告元数据兼容性，不下载压缩包，其 JSON 明确显示 `artifact_verified: false`。`--dry-run` 还会下载包并在临时 staging prefix 中验证。两者都不写目标安装或配置；临时文件及正常 npm 缓存活动与目标目录分开。

存在多套安装时指定 `--prefix 路径`，并使用拥有集成的同一 `--config-dir 路径`。目标须位于 npm 缓存之外。权限不足时选择或修复可写 prefix，产品不会运行 sudo 或弹出提权提示。没有 Claude 集成的安装只更换包；已有集成则要求可识别的兼容宿主，并刷新其自有资源。

## 脚本操作

```text
claude-statusline update --version 3.8.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
claude-statusline rollback --version 3.7.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

非交互包变更必须同时指定精确 `--version`、明确 `--prefix` 和 `--yes`。`--config-dir` 可选，但隔离安装建议明确填写。使用带引号的本机路径；Windows 可运行 `claude-statusline.cmd`。普通交互变更展示审核并要求输入 `yes`，除非已经显式提供 `--yes`。本轮不在双编辑器加入版本管理页面。

自动转换从真实已发布 v3.7.0 产物起验收。该历史兼容记录固定 SHA-256 `b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95`，registry 元数据不能替换成另一份旧包。新包提供版本化 `statuslineCompatibility` 声明；声明缺失／未知、运行时／宿主不支持或配置不可读时，阻止替换。

v3.7.0 本身没有包管理命令。从它升级时，可运行较新的公开管理器：`npx @fbincon/claude-code-statusline@3.8.0 update --version 3.8.0 --prefix PATH --config-dir PATH`，或使用之前事务输出的保留恢复入口。初次 npx 下载由 npm 控制；管理器另行审核持久安装变更。

## 包事务恢复

```text
claude-statusline recover --package --prefix /chosen/prefix --config-dir /chosen/claude --dry-run
claude-statusline recover --package --version 3.8.0 --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

每次操作在 `<CLAUDE_CONFIG_DIR>/statusline_runtime/package-management/transactions/pkg-ID/` 记录 prefix、原／目标身份、已验证压缩包、配置原始快照及阶段。prefix 锁阻止不同配置目录对同一安装并发变更；prefix 标记指向未完成记录。格式独立于旧文件／插件日志，旧版本配置恢复不会误读新记录。

执行器在 npm 替换前复制到包目录之外。保留的 `recovery-runner/bin/claude-statusline.js` 属于事务恢复材料，不是另一套受管理安装，Claude 也不会绑定到它。已安装版本缺少恢复命令或入口损坏时，以 Node 运行此入口；完成恢复及所需配置还原前，请保留它所属的事务目录。

恢复先检查磁盘上的实际包。目标已有效安装时，验证后接续集成，不重复全局 npm 替换；记录中的旧包／不完整包可在审核后通过已验证的保留压缩包修复。发现其他包、目标变化或无效记录时停止。普通 `recover --dry-run` 处理独立文件／插件事务，须先解决这些记录再恢复包操作。

包替换与集成是不同持久阶段。npm 成功不等于升级完成。集成失败、中断或 npm 执行期间发生配置修改，均保留未完成记录；重新审核实际状态后再恢复，不宣称 npm 与配置整体原子。完成的转换保留方案、项目绑定、执行授权及独立关闭选项。集成验证成功后重启 Claude，加载匹配资源。

## 单独恢复配置

```text
claude-statusline recover --restore-config pkg-BACKUP_ID --prefix /chosen/prefix --config-dir /chosen/claude --dry-run
claude-statusline recover --restore-config pkg-BACKUP_ID --prefix /chosen/prefix --config-dir /chosen/claude --yes
```

用操作输出的完整 UUID 备份 ID 替换 `pkg-BACKUP_ID`。审核列出文件及修订。明确提供 prefix 时，此配置恢复无需 npm。恢复范围包括保存的显示配置、方案集合及项目绑定，并在恢复布局需要时只调整自有子代理回调。保留当前来源执行授权、独立编辑器／采集器选择、界面偏好及 Claude 无关设置，不从旧快照静默重新启用授权。

恢复先校验快照哈希，在配置锁内重查当前修订，并通过既有文件事务备份被替换内容。快照缺失／变化或并发编辑会阻止操作。不兼容回退在替换包前停止；须单独审核并恢复适用快照，再重新审核回退。不要修改 schema 数字强行兼容。

## 更早版本及手动安装

v3.7.0 之前的版本需手动恢复：停止 Claude，按需导出当前显示方案，保留可用的 Node／包入口及兼容的变更前配置备份，再用 npm 将精确旧版本安装到选定 prefix。只恢复适用产品配置，保留无关设置和当前关闭选项，运行该版本的 `install` 与 `doctor` 后重启 Claude。Python 时代的恢复见[用户指南](USER_GUIDE.zh-CN.md#升级)。npm 失败且结果不明时，先检查实际状态再安装。

参阅 [CLI 参考](reference/cli.zh-CN.md)、[npm 安装规则](https://docs.npmjs.com/cli/v11/commands/npm-install/)及[实现／验收记录](development/m8-m9-delivery.zh-CN.md)。
