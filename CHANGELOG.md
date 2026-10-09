# Changelog

**English** | [简体中文](CHANGELOG.zh-CN.md)

## Unreleased

## 1.7.8 - 2026-10-09

- Add an independent light/dark Preview background choice to the in-session editor, remembered immediately as a UI preference without changing display drafts, portable exports or the actual status line. Default to the previous dark surface; recover the previous choice on storage failure.
- Preserve production RGB and terminal ANSI slots, plain terminal foregrounds, complete row padding and loading/empty/error/overflow backgrounds. Preview titles identify both the palette and background; interface chrome still follows the applied Claude theme.
- Add preference persistence/cancel/failure and Unicode/color regressions, four independent terminal/theme capture fixtures with default/ANSI comparison images, and bilingual instructions. Python and both Mod manifests are 1.7.8; configuration/protocol compatibility is unchanged.

## 1.7.7 - 2026-10-09

- External TUI headings, shortcuts and descriptions use terminal-default text instead of fixed white/cyan or dim attributes; selection reverses the defaults for light/dark terminal profiles.
- Preview the selected default/ANSI palette on the current terminal background, show its choice in the title, and preserve default text/resets and capability-quantized samples; fall back on unsupported defaults, monochrome and color-pair failures/exhaustion.
- Centralize external color/style roles, preserve compatibility exports and add light/dark capture analysis, recorded ANSI palettes, preview-fill checks and cross-platform color-allocation regressions.
- Update bilingual usage, architecture and validation documentation and add terminal-capture reconstructions; Python and both Mod release manifests are 1.7.7 with existing configuration/protocol compatibility.

## 1.7.6 - 2026-10-09

- Follow applied Claude themes in the in-session editor using explicit semantic text/background/selection colors, bold primary-text shortcut keys, readable inactive descriptions and themed recovery controls. Preserve separate host preference Apply and existing editor/protocol behavior.
- Fill sample preview rows with a dedicated dark background while retaining original RGB/ANSI spans and a neutral foreground for uncolored samples; share accurate default/reverse color decoding between capture rendering and PTY acceptance.
- Add page/state, separate theme Apply/refusal and terminal color regressions; extend fixed-host CI to Claude Code 2.1.294 on all three platforms and require 13 Python/build plus ten Mod jobs. Add reproducible theme captures and bilingual instructions.
- Synchronize Python and both Mod release manifests to 1.7.6.

- Generate Gitee wheel instructions as verified download links followed by local pipx installation. Direct pip/pipx asset URL downloads can return HTTP 403 while browser/curl downloads succeed; preserve published package bytes and GitHub installation commands.

## 1.7.5 - 2026-10-08

- Use relative documentation, language, license and screenshot links so the same main branch works on GitHub and Gitee. Generate fixed-tag GitHub links only in package metadata for the PyPI description; source READMEs retain generic package commands and no version/update section.
- Add a local Gitee Release-note renderer using public GitHub metadata and verified Gitee attachment URLs. Preserve historical package names, tags, support claims and prerelease status; document repeatable task-driven synchronization and note backups.
- Synchronize Python and both Mod release manifests to 1.7.5. CLI, configuration, runtime behavior and the repository layout remain compatible.
- Wait up to three minutes for newly uploaded versions to become visible in the package index. Retry only incomplete/404 reads; reject permission, identity and checksum errors immediately without repeating uploads.

## 1.7.4 - 2026-10-08

- Rename the distribution to `fbincon-claude-code-statusline` for PyPI while preserving the `claude_statusline` import, `claude-statusline` CLI, configuration ownership and portable exports. Synchronize Python and both Mod manifests at 1.7.4.
- Add tokenless GitHub Actions publishing from verified Release attachments: exact-tag/main CI gates, TestPyPI acceptance, formal upload on Release publication, index download/install checks and verified retries of partial uploads. Keep the same original assets across PyPI, GitHub and Gitee.
- Use version-independent PyPI commands in both READMEs, resolve long-description image/document links, expand the repository tree, and document existing wheel migrations and the bilingual maintainer publishing process. Validate strict package metadata in CI.

## 1.7.3 - 2026-10-07

