# 贡献指南

[English](CONTRIBUTING.md) | **简体中文**

## 选择反馈渠道

- 可复现缺陷请填写 [Bug 报告](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml)，提供版本、安装渠道、环境、复现步骤、预期行为与实际结果。如果安装失败而无法获得版本，填写“未知”。
- 使用问题或功能建议请先查看[用户指南](docs/USER_GUIDE.zh-CN.md)和已有 [Issues](https://github.com/fbincon/claude-code-statusline/issues)，再通过空白 Issue 描述使用场景和期望结果。
- 潜在漏洞请按[安全政策](SECURITY.zh-CN.md)私密报告。

诊断输出、配置片段和截图均为选填。分享前删除凭据、token、私密对话记录及无关个人信息。GitHub 是 Issues、PR 和 CI 的主要位置，Gitee 是公开同步分发仓库。

## 开发与检查

[开发指南](docs/development/README.zh-CN.md)介绍工作区和命令。开发与构建使用 Node 24.21.0、npm 11.19.0，并需安装 Git 和 Git LFS。在仓库根目录安装依赖：

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

文档和本仓库维护的社区模板使用：

```bash
npm run docs:check
git diff --check
```

产品、依赖、工作流或开发工具变更使用：

```bash
npm run check
git diff --check
```

CI 使用明确的文档／模板白名单。混合变更和发布审批 JSON 仍需完整产品矩阵。两条路径都以 `Complete candidate evidence` 汇总检查结束，详见 [CI 维护说明](docs/development/ci-maintenance.zh-CN.md)。完整测试套件使用隔离夹具；需要显式执行的安装、终端、实机或付费验证参见[测试与验收](docs/development/testing.zh-CN.md)。

## 准备 PR

保持变更集中，解释目的，并记录实际验证结果。标题采用 `fix: ...`、`docs: ...`、`ci: ...` 等 conventional 风格。维护者分支使用 `fbincon/` 前缀，不要求 DCO sign-off。

英文 Markdown 使用现有默认路径，完整简体中文对应文件命名为 `.zh-CN.md`。GitHub Issue 表单与唯一 PR 模板在同一文件中包含双语。保持链接有效，并更新相应文档索引。界面翻译贡献参见[翻译指南](docs/development/i18n.zh-CN.md)。

按需更新文档、截图、CHANGELOG 和关联 Issue；模板中其他项目明确填写“不适用”。项目 README 用于功能介绍和使用说明，发布版本、交付状态和更新叙述放在变更日志、发布说明或开发记录中。

PR 面向 `main`，合并前同步主线并等待必需 CI 检查通过。单人维护项目不强制第二个人审批，但维护者和自动化账号仍须遵守 PR 与 CI 要求。发布是独立的维护者操作，详见[发布指南](docs/RELEASING.zh-CN.md)。

## 平台验收跟踪

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)跟踪既有平台验收缺口。提交实际验证结果时，请说明被测源码或安装包、环境、步骤、结果和剩余限制，并区分实体桌面／电源证据与自动化测试、PTY 和重建截图。已接受的六项既有缺口仍标为未验证，不能豁免新的自动化失败。普通缺陷请使用通用 Bug 表单。
