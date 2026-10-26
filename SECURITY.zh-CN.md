# 安全政策

[English](SECURITY.md) | **简体中文**

## 支持范围

安全修复面向最新稳定版提供。请先将旧安装升级到最新稳定版，再确认问题是否仍然存在。旧小版本、预发布版本以及已归档的 Python 实现不承诺单独回补安全修复。修复通过新版本交付，不替换已经发布的软件包。

## 私密报告漏洞

请使用 [GitHub 私有漏洞报告](https://github.com/fbincon/claude-code-statusline/security/advisories/new)。不要在公开 Issue、PR 或 Gitee 讨论中披露尚未修复的漏洞。GitHub 是 GitHub 和 Gitee 两种分发渠道共同的主要安全报告入口。

请提供能够安全分享的信息：

- 受影响的产品版本和安装渠道。
- 相关的操作系统、终端、Node 和 Claude Code 版本。
- 最小复现步骤、预期行为及实际影响。
- 已知缓解方法或修复建议。

删除 token、凭据、私密对话记录及无关个人信息。配置和日志只保留复现问题所需的最小片段。

维护者会审阅报告，并通过私有报告协调修复和披露，不承诺固定响应期限。

## 安全范围与普通支持

安全相关范围包括安装与恢复、设置和 hook 写入、命令执行、扩展来源、凭据处理及软件包发布链。

普通缺陷、配置问题和功能建议请使用[公开 Issues](https://github.com/fbincon/claude-code-statusline/issues)，并参阅[贡献指南](CONTRIBUTING.zh-CN.md)。安装和配置帮助请先阅读[用户指南](docs/USER_GUIDE.zh-CN.md)。
