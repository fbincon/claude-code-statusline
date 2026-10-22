# Setup and complete appearance implementation

**English** | [简体中文](setup-appearance.zh-CN.md)

The development baseline is `a268fcb3b2ed8ad89da07d7e36e70fa8f4e691f2` (v3.4.0 plus repository cleanup). This work implements SETUP-01, APPEARANCE-01 and APPEARANCE-02 for v3.5.0. SHOWCASE-01 and external data sources remain separate work.

## Implementation

- The CLI setup service inspects files without write probes or installation locks, fingerprints reviewed resources, and saves the user-default display before independently applying integration. `ConfigurationService.saveDisplay` neither requires existing integration nor applies host preferences. The installer rechecks reviewed resources under its file lock. Durable backups and recovery journals retain partial-commit truth.
- A shared pure setup reducer and the existing Quick setup reducer drive the terminal wizard. Both configuration editors share Quick setup Save as and all appearance fields; native copies are generated. Host Apply stays independent. Shared-profile saves expose affected projects.
- Three complete entries extend the existing preset registry. Their single-profile JSON examples are deterministic generator outputs, without project bindings, host preferences or collector authorization. Saved copies retain their own identities and are not refreshed from built-ins.
- Powerline uses common geometry for explicit rows, automatic wraps, spacers and subagents. Color sequence is assigned after fitting and scoped to one render. Legacy semantic colors and geometry remain defaults. ASCII task/agent indicators retain distinguishable states.

## Interfaces and compatibility

Display schema 9 adds `powerline` with `padding`, `separator`, `start_cap`, `end_cap`, `color_mode`. Editor protocol 16 carries it, and adds the new preset metadata and CLI option descriptions. Runtime 2, lifecycle 4, portable 1, UI preferences 1 and profile collection/export 1 are unchanged. Schema 1–8 reads migrate only in memory; writes retain compatible backups. Older frontend/backend protocol pairs remain rejected.

The 161 frozen fixtures are unchanged. Their comparison explicitly translates only known display schema/default fields, derived revisions, portable/config bytes, new descriptor fields and the existing protocol metadata. Rendering values and original input/backup bytes remain compared. The existing CLI-help exception uses a new exact hash for the added setup command; no new arbitrary comparison exception is allowed.

## Verification and delivery

The maintainer's [2026-10-23 decision](../releases/approvals/v3.5.0.json) accepts only the six existing unverified observations in [#96](https://github.com/fbincon/claude-code-statusline/issues/96). It does not waive new failures or claim human desktop/power acceptance.

Feature tests cover setup read-only behavior, scoped saves, conflicts, migration backups, partial failures/recovery, schemes, controls, Unicode and widths. Installed acceptance additionally runs cancellation, display-only save and integration in POSIX PTYs or a Windows console, with synthetic host-version evidence identified explicitly. Fixed official-host tests remain separate and use no model requests.

### Release identity and automated gates

[Implementation PR #121](https://github.com/fbincon/claude-code-statusline/pull/121) delivers source `7723c540c3e16644b5601b94ce538dcd4ed37d68`. The annotated `v3.5.0` tag object is `b354f9390b779f32e9d962dcf1a6090a858a0402`. GitHub Release `421254542` became public at `2026-10-22T22:41:42Z` (2026-10-23 in Asia/Shanghai).

Local `npm run check` at the final feature head completed 1,101 tests: 1,097 passed, four existing platform skips and zero failures. All 45 generated resources, 2,702 documentation links, archive integrity and migration ledgers passed. Node 24.21.0/npm 11.19.0 produced the release bundle.

| Gate | Evidence | Result |
| --- | --- | --- |
| Final PR head `40c47f6a4b09565986644cb029176d47c2072370` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39856286812) | Passed, attempt 1 |
| Merged main `7723c540c3e16644b5601b94ce538dcd4ed37d68` | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39859424420) | Passed, attempt 1 |
| Annotated v3.5.0 tag | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39862813646) | Passed, attempt 2; artifact transport recovery below |
| npm OIDC preflight / publication | [Dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39866325694) · [Publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39866439429) | Both passed, attempt 1 |
| Public GitHub/npm downloads | [CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39866794799) | Passed: six jobs, twelve installations with initially empty caches |

Each full PR/main/tag run passed eight installation targets, 32 Node 22/24 cases, thirteen fixed Claude hosts and aggregate readiness. Each had 56 successful jobs and one inapplicable documentation-only job. The source-bound readiness reports preserve the six-gap decision and its SHA-256 `ee798ad37f6dbbbedc65e56fde50f702365bccb5278fc8fc0711139724bb69b6`; they do not turn those observations into passes.

