# 扩展实现与验收

[English](extensions.md) | **简体中文**

本次从 `9b783c9b92135607cb5f234a9c53314553fe9ecf` 实现 EXTENSIONS-01、LINKS-01、WORKFLOW-01、COMMAND-01、CAPABILITIES-01。CI-01、依赖自动更新和 SHOWCASE-01 不在范围内。使用方式见[扩展指南](../EXTENSIONS.zh-CN.md)。

## 职责与契约

- core 验证独立版本的数据源、标量观测、范围、受限 JSON Pointer 与新鲜度。显示引用使用不透明本机绑定，便携导入导出明确清除绑定 ID。
- 现有组件目录统一声明受影响组件的能力，共享表单、CLI 字段校验及配置解释使用相同描述；旧有无作用格式覆盖保持可读。
- platform 限制文件读取及进程输出。POSIX 使用进程组，Windows 使用关闭即终止的 Job Object，并在挂起状态将工具进程加入后恢复执行；静态监督程序不把参数插入 Shell 源码。
  POSIX 通过 `execve` 交接执行，避免 `execvp` 在无法识别可执行格式时隐式回退至 `/bin/sh`；旧 Node 运行时也使用相同规则，参见 [exec 接口契约](https://man7.org/linux/man-pages/man3/exec.3.html)。
  Windows 监督程序只从已加载的系统用户配置恢复系统目录变量，并明确加载系统 PowerShell 模块。用户命令通过独立序列化的环境块获得最小环境及调用方的 HOME，不会因监督程序的启动适配而继承完整宿主环境。
- cli 管理独立注册表事务、有时限的刷新任务、修订检查、观测缓存和 GitHub 查询。每个任务有独占执行标记、期限、取消状态与源修订。渲染不启动刷新；本地 JSON 渲染可维护最后已知值缓存，诊断只读且不发布缓存。
- 双编辑器复用同一数据源状态机，前端只适配绘制与通信。源保存、显示 Save 和宿主 Apply 分开。
- 链接目标附着于带样式的字素与预览片段，截断和换行重新构造闭合 OSC 8 区间；分隔符与装饰不继承前一链接。外部输入不能注入原始控制序列。

显示 schema 为 10，编辑器协议为 17；注册表与观测分别为 v1。运行时 2、生命周期 4、便携外层 1、UI 偏好 1、方案集合/导出 1 不变。旧 ID 与默认选择不变，增加三个主项和一个子代理项，含文本与占位共 66/17 种类型。


## 已完成的验收与交付

五个选定工作包均为 DONE。版本发布状态单独记录为已完成：[GitHub](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.6.0)、[npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.6.0)、[Gitee](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.6.0) 均交付核验后的产物。CI-01、Dependabot、SHOWCASE-01 未启动。

### 源码与自动化门禁

[功能 PR #123](https://github.com/fbincon/claude-code-statusline/pull/123) 的最终审阅头为 `99bf53bc5e93dfb5c6729f4e66e2b7a015d317be`，合并后发行源码为 `359b627aa3c4349b15f0b5007fc33fa17a8c0062`。附注标签 `v3.6.0` 对象为 `c80a5f9d95791845e1e98237d4d8589a7d94649e`，解引用后为该源码。

| 门禁 | 证据 | 结果 |
| --- | --- | --- |
| 最终 PR | [39912463623](https://github.com/fbincon/claude-code-statusline/actions/runs/39912463623) | 通过 |
| 发行 main | [39915698855](https://github.com/fbincon/claude-code-statusline/actions/runs/39915698855)，第 2 次尝试 | 通过；恢复过程见下文 |
| 附注标签 | [39922242928](https://github.com/fbincon/claude-code-statusline/actions/runs/39922242928) | 首次尝试通过 |
| OIDC 准备 | [39925189220](https://github.com/fbincon/claude-code-statusline/actions/runs/39925189220) | dry run 通过 |
| OIDC 发布 | [39925469351](https://github.com/fbincon/claude-code-statusline/actions/runs/39925469351) | 注册表延迟公开后第 2 次通过；恢复过程见下文 |
| 公开下载 | [39926501613](https://github.com/fbincon/claude-code-statusline/actions/runs/39926501613) | 六个 OS/Node 场景、十二次注册表安装通过 |

最终各轮功能 CI 均验收八安装目标、32 个 Node 运行时场景及十三个固定宿主。稳定版验证器同时要求四个扩展安装场景和本版本专项批准，不豁免新增失败。本地 `npm run check`：1,123 项测试，1,118 通过、五项平台跳过、零失败；核验 47 份生成资源及 2,746 条文档链接。两次干净构建、从交付源码归档进行的两次重建逐字节一致；main／tag CI 候选、下载的草稿附件及公开产物均与这四份文件一致。

### 安装行为与证据边界

十二项隔离安装检查全部通过，包括数据源显式启用、命令手动刷新、便携绑定隔离、OSC 8／纯文本输出；主行和子代理行覆盖 40／80／120 列。双编辑器及 CLI 共享审查、启用、绑定、刷新、取消和诊断；夹具覆盖六语言、冲突、旧修订、刷新期间禁用／删除、迟到结果、关闭取消、半写入／非法文件以及明确的 argv／stdin／环境边界。命令覆盖非零退出、非法 UTF-8／JSON、输出上限、超时及后代进程清理。

对本授权仓库的真实只读查询在最终审阅头解析出 PR #123，CI 为成功。切换到合并后的 main 时，旧源观测因分支／HEAD 改变而被隐藏。多 PR、无检查、等待、混合结论、认证／权限失败及身份变化另由夹具覆盖；源配置和观测不保存 token。

安装后的外部编辑器生成六语言 600 份 PTY 单元格捕获，另验证 `vt100`、`vt220`、`xterm-mono`、`dumb` 四个受限终端场景。终端恢复及取消后已保存配置不变均通过。报告 SHA-256：`c7b1f4b5be5ede9a24769259eb84f5474ca4f5d06f05f4de413ae02338c62b93`。实际 Claude 2.1.294 宿主通过数据源审查／原生操作、方案／保存、配置档及任务面板交互，报告 SHA-256：`9c7f9ac75200da2981d5597e8786728c1a74c55191290913c5167d307c9026f3`。两类运行模型调用均为零。

上述证据属于协议／PTY 和代理画面检查，不是 OS 截图、人工终端点击或实机桌面／电源验收。OSC 8 编码、闭合、截断、换行、emoji、Powerline 边界及纯文本回退由自动化检查；实际点击仍取决于终端和宿主能力。

### 公开交付

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.6.0.tgz` | `94d89808cd3aa841fedc0b800b6e620a2694edb1745d91b8e5cb75d3da5944a5` |
| `claude-code-statusline-3.6.0-source.tar.gz` | `53f2a54ff9b29987b42c6fee8bed25982cc674ea3e4ffb0937471f79e35ee2eb` |
| `build-manifest.json` | `8206992f9963038e5eaca3b148471f3226048ecfed65b42c5f366eaaa53aa84c` |
| `SHA256SUMS` | `bd98068c05d4b4a88568f0e3faa61534266a1277b5961c4048b4e6a8e3131ba0` |

npm `latest` 为 3.6.0，`beta` 保持 3.0.0-beta.1。OIDC 发布记录了[来源证明](https://search.sigstore.dev/?logIndex=3415380061)，并核验包的 SHA-256／SHA-512 和标签选择器。GitHub stable／Latest Release `421580832`、Gitee Release `1233575` 使用同一附注标签与源码。两站各四个附件均匿名下载、保留正常 TLS 验证，摘要与上表一致。本地固定版本／`latest` 安装使用初始空缓存并通过；Gitee 下载包通过十二项隔离安装检查。GitHub 与 Gitee 主线／标签使用明确 refspec 同步。

Gitee 首次 SSH 推送中断，回读确认远端引用未变后再重试。大附件的匿名 CDN 下载在初始路径超时，改用当前 Wi-Fi 接口与重新解析的公网地址后成功，保留正常 TLS 校验且不改变文件；SSH 同步始终严格核验已有服务器密钥。

### 修正与恢复

发布前失败促成了 Windows 监督程序启动、Node 24.0 文件身份、原生宿主冻结渲染属性、全局作用域编辑、本地 Git 身份读取、无检查解析及后台任务夹具清理修正。复现发现 Node `shell: false` 仍可能进入 POSIX `execvp` 对未知文本可执行文件的隐式 Shell 回退；最终 `execve` 交接拒绝该情形，同时保留明确解释器、字面参数、标准流和进程组清理。最终矩阵包含全部修正，没有通过停用产品测试取得验收。

main 第一次尝试有两项失败：Windows ARM／Node 22.x 的系统 PowerShell 就绪检查超过 60 秒，尚未执行候选；既有 macOS 26 Intel／Node 24.x 并发偏好写入测试无法建立当前进程身份，保留了原选择，底层 OS 原因未获证实。聚合门禁拒绝这两项。仅重跑失败任务及聚合，源码、时限与断言不变，第 2 次尝试通过；保留失败报告和日志。标签 CI 首次尝试通过。首次 OIDC 运行于 08:34 UTC 提交包并签署来源证明，但 npm 服务端处理超过既有三分钟可见性检查。注册表于 `2026-10-23T08:38:19.808Z` 公开版本。独立核验公开包 SHA-256／SHA-512、`latest` 及保留的 `beta` 后，仅重跑失败的发布任务。第 2 次尝试通过 `already-published` 路径，不再次上传或重新请求 OIDC 发布。保留原始签名证明及两次任务日志。

原始日志、旧候选、最终回执及 ANSI／单元格捕获保留在忽略的 `dist/validation/v3.6.0/`。独立交付文档后续 PR 仅运行必要文档检查，已发布标签和文件保持固定。

[v3.6.0 专项决定](../releases/approvals/v3.6.0.json)仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项既有缺口：macOS 实机睡眠、macOS 14 Intel 桌面／电源、Windows 10 桌面、WSL 弹窗、其余目标电源／人工视觉、Claude 2.1.296 精确类型声明。六项均仍未验证，不豁免新增功能问题或自动化失败。
