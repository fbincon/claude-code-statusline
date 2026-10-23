# M4–M7 实施与交付

[English](m4-m7-delivery.md) | **简体中文**

APPEARANCE-03、COMPOSITION-02、WORKFLOW-02、METRICS-01 已通过 **v3.7.0** 交付。维护者批准四个功能 PR 和一个发布 PR，选择自动刷新在本机明确开启后持续保留，并要求最终 PR/main/tag 自动门禁全部通过后发布。调研基线为 `a882bd1942d0a59e24e1536779fa283fd1f63c1b`。仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 既有六项缺口，仍标记为未验证。SHOWCASE-01、GIT-01 不在本次范围内。

## 已实现行为

| 工作包 | 结果 | 接口 |
| --- | --- | --- |
| APPEARANCE-03 | 为符合条件的主栏／子代理上下文及配额项提供逐实例可选百分比短条；保留数字默认、原始阈值和缺失／过期语义 | Display 11／editor 18 |
| COMPOSITION-02 | 连续单层分组、装饰文字随主指标显示、可选共享 Powerline 背景、整体拟合、复制重映射及明确编辑操作 | Display 12／editor 19 |
| WORKFLOW-02 | 经过审核的本机 GitHub 自动刷新策略、活跃会话租约、按身份合并任务、手动接管、退避、暂停与停止控件 | 来源注册表／任务 2、editor 20、runtime 3 |
| METRICS-01 | 可选每小时费用估算，逐实例选择会话／API 分母，至少观察一分钟，保留合法零值及六语言估算／单位标记 | Display 13／editor 21 |

共用 core 控件统一双编辑器、CLI 校验、便携持久化及项目方案行为，Mod 副本由权威源码生成。旧显示文件在内存中迁移，仅明确保存后写入；继续兼容 runtime v1/v2 observe/read。便携导入不授予来源执行权限。自动刷新独立于显示保存、宿主集成和两个指标采集器，要求 Claude 2.1.289+ 及已配置的运行时集成，每五秒续租，十五秒未续租即过期。渲染／预览／导入不发起刷新，JSON 和命令来源保持手动。

## 源码与自动门禁

