# Screenshots

**English** | [简体中文](README.zh-CN.md)

The original cross-platform gallery contains 21 original screenshots supplied on 2026-10-07: nine in-session TUI pages and twelve external TUI pages. The former 18-image README gallery and older records remain in the [archive](archive/README.md).

PNG bytes, dimensions, colors and metadata are preserved. Main status lines at the bottom of session screenshots show session data; configuration Preview regions use fixed samples and do not establish actual token usage or parallel-agent acceptance.

## Directory layout

```text
images/
├── tui/
│   ├── native/
│   │   ├── linux/
│   │   │   ├── main.png
│   │   │   ├── subagents.png
│   │   │   ├── settings.png
│   │   │   ├── layout.png
│   │   │   └── themes/
│   │   │       ├── main-light.png
│   │   │       └── main-dark.png
│   │   ├── windows/
│   │   │   ├── main.png
│   │   │   ├── subagents.png
│   │   │   ├── settings.png
│   │   │   ├── layout.png
│   │   │   └── themes/
│   │   │       ├── main-light.png
│   │   │       └── main-dark.png
│   │   └── macos/
│   │       └── main.png
│   └── external/
│       ├── linux/
│       │   ├── main.png
│       │   ├── subagents.png
│       │   ├── settings.png
│       │   ├── layout.png
│       │   └── themes/
│       │       ├── main-light.png
│       │       ├── main-light-ansi.png
│       │       ├── main-dark.png
│       │       └── main-dark-ansi.png
│       ├── windows/
│       │   ├── main.png
│       │   ├── subagents.png
│       │   ├── settings.png
│       │   ├── layout.png
│       │   └── themes/
│       │       ├── main-light.png
│       │       ├── main-light-ansi.png
│       │       ├── main-dark.png
│       │       └── main-dark-ansi.png
│       └── macos/
│           ├── main.png
│           ├── subagents.png
│           ├── settings.png
│           └── layout.png
├── discovery/
│   ├── native/
│   └── external/
└── archive/
    ├── screenshots/
    │   └── replaced-2026-10-07/
    └── reconstructions/
```

## Current images

| Entry | Platform | Main | Subagents | Settings | Layout |
| --- | --- | --- | --- | --- | --- |
| In-session | Linux | [PNG](tui/native/linux/main.png) | [PNG](tui/native/linux/subagents.png) | [PNG](tui/native/linux/settings.png) | [PNG](tui/native/linux/layout.png) |
| In-session | Windows | [PNG](tui/native/windows/main.png) | [PNG](tui/native/windows/subagents.png) | [PNG](tui/native/windows/settings.png) | [PNG](tui/native/windows/layout.png) |
| In-session | macOS | [PNG](tui/native/macos/main.png) | Not supplied | Not supplied | Not supplied |
| External | Linux | [PNG](tui/external/linux/main.png) | [PNG](tui/external/linux/subagents.png) | [PNG](tui/external/linux/settings.png) | [PNG](tui/external/linux/layout.png) |
| External | Windows | [PNG](tui/external/windows/main.png) | [PNG](tui/external/windows/subagents.png) | [PNG](tui/external/windows/settings.png) | [PNG](tui/external/windows/layout.png) |
| External | macOS | [PNG](tui/external/macos/main.png) | [PNG](tui/external/macos/subagents.png) | [PNG](tui/external/macos/settings.png) | [PNG](tui/external/macos/layout.png) |

## In-session Client screenshots

The session screenshots visibly show Claude Code 2.1.292: docked regions on Linux and Windows, and an inline region on macOS. Linux and Windows provide all four pages; only Main was supplied for macOS. Conversation text, earlier command results and connection messages remain unmodified.