### Installed artifacts and capture evidence

Two independent local builds, two builds from the delivered source archive, and the main/tag CI candidates produced identical package, source, manifest and checksum files. All four GitHub draft attachments were downloaded and compared before publication. Local and draft-download packages each passed all eleven isolated installed checks, including setup cancellation, display-only save and integration.

Official Claude Code 2.1.294 validation passed exact-host type checks, 128 native tests and fourteen runtime tests. The final installed native smoke exercised real host hook/render/runtime/UI commands, saved `quota-watch`, and opened the task-details pane. It used a synthetic key and unreachable loopback API with zero model calls. This establishes the automated host journey, not human desktop or physical power acceptance.

The final release package produced 258 setup/scheme captures and 528 extended editor captures across six languages, plus four monochrome/limited-terminal cases. Capture receipts verify terminal restoration and unchanged saved configuration after cancellation. Wizard captures explicitly inject synthetic Claude 2.1.258 detection; actual official-host tests are separate. The 27 committed gallery PNGs are byte-identical to images regenerated from the final release package. Fixed rendering inputs and reconstructed PTY cells are samples; agent image inspection does not establish human platform acceptance.

| Final capture receipt | SHA-256 |
| --- | --- |
| Setup/scheme, 258 captures | `107148bcda3bfd19377a54ddda994991d1faa7533228ff31149d5001074c5daa` |
| Extended editor, 528 captures | `9b881a5785ba5b3b34353696be4dee3b25c4cf9d76ab1fe7af90bbcbb3e8a2e2` |

### Public delivery

| Delivery file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.5.0.tgz` | `dc3dd446ec43075c017199c0fc631d89fe46ba7b17d8757917696f3ba22d945b` |
| `claude-code-statusline-3.5.0-source.tar.gz` | `7671e2df3cf464925a0b4820c74a1466b34d4bae6daa760fa5dc7dd6b45cca10` |
| `build-manifest.json` | `ec4ae88bf016543f73dea9979988833e8ba0db511012fbfa860903b435374ed5` |
| `SHA256SUMS` | `ff7b50697d6c47fc496af6dd923dc07b4084d947824290f3e333649b1a0ca197` |

The [npm package](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.5.0) and [GitHub stable/Latest Release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.5.0) deliver the same package bytes. npm `latest` is 3.5.0 and `beta` remains 3.0.0-beta.1. The OIDC publisher signed [provenance](https://search.sigstore.dev/?logIndex=3403074307) at `2026-10-22T22:39:28Z`, then verified public SHA-256/SHA-512 and selectors in the same successful attempt. Local anonymous GitHub/npm downloads and both fixed-version/`latest` installations passed with initially empty caches.

[Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.5.0) `1231272` uses the same source and annotated tag. All four attachments were anonymously downloaded with normal TLS verification and matched the table byte for byte. The downloaded bundle passed delivery verification, and its package passed all eleven isolated installed checks. Uploads and downloads completed without a transport retry.

### Corrections and recovery

Before final acceptance, 80-column sample inspection led to compact scheme labels and tighter directory/Git widths. Inherited Powerline backgrounds now avoid matching the resolved foreground while preserving explicit overrides and threshold foreground rules. The Japanese capture selector was corrected to match the localized UI. An installed failure-path fixture now explicitly requests the intended native-operation failure; the earlier Windows process failure has no proven OS cause and its log is retained.

An earlier PR aggregate rejected the omitted v3.5.0 approval-registry entry after all 53 target checks had passed. The registry and a regression against the actual current-version approval were corrected; the final PR/main/tag gates all passed without expanding accepted gaps.

The tag's first attempt failed while the Node 22.x/macOS 15 Intel job downloaded its artifact: the artifact service timed out after five attempts, before product tests. Only that failed job and its dependent aggregate were retried. Attempt 2 passed with the same source/package and unchanged checks; successful targets were retained. npm publication needed no retry.

Raw logs, superseded candidates, final receipts and ANSI/cell captures remain in ignored `dist/validation/v3.5.0/`. This delivery-documentation follow-up uses the necessary links/formatting checks; published files and tags remain immutable. The six accepted historical gaps remain explicitly unverified.

[Setup](../SETUP.md) · [Schemes](../SCHEMES.md) · [Appearance](../APPEARANCE.md) · [Capture provenance](../images/setup-appearance/README.md)
