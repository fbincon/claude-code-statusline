# 任务窗格快捷键与编辑器草稿保护

[English](editor-input-delivery.md) | **简体中文**

## 键盘与终端验收

在 Claude Code 2.1.316 的对话框打开任务窗格，首次操作直接使用键盘。80×24 内联和 140×44 停靠窗格各完成 81 步，核对了选中行、后端读取次数、搜索、筛选、折叠、翻页、刷新、取消及粘贴。对话框已有文字时，经宿主移交焦点，关闭窗格后聊天草稿仍保留原文。最终 npm 包通过 Linux 安装态 PTY 的 28 个 Native 流程、15 个外部编辑器流程，另有 3 个独立 npm 启动入口检查通过。[任务详情](../../../TASK_DETAILS.zh-CN.md) · [编辑器操作](../../../USER_GUIDE.zh-CN.md)

GNOME Terminal 3.58.0、VTE 0.84.0 与 Claude Code 2.1.316 对同一个包完成了 31 步图形自动化。GNOME 接管 Ctrl+- 并缩小终端。Ctrl+/ 与 Ctrl+Shift+- 向编辑器送达字节 `0x1f`，Ctrl+R 送达 `0x12`。撤销、重做、空栈提示、只读目录详情和输入框按键隔离均通过。图形事件由程序合成。维护者接受的六项缺口仍未验证，包括人工观感与物理设备检查。[草稿历史](../../../DRAFT_HISTORY.zh-CN.md) · [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)

从 GitHub 草稿 Release 重新下载并安装后，80×24 的任务窗格通过完整流程。宿主分配给 Native 编辑器的正文不足 12 行时，编辑器提示扩窗并保留草稿。把终端增高到 50 行后，同一会话恢复编辑。外部编辑器在隔离配置中用实际安装的可执行文件注册后，于 80×24 通过冒烟检查。

<a id="final-release"></a>

## 发布源码与门禁

验收通过的源码为 `a104294dd5dcbbc30c9d67dc9e5c2f007c410d57`。main 合并提交 `e074b06aac4b458db371206c2c67f7425e5ba8f0` 与该源码具有相同的文件树。注释标签 `v3.16.2` 的对象为 `3fc952cb7141c453311a0992aca967be7fd9e496`，指向验收通过的源码。[产品 PR #204](https://github.com/fbincon/claude-code-statusline/pull/204)

| 门禁 | 核验结果 |
| --- | --- |
| [最终 PR](https://github.com/fbincon/claude-code-statusline/actions/runs/41291221369/job/124827440507) | 最终提交在第 1 次运行通过全部 66 个产品作业。汇总证据覆盖 8 个安装目标、32 个 Node 用例和 16 个固定宿主，每个宿主各 313 个容量案例。12 种语言各 2,324 个键均达到发布要求。原始候选工件为 `13077800716`，汇总工件为 `13080657747`。 |
| [Main](https://github.com/fbincon/claude-code-statusline/actions/runs/41299924324/job/124829378957) | 已接纳的第一父提交独立核验了 PR 证据、合并关系和文件树。三平台安装冒烟均通过，晋级工件 `13081470110` 保留了原始源码身份。 |
| [注释标签](https://github.com/fbincon/claude-code-statusline/actions/runs/41300323011/job/124830093381) | 晋级工件 `13081042381` 把同一组原始回执和四个交付文件绑定到标签与 main 合并提交。 |
| [npm 预演](https://github.com/fbincon/claude-code-statusline/actions/runs/41300991328) 与 [OIDC 正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/41301175313) | 两次均从同一标签启动。正式发布生成回执 `13081276913`。`latest` 升至 `3.16.2`，`beta` 保持 `3.0.0-beta.1`。 |
| [公开下载与签名](https://github.com/fbincon/claude-code-statusline/actions/runs/41301532498) | Linux、Windows 和 macOS 上的 Node 22、24 共六个作业，分别从空缓存安装固定版本与 `latest`。第七个作业验证了外层包的 2 个签名、2 份证明和 6 个捆绑的公开上游依赖。外层包的已签文件清单覆盖 4 个私有 workspace。 |

两次独立 Git 构建与两次交付源码重建，均逐字节复现了原始 CI 的四个文件。匿名下载的 GitHub 附件和 npm 包也与原件一致。[GitHub 稳定版](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.2) · [npm 3.16.2](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.16.2)

| 文件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.16.2.tgz` | `d03e6e7faa79414759cd396ca345d5f5b392959ab4bc2e29b240e246d6b40c8f` |
| `claude-code-statusline-3.16.2-source.tar.gz` | `d93c3b615b4df0d2f7852e23001bec2fcd14258afc6275a2b22f03713661493e` |
| `build-manifest.json` | `b883ba2bccc846d1ef62960c805ae21f99974baf9b189dcce2b682f26dfba533` |
| `SHA256SUMS` | `1ac8b89dc3dd5b96dd828904a7edfa643f31f1abfaa90f676f29572a7985640c` |

Gitee Release `1263258` 发布了相同四件文件。另一进程匿名逐项重新下载，与 GitHub 和原始 CI 工件逐字节比对均一致。首次 Gitee 上传遇到 TLS 错误，两条路线的元数据查询和匿名下载返回的 404 均证实文件缺失后才再次上传。公开版每个文件名各有一件附件。[Gitee 稳定版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.2)

早期 PR 运行发现 Windows ARM64 冷安装 SDK 超时、Windows 测试未确认放弃对话框，以及证据汇总命令循环等待模块加载。最终提交修复了这三处并签发了自己的证据。[早期汇总作业](https://github.com/fbincon/claude-code-statusline/actions/runs/41284039503/job/124800948249) · [Windows ARM64 实测](https://github.com/fbincon/claude-code-statusline/actions/runs/41283455910)

## 本机安装核验

测试机已升级并保留公开版 3.16.2。安装目录中的 1,093 个文件全部与公开 npm 包逐字节一致。受保护的 11 个偏好路径中，6 个文件存在，5 个路径原本缺失。文件权限和缺失状态均保持。唯一的设置变化是 Native 插件自有的 `backendVersion` 从 `3.16.1` 升至 `3.16.2`，无需额外回写偏好。

实际 CLI 的 doctor 以成功状态退出，23 项通过，1 项警告要求用运行中的 Native 会话核实加载。Claude Code 2.1.316 用真实用户级注册完成两条斜杠入口的 16 步 PTY 检查，覆盖撤销重做、键盘搜索、触发后端重新读取并关闭页面。测试使用真实主目录的只读视图和临时会话写入层，禁用外部网络，实际安装保留。整次发布验收的付费模型请求为零。[版本决策](../../../releases/approvals/v3.16.2.json)
