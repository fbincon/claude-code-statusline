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
