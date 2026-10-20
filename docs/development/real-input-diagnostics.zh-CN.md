# 真实输入诊断与宿主字段覆盖

[English](real-input-diagnostics.md) | **简体中文**

实现基线：配置体验交付后的 `6716435`。[用户指南](../DIAGNOSTICS.zh-CN.md)定义命令契约。v3.3.0 已通过 npm、GitHub 和 Gitee 发布及验证，交付证据记录在下文。

## 架构与契约

core 负责宿主字段解释、配置原因、中性的渲染追踪和真实输入报告组装；既有示例适配器把中性布局结果转换为示例专用原因码，生产渲染仍按需开启追踪。cli 负责显式输入解析、显示／设置只读访问及现有存储适配；platform 提供有大小限制的文件读取，不提供写入或进程能力。

编辑器协议 14 新增 `diagnose`：必填 `draft`、`input`、`scope`、`width`，可选 `source` 默认 `supplied_json`，`observed_at` 默认 null，`include_local` 默认 true。响应分别表示来源、拟合文本片段、实例原因、证据和行结果；`explain` 仍仅解释示例。显示 schema 8、runtime 2、portable 1、UI preferences 1 不变。两个编辑器通过生成的目录及翻译资源获得新的可选组件。

诊断不调用会创建安装锁的 `ConfigurationService.read`，而是独立只读显示和设置文件。运行时适配器不调用 collector、事务服务、目录扫描、协调、子进程或网络客户端。已发布的请求／费用关联有独立的纯快照解析器；普通采集继续保留现有协调行为。已有任务快照可以直接使用生产计时格式化逻辑，无须采集转录。

两个工作树字段共存时保留既有会话名称优先级，普通 Git 工作树使用独立标签。缓存原因仍是宿主判断的可能原因，详细数量和时间保留在诊断报告中。可选的 `cache-miss-reason` 增加一个主栏指标：主栏／子代理指标为 61／14，含组合组件的类型为 63／16，默认选择不变。

## 证据与边界

合成的[宿主输入样本](../../tests/fixtures/diagnostics/host-input.json)依据 2026-10-19 检查的官方状态栏文档，不含真实会话数据。冻结 Python 样本与归档证据不变；比较器只在明确路径接受新增操作、工作树元数据变化和新增原因组件。

测试覆盖 CLI／文件／stdin／后端、六语言、重复实例及布局、缺失／无效／零值、会话与 prompt 隔离、陈旧／未来证据及读取前后存储内容一致。真实与示例输出复用拟合实现；另行验证生成的 Mod 协议解析及编辑器保存新增组件的通用流程。

