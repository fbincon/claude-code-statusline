# Publishing GitHub, PyPI and Gitee Releases

**English** | [简体中文](RELEASING.zh-CN.md)

<a id="发布-github-release"></a>

This guide is for maintainers. Users should start with [installation in the README](../README.md#quick-installation) and the [user guide](USER_GUIDE.md) for configuration. The current stable release is [v1.7.4](https://github.com/fbincon/claude-code-statusline/releases/tag/v1.7.4); commands below use it as an example. Replace the tag, package version, and filenames together for another release.

<a id="准备发布提交"></a>

Use the commands in [testing and acceptance](development/testing.md) for local checks, installed-package smoke and opt-in real Linux timer evidence. All 13 platform/build CI jobs and real timer acceptance must pass before publishing a timer release. Preserve raw reports only in ignored directories; record tested source, final commit, actual CI links and native-duration/visual limitations honestly.

## Native editor release gates

Stable v1.7.4 requests both the external TUI and in-session Client by default, preserving each recorded disablement. External needs 2.1.258+ and Client 2.1.287+; older/unknown hosts suspend each entry independently, restored by reinstall after upgrading. See [installation combinations and preferences](USER_GUIDE.md#editor-installation-combinations-and-compatibility).

On 2026-10-04 the maintainer confirmed v1.3.0a2 human acceptance on Linux, Windows and macOS. Stable retains the accepted Client interaction. Architecture, terminal and exact host versions were not supplied with that confirmation and remain unknown. Record CI, PTY and human acceptance separately; see [acceptance status](development/native.md#v130-acceptance-status).

Phase 5 candidates require all 13 Python/build and seven fixed Mod jobs (Linux 2.1.287/2.1.288/2.1.289, Windows/macOS 2.1.288/2.1.289) on the PR, merge commit and tag. Check stable defaults, persistent disablement, version thresholds, upgrade/downgrade, all four combinations and independent disablement. Core smoke explicitly selects basic integration; native smoke checks actual marketplaces, backend binding, saves and uninstall. An installed wheel must also pass real Linux PTYs with both entries.

Build from the verified merge commit, inspect wheel/sdist/resource inventories and independent rebuilds, verify fixed-tag installation, draft assets and SHA256, require tag CI, then publish stable as Latest and check public downloads/isolated installs. The sole Mod source supplies runtime assets; exclude dependencies, host declarations and raw reports. Raw evidence stays in ignored dist/validation. Before a Python package downgrade, remove native with the newer package's `install --no-native-editor`.

Display-item releases retain the accepted UI interaction and installation policy; they do not run paid model/timer suites. Releases changing timer behavior still require separate timer acceptance.

## Prepare the release commit

### Maintain bilingual documentation

English is the default at existing documentation paths. Complete Simplified Chinese versions use the `.zh-CN.md` suffix in the same directory. Update both languages together, including README, user guide, release guide, changelog, and image index. Keep language switches and links within each language current; retain legacy Chinese heading anchors at the English paths.

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

RELEASE_TAG=v1.7.4
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
fbincon_claude_code_statusline-1.7.4-py3-none-any.whl
fbincon_claude_code_statusline-1.7.4.tar.gz
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
sha256sum fbincon_claude_code_statusline-1.7.4-py3-none-any.whl \
  fbincon_claude_code_statusline-1.7.4.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
cd -
```

On macOS, generate with `shasum -a 256` and verify with `shasum -a 256 -c SHA256SUMS`. In Windows PowerShell, run in the assets directory:

```powershell
$releaseFiles = @(
    'fbincon_claude_code_statusline-1.7.4-py3-none-any.whl',
    'fbincon_claude_code_statusline-1.7.4.tar.gz'
)
$releaseFiles | ForEach-Object {
    $digest = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $_"
} | Set-Content -LiteralPath SHA256SUMS -Encoding ascii
```

Use SHA-256, lowercase hexadecimal digests, two spaces, and filenames without directories for cross-platform verification.

<a id="创建标签与草稿-release"></a>

## Create a tag and draft Release

Confirm all 13 Python/build and seven Mod CI jobs pass for Phase 5 for `RELEASE_COMMIT`, and that the remote tag and Release do not already exist. Create an annotated tag and a draft with all three assets; never overwrite historical tags or assets.

```bash
git tag -a "$RELEASE_TAG" "$RELEASE_COMMIT" -m "Release $RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
gh release create "$RELEASE_TAG" \
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-1.7.4-py3-none-any.whl" \
  "$RELEASE_ASSETS/fbincon_claude_code_statusline-1.7.4.tar.gz" \
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
3. Wait for all eight formal publishing jobs, including six index installation jobs on Linux, Windows and macOS with Python 3.10/3.14. Run the README's package-name installation command in independent pipx directories, check version, and run CLI smoke tests. Verify fixed-tag source and source-distribution installations as well.
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

Create matching GitHub Environments restricted to version tags `v*`. Only the upload job receives `id-token: write`; preparation has read-only repository/Actions access and verifies main/tag CI. Upload jobs download verified artifacts without checking out or building source. Actions are pinned to commit hashes and PyPA generates publishing attestations. No long-lived PyPI token is needed. A pending publisher does not reserve the package name; recheck it before the first upload.

## TestPyPI acceptance

After all main and tag CI jobs pass and the draft contains exactly the versioned wheel, source distribution and `SHA256SUMS`, dispatch on that exact tag:

```bash
gh workflow run publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" -f tag="$RELEASE_TAG"
gh run list --repo fbincon/claude-code-statusline --workflow publish.yml \
  --branch "$RELEASE_TAG" --event workflow_dispatch --limit 1
```

Inspect the returned run and wait for all eight jobs to succeed. Dispatching on `main` is rejected. The verification tool checks the tag commit is on main, both successful 13-job Python/build and seven-job Mod runs for main and tag, exact filenames, SHA256, package metadata, CLI identity, resources and strict long-description rendering. It then uploads only the two distributions to TestPyPI.

Six index jobs anonymously download both files, compare digests and bytes with the verified Release assets, install that exact wheel and run isolated CLI/configuration smoke. Windows dependencies come from normal PyPI. The successful TestPyPI run must have the same tag and commit as the formal Release. Raw evidence remains in ignored directories or Actions artifacts.

If a run fails, retain the draft and diagnose the failed gate. Reruns compare already uploaded files before skipping them and upload only missing files; conflicting hashes or extra files stop publication. Rerun the workflow after fixing account/publisher settings or transient failures. Version tags and published attachments retain their original history. After formal publication, follow the Gitee synchronization procedure below using these same three assets.

## Gitee code and Release synchronization

[GitHub](https://github.com/fbincon/claude-code-statusline) is the primary repository for development PRs, merges, CI, and publication. [Gitee](https://gitee.com/fbincon/claude-code-statusline) is the public synchronized repository. Synchronization runs as part of maintainer tasks, rather than through an automatic CI mirror. Keep `origin` and the `main` upstream on GitHub; add the separate SSH remote once:

```bash
git remote add gitee git@gitee.com:fbincon/claude-code-statusline.git
```

Before synchronizing, inspect `git remote -v`, the current branch, and the remote refs. Fetch the verified GitHub `main`, confirm its required CI passes, and push that exact commit to Gitee `main` with an explicit refspec. Push each GitHub version tag without recreating it. For example, after updating local `main` to the validated GitHub commit:

```bash
git push gitee main:refs/heads/main
git push gitee refs/tags/v1.7.4:refs/tags/v1.7.4
```

Verify both hosts expose identical `main` and tag object IDs. Preserve annotated tags and their target commits. Historical feature branches are pushed only when needed. If a ref has diverged, investigate before writing; never use force-push or `git push --mirror` for routine synchronization. Gitee PR acceptance uses temporary target and feature branches, preserving the PR record and removing only those branches after verified merging.

Git pushes do not copy Release metadata or assets. After the GitHub release is published and verified, create the matching Gitee Release using the [official Gitee MCP server](https://gitee.com/oschina/mcp-gitee). Use the same fixed tag, commit, English title, bilingual notes, and prerelease status; add verified Gitee download links to the Gitee notes. Gitee publishing states should follow its actual API capabilities. Its Release creation tool does not replace attachment upload: use the [official Release attachment API](https://gitee.com/api/v5/swagger) at `POST /repos/{owner}/{repo}/releases/{release_id}/attach_files` for the original wheel, source distribution, and `SHA256SUMS`.

Download GitHub's original published assets into a fresh directory and verify them before upload. For an existing Gitee Release, reuse matching metadata and assets, upload only missing files, and stop on conflicting content. After upload, anonymously redownload all three Gitee assets, verify names, sizes, and SHA256, and compare bytes with the GitHub originals. Record the Gitee Release URL and fixed commit after these checks pass. Preserve the GitHub validation claims and support boundaries.

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

## v1.7.4 documentation and diagnostics

Verify schema success/migration messages against the supported display version, supported v1–v4 files without diagnostic writes, and rejected legacy drafts before locking. Audit current bilingual catalog counts, protocol examples, collector defaults and timer explanations against source; preserve versioned acceptance records. The supplied 21 PNGs retain their original bytes and hashes, and the replaced 18-image gallery retains its provenance.

Require local checks and all 20 PR/merge/tag jobs, fixed-merge inventories and independent rebuild/install, installed core/native/runtime smoke, both editor PTYs and 1.7.2 upgrades. Verify draft/public bytes and SHA256, public wheel and fixed-tag installs before delivery. Python and both Mod manifests share 1.7.3; display v5, configuration protocol v4, runtime preference v2 and runtime protocol v2 remain compatible.
