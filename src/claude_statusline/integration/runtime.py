"""Native task timing and advanced observations, using the shared owned-plugin installer."""

from dataclasses import replace

from claude_statusline.integration import native
from claude_statusline.integration.mods import RUNTIME
from claude_statusline.integration.models import Diagnostic
from claude_statusline.runtime.live import model, store
import time


def _message(message):
    for before, after in (
        ("Native editor", "Runtime collection"),
        ("native editor", "runtime collection"),
        ("native Mod", "runtime Mod"),
        ("Native resource", "Runtime resource"),
        ("native plugin", "runtime plugin"),
        ("Native plugin", "Runtime plugin"),
        ("native resources", "runtime resources"),
        ("native marketplace", "runtime marketplace"),
        ("native backend", "runtime backend"),
        ("native session", "runtime session"),
        ("native loading", "runtime loading"),
        ("install --native-editor", "install --live-metrics"),
        ("2.1.287+", "2.1.289+"),
    ):
        message = message.replace(before, after)
    return message


def integrate(config_dir, executable, requested, version, *, uninstall=False):
    result = native.integrate(
        config_dir, executable, requested, version, uninstall=uninstall, spec=RUNTIME
    )
    return replace(
        result, messages=tuple(_message(message) for message in result.messages)
    )


def diagnostics(config_dir, executable, version):
    rows = [
        Diagnostic(row.level, _message(row.message))
        for row in native.diagnostics(config_dir, executable, version, spec=RUNTIME)
    ]
    active = 0
    latest = None
    for target in store.root(config_dir).glob("*.json"):
        try:
            import json

            session = json.loads(target.read_bytes()).get("session_id")
            state = (
                store.load(config_dir, session) if isinstance(session, str) else None
            )
            active += int(store.fresh(state, time.time() * 1000))
            if state and (
                latest is None
                or (state["heartbeat_at_ms"] or 0) > (latest["heartbeat_at_ms"] or 0)
            ):
                latest = state
        except (OSError, ValueError, TypeError):
            continue
    rows.append(
        Diagnostic(
            "OK" if active or not RUNTIME.requested(config_dir) else "WARN",
            f"runtime collector heartbeats: {active} fresh session(s); stale after {model.STALE_MS // 1000}s. Installation alone does not verify session loading.",
        )
    )
    if latest is not None:
        from claude_statusline.runtime.live import snapshot

        from claude_statusline.config import runtime as preferences
        from claude_statusline.runtime.tasks.view import active_point

        modes = preferences.load(config_dir)
        points = snapshot.resolve(
            latest, config_dir, latest["session_id"], enabled=modes.live_metrics
        )
        points["task-active-timer"] = active_point(config_dir, latest["session_id"])
        if not modes.live_metrics:
            points = {"task-active-timer": points["task-active-timer"]}
        sources = sorted(
            {
                row["source"]
                for row in points.values()
                if row["source"] and row["value"] is not None
            }
        )
        missing = [
            f"{item}:{row['reason']}"
            for item, row in points.items()
            if row["value"] is None
        ]
        partial = [item for item, row in points.items() if row["partial"]]
        rows.append(
            Diagnostic(
                "WARN" if missing or partial else "OK",
                f"runtime sources on host {latest['host_version']}: {', '.join(sources) or 'none'}; unavailable: {', '.join(missing) or 'none'}; partial: {', '.join(partial) or 'none'}",
            )
        )
    return rows
