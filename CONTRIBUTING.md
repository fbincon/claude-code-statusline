# Contributing

**English** | [简体中文](CONTRIBUTING.zh-CN.md)

## Choose the right channel

- For a reproducible defect, open a [Bug report](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml). Include the version, installation channel, environment, reproduction steps, expected behavior and actual result. If installation failed before a version was available, say unknown.
- For a question or feature idea, check the [user guide](docs/USER_GUIDE.md) and existing [Issues](https://github.com/fbincon/claude-code-statusline/issues), then use a blank Issue. Describe the use case and desired outcome.
- For a potential vulnerability, follow the [security policy](SECURITY.md) and report privately.

Diagnostic output, configuration excerpts and screenshots are optional. Remove credentials, tokens, private transcripts and unrelated personal data before sharing them. GitHub is the primary location for Issues, PRs and CI; Gitee mirrors synchronized code and release files.

## Development and checks

Coding agents should read the [repository agent guidance](AGENTS.md) for shared workspace boundaries, canonical sources and validation rules. `AGENTS.md` is maintained in English only.

The [development guide](docs/development/README.md) describes the workspace and commands. Use the toolchain pinned by [.node-version](.node-version) and [package.json](package.json), with Git and Git LFS installed for Git-policy tests. Install dependencies from the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

For documentation and the maintained community templates:

```bash
npm run docs:check
git diff --check
```

Registered root and current development guides also require the source-backed content and example tests:

```bash
npm run build
node --test dist/typescript/tools/checks/test/docs-content.test.js dist/typescript/tools/checks/test/docs-examples.test.js
```

The registration list is `tools/checks/impact-documentation.ts`; historical records and compatibility stubs stay unregistered. When adding or moving a current page, update its registration and `docs-example` markers together. When changing a registered fact, update both languages, its source-backed rule and a regression. Follow [documentation content checks](docs/development/README.md#documentation-content-checks).

For core product behavior changes:

```bash
npm run check
git diff --check
```

For other committed changes, use immutable committed inputs with `npm run ci:plan -- --base origin/main --head HEAD --output /tmp/impact-plan.json` and the selected `npm run ci:check` tasks; each run uses a new report path. Package-sensitive plans require `--compare`; use a new output path and the task for your actual platform. CI executes the remaining platform/host tasks. Documentation media also requires the asset checks selected by the plan.

CI combines checks for mixed maintenance. Product logic, protocols, runtime dependencies and bundled skill instructions require the complete product matrix; build/generation inputs use package comparison plus generation/build tests and three-platform installation smoke. Unknown ownership or unresolved comparisons block. Every PR route is gated by `Complete candidate evidence`; the name identifies the protected aggregate, not full-matrix coverage. See [impact checks](docs/development/impact-checks.md#responsibilities-and-checks) and [CI maintenance](docs/development/ci-maintenance.md). Tests use isolated configuration and installation directories; [testing and acceptance](docs/development/testing.md) describes installed, official-host, terminal, physical and paid checks.

## Prepare a pull request

Keep the change focused. Describe the resulting behavior and relevant tradeoffs, and record the impact route, selected tasks, actual results and limitations. Use a conventional title such as `fix: ...`, `docs: ...` or `ci: ...`. DCO sign-off is not required. Share only sanitized evidence.

English documentation Markdown uses the existing default paths, with complete Simplified Chinese counterparts named `.zh-CN.md`, except the English-only root `AGENTS.md` and the canonical product skill resources under `packages/cli/resources`. GitHub Issue forms and the single PR template contain both languages in one file. `docs:check` validates the PR template's required bilingual sections, and the impact plan routes any top-level `.github/ISSUE_TEMPLATE/*.ya?ml` form as documentation. Release notes through v3.9.2 use one bilingual page; v3.10.0 and later use separate English and Simplified Chinese pages. Follow the [release note template](docs/RELEASING.md#release-note-template) and the [changelog template](docs/RELEASING.md#changelog-template), and update both the [English](docs/releases/README.md) and [Chinese](docs/releases/README.zh-CN.md) indexes in the same change. Historical release pages and changelog entries are frozen except for navigation and status notes; keep internal evidence in delivery records.

Update the affected English and Simplified Chinese user and technical guides in the feature PR. Use [documentation ownership](docs/development/README.md#documentation-ownership) to choose where each detail belongs. Keep current procedures under `docs/development` and frozen records under `docs/development/history`; the [CLI reference](docs/reference/cli.md#protocol-and-schema-versions) owns current interface and format versions. Follow the [new current documentation page checklist](docs/development/README.md#new-current-documentation-page) and update the relevant index and links when adding or reorganizing a page.

At delivery, add a bilingual record under `docs/development/history/deliveries/` and link it from the [delivery index](docs/development/history/README.md#delivery-records) with source and artifact identities, actual checks, results and limits. Follow the [delivery record template](docs/development/history/README.md#delivery-record-template) for records introduced on or after 2026-11-14; earlier records are frozen. Do not rewrite frozen records. When moving a page or section, leave a short compatibility stub at the original path that preserves existing links and section anchors. Documentation maintenance alone does not create a product version, tag, Release or npm publication.

When adding or changing screenshots or captures, update the [image gallery index](docs/images/README.md), the bilingual gallery README/status entry, the directory tree, related guides and the capture/provenance manifest together; referenced files, SHA-256 values, dimensions and byte counts must match. Use neutral sample paths and never re-encode or rewrite frozen archive images.

Update documentation, screenshots, CHANGELOG and related Issue links when relevant; explicitly mark other template items not applicable. The project README introduces features and usage: release versions, delivery status and update narratives belong in the changelog, release notes or development records.

Target `main`, bring the branch up to date and require successful `Complete candidate evidence` for the final reviewed head before merging. Preserve [repository protections](docs/development/repository-governance.md#main-protection-and-checks). A second person's approval is not mandatory for this single-maintainer project; the PR and CI requirements still apply to maintainers and automation. Publication is a separate maintainer operation described in the [release guide](docs/RELEASING.md).

### Branch names

Contributors and coding agents use `<type>/<short-description>` for new development branches. Choose a common change type such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build` or `perf`; these are examples, not an enforced allowlist. Write the short description with lowercase letters, digits and hyphens, for example `feat/add-profiles`, `fix/render-width` or `docs/update-guide`.

Use this complete format instead of the desktop app's default branch prefix; do not additionally prepend a username or tool prefix. This guidance does not change the app setting. When creating a branch through the app UI, check the complete name before confirming.

The convention applies to new development branches. Preserve existing branch names, `main`, version tags and branches managed by external automation. Historical records and archived procedures retain their original names and conventions.

## Platform validation follow-up

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) tracks the existing platform acceptance gaps. For an actual validation result, identify the tested source or package, environment, steps, result and remaining limitations. Distinguish physical desktop/power evidence from automated tests, PTYs and reconstructed screenshots. The six accepted existing gaps remain unverified; they do not waive new automated failures. Paid-model checks require an approved budget and shared ledger. Ordinary bugs should use the generic Bug form.
