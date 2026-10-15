"""macOS adapters: deterministic failure cases and native runner checks."""

from claude_statusline.integration import doctor as integration_doctor
from claude_statusline.integration import installer as integration_installer
from claude_statusline.platforms import clocks as platform_clocks
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import macos_terminal as platform_macos_terminal
from claude_statusline.platforms import processes as platform_processes

import ctypes
import errno
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
from tests.support import SOURCE_ROOT

import unittest
from types import SimpleNamespace
from unittest import mock


BOOT_UUID = "12345678-1234-5678-9abc-123456789abc"


class MacOSProcessTests(unittest.TestCase):
    def test_token_preserves_claude_ps_spacing_and_overrides_locale_and_timezone(self):
        completed = subprocess.CompletedProcess(
            [], 0, "  Fri Oct  2 01:02:03 2026\n", ""
        )
        with (
            mock.patch.object(platform_environment, "is_linux", return_value=False),
            mock.patch.object(platform_environment, "is_windows", return_value=False),
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.dict(
                os.environ, {"LC_ALL": "zh_CN.UTF-8", "TZ": "Asia/Shanghai"}
            ),
            mock.patch.object(
                platform_processes.subprocess, "run", return_value=completed
            ) as run,
        ):
            self.assertEqual(
                platform_processes.process_start_token(42), "Fri Oct  2 01:02:03 2026"
            )
            self.assertIsNone(platform_processes.process_start_token(True))
        self.assertEqual(run.call_count, 1)
        self.assertEqual(
            run.call_args.args[0], ["/bin/ps", "-o", "lstart=", "-p", "42"]
        )
        self.assertEqual(run.call_args.kwargs["env"]["LC_ALL"], "C")
        self.assertEqual(run.call_args.kwargs["env"]["TZ"], "UTC")
        self.assertEqual(run.call_args.kwargs["timeout"], 1)
        self.assertFalse(run.call_args.kwargs["check"])

    def test_failed_empty_and_unreadable_ps_results_are_unverifiable(self):
        for result in (
            subprocess.CompletedProcess([], 1, "unexpected output", "missing process"),
            subprocess.CompletedProcess([], 0, " \n", ""),
        ):
            with (
                self.subTest(result=result),
                mock.patch.object(
                    platform_processes.subprocess, "run", return_value=result
                ),
            ):
                self.assertIsNone(platform_processes._macos_process_start_token(42))
        for error in (OSError("unavailable"), subprocess.TimeoutExpired("ps", 1)):
            with (
                self.subTest(error=error),
                mock.patch.object(
                    platform_processes.subprocess, "run", side_effect=error
                ),
            ):
                self.assertIsNone(platform_processes._macos_process_start_token(42))


