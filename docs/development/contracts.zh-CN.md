# 共享目录与 JSON 配置协议

[English](contracts.md) | **简体中文**

当前 Native 容量与恢复采用有界可见帧，并新增三平台 Claude 2.1.310 门禁；详见[实现与验收](native-capacity.zh-CN.md)。


[扩展实现与验收](extensions.zh-CN.md)覆盖本地 JSON、GitHub、命令、链接和共享组件能力。

[首次设置](../SETUP.zh-CN.md)与[完整方案](../SCHEMES.zh-CN.md)。

命名显示方案、用户侧项目绑定和只读任务详情，分别参见[方案管理](../PROFILES.zh-CN.md)和[任务详情](../TASK_DETAILS.zh-CN.md)。

协议 v24 是随包或源码原生前端使用的内部接口。显示配置使用 schema v15，v1–v14 在内存中迁移读取；协议与持久化版本独立演进。前后端资源应来自同一软件包版本。

## 共享目录

`packages/core/src/config/catalog.ts` 以 `(scope, id)` 定义 67 个主栏类型和 17 个子代理类型（分别为 65／15 个指标及文本、留白），提供名称、说明、分类、来源、示例、默认位置、格式选项、互斥关系和不可用原因。原有目录字典和默认元组是派生视图，保留项目 ID、说明、默认选择与顺序。CLI JSON 列表增加元数据，保留 enabled/position 字段；外部 TUI 和安装后的向导使用同一份定义及互斥关系。新增独立项默认关闭，可与组合项并存；见[显示项定义](../DISPLAY_ITEMS.zh-CN.md)。

最低版本只在有证据时声明。子 Agent 的 2.1.205 门槛表示行支持，不保证所有可选字段；effort 需要 2.1.214。缓存指标声明最低 2.1.251；网关金额／周期要求宿主和网关均至少 2.1.284。尚未证实的主字段最低版本使用 `null`/`unknown`，不猜测日期。`not_observed` 表示接口尚未观察实时数据，`unsupported_host` 表示已证实的版本边界，`unknown_host_version` 表示版本检测失败，`source_unavailable` 表示来源无法读取，`condition_not_met` 涵盖非 Git 仓库或未启用 fast mode 等条件。这些是可能原因的定义；打开配置不采集实时字段，也不因尚未观察到数据而禁用选择。

## 传输与操作

目录项目同时提供 `guidance` 对象，包含来源类型代码、统计范围、启用条件代码和设置／诊断命令。
这些静态定义由 `packages/core` 维护，共用多语言消息和生成的 TypeScript 词汇表。查看项目的“来源与启用条件”页
不查询实时数据、不开启采集、不改变选择。已知最低宿主版本与实际数据观测分开；未知最低版本继续保持未知。
不可用原因说明的是可能情况，不是当前会话诊断。`config list-items --json` 提供相同的增补元数据。

执行 `claude-statusline ui --config-dir PATH`（Windows npm 入口使用 `claude-statusline.cmd`）。单进程从 stdin 读取一个 UTF-8 JSON 对象直到 EOF，stdout 只输出一个 JSON 响应及换行；意外故障诊断写 stderr。成功退出码为 0，拒绝请求为 2。

```json
{"protocol_version":24,"operation":"read","payload":{}}
```

成功响应为 `{"protocol_version":24,"result":{...}}`；失败为 `{"protocol_version":24,"error":{"code":"...","message":"...","localization":null}}`。校验封装和 payload 字段，拒绝重复 JSON 键、非有限常量、错误版本/类型、未知操作及非法草稿。

