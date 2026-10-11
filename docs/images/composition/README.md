# Component editor captures

**English** | [简体中文](README.zh-CN.md)

These images reconstruct cells from actual installed-terminal output, with fixed sample previews. They are not OS screenshots or human acceptance. Instance suffixes distinguish copies of a type. A wide viewport retains left-side components and right-side context; narrower views collapse flexible whitespace and then hide lower-priority content.

Native uses A/D/X; external uses Ctrl+A/D/X. Interface and output languages are independent, so the Chinese interface can still preview English output. See the [composition guide](../../COMPOSITION.md).

| Entry | English | 简体中文 |
| --- | --- | --- |
| Native Client | ![Native instances](native/main-en.png) | ![Chinese native instances](native/main-zh-CN.png) |
| External curses | ![External instances](external/main-en.png) | ![Chinese external instances](external/main-zh-CN.png) |

## Provenance and limits

Captured on 2026-10-11 on Linux x86_64, Python 3.14.4 and Claude Code 2.1.296 from isolated 2.0.0a1 wheel installations. Native source: `c5647ae`; external source: `bb67f8f`. Later UI search/category-hint corrections do not change these views. Both use direct 120×30 PTYs. Native images crop only the Client pane; external images retain the complete window. Raw streams and cell JSON remain in ignored `dist/validation` directories and are not distributed.

Reconstruction uses DejaVu Sans Mono, Noto Sans CJK and Noto Sans Symbols with an explicit dark-terminal color fixture. Images received agent inspection. Actual font rendering and new human Windows/macOS interaction acceptance are not established by these images.

| Entry / language | Capture SHA256 | PNG SHA256 |
| --- | --- | --- |
| native / en | `68a5b50078f882ff846a22f80d968c52e8906fc198f6bb3dc424ca6fe8dfeef6` | `2427a9762727b56ff8932efbd364e7b23f589f6dee6988e8b2f6f260099b1d77` |
| native / zh-CN | `bbe991a4e41304b8266c86d10e1d0a29560eb5ef66823c78241761b4632d565d` | `6c4138e77a68877fb13323803477b872499de66523f0a4f4a6825ef9d3a37fe2` |
| external / en | `ba7bbec111c5dc4107a4b3a0842dc1eb2b5a3bf15b150691f04ca5a9c74a53ee` | `41ac7f57be29aa154bdc25e59dc6aa248c9c507420d8b9334390e97110562e2f` |
| external / zh-CN | `f065259aa9b3dde42c809ab1ad18a1a349dd682019a4e2a563cc17efdc3c6a44` | `cb703dcd57256e595e329e53986b1c88f7ca3dc3ca09f337cc62d92e8459dbc5` |
