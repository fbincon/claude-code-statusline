# 首个 TypeScript 预览版：交付证据

[English](preview-release.md) | **简体中文**

发布状态：**v3.0.0-beta.1 已于 2026-10-18 通过 GitHub、Gitee 和 npm beta 交付**，公开下载及安装验收通过。TS-06 保持 **IN_PROGRESS**，PERF-01 保持 **NOT_STARTED**。[决策与正式版门槛](README.zh-CN.md) · [反馈跟踪 #96](https://github.com/fbincon/claude-code-statusline/issues/96)。

## 固定发布身份

| 项目 | 值 |
| --- | --- |
| 版本 / npm 选择器 | `v3.0.0-beta.1` / `@fbincon/claude-code-statusline@beta` |
| 源码提交 | `a6cfb6aadf2fcacbd5bf8f027665528cf6b6f29f` |
| 带注释标签对象 | `edd2fb90803aa15086ff42f090c7afa418217b80` |
| 已评审实现 head | `f97c06ea5607a1b74b1f8f389ea58d343097e582`，[PR #97](https://github.com/fbincon/claude-code-statusline/pull/97)；与合并提交的文件树一致 |
| 运行时 / 包管理器 | Node `24.21.0` / npm `11.19.0` |
| 固定构建依赖 | TypeScript `5.9.3`、Koffi `3.3.3`、lossless-json `4.3.1` |
| npm SHA-512 完整性 | `sha512-d3ysd2J8ZTmMOlFUjGAwH7GmvuLyklTSSCw69rPWFlpWAtwalFaZiMH1teFSv92zAbSXsaTcsfDWmuMMJMw25Q==` |

发行版必须提供四项附件。SHA256SUMS 列出其他三个文件，表中另外记录 SHA256SUMS 自身摘要。

| 附件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.0.0-beta.1.tgz` | 3322997 | `3c2f350c976b669894b7a86aba2383c04489e5b1e2215631a5d74f23540aecb7` |
| `claude-code-statusline-3.0.0-beta.1-source.tar.gz` | 16573393 | `b875f415841fae13b29f105d8e4e68b5aeeccb1be521350e1c391e24e3bb416f` |
| `build-manifest.json` | 974 | `5d0c42d32790a0782f33e18118dab6174c84252366c559e7296372030c51280d` |
| `SHA256SUMS` | 316 | `71d0157d94f1da983be2f1c1afabf43d0468119b67ff12124432f44c02b681a7` |

安装包包含 645 个文件，内置 Linux x64、Windows x64、macOS x64 和 ARM64 原生依赖；内部 workspace 保持私有。显示 schema 8、编辑器协议 11、运行时协议 2 及 v1 兼容、任务 schema 4 均保持不变。

## 构建与自动化验收

| 证据 | 结果 |
| --- | --- |
| [PR head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39091472751) | 已评审 head 的 23/23 作业通过 |
| [合并 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39092199540) | 发布源码的 23/23 作业通过 |
| [标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39092942344) | 同一发布源码的 23/23 作业通过 |
| 独立构建 | 每次 CI 的两轮包字节一致；main/标签的全部四项附件与上表摘要一致 |
| 证据聚合 | 每轮八安装目标和十三固定 Claude 宿主组合；校验精确源码与安装包摘要，`preview_ready=true`、`stable_ready=false` |
| 下载 GitHub 草稿 | 四文件一致，`release:verify` 与针对最终安装包的十项隔离安装检查通过 |

八安装目标为 ubuntu-24.04 x64、windows-2025 x64、windows-11-arm 上模拟的 x64 Node、macos-14/15/26 ARM64、macos-15-intel/26-intel x64。十三宿主组合为 Linux Claude 2.1.287/2.1.288/2.1.289/2.1.294/2.1.296，以及 Windows/macOS Claude 2.1.288/2.1.289/2.1.294/2.1.296。Windows 10 和 macOS 14 Intel 不在上述 runner 覆盖范围内。

安装检查覆盖禁用生命周期脚本的空缓存离线安装、空格/Unicode/shell 特殊字符路径、渲染、移动目录拒绝、各平台启动器、前后端/编辑器绑定、显式中断恢复、保存偏好和 Python 兼容配置。完整检查包括错误版本/提交/摘要、证据缺失、附件不完整和受限发布身份比较的拒绝测试；还验证生成资源、文档链接、责任清单与冻结 Python 归档。官方 Mod 测试不调用付费模型。

本地环境为 **Ubuntu 26.04.1 LTS x64**，Node 24.21.0/npm 11.19.0。`npm run check` 共 940 项：937 通过，三项 Windows 专用测试跳过；本地跳过不算 Windows 通过。下载草稿包的十项安装检查在该本机系统上通过，各 runner 证据由上述独立 CI 提供。一份更早的本地回执因 target 环境变量误标为 Ubuntu 24.04，已在保留原件的同时追加更正，不能用于宣称 Ubuntu 24.04 验收；最终草稿回执使用 `local-ubuntu-26.04-x64`。

已评审 PR 包还从源码归档、在无 Git 历史的情况下独立重建，摘要同为 `a8ddd0083130b974e11c6633b2ee1c55e198063cac3339a2a1109781c764f453`。源码身份嵌入安装包，因此该摘要属于 PR 源码，不属于最终合并产物。

## Python 过渡与证据边界

隔离 Python 3.14.4 环境安装了真实已发布的 v2.0.0 wheel，SHA-256 为 `a6e35b5d1154738834497a098369722819cf3fe9292e290024fa0b16602bdaed`；随后使用已评审 PR 包完成 dry-run、升级、卸载及保留 Python 命令的重装。已保存的停用设置、无关设置、原命令绑定和渲染均保留。此项使用上述 PR 源码/包，其文件树与最终合并一致，但不改标为最终安装包运行。一次性验收脚本 SHA-256 为 `1bae464af9ec64b0ad2588972fd0c0b00315156bf9da5cc2e576dd70a5dddbe9`。[用户切换与回退步骤](../../../PREVIEW.zh-CN.md)。

没有切换现用个人 Python 安装，没有付费模型调用、自动休眠/重启或新增真人桌面/电源验收。本地日志、源码哈希、原始回执和脚本保留在忽略的 `dist/validation/typescript-migration/ts-06/` 下；提交的记录不包含私密对话和本机路径。

Claude 2.1.296 的两个 Mod 精确声明仍不可用；六个平台/Mod 缺项与已通过的官方 Mod 测试及 2.1.294 类型检查分别记录。本地对 SHA-256 为 `24972e3bc859fab2b46ed4c1e51f7d6130f06d3bd550811a114640de3370d0de` 的宿主复查确认同样限制，未调用付费模型。

D06 保持 **FAIL：104 pass / 60 fail / 28 inconclusive**。macOS 实机休眠恢复、macOS 14 Intel、Windows 10 桌面、WSL 桌面/弹窗及其他适用真人/电源缺项仍是未验证的正式版门槛。预览发布不关闭 TS-06；功能回归仍阻塞验收，已公开字节需要修复时必须递增 beta。

## 公开渠道验收

npm registry 异步接收上传，随后将精确版本状态标记为 published；新的匿名下载与最终安装包逐字节一致。`beta` 指向 `3.0.0-beta.1`。registry 还生成了 `0.0.0-stage` 占位版本，并最初将 `latest` 指向预览；删除 `latest` 返回 HTTP 400，因此将它改指既有的 registry 占位包，没有重新发布任何包字节。占位包不是可用产品，真正的 npm 稳定版发布前，安装必须明确指定 `@beta` 或固定版本。

本地 Ubuntu 26.04.1 x64 的 GitHub/npm 公开核验通过：GitHub 四附件一致，npm 字节与完整性摘要一致，空缓存、禁用生命周期脚本的固定版本及 beta 安装均通过。Gitee 四项匿名下载也与上表完全一致；下载的 Gitee tgz 通过分发包校验，以及空缓存、禁用生命周期脚本的隔离离线安装和版本/配置/渲染检查。

[首次三系统下载工作流](https://github.com/fbincon/claude-code-statusline/actions/runs/39094514522)因验证脚本向 `config show` 传入不支持的 `--config-dir` 而失败。修正后的脚本使用已隔离的 `CLAUDE_CONFIG_DIR` 环境变量，只修改验收工具，不修改已发布包。人工触发核验现在分别记录验证代码提交和固定发布提交，检出所选工作流提交并解析精确发布标签。历史失败证据保留。[修正后的三系统工作流](https://github.com/fbincon/claude-code-statusline/actions/runs/39094840584)全部通过：ubuntu-24.04 x64、windows-2025 x64、macos-15 ARM64，均使用 Node 24.21.0 并检查两种选择器。下载的三份回执均绑定发布提交 `a6cfb6aadf2fcacbd5bf8f027665528cf6b6f29f`、验证代码提交 `02fc7807d50be96956256c5261c4702ce6e9ae3d` 和最终安装包摘要。

| 公开渠道 | 发布身份与验收 |
| --- | --- |
| [GitHub 预览版](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) | Release `416206854`，发布时间 `2026-10-18T03:41:34Z`；四附件字节一致，Python v2.0.0 保持 Latest |
| [Gitee 预览版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) | Release `1214744`；同源码/标签、四项交付附件字节一致、镜像安装说明及 GitHub 主反馈入口；平台额外生成的自动源码归档不等同于交付的可重建源码包 |
| [npm 预览包](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.0.0-beta.1) | 发布时间 `2026-10-18T03:33:36.416Z`；`beta=3.0.0-beta.1`、`latest=0.0.0-stage`，tgz 的 SHA-256 和 SHA-512 完整性摘要一致 |

证据补充只修改文档及公开下载验收工具，不移动发布标签、不替换已公开文件。Gitee main 在 GitHub PR/main 检查通过后同步。缺失实体/桌面证据及阻塞反馈处理完成后，正式版另行推进。
