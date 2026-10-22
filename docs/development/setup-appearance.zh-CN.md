# 首次设置与完整外观实现

[English](setup-appearance.md) | **简体中文**

开发基线为 `a268fcb3b2ed8ad89da07d7e36e70fa8f4e691f2`（v3.4.0 加仓库整理）。本次为 v3.5.0 实现 SETUP-01、APPEARANCE-01、APPEARANCE-02；SHOWCASE-01 与外部数据来源仍为独立工作。

## 实现

- CLI 设置服务以无写入探针、无安装锁的方式检查文件，对已审阅资源记录指纹，先保存用户默认显示，再独立应用接入。`ConfigurationService.saveDisplay` 无需已有接入，也不应用宿主偏好。安装器在文件锁内复核审阅资源，持久化备份与恢复日志准确保留部分提交结果。
- 共享纯状态设置 reducer 与现有 Quick setup reducer 驱动终端向导。两种配置编辑器共用另存副本流程与所有外观字段，原生副本由生成器产生。宿主 Apply 保持独立，共享方案保存展示关联项目。
- 既有预设注册表扩展三套完整方案，单方案 JSON 示例由生成器确定性输出，不包含项目绑定、宿主偏好或采集授权。已保存副本保留独立身份，不随内置方案自动刷新。
- 显式行、自动换行、spacer 与子代理共用 Powerline 几何规则。颜色序列在宽度适配后分配，作用域限定在一次渲染中。默认保留旧语义配色与几何行为；ASCII 任务／代理标记保留可区分的状态含义。

## 接口与兼容

显示 schema 9 新增 `powerline`，字段为 `padding`、`separator`、`start_cap`、`end_cap`、`color_mode`。编辑器协议 16 传输这些字段，并包含新预设元数据与 CLI 选项描述。运行协议 2、生命周期 4、portable 1、UI 偏好 1、方案集合／导出 1 不变。schema 1–8 仅读取时在内存中迁移，写入保留兼容备份；旧前后端协议组合仍被拒绝。

161 个冻结样本保持原样。比较器仅对已知显示 schema／默认字段、派生修订、portable／配置字节、新字段描述和既有协议元数据进行明确转换；渲染结果、原始输入与备份字节仍严格比较。既有 CLI 帮助例外仅更新为包含 setup 命令的精确摘要，不新增任意比较豁免。

## 验证与交付

维护者于 [2026-10-23 作出的版本限定决定](../releases/approvals/v3.5.0.json)只接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 原有六项未验证观察，不豁免新增失败，也不代表真人桌面／电源验收。

功能测试覆盖设置只读性、定向保存、冲突、迁移备份、部分失败／恢复、方案、控制、Unicode 与宽度。安装产物验收额外在 POSIX PTY 或 Windows 控制台中运行取消、仅保存显示和接入流程，明确标注合成宿主版本证据；固定官方宿主测试独立进行，且不发出模型请求。

### 发行身份与自动化门槛

[实现 PR #121](https://github.com/fbincon/claude-code-statusline/pull/121)交付源码 `7723c540c3e16644b5601b94ce538dcd4ed37d68`，附注标签 `v3.5.0` 的对象为 `b354f9390b779f32e9d962dcf1a6090a858a0402`。GitHub Release `421254542` 于 `2026-10-22T22:41:42Z` 公开（Asia/Shanghai 为 2026-10-23）。

最终功能提交的本地 `npm run check` 完成 1,101 项测试：1,097 项通过、四项既有平台跳过、零失败。45 个生成资源、2,702 条文档链接、归档完整性与迁移台账均通过。发行产物由 Node 24.21.0/npm 11.19.0 构建。

| 门槛 | 证据 | 结果 |
| --- | --- | --- |
| 最终 PR 提交 `40c47f6a4b09565986644cb029176d47c2072370` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39856286812) | 第一次通过 |
| 合并 main `7723c540c3e16644b5601b94ce538dcd4ed37d68` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39859424420) | 第一次通过 |
| 附注标签 v3.5.0 | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39862813646) | 第二次通过；产物传输恢复见下文 |
| npm OIDC 预检／发布 | [预检](https://github.com/fbincon/claude-code-statusline/actions/runs/39866325694) · [发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39866439429) | 均第一次通过 |
| GitHub/npm 公开下载 | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39866794799) | 通过：六个作业、十二次初始空缓存安装 |

三轮完整 PR／main／标签 CI 均通过八安装目标、32 个 Node 22/24 案例、十三个固定 Claude 宿主及汇总就绪检查；每轮 56 个作业成功，纯文档作业不适用。绑定源码的就绪报告保留六项缺项决定及其 SHA-256 `ee798ad37f6dbbbedc65e56fde50f702365bccb5278fc8fc0711139724bb69b6`，不会把这些观察标为通过。

