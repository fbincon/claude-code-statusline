# 增量语言工作流实现

[English](i18n-02-delivery.md) | **简体中文** · [设计](i18n-workflow.zh-CN.md) · [工作包](development-plan.zh-CN.md#i18n-02)

I18N-02 三个切片已于 2026-10-30 随 v3.15.0 交付，GitHub／npm／Gitee 发布、公开验证和本机验证均已完成。以下最终来源与证据保留各自原始身份。

## 起点与兼容性准备

实现从 `745336e969937c56d12e6866cd05fa56debf429a`、产品 v3.14.0 开始，日期为 2026-10-30（Asia/Shanghai）。六个规范语言包各有 2,311 个键。现有 92 项生成资源漂移检查通过；语言输入与已验收 v3.14.0 来源 `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0` 相同。

兼容 [PR #187](https://github.com/fbincon/claude-code-statusline/pull/187) 已合并为 `f4f5b944cd1e446ace650da26740517bca1fda3e`。最终头 `30d606e464b91ed5343c096f921324e84e01a89a` 通过本地 Linux 专项任务及三平台 [PR 检查](https://github.com/fbincon/claude-code-statusline/actions/runs/40966696928)；[main 验证](https://github.com/fbincon/claude-code-statusline/actions/runs/40967505441)通过已接受基线验证器。实际包比较证明运行内容等价，未选择完整产品矩阵。该准备阶段保留严格完整语言包；功能交付一起启用元数据、有效资源、维护工具及前端来源处理。

构建期分析器位于 `tools/generation/i18n/`，版本化数据放在其 `data/` 目录。输入登记为构建职责，需要生成、消费前端检查及实际包比较。原始字典仍在规范资源目录。分析器只读取声明的字节映射，不访问 Git、网络、时钟或文件系统；已接受基线的导出器将分析器与独立证据读取器一起保留。

`release:prepare --candidate` 将产品验收与发布准备状态分开。策略启用后，现有 `--stable`、`--preview`、完整来源 tag 提升、维护来源发布绑定及 npm 发布均要求语言达到发布条件。原完整／维护证据外层格式及身份不变，增加可选的版本化 `language` 字段。新格式证据缺失不能使用 v3.15 前的兼容路径。历史 `sourceHashes()` 和 `policyDigest()` 的含义不变。

记录将准确来源提交和确定性报告绑定到英文、原始译文、验收／上下文／术语／策略／历史及生成器输入。报告区分存在、当前有效、已验收、回退和退休条目。验收来源保留实际验证范围；结构检查不代表母语者审阅。即使可以回退英文，新提交的不安全模板仍失败。

## 有效资源与维护工具

功能保持六个原始语言包不变。每种语言先从独立核验的原 PR `40905911155`（第 2 次尝试）、验收 artifact `12920128077` 建立 2,311 项匹配基线；ZIP SHA-256 为 `001ab7e32a3fa899d2abaf3e2f8879f606f307a615fccafa6fdc5ddb65f6ddc8`。版本控制中的快照绑定每个原始语言，运行时生成不依赖网络或仓库历史。随后为每种语言的三个“界面立即保存／显示保存”标签补充上下文／术语，并通过真实 `validate`／`accept` 命令完成当前上下文验证。每种语言有 2,308 项基线和三项当前验证记录；原始短语未变，不推断母语者审阅。

分析器产生唯一的确定性有效字典和来源映射。Node 界面资源仍聚合，Native 界面字典和回退清单仍按语言拆分，状态栏模块只含有效 `statusline.*` 消息。打包时以有效 JSON 替换原始 JSON；运行包不含生命周期历史或验收记录。生成时英中必须完整，未完成 B 条目使用当前英文；公开发布要求 A/B 全部验收。未来明确注册 C 语言时须定义维护范围并如实披露，本任务不新增可选语言。

开发命令为 `languages report`、`freeze`、`validate`、`accept`、`release-check`，通过 `npm run languages -- ...` 调用；`languages:coverage` 是 JSON 报告别名。冻结读取固定提交，不构建、测试、联网或修改源。验证记录准确源／译文／生成器输入和实际上下文审阅；只有显式验收发布匹配记录并保留旧契约。输入变化使待接受的验证文件失效。`generate`、`generate:check`、`check` 保留既有集成职责。

纯 `messageOrigin` 在双编辑器预建搜索中保留英文回退证据，不改变排名或高亮；已验收且同英文的技术词保留所属语言。界面语言、输出语言和宿主 Apply 的持久化继续独立。显示 schema 17、编辑器协议 30 不变。Client props 不增加字典、报告或历史，继续执行独立 props／Pane／Client 预算及保存恢复规则。

## 验证与交付状态

专项兼容测试覆盖源文案／译文／上下文／术语变化、历史占位符和删除、重复及不安全输入、合法英文术语、未来社区语言披露、准确包资源及证据篡改拒绝。独立验证器回归也将 HEAD 的分析器替换为空操作，确认已接受基线代码仍拒绝被修改的字节。

发布前来源 `96b4971c6b0c8ab33d4d57b6c02dd5647f27c41d` 通过完整本地检查：1,463 项通过、六项既有平台限定跳过，并通过 92 项生成资源、4,005 个文档链接、冻结归档和职责账本检查。双 Mod 通过官方验证／测试及 Claude 2.1.312 精确声明；283 项容量案例在该实际宿主全部通过。已安装语言专项诊断通过全部 36 种组合，明确不可提升，不替代完整安装或 Actions 证据。两次独立构建相同，包 SHA-256 为 `8d73f2b6852ffdb149283c2c6f033ae62ee208efdd844897f9498d8b0c92c5cf`。

首次构建因本机 `/tmp` 写入配额耗尽失败。同源重试改用磁盘文件系统上的任务私有目录并保留失败日志，没有放宽产品规则或期限。随后补充的专项保护拒绝不完整启用元数据及无法核验的旧版本语法，三项证据测试通过。最终来源验收和发布身份另行记录，不将这些早期执行改标为最终来源。

I18N-02 已完成，包括 v3.15.0 发布、Gitee 同步和测试机验证。仅保留 issue #96 六项既有已接受但未验证缺口，不豁免新增自动化失败。未运行付费模型测试。发布后新发现只提 issue，不补发修补版。

<a id="final-release"></a>

## 最终来源与发布

功能 [PR #188](https://github.com/fbincon/claude-code-statusline/pull/188) 接受来源 `73096d7851feb855ba36ed5640034b77951cdb79`。正常合并提交为 `3ffea73e2d13252f226e68922524a09e618aa843`，第一父提交为兼容准备合并 `f4f5b944`，第二父提交为已验收来源。注解 tag 对象 `5ef6a815c14602fd0b15364cec38cd88fd31bfcb` 指向该来源，且可从 main 到达。

| 门禁 | 原始运行与结果 |
| --- | --- |
| 最终 PR | [40971513208](https://github.com/fbincon/claude-code-statusline/actions/runs/40971513208)，首次尝试通过：八安装目标、32 Node 情况、十六固定宿主及 `Complete candidate evidence` |
| main 集成 | [40980771635](https://github.com/fbincon/claude-code-statusline/actions/runs/40980771635)，首次尝试通过：已接受基线核验及三平台集成冒烟 |
| 注解 tag | [40981220044](https://github.com/fbincon/claude-code-statusline/actions/runs/40981220044)，首次尝试通过：原始证据提升及严格语言发布门禁 |
| npm OIDC | [预演 40981921941](https://github.com/fbincon/claude-code-statusline/actions/runs/40981921941) 与[新版本发布 40982136714](https://github.com/fbincon/claude-code-statusline/actions/runs/40982136714)，均首次尝试通过 |
| 公开验证 | [40982689125](https://github.com/fbincon/claude-code-statusline/actions/runs/40982689125)，首次尝试通过：Linux／Windows／macOS × Node 22／24 六项下载／安装任务及签名任务全部通过 |

原始候选 artifact 为 `12939848889`，ZIP SHA-256 为 `e0643c997ab3c0cb05fa38a31fe79540bd06b91a5a8b9a43f0c0e0d3bc8deb0f`；完整验收 artifact 为 `12943673752`，ZIP SHA-256 为 `5a8fba6c3687518a763c1a88a98d8e450d74d98a50535300e33f3510796d4e7b`。来源／尝试／任务归属、全部 59 个引用 artifact 及 PR／main／tag 关系均已独立复核。从已接受基线 `f4f5b944` 导出的分析器重现最终语言报告 SHA-256 `d6eae34382272132d5378d1ed7bf78509e62438659ba656370b701ac7371617e`。每种语言当前 2,311 项均已验收，缺译、过期、待验证、无效及回退均为零。

最终来源的本地验收还通过 27 类共 28 项完整安装测试，包含全部 36 种界面／输出组合、42 项 Native／外置编辑器 PTY 流程及六语言共 24 项外置界面捕获。283 项容量案例保留原 271 项并新增十二项语言案例。早期 `96b4971` 检查仍归属原来源；自动化终端和代理检查的重建图像不代表实体或人工验收。

最终来源的两次独立构建及交付源码归档重建，与四项原始 CI 文件完全一致。发布的交付文件仅为以下四项：

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.15.0.tgz` | `9064fa583037b57c3b3d0c876fabe6dd15e63c4a9b8e52446e1a2ef9dcabe683` |
| `claude-code-statusline-3.15.0-source.tar.gz` | `000059c92b98ffc5be3372504e1e884f0f40997e5ba58d05a3aae0a449e53e4e` |
| `build-manifest.json` | `bdd9fc33b5e85858f30388230d9b99c2c22894d8af0a5b0550c6a1e9b9ced714` |
| `SHA256SUMS` | `bb9737158ff48b410fc1a604fb98bbccb33a90be220a0224dad81b05eb480960` |

[GitHub Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.15.0) `428538015` 为稳定版、Latest 且不可变，发布时间为 `2026-10-30T00:55:17Z`。草稿与公开附件均已下载并和原始 CI 字节比较。[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline) 的 `latest=3.15.0`，保留 `beta=3.0.0-beta.1`；发布回执记录新版本 `published` 操作。签名报告验证真实公开包、六个随包公开上游及精确 tag／来源／工作流运行的 provenance。随包私有工作区仍不支持原生全树审计，专用验证范围保持不变。

[Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.15.0) `1255035` 保留同一来源及四项附件字节。main 和注解 tag 通过明确 refspec 同步并核验；四项附件全部匿名重下比较。Gitee 自动生成的两个源码链接与四项交付文件分开记录。较慢的源码下载超过首次传输时间窗，服务端也不支持断点续传；重新完整下载后通过原始摘要检查，失败传输仅作为诊断记录。双语 Gitee 说明使用实际附件 URL。

## 本机验证与剩余限制

测试机在已验证、无冲突的 dry-run 后，通过受支持包命令从 3.14.0 升级到 3.15.0；事务 `pkg-af68f02c-903d-4156-8005-e22c2cf64e9e` 保留恢复入口。实际会话检查前后，全部 1,062 个安装文件均与公开包一致。已安装 Native 插件及缓存 manifest 均为 3.15.0，外置编辑器已注册；原有运行时采集关闭偏好保持不变。Doctor 磁盘检查通过，保留预期的实际会话未核验提示；实际加载由下述会话独立确认。

在 Claude Code 2.1.312 上，200 × 50 的六项真实外置／Native 流程全部通过：六种界面语言、英文搜索证据、UI 即时持久化、输出语言取消／保存／重开及恢复。Native 使用无外网路由的 Linux 用户／网络命名空间，仅对子进程明确选择全屏渲染，正常退出并记录零模型请求。脚本先在隔离候选安装中通过；输入顺序、保存确认和宿主焦点／渲染器诊断不算产品失败或可提升 CI 回执。

恢复后，九处原显示／UI／方案／来源／宿主偏好保留原字节、权限和缺省状态，仅将本项目拥有的 backendVersion 更新为 3.15.0。实际配置的状态栏命令随后用受控样例验证模型、目录和剩余上下文含义，再次确认偏好不变。发布后未观察到新的产品问题。六项 [#96 缺口](https://github.com/fbincon/claude-code-statusline/issues/96)按 [v3.15.0 决策](../releases/approvals/v3.15.0.json)继续标为未验证。SHOWCASE-01 及其原有前置条件不变。
