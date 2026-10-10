"""Independent capture oracle must survive arbitrary PTY and SGR boundaries."""

import importlib.util
import unittest


@unittest.skipUnless(
    importlib.util.find_spec("pyte") and importlib.util.find_spec("wcwidth"),
    "capture development dependencies unavailable",
)
class CaptureTests(unittest.TestCase):
    def screen(self):
        from tools.terminal_capture import Screen, Stream

        screen = Screen(20, 4)
        return screen, Stream(screen)

    def test_every_byte_chunking_preserves_clusters_and_base_style(self):
        value = "\x1b[31;44m👩\x1b[1m🏽\u200d💻\x1b[49mX"
        for step in (1, 2, 3, len(value)):
            screen, stream = self.screen()
            for index in range(0, len(value), step):
                stream.feed(value[index : index + step])
            self.assertEqual(screen.buffer[0][0].data, "👩🏽‍💻")
            self.assertEqual(screen.buffer[0][0].fg, "red")
            self.assertEqual(screen.buffer[0][0].bg, "blue")
            self.assertFalse(screen.buffer[0][0].bold)
            self.assertEqual(screen.buffer[0][2].data, "X")
            self.assertTrue(screen.buffer[0][2].bold)
            self.assertEqual(screen.buffer[0][2].bg, "default")
            self.assertEqual(screen.cursor.x, 3)

    def test_clear_and_cursor_moves_do_not_rejoin_old_capture_text(self):
        screen, stream = self.screen()
        stream.feed("👩\x1b[2J\x1b[H🏽X")
        self.assertEqual(screen.buffer[0][0].data, "🏽")
        self.assertEqual(screen.buffer[0][2].data, "X")
        stream.feed("\x1b[2;1H1️⃣🇨🇳a\u200db")
        self.assertEqual(
            [screen.buffer[1][i].data for i in (0, 2, 4, 5)],
            ["1️⃣", "🇨🇳", "a\u200d", "b"],
        )
        self.assertEqual(screen.cursor.x, 6)
