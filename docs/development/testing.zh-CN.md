# 测试与验收

[English](testing.md) | **简体中文**

普通验证全部使用临时 Claude 配置。测试不会安装到用户真实设置，也不会调用模型。

## 本地检查

共享目录/协议测试覆盖严格输入、Unicode 路径和不访问实时来源的样例预览。运行 `python tools/generate_ui_contracts.py --check` 检查 TypeScript 与 Python 定义一致；原生工作流也执行契约测试。参见[协议说明](contracts.zh-CN.md)。

`tests/ui/test_apply_protocol.py` 覆盖加锁前完整草稿校验、两编辑器冲突、等待锁期间的归属变化、外部同名安装、无关设置合并、回滚、v1 迁移、重复保存，以及 CLI/curses/JSON 等价性；还使用安装后的源码 CLI 验证 Unicode/特殊字符路径。官方 Mod 测试覆盖进程拒绝/超时、非法封装、协议不匹配、apply 结果、预览重试、缓存重绘及缩放/关闭后完成的响应。模拟 Mod API 失败时返回 `{ deny: 'reason' }`；直接抛错的测试 stub 会被宿主跳过。

在仓库根目录创建虚拟环境，安装项目和开发工具：

编辑器测试覆盖三页、完整保存和新 revision、取消重开、数值边界、窄面板、目录互斥排序、实际宿主行、锁定/拒绝/部分成功、冲突、未知保存结果、写入保护及旧响应。准备对应宿主声明后运行 `claude plugin test mods/statusline-native`，不调用模型。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e . ruff build twine 'readme-renderer[md]'
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -t . -v
.venv/bin/ruff check --select F,E9 src tests tools
.venv/bin/python tools/check_docs.py
git diff --check
```

Windows 使用 `.venv\Scripts\python.exe` 和 `.venv\Scripts\ruff.exe`，设置 `PYTHONUTF8=1` 以输出 UTF-8。Linux/macOS 的终端集成测试需要原生 curses 和 tmux。平台专属跳过会明确报告；Linux 测试不能替代 Windows/macOS CI。

测试按实现子系统分组。CLI、安装与 PTY/tmux/shell 场景位于 `tests/integration`，生命周期和并发场景位于 `tests/runtime`。`tests/support.py` 统一定位源码，不依赖测试目录的嵌套层级。兼容测试验证旧模块运行入口及函数/类型共享身份。

## 安装包检查

原生工作流检查 Linux 2.1.287/2.1.288/2.1.289/2.1.294 和 Windows/macOS 2.1.288/2.1.289/2.1.294 的实际构建声明、官方插件验证/测试及 TypeScript。`tools/native_install_smoke.py` 验证真实官方 marketplace 安装、绝对后端绑定、完整协议保存、重复安装、外部明确禁用、兼容恢复和卸载，不用认证或模型调用。显式调用的 PTY/人工步骤见[原生入口验证](native.zh-CN.md)；回调测试不能证明终端焦点或视觉表现正确。

按 [发布指南](../RELEASING.zh-CN.md) 从固定提交导出到新目录构建。构建作业先创建本地专属 fixture，再检查它们未进入发行包：

```bash
python tools/inspect_dist.py --write-exclusion-fixtures
python -m build
python tools/inspect_dist.py --check-long-description
```

仅在可丢弃的导出源码中创建 fixture；已有同名文件时工具会拒绝覆盖。检查支持 `--source PATH --dist PATH`，覆盖版本一致性、英文 README 元数据、平台依赖、全部 Python 包文件、两个 skill 模板、双语文档、测试与维护工具。本地 ROADMAP、验收记录、字节码和缓存必须排除。

在隔离环境安装 wheel 后，离开源码目录并把该环境 CLI 加入 PATH：

```bash
python /path/to/source/tools/ci_smoke.py --report /path/to/report.json
```

Smoke 使用带空格和中文的临时路径，验证安装 dry-run、安装、doctor、幂等重装、冲突回滚、渲染和卸载。macOS 桌面验收仍需显式运行 `tools/macos_terminal_smoke.py`，并使用真实 Terminal.app 会话。

## 真实计时验收

以下命令调用付费 Claude 模型，必须显式启动并提供总预算；普通测试和 CI 不运行它：

```bash
.venv/bin/python tools/live_timer_acceptance.py \
  --budget-usd 10 --budget-ledger dist/validation/task-timer/budget.json \
  --report-dir dist/validation/live-timer
