# 架构与仓库布局

[English](architecture.md) | **简体中文**

当前 Native 容量与恢复采用有界可见帧，并新增三平台 Claude 2.1.310 门禁；详见[实现与验收](native-capacity.zh-CN.md)。


[扩展实现与验收](extensions.zh-CN.md)覆盖本地 JSON、GitHub、命令、链接和共享组件能力。

[首次设置与完整外观实现](setup-appearance.zh-CN.md)记录首次使用、内置方案、schema 9、协议 16 及对应验收。

命名显示方案、用户侧项目绑定和只读任务详情，分别参见[方案管理](../PROFILES.zh-CN.md)和[任务详情](../TASK_DETAILS.zh-CN.md)。

显式真实输入诊断及缓存原因显示见[诊断指南](../DIAGNOSTICS.zh-CN.md)，实现边界与验收见[诊断开发说明](real-input-diagnostics.zh-CN.md)。

共享光标编辑、场景化快速配置和只读 `explain` 操作见[配置体验实现与验收](configuration-experience.zh-CN.md)。

当前计时证据、精确重放去重及缓存兼容见[迁移后修复](post-migration-fixes.zh-CN.md)。

当前生产包使用 TypeScript，保留已有 CLI、配置格式及存储位置；纯规则、平台副作用、应用服务和终端界面分层。

<a id="typescript-迁移-workspace"></a>

## 当前 TypeScript workspace

TS-03 新增 `packages/core`（纯配置、协议、多语言、Unicode、渲染与运行规则）、`packages/platform`（Node／原生 I/O）和 `packages/cli`（应用服务）。TS-04 新增 `packages/tui`、安装集成与持久恢复。workspace 是打包到公开 npm 成品中的私有实现包。

规范目录为 TypeScript 数据，项目 ID 和预设说明由其派生，不在前端契约中重复手改。规范语言资源位于 `packages/core/resources/i18n`，TypeScript 统一生成 Node 和 Mod 资源，不再重新生成 Python 归档。Mod 副本只包含受支持的纯模块，宿主操作保留在原有入口。参见 [TS-03 实施与验收](typescript-migration/ts-03/README.zh-CN.md)。

已迁移的运行逻辑分布在 `core/runtime/{tasks,live}`、`core/timing` 和纯用量／Git 解析模块，由 `cli/runtime` 编排。明确的 `RuntimeContext`、`RuntimeIO`、`CommandRunner` 边界提供时钟、进程身份、私有文件发布及 Git argv 执行。任务历史保留生命周期 schema 4 和 schema-1 兼容镜像；live 写入先取 live 锁再取 task 锁，用量写入先取 cache 锁再取 task 锁，任务写入不反向获取 live／cache 锁。完整 UTF-8 字节游标、有界历史和冻结结果兼容混合版本磁盘访问；开发用 `runtime`／`hook` 入口不切换已安装命令或 Mod 绑定。

TypeScript 结构将复用规则、系统操作及应用编排分开：


常见 runtime 协议分发通过只读偏好适配器，避免加载管理存储、显示规则和界面语言数据。
用量索引在一次缓存锁内保留最多 32 MiB 序列化暂存，先持久化最终页，再发布 manifest
及原子状态；超出上限仍使用相同持久化适配器，清理仍在状态提交成功后进行。
磁盘格式及精确重放统计不变，见 [PERF-01](performance/perf-01.zh-CN.md)。

```text
packages/
  core/
    src/editor/                    共享草稿、表单、搜索及响应规则
    src/integration/               纯 executable／argv 绑定
    resources/i18n/                规范翻译资源
  platform/
    src/terminal/                  raw mode、VT 输入输出、启动器及结果桥
    src/plugin-host.ts             有界官方 CLI 传输
  cli/
    src/config/                    配置及 UI 协议服务
    src/integration/               归属、资源、安装及 doctor
    src/recovery/                  journal、文件还原及官方状态核对
    resources/                     规范技能模板
  tui/
    src/                           外部编辑器状态、布局、绘制及会话
    src/drawing/                   有界画布／ANSI、呈现、快捷键及页面绘制
    test/                          纯外部编辑器产品回归测试
tools/migration/ts-04/
  package.ts                       私有安装验收归档
  installed.ts                     八目标入口／编辑器／恢复验收
  official-installed.ts            固定宿主安装验收
  host-smoke.ts                     本地真实宿主编辑器／runtime 交互
  test/                            具名责任、进程及终端测试
```

