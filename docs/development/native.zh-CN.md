# 原生配置编辑器

[English](native.md) | **简体中文**

v1.3.0a1 预览 Claude Code 内的分页键盘编辑器。当前稳定版仍为 v1.2.0；既有真人验收只适用于旧 UI。新界面完成 Linux、Windows、macOS 的新一轮清单后，才能发布稳定 v1.3.0。

## 源码结构与检查

`mods/statusline-native` 是唯一维护源。`.claude-plugin/plugin.json` 声明插件及后端选项；`hooks/register.ts` 负责宿主调用、打开、保存及响应生命周期；`lib/editor/` 分开维护草稿、导航和数值校验；`lib/backend.ts` 校验协议；`lib/preferences.ts` 表示实际宿主设置行。`ui/components/` 负责列表、分页、预览和操作栏，`ui/pages/` 组合页面，`ui/layout.ts` 分配可用字符空间；测试按 editor、UI、backend、integration 分组，使用官方 Mod 工具。宿主 API 留在入口层以供官方静态分析。

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

源码开发运行 `/statusline-configure-native`，持久安装后也可使用 `/statusline-configure`。面板请求 24 行、停靠时 72 列；实际位置和空间由宿主决定。最小要求是**正文 32 列 × 12 行**，不是整个终端的尺寸。内嵌面板与输入框、状态栏共享高度，较矮的 80 列终端可能需要增加高度或用宿主的 Ctrl+X 后接方向键调整。正文不足时显示尺寸提示和关闭操作，保留草稿。

Main/Subagents 直接显示 `[x]` / `[ ]` 项目行，Enter 操作当前行并切换启用状态。每个作用域分别保留过滤与当前项目；切页、翻页后请求将焦点放回项目，搜索提交后回到匹配行。宿主可能因键盘已经回到输入框等原因拒绝焦点请求，编辑结果不会因此失效。空选择、空搜索结果均有效；说明与例子放在紧凑详情行。

完整顺序为已启用项目的保存顺序，再接其他目录项目。启用和未启用行都能移动；过滤时以相邻可见行为目标，隐藏行相对顺序不变，与独立 TUI 一致。仅保存已启用项目，子 Agent 互斥继续使用 Python 共享目录。

横向页签、分页正文、底部样例预览及两行操作栏按实际正文高度分配预算。预览最多三行，溢出提示剩余行数，使用固定样例及生产格式，不读取实时 Git/transcript。高度、过滤和焦点变化复用预览；草稿或宽度变化才重新请求，并忽略失效响应。

Settings 包含九项工具设置；范围和选项来自 `describe`，刷新支持 `event`。Enter 独立接受当前数字字段；保存检查全部数值缓冲，无效输入保留，并请求定位第一个错误字段。Esc 先退出输入并取消该字段尚未接受的编辑，后续 Esc 关闭面板。

**Save**（`s`）提交完整草稿及打开时 revision，成功后更新基线并保持面板。**Finish**（`f`）仅在确认保存成功且没有待应用宿主偏好时关闭；theme/verbose 尚未应用时展开高级区域，提示 `a` 应用、再按 `f` 完成，或用 `q` 明确丢弃并关闭。冲突或失败保留草稿；未知结果必须先用 **Check saved state**（`k`）读取核对，才能重试或关闭，核对本身不重新写入也不自动关闭。

theme/verbose 默认折叠在 **Advanced**（`h`）后，仅提供 `$.config.list()` 的真实行并显示缺失、锁定状态。**Apply**（`a`）逐项重新检查并通过 `$.config.set()` 应用，保留部分成功；不与工具保存形成整体事务。关闭丢弃未应用偏好，已应用偏好继续生效。

