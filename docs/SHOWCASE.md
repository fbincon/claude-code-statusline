# Reproduce the statusline demonstrations

**English** | [简体中文](SHOWCASE.zh-CN.md)

These walkthroughs use the published **v3.16.0** package and ordinary public commands. The [gallery](images/showcase/README.md) identifies each image's configuration, input and capture method; the [development record](development/showcase.md) records package identities, verification and remaining limits. A sample preview is not a measurement of your account or a successful live installation.

**Start with:** [Install](#install) · [Choose a scene](#scenes) · [Edit and reuse](#edit) · [Inspect tasks](#tasks) · [Manage sources](#sources) · [Review versions](#versions) · [Troubleshoot](#troubleshooting)

<a id="install"></a>

## Install and complete first-use setup

Use Node 22 or 24 and an interactive terminal. This recording baseline fixes the package version so a later `latest` release does not silently change the walkthrough:

```sh
npx @fbincon/claude-code-statusline@3.16.0 --dry-run
npx @fbincon/claude-code-statusline@3.16.0
claude-statusline --version
claude-statusline doctor
```

The first entry reviews the persistent npm prefix and exact package before asking for `yes`. npm may separately ask to download the npx entry. A matching persistent installation is reused. For an already installed package, run `claude-statusline setup --dry-run`, then `claude-statusline setup`.

In setup, review the checks, retain the existing display or select a complete scheme, inspect the preview, then choose **Save display and integrate** or **Save display only**. Arrow keys select; Enter continues; Backspace returns; Escape cancels. The external editor needs at least 64 columns × 18 rows. These demonstrations use classic separators; keep Powerline off when adjusting appearance.

Restart Claude after successful integration and inspect its actual statusline. Package installation, display Save and host integration are separate stages: cancelling setup can leave an already completed npm install, and an integration failure can leave a successfully saved display. Read the reported stage and backup paths, run `doctor`, and inspect `recover --dry-run` before retrying. A UI-language choice saved with L is independent of display cancellation. See [setup and recovery](SETUP.md).

<a id="scenes"></a>

## Choose a scene without Powerline

Download the following single-profile JSON files. They are demonstration copies of existing schemes, not new built-in presets. Their common visual baseline uses classic separators and the default palette: Classic theme on dark backgrounds, Light theme on light backgrounds. They have no row-background gradients or shared Powerline blocks. Linked visibility and applicable alignment remain intact.

| File / profile name | Derived from | What to inspect |
| --- | --- | --- |
| [daily.json](../examples/showcase/daily.json) / `Showcase daily` | `daily-development` | Ten metrics in four rows: model/directory/Git, remaining context/window size, five-hour/weekly/spend limits, and tokens/task time |
| [agents.json](../examples/showcase/agents.json) / `Showcase agents` | `agent-workbench` | Task/activity groups and separate agent rows using the same colors for the same component types |
| [quota.json](../examples/showcase/quota.json) / `Showcase quota` | `quota-cost` | Quota/reset alignment, grouped context/spend and cost rate, with explicit threshold examples |
| [narrow.json](../examples/showcase/narrow.json) / `Showcase narrow` | `narrow-terminal` | Three explicit main rows, classic separators and adaptive indicators at 40 columns |
| [light.json](../examples/showcase/light.json) / `Showcase light` | `light-readable` | Light theme and the same gradient hues darkened for a light background, without colored blocks |

<a id="visual-baseline"></a>

### Shared colors and formatting

The approved visual baseline retains original model names and legacy labels, icons and number formatting. It removes extra `M`, `D` and `G` decorations from model, directory and Git while retaining meaningful status symbols such as `✓` and `⏱`. Every displayed metric type has a distinct soft, bright foreground gradient, shared across scenes and main/subagent rows. Model uses Petal, current directory uses Sunset and remaining context uses Ocean; the light variant darkens the same hue families. The [visual refinement record](development/showcase.md#visual-refinement) records the exact mapping and the separate collection/acceptance status.

Ordinary scenes retain these type colors. Threshold-color overrides are reserved for the quota scene or explicitly identified threshold examples; a sample color is not a live quota or billing observation. Editor controls stay neutral so the rendered statusline is the colored focus. Source and version demonstrations include a production-rendered colored preview with the relevant controls.

From the directory containing the downloaded files:

```sh
claude-statusline config profile import daily.json --dry-run
claude-statusline config profile import daily.json
claude-statusline config profile preview "Showcase daily" --width 120
claude-statusline config profile preview "Showcase daily" --scenario warning --width 80
claude-statusline config profile activate "Showcase daily"
claude-statusline config set statusline-language en
claude-statusline configure --user
```

Repeat import and preview with another file and its exact profile name. Import creates a named profile; activation explicitly copies it to the user default. An existing name requires a deliberate `--overwrite`, or import with a new `--name`. To edit the saved named profile instead of the activated default, use `claude-statusline configure --profile "Showcase daily"`. Later edits to that profile do not change the independent user-default copy.

Use `config set statusline-language zh-CN` after activation for Chinese statusline output. `--language zh-CN` changes the invocation's interface language, not the profile's output language. Named-profile output language is edited and saved inside that profile's editor.

Useful sample scenarios are `normal`, `warning`, `critical`, `zero`, `missing`, `source-stale`, `source-failed`, `long-content`, `git-clean`, `git-modified`, `git-conflicted`, `no-agents`, `few-agents` and `many-agents`. Previewing them makes no model request, runs no source and writes no display settings. Compare 40/80/120-column previews; missing observations never mean zero. Live values depend on the fields and collection available in the actual session.

Continuous row backgrounds require colored Powerline output, so these demonstrations do not activate them. Ordinary foreground gradients work without Powerline. The [appearance guide](APPEARANCE.md) explains both capabilities; [all eight complete schemes](SCHEMES.md) remain available unchanged.

<a id="edit"></a>

## Edit, review and reuse

Open the external editor with `claude-statusline configure --user`, or use `/statusline-configure-native` inside a supported Claude terminal after installing Native integration. `/statusline-config` is the conversational guide; it is not the Native editor command.

1. Confirm the editing target in the header. Use Settings to select sample scenario and preview width, then inspect Main and Subagents. These preview controls are session-only.
2. Open a component and change its ordinary foreground or foreground gradient. Cancel the form once to confirm the draft is retained, then accept a change.
3. Open **Changes and history** with Ctrl+T. Use U to undo and R to redo there. Outside managers, external Undo is Ctrl+Z; Native Undo is Ctrl+_ because Unix Claude may intercept Ctrl+Z. Redo is Ctrl+R.
4. Use **Display schemes and projects** (Ctrl+O) to import selected settings from a profile into the current draft. Select only the intended sections, review the differences and accept. Save separately.
5. Open a destination component's **Copy / paste visual style** to select a source and compatible visual fields. Its metric, local binding, position and visibility stay with the destination.
6. Use Settings → **Reuse complete groups** for an entire group. Review dependencies and any automatic-to-explicit layout conversion. Imported local bindings remain unresolved until separately bound; importing never enables their source.
7. Review changes, Save, close and reopen the same target to verify persistence. Repeat an edit followed by cancellation to verify the saved display stays unchanged.

For a read-only CLI selective-import review:

```sh
claude-statusline config profile import light.json --select theme,palette --user --dry-run
claude-statusline config profile export "Showcase daily" saved-daily.json
```

This selection reviews only the global theme and palette; it does not copy the light profile's darker component gradients. Use the visual-style workflow above for those styles, or import and preview the complete profile. Omitting `--dry-run` explicitly saves the selected fields to the chosen target. Export writes a new file; it does not mark an editor draft saved. Source enablement, UI language and independent host Apply are outside display Undo. If Save has an unknown result, reconcile saved state before another edit. For conflicts, comparison/export retains the draft; discard/reload requires explicit confirmation. See [draft history and reuse](DRAFT_HISTORY.md), [profiles](PROFILES.md) and [composition](COMPOSITION.md).

<a id="tasks"></a>

## Inspect a real task and its agents

For a bounded ordinary task, use Claude's noninteractive budget option with your own existing account:

```sh
claude --print --max-budget-usd 1 --output-format json \
  'Reply exactly SHOWCASE_SINGLE_OK. Use no tools.'
```

For a two-agent observation:

```sh
claude --print --max-budget-usd 2 --output-format json \
  'Start exactly two agents concurrently. Ask the first to reply SHOWCASE_A_OK and the second SHOWCASE_B_OK. Each agent must use no tools, change no files and perform no network work. After both finish, reply SHOWCASE_AGENTS_OK. Do nothing else.'
```

The delivery recorder fixes its actual prompt, session identity and result in provenance. These requests may incur model charges and are not required for configuration or sample previews. Claude's budget flag applies only with `--print`; do not assume it caps an ordinary interactive recording. Inspect the result's cost and completion state before another attempt. The delivery's own attempts share a separate USD 10 ledger; public instructions do not reuse that private account or ledger.

Open `/statusline-task`, or obtain the exact session ID from your own session metadata/statusline input and run:

```sh
claude-statusline task show --session-id SESSION_ID --json
claude-statusline task view --session-id SESSION_ID
```

Replace `SESSION_ID` with your own session ID. The gallery's recorded demonstration identifiers belong to the earlier controlled demonstration; do not paste them as your own IDs. Add `--prompt-id PROMPT_ID` to select a known historical task. Use `/` to search names/IDs, F to filter observed statuses, Enter to expand a selected agent, E to inspect evidence and R to refresh manually. Q closes the viewer. Settings → **Task details** returns to the existing configuration draft.

Check that task total time and per-agent elapsed time retain their different scopes, completed durations freeze, and unavailable active time stays unavailable. The external viewer may show IDs where Native can obtain host names. A failed refresh retains the previous report and its capture time. Neither viewer scans transcripts, starts collection, queries GitHub or calls a model. See [task details](TASK_DETAILS.md).

The gallery's task clip starts with recorded completed observations replayed through the installed renderer, then shows the offline task viewer reading those stores. It is not an original statusline callback recording. The main/agent ending times remain 14 seconds and 5/7 seconds in both languages. Active-time coverage is still unknown or incomplete where the pane says so. The session's recorded USD 0.00199048 rounds to `$0.00` in the production display; that does not mean the call was free. Selected keyframes are held for 1.4 seconds, so the clip is not real-time footage or a responsiveness benchmark.

The visual refinement reuses those retained observations; no new paid task is planned. The original two top-level tasks together cost USD 0.00224378 according to the CLI. Recoloring or reopening the viewer does not create a new task observation or change that original evidence.

<a id="sources"></a>

## Register, review and inspect a source

These optional steps create local source records. Use distinct IDs and a directory you own. In either editor, **Settings → Data sources** (Ctrl+Y) offers the same review flow. A saved source definition is independent of display Save and Undo.

For a local JSON example, create `queue.json` with a current ISO timestamp and a source definition using its absolute path:

```json
{"value":0,"observed_at":"2026-10-30T08:00:00Z"}
```

The timestamp above is illustrative: an old timestamp correctly becomes stale. Save this as `queue-source.json`, replacing the path:

```json
{
  "kind":"json","name":"Showcase queue",
  "scope":{"project":null,"session":null,"agent":null},
  "ttl_seconds":300,
  "settings":{"path":"/absolute/path/queue.json","pointer":"/value","observed_at_pointer":"/observed_at","unit":"jobs"}
}
```

```sh
claude-statusline source add showcase-queue --file queue-source.json --json
claude-statusline source review showcase-queue --json
claude-statusline source enable showcase-queue --review REVIEW_REVISION --json
claude-statusline config instance main add external-value
claude-statusline source bind showcase-queue --instance INSTANCE_ID --scope main --json
claude-statusline source diagnose showcase-queue --json
```

Use the actual `review_revision` and instance ID returned by the preceding commands. Enabled JSON is read when a bound component renders; a sample preview does not read the file. Explicit zero is valid data. Remove a field or let the timestamp expire to inspect missing/stale results, without describing them as a passing live value.

For a command source, use the same add → review → enable sequence with a definition such as:

```json
{
  "kind":"command","name":"Showcase command",
  "scope":{"project":null,"session":null,"agent":null},
  "ttl_seconds":300,
  "settings":{"executable":"node","args":["-p","String(42)"],"cwd":"/absolute/project","input":{},"output":"text","timeout_ms":5000}
}
```

Save it as `command-source.json`, add it with ID `showcase-command`, review and enable that exact revision. Then explicitly execute and inspect it:

```sh
claude-statusline source refresh showcase-command --project /absolute/project --json
claude-statusline source diagnose showcase-command --project /absolute/project --json
```

Arguments are literal; no Shell is implied. Source editing revokes the old review. The command receives only mapped input and essential OS environment variables, not model or forge credentials.

For GitHub, use a checkout of `fbincon/claude-code-statusline` with the intended branch and matching remote HEAD, plus your existing authenticated `gh` account. Create a GitHub source in the editor with explicit host `github.com`, repository `fbincon/claude-code-statusline`, actual project root, branch and account. Review and enable it, then choose **Refresh now** and **Inspect source and observations**. The query is read-only. No PR, unavailable checks and authentication failures are distinct from success; opening the page or a preview makes no request. Do not borrow the delivery account's name or switch credentials to reproduce the image.

The three stop operations mean different things:

```sh
claude-statusline source cancel JOB_ID --json
claude-statusline source auto-off SOURCE_ID --json
claude-statusline source disable SOURCE_ID --json
```

The first explicitly cancels the whole refresh job. The second stops that source's automatic policy while preserving enablement and other consumers. The third disables the source and stops subsequent reading/execution. Closing one editor releases only its interest. These walkthroughs do not require automatic refresh; if you choose it, review it separately. Disable the demonstration sources when finished; remove bindings before removing referenced records. See [source operations and cleanup](EXTENSIONS.md).

<a id="versions"></a>

## Review versions and recover deliberately

Open Settings → **Version and installation** in either editor. Initial entry reads local identity only. The following commands explicitly check metadata, then review the exact target with a dry-run:

```sh
claude-statusline update --version 3.16.0 --prefix /actual/prefix --check --json
claude-statusline update --version 3.16.0 --prefix /actual/prefix --dry-run
```

Replace `/actual/prefix` with the prefix that owns the installed package, as shown on the version page. Omit it only when the effective npm default selects that same installation. A custom installation can run correctly while npm's current default points elsewhere; `not_installed` at that other prefix is not a reason to reinstall the working package. Also pass the actual `--config-dir PATH` when it is nondefault.

Check package/configuration compatibility and result stages. A metadata check reports `artifact_verified: false`; it is not an archive check. A dry-run that stages a replacement also verifies its archive, using temporary staging and npm cache without replacing the target package or configuration. An already-current installation can instead return `unchanged: true` and `artifact_verified: false`, as on the demonstration machine; that result is not a downloaded-package verification.

The refreshed version demonstration pairs the relevant actions and diagnostics with a colored sample preview. Preview colors do not establish package verification. Follow any multiple-prefix warning and select the intended installation explicitly before checking or changing versions; exact image bounds and transformations belong to the capture inventory.

Practice an actual transition only with a separate prefix and empty configuration directory. For example, on POSIX create an isolated directory, install 3.15.0 there, then use the fixed newer manager:

```sh
showcase_lab=$(mktemp -d "${TMPDIR:-/tmp}/statusline-showcase.XXXXXX")
SHOWCASE_PREFIX="$showcase_lab/prefix"
SHOWCASE_CONFIG="$showcase_lab/config"
mkdir -p "$SHOWCASE_CONFIG"
npm install --global --ignore-scripts --prefix "$SHOWCASE_PREFIX" @fbincon/claude-code-statusline@3.15.0
npx @fbincon/claude-code-statusline@3.16.0 update --version 3.16.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --dry-run
npx @fbincon/claude-code-statusline@3.16.0 update --version 3.16.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --yes
npx @fbincon/claude-code-statusline@3.16.0 rollback --version 3.15.0 --prefix "$SHOWCASE_PREFIX" --config-dir "$SHOWCASE_CONFIG" --dry-run
```

Run the directory/variable setup before the package commands; do not substitute your normal installation. Keep this package-only exercise separate from the live Claude integration. Review compatibility before applying rollback with `--yes`; a different language/configuration may legitimately block the older package.

For a genuinely interrupted operation, preserve its printed transaction/control entry and review `recover --package --prefix PATH --config-dir PATH --dry-run`. Package repair and `recover --restore-config pkg-BACKUP_ID` are separate operations. Do not manufacture a failure in your working installation for a screenshot. Closing an execution page detaches; it does not cancel the durable operation. Protected history cleanup refuses running, unknown or referenced records. See the [complete version and recovery guide](PACKAGE_MANAGEMENT.md).

<a id="troubleshooting"></a>

## Read the result and troubleshoot

| Observation | Next step |
| --- | --- |
| Preview looks populated but the real statusline does not | The preview uses fixed observations. Check the actual host fields, collector opt-outs and [input diagnosis](DIAGNOSTICS.md); do not enable collection merely to imitate a picture. |
| Configured gradients appear gray | Check whether the command inherited `NO_COLOR`; its presence disables colors. Use an environment without that variable for a deliberately colored preview. Keep it for intentional no-color output; the product's behavior is unchanged. |
| Background gradient has no effect | These scenes disable Powerline. Use an ordinary foreground gradient, or read the separate Powerline requirement. |
| Source has no value, is stale or failed | Inspect its exact scope, revision, time and saved error. Zero and absence are different; refresh only after reviewing the relevant source. |
| Import changes the draft but not the statusline | Acceptance and Save are separate in the editor; named-profile import and activation are separate in the CLI. Check the selected target/project binding. |
| Save is unknown or conflicts | Keep the draft, inspect/reconcile current state and review again; do not force an old revision over newer settings. |
| Setup/update completed only some stages | Read package, display and integration outcomes separately. Keep backups/control entries and review the applicable recovery operation. |
| Version review reports `not_installed` although the command works | Select the actual package prefix with `--prefix`; npm's default prefix may have changed or differ from the command's installation. |
| Terminal is narrow or lacks color/glyph support | Try `Showcase narrow`, 40/80-column previews or no-color output. Complete numbers/graphemes and truthful missing states take priority over decoration. |

The [gallery](images/showcase/README.md) supplies alternate text, input provenance and method labels. Terminal reconstructions and agent visual inspection do not establish a new human usability study or physical-platform acceptance. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
