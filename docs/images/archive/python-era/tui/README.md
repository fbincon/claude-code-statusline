# Python-era TUI terminal reconstructions

**English** | [简体中文](README.zh-CN.md)

**Status:** Frozen Python-era archive (v1.6.1–v1.8.0 reconstructions); not current product acceptance. These images were moved from the top-level TUI page; image bytes and hashes are unchanged. Back to the [Python-era archive](../README.md) and [image index](../../../README.md).

## Theme terminal captures

Two additional Linux images were reconstructed on 2026-10-09 from actual Claude Code 2.1.294 truecolor PTY cells, cropped to the native editor. They are agent-inspected terminal captures, separate from the 21 original screenshots and from human acceptance. Source commit: `bb687df044d7e875c4817d9b1fc8c905749834bc`; viewport 120×30; OS Linux x86_64. All pages, forms and separate theme Apply are checked at both 120×30 and 80×48. Raw cells and private session logs stay in ignored validation directories.

| Theme | Capture | Size | PNG SHA-256 | Cell SHA-256 |
| --- | --- | --- | --- | --- |
| light | [main-light.png](native/linux/themes/main-light.png) | 888×576 | `08eee7ab45ad74814280c770c2c51c4772456382e1d80ff7c75edcb166205b11` | `0d74c602d9b8dc21e05349fcb9c1be65eba07b79c1518d85705b3a082f19686d` |
| dark | [main-dark.png](native/linux/themes/main-dark.png) | 888×576 | `ec5292f49b7adc18089d02ea94dab021c25a01e025ef5ea5177c36183da9908b` | `1bed1c71d5956fe7a4b3eab602bc2ed4b2b57d85db77523babb7038684807433` |

## External terminal color captures

These images reconstruct actual external TUI output from source commit `416862536f775f603a83812283ea2ea104a81699`, captured on 2026-10-09 in dedicated light/dark GNOME Terminal 3.58.0 / VTE 0.84.0 profiles attached to isolated tmux 3.6 servers. The installed 1.7.7 wheel was built from that exact commit, on Linux x86_64 / Python 3.14.4; each pane is 120×30.

The light profile uses foreground `#17191e` and background `#ffffff`; the dark uses `#dedee7` and `#17191e`. Both copy the original default profile's GNOME ANSI palette with bold-is-bright disabled, recording its values in the capture. Previews inherit the terminal background and show the selected production palette; the default and ANSI screenshots show genuine palette differences, with capability-quantized RGB samples. ANSI was selected in the unsaved draft, then cancellation preserved configuration bytes. Chrome and reversed selections passed 4.5:1 contrast checks; sample colors are preserved so users can see low contrast and compare palettes.

These are terminal reconstructions, not OS screenshots or human acceptance; GNOME Shell denied the earlier screenshot API attempt. Raw ANSI, decoded cells and reports remain in ignored `dist/validation/v1.7.7-terminal-source/gnome`. `archive/python/tools/render_native_capture.py` reads the recorded defaults and ANSI palette. Separate five-size light/dark PTY suites check four pages/forms, palette changes, Colors off and saved ANSI production output. Temporary terminal profiles/windows/servers were removed and the original default profile was preserved. Later documentation-only commits retain the tested implementation.

| Terminal / Palette | Image | Captured JSON SHA-256 | PNG SHA-256 |
| --- | --- | --- | --- |
| light / default | [PNG](external/linux/themes/main-light.png) | `1bb05a06b8bf6f2467c796b82660945cac875cee0e129787fe99a8a7a6d5920c` | `caa98e74e0a80184d56f02289e3778cd2f713604b027bca83a2ca1686fb45af9` |
| light / ansi | [PNG](external/linux/themes/main-light-ansi.png) | `6c0bddf026f8ff427f3b38a8c245c2b7b6268ddea87c04ff2e79b6b52406949e` | `ea5fb0ccfba335d9be038279a0dd4ed298b2eb7d4c38e4c3b19f682401771a0e` |
| dark / default | [PNG](external/linux/themes/main-dark.png) | `02bd6e45ae4efcf5979074866abc5b51d50ebe6a0594fe71f8972ee8a9668261` | `cedcc3feab9b0033ed72a6cc82033b4230af92523ec722fff837b257f28fe59a` |
| dark / ansi | [PNG](external/linux/themes/main-dark-ansi.png) | `80b25a3042908729de992824766213ac3fe9afe0eb5851c803553d3ae1f60c47` | `12d8ce4335261e9d06b9f3d83bb7ce709b56d6deff222563388f3866e5b5aa38` |

## Native preview background captures

