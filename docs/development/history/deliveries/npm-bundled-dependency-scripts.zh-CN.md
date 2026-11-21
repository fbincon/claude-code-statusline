# npm 安装与首次启动

[English](npm-bundled-dependency-scripts.md) | **简体中文**

本次 2026-11-21 功能交付修复 [issue #220](https://github.com/fbincon/claude-code-statusline/issues/220) 中的默认 npm 首次启动流程。源码修复通过 PR #286 交付。稳定版打包和发布使用独立的发布 PR。

## 变更

| 领域 | 结果 |
| --- | --- |
| 打包 | 新产物移除内置依赖清单的 `scripts`，并标记为 `sanitized`。Koffi 使用包内预构建二进制。 |
| 验证 | 候选包与签名验证覆盖带标记产物的全部内置公开及私有依赖清单。未带标记的历史产物沿用原验证规则。 |
| 首次启动 | 前缀检测跳过 npm 缓存中经过验证且指向当前运行包的临时入口，继续在 PATH 中查找持久安装。 |
| 影响比较 | 已打包生命周期脚本的变化走产品路线。源码比较器可在编译前运行。 |
| 发布 smoke | 使用真实 npm 和终端验证审阅、进入 setup、取消和清理缓存后的渲染。 |

## 源码身份

- 合入分支的基线：`4c3f432168dc8880d5fd487aa09d76397ecb15bc`。
- 独立打包比较 head：`d0417caa31f37cfaba9d28849792fa98ee021dfa`。
- 最终源码、包和执行身份记录在 [PR #286](https://github.com/fbincon/claude-code-statusline/pull/286)。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 干净源码 `ci:plan --compare` | 产品路线。在未预先构建的情况下，比较识别出包内 Koffi 和 lossless-json 的清单变化。 |
| 原始复现 | 在 Linux 上，已发布的 3.16.3 在 npm 尝试加载缺失的 Koffi 安装器时退出。此前没有脚本的候选包可以启动 CLI，但在审阅前把自己的临时入口识别为前缀冲突。 |

[PR 验证记录](https://github.com/fbincon/claude-code-statusline/pull/286) 将最终测试结果和平台限制绑定到审阅的 head。