class MacOSClockTests(unittest.TestCase):
    def setUp(self):
        platform_clocks._macos_clock_api.cache_clear()
        self.addCleanup(platform_clocks._macos_clock_api.cache_clear)

    @staticmethod
    def library(
        *,
        numer=125,
        denom=3,
        ticks=9_007_199_254_740_993,
        timebase_result=0,
        sysctl_result=0,
        uuid=BOOT_UUID,
    ):
        def timebase(pointer):
            pointer._obj.numer, pointer._obj.denom = numer, denom
            return timebase_result

        def sysctl(name, buffer, length, new_value, new_length):
            if (
                name != b"kern.bootsessionuuid"
                or new_value is not None
                or new_length != 0
            ):
                raise AssertionError("expected a read-only boot session UUID query")
            buffer.value = uuid.encode("ascii")
            length._obj.value = len(buffer.value) + 1
            return sysctl_result

        return SimpleNamespace(
            mach_continuous_time=mock.Mock(return_value=ticks),
            mach_timebase_info=mock.Mock(side_effect=timebase),
            sysctlbyname=mock.Mock(side_effect=sysctl),
        )

    def test_native_binding_uses_uint64_and_integer_nanoseconds_without_precision_loss(
        self,
    ):
        library = self.library()
        with mock.patch.object(ctypes, "CDLL", return_value=library) as load:
            self.assertEqual(
                platform_clocks._macos_boot_clock(),
                (375_299_968_947_541_375, f"darwin:{BOOT_UUID}"),
            )
            self.assertEqual(
                platform_clocks._macos_boot_clock()[1], f"darwin:{BOOT_UUID}"
            )
        load.assert_called_once_with("/usr/lib/libSystem.B.dylib", use_errno=True)
        self.assertIs(library.mach_continuous_time.restype, ctypes.c_uint64)
        self.assertIs(library.sysctlbyname.argtypes[2]._type_, ctypes.c_size_t)

    def test_failed_native_api_or_missing_reboot_id_falls_back_as_one_unit(self):
        for options in (
            {"timebase_result": 1},
            {"numer": 0},
            {"denom": 0},
            {"sysctl_result": -1},
            {"uuid": ""},
            {"uuid": "invalid-uuid"},
            {"ticks": -1},
        ):
            with self.subTest(options=options):
                platform_clocks._macos_clock_api.cache_clear()
                with (
                    mock.patch.object(
                        platform_environment, "is_linux", return_value=False
                    ),
                    mock.patch.object(
                        platform_environment, "is_windows", return_value=False
                    ),
                    mock.patch.object(
                        platform_environment, "is_macos", return_value=True
                    ),
                    mock.patch.object(
                        platform_clocks.time, "time_ns", return_value=12345
                    ),
                    mock.patch.object(
                        ctypes, "CDLL", return_value=self.library(**options)
                    ),
                ):
                    self.assertEqual(platform_clocks.now_clocks(), (12345, None, None))

    def test_missing_library_is_a_wall_clock_fallback(self):
        with (
            mock.patch.object(platform_environment, "is_linux", return_value=False),
            mock.patch.object(platform_environment, "is_windows", return_value=False),
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(ctypes, "CDLL", side_effect=OSError("unavailable")),
        ):
            wall, boot, boot_id = platform_clocks.now_clocks()
        self.assertIsInstance(wall, int)
        self.assertEqual((boot, boot_id), (None, None))

    def test_clock_success_keeps_reboot_identifier_independent_of_wall_clock(self):
        with (
            mock.patch.object(platform_environment, "is_linux", return_value=False),
            mock.patch.object(platform_environment, "is_windows", return_value=False),
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(ctypes, "CDLL", return_value=self.library(ticks=3)),
            mock.patch.object(
                platform_clocks.time, "time_ns", side_effect=[10_000, 100]
            ),
        ):
            self.assertEqual(
                platform_clocks.now_clocks(), (10_000, 125, f"darwin:{BOOT_UUID}")
            )
            self.assertEqual(
                platform_clocks.now_clocks(), (100, 125, f"darwin:{BOOT_UUID}")
            )


class MacOSDirectorySyncTests(unittest.TestCase):
    def test_only_macos_unsupported_directory_sync_is_softened(self):
        for macos, error, softened in (
            (True, errno.EINVAL, True),
            (True, errno.ENOTSUP, True),
            (True, errno.EOPNOTSUPP, True),
            (True, errno.EIO, False),
            (True, errno.EACCES, False),
            (False, errno.EINVAL, False),
        ):
            with (
                self.subTest(macos=macos, error=error),
                mock.patch.object(
                    platform_environment, "uses_posix_files", return_value=True
                ),
                mock.patch.object(platform_environment, "is_macos", return_value=macos),
                mock.patch.object(platform_files.os, "open", return_value=42),
                mock.patch.object(
                    platform_files.os,
                    "fsync",
                    side_effect=OSError(error, "sync failed"),
                ),
                mock.patch.object(platform_files.os, "close") as close,
            ):
                if softened:
                    self.assertIs(
                        platform_files._sync_parent_directory(
                            Path("unused/state.json")
                        ),
                        False,
                    )
                else:
                    with self.assertRaises(OSError):
                        platform_files._sync_parent_directory(Path("unused/state.json"))
                close.assert_called_once_with(42)