- Report the actual supported display schema in doctor success and migration messages; derive the apply-draft requirement from the same constant. Add read-only legacy/current/future-version regressions.
- Refresh both README galleries with 21 original TUI screenshots grouped by entry, platform and page. Archive the former 18-image gallery with original PNG bytes, source records and hashes.
- Audit bilingual README, user/CLI guides, display definitions and development docs. Correct catalog counts to 60 main/14 subagent items, protocol-v4 examples, independent timing/metrics defaults, CI coverage and task-completion explanations; retain historical acceptance records.
- Document optional execution time, incomplete coverage, canonical task-timer and its prompt-timer alias, and independent native/session/API durations. Synchronize Python and both Mods to 1.7.3 and stable installation links.

## 1.7.2 - 2026-10-07

- Rename the in-session heading to Configure Status Line and match the cyan section titles. Display uppercase letter keys with lowercase descriptions, retaining numbered page labels and standard modifier-key spelling.
- Consolidate controls in a state-aware wrapping footer. All pages put Tab first; Main/Subagents order is Tab, Space, select, order, format and search. Keep Filter's search entry, show H/A only in the applicable Settings state, and separate editing/recovery controls from ordinary actions.
- Share footer geometry with keyboard pagination. Minimum 32×12 panes preserve the selected row and a real sample preview, shortening descriptions and omitting secondary hints when height is limited.
- Accept both ASCII cases for ordinary shortcuts outside editing; preserve literal mixed-case text, Ctrl/Meta combinations and Shift+Tab. Update official regressions, installed terminal acceptance and bilingual instructions.
- Synchronize Python and both Mods to 1.7.2. Existing configuration, protocols, installation preferences and timing behavior remain compatible; retain historical screenshots and provenance.

## 1.7.1 - 2026-10-07

- Put in-session Client section titles on the frame edge and fill Settings, Layout and item-detail pages using actual group/field rows. Paging retains field offsets and resizing retains draft input and selection.
- Keep Layout mode, row boundaries and item fitting in consecutive groups, and group item formats before fitting controls. Align field/value columns by terminal cells.
- Draw white bold shortcut keys and regular dim action descriptions in both editors; fit complete shortcut groups in narrow viewports. Retain h to show/hide clearly named Claude preferences and their separate Apply action.
- Move the existing Linux, macOS and Windows Layout examples into the README platform galleries. Preserve PNG bytes and capture provenance; remove the duplicated user-guide examples and gallery redirects.
- Synchronize Python and both Mods to 1.7.1. Display schema v5, configuration protocol v4, runtime protocol v2, saved preferences and installation defaults remain compatible.

## 1.7.0 - 2026-10-07

- Promote the accepted task timing preview after the maintainer confirmed v1.7.0a1 validation on Linux, macOS and Windows. Exact OS, architecture, terminal and host versions were not supplied with this confirmation.
- Synchronize Python and both Mods at 1.7.0, update stable installation and upgrade links, and publish a new stable Latest release. Compatible stable installs request both editors and preserve recorded disablement; native timing and advanced metrics retain their independent preferences.
- Retain the accepted task clocks, submission and agent ownership, wait-coverage diagnostics, compatibility aliases and schema contracts: display v5, configuration protocol v4, runtime preferences v2, runtime protocol v2 and lifecycle v4.
- Require PR, merge and tag CI, fixed-merge package inspection, independent rebuild/install, installed editor and runtime smoke, captured-session revalidation and draft/public asset verification. Preserve the a1 tag, assets, prerelease status and original shared-budget ledger; stable promotion uses no new paid model calls.

## 1.7.0a1 - 2026-10-07

- Replace the prompt clock with a persistent task lifecycle and independent immutable pause/resume clock. Default `task-timer` includes submission, queueing, child agents, reports and main wrap-up; retain `prompt-timer` as an alias in commands, imports, item options and layouts.
- Add opt-in `task-active-timer`, shown only with complete identity, event, wait and boot-clock evidence. Preserve native turn duration separately; successful endings, failures and interruptions freeze. Treat raw Stop as a candidate, resume on verified activity, and confirm compatibility endings from matched transcript or verified idle evidence.
- Default native timing metadata on for Claude Code 2.1.289+ while keeping advanced metrics opt-in. Runtime preferences v2 preserve old explicit opt-outs and add independent timing switches; display v5, configuration protocol v4, runtime protocol v2 and lifecycle v4 retain supported older reads and shared compatibility entry points.
- Use stable Windows boot identity, strict execution-clock degradation and an incremental bounded submission index. Preserve historical frozen values without inventing execution time, and retain explicit background-report/message links across parallel wrap-up.
- Add regression, default native/disabled collection, shared-budget real Linux lifecycle and history-size performance checks; document migration, downgrade and preview/platform acceptance boundaries. This release is a prerelease with Latest disabled; stable installation links remain at v1.6.1.

