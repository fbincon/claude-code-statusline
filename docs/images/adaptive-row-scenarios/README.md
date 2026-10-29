# Adaptive appearance samples

**English** | [简体中文](README.zh-CN.md)

These five images reconstruct fixed samples rendered by the installed v3.14.0 candidate. They are terminal-cell reconstructions, not desktop screenshots or human acceptance. Sample model, task, usage and quota values are synthetic. [Exact PNG, cell, ANSI and font hashes](provenance.json).

- Source: `492d3d50c8d0d72b6230aff956425958b86f5417`
- Package SHA-256: `8fd4b89d82446ab2185fbf12181d324aedc6a68f28c4c3261b2a63b6cdd0abff`
- Linux x64; Node `24.21.0`; model calls: `0`

The capture suite also tests explicit dark/light/terminal theme variants. The dark examples below use that override; selecting the schemes normally retains their ocean/slate/ember defaults. Each image retains the complete rendered rows without cropping.

| Scheme | Language | Columns | Theme variant |
| --- | --- | ---: | --- |
| [Powerline daily](powerline-daily-en-120-dark-standard-compact.png) | en | 120 | dark |
| [Agent workbench](agent-workbench-en-120-dark-standard-compact.png) | en | 120 | dark |
| [Quota and cost](quota-cost-zh-CN-120-dark-standard-compact.png) | zh-CN | 120 | dark |
| [Narrow terminal](narrow-terminal-en-40-terminal-standard-compact.png) | en | 40 | terminal |
| [Light readable](light-readable-zh-CN-80-light-standard-compact.png) | zh-CN | 80 | light |

## Reproduce

```bash
npm run capture:setup-appearance -- --artifact ABSOLUTE_TGZ --commit 492d3d50c8d0d72b6230aff956425958b86f5417 --output NEW_DIRECTORY --font /path/to/DejaVuSansMono.ttf --font /path/to/NotoSansCJK-Regular.ttc
```

Use the matching immutable source and fonts recorded in the provenance file. Raw captures and receipts remain in ignored validation storage. [Implementation and validation](../../development/adaptive-row-scenarios.md).
