# npm bundled dependency scripts

**English** | [简体中文](npm-bundled-dependency-scripts.zh-CN.md)

This 2026-11-21 feature delivery removes lifecycle scripts from bundled npm dependency manifests so `npx` and ordinary installs cannot execute trimmed build scripts. Delivery is limited to source and documentation; no version, tag, Release or npm publication is created. [Issue #220](https://github.com/fbincon/claude-code-statusline/issues/220)

## Changes

| Area | Result |
| --- | --- |
| Packing | The packer removes `scripts` from every bundled dependency manifest; manifests without scripts remain byte-identical. The root manifest already had no scripts. |
| Artifact marker | New `candidate.json` files carry `dependency_manifests: "sanitized"`. Verification rejects lifecycle scripts only for marked artifacts, so historical published artifacts remain verifiable. |
| Signatures | Bundled dependency files match the signed upstream bytes exactly, or their `package.json` matches the deterministic scripts-removal transform. |
| Impact comparison | Bundled dependency manifests are normalized through the same transform before comparison; other manifest fields remain significant. |
| Regression coverage | Sanitizer, verifier marker compatibility, signature matching and package comparison tests cover the new invariant. |

## Source identities

- Baseline before the task: `db5a0b9f71b2ac355f495e265c85b0ae3b856e3b`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Targeted packaging tests | 21 tests passed across dependency, verifier, impact and signature suites. |
| `npm run check` | Passed after cleaning stale compiled outputs; 602 product tests with 596 passes and six platform-specific skips, and 1,247 tool tests. |
| Candidate build at implementation head | Two independent builds were byte-identical; SHA-256 `eb0613840270d8bdca7ac40e9ca5af84cc5a41ba95ee456a511a678d1b49f69c`; `candidate:verify` passed all 1,102 files. The later documentation-only follow-up does not change runtime bytes. |
| No-`--ignore-scripts` install | Succeeded on Linux x64; the bundled `koffi/package.json` has no `scripts`, `candidate.json` is marked `sanitized`, and the installed CLI reports 3.16.3. |
| `npm run ci:plan -- --compare` / `ci:check --task linux` | Maintenance route; package comparison equivalent with zero changed members; the Linux task passed actions, build, checks, documentation, generation, packaging and release coverage. |
| `npm run docs:check` / registered content tests | 7,436 links with zero errors; 37 content/example tests passed. |
| `git diff --check` | Clean. |

Windows `npx` itself cannot be exercised on this machine; the failure was the missing `cnoke.cjs` lifecycle target, and the local install reproduces the same lifecycle path. A later release must be handled as a product/payload change rather than a maintenance-release reuse because the bundled manifest bytes intentionally differ. The six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) platform gaps remain unverified. No paid model calls were made.
