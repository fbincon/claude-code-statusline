# Complete display schemes

**English** | [简体中文](SCHEMES.zh-CN.md)

<a id="editor-quick-setup"></a>

## Quick setup in either editor

In `/statusline-configure-native` or `claude-statusline configure`, press **Ctrl+P** or choose **Settings → Quick setup**. Choose a use case, appearance and sample. Use the arrow keys and Enter to select, Left/Right to adjust appearance, Tab to switch main and subagent samples, and PgUp/PgDn to scroll source requirements. Use the separate [first-use setup](SETUP.md) wizard to review and install Claude integration.

On the review page, choose an action.

- **Continue editing this draft** accepts the candidate as the current draft.
- **Save this draft** saves to the current target with the revision check, backup and transaction. Review of a shared profile shows the count and paths of bound projects.
- **Save as a named copy** keeps the original unsaved draft and saves a separate profile.

Backspace returns one step. Ctrl+G cancels and keeps the draft from before Quick setup. Esc also cancels in the external editor. Choosing a preset or scheme preserves existing collector preferences and disabled subagent rows. An explicit interface language change saves immediately, output language saves with the display draft, and Claude preferences use their separate Apply action.

## Built-in schemes

The eight complete schemes below expand into ordinary editable instances, layouts and appearance settings. The [usage demonstrations](SHOWCASE.md) provide ready-to-follow workflows and non-Powerline variants; selecting a built-in scheme uses its defaults shown here.

| ID / shareable JSON | Main display and default appearance | Subagents and requirements |
| --- | --- | --- |
| [`daily-development`](../examples/schemes/daily-development.json) | Model/effort, directory, Git, context and task time; compact separators and terminal theme. A second-row session-cost item starts disabled | Default agent template; Claude input, local Git and task observations |
| [`agent-focus`](../examples/schemes/agent-focus.json) | Task time, context and Git, plus observed run state, progress and agent count; compact separators and terminal theme | State, name, model, context, elapsed and task; hide completed agents, retain failures, no row limit |
| [`quota-watch`](../examples/schemes/quota-watch.json) | Context, five-hour/weekly limits and resets, then observed cost/spending/cache; compact separators and terminal theme | Host quota/cost fields; absent or expired limits are omitted, never converted to zero |
| [`powerline-daily`](../examples/schemes/powerline-daily.json) | Two rows of model, directory, Git, context, task time and cost; ocean theme, adaptive indicators and Powerline row gradient | State, name, model, context, elapsed and task; cost requires a host observation |
| [`agent-workbench`](../examples/schemes/agent-workbench.json) | Task/context/Git plus a linked activity group; slate theme, adaptive indicators and Powerline row gradient | Hide completed agents, retain failures, at most six rows; live activity requires separately enabled collection |
| [`quota-cost`](../examples/schemes/quota-cost.json) | Aligned quota/reset columns, context/spending and cost/rate rows; ember theme, adaptive indicators and Powerline row gradient | Host quota/cost observations; cost rate retains its defined time basis |
| [`narrow-terminal`](../examples/schemes/narrow-terminal.json) | Model, short directory, context and task time; automatic layout, compact separators and terminal theme | State, name, context and elapsed; short adaptive indicators and priority fitting |
| [`light-readable`](../examples/schemes/light-readable.json) | Two rows of model, directory, Git, context, task time and cost; light theme, adaptive indicators and Powerline row gradient | State, name, model, context, elapsed and task; use a light terminal background |

Compact numbers, stable instance IDs, priorities and width limits are included. Schemes retain output language, subagent enablement and the Git comparison base. They cannot enable collectors, authorize external sources, change independent host preferences or replace project bindings. Built-in updates do not replace a saved copy. Missing live/host data retains the component's unavailable-data behavior.

Powerline is a display choice, not a requirement. To keep a selected scheme's items and colors with compact separators, set `separator-style compact` before saving. Powerline backgrounds then have no effect; ordinary foreground colors and eligible foreground gradients still apply. The terminal background and font remain independently controlled. [Appearance controls](APPEARANCE.md).

The six original preset IDs also remain available: `minimal`, `developer`, `monitoring`, `multi-agent`, `left-right` and `repeated-metrics`. Unlike complete schemes, those presets preserve the selected global theme and separator. A **profile** is your named saved display configuration; it can start from either kind and later be shared or bound to a project. [Profile behavior](PROFILES.md).

## CLI and sharing

```sh
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set theme dark
claude-statusline config set separator-style compact
claude-statusline config enable session-cost
```

CLI preset application changes the user default and requires installed/owned Claude integration. Use `setup` to save before integration. In an editor, Save follows the displayed user/profile/project target.

Download a linked JSON file above, review it, then use single-profile import/export:

```sh
claude-statusline config profile import daily-development.json --dry-run
claude-statusline config profile import daily-development.json
claude-statusline config profile activate daily-development
claude-statusline config profile export daily-development my-scheme.json
```

The current generated files use single-profile format 1 and display schema 17. They contain no project bindings, collection switches, host preferences or external-capability grants. Import saves a named profile; activation and project binding remain explicit. Older captured scheme files retain their original format and artifact identities in the [setup gallery](images/setup-appearance/README.md) and [adaptive-scenario gallery](images/adaptive-row-scenarios/README.md).
