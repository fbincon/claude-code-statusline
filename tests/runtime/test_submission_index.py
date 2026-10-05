"""End evidence uses complete-line cursors across append, rewrite and retries."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime.tasks import evidence, store


class SubmissionIndexTests(unittest.TestCase):
    def test_indexed_lookup_reads_only_the_tail_and_invalidates_on_replacement(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "transcript.jsonl"

            def row(prompt, second):
                return (
                    json.dumps(
                        {
                            "type": "user",
                            "promptId": prompt,
                            "timestamp": f"2026-10-05T00:00:{second:02d}Z",
                            "promptSource": "typed",
                            "message": {"role": "user", "content": "probe"},
                        }
                    ).encode()
                    + b"\n"
                )

            path.write_bytes(b'{"type":"system"}\n' * 1000 + row("p", 1))
            with (
                mock.patch.object(store, "RUNTIME_ROOT", str(root)),
                mock.patch.object(
                    evidence,
                    "_read_submission_chunk",
                    wraps=evidence._read_submission_chunk,
                ) as read,
            ):
                first = evidence.submission_time(path, "p")
                offset = path.stat().st_size
                self.assertEqual(evidence.submission_time(path, "p"), first)
                self.assertEqual(read.call_count, 1)
                with path.open("ab") as stream:
                    stream.write(row("q", 2).rstrip(b"\n"))
                self.assertIsNone(evidence.submission_time(path, "q"))
                with path.open("ab") as stream:
                    stream.write(b"\n")
                self.assertGreater(evidence.submission_time(path, "q"), first)
                self.assertEqual(read.call_args.args[1], offset)
                replacement = root / "replacement"
                replacement.write_bytes(row("p", 3))
                replacement.replace(path)
                self.assertGreater(evidence.submission_time(path, "p"), first)
                self.assertEqual(read.call_args.args[1], 0)
