# Changelog

## 0.5.0 - 2026-09-03

- 新增默认关闭的实验入口 `/statusline-configure`，通过 `install --experimental-slash-tui` 持久启用，并可用 `--no-experimental-slash-tui` 永久关闭；与现有 `/statusline-config` 并存。
- 新增 tmux `90% × 90%` popup 与 GNOME Terminal 活动新标签页 launcher，复用已有 `claude-statusline configure` TUI；两者不可用时在本地阻断并提示独立命令，不调用模型。
- 新增私有原子结果桥接，向 Claude 对话回传保存、无变化、取消、中断、超时和错误；hook/TUI/launcher timeout 分别为 600/570/585 秒。
- 安装器扩展为 settings、feature 文件与两个 owned skill 的统一事务，支持损坏偏好的显式修复、降级暂挂/升级恢复、严格所有权、dry-run、备份和原字节回滚。
- `doctor` 新增 feature schema/权限、disabled/enabled/suspended、实验 skill/owner/matcher/timeout 和 launcher 可用性诊断；新增 launcher、PTY bridge 与真实 tmux popup 集成测试。
- 文档明确该功能不是 Claude Code 原生 TUI 扩展，不访问 `/dev/tty`，GNOME 路径是新标签页，并记录 `disableAllHooks` fallback 的模型回合例外。

## 0.4.0 - 2026-09-03

- 新增稳定的独立命令 `claude-statusline configure [--config-dir PATH]`，在 Linux 真实终端中提供 Items/Settings 双页签全屏 TUI，支持 Space 勾选、键盘导航、筛选、左右排序和数值编辑。
- 新增按键级 `Preview (sample data)`：复用生产 renderer 的格式化、分组与换行，只使用确定性样例，不读取 Git、transcript、网络或当前会话运行状态，也不创建缓存。
- Enter 一次性原子提交显示与宿主配置，Esc 和信号路径恢复终端且不写入；小于 `64x18` 时等待 resize。
- TUI 保存增加 baseline 并发保护：在现有安装锁内、创建备份前检测 display、host 或安装归属的语义变化，同时保留无关 `settings.json` 更新。
- 保持显示配置 schema version 1，不迁移或持久化禁用条目顺序；`/statusline-config` skill、slash fast hook 与现有 renderer/hook 行为不变。

## 0.3.2 - 2026-09-03

- 显示前缀首字母大写：`Session`、`Git`、`Repo`、`Worktree`、`Agent`；Git 错误标记同步改为 `Git!`。
- `cost` 金额前加 `Total`，如 `Total $0.12 · 12m 30s · +156/-23`（`vim NORMAL` 不在本次清单内，保持不变）。

## 0.3.1 - 2026-09-03

- 重构显示项分组与配色：`model-with-effort`、`fast-mode`、`thinking` 一组（象牙白）；`tokens`、`prompt-cache` 一组（粉）；`git`、`pr`、`repo` 一组（紫）；`version`、`session`、`cost`、`agent`、`vim-mode`、`worktree` 各自独立。
- `session`、`git`、`repo` 显示加前缀（`session xxxxx`、`git xxxxx`、`repo xxxxx`）。
- 目录顺序调整为同组相邻，向导追加的新条目自动落在组锚点之后。

## 0.3.0 - 2026-09-03

- 新增 11 个可选显示项：`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo`，数据来自 Claude Code 2.1.258+ 的公开 statusline payload。
- 新显示项默认禁用，默认输出与 0.2.0 完全一致；通过 `/statusline-config enable` 主动开启。
- `cost` 显示会话金额、API 时长与增删行数（第三方 API 下金额为估算值）；`prompt-cache` 显示缓存命中率与写入 token。
- 更新 `/statusline-config` 向导分组，新条目可通过勾选启用。

## 0.2.0 - 2026-09-03

- 增加用户全局的严格 JSON 显示配置、可选显示项及持久化顺序。
- 增加颜色、ANSI 调色板、目录格式、分隔符及 Claude Code 宿主设置。
- 增加 `/statusline-config` personal skill，以及新版 Claude Code 的本地 slash hook 快路径。
- 安装器自动管理 skill 和快捷 hook，旧版 Claude Code 优雅降级，卸载时保留用户偏好。
- 保持无配置时的 0.1.0 输出，并按启用项跳过不必要的 Git 和 transcript 工作。

## 0.1.0 - 2026-09-02

- 将现有 Claude Code statusline 渲染器与逐轮生命周期 hook 封装为独立 CLI。
- 增加安全、幂等的安装、卸载和诊断命令。
- 支持 `CLAUDE_CONFIG_DIR`，同时保留既有运行状态与缓存布局。
- 保留模型、目录、Git、上下文、限额、token 与计时显示行为。
