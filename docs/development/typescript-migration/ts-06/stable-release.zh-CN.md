# TypeScript 正式交付证据

[English](stable-release.md) | **简体中文**

发布状态：**v3.0.0 已于 2026-10-18 通过 npm `latest`、GitHub 正式版/Latest 和 Gitee 正式版交付**，公开下载及安装验收通过。**依据限定版本的维护者决定，TS-06 为 DONE；PERF-01 保持 NOT_STARTED。**[发行说明](../../../releases/v3.0.0.md) · [决定与门槛](README.zh-CN.md#正式版决定2026-10-18) · [平台反馈 #96](https://github.com/fbincon/claude-code-statusline/issues/96)。

## 不可变发布身份

| 项目 | 值 |
| --- | --- |
| 版本 / npm 选择器 | `v3.0.0` / `@fbincon/claude-code-statusline@3.0.0` 及 `@latest` |
| 源码 / 合并提交 | `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` |
| 注释标签对象 | `f457695f4d4956220b7397b991ee92cc8b0cf7a2` |
| 已审阅提交 | `a89aae54d81bc2a1f7f504b514a8df16b1e43444`，[PR #99](https://github.com/fbincon/claude-code-statusline/pull/99)，与合并提交的树一致 |
| 运行时 / 包管理器 | Node `24.21.0` / npm `11.19.0` |
| 固定构建依赖 | TypeScript `5.9.3`、Koffi `3.3.3`、lossless-json `4.3.1` |
| npm SHA-512 integrity | `sha512-7fsWbwmKLoum5IoLZf8fhbs2CWxYp+cl47uR+iz/bPEuRptDThFBpkxZp18WD3DLVbaIg63DQt6u7Hz2Bkh90g==` |
| 源码归档内批准记录 | [stable-approval.json](stable-approval.json)，SHA-256 `9b9cbb38e8a9cfff54928b9c45275d084b2ae3ba924ca1c54a8de10f34034db2` |

正式发布恰好四项交付附件。SHA256SUMS 列出其他三项；其自身摘要单独记录如下。

| 附件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.0.0.tgz` | 3327658 | `fa689dd448646a5fcbcc5fe7a66a60879646d71321fcc17417a95dd9c6e81749` |
| `claude-code-statusline-3.0.0-source.tar.gz` | 17365853 | `215ae3b88e5689e2fda85e3af14739ebf75c02a0fa96996a87dba400c50b2872` |
| `build-manifest.json` | 952 | `3eca893298f8dd1b3a23891963eb02ef79920c80d8e180a9ecb675a9546ee318` |
| `SHA256SUMS` | 302 | `3564ff726327c0ca37be006ff0ab9c9c59cc761841f6c7b73b1031e0bc49ae62` |

npm 包含 648 个文件，随包提供 Linux x64、Windows x64、macOS x64/ARM64 原生依赖，内部 workspace 保持私有。Windows ARM 使用模拟 x64 Node。显示 schema 8、编辑器协议 11、runtime 协议 2/v1 兼容及任务 schema 4 保持兼容。

## 构建与最终产物验收

| 证据 | 结果 |
| --- | --- |
| [PR 最终提交 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39105913003) | 已审阅提交 23/23 项通过 |
| [合并提交 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39106933639) | 发布源码 23/23 项通过 |
| [标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39107697338) | 同一发布源码 23/23 项通过 |
| 独立构建 | 两次干净构建字节一致，本地、合并 CI、标签 CI 的四项摘要一致 |
| 源码重建 | 解压交付源码包、无 Git 历史，两轮重建的四项文件均与正式附件一致 |
| 正式门槛 | 八安装目标/十三宿主回执绑定同一源码和 tgz，`stable_ready=true`，批准记录有效；六项精确宿主 Mod 声明不可用结果保留 |
| GitHub 草稿下载 | 四项字节一致，`release:verify --release` 及十项隔离安装检查通过 |
| 安装包外部 TUI | 最终 tgz 生成的中英文四页、共八张 PTY 图，与已审阅文档图逐字节一致 |

八个安装目标为 ubuntu-24.04 x64、windows-2025 x64、windows-11-arm 模拟 x64 Node、macos-14/15/26 ARM64 和 macos-15-intel/26-intel x64。十三个固定宿主组合为 Linux Claude 2.1.287/2.1.288/2.1.289/2.1.294/2.1.296，以及 Windows/macOS Claude 2.1.288/2.1.289/2.1.294/2.1.296。上述 CI 回执不包含 Windows 10 桌面或 macOS 14 Intel 桌面/电源验收。

本地工程检查环境为 **Ubuntu 26.04.1 LTS x64**、Node 24.21.0/npm 11.19.0，结果为 **944 项：941 通过、3 项仅限 Windows 的跳过**。责任台账、生成资源、文档链接和冻结 Python 归档检查通过。本地最终包及草稿下载包均在空 npm 缓存、离线安装、禁用生命周期脚本、源码目录外运行的条件下通过全部十项隔离安装检查。Windows/macOS 结果由各自 CI 回执提供，本地跳过不改写为平台通过。

安装验证覆盖无偏好默认值、重装、兼容旧偏好、显式与已保存开关、参数组合、旧宿主、已禁用插件、双编辑器、中断恢复、所有权、渲染及只读不写入。没有保存偏好时原生计时和高级采集关闭，显式参数及已保存偏好保持优先；基础 hook/transcript 计时保留。五语言 TUI 测试覆盖边框、分组线、Unicode 几何、整行选中与样式，已有交互、缩放、取消及终端恢复检查继续通过。[安装包 PTY 图库及精确来源](../../../images/typescript/README.zh-CN.md)区分终端重建图与真人桌面观察。

首个本地构建因 npm registry TLS 重置而中止，其不完整目录未用于发布；随后完整的两轮构建和独立源码重建通过，并与 CI 一致。早期测试夹具/验收工具对预览身份与旧采集默认值的假设，在最终已审阅提交前修正，失败日志保留为历史失败。既有 beta 字节、源码标签及参考 oracle 文件未改动。

## 公开渠道验收

| 渠道 | 已交付身份与验证 |
| --- | --- |
| [npm 正式包](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.0.0) | 发布于 `2026-10-18T07:46:42.701Z`；`latest=3.0.0`、`beta=3.0.0-beta.1`；匿名 tgz 及 SHA-512 与上表一致 |
| [GitHub 正式版/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0) | Release `416306494`，发布于 `2026-10-18T07:47:13Z`；`draft=false`、`prerelease=false`，Latest 指向本标签，四附件一致 |
| [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0) | Release `1215314`，相同提交/注释标签，四项公开下载附件字节一致，Gitee 安装链接已核验 |
| [三系统公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39108976848) | 3/3 项通过：ubuntu-24.04 x64、windows-2025 x64、macos-15 ARM64；各自以空缓存、禁用脚本安装精确 `3.0.0` 与 `latest` |

公开回执绑定源码 `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774`、验收工具 `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` 和最终 tgz 摘要。本地 GitHub/npm 两种选择器验证也通过。四项匿名 Gitee 下载摘要一致，Gitee tgz 通过完整包校验及隔离安装检查。平台额外生成的仓库源码归档不是可重建源码交付附件。

GitHub 为主仓库；检查分歧后，通过明确 refspec 将已验证 main 和版本标签同步到 Gitee。证据补充 PR 只修改文档，不移动发布标签或替换公开附件。此前 [beta.1 身份](preview-release.zh-CN.md)保留，`beta` 不变。Python v2.0.0 仍可回退，没有上传 PyPI 或切换个人现用安装。

## 接受的缺项与阶段关闭

维护者于 2026-10-18 **仅对 v3.0.0** 接受源码归档记录中的精确范围：macOS 实机休眠恢复、macOS 14 Intel 桌面/电源、Windows 10 桌面、WSL 桌面/弹窗、其他目标电源/人工视觉检查，以及不可用的 Claude 2.1.296 精确声明。以上保持**未验证/不可用**。官方 Mod 测试和可用精确宿主声明通过，不代表缺失的六项声明检查通过。macOS Client 可能需要先点击区域再输入的限制继续披露。

CI 和 PTY 重建图不构成新增实体休眠/重启或真人桌面验收。功能、保存、事件投递或恢复失败仍阻塞。有效的限定版本批准、完整通过的自动矩阵及已核对产物身份共同满足正式发布门槛；不批准后续版本或失败/不完整矩阵。

全部请求渠道与公开下载检查完成，因此依据该决定 **TS-06 为 DONE**。**D06 保持 FAIL：104 pass / 60 fail / 28 inconclusive；PERF-01 保持 NOT_STARTED**，须由后续任务启动。以上源码、运行时/依赖及附件摘要是其可重现基线。#96 继续收集平台反馈，缺失观察不勾选完成。私有原始日志和临时文件保留在忽略的验收目录。
