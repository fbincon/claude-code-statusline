# External TUI migration regression repairs

**English** | [简体中文](external-tui-regressions.zh-CN.md)

Updated: **2026-10-19** (Asia/Shanghai). Delivered: **v3.1.2**. Status: **DONE** under the version-specific maintainer decision.

## Baselines and scope

The independent review fixed Python v2.0.0 at `9b6d2fab4bf165be280d428a874521bfbf02c7e1` and TypeScript v3.1.1 at clean `main`, `fb07615bb041d4433865f20317a6eb85d988e4a4`. Python source was exported directly from that commit; the current archive was not assumed identical. The earlier [v3.1.1 delivery](external-tui-parity.md) remains a historical record, not evidence that every interaction was correct.

The maintainer approved six confirmed regression repairs and stable npm/GitHub/Gitee delivery. Public commands, protocol 12, display schema 8 and independent Save/preferences contracts remain compatible. Append-only text editing and the search length/grapheme boundary shared by both baselines remain legacy limitations. The Python archive, frozen fixtures and comparison waivers are unchanged. README remains a product introduction.

## Repairs and regression evidence

| Regression and minimal trigger | Repair and assertions |
| --- | --- |
| Main Ctrl+A, select `task-active-timer`, Ctrl+E; Subagents equivalent with `status`: guidance could dereference a missing instance and close the editor | Resolve picker guidance and titles by catalog scope/type, omit instance fields, and keep configured-instance forms separate. Draw every catalog type; test absent instances, colliding custom IDs, six languages and boundary sizes; assert unchanged draft, disk bytes and backend-preview count. |
| Add a text component, Ctrl+E, Enter: the first edit changed its label rather than its body | Select the first applicable semantic field: text body, metric label, or guidance. Exercise raw CJK, combining and ZWJ input through keys, production preview, cancel, save and reopen in both scopes. |
| Settings Home, Down ×15, Tab, Shift+Tab: Labels and its scroll position were lost | Remember Settings/Layout fields independently of transient details; normalize missing fields after draft replacement. Assert both round trips, detail traversal, resize with pending input, and deleted layout references. |
| Settings Home, PgDn at 64×18: skipped Statusline theme; equivalent errors affected other forms | Page by fields fitting the grouped viewport, including reverse traversal. Assert fixed Python targets at 64×18, 80×24 and 120×30, plus Layout/detail targets and unchanged list paging. |
| `TERM=vt100`, `vt220` or `xterm-mono`: emitted explicit colors | Treat these terminals as monochrome before COLORTERM hints; retain NO_COLOR presence override, linux eight-color and existing 16/256-color mappings. Check ANSI resets, product spans and installed CLI PTYs. |
| Warning 89/Critical 90, Right then Left: valid 88 retained the prior error | Return adjustment success from the shared internal helper. External state clears the matching localized form error only after acceptance. Redraw, failed edits and unrelated backend/review notices keep their existing messages. |

The new product suite first failed eight cases against the unchanged implementation. After repair all 22 external product tests and the targeted protocol/release/CI tests passed locally. Complete final-commit acceptance and public-delivery results are recorded below; targeted passes did not replace those gates.

The installed `capture:editor -- --extended` collector additionally exercises picker guidance, text body/preview in both scopes, Settings/Layout focus restoration and four monochrome TERM values. It retains existing style-cell assertions, review states, seven boundary dimensions, six locales, configuration-byte checks and terminal restoration. Light/dark images reconstruct recorded terminal cells using fixed fonts; they are not OS screenshots or physical/human acceptance.

The first PR capture completed all six language/page sequences and three monochrome PTYs, then failed because the collector incorrectly expected a TUI frame for `TERM=dumb`. The unchanged POSIX entry explicitly rejects that terminal before raw mode. The corrected collector requires its ANSI/VT explanation, exit 2, unchanged configuration and restored attributes; it still requires actual frames and clean cancellation for vt100, vt220 and xterm-mono. The failed attempt is retained separately; only a complete capture of the final source counts as acceptance.

## CI and release boundaries

