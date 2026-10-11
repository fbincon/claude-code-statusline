# Multilingual terminal captures

**English** | [简体中文](README.zh-CN.md)

These images reconstruct actual decoded Linux terminal cells captured from the installed v1.13.0 wheel at source `1134aee5425ed50fa0ca936321abb246e011b6b0`, on 2026-10-11. They are agent-inspected terminal reconstructions, not desktop screenshots or new human platform acceptance. The original cross-platform gallery remains [separate](../README.md).

| Language | Native, light | External, dark | External minimum |
| --- | --- | --- | --- |
| 繁體中文 | [Main](native/zh-Hant-light.png) | [Main](external/zh-Hant-dark.png) | [Settings](external/zh-Hant-minimum.png) |
| 日本語 | [Main](native/ja-light.png) | [Main](external/ja-dark.png) | [Settings](external/ja-minimum.png) |
| 한국어 | [Main](native/ko-light.png) | [Main](external/ko-dark.png) | [Settings](external/ko-minimum.png) |

## Provenance and scope

The environment was Linux x86_64, Python 3.14.4, Claude Code 2.1.294 and an `xterm-256color` PTY. Native captures use the installed persistent Mod and actual Client output; the 120-column host is cropped to its right editor pane. External captures use the installed curses entry at 120×30 and 64×18. Preview data is fixed and does not represent live account use. The minimum-size Settings captures intentionally show a localized interface with English output, before changing the output-language draft. Long labels are clipped at whole graphemes; full labels remain visible at wider sizes.

The complete three-language acceptance matrix passed 30 external cases (five sizes × two terminal backgrounds × three languages) and 12 native cases (80/120 columns × two backgrounds × three languages). It exercised real keys, both language directions, immediate interface persistence, draft cancellation, saving, reopening and actual statusline rendering. The nine images here were recaptured from the clean fixed source above; earlier matrix receipts identify their own source commits. Native 32×12 and other viewport boundaries are also covered by official Client tests, not claimed as 32×12 host PTY acceptance.

Terminal-default palettes are explicit capture-analysis fixtures; they do not change a physical desktop theme. In the persistent dark tmux path, the host can emit ANSI-256 index 17 (`#00005f`) for the requested native preview background. The acceptance tool records this transport conversion and accepts that exact observed mapping; direct truecolor checks stay strict. This is a capture/transport limitation, not a new color setting.

`tools/render_native_capture.py` renders captured cells with DejaVu Sans Mono, Noto Sans CJK and Noto Symbols 2. Native cropping excludes the transcript, composer and private configuration paths. PNG metadata retains the source commit and capture SHA256. Raw PTY/configuration receipts remain in ignored `dist/validation/final-gallery-*` and are excluded from distributions. No paid model calls, new Windows/macOS human terminal checks or native-speaker review are claimed.

## PNG integrity

| File | Pixels | SHA256 |
| --- | --- | --- |
| [external/ja-dark.png](external/ja-dark.png) | 1464×744 | `7b3e64e2f689378c4547d98b81c2ee10ca60a380413041fb98c2e46b9ade89d4` |
| [external/ja-minimum.png](external/ja-minimum.png) | 792×456 | `84edfc9fb17ff11a6366ca4280cd5536a6e0dfdc06633cd0772f4aee68d7a920` |
| [external/ko-dark.png](external/ko-dark.png) | 1464×744 | `2ed8ac37ed458de3bf142497c31f38c5c74f68759bad3e4edc87584b8de4377b` |
| [external/ko-minimum.png](external/ko-minimum.png) | 792×456 | `cf1cd9615fb24ab140ccc350a52e6c49fde15f303e36b64e12b361db9d97e114` |
| [external/zh-Hant-dark.png](external/zh-Hant-dark.png) | 1464×744 | `be66e829a04a562a6537c91b43729f9dad9609da52d0d83dead475423c794eac` |
| [external/zh-Hant-minimum.png](external/zh-Hant-minimum.png) | 792×456 | `4797c50aa361fafac059db25033be78775ffbe65ccc069c02b0549e4b64b2bc9` |
| [native/ja-light.png](native/ja-light.png) | 888×600 | `6c1b328fc11c8952ebab2d19fe981008174fa3ff7cb77f47a3838138295dd8a4` |
| [native/ko-light.png](native/ko-light.png) | 888×600 | `f0c8d2d616db42fd75d42d7c0374f6702d7f079aeccbb2ae64bd2ed14c77e0ce` |
| [native/zh-Hant-light.png](native/zh-Hant-light.png) | 888×600 | `8b7a18983c944c13a8d50f39398a588b0bfbd62fb0316a17eea7c594618c0c69` |
