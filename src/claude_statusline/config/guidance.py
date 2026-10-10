"""Static catalog guidance, without environment reads or live observations."""

SOURCE_KINDS = ("official_input", "local_git", "local_system", "transcript", "local_state", "lifecycle", "native_timing", "live_metrics", "telemetry")
SCOPES = ("main", "main_context", "session", "all_sessions", "task", "subagent", "subagent_context", "repository", "local", "latest_request")
REQUIREMENTS = (
    "observed_field", "subagent_rows", "agent_context", "configured_effort", "agent_effort_optional",
    "git_repository", "git_upstream", "git_base", "pull_request", "worktree_session",
    "usage_records", "task_observation", "native_timing", "complete_waits", "live_metrics",
    "owned_agents", "checklist_events", "tool_events", "complete_stream", "request_coverage",
    "existing_telemetry", "gateway", "gateway_284", "valid_window", "warm_cache",
    "fast_mode", "thinking", "agent_mode", "vim_mode", "context_observation",
)


def describe(item) -> dict:
    """Use established collectors/definitions; a condition is not a diagnosis."""
    name = item.id
    sources, scope, requirements = ["official_input"], "main", ["observed_field"]
    setup = ["claude-statusline doctor"]
    if item.scope == "subagent":
        scope = "subagent_context" if item.group == "context" else "subagent"
        requirements = ["subagent_rows", "observed_field"]
        if item.group == "context":
            requirements.append("agent_context")
        if name == "effort":
            requirements.append("configured_effort")
        elif name == "model-with-effort":
            requirements.append("agent_effort_optional")
        setup = ["claude-statusline install", "claude-statusline config set subagent-statusline on", *setup]
    elif name in ("git", "git-branch", "git-changes", "git-ahead-behind", "branch-diff"):
        sources, scope, requirements = ["local_git"], "repository", ["git_repository"]
        if name == "git-ahead-behind":
            requirements.append("git_upstream")
        if name == "branch-diff":
            requirements.append("git_base")
            setup.insert(0, "claude-statusline config set branch-diff-base <ref>")
    elif name == "hostname":
        sources, scope, requirements = ["local_system"], "local", []
    elif name in ("tokens", "input-tokens", "output-tokens"):
        sources, scope, requirements = ["transcript", "local_state"], "all_sessions", ["usage_records"]
    elif name == "task-timer":
        sources, scope, requirements = ["lifecycle", "transcript"], "task", ["task_observation"]
        setup.insert(0, "claude-statusline install")
    elif name == "task-active-timer":
        sources, scope, requirements = ["native_timing"], "task", ["native_timing", "complete_waits"]
        setup.insert(0, "claude-statusline install --native-timing")
    elif item.group in ("activity", "requests"):
        sources, scope, requirements = ["live_metrics"], "task", ["live_metrics", "task_observation"]
        setup.insert(0, "claude-statusline install --live-metrics")
        if name in ("run-state", "permission-mode"):
            sources.insert(0, "lifecycle")
        if name in ("permission-mode", "last-tool", "task-progress"):
            scope = "main"
        if name == "active-agents":
            requirements.append("owned_agents")
        if name == "task-progress":
            requirements.append("checklist_events")
        if name == "last-tool":
            requirements.append("tool_events")
        if name in ("ttft", "output-rate"):
            scope = "latest_request"
            requirements.append("complete_stream")
        if name.startswith("prompt-"):
            requirements.extend(("owned_agents", "request_coverage"))
        if name == "prompt-cost":
            sources.append("telemetry")
            requirements.append("existing_telemetry")
    else:
        if item.group == "context":
            scope = "main_context"
            requirements.append("context_observation")
        elif name in ("cost", "session-cost", "session-duration", "api-duration", "lines-changed"):
            scope = "session"
        elif item.group == "repository":
            scope = "repository"
        if item.group == "limits":
            requirements.append("valid_window")
        if name.startswith("spend-"):
            requirements.append("gateway_284" if name in ("spend-amount", "spend-period") else "gateway")
        if name == "cache-expires":
            requirements.append("warm_cache")
        for identity, requirement in (("pr", "pull_request"), ("worktree", "worktree_session"), ("fast-mode", "fast_mode"), ("thinking", "thinking"), ("agent", "agent_mode"), ("vim-mode", "vim_mode")):
            if name == identity:
                requirements.append(requirement)
    return {"source_kinds": sources, "measurement_scope": scope, "requirements": requirements, "setup": setup}
