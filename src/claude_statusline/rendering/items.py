"""rendering / items implementation."""

from __future__ import annotations

import math
import socket
import time
from dataclasses import dataclass, replace
from pathlib import Path
from claude_statusline.runtime import paths as runtime_paths
from claude_statusline.config import display as config_display
from claude_statusline.rendering import formatters as rendering_formatters
from claude_statusline.rendering import layout as rendering_layout
from claude_statusline.rendering import metrics, preferences
from claude_statusline.rendering import git as rendering_git
from claude_statusline.rendering import palette as rendering_palette
from claude_statusline.runtime import git as runtime_git
from claude_statusline.i18n import statusline


def __getattr__(name):
    """Keep historical module aliases without loading unselected collectors."""
    modules = {
        "rendering_timer": "claude_statusline.rendering.timer",
        "turn_store": "claude_statusline.runtime.turns.store",
        "runtime_usage": "claude_statusline.runtime.usage",
    }
    if name not in modules:
        raise AttributeError(name)
    from importlib import import_module

    value = import_module(modules[name])
    globals()[name] = value
    return value


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
    except (TypeError, ValueError, OverflowError):
        return "0"
    if v >= 1_000_000:
        try:
            value = f"{v / 1_000_000:.2f}".rstrip("0").rstrip(".")
        except OverflowError:
            return "0"
        return value + "M"
    if v >= 1000:
        return f"{v / 1000:.1f}K"
    return str(max(0, v))