```

每次使用新报告目录。Linux 工具只把认证、网关环境和模型选择写入私有临时配置，显式通过 PATH 绑定被测 CLI，并将所属生命周期 hook 替换为调用生产 reducer 的记录器。工具运行单 Agent 和两次并行 Agent 场景。Agent probe 仅运行指定的小型 sleep 命令，无需访问仓库数据。

每次调用将剩余额度传给 Claude 的 `--max-budget-usd`，跨场景累计已知费用；缺少最终费用时保守预留该次完整额度，并停止后续场景。重试预算必须包含此前尝试。官方上限包含子 Agent 费用，但恢复会话的历史费用不会自动计入，因此需独立累计，见 [官方 CLI 说明](https://code.claude.com/docs/en/cli-reference)。

报告记录 OS、Python、包与 Claude 版本、hook 顺序、真实 Agent 启停、等待/收尾阶段、终态证据、原生 duration 是否存在及生产 renderer 的冻结结果。原始 stream、hook payload 和隔离设置留在忽略的报告目录，只公开脱敏事实。Print 模式验收用于确定事件顺序，不代表交互终端视觉验收；原生 duration 的可用情况需如实报告。

单次并行验收中，Agent 可能在首个主 Stop 前结束，因此跳过等待阶段。整组验收仍要求至少一次真实等待 → 收尾顺序，每轮都必须保留原任务与冻结的渲染结果。已采集会话可不调用付费模型而重新检查：

```bash
.venv/bin/python tools/live_timer_acceptance.py verify-existing dist/validation/live-timer
```

计时行为发布必须满足所有适用门槛，包括真实计时证据；本轮 UI 晋升不调用付费套件。另见 [计时约定](timer.zh-CN.md) 和 [架构](architecture.zh-CN.md)。

原生 wheel 必须逐字节包含唯一维护源的运行文件与版本/协议/哈希清单，排除测试、开发依赖和宿主声明；sdist 包含 `src/build_native.py` 及 Mod 开发源，独立重建后包文件、metadata、入口应一致。

## Client 与外部入口检查

v1.3.0 检查四种安装组合、分别关闭、旧 owned 外部资源恢复、第三方命令冲突、重装、降级和卸载。Python 测试覆盖外部与 Client 两种保存顺序，验证旧草稿冲突时无覆盖、无多余备份，且保留无关配置。

固定宿主官方测试覆盖真实 Client 模块、Space/Tab/方向键、搜索快捷键隔离、Ctrl+G、数值边界、批次确认/去重/缺口、同帧快速输入、宿主冻结快照、旧 epoch、重复打开、保存锁与结果核对、Client 恢复、预览缓存及迟到响应。布局检查包含 32×12、分组边框、CJK 和组合字符。

Linux 自动 PTY 在 120×30 停靠及 80×48 内嵌布局检查点击获焦、三页、保存、取消、Esc 和继续同一 session。持久模式使用私有 tmux server，同时安装两条入口，验证原有外部 popup 保存后 Client 读取新值。执行 `tools/native_mod_acceptance.py --persistent --report-dir dist/validation/<新目录>`；原始数据私有保存，不进分发包。wheel/sdist/重建 wheel 核对 Client 模块清单。普通检查不调用付费模型。

2026-10-04 维护者分别确认 a2 Client 在 Linux、Windows、macOS 真人验收通过。正式晋升沿用已验收交互；自动检查另验证安装策略和发布资产。新增覆盖两个正式默认、明确 false、2.1.257/258/286/287/288 及未知版本、旧宿主显式启用、暂挂回滚及主动插件禁用。官方安装 smoke 另核实真实默认安装、关闭后重装不反弹。本轮不调用付费模型/计时套件。

干净提交 `9c9d553` 构建的 v1.4.0 wheel 通过核心／官方安装 smoke，并保存完整作用域目录。Linux Claude Code 2.1.289 持久 PTY 在 120×30、80×48 分别验证默认选择和 27 项选择（三个既有项加全部 24 个新增主栏项），共四组通过。Agent 目视检查使用真实捕获单元格的重建画面，`manual_visual_acceptance` 保持 false；原始报告保留在忽略的 dist/validation。

## 显示指标检查与性能

Token 回归另覆盖输入／输出部分观测、明确零值、非法字段、各计数器独立累计快照增量、嵌套子 Agent 归属、折叠消息 ID 及旧缓存一次恢复、不重复扫描。最终本地运行 478 项测试：470 项通过，八项预期平台跳过。

独立指标测试使用固定时钟，覆盖缺失／合法零值、作用域来源及无副作用预览。Git 与 transcript 延迟采集且每次刷新共享结果。使用隔离的本地样例分别记录启动与采集耗时，不调用模型：

```text
python tools/benchmark_render.py --samples 30 --report dist/validation/display-performance.json
```

默认 warm 模式先预热隔离的字节码目录；`--bytecode-mode cold` 使用空目录并禁止写入，避免源码更新造成旧代码读缓存、新代码每次重新编译的不公平比较。改动前后在同一机器、同一 Python 比较 P50／P95；报告记录被测提交。冷 transcript 样例使用不同会话，热样例复用状态。这是可复现的小样例基线，不代表大型仓库或会话历史的耗时上限。

Linux x86_64／Python 3.14.4、隔离的热字节码各 50 次采样：基线 `0670e0d`，完整显示代码 `50eb39f`，相同工具 SHA256 `8917e61f6e01a3c527fb94054af6c69d99d5d8805416707a48c039bc9054884e`。小型本地样例与调度噪声限制结论；渲染样例仅选择 model-with-effort。下表单位 ms，Before／After 为改动前／后。

| Metric (ms) | Before P50 / P95 | After P50 / P95 |
| --- | --- | --- |
| Python startup | 15.529 / 24.098 | 17.438 / 24.191 |
| Model-only render process | 48.119 / 59.094 | 50.133 / 59.574 |
| Git cold | 2.730 / 2.952 | 2.901 / 3.243 |
| Git warm | 0.010 / 0.016 | 0.036 / 0.048 |
| Transcript cold | 0.403 / 0.532 | 0.483 / 0.822 |
| Transcript warm | 0.126 / 0.153 | 0.141 / 0.165 |

## Phase 4 验证

高级表单回归覆盖逐项文本／格式、数字边界、字段取消、分行维护及仅明确保存才写设置的文件操作。原生测试覆盖输入中的快捷键字符、实际宿主行别名、缺失／不支持／锁定、类型／选项变化、逐项部分成功，以及工具 Save 与宿主 Apply 独立。Unicode 文本验证与 Python 一致，256 字符限制按码点计算。

从安装的 wheel 运行 `tools/native_mod_acceptance.py --persistent --advanced --report-dir dist/validation/<new-directory>`，真实检查 curses 弹窗 Ctrl+S、Client 保存／回读、中文路径、导入错误、未保存草稿导出、取消及两种尺寸的显式布局。维护者已于 2026-10-05 确认人工验收，macOS 范围为独立 TUI／CLI；CI 增加固定 Linux 2.1.289，保留原有平台矩阵。

### v1.5.0a1 候选验证记录

2026-10-05，预览 Python 507 项通过（499 项通过、8 项平台跳过），官方 Mod 40 项通过。干净 `07804ba` 的 v1.5.0a1 wheel 安装后通过核心／真实官方安装 smoke 与 120×30／80×48 高级持久 PTY，包括主题／逐轮计时 Apply／Reload 和工具保存独立性；重定基后的 `e978411` 源文件树字节一致。代理视觉检查见[图片索引](../images/archive/README.zh-CN.md#v150a1-phase-4-终端重建画面)，捕获时人工验收待确认，2026-10-05 已确认通过（macOS 独立 TUI／CLI）。

同机 Python 3.14.4、相同脚本 SHA256 前缀 `0f299dcff19d`、隔离预热字节码、50 样本，基线 `6c7826e` 与格式代码 `a040243`：

| 指标（ms） | 改前 P50 / P95 | 改后 P50 / P95 |
| --- | --- | --- |
| Python 启动 | 15.879 / 23.208 | 14.793 / 20.556 |
| 模型单项渲染进程 | 51.170 / 61.929 | 55.245 / 63.612 |
| Git 冷 | 2.712 / 3.209 | 3.006 / 5.517 |
| Git 暖 | 0.036 / 0.053 | 0.010 / 0.014 |
| Transcript 冷 | 0.458 / 0.618 | 0.451 / 0.582 |
| Transcript 暖 | 0.142 / 0.162 | 0.139 / 0.150 |

模型单项 P50 增约 4.1 ms（8%），P95 增约 1.7 ms；五项格式／显式布局为 52.690/60.660、53.498/62.186 ms，与基线不是同一显示样例。调度噪声、小样例及缓存状态限制结论，不能作为性能上限。使用 `--display-case legacy|formatted|explicit` 重现，基线用相同新脚本与原运行代码；按需采集继续由回归覆盖。

## v1.5.0 正式验收

2026-10-05，维护者确认 Phase 4 在 Linux、Windows，以及 macOS 的独立 TUI／CLI 入口人工验收通过；未提供具体 OS、架构、终端和宿主版本。本次确认不表示此前 macOS 会话内 Client 输入问题已修复。

正式版调整包／Mod 版本及发布默认值，格式、布局、可移植文件、宿主应用与已验收输入行为沿用已验证预览。自动 CI／PTY 与代理视觉检查分别记录；历史图片保留 a1 文件名、捕获哈希及原始源码提交。

## 独立运行检查

运行 `python tools/generate_runtime_contracts.py --check`、`python -m unittest tests.runtime.live.test_protocol tests.runtime.live.test_store tests.integration.test_runtime_installer`，以及固定 2.1.289 的运行 Mod 验证／测试／类型检查。`python tools/runtime_install_smoke.py --report PATH` 仅使用临时配置，不调用模型。CI 保留全部旧编辑器检查并增加 Windows／macOS 2.1.289。模拟协议心跳验证桥接，不代表真实会话加载。另见[实时契约](live.zh-CN.md)。

## Phase 5 指标迁移

显示 schema v4 新增可空 `metrics.branch_diff_base_ref`；配置协议 v3 在两个编辑器、冲突、预览和便携文件中保留它。v1/v2/v3 读取不写盘，真实保存才备份迁移；独立运行观测协议仍为 v1。已提交分支差异和已结束代理时长冻结见[指标定义](../DISPLAY_ITEMS.zh-CN.md)。

## Phase 5 真实验收

使用 `tools/live_metrics_acceptance.py --root dist/validation/phase5/CASE --case single|single-agent|parallel --budget-ledger dist/validation/phase5/budget.json --run-real-calls`。既有 ledger 必须明确授权 10 美元，全部尝试和重试共享加锁预留；费用未知保留整次额度。省略 --run-real-calls 可免费重验记录；不得新建账本重置支出。工具隔离配置，仅允许 Agent 与 sleep，验证真实请求汇总、最新请求时长、主线程收尾和多次冻结代理渲染，保持遥测导出设置。Headless 检查不代表人工或 Windows/macOS 会话交互验收。

## v1.6.0 正式版验收

2026-10-05，维护者确认 v1.6.0a1 在 Linux、Windows、macOS 验收通过；未提供具体 OS、架构、终端和宿主版本。这是新增的 Phase 5 验收记录，与历史编辑器确认及自动／headless／PTY 证据分开记录。已有 macOS Client 输入限制继续保留。正式 v1.6.0 沿用已验收运行实现、显示 schema v4、配置协议 v3 和运行协议 v1；兼容宿主的编辑器默认启用并保留明确 false，实时采集继续独立默认关闭并保留偏好。

晋升重验正式默认行为、a1 升级偏好保留、两 Mod／后端版本绑定、全部平台 CI 及已安装分发包／PTY。单代理／并行／主线程收尾捕获记录可免费重验；本次仅版本／默认行为变更，不重置原有 10 美元账本，也不重复付费套件。

## v1.6.1 外部 TUI 分组验证

本地 561 项 Python 测试中 553 项通过、8 项预期平台跳过；native 41 项与 runtime 8 项官方 Mod 测试、双 TypeScript、生成契约及 Ruff 通过。新增 UI 回归覆盖连续归组、稳定字段 key、标题不可选中、跨组分页、中文／组合字符、0／8／16／256 色和全部页面的绘制边界。64×18／19 使用紧凑分隔，64×20 起使用边框。

安装匹配 wheel 后，在隔离环境额外安装 `pyte`，运行下列免费 PTY 验证；每次使用新的报告目录。它以私有配置检查四页、格式详情、输入中缩放、取消不写盘和重排后的数值保存，尺寸为 64×18、64×20、80×24、120×30、80×48：

```bash
python tools/external_tui_acceptance.py --backend /absolute/venv/bin/claude-statusline \
  --report-dir dist/validation/external-tui-NEW --commit SOURCE_COMMIT
