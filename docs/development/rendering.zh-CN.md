# 渲染与 Unicode 契约

[English](rendering.md) | **简体中文**

生产主／子代理行、共享 TypeScript 预览和双编辑器使用固定 Unicode 18.0 列宽及扩展字符簇边界。歧义字符占一列。终端或字体可能采用不同字形表现；本契约定义应用布局，不代表所有物理终端。

## 可复现 Unicode 数据

`tools/unicode/data.json` 保留所需 wcwidth 0.9.1 数据表及原模块摘要；`provenance.json` 记录 Unicode 版本、数据与官方一致性文件摘要。npm 包及源码归档包含 MIT／Unicode 声明，生成的 Native 表也保留声明。产品元数据声明 `MIT AND Unicode-3.0`，项目自身代码仍为 MIT。

当前生成器是 `tools/generation/resources.ts`。修改其规范输入后运行：

```bash
npm run generate
npm run generate:check
```

普通生成离线完成，无需安装 Python 或 wcwidth。修改固定 Unicode／参考版本须明确调整生成器并完成适用产品验收。[Python 归档](../../archive/python/README.zh-CN.md)保留原 Python 生成流程和数据表编码，不从当前 main 重新生成。

可打印 ASCII 快速路径不初始化 Unicode 表。Core 与 Native 测试使用官方 Unicode 18.0 GraphemeBreakTest 和共享列宽样例。宽度规则逐个完整字符簇应用：`a` 后的 ZWJ 不能吞掉无关的 `b`。运行时分簇和宽度不导入 wcwidth，也不依赖宿主 Unicode 数据库；生成数组仅在非 ASCII 处理需要时初始化。

## 样式与边界

支持前景、背景和粗体样式。SGR 累积生效，`0` 重置受支持属性，`22` 取消粗体，`39`／`49` 分别恢复默认前景／背景。保留 ANSI 0–255 色槽和 RGB，支持分号／冒号扩展颜色格式；非法颜色组不能变成其他命令。

可见行先分簇再关联样式。同一簇内出现 SGR 时，以首个可见字符的样式绘制，后续转换仍影响下一簇。裁剪和换行不拆簇，有样式的行恢复状态并在末尾复位。不可拆簇宽于整个视口时用省略号表示；普通 CJK／emoji 簇可放入两列生产最小宽度。

不可信输入的控制字符继续清理。ZWJ、变体选择符和 emoji 标签作为 Unicode 文本保留，不开放 ANSI 注入。已验证的 OSC 8 链接经过适用样式和列宽处理后保留。固定预览不运行实时采集、不执行 Git、不写持久状态。[共享契约](contracts.zh-CN.md)。

## 编辑器绘制与捕获

Native 预览在独立的浅／深底色内应用 span 背景；默认背景恢复该底色，填充空格不继承最后一段颜色。外部编辑器通过 `packages/tui/src/drawing/canvas.ts` 生成有界帧与 ANSI 输出，将前景／背景映射到检测出的 0／8／16／256 色能力。平台终端适配器管理 raw 输入、缩放和退出恢复。完整文本及编辑操作保留字符簇，缩短重绘清理先前行。

当前采集工具位于 `tools/acceptance`：`capture:editor` 在真实 PTY 中运行匹配的已安装外部编辑器，`capture:render` 用明确字体重建已记录终端单元格。输出标明软件包／源码、单元格输入、裁剪、渲染器和字体摘要。`capture:native-capacity` 提供实际宿主 Native 捕获覆盖，其独立要求见[候选验收](typescript-migration/ts-05/candidate.zh-CN.md)及[容量／恢复](native-capacity.zh-CN.md)。

重建验证记录的终端输出，不证明物理终端字体或人工验收。方法标识与脱敏复现输入见[图片来源](../images/README.zh-CN.md)和 [SHOWCASE-01 采集](showcase.zh-CN.md)。历史 Python／pyte 命令保留在冻结归档及原始捕获记录，不属于当前开发流程。

## 条件显示与逐项外观

可见性使用渲染的同一惰性 Git／实时快照和未舍入用量；仅完整零值／干净证据触发隐藏，不从格式化文本反推观测。主题提供语义前景，逐项颜色覆盖包含标签／图标的完整样式值；已启用风险前景优先。共享颜色规则位于 `packages/core/src/rendering/colors.ts`。

Powerline 在适配后组合可见色块，计算内边距／边界并逐行复位。组件前景渐变适用于普通分隔；Powerline 背景及连续行渐变需要彩色 Powerline 输出。自适应指标在缩短或移除装饰时保留数字含义。[用户行为](../APPEARANCE.zh-CN.md)。

## 组件实例与布局

`packages/core/src/config/instances.ts` 负责身份、旧版映射及纯实例编辑，CLI 配置服务通过既有归属／修订事务应用规则。`packages/core/src/rendering/components.ts` 共享主／子行适配，包括文本及每个适用行的单个弹性留白。同一帧复用观测，各副本独立格式化；Native 生成模块复用相同纯规则。[组件组合](../COMPOSITION.zh-CN.md) · [共享契约](contracts.zh-CN.md)。

## TypeScript 开发渲染器

生产 TypeScript 入口支持 `render`（UTF-8 JSON stdin、主行 stdout）和 `render-subagents`（每个有效 ID 一条紧凑 NDJSON）。两者接受 UTF-8 BOM，静默忽略无效输入，并在显示配置无效时使用默认值。`CLAUDE_CONFIG_DIR` 选择配置目录，渲染命令不接受 `--config-dir`。主栏内容预算为 `COLUMNS - 2`，缺省 118 列，最小两列；当前编辑器协议返回两作用域的语义 span，宿主 padding 仅应用于主栏预览。

`RenderEnvironment` 连接时钟、路径及所选观测。重复组件共享 Git、用量、实时、分支差异及任务快照，格式化结果不参与计数。已结束代理需要记录的终态证据并保持冻结时长。十二种小型状态栏语言包与 UI 词库分离。Unicode 18 排版数据固定，载荷大小写转换及旧十进制解析保留冻结 Python 3.14／UCD 16 的兼容语义。
