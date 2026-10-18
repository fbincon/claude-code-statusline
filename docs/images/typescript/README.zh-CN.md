# TypeScript 安装包外部编辑器图像

[English](README.md) | **简体中文**

当前台湾／香港界面见 [v3.1.0 地区图库](regional/README.zh-CN.md)，来自最终发布包的两个编辑器。下方准备阶段图片保留原始来源。

八张图由 Linux PTY 中**实际安装包**的外部编辑器终端单元重建，**不是操作系统截图**。Python 原始截图继续保留在[跨平台图库](../README.zh-CN.md)。

捕获源码：`2f6d1c21f2abccfe0a05396172c1c8ec55cd989a`；准备包 tgz SHA-256：`4870797de594c064ab7bbea190eaaa0e6981ac5b60a263b7ac418b5cd94d8b50`。这是准备产物，与最终发布产物分别记录。[图像摘要、字体及配置](provenance.json) · [最终交付证据](../../development/typescript-migration/ts-06/stable-release.zh-CN.md)。

环境为 Ubuntu 26.04.1 LTS x64、Node 24.21.0、120×32 单元、xterm-256color。准备配置明确使用相对主目录路径，样例输出语言与界面语言一致。样例来自生产预览渲染器，不读取真实 transcript，也不调用模型。每次取消后设置/显示文件字节保持不变，终端属性恢复。五语言布局、无颜色和明暗终端行为另有测试；这些图不构成桌面焦点或实体电源验收。

复现命令：`npm run capture:editor -- --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE`；重复 `--font` 提供 DejaVu Sans Mono 常规/粗体、Noto Sans CJK 常规/粗体及 Noto Sans Symbols2。采集工具检查源码和实际安装字节匹配；原始 ANSI、单元与回执放在忽略的验证目录。

## 主状态栏

![主状态栏](external/linux/zh-CN/main.png)

## 子代理

![子代理](external/linux/zh-CN/subagents.png)

## 设置

![设置](external/linux/zh-CN/settings.png)

## 布局

![布局](external/linux/zh-CN/layout.png)

