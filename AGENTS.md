# Repository agent guidance

Shared instructions for work on claude-code-statusline. Start with [Contributing](CONTRIBUTING.md) and the [development guide](docs/development/README.md).
Keep personal preferences, machine setup and credential handling in user-level guidance.

## Workspace boundaries

The active product is TypeScript. Follow the [current architecture](docs/development/architecture.md#current-typescript-workspace); Python sections preserve historical context.

| Location | Responsibility |
| --- | --- |
| `packages/core` | Pure configuration, contracts, localization, Unicode, rendering and runtime rules |
| `packages/platform` | Node/native filesystem, process, locking and terminal effects |
| `packages/cli` | Application services, configuration, installation and recovery |
| `packages/tui` | External terminal editor using shared core and injected backend services |
| `mods/statusline-native` | Official-host native editor integration |
| `mods/statusline-runtime` | Official-host live/runtime observation integration |
| `tools` | Generation, checks, packaging, benchmarks and acceptance tooling |
| `archive/python` | Frozen historical implementation and comparison evidence |

Keep effects behind platform adapters and reuse shared pure rules across frontends.
Preserve the Python archive; use its [separate reference procedure](archive/python/README.md) for historical validation.

## Canonical sources and generated files

- Product identity lives in [core release definitions](packages/core/src/release.ts); private workspace versions are development metadata.
- Maintain catalog and protocol definitions in `packages/core`, translations in `packages/core/resources/i18n`, and skill templates in `packages/cli/resources`.
- Update canonical sources and regenerate owned copies; do not edit files marked as generated or regenerate the Python archive. Keep generated Native modules within the host import-file limit; split resources without dropping language or acceptance coverage.
- Use the existing [resource generator](tools/generation/resources.ts) and [translation guide](docs/development/i18n.md), preserving message keys and named placeholders.
- Language lifecycle inputs live in `tools/generation/i18n/data`, outside runtime resources. Keep translation-bound acceptance and historical contracts verifiable; use explicit language validation/acceptance operations instead of filling raw packs with English. Development requires complete A languages; every public release requires complete A/B languages through both complete-source and maintenance-source verification.

After changing canonical resources:

```bash
npm run generate
npm run generate:check
```

## Development and validation

Use the development toolchain pinned by [.node-version](.node-version) and [package.json](package.json). Product runtime support is documented separately in the development guide.
Install dependencies from the checkout root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

- Maintained documentation/templates, including root `AGENTS.md`: run `npm run docs:check` and `git diff --check`.
- Core product behavior changes: run `npm run check` and `git diff --check`. For committed maintenance changes, use `npm run ci:plan` and the selected `npm run ci:check` tasks; resolve package-sensitive plans with `--compare`. Follow [impact checks](docs/development/impact-checks.md) for immutable inputs and platform responsibilities.
- CI classifies actual source responsibilities and unions applicable checks. Documentation/media, presentation, tests, tools, CI and release data use scoped checks; runtime dependency or core behavior changes require the full product matrix. Unknown ownership or unresolved comparison blocks instead of automatically running the matrix. Bundled product instructions remain execution inputs.
- Draft quick checks and manual diagnostic probes are not complete acceptance. Preserve all logical platform/runtime/host obligations when sharing identical executions; receipts must identify the original execution and verified inputs.
- Promote only immutable, available evidence through verified PR/main/tag relationships. Core merges reuse complete PR acceptance plus integration smoke; maintenance merges reuse scoped receipts verified by accepted-base code. Maintenance-source releases build their own bytes and explicitly link original product coverage. Keep missing/expired/failed evidence blocking, manual diagnostics separate, and original source identities unchanged. Follow the [CI routing and expiry rules](docs/development/ci-maintenance.md).
- After moving or deleting source files, follow the documented [compiled-output cleanup](docs/development/README.md#clean-compiled-outputs) before rebuilding.
- Use isolated temporary configuration and installation directories. Preserve real Claude settings and the installed product.
- Installed, official-host, terminal, physical and paid acceptance have separate entries in [testing and acceptance](docs/development/testing.md); invoke the checks appropriate to the task. Paid checks require explicit scope and budget.
- Report actual evidence and limitations. Automated tests, PTYs and reconstructed screenshots do not establish physical acceptance. The six accepted [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified and do not waive new automated failures.

## Behavior and compatibility

- Preserve the [shared contracts](docs/development/contracts.md), storage compatibility and command-specific error behavior.
- Keep JSON/NDJSON protocol stdout free of logs, and preserve silent render/hook handling of invalid input. Check command intent before initializing terminal streams; machine-protocol pipes must retain blocking input.
- Choose bounded file readers for the data's ownership and permission contract; ordinary installation files are not private recovery artifacts. Acceptance must assert actual status/reasons and read-only byte/mode preservation, not identity alone. Read atomically replaced private progress through bounded snapshots; keep immutable recovery readers strict.
- Preserve unknown executor liveness as unknown. Retain its records and block package recovery or replacement until exit or a different process identity is confirmed.
- Use the platform tree-removal adapter for owned fixture state changes too; assert actual removal before testing dependent behavior.
- Route accepted draft edits through the shared history transition; previews and cancelled inputs never create history. Keep independent persistent effects outside undo, and bind reviewed structural candidates to the current target and draft generation.
- Preserve read-only operations, previews and dry-run contracts. Explicit configuration writes retain ownership/revision checks, locks, backups, atomic publication and recovery.
- Use the production rendering pipeline for previews with injected observations; keep live collection separate from pure rendering.
- Preserve complete graphemes, terminal-cell budgets and ANSI styling through shared Unicode/rendering helpers.
- Pass executable paths and literal argv through existing platform adapters, including spaces, Unicode and shell metacharacters.

## Documentation

- Maintain this root `AGENTS.md` in English only. Other maintained English Markdown documents have complete `.zh-CN.md` counterparts; GitHub forms and the PR template use their existing single bilingual format.
- Keep local links and anchors valid, update the relevant documentation indexes, and reference detailed guides instead of duplicating changing versions, schemas or delivery records here.
- Keep the project README focused on introduction and usage. Put release/update narratives in CHANGELOG, release notes or development records; update screenshots and changelogs when relevant.

## Pull requests and synchronization

- Keep changes focused, use conventional commit/PR titles, and record actual checks and limitations.
- Name new development branches `<type>/<short-description>` following [Contributing](CONTRIBUTING.md#branch-names). Use this complete format instead of the desktop app's default branch prefix; do not prepend a personal or tool prefix.
- Target `main`, bring the branch up to date, and require successful `Complete candidate evidence` for the final reviewed head before merging. Preserve [repository protections](docs/development/repository-governance.md#main-protection-and-checks).
- GitHub is primary for development, PRs and CI; Gitee distributes synchronized code. Synchronize validated main with explicit refspecs after checking divergence, and verify the resulting remote commit.
- Publication is a separate maintainer task governed by the [release guide](docs/RELEASING.md). Documentation maintenance does not itself require a product version, tag, Release or npm publication.
