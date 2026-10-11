"""Build a deterministic inventory from the immutable Git tree and test loader."""

from __future__ import annotations

import ast
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from .common import ROOT, REFERENCE, digest, git, isolated_environment, read_json
from .policy import BEHAVIORS, disposition, family


def imports(tree, files):
    result = set()
    for node in ast.walk(tree):
        names = []
        if isinstance(node, ast.Import):
            names = [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            names = [node.module, *(node.module + "." + a.name for a in node.names)]
        for name in names:
            if name.startswith("claude_statusline"):
                base = "src/" + name.replace(".", "/")
                result.update(
                    p for p in (base + ".py", base + "/__init__.py") if p in files
                )
    return sorted(result)


def runtime_inventory(source, python):
    with tempfile.TemporaryDirectory(prefix="ts01-inventory-") as directory:
        root = Path(directory)
        target = root / "inventory.json"
        subprocess.run(
            [
                str(python),
                "-B",
                str(ROOT / "tools/migration/worker.py"),
                "--source",
                str(source),
                "--output",
                str(target),
                "--inventory",
            ],
            env=isolated_environment(source, root),
            cwd=root,
            check=True,
            timeout=60,
        )
        return read_json(target)


def build(files, source, python=sys.executable):
    modules, tests, tools, environments = [], [], [], {}
    for name, raw in sorted(files.items()):
        if name.startswith("mods/") and name.endswith(".ts") and "/tests/" not in name:
            for match in re.findall(rb"\$\.env\.get\(['\"]([A-Z_]+)['\"]\)", raw):
                environments.setdefault(match.decode(), set()).add(name)
        if not name.endswith(".py") or not name.startswith(
            ("src/", "tests/", "tools/")
        ):
            continue
        tree = ast.parse(raw.decode("utf-8"))
        doc = ast.get_docstring(tree) or ""
        behavior = family(name, doc)
        generated = "_generated" in name or "_unicode_tables" in name
        category, reason = disposition(name, generated=generated)
        row = {
            "path": name,
            "sha256": digest(raw),
            "lines": len(raw.splitlines()),
            "behavior": behavior,
            "classification": category,
            "reason": reason,
            "stage": BEHAVIORS[behavior][2],
            "purpose": doc.split("\n")[0] if doc else Path(name).stem.replace("_", " "),
        }
        if name.startswith("tests/"):
            row["production_imports"] = imports(tree, files)
            for cls in tree.body:
                if not isinstance(cls, ast.ClassDef):
                    continue
                for method in cls.body:
                    if isinstance(
                        method, (ast.FunctionDef, ast.AsyncFunctionDef)
                    ) and method.name.startswith("test_"):
                        identifier = (
                            name[:-3].replace("/", ".")
                            + "."
                            + cls.name
                            + "."
                            + method.name
                        )
                        kind, why = disposition(name, identifier)
                        tests.append(
                            {
                                "id": identifier,
                                "path": name,
                                "line": method.lineno,
                                "behavior": behavior,
                                "assertion": method.name.removeprefix("test_").replace(
                                    "_", " "
                                ),
                                "classification": kind,
                                "reason": why,
                                "stage": BEHAVIORS[behavior][2],
                            }
                        )
        if name.startswith("tools/") or name == "src/build_native.py":
            callers = sorted(
                p
                for p, body in files.items()
                if p != name
                and p.endswith((".py", ".md", ".yml", ".ts"))
                and (name.encode() in body or Path(name).stem.encode() in body)
            )
            tools.append(
                {
                    **row,
                    "callers": callers,
                    "disposition": "retain_comparison_then_replace"
                    if behavior == "BENCHMARK"
                    else "replace",
                    "replacement": "TypeScript development tool preserving: "
                    + row["purpose"],
                    "replacement_stage": "TS-05",
                    "restriction": "Explicit budget/ledger required for new paid calls"
                    if "/live_" in name or "/task_timer_acceptance" in name
                    else None,
                }
            )
        modules.append(row)
        if name.startswith("src/"):
            for match in re.findall(rb'"(CLAUDE_STATUSLINE_[A-Z_]+)"', raw):
                environments.setdefault(match.decode(), set()).add(name)
            for node in ast.walk(tree):
                key = None
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.args
                ):
                    receiver = ast.unparse(node.func.value).lower()
                    if (
                        node.func.attr == "getenv"
                        or node.func.attr == "get"
                        and ("env" in receiver or receiver == "source")
                    ):
                        key = node.args[0]
                elif isinstance(node, ast.Subscript) and "environ" in ast.unparse(
                    node.value
                ):
                    key = node.slice
                if (
                    isinstance(key, ast.Constant)
                    and isinstance(key.value, str)
                    and re.fullmatch(r"[A-Z][A-Z0-9_]+", key.value)
                ):
                    environments.setdefault(key.value, set()).add(name)
    runtime = runtime_inventory(source, python)
    actual = set(runtime["discovered_test_ids"])
    definitions = {t["id"] for t in tests}
    if actual != definitions:
        raise ValueError(
            f"Unmapped discovered tests: {sorted(actual - definitions)}; undiscovered definitions: {sorted(definitions - actual)}"
        )
    return {
        "format_version": 1,
        "reference_commit": REFERENCE,
        "reference_tree": git("rev-parse", REFERENCE + "^{tree}").decode().strip(),
        "counts": {
            "source_python_files": sum(m["path"].startswith("src/") for m in modules),
            "test_python_files": sum(m["path"].startswith("tests/") for m in modules),
            "tool_python_files": sum(m["path"].startswith("tools/") for m in modules),
            "static_test_methods": len(tests),
            "discovered_test_ids": len(actual),
        },
        "behaviors": [
            {"id": key, "contract": value[0], "document": value[1], "stage": value[2]}
            for key, value in BEHAVIORS.items()
        ],
        "modules": modules,
        "test_methods": tests,
        "tools": tools,
        "ts01_tools": [
            {
                "path": p.relative_to(ROOT).as_posix(),
                "purpose": (
                    ast.get_docstring(ast.parse(p.read_text(encoding="utf-8"))) or ""
                ).split("\n")[0],
                "callers": [
                    "python -m tools.migration",
                    "migration-baseline CI",
                    "tests/migration",
                ],
                "replacement_stage": "TS-05",
                "replacement": "Port reference comparison/coverage verification to selected TypeScript tooling; preserve the frozen Python adapter only as isolated historical evidence.",
            }
            for p in sorted((ROOT / "tools/migration").glob("*.py"))
        ],
        "ts01_tool_corrections": [
            {
                "path": "tools/external_tui_acceptance.py",
                "reason": "The original harness waited for an internal fitting key instead of the presented Directory label; use localized presentation rows.",
                "disposition": "Production reference unchanged; rerun corrected harness against its installed wheel.",
            }
        ],
        "fixtures": [
            {
                "path": p,
                "sha256": digest(raw),
                "classification": "reuse_fixture",
                "stage": "TS-03",
            }
            for p, raw in sorted(files.items())
            if p.startswith("tests/fixtures/")
        ],
        "mod_tests": [
            {
                "path": p,
                "sha256": digest(raw),
                "stage": "TS-04",
                "disposition": "retain_existing_typescript_tests",
            }
            for p, raw in sorted(files.items())
            if p.startswith("mods/") and p.endswith(".test.ts")
        ],
        "environment_reads": [
            {
                "name": key,
                "source": sorted(value),
                "role": "mod_backend_override"
                if key.endswith("_EXECUTABLE")
                else "public_override"
                if key
                in (
                    "CLAUDE_CONFIG_DIR",
                    "CLAUDE_STATUSLINE_RUNTIME_DIR",
                    "CLAUDE_STATUSLINE_SESSIONS_DIR",
                )
                else "platform_or_terminal_context",
            }
            for key, value in sorted(environments.items())
        ],
        "public_surface": runtime,
        "mod_backend_bindings": [
            {
                "source": path,
                "behavior": behavior,
                "executable_precedence": [
                    environment,
                    "PluginOptions.backendExecutable",
                    "claude-statusline",
                ],
                "config_precedence": [
                    "CLAUDE_CONFIG_DIR",
                    "PluginOptions.configDir",
                    "backend default",
                ],
                "invocation": "argv array through $.process.run; append --config-dir only when explicitly bound",
                "stage": "TS-04",
            }
            for path, behavior, environment in (
                (
                    "mods/statusline-native/hooks/register.ts",
                    "PROTOCOL",
                    "CLAUDE_STATUSLINE_NATIVE_EXECUTABLE",
                ),
                (
                    "mods/statusline-runtime/hooks/observe.ts",
                    "LIVE",
                    "CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE",
                ),
            )
        ],
        "benchmark": {
            "reference": REFERENCE,
            "parameters": {
                "samples": 50,
                "rounds": 3,
                "profiles": ["small", "medium", "large"],
                "bytecode_modes": ["cold", "warm"],
            },
            "status": "harness_frozen_measurement_and_budgets_deferred_to_TS-02_D06",
            "files": {
                p: digest(raw)
                for p, raw in sorted(files.items())
                if p.startswith("tools/benchmark")
            },
        },
    }
