# npm installation and first entry

**English** | [简体中文](npm-bundled-dependency-scripts.zh-CN.md)

This 2026-11-21 feature delivery repairs the default npm first entry described in [issue #220](https://github.com/fbincon/claude-code-statusline/issues/220). The source repair lands in PR #286. Stable packaging and publication use the separate release PR.

## Changes

| Area | Result |
| --- | --- |
| Packing | New artifacts remove `scripts` from bundled dependency manifests and mark the result as `sanitized`. Koffi uses its bundled prebuilt binaries. |
| Verification | Candidate and signature verification cover all bundled public and private manifests on marked artifacts. Unmarked historical artifacts retain their readers. |
| First entry | Prefix detection skips a verified shim of the running package in the npm cache and checks the subsequent PATH entries for a persistent installation. |
| Impact comparison | Changes to shipped lifecycle scripts select the product route. The source comparator runs before compilation. |
| Release smoke | Real npm and a terminal exercise the review, setup handoff, cancel and rendering after cache removal. |

## Source identities

- Baseline incorporated into the branch: `4c3f432168dc8880d5fd487aa09d76397ecb15bc`.
- Packaging-only comparison head: `d0417caa31f37cfaba9d28849792fa98ee021dfa`.
- The final source, package and execution identities are recorded in [PR #286](https://github.com/fbincon/claude-code-statusline/pull/286).

## Validation and limits

| Check | Actual result |
| --- | --- |
| Clean source `ci:plan --compare` | Product route. The comparison identified the shipped Koffi and lossless-json manifests as changed members without a preceding build. |
| Original reproducer | On Linux, published 3.16.3 exited before CLI startup when npm tried to load the missing Koffi installer. An earlier script-free candidate reached the CLI and stopped before review due to its own temporary shim. |

The [PR validation record](https://github.com/fbincon/claude-code-statusline/pull/286) binds the final tests and platform limits to the reviewed head.
