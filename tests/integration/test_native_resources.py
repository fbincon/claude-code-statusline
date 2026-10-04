"""Runtime inventories reject linked trees before packaging external content."""

from pathlib import Path
import tempfile
import unittest

from claude_statusline.integration.models import ConfigurationError
from claude_statusline.integration.native_resources import source_files


class NativeResourceTests(unittest.TestCase):
    def test_linked_runtime_directory_is_not_packaged(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "hooks").mkdir()
            (root / "lib").mkdir()
            (root / "ui").mkdir()
            external = root / "external"
            external.mkdir()
            (external / "private.ts").write_text("private external content")
            try:
                (root / "ui/components").symlink_to(external, target_is_directory=True)
            except OSError as exc:
                self.skipTest(f"Creating symlinks is unavailable: {exc}")
            with self.assertRaisesRegex(ConfigurationError, "symlinks"):
                source_files(root)
