"""Hermetic filesystem seed for the Vue real-settings acceptance gate.

This fixture only prepares operator-owned inputs before the production Gateway
is imported.  Auth, CSRF, MemoryManager, skills/MCP routers, atomic config
writes, caches, and reloads remain the real implementation.
"""

from __future__ import annotations

import json
from pathlib import Path

_MEMORY_BLOCK = """memory:
  enabled: false
  injection_enabled: false
"""
_SETTINGS_TEST_MEMORY_BACKENDS = frozenset({"deermem", "noop"})


def configure_settings_memory_backend(config_yaml: str, backend: str) -> str:
    """Select a checked-in memory backend without adding a second YAML key.

    This helper is deliberately limited to the two backends exercised by the
    acceptance gate.  It edits the hermetic replay config before the
    production Gateway imports its config singleton; it does not replace or
    patch the production manager factory.
    """

    if backend not in _SETTINGS_TEST_MEMORY_BACKENDS:
        raise ValueError(f"Unsupported settings test memory backend: {backend}")
    if config_yaml.count(_MEMORY_BLOCK) != 1:
        raise ValueError("Hermetic replay config does not contain the expected memory block")
    return config_yaml.replace(
        _MEMORY_BLOCK,
        f"{_MEMORY_BLOCK}  manager_class: {backend}\n",
        1,
    )


def publish_settings_test_home(home: Path, marker: Path) -> None:
    """Expose only this run's temporary home to the filesystem assertions."""

    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(str(home.resolve()), encoding="utf-8")


def prepare_settings_e2e_fixture(home: Path, extensions_path: Path) -> None:
    skill_dir = home / "skills" / "public" / "review"
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        """---
name: review
description: Review source changes and report actionable findings.
license: MIT
---

# Review

Inspect the requested source and report evidence-backed findings.
""",
        encoding="utf-8",
    )
    extensions_path.write_text(
        json.dumps(
            {
                "mcpServers": {
                    "docs": {
                        "enabled": True,
                        "type": "stdio",
                        "command": "/usr/bin/true",
                        "args": [],
                        "env": {"E2E_SECRET": "must-stay-masked"},
                        "description": "Hermetic documentation tools",
                    }
                },
                "skills": {"review": {"enabled": True}},
            }
        ),
        encoding="utf-8",
    )
