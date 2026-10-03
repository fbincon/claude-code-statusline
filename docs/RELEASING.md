# Publishing GitHub Releases

**English** | [简体中文](RELEASING.zh-CN.md)

<a id="发布-github-release"></a>

This guide is for maintainers. Users should start with [installation in the README](../README.md#quick-installation) and the [user guide](USER_GUIDE.md) for configuration. The current stable release is [v1.2.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.2.0); commands below use it as an example. Replace the tag, package version, and filenames together for another release.

<a id="准备发布提交"></a>

Use the commands in [testing and acceptance](development/testing.md) for local checks, installed-package smoke and opt-in real Linux timer evidence. All 13 platform/build CI jobs and real timer acceptance must pass before publishing a timer release. Preserve raw reports only in ignored directories; record tested source, final commit, actual CI links and native-duration/visual limitations honestly.

## Native editor release gates

Stable v1.2.0 prefers native integration on compatible hosts while preserving explicit disablement. The maintainer confirmed all three human checklists on the fixed v1.2.0a1 candidate: Linux, Windows 11 and macOS 14.5. Record missing architecture/terminal metadata as unknown; do not infer it from CI. See the [acceptance record](development/native.md#stable-acceptance-record).

Every candidate requires merged-commit Python/build checks, the four pinned native jobs (Linux 2.1.287/2.1.288, Windows/macOS 2.1.288), isolated wheel/sdist/rebuild and fixed-tag/public installation checks. Core smoke explicitly selects compatibility integration; native smoke separately checks stable defaults, migration and disablement. Build from the verified merge commit, verify tag/draft assets/SHA256, require tag CI, then publish stable v1.2.0 as Latest. Prereleases remain opt-in and never become Latest.

Runtime resources come from `mods/statusline-native` through `src/build_native.py`, with a generated hash/version/protocol inventory. Wheel and rebuilt sdist payloads must agree and exclude development dependencies, host declarations and raw reports. Raw evidence stays in ignored `dist/validation`; terminal capture reconstruction and human acceptance are distinct. Before a Python package downgrade, use the newer package's `install --no-native-editor`, then reinstall the old package.

## Prepare the release commit

### Maintain bilingual documentation

English is the default at existing documentation paths. Complete Simplified Chinese versions use the `.zh-CN.md` suffix in the same directory. Update both languages together, including README, user guide, release guide, changelog, and image index. Keep language switches and links within each language current; retain legacy Chinese heading anchors at the English paths.

Store complete bilingual Release bodies in `docs/releases/<tag>.md`, with English first and the original Chinese in an expandable section. Use an English Release title. Preserve version-specific support and validation claims; label links to historical Chinese documentation explicitly. When editing an existing Release, update only its title and body, preserving tags, assets, release type, and Latest selection.

1. Create a release branch from the latest `main` with the `fbincon/` prefix. Synchronize versions in `pyproject.toml`, `src/claude_statusline/_version.py`, and CLI tests.
2. Replace the changelog's Unreleased date with the actual release date. Update stable versions and installation/upgrade URLs in the README and user guide, preserving historical support boundaries. These links become available after publication.
3. Release notes should describe major changes, platforms and Python versions, configuration compatibility, installation, and experimental boundaries, consistent with [requirements](USER_GUIDE.md#requirements).
4. Run unit/integration tests, Ruff, documentation-link checks, and whitespace checks. Tests use temporary Claude configuration and cover installation, idempotent reinstall, conflict rollback, configuration, rendering, doctor, and uninstallation.
5. Merge through a PR and confirm complete CI passes on the merge commit. Builds, tags, and Releases must all refer to that commit; use its hash rather than a moving branch name.

<a id="按提交构建分发包"></a>

## Build distributions from a commit

Run these Bash commands in a clean workspace on Linux / WSL / macOS. `git archive` exports only version-controlled files from the specified commit, excluding local caches, old builds, and acceptance records. Use a fresh output directory each time.

```bash
set -euo pipefail
git switch main
git pull --ff-only origin main
test -z "$(git status --porcelain)"

RELEASE_TAG=v1.2.0
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

By default, `python -m build` builds the source distribution first, then builds the wheel from it. The current version produces two assets:

```text
claude_code_statusline-1.2.0-py3-none-any.whl
claude_code_statusline-1.2.0.tar.gz
```

This pure-Python wheel works on Linux/WSL, Windows, and macOS; `windows-curses` is installed only on Windows. See [building and installing from source](USER_GUIDE.md#build-and-install-from-source) for basic Windows build commands. Release builds also require a clean checkout and separate output directory.

Before uploading, check:

- Correct wheel version, platform classifiers, and conditional dependencies, with `_platform.py`, `macos_terminal.py`, and both skill templates included.
- Source distribution includes both languages of the README, changelog, user guide, release guide, and image index, plus bilingual Release bodies, all platform PNGs, and tests. Wheel metadata uses the English README.
- Neither distribution includes `docs/MACOS_VALIDATION.md`, `.DS_Store`, bytecode, or local caches.
- Install the wheel in a new virtual environment, run `--version` outside the source directory, and validate the installed package through `tools/ci_smoke.py`. Linux/macOS require tmux.
- Separately rebuild the wheel from the source distribution, compare package files, metadata, and entry points, and verify isolated installation.

<a id="生成与核验校验文件"></a>

## Generate and verify checksums

In the assets directory, create a manifest for only this release's wheel and source distribution. Avoid wildcards that might select old files.

Linux / WSL：

```bash
cd "$RELEASE_ASSETS"
sha256sum claude_code_statusline-1.2.0-py3-none-any.whl \
  claude_code_statusline-1.2.0.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
cd -
```

On macOS, generate with `shasum -a 256` and verify with `shasum -a 256 -c SHA256SUMS`. In Windows PowerShell, run in the assets directory:

```powershell
$releaseFiles = @(
    'claude_code_statusline-1.2.0-py3-none-any.whl',
    'claude_code_statusline-1.2.0.tar.gz'
)
$releaseFiles | ForEach-Object {
    $digest = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $_"
} | Set-Content -LiteralPath SHA256SUMS -Encoding ascii
```

Use SHA-256, lowercase hexadecimal digests, two spaces, and filenames without directories for cross-platform verification.

<a id="创建标签与草稿-release"></a>

## Create a tag and draft Release

Confirm all 13 CI jobs pass for `RELEASE_COMMIT`, and that the remote tag and Release do not already exist. Create an annotated tag and a draft with all three assets; never overwrite historical tags or assets.

```bash
git tag -a "$RELEASE_TAG" "$RELEASE_COMMIT" -m "Release $RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
gh release create "$RELEASE_TAG" \
  "$RELEASE_ASSETS/claude_code_statusline-1.2.0-py3-none-any.whl" \
  "$RELEASE_ASSETS/claude_code_statusline-1.2.0.tar.gz" \
  "$RELEASE_ASSETS/SHA256SUMS" \
  --repo fbincon/claude-code-statusline \
  --verify-tag --draft --title "$RELEASE_TAG" \
  --notes-file "$RELEASE_ROOT/release-notes.md"
```

Write the actual notes to `release-notes.md` above with real newlines first. Pushing the tag triggers CI, which must also pass. Download draft assets into a new directory with `gh release download`, verify SHA256SUMS, and compare bytes with local artifacts. GitHub's generated Source code ZIP/TAR is not a substitute for the wheel asset.

<a id="正式发布与下载验证"></a>

## Publish and verify downloads

Mark a stable version without a prerelease identifier as Latest:

```bash
gh release edit "$RELEASE_TAG" --repo fbincon/claude-code-statusline \
  --draft=false --prerelease=false --latest
```

For prereleases, add `--prerelease --latest=false` when creating the draft; retain prerelease status and `--latest=false` when publishing. In the GitHub web UI, use the equivalent Draft, Pre-release, and Latest settings.

After publication:

1. Check the tag resolves to the build commit and asset names, sizes, digests, and release type are correct. Confirm the [latest stable entry point](https://github.com/fbincon/claude-code-statusline/releases/latest) points to this stable release.
2. Redownload all three assets from public URLs, verify checksums, and compare them with local artifacts.
3. Run the README's public wheel URL installation command in independent pipx directories, check version, and run CLI smoke tests. Verify fixed-tag source and source-distribution installations as well.
4. Check version, date, tag, asset URLs, and relative links agree across README, user guide, changelog, and release notes.
5. Confirm a clean workspace and record release links, commit, and CI results. Keep detailed local reports in ignored directories outside distributions.

Release notes must cite actual validation results. Read CI-covered OS versions, architectures, and Python versions from the corresponding run reports. Terminal screenshots illustrate appearance; they do not replace real sleep/resume or multi-agent lifecycle acceptance.

Related documentation: [pipx installation sources](https://pipx.pypa.io/latest/reference/examples.html), [creating GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), and [Release linking rules](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).
