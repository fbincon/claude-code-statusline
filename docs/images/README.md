# Screenshots

**English** | [简体中文](README.zh-CN.md)

The current gallery contains 18 images: three retained main status lines, three new in-session Client screenshots and twelve new external configuration pages. Earlier images and capture records are in the [archive](archive/README.md).

PNG bytes, dimensions, colors and metadata are preserved. Main status lines show session data; configuration `Preview (sample data)` uses fixed examples, not actual token usage or evidence of real parallel agents.

## Directory layout

```text
images/
├── statusline/{linux,macos,windows}.png
├── tui/native/{linux,macos,windows}/session.png
├── tui/external/{linux,macos,windows}/{main,subagents,settings,layout}.png
└── archive/
    ├── screenshots/{native,external}/{linux,macos,windows}/
    └── reconstructions/<source-version>/linux/
```

## Current images

| Platform | Main status line | In-session Client | Main | Subagents | Settings | Layout |
| --- | --- | --- | --- | --- | --- | --- |
| Linux | [PNG](statusline/linux.png) | [PNG](tui/native/linux/session.png) | [PNG](tui/external/linux/main.png) | [PNG](tui/external/linux/subagents.png) | [PNG](tui/external/linux/settings.png) | [PNG](tui/external/linux/layout.png) |
| macOS | [PNG](statusline/macos.png) | [PNG](tui/native/macos/session.png) | [PNG](tui/external/macos/main.png) | [PNG](tui/external/macos/subagents.png) | [PNG](tui/external/macos/settings.png) | [PNG](tui/external/macos/layout.png) |
| Windows | [PNG](statusline/windows.png) | [PNG](tui/native/windows/session.png) | [PNG](tui/external/windows/main.png) | [PNG](tui/external/windows/subagents.png) | [PNG](tui/external/windows/settings.png) | [PNG](tui/external/windows/layout.png) |

## In-session Client screenshots

The supplied screenshots visibly show Claude Code 2.1.289: docked panes on Linux and Windows, and an inline pane on macOS. Conversation text, earlier command results and connection messages are preserved.

