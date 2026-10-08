# Changelog

[English](CHANGELOG.md) | **简体中文**

## Unreleased

## 1.7.6 - 2026-10-09

- 会话内编辑器通过明确的主题文字／背景／选中色跟随 Claude 实际主题；快捷键使用主要文字色并加粗，辅助说明和恢复控件清晰可辨。保留独立的宿主偏好 Apply、既有编辑与协议行为。
- 样例预览整行填充独立深底，保留原始 RGB／ANSI span，无颜色样例使用中性前景；终端验收与捕获渲染共用正确的默认色／反色解析。
- 增加页面／状态、主题独立 Apply／拒绝及终端颜色回归；固定宿主 CI 增加三平台 Claude Code 2.1.294，发布要求 13 项 Python／构建与十项 Mod 检查。补充可复现主题捕获与双语说明。
- Python 与两个 Mod 发布 manifest 同步至 1.7.6。

- Gitee wheel 说明改为先下载并校验，再用 pipx 安装本地文件；直接 pip／pipx 附件 URL 下载可能返回 HTTP 403，而浏览器／curl 下载正常。保留已发布软件包字节及 GitHub 安装命令。

## 1.7.5 - 2026-10-08

- 文档、语言切换、许可证与截图使用相对链接，使同一 main 分支适配 GitHub 和 Gitee；仅在包元数据中生成固定 GitHub 标签链接用于 PyPI 介绍。源码 README 保留通用包名命令，不新增版本／更新说明区。
- 新增本地 Gitee 发行说明生成器，使用 GitHub 公开元数据与已核实的 Gitee 附件地址，保留历史包名、标签、支持结论及预发布属性；补充可重复的任务驱动同步与说明备份流程。
- Python 和两个 Mod 发布 manifest 同步至 1.7.5；CLI、配置、运行行为及仓库布局保持兼容。
- 对刚上传版本最多等待三分钟，使索引可见；仅重试缺失／404 读取，权限、身份与校验和错误立即拒绝，不重复上传。

## 1.7.4 - 2026-10-08

- 将分发名改为 `fbincon-claude-code-statusline` 用于 PyPI，保留 `claude_statusline` 导入、`claude-statusline` CLI、配置归属与可移植导出；Python 与两个 Mod manifest 同步为 1.7.4。
- 新增基于已验证 Release 附件的 GitHub Actions 可信发布：准确标签／主分支 CI 门槛、TestPyPI 验收、公开 Release 后正式上传、索引下载／安装验证与部分上传重试校验。PyPI、GitHub 和 Gitee 使用相同原始附件。
- 双语 README 使用不依赖项目版本的 PyPI 命令，修复长描述图片／文档链接并展开仓库结构；补充旧 wheel 迁移及双语维护者发布流程，CI 增加严格包元数据检查。

## 1.7.3 - 2026-10-07

- doctor 成功与迁移提示显示实际支持的显示 schema，apply 草稿要求使用同一版本常量；补充旧版、当前及版本常量变化的只读回归。
- 用 21 张原始 TUI 截图更新双语 README，按入口、平台和页面组织；原 18 张图库图片归档并保留 PNG 字节、来源和哈希。
- 核对双语 README、使用／CLI 指南、显示项和开发文档，修正 60 个主栏／14 个子 Agent 项、协议 v4 示例、独立计时／指标默认值、CI 覆盖和任务完成说明，保留历史验收数据。
- 补充可选执行耗时、覆盖不足、task-timer 及 prompt-timer 别名，以及独立原生／会话／API 耗时说明；Python 和两个 Mod 同步至 1.7.3，更新稳定安装链接。

## 1.7.2 - 2026-10-07

- 会话内大标题改为 Configure Status Line，使用与分区标题一致的青色；字母按键显示大写、作用说明小写，保留数字页签名称和标准组合键写法。
- 快捷键集中到底部，按状态展示并完整换行。各页 Tab 优先；Main/Subagents 顺序为 Tab、Space、选择、排序、格式、搜索。保留 Filter 搜索入口，Settings 按对应状态展示 H/A，编辑／恢复操作与普通动作分开。
- 底部行数与键盘分页共用布局预算；32×12 保留选中项和实际样例预览，高度不足时缩短说明并省略次要提示。
- 普通快捷键在非编辑状态兼容 ASCII 大小写，保留混合大小写输入、Ctrl/Meta 与 Shift+Tab；更新官方回归、已安装终端验收和双语说明。
- Python 与两个 Mod 同步至 1.7.2；配置、协议、安装偏好和计时行为兼容，历史截图及来源记录保留。

