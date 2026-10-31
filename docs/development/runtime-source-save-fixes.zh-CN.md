# 运行身份、来源超时与保存冲突修复

[English](runtime-source-save-fixes.md) | **简体中文**

本记录覆盖已批准的 v3.16.1 修复：[#197](https://github.com/fbincon/claude-code-statusline/issues/197)、[#195](https://github.com/fbincon/claude-code-statusline/issues/195)、[#196](https://github.com/fbincon/claude-code-statusline/issues/196)。不可变实现、发布前验收及已核验交付记录如下。发布状态：**已发布；必需发布门禁、公开渠道及本机验收均已核验**；必需 PR／main／tag 门禁、公开渠道及已发布本机结果保留各自原始证据身份。

## 行为与边界

| Issue | 缺陷 | 修复契约 |
| --- | --- | --- |
| #197 | `turn.start` 丢弃代理 ID，在已完成代理记录旁产生未结束的主线程记录；迟到终态批次可能先落定主线程、后落定代理 | 独立于主线程保留代理作用域身份，按已观测完成时间核对待处理终态观测 |
| #195 | deadline 到期先移除手动需求，导致超时结果不能发布 | 手动需求仍存在时记录失败超时，保留执行诊断／错误观测；明确释放／取消及过时身份继续受原边界约束 |
| #196 | 明确目标的 `profile_conflict` 拒绝进入保存结果未知保护 | 与 `configuration_conflict` 共享冲突分类；普通 Save 打开同目标变更审阅，保留草稿／历史及胜出方已保存字节 |

修复复用既有 runtime、来源任务、配置事务和编辑器边界。不推断缺失 token 覆盖、不强制结束旧 turn、不新增提供商或授予来源执行权限。其他方案错误保持既有分类。写入结果不明确时仍须只读核对已保存状态；重试不能绕过修订、归属或恢复检查。

Runtime 按已观测结束时间处理保留的终态观测，即使一起送达，也保留代理先结束、主线程随后收尾的顺序。迟到批次不能虚构单调时钟证据；无法证明的活跃时间区间继续以异常时钟原因保持不可用。

来源结果落定区分执行 deadline 与明确撤回需求。已经超时的工作不启动，也不能虚构命令结果、退出状态或测得时长。被后续任务取代的旧任务可以保留自身终态诊断，但不能覆盖新任务观测。

自动反馈同样区分过期读取与最终持久化结果。既有暂记超时保留孤立任务的重试／退避；后续确认成功时，worker 和生命周期对已处理尝试进行幂等核对，清除错误退避并记录真实完成时间。最终需要暂停的失败更新实际原因，不再次增加失败计数或改变已设重试时间。明确取消和租约丢失保留原有重试计数／时间，不猜测回滚。终态任务已写入、worker 尚未修复反馈即中断时，生命周期也能恢复核对；当前策略／身份及较新任务保护仍必需。成功反馈修复必须已有失败或暂停反馈；手动 JSON 刷新成功后，仅 `observed_at` 与 `execution.finished_at` 不同，不得改变已记录的 `last_success` 或已设的 `next`。同一来源修订上的显式自动审阅重置必须保留；历史任务或仍在落定任务的迟到反馈，不能恢复旧暂停或改变本次重置设置的派发时刻。

显示 schema 17、编辑器协议 31、来源注册表 3／任务 4、来源观测 1、runtime 3、生命周期 4、portable／方案 1、界面偏好 1 保持原格式。旧文件可读取，读取不迁移。更新已安装 runtime 集成后须重启 Claude Code；不完整历史观测保留原始证据。

Native 完整编辑状态仍留在宿主。props、外层 Pane 和 Client 绘制分别保留 48,000 字符、10,000 值及深度 16 的预检，包含非 ASCII 转义膨胀。同目标冲突审阅使用有界可见帧，保留 32×12 操作、翻页、选中内容、完整字素和预览颜色。恢复视图留在被拒绝的 Client 树之外，区分保存成功、等待及未知结果。参见[共同设计约定](development-plan.zh-CN.md#design-rules)和[容量／恢复](native-capacity.zh-CN.md)。

## 必需验收

- Runtime 生产端／消费端回归覆盖无代理、单代理、嵌套与并行代理回合、主线程继续、乱序／重放及缺失／含糊证据。断言每个实际回合具有正确的唯一生命周期身份及真实覆盖；仅 token 数值相加正确并不足够。
- 安装包来源回归覆盖成功命令、250／1000 毫秒对较长命令的超时、等待及 `--no-wait` 消费者、明确取消／释放、手动／自动需求重叠、来源编辑及迟到结果。断言终态／原因、执行诊断、保留观测及工作已终止。调度回归还覆盖暂记超时后的持久化成功／暂停、反馈写入中断、重复 tick、孤立任务重试及过时 worker。
- 双编辑器回归覆盖明确用户／方案／项目目标的并发修改、直接冲突审阅、审阅读取失败、草稿／历史和胜出方字节保留、审核后重试／重载／导出，以及真实未知保存核对和正常关闭／取消。Native 检查保留容量适配及宿主侧恢复。
- 规范生成源变化时执行生成／检查，执行 `npm run check`、文档检查及 `git diff --check`。最终 ready PR 产品验收保留八安装目标、32 项 Node、十六个固定宿主、全部既有 313 项容量案例及十二语言就绪，包括 144 组界面／输出组合。main／tag 晋级须核验原始不可变源码与证据；本机诊断不能替代。

已批准的真实会话补充在实际交互式 Claude 宿主使用已安装候选字节：无代理对照、单代理及两个后台代理加主线程收尾。将观测生命周期身份和完整 prompt 汇总与独立请求／transcript 用量比较，核验序号连续性，并确认结束后的计时在后续渲染中冻结。权限／等待／费用是否可用仍取决于实际证据。固定 Claude 2.1.296 的历史 SDK 验收脚本不能证明交互式 2.1.314 验收。

全部付费尝试和重试共享本任务总额 10 美元授权：发布前检查预留 8 美元，发布后本机检查预留 2 美元，每个场景最多 2 美元。每次请求前先预留有依据的最坏情况上界，再按已核验用量和保守定价计算已知费用上界。TLS 失败或最终费用未知时保留保守预留；维护者授权无需再次确认即可继续，但预算门必须保证已知费用、全部未结预留及下一请求合计仍在总预算内。原始 prompt、响应、设置、捕获和预算记录留在私有、忽略的验证目录。报告标明源码／产物／宿主身份，区分自动 PTY／代理检查与人工桌面或物理验收。

## 发布与本机验证

[版本决策](../releases/approvals/v3.16.1.json)只接受同一组 [#96 六项既有缺口](https://github.com/fbincon/claude-code-statusline/issues/96)，它们仍未验证，不豁免新的自动化失败。最终 PR／main／tag 门禁、可重现独立／源码重建、完整语言就绪及四项交付文件通过后，遵循[发布流程](../RELEASING.zh-CN.md)。通过 npm OIDC 和 GitHub 发布同字节软件包，核验公开下载／签名，再以明确 refs 同步已验证 Gitee 引用和同字节附件。

发布前使用不可变候选预演变更旅程。发布后升级并检查实际测试安装和已配置状态栏，恢复原有用户偏好且保留产品升级，独立记录实际结果。发布完成后本机若发现新的产品问题，保留 v3.16.1 并提 issue，本任务不补发其他修补版。

v3.16.0 及更早记录保留原始源码身份、结果和限制。

## 本机验收与真实交互会话

最终源码 `d652eda833d97c594abbf17929e347bf77395af2`、安装包 SHA256 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c` 通过本机完整仓库检查：**1,578 项通过、六项既有平台案例跳过、零失败**。生成检查核验 118 项资源，文档检查核验 4,416 个链接且零错误。最终 PR 运行 [41180416268](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268) 单独标识，其第 2 次尝试及 Complete candidate evidence 门禁通过，已验证覆盖及 main／tag 晋级记录如下。

已安装最终候选通过**六项真实 CLI 来源旅程**：快速成功、250 毫秒超时、1000 毫秒超时、`--no-wait` 超时、同一修订先成功后超时，以及明确取消并终止命令进程树。超时保留真实终态原因及可用执行诊断；先成功后超时保留原值 `42` 与原成功观测时间。未启动工作不虚构命令、退出状态或执行时长。

独立安装包补充通过**六项真实命令／租约旅程**：自然超时保留原成功值；释放手动兴趣保留自动工作；关闭自动兴趣保留手动工作；明确关闭租约取消；真实 15 秒租约到期在 22 秒命令期限前取消；无租约时释放最后手动兴趣取消。它直接驱动已安装 `AutomaticRefresh.lifecycle`，使用受控 session ID、真实 `Date.now`、真实 provider 和命令进程，不宣称官方宿主集成。

已安装调度补充通过**两项确定性旅程**：暂定超时后确认成功幂等修复反馈；手动 JSON 观测保留原到期时间并在到期后自动派发。该补充注入时钟及 worker 启动捕获，保留已安装命令 provider／进程适配器，不宣称真实时间或宿主集成。来源回执合计证明全部 **30 个已观测 worker／父／子进程身份退出**。每个 fixture 前后 1,091 项清单文件一致，断言涉及的 claim 已移除，平台适配器删除自有临时目录／安装。来源检查零模型／官方宿主调用，未修改真实用户配置。

最终已安装编辑器报告通过**两项真实 PTY 旅程**：外部对外部，以及 Native 对外部胜出方。每项证明恰好一次确定拒绝 apply、普通冲突审阅、保留草稿及撤销／重做、胜出文件未变、正常关闭与终端恢复。这些是自动真实 PTY 加终端单元重建，不是物理或人工验收；模型请求为零。

较早实际宿主本机容量执行保留原回执及源码输入身份：Claude 2.1.314 上七个入口 **313/313 案例通过**，零模型调用，回执 SHA256 `c01577bd332b9c9deef28515da0349accf5aee60670f49b9c44d61953bbf9c4c`。不将其重命名为最终源码的新执行。最终 PR 证据已建立当前源码在十六个固定宿主上的每宿主 313 项覆盖，共 5,008 次案例执行；它与这一较早本机补充分开标识。较早 Native 和 runtime 诊断仍独立保留为历史补充。

| 安装包回执 | 报告 SHA256 | Driver／采集器 SHA256 |
| --- | --- | --- |
| `source-cli-installed-02/report.json` | `15bc8c61f4a8e74f0c889723c28880570c0c37d490d4cd284903b567df046f28` | `e5a886b4eb111b5552186a6035a4577ce0ad6957de00de03d2eced132ae79280` |
| `source-lease-installed-02/report.json` | `8df7bf37f00fb706776a35e333755a609c1d230d673829f95cba6c56cb23f98d` | `1bf1be3cc37ceb711fb6fe071c91ead32cbd541c555e7d590e206390850f0ba1` |
| `automatic-projected-settlement-probe-02/report.json` | `791f4ee1e0ab1c6f05c70ed23189a8c88910825922847cc8ddbdca52b5c65bb3` | `a165e7b6abfecc50fd1a042f9bafc0b5765588a0ed811db6e3460bc8d5791ef1` |
| `issue-196-candidate-02-installed-01/report.json` | `5bb7283814ba8126684cc940f4ab061ed755bde9e57436e7d11b02a7c9ddb824` | `14876def47877a6c5d0734414efc872298f43410a1d1dc39c244c3a0dce04010` |

四次最终候选真实交互式 Claude 2.1.314 会话通过，合计 **21 次已验收 API 请求、含缓存输入 97,509 tokens、输出 2,287 tokens**。对照、前台及后台回执位于 `paid/candidate-02`；通过的并行回执位于 `paid/candidate-02-parallel-native-01`。各 fixture 的预算作用域绑定准确最终源码及安装包。API／native／去重 transcript assistant 用量逐请求完全匹配；每个 prompt 覆盖完整，没有虚假主回合，native 任务在 transcript 核对前完成。启动证据独立核验真实同步／异步结果、后台时间区间重叠和代理完成后的主线程收尾。

| 场景 | 代理 | Turn | 请求 | 含缓存输入 | 输出 | 观测序列 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 无代理对照 | 0 | 1 | 1 | 5,300 | 67 | 0–11 |
| 前台代理 | 1 | 2 | 5 | 20,957 | 459 | 0–43 |
| 后台代理与主线程收尾 | 1 | 3 | 6 | 29,275 | 807 | 0–51 |
| 两个时间重叠的后台代理与主线程收尾 | 2 | 5 | 9 | 41,977 | 954 | 0–77 |

每项随后通过二十次已安装生产渲染重放，**共八十次**，已结束任务时长保持冻结。输入来自实际会话／prompt／transcript／cwd／模型观测，不是前端状态栏输入抓取。这些是渲染器重放；权限／等待／费用可用性和物理／人工验收保留既有证据限制。

任务共享账本的**发布前快照**包含**截至该时点的全部 54 次尝试**，含原 B83 验收及探针。已知费用保守上界为 **0.0745668 美元**；四次未知请求保留 **3.2 美元**，占用总上界 **3.2745668 美元**。这不是提供商账单，也不是仅计最终通过会话的费用。两次较早最终候选并行试验各遇到两次 TLS 连接失败，没有 HTTP 状态／用量，每次 0.8 美元预留全部保留。随后私有可选适配器使用新解析的公共地址、已观测本机接口／源地址，保持 `api.deepseek.com` SNI 和正常证书核验。无认证 TLS 探针及 41 项零模型 harness 测试通过，未改变全局路由。绑定原生接口的并行试验通过，但原默认路由失败的根因仍未证实。不返还或重分类未知预留。后续继续共享同一 10 美元总预算（发布前 8、发布后 2、单场景至多 2），仅在有合理请求上界并保证剩余预算足够时继续未知费用尝试。

原源码 `b83e8ee36b8dec04a8bff6590afc84821120191b`、其 21 次成功请求及 `closure-drafts` 保留为不可变历史证据。自动反馈结算缺陷在发布前发现并修复，较早结果不重命名为最终源码验收。最终本机汇总回执为 `dist/validation/runtime-source-save/prepublication-local-evidence-candidate-02.json`，SHA256 `a1b171fc7a6bf08dd01855fef7167ca97347915c881ea952231b6237e795b6ee`。原始 prompt／响应／设置／transcript／捕获及账本仍为私有忽略文件。
<a id="final-release"></a>

## 源码、自动化门禁与交付

发布源码为 [PR #198](https://github.com/fbincon/claude-code-statusline/pull/198) 的 [`d652eda833d97c594abbf17929e347bf77395af2`](https://github.com/fbincon/claude-code-statusline/commit/d652eda833d97c594abbf17929e347bf77395af2)。发布状态：**已发布；必需发布门禁、公开渠道及本机验收均已核验**；Asia/Shanghai 发布日期：**2026-10-31**。main 合并：`517af2ffd8098084fd7c8e50bbe4a60447408bf5`，第一父提交 `821845127a1673c8133ca411c7d1ab771d0cbf85`。带注释 tag `v3.16.1`：对象 `6e5c7c103da904aea68323459fd1c2cbee1f5a21`，剥离源码 `d652eda833d97c594abbf17929e347bf77395af2`。下方必需门禁、渠道核验及本机结果保留各自原始源码和执行身份。

| 阶段 | 实际结果 |
| --- | --- |
| 最终审阅 PR | [运行 41180416268](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268)：通过，源码 `d652eda833d97c594abbf17929e347bf77395af2` 的第 2 次尝试：[Complete candidate evidence job 124505869413](https://github.com/fbincon/claude-code-statusline/actions/runs/41180416268/job/124505869413)。离线核验将完整记录及 stable readiness 绑定至安装包 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c`。原上传失败与未改源码的重试独立保留。 |
| 完整产品证据封装 | `ts06-acceptance` artifact **13038557370**, ZIP SHA256 `b191b837cd646d1f8f895aeaa9f0b85ff123247d2371b591344c1c1f26b6a599`; complete record SHA256 `1025dacca38e64ed88cf192d54ea390c19ec3159fe22701ae08e1a004ae860b5`; stable acceptance SHA256 `523e481b72ebe60f75ee1249dd5cb6174eed55145f4743436ba4d51a9a5c94b5`；八个安装目标、32 项 Node／runtime、十六个固定宿主；每宿主 313 项容量案例，合计 **5,008 次案例执行**。核验 59 个产物 ZIP、56 处原始执行引用及 66 份回执文件。十二种 A/B 语言全部就绪，每语言 2,311 个键全部接受。既有 #96 六项缺口仍未验证；自动覆盖不代表物理／人工验收。 |
| main 集成 | [已核验运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41190726249)：通过：[汇总 job 124507507393](https://github.com/fbincon/claude-code-statusline/actions/runs/41190726249/job/124507507393)。合并提交 `517af2ffd8098084fd7c8e50bbe4a60447408bf5` 的第一父提交为 `821845127a1673c8133ca411c7d1ab771d0cbf85`，接受的 PR head 为 `d652eda833d97c594abbf17929e347bf77395af2`；由已接受基线 verifier `821845127a1673c8133ca411c7d1ab771d0cbf85` 核验晋级。Ubuntu 24.04、Windows 2025、macOS 15 集成冒烟全部通过，零模型调用，四份原交付文件未变。完整产品覆盖保留原 PR 执行身份。 |
| 带注释 tag 晋级 | [已核验运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41191260106)：通过：[汇总 job 124508906147](https://github.com/fbincon/claude-code-statusline/actions/runs/41191260106/job/124508906147)。附注对象 `6e5c7c103da904aea68323459fd1c2cbee1f5a21` 剥离至接受源码 `d652eda833d97c594abbf17929e347bf77395af2`，可由已验证 main `517af2ffd8098084fd7c8e50bbe4a60447408bf5` 到达。tag 晋级核验原完整 PR 证据、main 集成记录及四份未变交付文件；复用执行不重命名为新完整矩阵。 |
| npm OIDC dry-run | [已核验运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41192088337)：通过：prepare job 124510770214 成功，publish 跳过。已核验 stable 发布计划及四份原交付文件，绑定源码 d652 与安装包 71e714…（bundle 产物 13039256353）。dry-run 准备不构成 npm 认证或发布证明。 |
| 新版本 npm 发布 | [已核验运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41192497985)：第 1 次尝试中 npm 接受了新 3.16.1 包并签发 provenance，随后公开可见性有界等待失败，未写出规范 npm-publication.json。唯一一次只核验重试在第 2 次尝试通过（job 124513862699），结果为 already-published、oidc_verified:false。重试不构成新的 OIDC 证明；已核验的签名 SLSA 关联原始运行 41192497985/attempts/1；action `new publish accepted + signed SLSA 41192497985/attempts/1; visibility wait failed; canonical JSON absent; verification retry: already-published, oidc_verified:false` |
| 公开下载与签名 | [已核验运行](https://github.com/fbincon/claude-code-statusline/actions/runs/41193375548)：自动 release 运行第 1 次尝试通过：Ubuntu 24.04／Windows 2025／macOS 15 × Node 22.x／24.x 的六项下载／安装 job，加签名 job，七项全部通过，零跳过、零失败。七个产物 ZIP 摘要均已核对。矩阵实际运行时为 22.23.4、24.22.2；固定 3.16.1 与 latest 安装均从空缓存开始且禁用生命周期脚本。每份回执绑定 d652 及原包字节；签名回执保留原 npm 调用身份，不重命名为后续无操作重试。 |

最终 PR 候选产物为运行 **41180416268** 的 **13034786536**，ZIP SHA256 `d1a27c7221f8aa808bc44d4afcc61df55ae676ad44f85aa05b7d4f4fbaec36d0`。其四项交付文件与两次独立 Git 构建及源码重建逐字节相同。较早 `candidate-02-ci-comparison.json` 字节比较回执保留 `acceptance_complete: false` 及其原身份；之后的完整 PR 证据与离线 stable readiness 核验独立建立最终汇总门禁通过。实际发布的是这些已核验字节。源码重建 TLS 失败保留为失败的环境尝试，随后成功源码重建独立标识。

| 交付文件 | 字节 | SHA256 | GitHub 附件 | Gitee 附件 |
| --- | ---: | --- | --- | --- |
| `fbincon-claude-code-statusline-3.16.1.tgz` | 5,150,828 | `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c` | [ID 695034502](https://github.com/fbincon/claude-code-statusline/releases/download/v3.16.1/fbincon-claude-code-statusline-3.16.1.tgz) | [ID 3552168](https://gitee.com/fbincon/claude-code-statusline/releases/download/v3.16.1/fbincon-claude-code-statusline-3.16.1.tgz) |
| `claude-code-statusline-3.16.1-source.tar.gz` | 36,605,571 | `a398f33fdc0d39191331804174cefd79196d2804f4c3708e08e4ca1749362825` | [ID 695034501](https://github.com/fbincon/claude-code-statusline/releases/download/v3.16.1/claude-code-statusline-3.16.1-source.tar.gz) | [ID 3552169](https://gitee.com/fbincon/claude-code-statusline/releases/download/v3.16.1/claude-code-statusline-3.16.1-source.tar.gz) |
| `build-manifest.json` | 955 | `e1860bd0b830fd5ac7a4a9beb5a6f7169bc3093b061be5c5e50bb50e453ea867` | [ID 695034504](https://github.com/fbincon/claude-code-statusline/releases/download/v3.16.1/build-manifest.json) | [ID 3552170](https://gitee.com/fbincon/claude-code-statusline/releases/download/v3.16.1/build-manifest.json) |
| `SHA256SUMS` | 304 | `ef3e6a53dd708c87681c59196afb7aa1daf62bc36c03587f01d0e3f4c9d0cc8f` | [ID 695034505](https://github.com/fbincon/claude-code-statusline/releases/download/v3.16.1/SHA256SUMS) | [ID 3552171](https://gitee.com/fbincon/claude-code-statusline/releases/download/v3.16.1/SHA256SUMS) |

GitHub stable／Latest 发布：[v3.16.1](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.1)，ID 429859067；发布于 2026-10-31T10:35:24Z（Asia/Shanghai 2026-10-31 18:35:24）。公开 stable／Latest，immutable=true、draft=false、prerelease=false。新读取的 Latest 仍为此 Release；四附件摘要均匹配原交付。npm 公开准确版本／选择器／字节及 provenance 核验：通过：公开 registry 中的 3.16.1 TGZ 为 5,150,828 字节，SHA256 为 71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c；SHA512 integrity 与无脏修改的 d652 清单均匹配原 CI 产物。registry trustedPublisher 为 GitHub Actions。固定 verifier 的签名检查通过两份签名及两份 attestation，范围为已签名外层 tarball 和全部捆绑公共上游依赖。SLSA 指向 .github/workflows/npm-publish.yml、refs/tags/v3.16.1、d652 及原始调用 41192497985/attempts/1。latest 为 3.16.1；相较发布前 registry 快照，beta 保持 3.0.0-beta.1。`latest`：`3.16.1`；保留的 `beta`：`3.0.0-beta.1`。Gitee 公开 Release：[v3.16.1](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.1), ID 1260054。明确已验证 main／tag 引用及匿名四附件字节核验：v3.16.1 发布时的引用快照：已核验 origin／Gitee 的 main 均为 `517af2ffd8098084fd7c8e50bbe4a60447408bf5`，附注 tag 对象均为 `6e5c7c103da904aea68323459fd1c2cbee1f5a21`，剥离至发布源码 `d652eda833d97c594abbf17929e347bf77395af2`。stable Release 1260054 指向 d652；API 正文回读与按实际元数据生成的平台说明完全一致。四份手动附件匿名下载均匹配 tag 交付、candidate02 及 GitHub 字节，证明 SHA256 为 964d8deed3aefb2b9b45e8bd5a77f84618520944d973ae520f421fc8441ba5af。两份自动源码归档不计入这四项。含糊或失败尝试保留独立历史：

- **已被替代的 B83 源码。** PR 运行 41168202931 的 Windows ARM／Node 22.0.0 job 124441167592 最初达到安装套件 55 分钟汇总上限而失败，没有产品断言失败。整个运行仍活动时的一次早期重跑请求被拒绝；之后只实际执行一次未改 head 的重试（job 124463172951）并通过。B83 源码身份及原失败尝试独立保留，不作为最终 d652 验收。

- **交付源码重建。** candidate02 的 source-rebuild-02 尝试因 registry.npmjs.org TLS ECONNRESET 停止，模型调用为零。之后 source-rebuild-03 完成两轮，四份文件均与 candidate02 逐字节一致。原失败日志保留。

- **最终源 PR 与晋级。** d652 运行 41180416268 第 1 次尝试中，macOS Intel／Node 22.x job 124477485935 产品步骤通过（安装 28、隔离 808、串行 133 项通过，串行保留三项既有跳过），但必需上传找到四个文件后，ArtifactService/CreateArtifact 连续五次超时而失败。只执行一次保留 head／输入／断言／期限的重试，第 2 次尝试中 job 124501084085 与最终门禁 124505869413 通过。main 41190726249、tag 41191260106 及公开下载 41193375548 的七项 job 均在第 1 次尝试通过。原失败保留真实执行身份。

- **发布前付费传输诊断。** 两次失败的默认路由并行试验保留四次 TLS 连接失败请求，以及四项各 0.80 美元的未知费用预留（合计 3.20 美元）。之后的原生接口试验使用新解析 DNS 和正常证书验证并通过；成功不会退回这些预留，也不能证明全局 TLS 根因。最终预算及后续发现仍由独立字段记录。

- **npm 接受发布后，可见性核验失败。** 运行 41192497985 第 1 次尝试于 10:24:31Z 接受新包并发布签名 provenance，随后在 10:27:27Z 达到公开可见性有界等待期限而失败，未生成规范 npm-publication.json。10:29:18Z 的只读 registry 检查已发现准确公开包、GitHub trusted publisher 与匹配 SLSA。唯一一次针对失败 job 的只核验重试于 10:32:32Z 通过，结果为 already-published、oidc_verified:false，没有再次发布或认证。新版本签名／provenance 证据关联原始 /attempts/1 调用；不合成 action=published JSON。

- **Gitee 匿名下载。** 首次两项大文件读取已返回 HTTP 200 且 TLS 有效，但达到 90 秒传输上限而超时，部分字节保留；同一路由的两项小文件通过。之后重新解析 DNS、绑定当前原生接口，在正常证书验证下完成两项大文件，四份手动文件均匹配原交付；两份自动源码归档不计入。上述传输结果不构成 TLS 根因或产品缺陷结论。

## 已发布安装的本机验证

历史 `machine/baseline-01` 核验了源码 `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0` 的原 3.16.0 安装、所属已配置渲染命令、安装清单及兼容 doctor／包状态。其十一处偏好按字节／权限／缺失状态的私有快照作为历史保留，绝不覆盖。受支持升级之前，**machine/baseline-final-d652-01** 新建了绑定最终源码 `d652eda833d97c594abbf17929e347bf77395af2` 和已核验公开包的快照。比较覆盖全部十一路径，并保留用户在此期间对全局 `.claude.json` 的修改。恢复仅使用这份新快照，保留所属 backendVersion 升级至 3.16.1。实际升级、渲染、编辑器、恢复与付费探测结果在下方分别记录。

| 已发布本机操作 | 实际结果 |
| --- | --- |
| 受支持的准确版本升级 | 通过：受支持升级 3.16.0 → 3.16.1；事务 `pkg-c423572d-7d9d-42bc-8dcf-141ee7156eb7` 完成，安装包与集成均核验通过。新建十一路径快照及紧邻升级前的字节／权限／缺失核对通过；最终源码 `d652eda833d97c594abbf17929e347bf77395af2`。 |
| 公开产物／安装清单／doctor | 通过：升级后与最终清单均准确包含 1,092 个文件，全部逐字节匹配已核验公开包 SHA256 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c`。初次／最终 doctor 退出码均为 0，有限临时探针已移除。Node 24.21.0、Claude 2.1.314。 |
| 已配置状态栏命令及字面参数渲染 | 通过：初次与最终检查按字面参数运行准确的所属已配置渲染命令。每次另通过 12 语言 × 3 宽度 × 主线程／子代理 = 72 项 fixture，共 144 次案例执行；十一路径偏好未变。输入为生产渲染管线的样例，并非前端状态栏输入抓取。 |
| 外部编辑器／Native 编辑器 | 通过：external-after-02 3/3、默认路径 native-after-03 3/3 真实 PTY 取消／保存／恢复旅程，覆盖十二界面语言且正常恢复终端。三个新 Native 会话的 API 请求日志均为零。两编辑器及命令后代使用无出站路由的网络命名空间；外部命令来源尝试次数未插桩。较早采集器拒绝及中断的 Native 尝试保留为失败历史，经独立审核后恢复，未修改产品。 |
| 十一路径原始偏好恢复 | 通过：新升级前快照的全部十一路径恢复原字节、权限及缺失状态，仅保留所属 backendVersion 升级。保留了历史 baseline-01 后用户对全局 .claude.json 的变化。全清单严格保护覆盖明确的界面／输出语言及精确宿主生命周期／窗格写入；最终 guard 为 idle，没有待决转换或活动会话。两份原阻止日志未变，没有接受未分类状态。 |
| 保留所属 backendVersion 及产品升级 | 通过：已安装公开产品保留 3.16.1，源码 `d652eda833d97c594abbf17929e347bf77395af2`，1,092 个已核验文件未变；所属 Native backendVersion 保留 3.16.1，已配置渲染命令保留。原偏好通过新快照恢复；物理／人工验收仍未验证。 |
| 发布后付费请求与证据 | 实际安装的公开 **3.16.1**、Claude **2.1.314**、源码 `d652eda833d97c594abbf17929e347bf77395af2`、包 SHA-256 `71e714f72b436acf6b24b78461b314dea12c01dc9ee00a7033a5c393bf7f891c`：一个并行用例通过，包含**两个执行区间重叠的异步代理**、**9 次请求**、**41,903 个含缓存输入 / 948 个输出 token**；逐请求 API、Native 与去重转录用量完全一致，**虚假主回合为零**，主代理在收到两个代理报告后结束，随后 **20 次生产渲染重放**计时不再变化。三份转录归档后已删除隔离认证配置，1,091 个载荷文件仍与安装候选清单一致。私有回执 `paid/postpublication-installed-01/final-paid-summary.json`，SHA-256 `23c8b49f8f25cce2e15e1cf63431a4c958002351b2d48a97b498b5a3a0da4040`。这是自动化 PTY 与重放证据，不构成物理或人工验收。 |
| 最终共享预算核算 | 全部 **63 次已结束尝试**的保守费用总上界为 **3.2882753 美元**：已知用量的费用上界估算 **0.0882753 美元**，加上**四次各 0.80 美元的未解决费用预留（共 3.20 美元）**；这些数额不是供应商账单。全部尝试及重试均保留在同一份 10 美元总账中，付费调用已关闭，四项 TLS 预留均未退回或改写为已知费用。 |
| 发布后新产品发现 | 已完成检查未确认新的已发布产品缺陷。两项私有采集器假设及最初产物暂存输入错误仅在忽略的验收工具中修正；失败尝试及分别核验的重跑记录见下文。保留 v3.16.1、附注 tag 及已发布附件，未另发修补版。 |

本机回执身份：`dist/validation/runtime-source-save/machine/final-machine-summary.json`, SHA256 `d825e25ddc95ebc9b940235c62cb8d321176aeafbd9c5a955c82dcf344beb1e9`。本证据通过独立专项文档后续维护，其仓库同步不会改变已发布产品。原始发布源码、tag 对象、公开附件和候选证据保留原身份；之后的文档提交不会被改称为产品验收。

发布后验收分别保留两次私有采集器失败。`machine/external-after/report.json` 因预览样式逐字素拆分而错误拒绝，保留画面已包含生产预览；七项片段回归和五项 continuation 拒绝探针通过后，`external-after-02/report.json` 验证了三条完整旅程。`machine/native-after-02/report.json` 因宿主首次打开面板的记录而停止；宿主日志及精确字节投影确认只有已知 Native 面板条目追加，测试宿主及后端进程均已确认退出。该中断会话仍为失败，不计正常关闭或终端恢复通过。显式面板开启转换仅允许十一路径的准确 before／after 状态，最多十五秒，随后恢复严格 UI 检查；28 项保护／生命周期案例及四项 continuation 拒绝探针通过后，`native-after-03/report.json` 验证了三条完整正常关闭旅程。两套原始阻断 journal／拒绝记录均未改变，每次重跑前均先恢复准确记录的测试改动。最初公开产物暂存预检还要求相邻三项交付文件；暂存已核验四文件资料后解决了这个辅助脚本输入错误。这些修正仅位于忽略的验收工具中，已发布产品字节保持不变。

同一组 #96 六项缺口继续被接受且**未验证**，不豁免新的自动化失败。实际宿主测试、自动 PTY、渲染重放和代理检查与人工桌面／物理验收继续分开。发布完成后的新问题仅提 issue，保留 v3.16.1、tag 和附件，本次交付不再补发其他修补版。


[发布说明](../releases/v3.16.1.zh-CN.md) · [来源行为](../EXTENSIONS.zh-CN.md) · [草稿冲突审阅](../DRAFT_HISTORY.zh-CN.md) · [运行契约](live.zh-CN.md)。
