"""Single source of scoped item metadata, defaults and selection constraints."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ItemDefinition:
    scope: str
    id: str
    label: str
    description: str
    group: str
    sources: tuple[str, ...]
    examples: tuple[str, ...]
    default_position: int | None = None
    minimum_version: str | None = None
    format_options: tuple[str, ...] = ("colors", "palette", "separator-style")
    excludes: tuple[str, ...] = ()
    unavailable_reasons: tuple[str, ...] = (
        "not_observed",
        "unsupported_host",
        "unknown_host_version",
        "source_unavailable",
        "condition_not_met",
    )

    def to_dict(self) -> dict:
        value = asdict(self)
        for key in (
            "sources",
            "examples",
            "format_options",
            "excludes",
            "unavailable_reasons",
        ):
            value[key] = list(value[key])
        value["default_enabled"] = self.default_position is not None
        value["minimum_version_status"] = (
            "verified" if self.minimum_version else "unknown"
        )
        return value


def _main(item, label, description, group, sources, example, position=None, **kwargs):
    return ItemDefinition(
        "main",
        item,
        label,
        description,
        group,
        tuple(sources),
        (example,),
        position,
        **kwargs,
    )


def _agent(item, label, description, sources, example, position=None, **kwargs):
    minimum_version = kwargs.pop("minimum_version", "2.1.205")
    return ItemDefinition(
        "subagent",
        item,
        label,
        description,
        "task",
        tuple(sources),
        (example,),
        position,
        minimum_version=minimum_version,
        **kwargs,
    )


ITEMS = (
    _main(
        "model-with-effort",
        "Model and effort",
        "Current model identifier with reasoning effort",
        "model",
        ("model.id", "effort.level"),
        "claude-opus high",
        0,
    ),
    _main(
        "model",
        "Model",
        "Current model identifier, or display name when the identifier is absent",
        "model",
        ("model.id", "model.display_name"),
        "claude-opus",
    ),
    _main(
        "effort",
        "Effort",
        "Live reasoning effort of the main conversation",
        "model",
        ("effort.level",),
        "high",
    ),
    _main(
        "fast-mode",
        "Fast mode",
        "Indicates fast mode is active",
        "model",
        ("fast_mode",),
        "fast",
    ),
    _main(
        "thinking",
        "Thinking",
        "Indicates extended thinking is enabled",
        "model",
        ("thinking.enabled",),
        "thinking",
    ),
    _main(
        "current-dir",
        "Directory",
        "Current working directory",
        "location",
        ("workspace.current_dir", "cwd", "worktree.path", "workspace.project_dir"),
        "~/projects/statusline/src",
        1,
        format_options=("colors", "palette", "separator-style", "directory-style"),
    ),
    _main(
        "project-name",
        "Project",
        "Project directory name",
        "location",
        ("workspace.project_dir",),
        "Project statusline",
    ),
    _main(
        "hostname",
        "Hostname",
        "Local hostname",
        "location",
        ("local_hostname",),
        "Host devbox",
    ),
    _main(
        "git",
        "Git",
        "Git branch, divergence, and working-tree changes",
        "repository",
        ("local_git",),
        "Git main ↑1 ~2 ?1",
        2,
    ),
    _main(
        "git-branch",
        "Git branch",
        "Current Git branch or detached HEAD identifier",
        "repository",
        ("local_git.branch",),
        "Git main",
    ),
    _main(
        "git-changes",
        "Git changes",
        "Staged, unstaged, conflicted and untracked file counts, or a clean worktree",
        "repository",
        (
            "local_git.staged",
            "local_git.unstaged",
            "local_git.conflicts",
            "local_git.untracked",
        ),
        "Git ~2 ?1",
    ),
    _main(
        "git-ahead-behind",
        "Git ahead/behind",
        "Commit difference from the configured upstream, including a gone upstream",
        "repository",
        (
            "local_git.upstream",
            "local_git.ahead",
            "local_git.behind",
            "local_git.upstream_gone",
        ),
        "Git ↑1 ↓0",
    ),
    _main(
        "pr",
        "Pull request",
        "Open pull or merge request on the current branch",
        "repository",
        ("pr.number", "pr.review_state"),
        "PR #42 · approved",
    ),
    _main(
        "repo",
        "Repository",
        "Remote repository owner and name",
        "repository",
        ("workspace.repo.owner", "workspace.repo.name"),
        "Repo example/statusline",
    ),
    _main(
        "worktree",
        "Worktree",
        "Worktree name in --worktree sessions",
        "repository",
        ("worktree.name",),
        "Worktree feature",
    ),
    _main(
        "context-remaining",
        "Context remaining",
        "Percentage of context window remaining",
        "context",
        ("context_window.remaining_percentage",),
        "Context 73% left",
        3,
    ),
    _main(
        "context-used",
        "Context used",
        "Percentage of context window used",
        "context",
        ("context_window.used_percentage", "context_window.remaining_percentage"),
        "Context 27% used",
    ),
    _main(
        "context-window-size",
        "Context window",
        "Total context window size",
        "context",
        ("context_window.context_window_size",),
        "200K window",
        4,
    ),
    _main(
        "context-tokens",
        "Context tokens",
        "Current input-context tokens, including cache reads/writes, versus window capacity",
        "context",
        (
            "context_window.current_usage",
            "context_window.total_input_tokens",
            "context_window.context_window_size",
        ),
        "Context 54K / 200K",
    ),
    _main(
        "five-hour-limit",
        "Five-hour allowance",
        "Remaining five-hour usage limit",
        "limits",
        ("rate_limits.five_hour.used_percentage",),
        "5h 82% left",
        5,
    ),
    _main(
        "five-hour-reset",
        "Five-hour reset",
        "Countdown to the five-hour allowance reset",
        "limits",
        ("rate_limits.five_hour.resets_at",),
        "5h reset 2h 13m",
    ),
    _main(
        "weekly-limit",
        "Weekly allowance",
        "Remaining seven-day usage limit",
        "limits",
        ("rate_limits.seven_day.used_percentage",),
        "weekly 64% left",
        6,
    ),
    _main(
        "weekly-reset",
        "Weekly reset",
        "Countdown to the seven-day allowance reset",
        "limits",
        ("rate_limits.seven_day.resets_at",),
        "weekly reset 6d 2h",
    ),
    _main(
        "spend-limit",
        "Gateway allowance",
        "Remaining gateway spend limit",
        "limits",
        ("rate_limits.spend_limit.used_percentage",),
        "spend 91% left",
        7,
    ),
    _main(
        "tokens",
        "Tokens",
        "Cumulative cache hit, cache miss, and output tokens",
        "usage",
        ("conversation_transcript",),
        "hit 1.2M · miss 87.5K · out 22.4K",
        8,
    ),
    _main(
        "prompt-cache",
        "Prompt cache",
        "Prompt cache hit ratio and cached input tokens",
        "usage",
        ("prompt_cache.hit_ratio", "prompt_cache.cache_write_tokens"),
        "cache 91% · 352K w",
        minimum_version="2.1.251",
    ),
    _main(
        "cache-state",
        "Cache state",
        "Main-conversation cache warmth, expiry or unobserved caching",
        "usage",
        (
            "prompt_cache.warm",
            "prompt_cache.caching_observed",
            "prompt_cache.expires_at",
        ),
        "Cache warm",
        minimum_version="2.1.251",
    ),
    _main(
        "cache-expires",
        "Cache expiry",
        "TTL countdown of an observed warm main-conversation cache",
        "usage",
        (
            "prompt_cache.warm",
            "prompt_cache.caching_observed",
            "prompt_cache.expires_at",
        ),
        "Cache TTL 4m 20s",
        minimum_version="2.1.251",
    ),
    _main(
        "cache-misses",
        "Cache misses",
        "Official diagnosed main-conversation cache misses, excluding expected rebuilds",
        "usage",
        ("prompt_cache.misses",),
        "Cache miss 2",
        minimum_version="2.1.251",
    ),
    _main(
        "api-requests",
        "API requests",
        "Official recorded API request count for the main conversation only",
        "usage",
        ("prompt_cache.requests",),
        "API requests 14",
        minimum_version="2.1.251",
    ),
    _main(
        "prompt-timer",
        "Task timer",
        "Elapsed time and outcome of the latest prompt",
        "usage",
        ("lifecycle_hooks", "conversation_transcript"),
        "✓ 1m 42s",
        9,
    ),
    _main(
        "version",
        "Host version",
        "Claude Code version",
        "session",
        ("version",),
        "v2.1.288",
    ),
    _main(
        "session",
        "Session",
        "Session name, or the session identifier prefix",
        "session",
        ("session_name", "session_id"),
        "Session demo-session",
    ),
    _main(
        "session-name",
        "Session name",
        "Observed custom or generated session name",
        "session",
        ("session_name",),
        "Session demo-session",
    ),
    _main(
        "session-id",
        "Session ID",
        "Full session identifier",
        "session",
        ("session_id",),
        "ID demo-session",
    ),
    _main(
        "session-id-short",
        "Short session ID",
        "First eight characters of the session identifier",
        "session",
        ("session_id",),
        "ID demo-ses",
    ),
    _main(
        "output-style",
        "Output style",
        "Official current output style name",
        "session",
        ("output_style.name",),
        "Style Default",
    ),
    _main(
        "cost",
        "Session totals",
        "Session cost, session runtime, and line changes",
        "usage",
        (
            "cost.total_cost_usd",
            "cost.total_duration_ms",
            "cost.total_lines_added",
            "cost.total_lines_removed",
        ),
        "Total $0.12 · 12m 30s · +156/-23",
    ),
    _main(
        "session-cost",
        "Session cost",
        "Cumulative session cost in US dollars",
        "usage",
        ("cost.total_cost_usd",),
        "Cost $0.12",
    ),
    _main(
        "session-duration",
        "Session runtime",
        "Official cumulative session runtime, distinct from task duration",
        "usage",
        ("cost.total_duration_ms",),
        "Session 12m 30s",
    ),
    _main(
        "api-duration",
        "API duration",
        "Official cumulative API request duration, distinct from session and task duration",
        "usage",
        ("cost.total_api_duration_ms",),
        "API 1m 15s",
    ),
    _main(
        "lines-changed",
        "Lines changed",
        "Claude's cumulative session line additions/removals, distinct from Git working-tree changes",
        "usage",
        ("cost.total_lines_added", "cost.total_lines_removed"),
        "+156/-23",
    ),
    _main(
        "agent",
        "Agent",
        "Agent name in --agent sessions",
        "modes",
        ("agent.name",),
        "Agent reviewer",
    ),
    _main(
        "vim-mode", "Vim mode", "Current Vim mode", "modes", ("vim.mode",), "vim NORMAL"
    ),
    _agent(
        "status-elapsed",
        "Status and elapsed",
        "Task status icon combined with elapsed time",
        ("tasks.status", "tasks.startTime"),
        "● 1m 18s",
        0,
        excludes=("status", "elapsed"),
    ),
    _agent(
        "status",
        "Status",
        "Task status icon",
        ("tasks.status",),
        "●",
        excludes=("status-elapsed",),
    ),
    _agent(
        "name",
        "Agent name",
        "Agent name or normalized task type",
        ("tasks.name", "tasks.type"),
        "Explore",
        1,
    ),
    _agent(
        "model-with-effort",
        "Agent model and effort",
        "Agent model identifier with reasoning effort",
        ("tasks.model", "tasks.effort"),
        "claude-sonnet-5 high",
        2,
    ),
    _agent(
        "model",
        "Agent model",
        "Resolved agent model identifier",
        ("tasks.model",),
        "sonnet-5",
    ),
    _agent(
        "effort",
        "Agent effort",
        "Explicit configured agent effort or numeric budget; absent when inherited",
        ("tasks.effort",),
        "high",
        minimum_version="2.1.214",
    ),
    _agent(
        "context-remaining",
        "Agent context remaining",
        "Percentage of the agent context window remaining",
        ("tasks.tokenCount", "tasks.contextWindowSize"),
        "58% left",
        3,
    ),
    _agent(
        "context-used",
        "Agent context used",
        "Percentage of the agent context window used",
        ("tasks.tokenCount", "tasks.contextWindowSize"),
        "42% used",
    ),
    _agent(
        "context-tokens",
        "Agent context tokens",
        "Agent context token count versus its model's window capacity",
        ("tasks.tokenCount", "tasks.contextWindowSize"),
        "Context 84K / 200K",
    ),
    _agent(
        "context-window-size",
        "Agent context window",
        "Resolved agent model's context window capacity",
        ("tasks.contextWindowSize",),
        "200K window",
    ),
    _agent(
        "elapsed",
        "Elapsed",
        "Elapsed time for this agent task",
        ("tasks.startTime",),
        "1m 18s",
        excludes=("status-elapsed",),
    ),
    _agent(
        "task",
        "Task label",
        "Dynamic task label or description",
        ("tasks.label", "tasks.description"),
        "searching auth flow",
        4,
    ),
    _agent(
        "tokens",
        "Agent tokens",
        "Agent task token count",
        ("tasks.tokenCount",),
        "84K tokens",
    ),
    _agent(
        "current-dir",
        "Agent directory",
        "Agent working directory",
        ("tasks.cwd",),
        "/project/src",
    ),
)

BY_SCOPE = {
    scope: {item.id: item for item in ITEMS if item.scope == scope}
    for scope in ("main", "subagent")
}


def default_items(scope: str) -> tuple[str, ...]:
    return tuple(
        item.id
        for item in sorted(
            (
                item
                for item in BY_SCOPE[scope].values()
                if item.default_position is not None
            ),
            key=lambda item: item.default_position,
        )
    )


def descriptions(scope: str) -> dict[str, str]:
    return {item.id: item.description for item in BY_SCOPE[scope].values()}


def conflicts(scope: str, items: list[str]) -> bool:
    selected = set(items)
    return any(selected.intersection(BY_SCOPE[scope][item].excludes) for item in items)


def wizard_groups() -> str:
    """Build the installed skill's group list and constraints from definitions."""
    lines = []
    for scope, label in (("main", "Main"), ("subagent", "Subagents")):
        groups = dict.fromkeys(item.group for item in BY_SCOPE[scope].values())
        for group in groups:
            ids = [
                f"`{item.id}`"
                for item in BY_SCOPE[scope].values()
                if item.group == group
            ]
            lines.append(f"   - {label} / {group}: " + ", ".join(ids))
    lines.append(
        "   Use default_enabled, format_options and excludes from the live listings; do not infer defaults from this grouping."
    )
    return "\n".join(lines)
