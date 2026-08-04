"""Report the repository handoff state for an agent picking up in-flight work.

This exists because a prose handoff can be confidently wrong. A previous window
recorded two M0 gates as "not executed, browser quota exhausted"; the artifacts
on disk said ``"status": "failed"`` — they had run, and the real causes were a
test race and a stream-bridge retention window that truncated the run. The two
commands that would have caught it are the two this script runs.

So it reports *state*, never a verdict, and deliberately does not run the gates:
it must stay fast enough for a SessionStart hook. Reading it is the cheap step
that tells an agent whether the expensive step is needed.

Usage:
    python3 scripts/handoff_check.py            # human-readable
    python3 scripts/handoff_check.py --hook     # SessionStart hook JSON
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = REPOSITORY / "frontend-vue-build-docs" / "evidence"
PLAYWRIGHT_RESULTS = REPOSITORY / "frontend-vue" / "test-results"
RECENT_COMMITS = 4


def _git(*args: str) -> str:
    """Run a read-only git command; never raise into the caller."""
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=REPOSITORY,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def _age(seconds: float) -> str:
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.0f} 分钟前"
    hours = minutes / 60
    if hours < 48:
        return f"{hours:.0f} 小时前"
    return f"{hours / 24:.0f} 天前"


def collect_worktree() -> list[str]:
    status = _git("status", "--porcelain")
    entries = [line for line in status.splitlines() if line.strip()]
    if not entries:
        return ["工作树      : 干净"]

    # Uncommitted work is the failure this check exists for: a window that ends
    # without committing leaves nothing for `git log` to hand over.
    lines = [f"工作树      : {len(entries)} 个未提交改动  ⚠ 上一个窗口没有提交"]
    lines.extend(f"              {entry}" for entry in entries[:8])
    if len(entries) > 8:
        lines.append(f"              ... 另有 {len(entries) - 8} 个")
    return lines


def collect_commits() -> list[str]:
    log = _git("log", f"-{RECENT_COMMITS}", "--format=%h %s")
    if not log:
        return ["最近提交    : (无)"]
    entries = log.splitlines()
    return ["最近提交    : " + entries[0]] + [
        f"              {entry}" for entry in entries[1:]
    ]


def collect_playwright() -> list[str]:
    """Report each Playwright config's last recorded run.

    A stale green is not evidence, so every entry carries its age.
    """
    if not PLAYWRIGHT_RESULTS.is_dir():
        return ["Playwright  : 无记录（尚未在本机跑过）"]

    now = time.time()
    entries: list[str] = []
    failed = False
    for last_run in sorted(PLAYWRIGHT_RESULTS.glob("*/.last-run.json")):
        suite = last_run.parent.name
        try:
            status = json.loads(last_run.read_text(encoding="utf-8")).get("status", "?")
        except (OSError, ValueError):
            status = "unreadable"
        failed = failed or status != "passed"
        marker = "" if status == "passed" else "  ⚠"
        entries.append(
            f"              {suite:<14} {status:<8} {_age(now - last_run.stat().st_mtime)}{marker}"
        )

    if not entries:
        return ["Playwright  : 无记录（尚未在本机跑过）"]
    header = "Playwright  : 存在失败记录  ⚠" if failed else "Playwright  :"
    return [header, *entries]


def collect_evidence() -> list[str]:
    if not EVIDENCE_DIR.is_dir():
        return []
    now = time.time()
    docs = sorted(EVIDENCE_DIR.glob("*.md"))
    if not docs:
        return []
    return [
        "证据文档    : "
        + f"{docs[0].relative_to(REPOSITORY)}  ({_age(now - docs[0].stat().st_mtime)})"
    ] + [
        f"              {doc.relative_to(REPOSITORY)}  ({_age(now - doc.stat().st_mtime)})"
        for doc in docs[1:]
    ]


def build_report() -> str:
    sections = [
        *collect_worktree(),
        *collect_commits(),
        *collect_playwright(),
        *collect_evidence(),
    ]
    return "\n".join(
        [
            "DeerFlow 交接状态",
            "─" * 46,
            *sections,
            "─" * 46,
            "不要接受上一份摘要的自我评价——它可能与磁盘上的产物矛盾。",
            "动手前先跑门禁取得真实颜色：",
            "    cd frontend-vue && make verify && make e2e-m0",
            "结束前必须提交；结论写进 frontend-vue-build-docs/evidence/ 并附可复跑命令。",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--hook",
        action="store_true",
        help="Emit SessionStart hook JSON so the report lands in the agent's context.",
    )
    args = parser.parse_args()

    report = build_report()
    if args.hook:
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": report,
                },
                "suppressOutput": True,
            },
            sys.stdout,
        )
        sys.stdout.write("\n")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
