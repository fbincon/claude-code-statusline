# 试用 TypeScript 预览版

[English](PREVIEW.md) | **简体中文**

本页保留**历史 v3.0.0-beta.1 试用与恢复流程**。当前产品请使用[安装指南](USER_GUIDE.zh-CN.md#安装与接入)或[使用演示](SHOWCASE.zh-CN.md)。正式版 v3.0.0 已接替该预览；其[交付记录](development/typescript-migration/ts-06/stable-release.zh-CN.md)与[版本专属决定](development/typescript-migration/ts-06/README.zh-CN.md#正式版决定2026-10-18)保留已接受缺口，不将未验证项标为通过。

预览当时通过 `@fbincon/claude-code-statusline@beta` 和内容相同的 GitHub/Gitee Release 附件分发。[原发布说明](releases/v3.0.0-beta.1.md) · [平台验收跟踪](https://github.com/fbincon/claude-code-statusline/issues/96)。

复现该包时按下方命令固定 `@3.0.0-beta.1`。`beta`、`latest` 等可变 npm 渠道不能确定历史版本。下方环境要求、CI 数量、schema 版本及结果描述保留的预览时期证据，不是当前产品验收；Python v2.0.0 保留为历史回退目标。

## 环境要求与验证限制

使用 Node **24.21.0**、npm **11.19.0**。安装包目标为 Linux/WSL x64、Windows x64、macOS x64 与 ARM64。Windows ARM 使用**模拟运行的 x64 Node**，不提供原生 Windows ARM 或 32 位运行时。安装预览版无需 Python 或原生编译器。

CI 覆盖八个安装目标、十三个固定 Claude 宿主组合。macOS 实机休眠恢复、macOS 14 Intel 桌面/电源、Windows 10 桌面、WSL 桌面/弹窗和其他目标平台电源/人工视觉检查保持**未验证**，仅对 v3.0.0 接受缺项发布。CI、PTY 不能替代真人桌面和实体电源验收。macOS Client 的历史焦点限制仍存在：输入前先点击 Client 区域。Claude 2.1.296 没有可用的精确宿主类型声明，其官方 Mod 测试与 2.1.294 类型检查分别记录。

兼容宿主上双编辑器默认开启，保留已有停用偏好。外部入口要求 Claude 2.1.258+，会话内 Client 要求 2.1.287+，原生计时要求 2.1.289+；高级 live metrics 继续显式启用。显示 schema 8、编辑器协议 11、运行时协议 2/v1、任务 schema 4 保持兼容。D06 保持 **FAIL：104 pass / 60 fail / 28 inconclusive**，性能工作属于 PERF-01；功能超时、事件丢失、写入或恢复失败仍是缺陷。

## 保留 Python 的隔离安装

保留原 Python 环境，试用前记录其可执行文件绝对路径及 `--version`。使用独立 npm 前缀，避免 PATH 同名命令冲突。仅安装 npm 包不会修改 Claude 设置。

Bash/Zsh：

```bash
SL_PREVIEW_PREFIX="$HOME/.local/share/claude-statusline-preview"
npm install --prefix "$SL_PREVIEW_PREFIX" --ignore-scripts --no-audit --no-fund @fbincon/claude-code-statusline@3.0.0-beta.1
SL_PREVIEW_ENTRY="$SL_PREVIEW_PREFIX/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js"
SL_PREVIEW_CONFIG="$SL_PREVIEW_PREFIX/test-config"
node "$SL_PREVIEW_ENTRY" --version
node "$SL_PREVIEW_ENTRY" install --config-dir "$SL_PREVIEW_CONFIG" --dry-run
node "$SL_PREVIEW_ENTRY" install --config-dir "$SL_PREVIEW_CONFIG"
node "$SL_PREVIEW_ENTRY" doctor --config-dir "$SL_PREVIEW_CONFIG"
node "$SL_PREVIEW_ENTRY" configure --config-dir "$SL_PREVIEW_CONFIG"
```

PowerShell：

```powershell
$previewPrefix = Join-Path $env:LOCALAPPDATA 'claude-statusline-preview'
npm.cmd install --prefix "$previewPrefix" --ignore-scripts --no-audit --no-fund '@fbincon/claude-code-statusline@3.0.0-beta.1'
$previewEntry = Join-Path $previewPrefix 'node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js'
$previewConfig = Join-Path $previewPrefix 'test-config'
node "$previewEntry" --version
node "$previewEntry" install --config-dir "$previewConfig" --dry-run
node "$previewEntry" install --config-dir "$previewConfig"
node "$previewEntry" doctor --config-dir "$previewConfig"
node "$previewEntry" configure --config-dir "$previewConfig"
```

固定复现时将 `@beta` 替换为 `@3.0.0-beta.1`。上述命令使用隔离 Claude 配置；测试实际会话时，以 `CLAUDE_CONFIG_DIR` 指向同一目录启动 Claude。需要登录时使用官方登录流程；验收清单无需新付费模型调用。若决定切换现有配置，先停止活跃 Claude 会话、备份配置目录，再用明确路径重复 dry-run/install/doctor。检查变更，解决外部资源所有权冲突，不要盲目添加 `--force`。

Windows npm 包装器为 `.cmd`/`.ps1`，不是旧 Python `.exe`。显式 `node` 加 JS 绝对路径可避免包装器和执行策略歧义；宿主绑定也使用绝对 argv。接入期间请保持所选 Node 和安装目录的位置。

## Release 离线附件

从 [GitHub 预览 Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) 或 [Gitee 预览 Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) 下载全部四项附件：

- `fbincon-claude-code-statusline-3.0.0-beta.1.tgz`
- `claude-code-statusline-3.0.0-beta.1-source.tar.gz`
- `build-manifest.json`
- `SHA256SUMS`

Linux/WSL 执行 `sha256sum -c SHA256SUMS`，macOS 执行 `shasum -a 256 -c SHA256SUMS`。PowerShell 用 `Get-FileHash -Algorithm SHA256 -LiteralPath FILE` 逐项与 `SHA256SUMS` 对照。随后将上述 npm 包参数替换为本地 tgz 路径，并添加 `--offline`。保留 `--ignore-scripts`，依赖与原生预编译文件已内置。Gitee 使用下载后的本地文件安装；自动生成的源码 ZIP 不是可重建源码附件。

## 简短验收清单

1. 记录 `--version`、系统/构建/架构、Node/npm、Claude、终端版本、渠道和安装包摘要。
2. 检查 dry-run、安装、doctor、重装、显式停用编辑器及修改前备份。
3. 用明确入口测试外部 `configure`，再在选定 Claude 配置中测试 `/statusline-configure` 与 `/statusline-configure-native`；验证键盘/鼠标焦点、缩放、Unicode、主题、保存/取消和终端恢复。
4. 使用已有或捕获的会话检查主/子状态栏、独立 UI/输出语言、显示编辑和导入导出。样例预览不算实时数据证据。
5. 检查下面的显式恢复与回退；每项记录通过/失败/未验证，截图或 CI 不能单独证明休眠恢复正确。

## 恢复与回退

`doctor` 只诊断未完成事务。先用同一入口及 `--config-dir` 执行 `recover --dry-run`，再显式 `recover`。不要删除事务日志绕过所有权检查。[恢复契约](development/typescript-migration/ts-04/recovery.zh-CN.md)。

已完成切换后回到 Python：先保留 Node 和**新版预览入口**，用该入口执行 `uninstall --config-dir <曾切换的目录>`，保留显示/偏好配置及兼容的修改前备份。再调用保留的 **Python 可执行文件绝对路径**，对同一目录执行 `install --dry-run`、`install`、`doctor`。旧包不存在时，用 `pipx install fbincon-claude-code-statusline==2.0.0` 安装固定历史版本，找到其绝对控制台入口后使用。重启 Claude 并验证渲染/编辑器。`recover` 修复中断事务，不会挑选任意历史备份或完成版本降级。

恢复绑定后，才用 `npm uninstall --prefix <预览安装目录> @fbincon/claude-code-statusline` 移除预览包。先删除文件会留下失效绝对路径绑定；不要用旧备份覆盖无关的新设置。[已发布 Python 文档](https://github.com/fbincon/claude-code-statusline/blob/v2.0.0/docs/USER_GUIDE.zh-CN.md)。

## 完整验收与反馈

[提交反馈](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml)，附脱敏复现日志，区分自动化、PTY、真人桌面和实体电源证据，不包含凭据或私密对话。平台覆盖统一跟踪于 [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)。

采集完整证据时，解压对应源码附件，使用固定 Node/npm，执行 `npm ci --ignore-scripts` 和 `npm run build`。`FULL_SHA` 取自 `build-manifest.json`；保留全部下载附件，安装包根目录指包含 `candidate.json` 的目录。采集器关联观察结果前会校验源码和实际安装文件：

```text
npm run acceptance:power -- before --kind suspend --output NEW_DIRECTORY --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
# 操作者主动执行真正的系统休眠/恢复，工具不会触发电源动作。
npm run acceptance:power -- after --output SAME_DIRECTORY --human-confirmed --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
npm run acceptance:terminal -- launch --mode direct --output NEW_DIRECTORY --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
```

重启和弹窗使用独立输出目录。电源采集支持 Linux/macOS/Windows；桌面终端采集支持 Linux GNOME 和 macOS Terminal。Windows/WSL 桌面及两个真实编辑器还需手工清单与精确环境记录。终端采集器验证终端基础能力，关联安装包不代表已验收实际编辑器交互。原始证据本地保存，只公开脱敏摘要。[TS-06 状态](development/typescript-migration/ts-06/README.zh-CN.md)。
