# Native 编辑器容量与恢复

[English](native-capacity.md) | **简体中文**

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) 跟踪 Client props 超限，[issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) 独立跟踪 Client 绘制树超限。合法配置也能触发两者；保存成功后仍可能重绘失败，因此面板空白不能证明写入失败。

## 展示边界

完整 Editor、catalog、baseline、草稿、管理器候选和库保留在宿主。`lib/session.ts` 使用原有纯绘制规则生成独立的扁平可见帧，只包含 Box／Text、基础属性及指向先前节点的子引用。Client 负责还原展示和发送有序输入，不再重建 Editor。隐藏预览区和翻页范围之外的数据不经过此端口。

`ui.message` 和 `ui.render` 共用投影。epoch、generation、累积按键批次及确认保留既有顺序和去重规则。空事件批次仅在实际 Client 尺寸变化时通知宿主；实际区域尺寸与绘制／按键分页使用的有界展示尺寸分开。

props、外层 Pane 和 Client 绘制树分别预检查：保守序列化字符数 48,000、值数 10,000、深度 16，并计入非 ASCII 转义膨胀。这是内部安全预算，不等价于 Claude 校验器，仍须实际挂载宿主验收。超预算时先减少单页高度，再减少展示宽度，保留 32×12 最小布局、选中内容、预览颜色和可用分页。容量提示放在分区标题开头，避免被裁剪或其他消息遮住。最小布局仍无法输出时进入恢复页，不裁剪存储配置。

空白区使用单个带高度的 Box；边框使用固定节点，不再逐空白行生成容器。预览与界面文字在完整字素裁剪后合并相同样式的连续片段。生产样本渲染、保存配置和展示拟合保持独立。

## 故障与保存结果

投影或外层绘制树被拒绝时，改为小型宿主恢复视图。兼容的 `ui.*` 观察器只处理本 Pane／Client 的 `ui.fault`；Claude 2.1.287／288 保留预检查和外层手动重试／关闭按钮。较新宿主可报告加载、绘制和运行故障。故障原因只作为文字展示，不作为指令或恢复命令执行。

恢复保留宿主已接收的草稿。重试推进 Client epoch 和挂载身份，替换已卸载实例，不提交保存。恢复页区分上次保存成功、正在写入及结果未知；未知结果继续阻止重试／关闭，并提供原有只读保存状态核对入口。修订校验、锁、备份和后端原子写入不变。

此次只修改 Mod／Client 私有端口。显示 schema 15、编辑器协议 24、portable／方案外层、来源和运行时格式保持不变。

## 必需检查

`tools/generation/native-capacity.ts` 使用生产 description、共享编辑规则及注入观测的生产渲染，重建原记录的 195 个具名用例。生成数据去重并拆分到宿主单模块大小限制以下，另补充现场 72×213 和极端尺寸两个用例。测试样本不执行来源命令，也不连接模型。

`test:mods` 执行普通产品 Mod 测试，并在临时容量 Mod 中使用实际交付的 Client 和投影代码。197 项必须在真实宿主测试引擎中全部通过：196 项挂载 Client 并确认输入，另一项检查极端尺寸投影。原诊断探针捕获拒绝后的成功退出不能计为回归通过。集成测试另行注入外层预检查失败和实际 Client 校验失败，覆盖成功及未知保存结果。

必需矩阵保留原十三个宿主组合，新增 Linux、Windows、macOS 的 Claude 2.1.310。十六个宿主回执、八个安装目标及 32 项 Node 运行时用例必须对应相同提交和产物摘要。本地测试元数据来自实际 `claude --version`；直接执行 Mod 测试前运行 `npm run mods:prepare`。2.1.310 通过不提交提示的交互式会话生成精确版本声明。准备时清空生成目录，等待整套产物稳定完成，包括宿主编译设置及所有被引用的工具声明；部分文件或旧编译配置不能算完成。2.1.296 的既有声明缺口仍明确标为不可用。

