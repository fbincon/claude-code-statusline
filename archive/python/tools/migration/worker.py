"""Fresh-process reference adapter. Never imported by production modules."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import unittest


def surface():
    from claude_statusline.cli import build_parser
    from claude_statusline.config import catalog

    def parser_record(parser, command):
        options, children = [], []
        for action in parser._actions:
            if isinstance(action, argparse._SubParsersAction):
                for name, child in action.choices.items():
                    children.extend(parser_record(child, [*command, name]))
            else:
                default = action.default
                if not isinstance(
                    default, (str, int, float, bool, type(None), list, dict)
                ):
                    default = repr(default)
                options.append(
                    {
                        "flags": action.option_strings,
                        "destination": action.dest,
                        "nargs": action.nargs,
                        "required": action.required,
                        "choices": list(action.choices)
                        if action.choices is not None
                        else None,
                        "default": default,
                    }
                )
        behavior = {
            "render": "RENDER",
            "render-subagents": "RENDER",
            "hook": "LIFECYCLE",
            "ui": "PROTOCOL",
            "runtime": "LIVE",
            "configure": "EDITOR",
            "install": "INSTALL",
            "uninstall": "INSTALL",
            "doctor": "INSTALL",
        }.get(command[0] if command else "", "CLI")
        if command[:2] == ["config", "instance"]:
            behavior = "INSTANCES"
        return [
            {"argv": command, "arguments": options, "behavior": behavior},
            *children,
        ]

    def flatten(suite):
        for test in suite:
            if isinstance(test, unittest.TestSuite):
                yield from flatten(test)
            else:
                if isinstance(test, unittest.loader._FailedTest):
                    raise RuntimeError(f"Test discovery failed: {test.id()}")
                yield test.id()

    suite = unittest.TestLoader().discover("tests", top_level_dir=".")
    return {
        "cli": parser_record(build_parser("en"), []),
        "catalog": {
            scope: list(definitions) for scope, definitions in catalog.BY_SCOPE.items()
        },
        "discovered_test_ids": sorted(flatten(suite)),
        "protocols": {"editor": 11, "runtime": 2, "runtime_read_compatibility": [1]},
        "schemas": {
            "display": 8,
            "display_read_compatibility": list(range(1, 8)),
            "task_lifecycle": 4,
            "portable": 1,
            "ui_preferences": 1,
            "feature_settings": 1,
            "native_preferences": 1,
            "runtime_preferences": 2,
            "legacy_turn_mirror": 1,
            "task_lifecycle_read_compatibility": [2, 3, 4],
            "live_store": 1,
            "slash_result": 1,
            "git_cache": 2,
            "turn_scan": 6,
            "usage_scan": 3,
        },
        "configuration_precedence": ["--config-dir", "CLAUDE_CONFIG_DIR", "~/.claude"],
        "editor_operations": [
            "describe",
            "read",
            "preview",
            "apply",
            "read_ui_preferences",
            "set_ui_language",
            "preset",
            "import",
            "review_import",
            "export",
        ],
        "runtime_operations": ["observe", "read"],
        "exit_codes": {
            "success": 0,
            "doctor_error_or_uncaught_error": 1,
            "invalid_argument_or_refused_request": 2,
            "tui_sigint": 130,
            "tui_other_signal": "128 + signal",
        },
        "streams": {
            "render": "text",
            "render-subagents": "id/content NDJSON",
            "ui": "one JSON envelope",
            "runtime": "one JSON envelope",
            "hook": "silent",
            "slash-hook": "block JSON for recognized direct commands; otherwise silent",
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--inventory", action="store_true")
    parser.add_argument("--case", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    sys.path[:0] = [str(source / "src"), str(source)]
    if args.inventory:
        import os

        os.chdir(source)
        result = surface()
    else:
        # Use this harness, never the source tree's unrelated tools package.
        from scenarios import run

        result = run(json.loads(args.case.read_text(encoding="utf-8")))
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
