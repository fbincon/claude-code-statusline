# Taiwan and Hong Kong interface captures

**English** | [简体中文](README.zh-CN.md)

These images come from the installed v3.1.0 package at source `10de45895d2734a8ab1eacec09b57bc89417be51` and tgz SHA-256 `000ddea0e995034ec8040691e21c9cf3119e18b6508c4870bc55b95247591011`. They are agent-inspected terminal-cell reconstructions, not operating-system screenshots or new human desktop acceptance. [Machine-readable provenance](provenance.json) · [Validation and delivery](../../../development/node-regional-languages.md).

| Language | Native Client, dark / light | External pages, dark | External minimum / light |
| --- | --- | --- | --- |
| 繁體中文（台灣） | [Dark](native/zh-TW/dark.png) / [Light](native/zh-TW/light.png) | [Main](external/zh-TW/main.png), [Subagents](external/zh-TW/subagents.png), [Settings](external/zh-TW/settings.png), [Layout](external/zh-TW/layout.png) | [64×18](external/zh-TW/minimum.png) / [80×24](external/zh-TW/light.png) |
| 繁體中文（香港） | [Dark](native/zh-HK/dark.png) / [Light](native/zh-HK/light.png) | [Main](external/zh-HK/main.png), [Subagents](external/zh-HK/subagents.png), [Settings](external/zh-HK/settings.png), [Layout](external/zh-HK/layout.png) | [64×18](external/zh-HK/minimum.png) / [80×24](external/zh-HK/light.png) |

## Capture scope

Linux x64 and Node 24.21.0. External frames are actual installed-editor PTYs at 120×32, 80×24 and 64×18. Sessions cancel without changing settings/display bytes and restore terminal attributes. Their interface and sample-output languages match; home-relative directories and fixed production preview samples avoid live account data. Boundary frames select the production light/dark theme to match the terminal background.

Native common-size frames use the actual installed Client in official Claude 2.1.294, inside a 120×36 PTY. The visible right Client region is cropped to 72×29 cells; the transcript, composer and actual host status line are excluded. Capture uses isolated temporary configuration, a synthetic key and an unreachable loopback API. Light captures switch the independent preview background to light. ANSI is decoded with `@xterm/headless 6.0.0` before rendering with the repository TypeScript renderer. No paid model calls or personal configuration changes occur.

Native 32×12 boundaries below reconstruct the installed component from synthetic view state. They are component evidence, distinct from the actual-host PTYs above. Official Client tests also exercise these boundaries. Deliberate paging, abbreviated hints and whole-grapheme ellipses remain at minimum sizes; no new overlap or broken Unicode was observed.

| Language | Native component minimum, dark / light |
| --- | --- |
| 繁體中文（台灣） | [Dark](native/zh-TW/minimum-dark.png) / [Light](native/zh-TW/minimum-light.png) |
| 繁體中文（香港） | [Dark](native/zh-HK/minimum-dark.png) / [Light](native/zh-HK/minimum-light.png) |

The complete final-package capture set contains 24 external page frames, 32 external boundary frames, 20 native component frames and four actual-host native frames. This gallery selects twenty images. Regional search, save/cancel/reopen, failed writes and the 36 independent UI/output combinations have separate automated coverage. Existing physical, desktop and exact-declaration gaps remain disclosed in the delivery report. Host transport can quantize dark native preview colors; these observations do not change a desktop theme. Raw ANSI, cells, collector scripts and receipts remain outside the repository. Older [Python language captures](../../languages/README.md) and [TypeScript preparation captures](../README.md) retain their original provenance.

## PNG integrity

