# 原生配置编辑器

[English](native.md) | **简体中文**

v1.2.0a1 候选 wheel 已包含 Main、Subagents、Settings 三页。稳定安装仍为 v1.1.1；预览显式启用，三平台真人验收与自动安装和回调测试分别记录。

## 源码结构与检查

`mods/statusline-native` 是唯一维护源。`.claude-plugin/plugin.json` 声明插件及后端选项；`hooks/register.ts` 负责宿主调用、打开、保存及响应生命周期；`lib/draft.ts` 负责选择、互斥、排序和数值缓冲；`lib/backend.ts` 校验协议；`lib/preferences.ts` 表示实际宿主设置行。`ui/` 绘制控件和页面，`tests/` 使用官方 Mod 测试工具。宿主 API 留在入口层以供官方静态分析。

开发使用 Node.js 22 和支持的 Claude Code 构建。原生工作流覆盖 Linux 2.1.287/2.1.288 及 Windows/macOS 2.1.288，独立于 Python 平台矩阵。先按[本地检查](testing.zh-CN.md#本地检查)安装源码后端；已发布的 v1.1.1 后端不提供新 `ui` 协议。

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

更换宿主后重新生成声明。准备工具使用全新未认证配置并禁用项目设置，检查声明头与实际可执行版本相符，不调用模型。依赖和生成的宿主声明不进入 Git 或分发包。版本号和 manifest 通过校验不能单独证明会话加载。

## 编辑器行为

源码开发运行 `/statusline-configure-native`，持久安装后也可使用 `/statusline-configure`。面板请求焦点，位置和滚动由宿主决定。Main、Subagents 使用 Python 目录中的 24 个主行和 10 个子代理项目。选择后可启用、禁用或上下移动；过滤保留完整选择。互斥来自共享目录，允许空选择。显示选中项目说明和样例；预览复用生产格式，不采集实时数据。

Settings 包含颜色、调色板、目录样式、分隔符、padding、刷新间隔、Vim 指示器、范围标签和自定义子代理行。选项及数值边界来自 `describe`，刷新支持 `event`。无效数值保留输入并阻止保存。

工具配置与宿主偏好分别应用。**Save tool configuration**（`s`）提交完整草稿和打开时 revision。成功后更新基线和 revision，保持面板打开，后续状态行刷新使用已保存设置。冲突保留草稿并提供 **Discard draft and reload**。超时或保存响应无效时必须先 **Check saved state**，重新读取核对后才能重试或关闭，避免重复写入。

宿主偏好只使用 `$.config.list()` 实际提供的 `theme`、`verbose` 行，显示缺失和锁定状态。**Apply host preferences**（`a`）逐项重新检查再调用 `$.config.set()`，分别报告成功和拒绝。部分成功保留，不与工具保存形成整体事务。关闭丢弃待应用偏好，已应用偏好仍生效。

| 按键 | 操作 |
| --- | --- |
| Tab / Enter | 切换焦点 / 操作当前宿主控件 |
| `1`、`2`、`3` | Main、Subagents、Settings |
| `s` / `a` | 保存工具配置 / 应用宿主偏好 |
| `t`、`u`、`d` | 切换选中项目 / 上移 / 下移 |
| Esc | 先退出输入编辑，再按一次关闭面板 |
| `q` | 关闭并丢弃未保存修改 |
| `r` | 丢弃草稿并重新读取保存配置 |

快捷键由原生控件处理，输入编辑时让位给文本。退出字段编辑会取消未接受的数值缓冲。body 小于 24 列时显示调整窗口提示和关闭操作，保留草稿。普通重绘复用预览，草稿或宽度变化才请求更新；关闭或重开使旧响应失效。应用期间禁止重复写入和普通关闭。重载丢弃未保存状态。

开发命令保留已安装向导和兼容 TUI。外来同名命令阻止注册，其他面板正常透传。通过 `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` 绑定绝对后端路径，`CLAUDE_CONFIG_DIR` 作为参数传递，不进行 shell 插值。

## 持久安装与恢复

安装候选包后运行 `claude-statusline install --native-editor`。后端仅把运行资源放到 `CLAUDE_CONFIG_DIR/statusline-native`，检查哈希清单，然后通过官方 marketplace add/install/configure 命令在 user 范围接入。`claude-statusline-local` 保留给本工具的本地目录 marketplace，绑定绝对后端及配置路径和预期版本。Mod 使用 SemVer `1.2.0-alpha.1` 对应后端 PEP 440 `1.2.0a1`。

确认安装成功后，文件事务才移除所属兼容 `/statusline-configure` skill/hook。两个原生命令打开同一编辑器，向导及独立 TUI 保留。外来 skill、命令、目录、marketplace、范围或缓存资源修改均阻止接管，`--force` 也不绕过原生归属保护。Mod 在会话中再次检查命令冲突，主入口和别名分别确认归属。

`claude-statusline-native.json` 单独保存显式启用/禁用，保留 `claude-statusline-features.json`。预览默认关闭；未来稳定版在兼容宿主优先原生，但保留明确的原生 false、旧偏好明确 false 及外部禁用的插件。外部禁用请先自行运行 `claude plugin enable statusline-native@claude-statusline-local --scope user`，再重装。安装器只自动恢复自己记录的宿主降级暂停。

`install --no-native-editor` 通过官方命令撤下确认所属的插件及 marketplace，仅删除哈希所属文件。禁用偏好保留，实验偏好已启用时才恢复旧启动器。卸载保留偏好、显示配置、运行数据和备份。普通重装幂等；同版本资源变化使用所属官方 uninstall/install，因为官方 update 会保留旧缓存。有限的旧清单允许诊断和重试失败升级，同时拒绝外来缓存内容。

插件操作与兼容写入分阶段执行。失败或结果不明确时保留兼容配置并报告实际状态，重试前检查 `doctor`。doctor 核对版本/协议、资源哈希、官方安装/启用状态及后端绑定，当前会话加载始终标为未验证：在受信任终端重启后检查 `/plugin` 和命令。safe/bare、`disableAllHooks` 或管理策略可能阻止加载。缺失所属文件可修复，已修改的外来内容必须恢复或移走；外来保留名称 marketplace 需先显式改名或移除注册。

宿主降级后用当前后端重新 install，暂停原生并保留偏好。Python 包降级前，先用新包运行 `claude-statusline install --no-native-editor`，再安装旧包并运行其安装器；旧包无法撤下本版本新增资源。

## Linux 验收

使用隔离配置和对应源码后端，记录系统、架构、终端及版本、Claude 版本和固定提交。Phase 1 在 `3a65482` 的人工 Linux 验收仅覆盖旧的临时验证入口，不能替代三页编辑器验收。

真人检查插件实际加载、面板位置和键盘焦点、三页、过滤、互斥及排序、样例预览、窄窗口/CJK、数值 Esc、保存后状态行刷新、取消和重开、冲突、宿主偏好独立应用，以及关闭后继续同一会话。Windows、macOS 稳定发布前执行同一清单。私有配置和终端/debug 记录保留在忽略的 `dist/validation`，公开文档仅记录脱敏结论。官方回调测试和 PTY 画面不替代真人视觉验收。

隔离工具可检查实际安装的插件，启动时不传 `--plugin-dir`：

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --persistent --backend .venv/bin/claude-statusline --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --persistent --interactive --backend .venv/bin/claude-statusline --terminal 'name/version' --report-dir dist/validation/native-manual
```

每次使用新目录。PTY 在 120/80 列检查三页、切换保存、取消重开、Esc 和本地向导，记录终端实际 cells 供截图使用，不把真人验收标成通过。交互模式记录环境及提交，直到维护者确认完整清单前 `manual_visual_acceptance` 始终为 false。Windows/macOS 在真实终端安装同一候选并执行相同清单。收齐三平台真人结果前稳定发布保持待办；首个预览也要求 Linux 真人验收。

参考：[创建及实际构建类型](https://code.claude.com/docs/en/plugins/mods/create)、[界面与焦点](https://code.claude.com/docs/en/plugins/mods/interface)、[官方测试](https://code.claude.com/docs/en/plugins/mods/test)、[本地 marketplace](https://code.claude.com/docs/en/plugin-marketplaces)。

维护者于 2026-10-04 确认完整 Linux 真人清单通过：隔离安装的 wheel 构建自 `db4129b`，后端 1.2.0a1、Claude Code 2.1.288、Linux x86_64。交互运行记录干净文档提交 `94ddbbd`、退出码 0，Mod 运行资源与被测代码提交一致；验收依据为用户明确确认。终端参数仍是占位文本，终端名称/版本记为未知。原始证据在忽略的 `dist/validation/phase2-human-linux`。后续平台修复涉及 Windows npm 入口和 macOS 可执行路径别名，已验收 Linux UI 运行资源不变。Windows/macOS 真人验收仍待完成。
