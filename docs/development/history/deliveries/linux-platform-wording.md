# Linux platform wording alignment

**English** | [简体中文](linux-platform-wording.zh-CN.md)

This 2026-11-21 documentation maintenance delivery removes WSL from Linux+WSL platform pairings in current maintained documentation, so the affected README taglines, requirement tables, shell-example lead-ins and troubleshooting text no longer pair Linux with WSL. Product behavior, commands, public interfaces, stored formats, release notes, historical delivery records and other frozen content are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Platform pairings | Updated README taglines, README and user-guide requirement tables, CLI reference and development guide shell-example lead-ins, and user-guide Git troubleshooting text in both languages: `Linux, WSL`, `Linux / WSL`, `Linux、WSL`, `Linux or WSL`, `Linux 或 WSL` and `Linux / WSL / macOS` now name just `Linux` where the text paired Linux with WSL. |
| Retained WSL references | `Windows/WSL` compact-marker behavior in the display reference, the `wsl-desktop-popup` approval identifier, the bug-form WSL distribution prompt and product i18n text are unchanged. |
| Frozen content | Release notes and approvals, historical delivery and migration records, TypeScript migration records, preview pages, historical changelog entries and generated resources are not rewritten. |

## Source identities

- Baseline before the task: `db5a0b9f`.
- Implementation baseline after synchronizing `origin/main`: `8c38f565`.
- Implementation commit: `29a394d6`. The record correction and final head are recorded in the PR description.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,506 local links, 0 errors (baseline 7,502) |
| `git diff --check` | Passed |
| `npm run build` | Passed on Node 24.21.0 |
| Documentation content, example and checker tests | 37/37 content/example tests and 54/54 `docs.test.js` tests passed |
| Impact plan and scoped check | Local `ci:plan` route `maintenance` with `actions`, `checks`, `docs`; local Linux `ci:check` passed. Windows and macOS tasks were not run: ordinary PRs allocate zero project CI runners. |

The change is documentation-only. It performs no installed-product, editor, platform, provider or paid-model acceptance. The Windows and macOS scoped tasks were not executed because ordinary PRs allocate zero project CI runners; the local Linux scoped receipt is the maintenance evidence. Frozen release notes and approvals still describe WSL where they did at publication. Product CLI and doctor messages still say `Linux/WSL`; no product change or new issue is created. The six accepted issue #96 gaps remain unverified.