## 1.7.1 - 2026-10-07

- 将会话内 Client 栏目标题移入框线，Settings、Layout 和格式详情按实际分组／字段行数填满后分页；翻页保留页内字段位置，缩放保留草稿输入和选中项。
- Layout 将模式、行边界、逐项适配连续排列，格式详情先集中格式再显示适配控件；按终端显示单元对齐字段与值。
- 两编辑器使用白色粗体按键与普通弱化作用说明，窄窗口只显示完整快捷键组；保留 h 展开／收起明确命名的 Claude preferences 与独立 Apply。
- 将现有 Linux、macOS、Windows Layout 示例移入 README 对应平台图库，保留 PNG 字节和捕获来源；移除用户指南重复示例与图库跳转文字。
- Python 和两 Mod 同步为 1.7.1；显示 schema v5、配置协议 v4、运行协议 v2、已保存偏好及安装默认行为继续兼容。

## 1.7.0 - 2026-10-07

- 维护者确认 v1.7.0a1 在 Linux、macOS、Windows 三个平台验证完成后，将已验收任务计时预览晋升正式版；本次确认未提供具体 OS、架构、终端或宿主版本。
- Python 和两 Mod 同步为 1.7.0，更新稳定安装／升级链接，建立新的稳定 Latest Release。兼容宿主正式安装默认请求两个编辑器，保留已保存的关闭选择；原生计时和高级指标继续使用独立偏好。
- 沿用已验收任务时钟、提交与 Agent 归属、等待覆盖诊断、兼容别名及协议：显示 v5、配置协议 v4、运行偏好 v2、运行协议 v2、生命周期 v4。
- 完成 PR／合并／标签 CI、固定合并分发包检查、独立重建／安装、已安装编辑器及运行 smoke、捕获会话复核和草稿／公开资产验证后发布。保留 a1 标签、资产、预览状态及原共享预算账本；正式晋升不新增付费模型调用。

## 1.7.0a1 - 2026-10-07

- 将 prompt 计时重构为持久任务生命周期及独立、不可变的暂停／恢复时钟。默认 `task-timer` 包含提交、排队、子 Agent、报告及主 Agent 收尾；CLI、导入、逐项选项和布局保留 `prompt-timer` 别名。
- 新增默认关闭的 `task-active-timer`，仅在身份、事件、等待和启动时钟证据完整时显示。原生单轮耗时独立保存，完成、失败及中断冻结；原始 Stop 为候选，可信活动继续原任务，匹配 transcript 或已核验 idle 确认兼容终态。
- Claude Code 2.1.289+ 默认采集必要计时元数据，高级指标仍按需启用。运行偏好 v2 保留旧版显式关闭并增加独立计时开关；显示 v5、配置协议 v4、运行协议 v2、生命周期 v4 支持旧版读取和共享兼容入口。
- 使用稳定 Windows 启动身份、严格执行时钟退化判断和增量有界提交索引；保留历史冻结值，不推算缺失执行时间。并行收尾保留后台报告及消息的明确关联。
- 补齐回归、默认原生／关闭采集、共享预算真实 Linux 生命周期及不同历史规模性能验证，说明迁移、降级和预览验收边界。本版为非 Latest 预览版，稳定安装链接继续指向 v1.6.1。

## 1.6.1 - 2026-10-05

- 统一外部 TUI 四页与格式详情的页面标题、连续分组、对齐栏目、选中行和独立 Preview。64×20 起使用标题边框，64×18–19 使用紧凑分隔；全局与页面操作分行显示。
- Settings 按用途归组，Layout 将模式、行边界与逐项适配集中排列；用稳定字段 key 分派原有设置，分组标题不参与选择，滚动与分页计入标题高度。
- 在 UI 子系统独立纯布局与窗口预算，补充边界／Unicode／色彩回归、安装包五尺寸 PTY、真实捕获与双语文档。Python 和两 Mod 同步 1.6.1；显示 v4、配置协议 v3、运行协议 v1 及已保存偏好继续兼容。

## 1.6.0 - 2026-10-05

