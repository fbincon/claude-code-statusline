# Complete display schemes

**English** | [简体中文](SCHEMES.zh-CN.md)

Open Quick setup in either editor (Ctrl+P), or run [first-use setup](SETUP.md). Choose a scheme, inspect its source requirements, preview main/subagent rows, and adjust appearance. The review offers continuing to edit, saving the current target, or saving a named copy. Saving a copy retains the existing unsaved draft. Saving edits to a shared profile shows its bound-project count and paths.

| ID / shareable JSON | Main display | Subagents and requirements |
| --- | --- | --- |
| [`daily-development`](../examples/schemes/daily-development.json) | Model/effort, directory, Git, context and task time; session cost is a disabled second-row item that can be enabled | Existing agent template; Claude input, local Git and task observations |
| [`agent-focus`](../examples/schemes/agent-focus.json) | Task time, context and Git; run state, progress and agent count when available | State, name, model, context, agent elapsed time and task; hide completed agents, retain failures, no row limit |
| [`quota-watch`](../examples/schemes/quota-watch.json) | Context, five-hour/weekly limits and resets; cost, spending and cache on a further row when supplied | Requires observed host fields; absent/expired limits are omitted, never converted to zero |

New schemes use short labels, compact numbers, terminal colors and compact separators. Choose dark/light/terminal themes in Quick setup, or adjust them in Settings. Powerline is optional; no special font is required by default. ASCII task/agent indicators retain state (`ok`, `run`, `fail`, `stop`, `pending`, `wait`). Task timing and an agent's elapsed time describe different scopes.

Each scheme expands into ordinary editable instances with fixed identities, priorities and width limits. Selection retains output language, subagent enablement and Git base configuration. It cannot enable collectors, add network or command sources, change independent host preferences, or replace project bindings. Run state/progress/count need separately enabled live metrics. Built-in updates do not replace a saved copy.

The six previous preset IDs and their expansion behavior remain available: `minimal`, `developer`, `monitoring`, `multi-agent`, `left-right`, `repeated-metrics`. New complete schemes additionally define global appearance; they do not change the user default until explicitly saved.

## CLI and sharing

```sh
claude-statusline config preset daily-development --dry-run
claude-statusline config preset daily-development
claude-statusline config set theme dark
claude-statusline config set palette default
claude-statusline config enable session-cost
```

Preset CLI application retains its existing installed/owned-host requirement. Use `setup` to save before integration. In an editor, Save follows the displayed user/profile/project target.

Download a linked JSON file above from the repository, review it, then use the existing single-profile import/export commands:

```sh
claude-statusline config profile import daily-development.json --dry-run
claude-statusline config profile import daily-development.json
claude-statusline config profile activate daily-development
claude-statusline config profile export daily-development my-scheme.json
```

These files use single-profile format 1 and display schema 9. They contain no project bindings, collection switches, host preferences or external-capability grants. Importing saves a named profile; activation and project binding remain explicit. See [profile behavior](PROFILES.md), [appearance controls](APPEARANCE.md), and [installed sample provenance](images/setup-appearance/README.md).