### 安装产物与捕获证据

两次独立本地构建、两次发行源码包重建及 main／标签 CI 候选的安装包、源码包、清单、校验文件完全一致。GitHub 草稿的四个附件在公开前已下载比较。本地包和草稿下载包均通过十一项隔离安装检查，包括设置取消、仅保存显示和接入。

官方 Claude Code 2.1.294 验证通过精确宿主类型检查、128 项原生测试及十四项 runtime 测试。最终安装包的原生 smoke 运行真实宿主 hook／render／runtime／UI 命令，保存 `quota-watch` 并打开任务详情窗格；使用合成密钥与不可达的本地 API 地址，模型调用为零。这证明自动化宿主旅程，不代表真人桌面或物理电源验收。

最终发行包完成 258 项设置／方案捕获、528 项六语言扩展编辑器捕获，另有四项无色／受限终端用例。收据验证终端恢复及取消后已保存配置不变。向导捕获显式注入合成 Claude 2.1.258 检测结果，与真实官方宿主测试分开。已提交的 27 张图库 PNG 与最终发行包重生成图片逐字节一致。固定渲染输入与重建 PTY 单元格属于样例，代理图片检查不代表真人平台验收。

| 最终捕获收据 | SHA-256 |
| --- | --- |
| 设置／方案，258 项 | `107148bcda3bfd19377a54ddda994991d1faa7533228ff31149d5001074c5daa` |
| 扩展编辑器，528 项 | `9b881a5785ba5b3b34353696be4dee3b25c4cf9d76ab1fe7af90bbcbb3e8a2e2` |

### 公开交付

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.5.0.tgz` | `dc3dd446ec43075c017199c0fc631d89fe46ba7b17d8757917696f3ba22d945b` |
| `claude-code-statusline-3.5.0-source.tar.gz` | `7671e2df3cf464925a0b4820c74a1466b34d4bae6daa760fa5dc7dd6b45cca10` |
| `build-manifest.json` | `ec4ae88bf016543f73dea9979988833e8ba0db511012fbfa860903b435374ed5` |
| `SHA256SUMS` | `ff7b50697d6c47fc496af6dd923dc07b4084d947824290f3e333649b1a0ca197` |

[npm 安装包](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.5.0)与 [GitHub stable／Latest Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.5.0)交付相同包字节。npm `latest` 为 3.5.0，`beta` 保留 3.0.0-beta.1。OIDC 发布器于 `2026-10-22T22:39:28Z` 签署[来源证明](https://search.sigstore.dev/?logIndex=3403074307)，同次运行完成公开 SHA-256／SHA-512 及标签验证。本机匿名 GitHub/npm 下载与固定版本／`latest` 初始空缓存安装均通过。

[Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.5.0) `1231272` 使用相同源码和附注标签，四个附件均以正常 TLS 校验匿名下载，与上表逐字节一致；下载产物通过交付校验，安装包通过全部十一项隔离安装检查。上传和下载无需传输重试。

### 修正与恢复

最终验收前，80 列样例检查促成方案标签精简与目录／Git 宽度调整。继承的 Powerline 背景避免与解析后的前景色相同，同时保留显式覆盖和阈值前景规则。日语捕获选择器改为匹配本地化界面。安装失败路径夹具改为显式请求预期的原生操作失败；更早的 Windows 进程失败没有已证实的操作系统原因，原始日志保留。

较早的 PR 在 53 个目标检查全部通过后，汇总正确拒绝遗漏的 v3.5.0 审批注册项。修复注册表并增加针对实际当前版本审批的回归后，最终 PR／main／标签门槛全部通过，未扩大缺项接受范围。

标签第一次运行中，Node 22.x/macOS 15 Intel 作业在下载产物时，产物服务五次超时，尚未开始产品测试。仅重跑该失败作业及依赖的汇总；第二次在相同源码／安装包及未变更检查下通过，保留已有成功目标。npm 发布无需重试。

原始日志、已替代候选、最终收据及 ANSI／单元格捕获保存在本地忽略的 `dist/validation/v3.5.0/`。交付文档补充仅做必要链接／格式检查，已发布文件和标签保持不可变；六项已接受历史缺项仍明确未验证。

[设置向导](../SETUP.zh-CN.md) · [完整方案](../SCHEMES.zh-CN.md) · [外观](../APPEARANCE.zh-CN.md) · [捕获来源](../images/setup-appearance/README.zh-CN.md)
