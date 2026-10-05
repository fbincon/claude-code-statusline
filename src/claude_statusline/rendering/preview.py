"""rendering / preview implementation."""

from __future__ import annotations

from pathlib import Path
from claude_statusline.config import display as config_display
from claude_statusline.rendering import items as rendering_items
from claude_statusline.rendering import layout as rendering_layout

SAMPLE_NOW = 1_788_400_120


class _SampleRenderState(rendering_items._RenderState):
    """Render deterministic preview values without touching live session state."""

    def live_data(self):
        return {
            key: {"value": value, "partial": key == "permission-mode"}
            for key, value in {
                "run-state": "waiting agents",
                "permission-mode": "plan",
                "active-agents": 2,
                "task-progress": {"completed": 3, "total": 5},
                "last-tool": {"name": "Read", "status": "success"},
            }.items()
        }

    def totals(self):
        return "1.2M", "87.5K", "22.4K", None, {}

    def raw_totals(self):
        return rendering_items.runtime_usage.SessionTokenCounts(
            1_200_000, 87_500, 22_400
        )

    def now(self):
        return SAMPLE_NOW

    def had_subagents(self):
        return True

    def git(self):
        text = (
            f"{self.palette.branch}Git feature/statusline-tui ↑1 ~2 ?1"
            f"{self.palette.reset}"
        )
        return rendering_items._RenderedItem(text, group="repo")

    def git_data(self):
        return {
            "kind": "ok",
            "branch": "feature/statusline-tui",
            "oid": "abc1234",
            "upstream": "origin/feature/statusline-tui",
            "upstream_gone": False,
            "ahead": 1,
            "behind": 0,
            "staged": 0,
            "unstaged": 2,
            "conflicts": 0,
            "untracked": 1,
        }

    def prompt_timer(self):
        return rendering_items._RenderedItem(
            f"{self.palette.timer}✓ 1m 42s{self.palette.reset}"
        )

    def hostname(self):
        return rendering_items._RenderedItem(
            f"{self.palette.directory}Host devbox{self.palette.reset}",
            group="location",
        )


def _sample_preview_data():
    project_dir = Path.home() / "projects" / "claude-code-statusline"
    project_text = project_dir.as_posix()
    return {
        "model": {"id": "claude-opus"},
        "effort": {"level": "high"},
        "fast_mode": True,
        "thinking": {"enabled": True},
        "workspace": {
            "current_dir": f"{project_text}/src",
            "project_dir": project_text,
            "repo": {"owner": "example", "name": "claude-code-statusline"},
        },
        "pr": {"number": 42, "review_state": "approved"},
        "worktree": {"name": "statusline-tui"},
        "context_window": {
            "remaining_percentage": 73,
            "used_percentage": 27,
            "context_window_size": 200_000,
            "total_input_tokens": 54_000,
            "current_usage": {
                "input_tokens": 35_000,
                "cache_creation_input_tokens": 12_000,
                "cache_read_input_tokens": 7_000,
                "output_tokens": 2_000,
            },
        },
        "rate_limits": {
            "five_hour": {"used_percentage": 18, "resets_at": SAMPLE_NOW + 7980},
            "seven_day": {"used_percentage": 36, "resets_at": SAMPLE_NOW + 525600},
            "spend_limit": {
                "used_percentage": 9,
                "resets_at": SAMPLE_NOW + 864000,
                "used_usd": 31.50,
                "limit_usd": 350,
                "period": "monthly",
            },
        },
        "prompt_cache": {
            "hit_ratio": 0.91,
            "cache_write_tokens": 352_000,
            "warm": True,
            "caching_observed": True,
            "expires_at": SAMPLE_NOW + 260,
            "misses": 2,
            "requests": 14,
        },
        "output_style": {"name": "Default"},
        "version": "2.1.289",
        "session_name": "demo-session",
        "session_id": "demo-session",
        "cost": {
            "total_cost_usd": 0.12,
            "total_duration_ms": 750_000,
            "total_api_duration_ms": 75_000,
            "total_lines_added": 156,
            "total_lines_removed": 23,
        },
        "agent": {"name": "reviewer"},
        "vim": {"mode": "NORMAL"},
    }


def render_preview_rows(
    display_config: config_display.DisplayConfig,
    width: int,
    padding: int = 0,
) -> list[str]:
    """Render deterministic sample rows using the production layout pipeline."""
    available_width = max(rendering_layout.MIN_CONTENT_WIDTH, int(width))
    requested_padding = max(0, int(padding))
    applied_padding = min(
        requested_padding,
        max(0, available_width - rendering_layout.MIN_CONTENT_WIDTH),
    )
    rows = rendering_items.configured_rows(
        _sample_preview_data(),
        display_config,
        available_width - applied_padding,
        _SampleRenderState,
    )
    prefix = " " * applied_padding
    return [prefix + row for row in rows]
