"""Cross-platform tests for the centralized operating-system adapters."""

from claude_statusline.platforms import clocks as platform_clocks
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import processes as platform_processes

import errno
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import textwrap
import threading
from tests.support import SOURCE_ROOT

import unittest
from types import SimpleNamespace
from unittest import mock


class PlatformIdentityTests(unittest.TestCase):
    def test_supported_platform_contract(self):
        self.assertTrue(platform_environment.is_supported_platform("linux"))
        self.assertTrue(platform_environment.is_supported_platform("linux2"))
        self.assertTrue(platform_environment.is_supported_platform("win32"))
        self.assertTrue(platform_environment.is_supported_platform("darwin"))
        self.assertFalse(platform_environment.is_supported_platform("cygwin"))

    def test_posix_file_capabilities_do_not_enable_other_unix_platforms(self):
        for name, expected in (
            ("linux", True),
            ("darwin", True),
            ("win32", False),
            ("cygwin", False),
            ("freebsd14", False),
        ):
            with self.subTest(platform=name):
                self.assertEqual(platform_environment.uses_posix_files(name), expected)
        self.assertTrue(platform_environment.is_macos("darwin"))
        self.assertFalse(platform_environment.is_linux("darwin"))
        self.assertFalse(platform_environment.is_wsl("darwin"))

    def test_wsl_environment_markers_short_circuit_kernel_detection(self):
        for marker, value in (
            ("WSL_INTEROP", "/run/WSL/1_interop"),
            ("WSL_DISTRO_NAME", "Ubuntu"),
        ):
            with (
                self.subTest(marker=marker),
                mock.patch.dict(platform_files.os.environ, {marker: value}, clear=True),
                mock.patch.object(platform_environment.platform, "release") as release,
            ):
                self.assertTrue(platform_environment.is_wsl("linux"))
                release.assert_not_called()

    def test_wsl_kernel_detection_and_platform_guard(self):
        cases = (
            ("linux", {}, "5.15.90.1-Microsoft-standard-WSL2", True),
            ("linux", {}, "6.8.0-52-generic", False),
            ("win32", {"WSL_DISTRO_NAME": "Ubuntu"}, "Microsoft", False),
        )
        for platform_name, environment, kernel_release, expected in cases:
            with (
                self.subTest(platform_name=platform_name, expected=expected),
                mock.patch.dict(platform_files.os.environ, environment, clear=True),
                mock.patch.object(
                    platform_environment.platform,
                    "release",
                    return_value=kernel_release,
                ) as release,
            ):
                self.assertEqual(platform_environment.is_wsl(platform_name), expected)
                if platform_name == "win32":
                    release.assert_not_called()

    def test_subprocess_creation_flags_are_platform_scoped(self):
        with mock.patch.object(platform_environment, "is_windows", return_value=False):
            self.assertEqual(platform_environment.no_window_creation_flags(), 0)
            self.assertEqual(platform_environment.new_console_creation_flags(), 0)
        with mock.patch.object(platform_environment, "is_windows", return_value=True):
            self.assertNotEqual(platform_environment.no_window_creation_flags(), 0)
            self.assertNotEqual(platform_environment.new_console_creation_flags(), 0)


class FileLockTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-platform-lock-")
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_exception_releases_lock(self):
        lock = self.root / "state.lock"
        with self.assertRaisesRegex(RuntimeError, "release"):
            with platform_files.exclusive_file_lock(lock):
                raise RuntimeError("release")
        with platform_files.exclusive_file_lock(lock):
            self.assertTrue(lock.is_file())

    def test_independent_processes_do_not_lose_updates(self):
        counter = self.root / "counter.txt"
        counter.write_text("0", encoding="ascii")
        lock = self.root / "counter.lock"
        script = textwrap.dedent(
            """
            import sys
            import time
            from pathlib import Path
            from claude_statusline import _platform

            counter = Path(sys.argv[1])
            lock = Path(sys.argv[2])
            for _index in range(8):
                with _platform.exclusive_file_lock(lock):
                    value = int(counter.read_text(encoding="ascii"))
                    time.sleep(0.002)
                    _platform.atomic_write_bytes(
                        counter, str(value + 1).encode("ascii")
                    )
            """
        )
        environment = os.environ.copy()
        source = str(SOURCE_ROOT)
        environment["PYTHONPATH"] = (
            source + os.pathsep + environment.get("PYTHONPATH", "")
        )
        processes = [
            subprocess.Popen(
                [sys.executable, "-c", script, str(counter), str(lock)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=environment,
                creationflags=platform_environment.no_window_creation_flags(),
            )
            for _index in range(4)
        ]
        failures = []
        for process in processes:
            stdout, stderr = process.communicate(timeout=30)
            if process.returncode:
                failures.append((process.returncode, stdout, stderr))
        self.assertEqual(failures, [])
        self.assertEqual(counter.read_text(encoding="ascii"), "32")

    def test_threads_and_file_lock_form_one_serialized_transaction(self):
        counter = self.root / "thread-counter.txt"
        counter.write_text("0", encoding="ascii")
        lock = self.root / "thread-counter.lock"
        barrier = threading.Barrier(8)
        errors = []

        def increment():
            try:
                barrier.wait()
                for _index in range(20):
                    with platform_files.exclusive_file_lock(lock):
                        value = int(counter.read_text(encoding="ascii"))
                        platform_files.atomic_write_bytes(
                            counter, str(value + 1).encode("ascii")
                        )
            except Exception as exc:  # noqa: BLE001 - surfaced by parent test
                errors.append(exc)

        threads = [threading.Thread(target=increment) for _index in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        self.assertEqual(counter.read_text(encoding="ascii"), "160")


class AtomicFileTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-platform-io-")
        self.root = Path(self.temporary.name)
        self.path = self.root / "state.json"

    def tearDown(self):
        self.temporary.cleanup()

    @staticmethod
    def transient_error():
        error = PermissionError(errno.EACCES, "temporarily busy")
        error.winerror = 32
        return error

    def test_windows_replace_retries_transient_sharing_violation(self):
        self.path.write_bytes(b"old")
        actual_replace = os.replace
        attempts = []

        def replace(source, target):
            attempts.append((source, target))
            if len(attempts) < 3:
                raise self.transient_error()
            actual_replace(source, target)

        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(platform_files.os, "replace", side_effect=replace),
            mock.patch.object(platform_clocks.time, "sleep") as sleep,
        ):
            platform_files.atomic_write_bytes(self.path, b"new")
        self.assertEqual(self.path.read_bytes(), b"new")
        self.assertEqual(len(attempts), 3)
        self.assertEqual(sleep.call_count, 2)
        self.assertEqual(list(self.root.glob("*.tmp")), [])

    def test_permanent_replace_failure_rolls_back_closes_fd_and_cleans_temp(self):
        self.path.write_bytes(b"old")
        descriptor, temporary = tempfile.mkstemp(dir=self.root)
        with (
            mock.patch.object(
                platform_files.tempfile,
                "mkstemp",
                return_value=(descriptor, temporary),
            ),
            mock.patch.object(
                platform_files.os, "replace", side_effect=OSError(errno.EIO, "broken")
            ),
            self.assertRaises(OSError),
        ):
            platform_files.atomic_write_bytes(self.path, b"new")
        self.assertEqual(self.path.read_bytes(), b"old")
        with self.assertRaises(OSError):
            os.fstat(descriptor)
        self.assertFalse(Path(temporary).exists())

    def test_exception_before_fdopen_still_closes_descriptor(self):
        descriptor, temporary = tempfile.mkstemp(dir=self.root)
        with (
            mock.patch.object(
                platform_files.tempfile,
                "mkstemp",
                return_value=(descriptor, temporary),
            ),
            mock.patch.object(
                platform_files, "_set_private_mode", side_effect=OSError("mode")
            ),
            self.assertRaises(OSError),
        ):
            platform_files.atomic_write_bytes(self.path, b"new")
        with self.assertRaises(OSError):
            os.fstat(descriptor)
        self.assertFalse(Path(temporary).exists())
        self.assertFalse(self.path.exists())

    def test_durable_unlink_retries_windows_transient_failure(self):
        self.path.write_bytes(b"data")
        actual_unlink = Path.unlink
        attempts = 0

        def unlink(target):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise self.transient_error()
            return actual_unlink(target)

        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(Path, "unlink", unlink),
            mock.patch.object(platform_clocks.time, "sleep"),
        ):
            self.assertTrue(platform_files.durable_unlink(self.path))
        self.assertEqual(attempts, 2)
        self.assertFalse(self.path.exists())

    def test_private_mode_is_not_applicable_on_windows(self):
        self.path.write_bytes(b"data")
        with mock.patch.object(platform_environment, "is_windows", return_value=True):
            self.assertIsNone(platform_files.private_mode_matches(self.path, 0o600))
        if os.name == "posix":
            self.path.chmod(0o600)
            self.assertTrue(platform_files.private_mode_matches(self.path, 0o600))


