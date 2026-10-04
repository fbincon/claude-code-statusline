"""rendering / items implementation."""

from __future__ import annotations

import math
import socket
import time
from dataclasses import dataclass
from pathlib import Path
from claude_statusline.config import display as config_display
from claude_statusline.rendering import formatters as rendering_formatters
from claude_statusline.rendering import layout as rendering_layout
from claude_statusline.rendering import metrics
from claude_statusline.rendering import git as rendering_git
from claude_statusline.rendering import palette as rendering_palette
from claude_statusline.rendering import timer as rendering_timer
from claude_statusline.runtime import git as runtime_git
from claude_statusline.runtime.turns import store as turn_store
from claude_statusline.runtime import usage as runtime_usage


def _live_directory(data):
    candidates = (
        rendering_formatters.deep_get(data, ("workspace", "current_dir")),
        rendering_formatters.deep_get(data, ("cwd",)),
        rendering_formatters.deep_get(data, ("worktree", "path")),
        rendering_formatters.deep_get(data, ("workspace", "project_dir")),
    )
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate
    return None


def humanize_api_tokens(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return "0"
    if v >= 1_000_000:
        value = f"{v / 1_000_000:.2f}".rstrip("0").rstrip(".")
        return value + "M"
    if v >= 1000:
        return f"{v / 1000:.1f}K"
    return str(max(0, v))


def _rate_limit_item(
    data, field, label, palette=rendering_palette.DEFAULT_PALETTE, *, now=None
):
    window = metrics.live_rate_window(data, field, now)
    if window is None:
        return None
    used = window.get("used_percentage")
    if isinstance(used, bool) or not isinstance(used, (int, float)):
        return None
    if (isinstance(used, float) and not math.isfinite(used)) or used < 0:
        return None
    left = 0 if used >= 100 else round(100 - used)
    return f"{palette.percentage}{label} {left}% left{palette.reset}"


def _rate_limit_segment(data, palette=rendering_palette.DEFAULT_PALETTE):
    """Render whichever Claude Code rate-limit windows are present."""
    now = time.time()
    parts = [
        _rate_limit_item(data, field, label, palette, now=now)
        for field, label in (
            ("five_hour", "5h"),
            ("seven_day", "weekly"),
            ("spend_limit", "spend"),
        )
    ]
    joiner = rendering_palette._styled_separator("·", palette)
    return joiner.join(part for part in parts if part) or None


@dataclass(frozen=True)
class _RenderedItem:
    text: str
    group: str | None = None
    prefer_slash_breaks: bool = False


_NOT_LOADED = object()


_ITEM_METHODS = {
    "model-with-effort": "model_with_effort",
    "model": "model",
    "effort": "effort",
    "current-dir": "current_dir",
    "project-name": "project_name",
    "hostname": "hostname",
    "git": "git",
    "context-remaining": "context_remaining",
    "context-used": "context_used",
    "context-window-size": "context_window_size",
    "context-tokens": "context_tokens",
    "tokens": "tokens",
    "prompt-timer": "prompt_timer",
    "version": "version",
    "session": "session",
    "session-name": "session_name",
    "session-id": "session_id",
    "session-id-short": "session_id_short",
    "output-style": "output_style",
    "cost": "cost",
    "prompt-cache": "prompt_cache",
    "fast-mode": "fast_mode",
    "agent": "agent",
    "vim-mode": "vim_mode",
    "thinking": "thinking",
    "pr": "pr",
    "worktree": "worktree",
    "repo": "repo",
}


_RATE_LIMIT_ITEMS = {
    "five-hour-limit": ("five_hour", "5h"),
    "weekly-limit": ("seven_day", "weekly"),
    "spend-limit": ("spend_limit", "spend"),
}

_RESET_ITEMS = {
    "five-hour-reset": ("five_hour", "5h"),
    "weekly-reset": ("seven_day", "weekly"),
}

_SESSION_METRICS = {"session-cost", "session-duration", "api-duration", "lines-changed"}
_CACHE_ITEMS = {"cache-state", "cache-expires", "cache-misses", "api-requests"}
_GIT_ITEMS = {"git-branch", "git-changes", "git-ahead-behind"}


class _RenderState:
    """Lazily resolve only the data sources selected by the user."""

    def __init__(self, data, config, palette, inner_separator):
        self.data = data
        self.config = config
        self.palette = palette
        self.inner_separator = inner_separator
        self.live_dir = _live_directory(data)
        self._git = _NOT_LOADED
        self._totals = _NOT_LOADED
        self._now = None

    def now(self):
        if self._now is None:
            self._now = time.time()
        return self._now

    def styled(self, text, style, group=None):
        return (
            _RenderedItem(f"{style}{text}{self.palette.reset}", group=group)
            if text
            else None
        )

    def totals(self):
        if self._totals is _NOT_LOADED:
            self._totals = runtime_usage.session_token_totals(self.data)
        return self._totals

    def had_subagents(self):
        session_id = rendering_formatters.deep_get(self.data, ("session_id",))
        if not session_id:
            return False
        prompt_id = rendering_formatters.deep_get(self.data, ("prompt_id",))
        record = (
            turn_store.load_turn_state(str(session_id), str(prompt_id))
            if prompt_id
            else None
        )
        if not isinstance(record, dict):
            record = turn_store.load_turn_state(str(session_id))
        return bool(isinstance(record, dict) and record.get("had_subagents"))

    def model_with_effort(self):
        model = metrics.model_name(self.data)
        if not model:
            return None
        text = f"{self.palette.model}{model}"
        effort = rendering_formatters.sanitize_payload_text(
            rendering_formatters.deep_get(self.data, ("effort", "level"))
        )
        if effort:
            text += f" {effort}"
        return _RenderedItem(text + self.palette.reset, group="model")

    def model(self):
        return self.styled(metrics.model_name(self.data), self.palette.model, "model")

    def effort(self):
        value = rendering_formatters.deep_get(self.data, ("effort", "level"))
        return self.styled(
            rendering_formatters.sanitize_payload_text(value),
            self.palette.model,
            "model",
        )

    def current_dir(self):
        if not self.live_dir:
            return None
        project_dir = rendering_formatters.deep_get(
            self.data, ("workspace", "project_dir")
        )
        if not isinstance(project_dir, str):
            project_dir = None
        value = config_display.format_directory(
            self.live_dir,
            self.config.directory_style,
            project_dir=project_dir,
        )
        return _RenderedItem(
            f"{self.palette.directory}{value}{self.palette.reset}",
            group="location",
            prefer_slash_breaks=True,
        )

    def project_name(self):
        value = rendering_formatters.deep_get(self.data, ("workspace", "project_dir"))
        if not isinstance(value, str) or not value:
            return None
        name = rendering_formatters.sanitize_payload_text(Path(value).name)
        if not name:
            return None
        return _RenderedItem(
            f"{self.palette.directory}Project {name}{self.palette.reset}",
            group="location",
        )

    def hostname(self):
        try:
            value = socket.gethostname()
        except OSError:
            return None
        name = rendering_formatters.sanitize_payload_text(value)
        if not name:
            return None
        return _RenderedItem(
            f"{self.palette.directory}Host {name}{self.palette.reset}",
            group="location",
        )

    def git_data(self):
        if not self.live_dir:
            return None
        if self._git is _NOT_LOADED:
            self._git = runtime_git.git_status(
                self.live_dir, rendering_formatters.deep_get(self.data, ("session_id",))
            )
        return self._git

    def git(self):
        result = self.git_data()
        text = runtime_git._git_segment(result, self.palette) if result else None
        return _RenderedItem(text, group="repo") if text else None

    def git_component(self, item):
        result = self.git_data()
        text = rendering_git.component(
            result,
            item,
            compact_staged=runtime_git.platform_environment.is_windows()
            or runtime_git.platform_environment.is_wsl(),
        )
        style = (
            self.palette.git_error
            if result and result.get("kind") == "error"
            else self.palette.branch
        )
        return self.styled(text, style, "repo")

    def context_remaining(self):
        value = rendering_formatters.deep_get(
            self.data, ("context_window", "remaining_percentage")
        )
        if value is None:
            return None
        try:
            percentage = round(float(value))
        except (TypeError, ValueError):
            return None
        return _RenderedItem(
            f"{self.palette.percentage}Context {percentage}% left{self.palette.reset}",
            group="context",
        )

    def context_used(self):
        value = rendering_formatters.deep_get(
            self.data, ("context_window", "used_percentage")
        )
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        try:
            percentage = float(value)
        except OverflowError:
            return None
        if not math.isfinite(percentage) or not 0 <= percentage <= 100:
            return None
        return _RenderedItem(
            f"{self.palette.percentage}Context {round(percentage)}% used"
            f"{self.palette.reset}",
            group="context",
        )

    def context_window_size(self):
        value = rendering_formatters.humanize_tokens(
            rendering_formatters.deep_get(
                self.data, ("context_window", "context_window_size")
            )
        )
        if not value:
            return None
        return _RenderedItem(
            f"{self.palette.size}{value} window{self.palette.reset}",
            group="context",
        )

    def rate_limit(self, field, label):
        text = _rate_limit_item(self.data, field, label, self.palette, now=self.now())
        return _RenderedItem(text, group="limits") if text else None

    def rate_reset(self, field, label):
        window = metrics.live_rate_window(self.data, field, self.now())
        value = (
            metrics.countdown(window.get("resets_at"), self.now()) if window else None
        )
        return self.styled(
            f"{label} reset {value}" if value else None,
            self.palette.percentage,
            "limits",
        )

    def context_tokens(self):
        text = metrics.context_tokens(
            rendering_formatters.deep_get(self.data, ("context_window",))
        )
        return self.styled(text, self.palette.percentage, "context")

    def session_metric(self, item):
        text = metrics.session_metric(
            rendering_formatters.deep_get(self.data, ("cost",)), item
        )
        return self.styled(text, self.palette.percentage, "usage")

    def tokens(self):
        totals = self.totals()
        if not totals:
            return None
        thit, tmiss, tout, _last_pt, _entry = totals
        parts = [
            f"{self.palette.tokens}hit {thit}{self.palette.reset}",
            f"{self.palette.tokens}miss {tmiss}{self.palette.reset}",
            f"{self.palette.tokens}out {tout}{self.palette.reset}",
        ]
        return _RenderedItem(self.inner_separator.join(parts), group="usage")

    def prompt_timer(self):
        totals = self.totals()
        if not totals:
            return None
        _thit, _tmiss, _tout, last_pt, entry = totals
        text = rendering_timer._timer_segment(
            rendering_formatters.deep_get(self.data, ("session_id",)),
            rendering_formatters.deep_get(self.data, ("prompt_id",)),
            last_pt,
            entry,
            self.palette,
        )
        return _RenderedItem(text) if text else None

    def version(self):
        value = rendering_formatters.deep_get(self.data, ("version",))
        if not isinstance(value, str) or not value:
            return None
        return _RenderedItem(f"{self.palette.model}v{value}{self.palette.reset}")

    def session(self):
        name = rendering_formatters.sanitize_payload_text(
            rendering_formatters.deep_get(self.data, ("session_name",))
        )
        if name:
            text = name
        else:
            sid = rendering_formatters.sanitize_payload_text(
                rendering_formatters.deep_get(self.data, ("session_id",))
            )
            if not sid:
                return None
            text = sid[:8]
        return _RenderedItem(f"{self.palette.model}Session {text}{self.palette.reset}")

    def session_name(self):
        value = rendering_formatters.sanitize_payload_text(
            self.data.get("session_name")
        )
        return self.styled(f"Session {value}" if value else None, self.palette.model)

    def session_id(self, short=False):
        value = rendering_formatters.sanitize_payload_text(self.data.get("session_id"))
        return self.styled(
            f"ID {value[:8] if short else value}" if value else None, self.palette.model
        )

    def session_id_short(self):
        return self.session_id(short=True)

    def output_style(self):
        value = rendering_formatters.sanitize_payload_text(
            rendering_formatters.deep_get(self.data, ("output_style", "name"))
        )
        return self.styled(f"Style {value}" if value else None, self.palette.model)

    def cache_metric(self, item):
        text = metrics.cache_metric(self.data.get("prompt_cache"), item, self.now())
        return self.styled(text, self.palette.tokens, "usage")

    def cost(self):
        cost = rendering_formatters.deep_get(self.data, ("cost",))
        if not isinstance(cost, dict):
            return None
        usd = cost.get("total_cost_usd")
        if isinstance(usd, bool) or not isinstance(usd, (int, float)):
            return None
        usd = float(usd)
        if not math.isfinite(usd):
            return None
        parts = [f"{self.palette.percentage}Total ${usd:.2f}{self.palette.reset}"]
        duration_ms = cost.get("total_duration_ms")
        if (
            not isinstance(duration_ms, bool)
            and isinstance(duration_ms, (int, float))
            and duration_ms > 0
        ):
            duration = rendering_timer._fmt_duration(float(duration_ms) / 1000.0)
            if duration:
                parts.append(f"{self.palette.percentage}{duration}{self.palette.reset}")
        added = runtime_usage._usage_int(cost.get("total_lines_added"))
        removed = runtime_usage._usage_int(cost.get("total_lines_removed"))
        if added or removed:
            parts.append(
                f"{self.palette.percentage}+{added}/-{removed}{self.palette.reset}"
            )
        return _RenderedItem(self.inner_separator.join(parts))

    def prompt_cache(self):
        cache = rendering_formatters.deep_get(self.data, ("prompt_cache",))
        if not isinstance(cache, dict):
            return None
        parts = []
        ratio = cache.get("hit_ratio")
        if (
            not isinstance(ratio, bool)
            and isinstance(ratio, (int, float))
            and math.isfinite(ratio)
            and 0 <= ratio <= 1
        ):
            parts.append(
                f"{self.palette.tokens}cache {round(ratio * 100)}%{self.palette.reset}"
            )
        written = rendering_formatters.humanize_tokens(cache.get("cache_write_tokens"))
        if written and written != "0":
            parts.append(f"{self.palette.tokens}{written} w{self.palette.reset}")
        if not parts:
            return None
        return _RenderedItem(self.inner_separator.join(parts), group="usage")

    def fast_mode(self):
        if not rendering_formatters.deep_get(self.data, ("fast_mode",)):
            return None
        return _RenderedItem(
            f"{self.palette.model}fast{self.palette.reset}", group="model"
        )

    def agent(self):
        name = rendering_formatters.deep_get(self.data, ("agent", "name"))
        if not isinstance(name, str) or not name:
            return None
        return _RenderedItem(f"{self.palette.timer}Agent {name}{self.palette.reset}")

    def vim_mode(self):
        mode = rendering_formatters.deep_get(self.data, ("vim", "mode"))
        if not isinstance(mode, str) or not mode:
            return None
        return _RenderedItem(f"{self.palette.timer}vim {mode}{self.palette.reset}")

    def thinking(self):
        if not rendering_formatters.deep_get(self.data, ("thinking", "enabled")):
            return None
        return _RenderedItem(
            f"{self.palette.model}thinking{self.palette.reset}", group="model"
        )

    def pr(self):
        pr = rendering_formatters.deep_get(self.data, ("pr",))
        if not isinstance(pr, dict):
            return None
        number = pr.get("number")
        if (
            isinstance(number, bool)
            or not isinstance(number, (int, str))
            or (isinstance(number, str) and not number)
        ):
            return None
        prefix = "MR !" if pr.get("kind") == "mr" else "PR #"
        text = f"{self.palette.branch}{prefix}{number}"
        state = pr.get("review_state")
        if isinstance(state, str) and state:
            text += self.inner_separator + state
        return _RenderedItem(text + self.palette.reset, group="repo")

    def worktree(self):
        name = rendering_formatters.deep_get(self.data, ("worktree", "name"))
        if not isinstance(name, str) or not name:
            return None
        return _RenderedItem(
            f"{self.palette.branch}Worktree {name}{self.palette.reset}"
        )

    def repo(self):
        repo = rendering_formatters.deep_get(self.data, ("workspace", "repo"))
        if not isinstance(repo, dict):
            return None
        owner = repo.get("owner")
        name = repo.get("name")
        if (
            not isinstance(owner, str)
            or not owner
            or not isinstance(name, str)
            or not name
        ):
            return None
        return _RenderedItem(
            f"{self.palette.branch}Repo {owner}/{name}{self.palette.reset}",
            group="repo",
        )

    def render(self, item_id):
        if item_id in _CACHE_ITEMS:
            return self.cache_metric(item_id)
        if item_id in _GIT_ITEMS:
            return self.git_component(item_id)
        if item_id in _SESSION_METRICS:
            return self.session_metric(item_id)
        reset = _RESET_ITEMS.get(item_id)
        if reset is not None:
            return self.rate_reset(*reset)
        rate_limit = _RATE_LIMIT_ITEMS.get(item_id)
        if rate_limit is not None:
            return self.rate_limit(*rate_limit)
        return getattr(self, _ITEM_METHODS[item_id])()


def _coalesce_items(items, inner_separator):
    segments = []
    current_text = None
    current_group = None
    current_prefer_slashes = False

    def flush():
        nonlocal current_text, current_group, current_prefer_slashes
        if current_text is not None:
            segments.append(
                rendering_layout._LayoutSegment(current_text, current_prefer_slashes)
            )
        current_text = None
        current_group = None
        current_prefer_slashes = False

    for item in items:
        if current_text is not None and item.group and item.group == current_group:
            current_text += inner_separator + item.text
            continue
        flush()
        current_text = item.text
        current_group = item.group
        current_prefer_slashes = item.prefer_slash_breaks
    flush()
    return segments


def _configured_segments(data, config):
    return _configured_segments_with_state(data, config, _RenderState)


def _configured_segments_with_state(data, config, state_class):
    palette = rendering_palette._palette_for(config)
    outer_separator, inner_separator = rendering_palette._separators(config, palette)
    state = state_class(data, config, palette, inner_separator)
    rendered = []
    for item_id in config.items:
        item = state.render(item_id)
        if item is not None and item.text:
            rendered.append(item)
    if rendered and (
        config.scope_labels == "always"
        or (config.scope_labels == "when-subagents" and state.had_subagents())
    ):
        rendered.insert(
            0,
            _RenderedItem(f"{palette.timer}Main/Session{palette.reset}"),
        )
    return (
        _coalesce_items(rendered, inner_separator),
        outer_separator,
        palette.reset,
    )
