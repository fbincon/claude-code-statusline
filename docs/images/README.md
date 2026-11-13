# Image and capture index

**English** | [简体中文](README.zh-CN.md)

Start with the [SHOWCASE-01 gallery](showcase/README.md) and [usage demonstrations](../SHOWCASE.md) for reproducible workflows from the v3.16.0 recording baseline; the current documented product is 3.16.3. Each gallery records the package/source/input identity and capture method available for its evidence. A physical screenshot, terminal recording, PTY reconstruction, agent inspection and human acceptance establish different kinds of evidence.

Status taxonomy: **Current baseline** is the approved 3.16 visual baseline; **Latest language capture** is the newest installed language gallery (v3.16.0); **Earlier TypeScript** and **Earlier feature** are versioned historical galleries; **Primary physical evidence** is the supplied 2026-10-07 screenshot set; **Python-era historical** is pre-TypeScript evidence; **Frozen archive** preserves replaced images and original records. Historical captures retain their original claims and do not establish acceptance of later packages or close the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96).

## Gallery index

| Gallery | Captured | Status | Content and evidence |
| --- | --- | --- | --- |
| [SHOWCASE-01](showcase/README.md) | v3.16.0 | Current baseline | Featured scenes, configuration workflow and reproducibility/provenance |
| [v3.16.0 languages](typescript/v3.16.0/README.md) | v3.16.0 | Latest language capture | Six additional interface languages, Native examples and twelve-language checks |
| [v3.1.1](typescript/v3.1.1/README.md) | v3.1.1 | Earlier TypeScript | Six-language pages, light/dark profiles and boundary views |
| [v3.1.0 regional](typescript/regional/README.md) | v3.1.0 | Earlier TypeScript | Taiwan/Hong Kong captures from both editors |
| [v3.0.0 preparation](typescript/README.md#v300-preparation-captures) | v3.0.0 | Earlier TypeScript | Eight installed external-editor preparation captures |
| [Adaptive appearance](adaptive-row-scenarios/README.md) | v3.14.0 | Earlier feature | Five scenario samples spanning 40/80/120 columns |
| [Draft history and reuse](draft-history-reuse/README.md) | v3.13.0 | Earlier feature | Draft history, structural review and reuse captures |
| [Source operations](source-command-package/README.md) | v3.12.0 | Earlier feature | Installed source state, binding inventory and policy-review views |
| [Native capacity and recovery](native-capacity/README.md) | v3.9.1 | Earlier feature | Quick setup, gradients, 24-instance save and tall-pane resizing |
| [Setup and complete appearance](setup-appearance/README.md) | v3.5.0 | Earlier feature | Setup/scheme sample provenance |
| [Component composition](composition/README.md) | 2.0.0a1 | Earlier feature | Instances, copies and left/right layouts |
| [TUI screenshots](tui/README.md) | 2026-10-07 | Primary physical evidence | 21 original in-session/external screenshots |
| [Python-era archive](archive/python-era/README.md) | v1.6.1–v1.13.0 | Frozen archive | 59 appearance, statusline, discovery, language and TUI-reconstruction images |
| [Historical archive](archive/README.md) | mixed | Frozen archive | 51 replaced screenshots and earlier capture records |

## Directory layout

```text
docs/images/
├── showcase/                 # Current visual baseline
├── typescript/               # Installed TypeScript captures by package
├── adaptive-row-scenarios/   # Appearance and scenario evidence
├── draft-history-reuse/      # History and reuse evidence
├── source-command-package/   # Source-operation evidence
├── native-capacity/          # Capacity and recovery evidence
├── setup-appearance/         # Setup and scheme evidence
├── composition/              # Component layout evidence
├── tui/                      # Original physical screenshots and Python-era reconstructions
└── archive/                  # Replaced images, original records and historical reconstructions
    └── python-era/           # 59 Python-era appearance/statusline/discovery/language/TUI images
```

## Gallery template

New galleries follow this structure. Existing galleries and `docs/images/archive/**` keep their original layout and are not retrofitted.

1. **README pair.** `README.md` and `README.zh-CN.md` use a single H1, the existing language navigation, `**Status:**` / `**状态：**` from the taxonomy above, then `## Provenance` / `## 来源`, `## Capture method` / `## 采集方法`, `## Evidence limits` / `## 证据限制`, the media table, the manifest link, reproduction notes and a link back to this index.
2. **Manifest.** `captures.json` uses schema 2. Every image in the gallery must be referenced, and every row path must resolve inside the gallery.
3. **Index.** Add exactly one row to the gallery index with the status from the taxonomy above.
4. **Provenance.** Record the source commit, package identity (or `null` for a source-only gallery), model calls and physical visual acceptance.

## Capture manifest schema 2

```json
{
  "schema_version": 2,
  "kind": "fixed samples through the installed production renderer",
  "source_commit": "<40-hex>",
  "package_sha256": "<64-hex or null>",
  "model_calls": 0,
  "physical_visual_acceptance": false,
  "captures": [
    {
      "file": "sample.png",
      "png_sha256": "<64-hex>",
      "width": 1200,
      "height": 400,
      "bytes": 12345
    }
  ]
}
```

`captures` must be non-empty. Each row uses a relative PNG path, a SHA-256 digest, positive dimensions and the exact byte count. Existing `schema_version: 1` manifests remain valid; do not rewrite them.

<a id="updating-screenshots"></a>

## Updating screenshots

- Update the English and Chinese versions of the affected README together; this index, the local gallery README, the directory tree, related guides, links and hashes must stay consistent.
- Use the current TypeScript capture/packaging tools and the media checks selected by [impact planning](../development/impact-checks.md); record package/source/input hashes, terminal geometry, fonts and any crop or encoding step. Keep private raw logs out of public assets.
- New and updated sample captures use neutral sample paths (for example `/demo` or `~/projects`); historical images keep their original bytes and identities.
- Preserve historical capture versions, filenames, commits and metadata; replacement batch dates are not capture dates. Archive pages are frozen.
- Use `SHA-256` as the hash label. See [editor drawing and capture](../development/rendering.md#editor-drawing-and-capture) for the current capture tools and historical Python archive.

## Legacy links

The following anchors are kept for old links and point to their new locations.

<details>
<summary>Historical anchors and current targets</summary>

<a id="current-images"></a>
<a id="display-notes"></a>
<a id="external-tui-v161"></a>
<a id="file-index"></a>
<a id="interface-screenshots"></a>
<a id="native-editor-captures"></a>
<a id="v120-captures"></a>
<a id="v130a1-preview-captures"></a>
<a id="v130a2-client-captures"></a>
<a id="v150-stable-acceptance"></a>
<a id="v150a1-phase-4-captures"></a>
<a id="v160-stable-acceptance"></a>
<a id="v161-external-tui-captures"></a>
<a id="theme-terminal-captures"></a>
<a id="external-terminal-color-captures"></a>
<a id="native-preview-background-captures"></a>
<a id="bilingual-terminal-captures"></a>
<a id="statusline-language-captures"></a>
<a id="discovery-and-import-review"></a>
<a id="conditional-appearance-captures"></a>
<a id="original-cross-platform-gallery"></a>
<a id="in-session-client-screenshots"></a>
<a id="sources-and-hashes"></a>

| Old area | Current location |
| --- | --- |
| Original 21 screenshots, in-session Client and source hashes | [TUI screenshots](tui/README.md) |
| Theme, external color, preview-background and bilingual captures | [Python-era TUI reconstructions](archive/python-era/tui/README.md) |
| Statusline language captures | [Python-era statusline archive](archive/python-era/statusline/README.md) and [TUI reconstructions](archive/python-era/tui/README.md#statusline-language-captures) |
| Discovery and import review | [Python-era discovery archive](archive/python-era/discovery/README.md) |
| Conditional appearance | [Python-era appearance archive](archive/python-era/appearance/README.md) |
| Language gallery | [Python-era language archive](archive/python-era/languages/README.md) |
| Display notes, file index, earlier reconstructions and v1.x release captures | [Historical archive](archive/README.md) |

</details>
