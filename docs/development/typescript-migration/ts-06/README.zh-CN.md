# TS-06 预览交付与正式版验收

[English](README.md) | **简体中文**

状态：依据下述限定版本决定，**DONE**。**v3.0.0 已在 npm `latest`、GitHub 正式版/Latest 和 Gitee 正式版发布并通过下载核验**。[正式版身份、摘要及 CI 证据](stable-release.zh-CN.md)。保留 [beta.1 交付记录](preview-release.zh-CN.md)、npm `beta` 和不可变附件。[用户指南](../../../USER_GUIDE.zh-CN.md) · [反馈与平台跟踪](https://github.com/fbincon/claude-code-statusline/issues/96)。

## 正式版决定：2026-10-18

维护者确认 beta.1 验收，明确选择**接受已知缺项发布**，并批准 v3.0.0 实施及正式交付计划。本决定仅对 **v3.0.0** 修订此前实体/桌面必过门槛，目标支持范围保持不变。macOS 实机休眠恢复、macOS 14 Intel 桌面/电源、Windows 10 桌面、WSL 桌面/弹窗和其他目标人工/电源覆盖继续标为**未验证**；Claude 2.1.296 精确声明仍不可用。不推断新增人工、电源或类型检查通过。

[机器可读批准记录](stable-approval.json)包含在已校验源码包中；`release:prepare --stable` 核对版本和批准范围，将记录 SHA-256 与通过的源码/产物绑定自动证据一起报告。该记录不能批准其他版本、不完整矩阵或功能失败。D06 仍 FAIL，PERF-01 仍 NOT_STARTED。[正式交付证据](stable-release.zh-CN.md)按实际结果更新。

v3.0.0 使用 npm `latest`、GitHub 正式版/Latest 和 Gitee 正式 Release。双编辑器默认接入保持不变；未保存偏好时，原生计时和高级采集均默认关闭，显式参数和已保存偏好仍优先。不上传 PyPI，Python v2.0.0 保留为回退目标；beta.1 保持 `beta` 和不可变附件。

## 关闭记录：2026-10-18

[PR #99](https://github.com/fbincon/claude-code-statusline/pull/99)交付安装默认值、外部 TUI 恢复及正式发布支持。最终 head、合并提交、标签的 CI 各 23 项通过；固定源码 `d3c87090fed4005f9d1ec8d84d3b016e0cdd4774` 可从源码附件重建为相同字节，草稿下载、npm 和 Gitee 字节一致。三系统公开下载检查均通过精确版本及 `latest` 安装。[完整报告](stable-release.zh-CN.md)记录各附件、源码归档内批准及仍未验证的范围。TS-06 为 DONE；PERF-01 保持 NOT_STARTED，须由后续任务启动。#96 继续收集缺失的平台观察。

## 已批准的预览门槛修订，2026-10-18

预览交接时，维护者批准先公开预览，收集本机无法完成的 macOS/Windows 及其他目标平台反馈，替代此前“任何 TS 发布之前完成全部实体/桌面验证”的要求。上文限定版本决定出台前，缺失项仍是正式版门槛，延期从不代表通过。目标平台边界不变。当时首个预览交付后 TS-06 仍进行中，后续正式交付见上文关闭记录；PERF-01 保持 NOT_STARTED。

当时预览包名为 `@fbincon/claude-code-statusline`，版本 `3.0.0-beta.1`，npm 使用 `beta` 标签；GitHub/Gitee 使用 `v3.0.0-beta.1` 并标记预览。Python v2.0.0 当时为最新稳定版，现仍保留为回退目标，没有上传 PyPI。与历史 Python 预览不同，TS 预览默认开启两个兼容编辑器，保留显式关闭；高级 live metrics 仍显式启用。

| 门槛 | 预览版 | 正式版 |
| --- | --- | --- |
| 固定源码独立构建及相同字节 | 必须 | 必须 |
| 八安装目标 / 十三固定宿主 | 最终 head、合并及标签必须通过 | 最终 head、合并及标签均已通过 |
| GitHub/Gitee/npm 下载身份与安装 smoke | 必须 | 必须 |
| macOS 实机休眠恢复 | 未验证，收集反馈 | 未验证；v3.0.0 已接受 |
| macOS 14 Intel 实机桌面/电源 | 未验证 | 未验证；v3.0.0 已接受 |
| Windows 10 桌面、焦点、编辑器与恢复 | 未验证 | 未验证；v3.0.0 已接受 |
| WSL 桌面启动/焦点与弹窗 | 未验证 | 未验证；v3.0.0 已接受 |
| 其他平台电源/人工视觉 | 保留历史精确范围，新缺口未验证 | 未验证范围仅对 v3.0.0 接受 |
| Claude 2.1.296 精确声明 | 不可用；复查，保留官方 Mod 测试与 2.1.294 类型检查 | 不可用；仅对 v3.0.0 接受，六项缺口保留 |
| 功能超时、事件丢失、写入与恢复 | 阻塞 | 阻塞 |
| D06 性能预算 | 披露历史 FAIL | 不阻塞，后续 PERF-01 处理 |

D06 保持 **104 pass / 60 fail / 28 inconclusive**，不从 CI 推断真人/实体电源通过。历史 Linux 等证据保留原始源码和运行时身份。

## 工程与证据

统一应用版本源驱动 CLI、协议身份、默认策略和生成的 Mod 清单，内部 workspace 保持私有。工程候选模式保留独立包名；公开模式只交付安装 tgz、源码 tar.gz、构建清单和 SHA256SUMS。正常构建/测试/发布校验无需 Python 或编译器；冻结 Python 归档保持独立。

161 项对比保留三处既有、哈希约束的 CLI 文案差异。TS-06 只额外允许十二个明确路径上的当前发布身份：CLI 版本输出；UI read/describe 与事务 read/save/reopen 的 backend_version；六条 runtime stdout 中恰好一处 backend_version 替换。其他字节、字段、数值类型和持久状态仍精确比较。 v3.0.0 已批准的无偏好策略仅额外改变 `runtime-null-prompt/value/0/stdout`：native timing/enabled 改为 false，顶层和执行计时原因改为关闭。原 stdout SHA-256 固定，其他字节仍精确比较，并以负向用例防止扩大豁免；oracle 与原三项文案例外不变。运行时动作序列只调整协议顶层 backend_version 的历史/当前身份，oracle 文件与哈希不变。

电源/终端采集器可同时传入 `--artifact`、`--commit`、`--installed-root`，校验完整分发包、采集源码及安装文件，再关联精确安装包身份。工具不触发电源动作；终端基础能力证据仍与真实编辑器验收分开。

原始日志、包和截图只放忽略的验证目录。公开摘要记录系统/架构、Node/npm/Claude/终端、源码 SHA、安装包 SHA-256、命令、数量、跳过项和真实 CI 链接；不提交私密对话和本机路径。

## 首预览交付顺序历史

1. 经 GitHub PR 评审合并，要求最终 head 和合并 CI。
2. 固定合并 SHA 构建，要求标签 CI 和同字节 `release:prepare --preview` 证据。
3. 创建 GitHub 预览草稿并下载核验全部四项附件。
4. 以 fbincon 完成 npm 官方登录/双重验证，用 `--access public --tag beta --ignore-scripts` 发布同一 tgz。
5. GitHub 发布但不设 Latest，以明确引用同步验证后的 main/标签及相同附件到 Gitee，核对预览属性和下载。
6. 三系统公开下载工作流通过，包括 npm 固定版本与 beta 安装，再通过后续 PR 记录发布证据。

部分渠道失败不算交付完成；重试前核实远端状态，已公开版本和字节不可覆盖，修复递增 beta。正式版按上文决定和当前[发布流程](../../../RELEASING.zh-CN.md)执行；最终产物仍须通过自动化及功能验收。本次不增加自动计划或付费模型调用。