Existing reports describe usable Client interaction on Linux and Windows and an opening pane with interaction problems on macOS. New static images update the layout examples; they do not independently verify saving, keyboard focus or resolution of that issue. See the [user guide](../USER_GUIDE.md#macos-mouse-reporting-and-client-focus) for checks and the [native editor record](../development/native.md#claude-code-21289-interaction-report) for historical feedback.

## Sources and hashes

Original filenames date the new external screenshots to 2026-10-05, in Main, Subagents, Settings and Layout order. macOS images show Terminal.app; Windows images show Windows Terminal. Exact OS, architecture, terminal-version and backend-commit metadata were not supplied. Retained main status lines come from the old repository; their original record did not give a capture date.

<details>
<summary>Original filenames, repository paths, dimensions and PNG SHA-256</summary>

| Original source path | Repository file | Dimensions | PNG SHA-256 |
| --- | --- | --- | --- |
| Old repository: `docs/images/statusline-macos.png` | [statusline/macos.png](statusline/macos.png) | 936×498 | `3c2c286af82268dbbf8e599c9ce236a75c7897eca9093a2d43eb48cfab04e3d8` |
| Old repository: `docs/images/statusline-windows.png` | [statusline/windows.png](statusline/windows.png) | 1708×985 | `874efc5bfac0128e70c224c799eef4c441da21623d8bee8076c797e3c2993093` |
| Old repository: `docs/images/statusline.png` | [statusline/linux.png](statusline/linux.png) | 1191×790 | `07d3a28c82e1b4fb099da5ac8a758c1fc1d1f3bbd712d85f812a7a3ad858d035` |
| Supplied directory: `statusline-configure-native打开的内部TUI展示/Linux.png` | [tui/native/linux/session.png](tui/native/linux/session.png) | 1105×714 | `6e9b4974de7ae5c04b54d15a23bd53ecda6706a894f67c480db8fce293315f31` |
| Supplied directory: `statusline-configure-native打开的内部TUI展示/Windows.png` | [tui/native/windows/session.png](tui/native/windows/session.png) | 1831×1197 | `9316798d77190af04031dc84cba3788aee517674cad184623621180c9b59a6ae` |
| Supplied directory: `statusline-configure-native打开的内部TUI展示/macOS.png` | [tui/native/macos/session.png](tui/native/macos/session.png) | 1161×933 | `610a1908dc7596bea234eec6171082628792c345818b54dbb5fa00a4d88c658b` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-20.png` | [tui/external/linux/main.png](tui/external/linux/main.png) | 1110×757 | `10d8ed857c17e4bb22ebebbd2b5e4bc95a79358f728306722baec170695c607f` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-27.png` | [tui/external/linux/subagents.png](tui/external/linux/subagents.png) | 1110×757 | `5f55a2d58fa635dbfd127b6c5ddebd9f938e4949325f88cd25374d3e9edb3779` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-39.png` | [tui/external/linux/settings.png](tui/external/linux/settings.png) | 1110×757 | `c4bf0164906dcfaf85052705c32be32ed570b4bfa6367a254598c26556162a4d` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-05 17-34-45.png` | [tui/external/linux/layout.png](tui/external/linux/layout.png) | 1110×757 | `740fb59a8c98f81367639425cb2e59ed46cd24107c5a7eb8b2f9ac15cbb8956d` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 174922.png` | [tui/external/windows/main.png](tui/external/windows/main.png) | 1826×1193 | `443fb7fbe8df82bb221f9fc878e2061f98ec04a551fb2c24785017a021d566f0` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175019.png` | [tui/external/windows/subagents.png](tui/external/windows/subagents.png) | 1826×1192 | `f0d3e194fbbd7c8a8e6b85b132992c0cc3c80b1424125685db03e2cdb4404e55` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175031.png` | [tui/external/windows/settings.png](tui/external/windows/settings.png) | 1825×1193 | `0fccc6e38cc58bd399e6b929b1181de9772eddd6861a5a4e791122e98ed8e633` |
| Supplied directory: `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-05 175039.png` | [tui/external/windows/layout.png](tui/external/windows/layout.png) | 1828×1194 | `868d8923e1b074ae80e8b79981da26a9645bfde59aab1a469ea95e080ff97837` |
| Supplied directory: `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180915.png` | [tui/external/macos/main.png](tui/external/macos/main.png) | 1138×723 | `0e6b9cb93766c3729933610f75df8a516a84254ab014273f6df98014f6b891b2` |
| Supplied directory: `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180940.png` | [tui/external/macos/subagents.png](tui/external/macos/subagents.png) | 1140×725 | `26ef13f510806ad9e3f1065ad8fb1114b5ec5d315c4cb5399ce4fe8ab473de42` |
| Supplied directory: `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 180956.png` | [tui/external/macos/settings.png](tui/external/macos/settings.png) | 1141×725 | `467deebb5acd95d970f22aa0a48a09d119f1087d48b34852dcb310e8afe5b034` |
| Supplied directory: `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-05 181009.png` | [tui/external/macos/layout.png](tui/external/macos/layout.png) | 1137×724 | `0b0e37797e2c4122a22fa8689a3a7764bef4b5ff6dbd423d9709495e3b329e17` |

</details>

## Updating screenshots

- Use lowercase English filenames and group current images by entry point, platform and page.
- Update both READMEs, the user guides, index and hashes together; preserve originals and archive replaced screenshots.
- Keep source versions, filenames, capture commits and metadata for historical reconstructions; do not relabel them as new-version screenshots.
- `MANIFEST.in` recursively includes Markdown and PNG files; distribution inspection verifies source-package completeness.

<a id="display-notes"></a>
<a id="external-tui-v161"></a>
<a id="file-index"></a>
<a id="interface-screenshots"></a>
<a id="native-editor-captures"></a>
<a id="v120-captures"></a>
<a id="v130a1-preview-captures"></a>
<a id="v130a2-client-captures"></a>
<a id="v150-stable-acceptance"></a>
<a id="v150a1-phase-4-captures"></a>
<a id="v160-stable-acceptance"></a>
<a id="v161-external-tui-captures"></a>
<a id="展示说明"></a>
<a id="文件索引"></a>
<a id="更新约定"></a>
<a id="界面截图"></a>

## Historical provenance

Provenance for older links has moved to the [archive index](archive/README.md), including earlier session screenshots, native previews, format/layout previews and external TUI captures. Original commits, capture hashes and acceptance scope remain in the archive.
