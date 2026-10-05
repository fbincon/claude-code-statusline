# Interface Screenshots

**English** | [简体中文](README.zh-CN.md)

<a id="界面截图"></a>

Screenshots appear in the [project README](../../README.md#screenshots). Main status line images come from actual Claude sessions; configuration `Preview (sample data)` uses fixed samples. The two Subagents previews are not evidence of acceptance testing with real parallel agents.

<a id="文件索引"></a>

## File index

| Platform | Main status line | Main | Subagents | Settings |
| --- | --- | --- | --- | --- |
| Linux | [statusline.png](statusline.png) | [configure-main.png](configure-main.png) | [configure-subagents.png](configure-subagents.png) | [configure-settings.png](configure-settings.png) |
| macOS | [statusline-macos.png](statusline-macos.png) | [configure-main-macos.png](configure-main-macos.png) | [configure-subagents-macos.png](configure-subagents-macos.png) | [configure-settings-macos.png](configure-settings-macos.png) |
| Windows | [statusline-windows.png](statusline-windows.png) | [configure-main-windows.png](configure-main-windows.png) | [configure-subagents-windows.png](configure-subagents-windows.png) | [configure-settings-windows.png](configure-settings-windows.png) |

## In-session Client screenshots

The maintainer supplied these actual terminal screenshots on 2026-10-04. They show the Client Main page inside an existing Claude Code session, together with the conversation, input area and main status line. All three visibly show Claude Code 2.1.289. Backend version, source commit, exact OS version, architecture and terminal version were not supplied and remain unknown.

| Platform | Screenshot | Dimensions | Maintainer's interaction report |
| --- | --- | --- | --- |
| Linux | [client-session-linux.png](client-session-linux.png) | 1414×874 | Normal interaction |
| Windows | [client-session-windows.png](client-session-windows.png) | 1792×1202 | Normal interaction |
| macOS | [client-session-macos.png](client-session-macos.png) | 1347×892 | Pane opens; interaction problems; working setup unverified |

Original filenames were `linux.png`, `windows.png` and `macOS.png`, respectively. The PNG bytes, dimensions and colors are preserved without cropping or redrawing. Original session text, including earlier command and connection messages, is retained. Client Preview uses fixed sample data. The screenshots show layout; interaction results come from the maintainer's separate report. Suggested macOS checks are in the [user guide](../USER_GUIDE.md#macos-mouse-reporting-and-client-focus); current feedback is recorded separately from historical acceptance in [native development](../development/native.md#claude-code-21289-interaction-report).

<a id="展示说明"></a>

## Display notes

Linux, macOS, and Windows each show the main status line and Main, Subagents, and Settings configuration pages. macOS / Windows images use platform suffixes; PNG contents, dimensions, and colors are preserved.

macOS images show Terminal.app; Windows images show Windows Terminal.

Each screenshot reflects its own terminal session, layout, and settings. Display items, palette, fonts, and window width may differ.

<a id="更新约定"></a>

## Updating screenshots

- Use PNG and lowercase English filenames, with `-macos` / `-windows` platform suffixes.
- Keep status lines and configuration pages legible; update README references and this index together.
- `MANIFEST.in` includes this directory's Markdown and PNGs in the source distribution; CI checks packaging completeness.

## Native editor captures

### v1.3.0a1 preview captures

[Main](native-main-v1.3.0a1-linux.png) · [Subagents](native-subagents-v1.3.0a1-linux.png) · [Settings](native-settings-v1.3.0a1-linux.png)

These PNGs reconstruct real decoded cells from Linux x86_64, Claude Code 2.1.288, backend 1.3.0a1 and a persistent official plugin at clean source commit `4cd97dd480aa0025fb9edc7644b872bf3fa6336b` (2026-10-04). The docked terminal measured 120×30; the same automated run also checked 80×48 inline operation. The renderer crops transcript/composer content and embeds the commit and capture hash. Values are production sample data; these are terminal reconstructions, not OS pixel screenshots or mockups. The capture source stays in ignored `dist/validation/native-usability-capture-288`. The maintainer subsequently confirmed a1 human acceptance on all three platforms; a2 Client acceptance is separate.

### v1.2.0 captures

[Main](native-main-linux.png) · [Subagents](native-subagents-linux.png) · [Settings](native-settings-linux.png)

These three PNGs reconstruct decoded cells captured from a real Linux x86_64 Claude Code 2.1.288 terminal at 120 columns, using the persistent official plugin installation and backend 1.2.0a1 at clean code commit `db4129b75dcc3aa20fc24bbb09946e249038ee2e` (2026-10-04). `tools/render_native_capture.py` crops away the transcript/composer and draws the original cell text/attributes with documentation fonts/default colors; these are terminal captures, not pixel-perfect OS screenshots or invented mockups. Each PNG embeds the commit and source capture SHA256.

The visible statusline values are production sample preview data. Settings continues below the crop through host scrolling/Tab navigation. These images and the 120/80-column automated save/cancel run do not imply human acceptance. Private raw cells/debug streams remain in ignored `dist/validation/phase2-editor-pty-fixed`. The `configure-*-macos.png` and `configure-*-windows.png` images show the compatibility TUI; native screenshots for those platforms were not supplied at that release; the maintainer separately confirmed human results on Windows 11 and macOS 14.5.

### v1.3.0a2 Client captures

[Main](client-main-v1.3.0a2-linux.png) · [Subagents](client-subagents-v1.3.0a2-linux.png) · [Settings](client-settings-v1.3.0a2-linux.png)

These PNGs reconstruct actual terminal cells from Linux x86_64, the Claude Code 2.1.288 interactive host, backend 1.3.0a2 and the persistently installed Mod. Fixed source commit: `2ed1f3ae306776caeffe6a27205a4d680cb8e472`; runtime resources match this candidate. The 120×30 PTY runs in a private tmux server; the same run checks 80×48 inline operation. Cropping excludes transcript/composer/live statusline; Preview is fixed production sample data. These are terminal reconstructions, not OS pixel screenshots or design mockups. Each embeds its commit/capture SHA256; private raw data remains in ignored `dist/validation/client-a2-fixed-288`. These captures do not establish human acceptance. On 2026-10-04 the maintainer separately confirmed a2 human acceptance on Linux, Windows and macOS; exact terminal/architecture/host metadata were not supplied. Stable v1.3.0 retains these Client interaction modules, with updated version/description metadata. Images keep their original a2 filenames and provenance.

### v1.5.0a1 Phase 4 captures

[Item format](client-format-v1.5.0a1-linux.png) · [Layout](client-layout-v1.5.0a1-linux.png) · [Compact Layout](client-layout-compact-v1.5.0a1-linux.png) · [Preset preview](client-preset-v1.5.0a1-linux.png) · [Claude preferences](client-preferences-v1.5.0a1-linux.png)

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
| [external-main-v1.6.1-linux.png](external-main-v1.6.1-linux.png) | 80x24 | `d7309f186324c8859ec727531d0579ed1c2f04e9848bf3fc7d5d202b67fcea4f` |
| [external-subagents-v1.6.1-linux.png](external-subagents-v1.6.1-linux.png) | 80x24 | `1fc7f0d99f0c147430a0c64affde00b9f882a7e5d15f80b1988d633e0053b39a` |
| [external-settings-v1.6.1-linux.png](external-settings-v1.6.1-linux.png) | 80x24 | `4efee90b89d03ea6c2c2eae20c2cdc9ad7fd83031db74bc59938cc170e77f594` |
| [external-layout-v1.6.1-linux.png](external-layout-v1.6.1-linux.png) | 80x24 | `35a984e75835c49bbc7f6fc3787882c572501f742c9e229c176cda352f2bb8a8` |
| [external-format-v1.6.1-linux.png](external-format-v1.6.1-linux.png) | 80x24 | `05bc122708050434348990c38049c30ce524b5d65657e181062ec8419f403063` |
| [external-settings-compact-v1.6.1-linux.png](external-settings-compact-v1.6.1-linux.png) | 64x18 | `bec340ec3d1160d87e0a7d977460ee5eb446cf9cdf87f5ee17866b2c9b9d1819` |
| [external-layout-compact-v1.6.1-linux.png](external-layout-compact-v1.6.1-linux.png) | 64x18 | `2ac330a789c6d0d8f7065e7876cc319198586c97edaf4419a0590a2939abe077` |
