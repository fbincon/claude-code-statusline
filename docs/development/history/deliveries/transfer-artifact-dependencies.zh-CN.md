# 传输 action 依赖固定

[English](transfer-artifact-dependencies.md) | **简体中文**

本次 2026-11-14 的 CI 维护交付刷新本地 transfer-artifact action 的依赖固定，以清除开放的 Dependabot 告警。本次交付不创建产品版本、标签、Release 或 npm 发布。

## 变更

| 领域 | 结果 |
| --- | --- |
| Action 依赖 | `@actions/artifact` 2.3.2 → 5.0.3；`@actions/http-client` 2.2.3 → 3.0.2；`yauzl` 保持 3.4.0。 |
| overrides | `undici` 6.29.1、`glob` 14.0.6、`fast-xml-parser` 5.12.1。 |
| Lockfile | 使用 Node 24.21.0 / npm 11.19.0 重新生成；234 个非根条目均解析到 registry 并带 sha512 完整性。 |
| 范围 | 未改 Action 运行时源码；未改 Dependabot 配置；未改产品。 |

## 源码身份

- 任务前基线：`fc454860`。
- 实现提交与最终 head 在 CI 后记录于 PR 描述。

## 验证与限制

| 检查 | 实际结果 |
| --- | --- |
| Lock 断言 | 通过：直接依赖、overrides、无 `@fastify/busboy`、已修复的 `undici`／`glob`／`minimatch`／`fast-xml-parser`、octokit 版本下限、registry／sha512。 |
| `bootstrap.mjs` 隔离安装/API 冒烟 | 通过：`DefaultArtifactClient.uploadArtifact`、内部 twirp client/util、`HttpClient`、`glob`、`undici`、`fast-xml-parser`。 |
| `npm audit --omit=dev` | 0 个漏洞。 |
| `npm run build` | 通过。 |
| `npm run actions:check` | 5 个文件、144 个引用、0 个错误。 |
| 定向 action/transfer 测试 | 54 个测试通过，0 个失败。 |
| `npm run docs:check` | 7,358 个链接，0 个错误。 |
| `git diff --check` | 通过。 |

范围化影响计划、PR CI 与传输探测证据记录于 PR 描述。本次未运行产品、安装、官方宿主、终端、物理或付费验收；该 CI 策略变更不改变产品行为。Action 变更会改变验收策略摘要；在新 Action 字节被接受前，主分支可能出现预期的 `actions/download-artifact` 回退。Dependabot 告警关闭取决于默认分支重新扫描。
