# TS-01 固定参考实现与行为清单

[English](README.md) | **简体中文**

[迁移总计划](../../typescript-migration.zh-CN.md)统一记录阶段状态。本文说明固定参考、
可移植样例、核验方式和证据。TS-01 不实现 TypeScript 后端，也不决定 D01–D06。

## 参考实现与覆盖范围

Python 参考固定为 **v2.0.0**，提交
`9b6d2fab4bf165be280d428a874521bfbf02c7e1`。2026-10-11（Asia/Shanghai）
开始实施时，GitHub `main` 与该提交一致。参考保存在 Git 中，使用时导出到隔离目录；
本阶段没有修改生产代码或软件版本。

[基准清单](../../../../tests/fixtures/migration/ts-01/baseline.json)记录 153 个 Python 源文件、
96 个 Python 测试文件、**815 个静态测试方法及 815 个实际发现的测试 ID**、42 个
Python 工具文件及构建入口、24 个现有 TypeScript 测试模块，以及命令参数树、环境变量读取、
协议和持久化版本。静态数量不等于测试通过数。每个 Python 模块和测试均有行为类别、
处置方式、理由及迁移阶段；测试模块的生产代码导入信息用于关联源码边界。

按模块、测试和工具条目的 `behavior` 关联 `behaviors[].id`，再关联
[样例定义](../../../../tests/fixtures/migration/ts-01/cases.json)中的 `cases[].behaviors`。
行为类别给出契约文档和迁移阶段。样例是补充回放证据，不表示整个类别或全部 815 项
测试已经移植。已有 TypeScript Mod 测试继续保留原有检查。

分类包括 `port_behavior`（行为待移植）、`reuse_fixture`（数据/辅助设施可复用）和
`retire_python_detail`（Python 实现细节待退役）。仅“转发函数与类型具有相同 Python
对象身份”的断言列入待退役，D05 前提仍未决定。模块执行入口及用户可见兼容能力仍需明确
过渡决策；TS-01 不删除任何测试。生成资源属于需要复现的数据，不算已经完成后端迁移。
所有现有工具均登记替代能力和阶段，新增 TS-01 工具也列入 TS-05；迁移期间保留性能工具
作为对照参考。

[平台清单](../../../../tests/fixtures/migration/ts-01/platforms.json)区分声明支持、CI 配置、
本机证据和覆盖缺口。Windows x86、WSL、macOS 14、真实桌面及休眠场景不能从其他 runner
推定。Windows 原生 ARM64 Python 仍不在当前支持契约中；x64 仿真属于独立的已声明配置，
仍需探针证据。

## 固定样例与比较规则

样例库包括 **161 个合成案例**及 84 份完整配置：

- 对 62 个主行类型及 16 个子代理类型分别生成固定预览。
- 五种语言、40/80/120 列的生产主行及子代理渲染，覆盖重复实例、CJK/组合字符/emoji、
  字面文本、spacer 和 ANSI/Powerline 输出。
- CLI 输出通道、退出码及损坏输入的静默处理；编辑器和运行时请求、重复字段、版本错误、
  缺失/null/零值区别及 runtime v1 兼容读取。
- 显示配置 v1–v8、禁用选项保留、便携文件导出/导入/审查、成功保存、精确修订哈希、
  陈旧草稿拒绝、备份及明确关闭的偏好。
- 任务继续、并行代理与报告交付、中断/失败、迟到的原生时长、冻结结果、重叠等待、
  重启降级、超出 JavaScript 安全整数范围的纳秒值，以及追加、半行、截断和替换时的
  UTF-8 字节游标。

输入使用 JSON；非法 JSON 请求以原始字符串保存。
[预期结果](../../../../tests/fixtures/migration/ts-01/expected.json)保留文本/ANSI 字节、
结构化响应、文件内容和生命周期状态。仅对已经解析的对象忽略键顺序；列表顺序、字符串、
类型、缺失字段、布尔值、整数和 null 均精确比较。协议字符串和磁盘文件快照内的 JSON
仍按字节比较。

每个案例启动独立子进程，使用独立临时配置、运行状态和会话目录；不继承模型凭据，PATH
仅包含隔离的参考 CLI 启动器，不包含宿主程序。时间、home、宿主版本和游标文件身份均作为显式观测注入并写入
样例定义。输出只把本次临时目录前缀替换为 `<CASE>`，不归一化修订哈希或数值。
虚拟后端路径固定为 `/ts01/claude-statusline`。

配置快照会如实记录已有锁文件的创建；“只读”指不重写用户配置字节，而非隐藏锁文件。
游标场景在调用生产代码前注入文件身份和修改时间，保留它们在状态文件中的字段。

