# Bundled configuration skill workflows

**English** | [简体中文](skill-workflows.zh-CN.md)

> **Historical record (frozen at v3.16.3, 2026-11-05).** Current behavior is in the [development guide](../../README.md) and [roadmap](../../roadmap.md); current interface versions are in the [CLI reference](../../../reference/cli.md#protocol-and-schema-versions).

<a id="final-release"></a>

## Validation and release evidence

This record tracks the v3.16.3 repairs to the two canonical skill templates in `packages/cli/resources`.

Published on **2026-11-05**: [npm 3.16.3](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.16.3), [GitHub stable/Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.3) and [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.3). Product source `0d8b928fd7ff6b83af49e9c590c01087021a6a20` passed [PR #206](https://github.com/fbincon/claude-code-statusline/pull/206). Its two-parent main merge is `4791ea88157ae696097b63a9c0158ef7c0df9956`, with the same tree. Annotated tag `v3.16.3`, object `830e3afa65428b0bc5ab84dc9709e4eb97623073`, points to the accepted product source under the complete-source release route. This documentation follow-up does not change the released tag, bytes or original acceptance.

### Original checks and promotion

| Evidence | Verified result and identity |
| --- | --- |
| Local checks | `npm run check`: 1,671 total, 1,665 passed and six expected platform skips; focused skill regressions: 21/21. Generation produced 118 outputs. Generation consistency, documentation (4,518 links), whitespace and frozen-archive checks passed. |
| Final product PR | [Run 41960181915, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/41960181915): success; required aggregate `127061199788`; candidate artifact `13384712855`; acceptance artifact `13389767502`. |
| Full product obligations | Eight installed targets, 32 Node cases, sixteen fixed hosts, 313 capacity cases per applicable host and twelve accepted languages with 2,324 keys each. All 56 installation/runtime/host history obligations retain full depth; `stable_ready` is true. |
| Main integration | [Run 41972029217, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/41972029217): success; required aggregate `127063627383`; promotion artifact `13390371812`. Integration smoke and byte verification retain original PR execution identities. |
| Annotated tag | [Run 41972672998, attempt 1](https://github.com/fbincon/claude-code-statusline/actions/runs/41972672998): success; required aggregate `127064993023`; promotion artifact `13390666471`. Source, main, tag object and original coverage were verified together. |
| Reproducible delivery | Two independent candidate builds and two builds from the delivered source reproduced all four original CI files byte for byte. |
| Public verification | [Run 41975586480](https://github.com/fbincon/claude-code-statusline/actions/runs/41975586480): all seven jobs passed—signatures/provenance and Node 22/24 downloads/installations on Linux, Windows and macOS. |

Candidate and acceptance artifact ZIP SHA-256 values are `42867b78d5e5f65c042cce1cc20bbc5ad828a2d7ee44ebd4b39da6789176764e` and `2eb6a602e89e208bef2a9c8b579a0f889a78333de2dd48b8671ef8bbb94e6c5d`. Main and tag promotion ZIPs are `add3363dfad3c955cb95cf5585eadde97bc4e7854b8bc704687f17aa36ed27f9` and `77466f62d0c9b44f6a3b9590b4cb83782bff5aa4fd3b8a4dcb2542719bbdee61`. The original source acceptance record SHA-256 is `84093a8d59779f2de4ccee4d478582bde1fe29ba2bdfe84268ada413cd5b13d0`. Superseded source runs and manual diagnostics do not replace these identities. All six local scenarios passed against the frozen final source before its already-running matrix completed; private-driver repairs did not trigger another product matrix.

### Actual installed skill calls

All six scenarios passed against that source/package on Claude Code **2.1.318**. A private task-specific driver used SDK **0.3.296** for controlled answers and observation, invoking actual installed slash skills without pasting template text. Command records, configuration bytes/modes and backups establish the results; model narration is not save evidence.

| Scenario | Questions; Bash / Read / Ask calls | Apply / new backups | Observed result |
| --- | --- | --- | --- |
| English save | 42, including all 32 metric pages once; 9 / 3 / 11 | 1 / 1 | Saved chosen user-default/host changes; bound-profile bytes/mode, retained order, custom label and unasked appearance survived. The current language outside the selected page was kept; colors off retained the ANSI palette. |
| Chinese save | 42, including all 32 metric pages once; 9 / 1 / 12 | 1 / 1 | Chinese questions saved Korean output language and appended hostname, retaining other fields, palette and subagent choices. |
| Cancel | 4; 6 / 3 / 1 | 0 / 0 | Original configuration bytes, modes and absence preserved. |
| Component group | 0; 2 / 0 / 0 | 0 / 0 | Stopped before questions; group structure and original bytes/modes preserved. |
| Cross-row alignment | 0; 2 / 0 / 0 | 0 / 0 | Stopped before questions; alignment structure and original bytes/modes preserved. |
| External fallback with hooks disabled | 0; 0 / 0 / 0 | 0 / 0 | Actual `/statusline-configure` fallback supplied terminal guidance without tools or writes. |

The private six-case summary SHA-256 is `f32e3a1c413c447c09ad3036a11d25d6acd54d5d1d8f616949cd6c70555c1350`, binding each report, driver, source, host, package and request identity. Raw logs remain private. Earlier model and private-driver failures remain separate failed diagnostics in the shared ledger. Driver repairs covered localized answers, palette-question classification and literal Bash quoting; private checks and replay verified them without changing the frozen product source.

### Published bytes and npm provenance

| Original delivery file | Bytes | SHA-256 |
| --- | ---: | --- |
| `fbincon-claude-code-statusline-3.16.3.tgz` | 5,173,691 | `7b5d8c122b074937ded4d574cfbf0fcac5b76df6d420622cc4ef69f3283c733c` |
| `claude-code-statusline-3.16.3-source.tar.gz` | 36,870,359 | `dbf1ce5d12cf840e7db67808d9ea3ea6457afcb6574f2002149b157abd76cd09` |
| `build-manifest.json` | 955 | `6af8efcfeebf07027523b04d05236742c876ddd26f5f99bb767271ff84704cdb` |
| `SHA256SUMS` | 304 | `768250bb41afdbab02be41e07b2c1e4036444d933366d4af5cd64da223c4048c` |

[npm preparation dry run 41973758527](https://github.com/fbincon/claude-code-statusline/actions/runs/41973758527) passed. [Live OIDC run 41974310603](https://github.com/fbincon/claude-code-statusline/actions/runs/41974310603), attempt 1, publisher job `127069916672`, uploaded the original CI package and signed provenance ([transparency entry 3692636488](https://search.sigstore.dev/?logIndex=3692636488)). npm accepted the upload, but public visibility exceeded the verifier's three-minute window. After anonymous metadata, exact package bytes/integrity and selectors were verified, only the failed publisher job was retried. Attempt 2, job `127072319582`, passed as `already-published`, performed no second upload and reported `oidc_verified: false`. That existing-version path emitted no fresh npm-publication receipt. Original OIDC publication/logs and verification-only retry retain separate identities.

The public npm package equals the original CI tgz; `latest` is `3.16.3`, while `beta` remains `3.0.0-beta.1`. GitHub Release `434811210` was published at **2026-11-05 05:41:21 UTC**, with stable/Latest verified. Authenticated draft and fresh anonymous public downloads matched all four original files. Gitee Release `1275524` uses the same source/tag; all four anonymous attachment downloads equal GitHub and the original CI bytes. Its two automatic source archives are not delivery files. Gitee notes were rendered from the public GitHub Release and actual attachment URLs. Metadata, body and unchanged attachment identities were read back after updating. Explicit main/tag refspec synchronization verified main `4791ea88157ae696097b63a9c0158ef7c0df9956`, tag object and dereferenced source. A failed desktop MCP connection was followed by an exact absent-release check and one successful fresh official MCP creation; CDN timeout/unsupported-resume diagnostics were retained before verified fresh-DNS/native-interface downloads with normal TLS verification.

### Actual-machine verification and budget

After a verified read-only review, the installed product manager upgraded the machine from **3.16.2 to 3.16.3** through normal transactions, locks and retained recovery runner. Package/integration verification completed. All **1,093 installed files** match the public artifact. Two repeated installs preserved owned files, modes, absence and backup inventory. Configuration JSON reads passed. Claude Code initialization discovered both installed skills in a network-isolated process: **zero prompt messages and zero model requests**.

A fresh pre-upgrade snapshot protects eleven preference paths, including both Claude user-state locations. Original bytes, modes and absence were verified/restored, allowing only the owned Native `backendVersion` advance to 3.16.3; the separately checked installation binding also changes only its backend version. Personal display, language and profile choices remain. `doctor` passed with 23 OK results and one explicit Native-session-loading warning; actual interactive Native loading/physical acceptance is not claimed. No post-publication paid request was sent.

All calls, failures and retries share the **USD 30** authorization, explicitly increased on 2026-11-05, with USD 24 allocated before publication and USD 6 after it. The final ledger contains **241 attempts: 236 known and five unresolved**. Conservative known-usage upper estimate **USD 2.5123041**, plus **USD 5** retained unknown reservations, gives **USD 7.5123041 total upper bound**, rounded up to **USD 7.52**. Four unresolved TLS attempts and one disconnected POST retain USD 1 each; reserves were not refunded or treated as zero. Known usage uses the provider's peak input/output rates, conservatively counting cached input as a miss ([provider pricing](https://api-docs.deepseek.com/quick_start/pricing/)); SDK estimates are auxiliary, and this is not an invoice. Paid calls are disabled and owned model processes have exited.

Display schema 17, editor protocol 31 and existing storage formats are unchanged by this patch. The six previously accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new automated failures. [Release notes](../../../releases/v3.16.3.md) · [Version decision](../../../releases/approvals/v3.16.3.json)
