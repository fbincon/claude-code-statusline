# CI 维护与 Actions 身份

[English](ci-maintenance.md) | **简体中文**

当前 Native 容量与恢复采用有界可见帧，并新增三平台 Claude 2.1.310 门禁；详见[实现与验收](native-capacity.zh-CN.md)。

## CI 耗时与稳定性优化

### 候选包在 PR、main 与 tag 之间晋级

待审查产品 PR 执行一次完整验收。常规双父 merge commit 合入 main 后，仅当 PR 验收的 head／base 与合并父提交一致、完整 Git tree 相同时复用候选包；前一个 main 门禁也须通过。main 在 Linux、Windows、macOS 上安装原包，执行版本、安装、doctor、渲染、带 revision 的配置读写及卸载冒烟。三个独立任务的回执分别记录实际集成提交与原始源码／包，可以单独重跑。

验收策略变化时同时执行复用影子核验和**完整 main 矩阵**。启用 PR 也必须完成最终 PR／main 验收并核对复用结果，然后后续普通合并才能跳过重复矩阵。squash／rebase、base／head／tree 变化或旧 PR 证据走明确的完整 main 后备路径。适用来源的证据损坏、过期、失败、取消、缺失或歧义均阻断，不能改选其他成功运行掩盖。

注解发布 tag 通常指向完整验收的 **PR 源提交**，该提交必须经已核验合并在 main 历史中可达。tag 门禁核对最新完整 PR 验收、成功的 main 集成、tag 对象、版本专属批准、源码 tree／策略及原始四文件／回执／输入／编译输出摘要。A 阶段的同提交 main → tag 路径继续支持完整 main 后备和旧证据。晋级记录区分实际检查与复用覆盖，不改写包内 commit 或原始回执。

完整运行在 `candidate-acceptance.json` 旁生成 schema v1 的 `ci-evidence.json`，记录源码／工具链／运行时／宿主身份、原始 job attempt 和回执／附件摘要。通过明确附件 ID 选择输入，保留先前 attempt 的成功执行；同名旧失败附件不能覆盖重试选定的报告。`ci-promotion` 记录 main／tag 证据链和原始集成 job 引用。恢复可执行编译输出前先验证原始归档和清单摘要；跨提交恢复另须相同 tree 和源提交可达性。旧源码修订保留完整 tag 路径。

npm 解析器沿 tag 晋级记录回溯原始完整运行，复核证据链并发布相同包字节。旧版本继续兼容读取，不补造新的历史证据。源码归档、独立构建、源码重建、草稿附件、OIDC 上下文和公开下载要求保持。源码／证据附件 30 天到期；刷新证据需要适用的完整验收及新的集成／tag 核验，不能用无关成功运行替代。

### 发布数据与验收策略

逐版本批准登记放在[批准登记表](../releases/approvals/registry.json)，与各版本批准 JSON 放在一起。新增版本时登记版本号、批准路径和精确批准日期，无需修改 `tools/release/approval.ts`。登记表和批准决定都是绑定源码的发布输入，纳入 Git tree、源码归档和候选包身份；它们不是可执行验收规则，不进入策略摘要。

| 改动 | 最终 PR | 等价 main 合并 | tag |
| --- | --- | --- | --- |
| 批准登记／决定 JSON、产品源码或生成的版本资源 | 完整候选矩阵 | 复用该 PR 的原始候选包，加三个安装冒烟 | 核验批准及原始证据链 |
| 工作流或可执行的构建、验收、批准校验、证据规则 | 完整候选矩阵 | 完整矩阵，加影子晋级和三个冒烟 | 核验原始证据链 |
| 允许清单内的纯文档 | 必要文档检查 | 必要文档检查 | 不产生候选验收证据 |

策略摘要继续包含 `tools/release/` 中的可执行校验文件及未来新增校验器，没有排除整个目录。沿用既有路径选择规则，保留历史证据兼容性。修复通过职责分离让可变数据退出策略范围，不按某个文件名或本次版本设置临时例外。base／head／tree 不等价仍走既有后备路径；适用证据损坏或不可取得仍阻断。

`release:prepare` 和晋级均从已校验的源码归档读取登记及决定，不读取当前工作区。登记要求唯一稳定版本／路径及有效日历日期；批准决定必须匹配登记的版本和日期、维护者、授权说明、引用及精确的六项已接受缺口。验收回执记录两个数据文件的摘要，晋级时比对原批准回执。没有登记表的历史归档可以只读解析原始字面登记表，不执行其中代码；新登记表损坏时禁止回退。已发布历史文件保持原样。

