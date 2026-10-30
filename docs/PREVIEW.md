# Try the TypeScript preview

**English** | [简体中文](PREVIEW.zh-CN.md)

This is the **historical v3.0.0-beta.1 trial and recovery procedure**. For the current product, use the [installation guide](USER_GUIDE.md#installation-and-integration) or [usage demonstrations](SHOWCASE.md). Stable v3.0.0 superseded this preview; its [delivery record](development/typescript-migration/ts-06/stable-release.md) and [release-specific decision](development/typescript-migration/ts-06/README.md#stable-decision-2026-10-18) preserve the accepted gaps without marking them passed.

The preview was distributed as `@fbincon/claude-code-statusline@beta` and identical GitHub/Gitee Release attachments. [Original release notes](releases/v3.0.0-beta.1.md) · [Platform validation tracker](https://github.com/fbincon/claude-code-statusline/issues/96).

To reproduce that package, pin `@3.0.0-beta.1`, as below. Mutable npm channels such as `beta` and `latest` do not establish a historical version. The requirements, CI counts, schema versions and results below describe the retained preview-era evidence, not current-product validation. Python v2.0.0 remains the historical rollback target.

## Requirements and validation limits

Use Node **24.21.0** with npm **11.19.0**. Supported package targets are Linux/WSL x64, Windows x64, macOS x64 and ARM64. Windows ARM testing uses **x64 Node under emulation**. A native Windows ARM or 32-bit runtime is not provided. No Python or native compiler is needed to install the preview.

CI covers eight installation targets and thirteen fixed Claude host combinations. Physical macOS sleep/resume, macOS 14 Intel desktop/power, Windows 10 desktop, WSL desktop/popup and remaining target-specific power/visual checks remain **unverified**, accepted for v3.0.0 publication only. CI and PTY results do not establish human desktop or physical power acceptance. The historical macOS Client focus limitation still applies: click the Client region before typing. Claude 2.1.296 has no usable exact-host declarations; its official Mod tests are separate from type checking on 2.1.294.

Both editors default on for compatible hosts, preserving saved disablement. External needs Claude 2.1.258+, in-session Client 2.1.287+, and native timing 2.1.289+. Advanced live metrics remain opt-in. Display schema 8, editor protocol 11, runtime protocol 2/v1 and task schema 4 remain compatible. D06 remains **FAIL: 104 pass / 60 fail / 28 inconclusive**; performance work belongs to PERF-01. Functional timeouts, event loss, failed writes and recovery failures remain bugs.

## Install without replacing Python

Keep the original Python environment and note its absolute executable path and `--version` before trying the preview. Use a separate npm prefix to avoid a same-name PATH collision. An npm package installation does not itself modify Claude settings.

Bash/Zsh:

```bash
SL_PREVIEW_PREFIX="$HOME/.local/share/claude-statusline-preview"
npm install --prefix "$SL_PREVIEW_PREFIX" --ignore-scripts --no-audit --no-fund @fbincon/claude-code-statusline@3.0.0-beta.1
SL_PREVIEW_ENTRY="$SL_PREVIEW_PREFIX/node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js"
SL_PREVIEW_CONFIG="$SL_PREVIEW_PREFIX/test-config"
node "$SL_PREVIEW_ENTRY" --version
node "$SL_PREVIEW_ENTRY" install --config-dir "$SL_PREVIEW_CONFIG" --dry-run
node "$SL_PREVIEW_ENTRY" install --config-dir "$SL_PREVIEW_CONFIG"
node "$SL_PREVIEW_ENTRY" doctor --config-dir "$SL_PREVIEW_CONFIG"
node "$SL_PREVIEW_ENTRY" configure --config-dir "$SL_PREVIEW_CONFIG"
```

PowerShell:

```powershell
$previewPrefix = Join-Path $env:LOCALAPPDATA 'claude-statusline-preview'
npm.cmd install --prefix "$previewPrefix" --ignore-scripts --no-audit --no-fund '@fbincon/claude-code-statusline@3.0.0-beta.1'
$previewEntry = Join-Path $previewPrefix 'node_modules/@fbincon/claude-code-statusline/bin/claude-statusline.js'
$previewConfig = Join-Path $previewPrefix 'test-config'
node "$previewEntry" --version
node "$previewEntry" install --config-dir "$previewConfig" --dry-run
node "$previewEntry" install --config-dir "$previewConfig"
node "$previewEntry" doctor --config-dir "$previewConfig"
node "$previewEntry" configure --config-dir "$previewConfig"
```

The commands pin the original preview package. These commands use temporary Claude configuration. To test an actual session, start Claude with `CLAUDE_CONFIG_DIR` pointing to that same configuration directory. Use your normal official login flow if needed; the checklist requires no new paid model calls. To switch your existing configuration deliberately, stop active Claude sessions, back up that directory, and repeat dry-run/install/doctor with its explicit path. Review reported changes and resolve foreign ownership rather than blindly using `--force`.

Windows npm wrappers are `.cmd`/`.ps1`, not the old Python `.exe`. Direct `node` plus an absolute JS path avoids wrapper and execution-policy ambiguity; installed host bindings use absolute argv. Keep the selected Node executable and prefix in place while the preview is integrated.

## Offline Release attachments

Download all four assets from the [GitHub preview Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1) or [Gitee preview Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.0.0-beta.1):

- `fbincon-claude-code-statusline-3.0.0-beta.1.tgz`
- `claude-code-statusline-3.0.0-beta.1-source.tar.gz`
- `build-manifest.json`
- `SHA256SUMS`

Verify `sha256sum -c SHA256SUMS` on Linux/WSL, or `shasum -a 256 -c SHA256SUMS` on macOS. In PowerShell compare `Get-FileHash -Algorithm SHA256 -LiteralPath FILE` with each entry in `SHA256SUMS`. Then replace the npm package argument above with the local tgz path and add `--offline`. Keep `--ignore-scripts`; dependencies and native prebuilds are bundled. Gitee installation uses downloaded local files. GitHub/Gitee automatic source ZIPs are not the reproducible source asset.

## Short test checklist

1. Record `--version`, OS/build/architecture, Node/npm, Claude and terminal versions, installation channel and tarball digest.
2. Check dry-run, install, doctor, reinstall and explicit editor disablement; inspect before-image backups.
3. Test `claude-statusline configure` through the explicit entry, then `/statusline-configure` and `/statusline-configure-native` in the selected Claude configuration. Verify keyboard/mouse focus, resize, Unicode, themes, save/cancel and terminal restoration.
4. Check main/subagent rendering with existing or captured sessions, independent UI/output languages, display edits and portable import/export. Do not treat sample previews as live-data evidence.
5. Test explicit recovery and rollback below. Report pass/fail/unverified for each applicable item; no screenshot or CI run alone proves sleep/resume correctness.

## Recovery and rollback

`doctor` only diagnoses unfinished transactions. Inspect with `recover --dry-run`, then use `recover` explicitly with the same entry and `--config-dir`. Never delete a pending journal to bypass ownership checks. [Recovery contract](development/typescript-migration/ts-04/recovery.md).

For a completed switch back to Python, first use the **new preview entry** to run `uninstall --config-dir <the switched directory>` while that entry and Node still exist. Keep the display/preferences and compatible before-image backups. Then invoke the retained **absolute Python executable** for `install --dry-run`, `install` and `doctor` on the same directory. If the old package is absent, install the fixed historical package with `pipx install fbincon-claude-code-statusline==2.0.0`, locate its absolute console executable, and use that executable. Restart Claude and verify rendering/editors. `recover` repairs incomplete transactions; it does not select an arbitrary historical backup or perform a version downgrade.

Only after binding has been restored, remove the preview package with `npm uninstall --prefix <preview prefix> @fbincon/claude-code-statusline`. Removing files first leaves broken absolute bindings. Never restore unrelated settings over newer changes. [Published Python documentation](https://github.com/fbincon/claude-code-statusline/blob/v2.0.0/docs/USER_GUIDE.md).

## Detailed acceptance and feedback

[Submit feedback](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml). Include sanitized reproduction logs and distinguish automation, PTY, human desktop and physical power evidence. Do not include credentials or private transcripts. Track platform coverage in [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96).

For collector-backed evidence, extract the exact source asset, use the pinned Node/npm, run `npm ci --ignore-scripts` and `npm run build`. Set `FULL_SHA` from `build-manifest.json`; use the complete downloaded asset directory and the installed package root (the directory containing `candidate.json`). The collectors verify source and installed bytes before associating observations:

```text
npm run acceptance:power -- before --kind suspend --output NEW_DIRECTORY --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
# The operator performs a real OS suspend/resume; the tool never initiates it.
npm run acceptance:power -- after --output SAME_DIRECTORY --human-confirmed --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
npm run acceptance:terminal -- launch --mode direct --output NEW_DIRECTORY --artifact ABSOLUTE_TGZ --commit FULL_SHA --installed-root INSTALLED_PACKAGE_ROOT
```

Use separate directories for reboot and popup tests. Power collection supports Linux/macOS/Windows; desktop terminal collection supports Linux GNOME and macOS Terminal. Windows/WSL desktop and both actual editors also need the manual checklist and exact environment report. The terminal collector exercises terminal primitives; association with an artifact does not replace actual editor interaction. Keep raw evidence locally and publish only sanitized summaries. [TS-06 status](development/typescript-migration/ts-06/README.md).