class PathSafetyTests(unittest.TestCase):
    def test_regular_file_is_not_a_link_or_reparse_point(self):
        with tempfile.TemporaryDirectory(prefix="statusline-path-safety-") as root:
            path = Path(root) / "regular"
            path.write_text("x", encoding="utf-8")
            self.assertFalse(platform_files.is_link_or_reparse(path))

    def test_windows_reparse_attribute_is_rejected(self):
        metadata = SimpleNamespace(
            st_mode=stat.S_IFDIR,
            st_file_attributes=getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400),
        )
        with (
            mock.patch.object(Path, "lstat", return_value=metadata),
            mock.patch.object(platform_environment, "is_windows", return_value=True),
        ):
            self.assertTrue(platform_files.is_link_or_reparse(Path("stand-in")))


class ProcessAndClockTests(unittest.TestCase):
    def test_current_and_missing_process_tokens(self):
        token = platform_processes.process_start_token(os.getpid())
        self.assertIsInstance(token, str)
        if platform_environment.is_macos():
            self.assertRegex(
                token, r"^[A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$"
            )
        else:
            self.assertTrue(token.isdecimal())
        self.assertIsNone(platform_processes.process_start_token(-1))
        self.assertIsNone(platform_processes.process_start_token(True))
        self.assertIsNone(platform_processes.process_start_token(2_147_000_000))

    def test_windows_process_token_conversion_and_access_denied(self):
        with (
            mock.patch.object(platform_environment, "is_linux", return_value=False),
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(
                platform_processes,
                "_windows_process_creation_filetime",
                return_value=1230,
            ),
        ):
            expected = platform_processes._DOTNET_FILETIME_OFFSET_TICKS + 1230
            self.assertEqual(platform_processes.process_start_token(42), str(expected))
        with (
            mock.patch.object(platform_environment, "is_linux", return_value=False),
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(
                platform_processes,
                "_windows_process_creation_filetime",
                return_value=None,
            ),
        ):
            self.assertIsNone(platform_processes.process_start_token(42))

    def test_windows_boot_clock_and_wall_clock_fallback(self):
        minute = platform_clocks._MINUTE_NS
        wall = 1_000 * minute + 30_000_000_000
        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(platform_clocks.time, "time_ns", return_value=wall),
            mock.patch.object(
                platform_clocks, "_windows_uptime_ns", return_value=100 * minute
            ),
            mock.patch.object(platform_clocks, "_windows_boot_id", return_value="windows:boot-guid"),
        ):
            self.assertEqual(
                platform_clocks.now_clocks(),
                (wall, 100 * minute, "windows:boot-guid"),
            )

        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(platform_clocks.time, "time_ns", return_value=wall),
            mock.patch.object(
                platform_clocks,
                "_windows_uptime_ns",
                side_effect=OSError("unavailable"),
            ),
        ):
            self.assertEqual(platform_clocks.now_clocks(), (wall, None, None))


if __name__ == "__main__":
    unittest.main(verbosity=2)
