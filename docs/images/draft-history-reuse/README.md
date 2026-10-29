# Draft history and reuse captures

**English** | [简体中文](README.zh-CN.md)

These images reconstruct cells from actual installed PTYs. They are not desktop screenshots or human visual acceptance.

- Source: `200df8fcea2b3f6d1a40885305b6b19bf28f9d05`
- Package SHA-256: `ec7fdf4df2dd739c82366e4230a33f8cef1a83c8e7864d407a783128ca6da66c`
- Claude Code: `2.1.312`; Node: `24.21.0`; interface: `en`; model calls: `0`

Native crops follow the observed header and footer; external captures retain the whole 120×32 terminal. Observations are fixed preview samples. The collector preserves configuration and restores terminal attributes.

| File | Crop (x, y, columns, rows) | PNG SHA-256 | Cells SHA-256 |
| --- | --- | --- | --- |
| [native-draft-history.png](native-draft-history.png) | `[127, 0, 73, 45]` | `13ba63bb7b9a2e47f1488be632d39359c61b2f492fef015c40c5312bca7944e8` | `5d2e9ae3b8a4933decd875a329ad18243165968697b316db9d2a9bc87ee36034` |
| [native-style-reuse.png](native-style-reuse.png) | `[127, 0, 73, 45]` | `cd9418cc492d24b5218aa841bc42a2b97ab113a946e3c1a6dee2aa38f26c9d3d` | `ac0a3069a69119b09e7a63f66ac32b69fdb809099928b345e5853ea34c98f680` |
| [native-group-reuse.png](native-group-reuse.png) | `[127, 0, 73, 44]` | `abe2d0b6472f0b9fc5c68243e70a0fbd85e6a618ebcbe1c8bf573c03b447c0dc` | `0197f8858a064c66a4c09427214e53f234e508c508fa2dc2a53e17716bccba5c` |
| [native-alignment-repair.png](native-alignment-repair.png) | `[127, 0, 73, 44]` | `6cb261ef2535750d55b8ab48d6db5479d73653d345b4dd5e88a4aa028e0faa44` | `a7111f988cb72121521550f61f76528aa6dc35910dd137505c6bd74461e9aa8a` |
| [external-draft-history.png](external-draft-history.png) | `[0, 0, 120, 32]` | `ed21e1513f3668c12152a5f4b6d43261ee72c8c59252f8aa05250c1accb832a2` | `258e38e86e3ccb8aafebf30cb0f009ec2ec6b6dbe3453d2a4e6a304b3743bdb9` |
| [external-style-reuse.png](external-style-reuse.png) | `[0, 0, 120, 32]` | `c3518635b8063b6ecad38bcc0a84e3eff782f0b6f477afb31c2b4ef2f4827dfe` | `95a8196a4fa140b4efc5d8a2346645a6bf039f8f64737cb6405da3f253a7ad0a` |
| [external-group-reuse.png](external-group-reuse.png) | `[0, 0, 120, 32]` | `3beea7560a6d5525d1e82cbb7f9fca4f37ae64eef7389c8d73077d20eeabbd49` | `82c8e1db64288dc020bfae3d234b10c85cc0851e7915af73e055abfde285dc9f` |
| [external-alignment-repair.png](external-alignment-repair.png) | `[0, 0, 120, 32]` | `f1370576ab4ba724ee60fa9013e494234d1a2ac77ee23cc8a52392a847850f55` | `426ec2d09e480d9e35808496fdc5a4d606b3ff8e1b63bab074573c8eb3b3b6d5` |

## Fonts

| File | SHA-256 |
| --- | --- |
| DejaVuSansMono.ttf | `a54dca07c76d6289e717e75e0a58c0128f6d7269ef3faf76417c9d7d3bba37ab` |
| NotoSansCJK-Regular.ttc | `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a` |
| NotoColorEmoji.ttf | `9fd0a3d0ce84d77e3185dfbae77bd1abf3926aa49a032e354d076c4f17151f10` |

## Reproduction

```bash
npm run capture:native-capacity -- --artifact ABSOLUTE_TGZ --commit 200df8fcea2b3f6d1a40885305b6b19bf28f9d05 --output NEW_DIRECTORY
```

The four new journeys per editor retain `after.cells.json`; render with `tools/acceptance/render-capture.ts` and the recorded fonts/crops. Raw cells, ANSI and host logs remain in the ignored acceptance directory; no physical or paid acceptance is inferred.
