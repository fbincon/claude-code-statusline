# Publishing npm, GitHub and Gitee Releases

**English** | [简体中文](RELEASING.zh-CN.md)

## TypeScript stable publication

v3.0.0 uses the public npm package `@fbincon/claude-code-statusline`, npm `latest`, stable GitHub/Gitee Releases and GitHub Latest. The [TS-06 decision](development/typescript-migration/ts-06/README.md#stable-decision-2026-10-18) accepts the listed known gaps for this version only; it does not pass those checks or relax functional acceptance. Preserve the existing beta selector and published artifacts.

1. Use Node 24.21.0/npm 11.19.0. Complete `npm run check`, review a PR and require all final-head and merge CI jobs. `release:build` selects preview/stable from the application version; an explicit mismatched channel is rejected.
2. Build from the immutable merge SHA with `npm run release:build -- --commit FULL_SHA --output NEW_DIRECTORY`. Require two byte-identical builds, matching source/Mod/application identities and `release:verify -- --artifact ABSOLUTE_TGZ --commit FULL_SHA`. Rebuild from the delivered source with `--source ABSOLUTE_SOURCE_TAR_GZ` in a separate new output directory.
3. Require eight installed targets and thirteen fixed hosts. Run `release:prepare -- --stable --artifact ABSOLUTE_TGZ --commit FULL_SHA --evidence DIRECTORY --report NEW_FILE`. Stable readiness also reads the v3.0.0 approval from the verified source archive and records its digest and unverified scope. Missing, failed, skipped, duplicate or mismatched automated receipts still fail. No paid calls or new physical acceptance are implied.
4. Create the annotated `v3.0.0` tag at that SHA and require tag CI. Create a GitHub draft **stable** Release. Upload exactly the package tgz, source tar.gz, `build-manifest.json` and `SHA256SUMS`; download and verify the draft bundle, installed smoke and installed TUI. Render relative links from `docs/releases/v3.0.0.md` to fixed-tag URLs with `tools/release/markdown.ts`.
5. Verify npm account/namespace access and use its official login/2FA flow when required. Publish the verified tgz from outside the checkout using `npm publish ABSOLUTE_TGZ --registry=https://registry.npmjs.org/ --access public --tag latest --ignore-scripts`. Do not repack. Wait for public metadata, compare SHA-512 integrity and tgz bytes, require `latest=3.0.0`, and retain `beta=3.0.0-beta.1`.
6. Publish GitHub as stable/Latest. The **Release public downloads** workflow verifies the four attachments and both exact-version and `latest` installations on Linux, Windows and macOS. Manual dispatch takes the exact tag; reports distinguish release and verifier commits. `release:downloads -- --tag v3.0.0 --commit FULL_SHA --output NEW_DIRECTORY` performs the same read-only checks.
7. Inspect divergence, then synchronize validated `main` and the exact tag to the existing Gitee SSH remote with explicit refspecs. Use official Gitee MCP to create the stable Release, and the keyring-backed official API helper for attachments. Upload the identical four files, render notes against actual attachment metadata, and redownload/check every digest.
8. Record actual checks, release identity and public-channel results through a follow-up PR; synchronize the validated evidence commit and update issue #96. Mark TS-06 DONE only after all channels and download checks pass. Keep raw logs, receipts and machine paths under ignored validation directories.

Inspect remote state before retrying an ambiguous result. Public package versions, tags and asset bytes remain immutable; any functional failure blocks publication, and a partially successful channel is not completed delivery. No PyPI upload occurs. The first-preview procedure below is historical; its original stable blockers are superseded only by the version-limited decision above.

## Historical TypeScript preview publication

Use the [preview guide](PREVIEW.md) and [TS-06 gates](development/typescript-migration/ts-06/README.md). GitHub is primary. The first preview is v3.0.0-beta.1; npm identity is @fbincon/claude-code-statusline. Missing physical/desktop evidence blocks stable delivery, not this explicitly approved preview. Both editors default on, preserving opt-outs.

1. Use pinned Node 24.21.0/npm 11.19.0. Run `npm run check`; review and merge through a PR with complete final-head and merge CI. Never change the Python archive or existing published tags/assets.
2. From the fixed merge SHA run `npm run release:build -- --commit FULL_SHA --output NEW_DIRECTORY`. This exports tracked bytes and independently builds twice. `candidate:build` retains private engineering mode. `release:verify -- --artifact ABSOLUTE_TGZ --commit FULL_SHA` requires the public package and all four deterministic assets, including the rebuildable source archive. Rebuild without Git history using `release:build -- --commit FULL_SHA --source ABSOLUTE_SOURCE_TAR_GZ --output NEW_DIRECTORY`.
3. CI distributes one public-shape artifact to eight installation targets and thirteen fixed hosts. `release:prepare -- --preview --artifact ABSOLUTE_TGZ --commit FULL_SHA --evidence DIRECTORY --report NEW_FILE` rejects missing, failed, skipped, duplicate or mismatched receipts. It reports preview readiness, never stable readiness. No paid calls or fabricated physical evidence are allowed.
4. Create an annotated v3.0.0-beta.1 tag at that verified commit, push its exact ref and require tag CI. Create a GitHub **draft prerelease** with `--latest=false`. Upload only the package tgz, source tar.gz, build-manifest.json and SHA256SUMS from that commit. Download the draft, verify checksums and isolated installation. Logs and machine paths are not Release assets. Before uploading the bilingual Release body, resolve repository-relative documentation and image links from `docs/releases/<tag>.md` to fixed-tag GitHub blob/raw URLs with the helpers in `tools/release/markdown.ts`; preserve external issue/CI links and code examples. The GitHub Release page does not resolve links from the source file directory.
5. The maintainer completes official npm login/2FA as fbincon. Verify identity/namespace access. From outside the development workspace run `npm publish ABSOLUTE_TGZ --registry=https://registry.npmjs.org/ --access public --tag beta --ignore-scripts`. Publish the already-verified tarball, without repacking. No npm credentials belong in this repository, logs or chat. Check package metadata, tarball integrity, beta and latest before proceeding; preview must not become latest.
6. Publish the GitHub prerelease without Latest; Python v2.0.0 retains Latest. The public-download workflow verifies GitHub/npm bytes plus exact-version and beta installations on Linux/Windows/macOS. It can also be dispatched for the exact tag from a selected verifier branch; receipts record verifier and release commits separately. A verifier-only correction does not replace published assets or move the tag. Its checks are read-only; publication requires the separately authenticated maintainer.
7. Inspect divergence, then push validated main and the exact tag to the existing Gitee SSH remote with explicit refspecs. Use official Gitee MCP for the prerelease and the official API for attachment uploads. Use the existing keyring-backed administrative client; never export credentials. Upload the same four assets, render notes using actual attachment metadata, confirm prerelease status and redownload/check all hashes. Preserve GitHub primary issue/CI links.
8. Record public download evidence, tag/source/checksums and actual CI URLs through a follow-up PR. Keep raw output ignored. Update the tracking issue. TS-06 remains in progress until stable gates pass.

A successful npm command can precede public availability. Wait for registry validation and public metadata before starting download acceptance; the authenticated [exact-version status endpoint](https://api-docs.npmjs.com/#tag/Packages) distinguishes lifecycle progress. Inspect the first publication's dist-tags explicitly. For this first preview, the registry created a `0.0.0-stage` placeholder and assigned `latest` to the preview despite `--tag beta`; deleting `latest` returned HTTP 400. Keep the preview on `beta` and direct `latest` to the registry placeholder until a real npm stable version is delivered. The placeholder is not an installable statusline product: users must select `@beta` or the exact preview version. Never replace an existing real stable version's `latest` with a placeholder. Any tag correction can require a separate official 2FA verification.

On an ambiguous upload/publish result, inspect remote metadata and bytes before retrying. Do not overwrite a public npm version or a published Release asset. Fixes use the next beta; a partially successful channel is not a completed release. The registry verification command is `npm run release:downloads -- --commit FULL_SHA --output NEW_DIRECTORY` and requires an already published GitHub/npm preview. The source-bound test harness retains only explicitly whitelisted version metadata changes against the frozen Python oracle.

## Archived Python publication procedure

The following preserves the published Python product and its historical procedure from the [pre-archive source](https://github.com/fbincon/claude-code-statusline/tree/38ff85b75c936201764c64f80b8fff96f091e176). The old PyPI workflow lives in archive/python/workflows. These wheel/PyPI commands do not apply to current main; published fixed tags retain their original procedures.

<a id="发布-github-release"></a>

This guide is for maintainers. Users should start with [installation in the README](../README.md#quick-installation) and the [user guide](USER_GUIDE.md) for configuration. The current stable release is [v2.0.0](https://github.com/fbincon/claude-code-statusline/releases/tag/v2.0.0); commands below use it as an example. Replace the tag, package version, and filenames together for another release.

<a id="准备发布提交"></a>

Use the commands in [testing and acceptance](development/testing.md) for local checks, installed-package smoke and opt-in real Linux timer evidence. All 13 platform/build CI jobs and real timer acceptance must pass before publishing a timer release. Preserve raw reports only in ignored directories; record tested source, final commit, actual CI links and native-duration/visual limitations honestly.

## Native editor release gates

Stable v2.0.0 requests both the external TUI and in-session Client by default, preserving each recorded disablement. External needs 2.1.258+ and Client 2.1.287+; older/unknown hosts suspend each entry independently, restored by reinstall after upgrading. See [installation combinations and preferences](USER_GUIDE.md#editor-installation-combinations-and-compatibility).

On 2026-10-04 the maintainer confirmed v1.3.0a2 human acceptance on Linux, Windows and macOS. Stable retains the accepted Client interaction. Architecture, terminal and exact host versions were not supplied with that confirmation and remain unknown. Record CI, PTY and human acceptance separately; see [acceptance status](development/native.md#v130-acceptance-status).

Current candidates require all 13 Python/build and 13 fixed Mod jobs (Linux 2.1.287/2.1.288/2.1.289/2.1.294/2.1.296, Windows/macOS 2.1.288/2.1.289/2.1.294/2.1.296) on the PR, merge commit and tag. Check stable defaults, persistent disablement, version thresholds, upgrade/downgrade, all four combinations and independent disablement. Core smoke explicitly selects basic integration; native smoke checks actual marketplaces, backend binding, saves and uninstall. An installed wheel must also pass real Linux PTYs with both entries.

Build from the verified merge commit, inspect wheel/sdist/resource inventories and independent rebuilds, verify fixed-tag installation, draft assets and SHA256, require tag CI, then publish stable as Latest and check public downloads/isolated installs. The sole Mod source supplies runtime assets; exclude dependencies, host declarations and raw reports. Raw evidence stays in ignored dist/validation. Before a Python package downgrade, remove native with the newer package's `install --no-native-editor`.

Display-item releases retain the accepted UI interaction and installation policy; they do not run paid model/timer suites. Releases changing timer behavior still require separate timer acceptance.

## Prepare the release commit

### Maintain bilingual documentation

English is the default at existing documentation paths. Complete Simplified Chinese versions use the `.zh-CN.md` suffix in the same directory. Update both languages together, including README, user guide, release guide, changelog, and image index. Keep language switches and links within each language current; retain legacy Chinese heading anchors at the English paths.

Use relative links for repository documentation, language switches, license files, screenshots and same-page sections. GitHub CI, Issues, package metadata and source-install commands retain their primary GitHub identity. The setuptools metadata hook converts README destinations into fixed-tag GitHub links for PyPI without editing the source README. Check both wheel and sdist descriptions and preserve the original README in the sdist. Inline code and fenced command examples are not rewritten by this conversion.

Store complete bilingual Release bodies in `docs/releases/<tag>.md`, with English first and the original Chinese in an expandable section. Use an English Release title. Preserve version-specific support and validation claims; label links to historical Chinese documentation explicitly. When editing an existing Release, update only its title and body, preserving tags, assets, release type, and Latest selection.

1. Create a release branch from the latest `main` with the `fbincon/` prefix. Synchronize versions in `pyproject.toml`, `src/claude_statusline/_version.py`, the Mod manifest, and CLI tests.
2. Add the version and actual release date to both changelogs. Keep README installation and upgrade commands independent of the project version; update fixed-version examples in the user and release guides. Preserve historical support boundaries and Release records.
3. Release notes should describe major changes, platforms and Python versions, configuration compatibility, installation, and current limitations, consistent with [requirements](USER_GUIDE.md#requirements).
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

RELEASE_TAG=v2.0.0
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

By default, `python -m build` builds the source distribution first, then builds the wheel from it. The current version produces two assets:

```text
fbincon_claude_code_statusline-2.0.0-py3-none-any.whl
fbincon_claude_code_statusline-2.0.0.tar.gz
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
sha256sum fbincon_claude_code_statusline-2.0.0-py3-none-any.whl \
  fbincon_claude_code_statusline-2.0.0.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
cd -
```

On macOS, generate with `shasum -a 256` and verify with `shasum -a 256 -c SHA256SUMS`. In Windows PowerShell, run in the assets directory:

```powershell
$releaseFiles = @(
    'fbincon_claude_code_statusline-2.0.0-py3-none-any.whl',
    'fbincon_claude_code_statusline-2.0.0.tar.gz'
)
$releaseFiles | ForEach-Object {
    $digest = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $_"
} | Set-Content -LiteralPath SHA256SUMS -Encoding ascii
```

Use SHA-256, lowercase hexadecimal digests, two spaces, and filenames without directories for cross-platform verification.

<a id="创建标签与草稿-release"></a>

## Create a tag and draft Release

Confirm all 13 Python/build and 13 Mod CI jobs pass for `RELEASE_COMMIT`, and that the remote tag and Release do not already exist. Create an annotated tag and a draft with all three assets; never overwrite historical tags or assets.

```bash
git tag -a "$RELEASE_TAG" "$RELEASE_COMMIT" -m "Release $RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
gh release create "$RELEASE_TAG" \
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-2.0.0-py3-none-any.whl" \
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-2.0.0.tar.gz" \
  "$RELEASE_ASSETS/SHA256SUMS" \
  --repo fbincon/claude-code-statusline \
  --verify-tag --draft --title "$RELEASE_TAG" \
  --notes-file "$RELEASE_ROOT/release-notes.md"
```

Write the actual notes to `release-notes.md` above with real newlines first. Pushing the tag triggers CI, which must also pass. Download draft assets into a new directory with `gh release download`, verify SHA256SUMS, and compare bytes with local artifacts. GitHub's generated Source code ZIP/TAR is not a substitute for the wheel asset.

<a id="正式发布与下载验证"></a>

## Publish and verify downloads

Complete [TestPyPI acceptance](#testpypi-acceptance) before publishing the GitHub Release. Publication triggers the formal PyPI workflow automatically. It uses these same Release attachments and requires the successful TestPyPI run and matching index digests; it does not rebuild packages.

Mark a stable version without a prerelease identifier as Latest:

```bash
gh release edit "$RELEASE_TAG" --repo fbincon/claude-code-statusline \
  --draft=false --prerelease=false --latest
```

For prereleases, add `--prerelease --latest=false` when creating the draft; retain prerelease status and `--latest=false` when publishing. In the GitHub web UI, use the equivalent Draft, Pre-release, and Latest settings.

After publication:

1. Check the tag resolves to the build commit and asset names, sizes, digests, and release type are correct. Confirm the [latest stable entry point](https://github.com/fbincon/claude-code-statusline/releases/latest) points to this stable release.
2. Redownload all three assets from public URLs, verify checksums, and compare them with local artifacts.
3. Wait for all nine formal publishing jobs, including six index installation jobs on Linux, Windows and macOS with Python 3.10/3.14. Run the README's package-name installation command in independent pipx directories, check version, and run CLI smoke tests. Verify fixed-tag source and source-distribution installations as well.
4. Check version, date, tag and asset URLs agree across the versioned guides, changelog and release notes. README retains generic commands and links to migration instructions; check its long description, image and documentation links on PyPI.
5. Confirm a clean workspace and record release links, commit, and CI results. Keep detailed local reports in ignored directories outside distributions.

Release notes must cite actual validation results. Read CI-covered OS versions, architectures, and Python versions from the corresponding run reports. Terminal screenshots illustrate appearance; they do not replace real sleep/resume or multi-agent lifecycle acceptance.

Related documentation: [pipx installation sources](https://pipx.pypa.io/latest/reference/examples.html), [creating GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), and [Release linking rules](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).

## Trusted publisher setup

The PyPI distribution is `fbincon-claude-code-statusline`; the repository, import package, CLI, ownership marker and portable export format keep their existing identities. The older distribution name belongs to another project on PyPI. See [existing-installation migration](USER_GUIDE.md#migrate-the-previous-distribution-name).

Create separate accounts on [PyPI](https://pypi.org/account/register/) and [TestPyPI](https://test.pypi.org/account/register/), verify email and configure two-factor authentication. In each account's Publishing page, register a [pending GitHub publisher](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/) with:

| Field | Value |
| --- | --- |
| Project name | `fbincon-claude-code-statusline` |
| Owner / Repository | `fbincon` / `claude-code-statusline` |
| Workflow filename | `publish.yml` |
| Environment | `pypi` on PyPI, `testpypi` on TestPyPI |

Create matching GitHub Environments restricted to version tags `v*`. Only the upload job receives `id-token: write`. GitHub requires push access to expose private drafts, so an isolated fetch job uses a short-lived `contents: write` token only for stdlib API reads, downloads and hash checks, without dependency installation or distribution execution. Subsequent preparation has read-only repository/Actions access and verifies main/tag CI. Upload jobs download verified artifacts without checking out or building source. Actions are pinned to commit hashes and PyPA generates publishing attestations. No long-lived PyPI token is needed. A pending publisher does not reserve the package name; recheck it before the first upload.

## TestPyPI acceptance

After all main and tag CI jobs pass and the draft contains exactly the versioned wheel, source distribution and `SHA256SUMS`, dispatch on that exact tag:

```bash
gh workflow run publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" -f tag="$RELEASE_TAG"
gh run list --repo fbincon/claude-code-statusline --workflow publish.yml \
  --branch "$RELEASE_TAG" --event workflow_dispatch --limit 1
```

Inspect the returned run and wait for all nine jobs to succeed. Dispatching on `main` is rejected. The verification tool checks the tag commit is on main, both successful 13-job Python/build and 13-job Mod runs for main and tag, exact filenames, SHA256, package metadata, CLI identity, resources and strict long-description rendering. It then uploads only the two distributions to TestPyPI.

Six index jobs anonymously download both files, compare digests and bytes with the verified Release assets, install that exact wheel and run isolated CLI/configuration smoke. Windows dependencies come from normal PyPI. The successful TestPyPI run must have the same tag and commit as the formal Release. Raw evidence remains in ignored directories or Actions artifacts.

Fresh uploads may briefly return 404 or an incomplete file list while index caches update. Index verification polls these read-only states every five seconds for up to three minutes. Permission errors, unexpected identities, conflicting hashes and extra files fail immediately; publication is not repeated by this polling.

If a run fails, retain the draft and diagnose the failed gate. Reruns compare already uploaded files before skipping them and upload only missing files; conflicting hashes or extra files stop publication. Rerun the workflow after fixing account/publisher settings or transient failures. Version tags and published attachments retain their original history. After formal publication, follow the Gitee synchronization procedure below using these same three assets.

## Gitee code and Release synchronization

[GitHub](https://github.com/fbincon/claude-code-statusline) is the primary repository for development PRs, merges, CI, and publication. [Gitee](https://gitee.com/fbincon/claude-code-statusline) is the public synchronized repository. Synchronization runs as part of maintainer tasks, rather than through an automatic CI mirror. Keep `origin` and the `main` upstream on GitHub; add the separate SSH remote once:

```bash
git remote add gitee git@gitee.com:fbincon/claude-code-statusline.git
```

Before synchronizing, inspect `git remote -v`, the current branch, and the remote refs. Fetch the verified GitHub `main`, confirm its required CI passes, and push that exact commit to Gitee `main` with an explicit refspec. Push each GitHub version tag without recreating it. For example, after updating local `main` to the validated GitHub commit:

```bash
git push gitee main:refs/heads/main
git push gitee refs/tags/v2.0.0:refs/tags/v2.0.0
```

Verify both hosts expose identical `main` and tag object IDs. Preserve annotated tags and their target commits. Historical feature branches are pushed only when needed. If a ref has diverged, investigate before writing; never use force-push or `git push --mirror` for routine synchronization. Gitee PR acceptance uses temporary target and feature branches, preserving the PR record and removing only those branches after verified merging.

Git pushes do not copy Release metadata or assets. After the GitHub release is published and verified, create the matching Gitee Release using the [official Gitee MCP server](https://gitee.com/oschina/mcp-gitee). Use the same fixed tag, commit, English title, bilingual notes, and prerelease status; add verified Gitee download links to the Gitee notes. Gitee publishing states should follow its actual API capabilities. Its Release creation tool does not replace attachment upload: use the [official Release attachment API](https://gitee.com/api/v5/swagger) at `POST /repos/{owner}/{repo}/releases/{release_id}/attach_files` for the original wheel, source distribution, and `SHA256SUMS`.

Download GitHub's original published assets into a fresh directory and verify them before upload. For an existing Gitee Release, reuse matching metadata and assets, upload only missing files, and stop on conflicting content. After upload, anonymously redownload all three Gitee assets, verify names, sizes, and SHA256, and compare bytes with the GitHub originals. Record the Gitee Release URL and fixed commit after these checks pass. Preserve the GitHub validation claims and support boundaries.

### Generate platform-specific notes

Before modifying existing Gitee notes, save its complete Release JSON, including body, tag, prerelease status and asset list, in an ignored validation directory. Read the current public GitHub Release JSON as the canonical source; historical files in the checkout may predate final public validation. Keep GitHub titles/bodies and all historical tag objects and package bytes intact.

After the matching Gitee Release and its verified attachments exist, export the current Gitee Release collection (including all pages) and render locally:

```bash
python tools/render_gitee_release.py \
  --tag "$RELEASE_TAG" \
  --github-release-json "$RELEASE_ROOT/github-release.json" \
  --gitee-releases-json "$RELEASE_ROOT/gitee-releases.json" \
  --output "$RELEASE_ROOT/gitee-notes.md"
```

Run the renderer from the validated current main branch. It makes no network requests or platform writes and uses actual attachment URLs, retaining each version's distribution name. Relative document links resolve from `docs/releases/<tag>.md`; explicit branch/tag refs keep their original meaning. Gitee can reject direct pip/pipx URL requests with HTTP 403 even while browser/curl downloads work. Wheel instructions therefore link to the Gitee assets, require downloading and checksum verification, and install the local wheel from the download directory. Source refs, GitHub Actions, Issues and original publication provenance retain their meaning. Missing or duplicate assets, a wrong tag, package identity or prerelease mismatch stop generation before writing the output.

Review the Markdown, compare it with the canonical source and snapshot, and validate document targets and installation commands. Use the official MCP/API to update only the Gitee body; release updates missing from MCP use `PATCH /repos/{owner}/{repo}/releases/{release_id}` with form-encoded fields, including the unchanged `tag_name` and `target_commitish` alongside the updated body to satisfy API validation. Re-read the release afterward and check its tag, prerelease flag and attachment list remain unchanged. Repeated synchronization renders from GitHub again, so appendices do not accumulate; restore the saved body if a note-only update needs rollback. Record actual browser navigation separately from API and attachment checks; a CAPTCHA requires user completion before browser acceptance can resume.

Authentication is local to each maintainer's machine: use a dedicated Gitee SSH identity and a personal token stored in the system keyring. Codex can supply MCP authentication through `http_headers_helper`; attachment clients read the same keyring entry inside the process. Never put tokens in the repository, documentation, URLs, command arguments, or logs. Use standard `git` for version control and the Gitee MCP/API for Gitee platform operations; `gh` remains a GitHub client.

<a id="v130-preview-rollout"></a>

## v1.3.0 stable promotion

v1.3.0a2 has confirmed three-platform human acceptance. Stable Python/Mod versions are both 1.3.0; both entries default on with independent compatibility suspension. Missing historical preferences follow the new stable default; explicit false remains off. Update current user links and instructions, preserving historical preview tags/assets/release types and contemporaneous records. Create a new v1.3.0 Release with prerelease=false, latest=true after all gates above pass.

## v1.4.0 display-item release

This release adds opt-in catalog entries and retains the existing Client interaction and installation policy. Require fixed-clock expiry, missing/zero, raw token/scope, complete editor/preview and lazy-collection checks. Keep the existing three-platform CI, inspect and independently rebuild packages, run installed-wheel Linux PTYs and visually inspect the larger catalog. Document the inherited macOS input limitation and record automated/agent inspection separately from historical human acceptance. New multiline layouts and runtime timing changes require their own additional acceptance.

## Phase 4 preview and stable promotion

The v1.5.0a1 preview was publicly verified at `b7181a6`. On 2026-10-05 the maintainer confirmed Phase 4 human acceptance on Linux and Windows and on macOS through the standalone TUI/CLI. Exact OS, architecture, terminal and host versions were not supplied. This confirmation does not declare the earlier macOS in-session Client input problem fixed. Stable v1.5.0 uses Python/Mod 1.5.0, enables both entries by default on supported hosts and retains explicit false. Display schema v3, protocol v2 and the accepted editor behavior are unchanged. Preserve historical preview tags/assets/release type and capture filenames.

Require all 18 jobs (13 Python/build, five fixed Mod) on the PR, merge commit and tag. Build from the fixed verified merge commit, run installed-wheel advanced Linux PTYs and independent wheel/sdist/rebuild, verify draft SHA256/bytes, then publish stable with prerelease=false and latest=true and verify public downloads and URL installations. No paid model/timer suite is required for this version/default promotion. Record Phase 4 completion only after public stable verification.

## Phase 5 preview and promotion

Publish v1.6.0a1 as prerelease with latest=false after all 20 jobs (13 Python/build and 7 fixed Mod jobs) pass on PR, merge and tag. Build from the fixed verified merge, inspect both Mod inventories, independently rebuild/install wheel and sdist, verify 120x30/80x48 installed-wheel PTYs, draft assets/SHA256 and public URL installs. Keep the original shared USD 10 ledger for every real model probe/retry, reserve unknown costs at the call cap, and stop when exhausted. Require reliable single/parallel/main-wrap request and frozen-duration evidence.

Both preview and stable keep live collection off unless independently requested. Promote to v1.6.0 only after affected real runtime session/platform acceptance is recorded, retaining known conditional metric availability and the macOS Client input limitation. Do not reuse historical editor human acceptance as evidence for new runtime collection; when missing, keep the complete preview and state the gap. Stable promotion uses a separate reviewed PR and verified fixed release assets.

On 2026-10-05 the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS, authorizing stable promotion. Exact OS, architecture, terminal and host versions were not supplied. Promote Python and both Mods to 1.6.0; stable editor defaults apply while recorded false and independent live-metrics choices persist. Display v4/configuration protocol v3/runtime protocol v1 retain the accepted a1 implementation. This version/default promotion requires upgrade/default checks, all 20 PR/merge/tag jobs, fixed-merge artifacts, independent rebuild/install, installed-wheel PTYs and draft/public verification; it does not require repeating paid model calls. Revalidate captured runtime records without calls and preserve the original budget ledger. Publish a new stable Latest release, retaining the a1 tag/assets/prerelease status and known macOS Client input limitation. Record Phase 5 completion only after public stable verification.

## v1.6.1 external TUI hierarchy patch

This patch changes external curses presentation and field grouping. Display v4, configuration protocol v3, runtime protocol v1 and integration preferences remain compatible; Python and both Mods share the release version. Verify field identity after regrouping, nonselectable headings, scrolling, resizing, Unicode, numeric/text editing, saving and cancellation. Installed-wheel standalone PTYs cover 64×18, 64×20, 80×24, 120×30 and 80×48; official persistent advanced PTYs retain 120×30/80×48 and editor readback.

Require all 20 PR/merge/tag jobs, fixed-merge builds, inventories, independent rebuild/install, v1.6.0 upgrades and draft/public bytes/SHA256. Record screenshot source commits, sample data and reconstruction provenance; distinguish agent inspection from human acceptance. Runtime implementation is inherited, so this patch uses free tests and local commands. Publish a new v1.6.1 Latest release and preserve historical tags, assets and evidence.

## Task timing prerelease gates

For v1.7.0a1, retain the stable installation target and publish prerelease with `--latest=false`. Require all 20 PR/merge/tag jobs and build from the fixed verified merge SHA. Both Mod SemVer versions use `1.7.0-alpha.1` for Python `1.7.0a1`.

Use the existing shared USD 10 ledger for every real attempt and retry. The task acceptance runner covers default timing, parallel reports/wrap-up, blocked Stop continuation, controlled SDK waiting/interruption and explicit collection opt-out; see [task timing validation](development/testing.md#task-timing-preview-validation). Do not publish with a failed required case, unknown cost or exhausted budget. Repeat verification of captured source evidence against the installed distribution without calling models.

Validate installed core/native/runtime smoke, matching-wheel external and Client PTYs, wheel/sdist inventories, independent rebuild/install, draft download/checksums and tag CI before publication. Public asset bytes and fixed-tag/URL isolated installs must be checked after publication. Record automatic SDK input separately from human interaction; real sleep and Windows/macOS model sessions remain explicit preview boundaries.

## v1.7.0 stable promotion

On 2026-10-07 the maintainer confirmed v1.7.0a1 validation on Linux, macOS and Windows and requested stable Latest publication. The confirmation supplies no exact OS, architecture, terminal or host versions, and no separate hardware sleep/resume record. Preserve the contemporaneous preview evidence and earlier platform troubleshooting details.

Promote Python and both Mods to 1.7.0, update current stable installation/upgrade links, and retain the accepted timing implementation and schema contracts. Stable editor defaults request both supported entries; saved false and explicit plugin disablement remain respected. Native timing metadata defaults on for compatible fresh installs, advanced metrics off, and existing runtime choices remain independent. Preserve a1 tags, assets, release type, screenshots and the shared USD 10 ledger.

Require all 20 jobs on the reviewed PR, fixed merge and annotated stable tag; inspect wheel/sdist and both Mod inventories, independently rebuild/install, check a1-to-stable upgrades, installed core/native/runtime smoke and both editor PTYs, and revalidate six captured real scenarios without new model calls. Verify draft bytes/SHA256 and tag CI before publication. Publish the new stable Release with prerelease=false and latest=true; verify anonymous public downloads and isolated public-wheel/fixed-tag URL installs before recording completion.

## v1.7.1 TUI polish

This patch moves Client titles into frame edges, packs grouped fields by their actual row cost, groups Layout and item details consecutively, and gives both editors distinct shortcut-key styles. Keep h to unfold host preferences and the separate Apply action, configuration/runtime contracts and installation defaults. README galleries use the existing four-page images; preserve original PNG bytes and provenance.

Require complete local checks and all 20 PR/merge/tag CI jobs, isolated installed-package external PTYs at five sizes, persistent advanced Client PTYs, shared-configuration readback and 1.7.0 upgrades. Follow the fixed-merge build, independent rebuild, inventory, draft/public SHA256 and installation-URL gates above. This UI patch does not run paid timer acceptance. Automation and capture inspection do not establish new human or other-platform terminal acceptance.

## v1.7.2 Client footer polish

Verify the cyan Configure Status Line heading, uppercase key/lowercase action styles, Tab-first page help, conditional controls and complete-group wrapping. Main/Subagents order is Tab, Space, select, order, Ctrl+E, search. Ordinary letters accept both cases without altering input text or modifier keys. Preserve 32×12, selected fields, previews and shared paging geometry; keep the external editor and configuration/runtime contracts compatible.

Require complete local checks and all 20 PR/merge/tag jobs, installed core/native/runtime smoke, both editor PTYs and 1.7.1 upgrades. Build from the verified merge SHA, inspect inventories, independently rebuild/install, and verify draft/public assets, SHA256 and URL installs. Keep raw captures ignored and historical screenshots intact. README contains usage and current install links; release history belongs in changelogs and Release notes. Publish v1.7.2 as stable Latest after the gates pass; no paid model/timer suite is required.

## v1.7.7 documentation and diagnostics

Verify schema success/migration messages against the supported display version, supported v1–v4 files without diagnostic writes, and rejected legacy drafts before locking. Audit current bilingual catalog counts, protocol examples, collector defaults and timer explanations against source; preserve versioned acceptance records. The supplied 21 PNGs retain their original bytes and hashes, and the replaced 18-image gallery retains its provenance.

Require local checks and all 20 PR/merge/tag jobs, fixed-merge inventories and independent rebuild/install, installed core/native/runtime smoke, both editor PTYs and 1.7.2 upgrades. Verify draft/public bytes and SHA256, public wheel and fixed-tag installs before delivery. Python and both Mod manifests share 1.7.3; display v5, configuration protocol v4, runtime preference v2 and runtime protocol v2 remain compatible.

## v1.8.0 native preview backgrounds

Verify the remembered UI-only light/dark background choice independently of Claude themes, accurate terminal ANSI slot rendering, stored-choice recovery and unchanged configuration on cancel. Require all 13 Python/build and ten fixed Mod jobs for PR, merge and tag; retain four-combination default/ANSI captures, isolated installed/upgrade checks, exact-commit distributions, independent rebuilding and draft/public/TestPyPI/PyPI/Gitee digest verification.

## v1.8.0 bilingual interfaces

Require shared resource keys/placeholders, Python/TypeScript synchronization, schema-v1 UI preference recovery/future protection/concurrency and localized CLI help/errors. Configuration protocol is v5; display remains v5 and runtime v2. Verify both editors switch immediately, preserve drafts/search/input and keep language across cancel/reopen/upgrade/uninstall. Catalog JSON and actual statusline output retain English/canonical values.

Run the complete local checks, all 23 PR/merge/tag jobs, installed-wheel external minimum/common viewports and persistent native language/advanced PTYs. Inspect reconstructed images and document platform/host/source/palette, distinguishing agent inspection from human acceptance and multiplexer quantization from direct RGB. Rebuild and independently install wheel/sdist, inspect both language resources, verify 1.7.8 upgrades and use the exact fixed commit for assets and SHA256. Complete TestPyPI, stable Latest/PyPI index checks and same-byte Gitee synchronization. No paid model/timer suite is invoked. See [translation checks](development/i18n.md#validate-a-change).

## Statusline localization release gates

Verify display schema/configuration protocol v6, side-effect-free v1–v5 migration, independent UI/output languages, draft save/cancel, known/raw value boundaries and single-line generated resources. Require installed-wheel language PTYs, production-render verification after saves, complete cross-platform CI, fixed-commit package/rebuild/upgrade verification, TestPyPI acceptance and identical GitHub/PyPI/Gitee bytes. Record native host, focus actions and terminal dimensions; CI and agent-inspected captures do not constitute new human or Windows/macOS terminal acceptance.


## Discovery and import-review release gates

Keep UI protocol v7 independent of display v6, portable v1, UI preferences v1 and runtime v2. Require shared fixtures, all catalog guidance translations, readonly review/diff tests, preserved save revisions, packaging of new runtime modules and source-only fixtures, and matching upgraded native resource markers. Verify both installed discovery runners in both languages and inspect real captured cells. Preserve existing item/default/collector behavior and verify a 1.9.0 upgrade with explicit opt-outs. Follow the same 23-job PR/merge/tag, TestPyPI, formal PyPI and GitHub/Gitee byte-verification gates above; do not infer human acceptance from automation.

## Appearance release gates

Keep schema 7 / editor protocol 9 separate from portable v1, interface preferences v1 and runtime v2. Require shared validation, v1.11 migration and compatible-backup recovery, complete current-head/merge/tag CI, installed bilingual appearance PTYs in both terminal/preview backgrounds, and fixed-source performance results. Validate default byte compatibility, unknown/partial visibility, channel overrides, risk precedence, ASCII/arrow boundaries and font-independent fallback. Publish the same verified wheel/sdist/SHA256SUMS through TestPyPI, GitHub/PyPI and Gitee. Record actual sources and preserve earlier failed or diagnostic runs; no new paid model calls or human platform acceptance are implied.

## Multilingual release gates

For v1.13.0, ship complete `en`, `zh-CN`, `zh-Hant`, `ja` and `ko` packs. Keep display schema 7, UI preferences 1, portable format 1 and runtime protocol 2; editor protocol 10 requires matching resources. Require registry/resource/placeholder consistency, temporary new-language generation, all 25 UI/output combinations, both selector directions, failure/cancel preservation and multilingual search/Unicode viewports.

Run installed-wheel external and persistent native language acceptance with `--language zh-Hant`, `--language ja` and `--language ko`, across light/dark fixtures. Inspect decoded cells and reconstructed images; preserve failed diagnostic runs. Persistent tmux may quantize RGB, including the dark preview background to ANSI index 17; record actual captured colors separately from direct RGB behavior. Benchmark immutable v1.12.0 and candidate sources plus temporary 2/5/10-language variants; distinguish the five shipped languages from synthetic capacity fixtures and Node module measurements from actual Claude Client startup. Complete the same fixed-merge, CI, independent rebuild, TestPyPI, PyPI, GitHub and same-byte Gitee gates above.

## Component-instance release gates

Composition uses display schema 8 and editor protocol 11. Check read-only v1–v7 mapping, backups before real saves, copy identities, disabled placements, ambiguity rejection, both editors' add/text/save/cancel paths, and repeated-metric observation reuse. Record installed bilingual PTYs, 40/80/120-cell output and fixed-source cold/warm benchmarks separately. Display defaults remain unchanged; previews retain the existing explicit editor opt-in policy.

Claude Code 2.1.296 loads, strictly validates and tests Mods but does not emit declarations through the current preparation flow. Retain exact-build type checks on the ten earlier fixed hosts and add three-platform Mod tests, marketplace installation and backend verification on 2.1.296. Do not describe these as exact-build 2.1.296 type checks. Real Windows/macOS human interaction, font behavior and the historical macOS Client focus limitation remain separate evidence.
