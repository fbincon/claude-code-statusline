# 外部 TUI 呈现与交互修复

[English](external-tui-parity.md) | **简体中文**

更新日期：**2026-10-19**（Asia/Shanghai）。已交付：**v3.1.1**。状态：按本版维护者决定为 **DONE**。[机器可读交付证据](external-tui-parity.delivery.json)。

## 后续独立回归审查

下方 v3.1.1 记录作为历史保留。独立对照固定 v3.1.1 与 Python v2.0.0 后，又确认六项外部编辑器回归。[v3.1.2 修复及独立验收](external-tui-regressions.zh-CN.md)记录后续解决情况，不将此前 DONE 状态作为正确性证明。

## 决策与边界

对比 Python v2.0.0（`9b6d2fab4bf165be280d428a874521bfbf02c7e1`）与 TypeScript v3.1.0（`10de45895d2734a8ab1eacec09b57bc89417be51`）后，维护者确认实施计划：保留青色标题、整行选中、列对齐和六语言，恢复有用的外部编辑器信息并修复呈现缺陷。边框与背景保持终端默认值，保留四页、最低 64×18 及20行起完整边框。

公共 CLI、编辑器协议 12 及持久格式保持兼容；原生编辑器行为与 Python 归档保留。产品测试不引入 TUI 对 CLI 的依赖。项目 README 继续承担产品介绍，不新增发布历史。

## 实现

绘制入口保留既有导出，编排有界画布／ANSI、外部字段呈现、上下文快捷键及页面内容模块。共享协议元数据继续保持规范来源，外部字段不再复用原生编辑器的短名称。

修复完整分组线样式、单个省略号、用户原始值与继承值区分、每个动作只显示一个 Enter、分类／数字／搜索提示、紧凑操作入口、字段计数、格式作用域／返回提示、说明命中高亮与匹配片段、待确认配置文字标记、小窗口尺寸换行、预览复数及8色亮度。通知与行内键保持加粗，导入审阅保留青色标题和整行选中。

## 验证与证据

产品回归覆盖六语言，32×12、64×18、64×19、64×20、80×24、120×30、80×48，以及无颜色／8／16／256色。断言检查实际样式区段和按键行为，不只检查文字存在或图片摘要。既有迁移命名、后端、保存／取消、信号、缩放与终端恢复测试继续作为门槛。

`capture:editor -- --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE --extended` 捕获实际安装包的六语言 PTY 输出、上下文页面及七种边界尺寸；对相同真实终端单元使用明确的明暗默认配色重建图像，并断言完整分组线样式、实际操作、取消保持配置字节及终端恢复。这些图像是终端单元重建，不是操作系统截图或人工桌面／电源验收。原始流、单元和回执保留在忽略的验证目录。

本地 `npm run check` 已通过：969 项测试，965 项通过、4 项预期平台跳过、无失败；36项生成资源、2,051条文档链接、冻结归档及三份职责台账全部通过。11项新增产品回归放在 TUI 包内，每种语言为1,370个键。