Eight native-editor PNGs were reconstructed on 2026-10-09 from Claude Code 2.1.295 terminal cells on Linux x86_64 / Python 3.14.4 at source commit `12fbbdc9054b33875179b4feb94639b1872d9e13`. Each 120×30 capture is cropped to 888×576 editor pixels; separate 80×48 inline runs check compact rendering. The terminal default foreground/background and xterm ANSI palette are explicit analysis fixtures independent of the Claude theme. The matching preview background is selected through the real UI, and both default/ANSI palettes, Colors off, all pages/forms, preference persistence and separate theme Apply are verified. These are terminal reconstructions, not OS screenshots, physical profile measurements or new human acceptance. Raw logs/cells stay in ignored `dist/validation/v1.7.8-preview-*` directories. Later documentation-only commits retain the same runtime source.

| Terminal / theme / palette | Image | Cell JSON SHA-256 | PNG SHA-256 |
| --- | --- | --- | --- |
| light / light / default | [light-terminal-light-theme-default.png](native/linux/preview-backgrounds/light-terminal-light-theme-default.png) | `e911e3f5013863220c9a2a75e0d1db2bb084d89230a6f2f5bc69b1dbe29d8a91` | `86b63f913fa2d7444f4aa59136a13b3b11554e1660af204f11994a5baf22c4b1` |
| light / light / ansi | [light-terminal-light-theme-ansi.png](native/linux/preview-backgrounds/light-terminal-light-theme-ansi.png) | `2fba1791bf0da4e140db326109e58ed6d78fb181cf2b53cdb58e0ac5f6d9ea4a` | `52af8ac4e6121de77dcd9b0c616b3dc61ae8dcff0c61bf440c9168a76531ac3d` |
| light / dark / default | [light-terminal-dark-theme-default.png](native/linux/preview-backgrounds/light-terminal-dark-theme-default.png) | `6b1cd7496a47d67dd9a447ef316e4df9bee775265ae361813e88cb623d1d56b9` | `220c0026f7fbe37c011af6cc6e0c4f29d844c98645c8aa97f8bd0d284fee0fcc` |
| light / dark / ansi | [light-terminal-dark-theme-ansi.png](native/linux/preview-backgrounds/light-terminal-dark-theme-ansi.png) | `9e7085ed93622cf54701ef09bcd4d34cb970a2439e928582880fe5152f4be628` | `3a14cd386343854cebbcd26f47dca4a696a95f15cbad37b23622bcdd7b298795` |
| dark / light / default | [dark-terminal-light-theme-default.png](native/linux/preview-backgrounds/dark-terminal-light-theme-default.png) | `7ab437cba95320c5fb6b875713ff6ab837c5713915065c9ea392d35808791da5` | `b33f7aff1f6c9cab403a1ed875ef8f9842903d01bc2d3adcfbc2caa8b4a930bd` |
| dark / light / ansi | [dark-terminal-light-theme-ansi.png](native/linux/preview-backgrounds/dark-terminal-light-theme-ansi.png) | `2b6bafc7e024791d07eb8cbc4ded4c7d725bd784c5a1ac9a5093b67f68601703` | `e6a7681d2aee8a4a58f2dc4b5f84f4ef01ad98eadc88b2aec402a37c6e05b67e` |
| dark / dark / default | [dark-terminal-dark-theme-default.png](native/linux/preview-backgrounds/dark-terminal-dark-theme-default.png) | `5b3e2d51cd720749b66e6b6360bae31d4546eff4cbce006628e3d07f9bc90a5f` | `768290a494ec034306b8175ef05a61beb47cce960375e7c316658eb994cf36b3` |
| dark / dark / ansi | [dark-terminal-dark-theme-ansi.png](native/linux/preview-backgrounds/dark-terminal-dark-theme-ansi.png) | `aff6d18cf76c41674ff1d4cc8fd5703cd95595d3fe8e4ad81c8038f858fd5508` | `67c58224889ab4e2429552b4697cd0a4041d00e6eebab3aa3303c9d37339d024` |

## Bilingual terminal captures

Ten images under `{native,external}/linux/languages/` reconstruct actual installed-package PTY output captured on 2026-10-09, source `19c74739a5bc45ec93258a52dcc0a800228497d5`. The implementation candidate still reported 1.7.8 before the release version promotion; its interface implementation is retained in 1.8.0. Environment: Linux 7.0.0-38-generic x86_64, CPython 3.14.4, Claude Code 2.1.295, pyte decoder and `archive/python/tools/render_native_capture.py`; 120×30 terminal, native docked crop (72 columns), full external crop. The original 21 physical screenshots and historical PNGs retain their bytes.

