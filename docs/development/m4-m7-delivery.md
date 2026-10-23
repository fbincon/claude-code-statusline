# M4–M7 implementation and delivery

**English** | [简体中文](m4-m7-delivery.zh-CN.md)

APPEARANCE-03, COMPOSITION-02, WORKFLOW-02 and METRICS-01 are delivered in **v3.7.0**. The maintainer approved four feature PRs and one release PR, persistent local opt-in for automatic refresh, and publication after the final PR/main/tag automated gates. Research baseline: `a882bd1942d0a59e24e1536779fa283fd1f63c1b`. Only the six existing [#96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted; they remain unverified. SHOWCASE-01 and GIT-01 are outside this delivery.

## Implemented behavior

| Package | Result | Interface |
| --- | --- | --- |
| APPEARANCE-03 | Optional per-instance percentage bars for eligible main/subagent context and quota items; numeric defaults, raw thresholds and missing/stale semantics retained | Display 11 / editor 18 |
| COMPOSITION-02 | Contiguous single-level groups, primary-linked text visibility, optional shared Powerline background, atomic fitting, remapped copies and explicit editing | Display 12 / editor 19 |
| WORKFLOW-02 | Reviewed local GitHub-only refresh policy, active-session leases, identity-aware coalescing, manual ownership, backoff, pause and stop controls | Source registry/jobs 2 / editor 20 / runtime 3 |
| METRICS-01 | Optional hourly cost estimate with independent session/API denominator, one-minute minimum, valid zero and explicit estimate/unit markers in six languages | Display 13 / editor 21 |

Shared core controls govern both editors, CLI validation, portable persistence and project schemes. Generated Mod copies follow the canonical source. Old display files migrate in memory until explicitly saved; runtime v1/v2 observe/read remain compatible. Portable imports cannot authorize source execution. Automatic refresh is separate from display Save, host integration and both metric collectors. It requires Claude 2.1.289+ and configured runtime integration, renews leases every five seconds and expires them after 15 seconds. Render/preview/import do not dispatch it; JSON and command sources remain manual.

## Source and automated gates

Feature PRs: [M4 #129](https://github.com/fbincon/claude-code-statusline/pull/129), [M5 #131](https://github.com/fbincon/claude-code-statusline/pull/131), [M6 #132](https://github.com/fbincon/claude-code-statusline/pull/132), [M7 #133](https://github.com/fbincon/claude-code-statusline/pull/133). [Release PR #134](https://github.com/fbincon/claude-code-statusline/pull/134).

- Final release source: `3edd719525635eedb6a909eee23bb96a4fcab393`; annotated `v3.7.0` object: `601ea862730d13d2d5feac022deedf927b62c291`.
- [Final PR CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40013222675), [merged-main CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40025287730) and [tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40029428803): each passed all 56 applicable jobs, with only the documentation-only job skipped. Each round requires eight installation targets, 32 Node runtime cases and thirteen fixed Claude hosts.
- Integrated local check: 1,160 tests passed, five platform skips; generated resources, documentation links, frozen archive and responsibility inventories passed. Native Mod tests passed 132/132 on Claude 2.1.294; runtime Mod tests passed 16/16 and exact-host typechecking passed on both 2.1.289 and 2.1.294. Final CI independently validates the full required host matrix.
- Installed acceptance requires all 16 checks, including three indicator, four group, four automatic-policy/lifecycle and four cost-rate scenarios. Final stable readiness rejects missing, failed, duplicate or foreign-identity receipts.

The M4 merged-main run [40006647972](https://github.com/fbincon/claude-code-statusline/actions/runs/40006647972) exposed an atomic source-file replacement race on macOS Intel/Node 22.x. M6 fixes it with at most three complete snapshot attempts, retaining no-follow, type, size and descriptor checks. Deterministic replacement, exhaustion and link-swap tests cover the repair. A Windows-only assertion in [40011934863](https://github.com/fbincon/claude-code-statusline/actions/runs/40011934863) then identified changed error text; the follow-up preserves the Windows message and verifies the dedicated error type. Failed/superseded runs remain evidence, not waivers. Earlier Windows ARM command-fixture timeouts were addressed by selecting the existing supported 30-second test budget; production defaults and cancellation/deadline tests did not change. M4's isolated setup-node stall passed on an unchanged-source targeted retry.

The final PR's first attempt also stopped one macOS Intel/Node 22.0.0 configuration write because the existing bounded `/bin/ps` identity probe returned no verifiable token. Its underlying error was not logged, so a specific timeout cause is not claimed. The original job log and failed receipt were retained. One unchanged-source targeted retry passed all 16 installed checks, runtime tests and the aggregate gate; no identity protection or process-probe deadline was relaxed.

The first tag attempt's macOS 26 Intel/Node 24.0.0 job remained in its product-test step beyond the two ten-minute subprocess budgets and did not respond to normal cancellation. It was force-cancelled; GitHub returned `BlobNotFound` for its log even after completion, so only live job metadata and the cancellation annotation are retained and the underlying cause is unknown. An unchanged-source targeted retry and the aggregate gate passed. No test was waived, and the package/tag source was not changed.

## Reproducibility and terminal verification

Two independent builds and a delivered-source rebuild produced identical delivery bytes. The four downloaded draft assets were verified before publication; the final installed package passed smoke and extended terminal checks. Final Linux PTY evidence contains **684** dark/light captures across English, Simplified Chinese, Taiwan/Hong Kong Traditional Chinese, Japanese and Korean, plus monochrome/dumb-terminal checks. Group editing, bar and cost-rate controls, automatic review/interval cancellation, terminal restoration and unchanged configuration are covered. These are terminal-cell reconstructions, not OS screenshots or human acceptance.

A controlled real GitHub read using a synthetic active-session lease passed before release: PR/CI observations were fetched, automatic work stopped when disabled, and the configured source/cache remained available. It used an isolated configuration and made no model calls; it is not an actual user-session or physical-platform acceptance claim.

| Public asset | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.7.0.tgz` | `b1afec4a234368ab0ef2e23f728b8204122c86e17213af32738b6f3d84363e95` |
| `claude-code-statusline-3.7.0-source.tar.gz` | `818498d739df808bbd442f2006febd0dedef581ac4f4ecc28eb5ee50ca716152` |
| `build-manifest.json` | `f9a2ceb15c355b881e10534438e07560eb8784b0f3e5abad14eeabfe6ceaaf4b` |
| `SHA256SUMS` | `01e63a201758a5999ca182afeddde4a56a6271da89db6b3c785479ca2c5e5660` |

## Public channels

[npm 3.7.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.7.0), [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.7.0) and [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.7.0) are published and download-verified. [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/40036511985) and [publication](https://github.com/fbincon/claude-code-statusline/actions/runs/40036648946) verified exact package bytes and integrity; `latest=3.7.0`, with `beta=3.0.0-beta.1` unchanged. [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/40037013526) passed exact-version and latest installations on Linux, Windows and macOS. GitHub/Gitee each expose the same four verified files. Validated main and the exact annotated tag were synchronized to Gitee with explicit refspecs; GitHub remains primary.

The [v3.7.0 approval](../releases/approvals/v3.7.0.json) does not verify physical macOS sleep, macOS 14 Intel desktop/power, Windows 10 desktop, WSL desktop popup, remaining target power/human visuals or unavailable Claude 2.1.296 exact declarations. Those six gaps remain open in #96. Raw logs, receipts and machine-local captures are retained under ignored validation directories; README contains feature introductions rather than release history.
