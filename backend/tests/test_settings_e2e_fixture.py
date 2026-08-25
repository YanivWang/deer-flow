"""Contracts for the explicitly enabled Vue real-settings fixture."""

from pathlib import Path

import pytest
from settings_e2e_fixture import configure_settings_memory_backend, publish_settings_test_home


def test_configure_settings_memory_backend_selects_noop_without_duplicate_yaml_section() -> None:
    source = """memory:
  enabled: false
  injection_enabled: false
summarization:
  enabled: false
"""

    configured = configure_settings_memory_backend(source, "noop")

    assert configured.count("memory:") == 1
    assert "memory:\n  enabled: false\n  injection_enabled: false\n  manager_class: noop\n" in configured


def test_configure_settings_memory_backend_rejects_unowned_backend() -> None:
    with pytest.raises(ValueError, match="Unsupported settings test memory backend"):
        configure_settings_memory_backend("memory:\n  enabled: false\n", "mem0")


def test_publish_settings_test_home_writes_only_the_requested_marker(tmp_path: Path) -> None:
    home = tmp_path / "gateway-home"
    marker = tmp_path / "nested" / "home.txt"
    home.mkdir()

    publish_settings_test_home(home, marker)

    assert marker.read_text(encoding="utf-8") == str(home.resolve())
    assert sorted(path.relative_to(tmp_path).as_posix() for path in tmp_path.rglob("*")) == [
        "gateway-home",
        "nested",
        "nested/home.txt",
    ]
