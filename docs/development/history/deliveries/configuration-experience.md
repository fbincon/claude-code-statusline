# Configuration experience: shared editing, quick setup and explanation

**English** | [简体中文](configuration-experience.zh-CN.md)

> **Historical record (frozen at v3.2.0, 2026-10-19).** Current behavior is in the [development guide](../../README.md) and [roadmap](../../roadmap.md); current interface versions are in the [CLI reference](../../../reference/cli.md#protocol-and-schema-versions).

## Validation and release evidence

The implementation starts from `844ce521e5c6e3a43d7120e99a7724ef35ab899a` and delivers UX-01, UX-02 and EXPLAIN-01.

Validation covers grapheme/Unicode input and resize, six-language candidate transitions, dirty-draft cancellation, conflicts, failure recovery, readonly I/O, duplicate-instance identity, and preview/explanation agreement at 40/80/120 columns. Installed extended captures include quick-setup stages, middle-of-text caret editing and explanations. The artifacts identify their immutable source and package hashes; reconstructed PTY cells are not desktop screenshots or human acceptance.

The [v3.2.0-only decision](../../../releases/approvals/v3.2.0.json) accepts the same six historical gaps in [#96](https://github.com/fbincon/claude-code-statusline/issues/96), with no waiver for new failures. Source-bound checks and the completed public-channel verification are recorded below.

Editor protocol 13 added `explain` and preset presentation metadata. Display schema 8, runtime protocol 2, portable envelope 1 and UI preference schema 1 remained unchanged. Actual display saves retained revision, ownership, backup and rollback checks; external save failures left the terminal and draft open. UI-language persistence and Claude preference Apply stayed independent.

## Release validation — 2026-10-19

[Implementation PR #113](https://github.com/fbincon/claude-code-statusline/pull/113) merged as `a2006c91bb62ac2a07ac12195bd66820c84d1a56`. Annotated tag `v3.2.0` is object `c60da8135d9e3e15d41b946b6c04f7edeead17c7` and points to that commit.

| Gate | Evidence | Result |
| --- | --- | --- |
| Final PR head `cde5416` | [CI 39253844841](https://github.com/fbincon/claude-code-statusline/actions/runs/39253844841) | 56 successful jobs; documentation-only job skipped |
| Merged main | [CI 39256749031](https://github.com/fbincon/claude-code-statusline/actions/runs/39256749031) | Same complete matrix and stable readiness passed |
| Version tag | [CI 39260071350, attempt 2](https://github.com/fbincon/claude-code-statusline/actions/runs/39260071350/attempts/2) | Same complete matrix and stable readiness passed |
| Local development | `npm run check` | 1,040 tests: 1,036 passed, zero failed, four platform skips; generation, links, frozen archive and ledgers passed |
| Additional local native checks | Claude 2.1.302 | 120 native official tests passed; the retained type declarations were 2.1.294, with no 2.1.302 declaration claim |
| Installed terminal workflows | Final-package extended PTYs, six languages | 396 captures; setup, text cursor, explanation, save/reopen and terminal restoration passed |

Each full matrix requires eight offline installation targets, all 32 Node runtime cases and thirteen fixed host combinations. Exact Claude 2.1.296 declarations remain unavailable under the version-specific approval.

The [first tag attempt](https://github.com/fbincon/claude-code-statusline/actions/runs/39260071350/attempts/1) recorded two setup failures. Windows ARM / Node 24.22.0 passed 595 product tests but its system PowerShell preparation exceeded 60 seconds before candidate installation. macOS 14 / Node 24.22.0 had no candidate tgz after artifact download, so validation stopped before product testing. The failed Windows receipt was backed up before clearing its artifact name for the rerun. Both affected jobs and the aggregate passed on attempt 2 at the same commit and with the same package; timeout and acceptance conditions were unchanged.

The two independent local builds, delivered-source rebuild, main CI bundle and tag CI bundle match byte for byte for all four delivery files. Package SHA-256: `11489adac35f7723b441e04a5af70ec221e1f2770872ebebfbc3dafe1845e541`. Source archive SHA-256: `33a013ac6b5fd85385052d9ef41be95a871fe57ab2d558a4321e87fd6d0a05c5`.

Local evidence is retained under ignored `dist/validation/v3.2.0/`. The final `release-captures/editor-capture.json` digest is `df75b66273171c8e08bf56c2f7c9db896a856478fe79f45224b9ba35aaed4e63`. Selected reconstructed frames were visually inspected by the agent; glyph appearance depends on the recorded fonts. This is distinct from human usability, host-desktop or physical-power acceptance, which remains unverified where disclosed.

## Published delivery

- [GitHub stable / Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.2.0), Release `417353430`, published at `2026-10-19T14:18:31Z`. All four draft attachments were downloaded and verified before publication; [SHA256SUMS](https://github.com/fbincon/claude-code-statusline/releases/download/v3.2.0/SHA256SUMS) identifies the delivered package, source and manifest.
- [npm 3.2.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.2.0): [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/39266709975) and [publication](https://github.com/fbincon/claude-code-statusline/actions/runs/39267068047) passed. The receipt records `published` for the same commit/package; `latest=3.2.0` and `beta=3.0.0-beta.1`.
- [Public-download CI](https://github.com/fbincon/claude-code-statusline/actions/runs/39267776555) passed all six Linux/Windows/macOS × Node 22/24 jobs. Fixed-version and `latest` installations passed in twelve initially empty caches with lifecycle scripts disabled; GitHub/npm package bytes and registry integrity matched.
- [Gitee stable](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.2.0), Release `1219646`: the validated main commit and annotated tag were synchronized with explicit refspecs after an ancestry check. All four delivery assets were anonymously downloaded and matched; the downloaded package passed all ten local offline installation checks. Automatic repository archives are separate from the rebuildable source attachment.

The follow-up documentation changes record these results and current protocol ownership. They require documentation/link/whitespace checks only; the released tag and package remain bound to the implementation commit above. The local-only roadmap marks UX-01, UX-02 and EXPLAIN-01 DONE, while later work and the six disclosed acceptance gaps remain open.