## 1.6.1 - 2026-10-05

- Give all four external TUI pages and item forms distinct page titles, continuous groups, aligned columns, selection and separate Preview. Titled frames start at 64×20; 64×18–19 uses compact separators. Global and page controls have separate rows.
- Group Settings by purpose and separate Layout mode, row boundaries and item fitting. Dispatch legacy controls by stable field key; group headings are nonselectable and consume viewport/paging budget.
- Isolate pure UI geometry/windows, add boundary/Unicode/color regressions and installed-package five-size PTYs, and document actual captures in both languages. Python and both Mods are 1.6.1; display v4, configuration protocol v3, runtime protocol v1 and recorded preferences remain compatible.

## 1.6.0 - 2026-10-05

- Promote the accepted Phase 5 preview after the maintainer confirmed v1.6.0a1 acceptance on Linux, Windows and macOS. Unprovided OS/architecture/terminal/host metadata remains unknown; retain the known macOS Client input limitation.
- Synchronize Python and both Mods at 1.6.0 and update current installation/upgrade links. Stable editor defaults enable compatible entries, preserving explicit false; live collection remains independently opt-in and preserves recorded preferences.
- Retain the eleven opt-in items, committed branch comparison, frozen ended-agent durations and accepted runtime implementation. Display schema v4, configuration protocol v3 and runtime protocol v1 are unchanged from a1; older display files migrate only on save. Preserve preview tags/assets/release type and capture provenance.
- Require all 20 PR/merge/tag jobs, fixed-merge wheel/sdist inspection and independent rebuild/install, installed-wheel PTYs, draft/public SHA256 and isolated URL installations before stable delivery. Revalidate captured runtime records without new paid calls or resetting the original ledger.

## 1.6.0a1 - 2026-10-05

- Add an independently owned, opt-in live-metrics Mod for fixed Claude Code 2.1.289 hosts, separate from editor enablement.
- Add strict runtime protocol v1, bounded session/prompt/agent history, atomic concurrent storage, exact retry identities and freshness/invalidation diagnostics.
- Package both Mods through shared version/hash inventories; extend official installation smoke and fixed-host CI to Windows/macOS 2.1.289. The complete preview uses display schema v4/configuration protocol v3; runtime protocol v1 remains independent.

- Add five opt-in task-scoped state, permission, active-agent, checklist and last-tool items, with deterministic previews, transparent partial markers and read-only diagnostics.


- Add cached committed merge-base branch diffs and shared base-ref configuration; move display to schema v4/configuration protocol v3 with write-only migration. Freeze ended subagent duration from reliable end evidence even when live metrics are off; preserve timer priorities.

- Add host-observed latest-request TTFT/output rate and cache-inclusive complete-task token items, verified spawn/lifecycle attribution, explicit incomplete coverage, passive official cost observations and a shared-budget real-session acceptance harness.

## 1.5.0 - 2026-10-05

- Promote the verified Phase 4 preview after maintainer-confirmed Linux/Windows human acceptance and macOS standalone TUI/CLI acceptance. Preserve the historical macOS Client input limitation; exact terminal/OS/host metadata remains unknown.
- Synchronize Python/Mod at 1.5.0 and stable installation/upgrade links. Both editor entries default on for supported hosts, preserving recorded false and independent compatibility suspension.
- Retain display schema v3, JSON protocol v2, existing appearance and the accepted formats, explicit layouts, presets, portable files and separate actual-row Claude preference application. Preserve a1 tags/assets and capture provenance.
- Require PR/merge/tag CI, final installed-wheel PTYs, independent package rebuild/install, SHA256 and public installation verification before stable Latest publication.

## 1.5.0a1 - 2026-10-05

- Keep actual content ahead of scope decoration in narrow explicit rows and preserve form selection when enabled items are removed.

- Add complete scoped forms and Layout to both editors, preset/import/export draft actions, and actual-row Claude appearance/time/title/behavior preferences with separate per-row Apply. Validate real curses Ctrl+S without terminal flow-control loss and extend fixed-host CI to Linux 2.1.289.

- Add editable minimal/developer/monitoring/multi-agent presets and versioned portable JSON import/export. Imports validate before saving, exports exclude installation/runtime/Claude preferences and protect existing files and live resources.

