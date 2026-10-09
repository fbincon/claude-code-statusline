# 发布 GitHub、PyPI 与 Gitee Release

[English](RELEASING.md) | **简体中文**

本指南供维护者使用。用户安装请看[项目首页](../README.zh-CN.md#快速安装)，配置说明见[使用指南](USER_GUIDE.zh-CN.md)。当前稳定版为 [v1.8.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.8.0)，以下命令以该版本为例；发布其他版本时同步替换标签、包版本和文件名。

本地检查、已安装包 smoke 与显式启用的真实 Linux 计时验收命令见 [测试与验收](development/testing.zh-CN.md)。计时版本发布前，13 个平台/构建 CI 作业与真实计时验收必须通过。原始记录只留在忽略目录，如实记录被测源码、最终提交、实际 CI 链接及原生 duration/视觉验收边界。

## 原生编辑器发布门槛

正式 v1.8.0 默认请求启用外部 TUI 和会话内 Client，保留各自明确关闭偏好。外部入口需 2.1.258+，Client 需 2.1.287+；低版本或未知宿主分别暂挂，升级后重装恢复。四种安装组合与偏好规则见[使用指南](USER_GUIDE.zh-CN.md#编辑器安装组合与兼容性)。

维护者于 2026-10-04 确认 v1.3.0a2 的 Linux、Windows、macOS 真人验收通过。正式版沿用已验收 Client 交互；架构、终端和宿主详细版本未随确认提供，记为未知。自动 CI、PTY 与真人验收分别记录，见[验收状态](development/native.zh-CN.md#v130-验收状态)。

Phase 5 候选要求 PR、合并提交、标签的全部 13 个 Python/build 和十个固定 Mod job（Linux 2.1.287/2.1.288/2.1.289/2.1.294、Windows/macOS 2.1.288/2.1.289/2.1.294）通过。检查正式默认、主动关闭不反弹、版本门槛、升级/降级、四种组合与独立禁用。核心 smoke 显式选择基础接入，原生 smoke 另检查实际 marketplace、后端绑定、保存与卸载。安装后的 wheel 需通过真实 Linux 两入口 PTY。

从验证过的合并提交构建，核对 wheel/sdist、资源清单与独立重建，验证固定标签、草稿资产和 SHA256；标签 CI 通过后发布正式版并设为 Latest，核验公开下载和隔离安装。运行资源由唯一 Mod 源码打包，排除开发依赖、宿主声明和原始报告。原始证据仅留在忽略的 dist/validation。Python 包降级前先用新版 `install --no-native-editor` 移除原生接入。

显示项发布沿用已验收交互与安装策略，不运行付费模型/计时套件。涉及计时行为的发布仍需独立的计时验收门槛。

## 准备发布提交

### 维护双语文档

现有文档路径以英文为默认版本，完整简体中文版使用同目录的 `.zh-CN.md` 后缀。首页、使用指南、发布指南、变更记录和截图说明的修改应同步维护两种语言，包括语言切换和同语言链接；英文路径保留旧中文标题锚点。

仓库文档、语言切换、许可证、截图与页内导航使用相对链接。GitHub CI、Issues、项目元数据与源码安装命令继续保持 GitHub 主库身份。setuptools 元数据钩子将 README 链接转换为固定 GitHub 标签地址供 PyPI 使用，不修改源码 README；检查 wheel 与 sdist 长描述，并确认 sdist 保留原始 README。行内代码与代码块中的命令示例不参与通用链接转换。

完整双语 Release 正文保存在 `docs/releases/<tag>.md`，英文在前，原中文置于可展开区域，Release 标题使用英文。保留各版本当时的支持范围和验证结论；历史中文文档链接应明确标注语言。修改现有 Release 时只更新标题与正文，保留标签、附件、发布类型和 Latest 状态。

1. 从最新 `main` 创建 `fbincon/` 前缀的发布分支，同步 `pyproject.toml`、`src/claude_statusline/_version.py` 、Mod manifest 和 CLI 测试中的版本。
2. 在双语变更记录中添加版本和实际发布日期。README 安装与升级命令保持不依赖项目版本；固定版本示例放在使用与发布指南中更新。保留历史支持范围和 Release 记录。
3. 发布说明列明主要改动、平台和 Python 版本、配置兼容性、安装方式及当前限制，与[运行要求](USER_GUIDE.zh-CN.md#运行要求)一致。
4. 运行单元和集成测试、Ruff、文档链接及空白检查。测试使用临时 Claude 配置，覆盖安装、幂等重装、冲突回滚、配置、渲染、doctor 和卸载。
5. 通过 PR 合入 `main`，确认合并提交的完整 CI 通过。后续构建、标签和 Release 都指向该提交，不使用移动中的分支名代替提交号。

## 按提交构建分发包

在干净工作区中执行以下 Bash 命令（Linux / WSL / macOS）。`git archive` 只导出该提交的版本控制文件，避免本地缓存、旧构建文件或验收记录混入发布包；每次使用新的输出目录。

```bash
set -euo pipefail
git switch main
git pull --ff-only origin main
test -z "$(git status --porcelain)"

RELEASE_TAG=v1.8.0
RELEASE_COMMIT="$(git rev-parse HEAD)"
RELEASE_ROOT="$(pwd)/dist/release-$RELEASE_TAG"
RELEASE_SOURCE="$RELEASE_ROOT/source"
RELEASE_ASSETS="$RELEASE_ROOT/artifacts"
test ! -e "$RELEASE_ROOT"
mkdir -p "$RELEASE_SOURCE" "$RELEASE_ASSETS"
git archive "$RELEASE_COMMIT" | tar -x -C "$RELEASE_SOURCE"

python3 -m venv "$RELEASE_ROOT/build-env"
"$RELEASE_ROOT/build-env/bin/python" -m pip install build twine 'readme-renderer[md]'
"$RELEASE_ROOT/build-env/bin/python" -m build \
  --outdir "$RELEASE_ASSETS" "$RELEASE_SOURCE"
"$RELEASE_ROOT/build-env/bin/python" -m twine check --strict \
  "$RELEASE_ASSETS/"*.whl "$RELEASE_ASSETS/"*.tar.gz
```

`python -m build` 默认先构建源码包，再从该源码包构建 wheel。当前版本生成两个附件：

```text
fbincon_claude_code_statusline-1.8.0-py3-none-any.whl
fbincon_claude_code_statusline-1.8.0.tar.gz
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
sha256sum fbincon_claude_code_statusline-1.8.0-py3-none-any.whl \
  fbincon_claude_code_statusline-1.8.0.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
cd -
```

macOS 使用 `shasum -a 256` 生成清单，并用 `shasum -a 256 -c SHA256SUMS` 核验。Windows PowerShell 在附件目录执行：

```powershell
$releaseFiles = @(
    'fbincon_claude_code_statusline-1.8.0-py3-none-any.whl',
    'fbincon_claude_code_statusline-1.8.0.tar.gz'
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
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-1.8.0-py3-none-any.whl" \
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-1.8.0.tar.gz" \
  "$RELEASE_ASSETS/SHA256SUMS" \
  --repo fbincon/claude-code-statusline \
  --verify-tag --draft --title "$RELEASE_TAG" \
  --notes-file "$RELEASE_ROOT/release-notes.md"
```

先将实际发布说明写入上述 `release-notes.md`，保留真实换行。标签推送会触发 CI，也应全部通过。通过 `gh release download` 将草稿附件下载到新的目录，核验 SHA256SUMS 并与本地产物逐字节比较。GitHub 自动生成的 Source code ZIP/TAR 不能替代 wheel 附件。

## 正式发布与下载验证

公开 GitHub Release 前先完成 [TestPyPI 验收](#testpypi-验收)。公开操作自动触发正式 PyPI 工作流，使用相同 Release 附件，并要求 TestPyPI 运行成功、索引哈希一致；发布时不重新构建。

版本号不含预发布标识的稳定版设置为 Latest：

```bash
gh release edit "$RELEASE_TAG" --repo fbincon/claude-code-statusline \
  --draft=false --prerelease=false --latest
```

预发布版本应在创建草稿时增加 `--prerelease --latest=false`，正式公开时仍保持预发布设置，并使用 `--latest=false`。在 GitHub 网页操作时使用对应的 Draft、Pre-release 和 Latest 选项。

发布后完成以下验证：

1. 检查标签解析到构建提交，附件名称、大小、摘要和发布类型正确；确认[最新稳定版入口](https://github.com/fbincon/claude-code-statusline/releases/latest)指向本次稳定版。
2. 从公开下载 URL 重新下载三个附件，核验清单并与本地产物比较。
3. 等待全部九项正式发布任务，包括 Linux、Windows、macOS 的 Python 3.10/3.14 六项索引安装验证。在独立 pipx 目录中执行 README 的包名安装命令，检查版本并运行 CLI smoke；验证固定标签源码及源码包安装。
4. 检查带版本指南、变更记录及发布说明中的版本、日期、标签与附件 URL 一致。README 保留通用命令和迁移入口；检查其 PyPI 长描述、图片与文档链接。
5. 确认工作区干净，记录发布链接、提交号和 CI 结果。详细本地报告存放在忽略目录中，不加入安装包。

发布说明引用真实验证结果；CI 覆盖的平台版本、架构与 Python 版本从对应运行报告读取。终端截图用于展示，不代替真实睡眠恢复或多 Agent 生命周期验收。

相关文档：[pipx 安装来源](https://pipx.pypa.io/latest/reference/examples.html)、[GitHub 创建 Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[GitHub Release 链接规则](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)。

## 可信发布者配置

PyPI 分发名为 `fbincon-claude-code-statusline`；仓库、导入包、CLI、配置归属标记和可移植导出格式保持原身份。旧分发名在 PyPI 上属于另一个项目，已有安装见[迁移步骤](USER_GUIDE.zh-CN.md#迁移旧分发名称)。

分别注册 [PyPI](https://pypi.org/account/register/) 和 [TestPyPI](https://test.pypi.org/account/register/) 账号，验证邮箱并配置双因素认证。在各站账号 Publishing 页面添加 [GitHub 待生效发布者](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)：

| 字段 | 设置 |
| --- | --- |
| Project name | `fbincon-claude-code-statusline` |
| Owner / Repository | `fbincon` / `claude-code-statusline` |
| Workflow filename | `publish.yml` |
| Environment | 正式站 `pypi`，测试站 `testpypi` |

创建同名 GitHub Environment，并限制部署来源为 `v*` 版本标签。仅上传任务获得 `id-token: write`。GitHub 要求推送权限才能读取私有草稿，因此独立下载任务使用短期 `contents: write` 令牌，仅执行标准库 API 读取、下载和哈希校验，不安装依赖或执行分发包代码；后续准备任务只读仓库与 Actions，验证主分支和标签 CI。上传任务仅下载已验证产物，不检出或构建源码。Actions 固定提交哈希，PyPA 生成发布证明，无需长期 PyPI Token。待生效发布者不预留包名，首次上传前再次核验名称。

## TestPyPI 验收

主分支与标签 CI 全部通过，草稿恰好包含带版本的 wheel、源码包和 `SHA256SUMS` 后，在对应标签触发：

```bash
gh workflow run publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" -f tag="$RELEASE_TAG"
gh run list --repo fbincon/claude-code-statusline --workflow publish.yml \
  --branch "$RELEASE_TAG" --event workflow_dispatch --limit 1
```

核对返回的运行记录，等待全部九项任务成功；使用 `main` 作为运行引用会被拒绝。校验工具检查标签提交位于主分支、主分支与标签各自通过 13 项 Python/build 与十项 Mod CI、准确文件名、SHA256、元数据、CLI 身份、资源和严格长描述渲染，再将两个分发包上传 TestPyPI。

六项索引任务匿名下载两个包，与已验证 Release 附件比较哈希和字节，安装准确的 wheel，并执行隔离 CLI／配置 smoke。Windows 依赖从正常 PyPI 解析。正式发布要求 TestPyPI 成功运行对应相同标签和提交；原始证据留在忽略目录或 Actions 产物中。

刚上传版本可能在索引缓存更新时短暂返回 404 或不完整文件列表。索引核验仅对这些读取状态每五秒重试，最多三分钟；权限错误、身份不符、哈希冲突与额外文件立即拒绝。轮询不会重复发布。

失败时保留草稿并排查失败门槛。重跑会先比较已上传文件，仅跳过一致文件、上传缺失文件；哈希冲突或额外文件会停止发布。修复账号、发布者设置或暂时性故障后重跑，保留原版本标签和已发布附件。正式发布后按下文 Gitee 流程同步相同三个附件。

## Gitee 代码与 Release 同步

[GitHub](https://github.com/fbincon/claude-code-statusline) 是日常开发 PR、合并、CI 和发布的主库，[Gitee](https://gitee.com/fbincon/claude-code-statusline) 是公开同步库。同步随维护任务执行，不使用自动 CI 镜像。保留 GitHub 的 `origin` 和 `main` 上游，首次配置时单独添加 SSH 远程：

```bash
git remote add gitee git@gitee.com:fbincon/claude-code-statusline.git
```

同步前检查 `git remote -v`、当前分支和远程引用。获取已验证的 GitHub `main`，确认所需 CI 通过，再用显式 refspec 将相同提交推送到 Gitee `main`。逐个推送 GitHub 已有版本标签，不重新创建标签。例如，本地 `main` 已更新到通过验证的 GitHub 提交后：

```bash
git push gitee main:refs/heads/main
git push gitee refs/tags/v1.8.0:refs/tags/v1.8.0
```

核对两平台 `main` 和标签对象 ID 完全一致，保留带注释标签及其目标提交。历史功能分支仅按需推送。引用出现分叉时先排查，日常同步不得强推或使用 `git push --mirror`。Gitee PR 验收使用临时目标分支和功能分支，确认合并后仅删除这些分支并保留 PR 记录。

Git 推送不会复制 Release 元数据与附件。GitHub 发行版发布并验证后，通过 [Gitee 官方 MCP](https://gitee.com/oschina/mcp-gitee) 创建同版本 Release，沿用固定标签、提交、英文标题、双语说明和预发布状态，并在 Gitee 说明中补充已验证的 Gitee 下载链接。发布状态按 Gitee 实际 API 能力处理。创建 Release 的工具不能替代附件上传：使用[官方 Release 附件 API](https://gitee.com/api/v5/swagger) 的 `POST /repos/{owner}/{repo}/releases/{release_id}/attach_files` 上传原始 wheel、源码包及 `SHA256SUMS`。

将 GitHub 已发布的原始附件下载到新的目录并先验证，再上传到 Gitee。Gitee 上已有同版本 Release 时复用匹配的元数据与附件，仅上传缺失文件；存在内容冲突时停止。上传后匿名重新下载 Gitee 的三个附件，核对名称、大小、SHA256，并与 GitHub 原件逐字节比较。通过后记录 Gitee Release 地址与固定提交，保留 GitHub 的真实验证结论和支持边界。

### 生成平台适配说明

修改现有 Gitee 说明前，将完整 Release JSON（含正文、标签、预发布状态与附件清单）保存至忽略的验收目录。以当前 GitHub 公开发行版 JSON 为权威来源；检出目录中的历史说明可能早于最终公开验证记录。保留 GitHub 标题／正文、历史标签对象和软件包字节。

对应 Gitee Release 及已验证附件就绪后，导出当前 Gitee 发行版集合（包含全部分页），在本地生成：

```bash
python tools/render_gitee_release.py \
  --tag "$RELEASE_TAG" \
  --github-release-json "$RELEASE_ROOT/github-release.json" \
  --gitee-releases-json "$RELEASE_ROOT/gitee-releases.json" \
  --output "$RELEASE_ROOT/gitee-notes.md"
```

从已验证的当前 main 分支运行生成器。它不发起网络请求或平台写入，使用实际附件地址并保留各版本分发名。相对文档地址以 `docs/releases/<tag>.md` 为基准；显式分支／标签引用保留原含义。即使浏览器／curl 下载正常，Gitee 也可能对 pip／pipx 直接 URL 请求返回 HTTP 403，因此 wheel 说明先链接至 Gitee 附件，要求下载并核验校验和后，在下载目录安装本地 wheel。源码引用、GitHub Actions、Issues 与原始发布来源保留原含义。附件缺失／重复、标签或包身份不符、预发布属性冲突时，在写入输出前停止。

检查 Markdown，与权威来源和快照对比，核验文档目标与安装命令，再通过官方 MCP/API 仅更新 Gitee 正文。MCP 缺少的发行版更新能力使用 `PATCH /repos/{owner}/{repo}/releases/{release_id}`，字段以表单编码提交。更新后重新读取，确认标签、预发布属性及附件清单未变。重复同步仍从 GitHub 重新生成，附录不会累积；仅说明更新需要回滚时恢复已保存正文。网页导航与 API／附件检查分别记录；遇到验证码时，由用户完成后继续网页验收。

认证配置保存在维护者本机：使用专用 Gitee SSH 身份和系统密钥环保存的私人令牌。Codex 可通过 `http_headers_helper` 提供 MCP 认证头，附件客户端在进程内读取同一密钥环条目。不得把令牌写入仓库、文档、URL、命令参数或日志。版本控制使用标准 `git`，Gitee 平台操作使用 MCP/API；`gh` 继续用于 GitHub。

<a id="v130-预览推进"></a>

## v1.3.0 正式晋升

v1.3.0a2 已获三平台真人验收确认。正式版 Python/Mod 均为 1.3.0，两个入口默认启用并独立降级；缺失历史偏好遵循正式默认，明确 false 保持关闭。更新当前用户安装链接和说明；历史预览标签、资产、发布状态与当时记录保留。新建 v1.3.0 Release，设置 prerelease=false、latest=true，通过上述完整验证后发布。

## v1.4.0 显示项发布

本版新增默认关闭的目录项，沿用既有 Client 交互与安装策略。要求固定时钟过期、缺失／零值、原始 token／作用域、完整编辑器／预览与延迟采集检查；保留三平台 CI，检查并独立重建包，运行已安装 wheel 的 Linux PTY，并目视检查扩展目录。继续说明 macOS 输入限制，自动／Agent 目视检查与历史真人验收分开记录。新多行布局和运行时计时变更另需相应额外验收。

## Phase 4 预览与正式晋升

v1.5.0a1 已从 `b7181a6` 公开验证。2026-10-05，维护者确认 Phase 4 在 Linux、Windows，以及 macOS 的独立 TUI／CLI 入口人工验收通过；未提供具体 OS、架构、终端和宿主版本。本次确认不表示此前 macOS 会话内 Client 输入问题已修复。 正式 Python／Mod 均为 1.5.0，兼容宿主默认启用两入口，保留明确 false；显示 schema v3、协议 v2 与已验收交互保持一致。历史预览标签／资产／发布状态及截图文件名保留。

PR、合并提交、标签均须通过全部 18 项 CI（13 项 Python／构建、5 项固定 Mod）。从固定已验证合并提交构建，运行安装后高级 Linux PTY、独立 wheel／sdist／重建验证，核对草稿 SHA256／字节，再以 prerelease=false、latest=true 发布并检查公开下载／URL 安装。本次版本／默认值晋升不运行付费模型／计时套件；公开正式验证成功后记录 Phase 4 完成。

## Phase 5 预览与晋升

PR、合并提交和标签的全部 20 项 CI（13 项 Python／构建、7 项固定 Mod）通过后，以 prerelease、latest=false 发布 v1.6.0a1。从已验证固定合并提交构建，检查双 Mod 清单、独立重建／安装 wheel 和 sdist、安装 wheel 的 120x30／80x48 PTY、草稿资产／SHA256 及公开 URL 安装。所有真实模型探测和重试保留原有共享 10 美元账本，费用未知预留整次额度，耗尽即停止；要求可靠的单代理／并行／主线程收尾请求和冻结时长证据。

预览和正式版均保持独立实时采集默认关闭。受影响的真实运行会话／平台验收记录齐备后，再通过独立评审 PR 和固定资产晋升 v1.6.0；保留条件性指标不可用及 macOS Client 输入限制。历史编辑器人工确认不能替代新采集验收；证据不足时保留完整预览并准确记录缺口。

2026-10-05，维护者确认 v1.6.0a1 在 Linux、Windows、macOS 验收通过，并要求正式晋升；未提供具体 OS、架构、终端和宿主版本。Python 和两 Mod 同步到 1.6.0，采用正式编辑器默认行为，保留明确 false 及独立实时采集偏好。显示 v4／配置协议 v3／运行协议 v1 沿用已验收 a1 实现。本次版本／默认行为晋升重验升级与默认路径、全部 20 项 PR／合并／标签 CI、固定合并资产、独立重建／安装、安装 wheel 的 PTY 及草稿／公开验证，无需重复付费模型调用；免费重验捕获运行记录并保留原预算账本。新建正式 Latest，保留 a1 标签／资产／预览状态及已知 macOS Client 输入限制。公开正式版验证完成后才记录 Phase 5 完成。

## v1.6.1 外部 TUI 层级补丁

本补丁改进外部 curses 页面与按用途分组；显示 v4、配置协议 v3、运行协议 v1 及默认接入偏好继续兼容，Python 和两个 Mod 同步版本。验证分组后的字段映射、标题不可选中、滚动、缩放、Unicode、数值／文本编辑、保存与取消。安装 wheel 的独立 PTY 覆盖 64×18、64×20、80×24、120×30、80×48；官方双入口持久高级 PTY 继续覆盖 120×30／80×48 和配置互读。

全部 20 项 PR／合并／标签 CI、固定合并构建、清单检查、独立重建与安装、v1.6.0 升级、草稿／公开下载和 SHA256 必须通过。截图标注源提交、样例数据和捕获重建来源；代理视觉检查与真人验收分别记录。沿用已有运行实现，本轮使用免费测试与本地命令。发布新的 v1.6.1 Latest，保留历史标签、资产和记录。

## 任务计时预览发布门槛

v1.7.0a1 保留稳定安装入口，以 prerelease 和 `--latest=false` 发布。PR／合并／标签的 20 项检查全部通过，从已核验的固定合并 SHA 构建。Python 为 `1.7.0a1`，两个 Mod 对应 SemVer `1.7.0-alpha.1`。

每次真实尝试及重试均使用既有共享 10 美元账本。验收脚本覆盖默认原生计时、并行报告／收尾、阻止 Stop 后续跑、受控 SDK 等待／中断及显式关闭；见[任务计时验证](development/testing.zh-CN.md#任务计时预览验证)。必需案例失败、费用未知或预算耗尽时停止发布。对安装后的分发包复核既有证据，无需再次调用模型。

发布前完成核心／编辑器／运行采集安装 smoke、匹配 wheel 的外部及 Client PTY、分发清单、独立重建／安装、草稿下载／校验及标签 CI；公开后核对资产字节与固定标签／URL 隔离安装。SDK 自动输入与真人交互分开，真实睡眠和 Windows/macOS 模型会话作为明确预览边界保留。

## v1.7.0 正式晋升

2026-10-07，维护者确认 v1.7.0a1 已在 Linux、macOS、Windows 完成验证，并要求发布稳定 Latest。本次确认未提供具体 OS、架构、终端或宿主版本，也未单独提供硬件睡眠／恢复记录；保留预览发布时的原始证据和此前平台故障排查说明。

Python 和两 Mod 晋升为 1.7.0，更新当前稳定安装／升级入口，沿用已验收计时实现及协议。正式编辑器默认请求启用两个兼容入口，保留已保存 false 和主动禁用插件。兼容宿主新安装默认开启原生计时元数据、高级指标关闭，已有运行选择继续独立保存。保留 a1 标签、资产、预览状态、截图及原 10 美元共享账本。

要求已审查 PR、固定合并提交和正式带注释标签各自全部 20 项 CI 通过；检查 wheel／sdist 和两个 Mod 清单，独立重建／安装，核验 a1 到正式版升级、已安装核心／原生／运行 smoke 和双编辑器 PTY，免费复核六个真实场景，不新增模型调用。公开前核验草稿字节／SHA256 和标签 CI；新正式 Release 设置 prerelease=false、latest=true，匿名公开下载及公开 wheel／固定标签 URL 隔离安装均通过后记录完成。

## v1.7.1 TUI 优化

本次补丁将 Client 标题移入框线，按实际分组／字段行数分页，集中 Layout 和格式详情分组，并统一两编辑器的快捷键样式。保留 h 展开宿主偏好与独立 Apply、配置与运行协议及安装默认行为。README 展示四页现有截图，原始 PNG 与来源记录保留。

运行完整本地检查及全部 20 项 PR／合并／标签 CI，验证隔离安装包的外部五尺寸 PTY、会话内持久高级 PTY、两个入口互读及 1.7.0 升级。固定合并提交构建、独立重建、包清单、草稿／公开 SHA256 和安装入口验证沿用本指南；不运行付费计时验收。自动化与画面检查不新增真人或其他平台终端验收记录。

## v1.7.2 Client 底部快捷键优化

验证青色 Configure Status Line 大标题、大写按键／小写说明、各页 Tab 优先、条件提示和完整组换行；Main/Subagents 顺序为 Tab、Space、选择、排序、Ctrl+E、搜索。普通字母兼容大小写，不改变输入文本及组合键；保留 32×12、选中字段、预览和共享分页预算，外部编辑器及配置／运行协议兼容。

要求本地完整检查、全部 20 项 PR／合并／标签 CI、已安装核心／原生／运行 smoke、两编辑器 PTY 和 1.7.1 升级。从验证后的固定合并提交构建，检查清单、独立重建／安装、草稿／公开资产、SHA256 和 URL 安装。原始捕获留在忽略目录，历史截图保留；README 维护使用说明和当前安装链接，更新记录放在 CHANGELOG 与 Release。门槛通过后发布 v1.7.2 正式 Latest，不运行付费模型／计时套件。

## v1.7.7 文档与诊断修正

验证 schema 成功及迁移提示随显示版本常量变化、兼容 v1–v4 文件的诊断不写入、旧草稿在加锁前拒绝。按源码核对当前双语目录数量、协议示例、采集默认值和计时说明，保留按版本记录的验收数据。提供的 21 张 PNG 保留原字节及哈希，被替换的 18 张图库图片保留来源。

要求本地检查及全部 20 项 PR／合并／标签 CI，固定合并清单与独立重建／安装、已安装核心／原生／运行 smoke、两编辑器 PTY 和 1.7.2 升级。交付前验证草稿／公开字节、SHA256、公开 wheel 与固定标签安装。Python 和两个 Mod 清单同步为 1.7.3，显示 v5、配置协议 v4、运行偏好 v2、运行协议 v2 兼容。

## v1.8.0 原生预览背景

验证立即记忆的 UI 浅色／深色底色与 Claude 主题独立、ANSI 终端色槽准确、存储失败恢复及取消时配置不变。要求 PR、合并与标签的全部 13 项 Python／构建和十项固定 Mod 检查、四组合 default／ANSI 捕获、隔离安装／升级、固定提交分发包、独立重建，以及草稿／公开附件、TestPyPI、PyPI 和 Gitee 哈希核验。

## v1.8.0 双语界面

检查共享资源键／占位符、Python／TypeScript 同步、schema v1 界面偏好的恢复／未来保护／并发，以及 CLI 帮助／错误翻译。配置协议 v5，显示维持 v5，运行维持 v2。验证两端即时切换、保留草稿／搜索／输入，取消／重开／升级／卸载保留语言；目录 JSON 与实际状态栏保持英文／规范原值。

运行完整本地检查、23 项 PR／合并／标签检查，安装后外部最低／常用视口及持久化原生语言／高级 PTY。检查重建图片，记录平台／宿主／源／调色板，区分代理画面检查、人类验收和复用器量化／直接 RGB。独立重建并安装 wheel／sdist，检查两种语言资源，验证 1.7.8 升级，以固定提交生成附件及 SHA256。完成 TestPyPI、稳定 Latest／PyPI 索引检查及 Gitee 同字节同步。本轮不运行付费模型／计时套件。见[翻译检查](development/i18n.zh-CN.md#校验修改)。
