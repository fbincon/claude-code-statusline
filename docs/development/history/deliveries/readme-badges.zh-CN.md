# README 徽章与行为准则链接

[English](readme-badges.md) | **简体中文**

本次 2026-11-14 的文档交付将两个 README 中纯文本的 npm 和 MIT 链接替换为 npm 版本徽章与 MIT 徽章，并从贡献章节链接行为准则。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| README 展示 | 在 `README.md` 与 `README.zh-CN.md` 中增加 npm 版本徽章和静态 MIT 徽章；CI 徽章保持不变。 |
| 社区入口 | 在两个 README 的“Contributing and security”／“贡献与安全”中链接行为准则。 |
| 文档索引 | 在历史索引中登记本双语记录。 |

## 源码身份

- 任务前基线：`9a992c60`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,354 个链接，0 个错误。 |
| `git diff --check` | 通过。 |
| `npm run build` | 通过。 |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 34 个测试通过，0 个失败。 |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54 个测试通过，0 个失败。 |

范围化影响计划与 CI 证据记录于 PR 描述。本次未运行产品、安装、官方宿主、终端、物理或付费验收；该文档变更不改变产品行为。shields.io 徽章为外部图片；本地 `LICENSE` 与行为准则链接可解析。未改动冻结的历史记录和发布说明。