| 操作 | Payload | 结果 |
| --- | --- | --- |
| `describe` | `{}` | 目录、配置选项及范围、能力、后端版本和支持的操作 |
| `read` | `{}` | `draft`、`revision`、`installed`、`installation`、能力及后端版本 |
| `preview` | `{"draft": {...}, "width": 80}` | `sample: true`，以及由可绘制 spans 组成的 `main` 和 `subagents` 行 |
| `apply` | `{"draft": {...}, "expected_revision": "<read 返回的 revision>"}` | 保存后的读取快照、`changed` 和 `backup_dir`（路径或 `null`） |
| `read_ui_preferences` | `{}` | `{schema_version:1,ui_language,warning}` |
| `set_ui_language` | `{ui_language}` | `{schema_version:1,ui_language,warning:null}` |
| `preset` | `{draft,preset}` | 校验并展开后的 `{draft}` |
| `import` | `{draft,path,selection?}` | 校验导入后的 `{draft}` |
| `export` | `{draft,path,overwrite}` | 导出目标 `{path}` |
| `review_import` | `{draft,path,selection?}` | 校验后的候选草稿与逐字段差异，不保存 |
| `explain` | `{draft,scope,width}` | 配置原因与逐实例样例结果，`actual_availability:"not_observed"` |
| `diagnose` | `{draft,input,scope,width,source?,observed_at?,include_local?}` | 真实输入、证据来源及逐实例拟合结果；`sample:false`，无写入或采集 |

| `profiles_read` | `{}` | 版本 1 方案集合及不透明修订 |
| `profiles_apply` | `{action,expected_revision,...}` | 已保存集合、修订、变更标记及备份路径 |
| `profile_import` | `{path}` 或 `{path,draft,selection}` | 已验证的命名显示候选，不写盘 |
| `profile_export` | `{name,display,path,overwrite}` | 版本 1 命名方案导出路径 |
| `task_details` | `{session_id,prompt_id?,host_agents?}` | 只读版本 1 任务投影，逐来源证据及限制 |

`read` 与 `apply` 还接受可选 `target`：`{kind:"user"}`、`{kind:"profile",id}` 或 `{kind:"project",path}`。定向读取使用有界只读快照，并返回 `configuration` 选择信息；修订覆盖集合、目标、解析出的绑定及基础配置。写入在原有锁内重读，并保留渲染器归属检查。未指定目标的请求沿用原契约。两个编辑器默认打开当前项目，在草稿期间固定编辑目标。详见[方案与项目契约](profiles-projects-tasks.zh-CN.md)。

`profiles_apply.action` 支持 `save`、`rename`、`delete`、`activate`、`bind`、`unbind`。覆盖需显式 `overwrite:true`；被引用方案不可删除；保存与 `bind_path` 属于同一事务。`activate` 将显示快照复制为独立默认配置，方案不含宿主及运行偏好。编辑器中的启用操作则先加载默认目标草稿，等待普通保存。任务详情要求明确会话，不采集或修复，也不声称跨文件快照原子一致。

`draft` 仅包含 `display`（有效 schema v15 显示配置）和 `host`（`padding`、`refresh_interval`、`hide_vim_mode_indicator`），每个字段均为必填。JSON 宿主布尔/数值严格校验：padding 为 0–32 的整数，refresh 为 1–3600 的整数或 `"event"`；拒绝 `"off"` 等字符串及小数。读取兼容显示 v1–v14 文件时只在内存中规范化，不迁移原文件；预览也接受完整的 v1 显示对象。apply 必须使用 read 返回的完整 schema v15 草稿，避免旧输入静默覆盖新设置。预览宽度为 2–10000 的整数。

`read` 使用现有安装锁获取一致快照，可能创建运行锁目录；`describe` 不创建配置文件。`preview` 不读取设置、检测宿主、采集 Git/transcript 或写缓存/锁，只使用生产格式和布局及固定样例。尚未观察到的数据不是零。每个 span 包含 `text`、`bold`、`foreground`、`background`，两个颜色通道分别为 `null`、`{"kind":"rgb","value":"#rrggbb"}` 或 `{"kind":"ansi","value":0..255}`，没有原始 ANSI 转义。返回主行和子 Agent 行；空选择和关闭子 Agent 显示仍返回空行列表。

能力将宿主版本与实际 Mod 加载情况区分开。`native_mod` 为 `unsupported`、`unknown` 或 `unverified`；`native_mod_loaded` 为 `null`，后端进程无法证明当前会话加载了什么。实际 Mod 回调及 PTY 交互提供加载证据。

## Revision 与前端生成

不透明 SHA-256 revision 覆盖规范化的有效显示/宿主配置，以及 `statusLine`、`subagentStatusLine` 的 type、命令身份和归属分类。数组顺序有意义；JSON 空白/键顺序与无关设置不触发冲突。命令只解析和规范化，不执行。

