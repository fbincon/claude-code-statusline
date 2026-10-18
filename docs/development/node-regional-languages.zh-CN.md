# Node 运行环境与地区语言后续工作

[English](node-regional-languages.md) | **简体中文**

本次迁移后工作已 **DONE**：v3.1.0 已交付 npm、GitHub 和 Gitee。TS-01–TS-06 保持完成；冻结样例、历史决定和 Python 参考保留。PERF-01 独立且尚未开始。

## 运行环境约定

成品接受稳定版 Node `^22.0.0 || ^24.0.0`。开发、资源生成与可复现构建保留 Node 24.21.0/npm 11.19.0。`packages/core/src/node-runtime.ts` 由打包、校验、诊断及运行环境回执检查共用。不新增其他 Node 系列或系统／架构承诺。

保留原有八个安装目标和十三个宿主。另有 32 个案例，以相同发布包在每个安装目标分别测试 22.0.0、最新 22.x、24.0.0 和最新 24.x。回执记录源码提交、包 SHA-256、实际 Node 版本／摘要、产品测试和隔离离线安装；缺失、重复、运行版本错误或失败均不能通过发布验收。先用固定工具链构建，再切换 Node 运行 `npm run test:runtime`，不重新构建。模块追踪使用异步加载钩子和明确的消息排空握手，兼容 Node 22.0.0。

Windows Node 24.0.0/libuv 1.50 的路径统计还会返回零设备号，而描述符统计保留真实卷序列号；[独立 Windows 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/39117485659) 已在两个 Windows 目标上复现。恢复读取从不跟随重解析点的原生句柄取得卷号和文件索引，确认索引仍匹配此前路径快照，再与已打开描述符核对身份。BigInt 避免索引舍入；Windows 卷号使用 32 位，POSIX 设备号保留全部位。保留普通文件／重解析点／权限保护，回归检查不同文件和路径替换。原生结构采用 [Microsoft 文档布局](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information)。

## 地区语言约定

选项顺序为 `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`。`zh-Hant` 仅作为台湾的兼容输入别名；读取在内存规范化且不改写文件，显式保存与导出采用规范代码，未知输入继续拒绝。台湾和香港各有完整资源、地区用词、统一生成、多语言搜索和独立界面／输出选择。[翻译约定](i18n.zh-CN.md)。

编辑器协议 12 明确拒绝旧前端并提示重装。显示 schema 8、界面偏好 1、portable 1 和 runtime 协议 2 保留格式。重新安装更新配套资源，并兼容旧协议的所有权标记以完成升级。降级前用新版本将两种语言设置为英文，或恢复兼容备份。

冻结迁移捕获在内存适配历史协议 11 请求。比较仅允许已知协议字段、精确的版本错误文字及两处语言选项列表变化；继续检查其他行为及原来的三项 CLI 文字差异。

## 验证与交付

状态：**DONE**，2026-10-18。生成／覆盖率、产品和工具测试、八目标安装、十三宿主及 32 项 Node 回执全部通过。36 种已安装界面／输出组合通过；测试覆盖地区搜索、旧偏好与参数、写入失败、可移植导入、协议不匹配、保存／取消／重开，以及主栏和子代理输出。两个编辑器已检查最小／常用尺寸与浅深背景。[安装包地区界面及捕获范围](../images/typescript/regional/README.zh-CN.md)。

维护者明确接受 v3.1.0 的六项既有披露缺口，见[版本专属决定](../releases/approvals/v3.1.0.json)。它们继续标为未验证：macOS 实机睡眠、macOS 14 Intel 桌面／电源、Windows 10 桌面、WSL 桌面／弹窗、其他目标人工／电源检查，以及 Claude 2.1.296 精确声明。功能与自动化失败仍阻止发布；原 v3.0.0 批准记录不变。D06 保持 **FAIL：104 通过／60 失败／28 无定论**，PERF-01 保持 **NOT_STARTED**，不宣称性能提升。

### 不可变发布身份

[实现 PR #102](https://github.com/fbincon/claude-code-statusline/pull/102) 合并为 `10de45895d2734a8ab1eacec09b57bc89417be51`。注释标签 `v3.1.0` 的对象为 `c7d2b00e9c3a828cff88594f037a3c6058308787`，解析到该源码提交。后续文档／证据工作不移动标签或替换已发布附件。[机器可读交付证据](node-regional-languages.delivery.json)。

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

[地区图库](../images/typescript/regional/README.zh-CN.md) 发布 20 张已检查图像，记录文件／终端单元／字体摘要及发布源码／包绑定。完整最终捕获集为 24 张外部页面、32 张外部边界、20 张原生组件和官方 Claude 2.1.294 中四张真实已安装 Client 图。明确区分常用尺寸原生 PTY、合成 32×12 组件与操作系统／人工验收；没有付费模型调用或个人配置改动。