- 维护者确认 v1.6.0a1 在 Linux、Windows、macOS 验收通过后晋升完整 Phase 5 预览；未提供的 OS／架构／终端／宿主信息保持未知，保留已知 macOS Client 输入限制。
- Python 和两 Mod 同步为 1.6.0，更新当前安装／升级链接。兼容入口采用正式编辑器默认启用行为，保留明确 false；实时采集继续独立默认关闭并保留已有偏好。
- 沿用十一项可选指标、已提交分支比较、结束代理时长冻结和已验收运行实现。显示 schema v4、配置协议 v3、运行协议 v1 与 a1 一致，旧显示文件仅真实保存迁移；保留预览标签／资产／发布状态及截图来源。
- 正式交付要求全部 20 项 PR／合并／标签 CI、固定合并 wheel／sdist 检查与独立重建／安装、安装 wheel 的 PTY、草稿／公开 SHA256 和隔离 URL 安装。免费重验捕获运行记录，不新增付费调用或重置原账本。

## 1.6.0a1 - 2026-10-05

- 新增独立所有权、默认关闭的实时指标 Mod，固定验证 Claude Code 2.1.289，与编辑器启用偏好分离。
- 新增严格运行协议 v1、有界会话／prompt／代理历史、原子并发存储、准确重试身份及心跳／失效诊断。
- 通过共享版本／哈希清单打包两 Mod，扩展实际官方安装 smoke 和 Windows／macOS 2.1.289 CI。完整预览使用显示 schema v4／配置协议 v3，运行协议 v1 独立。

- 新增五个默认不选中的任务级运行状态、权限、活跃代理、清单和最近工具项，支持确定性预览、明确的部分覆盖标记和只读诊断。

- 新增缓存的已提交 merge-base 分支差异和共享基准配置，显示升级为 schema v4、配置协议 v3，仅真实保存迁移。可靠结束证据冻结代理时长，关闭实时采集仍可用；保持计时器优先级。

- 新增宿主观测的最新请求 TTFT/输出率、缓存完整口径任务 token、可靠启动/生命周期归属、明确部分覆盖、被动官方费用观测和统一预算的真实会话验收工具。

## 1.5.0 - 2026-10-05

- 维护者确认 Linux／Windows 人工验收及 macOS 独立 TUI／CLI 通过后，晋升已验证 Phase 4 预览；保留历史 macOS Client 输入限制，具体终端／OS／宿主元数据仍未知。
- Python／Mod 同步 1.5.0，更新正式安装／升级链接；兼容宿主默认启用两入口，保留明确 false 及独立兼容暂挂。
- 沿用显示 schema v3、JSON 协议 v2、默认外观及已验收的格式／显式布局／预设／可移植文件／独立实际行 Claude 偏好应用；保留 a1 标签、资产与截图来源。
- 正式 Latest 发布前完成 PR／合并／标签 CI、最终 wheel PTY、独立包重建／安装、SHA256 与公开安装验证。

## 1.5.0a1 - 2026-10-05

- 窄显式行优先保留实际内容，避免仅剩范围标签；移除启用项目后保持表单选择有效。

- 两种编辑器完整支持逐项表单、Layout、预设／导入／导出草稿操作；Claude 实际外观／时间／标题／行为行独立逐项 Apply。验证 curses Ctrl+S 不被终端流控吞掉，固定宿主 CI 增加 Linux 2.1.289。

- 新增四种可编辑预设和独立版本的可移植 JSON 导入导出；导入先验证，导出排除安装／运行数据／Claude 偏好，并保护已有文件和实时资源。

- 新增显式行、优先级与终端列宽精简，并与生产预览共用管线；子 Agent 筛选、隐藏完成、行数和任务文本限制输出空内容，保留宿主顺序。

- 新增 schema v3 格式选项：模型简称、数字格式、标签／图标、风险阈值、已用／剩余额度和重置格式；v1/v2 读取不写文件，保存时备份迁移。
- 内部 JSON 契约升级至协议 v2，Client／curses 完整保存保留新增字段；兼容旧协议资源的升级和卸载所有权检查。

## 1.4.0 - 2026-10-04

- 新增默认关闭的网关估算金额／周期和累计输入／输出 token；复用会话快照／增量，以原始整数相加缓存读取、写入与普通输入，区分未观测和合法零值。目录达到 48 个主栏／14 个子 Agent 项。

- 累计输入／输出独立记录可用性，隐藏缺失计数器，不完整累计快照保留已知总量及各自增量；旧会话缓存仅恢复一次可用性，不重复累计消息 ID。

- 新增十一个默认关闭的缓存／会话／Git 项：缓存状态、TTL、官方主对话请求及 miss 数、输出样式、名称／完整／短会话 ID 和独立 Git 分项；组合与分项共享一次 Git 采集，区分未观测缓存与 cold。

- 新增九个默认关闭的独立主栏指标和四个子 Agent 指标，保留组合项、默认选择及 schema v2／协议 v1；隐藏过期额度，提供固定倒计时预览，说明指标作用域与降级恢复。