- Add explicit rows with priority/terminal-cell width fitting and shared production previews. Subagent filtering, completed hiding, row and task-text limits emit empty content without changing host order.

- Add opt-in schema-v3 format settings: short models, numeric formats, labels/icons, risk thresholds, used/remaining allowances and reset styles. Read v1/v2 without writes and migrate with a backup on save.
- Move the internal JSON contract to protocol v2 and preserve all new fields through complete Client/curses saves; retain owned protocol-v1 resources for upgrade/uninstall.

## 1.4.0 - 2026-10-04

- Add opt-in estimated gateway spend amount/period and cumulative input/output tokens. Sum raw cache-inclusive integers using existing all-session snapshots/deltas and expose unavailable data separately from observed zero. The catalog now has 48 main / 14 subagent items.

- Track cumulative input/output observations independently, hide absent counters and preserve known totals and per-counter deltas across partial cost snapshots. Recover availability once for older cached sessions without recounting message IDs.

- Add eleven opt-in cache/session/Git items: cache warmth/expiry and official main request/miss counts, output style, named/full/short session identity and independent Git fields. Share one Git collection across compound/components and retain unknown versus cold cache state.

- Add nine opt-in independent main metrics and four agent metrics, preserving compounds/defaults and schema v2/protocol v1. Suppress expired allowances and provide deterministic countdown previews; document metric scopes and downgrade recovery.

- Add original Linux, Windows and macOS screenshots of the in-session Client with Claude Code 2.1.289 to both READMEs and the image index.
- Record the maintainer's normal Linux/Windows interaction and unresolved macOS input problem separately from historical acceptance; document official Terminal.app/iTerm2 mouse reporting checks and alternative configuration entries without claiming a verified fix.

## 1.3.0 - 2026-10-04

- Promote the accepted a2 Client interaction after maintainer-confirmed human acceptance on Linux, Windows and macOS.
- Default both external `/statusline-configure` and in-session `/statusline-configure-native` on, preserving recorded disablement. External needs 2.1.258+, Client 2.1.287+; older/unknown hosts suspend independently and restore after upgrade/reinstall.
- Persist external disablement as schema-v1 false; suspend verified owned plugins with locked backups/rollback while preserving user plugin disablement. Refresh disabled plugins' owned resources and backend binding during package upgrades.
- Integrate Native into bilingual README common configuration and user-guide navigation; complete combinations, preference files, compatibility, recovery, upgrades and release instructions, preserving legacy anchors and a2 capture provenance.
- Synchronize Python/Mod at 1.3.0 and update stable links/Latest; display schemas and JSON protocol v1 remain compatible.

## 1.3.0a2 - 2026-10-04

- Keep `/statusline-configure` as the external terminal TUI and make `/statusline-configure-native` the experimental in-session Client; independently install, disable and use both.
- Restore enabled owned external resources removed by old native migration; remove the Mod's external alias/primaryCommand, check collisions independently and prune obsolete empty directories so disable/re-enable works after upgrading.
- Add Client arrow navigation/order, Tab pages, Space toggles, explicit search, Ctrl+G cancellation and s/f saving; explain initial click and host-owned Esc.
- Separate content/preview with grouped borders, emphasized headings, setting groups, aligned columns and compact layouts; retain separate Claude preference application and uncertain-save checks.
- Use copied snapshots and cumulative acknowledged input to prevent frozen drafts, lost keys, duplicate saves and stale responses; both save paths share revision protection.
- Cover installation combinations, upgrade recovery, cross-editor saves, Client, distributions and real PTYs; update bilingual guides and capture provenance.
- Record a1 human acceptance on all three platforms; a2 Client human acceptance was separately pending at preview publication. Prerelease publication keeps Latest at v1.2.0.

## 1.3.0a1 - 2026-10-04

- Preview direct checked native item rows, horizontal tabs, paged content, compact settings and a bounded bottom sample preview.
- Match standalone TUI ordering for enabled/disabled and filtered items; preserve per-scope selection and request focus after page changes.
- Add f save/close alongside s save/continue; fold host preferences behind h and retain pending preferences, independent application and unknown-save reconciliation.
- Separate editor/navigation/numeric logic and UI components/pages; package nested runtime modules and validate staging/cache resources.
- Record the isolated Client focus/key limitation and new automated checks; keep stable v1.2.0 and require new three-platform human acceptance for v1.3.0.