最终安装包通过八安装目标、十三固定宿主组合及32项 Node 运行时验证，实际运行时版本为22.0.0、22.23.3、24.0.0和24.22.0。最终审阅的 [PR #105 head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39143608031)、[合并 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39145660480)及[标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39147113769)各55项全部通过。PR 经下述一次可用性重试，合并和标签均首轮通过。

最终安装包重新采集并通过252张 PTY 帧，覆盖六语言、四页面和上下文状态；取消后设置／显示文件字节不变，终端属性恢复。[50张选图和来源](../images/typescript/v3.1.1/README.zh-CN.md)分别记录图片检查、字体／色板及校验值。最终选图与此前已检查的图片字节一致，252张最终源码行为断言均重新执行。实际捕获使用256色能力，无颜色／8／16／256色覆盖来自独立产品断言。

## 固定发布身份

实现 [PR #104](https://github.com/fbincon/claude-code-statusline/pull/104)及验收修正 [PR #105](https://github.com/fbincon/claude-code-statusline/pull/105)形成源码 `b484dc9acc87bc55a2833904dd332827307603ca`。最终注释标签 `v3.1.1` 对象为 `0a74c5b40456725e2e7bd15be9d77d7fb7627a47`。两次独立构建和源码附件的两轮独立重建，四份交付文件均一致；合并／标签 CI 安装包及下载的 GitHub 草稿附件也一致。草稿 tgz 通过667个包文件校验和全部十项隔离离线安装检查。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.1.tgz` | 3448826 | `364a0c7fb3c8e7d1715fe5c8d0d5a77e65926bcb3dd6f1c00b3035fb6a73e609` |
| `claude-code-statusline-3.1.1-source.tar.gz` | 19108621 | `aebff6ad18db91c120df37cbbdc30fc851cdfc634adf949819f47d1ec51868d8` |
| `build-manifest.json` | 952 | `be28c29c4617dfea66b4029dfb78d2125d5b326dd5d7af1224cc2c1b3f1ded86` |
| `SHA256SUMS` | 302 | `1f5be22e6e2ee5a64faaf788fa2bb8dbd294bff4f95c6a27bd6fdc4e34a40582` |

固定构建使用 Node 24.21.0／npm 11.19.0。npm integrity 为 `sha512-u6f1IdIBOImlz9be/X+kGsMzT061TPpRXqDSYD572HoxGs87mPZMKs76CHAqPWNnu5KydhzgU8D3cq0bfreZ8A==`。SHA256SUMS 列出另外三份文件，本身摘要单独记于上表。

## 验收失败与修正

首个未发布候选暴露缩放测试时序竞争：小窗口发送的按键可能在放大后才被读取。100次同步探测均保持取消语义，原顺序200次复现2次保存。PR #105 在每次禁用键后等待完整小窗口帧，并在放大前检查配置字节，保留原迁移测试名称。修正测试本地连续30次通过，未改运行时取消路径。

一次 Windows Node 22.0.0 作业全部十项离线检查通过后，清理临时目录遇到 `ENOTEMPTY`。PR #105 对原生删除增加有界重试，仅在清理成功后写通过回执；持续清理失败仍阻断验收。

一次 macOS 26 Intel／Node 24.22.0 的 PR 作业在发布 journal 前无法建立写入者身份，新 runner 重试通过。审阅确认现有身份保护在失败时拒绝写入；未放宽保护、超时或断言，具体可用性原因未确定。这是已记录的失败尝试，不宣称修复了产品问题；最终合并和标签矩阵各自独立通过。

初始未发布标签对象 `e60fcb548f5aefff2b0d5d13ed6fa49a12ed07ed` 指向 `ff4f0de04f45b1d1d7a9e81010cfd2e122dc8b5c`。确认公开渠道不存在 v3.1.1 包或 Release 后，按已批准的未发布标签规则，以该精确旧对象为 lease 修正至上述通过的纯验收修正合并。667个包文件中仅 `candidate.json` 来源变化，其余666个运行时／资源文件字节一致。最终构建和捕获重新执行，未覆盖任何已发布版本、标签或附件。

两次源码重建分别遇到 registry TLS 重置／下载超时，失败目录排除。新重建以单次进程的 IPv4 优先 DNS、正常 TLS 完成，六个锁定依赖下载分别核对 SHA-512；两轮源码重建的四份文件均与最终交付一致，未修改源码、代理或路由配置。

## 发布决定

[v3.1.1 批准](../releases/approvals/v3.1.1.json) 单独记录维护者接受相同六项既有缺口，仅适用于本版。发布校验不接受借用其他版本批准，也不接受失败或缺失的自动化证据。D06 继续 FAIL，PERF-01 继续 NOT_STARTED。

上述固定构建、源码重建及最终 head／合并／标签检查建立发布资格。npm 收到已验证的 tgz，GitHub／Gitee 收到同一 tgz、源码 tar.gz、构建清单及 SHA256SUMS。批准记录 SHA-256 为 `7352650c32c059fb522ad11c19e804cda879d415a5f942168e667a24a82d2cbd`。[发布说明](../releases/v3.1.1.md#简体中文)。

## 公开交付

| 渠道 | 验证结果 |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.1) | `2026-10-18T17:27:50.672Z` 公开；`latest=3.1.1`、`beta=3.0.0-beta.1`；匿名包 SHA-256／SHA-512 一致 |
| [GitHub stable／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.1) | Release `416587715`，`2026-10-18T17:29:37Z` 发布；非草稿、非预览且为 Latest；恰好四份一致附件 |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.1) | Release `1216887`，`2026-10-19T01:30:03+08:00` 创建；相同源码／注释标签、四份匿名下载附件一致，十项离线安装检查全部通过 |
| [公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39149828588) | Linux x64、Windows x64、macOS ARM64 × Node 22.23.3／24.22.0 共六项全部通过；各自以新缓存、禁用生命周期脚本安装精确 `3.1.1` 和 `latest` |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39148939884) 先于[正式运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39149157401)通过。首次正式尝试已接受上传并签署 provenance（[透明日志](https://search.sigstore.dev/?logIndex=3314357879)），随后 registry 处理超过175秒公开可见等待。匿名元数据及包字节一致后，仅重试失败的验证作业，返回 `already-published`、未上传并成功完成。原超时保留记录，不视为第二次发布或豁免失败。

六份公开 CI 回执绑定最终源码、验证器源码、包摘要和两个 registry 选择器；本地公开下载检查也独立通过。Gitee 四份下载与上表一致，tgz 通过完整包校验和安装检查；自动仓库归档与交付的可重建源码附件分开记录。

GitHub 继续作为主仓库。确认 Gitee main 无分歧提交后，以明确、无强推的 refspec 同步已验证 main 和注释标签。本次文档／图库回填不移动公开标签或替换附件，保留历史发布、beta、Python 参考／图片、项目根 README 及个人现用安装。六项接受的实机／桌面／声明缺口仍为未验证／不可用，CI 和重建图不关闭这些缺口。D06 保持 **FAIL：104 pass / 60 fail / 28 inconclusive**，PERF-01 保持 **NOT_STARTED**。