- 在中英文 README 与截图索引中加入显示 Claude Code 2.1.289 的 Linux、Windows、macOS 会话内 Client 原始截图。
- 单独记录维护者反馈的 Linux、Windows 正常交互与 macOS 尚未解决的输入问题，保留历史验收事实；补充 Terminal.app、iTerm2 官方鼠标报告检查建议及其他配置入口，不宣称已验证修复。

## 1.3.0 - 2026-10-04

- 维护者确认 v1.3.0a2 在 Linux、Windows、macOS 真人验收通过，正式版沿用已验收 Client 交互。
- 正式安装默认启用外部 `/statusline-configure` 与会话内 `/statusline-configure-native`，保留明确关闭偏好；外部需 2.1.258+，Client 需 2.1.287+，低版本/未知宿主分别暂挂，升级后重装恢复。
- 外部关闭持久保存 schema v1 的 false；版本暂挂在备份和锁保护下关闭已核验所属的插件，保留用户主动禁用，并支持失败回滚。升级时更新已禁用插件的所属资源和后端绑定，保持禁用状态。
- 将 Native 操作整合到双语 README 常用配置与用户指南，补齐安装组合、偏好文件、兼容性、恢复、升级及发布说明；保留历史锚点和 a2 图片来源。
- Python/Mod 同步 1.3.0，当前稳定安装入口和 Latest 更新至 v1.3.0；配置 schema 与 JSON 协议 v1 保持兼容。

## 1.3.0a2 - 2026-10-04

- 保留 `/statusline-configure` 的外部终端 TUI，`/statusline-configure-native` 改为当前 session 的实验性 Client；两入口独立安装、关闭和并存。
- 恢复旧原生迁移移除的已启用 owned 外部资源，取消 Mod 的外部命令别名和 primaryCommand，分别检查命令冲突；清理旧版空目录，支持禁用后再次启用。
- Client 提供方向键导航/排序、Tab 切页、Space 勾选、显式搜索、Ctrl+G 取消、s 保存及 f 完成；明确点击获焦和宿主 Esc 行为。
- 分组边框、强调标题、设置分组、栏目对齐和紧凑布局区分内容与预览；保留高级偏好独立应用与结果不明核对。
- 使用深复制快照及有序累计消息确认，避免冻结、丢键、重复保存及迟到响应；两种保存路径共用 revision 防覆盖。
- 补充安装组合、升级恢复、跨编辑器保存、Client、分发和真实 PTY 检查，更新双语指南及画面来源。
- 记录 a1 三平台真人通过；a2 Client 真人验收在预览发布时另记待验收。预览发布不更改 Latest v1.2.0。

## 1.3.0a1 - 2026-10-04

- 预览原生直接勾选行、横向页签、分页正文、紧凑设置及限高底部样例预览。
- 启用/未启用项目及过滤排序与独立 TUI 一致，保留作用域当前项目并在切页后请求焦点。
- 增加 f 保存关闭，保留 s 保存继续；h 折叠宿主偏好，保留待应用值、独立应用及未知保存核对。
- 按编辑/导航/数字逻辑及 UI 控件/页面展开结构，运行包包含嵌套模块，检查暂存和官方缓存。
- 记录隔离 Client 焦点/按键限制和新自动检查；稳定版保持 v1.2.0，v1.3.0 要求新的三平台真人验收。

## 1.2.0 - 2026-10-04

- Linux、Windows 11、macOS 14.5 真人验收明确通过后，发布稳定原生编辑器；未提供的架构/终端信息记为未知。
- 兼容宿主默认优先原生，保留明确的原生/插件禁用及兼容回退。
- 老宿主仍支持明确的兼容偏好修复和 force 行为，独立验证稳定默认启用及兼容 smoke。
- 同步 Mod/后端版本、稳定安装链接、验收和发布文档，UI 运行模块保留已验收的预览实现。

## 1.2.0a1 - 2026-10-04

