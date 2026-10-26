# Contributing

**English** | [简体中文](CONTRIBUTING.zh-CN.md)

## Choose the right channel

- For a reproducible defect, open a [Bug report](https://github.com/fbincon/claude-code-statusline/issues/new?template=bug_report.yml). Include the version, installation channel, environment, reproduction steps, expected behavior and actual result. If installation failed before a version was available, say unknown.
- For a question or feature idea, check the [user guide](docs/USER_GUIDE.md) and existing [Issues](https://github.com/fbincon/claude-code-statusline/issues), then use a blank Issue. Describe the use case and desired outcome.
- For a potential vulnerability, follow the [security policy](SECURITY.md) and report privately.

Diagnostic output, configuration excerpts and screenshots are optional. Remove credentials, tokens, private transcripts and unrelated personal data before sharing them. GitHub is the primary location for Issues, PRs and CI; Gitee is the public synchronized distribution.

## Development and checks

Coding agents should read the [repository agent guidance](AGENTS.md) for shared workspace boundaries, canonical sources and validation rules. This file is maintained in English only.

The [development guide](docs/development/README.md) describes the workspace and commands. Development and builds use Node 24.21.0 and npm 11.19.0, with Git and Git LFS available. Install dependencies from the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

For documentation and the maintained community templates:

```bash
npm run docs:check
git diff --check
```

For product, dependency, workflow or development-tool changes:

```bash
npm run check
git diff --check
```

CI uses an explicit documentation/template allowlist. Mixed changes and release approval JSON require the complete product matrix. Both routes finish at `Complete candidate evidence`; see [CI maintenance](docs/development/ci-maintenance.md). The full test suite uses isolated fixtures; follow [testing and acceptance](docs/development/testing.md) for opt-in installed, terminal, physical or paid checks.

## Prepare a pull request

Keep the change focused, explain its purpose and record what was actually tested. Use a conventional title such as `fix: ...`, `docs: ...` or `ci: ...`. Maintainer branches use the `fbincon/` prefix. DCO sign-off is not required.

English Markdown uses the existing default paths, with complete Simplified Chinese counterparts named `.zh-CN.md`, except the English-only root `AGENTS.md`. GitHub Issue forms and the single PR template contain both languages in one file. Keep links current and update the appropriate documentation indexes. See the [translation guide](docs/development/i18n.md) for interface translations.

Update documentation, screenshots, CHANGELOG and related Issue links when relevant; explicitly mark other template items not applicable. The project README introduces features and usage: release versions, delivery status and update narratives belong in the changelog, release notes or development records.

Target `main`, bring the branch up to date and wait for the required CI check before merging. A second person's approval is not mandatory for this single-maintainer project; the PR and CI requirements still apply to maintainers and automation. Publication is a separate maintainer operation described in the [release guide](docs/RELEASING.md).

## Platform validation follow-up

[Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) tracks the existing platform acceptance gaps. For an actual validation result, identify the tested source or package, environment, steps, result and remaining limitations. Distinguish physical desktop/power evidence from automated tests, PTYs and reconstructed screenshots. The six accepted existing gaps remain unverified; they do not waive new automated failures. Ordinary bugs should use the generic Bug form.
