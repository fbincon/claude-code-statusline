# 草稿历史、结构审阅与配置复用

[English](draft-history-and-reuse.md) | **简体中文**

## 实现与兼容性

UX-03、COMPOSITION-04、IMPORT-02 从 `bae8e70e6e7f254b22ec5f87fa61c052aa6575ac`（v3.12.0）开始，全部切片于 2026-10-29 合并交付 v3.13.0，状态为 **DONE**。下方发版后发现继续开放，不补发修补版。[用户操作](../DRAFT_HISTORY.zh-CN.md)。

Core 管理会话历史、语义差异、结构修复候选、样式字段兼容性及分组引用闭包；CLI 管理有界文件解析、来源／目标修订检查及现有加锁事务；外部 TUI 与 Native 适配共享管理器。Mod 资源继续由现有资源生成器维护。

编辑器协议 29 新增 `review_reuse`，输入 `{draft,path,profile,request}`。`path:null` 使用传入的当前草稿，便携配置与单方案文件保持独立解析入口。样式请求明确选择来源／目标范围与 ID、视觉字段；分组请求选择范围、组 ID、组外引用处理策略及显式布局转换许可。结果包含完整有效候选、语义差异、ID 映射、依赖、未绑定的本机来源及阻止原因；匹配前端严格检查响应形状。显示 schema 16、portable／方案格式 1、运行时 3、来源注册 3／作业 4 均不改变。

会话历史上限为 100 步／16 MiB 序列化快照。仅确认的草稿操作记录历史，数值预览仍可取消；新编辑清除重做分支。确认保存成功或明确丢弃重载清空历史。未知保存保留提交快照并冻结变更。来源授权、界面语言即时保存、宿主 Apply 和包执行不由撤销恢复。来源草稿 pin 覆盖当前、基线、撤销及重做状态使用的绑定。

结构提案绑定完整基线、目标身份及草稿代次，移除失效单位引用与不足两个引用的列，优先保留本身有效的关系。剩余非法关系在提案中明确移除，无关关系保留。完整校验继续拒绝非法分组、顺序和 spacer 位置。接受仅一次变更，过期提案不改变草稿。CLI 保留默认拒绝，必须提供精确的已审阅对齐 ID 与预期修订，并在事务锁内复验。

样式复用采用固定视觉白名单及组件能力支持的格式交集。整组复用计算组件／组／对齐闭包，一起重映射 ID 并保留必要行 spacer。组外引用必须扩选或明确排除，自动转显式布局须单独允许。跨配置导入清除绑定；接受后明确重绑定，检查来源类型和范围，不启用或执行来源。CLI 还需提供审阅过的来源语义摘要，防止文件变化后静默应用其他内容。

冲突比较读取同一固定目标并保留草稿和历史，提供基线／草稿／当前文件三种比较。保留草稿仅采用目标与安装归属一致的已审阅修订，后续仍走正常加锁保存事务，再次外部编辑继续冲突。重载必须明确丢弃，导出沿用现有受保护便携导出器。Native 只传输有界可见帧，完整历史及候选保留在宿主。

Native 提供 Ctrl+_ 撤销、Ctrl+R 重做，“变更与历史”页面也提供 U／R。宿主能转发时仍处理 Ctrl+Z，但 Unix 宿主会在 Client 收到前用它挂起 Claude；安装程序不改全局宿主按键。维护者于 2026-10-29 明确接受这一实测兼容调整，不记作 Native Ctrl+Z 终端验收通过。参见[使用与宿主说明](../DRAFT_HISTORY.zh-CN.md)。

## 必需验收

- Core、CLI 与双编辑器定向测试覆盖历史原子性、取消、边界、分支、保存边界、异步旧结果／提案、独立操作、精确引用修复、样式保留、分组闭包和来源隔离。
- 安装回执 `draft_reuse` 要求六语言、40／80／120 列、已安装模块的历史／结构／样式／整组流程、保存重开、真实修订冲突及未知保存核对。既有安装门禁全部保留。
- 保留全部 217 项既有容量用例，追加 26 项 32×12 与高大尺寸下的历史／恢复／结构／复用页面，共 243 项实际宿主检查。保留八安装目标、32 Node 情况及十六固定宿主，本机 2.1.312 结果仅作补充。
- 继续要求双编辑器已安装 PTY、匹配产物截图、生成一致性、源码／文档检查及最终 PR／main／tag 门禁。不调用付费模型，自动终端和重建图像不视为真人桌面或实体电源证据。

