# 原生配置编辑器

[English](native.md) | **简体中文**

源码前端已提供 Main、Subagents、Settings 三页。稳定安装仍为 v1.1.1；这是面向 v1.2.0 预览的开发工作，持久安装和三平台真人验收与回调测试分别记录。

## 源码结构与检查

`mods/statusline-native` 是唯一维护源。`.claude-plugin/plugin.json` 声明插件及后端选项；`hooks/register.ts` 负责宿主调用、打开、保存及响应生命周期；`lib/draft.ts` 负责选择、互斥、排序和数值缓冲；`lib/backend.ts` 校验协议；`lib/preferences.ts` 表示实际宿主设置行。`ui/` 绘制控件和页面，`tests/` 使用官方 Mod 测试工具。宿主 API 留在入口层以供官方静态分析。

开发使用 Node.js 22 和支持的 Claude Code 构建。原生工作流独立固定 2.1.287、2.1.288。先按[本地检查](testing.zh-CN.md#本地检查)安装源码后端；已发布的 v1.1.1 后端不提供新 `ui` 协议。

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

运行 `/statusline-configure-native`。面板请求焦点，位置和滚动由宿主决定。Main、Subagents 使用 Python 目录中的 24 个主行和 10 个子代理项目。选择后可启用、禁用或上下移动；过滤保留完整选择。互斥来自共享目录，允许空选择。显示选中项目说明和样例；预览复用生产格式，不采集实时数据。

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

## Linux 验收

使用隔离配置和对应源码后端，记录系统、架构、终端及版本、Claude 版本和固定提交。Phase 1 在 `3a65482` 的人工 Linux 验收仅覆盖旧的临时验证入口，不能替代三页编辑器验收。

真人检查插件实际加载、面板位置和键盘焦点、三页、过滤、互斥及排序、样例预览、窄窗口/CJK、数值 Esc、保存后状态行刷新、取消和重开、冲突、宿主偏好独立应用，以及关闭后继续同一会话。Windows、macOS 稳定发布前执行同一清单。私有配置和终端/debug 记录保留在忽略的 `dist/validation`，公开文档仅记录脱敏结论。官方回调测试和 PTY 画面不替代真人视觉验收。

隔离验收工具和平台安装检查将随持久接入更新。收齐 Linux、Windows、macOS 真人结果前稳定发布保持待办；首个预览也要求 Linux 真人验收。

参考：[创建及实际构建类型](https://code.claude.com/docs/en/plugins/mods/create)、[界面与焦点](https://code.claude.com/docs/en/plugins/mods/interface)、[官方测试](https://code.claude.com/docs/en/plugins/mods/test)、[本地 marketplace](https://code.claude.com/docs/en/plugin-marketplaces)。