最终候选还须执行适用的真实 Linux Native／外部编辑器 PTY 流程、保存回读并检查终端捕获；[v3.10.0 交付](appearance-preview-diagnosis.zh-CN.md) 在原十七组基础上增加两端选色、场景和文件诊断流程，共二十三组，记录来源／产物、宿主和平台身份。PTY 与重建图像属于自动化证据，不代表新的人工桌面或物理验收。

[安装候选选图](../images/native-capacity/README.zh-CN.md) 展示快速配置、渐变、实例保存和高面板缩放。

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## 交付记录

2026-10-26 的最终合并前 Linux x64 验证已通过仓库完整检查（1,250 项通过，五项既有平台跳过）、144 项 Native 产品测试、两个官方 Mod 测试套件及可用的精确 2.1.310 类型检查，以及全部 197 项容量用例。安装套件的 23 项测试全部通过。本机结果不替代十六个平台／宿主 CI 回执。

候选 `6bf142621c4b139baaf7c6096dec95b6a7ca66c0` 两次构建字节相同，包 SHA-256 为 `d03bbcd1842adada3236424ea632223db72256558987e858b356f2775957a192`。十七组安装包 PTY 流程全部通过：原十二组 Native 触发、新增前景渐变和说明页，以及三组外部对照。24 项案例仅写入一次并回读全部实例；高面板在缩放后保留未保存副本。正常流程日志没有宿主容量拒绝；未运行来源命令或付费模型测试。采集器改为等待实际命令注册并定位真实导入行，先前的采集失败不计为通过。

