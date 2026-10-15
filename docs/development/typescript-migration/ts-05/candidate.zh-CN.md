# 构建与验收工程候选

[English](candidate.md) | **简体中文**

使用 Node **24.21.0**、npm **11.19.0** 和锁定的 TypeScript **5.9.3**。
日常开发、生成、测试、文档和候选构建不需要 Python 或原生编译器。四个业务包保持独立；
测试支持工作区和维护工具仅供开发使用。

## 开发

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run docs:check
npm run generate:check
```

`check` 包含真实原生子进程、竞争、写入进程终止、原子发布、终端恢复、全部 161 个冻结案例
和完整责任台账。仅保留三项严格绑定哈希的 CLI 文本差异。平台跳过项明确报告。
修改共享资源后使用 `npm run generate`；它不再更新 Python 归档。

## 固定源码构建

```bash
SOURCE_COMMIT=$(git rev-parse HEAD)
npm run candidate:build -- --commit "$SOURCE_COMMIT" --output /absolute/new-candidate
```

完整 SHA 选择已跟踪的源码字节，不受本地编辑影响。两个临时导出目录分别使用全新的 npm
缓存、`npm ci --ignore-scripts`、编译和生成资源检查。只有两份 tgz 字节相同才通过。
构建需要联网取得锁定的依赖；生成的包可离线安装。过程不调用模型。

私有包名为 `@fbincon/statusline-ts05-candidate`，候选版本为
`0.0.0-ts05.g<12位提交哈希>`。应用身份在 `candidate.json` 中单独记录，不提前分配公开版本。
npm [bundleDependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bundledependencies)
包含四个业务包、lossless-json 4.3.1、Koffi 3.3.3 和四种固定预编译依赖：Linux x64、
Windows x64、macOS x64 与 macOS ARM64。Windows ARM 使用 x64 Node 模拟运行；
不据此宣称支持其他目标。包内包含两个 Mod、五种语言、技能模板、资源所有权清单和许可证；
不包含测试、归档、主机声明、编译器、开发缓存及私有报告。

输出通用候选 tgz、`statusline-ts05-source-<sha>.tgz`、`SHA256SUMS` 和
`build-manifest.json`。时间戳和机器路径保存在包外构建日志及 `build-report.json`。
源码包包含已跟踪源码、冻结归档以及带哈希的 `.candidate-source.json`，可不依赖 Git 历史重建：

```bash
# 解压源码包，进入 statusline-source，然后安装固定构建依赖。
npm ci --ignore-scripts --no-audit --no-fund
npm run candidate:build -- --commit FULL_SHA --source /absolute/source.tgz --output /absolute/new-rebuild
```

## 隔离安装与验收

将 `SHA256SUMS` 放在候选包旁边。全部目标使用同一份制品：

```bash
npm run candidate:verify -- --artifact /absolute/candidate.tgz --commit FULL_SHA
npm run test:installed -- --artifact /absolute/candidate.tgz --commit FULL_SHA --report /absolute/installed.json
npm run test:mods -- --artifact /absolute/candidate.tgz --commit FULL_SHA --report /absolute/mods.json --claude /absolute/fixed-host
```

验收器把 Node 复制到源码目录之外，将 PATH 限制为该副本，并以空缓存及
`--offline --ignore-scripts` 安装。覆盖两种编辑器、特殊字符路径、旧 Python 自有入口升级、
路径迁移、重装、显式关闭、写入中断、恢复、卸载和兼容的原始字节备份。已有 Python 产品和
真实 Claude 设置保持不变；证据绑定源码、锁文件、运行时、原生依赖和 tgz 摘要。

人工临时安装可运行 `npm install --prefix /absolute/test-prefix --cache /absolute/empty-cache
--offline --ignore-scripts --no-audit --no-fund /absolute/candidate.tgz`，随后通过 `node
/absolute/test-prefix/node_modules/@fbincon/statusline-ts05-candidate/bin/claude-statusline.js`
调用，并在管理命令中显式指定 `--config-dir /absolute/test-config`。主机绑定使用绝对 Node/JS
argv。npm `.cmd` 包装器保留既有 Windows 限制；PowerShell `.ps1`、Git Bash 和直接 Node
调用分别验收。

`doctor` 诊断未完成事务；`recover --dry-run` 检查，`recover` 显式协调恢复。升级试验保留
兼容备份和旧 Python 环境，见不变的[恢复协议](../ts-04/recovery.zh-CN.md)。不要替换任意
备份或外部设置。显示 schema 8、编辑器协议 11、运行时协议 2/v1 及任务 schema 4 保持兼容。

## CI 证据与交接

CI 只构建一次，再向八个平台目标和十三个固定 Claude 主机组合分发同一包。
`release:prepare` 要求完整报告，拒绝缺失、失败、跳过、重复或来源不符的结果。
Claude 2.1.296 没有可用的精确主机声明，记录为不可用，不能计为类型检查通过；更早的受支持
主机继续检查类型。运行时 Mod 从 2.1.289 开始支持。

TS-05 仅保存工程制品。公开预览版本、标签、注册表发布、Release 和最终产品切换属于 TS-06。
真实休眠、Windows 10、macOS 14 Intel 和 WSL 桌面验收仍是 TS-06 要求。D06 历史 FAIL
保留，PERF-01 测量与优化在 TS-06 之后进行，不作为候选门槛。

## 历史参考与可选工具

`archive/python/manifest.json` 保存原路径和哈希。手动入口重建固定历史检出，核验全部
318 个 Python 源文件、重放 161 个参考案例、运行归档 Python 测试、独立重采十二个固定
预期文件，并验证 Python/Node 混合锁与回退：

```bash
# 使用隔离的 Python 3.14.4，安装 wcwidth 0.9.1 和 pyte 0.8.2。
npm run reference:verify -- --python /absolute/reference-python --report /absolute/new-reference.json
```

该入口不刷新预期值、不修改归档字节。旧 Python 发布工作流已归档，仅手动触发的
`reference.yml` 使用 Python。原阶段结论及来源继续保留。

`benchmark -- --validate --output NEW_DIRECTORY` 验证功能夹具；描述性测量和
`benchmark:compare` 显式调用，不据此宣称 D06 通过。`acceptance:power` 记录操作者发起的
电源事件；`acceptance:terminal` 打开人工终端检查。`capture:render` 使用显式字体和来源
重建采集单元格，不代表操作系统截图。

`acceptance:paid` 默认只重验已有私有记录。新增模型调用还须 `--run-real-calls`、已有共享
10 美元账本、单次上限、新目录、已安装 JS 入口和固定的 2.1.296 可执行文件。
仅在需要时用 `npm ci --prefix tools/acceptance --ignore-scripts` 安装可选 SDK。
费用未知保留完整预留并阻止下次调用。本轮使用已有记录和模拟测试，没有新增付费会话或
人工/实机通过声明。
