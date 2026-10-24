# Git、终端、首次入口及版本管理交付

[English](m8-m9-delivery.md) | **简体中文**

目标：v3.8.0。起点：`d2975e8a4561371b5d32bec136400963dbccd97f`。尚未发布。维护者已批准四个功能 PR 和发布 PR，要求最终 PR/main/tag 门禁及 GitHub/npm/Gitee 字节验收。仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项既有缺口，继续保持未验证。

| 工作包 | 状态 | 证据 |
| --- | --- | --- |
| GIT-01 | VALIDATING | 共享策略及隔离回归；平台／安装回执待完成 |
| TERMINAL-01 | VALIDATING | Windows 能力判断一致性 |
| SETUP-02 | VALIDATING | npm 持久首次入口 |
| UPDATE-01 | VALIDATING | 从 v3.7.0 起的显式 CLI 版本转换 |

## Git 调用策略

platform 统一有界直接 Git 调用及提供方继承策略；状态采集、提交差异、来源身份和 GitHub 刷新均采用该策略。每次调用关闭 fsmonitor 和隐式裸仓库发现，不放宽所有权检查。状态采集预检过滤器及已初始化子模块，保留子模块脏状态；未知或冲突命令在扫描文件前阻止采集。两秒预算包含预检，每次输出限制 4 MiB，递归最多 64 个仓库。

| 配置 | 行为 |
| --- | --- |
| 仓库控制路径之外的用户／系统过滤器 | 保留用户转换 |
| 本地标准 Git LFS 命令 | 固定到仓库及 Git 目录之外的可执行文件 |
| 本地标准 git-crypt clean/smudge | 要求存在的外部绝对路径及受支持字面参数 |
| 其他 local/worktree 命令、不安全名称或冲突子模块定义 | 返回 `filter_blocked` 或 `policy_unavailable`，不替换成干净／零值 |
| 任意作用域 fsmonitor | 仅对这些观测调用禁用 |
| 隐式裸仓库 | 拒绝；不覆盖 `safe.directory` |

Git 状态缓存升为 3；显示及编辑器接口保持不变。`doctor` 本地化说明及缓存诊断报告策略失败，不打印过滤器命令或凭据。直接参数和两种 Git 运行时配置环境机制均传递策略，保留其他设置。策略不声称隔离另一个进程同时修改仓库文件或受信任程序安装的行为。

隔离回归覆盖同长度 clean-filter 调用、fsmonitor、全局过滤器、include、linked worktree、子模块、裸仓库、中文／空格路径及配置字节不变。核查参考 Matthew Breedlove（sirmalloc）及贡献者的 [ccstatusline 设计](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-hardening.ts)；本实现还在无法保留转换语义时阻止采集，并检查子模块。依据见 [Git 配置文档](https://git-scm.com/docs/git-config)。

## 验证与发布

各功能 PR 前记录本地校验，CI／安装回执、不可变身份和公开渠道结果随完成追加。未完成的平台、人工或发布检查不标为通过。

本地完整开发校验通过：1,167 项通过，五项既有平台跳过；生成资源、3,150 个文档链接、归档完整性及迁移清单通过。增加安装回执后另行重跑策略／诊断／发布门禁回归。发布准备现要求四项安装版 Git 场景；完整产物／平台结果仍待完成。

首轮 PR 矩阵发现 macOS `/var` 与 `/private/var` 路径别名，以及依赖索引时间戳的全局过滤器夹具问题。现于策略边界规范化根路径，并在夹具中明确使文件时间戳失效。安装版 Git 检查改在独立 Node 进程运行，避免验收父进程加载两套原生适配器。保留首轮失败记录，后续门禁须全部通过。

## Windows 预览策略

TERMINAL-01 增加共享 platform 能力判断及 ready 回调，由 setup、configure（含 slash 桥接）共用。检查实际 Windows 控制台句柄，启用并验证 VT，退出恢复输入／输出原始模式。显式无色及终端选择优先，继承 Windows Terminal 标记本身不决定调色板。setup 不再每帧重新判断能力；doctor 说明覆盖六语言。

安装验收增加 15 项真实 Windows 控制台场景（三入口 × 五环境），主动清除初始 VT 输出位，捕获发送的调色板，并核对恢复及设置不变。其他平台增加三项安装版策略检查，保留既有 PTY 流程。这些属于自动化控制台观察，不是 Windows Terminal 人工截图；#96 实体／人工缺口保持不变。

GIT-01 中间产物（源码 `2545ee2bea2ae05260c9cd1d824f85ac0472d06d`）通过独立构建字节一致及本地全部 17 项安装检查，包含四项 Git 场景；该中间产物未发布。

## 持久首次入口

SETUP-02 在 core 增加纯安装身份／动作规则，在 platform 提供有界 npm CLI 调用，在 cli/management 编排首次入口及独立包记录。无参数分派不进入渲染热路径。npm 通过已验证的 Node CLI 及字面参数调用，禁用生命周期脚本；保留配置的 registry，不打印认证信息。审核后重查 prefix、当前包字节及未完成操作，使用非阻塞 prefix 锁串行处理不同配置目录的包变更。复用系统安装不要求系统 prefix 可写。

包记录使用 schema 1，位于 `statusline_runtime/package-management`，与旧文件／插件恢复日志分离。npm 部分结果保留 prefix 标记及阶段。持久入口交接不改变显示保存、宿主 Apply、方案、绑定及独立启用策略。审核、取消、失败和下一步说明覆盖六语言。

验收结合状态／副作用回归及四项安装场景：真实 npm 连接临时回环 registry、受控确认、实际集成／渲染，并删除模拟 npx 缓存后用新进程启动。不使用用户 prefix 或 Claude 配置；完整平台结果待完成。

## 显式版本事务

UPDATE-01 增加版本化包兼容声明，以及与固定摘要绑定的 v3.7.0 兼容记录。core 负责版本／兼容规则和审核模型，platform 负责字面 npm 调用、元数据、SRI、staging 包及入口／资源验证，cli 负责选择、审核、prefix 锁、独立事务记录、修订绑定快照与恢复。显示 schema 13、编辑器协议 21 及既有 runtime／source 协议保持不变。

公开 CLI 在加载原生适配器之前转移至目标包之外的私有副本。目标集成由独立目标进程执行；事务保留执行器，使回退至 v3.7.0 后仍可恢复。Claude 始终绑定持久全局入口。npm 成功、包验证和集成成功分别记录阶段；恢复先检查磁盘实际版本，不重复已经验证的全局替换。配置恢复通过独立命令进行，保留当前授权、关闭选项及无关宿主设置。

实现分支提前采用已批准的 3.8.0 身份，以真实安装验收 3.7.0 → 3.8.0 → 3.7.0；此操作不发布版本。最终发布 PR 仍负责 Release notes、门禁核对及公开渠道验证。安装回执现要求二十类检查，包括真实 npm、固定历史字节、受控元数据、中断及独立恢复的七项包管理场景。保留八安装目标、32 个 Node 场景及十三个宿主目标。

首批 27 项管理、归档与发布准备定向测试本地通过。源码 `4345e2b505eac2f99ae67d1f361dcc8590690bbc` 的两次独立中间构建摘要均为 `628710d951474ba171542ef9a3cf8fcb41f6f40e4da0bf56ce7caf88379efa3b`。真实包完整性拒绝暴露了通用 npm 错误映射，现单独报告结构化 `EINTEGRITY` 而不转发 registry 详情。安装往返及最终矩阵证据待完成。用户操作见[版本管理指南](../PACKAGE_MANAGEMENT.zh-CN.md)。