Native captures use an explicit light terminal/background fixture with the Claude light theme and tmux 3.6; the host emits quantized 256-color samples in this path. External captures use the dark terminal-default fixture and documented xterm palette. These analysis fixtures do not read a physical terminal's exact defaults. Preview content is fixed data, unchanged by translation. External PNG metadata records source commit, capture SHA-256 and cell bounds; native PNG metadata records source commit and capture SHA-256. Fonts are DejaVu Sans Mono, Noto Sans CJK and Noto Sans Symbols 2. Native transcript/composer/private paths are cropped away. Agent visual inspection found the selected field, grouped pages, language autonyms and shortcut rows aligned, without old-language residue after full repaint. Automated/agent inspection is separate from human and Windows/macOS terminal acceptance.

| Surface / page / language | Image | PNG SHA-256 |
| --- | --- | --- |
| native/main-zh-CN | [PNG](native/linux/languages/main-zh-CN.png) | `31f213011e040b1452966b603153393b39ce0ce9d33301a8059eea6a0daceeb2` |
| native/subagents-zh-CN | [PNG](native/linux/languages/subagents-zh-CN.png) | `994a981a60de6195fc2108b77cbd6ee3abd1fdd72c6e18a18d8d73b1e21fe868` |
| native/settings-zh-CN | [PNG](native/linux/languages/settings-zh-CN.png) | `b77825bdf985cdb484cb0b5b5c7de41bc1198ae8262409b4f8cb9cca5717be35` |
| native/layout-zh-CN | [PNG](native/linux/languages/layout-zh-CN.png) | `39c7a16f648c7c783474a837962a4b42a604a20ba948461235e619ff2de537db` |
| native/settings-en | [PNG](native/linux/languages/settings-en.png) | `933b3fc7d7951d76fb42a1220142fb50ef6e3530ce4c72f9dc2d42e2a08c2a7a` |
| external/main-zh-CN | [PNG](external/linux/languages/main-zh-CN.png) | `41e68336970c0e3ad000b9f41db00f9699fb24264fa8aa7a3626dd88f05d9384` |
| external/subagents-zh-CN | [PNG](external/linux/languages/subagents-zh-CN.png) | `8c3574a8e8bffb30eea7ffba960ff37d4885fdded4d5a640418bfdbbb5472149` |
| external/settings-zh-CN | [PNG](external/linux/languages/settings-zh-CN.png) | `113166e0bb2d6c70d52d324107c311f5d9691e8380d4e4d9af3f4779c656c53c` |
| external/layout-zh-CN | [PNG](external/linux/languages/layout-zh-CN.png) | `e8c04500d3a099ef51bbcbae34249a7561f3fe75c325122f0e555c9dc1f747eb` |
| external/settings-en | [PNG](external/linux/languages/settings-en.png) | `2e12522cf59a1fd4403d07b4e0c194870f51156041fa81ba804b8169a25888c8` |

The raw captures/reports remain private in ignored `dist/validation/i18n`; screenshots are reconstructed output, not new OS screenshots. The external English selector was captured after switching back from Chinese to force a complete terminal repaint. [Behavior and commands](../../../../USER_GUIDE.md#interface-language).

## Statusline language captures

These six editor images reconstruct actual terminal cells, using fixed data rather than live user observations. Backend UI/render source `0786ad2` was packaged as development 1.8.0; native harness `bc50d80` passed with fixed Claude Code 2.1.294 on Linux x86_64 / CPython 3.14.4. Native images crop a 120×30 light-theme terminal to the pane; the multiplexer quantizes RGB to 256 colors. External images use the full 120×30 dark terminal with colors off. The two actual CLI output images are documented in [statusline/README.md](../statusline/README.md). Interface/output language independence is visible in English chrome with Chinese output. Agent image inspection is separate from human or Windows/macOS terminal acceptance. Raw logs/cells stay ignored.

| Capture | PNG SHA-256 |
| --- | --- |
| [Native main / English output](native/linux/statusline-languages/main-en.png) | `033434791c721d6b50bf580f6ab3325898d0cb627d8f0865f13651f226e6c135` |
| [Native main / Chinese output](native/linux/statusline-languages/main-zh-CN.png) | `f349a37ddf851da1e7de0c255c9f7ce949cc783688848f9ea8ae6b5913b131a9` |
| [Native output language / English](native/linux/statusline-languages/settings-en.png) | `0d0c53b9d7158696510c668c4c1fdd5d376ec039055d087ef5e1609efa20f130` |
| [Native output language / Chinese](native/linux/statusline-languages/settings-zh-CN.png) | `3ea6894f3d820d3aba9b5339851b65d4b0077da739c900090ea0061c6f580188` |
| [External output language / English](external/linux/statusline-languages/settings-en.png) | `fe5f01fb644d33bfdcb61aa49aa932c80151364b89f08650857517607df02749` |
| [External output language / Chinese](external/linux/statusline-languages/settings-zh-CN.png) | `2dc86d94fdfadc9dc9d76f61c4fa28ab0d8721d8735d2cf8e479650c9b23e85d` |
