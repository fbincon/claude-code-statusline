# Item format explanations in both editors

**English** | [简体中文](item-format-explanations.zh-CN.md)

This 2026-11-28 feature delivery reorganizes both read-only Ctrl+E pages in the Native and external editors. Delivery covers source and documentation on GitHub and Gitee. The engineering package is used for isolated verification.

## Changes

| Area | Result |
| --- | --- |
| Configuration and sample explanation | The selected component's reference examples come first. The page then shows the draft state, the current scenario and width, per-instance outcomes and known local conditions. The bottom preview uses the current draft. |
| Sources and requirements | The page groups source and scope, display conditions, possible causes, fields and versions, and literal setup commands. Each group appears where applicable. |
| Layout and paging | Both editors use shared grapheme-aware rows, bold headings and indented examples. Native reserves one terminal row for section spacing. Scroll keys use the current visible body size and Ctrl+G restores the originating selection. |

## Source identities

- Baseline `0b6a4637a928badee4c479038f296d4d139d832e`.
- Initial installed review used `f917880da0d6974f1903bae5a15d97e8cd953967` and showed that the Native host collapsed empty text rows. The final product evidence uses `a40679487c785cc7b5b7ff461fc6da6e28e2fe96`. The PR records the final reviewed head and its documentation checks.
- Candidate `0.0.0-ts05.ga40679487c78` SHA-256 `8936fd686f62541d22459f9d5373fd2678c9a01c9aea873764baddb0fd972637`. Source archive SHA-256 `19cf944eaf8d63ce11c687a056df51120f5c8e7efeba57cbe8cc9b253bf14ec7`.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64 with Node 24.21.0 | 2,044 tests passed and six platform-conditioned tests were skipped. Resource generation, documentation, archive and migration checks passed. |
| Language and documentation | 276 entries were accepted across all twelve interface languages, with zero English fallbacks. The 37 source-backed documentation and example tests passed. |
| Claude Code 2.1.332 | Official plugin validation, 374 Native tests and type checking against declarations from the same host passed on a full rerun. An existing source-management test hit its five-second timeout during the previous concurrent run. |
| Candidate | Two independent builds matched byte for byte. Verification covered 1,194 packaged files and the source archive. Registry TLS resets were resolved with bounded, certificate-verified proxy downloads of the locked tarballs. |
| Installed item details | Four Linux PTY journeys completed 200 steps through `/statusline-configure-native` and the installed `configure` entry in English and Simplified Chinese. They verified heading emphasis, an empty separator row, the fixed reference and rendered draft examples, scrolling, return focus, and configuration bytes and modes. The external journeys also resized to 64×18. |
| Impact plan and Linux smoke | The plan selected the product route. The aggregate Linux task's 409-minute estimate exceeded the 360-minute admission limit. The local product suite and all seven isolated Linux installation smoke checks passed. |

The installed runs used isolated configuration directories and made zero model calls. Visual evidence comes from Linux PTYs and reconstructed terminal cells. The six existing platform observations remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