apply 在取得共享安装锁之前校验完整草稿和 64 位小写十六进制 revision。配置服务取得锁后重读两个文件，比较 revision、检查归属，再复用现有备份、原子写入和回滚事务。外部 TUI 将打开时的快照传给同一服务，使用同一 revision 检查。返回 revision 在锁内根据提交后的快照计算，不另做无锁读取。

显式设置的 renderer 绝对路径必须与选定后端匹配；保留 Windows 和旧安装使用的规范 PATH 命令兼容性，解析后的命令身份参与 revision。通过绑定的 console-script 路径调用 JSON 接口时，使用该入口的身份，即使 PATH 中存在另一安装。拒绝外部主或子 Agent renderer，包括其他目录下的同名可执行文件和非 command 类型设置；允许子 Agent renderer 尚未安装。apply 只编辑显示选择和本工具主 renderer 的宿主选项，不安装 renderer、不接管外部归属。

无关设置从最新锁内快照合并；写入失败恢复两个文件的原始内容，并报告回滚失败。首次保存可能创建缺失的显示文件或将旧 schema 迁移至 v15；持久化配置已经相同时，使用返回的草稿/revision 重复保存不写文件、不创建备份。事务实际改变文件时才返回 `backup_dir`，无需调用模型。

| 错误码 | 含义与恢复 |
| --- | --- |
| `invalid_json`、`invalid_request`、`invalid_configuration` | 修正封装、payload 或草稿；非法 apply 输入不会写配置 |
| `unsupported_protocol`、`unsupported_operation` | 使用匹配的前后端协议及支持的操作 |
| `configuration_conflict` | 另一编辑器或安装操作改变了配置，重新读取并协调草稿 |
| `not_installed` | 主 renderer 不存在，保存前安装选定后端 |
| `ownership_mismatch` | renderer 属于其他安装或所有者，保存前解决归属 |
| `io_error` | 文件操作失败，检查消息及回滚诊断 |
| `internal_error` | 意外后端故障，检查 stderr |

规范协议类型、目录与资源生成位于 `packages/core` 和 `tools/generation/resources.ts`。运行 `npm run generate` 重新生成，以 `npm run generate:check` 检查漂移。Python 声明与生成器作为冻结对照证据保留在 `archive/python`；不维护另一份目录，不手改生成的 Mod 类型。Mod 使用 `$.process.run` 参数数组与 JSON stdin；PATH 不合适时通过 `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` 指定后端绝对路径，存在 `CLAUDE_CONFIG_DIR` 时显式传递。不会进行 shell 插值。

TypeScript 后端通过 `node packages/cli/dist/src/entry.js runtime --config-dir PATH` 提供运行协议 3，并兼容 v1/v2 observe/read。整批观察在写入前完整校验，stdout 只输出一个 JSON 响应，非法观察或状态不可用时返回 2。1 MiB 输入上限、重复字段／非有限数值拒绝及偏好语义与 Python 边界一致；`hook` 保持静默成功。运行读取不持久化身份修复，任务／live schema 保持现状；TS-04 安装通过共享 executable／argv 契约绑定两个 Mod。

桥接拒绝非法或截断响应、协议版本不匹配及非零退出，保留冲突等结构化后端错误。进程启动/拒绝错误使用 `backend_process`，超时错误使用 `backend_timeout`；宿主进程调用的超时为 30 秒。验证入口显示故障并提供预览重试；打开失败后重新打开会重读配置。

Client 编辑器首次打开时读取目录和配置，保留完整草稿及数值缓冲，仅在草稿或宽度变化时更新预览。保存使用基线 revision，成功后更新快照并保持面板打开。冲突保留草稿供显式丢弃/重载；结果不明确时先读取核对再重试。关闭使旧响应失效并丢弃待保存修改。宿主偏好使用独立实际行 API 并逐项报告。生成描述覆盖目录、选项、边界和能力；桥接拒绝不完整或重复目录、未知选项和不安全显示文本。

