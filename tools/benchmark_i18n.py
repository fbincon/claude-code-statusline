"""Compare fixed Git sources and temporary 2/5/10-language resource variants.

All probes are local and use isolated configuration and fixed input. Cold/warm
refer to Python bytecode, not the OS filesystem cache. Node measures the native
translation/search modules, not the Claude host's complete Client startup.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]

PYTHON_PROBE = r"""
import contextlib, hashlib, io, json, sys, time
from pathlib import Path
root, operation, language = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
import claude_statusline
assert Path(claude_statusline.__file__).resolve().is_relative_to(root), claude_statusline.__file__
result = {}
if operation == 'search':
    from claude_statusline.config import display, models
    from claude_statusline.ui.editor import EditorState
    from claude_statusline.ui import search
    started = time.perf_counter_ns()
    state = EditorState.from_effective(models.EffectiveConfig(display.DEFAULT_CONFIG, models.DEFAULT_HOST_CONFIG, True, root/'fixture.json'))
    result['prepare_ms'] = (time.perf_counter_ns()-started)/1e6
    queries = ['context', 'remaining', '剩余', '剩餘', 'コンテキスト', '컨텍스트', 'git', 'mwe']
    started = time.perf_counter_ns()
    count = 0
    for _ in range(3):
        for query in queries:
            state.search = query
            count += len(state.matches('main'))
    result['query_ms'] = (time.perf_counter_ns()-started)/1e6/(3*len(queries))
    result['matches'] = count
elif operation == 'lookup':
    from claude_statusline.i18n.statusline import text
    text('context.remaining', language, percentage=50)
    started = time.perf_counter_ns()
    for _ in range(10000):
        text('context.remaining', language, percentage=50)
    result['lookup_ms'] = (time.perf_counter_ns()-started)/1e6/10000
else:
    from claude_statusline.cli import main
    sys.argv = ['claude-statusline', '--language', language, '--help'] if operation == 'help' else ['claude-statusline', 'render-subagents' if operation == 'subagents' else 'render']
    captured = io.BytesIO()
    sink = io.TextIOWrapper(captured, encoding='utf-8', newline='\n')
    with contextlib.redirect_stdout(sink):
        try:
            code = main()
        except SystemExit as error:
            code = error.code
        assert code in (None, 0), code
    sink.flush()
    assert captured.getvalue()
    result['output_sha256'] = hashlib.sha256(captured.getvalue()).hexdigest()
