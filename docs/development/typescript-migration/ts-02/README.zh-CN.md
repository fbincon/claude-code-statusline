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
本轮不修改生产 Python、Mod 正式入口、产品版本、公开配置 schema 或 TS-01 固定预期。

| 决策 | 状态 | 方向与剩余证据 |
| --- | --- | --- |
| [D01](D01.zh-CN.md) | OPEN | Node 24／npm／ESM，未来 TS 版本仅 64 位；需完成原生安装矩阵并明确处置 WSL／旧桌面覆盖。 |
| [D02](D02.zh-CN.md) | OPEN | 系统原生时钟／身份及无损整数字面量；仍缺物理休眠／重启证据。 |
| [D03](D03.zh-CN.md) | OPEN | 兼容内核锁与持久化替换；关闭前须有 Windows 原生矩阵结果。 |
| [D04](D04.zh-CN.md) | OPEN | raw TTY／VT／共享 Unicode；仍缺 Windows 真实按键、GUI 启动／焦点及 tmux popup 证据。 |
| [D05](D05.zh-CN.md) | OPEN | npm 入口退役、argv 前缀绑定与事务升级策略；待安装后 shell／宿主证据齐备。 |
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
macOS 14 ARM 及 macOS 15／26 Intel／ARM。进程架构不能代表物理宿主架构，两者分别记录。
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

## 性能解释与下一门槛

策略在首个实现测量前由 `3c448b8` 固定。最小配置真实读取并校验 model 配置、解析 stdin、
通过固定 Unicode 内核裁剪并输出 ANSI；修改输入会改变输出，不支持的配置明确失败，
不会静默省略生产行为。双方均启动新进程，并断言输出字节一致。

首个 600 样本对照通过固定延迟／RSS 预算，但 Node 峰值 RSS 接近 Python 加 32 MiB 的上限。
这只证明**一个最小配置**的可行性，不代表完整后端加速或内存结论。
完整采集器／Agent／hook／进程内矩阵仍未测量；新测量保留旧原始结果及固定预算。

下一步：完成全部原生／安装自动检查，并补齐物理休眠／重启、WSL、Windows 桌面键盘／resize、
macOS 14 Intel 及 GUI／popup 证据。基础门槛满足或维护者明确解决支持范围调整前，
相关决策保持 OPEN，TS-03 保持 NOT_STARTED。完整安装／恢复属于 TS-04，完整性能验收属于 TS-05；
本轮探针交付不是产品发布。
