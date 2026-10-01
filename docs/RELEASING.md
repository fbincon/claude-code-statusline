# 发布 GitHub Release

本指南供维护者使用，仓库地址为 <https://github.com/fbincon/claude-code-statusline>。

仓库公开后，用户就可以通过 README 中的 GitHub 源码命令安装。Release wheel 需要维护者先构建并上传；仅推送源码不会自动生成 wheel 下载附件。

## 1. 构建安装包

发布前确认要发布的改动已经提交，并让该提交的 Linux/Windows CI 通过。`pyproject.toml` 和 `src/claude_statusline/_version.py` 的版本应一致，并在 `CHANGELOG.md` 中记录该版本。

以下 Bash 命令在项目根目录执行：

```bash
python3 -m venv .venv-build
source .venv-build/bin/activate
python -m pip install --upgrade build
python -m build
```

当前 `1.0.0` 应生成：

```text
dist/claude_code_statusline-1.0.0-py3-none-any.whl
dist/claude_code_statusline-1.0.0.tar.gz
```

wheel 是用户的快速安装入口，源码包用于从源码构建。该 wheel 的 Windows 条件依赖由安装时的 Python 平台决定。同一份 wheel 可以用于本项目支持的 Linux/WSL 和 Windows 环境。

`.venv-build/` 和 `dist/` 已由 `.gitignore` 排除；把构建产物上传为 Release 附件即可。文档截图保留在仓库的 `docs/images/`，并随源码包一起提供。

## 2. 在 GitHub 创建 Release

1. 把要发布的提交推送到仓库，确认 GitHub Actions 中的 CI 通过。
2. 打开仓库的 **Releases** 页面，选择 **Draft a new release**。
3. 选择或创建 `v1.0.0` 标签，确保标签指向已经通过 CI 的发布提交。
4. 标题填写 `v1.0.0`，说明中写明支持平台、主要功能、安装方式及已知限制。
5. 在附件区域上传上面的 `.whl` 和 `.tar.gz` 两个文件，保留构建生成的文件名。
6. 准备好后点击 **Publish release**；如果希望作为测试版提供，可选择 **This is a pre-release**。

GitHub 自动生成的 Source code ZIP/TAR 与手动上传的 wheel 不同。要让用户免去本地构建，必须上传 `.whl` 附件。

## 3. 检查安装入口

发布正式版本后，README 中的 [最新 Release 入口](https://github.com/fbincon/claude-code-statusline/releases/latest) 应能打开发布页。对于预发布版本，可直接分享 [全部 Releases](https://github.com/fbincon/claude-code-statusline/releases) 中该版本的页面。

`v1.0.0` wheel 的固定下载地址是：

```text
https://github.com/fbincon/claude-code-statusline/releases/download/v1.0.0/claude_code_statusline-1.0.0-py3-none-any.whl
```

确认附件可以下载后，用户既可以按 README 下载文件后安装，也可以直接执行：

```text
pipx install "https://github.com/fbincon/claude-code-statusline/releases/download/v1.0.0/claude_code_statusline-1.0.0-py3-none-any.whl"
pipx ensurepath
```

对应的固定版本源码安装命令是：

```text
pipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.0.0"
pipx ensurepath
```

两种方式安装后都需要重新打开终端，再运行 `claude-statusline install --dry-run`、`claude-statusline install` 和 `claude-statusline doctor`。Windows 使用 `claude-statusline.exe`。

## 4. 更新版本

下一次发布时，同步更新包版本、`_version.py`、Changelog、CI 中的版本断言，以及 README 中的 wheel 文件名和版本示例，然后构建对应提交并创建新的版本标签。指向 Releases 页面的链接可以继续使用；固定版本下载地址必须保持标签和文件名匹配。

相关文档：[pipx 安装来源示例](https://pipx.pypa.io/latest/reference/examples.html)、[GitHub 创建 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[GitHub Release 链接规则](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。
