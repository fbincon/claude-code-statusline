# 会话内 Client 配置编辑器

**简体中文** | [English](native.md)

v1.3.0a2 提供当前 Claude Code 终端 session 内的实验性 Client TUI。`/statusline-configure-native` 打开 Mod 面板；`/statusline-configure` 保留既有外部 curses TUI 及平台启动器。两者可同时安装。Latest 稳定版仍为 v1.2.0。

## 源码结构与检查

`mods/statusline-native` 是唯一 Mod 源码，安装身份仍为 `statusline-native@claude-statusline-local`。`hooks/register.ts` 负责宿主 API、命令、后端请求、保存生命周期与输入批次串行处理；`lib/editor/` 负责草稿、排序及数值规则；`lib/client/` 负责消息校验、按键和设置；`lib/session.ts` 生成独立快照。`ui/client/` 负责 Client 输入和绘制，`ui/components/` 提供共享板块，`ui/layout.ts` 计算单元格预算。测试对应 backend、client、editor、integration、UI。Python curses 界面与启动器独立维护，共用配置服务。

开发使用 Node.js 22、匹配的后端和固定宿主。每个宿主重新生成官方声明，不能复用其他版本类型。CI 检查 Linux 2.1.287/2.1.288，以及 Windows/macOS 2.1.288。

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

源码直接加载只提供 `/statusline-configure-native`。依赖、宿主生成声明和原始验证记录不进入运行资源；普通检查不调用模型。

## 编辑器行为

打开后先点击 Client 区域一次，再用键盘。Linux 2.1.288 实测中 `focus: true` 未让 Client 自动收键。Esc 不传给 Client：第一次归还输入焦点，之后可关闭面板。取消字段编辑使用 Ctrl+G。保存中或结果不明时阻止普通关闭。

| 按键 | 操作 |
| --- | --- |
| Tab / Shift+Tab；1/2/3 | 切换 Main、Subagents、Settings |
| 上下；PgUp/PgDn；Home/End | 选择、翻页、首尾 |
| 左右 | 条目排序；调整设置值 |
| Space / Enter | 勾选条目；操作设置或进入/确认数值编辑 |
| / | 进入列表搜索；Enter 结束搜索输入 |
| Ctrl+U / Ctrl+G | 清空输入 / 恢复搜索或数值的编辑前状态 |
| s / f / q | 保存继续 / 保存成功后退出 / 丢弃未保存修改并退出 |
| h / a | 折叠或展开 Claude 偏好 / 单独应用 |
| r / k / v | 丢弃重载 / 核对结果不明的保存 / 重试样例预览 |

搜索及数值编辑时，s/f/q 等普通字符作为输入；确认或 Ctrl+G 后恢复快捷键。刷新值支持数字或 `event`。保存校验所有数值缓冲。启用与未启用条目都能排序；筛选后移动相邻可见条目，隐藏条目的相对顺序保留，仅保存启用项顺序。子 Agent 互斥规则来自共享 catalog。

请求面板正文 72 列×24 行，实际空间和位置由宿主决定；最小正文为 32×12。≥64×20 时内容及预览使用分组边框；紧凑空间用带标题分隔线。导航、选择、说明、样例预览和操作提示区域分明。Settings 分组为 Appearance、Refresh / behavior 和默认折叠的 Claude preferences。空间不足保留草稿并提示调整尺寸或关闭；内嵌布局可能需要增加终端高度或使用宿主调整面板的快捷键。

预览使用固定样例及生产格式，最多显示三行并报告溢出行数。草稿或宽度变化重新请求，导航及高度变化复用缓存。Client 输入采用累积有序批次、确认及去重；宿主会冻结端口对象，所以传递深复制快照。旧 props、旧 epoch 和迟到预览不能替换当前状态。

