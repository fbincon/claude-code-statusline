# Gitee 发布附件策略

[English](gitee-release-asset-policy.md) | **简体中文**

本次 2026-11-21 的文档与发布工具维护交付调整当前 TypeScript 版本的 Gitee Release 策略。Gitee 继续镜像代码、带注释标签、发布说明、`build-manifest.json` 和 `SHA256SUMS`；Gitee 说明将包和源码归档链接到固定版本的 GitHub 原件。GitHub 仍是主库，继续发布并核验全部四件资产。Python 时代版本继续在 Gitee 保留 wheel、sdist 和 `SHA256SUMS`。现有 Gitee 附件不变。不创建版本、tag、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Gitee 生成器 | `release:gitee-notes` 现在按角色区分 TypeScript 资产。它只从 Gitee 收集 `build-manifest.json` 和 `SHA256SUMS`，校验包和源码归档的规范 GitHub URL，输出混合托管链接，并在缺少 Gitee 元数据或 GitHub 资产 URL 非规范时拒绝生成。旧 wheel 版本仍要求三件 Gitee 资产。 |
| 测试 | 更新夹具和遍历全部仓库发布正文的测试，重写 preview 测试，并新增仅元数据目标、Gitee 额外大附件、规范 URL 拒绝、正文链接改写和跨版本链接覆盖。 |
| 文档 | 更新中英文发布指南、仓库治理、使用指南、`AGENTS.md`、`CONTRIBUTING.md` 和 `CONTRIBUTING.zh-CN.md`，说明仅元数据的 Gitee 镜像和 1 GB 配额。 |
| 冻结内容 | 不重写发布说明、历史交付记录、`release-procedures*`、TypeScript 迁移记录、`archive/python/**` 和生成资源。`docs/PREVIEW.md` 保持不变，因为它固定描述 v3.0.0-beta.1 预览，该 Gitee Release 托管全部四件附件。 |

## 源码身份

- 任务前基线：`7be467eb`。
- 实现提交：`09d8b14b`。
- 交付记录提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| `npm run docs:check` | 7,508 个本地链接，0 错误 |
| `git diff --check` | 通过 |
| `npm run build` | Node 24.21.0 下通过 |
| `node --test dist/typescript/tools/release/test/gitee-notes.test.js` | 14/14 通过 |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54/54 通过 |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 37/37 通过 |
| 影响计划与定向检查 | 本地 `ci:plan` 路线为 `maintenance`，选择 `actions`、`checks`、`docs`、`release`；Linux `ci:check` 在 `09d8b14b` 上状态为 `pass` |
| 只读生成器演练 | v3.16.5 与 v3.16.4 均输出包/源码 GitHub URL 与元数据 Gitee URL；未写线上 Gitee |

本次仅修改发布工具和文档，未执行安装产品、编辑器、平台、模型提供方或付费验收。Windows 与 macOS 定向任务未执行，因为普通 PR 不分配项目 CI runner；维护证据为本地 Linux 定向回执。未执行任何 Gitee API 写入、上传、删除或 Release 正文更新。未修改冻结的发布说明、历史交付记录、`archive/python/**` 和冻结的发布流程页面。未删除或替换历史 Release 上已有的 Gitee 附件。新策略的首次实际应用将在下一个版本发布时发生。issue #96 的六个既有缺口仍未验证。
