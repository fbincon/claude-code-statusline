<a id="node-运行环境与地区语言后续工作"></a>

# Node 运行环境与地区语言支持

[English](node-regional-languages.md) | **简体中文**

成品支持稳定版 Node `^22.0.0 || ^24.0.0`，以及按序的 `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`id` 语言选项，台湾与香港均有完整语言包。原始迁移与发布证据见[交付记录](history/deliveries/node-regional-languages.zh-CN.md#node-运行环境与地区语言后续工作)。

## 运行环境约定

成品接受稳定版 Node `^22.0.0 || ^24.0.0`。开发、资源生成与可复现构建保留 Node 24.21.0/npm 11.19.0。`packages/core/src/node-runtime.ts` 由打包、校验、诊断及运行环境回执检查共用。不新增其他 Node 系列或系统／架构承诺。

当前验收矩阵覆盖八个安装、32 个 Node 用例和十六个固定宿主；当前数量由[测试与验收](testing.zh-CN.md#当前-typescript-检查)维护。32 个案例以相同发布包在每个安装目标分别测试 22.0.0、最新 22.x、24.0.0 和最新 24.x。回执记录源码提交、包 SHA-256、实际 Node 版本／摘要、产品测试和隔离离线安装；缺失、重复、运行版本错误或失败均不能通过发布验收。先用固定工具链构建，再切换 Node 运行 `npm run test:runtime`，不重新构建。模块追踪使用异步加载钩子和明确的消息排空握手，兼容 Node 22.0.0。

Windows Node 24.0.0/libuv 1.50 的路径统计还会返回零设备号，而描述符统计保留真实卷序列号；[独立 Windows 诊断](https://github.com/fbincon/claude-code-statusline/actions/runs/39117485659) 已在两个 Windows 目标上复现。恢复读取从不跟随重解析点的原生句柄取得卷号和文件索引，确认索引仍匹配此前路径快照，再与已打开描述符核对身份。BigInt 避免索引舍入；Windows 卷号使用 32 位，POSIX 设备号保留全部位。保留普通文件／重解析点／权限保护，回归检查不同文件和路径替换。原生结构采用 [Microsoft 文档布局](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information)。

## 地区语言约定

选项顺序为 `en`、`zh-CN`、`zh-TW`、`zh-HK`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`id`。`zh-Hant` 仅作为台湾的兼容输入别名；读取在内存规范化且不改写文件，显式保存与导出采用规范代码，未知输入继续拒绝。台湾和香港各有完整资源、地区用词、统一生成、多语言搜索和独立界面／输出选择。[翻译约定](i18n.zh-CN.md)。

冻结迁移捕获在内存适配历史协议 11 请求。比较仅允许已知协议字段、精确的版本错误文字及两处语言选项列表变化；继续检查其他行为及原来的三项 CLI 文字差异。

完整的[交付记录](history/deliveries/node-regional-languages.zh-CN.md#node-运行环境与地区语言后续工作)已归入开发历史。下方链接直达迁移章节。

- <a id="验证与交付"></a>[验证与交付](history/deliveries/node-regional-languages.zh-CN.md#验证与交付)
- <a id="不可变发布身份"></a>[不可变发布身份](history/deliveries/node-regional-languages.zh-CN.md#不可变发布身份)
- <a id="ci-与发布"></a>[CI 与发布](history/deliveries/node-regional-languages.zh-CN.md#ci-与发布)
- <a id="公开渠道与图像"></a>[公开渠道与图像](history/deliveries/node-regional-languages.zh-CN.md#公开渠道与图像)
