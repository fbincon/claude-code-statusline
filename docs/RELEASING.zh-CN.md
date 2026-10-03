# 发布 GitHub Release

[English](RELEASING.md) | **简体中文**

本指南供维护者使用。用户安装请看[项目首页](../README.zh-CN.md#快速安装)，配置说明见[使用指南](USER_GUIDE.zh-CN.md)。当前稳定版为 [v1.1.1](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.1.1)，以下命令以该版本为例；发布其他版本时同步替换标签、包版本和文件名。

本地检查、已安装包 smoke 与显式启用的真实 Linux 计时验收命令见 [测试与验收](development/testing.zh-CN.md)。计时版本发布前，13 个平台/构建 CI 作业与真实计时验收必须通过。原始记录只留在忽略目录，如实记录被测源码、最终提交、实际 CI 链接及原生 duration/视觉验收边界。

## 准备发布提交

### 维护双语文档

现有文档路径以英文为默认版本，完整简体中文版使用同目录的 `.zh-CN.md` 后缀。首页、使用指南、发布指南、变更记录和截图说明的修改应同步维护两种语言，包括语言切换和同语言链接；英文路径保留旧中文标题锚点。

完整双语 Release 正文保存在 `docs/releases/<tag>.md`，英文在前，原中文置于可展开区域，Release 标题使用英文。保留各版本当时的支持范围和验证结论；历史中文文档链接应明确标注语言。修改现有 Release 时只更新标题与正文，保留标签、附件、发布类型和 Latest 状态。

1. 从最新 `main` 创建 `fbincon/` 前缀的发布分支，同步 `pyproject.toml`、`src/claude_statusline/_version.py` 和 CLI 测试中的版本。
2. 将变更记录中的“未发布”改为实际发布日期。更新 README、使用指南中的稳定版本、安装与升级 URL，保留历史版本的支持范围；这些链接将在本次 Release 发布后生效。
3. 发布说明列明主要改动、平台和 Python 版本、配置兼容性、安装方式及实验功能边界，与[运行要求](USER_GUIDE.zh-CN.md#运行要求)一致。
4. 运行单元和集成测试、Ruff、文档链接及空白检查。测试使用临时 Claude 配置，覆盖安装、幂等重装、冲突回滚、配置、渲染、doctor 和卸载。
5. 通过 PR 合入 `main`，确认合并提交的完整 CI 通过。后续构建、标签和 Release 都指向该提交，不使用移动中的分支名代替提交号。

## 按提交构建分发包

在干净工作区中执行以下 Bash 命令（Linux / WSL / macOS）。`git archive` 只导出该提交的版本控制文件，避免本地缓存、旧构建文件或验收记录混入发布包；每次使用新的输出目录。

```bash
set -euo pipefail
git switch main
git pull --ff-only origin main
test -z "$(git status --porcelain)"

RELEASE_TAG=v1.1.1
RELEASE_COMMIT="$(git rev-parse HEAD)"
RELEASE_ROOT="$(pwd)/dist/release-$RELEASE_TAG"
RELEASE_SOURCE="$RELEASE_ROOT/source"
RELEASE_ASSETS="$RELEASE_ROOT/artifacts"
test ! -e "$RELEASE_ROOT"
mkdir -p "$RELEASE_SOURCE" "$RELEASE_ASSETS"
git archive "$RELEASE_COMMIT" | tar -x -C "$RELEASE_SOURCE"

python3 -m venv "$RELEASE_ROOT/build-env"
"$RELEASE_ROOT/build-env/bin/python" -m pip install build
"$RELEASE_ROOT/build-env/bin/python" -m build \
  --outdir "$RELEASE_ASSETS" "$RELEASE_SOURCE"
```

`python -m build` 默认先构建源码包，再从该源码包构建 wheel。当前版本生成两个附件：

```text
claude_code_statusline-1.1.1-py3-none-any.whl
claude_code_statusline-1.1.1.tar.gz
```

该纯 Python wheel 用于 Linux/WSL、Windows 和 macOS；`windows-curses` 仅在 Windows 安装。Windows 的基本构建命令见[从源码构建与安装](USER_GUIDE.zh-CN.md#从源码构建与安装)，发布时同样使用干净检出和独立输出目录。

上传前检查：

- wheel 的版本、平台分类和条件依赖正确，包含 `_platform.py`、`macos_terminal.py` 及两个 skill 模板。
- 源码包包含 README、变更记录、使用指南、发布指南和截图索引的中英文版本，以及双语 Release 正文、所有平台 PNG 和测试。wheel 元数据使用英文 README。
- 两种包均不包含 `docs/MACOS_VALIDATION.md`、`.DS_Store`、字节码或本地缓存。
- 将 wheel 安装到新虚拟环境，在非源码目录运行 `--version`；通过 `tools/ci_smoke.py` 验证已安装包。Linux/macOS 需要 tmux。
- 从源码包另行重建 wheel，核对包文件、元数据和入口，并完成隔离安装验证。

## 生成与核验校验文件

在附件目录只为本次 wheel 和源码包生成清单，不使用会选中旧文件的通配符。

Linux / WSL：

```bash
cd "$RELEASE_ASSETS"
sha256sum claude_code_statusline-1.1.1-py3-none-any.whl \
  claude_code_statusline-1.1.1.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
cd -
```

macOS 使用 `shasum -a 256` 生成清单，并用 `shasum -a 256 -c SHA256SUMS` 核验。Windows PowerShell 在附件目录执行：

```powershell
$releaseFiles = @(
    'claude_code_statusline-1.1.1-py3-none-any.whl',
    'claude_code_statusline-1.1.1.tar.gz'
)
$releaseFiles | ForEach-Object {
    $digest = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $_"
} | Set-Content -LiteralPath SHA256SUMS -Encoding ascii
```

清单使用 SHA-256、小写十六进制摘要、两个空格和不含目录的文件名，便于各平台核验。

## 创建标签与草稿 Release

确认 `RELEASE_COMMIT` 对应的全部 13 个 CI 任务通过，并确认同名远程标签和 Release 不存在。创建带注释标签，再创建包含三个附件的草稿；不要覆盖历史标签或附件。

```bash
git tag -a "$RELEASE_TAG" "$RELEASE_COMMIT" -m "Release $RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
gh release create "$RELEASE_TAG" \
  "$RELEASE_ASSETS/claude_code_statusline-1.1.1-py3-none-any.whl" \
  "$RELEASE_ASSETS/claude_code_statusline-1.1.1.tar.gz" \
  "$RELEASE_ASSETS/SHA256SUMS" \
  --repo fbincon/claude-code-statusline \
  --verify-tag --draft --title "$RELEASE_TAG" \
  --notes-file "$RELEASE_ROOT/release-notes.md"
```

先将实际发布说明写入上述 `release-notes.md`，保留真实换行。标签推送会触发 CI，也应全部通过。通过 `gh release download` 将草稿附件下载到新的目录，核验 SHA256SUMS 并与本地产物逐字节比较。GitHub 自动生成的 Source code ZIP/TAR 不能替代 wheel 附件。

## 正式发布与下载验证

版本号不含预发布标识的稳定版设置为 Latest：

```bash
gh release edit "$RELEASE_TAG" --repo fbincon/claude-code-statusline \
  --draft=false --prerelease=false --latest
```

预发布版本应在创建草稿时增加 `--prerelease --latest=false`，正式公开时仍保持预发布设置，并使用 `--latest=false`。在 GitHub 网页操作时使用对应的 Draft、Pre-release 和 Latest 选项。

发布后完成以下验证：

1. 检查标签解析到构建提交，附件名称、大小、摘要和发布类型正确；确认[最新稳定版入口](https://github.com/fbincon/claude-code-statusline/releases/latest)指向本次稳定版。
2. 从公开下载 URL 重新下载三个附件，核验清单并与本地产物比较。
3. 在独立的 pipx 目录中执行 README 的公开 wheel URL 安装命令，检查版本并运行 CLI smoke；验证固定标签源码及源码包也可安装。
4. 检查 README、使用指南、变更记录和发布说明中的版本、日期、标签、附件 URL 与相对链接一致。
5. 确认工作区干净，记录发布链接、提交号和 CI 结果。详细本地报告存放在忽略目录中，不加入安装包。

发布说明引用真实验证结果；CI 覆盖的平台版本、架构与 Python 版本从对应运行报告读取。终端截图用于展示，不代替真实睡眠恢复或多 Agent 生命周期验收。

相关文档：[pipx 安装来源](https://pipx.pypa.io/latest/reference/examples.html)、[GitHub 创建 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[GitHub Release 链接规则](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。
