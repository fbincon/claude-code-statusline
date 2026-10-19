# Configuration experience: shared editing, quick setup and explanation

**English** | [简体中文](configuration-experience.zh-CN.md)

The implementation starts from `844ce521e5c6e3a43d7120e99a7724ef35ab899a` and delivers UX-01, UX-02 and EXPLAIN-01. The public entry points remain `configure` and `/statusline-configure-native`. See the [user workflow](../USER_GUIDE.md#quick-setup-and-explanation) and [protocol](contracts.md#configuration-and-sample-explanation-protocol).

## Responsibilities and behavior

- `core/editor/text-input` owns original text, grapheme boundaries, insertion/deletion and the visible caret window. TUI and Client adapters translate input and draw the result. Complete text insertions are rejected atomically on invalid controls or field limits.
- `core/config/presets` supplies ordered presentation metadata. `core/editor/quick-setup` owns the candidate and transitions; the existing backend expands presets. Both editors use the shared menu and scrollable requirement text. Opening/backing out does not replace the pending draft, install integrations or enable collection.
- `core/rendering/trace` records decisions inside the existing main, subagent, component and Powerline renderers. The normal path does not construct a trace. `core/rendering/explain` combines those sample decisions with explicit configuration facts.
- `cli/ui/explain` reads installation ownership and collector preferences without locks or writes. Host capability is distinct from actual field observation. Unreadable sources remain unknown. No transcripts, runtime stores, Git queries or network calls supply explanation data.
- `core/editor/explanation` formats per-instance evidence for both interfaces. Native response guards retain epoch/width/draft identity; TUI caches results by draft, scope, instance and width. Native effects stay in hooks and external effects stay in Session.

New modules are generated into the self-contained native Mod; generated copies are not separately maintained. Tests live with the owning packages, with end-to-end PTY cases under the existing acceptance tools.

## Compatibility and limitations

Editor protocol **13** adds `explain` and preset presentation metadata. Display schema **8**, runtime protocol **2**, portable envelope **1** and UI preference schema **1** remain unchanged. Actual display saves retain revision, ownership, backup and rollback checks; external save failures leave the terminal and draft open. UI-language persistence and Claude preference Apply stay independent.

The native Client API provides keys without a paste-origin flag. Recognizable multi-character input remains atomic text, and input-queue overflow is reported. Host-split single-character paste cannot reliably be identified, and native Escape remains a focus action. These restrictions are disclosed rather than described as verified improvements.

Sample outcomes distinguish configured-off instances, condition hiding, clipping, priority/legacy width omission, empty values, spacers and hidden sample-agent rows. Automatic wrapping preserves content; preview-panel row capacity is an independent UI limit. No live availability diagnosis is claimed.

## Validation and release evidence

Validation covers grapheme/Unicode input and resize, six-language candidate transitions, dirty-draft cancellation, conflicts, failure recovery, readonly I/O, duplicate-instance identity, and preview/explanation agreement at 40/80/120 columns. Installed extended captures include quick-setup stages, middle-of-text caret editing and explanations. The artifacts identify their immutable source and package hashes; reconstructed PTY cells are not desktop screenshots or human acceptance.

The [v3.2.0-only decision](../releases/approvals/v3.2.0.json) accepts the same six historical gaps in [#96](https://github.com/fbincon/claude-code-statusline/issues/96), with no waiver for new failures. Final delivery requires final-head/main/tag CI, eight installed targets, 32 Node cases, thirteen fixed hosts, identical independent builds/source rebuild and verified npm/GitHub/Gitee downloads. Publication identities and completed evidence are recorded after those gates succeed.
