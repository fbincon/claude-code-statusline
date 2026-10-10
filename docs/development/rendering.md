# Rendering and Unicode contracts

**English** | [简体中文](rendering.zh-CN.md)

Production main/subagent rows, Python previews and the native editor use fixed Unicode 18.0 cell widths and extended grapheme boundaries. Ambiguous characters occupy one cell. A terminal or font can choose different glyph presentation; this contract describes the application's layout, not every physical terminal.

## Reproducible Unicode data

`tools/unicode/data.json` retains the required tables from wcwidth 0.9.1 with original module hashes. `provenance.json` records the Unicode version, data and official conformance-file hashes. The MIT and Unicode notices accompany source distributions and wheels; generated native tables retain the notices for separately installed Mods.

```bash
python tools/generate_unicode.py --check
```

Checking and ordinary builds are offline and require no wcwidth installation. To deliberately refresh the pinned snapshot, install `wcwidth==0.9.1` in a development environment and run `python tools/generate_unicode.py --refresh`; review all resulting data, generated files and provenance. Changing Unicode or reference versions requires an explicit generator change and complete acceptance.

Python loads tables only for non-ASCII text. Both implementations run the official Unicode 18.0 GraphemeBreakTest cases and shared terminal-width examples. The width policy applies the reference policy separately to each complete grapheme: for example, `a` followed by ZWJ and `b` must not swallow the unrelated `b`. Rendering neither imports wcwidth nor depends on the Python/host Unicode database.

## Styles and boundaries

The supported style state consists of foreground, background and bold. SGR changes accumulate; `0` resets all supported attributes, `22` clears bold, and `39`/`49` restore default foreground/background independently. ANSI slots 0–255 and RGB colors are preserved. Semicolon and colon extended-color forms are supported; malformed color groups cannot become unrelated style commands. Other terminal effects are outside this contract.

Partition the visible row into graphemes before assigning styles. When SGR occurs inside one cluster, its first visible code point supplies the cluster's drawing style; all later transitions still affect following clusters. Cropping and wrapping never split the cluster. Each emitted styled row restores its state and ends in a reset. An indivisible cluster wider than the whole viewport is replaced with an ellipsis; ordinary CJK/emoji clusters fit the existing two-cell production minimum.

Untrusted payload controls remain sanitized. ZWJ, variation selectors and emoji tag characters are preserved as part of Unicode text; they do not enable ANSI injection. Fixed sample previews continue to avoid live collectors, Git execution and persistent writes.

See [testing](testing.md) for representative benchmarks and [shared contracts](contracts.md) for the editor protocol.
