# 本地数据源、GitHub 检查与链接

[English](EXTENSIONS.md) | **简体中文**

扩展能力按需启用。显示组件引用本机注册的数据源；添加组件、导入方案、选择项目都不会自动启用源。外部值不计入官方任务、token 或费用总量。

## 使用两个编辑器配置

打开 **设置 → 数据源**，或在文本输入框之外按 **Ctrl+Y**。选择添加数据源，再选择本地 JSON、GitHub 或命令类型。Tab/Enter 移动到下一字段；Ctrl+S 将数据源保存为停用状态。程序参数使用 JSON 数组，输入映射使用 JSON 对象，参数按字面传递。

选择“审查并启用”，完整检查文件或程序路径、参数、工作目录、输入映射、作用范围与有效期，然后按 Enter 启用该修订。编辑数据源会撤销启用状态，必须再次审查。

通过主状态栏或子代理页面的现有组件选择器添加 `external-value`、`github-pr` 或 `github-ci`。使用“绑定到组件”选择兼容实例。数据源独立保存；显示草稿中的绑定仍需执行通常的“保存”。取消显示草稿不会撤销已单独保存的数据源变更。

“立即刷新”启动一个有时限的任务。“刷新状态”“取消正在进行的刷新”“查看来源和观测”提供结果和诊断。关闭编辑器仅释放自身刷新需求；仍有其他消费者或适用自动租约时继续执行。明确取消仍作用于整项任务。启用本身不会执行命令或网络查询。

## 本地 JSON

数据文件示例：

```json
{"value":0,"observed_at":"2026-10-23T08:00:00Z"}
```

数据源定义文件示例，将路径替换为实际绝对路径：

```json
{
  "kind": "json",
  "name": "队列",
  "scope": {"project": null, "session": null, "agent": null},
  "ttl_seconds": 300,
  "settings": {
    "path": "/absolute/path/queue.json",
    "pointer": "/value",
    "observed_at_pointer": "/observed_at",
    "unit": "项"
  }
}
```

注册、审查、启用并绑定：

```bash
claude-statusline source add queue --file queue-source.json --json
claude-statusline source review queue --json
claude-statusline source enable queue --review REVIEW_REVISION --json
claude-statusline config instance main add external-value
claude-statusline source bind queue --instance INSTANCE_ID --scope main --json
```

使用前述命令实际返回的 `review_revision` 和实例 ID。`source bind` 保存所选显示目标，可通过 `--profile NAME` 或 `--project PATH` 指定目标。`--config-dir PATH` 放在 `source` 后面。Windows JSON 路径需要转义反斜杠，也可使用正斜杠；支持空格和中文。

JSON Pointer 支持对象键和数组索引；`~0` 代表 `~`，`~1` 代表 `/`，不支持表达式或脚本执行。值必须为字符串、有限数值或布尔值。缺失/null 与 `0`、`false`、空字符串有不同含义。

文件上限为 1 MiB，拒绝链接、设备、FIFO、无效 JSON 和读取中变化的文件；建议生产工具通过原子替换写入。若文件包含 `version`，必须为 `1`；若包含 `source_id` 或 `scope`，必须匹配注册项和当前上下文。

渲染仅读取已选中且已启用的 JSON 源，同一帧中的重复实例共享观测。缺少观察时间时标记新鲜度未知，不使用文件修改时间替代。成功值保存在本地缓存，后续读取失败时可保留数值并明确标注错误。停用会阻止之后的外部文件读取。

## GitHub PR 与 CI

沿用现有 `gh` 认证。设置 `kind: "github"`、明确的项目或 worktree 范围，以及如下设置：

```json
{
  "host": "github.com",
  "repository": "owner/repository",
  "branch": "feature/example",
  "account": "your-gh-login",
  "pr": null
}
```

仅查询指定主机、仓库和分支，不切换账号，不猜测其他托管平台。多个开放 PR 匹配时，使用 `pr` 明确选择编号。非仓库、detached HEAD、本地与远端 HEAD 不符、认证失败、权限拒绝及检查不可用均有独立结果。已有宿主 `pr` 保持原义；`github-pr` 和 `github-ci` 是独立的主状态栏组件。

```bash
claude-statusline source refresh forge --project /absolute/project --json
claude-statusline source diagnose forge --project /absolute/project --json
```

刷新仅手动触发，总时限为 30 秒；渲染读取已发布观测，不运行 `gh`。缓存身份包含项目/worktree、账号、主机、仓库、分支、HEAD 和本地认证上下文。身份变化会使旧结果失效。凭据留在 `gh` 的认证机制中，不写入源配置、导出或诊断。

