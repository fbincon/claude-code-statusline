# 发布 GitHub Release

本指南供维护者使用。用户安装请看[项目首页](../README.md#快速安装)，配置说明见[使用指南](USER_GUIDE.md)。

当前源码版本为 **1.1.0（未发布）**。已发布的 [v1.0.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.0.0) 支持 Linux/WSL 与 Windows，[v1.1.0a1](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.1.0a1) 提供此前的 macOS 预览实现。版本准备和本地提交不代表已创建远程标签、Release 或附件。

## 发布前检查

- 包元数据、CLI 版本、变更记录和 CI 版本断言一致；1.1.0 发布前将变更记录中的“未发布”改为实际发布日期。
- 对准备发布的提交执行 Linux、Windows、macOS CI，确认该提交的检查通过。
- 发布说明应与[运行要求](USER_GUIDE.md#运行要求)一致，列明平台、Python 版本与实验性启动器范围。
- 在隔离环境中验证安装、幂等重装、冲突回滚、配置、渲染、doctor 和卸载，自动测试使用临时 Claude 配置。

## 构建与检查分发包

在包含待发布改动的干净工作目录中构建。以下命令用于 Linux / WSL / macOS；Windows 的等价命令见[从源码构建与安装](USER_GUIDE.md#从源码构建与安装)。

```bash
python3 -m venv .venv-build
.venv-build/bin/python -m pip install build
.venv-build/bin/python -m build
```

当前版本生成：

```text
dist/claude_code_statusline-1.1.0-py3-none-any.whl
dist/claude_code_statusline-1.1.0.tar.gz
```

该纯 Python wheel 用于 Linux/WSL、Windows 和 macOS；`windows-curses` 仅在 Windows 安装。wheel 应包含平台适配模块、Terminal 辅助模块及两个 skill 模板。源码包还应包含当前文档、截图及测试。检查完整性后，从源码包重建 wheel，再在新虚拟环境中安装和执行 smoke。

构建目录和虚拟环境已由 `.gitignore` 排除。上传本次生成的版本文件，避免混入旧产物。

macOS 在 `dist/` 中生成校验文件：

```bash
cd dist
shasum -a 256 claude_code_statusline-1.1.0-py3-none-any.whl claude_code_statusline-1.1.0.tar.gz > SHA256SUMS
cd ..
```

Linux / WSL 使用 `sha256sum`；Windows 使用 `Get-FileHash -Algorithm SHA256` 并生成对应的文件名/摘要清单。上传前再次核对附件摘要。

## 实际发布

在准备发布且待发布提交的验证已通过时，执行以下步骤。

1. 将要发布的提交推送到仓库，并确认该提交的完整 CI 通过。
2. 在 **Releases → Draft a new release** 中新建 `v1.1.0` 标签，指向经过验证的提交；标题使用同一标签。
3. 说明中写明平台范围、主要改动、安装方式及验证边界。
4. 上传本次构建的 wheel、源码包和 `SHA256SUMS`。GitHub 自动生成的 Source code ZIP/TAR 不能替代 wheel 附件。
5. 正式版本使用正式 Release 设置；预发布版本明确勾选 **This is a pre-release**。使用 GitHub CLI 发布预览时传入 `--prerelease --latest=false`。
6. 发布后下载附件，核验摘要、版本和隔离安装，确认[最新稳定版入口](https://github.com/fbincon/claude-code-statusline/releases/latest)符合发布类型。

## 同步用户安装入口

只有在远程标签和附件实际可用后，才将 README 和使用指南的当前本地安装步骤替换为该 Release 的真实 URL。标签、文件名和包版本必须一致；历史 v1.0.0 / v1.1.0a1 说明保留各自的支持范围。

检查相对文件链接、目录锚点、安装/升级/卸载命令和文档打包清单，再通过隔离 smoke 确认公开示例可执行。后续发布重复上述流程，不覆盖历史标签或附件。

相关文档：[pipx 安装来源](https://pipx.pypa.io/latest/reference/examples.html)、[GitHub 创建 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[GitHub Release 链接规则](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。
