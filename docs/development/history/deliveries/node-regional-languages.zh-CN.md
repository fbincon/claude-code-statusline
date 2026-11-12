# Node 运行环境与地区语言后续工作

[English](node-regional-languages.md) | **简体中文**

> **历史记录（冻结于 v3.1.0，2026-10-18）。** 当前行为见[开发指南](../../README.zh-CN.md)及[路线图](../../roadmap.zh-CN.md)；当前接口版本见 [CLI 参考](../../../reference/cli.zh-CN.md#协议与-schema-版本)。

## 验证与交付

本次迁移后工作已 **DONE**：v3.1.0 已交付 npm、GitHub 和 Gitee。TS-01–TS-06 保持完成；冻结样例、历史决定和 Python 参考保留。PERF-01 在本次 v3.1.0 交付时独立且尚未开始；后于 [Delivery v3.1.4](../performance/perf-01.zh-CN.md#delivery-v314) 完成关闭。

状态：**DONE**，2026-10-18。生成／覆盖率、产品和工具测试、八目标安装、十三宿主及 32 项 Node 回执全部通过。36 种已安装界面／输出组合通过；测试覆盖地区搜索、旧偏好与参数、写入失败、可移植导入、协议不匹配、保存／取消／重开，以及主栏和子代理输出。两个编辑器已检查最小／常用尺寸与浅深背景。[安装包地区界面及捕获范围](../../../images/typescript/regional/README.zh-CN.md)。

维护者明确接受 v3.1.0 的六项既有披露缺口，见[版本专属决定](../../../releases/approvals/v3.1.0.json)。它们继续标为未验证：macOS 实机睡眠、macOS 14 Intel 桌面／电源、Windows 10 桌面、WSL 桌面／弹窗、其他目标人工／电源检查，以及 Claude 2.1.296 精确声明。功能与自动化失败仍阻止发布；原 v3.0.0 批准记录不变。D06 作为历史证据保持 **FAIL：104 通过／60 失败／28 无定论**；本次 v3.1.0 交付时 PERF-01 为 **NOT_STARTED**，不宣称性能提升，后于 [Delivery v3.1.4](../performance/perf-01.zh-CN.md#delivery-v314) 完成关闭。

v3.1.0 交付使用编辑器协议 12，明确拒绝旧前端并提示重装。显示 schema 8、界面偏好 1、portable 1 和 runtime 协议 2 在该交付中保留格式。重新安装更新配套资源，并兼容旧协议的所有权标记以完成升级。降级前用新版本将两种语言设置为英文，或恢复兼容备份。

### 不可变发布身份

[实现 PR #102](https://github.com/fbincon/claude-code-statusline/pull/102) 合并为 `10de45895d2734a8ab1eacec09b57bc89417be51`。注释标签 `v3.1.0` 的对象为 `c7d2b00e9c3a828cff88594f037a3c6058308787`，解析到该源码提交。后续文档／证据工作不移动标签或替换已发布附件。[机器可读交付证据](../../node-regional-languages.delivery.json)。

| 交付文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.0.tgz` | 3,437,064 | `000ddea0e995034ec8040691e21c9cf3119e18b6508c4870bc55b95247591011` |
| `claude-code-statusline-3.1.0-source.tar.gz` | 17,442,036 | `ae4bc088a9079c20ce8c26e160f57e3f7ede29285705aed32bd377c84e075a7a` |
| `build-manifest.json` | 952 | `ee1f26d550d5789674fdc5cfeadd835e6f949f45f82ad4a80ec1dd042aef9491` |
| `SHA256SUMS` | 302 | `df19ddf9a77682dc2983a60445b559fd153514e56b066340ff02a0c1f071f550` |

固定工具链的两次独立构建，以及交付源码压缩包的独立重建，四个交付文件均字节一致。主分支／标签 CI 候选和 GitHub 草稿下载也匹配此包。包内 655 个文件包含原有四种原生目标。最终包通过 Node 22.0.0 产品测试和十项隔离离线检查；从实际已发布 v3.0.0 升级时，旧文件读取保留字节、仅保存时规范化两种语言、已归属协议 11 资源升级为 12，并保留备份。

### CI 与发布

| 检查 | 实际结果 |
| --- | --- |
| [PR 最终提交 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39117679694) | `8e9e58d04716fb5279d450ca1c789c0f720d59dc` 的 55/55 通过 |
| [合并 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39119023676) | 发布源码的 55/55 通过 |
| [标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39120233851) | 发布源码的 55/55 通过 |
| [npm OIDC 试运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39121664834) | 准备通过，发布任务按预期跳过 |
| [npm 发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39121750108) | 第一次 OIDC 上传被接受；第二次核验相同公开字节后通过 |
| [公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/39122362109) | 6/6 通过，核验四项 GitHub 附件及 npm 精确版本／`latest` 安装 |

本机完整检查为 957 项：953 通过、4 项平台跳过、0 失败。六个语言包各覆盖 1,365 个消息键，36 项生成产物一致；冻结 Python／归档和责任清单检查通过。正式就绪检查接受全部 8／13／32 项源码及包绑定回执，记录批准 SHA-256 `6f44f89301c96f38656067a8fc3cf2db6ea65e3be94c66a19b0a9c52e750f4a2`。

npm 第一次接受 OIDC 上传时公开元数据尚未可用，校验器耗尽约三分钟等待而失败；随后已认证版本状态接口报告 `published`。确认匿名元数据和实际下载 SHA-256／SHA-512 后，才重跑失败任务。重跑记录 `already-published`，没有再次上传，也没有重新验证 OIDC。首次签名来源证明绑定发布源码、标签和 `npm-publish.yml` 的[第一次运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39121750108/attempts/1)，现有 npm 可信发布绑定显示 **Valid**。没有令牌发布回退或覆盖已发布版本。

首轮公开下载回执记录实际版本，不从 `22.x`／`24.x` 推断：

| 平台 | 22.x 实际选择 | 24.x 实际选择 |
| --- | --- | --- |
| Ubuntu 24.04 x64 | 22.23.3 | 24.21.0 |
| Windows 2025 x64 | 22.23.3 | 24.21.0 |
| macOS 15 arm64 | 22.23.2 | 24.21.0 |

macOS 的选择暴露了 runner 缓存差异。证据后续工作为 32 项兼容矩阵和六项公开下载增加 `check-latest: true`，使后续范围选择解析最新发行版；原回执保留实际版本。精确最低版本和固定开发工具链继续明确指定。

### 公开渠道与图像

- [npm 3.1.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.0)：`latest=3.1.0`、`beta=3.0.0-beta.1`；公开下载包匹配交付包字节及 registry SHA-512。
- [GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.0)：Release `416388749`，发布于 `2026-10-18T11:13:23Z`，四项附件核验通过。六项公开下载任务各自从空缓存安装 `3.1.0` 和 `latest`，禁用生命周期脚本。
- [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.0)：Release `1215869`；检查祖先关系后用显式 refspec 同步源码及注释标签。四项相同附件已匿名下载、完整校验，并通过十项离线安装检查；平台自动源码归档与可重建源码附件分别对待。代理 TLS 失败先核对远端再重试；较慢的源码下载最终通过原生网络接口、当次公开 DNS 和正常证书校验完成。

[地区图库](../../../images/typescript/regional/README.zh-CN.md) 发布 20 张已检查图像，记录文件／终端单元／字体摘要及发布源码／包绑定。完整最终捕获集为 24 张外部页面、32 张外部边界、20 张原生组件和官方 Claude 2.1.294 中四张真实已安装 Client 图。明确区分常用尺寸原生 PTY、合成 32×12 组件与操作系统／人工验收；没有付费模型调用或个人配置改动。
