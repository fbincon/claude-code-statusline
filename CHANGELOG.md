# Changelog

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
