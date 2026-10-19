# 迁移后审查问题与文档更新清单

[English](post-migration-review.md) | **简体中文**

更新日期：**2026-10-19**（Asia/Shanghai）。四个专项合并后，共有 **6 项 TypeScript 迁移问题、5 项 Python 基线已有问题或共同风险，以及 5 类现有文档冲突**。6 项迁移问题中，5 项经过实际执行复现；Windows 桥接问题的 Windows 影响由静态推导，仍需实机验证。

下文保留原整理基线的问题与待处理语境。后续 [v3.1.3 修复记录](post-migration-fixes.zh-CN.md)跟踪 R01–R06、B01–B05、D01–D05 的实现、验证及交付状态。原优先级和证据保留，缺失的实机／人工验收单独记录。

## 基线与来源

四个 session 均固定 TypeScript 为干净 `main` 的 `1fa57c9ebfbb6ee76a1258939c3211145d55f719`，Python 为 v2.0.0 的 `9b6d2fab4bf165be280d428a874521bfbf02c7e1`。整理时仓库 HEAD 仍是该 TypeScript 提交。下列源码行号对应这个基线；所引用 Python 归档文件已逐字节核对。

| 来源 session | ID | 迁移问题 | 基线问题或共同风险 |
| --- | --- | ---: | ---: |
| [03_审查任务计时和生命周期状态机](codex://threads/01a151a0-b1e0-7950-bebe-3a0470ad7dcf) | `01a151a0-b1e0-7950-bebe-3a0470ad7dcf` | 0 | 2 |
| [04_审查指标采集和原始数据解释](codex://threads/01a151b2-e68d-7da1-af9b-1cae492330f4) | `01a151b2-e68d-7da1-af9b-1cae492330f4` | 1 | 2 |
| [05_审查CLI、外部 TUI、原生编辑器与后端的端到端接线](codex://threads/01a151c0-9757-7fd0-b9e2-dc3925318dae) | `01a151c0-9757-7fd0-b9e2-dc3925318dae` | 2 | 0 |
| [06_发行包和安装生命周期](codex://threads/01a151d7-4bd0-7a41-9c05-2b34f3487193) | `01a151d7-4bd0-7a41-9c05-2b34f3487193` | 3 | 1 |

计数按独立问题组计算：`doctor` 缺失的三类检查合为 R03；R02 的 PATH 命令归属错误与 R06 的 PATH 冲突误报分开保留，因为触发路径和影响不同。原始实验、测试通过数属于各 session 的历史证据，本次没有重新运行这些复现，也不累加可能重叠的测试数。

## TypeScript 迁移问题

| 编号 | 优先级 | 问题与用户影响 | 证据 | 来源 |
| --- | --- | --- | --- | --- |
| R01 | P1 | Windows 文件设备号表示不一致时，外部编辑器桥接误拒绝正常文件，无法完成握手或读取结果 | Windows 静态推导；Linux 安装包注入差异复现 | 06 |
| R02 | P2 | PATH 形式 renderer 被判为外来安装，阻断编辑器打开和保存 | 实际执行 | 05 |
| R03 | P2 | `doctor` 漏检损坏技能、不可写运行目录和非法宿主字段，错误返回成功 | Linux 实际安装包对照 | 06 |
| R04 | P3 | 异常类型的 `prompt_id` 被转换为当前任务回退，借用了其他任务的状态和 token | 实际 CLI 执行 | 04 |
| R05 | P3 | `--language` 与 `--version` 组合从成功变为退出 2，版本探测脚本失败 | 实际 CLI 执行 | 05 |
| R06 | P3 | 健康 npm 安装被 `doctor` 误报为 PATH 冲突 | HEAD 包和公开 npm 3.1.2 包实测 | 06 |

### R01 Windows 外部编辑器桥接误拒绝文件

- **触发与差异：** 原报告指出 Windows／Node 24.0.0 下，路径统计可能返回 `dev=0`，句柄统计返回非零卷号。TS 直接比较两者，可能将同一正常文件判为已替换；Python 使用 CPython 的文件身份检查。Linux 安装包注入该差异时稳定报 `Invocation file changed while opening`。
- **定位：** TS [bridge.ts:67](../../packages/platform/src/terminal/bridge.ts#L67)；Python [bridge.py:296](../../archive/python/src/claude_statusline/integration/bridge.py#L296)。仓库已有 [Windows 统计兼容性记录](node-regional-languages.zh-CN.md)。Windows 的具体受影响补丁版本和卷条件尚未确定。
- **漏测与最小补例：** 现有 Windows 包测试直接运行 `configure`，未走 request／started／result 完整桥接。应在真实 Windows、Node 24.0.0 经安装后的外部入口启动并取消编辑器，核对握手和结果；同时保留实际文件替换必须被拒绝的对照。不能把 Linux 注入实验记为 Windows 实机通过。

### R02 PATH 形式 renderer 阻断编辑和保存

- **触发与差异：** `settings.json` 使用 `statusLine.command = "claude-statusline render"`，PATH 已指向当前 Node／JS 安装。Python 返回 `installed: true`、正确宿主字段，并能打开、保存、重开；TS 渲染正常，却返回 `installed: false` 和默认宿主值，外部 TUI 退出 2，保存报 `ownership_mismatch`，磁盘保持旧值。子代理 renderer 同样受影响，原生编辑器也受相同后端检查阻止。
- **定位：** TS [commands.ts:96](../../packages/platform/src/commands.ts#L96)、[host.ts:30](../../packages/cli/src/config/host.ts#L30)；Python [ownership.py:128](../../archive/python/src/claude_statusline/integration/ownership.py#L128)。TS 在 canonical PATH 名称兼容判断前，就按 Node／JS 前缀长度拒绝参数；[共享契约](contracts.zh-CN.md)仍承诺 PATH 兼容。
- **漏测与最小补例：** 归属测试的旧式绑定使用空 `args`，真实 CLI 测试使用完整 Node／JS 命令，缺少交叉组合。补充真实 PATH 入口、canonical 命令、读取宿主值、打开编辑器、保存和重开；保留拒绝其他绝对安装路径的断言。

### R03 Doctor 对不可用安装返回成功

在各自健康安装上分别制造下列状态，结果均已实际执行确认：

| 触发状态 | Python | TypeScript |
| --- | --- | --- |
| 技能正文损坏，但所有权标记仍有效 | 退出 1 | 退出 0，报告技能 OK |
| `statusline_runtime` 可读，但当前用户不可写 | 退出 1，指出不可写 | 退出 0 |
| 宿主字段非法，如 `padding=true` 或 `refreshInterval=0` | 退出 1 | 退出 0，报告状态栏已拥有 |

- **影响与定位：** 诊断会放过损坏的配置技能、无法写入运行状态的安装和非法宿主设置。TS [doctor.ts:64](../../packages/cli/src/integration/doctor.ts#L64)仅检查命令归属，[doctor.ts:88](../../packages/cli/src/integration/doctor.ts#L88)仅检查技能存在性及标记，缺少对应运行目录写权限检查。Python 对应 [doctor.py:192](../../archive/python/src/claude_statusline/integration/doctor.py#L192)、[243](../../archive/python/src/claude_statusline/integration/doctor.py#L243)、[668](../../archive/python/src/claude_statusline/integration/doctor.py#L668)。
- **漏测与最小补例：** 现有测试覆盖技能缺失、显示配置损坏和 feature 文件权限，未覆盖表中三个状态。分别引入这些状态，断言退出 1、诊断原因正确且不改写配置。写权限用例应使用实际当前用户权限条件。
- **文档关联：** D05。诊断能力描述与实现需要一起闭合，不能仅靠删除文档承诺掩盖检查缺失。

### R04 异常 prompt ID 借用当前任务指标

- **触发与差异：** 高级采集已启用，当前任务 `p` 的输入、缓存创建、缓存读取、输出分别为 2、3、5、7。传入 `prompt_id:42` 时，Python 输出 `State — · Prompt in — · Prompt out —`；TS 输出 `State completed · Prompt in 10 · Prompt out 7`。其中 `10=2+3+5` 来自任务 `p`，异常 ID 并未证明归属。非空对象、数组也复现；合法字符串、未知字符串及 `null` 的对照符合原行为。真实宿主是否会发送这些异常类型尚未确认。
- **定位：** TS [environment.ts:77](../../packages/cli/src/rendering/environment.ts#L77)将异常值变为 `null`，[snapshot.ts:17](../../packages/core/src/runtime/live/snapshot.ts#L17)随后回退当前任务；Python [items.py:229](../../archive/python/src/claude_statusline/rendering/items.py#L229)、[snapshot.py:63](../../archive/python/src/claude_statusline/runtime/live/snapshot.py#L63)。
- **漏测与最小补例：** 现有 live 测试直接向解析器传字符串或 `null`，绕过渲染环境。经完整 `render` 链路分别传数字、对象、数组，断言不借用当前任务指标，并保留合法及缺省 ID 对照。

### R05 语言参数与版本查询组合失败

- **触发与差异：** `claude-statusline --language en --version` 和 `claude-statusline --language=en --version`。Python 将版本写到 stdout、stderr 为空、退出 0；TS stdout 为空、stderr 为 `unknown command: --version`、退出 2，影响统一附加语言参数的版本探测脚本。
- **定位：** TS [main.ts:31](../../packages/cli/src/main.ts#L31)、[main.ts:99](../../packages/cli/src/main.ts#L99)只提前处理单独的 `--version`，移除语言参数后未再次处理；Python [cli.py:34](../../archive/python/src/claude_statusline/cli.py#L34)使用全局 version action。
- **漏测与最小补例：** [现有版本测试](../../packages/cli/test/final-cli.test.ts#L5)只覆盖单独选项。补充语言选项的分离式和等号式组合，分别验证退出码、stdout 与 stderr。已批准的人类可读文案差异不包含这类退出码改变。

### R06 健康 npm 入口被误报为 PATH 冲突

- **触发与差异：** npm 全局命令目录在 PATH 首位，通过该目录的命令安装并运行 `doctor`。TS 报 `PATH selects another entry`，指向的却是刚调用的同一入口；退出码仍为 0。Python 健康安装报告实际可执行文件正常。该问题在 HEAD 构建包和公开 npm 3.1.2 包均复现。
- **定位：** TS [doctor.ts:23](../../packages/cli/src/integration/doctor.ts#L23)将 PATH 命令与内部 JS 参数比较；[外层 npm bin](../../tools/build/pack.ts#L65)与[内部 entry.js 绑定](../../packages/cli/src/main.ts#L107)本来就是不同文件。Python 对照 [doctor.py:155](../../archive/python/src/claude_statusline/integration/doctor.py#L155)。
- **漏测与最小补例：** 包验收主要直接运行 `node entry.js`，未将 npm 命令目录放入 PATH。分别覆盖当前 npm 入口和另一套保留的 Python 入口：前者不应告警，后者应正确报告冲突。该问题与 R02 的保存阻断不能互相替代。

## Python 基线已有问题和共同风险

这五项同样待处理，但不标记为迁移新增回归。

| 编号 | 原优先级 | 问题与用户影响 | 来源 |
| --- | --- | --- | --- |
| B01 | P2 | 等待期间墙钟前拨，活跃执行时长少计且被标为可信完整值 | 03 |
| B02 | P2 | 缺少 `turn_start`，仍把未知活跃时长显示为精确 0 秒 | 03 |
| B03 | P2 | transcript 被同路径更大文件替换，旧游标跳过新消息，漏计 token | 04 |
| B04 | P2 | 消息 ID 折叠丢失去重身份，旧消息重放会重复累计 token | 04 |
| B05 | 未评级 | 备份根目录预先为符号链接，拒绝前已向配置目录外写入快照 | 06 |

### B01 墙钟前拨导致活跃执行少计

显式启用原生计时，同一 boot、连续事件序号，结束事件声明 `wait_coverage=true`。单位为秒：

| 事件 | 墙钟 | 实际 boot 时间 |
| --- | ---: | ---: |
| 提交任务 | 1 | 1 |
| 原生 turn 开始 | 2 | 2 |
| 等待开始 | 3 | 3 |
| 等待结束，墙钟已前拨 10 秒 | 16 | 6 |
| turn 完成 | 30 | 20 |

两侧都把等待结束推算为虚假的 `boot=16`，冻结并显示 `Active 0m 05s`，同时保存 `active_coverage="complete"`、`reason=null`。可信边界下活跃时长应为 `(3−2)+(20−6)=15` 秒。任务总时长仍为 `20−1=19` 秒，原生报告的 1,500 ms 独立保存。

定位为 TS [tasks/native.ts:9](../../packages/core/src/runtime/tasks/native.ts#L9)与 Python [tasks/native.py:11](../../archive/python/src/claude_statusline/runtime/tasks/native.py#L11)。等待采样进入 `starting=true` 分支，依赖墙钟偏移构造 boot 时间。原测试通常令两种时钟同步变化，或直接提供正确 boot 样本。最小补例应经过生产等待适配、存储、重读和 CLI 渲染；证据充分时验证 15 秒，证据不足时不能输出可信的 5 秒。

### B02 缺失执行起点却返回零秒

最小序列为 `heartbeat(seq=0,t=0)` → `prompt(seq=1,t=1)` → `turn_end(seq=2,t=9,duration_ms=1500,wait_coverage=true)`，没有 `turn_start`。两侧都在结束事件时创建 turn，将起止同设为 9 秒，落盘 `active_coverage="complete"`、`frozen_ns=0`，显示 `Active 0m 00s`。任务总时长 8 秒、原生 duration 1,500 ms 仍正确。

定位为 TS [live/reducer.ts:113](../../packages/core/src/runtime/live/reducer.ts#L113)、[tasks/native.ts:92](../../packages/core/src/runtime/tasks/native.ts#L92)，Python [live/reducer.py:162](../../archive/python/src/claude_statusline/runtime/live/reducer.py#L162)、[tasks/native.py:143](../../archive/python/src/claude_statusline/runtime/tasks/native.py#L143)。原测试多先发送起点，缺失事件测试侧重序号缺口或等待；连续序号并不证明观察到了执行起点。补例应验证落盘、重读和渲染仍保留未知原因，不用 0 或宿主 duration 补造起点。

B01、B02 都与[任务计时契约](timer.zh-CN.md)中证据不足时隐藏或降级的要求不一致，需要保留为实现缺陷，而非修改指标定义使其成立。

### B03 更大文件轮转漏计 token

没有权威 `cost-state` 快照。先读消息 A，输入 token 为 1；同路径原子替换为更大文件，其中等长消息 B=2、C=3。两侧沿旧字节游标继续读取，跳过 B，显示 `in 4`，重复渲染仍为 4；按不同消息 ID 应为 `1+2+3=6`。

定位为 TS [CLI usage.ts:106](../../packages/cli/src/runtime/usage.ts#L106)、Python [usage.py:325](../../archive/python/src/claude_statusline/runtime/usage.py#L325)。UsageCollector 未用文件身份识别该替换；半行、缩短重写和另一个 SubmissionIndex 采集器的测试不能覆盖它。最小补例为上述 A→B/C 序列，断言累计及重复渲染均为 6。

### B04 折叠后的旧消息重放重复计数

没有 `cost-state` 快照。读入 5,001 个不同消息，每条输入 token 为 1，触发 ID 折叠，再追加第一条的相同记录。两侧从 `in 5001` 变为 `in 5002`；没有新消费，应保持 5,001。

定位为 TS [core usage.ts:232](../../packages/core/src/runtime/usage.ts#L232)、Python [usage.py:428](../../archive/python/src/claude_statusline/runtime/usage.py#L428)。旧贡献移入 `base` 时删除了去重身份。[原折叠测试](../../packages/cli/test/usage.test.ts#L151)使用零值并删除 transcript，未重放已折叠 ID。补例应使用正值，核对原始总量和最终显示均不重复累计。

### B05 符号链接备份根先产生外部写入

安装前将 `backups/statusline` 指向配置目录外的隔离目录。两侧都会先向链接目标写 `.before`、`.absent` 和 `metadata.json`。Python 完成安装；TS 随后拒绝符号链接并退出 2，但外部快照已经留下。该共同风险经过实际执行确认，原报告未给优先级。

定位为 TS [storage.ts:68](../../packages/cli/src/config/storage.ts#L68)及之后的[事务路径校验](../../packages/cli/src/recovery/files.ts#L100)，Python [storage.py:50](../../archive/python/src/claude_statusline/config/storage.py#L50)。原链接测试主要在恢复阶段替换快照。最小补例应在安装前设置链接，验证拒绝时链接目标没有新增文件。

## 现有文档更新清单

以下五类是原 session 明确指出、整理时仍能定位到的文档冲突。中英文应同步核对；只修正当前说明，保留有明确版本语境的历史记录。

| 编号 | 待更新文件 | 当前冲突 | 更新目标 |
| --- | --- | --- | --- |
| D01 | [DISPLAY_ITEMS.md](../DISPLAY_ITEMS.md)、[中文版](../DISPLAY_ITEMS.zh-CN.md)；英文约 L101–116，中文约 L93–105 | 将 display schema v5／配置协议 v4 称为当前契约，迁移说明也沿用旧版 | 按[共享契约](contracts.zh-CN.md)校正当前 schema v8／配置协议 v12，核对读取、显式保存及降级说明；运行协议等独立版本不得混改 |
| D02 | [native.md](native.md)、[中文版](native.zh-CN.md)；约 L57 | 声称筛选后能移动相邻可见项 | 改为搜索／分类筛选期间禁用排序，清除筛选后恢复；与两侧实现和用户指南保持一致 |
| D03 | [native.md](native.md)、[中文版](native.zh-CN.md)；约 L19–23、L87 | 当前开发步骤仍引用 `.venv/bin/python tools/prepare_mod_types.py`、旧 `.venv` 后端和 `tools/native_mod_acceptance.py` | 对照当前[开发入口](README.zh-CN.md)逐条更新 Node／npm、Mod 类型准备、后端绑定及验收命令；历史 Python 步骤应有历史标识 |
| D04 | [USER_GUIDE.md](../USER_GUIDE.md) 约 L793、[中文版](../USER_GUIDE.zh-CN.md)约 L767 | Windows 排障仍要求 `doctor` 输出 `windows-curses backend` | 按当前 Node raw TTY 实现及实际诊断项更新排障步骤，删除过时的诊断项名称，不凭空添加新的 OK 项 |
| D05 | [USER_GUIDE.md](../USER_GUIDE.md)约 L701、[中文版](../USER_GUIDE.zh-CN.md)的 Doctor 诊断段 | 英文承诺检查 `writable state`，中文概述检查状态目录，但 R03 证明运行目录可写性等检查缺失 | 与 R03 联动：修复后说明实际检查范围；修复前明确诊断缺口，不能声称成功诊断已验证这些条件 |

此外，修复前后需要同步以下已知问题说明；这是根据汇总提出的补充文档工作，不计入上面五类原文档冲突：

- [任务计时](timer.zh-CN.md)及[实时指标](live.zh-CN.md)：关联 B01／B02，说明活跃执行时长在已知边界下可能错误；保留任务总时长、活跃执行时长、原生 duration 三者的独立定义。
- [指标说明](../DISPLAY_ITEMS.zh-CN.md)及实时指标说明：关联 B03／B04／R04，说明无权威快照时的轮转、重放边界和异常身份归属；未知数据不能当成真实零值或当前任务数据。
- [用户指南](../USER_GUIDE.zh-CN.md)、[CLI 参考](../reference/cli.zh-CN.md)及原生集成说明：关联 R01／R02／R03／R05／R06／B05，修复记录应写明真实入口、诊断范围、权限与备份边界。Windows 静态推导须与实机结果分开记录。
- 上述文件的英文版本应同步；修复完成后为对应条目补充提交和验证证据，再更新处理状态。

## 判定边界和待验证项

- **已批准差异不列为缺陷：** Node／npm 分发及 Python 入口退役、当前 Node 22／24 范围和既有架构边界、绝对 Node＋JS argv 绑定、协议 12 和六语言及 `zh-Hant → zh-TW` 兼容、Windows boot identity v2、原生计时缺省关闭但保留显式偏好。具体历史决定仍以[迁移记录](typescript-migration.zh-CN.md)及其链接为准。
- **另有既有限制：** 追加式文字编辑、搜索长度／字素边界限制已记录于[外部 TUI 回归修复记录](external-tui-regressions.zh-CN.md)，不重复计为本次新增问题；v3.1.2 已修复的六项外部 TUI 问题也不重新列入待办。
- **计时疑点：** 合成乱序流中，任务完成后迟到的子代理 `turn_start` 会清除活跃时长冻结值并返回 `incomplete`，两侧一致。真实宿主能否产生该序列、是否属于允许的新活动恢复，仍待原始宿主序列验证，不列入已确认的 11 项。
- **平台与人工证据：** R01 需要真实 Windows 外部入口验证；Windows 文件占用／重解析点并发替换、macOS Terminal.app、GNOME 桌面启动、WSL、真实休眠／重启／调时及原生窗格焦点等未由四个 session 全部实测覆盖。隔离适配器、Linux PTY 和自动化通过不能替代这些结论。

## 后续修复组织

可先处理相互独立的 D01–D04，再让 D05 随 R03 更新。实现修复按上述原优先级排队；R01 同时需要补齐 Windows 证据，B05 需要先评估影响再定级。相近问题可以共同安排验证：R02／R06 覆盖真实 PATH 入口但保留各自断言，R03／B05 覆盖安装与文件边界，B01／B02 覆盖计时可信度，B03／B04 覆盖增量统计。

每项闭合应保留最小触发条件、修复提交和对应验证结果。平台未验证项继续单独保留；历史 TS-01–TS-06 DONE、D06 FAIL 和 PERF-01 NOT_STARTED 不因本清单自动改变。