参见[架构](architecture.zh-CN.md)、[原生验收](native.zh-CN.md)和[测试](testing.zh-CN.md)。


v1.3.0 保持 JSON 协议 v1 与显示 schema。外部 curses 与 Client 使用打开时 revision 保存。Mod 与 Client 的内部端口使用 epoch、严格递增 seq、累计待确认按键及 ack；一帧合并不会丢掉先前按键，保存按顺序处理。端口快照深复制，generation 拒绝迟到 props。该端口不是新的 CLI/public API。

## 结构化格式

协议 v24 返回完整 schema v15 草稿。`formatting` 包含共享格式与阈值，实例的 `options` 包含分作用域覆盖、标签／图标、优先级和最大列宽，`layout` 包含自动／显式行。子 Agent 草稿另含显示条件、隐藏完成行、行数与任务宽度限制。`describe.formatting_options` 与生成前端常量来自同一 core 定义。缺失当前必需字段和旧协议均拒绝，并提示重装匹配资源。Client／TUI 完整保存通过原有 revision 检查和事务保留新增字段。

## 草稿传输操作

`review_import` 接收 `{draft,path,selection?}`，读取文件一次并复用严格的便携／旧显示格式校验，返回完整候选 `{draft,changes}`，
不加配置锁、不备份、不采集、不写盘。每条差异包含 `section`、`kind`、`(scope,item_id)`、规范 `path`、`before`、`after`
和可本地化 `label`。分区覆盖主栏／子代理选择、格式／逐项覆盖、布局、输出语言及三个宿主状态栏设置。
顺序差异只比较保留 ID，单纯增删造成的位置偏移不算重排；仅显示配置的导入保留传入草稿的宿主值。