检查摘要区分失败、等待、通过、取消、跳过、未知、无检查、无 PR。失败优先于等待；通过要求至少一项成功，且没有失败、等待、取消或未知项。全部跳过仍显示跳过。该结果总结已观测检查，不代表 GitHub 合并资格或分支保护结论。

## 命令

设置 `kind: "command"`，例如：

```json
{
  "executable": "node",
  "args": ["-p", "String(42)"],
  "cwd": "/absolute/project",
  "input": {},
  "output": "text",
  "timeout_ms": 5000
}
```

保存时解析可执行程序位置，执行时使用字面参数，不经过 Shell。无法识别可执行格式的文本会失败，不会隐式转入 Shell。脚本需明确指定解释器；Windows `.cmd`/`.bat` 不会自动经 `cmd.exe` 执行。更改程序、参数、路径或输入后必须重新审查启用。

stdin 是仅包含选定映射的 JSON 对象。可用字段为 `project`、`session`、`agent`、`branch`、`head`，例如 `{"working_project":"project"}`；默认对象为空。子进程只继承必要系统环境，不自动接收模型或托管平台凭据。命令以当前用户权限运行，这不是操作系统沙箱。

文本输出清理为单行，以执行结束时间作为观察时间。`output: "json"` 要求输出下列独立版本契约的全部字段：

```json
{
  "version": 1,
  "source_id": "command-source-id",
  "scope": {"project": "/absolute/project", "session": null, "agent": null},
  "observed_at": "2026-10-23T08:00:00Z",
  "state": "valid",
  "value": 42,
  "unit": null
}
```

状态为 `valid`、`missing`、`partial`、`error` 或 `unsupported`；有效结果必须包含标量值。`observed_at` 可为 null，表示新鲜度未知。超时默认 5 秒，可配置 100 毫秒至 30 秒；stdout/stderr 总量上限 1 MiB。超时、取消、非零退出、输出超限及格式错误分别记录，同时终止后代进程，防止其保留管道。

`source refresh ID` 等待完成；`--no-wait` 返回任务 ID，供 `source status JOB_ID` 和 `source cancel JOB_ID` 使用。中断等待中的 CLI 仅释放自身消费者；`--no-wait` 返回后仍保留需求至完成或原 deadline。命令源同一时间只运行一个刷新。GitHub 按来源修订和上下文身份合并刷新；手动刷新登记独立消费者，不改写自动任务的初始身份。停用、删除、编辑会取消旧任务，配置修订与上下文检查会拒绝迟到结果。

## 新鲜度、分享与链接

有效期默认 300 秒，可设为 1 至 86400 秒。过期或刷新失败时可以保留最后已知值，但必须加前置状态标记；时间未知也会标记。身份不匹配时不展示旧值。完整时间、范围及任务原因见数据源诊断。所有预览使用固定样例，不读取源文件、不查询 GitHub、不执行命令。

便携导出保留来源提示，清除本机绑定 ID。导入必须重新明确绑定，即使已有同名源也不自动绑定。定义保存在所选 Claude 配置目录的 `claude-statusline-sources.json`；私有观测及任务位于 `statusline_runtime/sources`。普通配置恢复也覆盖数据源注册文件。不要在源定义中放置凭据。

支持链接的组件详情提供 `off`（默认）、`auto`、`on`。当前目录、项目名称、宿主 PR、GitHub PR/CI、子代理目录可链接到校验后的 HTTP(S) URL 或本地文件；目标缺失时保留纯文本。只有用户点击才打开目标，配置和渲染不会自动打开。

