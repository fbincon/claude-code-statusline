# Security policy

**English** | [简体中文](SECURITY.zh-CN.md)

## Supported versions

Security fixes are provided for the latest stable release. Please upgrade older installations to that release before checking whether a problem remains. Older minor releases, prereleases and the archived Python implementation do not receive a separate security backport commitment. Fixes are delivered as new versions; existing published packages are not replaced.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/fbincon/claude-code-statusline/security/advisories/new). Do not disclose an unpatched vulnerability in a public Issue, PR or Gitee discussion. GitHub is the primary security-reporting channel for both GitHub and Gitee distributions.

Include the information you can safely provide:

- Affected product version and installation channel.
- Operating system, terminal, Node and Claude Code versions where relevant.
- Minimal reproduction steps, expected behavior and observed impact.
- Any known mitigation or proposed fix.

Remove tokens, credentials, private conversation transcripts and unrelated personal data. Share only the smallest configuration or log excerpt needed to reproduce the issue.

The maintainer will review the report and coordinate a fix and disclosure through the private report. No fixed response deadline is promised.

## Scope and ordinary support

Security-relevant areas include installation and recovery, settings and hook writes, command execution, extension sources, credential handling, and the package publication chain.

For ordinary defects, configuration questions or feature ideas, use [public Issues](https://github.com/fbincon/claude-code-statusline/issues) and the [contribution guide](CONTRIBUTING.md). Start with the [user guide](docs/USER_GUIDE.md) for installation and configuration help.
