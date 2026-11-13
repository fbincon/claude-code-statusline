# 图片与捕获索引

[English](README.md) | **简体中文**

当前可复现操作流程与非 Powerline 场景变体，从 [SHOWCASE-01 图库](showcase/README.zh-CN.md)和[使用演示](../SHOWCASE.zh-CN.md)开始；录制基线为 v3.16.0，当前文档产品为 3.16.3。各图库分别记录其证据可用的软件包／源码／输入身份及捕获方法。实机截图、终端录制、PTY 重建、代理检查和人工验收是不同类型的证据。

状态分类：**当前基线**是已批准的 3.16 视觉基线；**最新语言捕获**是最新的已安装语言图库（v3.16.0）；**较早 TypeScript** 和**较早功能**是按版本保留的历史图库；**主要物理证据**是 2026-10-07 提供的原始截图集；**Python 时代历史**是 TypeScript 之前的证据；**冻结归档**保留被替换图片及原始记录。历史捕获保留原有结论，不代表后续软件包通过验收，也不关闭 [#96 原有六项缺口](https://github.com/fbincon/claude-code-statusline/issues/96)。

## 图库索引

| 图库 | 捕获版本 | 状态 | 内容与证据 |
| --- | --- | --- | --- |
| [SHOWCASE-01](showcase/README.zh-CN.md) | v3.16.0 | 当前基线 | 首页场景、配置流程及复现／来源说明 |
| [v3.16.0 语言](typescript/v3.16.0/README.zh-CN.md) | v3.16.0 | 最新语言捕获 | 六种新增界面语言、Native 示例及十二语言检查 |
| [v3.1.1](typescript/v3.1.1/README.zh-CN.md) | v3.1.1 | 较早 TypeScript | 六语言页面、明暗配色及边界视图 |
| [v3.1.0 地区](typescript/regional/README.zh-CN.md) | v3.1.0 | 较早 TypeScript | 两个编辑器的台湾／香港捕获 |
| [v3.0.0 准备阶段](typescript/README.zh-CN.md#v300-准备阶段捕获) | v3.0.0 | 较早 TypeScript | 八张安装包外部编辑器准备阶段捕获 |
| [自适应外观](adaptive-row-scenarios/README.zh-CN.md) | v3.14.0 | 较早功能 | 五个场景样本，覆盖 40／80／120 列 |
| [草稿历史与复用](draft-history-reuse/README.zh-CN.md) | v3.13.0 | 较早功能 | 草稿历史、结构审阅及复用捕获 |
| [来源操作](source-command-package/README.zh-CN.md) | v3.12.0 | 较早功能 | 已安装来源状态、绑定清单和策略审核界面 |
| [Native 容量与恢复](native-capacity/README.zh-CN.md) | v3.9.1 | 较早功能 | 快速配置、渐变、24 实例保存和高面板缩放 |
| [首次设置与完整外观](setup-appearance/README.zh-CN.md) | v3.5.0 | 较早功能 | 设置／方案样例来源 |
| [组件组合](composition/README.zh-CN.md) | 2.0.0a1 | 较早功能 | 实例、副本及左右布局 |
| [TUI 截图](tui/README.zh-CN.md) | 2026-10-07 | 主要物理证据 | 21 张原始会话内／外部截图 |
| [Python 时代归档](archive/python-era/README.zh-CN.md) | v1.6.1–v1.13.0 | 冻结的 Python 时代归档 | 59 张外观、状态栏、查找、语言及 TUI 重建图片 |
| [历史归档](archive/README.zh-CN.md) | 混合 | 冻结归档 | 51 张被替换截图及更早的捕获记录 |

## 目录结构

```text
docs/images/
├── showcase/                 # 当前视觉基线
├── typescript/               # 按软件包区分的已安装 TypeScript 捕获
├── adaptive-row-scenarios/   # 外观与场景证据
├── draft-history-reuse/      # 历史与复用证据
├── source-command-package/   # 来源操作证据
├── native-capacity/          # 容量与恢复证据
├── setup-appearance/         # 设置与方案证据
├── composition/              # 组件布局证据
├── tui/                      # 原始物理截图及 Python 时代终端重建
└── archive/                  # 被替换图片、原始记录及历史重建
    └── python-era/           # 59 张 Python 时代外观／状态栏／查找／语言／TUI 图片
```

<a id="更新约定"></a>
<a id="updating-screenshots"></a>

## 更新约定

- 同步修改受影响 README 的中英文版本；本索引、本地图库 README、目录树、相关指南、链接和哈希必须保持一致。
- 使用当前 TypeScript 采集／打包工具及[影响规划](../development/impact-checks.zh-CN.md)选择的媒体检查；记录软件包／源码／输入摘要、终端尺寸、字体及裁剪或编码步骤。私有原始日志不进入公开素材。
- 新采集和更新的样例使用中性样例路径（例如 `/demo` 或 `~/projects`）；历史图片保留原字节和身份。
- 保留历史捕获版本、文件名、提交及元数据；替换批次日期不代表捕获日期。归档页面已冻结。
- 哈希标签统一写作 `SHA-256`。当前采集工具及历史 Python 归档见[编辑器绘制与捕获](../development/rendering.zh-CN.md#编辑器绘制与捕获)。

## 旧链接

以下锚点保留给旧链接，并指向新位置。

<details>
<summary>历史锚点与当前目标</summary>

<a id="当前图片"></a>
<a id="current-images"></a>
<a id="展示说明"></a>
<a id="display-notes"></a>
<a id="文件索引"></a>
<a id="file-index"></a>
<a id="界面截图"></a>
<a id="interface-screenshots"></a>
<a id="external-tui-v161"></a>
<a id="native-editor-captures"></a>
<a id="v120-captures"></a>
<a id="v130a1-preview-captures"></a>
<a id="v130a2-client-captures"></a>
<a id="v150-stable-acceptance"></a>
<a id="v150a1-phase-4-captures"></a>
<a id="v160-stable-acceptance"></a>
<a id="v161-external-tui-captures"></a>
<a id="主题终端捕获"></a>
<a id="theme-terminal-captures"></a>
<a id="external-terminal-color-captures"></a>
<a id="原生预览背景捕获"></a>
<a id="native-preview-background-captures"></a>
<a id="双语终端采集"></a>
<a id="bilingual-terminal-captures"></a>
<a id="状态栏语言采集"></a>
<a id="statusline-language-captures"></a>
<a id="discovery-and-import-review"></a>
<a id="conditional-appearance-captures"></a>
<a id="original-cross-platform-gallery"></a>
<a id="in-session-client-screenshots"></a>
<a id="sources-and-hashes"></a>

| 旧区域 | 当前位置 |
| --- | --- |
| 原始 21 张截图、会话内 Client 及来源哈希 | [TUI 截图](tui/README.zh-CN.md) |
| 主题、外部配色、预览背景及双语捕获 | [Python 时代 TUI 重建](archive/python-era/tui/README.zh-CN.md) |
| 状态栏语言捕获 | [Python 时代状态栏归档](archive/python-era/statusline/README.zh-CN.md)及 [TUI 重建](archive/python-era/tui/README.zh-CN.md#状态栏语言采集) |
| 项目查找与导入审阅 | [Python 时代查找归档](archive/python-era/discovery/README.zh-CN.md) |
| 条件显示与外观 | [Python 时代外观归档](archive/python-era/appearance/README.zh-CN.md) |
| 语言图库 | [Python 时代语言归档](archive/python-era/languages/README.zh-CN.md) |
| 展示说明、文件索引、更早重建及 v1.x 发布捕获 | [历史归档](archive/README.zh-CN.md) |

</details>