def _rate_limit_item(
    data, field, label, palette=rendering_palette.DEFAULT_PALETTE, *, now=None, fmt=None, language="en"
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
    value, suffix = (
        (round(used), "used") if fmt and fmt.allowance == "used" else (left, "left")
    )
    label_key = {"5h": "five_hour", "weekly": "weekly", "spend": "spend"}.get(label)
    label = statusline.text("limit." + label_key, language) if label_key else label
    phrase = statusline.text("limit.used" if suffix == "used" else "limit.remaining", language, label=label, value=value)
    return f"{palette.percentage}{phrase}{palette.reset}"


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
    "input-tokens": "input_tokens",
    "output-tokens": "output_tokens",
    "task-timer": "prompt_timer",
    "task-active-timer": "active_timer",
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
    "branch-diff": "branch_diff",
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
_SPEND_ITEMS = {"spend-amount", "spend-period"}
_LIVE_ITEMS = {
    "run-state",
    "permission-mode",
    "active-agents",
    "task-progress",
    "last-tool",
    "ttft",
    "output-rate",
    "prompt-input-tokens",
    "prompt-output-tokens",
    "prompt-cost",
}


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
        self._counts = _NOT_LOADED
        self._live = _NOT_LOADED
        self._now = None
        self.fmt = config.formatting
        self.language = config.statusline_language

    def text(self, key, **params):
        return statusline.text(key, self.language, **params)

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

    def live_data(self):
        if self._live is _NOT_LOADED:
            from claude_statusline.runtime.live import snapshot

            self._live = snapshot.collect(
                Path(runtime_paths.CONFIG_DIR),
                self.data.get("session_id"),
                self.data.get("prompt_id"),
                now_ms=self.now() * 1000,
            )
        return self._live

    def live_metric(self, item):
        from claude_statusline.rendering import live

        return self.styled(
            live.metric(self.live_data(), item, self.fmt, self.language),
            self.palette.percentage,
            "activity",
        )

    def branch_data(self):
        from claude_statusline.runtime import branch_diff

        return branch_diff.collect(
            _live_directory(self.data), self.config.metrics.branch_diff_base_ref
        )

    def branch_diff(self):
        value = self.branch_data()["value"]
        text = (
            self.text("diff.empty")
            if value is None
            else self.text("diff", **value)
        )
        return self.styled(text, self.palette.branch, "repo")

    def totals(self):
        if self._totals is _NOT_LOADED:
            from claude_statusline.runtime import usage as runtime_usage

            self._totals = runtime_usage.session_token_totals(self.data)
        return self._totals

    def raw_totals(self):
        if self._counts is _NOT_LOADED:
            from claude_statusline.runtime import usage as runtime_usage

            totals = self.totals()
            self._counts = (
                runtime_usage.session_token_counts(totals[4]) if totals else None
            )
        return self._counts

    def had_subagents(self):
        session_id = rendering_formatters.deep_get(self.data, ("session_id",))
        if not session_id:
            return False
        from claude_statusline.runtime.turns import store as turn_store

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
        model = preferences.model_name(metrics.model_name(self.data), self.fmt)
        if not model:
            return None
        text = f"{self.palette.model}{model}"
        effort = rendering_formatters.sanitize_payload_text(
            rendering_formatters.deep_get(self.data, ("effort", "level"))
        )
        if effort:
            text += f" {statusline.value('effort', effort, self.language)}"
        return _RenderedItem(text + self.palette.reset, group="model")

    def model(self):
        return self.styled(
            preferences.model_name(metrics.model_name(self.data), self.fmt),
            self.palette.model,
            "model",
        )

    def effort(self):
        value = rendering_formatters.deep_get(self.data, ("effort", "level"))
        return self.styled(
            statusline.value("effort", rendering_formatters.sanitize_payload_text(value), self.language),
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
            f"{self.palette.directory}{self.text('project', value=name)}{self.palette.reset}",
            group="location",
        )

    def active_timer(self):
        from claude_statusline.runtime.tasks.view import active_point

        self.totals()  # Shared collection stage; native task state stays authoritative.
        point = active_point(Path(runtime_paths.CONFIG_DIR), self.data.get("session_id"),
                             self.data.get("prompt_id"))
        if point["value"] is None:
            return None
        value = rendering_formatters.format_duration(point["value"])
        return self.styled(self.text("active", value=value), self.palette.timer)

    def hostname(self):
        try:
            value = socket.gethostname()
        except OSError:
            return None
        name = rendering_formatters.sanitize_payload_text(value)
        if not name:
            return None
        return _RenderedItem(
            f"{self.palette.directory}{self.text('host', value=name)}{self.palette.reset}",
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
        text = runtime_git._git_segment(result, self.palette, language=self.language) if result else None
        return _RenderedItem(text, group="repo") if text else None

    def git_component(self, item):
        result = self.git_data()
        text = rendering_git.component(
            result,
            item,
            language=self.language,
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
            f"{self.palette.percentage}{self.text('context.remaining', percentage=percentage)}{self.palette.reset}",
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
            f"{self.palette.percentage}{self.text('context.used', percentage=round(percentage))}"
            f"{self.palette.reset}",
            group="context",
        )

    def context_window_size(self):
        value = preferences.number(
            rendering_formatters.deep_get(
                self.data, ("context_window", "context_window_size")
            ),
            self.fmt,
        )
        if not value:
            return None
        return _RenderedItem(
            f"{self.palette.size}{self.text('context.window', value=value)}{self.palette.reset}",
            group="context",
        )

    def rate_limit(self, field, label):
        text = _rate_limit_item(
            self.data, field, label, self.palette, now=self.now(), fmt=self.fmt, language=self.language
        )
        return _RenderedItem(text, group="limits") if text else None

    def rate_reset(self, field, label):
        window = metrics.live_rate_window(self.data, field, self.now())
        value = (
            preferences.reset_time(
                window.get("resets_at"), self.now(), self.fmt, metrics.countdown
            )
            if window
            else None
        )
        return self.styled(
            self.text("reset", label=self.text("limit.five_hour" if label == "5h" else "limit.weekly"), value=value) if value else None,
            self.palette.percentage,
            "limits",
        )

    def context_tokens(self):
        text = metrics.context_tokens(
            rendering_formatters.deep_get(self.data, ("context_window",)), self.fmt, self.language
        )
        return self.styled(text, self.palette.percentage, "context")

    def session_metric(self, item):
        text = metrics.session_metric(
            rendering_formatters.deep_get(self.data, ("cost",)), item, self.fmt, self.language
        )
        return self.styled(text, self.palette.percentage, "usage")

    def tokens(self):
        totals = self.totals()
        if not totals:
            return None
        thit, tmiss, tout, _last_pt, _entry = totals
        if self.fmt.number_format != "legacy":
            counts = self.raw_totals()
            if counts is not None:
                thit = preferences.number(counts.hit, self.fmt)
                tmiss = preferences.number(counts.miss, self.fmt)
                tout = preferences.number(counts.out, self.fmt)
        parts = [
            f"{self.palette.tokens}{self.text('tokens.' + label, value=value)}{self.palette.reset}"
            for label, value in (("hit", thit), ("miss", tmiss), ("out", tout))
            if value is not None
        ]
        return (
            _RenderedItem(self.inner_separator.join(parts), group="usage")
            if parts
            else None
        )

    def input_tokens(self):
        counts = self.raw_totals()
        value = counts.input_tokens if counts is not None else None
        if metrics.token_count(value) is None:
            return None
        return self.styled(
            self.text("tokens.in", value=preferences.number(value, self.fmt, humanize_api_tokens)),
            self.palette.tokens,
            "usage",
        )

    def output_tokens(self):
        counts = self.raw_totals()
        value = counts.out if counts is not None else None
        if metrics.token_count(value) is None:
            return None
        return self.styled(
            self.text("tokens.out", value=preferences.number(value, self.fmt, humanize_api_tokens)),
            self.palette.tokens,
            "usage",
        )

    def spend_metric(self, item):
        window = metrics.live_rate_window(self.data, "spend_limit", self.now())
        return self.styled(
            metrics.spend_metric(window, item, self.fmt, self.language),
            self.palette.percentage,
            "limits",
        )

    def prompt_timer(self):
        totals = self.totals()
        if not totals:
            return None
        from claude_statusline.rendering import timer as rendering_timer

        _thit, _tmiss, _tout, last_pt, entry = totals
        text = rendering_timer._timer_segment(
            rendering_formatters.deep_get(self.data, ("session_id",)),
            rendering_formatters.deep_get(self.data, ("prompt_id",)),
            last_pt,
            entry,
            self.palette,
            language=self.language,
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
        return _RenderedItem(f"{self.palette.model}{self.text('session', value=text)}{self.palette.reset}")

    def session_name(self):
        value = rendering_formatters.sanitize_payload_text(
            self.data.get("session_name")
        )
        return self.styled(self.text("session", value=value) if value else None, self.palette.model)

    def session_id(self, short=False):
        value = rendering_formatters.sanitize_payload_text(self.data.get("session_id"))
        return self.styled(
            self.text("session.id", value=value[:8] if short else value) if value else None, self.palette.model
        )

    def session_id_short(self):
        return self.session_id(short=True)

    def output_style(self):
        value = rendering_formatters.sanitize_payload_text(
            rendering_formatters.deep_get(self.data, ("output_style", "name"))
        )
        return self.styled(self.text("style", value=value) if value else None, self.palette.model)

    def cache_metric(self, item):
        text = metrics.cache_metric(
            self.data.get("prompt_cache"), item, self.now(), self.fmt, self.language
        )
        return self.styled(text, self.palette.tokens, "usage")

    def cost(self):
        from claude_statusline.rendering import timer as rendering_timer
        from claude_statusline.runtime import usage as runtime_usage

        cost = rendering_formatters.deep_get(self.data, ("cost",))
        if not isinstance(cost, dict):
            return None
        usd = cost.get("total_cost_usd")
        if isinstance(usd, bool) or not isinstance(usd, (int, float)):
            return None
        usd = float(usd)
        if not math.isfinite(usd):
            return None
        parts = [
            f"{self.palette.percentage}{self.text('cost.total', value=preferences.money(usd, self.fmt))}{self.palette.reset}"
        ]
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
                f"{self.palette.tokens}{self.text('cache.ratio', percentage=round(ratio * 100))}{self.palette.reset}"
            )
        written = preferences.number(cache.get("cache_write_tokens"), self.fmt)
        if written and written != "0":
            parts.append(f"{self.palette.tokens}{self.text('cache.write', value=written)}{self.palette.reset}")
        if not parts:
            return None
        return _RenderedItem(self.inner_separator.join(parts), group="usage")

    def fast_mode(self):
        if not rendering_formatters.deep_get(self.data, ("fast_mode",)):
            return None
        return _RenderedItem(
            f"{self.palette.model}{self.text('fast')}{self.palette.reset}", group="model"
        )

    def agent(self):
        name = rendering_formatters.deep_get(self.data, ("agent", "name"))
        if not isinstance(name, str) or not name:
            return None
        return _RenderedItem(f"{self.palette.timer}{self.text('agent', value=name)}{self.palette.reset}")

    def vim_mode(self):
        mode = rendering_formatters.deep_get(self.data, ("vim", "mode"))
        if not isinstance(mode, str) or not mode:
            return None
        return _RenderedItem(f"{self.palette.timer}vim {mode}{self.palette.reset}")

    def thinking(self):
        if not rendering_formatters.deep_get(self.data, ("thinking", "enabled")):
            return None
        return _RenderedItem(
            f"{self.palette.model}{self.text('thinking')}{self.palette.reset}", group="model"
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
            text += self.inner_separator + statusline.value("review", state, self.language)
        return _RenderedItem(text + self.palette.reset, group="repo")

    def worktree(self):
        name = rendering_formatters.deep_get(self.data, ("worktree", "name"))
        if not isinstance(name, str) or not name:
            return None
        return _RenderedItem(
            f"{self.palette.branch}{self.text('worktree', value=name)}{self.palette.reset}"
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
            f"{self.palette.branch}{self.text('repo', value=owner + '/' + name)}{self.palette.reset}",
            group="repo",
        )

    def render(self, item_id):
        self.fmt, options = preferences.options_for(self.config, item_id)
        used = None
        if options.visibility != "always" or self.fmt.thresholds.enabled:
            from . import visibility

            used = visibility.used_percentage(self.data, item_id, self.now() if item_id in _RATE_LIMIT_ITEMS else None)
            if not visibility.visible(
                options, item_id, used=used,
                git=self.git_data() if options.visibility == "git-dirty" else None,
                point=self.live_data().get(item_id) if options.visibility == "nonzero" else None,
            ):
                return None
        item = self._render(item_id)
        if item is None:
            return None
        text = item.text
        text = preferences.threshold(
            text, used, self.fmt, self.config, self.palette.percentage
        )
        text = preferences.decorate(text, item_id, "main", self.fmt, options, language=self.language)
        if self.config.theme != "classic" or self.config.separator_style == "powerline" or options.foreground is not None or options.background is not None:
            from . import appearance

            text = appearance.apply(text, self.config, item_id, options, used=used)
        if options.max_width is not None:
            text = rendering_layout.truncate_styled(text, options.max_width)
        return replace(item, text=text)

    def _render(self, item_id):
        if item_id in _LIVE_ITEMS:
            return self.live_metric(item_id)
        if item_id in _SPEND_ITEMS:
            return self.spend_metric(item_id)
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
            _RenderedItem(f"{palette.timer}{statusline.text('scope.main', config.statusline_language)}{palette.reset}"),
        )
    return (
        _coalesce_items(rendered, inner_separator),
        outer_separator,
        palette.reset,
    )


def configured_rows(data, config, width, state_class=_RenderState):
    """One production/preview pipeline; explicit rows never acquire continuations."""
    if config.separator_style == "powerline":
        return _powerline_rows(data, config, width, state_class)
    if config.layout.mode == "auto":
        segments, separator, reset = _configured_segments_with_state(
            data, config, state_class
        )
        return rendering_layout._layout_segments(
            segments, width, separator=separator, reset=reset
        )
    width = max(2, width)
    palette = rendering_palette._palette_for(config)
    outer, inner = rendering_palette._separators(config, palette)
    state = state_class(data, config, palette, inner)
    scope_label = config.scope_labels == "always" or (
        config.scope_labels == "when-subagents" and state.had_subagents()
    )
    rows = []
    for row in config.layout.rows:
        selected = [(i, state.render(i)) for i in row]
        selected = [
            (i, rendered) for i, rendered in selected if rendered and rendered.text
        ]
        if not selected:
            continue
        if scope_label and not rows:
            selected.insert(
                0, (None, _RenderedItem(f"{palette.timer}{statusline.text('scope.main', config.statusline_language)}{palette.reset}"))
            )

        def join():
            segments = _coalesce_items([item for _, item in selected], inner)
            return outer.join(segment.text for segment in segments)

        text = join()
        while len(selected) > 1 and rendering_layout._display_width(text) > width:
            index = min(
                range(len(selected)),
                key=lambda n: (
                    -1  # The scope decoration must not displace the last real item.
                    if selected[n][0] is None
                    else preferences.options_for(config, selected[n][0])[1].priority,
                    -n,
                ),
            )
            del selected[index]
            text = join()
        rows.append(
            rendering_layout._ensure_reset(
                rendering_layout.truncate_styled(text, width), palette.reset
            )
        )
    return rows


def _powerline_rows(data, config, width, state_class):
    from . import powerline, appearance
    from claude_statusline.config.formatting import ItemOptions

    palette = rendering_palette._palette_for(config)
    _, inner = rendering_palette._separators(config, palette)
    state = state_class(data, config, palette, inner)
    scope = config.scope_labels == "always" or (
        config.scope_labels == "when-subagents" and state.had_subagents()
    )
    rows = []
    configured = (config.items,) if config.layout.mode == "auto" else config.layout.rows
    for identifiers in configured:
        blocks = []
        for item_id in identifiers:
            rendered = state.render(item_id)
            if rendered and rendered.text:
                options = preferences.options_for(config, item_id)[1]
                blocks.append(powerline.Block(rendered.text, options.priority, rendered.prefer_slash_breaks))
        if not blocks:
            continue
        if scope and not rows:
            label = appearance.apply(statusline.text("scope.main", config.statusline_language), config, None, ItemOptions())
            blocks.insert(0, powerline.Block(label, -1))
        rows.extend(powerline.wrap(blocks, width, config) if config.layout.mode == "auto" else [powerline.fit(blocks, max(2, width), config)])
    return rows