Ordinary PR/push changes limited to root README/CHANGELOG Markdown and `docs/**/*.md` use documentation link/bilingual and whitespace checks. Unknown paths, executable changes, generated resources, version identity, approval JSON, workflow changes, tags and manual runs require the full candidate matrix. Rename detection checks both paths; missing/invalid revisions fall back to the full matrix. The existing Complete candidate evidence gate rejects scope failures, missing/skipped/failed product checks, and failed documentation checks. Documentation-only runs produce no release receipts.

v3.1.2 requires final-head, merge and tag acceptance: eight installed targets, 32 Node 22/24 cases and thirteen fixed hosts using the same package digest. Two independent builds and source-archive rebuilds, installed PTY checks, draft assets and public downloads remain required. Approval date/path are matched per version; another version's decision, a changed date or expanded gaps fail verification.

[The v3.1.2-only approval](../releases/approvals/v3.1.2.json) accepts the same six existing gaps: physical macOS sleep, macOS 14 Intel desktop/power, Windows 10 desktop, WSL desktop/popup, remaining target-specific human/power checks and Claude 2.1.296 exact declarations. They remain unverified/unavailable. New functional or automated failures are not waived. D06 stays **FAIL**; PERF-01 stays **NOT_STARTED**.

## Final-source acceptance and identity

