# Linux 平台措辞统一

[English](linux-platform-wording.md) | **简体中文**

本次 2026-11-21 文档维护从现行维护文档的 Linux+WSL 平台组合中移除 WSL，使相关运行要求表格和 Shell 示例引导语统一为 Linux、Windows 和 macOS。产品行为、命令、公开接口、存储格式、发布说明、历史交付记录及其他冻结内容均不变；不创建版本、tag、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| 平台组合 | 同步更新 README、使用指南、CLI 参考及开发指南的中英文要求表格与 Shell 示例引导语：原 `Linux, WSL`、`Linux/WSL`、`Linux / WSL`、`Linux、WSL` 和 `Linux／WSL` 在 Linux 与 WSL 并列处统一为 `Linux`。 |
| 保留的 WSL 说明 | 显示参考中的 `Windows/WSL` 紧凑标记行为、`wsl-desktop-popup` 批准标识、Bug 表单的 WSL 发行版提示及产品 i18n 文本均不变。 |
| 冻结内容 | 不重写发布说明与批准记录、历史交付与迁移记录、TypeScript 迁移记录、预览页面、变更日志历史条目及生成资源。 |

## 源码身份

- 任务前基线：`db5a0b9f`。
- 同步 `origin/main` 后的实现基线：`8c38f565`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,506 个本地链接，0 错误（基线 7,502） |
| `git diff --check` | 通过 |
| `npm run build` | Node 24.21.0 下通过 |
| 文档内容及示例测试 | 37/37 通过 |
| 影响计划与定向检查 | 选中任务及结果在 CI 后记录于 PR 描述 |

本次仅修改文档，未执行安装产品、编辑器、平台、模型提供方或付费验收。冻结的发布说明与批准记录仍保留发布时的 WSL 表述。产品 CLI 与 doctor 消息仍为 `Linux/WSL`；不修改产品，也不为此新建 issue。issue #96 的六个既有缺口仍未验证。