```

截图用 `tools/render_native_capture.py --surface external --bounds 0 0 COLUMNS ROWS --commit SOURCE_COMMIT` 从真实捕获 JSON 重建；Pillow 和字体仅用于文档。原始数据、隔离配置和构建留在忽略的 dist/validation，分发包只含公开图片与脱敏来源。自动 PTY、代理视觉检查与真人验收分别记录；历史人工确认不作为本次展示修改的新增真人验收。双入口还须运行匹配 wheel 的持久高级 PTY，核实外部保存后的 Client 互读。全部 20 项 PR／合并／标签 CI 与正式资产检查继续适用。

## 任务计时预览验证

任务计时预览通过 590 项 Python 测试（582 项通过、8 项预期平台跳过）、41 项原生编辑器及 10 项运行 Mod 官方测试，以及两个 TypeScript 项目、官方静态验证、生成契约、Ruff 和文档链接检查。安装验证覆盖默认仅计时元数据、持久显式关闭、独立开关、安装事务备份迁移及诊断绑定；回归覆盖 Stop 续跑、迟到原生结束、未闭合／重叠等待、时钟失效／重启／Windows 校时、历史冻结值、报告／消息别名与提交索引追加／替换。

真实 Linux x86_64／Python 3.14.4／Claude Code 2.1.289 已验证单 Agent、并行及收尾、阻止 Stop 后续跑、自动 SDK 问题等待／中断、默认原生计时及关闭后的兼容采集。生产计时可用时冻结，不完整执行证据隐藏。真实并行任务约 14.1 秒，最后原生单轮为 3.7 秒。全部尝试及重试共用原 10 美元账本，初始证据费用 0.801859 美元，无未知费用。SDK 回复为受控输入，不是真人验收；真实机器睡眠及真实 Windows/macOS 模型会话待验，CI 和模拟时钟独立记录。

必须使用既有账本和新案例目录，不得新建账本重置花费。`wait`／`interrupt` 额外需要可选验收依赖 `claude-agent-sdk`，SDK 使用 PATH 中实际宿主。不加 `--run-real-calls` 即仅复核已有记录：

```bash
.venv/bin/python tools/task_timer_acceptance.py \
  --root dist/validation/task-timer/parallel \
  --case parallel --backend /absolute/venv/bin/claude-statusline \
  --budget-ledger dist/validation/task-timer/budget.json \
  --cap-usd 1 --run-real-calls
