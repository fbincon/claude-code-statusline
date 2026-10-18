# TS-06 engineering handoff

**English** | [简体中文](TS06-HANDOFF.zh-CN.md)

TS-05 delivers the private universal engineering candidate, its rebuildable source
archive, checksums and source-bound acceptance. See [closure evidence](README.md)
and the [candidate guide](candidate.md). TS-06 remains **NOT_STARTED**; this handoff
records its prerequisites and does not publish or change the installed product.

## Inputs and preserved contracts

- Node 24.21.0, npm 11.19.0 and TypeScript 5.9.3; locked Koffi 3.3.3 and lossless-json 4.3.1.
- One offline tgz for Linux x64, Windows x64, macOS x64 and macOS ARM64. Windows ARM uses x64 Node under emulation; there is no native Windows ARM claim.
- Four business packages and two Mods, five languages, skill templates, ownership maps and licenses. Candidate identity is `@fbincon/statusline-ts05-candidate` / `0.0.0-ts05.g<commit>` with `private: true`; application identity remains separate.
- Display schema 8, editor protocol 11, runtime protocol 2 with v1 compatibility, and task schema 4. Preserve absolute Node/JS argv binding, explicit disablement, compatible backups and explicit recovery.
- The 161 frozen cases retain exactly three approved CLI text differences. The 856-method/62-tool ledger has no pending entries. The Python archive and independent reference entry preserve historical comparisons and rollback.
- The published Python product and its recoverable environments remain available. Current main is a TypeScript development checkout; use fixed Python tags for historical installation and publication procedures.

## Required before a TypeScript release

| Gate | Remaining work and evidence |
| --- | --- |
| Physical macOS sleep/resume | Record real suspend/resume; the ineffective VMware Sleep action is not a pass. |
| Physical macOS 14 Intel | Complete desktop and power validation on this actual target; newer/ARM CI cannot replace it. |
| Windows 10 desktop | Validate launch, focus, both editors, interruption and recovery on Windows 10. Windows 11/server CI covers different targets. |
| WSL desktop and popup | Confirm real desktop launch/focus and popup behavior; native, PTY and tmux-session checks remain separate evidence. |
| Other target power and human visual coverage | Record exact OS, architecture, terminal, host, source and installed artifact. Keep automated, reconstructed-image and human evidence distinct, including the historical macOS Client focus limitation. |
| Selected host declarations | Recheck the chosen host. 2.1.296 lacks usable declarations and has no typecheck pass; retain exact 2.1.294 checking and both Mods' official tests. |
| Actual preview distribution | Choose public naming/versioning and delivery channels; verify fixed-source builds, downloaded bytes, target installs and upgrade/recovery against the actual preview artifact. |
| Stable transition | Resolve preview feedback, document the last supported Python release and migration/rollback, verify final commit/tag CI and assets, then synchronize the validated GitHub refs and same-byte release assets to Gitee. |

The [approved release gates](../ts-02/LINUX-20261014.md#approved-stage-and-release-gates)
remain authoritative. Missing, skipped or failed observations cannot become passes.
CI's eight installation targets and thirteen fixed hosts are engineering evidence;
they do not fill the physical/desktop rows above. npm's Windows `.cmd` restriction
remains documented; PowerShell `.ps1`, Git Bash and direct Node are separate paths.

## Validation and publication boundaries

Use `npm run check`, `candidate:build`, `candidate:verify`, `test:installed`,
`test:mods` and `release:prepare` with immutable commits and the same candidate
artifact. Keep the actual generated filenames and all deterministic bundle files
together. Raw evidence remains in ignored validation directories and CI artifacts.
Use `reference:verify` only for independent historical checks; normal workflows
must not gain Python/compiler requirements.

TS-05 made no paid model calls, public preview, version tag, registry publication
or Release. Existing paid records and simulations verify the budgeted tooling;
new calls still require explicit invocation, a fresh evidence directory and the
shared budget/ledger constraints. The installed Python product was not switched.

D06 remains **FAIL: 104 pass / 60 fail / 28 inconclusive**. No full D06 measurement
ran in TS-05. PERF-01 remains **NOT_STARTED** after TS-06; retain its original
measurement policy, source/harness pins and failure records. Functional timeouts,
bounded resources, event loss, atomic writes and recovery remain current gates.

## TS-06 preview amendment, 2026-10-18

The historical conclusions above retain their original scope. The maintainer subsequently approved a public preview with unavailable physical/desktop checks deferred to stable. Missing checks are not passed. See the [current TS-06 decision](../ts-06/README.md) and [preview instructions](../../../PREVIEW.md).
