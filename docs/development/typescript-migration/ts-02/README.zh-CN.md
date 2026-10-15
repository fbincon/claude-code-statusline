# TS-02 平台探针与决策证据

[English](README.md) | **简体中文**

2026-10-14: [Linux 整合、实体机验收及已批准的发布前补验](LINUX-20261014.zh-CN.md).

更新：**2026-10-15**（Asia/Shanghai）。阶段状态由[迁移总计划](../../typescript-migration.zh-CN.md)统一维护。
TS-02 为 **DONE**，D01–D06 均为 **DECIDED**；TS-03 已[按修订后的非性能标准关闭](../ts-03/README.zh-CN.md#closure-2026-10-15)。
[D06 适用范围修订](D06.zh-CN.md#applicability-amendment-2026-10-15)将后续性能工作归入 TS-06 之后的
[PERF-01](../../performance/perf-01.zh-CN.md)。TS-04～TS-06 和 PERF-01 保持 NOT_STARTED。
整合 CI 和本 Linux 实体机电源／桌面验收已通过。维护者明确将无法补齐的外部实体机／桌面检查
延后到[发布前补验](LINUX-20261014.zh-CN.md#已批准的阶段与发布门槛)，仍记为未验证，平台支持承诺不变。

## 交付物与决策

私有[探针包](../../../../archive/python/tools/migration/ts-02/package.json)使用 Node **24.21.0**、npm（本机 **11.19.0**）、
TypeScript **5.9.3**、Koffi **3.3.3** 和 lossless-json **4.3.1**。
运行时归档固定官方 SHA-256，npm 依赖固定版本及 lockfile integrity；两个新增依赖均为 MIT。
复用的 Unicode 源码和许可文件属于构建产物，原始定义的所有者不变。
依赖审查核验了两个库及四种目标预编译包的实际 npm 归档、MIT 许可和 lockfile SHA-512；
Koffi 的原生二进制位于对应 `@koromix/koffi-*` 可选包中，Windows ARM 使用 x64 包。
详见 [Koffi 支持说明](https://koffi.dev/)及[无损 JSON 接口](https://github.com/josdejong/lossless-json)。
初始探针交付未修改生产 Python、Mod 正式入口、产品版本、公开配置 schema 或 TS-01 固定预期。
下述本机失败后的 Windows 时钟修复由维护者明确要求；冻结参考和固定预期继续保留。

| 决策 | 状态 | 方向与剩余证据 |
| --- | --- | --- |
| [D01](D01.zh-CN.md) | DECIDED | Node 24.21.0／npm／ESM，64 位 TS；八目标原生／安装矩阵通过，未覆盖目标明确保留到发布前。 |
| [D02](D02.zh-CN.md) | DECIDED | Koffi 时钟／身份及严格无损 bigint 边界；修复后的 Windows、本 Linux 真实电源及 macOS 虚拟机重启有证据，实体 macOS 睡眠延后补验。 |
| [D03](D03.zh-CN.md) | DECIDED | 八个原生目标已验证兼容内核锁与持久化替换；完整存储事务留给 TS-03。 |
| [D04](D04.zh-CN.md) | DECIDED | raw TTY／VT／共享 Unicode；真实 Windows 控制台、macOS Terminal.app／popup、Linux GNOME／popup 已有证据，其余外部覆盖延后补验。 |
| [D05](D05.zh-CN.md) | DECIDED | npm 入口退役、argv 前缀绑定及事务升级策略已固定；完整实现留给 TS-04。 |
| [D06](D06.zh-CN.md) | DECIDED；2026-10-15 修订适用范围 | 冻结预算与历史结果保留；完整成品测量和优化移至 TS-06 后的 PERF-01，不阻塞迁移／发布。 |

维护者已批准未来主版本退役 Windows x86、Python import、`python -m`、pipx 安装和旧 Windows `.exe` 名称。
历史 Python 发布物保留供既有用户使用和兼容回滚，不因此承诺新增维护分支。
项目根 README 继续介绍当前已发布的 Python 产品。

## 复现

使用精确锁定的 Node，以及仅供测试参考的 Python 3.14.4；可通过 `TS02_PYTHON` 指定其绝对路径。
从仓库根目录运行：

```bash
npm ci --prefix tools/migration/ts-02 --ignore-scripts --no-audit --no-fund
npm run --prefix tools/migration/ts-02 build
npm run --prefix tools/migration/ts-02 typecheck
npm test --prefix tools/migration/ts-02
npm run --prefix tools/migration/ts-02 probe -- /absolute/new-evidence-directory
npm run --prefix tools/migration/ts-02 verify-evidence -- /absolute/new-evidence-directory/evidence.json
npm run --prefix tools/migration/ts-02 benchmark -- /absolute/new-benchmark-directory
```

必须选择新的输出目录，工具拒绝复用已有目录。POSIX 终端测试需要 tmux。
候选安装只使用 Node／npm 和预编译原生模块；此阶段 Python 仅用于参考／测试适配器。
`exportReference` 从 `9b6d2fa` 读取不可变 Git blob，避免 checkout／archive 换行转换。
不得为了修复探针而移动 TS-01 参考。

Linux／macOS 上可用固定 Claude 宿主及 Node 的绝对路径执行免费的真实宿主 argv 检查：

```bash
python tools/migration/ts-02/scripts/mod-smoke.py --claude /path/to/claude --node /path/to/node --output /absolute/new-mod-evidence-directory
```

工具创建两个 Mod 的临时副本，增加 `backendArgs` 配置字段（`type: string`、`multiple: true`）。
虚构密钥和不可达的本地 API 阻止模型调用，只发送本地 slash 命令。
收据必须同时包含 `ui` 与 `runtime`；它证明真实进程调用，不代表完整后端响应、编辑器 parity 或人工视觉验收。

## 证据与限制

交付记录见 [PR #76](https://github.com/fbincon/claude-code-statusline/pull/76)。
[机器可读摘要](validation.json)记录受测提交、哈希、数量和 CI 链接。
原始日志保存在忽略的 `dist/validation/typescript-migration/ts-02/`，原生 CI 上传每个目标的收据。
收据绑定源码／策略哈希、测试数量、安装 tarball 哈希、宿主／进程架构及日志哈希；
核验器拒绝缺少日志、预算变化、源码变化、篡改结果和不一致数量。

矩阵保留原有 Python 和两个 Mod 检查，增加 Linux x64、Windows x64、**Windows ARM 上的 x64 Node／Python**、
macOS 14 ARM 及 macOS 15／26 Intel／ARM，标签依据 [GitHub runner 支持表](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。进程架构不能代表物理宿主架构，两者分别记录。
Windows 上明确跳过 POSIX PTY。PowerShell 与 Git Bash 安装 shim 分别检查；
Mod 无 shell 调用不把 `.cmd` 当作原生可执行文件。

保留实测发现，不通过归一化掩盖：

- `lossless-json` 即使配置重复键回调也接受同值重复键；严格适配器采用原生词元及显式键扫描。
- Windows 句柄可能使已退出进程的对象继续存在，并仍能读取创建身份。身份不等于存活；
  启动器原型单独检查状态，不静默重定义固定 Python token。
- 整数规范化哈希与 Python 一致；探针明确不支持任意浮点规范化，TS-03 须完成该 parity。
- 最小渲染比较 configured-rows 适配器按 UTF-8 LF 序列化的结果与标准 Linux TS-01 输出，
  不声称覆盖所有 Windows 生产 CLI 换行或诊断文本。
- 替换前后强制终止证明完整旧／新值及锁释放，不证明断电持久性；仅清理隔离目录内遗留文件。
- GNOME 参数和 macOS 命令文件检查只证明构造，不代表 GUI 启动／焦点；Windows 新控制台／raw 模式探针
  不等于键盘、resize 和视觉验收；tmux session 启动不等于 popup 焦点验证。

保留既有宿主声明边界：2.1.294 继续生成精确版本的官方声明并对两个 Mod 做类型检查；
2.1.296 能加载、测试和安装 Mod，但现有生成流程不产出精确宿主声明，因此没有声明／类型检查通过结论。
真实 argv 回执不能填补这一缺口。详见 [Native Mod CI](../../../../archive/python/workflows/native.yml)。

## 性能解释与下一门槛

策略在首个实现测量前由 `3c448b8` 固定。最小配置真实读取并校验 model 配置、解析 stdin、
通过固定 Unicode 内核裁剪并输出 ANSI；修改输入会改变输出，不支持的配置明确失败，
不会静默省略生产行为。双方均启动新进程，并断言输出字节一致。

`f891065` 的 600 样本对照（另有 200 个启动控制样本）通过固定延迟／RSS 预算，但 Node 峰值 RSS 接近 Python 加 32 MiB 的上限。
这只证明**一个最小配置**的可行性，不代表完整后端加速或内存结论。
探针交接时完整采集器／Agent／hook／进程内矩阵尚未测量；后续 [TS-03 测量](../ts-03/PERFORMANCE-OPTIMIZATION.zh-CN.md)仍为失败，旧原始结果及固定预算继续保留。

下表为三轮统计值的中位数；延迟单位 ms，RSS 单位 MiB，具体逐轮结果及判定见机器摘要。

| Python 字节码 | Python／TS P50 | Python／TS P95 | Python／TS 峰值 RSS | TS RSS 上限 |
| --- | --- | --- | --- | --- |
| 热 | 106.59／40.75 | 115.31／47.54 | 26.52／58.19 | 58.52 |
| 冷 | 233.46／41.33 | 245.48／47.67 | 27.68／58.23 | 59.68 |

[2026-10-14 整合](LINUX-20261014.zh-CN.md)已满足调整后的 TS-02 门槛：修复后的矩阵及本 Linux 实体机
睡眠／重启／GNOME／popup 通过。其余外部覆盖仍须在 TS 发布前补验，不记为通过。
完整安装／恢复仍属于 TS-04。按 2026-10-15 修订，完整成品性能测量／优化归 TS-06 后的 PERF-01，
不阻塞迁移或发布。TS-03 已按修订标准 DONE；本次文档任务不启动 TS-04 实现。

## 测试工具交接

新增 Python `scripts/oracle.py` 仅作对照适配器，在 TS-05 随参考实现退役；
`scripts/mod-smoke.py` 在 TS-05 迁移到选定的 Node PTY 工具，保留真实宿主进程 API 覆盖。
两者都不属于生产调用链。最小渲染输入／输出取自 `cli-render-bom`，显式窄配置取自 TS-01
`main-model`，同样传给 Python configured-rows 适配器；它明确不代表完整默认 CLI 配置。

初始 PR #76 的 Linux 测试共 33 项：31 通过，2 项仅 Windows 的案例跳过。
最终探针实现 `1e9b16c` 的[八目标 CI 矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/38161869092)全部通过：
每个 POSIX 目标 31 通过／2 跳过，每个 Windows 目标 25 通过／8 跳过，无失败。
此轮包含 Windows 原生架构证据及日志失败时的终端恢复，早期失败另行保留。
最终审查 head、CI 检查、合并提交及 Gitee 同步结果在 PR 中登记，不把早期证据伪装成最终 head 的执行结果。
初始交付时 Python 测试共 827 项，819 通过、8 项平台跳过。两个真实宿主 argv 探针在 2.1.294、2.1.296 均通过。
初始交付时重建 Python wheel 的 217 个条目与 TS-01 逐字节一致；扩展源码包包含探针和证据，排除依赖／构建目录。

以下按日期保留的补验记录描述各检查点当时的范围和阶段状态；当前决策与已批准的发布前补验见上文。

## 2026-10-12 本机 Windows 补验

基于合并提交 `7f2a418`，在 Windows 11 家庭版 26300、Intel x64 主机使用固定
Node 24.21.0／npm 11.19.0／Python 3.14.4 完成本机自动检查；原始日志和哈希见
[本机机器摘要](validation.windows-local-20261012.json)。生产源码、TS-01 参考及性能预算未改动。

- Windows 管理员进程：33 项中 25 通过、8 项平台跳过，完整安装探针及收据核验通过。
  原普通权限运行的 24 通过／1 失败／8 跳过仍保留；失败发生在文件符号链接样例创建的 `EPERM`，
  没有跳过该失败或更改系统策略。PowerShell／Git Bash 安装入口和独立目录 junction 检查通过；
  特殊路径下 `.cmd` 的既有失败继续保留。
- 本机 WSL2 Ubuntu 24.04.4 x64：31 通过、2 项平台跳过，安装及收据核验通过。
  此项覆盖 WSL 的原生／PTY／tmux session 自动检查，仍不代表 GUI／popup 人工验收。
- Python：827 项中 799 通过、28 项平台／权限条件跳过；五项共享资源检查、Ruff 和 Windows curses 检查通过。
  两个 Mod 在 2.1.294、2.1.296 上均通过官方校验、112＋10 项测试和安装 smoke；
  精确声明及类型检查仅在 2.1.294 通过，2.1.296 的既有声明缺口不变。
- 人工 Windows 控制台：四个方向键、中文／组合字符／emoji、大小窗口切换、Ctrl+S／Ctrl+C、
  日志异常后的模式恢复和视觉确认已完成。保留两次不完整操作及最终补验，按原始事件合并核验。
- 固定最小渲染性能：600 个渲染样本及 200 个控制样本，六项冷／热延迟和 RSS 指标均通过；
  热状态 Python／TS P50 为 275.46／119.60 ms，冷状态为 425.74／112.98 ms，无预算调整或追加重测。
- 物理 S0 现代待机／恢复通过：系统事件证明约 60.48 秒待机，启动身份保持不变，
  Node 和固定 Python 参考的启动时钟均包含睡眠时间。本机不具备 S3／休眠覆盖。
- **真实重启验收失败**：2026-10-12 04:01（Asia/Shanghai）的系统关闭／启动事件和
  启动时钟从 2059.515 秒降至 160.312 秒证明已重启，但 Node 和固定 Python 参考的
  `boot_id` 完全不变。独立 ctypes 查询也返回相同 GUID；这组实测样本在两种实现中
  都产生不可用的 elapsed delta。候选与参考一致不能证明重启身份正确；公共摘要保留结果与证据哈希，
  完整诊断及原始快照保存在独立证据包中。该轮验证未改写 TS-01 预期或生产代码。

本机适用的验证已执行完毕，结论含上述明确失败，并非全部验收通过。
本记录只补充这台 Windows x64 主机及其 WSL 环境，其他目标和 GUI／popup 门槛继续保留。
该历史检查点的 TS-02 为 VALIDATING，D01／D02／D04 为 OPEN，TS-03 为 NOT_STARTED；当前处置见上方 2026-10-14 Linux 整合。

## Windows 重启身份修复

维护者随后要求修复上述失败，当前工作区的 Python 时钟及 TS 探针已实现
[D02 的 v2 启动身份与旧数据降级规则](D02.zh-CN.md#windows-启动身份-v2-修复)。
[新修复记录](validation.windows-boot-fix-20261012.json)独立于上面的历史验证，
保留原失败收据和冻结 TS-01 参考；真实重启样本已加入回归用例。
本次修复不发布产品、不启动 TS-03，物理复验结果和其他平台门槛分别登记。

修复版 S0 待机／恢复已通过，系统事件区间约 112.70 秒；两种实现的启动序号均保持 1301，
sleep-aware elapsed 与可信域检查通过。随后真实重启后，Python／Node 启动序号均从
**1301 变为 1302**，跨重启 elapsed 正确回退到墙钟差，可信执行时间标记为降级。
源码／运行时哈希及系统启动事件核验通过，本机 Windows 阻断问题已验证修复。

修复后的 Python 全套 834 项中 806 通过／28 跳过；Windows 探针 27 通过／8 跳过，
WSL 探针 33 通过／2 跳过，安装及收据核验通过。600 个渲染样本和 200 个控制样本再次满足
固定预算。原始失败及一次旧 mock 修正前的测试失败均保留，不覆盖或重命名为通过记录。

## Windows → macOS → Linux 交接

2026-10-13 的[交接清单](handoff.windows-20261013.json)固定本地修复提交和 Windows 证据包哈希。
提交中的两个 Windows JSON 文件为公共摘要（schema 2）；完整原始记录、历史失败及受测源码字节
保存在独立的 `dist/handoff/ts02-windows-20261013/windows-evidence.zip`，不纳入 Git。
相邻的 `verify_handoff.py` 可在任意平台用 Python 校验压缩包和内部文件；它不执行归档代码。
原始记录仍保留受测 `7f2a418`＋脏工作树及源码哈希，不伪装成后续本地提交上的重跑。

拷贝时保留 `.git`、全部已提交文件以及整个 `dist/handoff/ts02-windows-20261013/` 目录。
该目录还包含离线 Git bundle、最终提交／文件校验清单及可直接交给 macOS 执行者的说明。
Windows 的依赖、虚拟环境、运行时和生成目录仅供原平台使用；macOS 按本文固定版本安装原生依赖并重新构建。
如需干净的 macOS 检出，可从离线 bundle 克隆到新目录，并保留原复制目录和证据包。

macOS 使用新分支／新输出目录验证该版本，记录宿主与进程架构、原生 API、真实睡眠／重启、
Terminal.app 启动／焦点、键盘／resize／恢复及实际支持的 tmux popup。Windows 专用电源工具不适用于 macOS。
新增改动与验收摘要单独提交，原始 macOS 证据另行保存；不覆盖 Windows 记录或移动 TS-01 参考。

Linux 最后通过 Git 合入提交、保留两端原始证据，评估 macOS 新改动对既有 Windows 结果的影响，
运行修复后的完整矩阵并补齐 Linux GUI／popup 和支持范围处置。各基础门槛关闭后再更新 TS-02／TS-03 状态。

2026-10-14 的 [macOS 本机验收](MACOS-20261014.zh-CN.md)覆盖 macOS 14.5 x86_64 VMware 来宾：
自动检查、固定预算、真人 Terminal／popup 与真实来宾重启已取得证据；睡眠按维护者要求跳过。
POSIX 宿主探针清理修复、原不完整操作和补测分别保留。此结果不关闭实体硬件或全平台门槛，最终交由 Linux 汇总。

当前整合、最终 head 检查、合并及同步由 [PR #77](https://github.com/fbincon/claude-code-statusline/pull/77) 记录；PR #76 与上述历史数据保留各自的被测提交。
