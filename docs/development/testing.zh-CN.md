# 测试与验收

[English](testing.md) | **简体中文**

按实际变更选择验证，并保留各结果的源码／产物身份。[影响检查](impact-checks.zh-CN.md)定义职责分类及本地任务，[CI 维护](ci-maintenance.zh-CN.md)定义必需汇总门禁、证据期限及 PR/main/tag 晋级。开发环境见[开发指南](README.zh-CN.md)。

| 工作 | 所需证据 |
| --- | --- |
| 文档／模板 | 当前行为准确、中英文一致、链接／锚点／导航有效，执行 `docs:check` 及空白检查 |
| 图片、录制与使用演示 | 计划选定的媒体检查、可读输出、匹配的已安装包、输入／配置来源及可复现操作；[SHOWCASE-01](showcase.zh-CN.md)与文档验收分开记录 |
| 工具、测试、呈现数据或 CI 策略 | 适用的 `ci:plan`／`ci:check` 任务；涉及包内容的分类须完成比较 |
| 核心行为／运行依赖 | 完整产品检查及适用安装／运行时／宿主矩阵 |
| 终端、实机或付费工作 | 范围明确的采集、源码绑定报告及实际限制；付费调用需要获批预算和共用账本 |

普通测试使用隔离的配置和安装目录。[候选包验收](#candidate-build-and-isolated-installation)介绍安装与宿主检查，交互终端、实机和付费场景有独立入口。分别记录 PTY 重建、操作者观察和实机结果。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)的六项既有缺口继续标为未验证。

当前 Native 容量规则与适用宿主检查见[容量与恢复](native-capacity.zh-CN.md)。[交付索引](history/README.zh-CN.md#delivery-records)链接各功能证据；历史记录中的数量描述其指定版本，不代表对当前 main 新执行了一轮检查。

## 当前 TypeScript 检查

[CI 执行与晋级规则](ci-maintenance.zh-CN.md#候选包在-prmain-与-tag-之间晋级)区分草稿反馈、完整候选验收和集成／发布核验。完整核心候选覆盖 8 安装目标、32 个 Node 场景、16 宿主及全部适用 Native 容量检查。main 三平台冒烟是原包的额外集成证据，不能替代缺失的 PR 验收。回归覆盖错误或过期运行／附件、重复回执、源码／tree／base／策略变化、移动 tag、编译输出来源及失败／跳过依赖。手动诊断和本地冒烟不属于可发布验收。

维护改动按[影响计划](impact-checks.zh-CN.md)执行 `npm run ci:plan` 与选中的 `ci:check` 任务。核心改动执行 `npm run check` 及适用的完整产品验收。
默认流程不启动 Python；固定参考保留全部 161 案例和原有三项文本差异，真实 Node 并发、原子写入、终止与终端恢复仍执行。2.1.296 类型声明不可用不计为类型通过。完整 D06 测量归 PERF-01，历史 FAIL 保留。

清理命令的回归测试在隔离临时目录中验证预览、完整删除、重复执行、符号链接边界，以及源码和历史资料的保留。重建检查前可运行 `npm run clean -- --dry-run` 和 `npm run clean`；命令范围见[开发指南](README.zh-CN.md#清理编译输出)。

<a id="candidate-build-and-isolated-installation"></a>

### 候选包构建与隔离安装

使用[固定开发工具链](README.zh-CN.md#准备开发环境)，选定完整提交 SHA，并在仓库根目录运行。输出目录必须是新目录。

```bash
SOURCE_COMMIT=$(git rev-parse HEAD)
CHECK_ROOT=$(mktemp -d)
npm run candidate:build -- --commit "$SOURCE_COMMIT" --output "$CHECK_ROOT/candidate"
```

构建先导出选定的 Git tree，核验文件清单及 blob 身份，再在两个独立目录中使用锁定依赖和空 npm 缓存分别构建。两个软件包压缩档必须逐字节一致。获取构建依赖需要联网。保留候选 tgz、源码归档、`build-manifest.json` 和 `SHA256SUMS` 的原始文件名，并放在同一目录。将 `CANDIDATE_TGZ` 设为生成的候选软件包绝对路径。

```bash
CANDIDATE_TGZ="/absolute/path/to/the/generated-candidate.tgz"
npm run candidate:verify -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT"
```

工程包名为 `@fbincon/statusline-ts05-candidate`，版本为 `0.0.0-ts05.g<12 位提交哈希>`。应用版本单独记录在 `candidate.json`。手动检查使用临时 prefix、空 npm 缓存和明确的 Claude 配置目录。

```bash
npm install --prefix "$CHECK_ROOT/prefix" --cache "$CHECK_ROOT/npm-cache" \
  --offline --ignore-scripts --no-audit --no-fund "$CANDIDATE_TGZ"
CANDIDATE_JS="$CHECK_ROOT/prefix/node_modules/@fbincon/statusline-ts05-candidate/bin/claude-statusline.js"
node "$CANDIDATE_JS" --version
node "$CANDIDATE_JS" install --config-dir "$CHECK_ROOT/claude-config" --dry-run
```

在 PowerShell 中为对应变量设置绝对路径，并使用 `node` 调用已安装的 JavaScript 入口。测试接入时绑定匹配的 Node 可执行文件和 JavaScript 入口。使用 `doctor` 和 `recover --dry-run` 在同一测试配置下查看待处理事务。参见[安装与恢复](contracts.zh-CN.md#候选安装与恢复)。

验收时向各执行器提供同一产物和提交，每个平台和固定宿主使用新的报告路径。将示例宿主路径替换为选定的 Claude 可执行文件。安装验收使用隔离 prefix 和配置，并禁用生命周期脚本。官方宿主检查记录准确宿主和对应声明的可用性。

```bash
npm run test:installed -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT" \
  --report "$CHECK_ROOT/installed.json"
CLAUDE_HOST="/absolute/path/to/fixed-claude"
npm run test:mods -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT" \
  --report "$CHECK_ROOT/mods.json" --claude "$CLAUDE_HOST"
```

按[绑定源码的 CI 规则](ci-maintenance.zh-CN.md#候选包在-prmain-与-tag-之间晋级)选择矩阵和复用证据。记录实际检查、平台与运行时身份、软件包摘要、限制及有意跳过的项目。本地候选报告证明其自身的执行结果。

### 终端、实机及付费验收

- 使用 `acceptance:terminal` 运行明确选定的交互场景，使用隔离设置并生成绑定源码的报告。将操作者的观察与自动 PTY 检查分别记录。[终端执行器](../../tools/acceptance/terminal.ts)
- 在操作者发起的真实休眠或重启前后运行 `acceptance:power`，记录事件、宿主和观测结果。[电源执行器](../../tools/acceptance/power.ts)
- 付费场景需要明确范围、获批预算及共用账本。新增模型请求需要 `--run-real-calls`。保留失败、重试和结果不明的请求及其预算预留。[付费执行器](../../tools/acceptance/paid.ts)
- 使用独立的 `reference:verify` 流程复现历史 Python 基线。[冻结 Python 归档](../../archive/python/README.zh-CN.md)

### 安装后的语言组合

候选包逐一验证所有已注册的界面和输出语言组合。每种界面语言有一个驱动，调用已安装 CLI 的入口函数。对每种输出语言，驱动核对预览前后文件字节，使用原 revision 应用草稿，再从新进程重开配置并按 120 列渲染。每行保留一对组合，六个操作全部经过真实 CLI 管道；这些冷启动组合覆盖每种界面和输出语言。十二种语言共 144 对，验收最多启动 231 个候选 Node 进程。

在驱动所在分支手动运行 CI 工作流，选择 `validation=language-comparison`。默认从派发所指的提交统一构建输入。使用兼容驱动时，选择 `language_input=v3.16.1` 可复测 #198 摘要固定的原包。Linux x64、macOS Intel 和使用 x64 Node 的 Windows ARM 宿主均测试同一份包。Windows 分别执行开发 Node 和 22.0.0。各 runner 交错运行三组旧驱动与当前驱动，保留每次测量、包与驱动身份、进程启动数和语义结果。此对照单独运行安装语言场景，完整平台和发布验收还要求其余场景。[安装验收时限](ci-maintenance.zh-CN.md#安装验收时限)。

## 发布批准与 CI 分流

发布及 CI 回归覆盖只增加数据完成版本登记、全部历史登记迁移、不可变源码中的登记／决定摘要、无效或缺失批准，以及过期／不匹配证据。重跑排序还覆盖较晚上传获得更小 ID、创建时间缺失／相同及阻断无效最新附件。隔离的 Git 合并／tag 夹具与模拟 Actions 归档执行真实 PR → main → tag 选择器，核对原始产物身份及三个冒烟的汇总。批准校验、构建、验收及信任规则修改仍改变源码绑定摘要，但已验收的等价合并复用矩阵。回归覆盖产品／生成输入、新验收／截图工具、CI 观察、发布说明、依赖、工作流／构建／校验器变化、批量祖先关系、改写提交、head／base／tree 不一致及最新运行失败。独立校验夹具把 HEAD 校验器替换为空实现，冻结 base 仍拒绝篡改字节；工作流断言要求交叉核验早于恢复和晋级。原始 job ID、名称、时间和 attempt 向 Actions 回查。手动全量及晋级 shadow 均不属于发布证据。夹具不创建本仓库版本／tag，不发网络或模型请求。`npm run check` 包含这些回归；最终 PR 矩阵和 main 三平台冒烟提供实际平台验收，main/tag/npm 专项回归与矩阵分别记录。见 [CI 分流](ci-maintenance.zh-CN.md#发布数据与验收策略)。

## Git、终端与包事务

安装验收现要求二十类检查，包含 Git 策略、共享终端能力、持久首次入口及显式版本管理。Windows 回执包含十五项环境场景与九种真实 shell／入口组合；模拟环境本身不能证明实际 shell 启动通过。详见[实现与诊断证据](history/deliveries/m8-m9-delivery.zh-CN.md)。

包测试使用临时 prefix、配置目录、受控 loopback registry 和禁用生命周期脚本的真实 npm。往返、中断及独立恢复前，先核验公开 v3.7.0 归档摘要；可用 `TS06_LEGACY_370_ARTIFACT` 指向已下载副本，仍执行相同摘要检查。runtime 与官方宿主回执必须包含每项操作结果。测试不更改开发者日常 Claude 配置，也不调用模型。当前发布要求见[发布指南](../RELEASING.zh-CN.md#current-typescript-publication)。

版本化证据测试在临时 Git 仓库重建覆盖清单，分别让 v1 和 v2 产品来源经过维护提交、tag 核验和 npm 证据读取。测试修改源码契约版本、历史深度、原始 attempt 或单个阶段回执，要求验证器拒绝。分片须标识实际执行断言的 runner、候选包、Node、npm 和适用的 Claude 可执行文件。

在分支手工触发 `tiered-probe` 可运行代表性的完整与短历史、Windows ARM 三段以及固定宿主作业。探测与自动验收使用同一个物理执行入口。核对各原始分片与阶段耗时，定向重跑时保留其他分片的身份。诊断门禁及制品与可晋升的完整证据分开。

在本地运行固定官方宿主诊断时，每个宿主使用独立的干净 checkout。先前宿主可能在插件的 `.claude-plugin/types` 留下被 Git 忽略的声明。验收类型或测试结果前应核对实际宿主与声明头。[实测样本](ci-efficiency.zh-CN.md)

## 安装包性能尝试

[PERF-01](performance/perf-01.zh-CN.md)维护具有独立身份的已安装 TS→TS 测量方法。
使用安装包模式的 `benchmark`／`benchmark:compare`；旧工作区 worker 仅为描述性诊断，
不能作为安装命令耗时。采集次数与计时分离；冷读／追加准备恢复完整用量索引。
Linux GNU time 记录新子进程峰值 RSS。功能正确是硬门槛，该记录不以最低提速或通过 Python 预算为结论条件。

## 外部 TUI 产品回归

TUI 包维护不依赖 CLI 的纯绘制／状态回归测试，检查完整分组线样式、字段名称与用户原始值、上下文按键提示、Unicode 截断和待确认修改标记，覆盖全部注册语言、七种尺寸及四种色阶。既有迁移命名的后端／PTY 测试保留职责台账；安装包捕获及交付证据另记于[外部 TUI 后续工作](external-tui-parity.zh-CN.md)，终端单元重建不等同于人工桌面或电源验收。

## 历史 Python 与迁移阶段记录

早期命令、阶段结论和验证限制见[历史验收记录](history/acceptance-records.zh-CN.md)。原章节入口如下。

- <a id="i18n-02-验收"></a>[I18N-02 原始验收范围](history/acceptance-records.zh-CN.md#i18n-02-验收)随 v3.15.0 记录。
- <a id="本地检查"></a>[本地检查](history/acceptance-records.zh-CN.md#本地检查)
- <a id="安装包检查"></a>[安装包检查](history/acceptance-records.zh-CN.md#安装包检查)
- <a id="真实计时验收"></a>[真实计时验收](history/acceptance-records.zh-CN.md#真实计时验收)
- <a id="client-与外部入口检查"></a>[Client 与外部入口检查](history/acceptance-records.zh-CN.md#client-与外部入口检查)
- <a id="显示指标检查与性能"></a>[显示指标检查与性能](history/acceptance-records.zh-CN.md#显示指标检查与性能)
- <a id="phase-4-验证"></a>[Phase 4 验证](history/acceptance-records.zh-CN.md#phase-4-验证)
- <a id="v150a1-候选验证记录"></a>[v1.5.0a1 候选验证记录](history/acceptance-records.zh-CN.md#v150a1-候选验证记录)
- <a id="v150-正式验收"></a>[v1.5.0 正式验收](history/acceptance-records.zh-CN.md#v150-正式验收)
- <a id="独立运行检查"></a>[独立运行检查](history/acceptance-records.zh-CN.md#独立运行检查)
- <a id="phase-5-指标迁移"></a>[Phase 5 指标迁移](history/acceptance-records.zh-CN.md#phase-5-指标迁移)
- <a id="phase-5-真实验收"></a>[Phase 5 真实验收](history/acceptance-records.zh-CN.md#phase-5-真实验收)
- <a id="v160-正式版验收"></a>[v1.6.0 正式版验收](history/acceptance-records.zh-CN.md#v160-正式版验收)
- <a id="v161-外部-tui-分组验证"></a>[v1.6.1 外部 TUI 分组验证](history/acceptance-records.zh-CN.md#v161-外部-tui-分组验证)
- <a id="任务计时预览验证"></a>[任务计时预览验证](history/acceptance-records.zh-CN.md#任务计时预览验证)
- <a id="v170-正式验收"></a>[v1.7.0 正式验收](history/acceptance-records.zh-CN.md#v170-正式验收)
- <a id="tui-优化验收"></a>[TUI 优化验收](history/acceptance-records.zh-CN.md#tui-优化验收)
- <a id="client-底部快捷键与大小写"></a>[Client 底部快捷键与大小写](history/acceptance-records.zh-CN.md#client-底部快捷键与大小写)
- <a id="原生主题验收"></a>[原生主题验收](history/acceptance-records.zh-CN.md#原生主题验收)
- <a id="外部终端配色验收"></a>[外部终端配色验收](history/acceptance-records.zh-CN.md#外部终端配色验收)
- <a id="双语界面验收"></a>[双语界面验收](history/acceptance-records.zh-CN.md#双语界面验收)
- <a id="状态栏本地化验收"></a>[状态栏本地化验收](history/acceptance-records.zh-CN.md#状态栏本地化验收)
- <a id="项目查找与导入审阅验收"></a>[项目查找与导入审阅验收](history/acceptance-records.zh-CN.md#项目查找与导入审阅验收)
- <a id="代表性渲染性能基准"></a>[代表性渲染性能基准](history/acceptance-records.zh-CN.md#代表性渲染性能基准)
- <a id="字符簇与预览样式验收"></a>[字符簇与预览样式验收](history/acceptance-records.zh-CN.md#字符簇与预览样式验收)
- <a id="条件显示与外观验收"></a>[条件显示与外观验收](history/acceptance-records.zh-CN.md#条件显示与外观验收)
- <a id="组件组合验收"></a>[组件组合验收](history/acceptance-records.zh-CN.md#组件组合验收)
- <a id="ts-03-e-渲染验收"></a>[TS-03 E 渲染验收](history/acceptance-records.zh-CN.md#ts-03-e-渲染验收)
- <a id="ts-04-安装验收"></a>[TS-04 安装验收](history/acceptance-records.zh-CN.md#ts-04-安装验收)

v3.12.0 来源与包执行检查涵盖命令独立许可、保留入口和受保护清理。参见[验收与交付](source-command-package-management.zh-CN.md#验收与交付)。
