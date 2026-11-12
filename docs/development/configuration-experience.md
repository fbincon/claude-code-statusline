# Configuration experience: shared editing, quick setup and explanation

**English** | [简体中文](configuration-experience.zh-CN.md)

The public entry points are `configure` and `/statusline-configure-native`; see the [user workflow](../USER_GUIDE.md#quick-setup-and-explanation) and [protocol](contracts.md#configuration-and-sample-explanation-protocol). Original implementation and release evidence is in the [delivery record](history/deliveries/configuration-experience.md#configuration-experience-shared-editing-quick-setup-and-explanation).

## Responsibilities and behavior

- `core/editor/text-input` owns original text, grapheme boundaries, insertion/deletion and the visible caret window. TUI and Client adapters translate input and draw the result. Complete text insertions are rejected atomically on invalid controls or field limits.
- `core/config/presets` supplies ordered presentation metadata. `core/editor/quick-setup` owns the candidate and transitions; the existing backend expands presets. Both editors use the shared menu and scrollable requirement text. Opening/backing out does not replace the pending draft, install integrations or enable collection.
- `core/rendering/trace` records decisions inside the existing main, subagent, component and Powerline renderers. The normal path does not construct a trace. `core/rendering/explain` combines those sample decisions with explicit configuration facts.
- `cli/ui/explain` reads installation ownership and collector preferences without locks or writes. Host capability is distinct from actual field observation. Unreadable sources remain unknown. No transcripts, runtime stores, Git queries or network calls supply explanation data.
- `core/editor/explanation` formats per-instance evidence for both interfaces. Native response guards retain epoch/width/draft identity; TUI caches results by draft, scope, instance and width. Native effects stay in hooks and external effects stay in Session.

New modules are generated into the self-contained native Mod; generated copies are not separately maintained. Tests live with the owning packages, with end-to-end PTY cases under the existing acceptance tools.

## Compatibility and limitations

The editor protocol and display schema carry `explain` and preset presentation metadata; current interface versions are in the [CLI reference](../reference/cli.md#protocol-and-schema-versions). Actual display saves retain revision, ownership, backup and rollback checks; external save failures leave the terminal and draft open. UI-language persistence and Claude preference Apply stay independent.

The native Client API provides keys without a paste-origin flag. Recognizable multi-character input remains atomic text, and input-queue overflow is reported. Host-split single-character paste cannot reliably be identified, and native Escape remains a focus action. These restrictions are disclosed rather than described as verified improvements.

Sample outcomes distinguish configured-off instances, condition hiding, clipping, priority/legacy width omission, empty values, spacers and hidden sample-agent rows. Automatic wrapping preserves content; preview-panel row capacity is an independent UI limit. No live availability diagnosis is claimed.

The full [delivery record](history/deliveries/configuration-experience.md#configuration-experience-shared-editing-quick-setup-and-explanation) is in the development history. The links below open its moved sections.

- <a id="validation-and-release-evidence"></a>[Validation and release evidence](history/deliveries/configuration-experience.md#validation-and-release-evidence)
- <a id="release-validation--2026-10-19"></a>[Release validation — 2026-10-19](history/deliveries/configuration-experience.md#release-validation--2026-10-19)
- <a id="published-delivery"></a>[Published delivery](history/deliveries/configuration-experience.md#published-delivery)
