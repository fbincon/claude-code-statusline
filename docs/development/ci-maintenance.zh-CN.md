# CI 维护与 Actions 身份

[English](ci-maintenance.md) | **简体中文**

当前 Native 容量与恢复采用有界可见帧，并新增三平台 Claude 2.1.310 门禁；详见[实现与验收](native-capacity.zh-CN.md)。

## CI 耗时与稳定性优化

### 候选包在 PR、main 与 tag 之间晋级

待审查产品 PR 执行一次完整验收。常规双父 merge commit 合入 main 后，当最终验收的 PR head／base 与实际合并父提交一致、完整 Git tree 相同时复用候选包。实际第一父提交的最新 main 运行及必需汇总门禁必须通过。批量推送的较早起点只要是该父提交的祖先即可，不代替实际合并 base。main 在 Linux、Windows、macOS 上安装原包，执行版本、安装、doctor、渲染、带 revision 的配置读写及卸载冒烟；三个独立任务记录实际集成提交和原始源码／包，可以分别重试。

`policyDigest` 继续将证据绑定到其不可变源码中的可执行规则，保留原有路径选择及历史解释。**与旧 main 的摘要不同不再触发完整矩阵。** 产品、生成资源、批准数据、新验收步骤、截图、CI 观察、发布说明、构建工具、工作流、发布校验及验收依赖变化都采用相同的内容／来源判断，不增加工具、目录或版本豁免名单。

### 路由表与阻断条件

| 事件或已核验条件 | 路由与检查 | 原因／限制 |
| --- | --- | --- |
| 白名单内纯文档 PR 或 main push | 文档检查及必需汇总门禁 | 不产生候选包／发布证据 |
| 草稿产品 PR | 快速本地检查；必需汇总门禁失败 | 不属于最终验收 |
| 待审查产品 PR | 完整 8 安装／32 运行时／16 宿主矩阵及适用的 197 项容量检查 | scope 预测未来合并路由，前提是本次最终运行通过 |
| 本仓库双父 main 合并，验收 head／base 与完整 tree 一致 | 复用原 PR 矩阵；三个冒烟、不可变 base 校验器、晋级专项回归及汇总门禁 | 包含可执行策略与工作流变化 |
| 包含上述合并的批量推送 | push 起点为祖先且实际第一父提交门禁通过时采用同一复用路径 | 中间 base 未验证或 push 范围未知／无关时阻断 |
| PR 已完整验收，但实际合并 tree、head 或验收 base 不同 | 在实际集成提交执行完整 main | 该集成源码／关系尚未完整验收 |
| squash、rebase、直接／非双父集成，或没有唯一的本仓库 merge PR | 完整 main；本仓库 PR 来源有歧义则阻断 | 仅 tree 相同不足以证明原始源提交可达性、编译输出恢复及 tag/npm 身份 |
| 源码确实早于证据封套，或 base 早于独立校验器 | 完整 main 引导 | 协议能力不存在与已有协议缺失证据是不同情况 |
| 最新适用 PR／base／main 运行失败、取消、未完成，或必需汇总门禁未成功 | 阻断 | 不改选旧绿色记录，不以自动全量回退掩盖 |
| 受支持证据缺失、过期、损坏、不匹配、有歧义，批准无效，或独立校验失败 | 阻断 | 修复原因或显式设计协议迁移；重复新校验器不构成独立证明 |
| 手动 `validation=full` | 主动完整验证；`Manual validation (not PR evidence)` | 不生成可晋级的 `ci-evidence.json`，输出为 `ci-manual-acceptance` |
| main 上手动 `validation=promotion-shadow` | 独立复核复用、三个冒烟及晋级契约 | 只生成诊断 main 回执，不执行完整矩阵，不作为 PR/tag/npm 证据 |
| 其他手动 probe | 具名隔离诊断 | 不能满足 PR 或发布验收 |
| tag 指向已验收源提交且 main 集成通过，或同提交完整 main 通过 | 核验原始源码、字节、完整回执、批准、tag 及 main 祖先关系 | 现代适用证据缺失时阻断；仅真正旧源码保留完整 tag 验收 |