已知限制：跨来源快照不是全局原子的，用量缓存没有采集时间，不刷新转录或重建历史；缺少提交对身份时无法读取 branch-diff。[#96](https://github.com/fbincon/claude-code-statusline/issues/96)既有实机／桌面／精确宿主声明缺口仍未验证。[2026-10-20 决定](../releases/approvals/v3.3.0.json)仅为 v3.3.0 接受这六项，任何新增功能或自动化失败仍阻断发布。

## 验收记录

本地实现检查已通过：`npm run check` 共 1,055 项测试，1,051 通过、4 项平台跳过、零失败；生成资源一致性、2,477 个文档链接、归档完整性及迁移台账通过。Linux Claude Code 2.1.294 的原生／运行时 Mod 官方测试通过，使用离线合成凭据，模型调用为零。这些检查不替代安装产物及最终平台验收。

下文记录固定源码／产物身份、最终检查、PR／main／tag CI、安装／Mod／PTY 结果及公开交付证据；原始报告保留在忽略的验证目录。纯文档后续提交不重复产品矩阵。

### 工程候选

源码 `ae574dba06d22c59c04d4217e3a2cb4f29e31dec`；私有工程包 SHA-256 为 `c5db3f984387ce110a0bfea5ee5ca547f626d5f8c4f823d9132f236a468e5f99`。两次独立构建字节一致；十项隔离安装检查和二十项指定输入检查通过，包含六语言 40／80／120 列及诊断前后文件不变。Linux Claude Code 2.1.294 原生／运行时 Mod 官方测试、精确声明及真实安装绑定通过。原始报告位于忽略的 `dist/validation/v3.3.0/`。396 个六语言扩展安装版 PTY 捕获全部通过，终端恢复通过；捕获报告 SHA-256：`db6e52b41ccf90e7fb980a37ba5da6817c6f0a6cc3b68c0f426f4a5f7acd0b30`。代理抽查了重建画面，这不等于真人桌面验收。最终源码验收及公开交付证据记录在下文。

## 发布验收 — 2026-10-20

[实现 PR #115](https://github.com/fbincon/claude-code-statusline/pull/115)合并为 `002c55dd993f457ab438507214515385b67692fa`。附注标签 `v3.3.0` 的对象为 `72daa1af12a78cc305fa48b603852a3f73ca02b4`，指向该提交。最终审查补充回归测试，防止晚于输入采集时间的任务快照进入运行状态渲染；每个参与来源独立保留观测时间。

| 门禁 | 证据 | 结果 |
| --- | --- | --- |
| 最终 PR head `e8c8900` | [CI 39407955538，第二次尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/39407955538/attempts/2) | 56 项任务成功；纯文档任务跳过 |
| 合并后的 main | [CI 39413309273](https://github.com/fbincon/claude-code-statusline/actions/runs/39413309273) | 完整矩阵及正式就绪检查通过 |
| 版本标签 | [CI 39416322509](https://github.com/fbincon/claude-code-statusline/actions/runs/39416322509) | 完整矩阵及正式就绪检查通过 |
| 本地开发检查 | `npm run check` | 共 1,056 项：1,052 通过、零失败、4 项平台跳过；39 份生成资源、2,491 个链接、归档完整性及台账通过 |
| 最终包安装 | 离线安装及诊断 | 十项安装检查、二十项指定输入用例通过 |
| 本地固定宿主 | Linux Claude Code 2.1.294 | 原生／运行时验证、官方测试、精确声明及真实安装绑定通过 |
| 安装版终端流程 | 最终包六语言扩展 PTY | 396 个捕获及终端恢复全部通过 |

每轮完整矩阵要求八个离线安装目标、32 个 Node 运行用例和十三个固定宿主组合；安装与 Node 验收均包含诊断用例。Claude 2.1.296 精确声明仍依本版本决定保持未验证。

[第一次 PR 尝试](https://github.com/fbincon/claude-code-statusline/actions/runs/39407955538/attempts/1)的 macOS 26 Intel／Node 24.x 在实时日志报告 612 项产品测试（610 通过、2 项平台跳过、零失败）后停滞，没有后续安装回执。超过验收子进程超时后取消该次运行，汇总门禁正确拒绝不完整证据。GitHub 未提供该停滞任务的完整日志包，实时页面摘要与任务元数据另行保留。受影响用例和汇总门禁在相同源码、相同产物的第二次尝试通过；未放宽任何检查、超时或验收规则。同一目标也在 main 矩阵正常通过。

两次独立本地构建、交付源码重建和 main／tag CI 产物的四个交付文件逐字节一致。安装包 SHA-256：`605ef85be239a9b4184bb59ce7cad036880a66c43ea126845b180aa66ebee90f`；源码归档 SHA-256：`497b892739aff300983b493171914cd6ed9b854eb5b717ba7d10ee85c0b1d71f`。

最终本地证据保留在忽略的 `dist/validation/v3.3.0/`。最终 `release-captures/editor-capture.json` 摘要为 `7861eceb29bc69e409ff23cca5092f15eaa44cc70207808310314228d8d1be4b`。代理抽查了中英文重建画面；终端单元及记录字体不构成真人桌面或实体电源验收。首次本地 Mod 准备发现此前临时宿主目录已不存在，重新安装同一固定版本后验收通过，未修改产品。

## 公开交付

- [GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.3.0)，Release `418352448`，发布时间为 `2026-10-20T12:13:44Z`。草稿四附件已重新下载并与验证构建一致，下载包十项安装检查通过；[SHA256SUMS](https://github.com/fbincon/claude-code-statusline/releases/download/v3.3.0/SHA256SUMS)记录安装包、源码和构建清单摘要。
- [npm 3.3.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.3.0)：[OIDC 预检](https://github.com/fbincon/claude-code-statusline/actions/runs/39419833196)及[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/39420030905)通过。回执为已验证提交和包的 `published`，公开 SHA-512 完整性一致；`latest=3.3.0`，保留 `beta=3.0.0-beta.1`。
- [公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39420669544)的六个 Linux／Windows／macOS × Node 22/24 任务全部通过。精确版本和 `latest` 共十二次初始空缓存安装通过，生命周期脚本关闭，GitHub／npm 字节及注册表完整性一致。
- [Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.3.0)，Release `1223144`：检查祖先关系后，以明确 refspec 同步已验证 main 和附注标签。四个附件匿名下载摘要一致，下载包十项离线安装检查通过。自动生成的仓库归档与可重建源码附件分别对待。

首次 Gitee 附件上传发生 TLS 传输错误，远端未留下附件。检查远端状态后，通过当前原生网络接口及新解析的公网地址上传相同文件，保持正常证书验证；匿名下载同样使用该路径。凭据始终由既有密钥环 API 客户端处理。

本次后续文档记录实际交付，仅做文档／链接／空白校验。已发布标签及包继续绑定上述实现提交；六项披露的实机／桌面／精确声明缺口仍未验证。
