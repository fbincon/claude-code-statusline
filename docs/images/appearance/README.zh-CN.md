# 条件显示与外观捕获

[English](README.md) | **简体中文**

**状态：** Python 时代历史（v1.12.0），不是当前外观基线，也不是真人平台验收。当前非 Powerline 场景见[使用演示](../../SHOWCASE.zh-CN.md)。返回[图片索引](../README.zh-CN.md)。

<a id="conditional-appearance-captures"></a>

来源为 Linux 安装包候选提交 `bf53c807fbe1a924b5137b887a6af59bc6acebac`，原生宿主 2.1.294。原生 120×30 捕获裁剪到 Client 区域，外部 120×30 保留全帧。使用 DejaVu Sans Mono 与 Noto Sans CJK 重建原始解码单元格；外部颜色反映 256 色量化，原生保留直接 RGB。原始终端流、单元格和报告保存在忽略的 `dist/validation/v1.12`。已做 agent 图片检查，无新增真人验收或付费模型调用。

| PNG | PNG SHA-256 | Cell capture SHA-256 |
| --- | --- | --- |
| [native-dark-en.png](native-dark-en.png) | `711c322f2dcca7b0949097f98763d90ca56e1afba0fc8815104b583a88c9eb5c` | `84d271985dc45130b0c0055a95a67a5ac7886f41b742adeee37fe35b935586f0` |
| [external-light-zh-CN.png](external-light-zh-CN.png) | `43440b8a8d2fd0c5ac67dc6c0fea1ea381a7b520b82684f95b3934f45c45edf0` | `b70552ee390683e17e7ff7df83dc15979b1700cc10289af6bc806702e6d76a2f` |