scope 日志和任务摘要输出实际路由／模式／原因、源 PR／run／commit、已验收第一父提交／run、原始封套与附件 ID、四个交付文件摘要及变更路径。PR scope 预测最新 base 上的 merge commit 是否可复用，但预测不是验收，不能保证后续附件可用或合并／base 不变。main 重新核验全部动态条件；路径变化只用于解释，不参与复用判定。

### 独立校验与 main/tag 专项义务

每次复用晋级都从**实际且已经通过验收的第一父提交**导出校验器 TypeScript blob 到隔离临时目录，加载该父提交的 `ci-sources`、`ci-evidence` 和 `ci-integration` 实现，独立读取最新适用源运行与 base 运行，核验合并／head／base／tree、执行工作流来源、封套、完整覆盖和下载的不可变字节。候选编译输出绝不覆盖这个校验器。当前校验器另向 Actions 核对必需汇总门禁及原始 job ID、名称、时间和 attempt。查询绑定已观察运行的明确 attempt，不使用可变的 latest-jobs 别名；随后重读运行状态／attempt，避免并发重试时借用过时的成功门禁。当前发布检查核验全部当前回执语义及源码绑定批准。三系统集成和路由／tag／npm／汇总门禁／工作流专项回归覆盖晋级专有行为，无需重复产品矩阵。

信任基础是已经验收的 base 加上对新工作流／驱动代码的审查，不是重复执行相同的新校验器。回归夹具将 HEAD 校验器替换为空实现，确认导出的旧校验器仍拒绝篡改字节和错误 PR；工作流回归要求交叉核验早于编译恢复及晋级。未来不兼容证据格式或覆盖变化须提供显式、经过审查的兼容／迁移检查，失败时阻断，不静默忽略旧校验器。仅 base 完全没有校验器的一次性情形采用表中的引导路径。新 main 回执为 schema 2，记录校验器 commit／tree、base run、原始封套及记录摘要；历史 schema 1 回执继续可读，不改写。

注解发布 tag 通常指向完整验收的 **PR 源提交**，该提交必须经已核验合并在 main 历史中可达。tag 门禁核对该 PR 最新完整运行、成功 main 集成、tag 对象、版本专属批准、源码 tree／策略及全部原始四文件／回执／输入／编译输出摘要。同提交 main → tag 路径继续支持完整 main 后备及旧证据。暂不扩大 squash／rebase：保留双父／head／base 检查，避免把不可达 PR 提交当作发布来源，或用改写后的身份恢复其编译输出。晋级回执区分实际执行与复用覆盖，不重写包内 commit 或原始回执。

完整自动运行继续在 `candidate-acceptance.json` 旁生成 schema v1 的 `ci-evidence.json`，记录源码／工具链／运行时／宿主身份、原始 job attempt 和回执／附件摘要。同名附件按 API 创建时间排序：ID 只用于身份，成功重试可能获得更小 ID。时间缺失或相同导致歧义时阻断；最新附件损坏、过期或失败时不得退回旧成功附件。先前 attempt 的成功执行保留原始 job ID 和时间。恢复可执行编译输出前先校验归档与清单摘要；跨提交恢复另须 tree 相同和源提交可达。

npm 解析器沿 tag 晋级追溯原始完整运行，重新核验证据链并发布同一包字节。源码归档、独立构建、源码重建、草稿附件校验、OIDC 和公开下载验收要求不变。源码／证据附件保留 30 天；刷新时重新完整执行相应原始 PR/main 事件，再核验集成与 tag，手动诊断及无关成功运行不能替代。历史源码身份、已发布包、回执和发布记录均不改写。

### 发布数据与验收策略

逐版本批准登记放在[批准登记表](../releases/approvals/registry.json)，与各版本批准 JSON 放在一起。新增版本时登记版本号、批准路径和精确批准日期，无需修改 `tools/release/approval.ts`。两个数据文件都是绑定源码的发布输入，纳入 Git tree、源码归档和候选包身份；不属于可执行规则，不进入策略摘要。`tools/release/` 可执行文件及未来新增校验器仍纳入摘要；摘要与已验收源码比较，不因旧 main 不同触发矩阵。