## 本地开发检查

2026-10-29 最终源码检查通过 1,407 项测试，六项仅适用于其他平台的检查跳过；86 项生成资源、3,764 项文档链接、归档及迁移清单检查通过。本机 Claude 2.1.312 通过 169 项产品 Mod 测试及精确声明／类型检查，实际宿主容量检查通过全部 243 项。首次容量运行发现两项导出长路径的只读呈现失败，绘制输入副本后修复，保留原断言并增加纯回归测试。这些源码检查补充下方不可变候选、固定平台／宿主及发布证据。

首个不可变候选还通过了全部 25 类安装验收。42 条实际 PTY 旅程发现 Native 的 Ctrl+Z 被宿主拦截，其余 41 条通过。验收工具仍使用旧总数 34，以及 Native 按键事件错误检查 `paste` 字段的问题，均在最终验收前修正。初次失败运行保留为诊断证据，不提升为发布凭据。

第二个候选通过全部 25 类安装验收、42 条旅程，以及字节相同的交付源码重建。截图复核随后移除了样式审阅中整组导入专用的提示和空白 ID 页。最小尺寸审阅现在保留可见差异行，分组依赖选择可翻页查看；核心回归覆盖六语言及最小正文，实际宿主容量断言检查差异可见和选择翻页。最终源码须重新完成绑定到提交的验收。一次已被替代的 Windows ARM 运行在调用候选前初始化系统 PowerShell 超时，保留为失败的环境尝试，不记为产品通过证据。

后续本地运行还保留了两类环境／观测失败：`/tmp` 用户配额中断夹具创建及包执行；任务页刷新发生在后端 stdout 返回、宿主尚未应用完成界面之间。改用独立磁盘临时目录，刷新前等待实际只读标题及读取时间，并保留第二次后端读取必须完成的断言。这些修正不豁免失败，也不改变产品行为。

## 交付证据

