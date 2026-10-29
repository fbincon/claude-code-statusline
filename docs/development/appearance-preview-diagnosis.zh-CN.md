# 外观、样例场景与显式文件诊断

[English](appearance-preview-diagnosis.md) | **简体中文**

APPEARANCE-05、PREVIEW-01、EXPLAIN-02 基于 v3.9.2，从 main `4ae8d45a8029339f11d3c5dead6a9f19a58a9a40` 开始。已随 v3.10.0 于 2026-10-28 交付发布，源码、门禁和原始交付产物记录如下。

## 职责与行为

Core 维护主题注册表、渐变预设、会话内预览选择、配色候选、文件诊断展示及渲染决策。Platform 保留有界只读文件访问；CLI 解析指定文件并编排诊断。双编辑器适配相同纯状态。原生投影仅发送可见文本和样式片段，候选、场景定义和完整报告留在宿主。

八个主题保留 `classic`、`dark`、`light`、`terminal`，新增 `ocean`、`ember`、`slate`、`blossom`。十一个渐变保留原有三个，新增 `glacier`、`lagoon`、`flame`、`copper`、`steel`、`sage`、`petal`、`twilight`。预设保存展开后的 RGB 色标。颜色候选先预览，接受仅改变显示草稿；显示 Save 与宿主偏好及来源授权继续独立。

十四个确定性场景替换观测：正常、警告、严重、零值、缺失、来源过期／失败、长内容、三种 Git 状态以及零／二／24 个代理。Ctrl+V 切换场景，Ctrl+W 切换自动／40／80／120 列，Ctrl+N 推进预览行。实际宽度不超过预览空间。场景不改变草稿，不启用采集。

`diagnose_file` 使用当前草稿、所选作用域、可选采集时间读取明确指定的路径，默认 `include_local:false`。已有 CLI `diagnose` 保留默认加入缓存及 `--input-only` 开关。文件操作不保存、不采集、不修复、不启动来源。报告标明来源、输入／诊断时间、会话身份和证据范围。Esc 从报告返回表单，再返回保留的编辑器。

## 接口与兼容

显示 schema 16 新增主题身份；schema 1–15 只读兼容，显式保存保留备份／迁移。旧 schema 不接受新主题。协议 26 新增 `diagnose_file`、preview／explain 可选 `scenario`、场景元数据及逐行可选 `style_reasons`，携带稳定原因码及背景主实例身份。Portable／profile 封装、来源存储、runtime 和 UI preferences 版本不变。升级时安装匹配的前后端资源；降级前恢复兼容备份。

样式原因来自生产渲染，区分颜色关闭、背景渐变不适用、组主实例控制背景、阈值前景、ANSI 转换及中性背景对比度保护。样例证据始终是合成数据，不证明现场可用性。文件诊断保留 FIX-04 的历史时间过滤和逐代理证据规则。

## 验证与交付

集中回归覆盖注册／迁移、全部场景在 40／80／120 列下的预览与解释一致性、真实零值、样式决策、文件校验与只读边界、六语言候选及未知保存保护。安装验收补充新主题／预设、场景身份和未保存草稿文件诊断。官方 Mod 测试补充有界选色页和宿主保留的大型诊断报告。原有全部 197 项容量用例继续必需。

