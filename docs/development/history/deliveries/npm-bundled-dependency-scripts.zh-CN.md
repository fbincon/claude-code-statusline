# npm 打包依赖脚本

[English](npm-bundled-dependency-scripts.md) | **简体中文**

本次 2026-11-21 功能交付移除打包依赖清单中的生命周期脚本，使 `npx` 和普通安装不会执行已裁剪的构建脚本。交付范围仅限源码和文档；不创建版本、标签、Release 或 npm 发布。[Issue #220](https://github.com/fbincon/claude-code-statusline/issues/220)

## 变更

| 领域 | 结果 |
| --- | --- |
| 打包 | 打包器移除所有内置依赖清单中的 `scripts`；没有该字段的清单保持逐字节不变。根清单原本就没有 scripts。 |
| 产物标记 | 新的 `candidate.json` 带有 `dependency_manifests: "sanitized"`。验证器仅对带标记的产物拒绝生命周期脚本，因此历史公开产物仍可验证。 |
| 签名 | 内置依赖文件与签名上游逐字节一致，或其 `package.json` 匹配确定性的脚本移除转换。 |
| 影响比较 | 比较前对内置依赖清单应用同一转换；其他清单字段仍参与比较。 |
| 回归覆盖 | 清理器、验证器标记兼容性、签名匹配和包比较测试覆盖新的不变量。 |

## 源码身份

- 任务前基线：`db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`。
- 实现提交和最终 head 由 CI 后的 PR 描述记录。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| 打包专项测试 | 依赖、验证器、影响比较和签名测试共 21 项通过。 |
| `npm run check` | 清理陈旧编译输出后通过；602 项产品测试，596 项通过，六项平台相关跳过；1,247 项工具测试。 |
| `npm run docs:check` / 已注册内容测试 | 7,436 个链接零错误；37 项内容和示例测试通过。 |
| `git diff --check` | 无错误。 |

Linux x64 的无 `--ignore-scripts` 安装和候选包验证结果记录在 PR 描述中。本机无法执行 Windows `npx` 本身；原失败是缺失的 `cnoke.cjs` 生命周期目标，本地安装复现了同一生命周期路径。后续发布必须按产品／载荷改动处理，而不是复用维护性发布，因为内置清单字节有意不同。既有 [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) 六项平台缺口仍未验证。未进行付费模型调用。