`auto` 使用终端提示，包括 `FORCE_HYPERLINK`；未知终端或未确认的复用器回退为文本。`on` 明确要求输出 OSC 8。外部编辑器预览保留链接，原生预览在宿主不提供链接绘制时保留可读标签。实际点击还取决于 Claude Code 和终端，参见[官方状态栏说明](https://code.claude.com/docs/en/statusline#osc-8-links-not-clickable)。

当前使用显示 schema 15、编辑器协议 25、来源注册表 2、观测 1 与来源任务 3。运行中的 v1／v2 旧任务只读兼容，不被新消费者加入。旧显示配置可读取，读取不会自动改写；明确保存时使用新格式。前后端不匹配时重新安装集成。运行时、任务生命周期、便携外层与方案集合格式版本保持不变。

## GitHub 自动刷新

先“审核并启用”来源，再在任一编辑器选择“审核自动刷新”。检查来源身份和间隔，←/→ 每次调整 60 秒，回车保存本机策略；Esc 放弃尚未保存的选择。默认间隔取来源有效期，限制在 60–86400 秒。CLI 支持该范围内任意整数：

```bash
claude-statusline source review forge --json
claude-statusline source auto-on forge --review REVIEW_REVISION --interval 300 --json
claude-statusline source diagnose forge --project /absolute/project --json
claude-statusline source auto-off forge --json
```

使用实际返回的审核修订。策略在本机持续保留至主动关闭，与显示保存及宿主安装分开。如果运行时 Mod 尚未安装或配置自动刷新，执行 `claude-statusline install`（或应用宿主集成），再重启 Claude。要求 Claude 2.1.289 及以上；原生计时、高级实时指标和原生编辑器可继续关闭。

支持的活跃会话每五秒续租；15 秒未收到心跳后租约失效。仅匹配项目／会话范围、分支和 HEAD 的上下文派发刷新。会话结束关闭对应租约，没有适用租约时停止自动工作，不安装常驻服务。多个会话对同一来源及身份共用任务。手动刷新与自动租约分别登记需求；结束一个会话、关闭自动刷新或退出一个编辑器，不会取消其他仍适用的需求。

诊断显示关闭／等待／运行／退避／暂停、间隔、下次尝试、最近尝试和最近成功时间。网络失败指数退避，最长一天；认证、权限、账户和身份失败暂停自动尝试，需手动重试成功或重新审核。认证环境变化需要重新审核自动策略。编辑来源撤销自动审核；停用、删除会取消任务。“关闭自动刷新”保留已启用来源和缓存；过期／错误标记仍生效，身份不匹配时隐藏旧值。

渲染、预览、导入及项目绑定均不派发刷新，JSON 源不参与自动调度，命令须按下述规则独立审核，本机策略不进入便携导出。无适用会话显示 `waiting/no_session`；不支持的宿主或未配置运行时集成无法续租。

## 可读状态与已保存检查详情

“查看来源和观测”及 `source diagnose ID` 共用可读摘要：启用状态、自动策略、等待／运行／退避／暂停、本次观测失败与新鲜度、上次成功、下次执行及上下文归属。最近任务摘要有界，展示退出状态、耗时和已清理输出；旧记录缺失的信息显示未知。`--json` 和高级 JSON 操作提供结构化详情。刷新失败后，旧成功值可能仍在 TTL 内；失败和新鲜度分别显示。

GitHub 检查详情保留名称、状态、已验证 HTTP(S) 链接、仓库、分支、HEAD 和采集时间。方向键按每页十六条浏览保存的观测，打开页面不会查询 GitHub。未知、缺失、取消、跳过及过期保留原含义；失败后保留的旧检查详情仍使用原始时间。

“取消正在进行的刷新”取消当前任务。“关闭自动刷新”释放自动需求，保留适用手动消费者。“停用来源”阻止新任务并取消未完成任务。关闭视图仅释放自身需求。

## 命令自动执行

先审核并启用准确命令，再通过前述 `auto-on` 入口单独审核自动执行。命令自动许可默认关闭，初始间隔为 **300 秒**，允许 60–86400 秒，与 `ttl_seconds` 独立。编辑来源撤销旧执行许可及自动许可；读取旧注册表不会补授许可。

运行时 Mod 每五秒续租，十五秒过期。仅已确认的项目、会话及本地代理传递审核过的输入映射；无法确认代理／项目归属时等待，不猜测。不安装常驻服务。同一命令来源串行，相同实际输入共享任务，不同上下文公平轮转并保留独立结果。繁忙时跳过，不积压补跑。临时失败指数退避；缺失程序、输出格式及配置／身份错误暂停，成功手动重试或重新审核后恢复。迟到结果不能写入已修改来源。

## 绑定清单与清理

绑定优先保留组件当前兼容记录，否则复用同一来源的兼容记录。来源库“绑定清单”列出未使用／重复记录，并提供显式清理审核。默认配置、全部命名方案／项目关联、已登记编辑器草稿及保留恢复事务保护其引用。审核发生变化或无法读取引用时拒绝删除。清理不改变来源定义或执行许可。

```bash
claude-statusline source bindings --json
claude-statusline source cleanup-bindings BINDING_ID --review REVIEW_REVISION --json
claude-statusline source release-draft DRAFT_OWNER --json
```

先检查引用，使用清单当前修订。崩溃编辑器可能留下保守草稿保留记录；仅在恢复、导出或明确放弃该草稿后释放准确 owner。正常关闭编辑器会释放记录。仅移除当前显示引用，不代表可以删除其他方案仍使用的记录。

旧 `source unbind ID --binding BINDING_ID` 删除同样在锁内检查全部引用，拒绝仍使用或无法确认的记录。先在编辑器解除组件引用，再优先使用带审核的绑定清理。
