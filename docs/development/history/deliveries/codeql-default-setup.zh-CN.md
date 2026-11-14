# CodeQL 默认配置与首轮告警分诊

[English](codeql-default-setup.md) | **简体中文**

本次 2026-11-14 的安全维护交付记录 CodeQL 默认配置及首轮扫描的分诊。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| CodeQL 配置 | 为 GitHub Actions 和 JavaScript/TypeScript 启用默认配置；Python 因属于冻结归档而保持关闭。使用标准 GitHub runner、默认查询集、remote-sources 威胁模型；扫描 `main` 和受保护分支的推送／PR，并每周计划扫描。 |
| 首轮扫描 | `2c2044d0` 上的两次分析均无分析错误。 |
| 告警分诊 | 审阅并关闭 29 个告警，均记录理由：14 个测试／工具类告警按 used in tests 或 false positive 关闭；15 个 `actions/cache-poisoning` 告警按 false positive 关闭，因为候选任务使用只读权限、Actions 缓存按分支隔离，且工作流由维护者手动派发，不接受任意 commit 输入。 |
| 分诊后开放告警 | 0。 |
| 必需检查 | CodeQL 仍独立于 `Complete candidate evidence`；未修改 ruleset。 |
| 产品范围 | 未修改产品源码或行为。 |

## 源码身份

- 任务前基线：`2c2044d0`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `GET /code-scanning/default-setup` | `configured`；语言 `actions`、`javascript`、`javascript-typescript`、`typescript`；`default` 查询集；`remote` 威胁模型；每周计划；标准 runner。 |
| `GET /code-scanning/analyses` | `2c2044d0` 上两次分析，无错误。 |
| `GET /code-scanning/alerts?state=open` | 分诊后为 0。 |
| 关闭回读 | Security 页面记录 29 个告警的关闭理由和说明。 |
| 文档检查 | 本治理记录 PR 的 `npm run docs:check`、`git diff --check`、build、docs-content／docs-examples 及文档模板测试。 |

本次未运行产品、安装、官方宿主、终端、物理或付费验收；该安全维护变更不改变产品行为。CodeQL 不是必需检查；新告警仍需分诊。关闭决定是记录在 Security 页面的安全判断，不能替代对未来告警的审阅。
