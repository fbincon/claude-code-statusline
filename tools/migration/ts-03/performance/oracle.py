"""Test-only D06 worker importing the immutable TS-01 export, never the candidate."""
import hashlib
import json
import os
from pathlib import Path
import resource
import sys
import time

reference = Path(os.environ["TS03_REFERENCE_ROOT"])
if reference.joinpath(".reference").read_text().strip() != "9b6d2fab4bf165be280d428a874521bfbf02c7e1":
    raise RuntimeError("Wrong frozen Python reference")
sys.path.insert(0, str(reference / "src"))
path, phase, *arguments = sys.argv[1:]
data = json.loads(Path(path).read_text())
spec = data["spec"]
counts = dict(usage_calls=0, transcript_reads=0, git_calls=0)


def reset_counts():
    counts.update(usage_calls=0, transcript_reads=0, git_calls=0)


def rss():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024


if spec["operation"] in ("render", "usage", "git"):
    from claude_statusline.runtime import git, usage, transcript, paths

    collect = usage.session_token_totals
    read = transcript._read_transcript_chunk
    uncached = git._uncached_git_status

    def counted_collect(value):
        counts["usage_calls"] += 1
        return collect(value)

    def counted_read(*args):
        counts["transcript_reads"] += 1
        return read(*args)

    def counted_git(*args):
        counts["git_calls"] += 1
        return uncached(*args)

    usage.session_token_totals = counted_collect
    transcript._read_transcript_chunk = counted_read
    git._uncached_git_status = counted_git

if phase == "prepare":
    if spec["operation"] == "render":
        usage.session_token_totals(data["payload"])
        git.git_status(data["project"], "bench")
    print('{"prepared":true}')
elif spec["mode"] == "command":
    from claude_statusline.cli import main

    reset_counts()
    status = main([data["command"]])
    signature = None
    if spec["operation"] == "hook":
        files = list(Path(os.environ["CLAUDE_STATUSLINE_RUNTIME_DIR"]).joinpath("turns").glob("*.json"))
        state = json.loads(files[0].read_text())
        signature = dict(records=len(files), status=state["status"], prompt_id=state["prompt_id"])
    print(json.dumps(dict(peak_rss_bytes=rss(), counts=counts, signature=signature)), file=sys.stderr)
    raise SystemExit(status)
else:
    def prepare():
        pass

    def cleanup():
        pass

    if spec["operation"] == "usage":
        def action():
            value = usage.session_token_totals(data["payload"])
            tokens = usage.session_token_counts(value[4])
            return [*value[:3], dict(hit=tokens.hit, miss=tokens.miss, out=tokens.out, input_tokens=tokens.input_tokens)]

        state = Path(paths.STATEFILE)
        if spec["cache"] == "cold":
            def prepare():
                state.unlink(missing_ok=True)
        else:
            action()
            cache = state.read_bytes()
            history = Path(data["history"])
            size = history.stat().st_size

            def prepare():
                state.write_bytes(cache)
                if spec["cache"] == "append":
                    with history.open("a", encoding="utf-8") as stream:
                        stream.write(data["append"])

            def cleanup():
                if spec["cache"] == "append":
                    with history.open("r+b") as stream:
                        stream.truncate(size)
                    os.utime(history, ns=(1788400000000000000, 1788400000000000000))
    elif spec["operation"] == "git":
        value = git._uncached_git_status(data["project"])
        cache_path = Path(git._git_cache_path("bench"))

        def action():
            return git.git_status(data["project"], "bench")

        def prepare():
            if spec["cache"] == "miss":
                cache_path.unlink(missing_ok=True)
            else:
                git._write_git_cache("bench", data["project"], value)
                if spec["cache"] == "expired":
                    cached = json.loads(cache_path.read_text())
                    cached["checked_ns"] = 0
                    cache_path.write_text(json.dumps(cached))
    else:
        from claude_statusline.config.display import validate_display_config
        from claude_statusline.rendering import items, subagents

        config = validate_display_config(data["display"])
        if spec["operation"] == "agents":
            def action():
                return subagents.render_payload(data["payload"], config, now_ms=1788400078000)
        else:
            def action():
                return items.configured_rows(data["payload"], config, 80)

    Path(os.environ["CLAUDE_STATUSLINE_RUNTIME_DIR"]).mkdir(parents=True, exist_ok=True)
    records = []
    for index in range(int(arguments[0]) if arguments else 50):
        prepare()
        reset_counts()
        start = time.perf_counter_ns()
        result = action()
        elapsed = (time.perf_counter_ns() - start) / 1_000_000
        encoded = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        records.append(dict(ms=elapsed, peak_rss_bytes=rss(), counts=dict(counts), output_sha256=hashlib.sha256(encoded).hexdigest()))
        cleanup()
    print(json.dumps(dict(records=records, peak_rss_bytes=rss())))
