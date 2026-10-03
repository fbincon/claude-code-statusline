# 共享目录与 JSON 配置协议

[English](contracts.md) | **简体中文**

协议 v1 是源码原生前端使用的内部接口。显示配置继续使用 schema v2，并兼容原有 v1 读取；协议与持久化版本独立演进。已发布 wheel 不会安装原生编辑器。

## 共享目录

`claude_statusline.config.catalog` 以 `(scope, id)` 定义 24 个主显示项和 10 个子 Agent 项，提供名称、说明、分类、来源、示例、默认位置、格式选项、互斥关系和不可用原因。原有目录字典和默认元组是派生视图，保留项目 ID、说明、默认选择与顺序。CLI JSON 列表增加元数据，保留 enabled/position 字段；curses 和安装后的向导使用同一份定义及互斥关系。

最低版本只在有证据时声明。子 Agent 的 2.1.205 门槛表示行支持，不保证所有可选字段；effort 需要 2.1.214。尚未证实的主字段最低版本使用 `null`/`unknown`，不猜测日期。`not_observed` 表示接口尚未观察实时数据，`unsupported_host` 表示已证实的版本边界，`unknown_host_version` 表示版本检测失败，`source_unavailable` 表示来源无法读取，`condition_not_met` 涵盖非 Git 仓库或未启用 fast mode 等条件。这些是可能原因的定义；打开配置不采集实时字段，也不因尚未观察到数据而禁用选择。

## 传输与操作

执行 `claude-statusline ui --config-dir PATH`（Windows 使用 `claude-statusline.exe`）。单进程从 stdin 读取一个 UTF-8 JSON 对象直到 EOF，stdout 只输出一个 JSON 响应及换行；意外故障诊断写 stderr。成功退出码为 0，拒绝请求为 2。

```json
{"protocol_version":1,"operation":"read","payload":{}}
```

成功响应为 `{"protocol_version":1,"result":{...}}`；失败为 `{"protocol_version":1,"error":{"code":"...","message":"..."}}`。校验封装和 payload 字段，拒绝重复 JSON 键、非有限常量、错误版本/类型、未知操作及非法草稿。

| 操作 | Payload | 结果 |
| --- | --- | --- |
| `describe` | `{}` | 目录、配置选项及范围、能力、后端版本和支持的操作 |
| `read` | `{}` | `draft`、`revision`、`installed`、`installation`、能力及后端版本 |
| `preview` | `{"draft": {...}, "width": 80}` | `sample: true`，以及由可绘制 spans 组成的 `main` 和 `subagents` 行 |
| `apply` | `{"draft": {...}, "expected_revision": "<read 返回的 revision>"}` | 保存后的读取快照、`changed` 和 `backup_dir`（路径或 `null`） |

`draft` 仅包含 `display`（有效 v2 显示配置）和 `host`（`padding`、`refresh_interval`、`hide_vim_mode_indicator`），每个字段均为必填。JSON 宿主布尔/数值严格校验：padding 为 0–32 的整数，refresh 为 1–3600 的整数或 `"event"`；拒绝 `"off"` 等字符串及小数。读取现有显示 v1 文件时只在内存中规范化，不迁移原文件；预览也接受完整的 v1 显示对象。apply 必须使用 read 返回的完整 v2 草稿，避免旧输入静默覆盖新设置。预览宽度为 2–10000 的整数。

`read` 使用现有安装锁获取一致快照，可能创建运行锁目录；`describe` 不创建配置文件。`preview` 不读取设置、检测宿主、采集 Git/transcript 或写缓存/锁，只使用生产格式和布局及固定样例。尚未观察到的数据不是零。每个 span 包含 `text`、`bold`、`foreground`，后者为 `null`、`{"kind":"rgb","value":"#rrggbb"}` 或 `{"kind":"ansi","value":0..15}`，没有原始 ANSI 转义。返回主行和子 Agent 行；空选择和关闭子 Agent 显示仍返回空行列表。

