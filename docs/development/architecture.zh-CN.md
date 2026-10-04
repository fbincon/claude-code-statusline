# 架构与仓库布局

[English](architecture.md) | **简体中文**

Python 包保留现有 CLI、配置格式和存储位置。v1.1.1 按职责组织实现，并在原 Python 路径保留延迟加载的兼容模块。

```text
src/claude_statusline/
  cli.py、__main__.py、_version.py   CLI 分发与版本
  config/                           显示/feature、宿主配置、模型、
                                    共享存储、事务与命令
  rendering/                        格式、颜色、布局、条目、计时、
                                    主栏/子 Agent 输出及预览
  runtime/                          路径、缓存、registry、transcript、
                                    usage、Git 与 prompt 生命周期
    turns/                          纯记录逻辑、加锁存储和 reducer
  integration/                      所有权、能力、资源、安装计划/提交、
                                    doctor、hooks、启动器及结果桥
  ui/                               模型、编辑草稿、键盘、绘制、
                                    终端会话及保存/取消生命周期
  platforms/                        系统识别、文件、进程、时钟及
                                    Terminal.app 适配
  resources/                        配置 skill 模板
  *.py                              原有兼容入口

tests/{config,rendering,runtime,integration,ui,platforms}/
tests/support.py                    子进程测试的稳定源码定位
tools/                              验证与显式启用的验收命令
docs/development/                   架构、测试及计时约定
```

## 依赖与边界

随包接入的 TypeScript Client 编辑器放在 `mods/statusline-native`，分为可静态分析的宿主入口、纯草稿及宿主行逻辑、严格协议桥接、生成契约、页面绘制和官方测试。Python 继续负责配置与渲染。源码包保留 Mod 开发文件；`src/build_native.py` 仅把运行 manifest/模块及生成的哈希、版本、协议清单打入 wheel。安装器拥有本地目录 marketplace，通过官方插件命令接入，与兼容文件事务分阶段执行。参见[原生入口验证](native.zh-CN.md)。

`config.catalog` 定义带作用域的项目和派生兼容视图；`ui.contracts` 定义生成的前端类型，`ui.protocol` 负责 JSON describe/read/preview/apply 传输，`rendering.spans` 将生产样例转换为可绘制输出。`config.revisions` 为锁内读取及 JSON/curses 共用的保存提供覆盖安装归属的语义 revision；apply 复用配置服务事务，返回提交后的快照。参见[共享契约](contracts.zh-CN.md)。

平台适配提供文件锁、原子写入、进程身份和包含睡眠时间的时钟。运行采集依赖这些适配；renderer 使用采集结果和显示配置。UI 草稿通过配置 service 保存。安装与配置共用存储锁及所有权辅助逻辑，保留回滚和语义冲突检查。

```mermaid
flowchart LR
    CLI[延迟 CLI 分发] --> R[渲染]
    CLI --> H[生命周期 hooks]
    CLI --> I[安装与配置]
    CLI --> U[终端编辑器]
    U --> C[配置 service]
    U --> P[样例预览]
    R --> RT[运行采集]
    H --> T[Turn reducer 与存储]
    I --> S[共享存储与所有权]
    C --> S
    RT --> A[平台适配]
    T --> A
    S --> A
```

`render`、`render-subagents` 和 `hook` 的启动路径不加载终端编辑器及启动器。各子包初始化不提前导入实现。可选前端在实际使用时导入；预览只使用固定数据，不读取 transcript/Git，也不保存状态。

主 renderer 从 stdin 读取官方 JSON，输出格式化文本。子 Agent renderer 保留 `id`/`content` NDJSON 协议。输入或状态不可用时，hooks 继续静默成功退出。管理命令继续使用原有 stderr 与退出码约定。

## 兼容与资源

原有 `claude_statusline.statusline`、`turn_state`、`installer`、`interactive_config`、`_platform` 等模块将属性读取转发到正式实现。函数、异常和模型共享身份，不另建生命周期存储或事务实现。原模块运行入口继续可用，包括 `python -m claude_statusline.macos_terminal`。

测试直接 patch 拥有函数或常量的正式模块。给兼容模块赋值私有全局变量不是配置接口；修改运行目录应使用文档说明的环境变量。

资源继续通过 `importlib.resources` 从 `claude_statusline/resources` 加载。Terminal 子进程从根包定位 Python 包目录，不依赖被移动适配文件的父目录层级。

## 持久化

显示 schema v2、feature schema v1、schema-1 运行镜像和生命周期 schema v3 保持兼容。可选 `duration_source` 区分冻结的任务时间与满足条件的原生校准。可选的 Agent 历史、续接 prompt 别名和待交付报告，使宿主生成的结果通知仍属于同一人类任务；这些记录有界，不改变配置格式。计时 transcript 扫描版本升级到 5，重新核对旧缓存，不重置累计用量。

本地 ROADMAP 与原始验收记录不进入发行包。发布从固定且已验证的提交导出；包检查覆盖全部正式 Python 模块、兼容入口、资源、测试、工具和双语文档。

另见 [测试](testing.zh-CN.md)、[计时约定](timer.zh-CN.md) 和 [发布指南](../RELEASING.zh-CN.md)。

## 原生编辑器结构

唯一 Mod 源为 `mods/statusline-native`。宿主 API 留在 `hooks/register.ts`，草稿与数值规则在 `lib/editor/`，输入校验、按键及设置在 `lib/client/`，独立端口快照在 `lib/session.ts`。`ui/client/` 维护 Client 输入/绘制；`ui/components/` 提供共享板块，`ui/layout.ts` 计算正文预算。测试对应 backend、client、editor、integration、UI。

`/statusline-configure` 的 Python curses UI/平台启动器保持独立；Mod 只注册 `/statusline-configure-native`。两者可同时安装和打开，保存共用配置服务、revision 校验及事务锁。Client 不访问文件或启动进程，通过有序累积消息批次与宿主通信；快照深复制以隔离宿主冻结行为，序号确认/去重及 epoch 防止重复或迟到输入。递归打包包含 Client 模块，排除测试、宿主声明、依赖及原始验证记录。

正式版编辑器默认由 config.editor_defaults 共享，两个偏好独立，明确参数优先。安装、slash 执行和 doctor 使用相同外部默认；缺失偏好默认启用，明确 false 持久关闭。宿主门槛为外部 2.1.258、Client 2.1.287，版本不支持或未知时分别暂挂。已核验所属的插件通过受锁保护、备份和回滚的设置/owner 事务暂停，不依赖新版宿主 API；仅工具暂挂在恢复兼容后自动启用。

## 独立显示指标

`rendering.metrics` 负责严格数值／上下文解析、重置倒计时及会话分项格式化；主渲染状态每次刷新捕获一个时钟并缓存实时采集结果。预览提供固定时钟与样例值；作用域目录新增项通过生成契约传递至两个编辑器和向导，无需变更 schema／协议。见[显示指标定义](../DISPLAY_ITEMS.zh-CN.md)。
