# TS-06 预览交付与正式版验收

[English](README.md) | **简体中文**

状态：**IN_PROGRESS**，目标 **v3.0.0-beta.1**。准备工作不等于已经发布；交付后补记公开下载验收与最终提交/标签身份。[试用指南](../../../PREVIEW.zh-CN.md) · [反馈与平台跟踪](https://github.com/fbincon/claude-code-statusline/issues/96)。

## 已批准的预览门槛修订，2026-10-18

维护者批准先公开预览，收集本机无法完成的 macOS/Windows 及其他目标平台反馈。本修订替代此前“任何 TS 发布之前完成全部实体/桌面验证”的要求；缺失项仍是正式版门槛，延期不代表通过。目标平台边界不变。本次任务交付首个预览版，随后 TS-06 仍进行中，PERF-01 保持 NOT_STARTED。

包名为 `@fbincon/claude-code-statusline`，版本 `3.0.0-beta.1`，npm 使用 `beta` 标签；GitHub/Gitee 使用 `v3.0.0-beta.1` 并标记预览。Python v2.0.0 保持最新稳定版与回退目标，不上传 PyPI。与历史 Python 预览不同，TS 预览默认开启两个兼容编辑器，保留显式关闭；高级 live metrics 仍显式启用。

| 门槛 | 预览版 | 正式版 |
| --- | --- | --- |
| 固定源码独立构建及相同字节 | 必须 | 必须 |
| 八安装目标 / 十三固定宿主 | 最终 head、合并及标签必须通过 | 最终产品必须通过 |
| GitHub/Gitee/npm 下载身份与安装 smoke | 必须 | 必须 |
| macOS 实机休眠恢复 | 未验证，收集反馈 | 必须 |
| macOS 14 Intel 实机桌面/电源 | 未验证 | 必须 |
| Windows 10 桌面、焦点、编辑器与恢复 | 未验证 | 必须 |
| WSL 桌面启动/焦点与弹窗 | 未验证 | 必须 |
| 其他平台电源/人工视觉 | 保留历史精确范围，新缺口未验证 | 适用项必须 |
| Claude 2.1.296 精确声明 | 不可用；复查，保留官方 Mod 测试与 2.1.294 类型检查 | 复查所选精确宿主 |
| 功能超时、事件丢失、写入与恢复 | 阻塞 | 阻塞 |
| D06 性能预算 | 披露历史 FAIL | 不阻塞，后续 PERF-01 处理 |

D06 保持 **104 pass / 60 fail / 28 inconclusive**，不从 CI 推断真人/实体电源通过。历史 Linux 等证据保留原始源码和运行时身份。

## 工程与证据

统一应用版本源驱动 CLI、协议身份、默认策略和生成的 Mod 清单，内部 workspace 保持私有。工程候选模式保留独立包名；公开模式只交付安装 tgz、源码 tar.gz、构建清单和 SHA256SUMS。正常构建/测试/发布校验无需 Python 或编译器；冻结 Python 归档保持独立。

161 项对比保留三处既有、哈希约束的 CLI 文案差异。TS-06 只额外允许十二个明确路径上的当前发布身份：CLI 版本输出；UI read/describe 与事务 read/save/reopen 的 backend_version；六条 runtime stdout 中恰好一处 backend_version 替换。其他字节、字段、数值类型和持久状态仍精确比较。运行时动作序列只调整协议顶层 backend_version 的历史/当前身份，oracle 文件与哈希不变。

电源/终端采集器可同时传入 `--artifact`、`--commit`、`--installed-root`，校验完整分发包、采集源码及安装文件，再关联精确安装包身份。工具不触发电源动作；终端基础能力证据仍与真实编辑器验收分开。

原始日志、包和截图只放忽略的验证目录。公开摘要记录系统/架构、Node/npm/Claude/终端、源码 SHA、安装包 SHA-256、命令、数量、跳过项和真实 CI 链接；不提交私密对话和本机路径。

## 交付顺序

1. 经 GitHub PR 评审合并，要求最终 head 和合并 CI。
2. 固定合并 SHA 构建，要求标签 CI 和同字节 `release:prepare --preview` 证据。
3. 创建 GitHub 预览草稿并下载核验全部四项附件。
4. 以 fbincon 完成 npm 官方登录/双重验证，用 `--access public --tag beta --ignore-scripts` 发布同一 tgz。
5. GitHub 发布但不设 Latest，以明确引用同步验证后的 main/标签及相同附件到 Gitee，核对预览属性和下载。
6. 三系统公开下载工作流通过，包括 npm 固定版本与 beta 安装，再通过后续 PR 记录发布证据。

部分渠道失败不算交付完成；重试前核实远端状态，已公开版本和字节不可覆盖，修复递增 beta。正式版还需解决阻塞反馈、对最终包补齐适用验收。本次不增加自动计划或付费模型调用。