- 增加原生 Main、Subagents、Settings 三页，使用共享目录选择、互斥、排序和样例预览；完整草稿以 revision 保护保存，成功后保持面板，未知结果先读取核对再重试。
- 实际 theme/verbose 宿主偏好独立应用，报告锁定、拒绝和部分成功；窄面板保留草稿，关闭/重载使旧响应失效。
- wheel 从唯一维护源打包匹配的 Mod 运行资源，通过所属本地 marketplace 接入，绑定实际后端并迁移所属配置入口，保留明确禁用，支持暂停、降级及卸载恢复。
- doctor 分别核对资源哈希、版本、协议、启用和后端绑定，不把磁盘安装当作会话加载；修复 Windows npm/console 入口及 macOS 路径别名。
- 与 CLI/curses/向导共享目录及 JSON describe/read/preview/apply，增加生成的 TypeScript、平台原生检查和注明来源的真实终端画面。
- 预览保持原生显式启用，Latest 仍为 v1.1.1；Linux 真人验收已确认，Windows/macOS 原生真人验收待完成，稳定 v1.2.0 保留门槛。

## 1.1.1 - 2026-10-03

- 在最终 Stop 前后保留完整多 Agent 任务耗时，包含主 Agent 收尾。
- 冻结失败/中断证据，让重复终态 hook 与普通单轮校准保持幂等。
- 在增量读取和排队 hook 之间保留 transcript 的 prompt 归属，拒绝无法归属的 duration 与无效数值。
- 区分任务、原生单轮、会话运行和 API 等待时间，并修正 `cost` 描述。

- 将后台 Agent 结果通知 ID 关联到原始人类任务，等待待交付报告后再完成主 Agent 收尾。
- 冻结前核对提交证据，阻止后续 transcript 扫描改写终态耗时。
- 将实现拆分为配置、渲染、运行、集成、UI 与平台子系统，保留旧 Python 入口，隔离共享存储与所有权。
- 按子系统归类测试，修复移动后的源码/Terminal 路径，并在 `tools/` 统一双语文档、包检查和显式验收入口。

## 1.1.0 - 2026-10-03

- macOS 核心功能与独立 TUI 转为正式支持，范围为 macOS 14+、Intel / Apple Silicon、CPython 3.10–3.14；保留原生进程识别、包含睡眠时间的时钟和 POSIX 文件安全适配。
- 实验性 `/statusline-configure` 在有效 tmux 会话之外新增 Terminal.app 入口，使用系统 `open` 和私有 `.command` 文件；退出后遵循 Terminal 自身偏好，无需 AppleScript 自动化权限。
- Terminal 入口绑定当前 Python、CLI、配置目录和工作目录，支持空格、中文及 shell 特殊字符；使用独立启动握手、进程身份核验与 schema v1 结果桥，处理启动失败、关窗、中断、父调用退出和超时。
- 在 TUI 轮询和配置事务锁内核对调用存活与期限，失效调用不能继续保存；撤销调用后仅回收匹配身份的编辑器进程并清理本次私有文件。
- 更新 CLI 帮助、包描述与 macOS `doctor` 诊断；诊断只检查 Terminal 及图形会话条件，不启动桌面终端。配置和结果 schema、Linux/Windows 行为及实验入口默认关闭策略保持兼容。
- 修正 PTY 分段读取误报，新增 Terminal 生命周期与原生辅助进程测试，补充 `.DS_Store` 忽略规则和分发包检查。
- 发布 v1.1.0 稳定版 wheel、源码包和 SHA256SUMS；统一 Linux/WSL、Windows、macOS 的安装与升级入口，保留历史版本的支持范围说明。
- 发布指南补全按已验证提交构建、草稿附件核验、正式发布及下载后隔离安装的流程；CI 核对源码/包版本、文档和截图，并拒绝分发本地验收记录及系统缓存。
- 收录 macOS / Windows 主状态栏及三页 TUI 的八张原始截图，统一文件名、文件索引和首页展示；CI 增加全平台截图的打包检查。

## 1.1.0a1 - 2026-10-02

- 新增 macOS 预览支持：核心状态栏、子 Agent 行、安装配置命令和独立 curses TUI；实验性 `/statusline-configure` 仅使用通过预检查的 tmux popup。
- Linux/macOS 共享 POSIX 文件锁、私有权限修复、原子替换和父目录同步；仅 macOS 文件系统不支持目录同步时降级，真实 I/O 错误继续传播。
- macOS session registry 使用 C locale / UTC 的 `ps -o lstart=` 启动标识，先筛选匹配会话再查询进程。计时通过延迟加载的 LibSystem `mach_continuous_time`、`mach_timebase_info` 与 `kern.bootsessionuuid` 保持包含睡眠时间的时钟和重启识别；接口不可用时整体回退墙钟。
- `doctor` 增加 macOS 预览、架构、系统版本、curses、进程、时钟、目录同步与实验入口 tmux 诊断；缺少 curses 时独立 TUI 返回清晰错误。
- macOS 独立 TUI 定时轮询输入，使旧 curses/CPython 3.10 在没有后续按键时也能及时处理 SIGINT 等信号；PTY 测试建立前台控制终端并在等待退出时持续读取输出。
- CI 增加 macOS 15/26 × Intel/Apple Silicon × Python 3.10/3.14，扩展 PTY/tmux 实测并生成平台验证报告；ARM64 的 Python 3.10 下界固定为 3.10.11。
- 发布 v1.1.0a1 预览 wheel、源码包与 SHA256SUMS，供 macOS 用户试用；Linux/WSL 与 Windows 用户仍可选择稳定版 v1.0.0，预览包也包含这两个平台的既有功能。
- 同步包版本、CLI/CI 版本断言、安装升级入口与发布指南。显示 schema v2、feature schema v1、旧配置及运行状态保持兼容，无需数据迁移。
- 已发布的 v1.0.0 安装包与标签不包含 macOS 支持。实际 Claude 视觉效果、真实睡眠恢复与桌面终端体验尚未人工验收；macOS 仍声明为预览。