```

案例为 `single`、`single-agent`、`parallel`、`stop-continue`、`wait`、`interrupt`、`compat`。费用未知时保留全部额度，阻止新增付费尝试；旧计时脚本同样要求此账本，并保留历史记录复核。原始流、SDK 输入和私有配置保留在忽略的 `dist/validation`。

同一解释器和机器、相同脚本 SHA256 `808a8b5224fa52584bfa0b9ac09ee052e64dac2b186391af1a0fa5fbcfbf6b4f`，在各源码 PYTHONPATH 下运行 `tools/benchmark_task_timer.py --samples 30 --report PATH`，比较基线 `4268743` 与任务计时实现。样例覆盖 100／10,000／100,000 行、1／32 任务，启动另使用单 prompt 生产 renderer：

| Metric (ms) | Before P50 / P95 | After P50 / P95 |
| --- | --- | --- |
| Python startup | 15.548 / 18.292 | 13.667 / 18.026 |
| Timer imports | 40.502 / 50.502 | 40.548 / 51.444 |
| Timer render process | 51.673 / 60.577 | 53.221 / 62.110 |
| Hot refresh: 100,000 rows, 32 tasks | 0.001 / 0.009 | 0.001 / 0.002 |
| Terminal: 100 rows, 32 tasks | 0.021 / 0.023 | 0.048 / 0.056 |
| Terminal: 10,000 rows, 32 tasks | 0.861 / 0.893 | 0.048 / 0.061 |
| Terminal: 100,000 rows, 32 tasks | 9.486 / 9.595 | 0.048 / 0.061 |

未变化的热刷新不读取 transcript；终态查找复用有界游标索引。100,000 行／32 任务（16.6 MB）的首次提交索引从 9.84 ms 变为 22.44 ms，仍需扫描一次源文件。计时 renderer 启动 P50 增加约 1.5 ms；本地样例、调度和缓存噪声限制结论，不构成性能上界。原始历史和路径报告保持私有。

## v1.7.0 正式验收

2026-10-07，维护者确认 v1.7.0a1 预览已在 Linux、macOS、Windows 完成验证，未提供具体 OS、架构、终端和 Claude Code 版本。该确认记录平台验收；自动 CI、SDK 受控场景和硬件睡眠／恢复证据继续分别记录。

正式 1.7.0 沿用已验收任务计时实现和协议。使用安装包核验正式编辑器默认、已保存关闭选择、兼容／未知宿主以及 a1 到正式版的资源／后端升级。继续运行现有 590 项 Python、51 项官方 Mod 测试、生成契约、TypeScript、Ruff、文档和全部 PR／合并／标签 CI。稳定 wheel 免费复核六个捕获场景，保留原 0.801859 美元账本，并核验独立重建、双编辑器 PTY、草稿／公开资产和 URL 安装。详见[正式 Release 记录](../releases/v1.7.0.md)。

## TUI 优化验收

分组分页回归覆盖实际可见行、跨页分组、无孤立标题、边界翻页及页内位置保留。绘制检查四页与格式详情在 32×12、64×18、64×20、80×24、120×30 和 80×48 的布局，并验证缩放期间保留输入及字段 key。快捷键检查普通说明、独立粗体按键（Client 使用宿主主题主要文字色）、完整提示组裁剪、中文／组合字符及外部 0／8／16／256 色。

运行本页全部检查、两个 Mod 官方验证／测试与 TypeScript；使用新报告目录运行外部五尺寸 PTY，以及 `native_mod_acceptance.py --persistent --advanced` 的已安装 Client／外部互读、逐项格式、布局、文件与宿主偏好测试。验收脚本按稳定字段身份定位，报告保留源提交与宿主版本。原始捕获只用于目视验收，图库 PNG 与来源记录不变；自动化检查不建立新真人验收。

## Client 底部快捷键与大小写

原生回归检查主题强调色 Configure Status Line 标题、大写按键／小写说明、所有页面 Tab 优先顺序、H/A/搜索／编辑／恢复条件提示、完整组换行、一行实际样例及共享的底部／分页预算。覆盖 32×12、32×13、48×12、64×18、64×20、80×24、120×30、80×48，以及字段、路径、数值／搜索输入、展开偏好、忙碌和结果不明状态。大小写检查保留混合大小写文本、中文和组合字符，覆盖 Ctrl/Meta、Ctrl+E/G/U、Shift+Tab；官方挂载测试也验证大写操作和原样文本输入。

已安装持久 PTY 脚本比较新标题与 Preview 的真实终端颜色，检查 S save 按键／说明样式及页面提示顺序，并在原有编辑、缩放、配置互读流程中验证大写保存／完成／丢弃／偏好操作和混合大小写条目文本。使用新的忽略报告目录并检查终端捕获重建，保留历史图库；自动化与真人／平台验收分别记录。完整 PR／合并／标签 CI 与安装包要求见发布指南。

## 原生主题验收

每个受支持主题使用独立的忽略目录：

```bash
.venv/bin/python tools/native_mod_acceptance.py --theme light --terminal-theme light --theme-only \
  --report-dir dist/validation/theme-light
