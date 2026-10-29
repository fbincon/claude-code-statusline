# 自适应外观样例

[English](README.md) | **简体中文**

五张图片由已安装的 v3.14.0 候选渲染固定样例，再从终端单元重建。它们不是桌面截图或人工验收，模型、任务、用量和配额均为合成样例。[PNG、终端单元、ANSI 和字体的精确摘要](provenance.json)。

- 源提交：`492d3d50c8d0d72b6230aff956425958b86f5417`
- 包 SHA-256：`8fd4b89d82446ab2185fbf12181d324aedc6a68f28c4c3261b2a63b6cdd0abff`
- Linux x64；Node `24.21.0`；模型调用：`0`

采集套件还测试显式的 dark／light／terminal 主题变体。下列深色示例使用 dark 覆盖；正常选择方案时分别保留 ocean／slate／ember 默认主题。所有图片保留完整显示行，不裁剪。

| 方案 | 语言 | 列数 | 主题变体 |
| --- | --- | ---: | --- |
| [Powerline 日常](powerline-daily-en-120-dark-standard-compact.png) | en | 120 | dark |
| [代理工作台](agent-workbench-en-120-dark-standard-compact.png) | en | 120 | dark |
| [配额与费用](quota-cost-zh-CN-120-dark-standard-compact.png) | zh-CN | 120 | dark |
| [窄终端](narrow-terminal-en-40-terminal-standard-compact.png) | en | 40 | terminal |
| [浅色易读](light-readable-zh-CN-80-light-standard-compact.png) | zh-CN | 80 | light |

## 复现

```bash
npm run capture:setup-appearance -- --artifact ABSOLUTE_TGZ --commit 492d3d50c8d0d72b6230aff956425958b86f5417 --output NEW_DIRECTORY --font /path/to/DejaVuSansMono.ttf --font /path/to/NotoSansCJK-Regular.ttc
```

使用与来源文件匹配的不可变源码和字体。原始采集与回执留在忽略的验证目录中。[实现与验收](../../development/adaptive-row-scenarios.zh-CN.md)。
