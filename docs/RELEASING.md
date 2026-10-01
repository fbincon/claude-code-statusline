# 发布 GitHub Release

本指南供维护者使用。用户安装请看[项目首页](../README.md#快速安装)，完整配置说明见[使用指南](USER_GUIDE.md)。

仓库已公开。稳定版 [v1.0.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.0.0) 支持 Linux/WSL 与 Windows；[v1.1.0a1](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.1.0a1) 是包含 macOS 支持的预发布。两者分别提供 wheel、源码包和 `SHA256SUMS`，不覆盖已有版本的标签或附件。下文以 1.1.0a1 为例。

Release wheel 由维护者构建并上传；推送源码会触发 CI，但不会自动生成 Release 附件。

## 1. 构建安装包

发布前确认要发布的改动已经提交，并让该提交的 Linux/Windows/macOS CI 通过。`pyproject.toml` 和 `src/claude_statusline/_version.py` 的版本应一致，并在 [CHANGELOG.md](../CHANGELOG.md) 中记录该版本。

在干净的发布工作目录中构建，避免把不同版本的产物混在一起。以下 Bash 命令在项目根目录执行：

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
```

以 `1.1.0a1` 为例，构建生成：

```text
dist/claude_code_statusline-1.1.0a1-py3-none-any.whl
dist/claude_code_statusline-1.1.0a1.tar.gz
```

wheel 是用户的快速安装入口，源码包用于从源码构建。该纯 Python wheel 共用于 Linux/WSL、Windows 与 macOS；Windows 条件依赖由安装时的 Python 平台决定。v1.1.0a1 的 macOS 支持仍为预览：实际 Claude 视觉效果、真实睡眠恢复与桌面终端体验尚未人工验收。

`.venv-build/` 和 `dist/` 已由 `.gitignore` 排除。检查源码包包含 `docs/USER_GUIDE.md`、`docs/RELEASING.md` 和 `docs/images/` 截图；检查 wheel 包含平台模块及两个 skill 模板。检查方法见[开发与测试](USER_GUIDE.md#附录开发与测试)。

在 `dist/` 目录生成校验文件（Bash；使用本次发布的实际文件名）：

```bash
cd dist
sha256sum claude_code_statusline-1.1.0a1-py3-none-any.whl claude_code_statusline-1.1.0a1.tar.gz > SHA256SUMS
cd ..
```

macOS 可将 `sha256sum` 替换为 `shasum -a 256`。发布前在隔离虚拟环境中安装构建出的 wheel，确认 CLI 版本、配置事务与渲染 smoke；从源码包再构建 wheel，检查版本、条件依赖及资源。

## 2. 在 GitHub 创建 Release

1. 把要发布的提交推送到仓库，确认 GitHub Actions 中的 CI 通过。
2. 打开仓库的 **Releases** 页面，选择 **Draft a new release**。
3. 创建本次发布的新版本标签（命名格式为 `v<版本号>`），确保标签指向已经通过 CI 的发布提交。
4. 标题填写该标签，说明中写明支持平台、主要功能、安装方式及已知限制。
5. 在附件区域上传本次构建的 `.whl`、`.tar.gz` 和 `SHA256SUMS`，保留构建生成的文件名。
6. 对 v1.1.0a1 选择 **This is a pre-release**，确认附件齐全后点击 **Publish release**。使用 GitHub CLI 时明确传入 `--prerelease --latest=false`，保留最新稳定版入口。

GitHub 自动生成的 Source code ZIP/TAR 与手动上传的 wheel 不同。要让用户免去本地构建，必须上传 `.whl` 附件。

## 3. 检查安装入口

发布正式版本后，检查[最新 Release 入口](https://github.com/fbincon/claude-code-statusline/releases/latest)、README 和使用指南中的固定版本链接。预发布版本直接检查其 Release 页面，下载全部附件并验证 `SHA256SUMS`，确认安装链接可用；v1.1.0a1 发布后，最新稳定版入口应继续指向 v1.0.0。

`v1.1.0a1` wheel 的固定下载地址是：

```text
https://github.com/fbincon/claude-code-statusline/releases/download/v1.1.0a1/claude_code_statusline-1.1.0a1-py3-none-any.whl
```

确认附件可以下载后，用户既可以按 README 下载文件后安装，也可以直接执行：

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.1.0a1/claude_code_statusline-1.1.0a1-py3-none-any.whl"
pipx ensurepath
```

对应的固定版本源码安装命令是：

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.1.0a1"
pipx ensurepath
```

两种方式安装后都需要重新打开终端，再运行 `claude-statusline install --dry-run`、`claude-statusline install` 和 `claude-statusline doctor`。Windows 使用 `claude-statusline.exe`。

## 4. 更新版本

下一次发布时，同步更新包版本、`_version.py`、变更记录、CI 中的版本断言，以及 README、使用指南和本发布指南中的 wheel 文件名、标签和安装/升级示例。检查文档相对链接与目录锚点，并确认打包清单包含当前文档，再构建对应提交、生成校验文件并创建新版本标签。指向 Releases 页面的链接可以继续使用；固定版本下载地址必须保持标签和文件名匹配。

相关文档：[pipx 安装来源示例](https://pipx.pypa.io/latest/reference/examples.html)、[GitHub 创建 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[GitHub Release 链接规则](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。
