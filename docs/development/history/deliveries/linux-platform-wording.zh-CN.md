# Linux 平台措辞统一

[English](linux-platform-wording.md) | **简体中文**

本次 2026-11-21 文档维护从现行维护文档中移除 Linux 与 WSL 的平台并列表述，使相关 README 标语、运行要求表格、Shell 示例引导语和故障排查文字不再将 Linux 与 WSL 并列。产品行为、命令、公开接口、存储格式、发布说明、历史交付记录及其他冻结内容均不变；不创建版本、tag、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 平台组合 | 同步更新 README 标语、README 与使用指南的运行要求表格、CLI 参考及开发指南的 Shell 示例引导语，以及使用指南的 Git 故障排查文字：原 `Linux, WSL`、`Linux / WSL`、`Linux、WSL`、`Linux or WSL`、`Linux 或 WSL` 和 `Linux / WSL / macOS` 在 Linux 与 WSL 并列处改为仅列 `Linux`。 |
| 保留的 WSL 说明 | 显示参考中的 `Windows/WSL` 紧凑标记行为、`wsl-desktop-popup` 批准标识、Bug 表单的 WSL 发行版提示及产品 i18n 文本均不变。 |
| 冻结内容 | 不重写发布说明与批准记录、历史交付与迁移记录、TypeScript 迁移记录、预览页面、变更日志历史条目及生成资源。 |

## 源码身份

- 任务前基线：`db5a0b9f`。
- 同步 `origin/main` 后的实现基线：`8c38f565`。
- 实现提交：`29a394d6`；记录更正与最终 head 在 PR 描述中记录。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,506 个本地链接，0 错误（基线 7,502） |
| `git diff --check` | 通过 |
| `npm run build` | Node 24.21.0 下通过 |
| 文档内容、示例及检查器测试 | 37/37 内容／示例测试与 54/54 `docs.test.js` 测试通过 |
| 影响计划与定向检查 | 本地 `ci:plan` 路线为 `maintenance`，选择 `actions`、`checks`、`docs`；本地 Linux `ci:check` 通过。Windows 与 macOS 任务未执行：普通 PR 不分配项目 CI runner。 |

本次仅修改文档，未执行安装产品、编辑器、平台、模型提供方或付费验收。Windows 与 macOS 定向任务未执行，因为普通 PR 不分配项目 CI runner；维护证据为本地 Linux 定向回执。冻结的发布说明与批准记录仍保留发布时的 WSL 表述。产品 CLI 与 doctor 消息仍为 `Linux/WSL`；不修改产品，也不为此新建 issue。issue #96 的六个既有缺口仍未验证。