## 1.2.0 - 2026-10-04

- Promote the native configuration editor after confirmed human acceptance on Linux, Windows 11 and macOS 14.5. Unprovided architecture/terminal details remain unknown.
- Prefer native integration by default on compatible hosts, preserving explicit native/plugin disablement and compatibility fallbacks.
- Keep explicit compatibility preference repair and force behavior available on older hosts; independently validate stable default activation and compatibility smoke.
- Synchronize Mod/backend versions, stable installation links, acceptance records and release documentation. UI/runtime modules remain the accepted preview implementation.

## 1.2.0a1 - 2026-10-04

- Add the native Main, Subagents and Settings editor with catalog-driven selection, exclusions, ordering and sample preview. Save complete drafts with revision protection, retain the pane after success, and check uncertain save outcomes before retry.
- Apply actual theme/verbose host preferences separately and report locked/refused/partial results. Preserve drafts in narrow panes and invalidate stale responses on close/reload.
- Bundle matching runtime Mod resources in wheels from one maintained source. Install through an owned local marketplace, bind the selected backend, migrate owned configure entries, preserve explicit disablement, and support suspension, downgrade and uninstall recovery.
- Diagnose resource hashes, versions, protocol, enablement and backend binding separately from unverified current-session loading. Fix Windows npm/console entry resolution and macOS aliases.
- Share the scoped catalog and JSON describe/read/preview/apply contracts with CLI/curses/wizard; add generated TypeScript, platform native checks and documented real terminal captures.
- Keep preview native integration opt-in and v1.1.1 as Latest. Linux human acceptance is confirmed; Windows/macOS native human acceptance is pending, so stable v1.2.0 remains gated.

## 1.1.1 - 2026-10-03

- Preserve full multi-agent task duration before and after final Stop, including main-agent wrap-up.
- Freeze failure/interruption evidence and make duplicate terminal hooks and single-turn calibration idempotent.
- Keep transcript prompt ownership across incremental reads and queued hooks; reject unowned durations and invalid values.
- Clarify task, native-turn, session-runtime and API-wait definitions; correct the `cost` description.

- Keep background-agent result notification IDs in the original human task and wait for outstanding reports before final wrap-up.
- Resolve submission evidence before freezing and prevent later transcript scans from changing terminal duration.
- Split implementation into configuration, rendering, runtime, integration, UI and platform subsystems; retain legacy Python entry points and isolate shared storage/ownership.
- Group tests by subsystem, fix moved source/Terminal paths, and centralize bilingual documentation, package checks and opt-in acceptance under `tools/`.

## 1.1.0 - 2026-10-03

- Promote macOS core functionality and the standalone TUI to supported status on macOS 14+, Intel / Apple Silicon, CPython 3.10–3.14, retaining native process identity, sleep-inclusive timing, and POSIX file safety.
- Add Terminal.app to experimental `/statusline-configure` outside valid tmux sessions, using system `open` and private `.command` files. Window handling follows Terminal preferences without AppleScript automation permission.
- Bind the Terminal launcher to the current Python, CLI, configuration directory, and working directory, supporting spaces, Chinese characters, and shell metacharacters. Use a separate startup handshake, process identity verification, and schema v1 result bridge for launch failure, window closure, interruption, parent-call exit, and timeout.
- Check call liveness and deadlines during TUI polling and under the configuration transaction lock, preventing expired calls from saving. Revoked calls reap only the matching editor process and clean up their private files.
- Update CLI help, package description, and macOS `doctor` diagnostics. Diagnostics check Terminal and graphical-session conditions without opening desktop terminals. Configuration/result schemas, Linux/Windows behavior, and the disabled-by-default experimental entry point remain compatible.
- Fix false failures from partial PTY reads, add Terminal lifecycle and native helper tests, and extend `.DS_Store` ignore rules and distribution checks.
- Publish stable v1.1.0 wheel, source distribution, and SHA256SUMS. Unify installation and upgrade entry points for Linux/WSL, Windows, and macOS while preserving historical support boundaries.
- Complete the release guide with builds from verified commits, draft-asset verification, publication, and isolated installation after download. CI checks source/package versions, documentation, and screenshots, and excludes local acceptance records and system caches.
- Include eight original macOS / Windows screenshots of the main status line and three TUI pages, standardizing filenames, index, and README display. CI checks packaging of screenshots from all platforms.

## 1.1.0a1 - 2026-10-02

