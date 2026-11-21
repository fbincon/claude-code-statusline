# Gitee release asset policy

**English** | [简体中文](gitee-release-asset-policy.zh-CN.md)

This 2026-11-21 documentation and release-tooling maintenance delivery changes the Gitee Release policy for current TypeScript releases. Gitee keeps mirrored code, the annotated tag, Release notes, `build-manifest.json` and `SHA256SUMS`; the Gitee notes link the package and source archive to the version-pinned GitHub originals. GitHub remains primary and still publishes and verifies all four assets. Python-era releases retain their wheel, sdist and `SHA256SUMS` Gitee attachments. Existing Gitee attachments are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Gitee renderer | `release:gitee-notes` now classifies TypeScript assets by role. It catalogs only `build-manifest.json` and `SHA256SUMS` from Gitee, validates canonical GitHub URLs for the package and source archive, emits mixed-host links, and rejects missing Gitee metadata or non-canonical GitHub asset URLs. Legacy wheel releases still require all three Gitee assets. |
| Tests | Updated the fixture and repository-wide release-body test, rewrote the preview test, and added coverage for metadata-only targets, extra Gitee large assets, canonical URL rejection, body-link rewriting and cross-version links. |
| Documentation | Updated the bilingual release guide, repository governance, user guide, `AGENTS.md`, `CONTRIBUTING.md` and `CONTRIBUTING.zh-CN.md` to describe the metadata-only Gitee mirror and the 1 GB quota. |
| Frozen content | Release notes, historical delivery records, `release-procedures*`, TypeScript migration records, `archive/python/**` and generated resources were not rewritten. `docs/PREVIEW.md` remains unchanged because it documents the fixed v3.0.0-beta.1 preview, whose Gitee Release hosts all four attachments. |

## Source identities

- Baseline before the task: `7be467eb`.
- Implementation commit: `09d8b14b`.
- Delivery-record commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,508 local links, 0 errors |
| `git diff --check` | Passed |
| `npm run build` | Passed on Node 24.21.0 |
| `node --test dist/typescript/tools/release/test/gitee-notes.test.js` | 14/14 passed |
| `node --test dist/typescript/tools/checks/test/docs.test.js` | 54/54 passed |
| `node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js` | 37/37 passed |
| Impact plan and scoped check | Local `ci:plan` route `maintenance` with `actions`, `checks`, `docs` and `release`; Linux `ci:check` status `pass` on `09d8b14b` |
| Read-only renderer dry run | v3.16.5 and v3.16.4 rendered with package/source GitHub URLs and metadata Gitee URLs; no live Gitee write |

The change is release tooling and documentation only. No installed-product, editor, platform, provider or paid-model acceptance was performed. Windows and macOS scoped tasks were not run because ordinary PRs allocate zero project CI runners; the Linux scoped receipt is the maintenance evidence. No Gitee API write, upload, deletion or Release-body update was performed. Frozen release pages, historical delivery records, `archive/python/**` and frozen release-procedure pages were not modified. Existing Gitee attachments on historical releases were not deleted or replaced. The first real application of the new policy will be the next release. The six accepted issue #96 gaps remain unverified.
