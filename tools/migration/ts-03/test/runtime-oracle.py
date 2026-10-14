"""Test-only action replay against the immutable TS-01 Python source export."""

import copy
import json
import os
from pathlib import Path
import sys
from unittest import mock

from claude_statusline.runtime.live import durations, protocol
from claude_statusline.runtime.tasks import reducer, store


def main():
    actions = json.load(sys.stdin)
    root = Path(os.environ["CLAUDE_CONFIG_DIR"])
    root.mkdir(parents=True)
    root.joinpath("claude-statusline-runtime.json").write_text(
        '{"schema_version":2,"native_timing":true,"live_metrics":true}'
    )
    results = []
    for action in actions:
        wall = action["wall"]
        with (
            mock.patch.object(store, "now_clocks", return_value=(wall, wall, "test")),
            mock.patch("time.time", return_value=wall / 1e9),
            mock.patch("time.time_ns", return_value=wall),
        ):
            if action["kind"] == "hook":
                result = reducer.handle_event(action["payload"])
                durations.observe(action["payload"], config_dir=root)
            elif action["kind"] == "transcript":
                result = reducer.reconcile_transcript_events(
                    action["session"], action["payload"]
                )
            else:
                result = protocol.dispatch(action["payload"], root)
            results.append(copy.deepcopy(result))
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            raw = path.read_text()
            files[path.relative_to(root).as_posix()] = json.loads(raw) if raw else raw
    print(json.dumps({"results": results, "files": files}, ensure_ascii=False))


if __name__ == "__main__":
    main()