`release:prepare` 和晋级从已核验源码归档读取登记与批准，不读取当前 checkout。登记要求唯一稳定版本／路径及有效日历日期；批准必须匹配版本／日期、维护者、权限、引用及精确六项既有缺口。原验收回执记录两个文件的摘要。缺少登记表的历史归档可读取原字面量登记表而不执行源码；新登记表损坏时不得回退。参见[发布准备](../RELEASING.zh-CN.md#绑定源码的-ci-证据晋级)及[分流回归](testing.zh-CN.md#发布批准与-ci-分流)。

### 开发与执行路径

macOS 身份适配器通过既有原生桥接读取 `PROC_PIDTBSDINFO`，校验完整结构和 PID，并保留 C locale／UTC 的 `ps lstart` token，包括个位日期的空格。未知结果仍不可验证，僵尸进程不算存活。ABI 对照 [Apple 定义](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h)，实际 macOS 测试逐字比较 `ps` 的结果。手动 `validation=macos-probe` 在 Intel 和 ARM 上各重复二十次受影响的六语言事务流程，每台 runner 还进行 1,000 次身份比较，仅生成诊断证据。

草稿产品 PR 执行 `Draft quick checks`（完整的本地 Linux 检查命令），但不能通过 `Complete candidate evidence`。创建、同步、重新打开、转为待审查和退回草稿都会重新分类当前 head。待审查产品 PR 要求完整覆盖；白名单文档在分类任务中完成检查，无需构建产品。汇总门禁使用固定 Node 直接执行无外部依赖的检查器。PR 更新取消旧运行；main／tag 按不可变提交分组，避免取消其他修订的证据。

开发检查与两次独立干净构建并行，二者均成功后才执行平台验收。开发任务分发绑定精确提交、锁文件、逐文件及归档摘要的可移植编译输出。消费方自行安装本平台原生依赖，校验后只恢复六个固定编译目录；独立构建不使用此包。平台任务保留全部源码测试，仓库静态生成／文档／归档／清单检查集中执行。普通测试文件使用两个隔离 worker；原生进程与锁、终端、时序及恢复测试保留串行组。未知位置仍执行并默认串行；`STATUSLINE_TEST_WORKERS=1` 用于对照。

Node 选择器每份候选只解析一次。8／32／16 项逻辑责任全部保留：开发运行时与某个 Node 组合完全一致时，安装任务的完整源码测试和原有隔离安装也覆盖该组合。共享回执引用这次实际执行，并要求源码测试回执、可执行文件摘要和源码哈希一致，不算一次新测试。其他运行时保持独立任务。两个真实历史版本流程通过隔离子进程执行，分别拥有 prefix、HOME、配置、缓存、registry 和日志。Windows 顺序执行以避免 npm／复制 fixture 竞争，其他平台并发执行；失败时取消另一个流程，等待退出后再清理。每条既有流程保留独立的 900 秒预算（官方宿主为 1,200 秒）；新增 v3.12 编辑器执行阶段独立使用 900／1,200 秒计时器和回执。发布校验拒绝阶段缺失或超时，外层预算按这些独立责任求和。

手动 `validation=windows-probe` 在 Windows x64 和 ARM 宿主／x64 上运行进程边界回归、同机新旧监督程序测量及真实安装验收，不能生成汇总发布验收。最终完整矩阵还在 Windows Claude 2.1.289、2.1.294 上各重复十次原有 20 秒长场景，保留原测试体、源码摘要、单项耗时与日志，然后执行常规完整宿主测试。 Windows 控制台诊断先执行原有终端策略与外部编辑器场景，用测试专属 Node preload 记录子进程终端字节，同时保留真实控制台句柄。`test:installed -- --diagnostic-pattern REGEX` 保留 PowerShell 准备及所选场景全部断言；回执明确不可晋级，且绝不会标记为完整验收通过。

专项诊断可向包管理命令预加载计时订阅器。产品的 `claude-statusline.management-timing` 诊断通道只报告 npm、复制、归档校验和事务检查点的阶段名与耗时；普通命令无订阅器，协议输出不变。诊断日志与常规冷安装证据分开。registry／cache 通过一次 npm `config list --json` 读取，保留 npm 配置优先级、prefix／root 检查和含凭据地址的拒绝行为（[npm 配置](https://docs.npmjs.com/cli/v10/commands/npm-config/)）。

[Issue #157](https://github.com/fbincon/claude-code-statusline/issues/157) 跟踪分阶段优化。完整候选覆盖仍为 8 安装目标、32 运行时、16 官方宿主及适用的 197 项 Native 容量检查。普通交付执行一轮完整候选矩阵，再进行 main 集成和 tag 核验；仅路由表中的未验收集成／协议引导情况保留完整后备路径。

候选准备只下载一次不可变的 3.7.0、3.8.0 历史包，验证固定 SHA-256 后通过独立的 `ci-historical-inputs` 附件分发。缓存键包含两个不可变摘要，不使用回退键，也不保存测试结果；恢复的文件使用前重新计算摘要。消费方使用已有 `TS06_LEGACY_370_ARTIFACT`／`TS06_LEGACY_380_ARTIFACT` 输入并独立复核字节。候选安装继续在仓库外使用空缓存、离线 npm 和禁用生命周期脚本；本地未提供历史包时也使用同一个下载器。

历史包缓存使用 [actions/cache v4.3.0](https://github.com/actions/cache/tree/v4.3.0)，固定提交为 `0057852bfaa89a56745cba8c7296529d2fc39830`。Node 版本索引采用相同的有界临时故障重试策略，记录索引摘要及解析时间；矩阵消费方不再各自解析版本选择器。

下载最多尝试三次，仅对适用的临时连接错误和 HTTP 408／429／500／502／503／504 进行一秒、两秒退避。摘要不符、非法 gzip、内容超限、权限错误和重试耗尽均失败。日志记录版本、固定 URL、阶段、次数和耗时，不记录凭据。官方宿主回执保存有界、脱敏的成功与失败命令日志、阶段耗时和运行身份。候选包及验收附件明确保留 30 天；压缩包上传避免重复压缩。

使用 `npm run ci:watch -- --run RUN_ID --head FULL_SHA --watch --report dist/validation/ci/RUN_ID.json` 确定性跟踪运行。本地使用已有认证的 `gh` 账户，CI 使用 Actions token；不输出 token，也不修改 GitHub。程序按 15／30／60 秒退避轮询固定运行和当前任务进度，仅输出变化状态及失败步骤摘要，完成时分页收集全部 attempt／步骤耗时。收集期间启动的重跑不会误报为先前成功。报告区分排队、执行和 attempt。退出码 0 表示成功完成、1 表示 CI 失败、2 表示观察未完成；观察到期不取消 CI。不得将沿用的成功任务计作新执行样本。

真实 Git 仓库测试属于资源敏感用例并保留串行：Windows 诊断发现双 worker 并发下出现观测缺失及子进程超时。`validation=windows-source-probe` 在受影响的 Windows x64／ARM 和 Node 组合上执行原运行时测试及十次独立 Git 测试，不生成候选或发布验收。

手动运行使用独立汇总名称 `Manual validation (not PR evidence)`，包括有意跳过的诊断门禁，避免成功或 skipped 的诊断状态覆盖 PR 必需检查。

### Issue #157 的实测交付记录

下列完整运行均保留 8/32/16 覆盖及适用的 197 项 Native 检查。总耗时包含排队与重跑间隔；累计任务分钟统计实际执行，包含失败执行，但排除 GitHub 在后续 attempt 中复制、执行时间戳不变的成功任务。最长排队和最长执行是分别统计的单任务最大值，可能来自不同任务，不能据此直接从总耗时中相减。

| 完整运行 | 总耗时 | 最长任务排队 | 最长任务执行 | 累计任务分钟 | macOS 分钟 | 重跑次数 |
| --- | --- | --- | --- | ---: | ---: | ---: |
| [基线 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40336709149) | 56m40s | 38m14s | 32m31s | 598.35 | 221.43 | 0 |
| [基线 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40346292097) | 67m23s | 39m46s | 34m28s | 626.33 | 235.07 | 1 |
| [基线 tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40357902282) | 73m28s | 45m17s | 33m59s | 636.23 | 236.50 | 1 |
| [第二阶段最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40402431203) | 41m53s | 34m28s | 21m17s | 459.37 | 161.97 | 0 |
| [第二阶段 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40408875074) | 66m53s | 57m58s | 20m27s | 473.70 | 174.80 | 0 |
| [阶段 A 最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40409378646) | 70m55s | 62m45s | 19m47s | 462.07 | 170.42 | 0 |

第二阶段最终 PR 相比基线 PR，总耗时减少 26.1%，累计任务分钟减少 23.2%，macOS 分钟减少 26.9%。随后两轮交付验收同时运行、共享托管 runner 配额，更长排队掩盖了执行工作量的降低。这些是具名实测结果，不是延迟保证或受控基准。该历史交付当时对启用策略变化执行完整 PR/main 矩阵。当前路由表已取代这种自动联动；现在等价集成即使改变策略也复用原验收。新 tag 触发与真实 npm/OIDC provenance 留待下一次正式发布记录；本次维护不创建版本或测试 tag。

稳定性证据包括 [Windows x64/ARM 宿主安装诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40392875032)：两轮诊断中的同机监督进程启动中位数降低 68–76%，该比例仅描述启动耗时。[macOS Intel/ARM 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40395043483) 各通过 1,000 次身份比较和 20 次相关事务流程。第二阶段最终 PR 中，Windows Claude 2.1.289、2.1.294 各通过十次原长场景重复；最大耗时为 4.079 秒／2.434 秒，距未改变的 20 秒超时最少仍有 15.921 秒／17.566 秒余量。

失败历史继续保留。[第二阶段较早的完整运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40397874104) 在双 worker 调度下出现四个 Windows Git 测试时序失败后取消。将这些资源敏感测试放回串行组，保留全部断言和超时；[四种相关 Windows/Node 组合](https://github.com/fbincon/claude-code-statusline/actions/runs/40401253349) 随后通过完整运行时套件和十次 Git 套件直接重复，再通过最终完整验收。[真实草稿运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40401259200) 的快检成功、必需汇总检查失败；ready/converted/synchronize 转换和取消也已实际执行。取消或诊断运行不计为完整验收；issue #96 既有六项缺口仍未验证。

随后，[阶段 A main 的 macOS 26 / Node 22.x 任务](https://github.com/fbincon/claude-code-statusline/actions/runs/40418420063/job/121907456214) 暴露了历史版本命令提前关闭 stdin 时未处理的 `EPIPE`。验收 worker 现在先注册管道错误处理再写入：成功仍由退出码与命令输出断言决定，其他流错误会失败并终止命令。真实子进程回归覆盖提前关闭后的成功／失败退出码、Unicode 输入完整性和其他流错误，并在每个运行时源码套件中串行执行。[当时运行中的阶段 B PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40418703438) 因这次修复取消，不计入上表的成功运行。

[下一轮阶段 B 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40421822049) 暴露了该新增夹具的 Windows 特有问题：关闭文件描述符 0 并未关闭所有继承的 stdin 句柄，导致夹具握手超时。夹具现改为在有界写入等待期间让真实子进程退出，仍要求观察到管道关闭错误（`EPIPE`，或 Windows 的 `EOF`）、保留原退出码，且不改变超时。[Windows 定向诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/40424220219) 确认了 Windows 的 `EOF` 形式；其他输入错误仍会失败。这些失败／取消运行与成功验收分别保留。

## CI-01 实现

**状态：DONE。** 实施基线：`95206119dab6f931f320277d25889fea8da49528`（2026-10-23）。产品基线保持 v3.6.0；本次维护不创建版本、标签、npm 发布或 Release。

CI-01 固定现有 Actions 主版本，增加离线身份检查，并启用每周 Actions 更新提议。保留现有工作流触发条件、权限、Node／构建版本、平台与宿主矩阵、OIDC 和发布条件。[路线图](roadmap.zh-CN.md#milestones) · [范围与验收](development-plan.zh-CN.md#ci-01)。

## 初始引用清单与来源

四个工作流共有 39 处外部引用：CI 24 处、npm 发布 7 处、公开下载 4 处、历史 Python 参照 4 处。下列精确版本标签已于 2026-10-23 通过官方仓库的 Git 引用 API 解析，均直接指向提交；规划阶段也核对了对应主版本标签。每个 `uses:` 保留精确的 `# vX.Y.Z` 注释。

| 官方 Action 与版本标签 | 完整提交 SHA | 引用数 |
| --- | --- | --- |
| [checkout v4.4.0](https://github.com/actions/checkout/tree/v4.4.0) | `11d5960a326750d5838078e36cf38b85af677262` | 10 |
| [setup-node v4.4.0](https://github.com/actions/setup-node/tree/v4.4.0) | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 13 |
| [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/tree/v4.6.2) | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 9 |
| [download-artifact v4.3.0](https://github.com/actions/download-artifact/tree/v4.3.0) | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | 6 |
| [setup-python v5.6.0](https://github.com/actions/setup-python/tree/v5.6.0) | `a26af69be951a213d495a4c3e4e4022e16d87065` | 1 |

此表保留为首次交付证据，后续更新 PR 单独提供已审查的版本／SHA 来源。固定范围包括工作流直接引用和可达的本地组合 Action；远程 Action 内部依赖仍由上游实现管理。参见 [GitHub 安全使用指引](https://docs.github.com/en/actions/reference/security/secure-use)。

## 本地与 CI 检查

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` 使用固定的仅开发依赖 `yaml` 解析 `.github/workflows/**/*.yml` 和 `.yaml`，检查步骤 Action、任务级可复用工作流及可达本地 Action 清单。外部仓库引用必须使用完整 40 位提交 SHA 与语义版本注释；Docker 步骤必须使用完整 SHA-256 digest。本地 `./` 引用保留相对检出根目录的正常语义，定义必须存在于仓库内，每个本地组合依赖文件检查一次。

检查器支持带引号的键、行内映射、别名和折叠标量，忽略脚本／注释示例；YAML 错误、重复键、无法解析的引用或空工作流清单均失败。诊断包含文件与行号，并以非零状态退出。离线检查验证引用和注释格式，审查者通过官方上游来源核对实际版本与提交的对应关系。

CI scope 任务在变更分类之前执行检查，`npm run check` 在普通测试前执行检查；既有汇总门禁要求 scope 成功。工作流、Dependabot 和工具变更继续要求完整最终 PR 产品矩阵；白名单内的文档与社区模板只运行必要文档校验，不生成发布验收凭据。

### 社区文档检查

轻量路径包含既有 README/CHANGELOG 与 `docs/**/*.md`、根目录的 `AGENTS.md`、根目录的 `SECURITY.md`、`CONTRIBUTING.md` 及其 `.zh-CN.md` 对应文件、`.github/pull_request_template.md`，以及 Issue 模板中的精确路径 `bug_report.yml`、`config.yml` 和旧 `preview-feedback.yml`。保留旧路径以允许替换或删除旧表单。代理指引只新增根目录 `AGENTS.md` 这一精确路径，不为其他指令文件增加通配规则。其他 `.github` 路径以及产品／文档混合变更仍需完整矩阵。未知 Git 修订及可执行文件改名为文档不能进入文档路径；tag 和手动事件采用上面的显式路由表。

`npm run docs:check` 检查 Markdown、单文件双语 PR 模板、Issue 表单 Markdown 内容和入口链接中的本地目标及锚点。根目录政策文件需要独立的英文／中文文件，根目录 `AGENTS.md` 除外：它只维护英文，仍检查链接和锚点；该例外不适用于 `docs/` 下的同名文件。PR 模板和表单在同一文件中包含双语。复用既有仅开发 YAML 解析器，检查表单结构、显式且唯一的字段 ID、必填标志、下拉选项，以及联系入口的名称、HTTP(S) 地址和说明。这是针对本仓库所维护字段的离线检查，不代替 GitHub 渲染；合并后仍应检查实际入口与模板。参见 [GitHub 表单语法](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)。

`Complete candidate evidence` 继续作为唯一汇总检查。轻量路径要求 scope 和文档任务成功、产品任务按设计跳过；完整验收路径要求全部产品任务成功，复用路径要求集成和晋级成功、产品任务按设计跳过。分类器／检查器修改须通过回归、完整最终 PR 验收及路由表规定的 main 核验，包括独立 base 校验。

## 每周更新与审查步骤

[Dependabot 配置](../../.github/dependabot.yml)仅检查 `github-actions`，按 `Asia/Shanghai` 每周一 09:00 调度。次版本／补丁更新归为一组，同时最多保留一个版本更新 PR；忽略主版本更新。PR 面向默认分支，仍需正常审查和 CI。参见 [GitHub 配置参考](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)。首次扫描没有符合条件的新版本时无需产生 PR。

每次自动或手动更新均执行：

1. 阅读官方发布说明，比较固定源码与拟议提交。保留当前主版本；运行时、runner 或权限变化另行评估。
2. 在官方 Action 仓库解析精确版本标签，例如：

   ```bash
   gh api --hostname github.com repos/actions/checkout/git/ref/tags/v4.4.0 \
     --jq '{ref: .ref, type: .object.type, sha: .object.sha}'
   ```

   若对象为附注标签，继续读取 Git 标签对象直到提交；在 PR 中记录完整提交、版本及官方来源，不通过打印 token 获取凭据。
3. 同步更新该 Action 所有位置的 SHA 与精确版本注释。运行 `actions:check`、专项回归、`npm run check` 和空白校验；检查权限、触发条件、矩阵及发布条件的差异。
4. 最终已审查 PR head 的 CI 成功后合并，并验证合并后的 main。相关手动工作流引用变化时运行对应工作流；纯文档证据补充采用正常文档分流。

若更新导致工作流回归，通过 PR 回退该项更新，恢复之前验证的 SHA／注释，再验证受影响工作流；保留既有发布标签与 npm 选择器。本流程不强制更新已发布版本的身份。

## 验证与完成证据

本地验证通过：`actions:check` 检查四个文件、39 处引用且零错误；检查器及分流专项 17 项通过；`npm run check` 的 1,136 项测试中 1,131 项通过、5 项平台相关跳过，生成资源、文档、归档及完整责任清单通过。四个工作流与实施基线的 YAML 结构对比确认，除引用替换及 scope 校验接入外，其余结构一致；`git diff --check` 通过。

[首次 PR 运行](https://github.com/fbincon/claude-code-statusline/actions/runs/39941449719)发现 macOS 14／15 临时目录的 `/var` → `/private/var` 别名会使检查器误判仓库边界。已先解析检出根目录的真实路径，并增加目录别名回归测试；旧运行已取消，修正后的最终 head 随后通过了完整矩阵。

实现 [PR #126](https://github.com/fbincon/claude-code-statusline/pull/126) 已合并。最终审查 head 为 `7888e4af798ec795b90f4b374633e6fa4fb67335`，合并后的实现 main 为 `8a6a081426f463157df308f6ef1d15a15b5901aa`。

最终 head 的首轮执行中，Windows／Claude 2.1.289 的既有原生 Mod 测试报告 128 项通过、1 项失败，具体失败用例不在保留的输出尾部中。整轮结束后，仅重试该任务及依赖它的汇总门禁，提交和断言均未改变；第二次执行的最终结果为 56 项成功、1 项按预期跳过的纯文档任务。失败历史保留在同一运行中，未以 #96 豁免。

main 首轮的 Windows 11 ARM/x64、Node 22.x 出现命令夹具的 15 秒超时；Node 24.0.0 与 24.x 则在调用候选包前，系统 PowerShell 就绪检查触及 60 秒超时（`candidate_invoked=false`）。源码、超时及断言均未修改；第二次执行中，这三个用例及汇总验收全部通过。最终 main 同样为 56 项成功、1 项按预期跳过的纯文档任务。

| 验证 | 结果与证据 |
| --- | --- |
| 最终 PR | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39942651085)：八安装目标、32 项 Node 用例、十三宿主和汇总验收 |
| 实现 main | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946518666)：八安装目标、32 项 Node 用例、十三宿主和汇总验收 |
| 历史 Python 参照 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946731889)：冻结参照与混合运行时恢复 |
| v3.6.0 公开下载 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946736835)：三系统 × Node 22／24 的六项检查 |
| npm dry-run | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946741308)：prepare 成功，publish 按预期跳过 |
| Dependabot 首次扫描 | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946535839)：GitHub 接受并执行 Actions 更新配置 |

所有 main／手动验证使用上面的实现 main。npm dry-run 验证已有发布输入、准备过程和 registry 字节，不申请 npm 发布凭据，也不验证真实 OIDC 发布。本次不创建新版本标签、npm 发布或 Release，既有 v3.6.0 身份保留。

main 与手动验证均已通过。纯文档证据收尾采用正常文档分流，并从仅含已提交文件的检出校验链接；最终 main 在文档门禁通过后，检查分支差异并通过显式 refspec 同步至 Gitee。[Issue #96 的六项缺口](https://github.com/fbincon/claude-code-statusline/issues/96)继续未验证，本任务接受这些缺口，不豁免新增自动化失败，也不将 dry-run 当作发布证据。
