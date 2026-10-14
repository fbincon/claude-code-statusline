"""Windows boot identity regression and native API failure behavior."""
import ctypes
import json
import os
import subprocess
import sys
import unittest
import uuid
from types import SimpleNamespace
from unittest import mock

from claude_statusline.platforms import clocks
from tests.support import SOURCE_ROOT


class WindowsBootIdentityTests(unittest.TestCase):
    def test_boot_guid_rejects_native_error_truncation_and_zero(self):
        identity = uuid.UUID("a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53")
        for status, length, raw, expected in (
            (0, 32, identity.bytes_le, str(identity)),
            (-1, 32, identity.bytes_le, None),
            (0, 16, identity.bytes_le, None),
            (0, 32, bytes(16), None),
        ):
            with self.subTest(status=status, length=length, raw=raw):
                def query(kind, output, size, returned):
                    self.assertEqual((kind, size), (90, 32))
                    ctypes.memmove(output, raw, 16)
                    returned._obj.value = length
                    return status
                native = SimpleNamespace(NtQuerySystemInformation=mock.Mock(side_effect=query))
                with mock.patch.object(ctypes, "WinDLL", return_value=native, create=True):
                    self.assertEqual(clocks._windows_boot_guid(), expected)

    def test_same_guid_and_different_sequences_are_distinct_boots(self):
        with (
            mock.patch.object(clocks, "_windows_boot_guid", return_value="a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53"),
            mock.patch.object(clocks, "_windows_boot_sequence", side_effect=[41, 42, None]),
        ):
            first, second = clocks._windows_boot_id(), clocks._windows_boot_id()
            self.assertEqual(first, "windows:v2:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53:41")
            self.assertNotEqual(first, second)
            self.assertIsNone(clocks._windows_boot_id())
        with (
            mock.patch.object(clocks, "_windows_boot_guid", return_value=None),
            mock.patch.object(clocks, "_windows_boot_sequence") as read,
        ):
            self.assertIsNone(clocks._windows_boot_id())
            read.assert_not_called()

    def test_checked_self_read_rejects_failure_short_reads_and_zero(self):
        for success, count, sequence, expected in (
            (1, 4, 123, 123), (1, 4, 0xffffffff, 0xffffffff),
            (0, 4, 123, None), (1, 3, 123, None), (1, 4, 0, None),
        ):
            with self.subTest(success=success, count=count, sequence=sequence):
                def read(process, address, output, size, length):
                    self.assertEqual(process, -1)
                    self.assertEqual(address, 0x7FFE02C4)
                    self.assertEqual(size, 4)
                    output._obj.value = sequence
                    length._obj.value = count
                    return success
                kernel = SimpleNamespace(GetCurrentProcess=mock.Mock(return_value=-1), ReadProcessMemory=mock.Mock(side_effect=read))
                with mock.patch.object(ctypes, "WinDLL", return_value=kernel, create=True):
                    self.assertEqual(clocks._windows_boot_sequence(), expected)
        with mock.patch.object(ctypes, "WinDLL", side_effect=OSError("unavailable"), create=True):
            self.assertIsNone(clocks._windows_boot_sequence())

    def test_missing_identity_preserves_wall_clock_only_fallback(self):
        with (
            mock.patch.object(clocks.platform_environment, "is_windows", return_value=True),
            mock.patch.object(clocks.time, "time_ns", return_value=1000),
            mock.patch.object(clocks, "_windows_uptime_ns", return_value=100),
            mock.patch.object(clocks, "_windows_boot_guid", return_value="guid"),
            mock.patch.object(clocks, "_windows_boot_sequence", return_value=None),
        ):
            self.assertEqual(clocks.now_clocks(), (1000, None, None))

    @unittest.skipUnless(sys.platform == "win32", "Windows native shared page")
    def test_native_identity_is_shared_across_independent_processes(self):
        before = clocks.now_clocks()
        child = json.loads(subprocess.check_output(
            [sys.executable, "-c", "import json; from claude_statusline.platforms.clocks import now_clocks; print(json.dumps(now_clocks()))"],
            env=dict(os.environ, PYTHONPATH=str(SOURCE_ROOT)), text=True, encoding="utf-8",
        ))
        after = clocks.now_clocks()
        self.assertRegex(before[2], r"^windows:v2:[0-9a-f-]{36}:[1-9][0-9]*$")
        self.assertEqual(before[2], child[2])
        self.assertEqual(before[2], after[2])
        self.assertLessEqual(before[1], child[1])
        self.assertLessEqual(child[1], after[1])