最终 PR／main／tag 门禁已通过，包括八安装目标、32 Node 情况、十六官方宿主情况及全部 197 项容量用例。验收工具变更已执行完整 main 验收与 shadow promotion。[v3.10.0 决定](../releases/approvals/v3.10.0.json)仅接受六项既有 [#96 缺口](https://github.com/fbincon/claude-code-statusline/issues/96)，继续标记未验证。不运行付费模型测试。下述终端观察属于自动化捕获，不构成物理或人工验收。

## 源码与必需门禁

[PR #169](https://github.com/fbincon/claude-code-statusline/pull/169) 交付源码 `e2cd0a8178d2a5eee58a308ad52db4f60d21847a`。main 合并提交 `6a3e9bb96b9670123d5f99d1e0cb6a5e8201ccde` 的 Git 树相同。注解标签 `v3.10.0` 对象为 `cceec9e93ea2228d5aa2b8b19e0276dbaf3854bc`，指向 main 可达的已验收 PR 源码。

| 执行 | 实际结果 |
| --- | --- |
| [最终 PR 40622637912](https://github.com/fbincon/claude-code-statusline/actions/runs/40622637912) | Complete candidate evidence 通过；完整安装、runtime、官方宿主和容量矩阵 |
| [main 40626868677](https://github.com/fbincon/claude-code-statusline/actions/runs/40626868677) | 完整矩阵、三项集成 smoke 及 shadow promotion 通过 |
| [tag 40630847629](https://github.com/fbincon/claude-code-statusline/actions/runs/40630847629) | 原始源码晋级及 Complete candidate evidence 通过 |
| [npm dry run 40632861625](https://github.com/fbincon/claude-code-statusline/actions/runs/40632861625) | 使用精确标签及原始包，通过 |
| [npm 发布 40633101480](https://github.com/fbincon/claude-code-statusline/actions/runs/40633101480) | 新版本 OIDC 发布通过；`latest` 为 3.10.0，`beta` 保持 3.0.0-beta.1 |
| [公开下载 40633802047](https://github.com/fbincon/claude-code-statusline/actions/runs/40633802047) | Linux／Windows／macOS × Node 22／24 六项全部通过 |

原始 PR 制品 `12788490223` 提供下列四文件；原始验收制品 `12789129762` 保留源码绑定证据，其封装引用 56 项原始执行及 66 项凭证哈希。main 和 tag 晋级该源码，不重标凭证，也不以稍后重建替换文件。独立本地构建和源码归档重建均复现四文件字节。

| 原始文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.10.0.tgz` | `71f52fcbf8bc726c34340c5916db71f3f9b1e4eef03d4c4fd9a4f9a7a73a3b10` |
| `claude-code-statusline-3.10.0-source.tar.gz` | `ee5d0a692d380d90a134edf339a618b1932b80f48efe2e2d2ab79f6c67105cb3` |
| `build-manifest.json` | `2b3e702072131ac0565d090258740528e49439dc903fa4bf79a2f32f9058838f` |
| `SHA256SUMS` | `94b17620e58a571d2a7443755c7f02d988fc537e44db187565d0c838ce48e15a` |

## 本地观察与测试机恢复

最终源码 `npm run check` 为 1,313 项通过、六项平台限定跳过、零失败。资源生成／检查覆盖 67 个自有资源；六种语言各有 2,063 条消息。文档及空白检查通过，冻结 Python 归档保持不变。固定官方宿主测试 157 项通过，精确宿主类型检查通过。

安装验收保留全部 197 项容量用例，23 组真实 Linux Native／外部 PTY 流程通过。外部捕获器记录六语言、明暗背景共 852 帧，以及四组无色／dumb 终端对照。已检查新增配色候选、场景／宽度、文件表单和报告捕获。补充 Native 观察等待异步 Ocean 预览实际到达后再检查生产配色，保留独立捕获器身份。

真实测试安装经受支持的包管理器从 3.9.2 升级至 3.10.0。两端安装后编辑器均打开场景／宽度控制，以仅输入证据诊断 Unicode 路径的明确文件，不保存显示配置、不调用模型。探针保留配置字节、宿主界面偏好和终端状态。首轮补充探针继承 `TERM=dumb`，在进入编辑器前正确终止；修正 ANSI PTY 环境后的探针通过。

升级快照 `pkg-1a876a82-04f1-4425-a05f-cc87e0348f16` 经 `recover --restore-config --dry-run` 审阅后，使用受支持的恢复命令还原。原 schema-15 显示配置与界面偏好的字节、权限均与升级前快照一致；原本不存在的可选配置仍不存在。Claude 设置仅修改受管理 Native 后端版本绑定为 3.10.0，其余设置保留。最终只读协议 26 预览和仅输入诊断成功加载还原的 schema-15 文件，不重写文件。版本及 doctor 检查通过，升级后的产品继续安装。

机器私有快照、终端原始捕获及详细凭证保留在忽略目录 `dist/validation/v3.10.0/`，不发布用户配置，也不声称物理验收。临时探针失败和中断传输保留实际结果，不复用为通过凭证。

## 已发布渠道

[npm 3.10.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.10.0) 已公开；匿名下载字节匹配原始候选 SHA-256 及 SHA-512 integrity。SLSA 溯源对应源码 `e2cd0a8178d2a5eee58a308ad52db4f60d21847a`、标签工作流及发布运行 40633101480。

[GitHub v3.10.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.10.0) 为公开 stable／Latest Release，发布时间 `2026-10-28T04:42:09Z`。发布前已下载并比对四个草稿附件；全新离线安装、doctor、预览、文件诊断及 PTY 取消通过。上述公开下载矩阵另行验证已发布交付。

[Gitee v3.10.0](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.10.0)，Release `1248231`，分发相同源码和注解标签。四个手工附件均经匿名下载并匹配原始字节；Gitee 自动生成的两个归档不替代已核验源码包。下载 npm 包的空缓存离线安装通过版本、安装／doctor、协议／场景、仅输入文件诊断及 PTY 取消／终端恢复。发行说明从已发布 GitHub 元数据和实际 Gitee 附件目录生成，已读回核验。验证后的 main 和未改变的标签对象经分歧检查后使用显式 refspec 同步。
