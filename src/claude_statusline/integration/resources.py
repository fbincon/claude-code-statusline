"""integration / resources implementation."""

from __future__ import annotations

import json
import shlex
from importlib import resources
from claude_statusline.config import catalog
from pathlib import Path
from claude_statusline.config import storage as config_storage
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment


def skill_paths(
    config_dir: Path,
    command_name: str = integration_models.SLASH_COMMAND_NAME,
) -> tuple[Path, Path]:
    if command_name == integration_models.SLASH_COMMAND_NAME:
        relative = integration_models.SKILL_RELATIVE_PATH
        owner_relative = integration_models.SKILL_OWNER_RELATIVE_PATH
    elif command_name == integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME:
        relative = integration_models.EXPERIMENTAL_SKILL_RELATIVE_PATH
        owner_relative = integration_models.EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH
    else:
        raise ValueError(f"unsupported skill: {command_name}")
    return config_dir / relative, config_dir / owner_relative


def experimental_skill_paths(config_dir: Path) -> tuple[Path, Path]:
    return skill_paths(config_dir, integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME)


def _skill_owner_bytes() -> bytes:
    return config_storage._json_bytes(
        {
            "owner": integration_models.SKILL_OWNER,
            "schema_version": integration_models.SKILL_OWNER_SCHEMA,
        }
    )


def _render_skill_resource(resource_name: str) -> bytes:
    try:
        template = (
            resources.files("claude_statusline")
            .joinpath(f"resources/{resource_name}/SKILL.md")
            .read_text(encoding="utf-8")
        )
    except (FileNotFoundError, OSError) as exc:
        raise integration_models.ConfigurationError(
            f"cannot load bundled {resource_name} skill: {exc}"
        ) from exc
    return template.encode("utf-8")


def render_skill(executable: Path) -> bytes:
    template = _render_skill_resource(integration_models.SLASH_COMMAND_NAME).decode(
        "utf-8"
    )
    shell_command = (
        "claude-statusline.exe"
        if platform_environment.is_windows()
        else shlex.quote(str(executable))
    )
    rules = [f"Bash({shell_command} config *)"]
    if platform_environment.is_windows():
        rules.append(f"PowerShell({shell_command} config *)")
    allowed_rules = "\n".join(
        f"  - {json.dumps(rule, ensure_ascii=False)}" for rule in rules
    )
    rendered = template.replace(
        "__CLAUDE_STATUSLINE_ALLOWED_RULES__", allowed_rules
    ).replace("__CLAUDE_STATUSLINE_COMMAND__", shell_command).replace(
        "__CLAUDE_STATUSLINE_ITEM_GROUPS__", catalog.wizard_groups()
    )
    if "__CLAUDE_STATUSLINE_" in rendered:
        raise integration_models.ConfigurationError(
            "bundled statusline-config skill has unresolved placeholders"
        )
    return rendered.encode("utf-8")


def render_experimental_skill() -> bytes:
    return _render_skill_resource(integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME)
