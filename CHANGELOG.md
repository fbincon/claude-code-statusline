# Changelog

## 0.1.0 - 2026-09-02

- 将现有 Claude Code statusline 渲染器与逐轮生命周期 hook 封装为独立 CLI。
- 增加安全、幂等的安装、卸载和诊断命令。
- 支持 `CLAUDE_CONFIG_DIR`，同时保留既有运行状态与缓存布局。
- 保留模型、目录、Git、上下文、限额、token 与计时显示行为。