能力将宿主版本与实际 Mod 加载情况区分开。`native_mod` 为 `unsupported`、`unknown` 或 `unverified`；`native_mod_loaded` 为 `null`，Python 进程无法证明当前会话加载了什么。实际 Mod 回调及 PTY 交互提供加载证据。

## Revision 与前端生成

不透明 SHA-256 revision 覆盖规范化的有效显示/宿主配置，以及 `statusLine`、`subagentStatusLine` 的 type、命令身份和归属分类。数组顺序有意义；JSON 空白/键顺序与无关设置不触发冲突。命令只解析和规范化，不执行。

apply 在取得共享安装锁之前校验完整草稿和 64 位小写十六进制 revision。配置服务取得锁后重读两个文件，比较 revision、检查归属，再复用现有备份、原子写入和回滚事务。curses 将打开时的快照传给同一服务，使用同一 revision 检查。返回 revision 在锁内根据提交后的快照计算，不另做无锁读取。

显式设置的 renderer 绝对路径必须与选定后端匹配；保留 Windows 和旧安装使用的规范 PATH 命令兼容性，解析后的命令身份参与 revision。通过绑定的 console-script 路径调用 JSON 接口时，使用该入口的身份，即使 PATH 中存在另一安装。拒绝外部主或子 Agent renderer，包括其他目录下的同名可执行文件和非 command 类型设置；允许子 Agent renderer 尚未安装。apply 只编辑显示选择和本工具主 renderer 的宿主选项，不安装 renderer、不接管外部归属。

无关设置从最新锁内快照合并；写入失败恢复两个文件的原始内容，并报告回滚失败。首次保存可能创建缺失的显示文件或将 v1 迁移至 v2；持久化配置已经相同时，使用返回的草稿/revision 重复保存不写文件、不创建备份。事务实际改变文件时才返回 `backup_dir`，无需调用模型。

| 错误码 | 含义与恢复 |
| --- | --- |
| `invalid_json`、`invalid_request`、`invalid_configuration` | 修正封装、payload 或草稿；非法 apply 输入不会写配置 |
| `unsupported_protocol`、`unsupported_operation` | 使用匹配的前后端协议及支持的操作 |
| `configuration_conflict` | 另一编辑器或安装操作改变了配置，重新读取并协调草稿 |
| `not_installed` | 主 renderer 不存在，保存前安装选定后端 |
| `ownership_mismatch` | renderer 属于其他安装或所有者，保存前解决归属 |
| `io_error` | 文件操作失败，检查消息及回滚诊断 |
| `internal_error` | 意外后端故障，检查 stderr |

`claude_statusline.ui.contracts` 的 Python 类型生成 `lib/generated-contracts.ts`。运行 `tools/generate_ui_contracts.py` 重新生成，`--check` 检查漂移；不维护第二份目录，不手改生成类型。Mod 使用 `$.process.run` 参数数组与 JSON stdin；PATH 不合适时通过 `CLAUDE_STATUSLINE_NATIVE_EXECUTABLE` 指定后端绝对路径，存在 `CLAUDE_CONFIG_DIR` 时显式传递。不会进行 shell 插值。

桥接拒绝非法或截断响应、协议版本不匹配及非零退出，保留冲突等结构化后端错误。进程启动/拒绝错误使用 `backend_process`，超时错误使用 `backend_timeout`；宿主进程调用的超时为 30 秒。验证入口显示故障并提供预览重试；打开失败后重新打开会重读配置。

原生入口打开时读取目录和配置，TypeScript 保留草稿，变化或缩放时请求预览，普通重绘复用缓存。Esc 或 Close 按钮关闭时丢弃草稿并使未完成的旧响应失效；旧宽度响应不能覆盖当前预览。颜色切换仍不保存，验证入口始终不调用 apply；完整保存界面仍属于 Phase 2。

参见[架构](architecture.zh-CN.md)、[原生验收](native.zh-CN.md)和[测试](testing.zh-CN.md)。