try:
    import resource
    result['peak_rss_kib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 if sys.platform == 'darwin' else 1)
except ImportError:
    result['peak_rss_kib'] = None
result['loaded_statusline_modules'] = sorted(name for name in sys.modules if 'i18n._generated_statusline' in name)
print(json.dumps(result))
"""

NODE_PROBE = r"""
import {pathToFileURL} from 'node:url';
const root = process.argv[1];
const started = performance.now();
const search = await import(pathToFileURL(root + '/mods/statusline-native/lib/editor/search.ts'));
const {SEARCH_CATALOG} = await import(pathToFileURL(root + '/mods/statusline-native/tests/generated-search-fixtures.ts'));
const import_ms = performance.now() - started;
const items = SEARCH_CATALOG.filter(item => item.scope === 'main');
const before = performance.now();
items.forEach(item => search.fields(item));
const prepare_ms = performance.now() - before;
const queries = ['context','remaining','剩余','剩餘','コンテキスト','컨텍스트','git','mwe'];
const queryStart = performance.now();
let matches = 0;
for (let n=0;n<3;n++) for (const query of queries) for (const item of items) {
  if (search.bestMatch(search.fields(item), query)) matches++;
}
console.log(JSON.stringify({import_ms,prepare_ms,query_ms:(performance.now()-queryStart)/24,
  matches,peak_rss_kib:process.resourceUsage().maxRSS}));
"""


def summary(values):
    ordered = sorted(values)
    return {"p50": statistics.median(values), "p95": ordered[math.ceil(len(values) * .95) - 1]}


def checked(command, **kwargs):
    result = subprocess.run(command, **kwargs)
    if result.returncode:
        raise RuntimeError(f"Benchmark probe failed ({result.returncode}): {result.stderr[-4000:]}")
    return result


def export(ref, destination):
    sha = subprocess.check_output(["git", "rev-parse", ref + "^{commit}"], cwd=ROOT, text=True).strip()
    archive = subprocess.check_output(["git", "archive", "--format=zip", sha], cwd=ROOT)
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        source.extractall(destination)
    return sha


def environment(source, config, cache, warm):
    env = dict(os.environ, PYTHONPATH=str(source / "src"), CLAUDE_CONFIG_DIR=str(config),
               CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "runtime"), PYTHONHASHSEED="0",
               PYTHONPYCACHEPREFIX=str(cache), DISABLE_AUTOUPDATER="1")
    if warm:
        env.pop("PYTHONDONTWRITEBYTECODE", None)
    else:
        env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def resource_variant(source, count):
    package = source / "src/claude_statusline/i18n"
    registry = json.loads((package / "languages.json").read_text(encoding="utf-8"))
    if count < len(registry):
        registry = registry[:count]
    else:
        for index in range(count - len(registry)):
            code = "qa" + chr(ord("a") + index)
            registry.append({"code": code, "name": "Synthetic " + code})
            shutil.copyfile(package / "locales/en.json", package / "locales" / (code + ".json"))
    for path in (package / "locales").glob("*.json"):
        if path.stem not in {row["code"] for row in registry}:
            path.unlink()
    (package / "languages.json").write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run([sys.executable, str(source / "tools/generate_i18n.py")], cwd=source, check=True, capture_output=True)


def source_digest(source):
    paths = sorted((source / "src/claude_statusline").rglob("*.py"))
    paths += sorted((source / "src/claude_statusline/i18n").rglob("*.json"))
    paths += sorted((source / "mods/statusline-native/lib").rglob("*.ts"))
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(source).as_posix().encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def run(args):
    report = {"baseline": args.baseline, "candidate": args.candidate,
              "python": sys.version, "node": subprocess.check_output(["node", "--version"], text=True).strip(),
              "platform": platform.platform(), "samples": args.samples, "rounds": args.rounds, "modes": args.modes,
              "harness_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "notes": "Synthetic variants change only registration and generated language resources; qaa–qae are copied English fixtures. Cold/warm means Python bytecode only. Node probes exclude the Claude Client host.",
              "variants": {}, "runs": []}
    payload = json.dumps({"columns":120, "model":{"id":"sample-model"},
                         "context_window":{"remaining_percentage":50},
                         "tasks":[{"id":"demo","name":"Example","model":"sample-model","status":"running",
                                   "contextWindowSize":200000,"tokenCount":100000}]})
    cases = [(op, lang) for op in ("help", "render", "subagents", "lookup") for lang in ("en", "zh-CN")]
    cases += [("search", "en")]
    with tempfile.TemporaryDirectory(prefix="statusline-language-benchmark-") as directory:
        temporary = Path(directory)
        baseline, candidate = temporary / "baseline", temporary / "candidate-5"
        report["baseline"] = export(args.baseline, baseline)
        report["candidate"] = export(args.candidate, candidate)
        roots = {"baseline-2": baseline, "candidate-5": candidate}
        for count in (2, 10):
            source = temporary / f"candidate-{count}"
            shutil.copytree(candidate, source)
            resource_variant(source, count)
            roots[f"candidate-{count}"] = source
        roots = {name: roots[name] for name in ("baseline-2", "candidate-2", "candidate-5", "candidate-10")}
        for name, source in roots.items():
            files = sorted((source / "src/claude_statusline/i18n").rglob("*"))
            resource_bytes = b"".join(path.read_bytes() for path in files if path.suffix in (".json", ".py"))
            native_bytes = (source / "mods/statusline-native/lib/i18n/generated-locales.ts").read_bytes()
            report["variants"][name] = {
                "source_digest": source_digest(source), "python_i18n_bytes": len(resource_bytes),
                "python_i18n_gzip_bytes": len(gzip.compress(resource_bytes, mtime=0)),
                "native_i18n_bytes": len(native_bytes), "native_i18n_gzip_bytes": len(gzip.compress(native_bytes, mtime=0)),
            }
            for lang in ("en", "zh-CN"):
                config = temporary / (name + "-" + lang)
                config.mkdir()
                prepare = (
                    "import json,sys; from pathlib import Path; from claude_statusline.config.display import DEFAULT_CONFIG; "
                    "d=DEFAULT_CONFIG.with_updates(items=('context-remaining',),use_colors=False,scope_labels='off',statusline_language=sys.argv[1]); "
                    "d=d.with_updates(subagents=d.subagents.with_updates(items=('model','context-remaining'))) if hasattr(d.subagents,'with_updates') else d; "
                    "x=d.to_dict(); x['subagents']['items']=['model','context-remaining']; "
                    "Path(sys.argv[2]).write_text(json.dumps(x))"
                )
                subprocess.run([sys.executable, "-c", prepare, lang, str(config / "claude-statusline.json")],
                               cwd=temporary, env=environment(source,config,temporary/"setup-cache",False), check=True, capture_output=True)
        for mode in args.modes:
            for round_number in range(args.rounds):
                order = list(roots) if round_number % 2 == 0 else list(reversed(roots))
                for name in order:
                    source = roots[name]
                    digest = report["variants"][name]["source_digest"]
                    metrics, diagnostics = {}, {}
                    for operation, language in cases + ([("node-search", "en")] if mode == "warm" else []):
                        config = temporary / (name + "-" + language)
                        # Disabling writes does not disable reads of existing pyc.
                        # Give cold workers a distinct, permanently empty tree.
                        cache = temporary / ("bytecode-" + mode + "-" + name)
                        env = environment(source, config, cache, mode == "warm")
                        command = (["node", "--no-warnings", "--experimental-transform-types", "--input-type=module", "-e", NODE_PROBE, str(source)]
                                   if operation == "node-search" else [sys.executable, "-c", PYTHON_PROBE, str(source), operation, language])
                        # Prime outside the measured batch, also for the bytecode-disabled worker.
                        checked(command, input=payload, cwd=temporary, env=env, capture_output=True, text=True)
                        samples = []
                        for _ in range(args.samples):
                            started = time.perf_counter_ns()
                            result = checked(command, input=payload, cwd=temporary, env=env, capture_output=True, text=True, encoding="utf-8")
                            elapsed = (time.perf_counter_ns() - started) / 1e6
                            value = json.loads(result.stdout)
                            value["process_ms"] = elapsed
                            samples.append(value)
                        key = operation + "/" + language
                        metrics[key] = {field: {**summary([value[field] for value in samples]), "raw": [value[field] for value in samples]}
                                        for field in samples[0] if field.endswith(("_ms", "_kib")) and samples[0][field] is not None}
                        diagnostics[key] = {field: samples[0][field] for field in samples[0] if field not in metrics[key]}
                        if mode == "cold":
                            assert not cache.exists(), "Cold worker created bytecode"
                    assert source_digest(source) == digest, "Benchmark source changed during measurement"
                    report["runs"].append({"variant":name, "mode":mode, "round":round_number+1, "metrics":metrics, "diagnostics":diagnostics})
                    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    print(f"{mode} round {round_number+1}: {name} complete", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", default="v1.12.0")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--modes", choices=("warm", "cold"), nargs="+", default=["warm", "cold"])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.samples < 1 or args.rounds < 1:
        parser.error("samples and rounds must be positive")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    run(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
