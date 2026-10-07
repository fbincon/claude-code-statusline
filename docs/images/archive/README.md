# Archived screenshots and terminal captures

**English** | [简体中文](README.zh-CN.md)

This archive preserves 51 images from earlier documentation and their original provenance. The [current image index](../README.md) lists the new in-session and external TUI screenshots. Historical reports below retain their original dates and scope; moving a file does not create a new acceptance result.

## Gallery replacement batch

The [18-image gallery replaced on 2026-10-07](screenshots/replaced-2026-10-07/README.md) preserves the former main status lines, in-session Main screenshots and four-page external galleries with their original filenames and PNG hashes. Replacement dates do not change capture dates or acceptance claims.

<a id="界面截图"></a>

Screenshots appear in the [project README](../../../README.md#screenshots). Main status line images come from actual Claude sessions; configuration `Preview (sample data)` uses fixed samples. The two Subagents previews are not evidence of acceptance testing with real parallel agents.

<a id="文件索引"></a>

## File index

| Platform | Main status line | Main | Subagents | Settings |
| --- | --- | --- | --- | --- |
| Linux | [statusline.png](screenshots/replaced-2026-10-07/statusline/linux.png) | [configure-main.png](screenshots/external/linux/main.png) | [configure-subagents.png](screenshots/external/linux/subagents.png) | [configure-settings.png](screenshots/external/linux/settings.png) |
| macOS | [statusline-macos.png](screenshots/replaced-2026-10-07/statusline/macos.png) | [configure-main-macos.png](screenshots/external/macos/main.png) | [configure-subagents-macos.png](screenshots/external/macos/subagents.png) | [configure-settings-macos.png](screenshots/external/macos/settings.png) |
| Windows | [statusline-windows.png](screenshots/replaced-2026-10-07/statusline/windows.png) | [configure-main-windows.png](screenshots/external/windows/main.png) | [configure-subagents-windows.png](screenshots/external/windows/subagents.png) | [configure-settings-windows.png](screenshots/external/windows/settings.png) |

## In-session Client screenshots

The maintainer supplied these actual terminal screenshots on 2026-10-04. They show the Client Main page inside an existing Claude Code session, together with the conversation, input area and main status line. All three visibly show Claude Code 2.1.289. Backend version, source commit, exact OS version, architecture and terminal version were not supplied and remain unknown.

| Platform | Screenshot | Dimensions | Maintainer's interaction report |
| --- | --- | --- | --- |
| Linux | [client-session-linux.png](screenshots/native/linux/session.png) | 1414×874 | Normal interaction |
| Windows | [client-session-windows.png](screenshots/native/windows/session.png) | 1792×1202 | Normal interaction |
| macOS | [client-session-macos.png](screenshots/native/macos/session.png) | 1347×892 | Pane opens; interaction problems; working setup unverified |

Original filenames were `linux.png`, `windows.png` and `macOS.png`, respectively. The PNG bytes, dimensions and colors are preserved without cropping or redrawing. Original session text, including earlier command and connection messages, is retained. Client Preview uses fixed sample data. The screenshots show layout; interaction results come from the maintainer's separate report. Suggested macOS checks are in the [user guide](../../USER_GUIDE.md#macos-mouse-reporting-and-client-focus); current feedback is recorded separately from historical acceptance in [native development](../../development/native.md#claude-code-21289-interaction-report).

<a id="展示说明"></a>

## Display notes

Linux, macOS, and Windows each show the main status line and Main, Subagents, and Settings configuration pages. macOS / Windows images use platform suffixes; PNG contents, dimensions, and colors are preserved.

macOS images show Terminal.app; Windows images show Windows Terminal.

Each screenshot reflects its own terminal session, layout, and settings. Display items, palette, fonts, and window width may differ.

<a id="更新约定"></a>

## Updating screenshots

The following filename convention describes the archived assets. New screenshots follow the [current directory conventions](../README.md#updating-screenshots).

- Use PNG and lowercase English filenames, with `-macos` / `-windows` platform suffixes.
- Keep status lines and configuration pages legible; update README references and this index together.
- `MANIFEST.in` includes this directory's Markdown and PNGs in the source distribution; CI checks packaging completeness.

## Native editor captures

### v1.3.0a1 preview captures

[Main](reconstructions/v1.3.0a1/linux/native-main-v1.3.0a1-linux.png) · [Subagents](reconstructions/v1.3.0a1/linux/native-subagents-v1.3.0a1-linux.png) · [Settings](reconstructions/v1.3.0a1/linux/native-settings-v1.3.0a1-linux.png)

These PNGs reconstruct real decoded cells from Linux x86_64, Claude Code 2.1.288, backend 1.3.0a1 and a persistent official plugin at clean source commit `4cd97dd480aa0025fb9edc7644b872bf3fa6336b` (2026-10-04). The docked terminal measured 120×30; the same automated run also checked 80×48 inline operation. The renderer crops transcript/composer content and embeds the commit and capture hash. Values are production sample data; these are terminal reconstructions, not OS pixel screenshots or mockups. The capture source stays in ignored `dist/validation/native-usability-capture-288`. The maintainer subsequently confirmed a1 human acceptance on all three platforms; a2 Client acceptance is separate.

### v1.2.0 captures

[Main](reconstructions/v1.2.0a1/linux/native-main-linux.png) · [Subagents](reconstructions/v1.2.0a1/linux/native-subagents-linux.png) · [Settings](reconstructions/v1.2.0a1/linux/native-settings-linux.png)

These three PNGs reconstruct decoded cells captured from a real Linux x86_64 Claude Code 2.1.288 terminal at 120 columns, using the persistent official plugin installation and backend 1.2.0a1 at clean code commit `db4129b75dcc3aa20fc24bbb09946e249038ee2e` (2026-10-04). `tools/render_native_capture.py` crops away the transcript/composer and draws the original cell text/attributes with documentation fonts/default colors; these are terminal captures, not pixel-perfect OS screenshots or invented mockups. Each PNG embeds the commit and source capture SHA256.

The visible statusline values are production sample preview data. Settings continues below the crop through host scrolling/Tab navigation. These images and the 120/80-column automated save/cancel run do not imply human acceptance. Private raw cells/debug streams remain in ignored `dist/validation/phase2-editor-pty-fixed`. The `configure-*-macos.png` and `configure-*-windows.png` images show the compatibility TUI; native screenshots for those platforms were not supplied at that release; the maintainer separately confirmed human results on Windows 11 and macOS 14.5.

### v1.3.0a2 Client captures

[Main](reconstructions/v1.3.0a2/linux/client-main-v1.3.0a2-linux.png) · [Subagents](reconstructions/v1.3.0a2/linux/client-subagents-v1.3.0a2-linux.png) · [Settings](reconstructions/v1.3.0a2/linux/client-settings-v1.3.0a2-linux.png)

These PNGs reconstruct actual terminal cells from Linux x86_64, the Claude Code 2.1.288 interactive host, backend 1.3.0a2 and the persistently installed Mod. Fixed source commit: `2ed1f3ae306776caeffe6a27205a4d680cb8e472`; runtime resources match this candidate. The 120×30 PTY runs in a private tmux server; the same run checks 80×48 inline operation. Cropping excludes transcript/composer/live statusline; Preview is fixed production sample data. These are terminal reconstructions, not OS pixel screenshots or design mockups. Each embeds its commit/capture SHA256; private raw data remains in ignored `dist/validation/client-a2-fixed-288`. These captures do not establish human acceptance. On 2026-10-04 the maintainer separately confirmed a2 human acceptance on Linux, Windows and macOS; exact terminal/architecture/host metadata were not supplied. Stable v1.3.0 retains these Client interaction modules, with updated version/description metadata. Images keep their original a2 filenames and provenance.

### v1.5.0a1 Phase 4 captures

[Item format](reconstructions/v1.5.0a1/linux/client-format-v1.5.0a1-linux.png) · [Layout](reconstructions/v1.5.0a1/linux/client-layout-v1.5.0a1-linux.png) · [Compact Layout](reconstructions/v1.5.0a1/linux/client-layout-compact-v1.5.0a1-linux.png) · [Preset preview](reconstructions/v1.5.0a1/linux/client-preset-v1.5.0a1-linux.png) · [Claude preferences](reconstructions/v1.5.0a1/linux/client-preferences-v1.5.0a1-linux.png)

These PNGs reconstruct real decoded cells from the installed v1.5.0a1 wheel, Mod 1.5.0-alpha.1 and Claude Code 2.1.289 on Linux x86_64 / Python 3.14.4. Both persistent entries passed advanced PTYs at 120×30 and 80×48. The capture source was clean local commit `07804ba23f98396b1bbb67b795efd9ccf8e6fab3`; after rebasing the release branch, public candidate `e978411ab92b99b44cf99d42f8dfce9eba3cf415` has exactly the same source tree (`ff77dc8b4b0fa3264b2344a38c98a1786b27e0ee`). Images preserve the original capture commit/hash in metadata. Runtime Mod fingerprint: `06510b1cbfc9c28c175cb3fc3a2268cb312de93c5e3f128b3e4effa52158ab10`.

The renderer crops transcript/composer/live status and private paths, uses explicit cell bounds for the compact pane, and preserves CJK continuation-cell backgrounds. Preview values are production samples. Agent inspection confirmed readable format/layout/host controls and CJK text; these are terminal reconstructions, not OS screenshots or human acceptance. Raw reports remain in ignored `dist/validation/phase4/preview-candidate-r2-pty`. Linux/Windows Phase 4 and macOS standalone TUI/CLI human acceptance was confirmed on 2026-10-05; the macOS Client input limitation remains open.

## v1.5.0 stable acceptance

On 2026-10-05 the maintainer confirmed Phase 4 human acceptance on Linux and Windows and on macOS through the standalone TUI/CLI. Exact OS, architecture, terminal and host versions were not supplied. This confirmation does not declare the earlier macOS in-session Client input problem fixed.

Stable changes package/Mod versions and release defaults; formatting, layout, portable files, host application and accepted input behavior remain those of the verified preview. Automated CI/PTYs and agent capture inspection remain independent evidence. Historical preview images keep their a1 filenames, capture hashes and original source commits.

## v1.6.0 stable acceptance

On 2026-10-05 the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS. Exact OS, architecture, terminal and host versions were not supplied. This is the new Phase 5 acceptance record, separate from historical editor confirmation and automated/headless/PTY evidence. The existing macOS Client input limitation remains documented. Stable v1.6.0 retains the accepted runtime implementation, display schema v4, configuration protocol v3 and runtime protocol v1. Editor entries default on for compatible hosts, preserving explicit false; live collection remains independently opt-in and preserves its preference.

<a id="external-tui-v161"></a>

## v1.6.1 external TUI captures

These seven PNGs reconstruct actual curses PTY cells from the installed wheel at source commit `ceb70bb127eb33d6257d47498b947f1f4c57a7f2`, backend/both Mods 1.6.1. Environment: Linux x86_64 (kernel 7.0.0-38-generic), Python 3.14.4, xterm-256color PTY and pyte 0.8.2. Five standalone sizes passed four pages/detail, resize during input, byte-identical cancellation and regrouped numeric save/readback. Raw captures remain in ignored `dist/validation/tui-sections-candidate/external-pty`.

80×24 shows Main, Subagents, Settings, Layout and item formatting; 64×18 shows compact Settings/Layout. The screenshot fixture selects three main items to expose grouping. CJK/combining text comes from actual field input; Preview uses production fixed samples. Images reconstruct terminal text/attributes with documentation fonts/colors; they are not OS pixel screenshots or design mockups. PNG metadata embeds source commit/capture SHA256; full capture digests follow.

Agent inspection confirmed distinct titles, columns, groups, selected rows, Preview and controls in all seven images. Automated `manual_visual_acceptance` stays false; no new maintainer human acceptance is claimed and historical platform confirmations retain their original scope. Standalone captures do not claim a Claude session; official persistent PTYs independently verify both slash entries and configuration readback.

| Image | Terminal cells | Capture JSON SHA256 |
| --- | --- | --- |
| [external-main-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-main-v1.6.1-linux.png) | 80x24 | `d7309f186324c8859ec727531d0579ed1c2f04e9848bf3fc7d5d202b67fcea4f` |
| [external-subagents-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-subagents-v1.6.1-linux.png) | 80x24 | `1fc7f0d99f0c147430a0c64affde00b9f882a7e5d15f80b1988d633e0053b39a` |
| [external-settings-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-v1.6.1-linux.png) | 80x24 | `4efee90b89d03ea6c2c2eae20c2cdc9ad7fd83031db74bc59938cc170e77f594` |
| [external-layout-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-v1.6.1-linux.png) | 80x24 | `35a984e75835c49bbc7f6fc3787882c572501f742c9e229c176cda352f2bb8a8` |
| [external-format-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-format-v1.6.1-linux.png) | 80x24 | `05bc122708050434348990c38049c30ce524b5d65657e181062ec8419f403063` |
| [external-settings-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-compact-v1.6.1-linux.png) | 64x18 | `bec340ec3d1160d87e0a7d977460ee5eb446cf9cdf87f5ee17866b2c9b9d1819` |
| [external-layout-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-compact-v1.6.1-linux.png) | 64x18 | `2ac330a789c6d0d8f7065e7876cc319198586c97edaf4419a0590a2939abe077` |

<details>
<summary>Archived files, dimensions and PNG SHA-256</summary>

| Original repository path | Archived file | Dimensions | PNG SHA-256 |
| --- | --- | --- | --- |
| `docs/images/client-format-v1.5.0a1-linux.png` | [client-format-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-format-v1.5.0a1-linux.png) | 888×552 | `b3299dcfd96b7b53b0cda11f71bc3ff618b6d6c57660ca159637ea79fc187784` |
| `docs/images/client-layout-compact-v1.5.0a1-linux.png` | [client-layout-compact-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-layout-compact-v1.5.0a1-linux.png) | 984×336 | `03bbe2baeb1e92beefe8ffa8c6f0525c17ec34ebc17f8c719d253b2665ff86d8` |
| `docs/images/client-layout-v1.5.0a1-linux.png` | [client-layout-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-layout-v1.5.0a1-linux.png) | 888×552 | `46e0dc2f088f787f1d53ffcdca8ab494df61f18a2cfb4d68eb7344d302bb03fd` |
| `docs/images/client-main-v1.3.0a2-linux.png` | [client-main-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-main-v1.3.0a2-linux.png) | 888×552 | `8f20a96115934ce61b9c508466da10becbe6f0f0abf9dfbbcff21530fde36e99` |
| `docs/images/client-preferences-v1.5.0a1-linux.png` | [client-preferences-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-preferences-v1.5.0a1-linux.png) | 888×576 | `95da985dafd29b402540644d5a72b4031c95afeea4fe523b6088140065305d09` |
| `docs/images/client-preset-v1.5.0a1-linux.png` | [client-preset-v1.5.0a1-linux.png](reconstructions/v1.5.0a1/linux/client-preset-v1.5.0a1-linux.png) | 888×576 | `499905fdfab747c32e3f29072303ae7132cca485b8f643968fb9f31528d3b164` |
| `docs/images/client-session-linux.png` | [session.png](screenshots/native/linux/session.png) | 1414×874 | `98624732a495c811fc024b04818e87d3965dabf28001768a3e587e95fab339be` |
| `docs/images/client-session-macos.png` | [session.png](screenshots/native/macos/session.png) | 1347×892 | `a7b33951a7973165062f441f7f554c5228f950fb1069ef0cbbe9ae87916735a6` |
| `docs/images/client-session-windows.png` | [session.png](screenshots/native/windows/session.png) | 1792×1202 | `7f10a719a3db89d15e5a869955046e49eb279214e1b1baf4aa571cd5bdc7e483` |
| `docs/images/client-settings-v1.3.0a2-linux.png` | [client-settings-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-settings-v1.3.0a2-linux.png) | 888×552 | `fa61c28e28e64e196fcb76ce3cbbc082e8d44d9331061690759f13d7452fb079` |
| `docs/images/client-subagents-v1.3.0a2-linux.png` | [client-subagents-v1.3.0a2-linux.png](reconstructions/v1.3.0a2/linux/client-subagents-v1.3.0a2-linux.png) | 888×552 | `4c8fcb0d62c42cd843b391a90e46f02379b2d9d9dc73befadc39b0b524ab87cc` |
| `docs/images/configure-main-macos.png` | [main.png](screenshots/external/macos/main.png) | 931×509 | `5a83c868a9a7c79e12acf85c945d050f4ad61761113e9236792f468d34381550` |
| `docs/images/configure-main-windows.png` | [main.png](screenshots/external/windows/main.png) | 1750×950 | `dccd1d37fd6c95f40de143206b30fca0bc619ac03b6e92abc5091f57122ee059` |
| `docs/images/configure-main.png` | [main.png](screenshots/external/linux/main.png) | 1191×790 | `c99b5accf4443f5eaa5fb643c0f26c736200926d06bcb3e955d87b668c1e3345` |
| `docs/images/configure-settings-macos.png` | [settings.png](screenshots/external/macos/settings.png) | 934×515 | `e23d86483c1d36001fe72a00fe367f57d70f94367b753a4f6d52a7471266d369` |
| `docs/images/configure-settings-windows.png` | [settings.png](screenshots/external/windows/settings.png) | 1749×947 | `84e041bc444359374a654f2675b916a02b4b9f1d8d113ac890087f191fc6b85a` |
| `docs/images/configure-settings.png` | [settings.png](screenshots/external/linux/settings.png) | 1191×790 | `4924b2d547aca1f719b65ac07644845d76a8ada605ae8436f71ee48a02d2d5b1` |
| `docs/images/configure-subagents-macos.png` | [subagents.png](screenshots/external/macos/subagents.png) | 939×513 | `22f54e310ebc374c91faef0250058ab5ee072e0a8fc7de4f7d44e57636e74d5b` |
| `docs/images/configure-subagents-windows.png` | [subagents.png](screenshots/external/windows/subagents.png) | 1751×956 | `ac6885089a858f0ea3b4615e201bb27ef2df45e4a61fda70315ee6e91cb8ee80` |
| `docs/images/configure-subagents.png` | [subagents.png](screenshots/external/linux/subagents.png) | 1191×790 | `7abed4cee329eb534f8621a6da9ff4ac4c9fa6f1becbe954545cd59b6ca256dc` |
| `docs/images/external-format-v1.6.1-linux.png` | [external-format-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-format-v1.6.1-linux.png) | 984×600 | `15a89fbeb4c005b1042251eb248f919567c0229e9e0d0390dbdfe9179aab4b62` |
| `docs/images/external-layout-compact-v1.6.1-linux.png` | [external-layout-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-compact-v1.6.1-linux.png) | 792×456 | `6d34337140b299543d95300632a3cba489bc59f999c56a597e4254b64dfc0297` |
| `docs/images/external-layout-v1.6.1-linux.png` | [external-layout-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-layout-v1.6.1-linux.png) | 984×600 | `1f8e0aba8e3d9d9765e1ffad78e99ad34077987e3387d21a833c1b4523c25d8b` |
| `docs/images/external-main-v1.6.1-linux.png` | [external-main-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-main-v1.6.1-linux.png) | 984×600 | `d4bf69c5f661923bbb8dfd7ebea8927535d321f9d43d386c8b749ce86982e62d` |
| `docs/images/external-settings-compact-v1.6.1-linux.png` | [external-settings-compact-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-compact-v1.6.1-linux.png) | 792×456 | `358a7edf5e7743851586f06ca27782d4ef4f791d8c709cfc98e83e9810e7f4a3` |
| `docs/images/external-settings-v1.6.1-linux.png` | [external-settings-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-settings-v1.6.1-linux.png) | 984×600 | `0f91b2baa6c044a5627e08e475ab0390028ca3132b2ab3efaf959644bb564d4f` |
| `docs/images/external-subagents-v1.6.1-linux.png` | [external-subagents-v1.6.1-linux.png](reconstructions/v1.6.1/linux/external-subagents-v1.6.1-linux.png) | 984×600 | `c4baee897762f39422868354e4c733cf2267ae8cb0adfd643895d5875c2e271c` |
| `docs/images/native-main-linux.png` | [native-main-linux.png](reconstructions/v1.2.0a1/linux/native-main-linux.png) | 612×576 | `49076d8513f4d265d415263407164f8dbb3fc411fba5a2e2dab1b863591ee876` |
| `docs/images/native-main-v1.3.0a1-linux.png` | [native-main-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-main-v1.3.0a1-linux.png) | 888×576 | `50643eef8fdb2cc40ce5dec9e7b149988da6c0e1377749003cc81b1fce267dea` |
| `docs/images/native-settings-linux.png` | [native-settings-linux.png](reconstructions/v1.2.0a1/linux/native-settings-linux.png) | 612×576 | `46d11563f9ba160114b84c5a9593423ac499de02215da6291f3cc718f7372585` |
| `docs/images/native-settings-v1.3.0a1-linux.png` | [native-settings-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-settings-v1.3.0a1-linux.png) | 888×576 | `d1ed32200ad2f095a04e5d6542938834436dff86f4977fc6d790f1614eb63c06` |
| `docs/images/native-subagents-linux.png` | [native-subagents-linux.png](reconstructions/v1.2.0a1/linux/native-subagents-linux.png) | 612×576 | `ab4c58e7d8339d9496ee47f691e18f6a1b9398e629d72430be6e40bf66701919` |
| `docs/images/native-subagents-v1.3.0a1-linux.png` | [native-subagents-v1.3.0a1-linux.png](reconstructions/v1.3.0a1/linux/native-subagents-v1.3.0a1-linux.png) | 888×576 | `3a757011ea615775e018baff254af197d6e0d9362db86152e96f55bd9a00e146` |

</details>

These hashes identify the PNG files. Capture JSON SHA256 values in the provenance tables identify the original terminal records, a different artifact.