```

在支持的宿主上依次检查 dark、light-daltonized、dark-daltonized、light-ansi、dark-ansi、auto 和 `custom:statusline-validation-light`。自定义夹具以 light 为基础，明确覆盖正文、反色、辅助色和强调色。每次在 120×30 与 80×48 捕获四页及项目格式表单，按解码后的背景检查快捷键／说明对比度，并验证主题草稿不提前生效、独立 Apply 成功且不保存工具草稿。读取主题时优先采用当前 settings，再兼容旧全局存储。保存与跨编辑器互读另运行完整 persistent／advanced 验收。

`tools/terminal_colors.py` 在处理反色前分别解析默认前景和背景，验收与捕获渲染共用该逻辑。RGB 单元格精确；ANSI 名称使用已记录的捕获调色板，不代表物理终端的自定义 ANSI 颜色。重建图片属于终端证据，与系统截图、真人验收分别记录。

原生捕获脚本将 `--terminal-theme light|dark` 与 `--theme` 独立设置。在新的报告目录中运行四种深浅组合；每次捕获 default／ANSI 和 Colors off，通过键盘选择匹配的预览底色，检查全部预览单元格使用该标准底色，并记录终端默认前景／背景、共享 xterm ANSI 调色板和明确的分析夹具来源。夹具不修改物理终端配置。UI 测试覆盖加载／错误、溢出、中文／组合字符及宿主容器隔离；实际宿主另检查主题单独 Apply 与工具配置保持不变。

## 外部终端配色验收

`ui.theme` 使用终端默认主界面、粗体按键／标题、普通说明及反色选择。测试覆盖四页及项目格式表单的 0／8／16／256 色、颜色启动／默认色失败、有限颜色对分配、ANSI／RGB 样例映射和终端默认预览背景。外部最低尺寸仍为 64×18；32×12 验证缩放／取消提示，工作尺寸检查单元格边界、中文／组合字符和状态保留。

使用已安装 wheel，在两组终端默认色夹具中运行，每次使用新的忽略报告目录：

```bash
.venv/bin/python tools/external_tui_acceptance.py \
  --backend /path/to/installed/claude-statusline --commit COMMIT_HASH \
  --terminal-theme light --report-dir dist/validation/external-light
```

再用 `--terminal-theme dark` 和另一报告目录运行。该选项为捕获分析提供默认色，不修改物理终端配置。两组夹具均覆盖 64×18、64×20、80×24、120×30、80×48、四页、格式表单、数值输入／错误、缩放、字节一致的取消及保存互读。每次捕获检查默认主界面及反色选择至少 4.5:1 的对比度、粗体按键／普通说明、终端默认预览背景、Palette default／ansi 与 Colors off 草稿，以及保存后的 ANSI 生产输出。捕获元数据记录默认前景／背景及 xterm ANSI 调色板，图片绘制读取该调色板。真实终端配置与真人验收分别记录。

本补丁本地 Python 检查通过 659 项测试（651 项通过、八项预期平台跳过）；Claude Code 2.1.295 官方 Mod 测试通过 59 项 native 与十项 runtime。两个 TypeScript 项目使用准确 2.1.294 生成声明：2.1.295 无登录类型加载在生成声明前停于登录检查。固定 CI 宿主保留现有版本，以及 13 项 Python／构建和十项 Mod 门槛。
