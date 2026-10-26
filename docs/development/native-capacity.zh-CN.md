# Native 编辑器容量与恢复

[English](native-capacity.md) | **简体中文**

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) 跟踪 Client props 超限，[issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) 独立跟踪 Client 绘制树超限。合法配置也能触发两者；保存成功后仍可能重绘失败，因此面板空白不能证明写入失败。

## 展示边界

完整 Editor、catalog、baseline、草稿、管理器候选和库保留在宿主。`lib/session.ts` 使用原有纯绘制规则生成独立的扁平可见帧，只包含 Box／Text、基础属性及指向先前节点的子引用。Client 负责还原展示和发送有序输入，不再重建 Editor。隐藏预览区和翻页范围之外的数据不经过此端口。

`ui.message` 和 `ui.render` 共用投影。epoch、generation、累积按键批次及确认保留既有顺序和去重规则。空事件批次仅在实际 Client 尺寸变化时通知宿主；实际区域尺寸与绘制／按键分页使用的有界展示尺寸分开。

props、外层 Pane 和 Client 绘制树分别预检查：保守序列化字符数 48,000、值数 10,000、深度 16，并计入非 ASCII 转义膨胀。这是内部安全预算，不等价于 Claude 校验器，仍须实际挂载宿主验收。超预算时先减少单页高度，再减少展示宽度，保留 32×12 最小布局、选中内容、预览颜色和可用分页，并显示容量提示。最小布局仍无法输出时进入恢复页，不裁剪存储配置。

空白区使用单个带高度的 Box；边框使用固定节点，不再逐空白行生成容器。预览与界面文字在完整字素裁剪后合并相同样式的连续片段。生产样本渲染、保存配置和展示拟合保持独立。

## 故障与保存结果

投影或外层绘制树被拒绝时，改为小型宿主恢复视图。兼容的 `ui.*` 观察器只处理本 Pane／Client 的 `ui.fault`；Claude 2.1.287／288 保留预检查和外层手动重试／关闭按钮。较新宿主可报告加载、绘制和运行故障。故障原因只作为文字展示，不作为指令或恢复命令执行。

恢复保留宿主已接收的草稿。重试推进 Client epoch 和挂载身份，替换已卸载实例，不提交保存。恢复页区分上次保存成功、正在写入及结果未知；未知结果继续阻止重试／关闭，并提供原有只读保存状态核对入口。修订校验、锁、备份和后端原子写入不变。

此次只修改 Mod／Client 私有端口。显示 schema 15、编辑器协议 24、portable／方案外层、来源和运行时格式保持不变。

## 必需检查

`tools/generation/native-capacity.ts` 使用生产 description、共享编辑规则及注入观测的生产渲染，重建原记录的 195 个具名用例。生成数据去重并拆分到宿主单模块大小限制以下，另补充现场 72×213 和极端尺寸两个用例。测试样本不执行来源命令，也不连接模型。

`test:mods` 执行普通产品 Mod 测试，并在临时容量 Mod 中使用实际交付的 Client 和投影代码。197 项必须在真实宿主测试引擎中全部通过：196 项挂载 Client 并确认输入，另一项检查极端尺寸投影。原诊断探针捕获拒绝后的成功退出不能计为回归通过。集成测试另行注入外层预检查失败和实际 Client 校验失败，覆盖成功及未知保存结果。

必需矩阵保留原十三个宿主组合，新增 Linux、Windows、macOS 的 Claude 2.1.310。十六个宿主回执、八个安装目标及 32 项 Node 运行时用例必须对应相同提交和产物摘要。本地测试元数据来自实际 `claude --version`；直接执行 Mod 测试前运行 `npm run mods:prepare`。2.1.310 通过不提交提示的交互式会话生成精确版本声明。准备时清空生成目录，等待整套产物稳定完成，包括宿主编译设置及所有被引用的工具声明；部分文件或旧编译配置不能算完成。2.1.296 的既有声明缺口仍明确标为不可用。

最终候选还须执行十二组真实 Linux Native PTY 触发流程、外部编辑器对照、保存回读并检查终端捕获，记录来源／产物、宿主和平台身份。PTY 与重建图像属于自动化证据，不代表新的人工桌面或物理验收。

[安装候选选图](../images/native-capacity/README.zh-CN.md) 展示快速配置、渐变、实例保存和高面板缩放。

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## 交付记录

2026-10-26 的合并前 Linux x64 验证已通过仓库完整检查（1,249 项通过，五项既有平台跳过）、143 项 Native 产品测试、两个官方 Mod 测试套件及可用的精确 2.1.310 类型检查，以及全部 197 项容量用例。安装套件的 23 项测试全部通过。本机结果不替代十六个平台／宿主 CI 回执。

候选 `6bf142621c4b139baaf7c6096dec95b6a7ca66c0` 两次构建字节相同，包 SHA-256 为 `d03bbcd1842adada3236424ea632223db72256558987e858b356f2775957a192`。十七组安装包 PTY 流程全部通过：原十二组 Native 触发、新增前景渐变和说明页，以及三组外部对照。24 项案例仅写入一次并回读全部实例；高面板在缩放后保留未保存副本。正常流程日志没有宿主容量拒绝；未运行来源命令或付费模型测试。采集器改为等待实际命令注册并定位真实导入行，先前的采集失败不计为通过。

前几次 CI 暴露了 2.1.310 声明产物不完整的问题：主声明出现后，交互进程可能在编译配置写完前就被结束。等待完整的新产物并明确隔离目录的首次启动偏好后，已修正该验收工具问题。[Windows 诊断作业](https://github.com/fbincon/claude-code-statusline/actions/runs/40327432302) 已通过精确声明生成和 TypeScript 检查，Linux 2.1.310、2.1.287 的全新产物检查也通过。macOS CI 还暴露了临时目录 `/var` 与 `/private/var` 的别名差异，准备工具现在按规范真实路径及 Windows 标准拼写记录受信任测试目录。临时诊断工作流已移除。独立扩展外部编辑器套件通过六语言共 792 张明／暗主题捕获及四种单色／dumb 终端对照，终端模式与配置均恢复。

PR／main／tag、最终不可变产物及公开渠道回执将在各门禁完成后记录；本合并前记录不宣称已发布。

Windows 2.1.296 作业还暴露了一项宿主偏好测试在反复定位字段时超过 20 秒。选择器现在从表单末尾的宿主偏好区开始，并复用可见帧中的 Client 身份，减少重复宿主查询；行为断言和原超时保持不变，修改后的本机 143 项测试全部通过。

[本版本批准](../releases/approvals/v3.9.1.json) 仅接受 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 的六项既有缺口，仍保持未验证。任何新增自动化失败或回执缺失均阻止发布。