@unittest.skipUnless(os.name == "posix", "real POSIX permissions required")
class MacOSInstallationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="statusline-macos-install-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.config = self.root / "配置 with spaces"
        self.executable = self.root / "bin with spaces" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        self.executable.chmod(0o755)
        patcher = mock.patch.object(platform_environment.sys, "platform", "darwin")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_install_repairs_runtime_lock_and_backup_permissions_then_is_idempotent(
        self,
    ):
        result = integration_installer.install_configuration(
            self.config,
            self.executable,
            dry_run=True,
            claude_version=(2, 1, 258),
        )
        self.assertTrue(result.changed)
        self.assertFalse(self.config.exists())
        runtime = self.config / "statusline_runtime"
        runtime.mkdir(parents=True)
        runtime.chmod(0o755)
        lock = runtime / "install.lock"
        lock.write_text("", encoding="utf-8")
        lock.chmod(0o644)
        backup_root = self.config / "backups" / "statusline"
        backup_root.mkdir(parents=True)
        backup_root.chmod(0o755)
        result = integration_installer.install_configuration(
            self.config,
            self.executable,
            claude_version=(2, 1, 258),
        )
        for directory in (runtime, backup_root, result.backup_dir):
            self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        for path in (
            lock,
            self.config / "settings.json",
            *result.backup_dir.rglob("*"),
        ):
            self.assertEqual(
                stat.S_IMODE(path.stat().st_mode), 0o700 if path.is_dir() else 0o600
            )
        again = integration_installer.install_configuration(
            self.config,
            self.executable,
            claude_version=(2, 1, 258),
        )
        self.assertFalse(again.changed)
        self.assertEqual(len(list(backup_root.iterdir())), 1)

    def test_doctor_reports_native_capabilities_or_degradation_without_opening_terminal(
        self,
    ):

        integration_installer.install_configuration(
            self.config,
            self.executable,
            claude_version=(2, 1, 258),
            experimental_slash_tui=True,
        )
        original_which = shutil.which
        for available in (True, False):
            with (
                self.subTest(available=available),
                mock.patch.object(
                    integration_doctor.stdlib_platform, "machine", return_value="arm64"
                ),
                mock.patch.object(
                    integration_doctor.stdlib_platform,
                    "mac_ver",
                    return_value=("15.0", (), ""),
                ),
                mock.patch.object(
                    platform_processes,
                    "process_start_token",
                    return_value="start" if available else None,
                ),
                mock.patch.object(
                    platform_clocks,
                    "now_clocks",
                    return_value=(123, 12, "boot") if available else (123, None, None),
                ),
                mock.patch.object(
                    platform_files, "_sync_parent_directory", return_value=available
                ),
                mock.patch.object(
                    platform_macos_terminal,
                    "availability",
                    return_value=(False, "no GUI session"),
                ),
                mock.patch.object(
                    integration_doctor.shutil,
                    "which",
                    side_effect=lambda name: (
                        None if name == "tmux" else original_which(name)
                    ),
                ),
            ):
                diagnostics = integration_doctor.collect_diagnostics(
                    self.config, self.executable, claude_version=(2, 1, 258)
                )
            self.assertFalse(
                [item.message for item in diagnostics if item.level == "ERROR"]
            )
            self.assertTrue(
                any("platform: darwin" == item.message for item in diagnostics)
            )
            self.assertFalse(any("preview" in item.message for item in diagnostics))
            self.assertTrue(
                any(
                    "install tmux" in item.message and item.level == "WARN"
                    for item in diagnostics
                )
            )
            expected = "OK" if available else "WARN"
            for capability in (
                "process start verification",
                "suspend-aware clock",
                "parent-directory sync",
            ):
                self.assertTrue(
                    any(
                        capability in item.message and item.level == expected
                        for item in diagnostics
                    )
                )

    def test_file_sync_failure_is_not_treated_as_unsupported_directory_sync(self):
        target = self.root / "state.json"
        target.write_bytes(b"old")
        with mock.patch.object(
            platform_files.os,
            "fsync",
            side_effect=OSError(errno.EINVAL, "file sync failed"),
        ):
            with self.assertRaises(OSError):
                platform_files.atomic_write_bytes(target, b"new")
        self.assertEqual(target.read_bytes(), b"old")
        self.assertFalse(list(self.root.glob("*.tmp")))


@unittest.skipUnless(sys.platform == "darwin", "native macOS APIs required")
class NativeMacOSTests(unittest.TestCase):
    def test_continuous_clock_and_reboot_id_are_valid_and_shared_between_processes(
        self,
    ):
        wall, before, boot_id = platform_clocks.now_clocks()
        self.assertIsInstance(before, int)
        self.assertGreater(before, 0)
        self.assertLess(before, wall)
        self.assertRegex(boot_id, r"^darwin:[0-9a-f-]{36}$")
        environment = os.environ.copy()
        environment["PYTHONPATH"] = str(SOURCE_ROOT)
        child = subprocess.run(
            [
                sys.executable,
                "-c",
                "import json; from claude_statusline import _platform; print(json.dumps(_platform.now_clocks()))",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=environment,
            check=True,
            timeout=10,
        )
        _child_wall, child_clock, child_id = json.loads(child.stdout)
        self.assertEqual(child_id, boot_id)
        self.assertGreaterEqual(child_clock, before)
        self.assertGreaterEqual(platform_clocks.now_clocks()[1], child_clock)
        self.assertIn(platform.machine(), {"arm64", "x86_64"})

    def test_child_process_becomes_unverifiable_after_exit(self):
        child = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(30)"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            token = platform_processes.process_start_token(child.pid)
            self.assertIsInstance(token, str)
            self.assertRegex(
                token, r"^[A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$"
            )
        finally:
            child.kill()
            child.wait(timeout=5)
        self.assertIsNone(platform_processes.process_start_token(child.pid))


if __name__ == "__main__":
    unittest.main()
