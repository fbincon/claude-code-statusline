# 渲染与 Unicode 契约

[English](rendering.md) | **简体中文**

生产主／子代理行、Python 预览和原生编辑器采用固定 Unicode 18.0 列宽与扩展字符簇边界。歧义字符占一列。终端或字体可能选择不同的字形表现；这里规定应用的布局，不代表所有物理终端的表现。

## 可复现 Unicode 数据

`tools/unicode/data.json` 保留 wcwidth 0.9.1 所需数据表及原模块校验值。`provenance.json` 记录 Unicode 版本、数据和官方一致性样例的校验值。源码包与 wheel 包含 MIT／Unicode 声明，生成的原生数据表也保留声明，供独立安装的 Mod 使用。

```bash
python tools/generate_unicode.py --check
```

检查和普通构建离线完成，无需安装 wcwidth。主动刷新固定快照时，在开发环境安装 `wcwidth==0.9.1` 后运行 `python tools/generate_unicode.py --refresh`，审阅数据、生成文件和来源记录。更新 Unicode 或参考库版本必须明确修改生成器，并重新完整验收。

Python 只在非 ASCII 文本出现时加载数据表。两端执行官方 Unicode 18.0 GraphemeBreakTest 及共享宽度样例。宽度规则逐个完整字符簇应用参考规则：例如 `a` 后的 ZWJ 不得吞掉属于下一个簇的 `b`。渲染不导入 wcwidth，也不依赖 Python／宿主自带 Unicode 数据库的版本。

## 样式与边界

支持的样式状态包括前景色、背景色和粗体。SGR 指令累积生效；`0` 重置全部受支持属性，`22` 取消粗体，`39`／`49` 分别恢复默认前景／背景。保留 ANSI 0–255 色槽与 RGB，支持分号和冒号扩展颜色形式；非法颜色组不能变成其他样式指令。其他终端特效不在此契约中。

先对整行可见文本分簇，再关联样式。同一簇内部出现 SGR 时，以首个可见字符的样式整体绘制；后续样式变更仍影响下一簇。裁切和换行不拆簇。每个有样式的输出行恢复所需状态，并在末尾复位。单个不可拆簇若宽于整个视口，以省略号替代；普通 CJK／emoji 簇可放入既有的两列生产最小宽度。

不可信载荷中的控制字符继续清理。保留作为 Unicode 文本组成部分的 ZWJ、变体选择符与 emoji 标签字符，这不会开放 ANSI 注入。固定样例预览继续避免实时收集、Git 执行和持久化写入。

代表性性能基准见[测试文档](testing.zh-CN.md)，编辑器协议见[共享契约](contracts.zh-CN.md)。
