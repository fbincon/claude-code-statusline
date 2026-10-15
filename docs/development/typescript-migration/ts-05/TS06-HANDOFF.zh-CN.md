# TS-06 工程交接

[English](TS06-HANDOFF.md) | **简体中文**

TS-05 交付私有通用工程候选、可重建源码包、校验文件及绑定源码的验收证据。
参见[关闭证据](README.zh-CN.md)和[候选指南](candidate.zh-CN.md)。TS-06 仍为
**NOT_STARTED**；本文记录其前提，不执行发布或切换已安装产品。

## 输入与保留契约

- Node 24.21.0、npm 11.19.0、TypeScript 5.9.3；固定 Koffi 3.3.3 和 lossless-json 4.3.1。
- 单个离线 tgz 覆盖 Linux x64、Windows x64、macOS x64 与 macOS ARM64。Windows ARM 使用 x64 Node 模拟运行，不宣称原生 Windows ARM 支持。
- 四个业务包、两个 Mod、五种语言、技能模板、所有权清单和许可证。候选身份为 `@fbincon/statusline-ts05-candidate` / `0.0.0-ts05.g<commit>`，保持 `private: true`，应用身份独立记录。
- 显示 schema 8、编辑器协议 11、运行时协议 2 及 v1 兼容、任务 schema 4。保持绝对 Node/JS argv 绑定、显式禁用、兼容备份与显式恢复。
- 161 个冻结案例只保留原有三个已批准 CLI 文本差异。856 个测试方法、62 个工具入口的台账无待处理项。Python 归档和独立参考入口保留历史对照及回退。
- 保留已发布 Python 产品及可恢复环境。当前 main 是 TypeScript 开发源码，历史安装和发布流程使用固定 Python 标签。

## TypeScript 发布前必须完成

| 门槛 | 剩余工作及证据 |
| --- | --- |
| macOS 实机休眠/恢复 | 记录真实休眠/恢复；无效果的 VMware Sleep 操作不能计为通过。 |
| macOS 14 Intel 实机 | 在该实际目标完成桌面和电源验收；较新系统或 ARM CI 不能替代。 |
| Windows 10 桌面 | 在 Windows 10 验证启动、焦点、两个编辑器、中断和恢复；Windows 11/server CI 的目标不同。 |
| WSL 桌面和弹窗 | 确认真实桌面启动、焦点及弹窗；原生、PTY、tmux 会话检查单独保留。 |
| 其他目标的电源及人工视觉覆盖 | 记录准确系统、架构、终端、主机、源码和安装制品；区分自动化、重建图像与人工证据，保留历史 macOS Client 焦点限制。 |
| 所选主机声明 | 重验发布选择的主机；2.1.296 缺少可用声明，不能记为类型检查通过。保留精确 2.1.294 声明检查及两个 Mod 的官方测试。 |
| 实际预览分发 | 确定公开名称、版本和交付渠道；针对真实预览制品验证固定源码构建、下载字节、目标安装及升级恢复。 |
| 正式切换 | 解决预览反馈，说明最后支持的 Python 版本、迁移和回退；验证最终提交/标签 CI 及资产，再同步已验证的 GitHub 引用及同字节发布资产到 Gitee。 |

既有[发布前门槛](../ts-02/LINUX-20261014.zh-CN.md#已批准的阶段与发布门槛)继续适用，
缺失、跳过和失败的观察不能计为通过。CI 的八个安装目标、十三个固定主机组合属于工程证据，
不能填补上表实机/桌面项目。npm Windows `.cmd` 的既有限制保留，PowerShell `.ps1`、
Git Bash 和直接 Node 调用分别验证。

## 验证与发布边界

使用 `npm run check`、`candidate:build`、`candidate:verify`、`test:installed`、
`test:mods` 和 `release:prepare`，固定提交并使用同一候选制品。
保留实际生成的文件名，将全部确定性包文件放在同一目录。原始证据保存在忽略的验收目录和 CI 制品中。
`reference:verify` 只用于独立历史检查，普通流程不得重新依赖 Python/编译器。

TS-05 没有新增付费模型调用、公开预览、版本标签、注册表发布或 Release。
既有付费记录和模拟验证了预算工具；新调用仍须显式启用、新证据目录及共享预算/账本约束。
已安装 Python 产品未切换。

D06 仍为 **FAIL：104 pass / 60 fail / 28 inconclusive**，TS-05 没有运行完整 D06 测量。
PERF-01 保持 **NOT_STARTED**，在 TS-06 后进行，保留原测量策略、源码/工具固定信息和失败记录。
功能超时、资源上限、事件丢失、原子写入和恢复仍是当前门槛。
