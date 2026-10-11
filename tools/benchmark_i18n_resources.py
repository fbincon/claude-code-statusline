"""Measure fixed-source wheel sizes and Linux process mapping high-water marks.

Separate from timed comparisons: builds and memory probes must not overlap them.
Linux /proc/self/status avoids a fork parent's inherited getrusage RSS floor.
Synthetic qaa–qae packs copy English and are never published.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile

from benchmark_i18n import PYTHON_PROBE, environment, export, resource_variant, summary


MAPPED_MEMORY = """
for line in Path('/proc/self/status').read_text().splitlines():
    if line.startswith(('VmHWM:', 'VmRSS:')):
        key, value, unit = line.split()
        assert unit == 'kB'
        result[{'VmHWM:':'mapped_peak_rss_kib', 'VmRSS:':'mapped_rss_kib'}[key]] = int(value)
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", default="v1.12.0")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.samples < 1 or not Path("/proc/self/status").is_file():
        parser.error("positive samples and Linux /proc are required")
    marker = "print(json.dumps(result))"
    assert PYTHON_PROBE.count(marker) == 1
    probe = PYTHON_PROBE.replace(marker, MAPPED_MEMORY + "\n" + marker)
    report = {"python": sys.version, "platform": platform.platform(),
              "samples": args.samples,
              "harness_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "variants": {}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="statusline-resource-control-") as temporary:
        root = Path(temporary)
        for name, ref, count in (("baseline-2", args.baseline, None),
                                 ("candidate-2", args.candidate, 2),
                                 ("candidate-5", args.candidate, 5),
                                 ("candidate-10", args.candidate, 10)):
            source = root / name
            sha = export(ref, source)
            if count != 5 and count is not None:
                resource_variant(source, count)
                subprocess.run([sys.executable, "tools/generate_ui_contracts.py"],
                               cwd=source, env=dict(os.environ, PYTHONPATH=str(source / "src")),
                               check=True, capture_output=True)
            config = root / (name + "-config")
            config.mkdir()
            env = environment(source, config, root / (name + "-bytecode"), True)
            subprocess.run([sys.executable, "-c",
                            "import json,sys; from pathlib import Path; "
                            "from claude_statusline.config.display import DEFAULT_CONFIG; "
                            "d=DEFAULT_CONFIG.with_updates(items=('context-remaining',),use_colors=False); "
                            "Path(sys.argv[1]).write_text(json.dumps(d.to_dict()))",
                            str(config / "claude-statusline.json")],
                           cwd=root, env=env, check=True, capture_output=True)
            row = {"commit": sha, "memory": {}}
            payload = '{"context_window":{"remaining_percentage":50},"tasks":[{"id":"demo","name":"Example","status":"running"}]}'
            for operation in ("render", "subagents", "search"):
                values = []
                for _ in range(args.samples):
                    completed = subprocess.run([sys.executable, "-c", probe, str(source), operation, "en"],
                                               input=payload, cwd=root, env=env, text=True,
                                               capture_output=True, check=True)
                    values.append(json.loads(completed.stdout))
                row["memory"][operation] = {
                    key: {**summary([value[key] for value in values]), "raw": [value[key] for value in values]}
                    for key in ("mapped_peak_rss_kib", "mapped_rss_kib", "peak_rss_kib")}
            output = root / (name + "-wheel")
            subprocess.run([sys.executable, "-m", "build", "--wheel", "--outdir", str(output), str(source)],
                           check=True, capture_output=True)
            wheel, = output.glob("*.whl")
            row.update(wheel_bytes=wheel.stat().st_size, wheel_sha256=hashlib.sha256(wheel.read_bytes()).hexdigest())
            report["variants"][name] = row
            args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(name + " complete", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
