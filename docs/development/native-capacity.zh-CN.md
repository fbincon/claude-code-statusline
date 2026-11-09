# Native 编辑器容量与恢复

[English](native-capacity.md) | **简体中文**

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) 跟踪 Client props 超限，[issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) 独立跟踪 Client 绘制树超限。合法配置也能触发两者；保存成功后仍可能重绘失败，因此面板空白不能证明写入失败。

## 展示边界

完整 Editor、catalog、baseline、草稿、管理器候选和库保留在宿主。`lib/session.ts` 使用原有纯绘制规则生成独立的扁平可见帧，只包含 Box／Text、基础属性及指向先前节点的子引用。Client 负责还原展示和发送有序输入，不再重建 Editor。隐藏预览区和翻页范围之外的数据不经过此端口。

`ui.message` 和 `ui.render` 共用投影。epoch、generation、累积按键批次及确认保留既有顺序和去重规则。空事件批次仅在实际 Client 尺寸变化时通知宿主；实际区域尺寸与绘制／按键分页使用的有界展示尺寸分开。

处理按键时，将 Client 上报的视口约束到外层窗格实际分配的区域。有些宿主会在按键事件中上报较大的整个终端视口。绘制和键盘翻页须使用同一适配区域，按 End 或调整大小后的第一步也应如此。

props、外层 Pane 和 Client 绘制树分别预检查：保守序列化字符数 48,000、值数 10,000、深度 16，并计入非 ASCII 转义膨胀。这是内部安全预算，不等价于 Claude 校验器，仍须实际挂载宿主验收。超预算时先减少单页高度，再减少展示宽度，保留 32×12 最小布局、选中内容、预览颜色和可用分页。容量提示放在分区标题开头，避免被裁剪或其他消息遮住。最小布局仍无法输出时进入恢复页，不裁剪存储配置。

空白区使用单个带高度的 Box；边框使用固定节点，不再逐空白行生成容器。预览与界面文字在完整字素裁剪后合并相同样式的连续片段。生产样本渲染、保存配置和展示拟合保持独立。

## 故障与保存结果

投影或外层绘制树被拒绝时，改为小型宿主恢复视图。兼容的 `ui.*` 观察器只处理本 Pane／Client 的 `ui.fault`；Claude 2.1.287／288 保留预检查和外层手动重试／关闭按钮。较新宿主可报告加载、绘制和运行故障。故障原因只作为文字展示，不作为指令或恢复命令执行。

恢复保留宿主已接收的草稿。重试推进 Client epoch 和挂载身份，替换已卸载实例，不提交保存。恢复页区分上次保存成功、正在写入及结果未知；未知结果继续阻止重试／关闭，并提供原有只读保存状态核对入口。修订校验、锁、备份和后端原子写入不变。

当前显示与编辑器接口版本见[共享契约](contracts.zh-CN.md)。

## 必需检查

[容量生成器](../../tools/generation/native-capacity.ts)使用生产 description、共享编辑规则和注入观测的生产渲染生成用例。用例覆盖 72×213 现场尺寸、极端尺寸及已注册语言，生成模块分片遵守宿主大小限制。夹具使用注入数据。现行用例数量由[证据验证器](../../tools/checks/ci-section-evidence.ts)按不可变源码中的语言清单推导。

`test:mods` 执行产品 Mod 测试，并以实际交付的 Client 和投影代码运行临时容量 Mod。各适用用例在真实宿主测试引擎验证挂载、输入确认或极端尺寸投影。集成测试分别注入外层预检查失败和实际 Client 校验失败，覆盖成功及未知保存结果。诊断探针捕获拒绝后的退出只记作诊断。

按[当前 TypeScript 检查](testing.zh-CN.md#当前-typescript-检查)选择必需的安装、运行时和宿主组合，绑定同一源码与产物摘要。本地 Mod 测试先运行 `npm run mods:prepare`，按实际 `claude --version` 准备精确声明。在 2.1.310 上用不提交提示的交互会话生成声明，等待包含宿主编译设置和所有所需工具声明的稳定产物。2.1.296 的既有声明缺口仍标为不可用。

安装候选执行适用的真实 Linux Native／外部编辑器 PTY 流程，核对保存回读与终端捕获，并记录产物、源码、宿主和平台。PTY 和重建图像按自动化证据记录，实机及人工结果单独记录。参见[测试与验收](testing.zh-CN.md)及[容量验证选图](../images/native-capacity/README.zh-CN.md)。

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## v3.9.1 历史验收

- <a id="交付记录"></a>[交付记录](history/deliveries/native-capacity-v3.9.1.zh-CN.md#交付记录)
- <a id="最终稳定版交付"></a>[最终稳定版交付](history/deliveries/native-capacity-v3.9.1.zh-CN.md#最终稳定版交付)