文件发布在修改前记录不可覆盖的原始快照与持久检查点。共同安装锁保护文件提交，
管理锁串行化官方集成各阶段。显式恢复核验所有记录状态，核对不明确的宿主结果并
保留插件禁用偏好。参见[恢复流程](typescript-migration/ts-04/recovery.zh-CN.md)和
[安装验收](typescript-migration/ts-04/candidate.zh-CN.md)。

## 当前应用服务

开发 CLI 通过 `ConfigurationService`／`Storage` 绑定文件事务与宿主身份；私有 ESM 入口为 `packages/cli/src/entry.ts`，配置与协议代码位于 `config/`、`ui/`。`render`、`render-subagents`、`hook`、`slash-hook` 的快速分发位于管理资源导入之前，完整 `LaunchSpec` 前缀区分 TS 开发后端与已安装渲染器。

`core/rendering` 负责主／子行组合、格式、样式、Powerline 和确定性预览。`RenderEnvironment` 提供选定语言与同步观测接口；`cli/rendering/environment.ts` 按组件需要导入采集器并连接运行服务。每帧缓存各来源和原始任务快照，重复实例分别格式化；`platform/presentation.ts` 提供词法路径、本地／UTC 日期和主机名。预览替换所有观测，不采集或写入运行证据。`packages/tui` 在共享编辑核心及可注入协议后端上实现外部编辑器；`platform/terminal` 负责 raw mode、增量 UTF-8／VT 输入、有界输出、启动器及私有请求／结果文件；`cli/integration` 连接适配层并在配置锁内复核请求撤销。详见 [TS-04](typescript-migration/ts-04/README.zh-CN.md)。

内部用量／transcript JSON 路径保留数值词法，遇到有序数字键或旧非有限常量时回到精确解析器。可变 ID 字典以有界删除开销保持 Python 插入顺序；原生缓存序列化保持 Python 空格、ASCII 转义及数值拼写。公开配置／协议仍使用严格解析，不改变磁盘 schema。

`cli/recovery` 维护带版本的文件与官方操作日志。配置和安装服务先发布不可覆盖的原始快照，再进行写入；未完成日志阻止配置写入，直到显式恢复。插件刷新意图跨卸载／重装保留手动禁用；doctor 仅检查。详见[候选实现恢复](typescript-migration/ts-04/recovery.zh-CN.md)。

[来源与包执行边界及新增验收](source-command-package-management.zh-CN.md)记录协议 28、命令独立许可、保留入口和受保护清理。

## 历史 Python 架构

原始布局、版本约束与实现说明见[历史 Python 架构](history/python-implementation.zh-CN.md#python-architecture)。以下入口保留原章节的锚点。

- <a id="依赖与边界"></a>[依赖与边界](history/python-implementation.zh-CN.md#依赖与边界)
- <a id="兼容与资源"></a>[兼容与资源](history/python-implementation.zh-CN.md#兼容与资源)
- <a id="持久化"></a>[持久化](history/python-implementation.zh-CN.md#持久化)
- <a id="原生编辑器结构"></a>[原生编辑器结构](history/python-implementation.zh-CN.md#原生编辑器结构)
- <a id="独立显示指标"></a>[独立显示指标](history/python-implementation.zh-CN.md#独立显示指标)
- <a id="phase-4-配置边界"></a>[Phase 4 配置边界](history/python-implementation.zh-CN.md#phase-4-配置边界)
- <a id="独立运行采集"></a>[独立运行采集](history/python-implementation.zh-CN.md#独立运行采集)
- <a id="phase-5-指标迁移"></a>[Phase 5 指标迁移](history/python-implementation.zh-CN.md#phase-5-指标迁移)
- <a id="外部编辑器结构v161"></a>[外部编辑器结构（v1.6.1）](history/python-implementation.zh-CN.md#外部编辑器结构v161)
- <a id="任务时钟结构"></a>[任务时钟结构](history/python-implementation.zh-CN.md#任务时钟结构)
- <a id="tui-布局与快捷键"></a>[TUI 布局与快捷键](history/python-implementation.zh-CN.md#tui-布局与快捷键)
- <a id="共享界面语言"></a>[共享界面语言](history/python-implementation.zh-CN.md#共享界面语言)
- <a id="独立的状态栏语言"></a>[独立的状态栏语言](history/python-implementation.zh-CN.md#独立的状态栏语言)
- <a id="组件实例与布局"></a>[组件实例与布局](history/python-implementation.zh-CN.md#python-architecture-component-instances-and-layout)