本次迁移校验器本身改变策略，因此需要一次完整最终 PR／main 验收及影子晋级。后续只新增发布批准数据时，main 使用常规复用路径。参见[发布准备](../RELEASING.zh-CN.md#绑定源码的-ci-证据晋级)及[分流回归](testing.zh-CN.md#发布批准与-ci-分流)。

### 开发与执行路径

macOS 身份适配器通过既有原生桥接读取 `PROC_PIDTBSDINFO`，校验完整结构和 PID，并保留 C locale／UTC 的 `ps lstart` token，包括个位日期的空格。未知结果仍不可验证，僵尸进程不算存活。ABI 对照 [Apple 定义](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h)，实际 macOS 测试逐字比较 `ps` 的结果。手动 `validation=macos-probe` 在 Intel 和 ARM 上各重复二十次受影响的六语言事务流程，每台 runner 还进行 1,000 次身份比较，仅生成诊断证据。

草稿产品 PR 执行 `Draft quick checks`（完整的本地 Linux 检查命令），但不能通过 `Complete candidate evidence`。创建、同步、重新打开、转为待审查和退回草稿都会重新分类当前 head。待审查产品 PR 要求完整覆盖；白名单文档在分类任务中完成检查，无需构建产品。汇总门禁使用固定 Node 直接执行无外部依赖的检查器。PR 更新取消旧运行；main／tag 按不可变提交分组，避免取消其他修订的证据。

开发检查与两次独立干净构建并行，二者均成功后才执行平台验收。开发任务分发绑定精确提交、锁文件、逐文件及归档摘要的可移植编译输出。消费方自行安装本平台原生依赖，校验后只恢复六个固定编译目录；独立构建不使用此包。平台任务保留全部源码测试，仓库静态生成／文档／归档／清单检查集中执行。普通测试文件使用两个隔离 worker；原生进程与锁、终端、时序及恢复测试保留串行组。未知位置仍执行并默认串行；`STATUSLINE_TEST_WORKERS=1` 用于对照。

Node 选择器每份候选只解析一次。8／32／16 项逻辑责任全部保留：开发运行时与某个 Node 组合完全一致时，安装任务的完整源码测试和原有隔离安装也覆盖该组合。共享回执引用这次实际执行，并要求源码测试回执、可执行文件摘要和源码哈希一致，不算一次新测试。其他运行时保持独立任务。两个真实历史版本流程通过隔离子进程并发执行，分别拥有 prefix、HOME、配置、缓存、registry 和日志；失败时取消另一个流程，等待退出后再清理。

手动 `validation=windows-probe` 在 Windows x64 和 ARM 宿主／x64 上运行进程边界回归、同机新旧监督程序测量及真实安装验收，不能生成汇总发布验收。最终完整矩阵还在 Windows Claude 2.1.289、2.1.294 上各重复十次原有 20 秒长场景，保留原测试体、源码摘要、单项耗时与日志，然后执行常规完整宿主测试。

专项诊断可向包管理命令预加载计时订阅器。产品的 `claude-statusline.management-timing` 诊断通道只报告 npm、复制、归档校验和事务检查点的阶段名与耗时；普通命令无订阅器，协议输出不变。诊断日志与常规冷安装证据分开。registry／cache 通过一次 npm `config list --json` 读取，保留 npm 配置优先级、prefix／root 检查和含凭据地址的拒绝行为（[npm 配置](https://docs.npmjs.com/cli/v10/commands/npm-config/)）。

[Issue #157](https://github.com/fbincon/claude-code-statusline/issues/157) 跟踪分阶段优化。完整候选覆盖仍为 8 安装目标、32 运行时、16 官方宿主及适用的 197 项 Native 容量检查。普通交付执行一轮完整候选矩阵，再进行 main 集成和 tag 核验；策略变化及不等价集成保留完整后备路径。

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

第二阶段最终 PR 相比基线 PR，总耗时减少 26.1%，累计任务分钟减少 23.2%，macOS 分钟减少 26.9%。随后两轮交付验收同时运行、共享托管 runner 配额，更长排队掩盖了执行工作量的降低。这些是具名实测结果，不是延迟保证或受控基准。启用验收策略变化时，仍执行完整 PR/main 矩阵；之后的普通交付使用一次完整 PR 矩阵、三个 main 安装冒烟和 tag 晋级核验。新 tag 触发与真实 npm/OIDC provenance 留待下一次正式发布记录；本次维护不创建版本或测试 tag。

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

CI scope 任务在变更分类之前执行检查，`npm run check` 在普通测试前执行检查；既有汇总门禁要求 scope 成功。工作流、Dependabot 和工具变更继续触发完整产品矩阵；白名单内的文档与社区模板只运行必要文档校验，不生成发布验收凭据。

### 社区文档检查

轻量路径包含既有 README/CHANGELOG 与 `docs/**/*.md`、根目录的 `AGENTS.md`、根目录的 `SECURITY.md`、`CONTRIBUTING.md` 及其 `.zh-CN.md` 对应文件、`.github/pull_request_template.md`，以及 Issue 模板中的精确路径 `bug_report.yml`、`config.yml` 和旧 `preview-feedback.yml`。保留旧路径以允许替换或删除旧表单。代理指引只新增根目录 `AGENTS.md` 这一精确路径，不为其他指令文件增加通配规则。其他 `.github` 路径以及产品／文档混合变更仍需完整矩阵。未知 Git 修订、可执行文件改名为文档、标签事件和手动 CI 也保留完整检查。

`npm run docs:check` 检查 Markdown、单文件双语 PR 模板、Issue 表单 Markdown 内容和入口链接中的本地目标及锚点。根目录政策文件需要独立的英文／中文文件，根目录 `AGENTS.md` 除外：它只维护英文，仍检查链接和锚点；该例外不适用于 `docs/` 下的同名文件。PR 模板和表单在同一文件中包含双语。复用既有仅开发 YAML 解析器，检查表单结构、显式且唯一的字段 ID、必填标志、下拉选项，以及联系入口的名称、HTTP(S) 地址和说明。这是针对本仓库所维护字段的离线检查，不代替 GitHub 渲染；合并后仍应检查实际入口与模板。参见 [GitHub 表单语法](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)。

`Complete candidate evidence` 继续作为唯一汇总检查。轻量路径要求 scope 和文档任务成功、产品任务按设计跳过；其他路径要求所有产品任务成功。分类器或检查器变更必须通过本地回归以及最终 PR head/main 的完整 CI，后续纯文档 PR 才使用新路径。

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