[PR #107](https://github.com/fbincon/claude-code-statusline/pull/107) merged at `ac64af37775d80a80063ff98bb23dd1e6e8c7b0c`. The annotated `v3.1.2` tag is object `8c8f1f1e973d6531fd87c61170d7ed025c1c021a` at that source. [Final-head CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39156249499), [merge CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39157934989) and [tag CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39159653022) require the same complete matrix. All three final-source runs passed 56 required jobs each, with only the inapplicable documentation-only job skipped. Each eight-target/32-runtime/thirteen-host matrix and its aggregate passed on the first attempt.

Local checks passed 987 tests: 983 passes, four expected platform skips, no failures; 36 generated resources, 2,215 documentation links, the frozen archive and all three responsibility ledgers passed. Eighteen added tests cover product behavior, actual protocol persistence and CI routing. The 32 runtime receipts use Node 22.0.0, 22.23.3, 24.0.0 and 24.22.0. Maintainer approval SHA-256: `9dec23ed27353c6e01732688c1b8323fb37fa964444e3198eca42b7b43fd26ef`.

Two clean builds and two independent rebuilds from the delivered source archive match all four files byte for byte. The merge CI bundle and downloaded GitHub draft attachments match those files. The downloaded draft tgz verifies all 670 package files and passes all ten isolated offline installed checks. Build identity stays Node 24.21.0/npm 11.19.0. Final asset hashes are recorded below.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.1.2.tgz` | 3,451,682 | `34a07be584e657052402f6d874d83217c659d26f49fad2e0c53c8a0a49c815e3` |
| `claude-code-statusline-3.1.2-source.tar.gz` | 23,707,948 | `dea3f134b00d05857a934ff862b7efae19059cba0667603bb6739537bf79e1c4` |
| `build-manifest.json` | 952 | `2a5aef16253a7801591900b38e1cdac078acd8211c2cef285ed25de23f29df7e` |
| `SHA256SUMS` | 302 | `3a78a8093d1d57fe827eecca238484a57dc43723f104508809b138ba808a3b31` |

npm integrity: `sha512-kFjPdlknTk7fRb5kg1cUcLVuFS0AArKXHi1h+o7GSYNHmtdrcE16HTdFgAJZ7fT/5WZquEbUzb7MbQG001MTtA==`. SHA256SUMS lists the other three files; its own hash is in the table.

## Installed terminal and state coverage

The final-source collector passed 168 actual page/state frames and 336 light/dark reconstructions across six languages, four pages, picker guidance in both scopes, text-body/preview, detail/edit/search/category/numeric/review states and all seven boundary sizes. Three additional PTYs verify vt100/vt220/xterm-mono without explicit colors despite a truecolor hint. A fourth verifies the existing POSIX dumb-terminal rejection. Configuration bytes and terminal attributes are preserved. Final collector report SHA-256: `08c3307b4d23fe5215846fa49deea5d008a4214a94524bb4b90d0979930d12d6`.

Captures use Linux x64, kernel 7.0.0-38-generic, xterm-256color, DejaVu Sans Mono regular/bold, Noto Sans CJK regular/bold and Noto Sans Symbols2, with recorded font hashes and fixed light/dark reconstruction profiles. These fonts have missing emoji glyphs in SVG reconstructions; code points, grapheme boundaries and terminal cells are separately asserted. They do not establish the appearance of every terminal/font or physical/human acceptance. Raw streams, cells, images and receipts stay in isolated temporary evidence, outside the source and Release assets.

Compared with the final PR capture, 324 images are byte-identical; twelve expanded-review images vary because newly created instance IDs and their wrapping vary. The six normalized review contents agree. The final images and exact cell styles were independently sampled; no general image-equality waiver or frozen-fixture change was introduced.

The installed `/statusline-configure` slash-hook → tmux popup path passes normal cancellation and Main/Subagents picker guidance. Each returns unchanged configuration, removes its lease and leaves the underlay usable; terminal attributes restore. This uses a version-only synthetic Claude host, not a real desktop conversation; model calls are zero. Protocol tests and operation replay additionally cover presets, immediate UI-language preferences, export, reviewed import acceptance/cancellation, saved instance identity/overrides/layout, revision conflicts and preview retry.

| Area | Evidence | Remaining boundary |
| --- | --- | --- |
| Main/Subagents/Settings/Layout and contextual states | Product regressions, installed PTY cells and source-bound matrix | Representative combinations; no claim of exhaustive Cartesian coverage |
| Styles, full separators, selection and overflow | Style spans, full terminal segments/cells, monochrome/basic-color assertions and reconstructed samples | Terminal palettes/fonts and human desktop checks remain scoped gaps |
| Keys, focus, paging and raw text | Exact target-field tests, both text scopes, resize/input preservation and installed-key sequences | Shared append-only editing/search limitations remain legacy |
| Draft, preview and persistence | Protocol/disk/reopen assertions, failed-save/conflict/recovery tests and isolated installed checks | Personal installation/configuration was not used |
| Locales and Unicode | Six-language boundary captures and Unicode conformance/product assertions | SVG emoji fallback is not a physical-font verification |
| Entry/lifecycle/platforms | Direct CLI, synthetic slash/tmux, signal/resize/cleanup tests, eight targets/32 Node/thirteen hosts | The six version-limited accepted gaps remain unverified/unavailable |

## Public delivery

The actual installed public `.bin/claude-statusline` bootstrap also passed a real PTY picker-guidance/cancel sequence, preserving configuration bytes and terminal attributes.

| Channel | Verified result |
| --- | --- |
| [npm](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.1.2) | Public at `2026-10-18T20:04:48.077Z`; latest=3.1.2, beta=3.0.0-beta.1; anonymous SHA-256/SHA-512 match |
| [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.1.2) | Release 416660752, published `2026-10-18T20:07:27Z`; four matching attachments, non-draft and non-prerelease |
| [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.1.2) | Release 1216983, created `2026-10-19T04:08:21+08:00`; same annotated tag and four anonymous matching downloads; all ten offline installed checks pass |
| [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39161871568) | Six of six Linux x64/Windows x64/macOS ARM64 cases pass on Node 22.23.3/24.22.0; each installs exact 3.1.2 and latest with fresh caches and scripts disabled |

[OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39161352173) passed before the [live publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39161493210). The publication receipt records `published`, source/tag CI and the exact package digest; no publication retry was needed. Local public-download verification independently passes both selectors and GitHub/npm bundle checks.

Gitee's automatic repository archives are distinct from the four delivered attachments. The first release-notes PATCH omitted the API's required tag_name and returned 400 without changing metadata. Reading the existing Release confirmed the unchanged body; supplying the original tag_name and stable flag then updated the rendered bilingual notes successfully. The tag object and attachments remain identical; no upload was repeated.

GitHub remains primary. Gitee synchronization uses checked, non-divergent main and the exact annotated tag with explicit non-force refspecs. The delivery-document follow-up does not move the public tag or replace assets. Root READMEs, historical releases, beta and the personal installation are preserved. The six accepted gaps remain unverified/unavailable; D06 stays **FAIL: 104 pass / 60 fail / 28 inconclusive**, PERF-01 **NOT_STARTED**.
