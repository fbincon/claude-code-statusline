"""Native Windows shell compatibility smoke tests."""

from claude_statusline.integration import installer as integration_installer

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


def _git_bash() -> str | None:
    candidates = [
        Path(r"E:\gitNew\Program\Git\bin\bash.exe"),
        Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
        / "Git"
        / "bin"
        / "bash.exe",
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"))
        / "Git"
        / "bin"
        / "bash.exe",
    ]
    return next((str(path) for path in candidates if path.is_file()), None)


@unittest.skipUnless(os.name == "nt", "native Windows shell behavior")
class WindowsShellSmokeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(
            prefix="statusline Windows 中文 shell "
        )
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.config_dir = self.root / "Claude 配置"
        executable = shutil.which("claude-statusline.exe")
        if executable is None:
            self.skipTest("installed claude-statusline.exe is required")
        self.executable = Path(executable)
        integration_installer.install_configuration(
            self.config_dir,
            self.executable,
            claude_version=(2, 1, 258),
        )
        self.environment = os.environ.copy()
        self.environment["CLAUDE_CONFIG_DIR"] = str(self.config_dir)
        self.environment["PYTHONUTF8"] = "1"

    def _run_powershell(
        self, fixture: Path, subcommand: str
    ) -> subprocess.CompletedProcess:
        escaped = str(fixture).replace("'", "''")
        script = (
            "$OutputEncoding = [System.Text.UTF8Encoding]::new($false); "
            f"Get-Content -LiteralPath '{escaped}' -Raw -Encoding UTF8 | "
            f"& claude-statusline.exe {subcommand}; exit $LASTEXITCODE"
        )
        return subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", script],
            capture_output=True,
            env=self.environment,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def _run_git_bash(
        self, fixture: Path, subcommand: str
    ) -> subprocess.CompletedProcess:
        bash = _git_bash()
        if bash is None:
            self.skipTest("Git Bash is required")
        return subprocess.run(
            [
                bash,
                "-c",
                f'claude-statusline.exe {subcommand} < "$1"',
                "statusline-test",
                str(fixture),
            ],
            capture_output=True,
            env=self.environment,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def test_installed_main_and_subagent_commands_match_in_both_shells(self):
        settings = json.loads(
            (self.config_dir / "settings.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            settings["statusLine"]["command"], "claude-statusline.exe render"
        )
        self.assertEqual(
            settings["subagentStatusLine"]["command"],
            "claude-statusline.exe render-subagents",
        )

        fixtures = {
            "render": {
                "model": {"id": "claude-测试"},
                "workspace": {
                    "current_dir": r"C:\Users\测试 User\项目\src",
                    "project_dir": r"C:\Users\测试 User\项目",
                },
                "context_window": {
                    "remaining_percentage": 75,
                    "context_window_size": 200000,
                },
                "rate_limits": {},
            },
            "render-subagents": {
                "columns": 100,
                "tasks": [
                    {
                        "id": "agent-1",
                        "name": "研究员",
                        "status": "running",
                        "description": "检查 Windows 路径",
                    }
                ],
            },
        }
        for subcommand, payload in fixtures.items():
            with self.subTest(subcommand=subcommand):
                fixture = self.root / f"{subcommand} 输入.json"
                fixture.write_bytes(
                    b"\xef\xbb\xbf"
                    + json.dumps(payload, ensure_ascii=False).encode("utf-8")
                )
                powershell = self._run_powershell(fixture, subcommand)
                git_bash = self._run_git_bash(fixture, subcommand)
                self.assertEqual(powershell.returncode, 0, powershell.stderr)
                self.assertEqual(git_bash.returncode, 0, git_bash.stderr)
                self.assertTrue(powershell.stdout)
                self.assertEqual(powershell.stdout, git_bash.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
