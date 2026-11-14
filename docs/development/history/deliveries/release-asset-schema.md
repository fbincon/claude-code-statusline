# Release asset schema documentation

**English** | [简体中文](release-asset-schema.zh-CN.md)

This 2026-11-14 documentation delivery documents the release asset schemas in the release guide and links them from the candidate build section. Product behavior, commands, public interfaces and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Manifest | `docs/RELEASING.md#release-asset-schemas` records the `build-manifest.json` fields: schema, commit, channel, version, candidate/source identities, byte-identical builds and the two build records. |
| Checksums | The same section records the `SHA256SUMS` line format, its three-file scope and the `npm run release:verify` inventory/digest check. |
| Source archive | `statusline-source/.candidate-source.json` is documented as the in-archive manifest, not a fifth uploaded asset; `build-report.json` is not a release asset. |
| Candidate guide | `docs/development/testing.md` links the field-level schema while keeping the existing four-file candidate instructions. |
| Checker | No new checker; the release build and verify tools remain authoritative. |

## Source identities

- Baseline before the task: `826bc27b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,327 links, 0 errors |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | Isolated group 1,185/1,185 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

This delivery does not change `tools/build/candidate.ts`, `verify.ts` or `files.ts`, does not rewrite a published Release or its attachments, and performs no product, installed, platform or paid acceptance.