前几次 CI 暴露了 2.1.310 声明产物不完整的问题：主声明出现后，交互进程可能在编译配置写完前就被结束。等待完整的新产物并明确隔离目录的首次启动偏好后，已修正该验收工具问题。[Windows 诊断作业](https://github.com/fbincon/claude-code-statusline/actions/runs/40327432302) 已通过精确声明生成和 TypeScript 检查，Linux 2.1.310、2.1.287 的全新产物检查也通过。macOS CI 还暴露了临时目录 `/var` 与 `/private/var` 的别名差异，准备工具现在按规范真实路径及 Windows 标准拼写记录受信任测试目录。临时诊断工作流已移除。独立扩展外部编辑器套件通过六语言共 792 张明／暗主题捕获及四种单色／dumb 终端对照，终端模式与配置均恢复。

Windows 2.1.296 作业还暴露了一项宿主偏好测试在反复定位字段时超过 20 秒。选择器现在从表单末尾的宿主偏好区开始，并复用可见帧中的 Client 身份，减少重复宿主查询；行为断言和原超时保持不变，修改后的本机 143 项测试全部通过。

## 最终稳定版交付

于 2026-10-27（Asia/Shanghai）完成。[PR #158](https://github.com/fbincon/claude-code-statusline/pull/158) 合并了最终审查提交 `d48d471527ff7b604eceb610736a71b2febb2da5`。发布源为 [`5dbfc00381a140917d15cedf63094d01abdc6d1d`](https://github.com/fbincon/claude-code-statusline/commit/5dbfc00381a140917d15cedf63094d01abdc6d1d)，注解标签 `v3.9.1` 的对象为 `d1a4a3dd6efe054812e7eb004daea929ac508345`。

| 门禁 | 最终结果 |
| --- | --- |
| [最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40336709149) | 59 项适用作业及 Complete candidate evidence 全部通过 |
| [合并 main](https://github.com/fbincon/claude-code-statusline/actions/runs/40346292097) | 第二次运行通过同一完整矩阵 |
| [注解 tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40357902282) | 第二次运行通过同一完整矩阵 |
| 正式发布预检查 | 八个安装目标、32 项 Node 用例、十六个宿主均匹配发布源及包摘要 |
| [OIDC 预演](https://github.com/fbincon/claude-code-statusline/actions/runs/40370465179) | 标签、祖先关系、main／tag 门禁、产物字节及注册表状态通过 |
| [npm 发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40370705542) | 首次运行通过 OIDC 发布；第二次核验已经公开的相同版本 |
| [公开下载](https://github.com/fbincon/claude-code-statusline/actions/runs/40372098760) | Linux／Windows／macOS × Node 22.23.4／24.22.1 共六组全部通过，包含十二次精确版本／latest 安装 |

完整产品矩阵按设计跳过纯文档作业。main 首次运行下载历史 npm 包时连接超时；tag 首次 Windows 2.1.288 作业通过 Native 校验、测试、精确类型及 197 项容量用例后，在历史升级过程中超过原有 npm 时限。定向重跑失败作业后，两个最终门禁均通过，未更改断言、时限或源代码；失败记录保留，不计作通过证据。

最终包另行通过全部 197 项实际宿主容量检查、23 项安装检查、十七组安装包 PTY、六语言 792 帧明暗主题采集及四种单色／dumb 终端对照，配置和终端状态恢复断言全部通过。已检查五幅最终包 Native 单元格重建图；这些仍属于自动化 PTY 与代理观察证据。

| 问题 | 独立回归证据 |
| --- | --- |
| [#154：Client props](https://github.com/fbincon/claude-code-statusline/issues/154) | 生产快速配置、导入、方案、数据源、说明、渐变及禁用实例状态均可操作。真实 24 项场景仅保存一次，回读所有实例并显示保存成功；恢复测试保留成功／未知结果，禁止重试再次保存。 |
| [#155：Client 绘制](https://github.com/fbincon/claude-code-statusline/issues/155) | 宿主用例覆盖 32／72 列及 170／180／200 行边界；真实 200×220 终端提供 72×213 Client，缩小到 200×50 后保留未保存副本、预览和页脚，正常流程日志无容量拒绝。 |

两次独立构建、交付源码重建、main／tag CI 文件、重新下载的四个 GitHub 草稿附件及匿名公开 GitHub／Gitee 下载均逐字节一致：

| 交付文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.1.tgz` | `1a848e45519b5ecb75eb48f9893190b448c289c7e917049ac9b20c545327bf55` |
| `claude-code-statusline-3.9.1-source.tar.gz` | `92155721ec225f6c236264cd08a899f88ee8e6a5e0eb4fd415e195abba881d74` |
| `build-manifest.json` | `bee61414d37adf21e33338bf03240f7fbe2d6eddaaae950d7d37eba2b0abdef9` |
| `SHA256SUMS` | `c2e5f616a013da01586676216c25c06a6f9cc82bbdd039a2ee929546de65b417` |

npm 接受首次 OIDC 发布并签发来源证明，但注册表同步超过校验器的三分钟窗口。匿名元数据及包下载确认 SHA-256／SHA-512 和标签一致后，重跑失败发布作业；它进入只读的 `already-published` 分支并通过，未再次上传包。公开来源证明指向本次发布提交、`refs/tags/v3.9.1` 和首次发布运行。npm `latest` 为 `3.9.1`，`beta` 保持 `3.0.0-beta.1`。

[GitHub v3.9.1](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.1) 已作为稳定 Latest 发布，附件不可变。[Gitee v3.9.1](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.1) 使用相同发布源、注解标签和四个已验证附件，并维护平台对应的下载说明。匿名下载的 Gitee 包在空缓存环境中离线安装，通过版本、渲染及配置烟测；本机匿名 GitHub／npm 精确版本和 latest 安装也通过。

Linux 测试机通过正式包管理命令从 3.9.0 升级至 3.9.1，已验证安装源身份及 doctor 检查。真实外部／Native 安装入口均通过快速配置、取消不保存；Claude 2.1.310 的 Native 入口还通过高面板缩放和关闭。显示配置与 UI 偏好文件和初始快照逐字节相同，集成设置仅更新本工具管理的后端版本；保留升级后的正式安装。

原始日志、采集、私有快照和回执保存在被忽略的验收目录。未执行付费模型测试，也未增加人工桌面或物理验收声明。

[本版本批准](../releases/approvals/v3.9.1.json) 仅接受 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口，仍保持未验证。任何新增自动化失败或回执缺失均阻止发布。