| 按键 | 操作 |
| --- | --- |
| Tab / Enter | 移动焦点 / 操作当前原生控件；Enter 切换当前项目行 |
| `1`、`2`、`3` | Main、Subagents、Settings |
| `p` / `n` | 上一页 / 下一页正文，选中目标页首行 |
| `t`、`u`、`d` | 切换当前项目 / 向前移动 / 向后移动 |
| `s` / `f` | 保存继续 / 确认保存后关闭 |
| `h` / `a` | 折叠或展开宿主偏好 / 独立应用 |
| `c` | Colors 位于当前 Settings 分页时切换颜色 |
| Esc / `q` | 先退出输入 / 关闭并丢弃待保存修改 |
| `r` / `k` / `v` | 丢弃草稿并重读 / 核对未知保存 / 重试失败预览 |

可打印快捷键让位给正在输入的 Input。Tab 和方向键继续用于宿主焦点及滚动，不采用独立 TUI 的切页和排序含义。应用期间禁止重复写入与普通关闭，重载丢弃未保存状态。向导、独立 TUI 及兼容启动器按既有安装偏好保留。

## Client 能力探针

隔离 Linux x86_64 PTY、Claude Code 2.1.288 的探针确认：`Client` 区域**点击后**可以收到上下左右、Tab、Enter、普通字符和 Ctrl+U；打开面板的 `focus: true` 不会直接把键盘交给该区域。Esc 不传给 `surface.onKey`，焦点和关闭仍由宿主处理。探针源码和原始报告仅留在忽略的验证目录，不打入运行资源；这是自动能力证据，不是真人验收。因此 v1.3.0a1 继续以原生控件提供无需鼠标的操作，不发布 Client 模式。

## 持久安装与恢复

安装匹配版本后运行 `claude-statusline install --native-editor`。后端仅把运行资源放到 `CLAUDE_CONFIG_DIR/statusline-native`，检查哈希清单，然后通过官方 marketplace add/install/configure 命令在 user 范围接入。`claude-statusline-local` 保留给本工具的本地目录 marketplace，绑定绝对后端及配置路径和预期版本。v1.3.0a1 的 Mod SemVer `1.3.0-alpha.1` 对应后端 PEP 440 `1.3.0a1`；稳定 v1.2.0 的 Mod/后端均为 `1.2.0`。资源清单递归收集维护的 hooks/lib/ui TypeScript 子目录；wheel 排除依赖、测试及宿主声明。

确认安装成功后，文件事务才移除所属兼容 `/statusline-configure` skill/hook。两个原生命令打开同一编辑器，向导及独立 TUI 保留。外来 skill、命令、目录、marketplace、范围或缓存资源修改均阻止接管，`--force` 也不绕过原生归属保护。Mod 在会话中再次检查命令冲突，主入口和别名分别确认归属。

`claude-statusline-native.json` 单独保存显式启用/禁用，保留 `claude-statusline-features.json`。预览默认关闭；稳定版在兼容宿主优先原生，但保留明确的原生 false、旧偏好明确 false 及外部禁用的插件。外部禁用请先自行运行 `claude plugin enable statusline-native@claude-statusline-local --scope user`，再重装。安装器只自动恢复自己记录的宿主降级暂停。

`install --no-native-editor` 通过官方命令撤下确认所属的插件及 marketplace，仅删除哈希所属文件。禁用偏好保留，实验偏好已启用时才恢复旧启动器。卸载保留偏好、显示配置、运行数据和备份。普通重装幂等；同版本资源变化使用所属官方 uninstall/install，因为官方 update 会保留旧缓存。有限的旧清单允许诊断和重试失败升级，同时拒绝外来缓存内容。

插件操作与兼容写入分阶段执行。失败或结果不明确时保留兼容配置并报告实际状态，重试前检查 `doctor`。doctor 核对版本/协议、资源哈希、官方安装/启用状态及后端绑定，当前会话加载始终标为未验证：在受信任终端重启后检查 `/plugin` 和命令。safe/bare、`disableAllHooks` 或管理策略可能阻止加载。缺失所属文件可修复，已修改的外来内容必须恢复或移走；外来保留名称 marketplace 需先显式改名或移除注册。

