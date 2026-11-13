# docs/images index organization and Python-era archive

**English** | [简体中文](docs-images-organization.zh-CN.md)

This 2026-11-13 maintenance pass reorganizes the image documentation into a current index, local gallery indexes and a frozen Python-era archive. Product behavior, public interfaces, stored formats and all image bytes are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Round | Result |
| --- | --- |
| Content corrections | Added per-file `setup-appearance` provenance; corrected stale renderer paths, archive snapshot wording, archive packaging/project-README claims, root navigation labels, bilingual metadata scope and showcase/draft/TypeScript wording; normalized `SHA-256` labels. |
| Index restructure | Replaced the 251-line root evidence ledger with a 17-row gallery index, status/version columns, a complete directory tree, maintenance conventions and preserved legacy anchors. Added bilingual local indexes for `tui/`, `appearance/`, `statusline/` and `discovery/`; added status lines to every gallery. |
| Python-era archive | Moved 59 images and their indexes into `archive/python-era/`: appearance (2), statusline (2), discovery (16), languages (9) and TUI reconstructions (30). Kept the 21 original physical screenshots in `tui/`. Updated direct links in `APPEARANCE`, `development/native`, `v1.13.0` and the TypeScript galleries. |
| Verification tooling | Extended `tools/checks/impact-assets.ts` to validate top-level `captures`, `images`, `frames` and `records` arrays, `file`/`name` resolution, `png_sha256`/`sha256`, dimensions and byte counts; added focused tests. |

## Source identities

- Baseline before the task: `67924b19`.
- PR1 content corrections: merge `9d615fdd2f81937f6af6504f0a42dc0cf9f7c54d` (PR #242).
- PR2 index restructure: merge `f3d1437a1b96b84869a87466a0454e95b707d2ae` (PR #243).
- PR3 implementation head before this record: `2beb494b`; the final head, PR number, CI result and merge/Gitee identities are recorded in the PR description and comments.

The move preserves reviewable renames: 59 PNGs at 100% similarity, 21 original PNGs remaining in `tui/`, and 51 pre-existing archive images plus 59 Python-era images for 110 archived images. The documented SHA-256 multiset remains 1,590 before and after the move.

## Validation and limits

- Each round passed `npm run docs:check` and `git diff --check`; the image reference audit reports 293/293 images referenced, zero orphans and zero broken image links.
- PR1's impact route is `maintenance` with `actions`, `assets` and `docs` on Linux. PR2's route is `maintenance` with `actions` and `docs` on Linux. PR3 changes `README` links, media paths and `tools/checks`; its final-head plan and scoped receipts are recorded in the PR, including the Windows/macOS `checks` tasks selected by the registered development guide change.
- The new asset tests pass 4/4 and the existing impact-plan tests pass 21/21.
- No image is recaptured or re-encoded; historical bytes, filenames and hashes are preserved. No human, physical-platform, paid-model or new installed acceptance is claimed.
- GitHub issue [#241](https://github.com/fbincon/claude-code-statusline/issues/241) records the current Native header/Retry-Close overlap; the archive notes the historical discovery description clipping without opening a product issue because current TypeScript already adds the ellipsis.