| File | Pixels | SHA-256 |
| --- | --- | --- |
| [external/zh-TW/main.png](external/zh-TW/main.png) | 1464×792 | `e575309c00e18b8018cf9a93ecff62d46705d585779569a7b9c0c18dc21f7d8f` |
| [external/zh-TW/subagents.png](external/zh-TW/subagents.png) | 1464×792 | `4a18a0cc93bb00d7b66978f927ad936b856c84e31919de624a802c302608c6df` |
| [external/zh-TW/settings.png](external/zh-TW/settings.png) | 1464×792 | `68dd68d92420e190fbcca67d416fe8ed21bba92fe8a0fdf29266e73a4b505db4` |
| [external/zh-TW/layout.png](external/zh-TW/layout.png) | 1464×792 | `a2e97de81040be4fc2a002835e387254a28b1d0f86140cae4186107bee8e28bb` |
| [external/zh-TW/minimum.png](external/zh-TW/minimum.png) | 792×456 | `f584eb1d9fc2cb0aeadd94bfa77cec2b6b85d83e125dc85ab6e04b9fd9b773a6` |
| [external/zh-TW/light.png](external/zh-TW/light.png) | 984×600 | `35ecfdee70dd02edc8ca40b95e2a0c6963966c347493beff9bbb9c0825edba5d` |
| [native/zh-TW/dark.png](native/zh-TW/dark.png) | 888×720 | `9398a01279bcb1b1f45c49e17a235f39aa9bb4b70fe9347f94d1ca8d13f1dbbc` |
| [native/zh-TW/minimum-dark.png](native/zh-TW/minimum-dark.png) | 408×312 | `74c00ac5ea134b9af555d48b7495de546ff5babf56c4180f3aef2c7a7d289773` |
| [native/zh-TW/light.png](native/zh-TW/light.png) | 888×720 | `1b0d46929b9b1a7af48b99734b04a84bbf86ae80c590e21b7876475e0e11045f` |
| [native/zh-TW/minimum-light.png](native/zh-TW/minimum-light.png) | 408×312 | `a8cdfd7aa3ec65000a5315ac5e2afc91a176eb1946a8b5326c87280cc4a4f643` |
| [external/zh-HK/main.png](external/zh-HK/main.png) | 1464×792 | `7dea82c34867365b4d7585c8b27c0df68e98822139db13b9d9dc540b04c4e2ee` |
| [external/zh-HK/subagents.png](external/zh-HK/subagents.png) | 1464×792 | `e4fff0185db938f2bc5425eb041b6051740239cb28c33726ceef9436262de506` |
| [external/zh-HK/settings.png](external/zh-HK/settings.png) | 1464×792 | `82ff691a3c9102c81e3eb2327a9b85f6f4613876bfd2d27b1ebec37fcfd51979` |
| [external/zh-HK/layout.png](external/zh-HK/layout.png) | 1464×792 | `910558e715f3194bdbae03f0eff5423e5a63a44320113565bd7a7f14a0ad9fcb` |
| [external/zh-HK/minimum.png](external/zh-HK/minimum.png) | 792×456 | `07d07ffa78a8ffba1fb3840a4f6dd3e51920136e716d2b372d59e91997c9871e` |
| [external/zh-HK/light.png](external/zh-HK/light.png) | 984×600 | `0de6db178032f7e50ed4e74ecdbea7fc079055eaf893c69bea4d42f85275c108` |
| [native/zh-HK/dark.png](native/zh-HK/dark.png) | 888×720 | `def38ad79b4b7cea8118a435d0430153608cc630c7b7401f640244e753dd9c5f` |
| [native/zh-HK/minimum-dark.png](native/zh-HK/minimum-dark.png) | 408×312 | `809aea1fb31dd783c7f807b194c945366a1c7cca361c0f7faf340eaa714dd528` |
| [native/zh-HK/light.png](native/zh-HK/light.png) | 888×720 | `4b72f2a1386a57552456f4ff95cdf2b4580f21642964eb2ede5a37058df50d4a` |
| [native/zh-HK/minimum-light.png](native/zh-HK/minimum-light.png) | 408×312 | `a83359851626dfd4328c88378a01fd3d2cb8456977a24f8a2a297f4370b9d1c6` |
