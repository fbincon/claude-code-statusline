"""Capture immutable-reference results and verify without rewriting expectations."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import platform
import re
import subprocess
import sys
import tempfile

from .common import (
    CORPUS,
    ROOT,
    REFERENCE,
    check_source,
    digest,
    encoded,
    isolated_environment,
    read_json,
)
from .inventory import build
from .policy import BEHAVIORS


@contextmanager
def source_tree(files, source=None):
    if source is not None:
        source = source.resolve()
        check_source(source, files)
        yield source
    else:
        with tempfile.TemporaryDirectory(prefix="ts01-reference-") as directory:
            root = Path(directory)
            for name, raw in files.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
            yield root


def harness_hashes():
    return {
        p.relative_to(ROOT).as_posix(): digest(p.read_bytes())
        for p in sorted((ROOT / "tools/migration").glob("*.py"))
    }


def validate_cases(document):
    ids = set()
    for case in document["cases"]:
        identifier = case["id"]
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]+", identifier) or identifier in ids:
            raise ValueError(f"Invalid/duplicate case ID: {identifier}")
        ids.add(identifier)
        if not case["behaviors"] or any(b not in BEHAVIORS for b in case["behaviors"]):
            raise ValueError(f"Unmapped behavior: {identifier}")
        if case.get("config_id") not in (None, *document["configs"]):
            raise ValueError(f"Unknown configuration: {identifier}")
    if not ids:
        raise ValueError("Empty fixture corpus")


def capture(source, output, python=sys.executable, corpus=CORPUS):
    document = read_json(corpus / "cases.json")
    validate_cases(document)
    output.mkdir(parents=True, exist_ok=False)
    results = {}
    for spec in document["cases"]:
        case = dict(spec)
        if "config_id" in case:
            case["config"] = document["configs"][case["config_id"]]
        with tempfile.TemporaryDirectory(prefix="ts01-case-") as directory:
            root = Path(directory)
            request, response = root / "case.json", root / "response.json"
            request.write_bytes(encoded(case))
            process = subprocess.run(
                [
                    str(python),
                    "-B",
                    str(ROOT / "tools/migration/worker.py"),
                    "--source",
                    str(source),
                    "--case",
                    str(request),
                    "--output",
                    str(response),
                ],
                env=isolated_environment(source, root),
                cwd=root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=60,
                check=False,
            )
            if process.returncode:
                raise ValueError(f"Case {case['id']} failed:\n{process.stderr}")
            if process.stdout or process.stderr:
                raise ValueError(
                    f"Case {case['id']} leaked adapter output: {process.stdout!r} {process.stderr!r}"
                )
            results[case["id"]] = read_json(response)
    raw = encoded(results)
    (output / "results.json").write_bytes(raw)
    version = subprocess.check_output([str(python), "--version"], text=True).strip()
    receipt = {
        "format_version": 1,
        "reference_commit": REFERENCE,
        "python": version,
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "cases": len(results),
        "cases_sha256": digest((corpus / "cases.json").read_bytes()),
        "results_sha256": digest(raw),
        "harness": harness_hashes(),
    }
    (output / "receipt.json").write_bytes(encoded(receipt))
    return results


def differences(expected, actual, path="$", limit=20):
    """Type-strict comparison: bool/int, null/missing and integers stay distinct."""
    if type(expected) is not type(actual):
        return [f"{path}: {type(expected).__name__} != {type(actual).__name__}"]
    if isinstance(expected, dict):
        result = [
            f"{path}: missing {key}" for key in sorted(expected.keys() - actual.keys())
        ]
        result += [
            f"{path}: unexpected {key}"
            for key in sorted(actual.keys() - expected.keys())
        ]
        for key in sorted(expected.keys() & actual.keys()):
            result.extend(
                differences(expected[key], actual[key], f"{path}.{key}", limit)
            )
            if len(result) >= limit:
                break
        return sorted(result)[:limit]
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return [f"{path}: list length {len(expected)} != {len(actual)}"]
        result = []
        for i, (before, after) in enumerate(zip(expected, actual)):
            result.extend(differences(before, after, f"{path}[{i}]", limit))
            if len(result) >= limit:
                break
        return result[:limit]
    return [] if expected == actual else [f"{path}: value differs"]


def check_lock(corpus=CORPUS):
    lock = read_json(corpus / "lock.json")
    if lock["reference_commit"] != REFERENCE:
        raise ValueError("Wrong reference commit in lock")
    if lock["harness"] != harness_hashes():
        raise ValueError("Capture harness changed; review and explicitly re-freeze it")
    expected_names = {"baseline.json", "cases.json", "expected.json", "platforms.json"}
    if set(lock["fixtures"]) != expected_names:
        raise ValueError("Incomplete fixture lock")
    for name, sha in lock["fixtures"].items():
        if digest((corpus / name).read_bytes()) != sha:
            raise ValueError(f"Fixture hash mismatch: {name}")


def verify(files, source, capture_dir=None, python=sys.executable, corpus=CORPUS):
    check_lock(corpus)
    baseline = read_json(corpus / "baseline.json")
    errors = differences(baseline, build(files, source, python))
    if errors:
        raise ValueError("Inventory mismatch:\n" + "\n".join(errors))
    cases = read_json(corpus / "cases.json")
    validate_cases(cases)
    expected = read_json(corpus / "expected.json")
    if set(expected) != {case["id"] for case in cases["cases"]}:
        raise ValueError("Expected output does not cover all cases")
    if capture_dir is None:
        with tempfile.TemporaryDirectory(prefix="ts01-verify-") as directory:
            actual = capture(source, Path(directory) / "capture", python, corpus)
    else:
        receipt = read_json(capture_dir / "receipt.json")
        if (
            receipt["reference_commit"] != REFERENCE
            or receipt["harness"] != harness_hashes()
        ):
            raise ValueError(
                "Capture identity does not match the frozen reference/harness"
            )
        if receipt["cases_sha256"] != digest((corpus / "cases.json").read_bytes()):
            raise ValueError("Capture used different cases")
        raw = (capture_dir / "results.json").read_bytes()
        if receipt["results_sha256"] != digest(raw):
            raise ValueError("Capture output hash mismatch")
        actual = read_json(capture_dir / "results.json")
    errors = differences(expected, actual)
    if errors:
        raise ValueError("Behavior mismatch:\n" + "\n".join(errors))
    return {
        "reference_commit": REFERENCE,
        "counts": baseline["counts"],
        "cases": len(expected),
        "result": "passed",
    }
