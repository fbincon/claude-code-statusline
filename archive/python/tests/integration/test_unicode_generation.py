"""Unicode reproduction is independent of checkout line-ending conversion."""

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from tools import generate_unicode as generator


class UnicodeGenerationTests(unittest.TestCase):
    def test_decoded_tables_match_every_pinned_reference_interval(self):
        from claude_statusline.rendering import _unicode_grapheme, _unicode_width

        expected = json.loads(
            (generator.DATA / "data.json").read_text(encoding="utf-8")
        )["tables"]
        for module in (_unicode_grapheme, _unicode_width):
            for name in vars(module).keys() & expected.keys():
                with self.subTest(module=module.__name__, table=name):
                    self.assertEqual(
                        getattr(module, name), tuple(map(tuple, expected[name]))
                    )

    def test_crlf_checkout_produces_the_same_tables_fixtures_and_provenance(self):
        expected = {
            str(path.relative_to(generator.ROOT)): content
            for path, content in generator.outputs()
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(generator.DATA, root / "tools/unicode")
            (root / "tests/fixtures").mkdir(parents=True)
            shutil.copyfile(
                generator.ROOT / "tests/fixtures/graphemes.json",
                root / "tests/fixtures/graphemes.json",
            )
            for path in (root / "tools/unicode").iterdir():
                path.write_bytes(
                    path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
                )
            with (
                patch.object(generator, "ROOT", root),
                patch.object(generator, "DATA", root / "tools/unicode"),
            ):
                actual = {
                    str(path.relative_to(root)): content
                    for path, content in generator.outputs()
                }
            self.assertEqual(actual, expected)