功能 PR：[M4 #129](https://github.com/fbincon/claude-code-statusline/pull/129)、[M5 #131](https://github.com/fbincon/claude-code-statusline/pull/131)、[M6 #132](https://github.com/fbincon/claude-code-statusline/pull/132)、[M7 #133](https://github.com/fbincon/claude-code-statusline/pull/133)。[发布 PR #134](https://github.com/fbincon/claude-code-statusline/pull/134)。

- 最终发布源码：`3edd719525635eedb6a909eee23bb96a4fcab393`；附注标签 `v3.7.0` 对象：`601ea862730d13d2d5feac022deedf927b62c291`。
- [最终 PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40013222675)、[合并后 main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40025287730)、[标签 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40029428803) 各有 56 项适用作业通过，仅按设计跳过纯文档作业。每轮要求八个安装目标、32 个 Node 运行时场景及十三个固定 Claude 宿主。
- 集成本地检查：1,160 项测试通过，五项按平台跳过；生成资源、文档链接、冻结归档及职责清单全部通过。Claude 2.1.294 原生 Mod 132/132 通过；runtime Mod 16/16 及精确类型检查在 2.1.289、2.1.294 均通过。最终 CI 独立验证完整宿主矩阵。
- 安装验收要求全部 16 项检查，包含三项短条、四项分组、四项自动策略／生命周期及四项费用速率场景。正式发布就绪检查拒绝缺失、失败、重复或身份不匹配的证据。

M4 合并后 main [运行 40006647972](https://github.com/fbincon/claude-code-statusline/actions/runs/40006647972) 在 macOS Intel／Node 22.x 暴露来源文件原子替换竞态。M6 通过最多三次完整快照重读修复，继续保留不跟随链接、类型、大小和描述符检查；确定性替换、重试耗尽及链接替换测试覆盖此修复。[运行 40011934863](https://github.com/fbincon/claude-code-statusline/actions/runs/40011934863) 随后发现 Windows 专用断言仍依赖旧错误文字，后续修复保留 Windows 提示并同时校验专用异常类型。失败及被新提交替代的运行保留为证据，不作为豁免。此前 Windows ARM 命令夹具超时通过显式选择已支持的 30 秒测试预算解决，生产默认及取消／截止时间测试未改变。M4 一次独立的 setup-node 停滞经相同源码定向重跑通过。

最终 PR 的首轮检查中，macOS Intel／Node 22.0.0 一次配置写入因既有、有截止时间的 `/bin/ps` 身份查询未取得可验证令牌而停止。底层错误未记录，因此不宣称已证实具体超时原因。原作业日志和失败回执已保留；一次相同源码定向重验通过全部 16 项安装检查、运行时测试及汇总门禁，未放宽身份保护或进程查询截止时间。

标签首轮的 macOS 26 Intel／Node 24.0.0 作业在产品测试阶段超过两个十分钟子进程预算，普通取消也未生效，随后被强制取消。GitHub 在作业结束后仍对日志返回 `BlobNotFound`，因此仅保留运行时作业元数据和取消注释，底层原因未知。相同源码的定向重验及汇总门禁随后通过，未豁免任何测试，也未更换安装包或标签源码。

## 可重现性与终端验证

两个独立构建及交付源码归档重建得到相同字节。发布前已下载核验四个草稿附件，最终安装包通过冒烟和扩展终端检查。最终 Linux PTY 证据包括 **684** 张英文、简体中文、台湾／香港繁体中文、日文和韩文的深／浅色画面，以及单色／dumb 终端检查；覆盖分组编辑、短条与费用速率控件、自动刷新审核／间隔取消、终端恢复及配置不变。这些是终端单元格重建，不是操作系统截图或人工验收。

发布前的受控真实 GitHub 读取使用合成活跃会话租约：成功读取 PR/CI 观察，关闭后停止自动工作并保留来源配置和缓存。使用隔离配置且无模型调用，不宣称完成真实用户会话或实体平台验收。

| 公开附件 | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.7.0.tgz` | `b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95` |
| `claude-code-statusline-3.7.0-source.tar.gz` | `818498d739df808bbd442f2006febd0dedef581ac4f4ecc28eb5ee50ca716152` |
| `build-manifest.json` | `f9a2ceb15c355b881e10534438e07560eb8784b0f3e5abad14eeabfe6ceaaf4b` |
| `SHA256SUMS` | `01e63a201758a5999ca182afeddde4a56a6271da89db6b3c785479ca2c5e5660` |

## 公开渠道

[npm 3.7.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.7.0)、[GitHub 正式版／Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.7.0)、[Gitee 正式版](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.7.0) 均已发布并核验公开下载。[OIDC 试运行](https://github.com/fbincon/claude-code-statusline/actions/runs/40036511985)及[正式发布](https://github.com/fbincon/claude-code-statusline/actions/runs/40036648946) 核验包的精确字节与完整性；`latest=3.7.0`，保留 `beta=3.0.0-beta.1`。[公开下载 CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40037013526) 通过 Linux、Windows、macOS 上的精确版本及 latest 安装验收。GitHub／Gitee 均提供相同四个已验证文件；使用明确 refspec 向 Gitee 同步已验证 main 和精确附注标签，GitHub 保持主仓库。

[v3.7.0 批准](../releases/approvals/v3.7.0.json) 不意味着完成 macOS 实机休眠、macOS 14 Intel 桌面／电源、Windows 10 桌面、WSL 桌面弹窗、其他平台电源／人工视觉或缺失的 Claude 2.1.296 精确声明验证。这六项继续在 #96 保持未验证。原始日志、回执及本机画面保存在忽略的验证目录；README 保留功能介绍，不加入版本更新历史。
