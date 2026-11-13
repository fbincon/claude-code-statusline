# Image gallery template and manifest schema

**English** | [简体中文](image-gallery-governance.zh-CN.md)

This 2026-11-14 documentation and check maintenance adds a new-gallery README template, capture manifest schema 2, and structural checks for new galleries and gallery-index membership. Existing galleries, manifests and archived media keep their original layout. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Template | `docs/images/README.md#gallery-template` and its Chinese pair define the README order, status line, provenance/capture-method/evidence-limit sections and index backlink. |
| Manifest | `docs/images/README.md#capture-manifest-schema-2` defines schema 2: source commit, package identity or `null`, model calls, physical visual acceptance and capture rows with digest, dimensions and bytes. |
| Checker | `checkImageGalleries` requires a schema 2 manifest and README template for new galleries, validates rows and referenced images, and requires exactly one English and Chinese index row per gallery. |
| Integration | The checker runs from both `checkAssets` (media changes) and `checkDocs` (README/index-only changes). |
| Legacy | The 12 current non-archive galleries, existing v1 manifests and `docs/images/archive/**` are grandfathered. |

## Source identities

- Baseline before the task: `39393cb0`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,265 local links, 0 errors (baseline 7,261) |
| `npm run build` | Passed |
| `docs.test.js` | 50/50 passed |
| `impact-assets.test.js` | 13/13 passed, including the new gallery schema cases |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Selected tasks and results are recorded in the PR description after CI |

This is documentation and check maintenance. It does not recapture, re-encode or rewrite existing images, and it does not perform installed-product, editor, platform, physical, provider or paid-model acceptance. The checker validates structure, not visual quality. The six accepted issue #96 gaps remain unverified.
