# 来源操作、命令调度与包执行

[English](source-command-package-management.md) | **简体中文**

> **历史记录（冻结于 v3.12.0，2026-10-28）。** 当前行为见[开发指南](../../README.zh-CN.md)及[路线图](../../roadmap.zh-CN.md)；当前接口版本见 [CLI 参考](../../../reference/cli.zh-CN.md#协议与-schema-版本)。

## 验收与交付

v3.12.0 实现 SOURCES-01 第一至三片、COMMAND-02 和 UPDATE-02 第二／三片。最终验收与发布已完成，状态为 **DONE**。[来源指南](../../../EXTENSIONS.zh-CN.md) · [包管理指南](../../../PACKAGE_MANAGEMENT.zh-CN.md) · [路线](../../roadmap.zh-CN.md)。

本机要求 generate、generate:check、check 和 diff 空白检查。定向测试覆盖普通／私有权限、共享消费者、多上下文租约、重试／暂停、已存 GitHub 分页、草稿保留、跨方案引用、审核失效、未知保存、阶段结果及清理冲突。

安装验收保留原有真实 npm 历史转换，另通过保留入口测试编辑器审核后降级／升级、脱离、旧协议拒绝、中断包恢复、独立还原及受保护清理，使用受控 loopback registry。来源安装检查增加独立自动许可、默认间隔／TTL 独立、非 Git 上下文、手动需求保留、旧成功及绑定清理。

最终不可变候选保留八个安装目标、32 个 Node 组合、十六个固定宿主及原有 197 项容量断言；新增二十个有界来源／包页面与原用例共享实际宿主执行，总计 217 项。回执分别记录基线／新增数及名称摘要，不将基线虚构成独立执行。最终 PR 证据通过 main/tag 晋级原始产物。补充双编辑器 PTY 和本机真实 Claude 2.1.312，不调用模型。实际身份、摘要及发布结果记录在下文。

#157 已凭 v3.11.0 tag／OIDC／provenance 及公开下载证据关闭，见[问题评论](https://github.com/fbincon/claude-code-statusline/issues/157#issuecomment-6472495690)。账户 macOS 额度／runner 供应仍未验证。仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 既有六项缺口，不豁免新增自动化失败。v3.12.0 发布后，本机新发现只提 issue，保持该版本不变。

较早的发布前快照：安装候选 `25b47a17b14e812f74c324b4e30bbd2feaaaf5d7` 的全部 25 项安装测试通过，包括真实 npm 编辑器转换及来源操作。修复版本页只读投影后，Claude 2.1.312 全部 217 项容量断言通过。五个测试文件保留原断言，并限制宿主失败报告大小。当时最终不可变 PR／main／tag 及渠道记录仍待完成；已完成的交付记录如下。


编辑器协议 28 需要匹配 Mod。显示 schema 保持 16；来源注册表 3 支持独立审核的命令自动策略，任务 4 携带有界执行摘要，观测／命令输出保持 1，runtime 保持 3。旧记录读取不改写、不补授许可，历史缺失信息为未知。回退审核拒绝无法读取当前来源／显示配置的旧包。

## v3.12.0 交付记录

SOURCES-01 三个切片、COMMAND-02 及 UPDATE-02 第二／三片均已完成验收和发布，三个工作包为 **DONE**。功能 [PR #175](https://github.com/fbincon/claude-code-statusline/pull/175) 使用正常 merge commit `99edd1d8d2684a852bb0c719fd6a92cdcf4259e5`；不可变发布来源为 `2461105f3e1fcd2927a2f343b8a316d5dae30ce2`，注释标签对象为 `83cec9d0d97f2ef2c253ba3ed008f2ce2c8c12d9`。发布时刻：`2026-10-28T22:11:09Z`。

最终 PR 覆盖 8 个安装目标、32 个 Node 组合、16 个固定宿主。每个适用宿主在同一次执行中完成原 197 项及新增 20 项容量断言，共 217 项，并保留独立数量与名称摘要。main 的独立接受基线核验、三个安装 smoke 及 tag 晋级均使用原始 PR 产物；没有重建或重标验收文件。本地完整检查 1,392 项通过、6 项平台限定跳过；78 份生成资源、文档和空白检查通过。最终候选本地 25 项安装及 34 项双编辑器 PTY 均通过；实际 Claude 2.1.312 的受控会话命令核对了来源值与执行结果，模型调用为零。

六语言／双背景扩展采集共 948 张图，保留早期来源 `d16dacb5b6b937c4f04925b05047dd53538e3206`；未将它们重标为最终产物或物理验收。

[npm 3.12.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.12.0)、[GitHub 稳定 Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.12.0) 和 [Gitee Release 1251340](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.12.0) 分发已核验的 npm 包及相同的四份 GitHub／Gitee 交付文件。OIDC 的[签名 provenance](https://search.sigstore.dev/?logIndex=3550334517)指向同一发布来源；npm `latest=3.12.0`，保留 `beta=3.0.0-beta.1`。公开下载六个作业及 Gitee 四份附件匿名下载摘要均通过，validated main 与标签已显式同步。

本机由 3.11.0 升级至 3.12.0，事务 `pkg-310635db-0b1c-4cfc-91ca-292d1f9ddd43`。实际包状态页、普通清单字节／权限只读不变性、状态栏输出、外部版本页／草稿取消／终端恢复及 doctor 均通过。原显示／界面偏好字节、权限及可选来源文件原本不存在的状态已核对；新版集成所需变更保留。

实际安装的清单另在 `0600`、`0644`、`0664` 下验证：均报告当前 `3.12.0`、兼容且原因列表为空，读取期间字节、权限、文件身份及配置均不变，探测后恢复原权限。显示／界面偏好的字节与权限保持一致，方案／来源文件仍不存在；设置中唯一变化为 Native `backendVersion` 从 `3.11.0` 升至 `3.12.0`，其余设置不变。

将 npm 验证器限定到实际发布的包后，registry 签名与发布／SLSA attestation 均通过；另经 Sigstore 使用受信 TUF 材料，核对精确 GitHub 工作流／标签的证书身份及签发者。通用 `npm audit signatures` 诊断曾查询私有 bundled workspace 的 `0.0.0` 包并返回 404，该结果保留；成功的公开包校验覆盖其全部 bundled 字节的完整性。

首次本机补充 PTY 继承 `TERM=dumb`、`NO_COLOR=1`，触发预期的 ANSI 终端拒绝。显式配置 VT PTY 后，已安装编辑器的版本页、未保存草稿保留、取消及终端恢复均通过；此验证脚本修正不构成物理验收，也未修改产品。发布后未确认新的本机产品问题。

首轮有两项失败：Windows ARM／x64 Node 24.0.0 的既有 60 秒系统 PowerShell 准备超时，候选程序尚未启动；macOS 26 Intel Node 24.0.0 在历史回退审核中返回 `interrupted`，现有回执不足以确定原因。[同提交完整重试](https://github.com/fbincon/claude-code-statusline/actions/runs/40759928021/attempts/2)通过，保留原断言及全部时限。最终汇总使用原成功执行及新成功重试的回执，首次失败记录仍保留，未豁免或重标。

Issue #157 保留真实 v3.11.0 tag／OIDC／provenance 关闭证据；#173 由功能 PR 关闭。仅原 #96 六项缺口仍未验证，不代表通过，也不豁免新增自动化失败。发布后发现的新本机问题只登记 issue，保持 v3.12.0。

| Gate / 门禁 | Result / 结果 |
| --- | --- |
| [Final PR / 最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40759928021) | Passed / 通过 |
| [Main integration / main 集成](https://github.com/fbincon/claude-code-statusline/actions/runs/40774605697) | Passed / 通过 |
| [Annotated tag / 注释标签](https://github.com/fbincon/claude-code-statusline/actions/runs/40775183960) | Passed / 通过 |
| [OIDC dry run / OIDC 演练](https://github.com/fbincon/claude-code-statusline/actions/runs/40776119637) | Passed / 通过 |
| [OIDC publication / OIDC 发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40776458624) | Passed / 通过 |
| [Public downloads / 公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/40777988443) | Passed / 通过 |

| Original file / 原始文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.12.0.tgz` | `96dfcb89fbf514c913762df89ec5c1a104981e5b601d2f4c39f50cd3aaeb7030` |
| `claude-code-statusline-3.12.0-source.tar.gz` | `aff60716c80345bb22e9adc42a7a9d0918d87dccf6ac88aadefeb527abac7870` |
| `build-manifest.json` | `14e85af1d4530501b2589839c50e1694dd32faabbe3cfd71c73527ed1fec41dd` |
| `SHA256SUMS` | `e699ae8d3f3aa0a5e77fc2b5201b95aefb254712f6152056411f3ac4408d5310` |
