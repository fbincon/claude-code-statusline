# Git、终端、首次入口及版本管理交付

[English](m8-m9-delivery.md) | **简体中文**

目标：v3.8.0。起点：`d2975e8a4561371b5d32bec136400963dbccd97f`。已于 2026-10-25 完成 GitHub／npm／Gitee 发布及公开下载核验。维护者已批准四个功能 PR 和发布 PR，要求最终 PR/main/tag 门禁及 GitHub/npm/Gitee 字节验收。仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项既有缺口，继续保持未验证。

| 工作包 | 状态 | 证据 |
| --- | --- | --- |
| GIT-01 | DONE | [PR #137](https://github.com/fbincon/claude-code-statusline/pull/137) · [完整 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40075245972) |
| TERMINAL-01 | DONE | [PR #138](https://github.com/fbincon/claude-code-statusline/pull/138) · [完整 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40075247333) |
| SETUP-02 | DONE | [PR #139](https://github.com/fbincon/claude-code-statusline/pull/139) · [完整 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40081854700) |
| UPDATE-01 | DONE | [PR #140](https://github.com/fbincon/claude-code-statusline/pull/140) · [完整 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40087600655) |

## 最终源码与交付核验

[发布 PR #141](https://github.com/fbincon/claude-code-statusline/pull/141)固定源码 `f68d26eeddda98ab4041d2b9e873ade556fa1909`；`v3.8.0` 附注标签对象为 `3678648f079171c89fb1a821b7c597851c4793ad`。[最终 PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40092744615)、[main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40201359757)和 [tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40201492094)最终各通过 56 个适用作业，仅跳过一项条件性纯文档检查。最终 main／tag 准备回执均核验八安装目标、32 个 Node 场景及十三个固定宿主。最终开发检查通过 1,208 项测试、零失败，保留五项既有平台跳过；51 项生成资源和 3,198 个文档链接通过。

两次独立构建、完整的交付源码重建以及最终 tag CI 构建，均得到下表四个文件的相同字节。GitHub 草稿附件下载后与之相符；下载的包通过隔离离线安装、版本、集成及渲染检查。首次源码重建在第二轮打包下载依赖时 TLS 连接中断，保持源码不变完整重跑后通过；未修改依赖或核验规则。

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.8.0.tgz` | `c11ebea864a0d472c779f87401fe2e96bfcd3d16120db0cf2661d50fd6339dbc` |
| `claude-code-statusline-3.8.0-source.tar.gz` | `2d5522d7c2487bccaa53f06c029fc5d23d39884b31ff8f68569f541f44232153` |
| `build-manifest.json` | `f96663ea9a169f8d9ee139cfeb08f6cde1262a6e76c681a1f5e51b8850f3b664` |
| `SHA256SUMS` | `20efffe130654ac90c54560423836f6c86ffb14e98b4a3618ff6efb1ed588e81` |

最终安装版 Linux PTY 验收通过 **684** 张深浅色捕获，每种语言 114 张，另通过四项单色／dumb 终端检查、取消保留与终端恢复，并检查了六语言代表画面。报告 SHA-256：`80540ae33058f626b4987ca8698e16b17b942f7338e2e1ca201ea62e7252710a`。这些是终端单元格重建，不是操作系统截图或人工桌面／电源验收；没有模型调用。

[tag CI 首轮](https://github.com/fbincon/claude-code-statusline/actions/runs/40201492094/attempts/1)中，Windows／Claude 2.1.289 的两套官方 Mod 测试与精确宿主类型检查通过，随后一项 npm 操作在包事务建立前触及既有 30 秒上限。其余 54 项通过，汇总门禁正确失败。[相同产物诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40203230224)在相同 Windows／宿主组合通过三轮各二十项完整操作；249 次受控进程观测中的 npm root／version／config／view 查询均在原上限内完成。未复现原超时，不推断其根因；产品期限和发布标准不变。[tag 第二次运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40201492094/attempts/2)随后通过失败作业及汇总，完成全部 56 项适用门禁；其正式宿主版本回执包含全部七项场景和二十项操作。原失败回执先下载并核对摘要，再将同名旧附件从发布输入集合移除；原运行日志及保留的归档继续保存失败证据。

[npm 3.8.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.8.0)、[GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.8.0)和 [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.8.0)已发布并核对公开字节。[OIDC 预演](https://github.com/fbincon/claude-code-statusline/actions/runs/40207988960)及[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40208161490)通过；npm `latest=3.8.0`，`beta=3.0.0-beta.1` 保持不变。[公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40208466789)六项全部通过，覆盖 Linux／Windows／macOS × Node 22／24 的精确版本及 latest 安装。GitHub／Gitee 各四个交付附件均与上表相符；已用明确 refspec 同步验证后的 main 和相同附注标签对象，GitHub 保持主仓库。Gitee 源码下载使用原生 Wi-Fi 和实时解析的公开地址，保留正常 TLS 验证。

## 已通过的功能验收

四个功能 PR 各自通过 56 个适用 CI 作业，仅跳过条件性的纯文档作业，随后合并。最终功能提交为 `2394bcff50e2a3e37b0912c28e2de7e8afc6b7b6`，合并提交为 `dfb2083bd2086dc842b6d6f04b3a87a6daddf03e`。其八安装目标、32 个 Node 场景、十三个固定宿主及汇总门禁全部通过；每份安装／runtime 回执要求二十类检查，每个 Windows 目标还须包含十五项环境场景与九项实际 shell／入口组合。

完整开发检查通过 1,208 项测试，保留五项既有平台跳过；51 项资源生成、六语言覆盖、3,174 个文档链接、归档及责任清单检查通过。该功能提交的两次独立构建包摘要一致，为 `3e93344ae52e2364dba34399287a8546e0408ff75cd2f04ffcfdb0cb8b073566`，源码归档摘要为 `d544d247eb39b0aafb173ddc3be624613bc44ee3a846402ef3061850f532067a`。这些是功能验收产物，尚非最终公开发布产物。

以下保留中间实现与失败诊断历史。中间段落中的待验证说明保留当时语境，最终源码、门禁及公开渠道结果以上文为准。

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

## 早期 Git 验证

各功能 PR 前记录本地校验，CI／安装回执、不可变身份和公开渠道结果随完成追加。未完成的平台、人工或发布检查不标为通过。

本地完整开发校验通过：1,167 项通过，五项既有平台跳过；生成资源、3,150 个文档链接、归档完整性及迁移清单通过。增加安装回执后另行重跑策略／诊断／发布门禁回归。发布准备现要求四项安装版 Git 场景；该阶段属于中间检查；已通过的平台结果见上文。

首轮 PR 矩阵发现 macOS `/var` 与 `/private/var` 路径别名，以及依赖索引时间戳的全局过滤器夹具问题。现于策略边界规范化根路径，并在夹具中明确使文件时间戳失效。安装版 Git 检查改在独立 Node 进程运行，避免验收父进程加载两套原生适配器。保留首轮失败记录，后续门禁须全部通过。

## Windows 预览策略

TERMINAL-01 增加共享 platform 能力判断及 ready 回调，由 setup、configure（含 slash 桥接）共用。检查实际 Windows 控制台句柄，启用并验证 VT，退出恢复输入／输出原始模式。显式无色及终端选择优先，继承 Windows Terminal 标记本身不决定调色板。setup 不再每帧重新判断能力；doctor 说明覆盖六语言。

安装验收增加 15 项真实 Windows 控制台场景（三入口 × 五环境），主动清除初始 VT 输出位，捕获发送的调色板，并核对恢复及设置不变。其他平台增加三项安装版策略检查，保留既有 PTY 流程。这些属于自动化控制台观察，不是 Windows Terminal 人工截图；#96 实体／人工缺口保持不变。

最终验收还从实际 PowerShell、CMD 和 Git Bash 进程分别启动三个入口。新增九项控制台回执将真实 shell 启动与十五项环境复现场景分开，要求 256 色输出、取消及模式恢复。发布准备拒绝缺失、重复或未恢复的 shell 回执。版本转换测试与其子进程包装采用一致的显式预算，产品超时保持不变。

[实际 shell 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40087055566)通过 Windows 2025／ARM × Node 22.0.0／24.0.0 的全部四个作业，每个作业包含十五项环境场景及九种真实 shell／入口组合。早期夹具错误地将 POSIX 驱动路径传给原生 Node；保留 Windows 参数路径后修正，产品未改变。这些诊断回执使用固定的 `e3029fe` 包，最终绑定源码的矩阵仍须执行相同必需检查。

GIT-01 中间产物（源码 `2545ee2bea2ae05260c9cd1d824f85ac0472d06d`）通过独立构建字节一致及本地全部 17 项安装检查，包含四项 Git 场景；该中间产物未发布。

## 持久首次入口

SETUP-02 在 core 增加纯安装身份／动作规则，在 platform 提供有界 npm CLI 调用，在 cli/management 编排首次入口及独立包记录。无参数分派不进入渲染热路径。npm 通过已验证的 Node CLI 及字面参数调用，禁用生命周期脚本；保留配置的 registry，不打印认证信息。审核后重查 prefix、当前包字节及未完成操作，使用非阻塞 prefix 锁串行处理不同配置目录的包变更。复用系统安装不要求系统 prefix 可写。

包记录使用 schema 1，位于 `statusline_runtime/package-management`，与旧文件／插件恢复日志分离。npm 部分结果保留 prefix 标记及阶段。持久入口交接不改变显示保存、宿主 Apply、方案、绑定及独立启用策略。审核、取消、失败和下一步说明覆盖六语言。

验收结合状态／副作用回归及四项安装场景：真实 npm 连接临时回环 registry、受控确认、实际集成／渲染，并删除模拟 npx 缓存后用新进程启动。不使用用户 prefix 或 Claude 配置；已通过的平台结果见上文。

## 显式版本事务

UPDATE-01 增加版本化包兼容声明，以及与固定摘要绑定的 v3.7.0 兼容记录。core 负责版本／兼容规则和审核模型，platform 负责字面 npm 调用、元数据、SRI、staging 包及入口／资源验证，cli 负责选择、审核、prefix 锁、独立事务记录、修订绑定快照与恢复。显示 schema 13、编辑器协议 21 及既有 runtime／source 协议保持不变。

公开 CLI 在加载原生适配器之前转移至目标包之外的私有副本。目标集成由独立目标进程执行；事务保留执行器，使回退至 v3.7.0 后仍可恢复。Claude 始终绑定持久全局入口。npm 成功、包验证和集成成功分别记录阶段；恢复先检查磁盘实际版本，不重复已经验证的全局替换。配置恢复通过独立命令进行，保留当前授权、关闭选项及无关宿主设置。

实现分支提前采用已批准的 3.8.0 身份，以真实安装验收 3.7.0 → 3.8.0 → 3.7.0；此操作不发布版本。最终发布 PR 仍负责 Release notes、门禁核对及公开渠道验证。安装回执现要求二十类检查，包括真实 npm、固定历史字节、受控元数据、中断及独立恢复的七项包管理场景。保留八安装目标、32 个 Node 场景及十三个宿主目标。

首批 27 项管理、归档与发布准备定向测试本地通过。源码 `4345e2b505eac2f99ae67d1f361dcc8590690bbc` 的两次独立中间构建摘要均为 `628710d951474ba171542ef9a3cf8fcb41f6f40e4da0bf56ce7caf88379efa3b`。真实包完整性拒绝暴露了通用 npm 错误映射，现单独报告结构化 `EINTEGRITY` 而不转发 registry 详情。安装往返及功能矩阵证据见上文。用户操作见[版本管理指南](../PACKAGE_MANAGEMENT.zh-CN.md)。

UPDATE-01 本地验收源码 `1daf5d852f43b4993e6194012d89c9eb4c158367` 通过 1,194 项测试（五项既有平台跳过）、51 项生成资源及 3,174 个文档链接。独立构建包 SHA-256 为 `95dd967f94fac51b50e9b0db981079e086d6254fca2e3646e2cd23b0dbbda3a3`，全部二十项安装检查通过；七项转换场景还通过隔离的官方 Claude 2.1.296 宿主及两个适用 Mod，包含中断、资源刷新、关闭选项保留和独立恢复。未发起模型调用。包子进程身份记录及协作取消防止将仍存活的执行器误判为空闲恢复目标；后续完整功能矩阵已通过，最终发布门禁仍须通过。

[独立 Windows ARM 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40077221439)及[更新矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/40076937090)的两个 Windows Node 22.23.4 任务均在 `fs.cpSync` 内以 `0xC0000409` 退出，复制尚未完成，也未加载任何原生模块。包复制现使用有界目录枚举及排他普通文件复制，拒绝链接／特殊文件，并在私有目录中保留可执行权限。bootstrap 与保留的恢复执行器采用同一实现；后者验证成功后才通过目录重命名交付。这是针对已观察复制失败的规避措施，不推断上游根因；替代平台门禁仍须通过。

[替代实现诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40077988543)在 Windows ARM／Node 22.23.4 上完成十轮首次入口检查，使用此前固定的夹具包。这属于诊断证据，不是最终发布验收。[后续 Node 22.0.0 矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/40078309875)发现路径别名导致目标包含检查失效；现先解析源路径及目标既有父目录，再检查包含关系，并通过目录别名回归验证在创建目标前拒绝。

[清理诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40080844051)在两个 Windows 目标的 Node 24.0.0 上复现另一项问题：`rmSync` 返回后没有删除 Unicode 目录，延迟观察时原路径和规范路径仍包含复制的文件。Node 的 [#61108](https://github.com/nodejs/node/pull/61108)记录了非 ASCII 路径缺陷，并在 [24.13.1](https://nodejs.org/en/blog/release/v24.13.1) 中修复。现以仅依赖内建模块的逐项 unlink/rmdir 清理包执行器、staging 和集成文件，也替换已有用量会话清理中的同一受影响调用。删除链接时不遍历其目标；首次入口验收明确断言缓存已消失后才重启，保留 Node 下界及中文路径夹具。

[修正后的清理诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40081505631)通过 Windows 2025／ARM × Node 22.x／24.0.0 的全部四个作业；每个作业均完成两类有界复制失败场景各 1,000 轮，以及目录链接／Unicode 清理回归。最终安装包及发布矩阵仍须单独通过。

[更新矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/40079404397)还在十秒上限的 `git lfs version` 夹具准备阶段记录了空子进程状态，尚未进入产品策略检查。旧日志未保留底层错误，因此不推断具体原因。夹具现记录状态／信号／错误，并仅对此冷启动准备允许三十秒；产品截止时间及过滤器／超时断言保持不变。

[后续更新矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/40081939042)触及旧有单操作 150 秒及安装套件十分钟验收预算：前者可能先于产品单个 npm 步骤的 180 秒上限中断，后者未计入新增真实包转换序列。验收现分别组合单操作六分钟、转换序列十五分钟（正式宿主二十分钟）、既有套件十分钟及外层准备／清理预算，产品超时不变。每条版本测试命令在临时安装目录之外记录耗时、结果及有界失败诊断，未完成运行不能提供通过回执。中间 [main 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40080997079)另保留了一项 macOS checkout DNS 失败，尚未取得源码或执行候选；最终仍须通过绑定源码的完整门禁。

`e3029fe` 的完整开发检查通过 1,207 项测试，保留五项既有平台跳过。[对应矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/40084425356)中，Windows／Claude 2.1.288 在包替换前触发产品 npm 超时，其余 54 个作业通过，汇总门禁正确失败。[相同产物诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40085700315)在 Windows 2025／2.1.288 完成两轮、Windows 2025／2.1.289 完成三轮各二十项操作，未复现该超时；前者第三轮在调用产品前下载历史归档时遇到 `ECONNABORTED`。不推断原超时根因，保留产品期限，替代正式门禁必须通过。

## 后续诊断与发布边界

相同版本产物的诊断另在 Windows ARM／Claude 2.1.288 完成三轮各二十项操作，因此三种环境共八轮完整转换通过。第三方历史包下载中断没有被记录为产品通过；原 npm 超时仍不推断根因。随后 UPDATE-01 的完整正式矩阵一次通过全部适用作业。

[SETUP-02 合并后的中间 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40086715360)首轮曾在 Windows 子模块脏状态测试中得到 `error`；旧日志未记录底层原因，不能断定为超时。[独立诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40088039171)在两个 Windows 目标、Node 22／24 上各用二十个新仓库完成一百次观测，全部通过，保留逐调用耗时及错误记录能力。产品两秒总预算不变；后续 UPDATE-01 的正式矩阵也通过。首轮被取消，第二次运行随后通过；两次中间运行均不能替代上文最终发布源码的门禁。

[UPDATE-01 合并后的中间 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40091394223)记录了一项官方 Windows／Claude 2.1.289 原生编辑器英文保存／取消／重开测试的 30 秒超时，其余 131 项原生测试通过。日志不足以确定底层原因；测试上限不变，最终发布矩阵仍必须通过同一测试。

四个工作包已 DONE，v3.8.0 公开发布及三渠道下载核验已完成；失败、诊断与正式复验分别保留在上文。[本版本批准记录](../releases/approvals/v3.8.0.json)限定保留 #96 的六项原有未验证缺口。