Static images update the layout examples without independently verifying saves, keyboard focus or resolution of the historical macOS input issue. See the [user guide](../USER_GUIDE.md#macos-mouse-reporting-and-client-focus) and [native editor record](../development/native.md#claude-code-21289-interaction-report) for checks and historical feedback.

## Sources and hashes

The supplied directory groups files by entry and platform; original filenames record 2026-10-07. Files map to Main, Subagents, Settings and Layout in order, with only Main supplied for the macOS Client. Exact OS, architecture, terminal-version and backend-commit metadata were not supplied.

<details>
<summary>Original filenames, repository paths, dimensions and PNG SHA-256</summary>

| Original source path | Repository file | Dimensions | PNG SHA-256 |
| --- | --- | --- | --- |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-36-44.png` | [tui/native/linux/main.png](tui/native/linux/main.png) | 1009×729 | `7e83baab8ce567609978d9047b91ba0c7ba8d251b366350d1698f9c1f9e09298` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-36-54.png` | [tui/native/linux/subagents.png](tui/native/linux/subagents.png) | 1009×729 | `d197811741c03a2b3132a0fdbcdbabbb4050bff304f5b0727422f9c0898c6eb5` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-37-00.png` | [tui/native/linux/settings.png](tui/native/linux/settings.png) | 1009×729 | `20119c8cd5ee120fe105ecd525a821da7ad39cf1c9ca3b43ef46dec25b6a83cb` |
| `statusline-configure-native打开的内部TUI展示/Linux/Screenshot From 2026-10-07 19-37-08.png` | [tui/native/linux/layout.png](tui/native/linux/layout.png) | 1009×729 | `b18a6d0625c30245efdff61bc11580cf49da1498d8da2164df05234f310fe3ea` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195919.png` | [tui/native/windows/main.png](tui/native/windows/main.png) | 1634×1165 | `3f3e8e079c2cb347c0ccead1134748fa7e77d4bddae3c3028a6b595e58631cd8` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195934.png` | [tui/native/windows/subagents.png](tui/native/windows/subagents.png) | 1629×1160 | `41c9a07bad74b88f7f1cbc0a5aaa84c3a85bf389b5613940c929f74227622261` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 195951.png` | [tui/native/windows/settings.png](tui/native/windows/settings.png) | 1629×1167 | `7a64fd05dfd96a5ed0a9d9c8e5e0fcc165facf4cd811496744ac91742cc00f3b` |
| `statusline-configure-native打开的内部TUI展示/Windows/屏幕截图 2026-10-07 200002.png` | [tui/native/windows/layout.png](tui/native/windows/layout.png) | 1628×1159 | `4d5f47308447b73b8a7e326157354b2a3ff1fd3f3ce3842376aa2ed3a16fdb16` |
| `statusline-configure-native打开的内部TUI展示/macOS/屏幕截图 2026-10-07 203809.png` | [tui/native/macos/main.png](tui/native/macos/main.png) | 1278×931 | `154cdd288166e0c440a76259ae735bc8ad2a08141253d44fd0bb5f2349b0e26e` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-20.png` | [tui/external/linux/main.png](tui/external/linux/main.png) | 1079×732 | `43c46bc311172520832b5752547a9c6a5126eefdc97c44cb1ce5231e9db5b263` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-26.png` | [tui/external/linux/subagents.png](tui/external/linux/subagents.png) | 1079×732 | `6265f3cdf3ce6eaa28111da2f20f0b1fa8b5d6404d1af59142be2f3c35b49f86` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-32.png` | [tui/external/linux/settings.png](tui/external/linux/settings.png) | 1079×732 | `0ff095e837fcf80941d6dae0636e8c2a2a3761ebc4311dba4673e54b74996cdc` |
| `statusline-configure打开的外部TUI展示/Linux/Screenshot From 2026-10-07 19-38-37.png` | [tui/external/linux/layout.png](tui/external/linux/layout.png) | 1079×732 | `cd6199536efe9904f0d1c861e01538bf5e7783313d01de9faca8c30274b7ba20` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200100.png` | [tui/external/windows/main.png](tui/external/windows/main.png) | 1632×1163 | `fcb2139cdc67938b51b5bca2cb8687a0471636c15e31d45a99d2d8e3b727e0c2` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200110.png` | [tui/external/windows/subagents.png](tui/external/windows/subagents.png) | 1629×1163 | `f72372ea786a5a3fa1f008cf4a9bc2b590c31aadc138318fcd45d80cf61e4c50` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200120.png` | [tui/external/windows/settings.png](tui/external/windows/settings.png) | 1629×1162 | `448fe8539f791b98009196d5fb42028f892466cb378811b4ee306475e985bfb9` |
| `statusline-configure打开的外部TUI展示/Windows/屏幕截图 2026-10-07 200137.png` | [tui/external/windows/layout.png](tui/external/windows/layout.png) | 1625×1163 | `bc400e643217e9b1f1cf365478b80d8f1bfa2f2f1c0e9a30b408f6db25bb22aa` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203857.png` | [tui/external/macos/main.png](tui/external/macos/main.png) | 1292×842 | `1822b19c3807cc4a3b84c69cc42441dcade2f8891c56a42627dbf07a1f280969` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203909.png` | [tui/external/macos/subagents.png](tui/external/macos/subagents.png) | 1287×848 | `33f6dc1501a6aa394561e2f1febf6a8290a2983ca1d7bc8e4e4482090b1b2109` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203920.png` | [tui/external/macos/settings.png](tui/external/macos/settings.png) | 1289×846 | `207637fb8365b339ab054e83e4428c417aac4b2e9b910bffd1173e5a1f4e1c81` |
| `statusline-configure打开的外部TUI展示/macOS/屏幕截图 2026-10-07 203930.png` | [tui/external/macos/layout.png](tui/external/macos/layout.png) | 1291×843 | `dbdb3d1f0d9e820f23059deadd20f3da0c7edc7df425fd59ceaeecd5a49aa741` |

</details>

## Updating screenshots

- Use lowercase English filenames grouped by entry, platform and page.
- Update both READMEs, related guides, indexes and hashes together; preserve sources and archive replaced images.
- Preserve historical capture versions, filenames, commits and metadata; replacement batch dates are not capture dates.
- `MANIFEST.in` includes Markdown and PNG files; distribution inspection verifies source-package completeness.

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
<a id="current-images"></a>

## Historical provenance

Original captures, hashes and acceptance scope for older links remain in the [archive index](archive/README.md).

## Theme terminal captures

Two additional Linux images were reconstructed on 2026-10-09 from actual Claude Code 2.1.294 truecolor PTY cells, cropped to the native editor. They are agent-inspected terminal captures, separate from the 21 original screenshots and from human acceptance. Source commit: `bb687df044d7e875c4817d9b1fc8c905749834bc`; viewport 120×30; OS Linux x86_64. All pages, forms and separate theme Apply are checked at both 120×30 and 80×48. Raw cells and private session logs stay in ignored validation directories.

| Theme | Capture | Size | PNG SHA256 | Cell SHA256 |
| --- | --- | --- | --- | --- |
| light | [main-light.png](tui/native/linux/themes/main-light.png) | 888×576 | `08eee7ab45ad74814280c770c2c51c4772456382e1d80ff7c75edcb166205b11` | `0d74c602d9b8dc21e05349fcb9c1be65eba07b79c1518d85705b3a082f19686d` |
| dark | [main-dark.png](tui/native/linux/themes/main-dark.png) | 888×576 | `ec5292f49b7adc18089d02ea94dab021c25a01e025ef5ea5177c36183da9908b` | `1bed1c71d5956fe7a4b3eab602bc2ed4b2b57d85db77523babb7038684807433` |

## External terminal color captures

These images reconstruct actual external TUI output from source commit `416862536f775f603a83812283ea2ea104a81699`, captured on 2026-10-09 in dedicated light/dark GNOME Terminal 3.58.0 / VTE 0.84.0 profiles attached to isolated tmux 3.6 servers. The installed 1.7.7 wheel was built from that exact commit, on Linux x86_64 / Python 3.14.4; each pane is 120×30.

The light profile uses foreground `#17191e` and background `#ffffff`; the dark uses `#dedee7` and `#17191e`. Both copy the original default profile's GNOME ANSI palette with bold-is-bright disabled, recording its values in the capture. Previews inherit the terminal background and show the selected production palette; the default and ANSI screenshots show genuine palette differences, with capability-quantized RGB samples. ANSI was selected in the unsaved draft, then cancellation preserved configuration bytes. Chrome and reversed selections passed 4.5:1 contrast checks; sample colors are preserved so users can see low contrast and compare palettes.

These are terminal reconstructions, not OS screenshots or human acceptance; GNOME Shell denied the earlier screenshot API attempt. Raw ANSI, decoded cells and reports remain in ignored `dist/validation/v1.7.7-terminal-source/gnome`. `tools/render_native_capture.py` reads the recorded defaults and ANSI palette. Separate five-size light/dark PTY suites check four pages/forms, palette changes, Colors off and saved ANSI production output. Temporary terminal profiles/windows/servers were removed and the original default profile was preserved. Later documentation-only commits retain the tested implementation.

| Terminal / Palette | Image | Captured JSON SHA256 | PNG SHA256 |
| --- | --- | --- | --- |
| light / default | [PNG](tui/external/linux/themes/main-light.png) | `1bb05a06b8bf6f2467c796b82660945cac875cee0e129787fe99a8a7a6d5920c` | `caa98e74e0a80184d56f02289e3778cd2f713604b027bca83a2ca1686fb45af9` |
| light / ansi | [PNG](tui/external/linux/themes/main-light-ansi.png) | `6c0bddf026f8ff427f3b38a8c245c2b7b6268ddea87c04ff2e79b6b52406949e` | `ea5fb0ccfba335d9be038279a0dd4ed298b2eb7d4c38e4c3b19f682401771a0e` |
| dark / default | [PNG](tui/external/linux/themes/main-dark.png) | `02bd6e45ae4efcf5979074866abc5b51d50ebe6a0594fe71f8972ee8a9668261` | `cedcc3feab9b0033ed72a6cc82033b4230af92523ec722fff837b257f28fe59a` |
| dark / ansi | [PNG](tui/external/linux/themes/main-dark-ansi.png) | `80b25a3042908729de992824766213ac3fe9afe0eb5851c803553d3ae1f60c47` | `12d8ce4335261e9d06b9f3d83bb7ce709b56d6deff222563388f3866e5b5aa38` |

## Native preview background captures

Eight native-editor PNGs were reconstructed on 2026-10-09 from Claude Code 2.1.295 terminal cells on Linux x86_64 / Python 3.14.4 at source commit `12fbbdc9054b33875179b4feb94639b1872d9e13`. Each 120×30 capture is cropped to 888×576 editor pixels; separate 80×48 inline runs check compact rendering. The terminal default foreground/background and xterm ANSI palette are explicit analysis fixtures independent of the Claude theme. The matching preview background is selected through the real UI, and both default/ANSI palettes, Colors off, all pages/forms, preference persistence and separate theme Apply are verified. These are terminal reconstructions, not OS screenshots, physical profile measurements or new human acceptance. Raw logs/cells stay in ignored `dist/validation/v1.7.8-preview-*` directories. Later documentation-only commits retain the same runtime source.

| Terminal / theme / palette | Image | Cell JSON SHA256 | PNG SHA256 |
| --- | --- | --- | --- |
| light / light / default | [light-terminal-light-theme-default.png](tui/native/linux/preview-backgrounds/light-terminal-light-theme-default.png) | `e911e3f5013863220c9a2a75e0d1db2bb084d89230a6f2f5bc69b1dbe29d8a91` | `86b63f913fa2d7444f4aa59136a13b3b11554e1660af204f11994a5baf22c4b1` |
| light / light / ansi | [light-terminal-light-theme-ansi.png](tui/native/linux/preview-backgrounds/light-terminal-light-theme-ansi.png) | `2fba1791bf0da4e140db326109e58ed6d78fb181cf2b53cdb58e0ac5f6d9ea4a` | `52af8ac4e6121de77dcd9b0c616b3dc61ae8dcff0c61bf440c9168a76531ac3d` |
| light / dark / default | [light-terminal-dark-theme-default.png](tui/native/linux/preview-backgrounds/light-terminal-dark-theme-default.png) | `6b1cd7496a47d67dd9a447ef316e4df9bee775265ae361813e88cb623d1d56b9` | `220c0026f7fbe37c011af6cc6e0c4f29d844c98645c8aa97f8bd0d284fee0fcc` |
| light / dark / ansi | [light-terminal-dark-theme-ansi.png](tui/native/linux/preview-backgrounds/light-terminal-dark-theme-ansi.png) | `9e7085ed93622cf54701ef09bcd4d34cb970a2439e928582880fe5152f4be628` | `3a14cd386343854cebbcd26f47dca4a696a95f15cbad37b23622bcdd7b298795` |
| dark / light / default | [dark-terminal-light-theme-default.png](tui/native/linux/preview-backgrounds/dark-terminal-light-theme-default.png) | `7ab437cba95320c5fb6b875713ff6ab837c5713915065c9ea392d35808791da5` | `b33f7aff1f6c9cab403a1ed875ef8f9842903d01bc2d3adcfbc2caa8b4a930bd` |
| dark / light / ansi | [dark-terminal-light-theme-ansi.png](tui/native/linux/preview-backgrounds/dark-terminal-light-theme-ansi.png) | `2b6bafc7e024791d07eb8cbc4ded4c7d725bd784c5a1ac9a5093b67f68601703` | `e6a7681d2aee8a4a58f2dc4b5f84f4ef01ad98eadc88b2aec402a37c6e05b67e` |
| dark / dark / default | [dark-terminal-dark-theme-default.png](tui/native/linux/preview-backgrounds/dark-terminal-dark-theme-default.png) | `5b3e2d51cd720749b66e6b6360bae31d4546eff4cbce006628e3d07f9bc90a5f` | `768290a494ec034306b8175ef05a61beb47cce960375e7c316658eb994cf36b3` |
| dark / dark / ansi | [dark-terminal-dark-theme-ansi.png](tui/native/linux/preview-backgrounds/dark-terminal-dark-theme-ansi.png) | `aff6d18cf76c41674ff1d4cc8fd5703cd95595d3fe8e4ad81c8038f858fd5508` | `67c58224889ab4e2429552b4697cd0a4041d00e6eebab3aa3303c9d37339d024` |

## Bilingual terminal captures

Ten images under `tui/{native,external}/linux/languages/` reconstruct actual installed-package PTY output captured on 2026-10-09, source `19c74739a5bc45ec93258a52dcc0a800228497d5`. The implementation candidate still reported 1.7.8 before the release version promotion; its interface implementation is retained in 1.8.0. Environment: Linux 7.0.0-38-generic x86_64, CPython 3.14.4, Claude Code 2.1.295, pyte decoder and `tools/render_native_capture.py`; 120×30 terminal, native docked crop (72 columns), full external crop. The original 21 physical screenshots and historical PNGs retain their bytes.

Native captures use an explicit light terminal/background fixture with the Claude light theme and tmux 3.6; the host emits quantized 256-color samples in this path. External captures use the dark terminal-default fixture and documented xterm palette. These analysis fixtures do not read a physical terminal's exact defaults. Preview content is fixed data, unchanged by translation. PNG metadata records source commit, capture SHA256 and cell bounds; fonts are DejaVu Sans Mono, Noto Sans CJK and Noto Sans Symbols 2. Native transcript/composer/private paths are cropped away. Agent visual inspection found the selected field, grouped pages, language autonyms and shortcut rows aligned, without old-language residue after full repaint. Automated/agent inspection is separate from human and Windows/macOS terminal acceptance.

| Surface / page / language | Image | PNG SHA256 |
| --- | --- | --- |
| native/main-zh-CN | [PNG](tui/native/linux/languages/main-zh-CN.png) | `31f213011e040b1452966b603153393b39ce0ce9d33301a8059eea6a0daceeb2` |
| native/subagents-zh-CN | [PNG](tui/native/linux/languages/subagents-zh-CN.png) | `994a981a60de6195fc2108b77cbd6ee3abd1fdd72c6e18a18d8d73b1e21fe868` |
| native/settings-zh-CN | [PNG](tui/native/linux/languages/settings-zh-CN.png) | `b77825bdf985cdb484cb0b5b5c7de41bc1198ae8262409b4f8cb9cca5717be35` |
| native/layout-zh-CN | [PNG](tui/native/linux/languages/layout-zh-CN.png) | `39c7a16f648c7c783474a837962a4b42a604a20ba948461235e619ff2de537db` |
| native/settings-en | [PNG](tui/native/linux/languages/settings-en.png) | `933b3fc7d7951d76fb42a1220142fb50ef6e3530ce4c72f9dc2d42e2a08c2a7a` |
| external/main-zh-CN | [PNG](tui/external/linux/languages/main-zh-CN.png) | `41e68336970c0e3ad000b9f41db00f9699fb24264fa8aa7a3626dd88f05d9384` |
| external/subagents-zh-CN | [PNG](tui/external/linux/languages/subagents-zh-CN.png) | `8c3574a8e8bffb30eea7ffba960ff37d4885fdded4d5a640418bfdbbb5472149` |
| external/settings-zh-CN | [PNG](tui/external/linux/languages/settings-zh-CN.png) | `113166e0bb2d6c70d52d324107c311f5d9691e8380d4e4d9af3f4779c656c53c` |
| external/layout-zh-CN | [PNG](tui/external/linux/languages/layout-zh-CN.png) | `e8c04500d3a099ef51bbcbae34249a7561f3fe75c325122f0e555c9dc1f747eb` |
| external/settings-en | [PNG](tui/external/linux/languages/settings-en.png) | `2e12522cf59a1fd4403d07b4e0c194870f51156041fa81ba804b8169a25888c8` |

The raw captures/reports remain private in ignored `dist/validation/i18n`; screenshots are reconstructed output, not new OS screenshots. The external English selector was captured after switching back from Chinese to force a complete terminal repaint. [Behavior and commands](../USER_GUIDE.md#interface-language).

## Statusline language captures

These eight images reconstruct actual terminal cells, using fixed data rather than live user observations. Backend UI/render source `0786ad2` was packaged as development 1.8.0; native harness `bc50d80` passed with fixed Claude Code 2.1.294 on Linux x86_64 / CPython 3.14.4. Native images crop a 120×30 light-theme terminal to the pane; the multiplexer quantizes RGB to 256 colors. External images use the full 120×30 dark terminal with colors off. Production images capture real renderer stdout on a 100×4 PTY and crop its first two rows. Interface/output language independence is visible in English chrome with Chinese output. Agent image inspection is separate from human or Windows/macOS terminal acceptance. Raw logs/cells stay ignored.

| Capture | PNG SHA-256 |
| --- | --- |
| [Native main / English output](tui/native/linux/statusline-languages/main-en.png) | `033434791c721d6b50bf580f6ab3325898d0cb627d8f0865f13651f226e6c135` |
| [Native main / Chinese output](tui/native/linux/statusline-languages/main-zh-CN.png) | `f349a37ddf851da1e7de0c255c9f7ce949cc783688848f9ea8ae6b5913b131a9` |
| [Native output language / English](tui/native/linux/statusline-languages/settings-en.png) | `0d0c53b9d7158696510c668c4c1fdd5d376ec039055d087ef5e1609efa20f130` |
| [Native output language / Chinese](tui/native/linux/statusline-languages/settings-zh-CN.png) | `3ea6894f3d820d3aba9b5339851b65d4b0077da739c900090ea0061c6f580188` |
| [External output language / English](tui/external/linux/statusline-languages/settings-en.png) | `fe5f01fb644d33bfdcb61aa49aa932c80151364b89f08650857517607df02749` |
| [External output language / Chinese](tui/external/linux/statusline-languages/settings-zh-CN.png) | `2dc86d94fdfadc9dc9d76f61c4fa28ab0d8721d8735d2cf8e479650c9b23e85d` |
| [Actual CLI output / English](statusline/linux/en.png) | `760eb877e851f044590d5adc0ac1b3ff93e155041c6c96c960ad42cd86fb807f` |
| [Actual CLI output / Chinese](statusline/linux/zh-CN.png) | `129ab6478728c3636a2e220aee2ca26c1598d62c3a9c06590bd1e6c4a2ab1692` |


<a id="discovery-and-import-review"></a>

## Discovery and import review

These sixteen PNGs reconstruct actual installed-editor terminal cells from `469c08cbf10526898178d2177a6ffa4f1206ad99` (Linux x86_64, CPython 3.14.4, backend 1.10.0). Native captures use the officially installed Mod on fixed Claude Code 2.1.294 in a direct PTY, avoiding multiplexer RGB conversion. The captured viewports are 120×30; external acceptance also covers 64×18, 64×20, 80×24 and 80×48 in both languages, and native acceptance covers 80×48.

Only the editor is shown: native crops exclude the transcript, composer, live model and private paths. Preview values are fixed samples. Search/guidance examples retain English output independently of interface language; imported candidates choose Chinese output. These are terminal reconstructions, not OS screenshots or human platform acceptance. All sixteen images were inspected for text, clipping, selection and preview readability. Raw cells/logs remain in ignored validation directories.

| Feature | External English | External Chinese | Native English | Native Chinese |
| --- | --- | --- | --- | --- |
| Ranked search | [PNG](discovery/external/search-en.png) | [PNG](discovery/external/search-zh-CN.png) | [PNG](discovery/native/search-en.png) | [PNG](discovery/native/search-zh-CN.png) |
| Category filter | [PNG](discovery/external/category-en.png) | [PNG](discovery/external/category-zh-CN.png) | [PNG](discovery/native/category-en.png) | [PNG](discovery/native/category-zh-CN.png) |
| Sources and requirements | [PNG](discovery/external/guidance-en.png) | [PNG](discovery/external/guidance-zh-CN.png) | [PNG](discovery/native/guidance-en.png) | [PNG](discovery/native/guidance-zh-CN.png) |
| Import differences | [PNG](discovery/external/review-en.png) | [PNG](discovery/external/review-zh-CN.png) | [PNG](discovery/native/review-en.png) | [PNG](discovery/native/review-zh-CN.png) |

<details>
<summary>PNG and raw-capture SHA-256 / PNG 与原始捕获 SHA-256</summary>

| File | PNG SHA-256 | Capture SHA-256 |
| --- | --- | --- |
| [discovery/external/search-en.png](discovery/external/search-en.png) | `57ab60de6238b46432b50a053fe893d4f65eab8472c8e71f3530a6c0e36ed900` | `239ebe44262c22712ef8e06ad178fa43745f4a41105c645c965ce9d7644a2103` |
| [discovery/external/category-en.png](discovery/external/category-en.png) | `13710ad5b99a487ac0fa020fdc138d7442abb7a975ac4513d1e94322aa9183fb` | `92581021434ac3af09e49ec1c74fc79f069d038e31fe9c724db667eda2cb072a` |
| [discovery/external/guidance-en.png](discovery/external/guidance-en.png) | `25ab521f4578acd231063149aa36bd4f8ca6d2a377990479376e55bf8464c8e0` | `d0e4dfa6b7f7745819a9d80e19306f5493ba5c5b41fdfc56aff67f461cd5bc9e` |
| [discovery/external/review-en.png](discovery/external/review-en.png) | `2240e6bf0ba390750a81c9264182d1c89ee9b2d17ae641b392d29403c25a3fcc` | `2d48acfbc37577b6f68fa84b3386d595211d2c43bad5310351f9ba7a9aead188` |
| [discovery/external/search-zh-CN.png](discovery/external/search-zh-CN.png) | `4b9cd7e613d513630790cf222cc0ae1ba56555cc2d73a367e4b4816921846510` | `0055e8ed49feef8d1cc6f40da3a7624d134528c96236052176259daceb81e45c` |
| [discovery/external/category-zh-CN.png](discovery/external/category-zh-CN.png) | `e38357d92a0aba3845bc60f650faec9b68e97bcb5a6d1d8e2244a192409d60f3` | `df2934638d84a31f953b0760653127e821e8aadf82fb9bd6cc1083708c8c839f` |
| [discovery/external/guidance-zh-CN.png](discovery/external/guidance-zh-CN.png) | `e50baca2cb73fe1ccba8eeae388dce09a03c776331fd8ad8c854647caae0ac3b` | `111b5f02cd9ad98179736f5e2d5a21bfd436ad8ae8e3a396238fd6e1af958c0c` |
| [discovery/external/review-zh-CN.png](discovery/external/review-zh-CN.png) | `6523c6390c27dac44d876d1a8b1434c14adf7aa5fa04bfa1863ce3602ae7f987` | `6ef035e278628f45e1b16cdcb3175a3b02f2f683a4186b3c28f7739997393ff0` |
| [discovery/native/search-en.png](discovery/native/search-en.png) | `7cd3211728f94ff11bc3fb3e45e357a583282854271350d555959663f4b34392` | `48f9b8c8fff7625710d2d0cadd4330cd2af3855e7a0554be9f0e3acf899a6055` |
| [discovery/native/category-en.png](discovery/native/category-en.png) | `ca080c2bd429b6ab80cc98b460e6ec585b07c22b89c44e0f56ad3308703224a2` | `111b5b0ba04f9e7f65ced90554c7080a320823f5c352c0784ec7bd7d9e21e101` |
| [discovery/native/guidance-en.png](discovery/native/guidance-en.png) | `b82af6762988cbbc499827770df01fcb92536d714621cdca01256408fc030736` | `a843cfce37a62ef9e954fbdc3983507e7993a8acc66581ce3985052e53d2cb26` |
| [discovery/native/review-en.png](discovery/native/review-en.png) | `ddf59835e9279c776cf087b220fa4986e8f1de350a96df24e01ee1a0252d5215` | `0e37e08c250330139523d53d6a6174249693da9d44cde09044ad8849933eafb4` |
| [discovery/native/search-zh-CN.png](discovery/native/search-zh-CN.png) | `577b38d508e550900a7a62deb459f4eea56367f0c3caadf939b156f4a4442754` | `1d0a58300069184cf4e20f384abfb41dca2219b9f97a1e66a3e4760bbb0a5cd7` |
| [discovery/native/category-zh-CN.png](discovery/native/category-zh-CN.png) | `44676e6e64dbe9ed16c32d9b4586ca1355dbbb52852c6cd3cbc18ce6babb0c00` | `e2823f421bdc38f83587fd829015e71985838ea033dfb5c51f28a1276aa75db1` |
| [discovery/native/guidance-zh-CN.png](discovery/native/guidance-zh-CN.png) | `b00f4bd1efe05f4d4e1e5db5cb3eea262d03c989232aa0e467d949782e960de4` | `99d5bb5140ea41fdc97b15d3e03a30436422983a09e751194cfb37a123b9aeee` |
| [discovery/native/review-zh-CN.png](discovery/native/review-zh-CN.png) | `9a2537723d3f7212576eb61078b9a8cb2413dd22d4e5aeeed0121777986b9a0f` | `5697b27f6c597c1b17ad5ca489af097f04f5a916e0b696431c9ecdc75a7311ab` |

</details>