标准回放环境为 Linux/Python 3.14。其他平台沿用原有原生 CI 矩阵验证，不声称所有
POSIX 样例在 Windows 上具有相同字节。Python 适配器调用固定参考的生产边界；后续
TypeScript 适配器应使用相同输入、输出相同可观察结果，且不得调用 Python。

## 复现与审查

使用已安装本项目及现有测试依赖（`wcwidth==0.9.1`、`pyte`）的开发虚拟环境，
在仓库根目录运行：

```bash
python -m tools.migration inventory --output /tmp/ts01-inventory-new.json
python -m tools.migration capture --output-dir /tmp/ts01-capture-new
python -m tools.migration verify --capture-dir /tmp/ts01-capture-new
python -m tools.migration verify
python -m unittest tests.migration.test_baseline -v
```

输出路径必须未使用。`inventory` 拒绝覆盖已有文件，`capture` 拒绝已有目录。
不指定 `--source-root` 时，工具自动将固定 Git 提交导出到临时目录；指定时须通过源文件
字节检查，改动、缺失或新增 Python 模块均会拒绝。`--python PATH` 指定解释器并保留
虚拟环境身份。本地必须存在固定提交；专用 CI 任务显式获取历史。

[锁定记录](../../../../tests/fixtures/migration/ts-01/lock.json)固定样例和适配器哈希。
`verify` 检查锁定记录，重新生成清单、核对测试发现覆盖，并回放样例或校验已保存的采集
凭据和结果。发现差异以非零退出，**不会修改预期结果**。新增测试检查遗漏映射、错误提交、
输入篡改、输出差异及数值/类型强制转换；两次采集使用不同临时目录。

确需变更参考或适配器时，应在总计划记录理由和影响的契约，保留旧历史，在新目录采集、
审查差异并完成相关重验，再显式替换已审查的 JSON 和锁定文件。不提供自动接受全部差异
的开关。

性能脚本源码及参数已经固定：50 样本、三轮交替、small/medium/large 场景、cold/warm
字节码条件。本阶段不新增性能结论或验收预算；测量、RSS 缺口和 D06 决策属于 TS-02。

## 验证与限制

在 Linux x86_64 / Python 3.14.4 上重新验证固定参考：

| 检查 | 结果 |
| --- | --- |
| 参考 unittest 全集 | 运行 815 项：807 通过，8 项按 Windows/macOS 原生条件跳过 |
| Ruff F/E9 | 使用 `--no-respect-gitignore` 扫描导出目录，通过 |
| i18n、Unicode、UI 协议、编辑器样例、runtime 协议生成检查 | 五项 `--check` 全部通过 |
| 参考文档检查 | 相对链接及双语配对通过 |
| wheel/sdist 内容检查及严格 Twine 元数据检查 | 通过；wheel 217 条、sdist 741 条 |
| 源码目录外安装 wheel 的 CLI 烟测 | 安装 dry-run、重复安装、所有权冲突/回滚、渲染、卸载通过 |
| 2.1.294 和 2.1.296 各自的 native/runtime Mod 测试 | 每个宿主 112 + 10 项通过 |
| 2.1.294 精确宿主声明及两套类型检查 | 通过 |
| 两个宿主的两套官方安装/后端桥接烟测 | 通过；没有模型调用 |
| 修正后的外部 TUI 脚本 | 既有五种尺寸全部通过 |
| 安装产物的字素/样式 PTY | 六个案例通过 |
| 2.1.296 持久安装的原生编辑器组合 PTY | 120×30、80×48 下中英文均通过 |

验证摘要、依赖版本、哈希及后续 CI 证据见
[validation.json](../../../../tests/fixtures/migration/ts-01/validation.json)。原始日志和截图
保留在忽略的 `dist/validation/typescript-migration/ts-01/` 独立运行目录。
这些结果证明自动检查通过，不代表人工视觉验收。

两项旧工具问题已明确处置：

1. 原外部 TUI 脚本等待内部名称 `current-dir Priority`，而界面实际显示
   `Directory Priority`。修正脚本改为读取展示标签，并针对未改动的参考 wheel 通过五种
   尺寸验收。保留原始失败；这不是生产缺陷，也没有暗中移动参考基准。
2. 旧原生 PTY 工具从仓库内部的源码归档目录运行时，会把外层 Git 工作区的身份写入报告。
   原始 `commit` 和 dirty 字段因此描述的是调用方。验证凭据另行将核验过的源码和已安装
   wheel 哈希绑定到参考提交；不能仅依赖旧字段判断被测包身份。

Claude Code 2.1.296 有运行及安装检查，但现有流程不能生成其精确宿主声明。按已确认范围，
TS-01 不新增付费模型调用，也不等待跨平台人工桌面验收。真实休眠、重启、断电持久性及
未覆盖的架构/终端组合继续作为 TS-02/TS-06 的明确工作。D01–D06 保持 OPEN。
