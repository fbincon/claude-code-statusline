"""Small adapters from language-neutral cases to the frozen Python boundaries."""

from __future__ import annotations

from contextlib import ExitStack
import datetime
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest import mock


def snapshot():
    root = Path.cwd()
    result = {}
    for directory in ("config", "runtime", "sessions"):
        for path in sorted((root / directory).rglob("*")):
            if path.is_file():
                result[path.relative_to(root).as_posix()] = path.read_text(
                    encoding="utf-8"
                )
    return result


def normalize(value):
    """Only the per-case temporary root is variable; no value/key deletion."""
    if isinstance(value, str):
        return value.replace(str(Path.cwd()), "<CASE>")
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if isinstance(value, dict):
        return {normalize(k): normalize(v) for k, v in value.items()}
    return value


def run(case):
    root = Path.cwd()
    config_dir = root / "config"
    for name, raw in case.get("files", {}).items():
        relative = Path(name)
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[0] not in ("config", "runtime", "sessions")
        ):
            raise ValueError("Unsafe case fixture path")
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(raw, encoding="utf-8")
    before = snapshot()
    with ExitStack() as stack:
        # These observations are inputs, not output normalizers.
        stack.enter_context(mock.patch("time.time", return_value=2_000_000_000))
        stack.enter_context(
            mock.patch("time.time_ns", return_value=2_000_000_000_000_000_001)
        )
        if case["kind"] != "cli":
            stack.enter_context(
                mock.patch("pathlib.Path.home", return_value=Path("/ts01/home"))
            )
        value = dispatch(case, config_dir, stack)
    return normalize(
        {
            "value": value,
            "files_before": before,
            "files_after": snapshot(),
            "directories_after": [
                name
                for name in ("config", "runtime", "sessions")
                if (root / name).exists()
            ],
        }
    )


def dispatch(case, config_dir, stack):
    from claude_statusline.config import display

    kind = case["kind"]
    data = case["input"]
    if kind in ("preview", "render", "subagents"):
        from claude_statusline.rendering import items, preview, subagents

        config = display.validate_display_config(case["config"])
        if kind == "preview":
            return (
                subagents.preview_rows(config, data["width"])
                if data.get("scope") == "subagent"
                else preview.render_preview_rows(config, data["width"])
            )
        if kind == "render":
            return items.configured_rows(data["payload"], config, data["width"])
        return subagents.render_payload(data["payload"], config, now_ms=data["now_ms"])
    if kind == "cli":
        # Management commands resolve the installed backend even under -m.
        # Supply only this isolated reference launcher, never the user's PATH.
        if os.name != "nt":
            launcher = Path.cwd() / "bin/claude-statusline"
            launcher.parent.mkdir(exist_ok=True)
            launcher.write_text(
                "#!"
                + sys.executable
                + "\nfrom claude_statusline.cli import main\nraise SystemExit(main())\n",
                encoding="utf-8",
            )
            launcher.chmod(0o700)
        result = subprocess.run(
            [sys.executable, "-B", "-m", "claude_statusline", *data["argv"]],
            input=data["stdin"].encode("utf-8"),
            capture_output=True,
            timeout=30,
            check=False,
        )
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout.decode("utf-8"),
            "stderr": result.stderr.decode("utf-8"),
        }
    if kind == "ui":
        from claude_statusline.integration import capabilities
        from claude_statusline.ui import protocol

        stack.enter_context(
            mock.patch.object(
                capabilities, "detect_claude_version", return_value=(2, 1, 294)
            )
        )
        result, status = protocol.handle(
            data["raw"], config_dir, Path("/ts01/claude-statusline")
        )
        return {"response": result, "exit_code": status}
    if kind == "display":
        config, raw = display.read_display_config(config_dir)
        return {
            "effective": config.to_dict(),
            "raw": raw.decode("utf-8") if raw is not None else None,
        }
    if kind == "transaction":
        return transaction(data, config_dir, stack)
    if kind == "transfer":
        from claude_statusline.ui import protocol

        target = Path.cwd() / "portable.json"
        responses = []
        for operation, payload in (
            (
                "export",
                {"draft": data["draft"], "path": str(target), "overwrite": False},
            ),
            ("import", {"draft": data["draft"], "path": str(target)}),
            ("review_import", {"draft": data["draft"], "path": str(target)}),
        ):
            result, status = protocol.handle(
                json.dumps(
                    {"protocol_version": 11, "operation": operation, "payload": payload}
                ),
                config_dir,
                Path("/ts01/claude-statusline"),
            )
            responses.append(
                {"operation": operation, "response": result, "exit_code": status}
            )
        return {"responses": responses, "portable": target.read_text(encoding="utf-8")}
    if kind == "lifecycle":
        return lifecycle(data, stack)
    if kind == "clock":
        from claude_statusline.runtime.timing.clock import Sample, StatusTimer

        timer = StatusTimer.load(data["initial"])
        states = []
        for event in data["events"]:
            sample = Sample.load(event["sample"])
            action = event["action"]
            if action == "restore":
                timer = StatusTimer.load(json.loads(json.dumps(timer.to_dict())))
            elif action in ("pause", "resume"):
                timer = getattr(timer, action)(event["token"], sample)
            else:
                timer = getattr(timer, action)(sample)
            states.append(
                {"state": timer.to_dict(), "elapsed_ns": timer.elapsed(sample)}
            )
        return states
    if kind == "runtime":
        return runtime(data, config_dir)
    if kind == "cursor":
        return cursor(data, stack)
    raise ValueError(f"Unknown case kind: {kind}")


