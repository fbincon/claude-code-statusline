# 贡献指南

[English](CONTRIBUTING.md) | **简体中文**

## 选择反馈渠道

- 可复现缺陷请填写 [Bug 报告](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml)，提供版本、安装渠道、环境、复现步骤、预期行为与实际结果。如果安装失败而无法获得版本，填写“未知”。
- 使用问题或功能建议请先查看[用户指南](docs/USER_GUIDE.zh-CN.md)和已有 [Issues](https://github.com/fbincon/claude-code-statusline/issues)，再通过空白 Issue 描述使用场景和期望结果。
- 潜在漏洞请按[安全政策](SECURITY.zh-CN.md)私密报告。

诊断输出、配置片段和截图均为选填。分享前删除凭据、token、私密对话记录及无关个人信息。GitHub 是 Issues、PR 和 CI 的主要位置，Gitee 同步镜像代码与发布文件。

## 开发与检查

编码代理应阅读[项目级代理指引](AGENTS.md)，了解共享工作区边界、规范来源和验证规则。`AGENTS.md` 仅维护英文。

[开发指南](docs/development/README.zh-CN.md)介绍工作区和命令。使用 [.node-version](.node-version) 和 [package.json](package.json) 固定的工具链，并为 Git 策略测试安装 Git 与 Git LFS。在仓库根目录安装依赖：

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

文档和本仓库维护的社区模板使用：

```bash
npm run docs:check
git diff --check
```

已登记的根目录文档和当前开发指南还须运行源码核对的内容与示例测试：

```bash
npm run build
node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js
```

登记清单位于 `tools/checks/impact-documentation.ts`；历史记录和兼容存根不登记。新增或迁移当前页面时，同步维护登记和 `docs-example` 标记。修改已登记事实时，同步更新中英文、对应源码规则，并补充回归测试。详见[文档内容检查](docs/development/README.zh-CN.md#documentation-content-checks)。

核心产品行为变更使用：

```bash
npm run check
git diff --check
```

其他已提交改动使用不可变的已提交输入运行 `npm run ci:plan -- --base origin/main --head HEAD --output /tmp/impact-plan.json`，再执行计划选中的 `npm run ci:check` 任务；每次运行使用新的报告路径。涉及包内容的计划须增加 `--compare`；使用新输出路径和符合实际平台的任务，其他平台／宿主由 CI 执行。文档媒体还须通过计划选中的资源检查。

CI 对混合维护取检查并集。产品逻辑、协议、运行时依赖与内置技能指令须执行完整产品矩阵；构建／生成输入使用包比较及生成／构建测试与三平台安装冒烟。归属未知或比较未解决会阻断。每条 PR 路线都由 `Complete candidate evidence` 门禁；该名称代表受保护聚合，不代表完整矩阵覆盖。详见[按影响检查](docs/development/impact-checks.zh-CN.md#职责与检查)和 [CI 维护](docs/development/ci-maintenance.zh-CN.md)。测试使用隔离的配置与安装目录；安装、官方宿主、终端、实机和付费检查参见[测试与验收](docs/development/testing.zh-CN.md)。

## 准备 PR

保持变更集中。说明变更后的行为与相关取舍，并记录影响路线、选中任务、实际结果和限制。标题采用 `fix: ...`、`docs: ...`、`ci: ...` 等 conventional 风格。不要求 DCO sign-off。仅分享脱敏证据。

英文文档 Markdown 使用现有默认路径，完整简体中文对应文件命名为 `.zh-CN.md`，仅维护英文的根目录 `AGENTS.md` 和 `packages/cli/resources` 下的规范产品技能资源除外。GitHub Issue 表单与唯一 PR 模板在同一文件中包含双语。v3.9.2 及更早版本使用一个双语发布页；自 v3.10.0 起分别维护英文和简体中文页面。按[发布说明模板](docs/RELEASING.zh-CN.md#发布说明模板)编写，并在同一次变更中更新[英文](docs/releases/README.md)和[中文](docs/releases/README.zh-CN.md)两个发布说明索引。历史发布页除导航和状态说明外保持冻结；内部证据留在交付记录中。

在功能 PR 中同步更新受影响的中英文用户指南和技术指南。按[文档更新责任](docs/development/README.zh-CN.md#documentation-ownership)选择维护位置。当前流程放在 `docs/development`，冻结记录放在 `docs/development/history`；[CLI 参考](docs/reference/cli.zh-CN.md#协议与-schema-版本)是当前接口和格式版本的唯一来源。新增或重组页面时同步更新相应索引和链接。

交付时在 `docs/development/history/deliveries/` 新增中英文成对记录，并加入[交付索引](docs/development/history/README.zh-CN.md#delivery-records)，记录源码与产物身份、实际检查、结果和限制。不得改写冻结记录。迁移页面或章节时，在原路径保留简短兼容存根，维持原有链接和章节锚点。仅文档维护不产生产品版本、标签、Release 或 npm 发布。

新增或更换截图、终端捕获时，须在同一变更中更新[图片索引](docs/images/README.zh-CN.md)、中英文图库 README 与状态条目、目录树、相关指南以及捕获／来源清单；引用文件、SHA-256、尺寸和字节数必须一致。使用中性示例路径，不得重新编码或改写冻结归档图片。

按需更新文档、截图、CHANGELOG 和关联 Issue；模板中其他项目明确填写“不适用”。项目 README 用于功能介绍和使用说明，发布版本、交付状态和更新叙述放在变更日志、发布说明或开发记录中。

PR 面向 `main`，合并前同步主线，并要求最终审查 head 通过 `Complete candidate evidence`。保留[仓库保护](docs/development/repository-governance.zh-CN.md#主线保护与检查)。单人维护项目不强制第二个人审批，但维护者和自动化账号仍须遵守 PR 与 CI 要求。发布是独立的维护者操作，详见[发布指南](docs/RELEASING.zh-CN.md)。

### 分支命名

贡献者和编码代理为新的开发分支采用 `<type>/<short-description>`。类型使用 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`、`build`、`perf` 等常见变更类型；这些是示例，不是强制校验的白名单。简短描述使用小写英文字母、数字和短横线，例如 `feat/add-profiles`、`fix/render-width` 或 `docs/update-guide`。

将此格式作为完整分支名，替代桌面应用的默认分支前缀，不额外添加用户名或工具前缀。此规则不会修改应用设置。通过应用界面创建分支时，在确认前核对完整名称。

此约定适用于新的开发分支。保留现有分支名、`main`、版本标签及外部自动化管理的分支。历史记录和已归档流程保留原始名称与约定。

## 平台验收跟踪

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)跟踪既有平台验收缺口。提交实际验证结果时，请说明被测源码或安装包、环境、步骤、结果和剩余限制，并区分实体桌面／电源证据与自动化测试、PTY 和重建截图。已接受的六项既有缺口仍标为未验证，不能豁免新的自动化失败。付费模型检查须有已批准的预算和共享台账。普通缺陷请使用通用 Bug 表单。
