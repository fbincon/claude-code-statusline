"""Explicit identities for the independently owned, bundled Mods."""

from dataclasses import dataclass
from pathlib import Path

from claude_statusline.config import native, runtime


@dataclass(frozen=True)
class ModSpec:
    name: str
    marketplace: str
    minimum_version: tuple[int, int, int]
    label: str
    flag: str

    @property
    def plugin(self):
        return self.name + "@" + self.marketplace

    def requested(self, config_dir: Path):
        preference = native if self.name == "statusline-native" else runtime
        return preference.requested(config_dir, None)

    def bundled_files(self):
        from claude_statusline.integration import native_resources

        # Retain the existing no-argument source/inventory interface.
        if self.name == "statusline-native":
            return native_resources.bundled_files()
        return native_resources.bundled_files(self.name)


NATIVE = ModSpec(
    "statusline-native",
    "claude-statusline-local",
    (2, 1, 287),
    "Native editor",
    "native-editor",
)
RUNTIME = ModSpec(
    "statusline-runtime",
    "claude-statusline-runtime-local",
    (2, 1, 289),
    "Live metrics",
    "live-metrics",
)
SPECS = (NATIVE, RUNTIME)