## 1.0.0 - 2026-09-04

- Git staged 计数按运行平台调整间距：原生 Linux 保留 `● N`，Windows 和 WSL 改为 `●N`；WSL 同时根据环境变量和内核 release 识别。
- 将平台契约从 Linux 扩展为 Linux/WSL 与 Windows 10/11 原生；Windows 支持 CPython 3.10–3.14 x86/x64，macOS 继续明确不支持，Windows ARM64 原生 Python 暂不承诺。
- 新增集中式平台适配层：Linux 保留 `fcntl.flock`、`0600/0700` 与父目录 `fsync`；Windows 使用延迟导入的 `msvcrt` 固定字节锁、继承 ACL、带 sharing violation/access denied 重试的原子替换与 durable unlink。
- Windows session registry 校验通过 `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)`、`GetProcessTimes` 和本地 `.NET DateTime.Ticks` 转换验证 `procStart`；计时使用包含休眠时间的 `GetTickCount64` 与按分钟量化的启动标识，API 不可用时回退墙钟。
- Windows 安装统一写入可由 Git Bash 和 PowerShell 执行的 `claude-statusline.exe render`、`render-subagents`、`hook` 与 `slash-hook`；Linux 绝对路径加 POSIX 引号的既有命令格式不变。所有权识别同时接受 canonical 名称、大小写不敏感 `.exe` 与解析到当前入口的 PATH alias。
- Windows `/statusline-config` skill 同时预授权窄范围 Bash/PowerShell config 规则；`/statusline-configure` fallback 同时禁用 Bash 与 PowerShell。`doctor` 新增 Windows executable、ACL/mode 差异、`windows-curses` 与系统新控制台诊断。
- 包元数据增加条件依赖 `windows-curses>=2.4.2; sys_platform == "win32"`。Linux 与 Windows 复用 Main/Subagents/Settings 全屏 TUI；信号注册只引用平台实际存在的信号，并兼容 PDCurses resize。
- `/statusline-configure` 在 Windows 新增 `CREATE_NEW_CONSOLE` launcher，直接运行当前虚拟环境的 `python -m claude_statusline configure`，保留子进程句柄、真实终端 I/O、570/585 秒 deadline、关窗/异常/超时回收及 schema v1 结果回传。Linux tmux/GNOME 行为保持不变。
- Windows 结果桥拒绝 symlink、junction、其他 reparse point、路径越界、非普通文件和超过 16 KiB 的结果；不再把 NTFS 伪 POSIX mode 当成损坏。长路径换行同时识别 `/` 与 `\`，`full` 风格保留 payload 原始分隔符。
- 保持显示 schema v2、feature schema v1、状态缓存、生命周期 ledger、默认显示、Claude Code 2.1.205/2.1.258 功能门槛和旧 Linux 安装所有权语义不变，不执行数据迁移。
- CI 新增 Ubuntu/Windows × Python 3.10/3.14 矩阵、PowerShell/Git Bash 与 Linux smoke，以及 sdist/wheel 版本、条件依赖、skills 和平台模块打包检查。

## 0.9.0 - 2026-09-03

- 新增子 Agent 条目 `status-elapsed`：把状态图标与用时合并为一个单元（如 `⏱ 1m 18s`、`✓ 0m 42s`），取代 `status` 与 `elapsed` 成为默认子 Agent 行，默认输出从 `⏱ Explore · sonnet-5/high · Context 58% left · 1m 18s · searching auth flow` 变为 `⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow`。
- `status-elapsed` 与 `status`、`elapsed` 在 `subagents.items` 中互斥：配置校验拒绝共存，CLI 的 set-items/enable/disable/order/apply 直接报错；交互向导勾选其一自动取消冲突项。
- 缺失或非法 `startTime` 时 `status-elapsed` 只显示状态图标；未来时间按 0 秒。与旧 `elapsed` 一致，已完成任务因 payload 无 endTime 继续计时；时长仍按 floor 取整。
- 窄屏适配把 `status-elapsed` 视为与 `status` 同等的核心条目，始终保留，极窄时退化为图标；不加入可选段丢弃顺序。
- 更新渲染、目录、预览、配置校验、向导、CLI 与文档测试。

## 0.8.0 - 2026-09-03

- 新增子 Agent 条目 `context-remaining`：显示 `Context N% left`（先按 `tokenCount / contextWindowSize` 四舍五入已用百分比，再取 `100 − 已用` 并截断到 0–100），并取代 `context-used` 成为默认子 Agent 行的上下文项。
- 子 Agent `context-used` 保持可选，显示格式从 `ctx N%` 改为与主栏一致的 `Context N% used`；已有配置目录结构不变，但启用 `context-used` 的现有配置会看到新文本。
- 无显示配置的安装默认子 Agent 行改为显示剩余上下文；两个上下文条目都参与窄屏丢弃（`current-dir → tokens → context-used → context-remaining → model-with-effort → task`）。
- 新条目可通过 CLI、TUI 与 `/statusline-config` 启用和排序；更新对应渲染、目录、预览与文档测试。

## 0.7.0 - 2026-09-03

- 新增三个默认关闭的主 Agent 条目：`context-used` 显示 Claude 官方 payload 的上下文已用百分比，`project-name` 显示启动项目目录 basename，`hostname` 通过 Python 标准库显示本地主机名。
- `context-used` 与 `context-remaining` 可独立配置并相邻共存；`current-dir`、`project-name`、`hostname` 组成位置组，所有新增文本均执行缺失值、范围与控制字符/ANSI 安全校验。
- 保持 schema v2、原有十项 `DEFAULT_ITEMS`/`LEGACY_DEFAULT_ITEMS`、旧配置与默认输出不变；三个新条目只通过 CLI、TUI 或 `/statusline-config` 显式启用。
- 全条目预览扩展为 24 个确定性主条目，hostname 固定为 `devbox`，不读取真实机器名；子 Agent renderer、条目目录和默认配置保持不变。

## 0.6.0 - 2026-09-03

- 新增 Claude Code 官方 `subagentStatusLine` 一等支持与高频 `render-subagents` NDJSON 命令；按 task 显示状态、名称、模型/effort、上下文、用时和任务，并支持 token、cwd 可选项、ANSI/CJK/emoji 安全限宽及损坏输入静默降级。
- `prompt-timer` 改为从用户提交到主 Agent 最终 `Stop` 的端到端时间；新增 `SubagentStart`/`SubagentStop` ledger、`waiting_subagents`/`resuming_main` 阶段、权威 `background_tasks` 同步，并抑制 registry/transcript 提前完成。
- 主栏新增 `off/when-subagents/always` 范围标签；默认只在当前 prompt 曾启动子 Agent 时显示固定的 `Main/Session`，session token 聚合口径保持不变。
- 显示配置平滑升级到严格 schema v2：schema v1 只读迁移且不会被 render/doctor/install 重写，首次真实保存会备份原字节并原子写出 canonical v2。
- 新增完整的 `config subagents ...` 命令、`subagent-statusline`/`scope-labels` 设置及兼容旧调用的可选 `config apply` 参数；TUI 升级为 Main/Subagents/Settings 三页签，slash 向导同步一次性提交全部字段。
- 安装器新增 Claude Code 2.1.205 版本门槛、owned/absent/foreign/unsupported 所有权状态、foreign 整体拒绝与 `--force` 接管、关闭/降级暂挂及升级恢复；uninstall 只移除本工具拥有的子 Agent 设置和 hooks。
- 扩展 renderer、Unicode 宽度、生命周期、配置迁移、安装事务、TUI/Slash、CLI 与 doctor 测试，并更新构建、升级、降级和人工多 Agent 验收文档。

## 0.5.0 - 2026-09-03

- 新增默认关闭的实验入口 `/statusline-configure`，通过 `install --experimental-slash-tui` 持久启用，并可用 `--no-experimental-slash-tui` 永久关闭；与现有 `/statusline-config` 并存。
- 新增 tmux `90% × 90%` popup 与 GNOME Terminal 活动新标签页 launcher，复用已有 `claude-statusline configure` TUI；两者不可用时在本地阻断并提示独立命令，不调用模型。
- 新增私有原子结果桥接，向 Claude 对话回传保存、无变化、取消、中断、超时和错误；hook/TUI/launcher timeout 分别为 600/570/585 秒。
- 安装器扩展为 settings、feature 文件与两个 owned skill 的统一事务，支持损坏偏好的显式修复、降级暂挂/升级恢复、严格所有权、dry-run、备份和原字节回滚。
- `doctor` 新增 feature schema/权限、disabled/enabled/suspended、实验 skill/owner/matcher/timeout 和 launcher 可用性诊断；新增 launcher、PTY bridge 与真实 tmux popup 集成测试。
- 文档明确该功能不是 Claude Code 原生 TUI 扩展，不访问 `/dev/tty`，GNOME 路径是新标签页，并记录 `disableAllHooks` fallback 的模型回合例外。

## 0.4.0 - 2026-09-03

- 新增稳定的独立命令 `claude-statusline configure [--config-dir PATH]`，在 Linux 真实终端中提供 Items/Settings 双页签全屏 TUI，支持 Space 勾选、键盘导航、筛选、左右排序和数值编辑。
- 新增按键级 `Preview (sample data)`：复用生产 renderer 的格式化、分组与换行，只使用确定性样例，不读取 Git、transcript、网络或当前会话运行状态，也不创建缓存。
- Enter 一次性原子提交显示与宿主配置，Esc 和信号路径恢复终端且不写入；小于 `64x18` 时等待 resize。
- TUI 保存增加 baseline 并发保护：在现有安装锁内、创建备份前检测 display、host 或安装归属的语义变化，同时保留无关 `settings.json` 更新。
- 保持显示配置 schema version 1，不迁移或持久化禁用条目顺序；`/statusline-config` skill、slash fast hook 与现有 renderer/hook 行为不变。

## 0.3.2 - 2026-09-03

- 显示前缀首字母大写：`Session`、`Git`、`Repo`、`Worktree`、`Agent`；Git 错误标记同步改为 `Git!`。
- `cost` 金额前加 `Total`，如 `Total $0.12 · 12m 30s · +156/-23`（`vim NORMAL` 不在本次清单内，保持不变）。

## 0.3.1 - 2026-09-03

- 重构显示项分组与配色：`model-with-effort`、`fast-mode`、`thinking` 一组（象牙白）；`tokens`、`prompt-cache` 一组（粉）；`git`、`pr`、`repo` 一组（紫）；`version`、`session`、`cost`、`agent`、`vim-mode`、`worktree` 各自独立。
- `session`、`git`、`repo` 显示加前缀（`session xxxxx`、`git xxxxx`、`repo xxxxx`）。
- 目录顺序调整为同组相邻，向导追加的新条目自动落在组锚点之后。

## 0.3.0 - 2026-09-03

- 新增 11 个可选显示项：`version`、`session`、`cost`、`prompt-cache`、`fast-mode`、`agent`、`vim-mode`、`thinking`、`pr`、`worktree`、`repo`，数据来自 Claude Code 2.1.258+ 的公开 statusline payload。
- 新显示项默认禁用，默认输出与 0.2.0 完全一致；通过 `/statusline-config enable` 主动开启。
- `cost` 显示会话金额、API 时长与增删行数（第三方 API 下金额为估算值）；`prompt-cache` 显示缓存命中率与写入 token。
- 更新 `/statusline-config` 向导分组，新条目可通过勾选启用。

## 0.2.0 - 2026-09-03

- 增加用户全局的严格 JSON 显示配置、可选显示项及持久化顺序。
- 增加颜色、ANSI 调色板、目录格式、分隔符及 Claude Code 宿主设置。
- 增加 `/statusline-config` personal skill，以及新版 Claude Code 的本地 slash hook 快路径。
- 安装器自动管理 skill 和快捷 hook，旧版 Claude Code 优雅降级，卸载时保留用户偏好。
- 保持无配置时的 0.1.0 输出，并按启用项跳过不必要的 Git 和 transcript 工作。

## 0.1.0 - 2026-09-02

- 将现有 Claude Code statusline 渲染器与逐轮生命周期 hook 封装为独立 CLI。
- 增加安全、幂等的安装、卸载和诊断命令。
- 支持 `CLAUDE_CONFIG_DIR`，同时保留既有运行状态与缓存布局。
- 保留模型、目录、Git、上下文、限额、token 与计时显示行为。
