# 原生入口验证

[English](native.md) | **简体中文**

这是 Phase 1 的开发验证工具，通过源代码显式加载。它尚非完整原生配置编辑器，wheel 不会安装该 Mod。稳定用户继续使用 v1.1.1，以及现有 CLI、向导和独立 TUI。

## 源码结构与检查

`mods/statusline-native` 是独立插件：`.claude-plugin/plugin.json` 提供标识，`hooks/hooks.json` 加载 `hooks/register.ts`，`lib` 放置纯草稿逻辑，`tests` 使用官方 Mod 测试工具。宿主 API 调用保留在入口模块，供官方静态分析检查。源码分发包包含这些开发文件，排除依赖目录、生成的宿主声明和原始验收记录。

开发使用 Node.js 22 和支持 Mod 的 Claude Code 构建。原生工作流单独固定测试 2.1.287 与 2.1.288，不扩大 Python 平台矩阵。在仓库根目录执行：

先按[本地检查](testing.zh-CN.md#本地检查)将当前 checkout 安装到开发环境。已发布的 v1.1.1 可执行文件没有新的 `ui` 协议；加载验证入口时显式绑定源码后端。

```bash
npm ci --prefix mods/statusline-native --ignore-scripts --no-audit --no-fund
.venv/bin/python tools/prepare_mod_types.py
claude plugin validate --strict mods/statusline-native
claude plugin test mods/statusline-native
npm run --prefix mods/statusline-native typecheck
CLAUDE_STATUSLINE_NATIVE_EXECUTABLE="$PWD/.venv/bin/claude-statusline" claude --plugin-dir ./mods/statusline-native
```

类型准备工具使用全新的未登录配置，不读取项目设置。宿主加载时先写出声明，随后 print 会话因未登录而退出。检查成功要求声明头与实际可执行文件版本一致，旧文件不能使检查误通过。这不会调用模型。生成的 `.claude-plugin/types` 仅供本地使用，切换宿主版本后重新生成。版本号或 manifest 验证成功不能单独证明模块已经加载。

## 验证入口行为

在该会话运行 `/statusline-configure-native`。面板请求键盘焦点，支持通过 `c` 或键盘导航切换 **Colors**，通过 Esc 或 **Close**（`q`）关闭。重新打开时草稿重置，切换项始终不会保存。面板可能位于 transcript 旁边或输入框上方，由宿主和终端宽度决定。焦点只是向宿主发出的请求；已有输入文本或其他弹窗可能继续持有键盘。

临时命令名称保留 `/statusline-config` 和 `/statusline-configure`。Mod 注册前先读取已有命令，发现其他归属时不注册，并将命令处理交还宿主；其他面板也继续交由原处理链处理。允许重新注册自己的命令。在真实宿主中记录命令来源与优先级，不能假定所有 hook 和 skill 的优先级相同。

## Linux 验收

显式调用的验收工具创建私有、隔离的 Claude 配置并绑定指定后端，只复制认证、网关和模型设置，发送本地 slash 命令，不修改日常配置。原始终端与调试记录可能包含私有路径，保留在忽略的 `dist/validation` 下。

```bash
.venv/bin/python -m pip install pyte==0.8.2
.venv/bin/python tools/native_mod_acceptance.py --report-dir dist/validation/native-pty
.venv/bin/python tools/native_mod_acceptance.py --interactive --report-dir dist/validation/native-manual
```

每次使用新的报告目录。PTY 用例覆盖 120 和 80 列：打开、切换、Esc、返回输入框、运行原有本地 `/statusline-config show`，并确认没有保存显示配置。PTY 证据和官方回调测试不能代替人工视觉验收。

人工验收记录 OS、终端、Claude 与后端版本、提交和结果。检查面板位置、焦点、键盘切换、Esc、窄窗口及继续使用原会话。本次检查不发送模型提示词。维护者确认这些步骤之前，原生入口 PR 保持待合并；Windows 和 macOS 原生交互留待 Phase 2 验收。

参考：[创建与实际构建类型](https://code.claude.com/docs/en/plugins/mods/create)、[界面与焦点](https://code.claude.com/docs/en/plugins/mods/interface)、[官方测试](https://code.claude.com/docs/en/plugins/mods/test)。

2026-10-04 开发验证：Claude Code 2.1.288 生成匹配的声明，并通过严格验证、三项官方 Mod 测试和 TypeScript 检查。原生 Linux x86_64 的 120/80 列 PTY 用例完成面板打开、切换、Esc 返回及旧版本地命令调用，没有保存草稿。人工视觉/焦点验收仍待完成；最低版本结果以独立 CI 报告为准。
