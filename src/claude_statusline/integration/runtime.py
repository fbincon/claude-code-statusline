"""Independent live-metrics Mod, using the shared owned-plugin installer."""

from dataclasses import replace

from claude_statusline.integration import native
from claude_statusline.integration.mods import RUNTIME
from claude_statusline.integration.models import Diagnostic
from claude_statusline.runtime.live import model, store
import time


def _message(message):
    for before, after in (
        ("Native editor", "Live metrics"),
        ("native editor", "live metrics"),
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
    for target in store.root(config_dir).glob("*.json"):
        try:
            import json

            session = json.loads(target.read_bytes()).get("session_id")
            state = (
                store.load(config_dir, session) if isinstance(session, str) else None
            )
            active += int(store.fresh(state, time.time() * 1000))
        except (OSError, ValueError, TypeError):
            continue
    rows.append(
        Diagnostic(
            "OK" if active or not RUNTIME.requested(config_dir) else "WARN",
            f"runtime collector heartbeats: {active} fresh session(s); stale after {model.STALE_MS // 1000}s. Installation alone does not verify session loading.",
        )
    )
    return rows
