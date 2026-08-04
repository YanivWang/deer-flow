"""Cover scripts/handoff_check.py — the session-handoff state report.

The report is what a fresh agent reads before trusting a previous window's
summary, so the cases that matter are the ones that previously went unnoticed:
uncommitted work, and a Playwright suite whose last recorded run was red.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
HANDOFF_SCRIPT = REPO_ROOT / "scripts" / "handoff_check.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("deerflow_handoff_check", HANDOFF_SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def handoff():
    return _load_module()


def _write_last_run(results_dir: Path, suite: str, status: str) -> None:
    suite_dir = results_dir / suite
    suite_dir.mkdir(parents=True, exist_ok=True)
    (suite_dir / ".last-run.json").write_text(json.dumps({"status": status}), encoding="utf-8")


def test_clean_worktree_reports_clean(handoff, monkeypatch):
    monkeypatch.setattr(handoff, "_git", lambda *args: "")
    assert handoff.collect_worktree() == ["工作树      : 干净"]


def test_uncommitted_changes_are_flagged(handoff, monkeypatch):
    monkeypatch.setattr(handoff, "_git", lambda *args: "M  a.py\n?? b.py")
    lines = handoff.collect_worktree()
    assert "2 个未提交改动" in lines[0]
    assert "⚠" in lines[0], "uncommitted work must be visually flagged, not merely listed"
    assert any("a.py" in line for line in lines)


def test_long_worktree_listing_is_truncated(handoff, monkeypatch):
    monkeypatch.setattr(handoff, "_git", lambda *args: "\n".join(f"M  f{n}.py" for n in range(20)))
    lines = handoff.collect_worktree()
    assert "20 个未提交改动" in lines[0]
    assert any("另有 12 个" in line for line in lines)


def test_failed_playwright_run_is_flagged(handoff, monkeypatch, tmp_path):
    monkeypatch.setattr(handoff, "PLAYWRIGHT_RESULTS", tmp_path)
    _write_last_run(tmp_path, "m0", "passed")
    _write_last_run(tmp_path, "visual", "failed")

    lines = handoff.collect_playwright()
    assert "存在失败记录" in lines[0]
    assert any("visual" in line and "failed" in line and "⚠" in line for line in lines)
    assert any("m0" in line and "passed" in line for line in lines)


def test_all_passed_playwright_runs_are_not_flagged(handoff, monkeypatch, tmp_path):
    monkeypatch.setattr(handoff, "PLAYWRIGHT_RESULTS", tmp_path)
    _write_last_run(tmp_path, "m0", "passed")
    assert "⚠" not in "".join(handoff.collect_playwright())


def test_unreadable_last_run_counts_as_not_passed(handoff, monkeypatch, tmp_path):
    monkeypatch.setattr(handoff, "PLAYWRIGHT_RESULTS", tmp_path)
    suite_dir = tmp_path / "m0"
    suite_dir.mkdir()
    (suite_dir / ".last-run.json").write_text("{not json", encoding="utf-8")

    lines = handoff.collect_playwright()
    assert "存在失败记录" in lines[0]
    assert any("unreadable" in line for line in lines)


def test_missing_results_directory_is_not_an_error(handoff, monkeypatch, tmp_path):
    monkeypatch.setattr(handoff, "PLAYWRIGHT_RESULTS", tmp_path / "absent")
    assert handoff.collect_playwright() == ["Playwright  : 无记录（尚未在本机跑过）"]


def test_git_failure_degrades_instead_of_raising(handoff, monkeypatch):
    def _explode(*_args, **_kwargs):
        raise OSError("git is unavailable")

    monkeypatch.setattr(handoff.subprocess, "run", _explode)
    assert handoff._git("status") == ""
    assert handoff.collect_worktree() == ["工作树      : 干净"]


def test_report_tells_the_reader_to_verify_before_trusting(handoff):
    report = handoff.build_report()
    assert "不要接受上一份摘要的自我评价" in report
    assert "make verify" in report
    assert "evidence/" in report


def test_hook_mode_emits_session_start_context(handoff, capsys, monkeypatch):
    monkeypatch.setattr(handoff.sys, "argv", ["handoff_check.py", "--hook"])
    assert handoff.main() == 0

    payload = json.loads(capsys.readouterr().out)
    assert payload["hookSpecificOutput"]["hookEventName"] == "SessionStart"
    assert "DeerFlow 交接状态" in payload["hookSpecificOutput"]["additionalContext"]


def test_human_mode_prints_plain_text(handoff, capsys, monkeypatch):
    monkeypatch.setattr(handoff.sys, "argv", ["handoff_check.py"])
    assert handoff.main() == 0

    out = capsys.readouterr().out
    assert out.startswith("DeerFlow 交接状态")
    assert not out.lstrip().startswith("{")
