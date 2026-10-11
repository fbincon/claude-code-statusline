# TS-02 平台探针与决策证据

[English](README.md) | **简体中文**

更新日期：**2026-10-12**（Asia/Shanghai）。阶段状态由[迁移总计划](../../typescript-migration.zh-CN.md)
统一维护。TS-02 当前为 **VALIDATING**，不是 DONE；TS-03 尚未开始。
已批准先做自动验证，并明确保留未完成的物理／桌面门槛；不能用推荐方案代替缺失证据。

## 交付物与决策

私有[探针包](../../../../tools/migration/ts-02/package.json)使用 Node **24.21.0**、npm（本机 **11.19.0**）、
TypeScript **5.9.3**、Koffi **3.3.3** 和 lossless-json **4.3.1**。
运行时归档固定官方 SHA-256，npm 依赖固定版本及 lockfile integrity；两个新增依赖均为 MIT。
复用的 Unicode 源码和许可文件属于构建产物，原始定义的所有者不变。
依赖审查核验了两个库及四种目标预编译包的实际 npm 归档、MIT 许可和 lockfile SHA-512；
Koffi 的原生二进制位于对应 `@koromix/koffi-*` 可选包中，Windows ARM 使用 x64 包。
详见 [Koffi 支持说明](https://koffi.dev/)及[无损 JSON 接口](https://github.com/josdejong/lossless-json)。
本轮不修改生产 Python、Mod 正式入口、产品版本、公开配置 schema 或 TS-01 固定预期。

| 决策 | 状态 | 方向与剩余证据 |
| --- | --- | --- |
| [D01](D01.zh-CN.md) | OPEN | Node 24／npm／ESM，未来 TS 版本仅 64 位；原生安装矩阵通过，仍需明确处置 WSL／旧桌面覆盖。 |
| [D02](D02.zh-CN.md) | OPEN | 系统原生时钟／身份及无损整数字面量；仍缺物理休眠／重启证据。 |
| [D03](D03.zh-CN.md) | DECIDED | 八个原生目标已验证兼容内核锁与持久化替换；完整存储事务留给 TS-03。 |
| [D04](D04.zh-CN.md) | OPEN | raw TTY／VT／共享 Unicode；仍缺 Windows 真实按键、GUI 启动／焦点及 tmux popup 证据。 |
| [D05](D05.zh-CN.md) | DECIDED | npm 入口退役、argv 前缀绑定及事务升级策略已固定；完整实现留给 TS-04。 |
| [D06](D06.zh-CN.md) | DECIDED | 测量前固定预算；最小渲染测量与完整迁移验收分开。 |

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
真实 argv 回执不能填补这一缺口。详见 [Native Mod CI](../../../../.github/workflows/native.yml)。

## 性能解释与下一门槛

策略在首个实现测量前由 `3c448b8` 固定。最小配置真实读取并校验 model 配置、解析 stdin、
通过固定 Unicode 内核裁剪并输出 ANSI；修改输入会改变输出，不支持的配置明确失败，
不会静默省略生产行为。双方均启动新进程，并断言输出字节一致。

`f891065` 的 600 样本对照（另有 200 个启动控制样本）通过固定延迟／RSS 预算，但 Node 峰值 RSS 接近 Python 加 32 MiB 的上限。
这只证明**一个最小配置**的可行性，不代表完整后端加速或内存结论。
完整采集器／Agent／hook／进程内矩阵仍未测量；新测量保留旧原始结果及固定预算。

下表为三轮统计值的中位数；延迟单位 ms，RSS 单位 MiB，具体逐轮结果及判定见机器摘要。

| Python 字节码 | Python／TS P50 | Python／TS P95 | Python／TS 峰值 RSS | TS RSS 上限 |
| --- | --- | --- | --- | --- |
| 热 | 106.59／40.75 | 115.31／47.54 | 26.52／58.19 | 58.52 |
| 冷 | 233.46／41.33 | 245.48／47.67 | 27.68／58.23 | 59.68 |

下一步：补齐物理休眠／重启、WSL、Windows 桌面键盘／resize、
macOS 14 Intel 及 GUI／popup 证据。基础门槛满足或维护者明确解决支持范围调整前，
相关决策保持 OPEN，TS-03 保持 NOT_STARTED。完整安装／恢复属于 TS-04，完整性能验收属于 TS-05；
本轮探针交付不是产品发布。

## 测试工具交接

新增 Python `scripts/oracle.py` 仅作对照适配器，在 TS-05 随参考实现退役；
`scripts/mod-smoke.py` 在 TS-05 迁移到选定的 Node PTY 工具，保留真实宿主进程 API 覆盖。
两者都不属于生产调用链。最小渲染输入／输出取自 `cli-render-bom`，显式窄配置取自 TS-01
`main-model`，同样传给 Python configured-rows 适配器；它明确不代表完整默认 CLI 配置。

当前 Linux 测试共 33 项：31 通过，2 项仅 Windows 的案例跳过。
最终探针实现 `1e9b16c` 的[八目标 CI 矩阵](https://github.com/fbincon/claude-code-statusline/actions/runs/38161869092)全部通过：
每个 POSIX 目标 31 通过／2 跳过，每个 Windows 目标 25 通过／8 跳过，无失败。
此轮包含 Windows 原生架构证据及日志失败时的终端恢复，早期失败另行保留。
最终审查 head、CI 检查、合并提交及 Gitee 同步结果在 PR 中登记，不把早期证据伪装成最终 head 的执行结果。
既有 Python 测试共 827 项，819 通过、8 项平台跳过。两个真实宿主 argv 探针在 2.1.294、2.1.296 均通过。
重建 Python wheel 的 217 个条目与 TS-01 逐字节一致；扩展源码包包含探针和证据，排除依赖／构建目录。
