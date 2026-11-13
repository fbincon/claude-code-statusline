# Project agent guidance maintenance

**English** | [简体中文](agents-guidance-maintenance.zh-CN.md)

This 2026-11-14 documentation maintenance aligns root `AGENTS.md` with the documentation governance established by the November documentation reorganization. It adds the ownership/history split, delivery-record and frozen-page rules, image manifest/provenance duties, registered-guide content checks, and precise CI responsibility classification; it also clarifies canonical skill resources, paid-acceptance evidence, the release-note pairing boundary and Gitee synchronization scope. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Documentation ownership and history | Root guidance now points to the ownership map, keeps current procedures under `docs/development` and frozen records under `docs/development/history`, and names the CLI reference as the owner of current interface and format versions. |
| Delivery records | Substantive documentation work must add a bilingual record under `docs/development/history/deliveries/`, link it from the delivery index, record source/artifact identities and actual checks, and leave frozen records unchanged. |
| Moved pages and archives | Moved or archived pages retain original evidence, commands and results plus a link at the old path and section anchor; archived release notes, delivery records and images are frozen. |
| Images and captures | The gallery index and bilingual gallery README/status entries must stay consistent with the directory tree, related guides and capture/provenance manifests, including SHA-256 values, dimensions and byte counts; new captures use neutral sample paths and archive images are never re-encoded. |
| Documentation checks | Registered root and current development guides now require `npm run build` plus the source-backed content and example tests, bilingual updates, source-backed rule changes and regressions; `docs:check` remains the lightweight link/anchor/template check. |
| CI and acceptance | Impact classification now names product logic, protocols, runtime dependencies and bundled skill instructions for the complete matrix and build/generation inputs for package comparison plus generation/build tests and installation smoke; paid checks require an approved budget and shared ledger. |
| Release and synchronization | The release-note boundary is aligned to v3.9.2 and both language indexes are linked; Gitee mirrors code and release files; the issue #96 warning links the known validation gaps. |
| Canonical skill resources | The statusline `SKILL.md` files under `packages/cli/resources` are identified as canonical and not generated. |

## Source identities

- Baseline before the task: `06b047bd`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,213 local links, 0 errors (baseline 7,202) |
| `git diff --check` | Passed |
| Documentation content and example tests | Not required: no registered root or current development guide changed |
| Impact plan and scoped check | Selected tasks and results are recorded in the PR description after CI |

This is documentation-only maintenance. It does not perform installed-product, editor, platform, provider or paid-model acceptance, and it does not revalidate the existing behavior/compatibility policy statements. Historical content is not rewritten. The six accepted issue #96 gaps remain unverified.
