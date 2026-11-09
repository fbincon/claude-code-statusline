# Task pane controls and editor draft protection

**English** | [简体中文](editor-input-delivery.zh-CN.md)

## Keyboard and terminal acceptance

Claude Code 2.1.316 opened the task pane from the conversation with no mouse click. At 80×24 inline and 140×44 docked, each 81-step journey checked the selected report row, backend read count, search, filtering, folding, paging, refresh, field cancellation and paste. A pre-existing conversation draft survived the focus handoff and still matched after the pane closed. The final npm package passed 28 Native and 15 external installed Linux PTY journeys, plus three standalone npm entry checks. [Task details](../../../TASK_DETAILS.md) · [Editor controls](../../../USER_GUIDE.md)

GNOME Terminal 3.58.0 with VTE 0.84.0 and Claude Code 2.1.316 passed 31 graphical automation steps against the same package. GNOME handled Ctrl+- as zoom. Ctrl+/ and Ctrl+Shift+- passed byte `0x1f` to the editor, and Ctrl+R passed `0x12`. Undo, redo, empty-stack messages, read-only catalog details and input-field isolation passed. The events were synthesized. The maintainer's six accepted gaps, including human visual and physical checks, remain open. [Draft history](../../../DRAFT_HISTORY.md) · [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)

The downloaded GitHub draft also passed installed smoke tests. The 80×24 task journey passed. When the host allocated the editor fewer than 12 body lines, it showed recovery and retained the draft. Increasing the terminal height to 50 restored the editor in the same session. The external editor passed at 80×24 after registering the exact installed executable in its isolated configuration.

<a id="final-release"></a>

## Source and release gates

The accepted source is `a104294dd5dcbbc30c9d67dc9e5c2f007c410d57`. The main merge `e074b06aac4b458db371206c2c67f7425e5ba8f0` has the same tree. Annotated tag `v3.16.2` is object `3fc952cb7141c453311a0992aca967be7fd9e496` and points to the accepted source. [Product PR #204](https://github.com/fbincon/claude-code-statusline/pull/204)

| Gate | Verified result |
| --- | --- |
| [Final PR](https://github.com/fbincon/claude-code-statusline/actions/runs/41291221369/job/124827440507) | All 66 product jobs passed on attempt 1. The aggregate bound 8 installations, 32 Node cases and 16 fixed hosts, each with 313 capacity cases. All twelve languages passed release readiness with 2,324 keys each. Candidate `13077800716` and acceptance `13080657747` identify the original artifacts. |
| [Main](https://github.com/fbincon/claude-code-statusline/actions/runs/41299924324/job/124829378957) | The accepted first parent independently verified the PR evidence, merge and tree. Three platform smokes passed. Promotion artifact `13081470110` retained the original source. |
| [Annotated tag](https://github.com/fbincon/claude-code-statusline/actions/runs/41300323011/job/124830093381) | Promotion artifact `13081042381` bound the same original receipts and four delivery files to the tag and main merge. |
| [npm dry run](https://github.com/fbincon/claude-code-statusline/actions/runs/41300991328) and [OIDC publication](https://github.com/fbincon/claude-code-statusline/actions/runs/41301175313) | Both ran from the same tag. The live run issued publication receipt `13081276913`. `latest` advanced to `3.16.2` and `beta` stayed at `3.0.0-beta.1`. |
| [Public downloads and signatures](https://github.com/fbincon/claude-code-statusline/actions/runs/41301532498) | Six jobs installed both the fixed version and `latest` from empty caches on Linux, Windows and macOS with Node 22 and 24. The seventh verified the outer package's two signatures, two attestations and six bundled public upstreams. The signed outer inventory covers the four private workspaces. |

Two independent Git builds and two builds from the delivered source reproduced all four original CI files. Anonymous GitHub downloads and the npm tarball matched those bytes. [GitHub stable release](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.16.2) · [npm 3.16.2](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.16.2)

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.16.2.tgz` | `d03e6e7faa79414759cd396ca345d5f5b392959ab4bc2e29b240e246d6b40c8f` |
| `claude-code-statusline-3.16.2-source.tar.gz` | `d93c3b615b4df0d2f7852e23001bec2fcd14258afc6275a2b22f03713661493e` |
| `build-manifest.json` | `b883ba2bccc846d1ef62960c805ae21f99974baf9b189dcce2b682f26dfba533` |
| `SHA256SUMS` | `1ac8b89dc3dd5b96dd828904a7edfa643f31f1abfaa90f676f29572a7985640c` |

Gitee release `1263258` published the same files. An independent anonymous download matched each file to GitHub and to the original CI artifact. The first Gitee upload encountered a TLS error. Two metadata checks and an anonymous 404 established the file was absent before the successful upload. The public release contains one attachment per filename. [Gitee stable release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.16.2)

Earlier PR attempts exposed a cold SDK-install timeout on Windows ARM64, a Windows test that left the discard prompt open, and a circular module wait in the evidence CLI. The final head fixed these and issued its own evidence. [Earlier aggregate](https://github.com/fbincon/claude-code-statusline/actions/runs/41284039503/job/124800948249) · [Windows ARM64 measurement](https://github.com/fbincon/claude-code-statusline/actions/runs/41283455910)

## Verified installation

The test machine retained the public 3.16.2 upgrade. All 1,093 installed files matched the public npm package. Of eleven protected preference paths, six files existed and five were absent. Every original mode and absent path matched. The only changed setting was the Native plugin's owned `backendVersion`, from `3.16.1` to `3.16.2`. No extra preference rewrite was needed.

The installed CLI's doctor exited successfully with 23 passing checks and one warning asking for a running Native session. Under the actual user-level registration, Claude Code 2.1.316 passed 16 PTY steps across both slash commands, including undo/redo, keyboard search, a fresh backend read and close. The PTY used a read-only view of the real home with a temporary writable session layer and no external route. The installed package stayed in place. The complete release validation used zero paid model requests. [Version decision](../../../releases/approvals/v3.16.2.json)