宿主降级后用当前后端重新 install，暂停原生并保留偏好。Python 包降级前，先用新包运行 `claude-statusline install --no-native-editor`，再安装旧包并运行其安装器；旧包无法撤下本版本新增资源。

## Linux 验收

使用隔离配置和对应源码后端，记录系统、架构、终端及版本、Claude 版本和固定提交。Phase 1 在 `3a65482` 的人工 Linux 验收仅覆盖旧的临时验证入口，不能替代三页编辑器验收。

每个新界面候选真人检查：插件实际加载、面板位置与纯键盘焦点、Enter 勾选、p/n 翻页及当前项目保持、过滤下启用/未启用项目排序与互斥、三页、限高预览与窄窗口/CJK、数值提交/Esc、s 保存刷新及 f 保存关闭、取消重开、冲突与未知结果核对、折叠及独立宿主偏好，以及关闭后继续同一会话。Windows、macOS 稳定发布前执行同一清单。私有配置和终端/debug 记录保留在忽略的 `dist/validation`，公开文档仅记录脱敏结论。官方回调测试和 PTY 画面不替代真人视觉验收。

隔离工具可检查实际安装的插件，启动时不传 `--plugin-dir`：

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --persistent --backend .venv/bin/claude-statusline --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --persistent --interactive --backend .venv/bin/claude-statusline --terminal 'name/version' --report-dir dist/validation/native-manual
```

每次使用新目录。PTY 在 120×30、80×48 终端尺寸检查三页、切换保存、取消重开、Esc 和本地向导，记录终端实际 cells 供截图使用，不把真人验收标成通过。交互模式记录环境及提交，直到维护者确认完整清单前 `manual_visual_acceptance` 始终为 false。Windows/macOS 在真实终端安装同一候选并执行相同清单。发布门槛要求记录三平台真人结果，下方 v1.2.0 历史确认不能替代 v1.3.0 的门槛。

参考：[创建及实际构建类型](https://code.claude.com/docs/en/plugins/mods/create)、[界面与焦点](https://code.claude.com/docs/en/plugins/mods/interface)、[官方测试](https://code.claude.com/docs/en/plugins/mods/test)、[本地 marketplace](https://code.claude.com/docs/en/plugin-marketplaces)。

维护者于 2026-10-04 确认完整 Linux 真人清单通过：隔离安装的 wheel 构建自 `db4129b`，后端 1.2.0a1、Claude Code 2.1.288、Linux x86_64。交互运行记录干净文档提交 `94ddbbd`、退出码 0，Mod 运行资源与被测代码提交一致；验收依据为用户明确确认。终端参数仍是占位文本，终端名称/版本记为未知。原始证据在忽略的 `dist/validation/phase2-human-linux`。后续平台修复涉及 Windows npm 入口和 macOS 可执行路径别名，已验收 Linux UI 运行资源不变。Windows/macOS 真人验收随后已确认，见下方记录。

## 稳定版验收记录

维护者于 2026-10-04 明确确认 Windows、macOS 均通过基于已发布 v1.2.0a1（`d161e55`）及清单要求 Claude Code 2.1.288 的完整原生真人检查，后续补充系统为 Windows 11、macOS 14.5。未提供架构、终端名称/版本及独立宿主版本命令输出，记为未知，不从 CI 推断。该确认与 Windows Server 2025/macOS 15.7.9 arm64 自动安装报告区分；Linux 记录见上方。稳定变更保留同一 UI 运行模块、同步版本并启用已测试的稳定默认。原始确认元数据保留在忽略的 `dist/validation/phase2-human-windows-macos.json`。

## v1.3.0 验收状态

v1.3.0a1 为预览。Linux 自动 PTY 检查使用固定 Claude Code 2.1.288 和持久插件，官方 Mod 测试另覆盖固定 CI 宿主矩阵。新界面的 Linux、Windows、macOS 真人验收均待完成；稳定 v1.3.0 与 Latest 推进要求三平台对新候选确认，并记录源码、版本和实际环境。
