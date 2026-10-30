# 复现状态栏演示

[English](SHOWCASE.md) | **简体中文**

本指南使用已发布的 **v3.16.0** 安装包和普通公开命令。[图库](images/showcase/README.zh-CN.md) 标明每件素材的配置、输入和采集方式；[开发记录](development/showcase.zh-CN.md) 保存安装包身份、验证结果及限制。样本预览不是你的账户测量结果，也不证明真实会话已成功加载安装。

**入口：**[安装](#install) · [选择场景](#scenes) · [编辑与复用](#edit) · [查看任务](#tasks) · [管理来源](#sources) · [审查版本](#versions) · [排障](#troubleshooting)

<a id="install"></a>

## 安装并完成首次配置

使用 Node 22 或 24，以及交互式终端。本次录制固定安装包版本，避免之后的 `latest` 悄然改变操作基线：

```sh
npx @fbincon/claude-code-statusline@3.16.0 --dry-run
npx @fbincon/claude-code-statusline@3.16.0
claude-statusline --version
claude-statusline doctor
```

首次入口先审查持久 npm 前缀和精确版本，再要求输入 `yes`。npm 下载 npx 入口可能另有确认。已有匹配的持久安装会被复用。已经安装时，可运行 `claude-statusline setup --dry-run`，再运行 `claude-statusline setup`。

在 setup 中查看检查结果，保留当前显示或选择完整方案，检查预览，最后选择**保存显示并集成**或**仅保存显示**。方向键选择，Enter 继续，Backspace 返回，Escape 取消。外部编辑器至少需要 64 列 × 18 行。本组演示使用紧凑分隔符；调整外观时保持 Powerline 关闭。

集成成功后重启 Claude，并查看真实状态栏。安装包、显示保存和宿主集成是独立阶段：取消 setup 可能保留已完成的 npm 安装，集成失败也可能保留已保存的显示。阅读阶段结果及备份路径，运行 `doctor`，并先用 `recover --dry-run` 检查再重试。按 L 明确保存的界面语言不随显示取消撤销。详见[首次配置与恢复](SETUP.zh-CN.md)。

<a id="scenes"></a>

## 选择不用 Powerline 的场景

下载以下单方案 JSON 文件。它们是现有方案的演示副本，不是新增内置预设。所有副本使用紧凑分隔符、清除不生效的行背景渐变并关闭共享 Powerline 色块；联动可见性及适用对齐关系仍保留。

| 文件／方案名称 | 派生自 | 观察重点 |
| --- | --- | --- |
| [daily.json](../examples/showcase/daily.json)／`Showcase daily` | `daily-development` | Ocean 主题、普通前景渐变、模型、目录、Git、上下文、任务时间及已启用的会话费用 |
| [agents.json](../examples/showcase/agents.json)／`Showcase agents` | `agent-workbench` | Slate 任务／活动组及独立代理行 |
| [quota.json](../examples/showcase/quota.json)／`Showcase quota` | `quota-cost` | Ember 额度／重置时间对齐、上下文／花费分组和费用速率 |
| [narrow.json](../examples/showcase/narrow.json)／`Showcase narrow` | `narrow-terminal` | 40 列下紧凑 ASCII 显示和自适应指示条 |
| [light.json](../examples/showcase/light.json)／`Showcase light` | `light-readable` | 浅色主题、可读的风险颜色，不使用彩色色块 |

在下载文件所在目录运行：

```sh
claude-statusline config profile import daily.json --dry-run
claude-statusline config profile import daily.json
claude-statusline config profile preview "Showcase daily" --width 120
claude-statusline config profile preview "Showcase daily" --scenario warning --width 80
claude-statusline config profile activate "Showcase daily"
claude-statusline config set statusline-language zh-CN
claude-statusline configure --user
```

换成其他文件及其精确名称即可导入、预览另一套方案。导入创建命名方案；激活才明确复制到用户默认显示。名称已存在时，需明确使用 `--overwrite`，或通过 `--name` 使用新名称。要编辑保存的命名方案而不是已激活的默认副本，使用 `claude-statusline configure --profile "Showcase daily"`。之后修改命名方案不会改变独立的用户默认副本。

激活后运行 `config set statusline-language en` 可改为英文状态栏。`--language zh-CN` 只改变本次命令的界面语言，不改变方案输出语言。命名方案的输出语言应在该方案编辑器中修改并保存。

可用样本包括 `normal`、`warning`、`critical`、`zero`、`missing`、`source-stale`、`source-failed`、`long-content`、`git-clean`、`git-modified`、`git-conflicted`、`no-agents`、`few-agents`、`many-agents`。预览不调用模型、不执行来源、不写显示设置。比较 40／80／120 列；缺失观察不等于零。真实数值取决于当前会话提供的字段及已启用的采集。

连续行背景要求彩色 Powerline 输出，因此本组演示不启用它。普通前景渐变不依赖 Powerline。[外观指南](APPEARANCE.zh-CN.md) 解释两者的条件；原有[八套完整方案](SCHEMES.zh-CN.md) 保持可用。

<a id="edit"></a>

## 编辑、审查与复用

用 `claude-statusline configure --user` 打开外部编辑器，或在已安装 Native 集成的受支持 Claude 终端中运行 `/statusline-configure-native`。`/statusline-config` 是对话式指南，不是 Native 编辑器命令。

1. 确认页首编辑目标。在设置中选择样本场景和预览宽度，检查主状态栏和子代理预览。这些预览控制只属于当前编辑会话。
2. 打开组件，修改普通前景色或前景渐变。先取消一次表单，确认保留原草稿，再接受修改。
3. 按 Ctrl+T 打开**变更与历史**，在其中用 U 撤销、R 重做。在管理页之外，外部编辑器撤销为 Ctrl+Z，Native 撤销为 Ctrl+_，因为 Unix Claude 可能截获 Ctrl+Z；重做为 Ctrl+R。
4. 用**显示方案与项目**（Ctrl+O）将单方案文件的选定设置导入当前草稿。只选择需要的部分，审查差异并接受，再另行保存。
5. 打开目标组件的**复制／粘贴视觉样式**，选择来源及兼容的视觉字段。目标指标、本地绑定、位置和可见性保持原样。
6. 用设置中的**复用完整组**导入整组，审查依赖及需要的自动转显式布局。导入的本地来源绑定保持未解析，直到另行绑定；导入不会启用来源。
7. 审查、保存、关闭，再打开同一目标确认持久化。另做一次修改后取消，确认已保存显示不变。

CLI 的只读选择性导入审查：

```sh
claude-statusline config profile import light.json --select theme,palette --user --dry-run
claude-statusline config profile export "Showcase daily" saved-daily.json
```

去掉 `--dry-run` 才明确把选定字段保存到选定目标。导出写新文件，不会把编辑器草稿标为已保存。来源授权、界面语言和独立的宿主 Apply 不属于显示撤销。保存结果未知时，先核对已保存状态再编辑。发生冲突时，可比较或导出并保留草稿；丢弃／重载需要明确确认。详见[草稿历史与复用](DRAFT_HISTORY.zh-CN.md)、[方案](PROFILES.zh-CN.md)和[组合](COMPOSITION.zh-CN.md)。

<a id="tasks"></a>

## 查看真实任务和子代理

普通任务可使用自己的现有账户，通过 Claude 非交互预算选项控制：

```sh
claude --print --max-budget-usd 1 --output-format json \
  'Reply exactly SHOWCASE_SINGLE_OK. Use no tools.'
```

双代理观察：

```sh
claude --print --max-budget-usd 2 --output-format json \
  'Start exactly two agents concurrently. Ask the first to reply SHOWCASE_A_OK and the second SHOWCASE_B_OK. Each agent must use no tools, change no files and perform no network work. After both finish, reply SHOWCASE_AGENTS_OK. Do nothing else.'
```

交付录制器在来源记录中固定实际提示、会话身份和结果。这些请求可能产生模型费用，配置和样本预览不需要它们。Claude 预算参数只适用于 `--print`，不能假定它会限制普通交互录制；再次尝试前检查费用和完成状态。本次交付的调用另用共享的 10 美元账本，公开指南不复用该私有账户或账本。

打开 `/statusline-task`，或从自己的会话元数据／状态栏输入取得精确会话 ID 后运行：

```sh
claude-statusline task show --session-id SESSION_ID --json
claude-statusline task view --session-id SESSION_ID
```

替换 `SESSION_ID`，不要用图库脱敏 ID 查询本地数据。加上 `--prompt-id PROMPT_ID` 可选择已知历史任务。`/` 搜索名称／ID，F 筛选已观察到的状态，Enter 展开选中代理，E 查看证据，R 手动刷新，Q 关闭。设置中的**任务详情**会返回原配置草稿。

检查任务总时间与代理经过时间的作用域差异，完成时长是否冻结，以及不可用的活跃时间是否仍标为不可用。外部查看器可能显示 ID，而 Native 能从宿主取得名称。刷新失败会保留上一次报告及其采集时间。两个查看器都不扫描转录、不启动采集、不查询 GitHub，也不调用模型。详见[任务详情](TASK_DETAILS.zh-CN.md)。

图库任务动图先通过已安装渲染器回放已记录的完成观察值，再展示离线任务查看器读取这些状态，并非原 statusline 回调录屏。英中主任务／代理结束时长都保持 14 秒和 5／7 秒；面板标明未知或不完整的活跃计时覆盖仍然如此。会话记录费用 0.00199048 美元，在生产显示中四舍五入为 `$0.00`，不代表免费。选取的关键帧各停留 1.4 秒，因此动图不是实时录像或响应速度基准。

<a id="sources"></a>

## 登记、审查和检查来源

以下可选步骤创建本地来源记录。使用独立 ID 以及自己拥有的目录。两个编辑器的**设置 → 数据来源**（Ctrl+Y）提供相同审查流程。来源定义保存独立于显示保存和撤销。

本地 JSON 示例：用当前 ISO 时间创建 `queue.json`，再在来源定义中写入绝对路径：

```json
{"value":0,"observed_at":"2026-10-30T08:00:00Z"}
```

上面的时间仅为示例；旧时间应当正确显示为过期。将以下内容保存为 `queue-source.json`，替换文件路径：

```json
{
  "kind":"json","name":"Showcase queue",
  "scope":{"project":null,"session":null,"agent":null},
  "ttl_seconds":300,
  "settings":{"path":"/absolute/path/queue.json","pointer":"/value","observed_at_pointer":"/observed_at","unit":"jobs"}
}
```

```sh
claude-statusline source add showcase-queue --file queue-source.json --json
claude-statusline source review showcase-queue --json
claude-statusline source enable showcase-queue --review REVIEW_REVISION --json
claude-statusline config instance main add external-value
claude-statusline source bind showcase-queue --instance INSTANCE_ID --scope main --json
claude-statusline source diagnose showcase-queue --json
```

使用前序命令实际返回的 `review_revision` 和实例 ID。已启用 JSON 在绑定组件真实渲染时读取；样本预览不读该文件。明确的零是有效数据。删除字段或等待时间戳过期可观察缺失／过期结果，不把它们描述为有效的实时值。

命令来源可采用相同的添加 → 审查 → 启用流程，定义例如：

```json
{
  "kind":"command","name":"Showcase command",
  "scope":{"project":null,"session":null,"agent":null},
  "ttl_seconds":300,
  "settings":{"executable":"node","args":["-p","String(42)"],"cwd":"/absolute/project","input":{},"output":"text","timeout_ms":5000}
}
```

保存为 `command-source.json`，以 `showcase-command` 为 ID 添加，审查并启用精确修订，再明确执行和检查：

```sh
claude-statusline source refresh showcase-command --project /absolute/project --json
claude-statusline source diagnose showcase-command --project /absolute/project --json
```

参数按字面传递，不隐式经过 Shell。修改来源会撤销旧审查。命令只接收选定映射的输入和必要 OS 环境，不接收模型或代码托管凭据。

GitHub 示例使用 `fbincon/claude-code-statusline` 检出目录、目标分支及匹配的远端 HEAD，并使用自己已有的 `gh` 登录。通过编辑器添加 GitHub 来源，明确填写宿主 `github.com`、仓库 `fbincon/claude-code-statusline`、实际项目根、分支和账户。审查并启用后，选择**立即刷新**及**检查来源与观察值**。查询是只读的。无 PR、检查不可用和认证失败都不等于成功；仅打开页面或预览不会请求网络。复现图片无需使用交付账户名称或切换凭据。

三种停止操作有不同含义：

```sh
claude-statusline source cancel JOB_ID --json
claude-statusline source auto-off SOURCE_ID --json
claude-statusline source disable SOURCE_ID --json
```

第一项明确取消整个刷新作业；第二项关闭该来源的自动策略，保留启用状态及其他消费者；第三项禁用来源，停止后续读取／执行。关闭一个编辑器只释放它自己的兴趣。本指南不要求启用自动刷新；若选择启用，需要另行审查。结束后禁用演示来源；删除仍被引用的记录前先解除绑定。详见[来源操作与清理](EXTENSIONS.zh-CN.md)。

<a id="versions"></a>

## 审查版本并明确恢复

在任一编辑器打开**设置 → 版本与安装**。首次进入只读本地身份。以下命令明确检查元数据，再以 dry-run 审查精确目标：

```sh
claude-statusline update --version 3.16.0 --prefix /actual/prefix --check --json
claude-statusline update --version 3.16.0 --prefix /actual/prefix --dry-run
```

将 `/actual/prefix` 替换为版本页显示的真实安装包前缀。只有当前 npm 默认前缀指向同一安装时才省略它。自定义安装可以正常运行，但 npm 当前默认值可能指向别处；另一个前缀的 `not_installed` 不代表应该重装正常产品。配置目录非默认时，也应传入实际 `--config-dir PATH`。

核对安装包／配置兼容性和阶段结果。元数据检查报告 `artifact_verified: false`，不等于安装包校验。需要准备替换包的 dry-run 也会验证归档，可使用临时目录和 npm 缓存，但不替换目标包或配置。已是当前版本时，可以像本次演示机器一样返回 `unchanged: true` 及 `artifact_verified: false`，该结果不代表下载包验证。

图库版本图只裁切操作和诊断区，不是完整的前缀／版本页首。它保留多个前缀的警告：检查或改变版本前应明确选择目标安装。

实际版本切换应在独立前缀和空配置目录中演练。例如在 POSIX 上创建隔离目录，在那里安装 3.15.0，再使用固定的新版管理入口：

```sh
showcase_lab=$(mktemp -d "${TMPDIR:-/tmp}/statusline-showcase.XXXXXX")
SHOWCASE_PREFIX="$showcase_lab/prefix"
SHOWCASE_CONFIG="$showcase_lab/config"
mkdir -p "$SHOWCASE_CONFIG"
npm install --global --ignore-scripts --prefix "$SHOWCASE_PREFIX" @fbincon/claude-code-statusline@3.15.0
npx @fbincon/claude-code-statusline@3.16.0 update --version 3.16.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --dry-run
npx @fbincon/claude-code-statusline@3.16.0 update --version 3.16.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --yes
npx @fbincon/claude-code-statusline@3.16.0 rollback --version 3.15.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --dry-run
```

先执行目录／变量设置，再执行包命令，不要替换成正常安装路径。本练习只管理隔离包，不连接真实 Claude 集成。确认兼容性后才用 `--yes` 应用回退；不同语言／配置可能合理地阻止旧包安装。

真正发生中断时，保留输出的事务／控制入口，先用 `recover --package --prefix PATH --config-dir PATH --dry-run` 审查。包修复和 `recover --restore-config pkg-BACKUP_ID` 是不同操作，不应为截图破坏正常安装。关闭执行页仅分离视图，不取消持久作业。受保护历史清理拒绝运行中、未知或仍被引用的记录。详见[完整版本与恢复指南](PACKAGE_MANAGEMENT.zh-CN.md)。

<a id="troubleshooting"></a>

## 阅读结果与排障

| 现象 | 下一步 |
| --- | --- |
| 预览有数据，真实状态栏没有 | 预览使用固定观察值。核对实际宿主字段、采集关闭偏好及[输入诊断](DIAGNOSTICS.zh-CN.md)，不要只为模仿图片而启用采集。 |
| 背景渐变没有效果 | 本组方案关闭 Powerline。使用普通前景渐变，或查看独立的 Powerline 条件。 |
| 来源无值、过期或失败 | 检查精确作用域、修订、时间和已存错误。零与缺失不同；审查来源后再决定刷新。 |
| 导入改变草稿，但状态栏未变 | 编辑器接受与保存分开；CLI 命名方案导入与激活分开。检查当前目标／项目绑定。 |
| 保存未知或冲突 | 保留草稿，核对已保存状态并重新审查，不强行用旧修订覆盖新设置。 |
| setup／update 只完成部分阶段 | 分别阅读包、显示和集成结果，保留备份／控制入口并审查相应恢复操作。 |
| 命令能运行，版本审查却报告 `not_installed` | 用 `--prefix` 选择真实安装前缀；npm 默认值可能已经变化，或本就不同于命令的安装位置。 |
| 终端太窄或不支持颜色／字形 | 试用 `Showcase narrow`、40／80 列预览或无色输出。完整数字／字素及真实缺失状态优先于装饰。 |

[图库](images/showcase/README.zh-CN.md) 提供替代文本、输入来源和方法标签。终端重建和代理视觉检查不构成新的真人可用性研究或实体平台验收。[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口仍未验证。