- Add macOS preview support for the main status line, subagent rows, installation/configuration commands, and standalone curses TUI. Experimental `/statusline-configure` uses only preflight-verified tmux popup.
- Share POSIX file locking, private permission repair, atomic replacement, and parent-directory sync between Linux/macOS. Degrade only when the macOS filesystem cannot sync directories; real I/O errors continue to propagate.
- Use C locale / UTC `ps -o lstart=` start identity in the macOS session registry, filtering matching sessions before querying processes. Lazy-loaded LibSystem `mach_continuous_time`, `mach_timebase_info`, and `kern.bootsessionuuid` provide sleep-inclusive timing and reboot detection; unavailable interfaces cause the whole group to fall back to wall-clock time.
- Add macOS preview, architecture, OS version, curses, process, clock, directory-sync, and experimental tmux diagnostics to `doctor`. The standalone TUI gives a clear error when curses is missing.
- Poll input in the macOS standalone TUI so older curses/CPython 3.10 promptly handles SIGINT and other signals without further keystrokes. PTY tests establish a foreground controlling terminal and keep reading output while waiting for exit.
- Add macOS 15/26 × Intel/Apple Silicon × Python 3.10/3.14 CI, extend PTY/tmux integration, and produce platform validation reports. Pin the ARM64 Python 3.10 lower bound to 3.10.11.
- Publish v1.1.0a1 preview wheel, source distribution, and SHA256SUMS for macOS evaluation. Linux/WSL and Windows users can still choose stable v1.0.0; the preview also includes existing functionality for those platforms.
- Synchronize package version, CLI/CI version assertions, installation/upgrade entry points, and release guide. Display schema v2, feature schema v1, old configuration, and runtime state remain compatible without migration.
- Published v1.0.0 packages and tag do not include macOS support. Actual Claude visuals, real sleep/resume, and desktop-terminal experience have not been manually accepted; macOS remains a preview.

## 1.0.0 - 2026-09-04

