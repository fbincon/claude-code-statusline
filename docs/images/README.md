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

The visible statusline values are production sample preview data. Settings continues below the crop through host scrolling/Tab navigation. These images and the 120/80-column automated save/cancel run do not imply human acceptance. Private raw cells/debug streams remain in ignored `dist/validation/phase2-editor-pty-fixed`. Existing macOS/Windows screenshots above show the compatibility TUI; native screenshots for those platforms were not supplied; the maintainer separately confirmed human results on Windows 11 and macOS 14.5.
