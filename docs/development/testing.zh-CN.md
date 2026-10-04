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
.venv/bin/python -m pip install -e . ruff build
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -t . -v
.venv/bin/ruff check --select F,E9 src tests tools
.venv/bin/python tools/check_docs.py
git diff --check
```

Windows 使用 `.venv\Scripts\python.exe` 和 `.venv\Scripts\ruff.exe`，设置 `PYTHONUTF8=1` 以输出 UTF-8。Linux/macOS 的终端集成测试需要原生 curses 和 tmux。平台专属跳过会明确报告；Linux 测试不能替代 Windows/macOS CI。

测试按实现子系统分组。CLI、安装与 PTY/tmux/shell 场景位于 `tests/integration`，生命周期和并发场景位于 `tests/runtime`。`tests/support.py` 统一定位源码，不依赖测试目录的嵌套层级。兼容测试验证旧模块运行入口及函数/类型共享身份。

## 安装包检查

原生工作流检查 Linux 2.1.287/2.1.288 和 Windows/macOS 2.1.288 的实际构建声明、官方插件验证/测试及 TypeScript。`tools/native_install_smoke.py` 验证真实官方 marketplace 安装、绝对后端绑定、完整协议保存、重复安装、外部明确禁用、兼容恢复和卸载，不用认证或模型调用。显式调用的 PTY/人工步骤见[原生入口验证](native.zh-CN.md)；回调测试不能证明终端焦点或视觉表现正确。

按 [发布指南](../RELEASING.zh-CN.md) 从固定提交导出到新目录构建。构建作业先创建本地专属 fixture，再检查它们未进入发行包：

```bash
python tools/inspect_dist.py --write-exclusion-fixtures
python -m build
python tools/inspect_dist.py
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
  --budget-usd 10 --report-dir dist/validation/live-timer
```

每次使用新报告目录。Linux 工具只把认证、网关环境和模型选择写入私有临时配置，显式通过 PATH 绑定被测 CLI，并将所属生命周期 hook 替换为调用生产 reducer 的记录器。工具运行单 Agent 和两次并行 Agent 场景。Agent probe 仅运行指定的小型 sleep 命令，无需访问仓库数据。

每次调用将剩余额度传给 Claude 的 `--max-budget-usd`，跨场景累计已知费用；缺少最终费用时保守预留该次完整额度，并停止后续场景。重试预算必须包含此前尝试。官方上限包含子 Agent 费用，但恢复会话的历史费用不会自动计入，因此需独立累计，见 [官方 CLI 说明](https://code.claude.com/docs/en/cli-reference)。

报告记录 OS、Python、包与 Claude 版本、hook 顺序、真实 Agent 启停、等待/收尾阶段、终态证据、原生 duration 是否存在及生产 renderer 的冻结结果。原始 stream、hook payload 和隔离设置留在忽略的报告目录，只公开脱敏事实。Print 模式验收用于确定事件顺序，不代表交互终端视觉验收；原生 duration 的可用情况需如实报告。

单次并行验收中，Agent 可能在首个主 Stop 前结束，因此跳过等待阶段。整组验收仍要求至少一次真实等待 → 收尾顺序，每轮都必须保留原任务与冻结的渲染结果。已采集会话可不调用付费模型而重新检查：

```bash
.venv/bin/python tools/live_timer_acceptance.py verify-existing dist/validation/live-timer
```

发布前必须满足所有门槛，包括真实计时证据。另见 [计时约定](timer.zh-CN.md) 和 [架构](architecture.zh-CN.md)。

原生 wheel 必须逐字节包含唯一维护源的运行文件与版本/协议/哈希清单，排除测试、开发依赖和宿主声明；sdist 包含 `src/build_native.py` 及 Mod 开发源，独立重建后包文件、metadata、入口应一致。

## 新原生编辑器检查

v1.3.0a1 新增直接项目控件、未启用/过滤排序、分页与焦点目标、正文 32×12 边界、高度变化复用预览、CJK 标签截断、数字独立接受、Finish 和待应用宿主偏好覆盖。官方测试派发焦点事件；真实 API 焦点及绘制在 Linux 120×30、80×48 PTY 检查，另要求新一轮真人验收。回调测试不能证明 Client 自动获得键盘。嵌套运行资源在暂存、官方缓存及 wheel/sdist 中核对。常规检查使用临时配置，不调用付费模型。
