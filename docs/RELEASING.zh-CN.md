# 发布 npm、GitHub 与 Gitee Release

[English](RELEASING.md) | **简体中文**

GitHub 是审查、CI 与 Release 的主库。npm 分发 TypeScript 软件包，Gitee 同步已验证的代码和交付文件。安装见[使用指南](USER_GUIDE.zh-CN.md#安装与接入)。旧版本的操作及证据见[交付与历史索引](development/history/README.zh-CN.md)。

[发布准备](#current-typescript-publication) · [源码与证据](#绑定源码的-ci-证据晋级) · [标签与草稿](#发布身份与不可变附件) · [npm OIDC](#通过-github-actions-可信发布-npm) · [公开下载](#github-正式发布与公开验证) · [Gitee](#gitee-代码与-release-同步) · [交付记录](#记录交付)

<a id="current-typescript-publication"></a>

## 准备 TypeScript 发布

1. 确认发布范围、渠道及[应用版本](../packages/core/src/release.ts)。使用固定开发工具链，按贡献指南的命名约定从当前 `main` 创建分支。更新双语变更记录和版本说明。规范源变化时重新生成对应资源。参见[贡献指南](../CONTRIBUTING.zh-CN.md)和[开发指南](development/README.zh-CN.md)。
2. 正式版发布需新增维护者决定 JSON，并登记版本、路径和准确批准日期。校验器从不可变源码归档读取这两份文件。决定仅适用于该版本与六项既有未验证缺口，所有必需的自动化门禁均须通过。参见[审批登记表](releases/approvals/registry.json)和[发布数据规则](development/ci-maintenance.zh-CN.md#发布数据与验收策略)。
3. 执行影响计划选中的检查。最终审核的 PR head 须通过 **Complete candidate evidence**，合并后等待主分支验证通过。预览版和正式版公开发布均要求 A/B 语言完整就绪。参见[按影响检查](development/impact-checks.zh-CN.md)和[语言发布流程](development/i18n-workflow.zh-CN.md)。
4. 将双语版本说明存入 `docs/releases/<tag>.md` 及其中文配对页。Release 标题使用英文，公开正文包含两种语言。记录用户可见改动、支持的平台及运行时、兼容性、安装方式和已知限制，并与该版本证据及[运行要求](USER_GUIDE.zh-CN.md#运行要求)核对。将新版本加入中英两版[发布说明索引](releases/README.zh-CN.md)。

例行仓库维护走专项检查和已验证主分支同步。产品发布由维护者单独决定。

## 绑定源码的 CI 证据晋级

根据已验证的 PR 与主分支记录选择发布源码。下文中 `SOURCE_COMMIT` 是选定源码的完整 SHA，`RELEASE_TAG` 是获批的版本标签，`RELEASE_ROOT` 是存放本次交付文件与报告的隔离目录。将 `DRAFT_TGZ` 设为下载的草稿软件包绝对路径。

| 已接受源码 | 标签与交付证据 |
| --- | --- |
| 完整产品源码 | 给经已验证主分支合并可达的已接受 PR 源码打标签。发布原始 CI 软件包和其他三件文件。最终 PR 提供完整产品覆盖，主分支提供独立验证的集成冒烟。 |
| 维护源码 | 给已在主分支验证的维护源码打标签。构建该源码自己的四件交付文件，核对独立构建和交付源码重建，通过已接受代码验证运行时等价，并对新制品执行三平台安装冒烟。发布绑定关联本次专项证据和原完整产品运行。 |

遵循 [CI 分流与阻塞规则](development/ci-maintenance.zh-CN.md#路由表与阻断条件)和[维护证据规则](development/impact-checks.zh-CN.md#证据与晋升)。

### 跨 CI 版本的发布证据

带标签的源码决定证据格式和历史配置。核对最新适用的主分支／标签关系、原制品 ID 及摘要、原执行与重试身份，以及拆分安装的每个阶段。复用已验证的 v1 基线时保留其原完整历史身份。混合改动还需保留必需的素材或批准回执。参见[完整证据规则](development/ci-maintenance.zh-CN.md#完整证据的版本)。

晋级使用原始完整候选制品。工作作业输入清单、传输探针与手动对照保留各自的执行用途或诊断身份。任何必需证据失败、缺失、过期或损坏时，先通过适用的自动流程解决，再继续发布。参见[制品与证据规则](development/ci-maintenance.zh-CN.md#独立校验与-maintag-专项义务)。

## 发布身份与不可变附件

1. 在 `SOURCE_COMMIT` 创建带注释标签并推送明确的标签 ref。核对远端标签对象和解引用提交，等待所选路线的标签 CI 通过。在交付记录中保留标签、源码和软件包身份。
2. 从通过验收的路线取得四件交付文件。以下名称中的 `VERSION` 表示应用版本。
   - `fbincon-claude-code-statusline-VERSION.tgz`
   - `claude-code-statusline-VERSION-source.tar.gz`
   - `build-manifest.json`
   - `SHA256SUMS`
3. 确认独立构建及交付源码重建复现了验证过的文件。`npm run release:build -- --commit "$SOURCE_COMMIT" --output NEW_DIRECTORY` 执行两次构建。从交付归档重建时，加上 `--source ABSOLUTE_SOURCE_ARCHIVE` 并使用另一个新目录。Git 导出按所选树的普通文件清单和 blob 身份核验，交付源码重建使用归档清单与摘要。
4. 为该标签准备 GitHub Release 草稿。正式版发布时设为 Latest，预览版标记为预发布并关闭 Latest。以 `docs/releases/<tag>.md` 为基准，将公开说明中的仓库相对链接及图片解析为固定标签的 blob/raw 链接，保留外部 Issue、CI 链接与代码示例。上传四件已验证文件。将草稿附件下载至新目录，与原件核对清单、大小和 SHA-256 摘要。在匹配源码的检出目录运行 `npm run release:verify -- --artifact "$DRAFT_TGZ" --commit "$SOURCE_COMMIT"`，使下载的 tgz 与其他三件文件处于同一目录。参见[发布 Markdown 工具](../tools/release/markdown.ts)和[隔离安装检查](development/testing.zh-CN.md)。

核对准确的 ref、提交与摘要后，才可修正未发布草稿的附件或标签。正式公开后，保留标签对象与附件字节，产品修复通过新版本交付。Gitee 副本需单独核对字节。参见 [GitHub 不可变 Release](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)。

## 通过 GitHub Actions 可信发布 npm

[Publish npm with OIDC 工作流](../.github/workflows/npm-publish.yml)准备已验证的交付文件并发布其中的 tgz。它解析完整源码晋级记录或维护源码绑定。完整源码路线使用原覆盖上下文重新执行 `release:prepare` 核验。维护源码路线重新验证本次交付包及其与原产品覆盖的关联。

### npm 端首次配置

复用为本仓库及工作流验证过的绑定。新建绑定时，在 npm 包设置中选择 **Trusted publishing → GitHub Actions**。Owner 填 `fbincon`，仓库填 `claude-code-statusline`，工作流文件名填 `npm-publish.yml`。Environment name 留空，并开启 npm publish 和 dist-tag 操作。保留账号 2FA，待新版本准备好并能在 npm 规定的时限内首次发布时再创建绑定。参见 [npm 可信发布文档](https://docs.npmjs.com/trusted-publishers/)。

### 试运行与正式发布

工作流 ref 与 `tag` 输入使用同一个带注释标签。标签须包含发布工作流及匹配的校验器。最终 PR、主分支、标签和草稿均通过检查后，触发试运行。

```bash
gh workflow run npm-publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" --field "tag=$RELEASE_TAG" --field dry_run=true
```

等待成功，核对工作流摘要及 `npm-publish-bundle` 与已审核源码和草稿四件文件相符。首次新版本发布验证 npm OIDC 绑定。获得本次发布授权后，从同一标签触发正式发布。

```bash
gh workflow run npm-publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" --field "tag=$RELEASE_TAG" --field dry_run=false
```

等待结果。仅隔离的发布任务具有 `id-token: write`。它禁用生命周期脚本，上传已准备好的 tgz，核对公开的 SHA-256 与 SHA-512 完整性，正式版选 `latest`，预览版选 `beta`，并保留其他选择器。新上传完成时保留原始 `npm-publication` 回执和来源证明。`already-published` 表示核对了既有发布的字节和目标选择器。该分支报告已有发布，不产生新的 OIDC 回执。

结果不明时，先检查 registry 的精确版本状态，等公开元数据可用后再决定是否重试。比较软件包字节、完整性与选择器。首次上传及来源证明与后续只读核验重试分别记录。参见 [npm 精确版本生命周期 API](https://api-docs.npmjs.com/#tag/Packages)。

## GitHub 正式发布与公开验证

npm 发布及公开 registry 验证完成后，发布已核验的草稿。确认标签、提交、Release 类型及四件附件。正式版推进 GitHub Latest，预览版使用预发布标记并保留已有的正式版 Latest。

精确版本标签的 [Release public downloads](../.github/workflows/preview-downloads.yml) 工作流须全部通过。工作流比对匿名下载字节，在 Linux、Windows 和 macOS 分别用 Node 22 和 24 安装精确版本及其渠道选择器。签名作业检查公开软件包、打包的已签名上游依赖及 OIDC 来源证明。只读重验时显式选择已发布标签，并使用应用版本与标签一致的校验器检出。渠道选择器须仍指向该版本。分别记录发布源码和校验器 SHA。

## Gitee 代码与 Release 同步

使用独立的 `gitee` SSH 远程。获取 GitHub 和 Gitee refs，确认 Gitee `main` 与通过必要 CI 的 GitHub `main` 相同或是其祖先。将该 GitHub 提交的完整 SHA 设为 `VALIDATED_MAIN`。发布版本时，核对本地带注释标签对象及提交与 GitHub 一致，并确认 Gitee 的同名标签相同或尚不存在。引用分叉时先解决，再推送。

```bash
git push gitee "$VALIDATED_MAIN:refs/heads/main"
git push gitee "refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"
```

例行代码同步使用主分支 refspec，版本发布使用对应的标签 refspec。推送后读取两端的 `main`、标签对象和解引用提交，核对预期身份。

GitHub 发布并验证后，在 Gitee 创建对应 Release，使用相同的标签、提交、标题和预发布状态。使用 [Gitee 官方 MCP](https://gitee.com/oschina/mcp-gitee)。通过 `POST /repos/{owner}/{repo}/releases/{release_id}/attach_files` 上传附件。写入 Release 元数据时使用表单编码字段和小写布尔值。[Gitee 官方 Release API](https://gitee.com/api/v5/swagger)复用已有 Release 前，先核对其元数据和现有附件。仅上传四件已验证 GitHub 附件中缺少的文件，发现冲突时停止。上传后匿名重新下载四件文件，与 GitHub 原件比较名称、大小和 SHA-256 摘要。

### 生成平台适配说明

保存对应 Gitee Release 的完整 JSON 及当前正文，作为恢复记录。导出已公开的 GitHub Release JSON，包含 `body`、`html_url`、`published_at`、标签、预发布状态和附件。将全部分页的 Gitee Release 及实际附件地址导出为一个 JSON 数组。确认两端 Release 和已验证附件就绪后，在隔离目录生成说明。

```bash
npm run release:gitee-notes -- \
  --tag "$RELEASE_TAG" \
  --github-release-json "$RELEASE_ROOT/github-release.json" \
  --gitee-releases-json "$RELEASE_ROOT/gitee-releases.json" \
  --output "$RELEASE_ROOT/gitee-notes.md"
```

生成器以 `docs/releases/<tag>.md` 为基准解析相对链接，并使用实际附件地址。将输出与公开的 GitHub 正文对照审查。通过官方 MCP/API 更新 Gitee 正文，保留接口要求的原元数据字段。更新必须携带原 `tag_name`、`name` 和 `body`；仅发送正文的 PATCH 不足。更新后读取验证新正文，以及预期的标签、目标提交、预发布状态和附件身份。凭据沿用维护者的 SSH 和密钥环配置。不同软件包格式分别参见[生成器约定](../tools/release/gitee-notes.ts)和[历史 wheel 同步](development/history/release-procedures.zh-CN.md#python-发行版的-gitee-同步)。

## 记录交付

记录源码 SHA、主分支合并、带注释标签及四件文件的摘要。链接必需的 PR、主分支和标签 CI、npm 发布及来源证明、公开下载和签名检查，以及两端的公开 Release。区分本次执行的检查、复用覆盖、重试和诊断。按实际范围与限制记录单独获准的本机、实机或付费检查，随该版本决定保留六项未验证缺口。原始日志和机器路径保存在隔离验收输出中。

[变更记录](../CHANGELOG.zh-CN.md)负责发布日期和摘要，版本说明负责用户可见改动，[交付记录](development/history/README.zh-CN.md)负责检查与源码身份。按正常专项路线合入证据文档，再同步已验证的主分支。

## 历史章节链接

以下链接保留原发布流程与各版本证据。完整时间线见[发布历史](development/history/release-procedures.zh-CN.md)。

### TypeScript 分版本交付记录

- <a id="v3163-内置配置技能"></a>[v3.16.3 内置配置技能](development/history/release-procedures.zh-CN.md#v3163-内置配置技能)
- <a id="v3162-快捷键与编辑器修复"></a>[v3.16.2 快捷键与编辑器修复](development/history/release-procedures.zh-CN.md#v3162-快捷键与编辑器修复)
- <a id="v3161-运行来源与保存冲突修复"></a>[v3.16.1 运行、来源与保存冲突修复](development/history/release-procedures.zh-CN.md#v3161-运行来源与保存冲突修复)
- <a id="v3160-语言扩展"></a>[v3.16.0 语言扩展](development/history/release-procedures.zh-CN.md#v3160-语言扩展)
- <a id="v3150-增量语言工作流"></a>[v3.15.0 增量语言工作流](development/history/release-procedures.zh-CN.md#v3150-增量语言工作流)
- <a id="v3140-自适应与连续背景"></a>[v3.14.0 自适应与连续背景](development/history/release-procedures.zh-CN.md#v3140-自适应与连续背景)
- <a id="v3130-草稿历史与复用"></a>[v3.13.0 草稿历史与复用](development/history/release-procedures.zh-CN.md#v3130-草稿历史与复用)
- <a id="v3120-来源命令与包管理"></a>[v3.12.0 来源、命令与包管理](development/history/release-procedures.zh-CN.md#v3120-来源命令与包管理)
- <a id="v3110-任务浏览与版本审核"></a>[v3.11.0 任务浏览与版本审核](development/history/release-procedures.zh-CN.md#v3110-任务浏览与版本审核)
- <a id="v3100-外观与理解"></a>[v3.10.0 外观与理解](development/history/release-procedures.zh-CN.md#v3100-外观与理解)
- <a id="v392-正确性修复"></a>[v3.9.2 正确性修复](development/history/release-procedures.zh-CN.md#v392-正确性修复)
- <a id="v391-native-容量补丁"></a>[v3.9.1 Native 容量补丁](development/history/release-procedures.zh-CN.md#v391-native-容量补丁)
- <a id="v380-git终端与版本管理"></a>[v3.8.0 Git、终端与版本管理](development/history/release-procedures.zh-CN.md#v380-git终端与版本管理)
- <a id="v370-图形分组刷新与速率"></a>[v3.7.0 图形、分组、刷新与速率](development/history/release-procedures.zh-CN.md#v370-图形分组刷新与速率)
- <a id="v360-扩展交付"></a>[v3.6.0 扩展交付](development/history/release-procedures.zh-CN.md#v360-扩展交付)
- <a id="v350-首次设置与完整外观"></a>[v3.5.0 首次设置与完整外观](development/history/release-procedures.zh-CN.md#v350-首次设置与完整外观)
- <a id="v340-方案项目与任务详情"></a>[v3.4.0 方案、项目与任务详情](development/history/release-procedures.zh-CN.md#v340-方案项目与任务详情)
- <a id="v330-输入诊断发布"></a>[v3.3.0 输入诊断发布](development/history/release-procedures.zh-CN.md#v330-输入诊断发布)
- <a id="v320-配置体验发布"></a>[v3.2.0 配置体验发布](development/history/release-procedures.zh-CN.md#v320-配置体验发布)
- <a id="v314-性能后续工作"></a>[v3.1.4 性能后续工作](development/history/release-procedures.zh-CN.md#v314-性能后续工作)
- <a id="v313-迁移后修复"></a>[v3.1.3 迁移后修复](development/history/release-procedures.zh-CN.md#v313-迁移后修复)
- <a id="v312-外部-tui-回归交付"></a>[v3.1.2 外部 TUI 回归交付](development/history/release-procedures.zh-CN.md#v312-外部-tui-回归交付)
- <a id="当前外部-tui-正式交付"></a>[v3.1.1 外部 TUI 正式交付](development/history/release-procedures.zh-CN.md#v311-外部-tui-正式交付)
- <a id="当前地区语言与-node-正式版流程"></a>[v3.1.0 地区语言与 Node 正式交付](development/history/release-procedures.zh-CN.md#v310-地区语言与-node-正式交付)

### TypeScript 首次预览及正式发布

- <a id="typescript-正式发布"></a>[TypeScript 正式发布](development/history/release-procedures.zh-CN.md#typescript-正式发布)
- <a id="typescript-首预览发布历史"></a>[TypeScript 首预览发布历史](development/history/release-procedures.zh-CN.md#typescript-首预览发布历史)

### Python 与 PyPI 发布

- <a id="已归档的-python-发布流程"></a>[已归档的 Python 发布流程](development/history/release-procedures.zh-CN.md#已归档的-python-发布流程)
- <a id="原生编辑器发布门槛"></a>[原生编辑器发布门槛](development/history/release-procedures.zh-CN.md#原生编辑器发布门槛)
- <a id="准备发布提交"></a>[准备发布提交](development/history/release-procedures.zh-CN.md#准备发布提交)
- <a id="维护双语文档"></a>[维护双语文档](development/history/release-procedures.zh-CN.md#维护双语文档)
- <a id="按提交构建分发包"></a>[按提交构建分发包](development/history/release-procedures.zh-CN.md#按提交构建分发包)
- <a id="生成与核验校验文件"></a>[生成与核验校验文件](development/history/release-procedures.zh-CN.md#生成与核验校验文件)
- <a id="创建标签与草稿-release"></a>[创建标签与草稿 Release](development/history/release-procedures.zh-CN.md#创建标签与草稿-release)
- <a id="正式发布与下载验证"></a>[正式发布与下载验证](development/history/release-procedures.zh-CN.md#正式发布与下载验证)
- <a id="可信发布者配置"></a>[可信发布者配置](development/history/release-procedures.zh-CN.md#可信发布者配置)
- <a id="testpypi-验收"></a>[TestPyPI 验收](development/history/release-procedures.zh-CN.md#testpypi-验收)

### Python 分版本发布门槛

- <a id="v130-正式晋升"></a><a id="v130-预览推进"></a>[v1.3.0 正式晋升](development/history/release-procedures.zh-CN.md#v130-正式晋升)
- <a id="v140-显示项发布"></a>[v1.4.0 显示项发布](development/history/release-procedures.zh-CN.md#v140-显示项发布)
- <a id="phase-4-预览与正式晋升"></a>[Phase 4 预览与正式晋升](development/history/release-procedures.zh-CN.md#phase-4-预览与正式晋升)
- <a id="phase-5-预览与晋升"></a>[Phase 5 预览与晋升](development/history/release-procedures.zh-CN.md#phase-5-预览与晋升)
- <a id="v161-外部-tui-层级补丁"></a>[v1.6.1 外部 TUI 层级补丁](development/history/release-procedures.zh-CN.md#v161-外部-tui-层级补丁)
- <a id="任务计时预览发布门槛"></a>[任务计时预览发布门槛](development/history/release-procedures.zh-CN.md#任务计时预览发布门槛)
- <a id="v170-正式晋升"></a>[v1.7.0 正式晋升](development/history/release-procedures.zh-CN.md#v170-正式晋升)
- <a id="v171-tui-优化"></a>[v1.7.1 TUI 优化](development/history/release-procedures.zh-CN.md#v171-tui-优化)
- <a id="v172-client-底部快捷键优化"></a>[v1.7.2 Client 底部快捷键优化](development/history/release-procedures.zh-CN.md#v172-client-底部快捷键优化)
- <a id="v177-文档与诊断修正"></a>[v1.7.7 文档与诊断修正](development/history/release-procedures.zh-CN.md#v177-文档与诊断修正)
- <a id="v180-原生预览背景"></a>[v1.8.0 原生预览背景](development/history/release-procedures.zh-CN.md#v180-原生预览背景)
- <a id="v180-双语界面"></a>[v1.8.0 双语界面](development/history/release-procedures.zh-CN.md#v180-双语界面)
- <a id="状态栏本地化发布门槛"></a>[状态栏本地化发布门槛](development/history/release-procedures.zh-CN.md#状态栏本地化发布门槛)
- <a id="项目查找与导入审阅发布门槛"></a>[项目查找与导入审阅发布门槛](development/history/release-procedures.zh-CN.md#项目查找与导入审阅发布门槛)
- <a id="条件显示与外观发布门槛"></a>[条件显示与外观发布门槛](development/history/release-procedures.zh-CN.md#条件显示与外观发布门槛)
- <a id="多语言发布门槛"></a>[多语言发布门槛](development/history/release-procedures.zh-CN.md#多语言发布门槛)
- <a id="组件实例版本门槛"></a>[组件实例版本门槛](development/history/release-procedures.zh-CN.md#组件实例版本门槛)