重复执行原生命令会聚焦现有面板并保留草稿。外部 TUI 和 Client 可同时打开；保存共用短期文件锁和打开时版本，先保存者生效，旧草稿提示冲突且不覆盖新配置。Client 冲突时保留草稿，r 明确丢弃重载。结果不明须先 k 只读核对，不重新提交或自动退出。

Theme/verbose 只使用 `$.config.list()` 的真实行。Apply 逐项重查锁定及当前值，报告部分成功，与工具配置保存分开。Finish 不默默丢弃待应用偏好。Client 故障保留宿主已接收草稿；Client 外始终保留 Retry/Close 按钮供加载失败时恢复。2.1.287/2.1.288 没有后续版本的 `ui.fault` 事件，本实现使用内部绘制异常处理及原生恢复按钮。

## 持久安装与恢复

```bash
claude-statusline install --experimental-slash-tui --native-editor
claude-statusline doctor
```

在受信任终端中重启 Claude Code，再选择任一命令。`--experimental-slash-tui` / `--no-experimental-slash-tui` 只控制外部入口；`--native-editor` / `--no-native-editor` 只控制 Client。预览版新安装默认都关闭，已有独立偏好保留。若旧原生迁移曾移除已启用的外部 skill/hook，重装会恢复本工具所属资源。Mod 不再注册外部命令名，也不再声明 `primaryCommand`。

原生资源暂存于 `CLAUDE_CONFIG_DIR/statusline-native`，核验哈希、版本及协议清单后，经官方本地 marketplace 命令安装。绑定绝对后端路径、配置目录和版本；后端 1.3.0a2 对应 Mod 1.3.0-alpha.2。外来原生命令或资源阻止该入口安装，外部冲突在启用外部入口时检查；外来外部命令不会阻止仅安装 Client。被修改的 owned 缓存不被接管。

禁用原生只移除核实所属的原生插件、marketplace 和资源，外部入口保留自身偏好及资源。卸载保留显示配置、偏好、备份和运行数据。失败报告实际状态；doctor 分别检查资源、绑定及启用情况，当前 session 加载仍须核实。外部禁用的插件保持禁用，仅自动恢复工具记录的暂挂。safe/bare、管理策略及 disableAllHooks 可阻止加载。降级 Python 包前先用新版禁用原生，再安装旧包。

## Linux 验收

自动 Linux 运行器使用隔离配置，仅发送本地斜杠命令，记录终端单元格、版本及源码状态；图像是实际终端输出重建，不是系统像素截图或真人验收。持久模式使用私有 tmux server，验证 Client 和既有外部 popup，并核实两者读取对方保存结果。

```bash
.venv/bin/python tools/native_mod_acceptance.py --persistent --report-dir dist/validation/client-a2-local
```

固定候选需核实实际加载、首次点击、Space/Enter、切页/排序/搜索、数值 Ctrl+G、保存/完成/取消、Esc 焦点及关闭、窄窗/CJK、偏好、冲突和继续同一 session。Windows/macOS 真人检查与 CI 分开记录。

## 稳定版验收记录

v1.2.0 在晋升稳定版前，已获维护者确认 Linux、Windows 11、macOS 14.5 的完整真人清单通过。原始结论保留在 v1.2.0 发布文档；未提供的架构与终端信息保持未知。

## v1.3.0 验收状态

2026-10-04 维护者明确确认 v1.3.0a1 的新原生控件界面在 Linux、Windows、macOS 真人验收通过。本次确认未补充架构、终端和宿主输出。这是 a1 基线，不代表 a2 Client 已真人验收。

v1.3.0a2 经自动 CI、打包/安装及 Linux 真实 PTY 检查后，以显式启用的预览版发布；a2 三平台真人验收均待完成。Latest 仍为 v1.2.0。本轮 UI 变化不运行付费计时验收。

参考：[实际版本 Mod 类型](https://code.claude.com/docs/en/plugins/mods/create)、[官方测试](https://code.claude.com/docs/en/plugins/mods/test)、[本地 marketplace](https://code.claude.com/docs/en/plugin-marketplaces)。