两个编辑器显示可展开分区和候选样例预览。Enter 展开详情，方向键选择分区，Page Up/Down 滚动，Tab 切换预览范围。
A 将内存候选接受到草稿；取消保留原草稿。接受不重新读取文件，也不改变打开时的 revision；保存仍是独立的冲突检查事务。
界面偏好、独立宿主偏好及采集开关不属于便携文件。选择性导入仅支持明确的全局白名单及完整主区／子代理区，不支持任意组件拼接；未选状态及本地来源绑定保留。参见[选择性导入](#选择性导入契约)。
原有 `import` 操作继续供匹配协议的客户端使用。协议 v24 与显示 schema v15 独立演进；前后端资源需匹配重装。

`preset` 接收 `{draft,preset}`，返回共享 core 展开的 `{draft}`；`import` 接收 `{draft,path,selection?}`，返回验证后的 `{draft}`，不保存，仅显示文件从当前草稿保留刷新选项；`export` 接收 `{draft,path,overwrite}`，写入可移植文件并返回 `{path}`。导出是独立于设置 Save 的显式文件操作。三者不改变安装或打开时 revision，随后 apply 仍使用原 revision。`describe.presets` 由 core 唯一预设定义生成。

## 共享编辑表单与宿主偏好

`packages/core/src/config/editor-fields.ts` 定义全局与逐项字段的类型、选项、范围及空值行为，生成 `describe.editor_fields` 和 TypeScript `EDITOR_FIELDS`。Client 本地验证后调用生产预览／保存，后端最终验证；外部 TUI 使用同一描述及纯编辑函数。Import／Preset 只替换草稿，Export 可包含未保存修改，都不改变打开时的 revision 或应用 Claude 偏好。

文件操作由宿主 hooks 通过参数数组／JSON stdin 调用 Node 后端，Client 不访问文件。传输／保存期间阻止编辑与普通关闭，epoch 拒绝迟到结果；文本输入保留普通快捷键字符。Ctrl+G 取消输入或返回项目列表，外部 TUI 使用 raw 输入模式确保 Ctrl+S 不被终端流控吞掉。

`lib/preferences.ts` 将偏好映射到实际菜单行，例如 `turnDuration`、`reduceMotion`、`tips`、`progressBar`、`notifChannel`。值、类型、选项、提供方和锁来自 `$.config.list()`。独立 Apply 逐项重读后调用 `$.config.set()`，对应行保留部分成功／拒绝等结果；类型／提供方／值变化或选项失效时不写入。缺失／锁定／不支持行给出官方入口，模型／effort／thinking／fast 行为与工具显示格式分组。不得直接写 Claude 持久化键。

## Phase 5 指标迁移

显示 schema v15 保留可空 `metrics.branch_diff_base_ref`；配置协议 v24 在两个编辑器、冲突、预览和便携文件中保留它。v1–v7 读取不写盘，真实保存才备份迁移；独立运行协议为 v3，兼容接收 v1/v2 观测。已提交分支差异和已结束代理时长冻结见[指标定义](../DISPLAY_ITEMS.zh-CN.md)。

## 界面偏好与消息操作

`read_ui_preferences` 接受 `{}`，返回 `schema_version:1`、`ui_language`（注册表中的受支持代码）及 `warning`（`null` 或语义消息）。缺失／无效读取回退英文，不修复文件字节。`set_ui_language` 仅接受包含支持代码的 `{ui_language}`，使用现有锁、备份和原子写入保存，返回相同形状及空 warning。未来偏好 schema 拒绝覆盖。这两个操作不改变显示／宿主草稿、revision 或接入。

错误保留稳定 `code` 与英文 `message`，`localization` 为 null 或 `{key,params,fallback}`；参数可以包含嵌套消息及标量值。前端校验该形状，再按当前语言渲染，外部程序详情保持原值。判断使用错误码／消息键，不使用翻译文字。`describe` 与现有机器可读目录保留英文基准元数据。生成契约、严格 TypeScript 校验及包内资源清单均使用配置协议 v24，UI 偏好 schema v1 与运行协议 v3 保持独立。

见[翻译架构与贡献规则](i18n.zh-CN.md)。

## 状态栏语言

显示 schema v15 包含必需的 `statusline_language`（`en` / `zh-CN` / `zh-TW` / `zh-HK` / `ja` / `ko`）。读取或导入 v1–v5 时补为英文；读取不改写文件，显式保存先备份再迁移。配置协议 v24 要求完整当前草稿，语言参与 revision、预览和可移植导出。UI 偏好 schema v1 与运行协议 v3 独立。预设保留语言，显示 reset 恢复英文；`config apply --statusline-language` 可选，省略时保留当前值。

协议 v24 保留独立背景通道。空前景／背景分别恢复终端或预览底色的默认值。完整字符簇的样式和裁切遵循[渲染契约](rendering.zh-CN.md)。显示 schema v15、便携格式 v1、界面偏好 v1、运行协议 v3 独立演进；切换预览底色不迁移显示文件。

## 外观契约

schema 15 保存[外观说明](../APPEARANCE.zh-CN.md)中的字段。core 的 `ItemOptions` 与作用域规则表是规范定义，生成默认值、类型和共享验证样例供原生编辑器使用。CLI 与两端表单拒绝不适用的规则。生产和固定预览复用条件、样式和色块组合，观测及采集保持分离；portable v1 与 runtime v3 不变。

## 实例身份与草稿

显示 schema 15 使用有序 `instances`，不采用旧 wire 的 `items`／`item_options` 投影。每项包含 `id`、`type_id`、`enabled`、`options`、`text` 及可选本机 `source` 引用；ID 在作用域内唯一，新增／复制生成新 ID。布局引用所有实例（含禁用项），每行至多一个 spacer。配置目录保留类型定义；编辑器实例行从类型取得元数据。可移植外层仍为 v1，运行协议仍为 v3。完整规则见[组件组合](../COMPOSITION.zh-CN.md)。

读取 v1–v7 时按 canonical 类型 ID 确定性映射，保留禁用项自定义值。审阅差异按实例 ID 区分新增、删除、启用、禁用、重新排序及选项／文本变更。保存完整 schema 15 草稿时不经过旧类型选择投影。

TS 配置服务沿用安装锁、显示 schema 15、UI protocol 24、语义修订版本 1 与独立偏好文件。保存在锁内重读并验证所有权／修订，无变化时不备份。JSON／UTF-8 诊断与数字形式对象键的顺序按 Python 3.14.4 对照；两个编辑器使用生产预览流水线；显式安装记录选定 Node／JS 绑定，普通协议读取不改写绑定。

## TypeScript 后端绑定

随包编译的 ESM 后端已实现全部 UI v24 操作（含预览 span）、runtime v3 及 v1/v2 observe/read 兼容操作，以及 `config`、`render`、`render-subagents`、`hook`、`slash-hook`。schema 与 stdout／stderr 分工保持兼容，UI 预览和 dry-run 不重写活动配置。直接 slash 修改调用同一加锁配置服务，并按已保存的界面语言呈现最终 block 决策。

`/statusline-configure` 将 `{configDir, backend: LaunchSpec, cwd}` 传入可注入的编辑器启动器。结果涵盖 updated、already-current、cancelled、interrupted、timed-out、error；识别出的命令始终阻止模型扩展，结果文字按 Unicode 字符数限长。TS-04 选择原生终端启动器，将私有结果租约与父进程身份、后端 argv、配置及 nonce 绑定；等待配置锁后在锁内再次检查保存许可。测试同时覆盖隔离的真实 PTY、tmux 弹窗、Windows 控制台与注入启动器。

TS-03 配置帮助及参数诊断在显示前解析界面偏好，包括显式配置目录。`--` 之后的字面值不能触发帮助或重定向存储。机器 JSON 目录及输出语言选择独立于界面语言；人类文案例外在迁移对照器中逐字段精确登记。


## 候选安装与恢复

TS 候选提供 `install`、`uninstall`、只读 `doctor` 和显式
`recover [--config-dir PATH] [--dry-run]`。文件阶段使用版本 1 journal 和绑定哈希的
原始快照；中断待恢复状态阻止新的配置写入，渲染／runtime 观察仍可使用。恢复先核验
全部目标，再还原字节／缺失状态／模式，或保留已确认提交的阶段。官方写入结果通过
实际库存、缓存哈希及 argv 绑定核对，不盲目重放记录的写入参数。持久刷新意图在
卸载／重装间隙保留用户明确禁用。上述新增文件不改变显示／UI／runtime 协议 schema。
参见[候选恢复契约](typescript-migration/ts-04/recovery.zh-CN.md)。


## 配置与示例解释协议

`explain` 接受 `{draft, scope, width}`，范围为 `main` 或 `subagent`，宽度为 2–10000 的整数。返回 `sample:true`、范围、宽度、`actual_availability:"not_observed"`、与 preview 一致的 `preview`，以及按实例 ID 对应的 `instances`。每个实例包含类型、开关、附带来源的原因和逐示例行结果；`truncated` 单独记录裁剪，最终结果可为可见、条件隐藏、优先级省略、宽度省略、空值、隐藏代理行或间隔。示例结果的来源固定为示例，不是实时观察。

`reasons.origin` 区分草稿配置、本地配置、已知宿主能力和未知证据。安装归属和运行偏好读取失败时返回未知；正常读取缺失的偏好使用既有默认关闭语义。`explain` 不获取安装锁、不创建目录或修复文件，不读取转录、任务/用量缓存或 Git。既有 `read` 仍使用安装锁保护快照，可能创建锁目录；`preview` 继续完全不读取配置或检测宿主。

`describe.presets` 增加 `purpose_key`、`requirements_key` 和 `example`；展示顺序优先四种用途，再列两个示例，预设 ID 和扩展语义不变。协议 24 要求匹配的前后端资源；显示 schema 15、运行协议 3、portable 1 和 UI preferences 1 独立保持兼容。

## 设置与完整外观契约

新的 `display.powerline` 对象使用封闭选项与兼容默认值，schema 15 和编辑器协议 24 要求匹配资源。`describe.options` 与 `editor_fields` 从同一描述生成五种 Powerline 控制。既有预设注册表新增三套完整方案，不另建注册表。setup 使用独立的只读检查与仅保存显示服务，不在编辑器协议新增安装操作。[实现与验收](setup-appearance.zh-CN.md)。

## 数据源协议

`sources_read`, `sources_apply`, `source_review`, `source_context`, `source_refresh`, `source_status`, `source_cancel`, `source_diagnose` 提供注册管理、独立审查与可取消刷新；`sources_apply` 使用注册表修订检查并单独提交。`source_refresh` 返回任务而不等待命令执行。显示引用不包含程序或文件路径，便携导出清除绑定 ID；选择性导入仅清除被导入分区的绑定。

## 功能契约演进

以下版本记录各功能引入时的接口。当前编辑器协议为 24、显示 schema 为 15；旧协议客户端必须使用匹配的软件包资源。

### 图形指标契约

显示 schema 11 / 编辑器协议 18 为适用实例增加可选 `presentation`、`bar_width`、`bar_style`。省略时为数字、8 格、自动字符。后端与双编辑器共用能力与校验，不支持的类型拒绝这些字段。版本 1–10 只读迁移，实际保存沿用备份及修订事务。runtime 2、lifecycle 4、portable 1、来源注册表/观察 1 不变。[交付记录](m4-m7-delivery.zh-CN.md)。

### 分组契约

显示 schema 12 / 编辑器协议 19 在主显示与子代理模板中增加 `groups`。每组包含 `id`、有序 `member_ids`、`primary_id`、`link_visibility`、`shared_powerline`。旧格式只读迁移为空组。共用规则拒绝重叠、spacer、不连续引用及跨显式行。复制重新映射成员，删除主指标解除分组。`group_hidden` 为明确的布局/样例原因；其他接口版本不变。

### WORKFLOW-02 automatic policy

编辑器协议 20 保持显示 schema 12。来源注册表 v2 新增本机 `automatic` 策略：`{source_id,enabled,review_revision,interval_seconds,auth_revision}`；v1 只读迁移为空策略列表，不改写文件。任务 v2 增加 `trigger` 与 `identity`，v1 任务按手动读取；观测仍为 schema 1。Runtime v3 增加 `source_lifecycle`，payload 为 `{session_id,epoch,seq,project,host_version,event}`（`tick|end`），继续支持 v1/v2 observe/read。生命周期独立于指标偏好，拒绝旧版协议调用新操作。策略使用既有修订锁保存，渲染不能续租或派发任务；`source_diagnose.automatic` 返回调度状态和时间。

### METRICS-01

显示 schema 13／编辑器协议 21 增加可选主栏 `session-cost-rate` 类型及实例选项 `cost_rate_basis: session|api`（省略为 session）。核心计算要求有限非负费用及至少 60,000 ms 的所选官方时长；关闭标签仍保留分母和估算标记，输入证据只列所选分母。旧显示文件只读迁移，不启用新类型或改写文件。来源、运行、便携及界面偏好版本沿用 WORKFLOW-02。

### 选择性导入契约

编辑器协议 22 保持显示 schema 13。`import` 与 `review_import` 在 `draft`、`path` 外接受可选 `selection` 数组；`profile_import` 可同时提供 `draft` 与 `selection`。省略选择时沿用完整导入，空选择产生不变草稿。未知或重复选择以及源文件无效引用被拒绝。对应格式解析先于共享选择逻辑，后续写入仍使用原有版本校验事务。选择与差异由 core 实现并生成到原生编辑器。

### 渐变契约

显示 schema 14、编辑器协议 23 为实例选项增加可选 `foreground_gradient`、`background_gradient` 数组；null 表示关闭，否则包含 2～5 个 RGB 颜色。省略时关闭，较低源 schema 不接受新增字段，预设保存前展开。内部着色回调经过拟合与语义换行后执行，不进入传输格式，既有预览 span 结构不变。


### 显式行对齐 / COMPOSITION-03

显示 schema 15、编辑器协议 24 增加可选 `layout.alignments`：
`[{"id":"summary","columns":[[{"kind":"instance","id":"a"},{"kind":"group","id":"g"}]]}]`。
引用按当前显式主行中的完整单位解析，保存前检查 ID、行唯一性、spacer 侧别、顺序及关系重叠。旧 schema 拒绝该字段。两阶段布局先测量、保留隐藏列位，再使用共享颜色游标及观察缓存绘制。宽度回退保持原有拟合路径；解释／诊断新增 `alignment_active`／`alignment_collapsed` 原因码，响应外层不变。双编辑器的 Layout 管理由 core 生成，原生 Client 端口传递尚未保存的管理器状态。
