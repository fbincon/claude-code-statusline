# 渲染与 Unicode 契约

[English](rendering.md) | **简体中文**

生产主／子代理行、Python 预览和原生编辑器采用固定 Unicode 18.0 列宽与扩展字符簇边界。歧义字符占一列。终端或字体可能选择不同的字形表现；这里规定应用的布局，不代表所有物理终端的表现。

## 可复现 Unicode 数据

`tools/unicode/data.json` 保留 wcwidth 0.9.1 所需数据表及原模块校验值。`provenance.json` 记录 Unicode 版本、数据和官方一致性样例的校验值。源码包与 wheel 包含 MIT／Unicode 声明，生成的原生数据表也保留声明，供独立安装的 Mod 使用。

分发元数据以 `MIT AND Unicode-3.0` 表示项目代码与随包 Unicode 数据的许可，依据[包许可证表达式规范](https://packaging.python.org/en/latest/specifications/pyproject-toml/#license)和 [Unicode-3.0 标识](https://spdx.org/licenses/Unicode-3.0.html)。项目自身代码继续使用 MIT 许可。

```bash
python tools/generate_unicode.py --check
```

检查和普通构建离线完成，无需安装 wcwidth。主动刷新固定快照时，在开发环境安装 `wcwidth==0.9.1` 后运行 `python tools/generate_unicode.py --refresh`，审阅数据、生成文件和来源记录。更新 Unicode 或参考库版本必须明确修改生成器，并重新完整验收。

可打印 ASCII 快速路径不加载 Unicode 数据表。两端执行官方 Unicode 18.0 GraphemeBreakTest 及共享宽度样例。宽度规则逐个完整字符簇应用参考规则：例如 `a` 后的 ZWJ 不得吞掉属于下一个簇的 `b`。宽度与分簇不导入 wcwidth，也不依赖 Python／宿主自带 Unicode 数据库的版本。

生成的 Python 数据表用标准库 `struct` 解码固定小端序的 32 位整数，避免冷字节码时编译大量元组字面量；测试逐项核对解码结果与固定 JSON 参考区间。表值、Unicode 规则和原生生成数组不变。未选用的 transcript／计时模块按需导入，保留原模块别名。

## 样式与边界

支持的样式状态包括前景色、背景色和粗体。SGR 指令累积生效；`0` 重置全部受支持属性，`22` 取消粗体，`39`／`49` 分别恢复默认前景／背景。保留 ANSI 0–255 色槽与 RGB，支持分号和冒号扩展颜色形式；非法颜色组不能变成其他样式指令。其他终端特效不在此契约中。

先对整行可见文本分簇，再关联样式。同一簇内部出现 SGR 时，以首个可见字符的样式整体绘制；后续样式变更仍影响下一簇。裁切和换行不拆簇。每个有样式的输出行恢复所需状态，并在末尾复位。单个不可拆簇若宽于整个视口，以省略号替代；普通 CJK／emoji 簇可放入既有的两列生产最小宽度。

不可信载荷中的控制字符继续清理。保留作为 Unicode 文本组成部分的 ZWJ、变体选择符与 emoji 标签字符，这不会开放 ANSI 注入。固定样例预览继续避免实时收集、Git 执行和持久化写入。

代表性性能基准见[测试文档](testing.zh-CN.md)，编辑器协议见[共享契约](contracts.zh-CN.md)。

## 编辑器绘制与捕获

原生预览在既有浅／深底色内应用 span 显式背景。默认背景恢复预览底色，补齐空格不继承最后一段颜色。curses 按 0／8／16／256 色能力映射两个通道，并限制颜色对分配；无法使用默认色或颜色对耗尽时退回终端默认文本。

curses 继续负责输入、几何尺寸与退出恢复。支持 VT 的输出先刷新空白底层画面，再按准确位置绘制完整文本；每批输出恢复光标与 SGR 状态，以避免 curses 逐字符存储造成 emoji 错位。不支持 VT 时，将不支持的多码点字符簇整体替换为等宽占位符，保存的文本保持原值。调整尺寸和缩短内容会清理旧画面。文本编辑与高亮行同样保留字符簇边界。

PTY 工具使用 pyte 处理控制指令，使用固定 wcwidth 独立解码字符簇，不使用生产宽度内核；保留原始字节流和解码单元格。捕获验证终端输出，不代表已安装字体或人工验收。在 Linux／macOS 上运行，执行环境需有 `pyte` 和 `wcwidth==0.9.1`：

```bash
python tools/rendering_acceptance.py --python /absolute/installed-venv/bin/python --commit VERIFIED_SHA --report-dir dist/validation/new-rendering-pty
```

覆盖 32／64／120 列彩色与单色 PTY、跨 SGR 边界字符簇、索引／RGB 背景、独立重置、缩短重绘及调整尺寸。`--source` 仅用于开发探测，报告与安装包验收分开记录。

## 条件显示与逐项外观

条件复用渲染的惰性 Git／实时快照与未四舍五入的用量值，仅完整的零值／干净证据触发隐藏，不从格式化文本反推观测。主题提供语义前景，逐项颜色随后覆盖完整样式单元，包括标签／图标和内部复位；已启用的告警前景优先。Powerline 在过滤和适配后组合可见色块，计入内边距和边界并逐行复位。经典路径保留旧输出字节及惰性导入，共享量化放在 `rendering.colors`，curses 保留兼容导出。见[用户行为](../APPEARANCE.zh-CN.md)和 tests 中的共享外观／旧版样例。
