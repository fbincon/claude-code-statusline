# Linux platform wording alignment

**English** | [简体中文](linux-platform-wording.zh-CN.md)

This 2026-11-21 documentation maintenance delivery removes WSL from Linux+WSL platform pairings in current maintained documentation, so the affected requirement tables and shell-example lead-ins name Linux, Windows and macOS. Product behavior, commands, public interfaces, stored formats, release notes, historical delivery records and other frozen content are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Platform pairings | Updated README, user guide, CLI reference and development guide requirement tables and shell-example lead-ins in both languages: `Linux, WSL`, `Linux/WSL`, `Linux / WSL`, `Linux、WSL` and `Linux／WSL` now read `Linux` where the text paired Linux with WSL. |
| Retained WSL references | `Windows/WSL` compact-marker behavior in the display reference, the `wsl-desktop-popup` approval identifier, the bug-form WSL distribution prompt and product i18n text are unchanged. |
| Frozen content | Release notes and approvals, historical delivery and migration records, TypeScript migration records, preview pages, historical changelog entries and generated resources are not rewritten. |

## Source identities

- Baseline before the task: `db5a0b9f`.
- Implementation baseline after synchronizing `origin/main`: `8c38f565`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,506 local links, 0 errors (baseline 7,502) |
| `git diff --check` | Passed |
| `npm run build` | Passed on Node 24.21.0 |
| Documentation content and example tests | 37/37 passed |
| Impact plan and scoped check | Selected tasks and results are recorded in the PR description after CI |

The change is documentation-only. It performs no installed-product, editor, platform, provider or paid-model acceptance. Frozen release notes and approvals still describe WSL where they did at publication. Product CLI and doctor messages still say `Linux/WSL`; no product change or new issue is created. The six accepted issue #96 gaps remain unverified.
