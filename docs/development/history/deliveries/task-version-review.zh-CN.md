# 任务浏览与版本审核

[English](task-version-review.md) | **简体中文**

> **历史记录（冻结于 v3.11.0，2026-10-28）。** 当前行为见[开发指南](../../README.zh-CN.md)及[路线图](../../roadmap.zh-CN.md)；当前接口版本见 [CLI 参考](../../../reference/cli.zh-CN.md#协议与-schema-版本)。

## 验证与交付

TASK-02 与 UPDATE-02 第一片已随 v3.11.0 于 2026-10-28 发布。TASK-02 包含基础及增强阅读两片；UPDATE-02 第二／三片在 v3.11.0 时尚未开始，后于 v3.12.0 交付（[v3.12.0 交付记录](source-command-package-management.zh-CN.md#v3120-交付记录)）。维护者要求保持 3.11.0，将实际安装发现的版本页权限误报留待 [issue #173](https://github.com/fbincon/claude-code-statusline/issues/173) 后续修复，该问题已在 v3.12.0（PR #175）修复。[任务用法](../../../TASK_DETAILS.zh-CN.md) · [包管理](../../../PACKAGE_MANAGEMENT.zh-CN.md)。

v3.11.0 的编辑器协议 27 新增本机 `package_status` 以及按所有者绑定的 `package_review_start`、`package_review_status`、`package_review_cancel`，详见[协议约定](../../contracts.zh-CN.md#任务浏览与包审核协议-27)。该交付中任务详情仍为版本 1，显示 schema 16 和既有持久化格式不变。

在 v3.11.0 中，界面执行／恢复及受保护历史清理仍属于 UPDATE-02 第二／三片，后于 v3.12.0 交付（[v3.12.0 交付记录](source-command-package-management.zh-CN.md#v3120-交付记录)）。

必需覆盖六语言、无／部分／陈旧／冲突任务数据、父节点缺口、大列表、Unicode 缩放、选中位置保持、刷新失败、已保存／未保存／未知保存结果、进入页面仅本机读取、元数据与已验证产物区分、不兼容目标、完整性／身份变化和视图独立取消。既有升级／回退／恢复检查继续必需。

安装态受控 registry 验收验证本机读取零 registry 请求、元数据检查、已验证升级／回退 dry-run、独立配置还原审核及取消，并比较安装／配置字节。发布验证器要求安装和官方宿主版本管理结果都包含这些回执。保留 8 个安装目标、32 个 Node 用例、16 个固定宿主和 197 个 Native 容量用例，并增加本次安装态／PTY 旅程。

测试机 Claude 2.1.312 的观察作为补充，不替代固定宿主回执或实体／人工验收。相同六项 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 缺口继续接受且未验证，本次不运行付费模型测试。

## 已接受源码与不可变交付物

[PR #172](https://github.com/fbincon/claude-code-statusline/pull/172) 交付源码 `d49547efd52cfe9a786b7291cfc0cf28828e8246`。main 合并提交 `f72fe3dcfb9c70aa67d2a972ea0edcc97d484c15` 与其具有相同树。注释标签 `v3.11.0` 的对象为 `cd07a2a152a88a7e8a3e26aea80d5301eccb0b84`，指向可从 main 到达的已接受 PR 源码。

| 门禁 | 结果 |
| --- | --- |
| [最终 PR 40681624434](https://github.com/fbincon/claude-code-statusline/actions/runs/40681624434) | Complete candidate evidence 通过；包含 8 个安装目标、32 个 Node 用例、16 个固定宿主及 197 个 Native 容量用例 |
| [Main 40689472382](https://github.com/fbincon/claude-code-statusline/actions/runs/40689472382) | 原始证据校验及 Linux／Windows／macOS 安装冒烟通过 |
| [Tag 40690205648](https://github.com/fbincon/claude-code-statusline/actions/runs/40690205648) | 原始源码提升及 Complete candidate evidence 通过 |
| [npm 预演 40692422132](https://github.com/fbincon/claude-code-statusline/actions/runs/40692422132) | 针对准确标签和原始软件包通过 |
| [npm 发布 40692928066](https://github.com/fbincon/claude-code-statusline/actions/runs/40692928066) | 新版本 OIDC 发布及 registry 校验通过 |

原始候选构件 `12813002893` 提供四个交付文件。验收构件 `12815224448` 记录 56 次原始执行及 66 个回执哈希。本地独立构建和从交付源码压缩包进行的重建均逐字节复现四个文件；main 和 tag 复用原始字节。

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.11.0.tgz` | `bb9545b8f6da203f90da5a06694f86ae4e457d21514db9e736c9a6716f387d99` |
| `claude-code-statusline-3.11.0-source.tar.gz` | `6794411a91e6fe3577aae88cbcf0fb3ab54180f12d704c1a3d08c5681c4d6abe` |
| `build-manifest.json` | `e7cc136cd4bac57e3613f95c811470061937889b5e2f5e6f1ea83119552f62ff` |
| `SHA256SUMS` | `b036efaef60df4761490df81cd892beb781014dceb8f64807cee4fa246365559` |

## 本地与终端验证

最终源码通过 `npm run check`：1,364 项测试通过、6 项既有平台用例跳过、零失败。生成检查覆盖 70 个受管资源；文档、归档及职责检查通过。固定 Claude 2.1.310 Native 测试全部 164 项通过，准确宿主类型检查也通过。

在 v3.11.0，安装态验收有 24 类，包含六语言任务读取及元数据／已验证产物区分。重新下载的四个 GitHub 草稿附件与原始 CI 文件一致，从下载包进行的全新离线安装通过全部 24 类。审核期间配置及安装包字节保持不变。

最终包通过 27 条真实 Linux Native／外部 PTY 旅程。扩展外部采集记录六语言共 924 张明／暗帧，以及四项单色／dumb 终端检查，终端恢复且配置保持不变。已目视检查任务摘要、证据、显式身份、独立入口及本机包管理页面。采集源码为[外部采集器](../../../../tools/acceptance/editor-capture.ts)和 [Native／外部旅程采集器](../../../../tools/acceptance/native-capacity-pty.ts)；报告保留准确源码、软件包、字体及帧哈希。这些是使用合成任务证据的终端单元格重建。隔离本地安装的版本页采集有意显示未知持久前缀，不声称存在受管全局安装。

验收发现并修复取消清理竞争，以及 Native 大报告翻页时重复扫描 Unicode 的问题。取消现先确认执行器退出再清理；翻页复用已换行行及父子关系索引，既有宿主测试的 5 秒限制保持不变。早期失败、中断及部分传输回执与通过证据分开保留。原始日志、终端单元格及渲染图片保存在忽略目录 `dist/validation/v3.11.0/`。

## 发布渠道与测试机

[npm 3.11.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.11.0) 已公开：`latest=3.11.0`，`beta=3.0.0-beta.1` 保持不变。OIDC 发布回执记录上述原始包哈希及源码。

[GitHub v3.11.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.11.0) 为不可变稳定版及 Latest，发布时间为 `2026-10-28T13:15:20Z`。[公开下载 40694759092](https://github.com/fbincon/claude-code-statusline/actions/runs/40694759092) 的 Linux／Windows／macOS × Node 22／24 共六项作业全部通过，包含精确版本及 latest 安装。

[Gitee v3.11.0](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.11.0)（Release `1250326`）分发相同注释标签和四个已验证文件。四个手动附件均在正常 TLS 校验下匿名下载，与原始字节一致；两个自动生成归档不替代已验证源码归档。下载包经空缓存离线安装后，版本、渲染、任务 JSON、独立任务 PTY／取消检查通过。发行说明依据 GitHub 元数据和实际 Gitee 附件地址生成并回读。检查祖先关系后，使用显式 refspec 同步了已验证 main 和准确标签。

实际测试安装经项目包管理器从 3.10.0 升级到 3.11.0，快照为 `pkg-a9d5b015-a091-4dd5-b390-56d59a870238`。软件包／接入验证及 doctor 通过。实际安装的补充 PTY 探针打开外部版本页、任务摘要／证据及独立任务查看器，保留未保存草稿，退出后恢复终端属性且没有模型调用。探针明确记录下述警告，不声称本机包兼容检查通过。doctor 继续验证 Native 资源所有权与已装后端绑定；这不构成新的人工／实体验收。

配置恢复审核确认没有显示变更需要还原。原显示／界面偏好字节、POSIX 权限及可选文件的缺省状态与升级前快照一致。Claude 无关设置保持不变，唯一设置差异是受管 Native 后端版本从 3.10.0 变为 3.11.0。安装包保持 3.11.0。

## 延后处理的版本页警告

[Issue #173](https://github.com/fbincon/claude-code-statusline/issues/173) 记录已确认的发布后缺陷：版本页通过私有恢复文件读取器读取普通 npm 清单，因此 `0644`／`0664` 等 POSIX 权限可能产生 `io_error` 和错误的本机兼容结果。版本、前缀及上一版本仍能识别；既有 CLI 包审核可继续使用，不应仅为消除提示而修改安装文件权限。该缺陷已在 v3.12.0（PR #175）修复；本节保留 v3.11.0 的观察与延后决定。

2026-10-28，维护者明确要求保持 3.11.0，把此问题留给后续开发。尚未提交的修复已撤回，没有创建 3.11.1 标签或发布。该已知缺陷独立于 issue #96 的六项既有未验证缺口，也不记为通过检查。TASK-02 已交付；UPDATE-02 第一片已交付并单独跟踪此问题，第二／三片在 v3.11.0 时尚未开始，后于 v3.12.0 交付（[v3.12.0 交付记录](source-command-package-management.zh-CN.md#v3120-交付记录)）。