- Adjust Git staged-count spacing by platform: native Linux retains `● N`; Windows and WSL use `●N`. Detect WSL through both environment variables and kernel release.
- Extend platform support from Linux to Linux/WSL and native Windows 10/11. Windows supports CPython 3.10–3.14 x86/x64; macOS remains unsupported, and native Windows ARM64 Python is not guaranteed.
- Add a centralized platform adapter: Linux retains `fcntl.flock`, `0600/0700`, and parent-directory `fsync`; Windows uses lazy-loaded `msvcrt` fixed-byte locks, inherited ACLs, atomic replacement with sharing-violation/access-denied retries, and durable unlink.
- Validate Windows session-registry `procStart` through `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)`, `GetProcessTimes`, and local `.NET DateTime.Ticks` conversion. Timing uses sleep-inclusive `GetTickCount64` and a minute-quantized boot identity, falling back to wall-clock time when APIs are unavailable.
- Install Windows commands as `claude-statusline.exe render`, `render-subagents`, `hook`, and `slash-hook`, executable by Git Bash and PowerShell. Linux retains absolute paths with POSIX quoting. Ownership accepts canonical names, case-insensitive `.exe`, and PATH aliases resolving to the current entry point.
- Preauthorize narrow Bash/PowerShell config rules in the Windows `/statusline-config` skill. The `/statusline-configure` fallback disables both Bash and PowerShell. Add Windows executable, ACL/mode differences, `windows-curses`, and system new-console diagnostics to `doctor`.
- Add conditional dependency `windows-curses>=2.4.2; sys_platform == "win32"` to metadata. Linux and Windows share the Main/Subagents/Settings full-screen TUI, registering only available platform signals and supporting PDCurses resize.
- Add a Windows `CREATE_NEW_CONSOLE` launcher for `/statusline-configure`, running the current environment's `python -m claude_statusline configure` with a retained child handle, real terminal I/O, 570/585-second deadlines, cleanup after closure/failure/timeout, and schema v1 result bridging. Linux tmux/GNOME behavior remains unchanged.
- Reject symlinks, junctions, other reparse points, out-of-bounds paths, nonregular files, and results over 16 KiB in the Windows bridge; do not mistake NTFS simulated POSIX modes for corruption. Long-path wrapping recognizes `/` and `\`; `full` style preserves payload separators.
- Retain display schema v2, feature schema v1, caches, lifecycle ledger, defaults, Claude Code 2.1.205/2.1.258 thresholds, and old Linux installation-ownership semantics without migration.
- Add Ubuntu/Windows × Python 3.10/3.14 CI, PowerShell/Git Bash and Linux smoke tests, and sdist/wheel checks for version, conditional dependencies, skills, and platform modules.

## 0.9.0 - 2026-09-03

- Add subagent item `status-elapsed`, combining status icon and duration (such as `⏱ 1m 18s`, `✓ 0m 42s`) into one unit, replacing `status` and `elapsed` as defaults. Default output changes from `⏱ Explore · sonnet-5/high · Context 58% left · 1m 18s · searching auth flow` to `⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow`.
- Make `status-elapsed` mutually exclusive with `status` and `elapsed` in `subagents.items`: validation and CLI set-items/enable/disable/order/apply reject combinations; selecting one in the interactive wizard deselects conflicting items.
- Show only the icon when `startTime` is missing or invalid; future timestamps count as 0 seconds. Like old `elapsed`, completed tasks keep counting because the payload has no endTime; durations still use floor rounding.
- Treat `status-elapsed` as a core narrow-screen item like `status`: always retain it, reducing it to an icon at extreme widths rather than adding it to optional-segment drop order.
- Update renderer, catalog, preview, validation, wizard, CLI, and documentation tests.

## 0.8.0 - 2026-09-03

- Add subagent `context-remaining`, displaying `Context N% left`: round the used percentage from `tokenCount / contextWindowSize`, subtract it from 100, and clamp to 0–100. It replaces `context-used` as the default subagent context item.
- Keep subagent `context-used` optional, changing `ctx N%` to main-line-compatible `Context N% used`. Configuration structure is unchanged, but existing configurations enabling it see new text.
- Show remaining context by default for installations without display configuration. Both context items participate in narrow-screen dropping: `current-dir → tokens → context-used → context-remaining → model-with-effort → task`.
- Enable and reorder the new item through CLI, TUI, or `/statusline-config`; update renderer, catalog, preview, and documentation tests.

## 0.7.0 - 2026-09-03

- Add three disabled-by-default main-agent items: `context-used` from Claude's official payload, `project-name` from the launch project's directory basename, and `hostname` from Python's standard library.
- Configure `context-used` and `context-remaining` independently or together. Group `current-dir`, `project-name`, and `hostname` as location items, validating new text for missing values, ranges, control characters, and ANSI safety.
- Retain schema v2, the ten original `DEFAULT_ITEMS`/`LEGACY_DEFAULT_ITEMS`, old configuration, and default output. Enable new items explicitly through CLI, TUI, or `/statusline-config`.
- Extend the all-items preview to 24 deterministic main items, with fixed hostname `devbox`, without reading the real hostname. Subagent renderer, catalog, and defaults remain unchanged.

## 0.6.0 - 2026-09-03

- Add first-class official Claude Code `subagentStatusLine` support and frequent `render-subagents` NDJSON execution. Show status, name, model/effort, context, duration, and task, with optional tokens/cwd, ANSI/CJK/emoji-safe width limits, and silent degradation on corrupted input.
- Make `prompt-timer` measure end-to-end time from user submission to the main agent's final `Stop`. Add `SubagentStart`/`SubagentStop` ledger, `waiting_subagents`/`resuming_main` phases, authoritative `background_tasks` synchronization, and suppression of premature registry/transcript completion.
- Add `off/when-subagents/always` main-line scope labels, defaulting to fixed `Main/Session` only after the current prompt has launched subagents. Session token aggregation remains unchanged.
- Upgrade display configuration smoothly to strict schema v2. Schema v1 is migrated in memory without render/doctor/install rewrites; the first actual save backs up original bytes and atomically writes canonical v2.
- Add complete `config subagents ...` commands, `subagent-statusline`/`scope-labels`, and backward-compatible optional `config apply` arguments. Upgrade the TUI to Main/Subagents/Settings tabs; the slash wizard submits all fields together.
- Add installer threshold Claude Code 2.1.205, ownership states owned/absent/foreign/unsupported, rejection of the full operation on foreign ownership with `--force` takeover, suspension on disabling/downgrade, and restoration on upgrade. Uninstall removes only owned subagent settings and hooks.
- Expand renderer, Unicode width, lifecycle, migration, installation transaction, TUI/Slash, CLI, and doctor tests; update build, upgrade, downgrade, and manual multi-agent acceptance documentation.

## 0.5.0 - 2026-09-03

- Add disabled-by-default experimental `/statusline-configure`, persistently enabled with `install --experimental-slash-tui` and permanently disabled with `--no-experimental-slash-tui`, alongside `/statusline-config`.
- Add tmux `90% × 90%` popup and active GNOME Terminal tab launchers, reusing `claude-statusline configure`. When neither is available, block locally and suggest the standalone command without calling the model.
- Add private atomic result bridging for save, no changes, cancellation, interruption, timeout, and errors to the Claude conversation. Hook/TUI/launcher timeouts are 600/570/585 seconds.
- Extend installation to a unified transaction for settings, feature file, and two owned skills, with explicit repair of corrupted preferences, downgrade suspension/upgrade restoration, strict ownership, dry-run, backups, and original-byte rollback.
- Add doctor checks for feature schema/permissions, disabled/enabled/suspended state, experimental skill/owner/matcher/timeout, and launcher availability. Add launcher, PTY bridge, and real tmux popup integration tests.
- Document that this is not a native Claude Code TUI extension, never accesses `/dev/tty`, uses a new GNOME tab, and has a model-turn fallback exception under `disableAllHooks`.

## 0.4.0 - 2026-09-03

- Add stable standalone `claude-statusline configure [--config-dir PATH]`, providing full-screen Items/Settings tabs in real Linux terminals, with Space selection, navigation, filtering, Left/Right ordering, and numeric editing.
- Add per-keystroke `Preview (sample data)`, reusing production formatting, grouping, and wrapping with deterministic samples only. It reads no Git, transcripts, network, or current runtime state, and creates no cache.
- Enter atomically submits display and host configuration; Esc and signals restore the terminal without writing. Below `64x18`, wait for resizing.
- Add TUI baseline concurrency protection: detect semantic changes to display, host, or installation ownership under the existing lock before backup, preserving unrelated `settings.json` updates.
- Retain display schema version 1 without migration or disabled-item order persistence. `/statusline-config` skill, slash shortcut hook, and existing renderer/hook behavior remain unchanged.

## 0.3.2 - 2026-09-03

- Capitalize display prefixes `Session`, `Git`, `Repo`, `Worktree`, and `Agent`; change the Git error marker to `Git!`.
- Prefix cost amounts with `Total`, such as `Total $0.12 · 12m 30s · +156/-23`. `vim NORMAL` is outside this change and remains unchanged.

## 0.3.1 - 2026-09-03

- Refactor grouping/colors: `model-with-effort`, `fast-mode`, and `thinking` together in ivory; `tokens`/`prompt-cache` in pink; `git`/`pr`/`repo` in purple. `version`, `session`, `cost`, `agent`, `vim-mode`, and `worktree` remain independent.
- Add prefixes to `session`, `git`, and `repo`: `session xxxxx`, `git xxxxx`, `repo xxxxx`.
- Place group members together in catalog order; new wizard-enabled items append after group anchors.

## 0.3.0 - 2026-09-03

- Add 11 optional items from Claude Code 2.1.258+ public status-line payload: `version`, `session`, `cost`, `prompt-cache`, `fast-mode`, `agent`, `vim-mode`, `thinking`, `pr`, `worktree`, and `repo`.
- Disable new items by default, keeping default output identical to 0.2.0; enable explicitly with `/statusline-config enable`.
- Show session cost, API duration, and line changes in `cost` (estimated amounts for third-party APIs); show cache hit rate and written tokens in `prompt-cache`.
- Update `/statusline-config` wizard groups to enable new items through selection.

## 0.2.0 - 2026-09-03

- Add strict user-global JSON display configuration, optional items, and persistent ordering.
- Add colors, ANSI palette, directory formats, separators, and Claude Code host settings.
- Add `/statusline-config` personal skill and local slash-hook shortcut execution for newer Claude Code.
- Automatically manage skill and shortcut hook, degrade gracefully on older Claude Code, and preserve preferences on uninstall.
- Retain unconfigured 0.1.0 output and skip unnecessary Git/transcript work according to enabled items.

## 0.1.0 - 2026-09-02

- Package the existing Claude Code status-line renderer and per-turn lifecycle hook as a standalone CLI.
- Add safe, idempotent installation, uninstallation, and diagnostics.
- Support `CLAUDE_CONFIG_DIR`, retaining existing runtime-state and cache layout.
- Preserve model, directory, Git, context, limits, tokens, and timer display behavior.
