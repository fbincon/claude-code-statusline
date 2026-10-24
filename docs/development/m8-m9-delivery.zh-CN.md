# Git、终端、首次入口及版本管理交付

[English](m8-m9-delivery.md) | **简体中文**

目标：v3.8.0。起点：`d2975e8a4561371b5d32bec136400963dbccd97f`。尚未发布。维护者已批准四个功能 PR 和发布 PR，要求最终 PR/main/tag 门禁及 GitHub/npm/Gitee 字节验收。仅接受 [#96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项既有缺口，继续保持未验证。

| 工作包 | 状态 | 证据 |
| --- | --- | --- |
| GIT-01 | VALIDATING | 共享策略及隔离回归；平台／安装回执待完成 |
| TERMINAL-01 | NOT_STARTED | Windows 能力判断一致性 |
| SETUP-02 | NOT_STARTED | npm 持久首次入口 |
| UPDATE-01 | NOT_STARTED | 从 v3.7.0 起的显式 CLI 版本转换 |

## Git 调用策略

platform 统一有界直接 Git 调用及提供方继承策略；状态采集、提交差异、来源身份和 GitHub 刷新均采用该策略。每次调用关闭 fsmonitor 和隐式裸仓库发现，不放宽所有权检查。状态采集预检过滤器及已初始化子模块，保留子模块脏状态；未知或冲突命令在扫描文件前阻止采集。两秒预算包含预检，每次输出限制 4 MiB，递归最多 64 个仓库。

| 配置 | 行为 |
| --- | --- |
| 仓库控制路径之外的用户／系统过滤器 | 保留用户转换 |
| 本地标准 Git LFS 命令 | 固定到仓库及 Git 目录之外的可执行文件 |
| 本地标准 git-crypt clean/smudge | 要求存在的外部绝对路径及受支持字面参数 |
| 其他 local/worktree 命令、不安全名称或冲突子模块定义 | 返回 `filter_blocked` 或 `policy_unavailable`，不替换成干净／零值 |
| 任意作用域 fsmonitor | 仅对这些观测调用禁用 |
| 隐式裸仓库 | 拒绝；不覆盖 `safe.directory` |

Git 状态缓存升为 3；显示及编辑器接口保持不变。`doctor` 本地化说明及缓存诊断报告策略失败，不打印过滤器命令或凭据。直接参数和两种 Git 运行时配置环境机制均传递策略，保留其他设置。策略不声称隔离另一个进程同时修改仓库文件或受信任程序安装的行为。

隔离回归覆盖同长度 clean-filter 调用、fsmonitor、全局过滤器、include、linked worktree、子模块、裸仓库、中文／空格路径及配置字节不变。核查参考 Matthew Breedlove（sirmalloc）及贡献者的 [ccstatusline 设计](https://github.com/sirmalloc/ccstatusline/blob/bed850187783904a9affcaba1dd80e967622e70b/src/utils/git-hardening.ts)；本实现还在无法保留转换语义时阻止采集，并检查子模块。依据见 [Git 配置文档](https://git-scm.com/docs/git-config)。

## 验证与发布

各功能 PR 前记录本地校验，CI／安装回执、不可变身份和公开渠道结果随完成追加。未完成的平台、人工或发布检查不标为通过。

本地完整开发校验通过：1,167 项通过，五项既有平台跳过；生成资源、3,150 个文档链接、归档完整性及迁移清单通过。增加安装回执后另行重跑策略／诊断／发布门禁回归。发布准备现要求四项安装版 Git 场景；完整产物／平台结果仍待完成。