def transaction(data, config_dir, stack):
    from claude_statusline.config import storage
    from claude_statusline.integration import capabilities
    from claude_statusline.ui import protocol

    class FixedDateTime(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            value = cls(2033, 5, 18, 3, 33, 20, tzinfo=datetime.timezone.utc)
            return value.astimezone(tz) if tz else value.replace(tzinfo=None)

    stack.enter_context(mock.patch.object(storage.dt, "datetime", FixedDateTime))
    stack.enter_context(
        mock.patch.object(
            capabilities, "detect_claude_version", return_value=(2, 1, 294)
        )
    )
    executable = Path("/ts01/claude-statusline")

    def call(operation, payload):
        result, status = protocol.handle(
            json.dumps(
                {"protocol_version": 11, "operation": operation, "payload": payload}
            ),
            config_dir,
            executable,
        )
        return {"response": result, "exit_code": status}

    initial = call("read", {})
    revision = initial["response"]["result"]["revision"]
    first = call("apply", {"draft": data["draft"], "expected_revision": revision})
    after_first = snapshot()
    conflict = call(
        "apply",
        {
            "draft": initial["response"]["result"]["draft"],
            "expected_revision": revision,
        },
    )
    return {
        "initial": initial,
        "first_save": first,
        "stale_save": conflict,
        "after_first_save": after_first,
        "stale_save_unchanged": snapshot() == after_first,
        "reopen": call("read", {}),
    }


def lifecycle(data, stack):
    from claude_statusline.runtime.tasks import reducer, store
    from claude_statusline.rendering import timer

    states = []
    for step in data["events"]:
        sample = (step["wall_ns"], step["boot_ns"], step["boot_id"])
        with mock.patch.object(store, "now_clocks", return_value=sample):
            if step["action"] == "hook":
                reducer.handle_event(step["payload"])
            elif step["action"] == "confirm":
                reducer.confirm_completion(
                    data["session_id"], data["prompt_id"], wall_ns=step["wall_ns"]
                )
            elif step["action"] == "transcript":
                reducer.reconcile_transcript_events(
                    data["session_id"], step["observations"]
                )
            else:
                raise ValueError("Unknown lifecycle action")
            state = store.load_turn_state(data["session_id"], data["prompt_id"])
            states.append(
                {
                    "state": state,
                    "rendered": timer._render_state_timer(state, None)
                    if state
                    else None,
                }
            )
    return states


def runtime(data, config_dir):
    from claude_statusline.runtime.live import protocol

    records = []
    for raw in data["requests"]:
        input_stream = io.TextIOWrapper(
            io.BytesIO(raw.encode("utf-8")), encoding="utf-8"
        )
        output_stream = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
        with (
            mock.patch("sys.stdin", input_stream),
            mock.patch("sys.stdout", output_stream),
        ):
            status = protocol.main(type("Args", (), {"config_dir": str(config_dir)})())
            output_stream.flush()
            records.append(
                {
                    "exit_code": status,
                    "stdout": output_stream.buffer.getvalue().decode("utf-8"),
                }
            )
    return records


def cursor(data, stack):
    from claude_statusline.runtime.tasks import evidence
    from types import SimpleNamespace

    path = Path(os.environ["CLAUDE_STATUSLINE_RUNTIME_DIR"]) / "synthetic.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    results = []
    original_stat, original_resolve = Path.stat, Path.resolve
    identity, mtime = 100, 1

    def fixed_stat(self, *args, **kwargs):
        value = original_stat(self, *args, **kwargs)
        if self != path:
            return value
        fields = {
            name: getattr(value, name) for name in dir(value) if name.startswith("st_")
        }
        fields.update(st_dev=7, st_ino=identity, st_mtime_ns=mtime)
        return SimpleNamespace(**fields)

    def fixed_resolve(self, *args, **kwargs):
        return (
            Path("/ts01/synthetic.jsonl")
            if self == path
            else original_resolve(self, *args, **kwargs)
        )

    stack.enter_context(mock.patch.object(Path, "stat", fixed_stat))
    stack.enter_context(mock.patch.object(Path, "resolve", fixed_resolve))
    with mock.patch.object(
        evidence, "_read_submission_chunk", wraps=evidence._read_submission_chunk
    ) as reader:
        for step in data["steps"]:
            mtime += 1
            raw = step["text"].encode("utf-8")
            if step["action"] == "append":
                with path.open("ab") as stream:
                    stream.write(raw)
            elif step["action"] == "replace":
                identity += 1
                replacement = path.with_suffix(".new")
                replacement.write_bytes(raw)
                replacement.replace(path)
            else:
                path.write_bytes(raw)
            reader.reset_mock()
            value = evidence.submission_time(path, step["prompt_id"])
            results.append(
                {
                    "submission_ns": value,
                    "file_bytes": path.stat().st_size,
                    "read_offsets": [call.args[1] for call in reader.call_args_list],
                }
            )
    return results