验收源为 [PR #177](https://github.com/fbincon/claude-code-statusline/pull/177) 的 `200df8fcea2b3f6d1a40885305b6b19bf28f9d05`。合并提交为 `b58227b3aee7ea19dbe52e51fa5cbb42ff113e79`；annotated tag 对象 `d2bccc1e47695730babc6d36b4eac7fcfc776cd4` 指向可从 main 到达的验收源。证据提升保留原候选 artifact `12864489146` 与验收 artifact `12866824651`，不重建或重标来源。

| 阶段 | 证据 | 结果 |
| --- | --- | --- |
| 最终 PR | [40798745153](https://github.com/fbincon/claude-code-statusline/actions/runs/40798745153) | Complete candidate evidence；8 安装、32 Node、16 固定宿主 |
| Main | [40809667058](https://github.com/fbincon/claude-code-statusline/actions/runs/40809667058) | 验收源复验及 Linux／Windows／macOS 集成 |
| Annotated tag | [40809978482](https://github.com/fbincon/claude-code-statusline/actions/runs/40809978482) | 原始不可变字节及证据链 |
| OIDC 演练 | [40810725313](https://github.com/fbincon/claude-code-statusline/actions/runs/40810725313) | 通过，不写 npm |
| OIDC 发布 | [40810879215](https://github.com/fbincon/claude-code-statusline/actions/runs/40810879215) | 新版本发布，字节及选择器核验通过 |
| 公开下载 | [40811437241](https://github.com/fbincon/claude-code-statusline/actions/runs/40811437241) | Linux／Windows／macOS × Node 22／24 共 6 项全部通过 |

最终不可变候选通过全部 25 类安装验收、42 条双编辑器实际 PTY 旅程及 243 项真实宿主容量断言，保留既有 217 项。扩展捕获覆盖全部六语言、948 张深／浅色终端重建图和四项单色终端检查，终端属性已恢复。[八张新增页面示例](../images/draft-history-reuse/README.zh-CN.md) 保留来源、原始单元格、PNG、字体及裁剪摘要。这些属于自动终端观测，不是新增真人桌面或实体电源验收。

两次独立本机构建、原始 CI 构建及交付源码的两轮重建字节一致。发布前下载的 GitHub 四个草稿附件与原始不可变文件匹配：

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.13.0.tgz` | `ec7fdf4df2dd739c82366e4230a33f8cef1a83c8e7864d407a783128ca6da66c` |
| `claude-code-statusline-3.13.0-source.tar.gz` | `475146ed39c25c57f1b9e3453e98428fd5554a1bea01722fda99289b5c6d37df` |
| `build-manifest.json` | `12c3f76e60ba9f2d51214c5e413e058cda9c7e55014f63b53a3973eda66f61dc` |
| `SHA256SUMS` | `08288f53d5b30f21b868b5fd14cdbf4a5b4b0f6cfd5062ed9f6e7332b4c8dc53` |

[GitHub stable Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.13.0)、[npm 3.13.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.13.0) 与 [Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.13.0) 已发布。GitHub Release 不可变保护开启。`latest=3.13.0`，`beta=3.0.0-beta.1`；精确版本和 latest 公开安装通过。npm 11.19.0 的 TUF／pacote 验证器验证了已发布外层包的两项签名及两份证明包，完整性摘要匹配；provenance 对应 tag、验收源和实际 OIDC 运行。此结果与下方 #178 失败的全树审计分开记录。Gitee main／tag 使用显式 refspec 同步，四个匿名附件下载摘要匹配；CDN 超时后使用重新解析的本机原生网络路径，保持正常 TLS 验证。

## 本机验证与发版后发现

持久测试安装通过事务 `pkg-62f03225-299c-486a-abb7-24b07fbf8101` 从 3.12.0 升级到 3.13.0，包和适用接入分别完成。首次只读预览因 registry ECONNRESET 停止，确认无遗留 npm 进程、未修改安装后再重试。全部 1,055 项安装清单文件匹配验收产物，配置中的实际 statusline 命令成功渲染指定样例。外部与 Native 实际安装验证通过历史／比较／导出、样式粘贴／撤销、完整组导入／撤销和对齐修复／撤销。

显示／UI 字节与权限完全保留，原本不存在的来源／方案文件仍不存在，无关 Claude 设置保留。仅本工具拥有的 Native `backendVersion` 更新为 3.13.0。宿主配置字节／权限、临时 API-key 认可及提示状态均已恢复；请求转录和事件证据保留。原始日志、回执和本机路径放在忽略的验证目录。

三项新增发现独立于 #96 六项缺口：

- [#178](https://github.com/fbincon/claude-code-statusline/issues/178)：`npm audit signatures` 遍历内置私有工作区包，因 registry E404 失败。全树审计不记作通过；上方单独限定外层包的签名／provenance 验证通过。
- [#179](https://github.com/fbincon/claude-code-statusline/issues/179)：临时实际配置 Native 诊断**误发了两次模型请求**，违反不运行付费模型测试的指令。通用 API-key-helper 警告误匹配过宽的自动弹窗处理，实际配置又覆盖模拟环境地址。进程已停止，Claude 记账约 **USD 0.0955**，实际服务商扣费未核验。失败诊断不记作零调用回执。最终通过的 Native 重试使用无路由的 Linux 非特权用户／网络命名空间，验证出站 ENETUNREACH，且未观察到 API 请求；长期工具改进留在 issue 中。
- [#180](https://github.com/fbincon/claude-code-statusline/issues/180)：Native 简中样式入口仍显示英文，尽管规范翻译键已存在。功能验证按实际显示的标题导航，不据此宣称新增 Native 入口标题已完全本地化。

发布门禁与不可变候选验收未调用付费模型，发版后误发请求另行明确记录。上述发现不触发产品修正、新 tag 或补丁发布。[版本限定授权](../releases/approvals/v3.13.0.json) 只接受 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 原有六项缺口且保持未验证，不豁免新增自动化失败。证据补充含文档白名单之外的 PNG，按完整产品 CI 矩阵执行。
