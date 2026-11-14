# Transfer artifact dependency pins

**English** | [简体中文](transfer-artifact-dependencies.zh-CN.md)

This 2026-11-14 CI maintenance delivery refreshes the local transfer-artifact Action's dependency pins to clear the open Dependabot alerts. It creates no product version, tag, Release or npm publication.

## Changes

| Area | Result |
| --- | --- |
| Action dependencies | `@actions/artifact` 2.3.2 → 5.0.3; `@actions/http-client` 2.2.3 → 3.0.2; `yauzl` stays 3.4.0. |
| Overrides | `undici` 6.29.1, `glob` 14.0.6, `fast-xml-parser` 5.12.1. |
| Lockfile | Regenerated with Node 24.21.0 / npm 11.19.0; 234 non-root entries, all registry-resolved with sha512 integrity. |
| Scope | No Action runtime source changes; no Dependabot config change; no product changes. |

## Source identities

- Baseline before the task: `fc454860`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Lock assertions | Passed: direct pins, overrides, no `@fastify/busboy`, patched `undici`/`glob`/`minimatch`/`fast-xml-parser`, octokit floors, registry/sha512. |
| `bootstrap.mjs` isolated install/API smoke | Passed: `DefaultArtifactClient.uploadArtifact`, internal twirp client/util, `HttpClient`, `glob`, `undici`, `fast-xml-parser`. |
| `npm audit --omit=dev` | 0 vulnerabilities. |
| `npm run build` | Passed. |
| `npm run actions:check` | 5 files, 144 references, 0 errors. |
| Targeted action/transfer tests | 54 tests passed, 0 failed. |
| `npm run docs:check` | 7,358 links, 0 errors. |
| `git diff --check` | Passed. |

Scoped impact-plan, PR CI and transport-probe evidence are recorded in the PR description. No product, installed, official-host, terminal, physical or paid acceptance was run; this CI-policy change does not alter product behavior. The Action change alters the acceptance-policy digest; the expected main fallback to `actions/download-artifact` may appear until the new Action bytes are accepted. Dependabot alert closure depends on the default-branch rescan.
