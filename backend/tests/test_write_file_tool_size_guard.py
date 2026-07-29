"""Size-guard tests for write_file_tool (issue #3189, PR #3195).

These tests verify that write_file_tool rejects oversized payloads with an
actionable message, keeps small append chunks working, and refuses clearly
truncated completed HTML documents. They run purely against the tool's internal
guard — no real sandbox or filesystem is exercised, so they're fast and
hermetic.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from deerflow.sandbox import tools as tools_module
from deerflow.sandbox.tools import (
    append_artifact_chunk_tool,
    begin_artifact_write_tool,
    finalize_artifact_write_tool,
    str_replace_tool,
    write_file_tool,
)


class _InMemorySandbox:
    def __init__(self) -> None:
        self.files: dict[str, str] = {}

    def read_file(self, path: str) -> str:
        if path not in self.files:
            raise FileNotFoundError(path)
        return self.files[path]

    def write_file(self, path: str, content: str, append: bool = False) -> None:
        if append:
            self.files[path] = self.files.get(path, "") + content
        else:
            self.files[path] = content


def _call_write_file(
    *,
    content: str,
    append: bool = False,
    path: str = "/tmp/test.txt",
    existing_content: str = "",
) -> str:
    """Invoke write_file_tool via its underlying callable.

    We patch the sandbox initialisation chain to a no-op MagicMock so the test
    focuses purely on the size guard. The guard runs BEFORE any sandbox call,
    so when the guard rejects we never enter the patched path; when the guard
    passes, the patched sandbox.write_file returns silently and the tool
    returns "OK".
    """
    fn = getattr(write_file_tool, "func", write_file_tool)
    runtime = MagicMock()

    with (
        patch.object(tools_module, "ensure_sandbox_initialized") as mock_ensure,
        patch.object(tools_module, "ensure_thread_directories_exist"),
        patch.object(tools_module, "is_local_sandbox", return_value=False),
        patch.object(tools_module, "get_file_operation_lock") as mock_lock,
    ):
        sandbox = MagicMock()
        sandbox.write_file = MagicMock()
        sandbox.read_file = MagicMock(return_value=existing_content)
        mock_ensure.return_value = sandbox
        mock_lock.return_value.__enter__ = MagicMock(return_value=None)
        mock_lock.return_value.__exit__ = MagicMock(return_value=False)

        return fn(
            runtime=runtime,
            description="test write",
            path=path,
            content=content,
            append=append,
        )


def _call_str_replace(
    *,
    existing_content: str,
    old_str: str,
    new_str: str,
    path: str = "/tmp/test.html",
) -> str:
    fn = getattr(str_replace_tool, "func", str_replace_tool)
    runtime = MagicMock()

    with (
        patch.object(tools_module, "ensure_sandbox_initialized") as mock_ensure,
        patch.object(tools_module, "ensure_thread_directories_exist"),
        patch.object(tools_module, "is_local_sandbox", return_value=False),
        patch.object(tools_module, "get_file_operation_lock") as mock_lock,
    ):
        sandbox = MagicMock()
        sandbox.read_file = MagicMock(return_value=existing_content)
        sandbox.write_file = MagicMock()
        mock_ensure.return_value = sandbox
        mock_lock.return_value.__enter__ = MagicMock(return_value=None)
        mock_lock.return_value.__exit__ = MagicMock(return_value=False)

        return fn(
            runtime=runtime,
            description="test replace",
            path=path,
            old_str=old_str,
            new_str=new_str,
        )


def _call_artifact_tool(
    tool_obj,
    sandbox: _InMemorySandbox,
    **kwargs,
) -> str:
    fn = getattr(tool_obj, "func", tool_obj)
    runtime = MagicMock()

    with (
        patch.object(tools_module, "ensure_sandbox_initialized") as mock_ensure,
        patch.object(tools_module, "ensure_thread_directories_exist"),
        patch.object(tools_module, "is_local_sandbox", return_value=False),
        patch.object(tools_module, "get_file_operation_lock") as mock_lock,
    ):
        mock_ensure.return_value = sandbox
        mock_lock.return_value.__enter__ = MagicMock(return_value=None)
        mock_lock.return_value.__exit__ = MagicMock(return_value=False)
        return fn(runtime=runtime, description="artifact test", **kwargs)


def test_below_cap_succeeds():
    """A 79 KB payload sits comfortably under the 80 KB default and must pass
    straight through to the sandbox layer.
    """
    payload = "a" * (79 * 1024)
    result = _call_write_file(content=payload)
    assert result == "OK"


def test_above_cap_returns_actionable_error():
    """An 81 KB payload trips the guard. The error message must name the
    cap, the actual size, and steer the LLM toward str_replace / the staged
    artifact protocol instead of retrying a large write_file payload.
    """
    payload = "a" * (81 * 1024)
    result = _call_write_file(content=payload)

    assert result.startswith("Error: write_file content")
    assert "81920 bytes" in result or "82944 bytes" in result, "Error must report the actual content size so the LLM/operator can judge how much to trim or chunk."
    assert "str_replace" in result, "Error must point to str_replace as the preferred incremental-edit path."
    assert "begin_artifact_write" in result, "Error must surface the staged artifact protocol."
    assert "append_artifact_chunk" in result, "Error must surface the staged artifact protocol."
    assert "append=True" not in result, "Oversized writes must not steer the model back to write_file append loops."


def test_above_cap_with_append_true_is_rejected():
    """append=True is the correct way to write a large document in chunks, but
    each chunk must still stay under the streaming-safe single-call cap.
    """
    payload = "a" * (200 * 1024)  # 200 KB
    result = _call_write_file(content=payload, append=True)
    assert result.startswith("Error: write_file content")
    assert "single-call limit" in result


def test_below_cap_with_append_true_succeeds():
    payload = "a" * (16 * 1024)
    result = _call_write_file(content=payload, append=True)
    assert result == "OK"


def test_env_override_raises_cap(monkeypatch: pytest.MonkeyPatch):
    """Setting DEERFLOW_WRITE_FILE_MAX_BYTES lets deployments accept larger
    payloads when the underlying LLM/network can demonstrably handle them.
    """
    monkeypatch.setenv("DEERFLOW_WRITE_FILE_MAX_BYTES", str(300 * 1024))
    payload = "a" * (150 * 1024)  # 150 KB — would normally trip the 80 KB cap
    result = _call_write_file(content=payload)
    assert result == "OK"


def test_env_override_zero_disables_guard(monkeypatch: pytest.MonkeyPatch):
    """Setting the env var to 0 is the documented escape hatch for operators
    who want to opt out of the guard entirely (e.g. when running models with
    very large stream_chunk_timeout values).
    """
    monkeypatch.setenv("DEERFLOW_WRITE_FILE_MAX_BYTES", "0")
    payload = "a" * (500 * 1024)  # 500 KB
    result = _call_write_file(content=payload)
    assert result == "OK"


def test_html_complete_document_succeeds():
    payload = "<!doctype html><html><head><title>ok</title></head><body><h1>OK</h1></body></html>"
    result = _call_write_file(content=payload, path="/tmp/report.html")
    assert result == "OK"


def test_html_complete_document_without_explicit_head_succeeds():
    payload = "<!doctype html><html><body><h1>OK</h1></body></html>"
    result = _call_write_file(content=payload, path="/tmp/report.html")
    assert result == "OK"


def test_html_prefix_chunk_without_closing_document_succeeds():
    payload = "<!doctype html><html><head><style>.hero{color:red}"
    result = _call_write_file(content=payload, path="/tmp/report.html")
    assert result == "OK"


def test_html_final_append_validates_combined_document():
    existing = "<!doctype html><html><head><style>.hero{color:red}</style></head><body><h1>OK</h1>"
    result = _call_write_file(
        content="</body></html>",
        append=True,
        path="/tmp/report.html",
        existing_content=existing,
    )
    assert result == "OK"


def test_html_truncated_tail_is_rejected():
    payload = "/* TIMELINE */\n.timeline{color:red}\n</style></head><body><h1>Broken</h1></body></html>"
    result = _call_write_file(content=payload, path="/tmp/report.html")
    assert result.startswith("Error: HTML appears truncated")
    assert "style" in result or "head" in result


def test_str_replace_rejects_truncated_completed_html():
    existing = "<!doctype html><html><body><h1>OK</h1></body></html>"
    broken = "/* TIMELINE */\n.timeline{color:red}\n</style></head><body><h1>Broken</h1></body></html>"
    result = _call_str_replace(
        existing_content=existing,
        old_str=existing,
        new_str=broken,
    )
    assert result.startswith("Error: HTML appears truncated")


def test_env_override_malformed_falls_back_to_default(monkeypatch: pytest.MonkeyPatch):
    """A typo in the env var (e.g. 'lots') must not crash the tool — fall
    back silently to the safe 80 KB default. Crashing on every write because
    of a misconfigured env var would be far worse than ignoring it.
    """
    monkeypatch.setenv("DEERFLOW_WRITE_FILE_MAX_BYTES", "lots")
    # 100 KB should still be rejected because the malformed value falls back
    # to the 80 KB default.
    payload = "a" * (100 * 1024)
    result = _call_write_file(content=payload)
    assert result.startswith("Error: write_file content")


def test_artifact_protocol_finalizes_complete_html():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.html"
    first = "<!doctype html><html><head><style>.hero{color:red}</style></head><body><h1>"
    second = "OK</h1></body></html>"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path, total_chunks=2).startswith("OK")
    assert _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=0, content=first).startswith("OK")
    assert _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=1, content=second).startswith("OK")

    result = _call_artifact_tool(finalize_artifact_write_tool, sandbox, path=path, expected_chunks=2)

    assert result.startswith("OK: finalized artifact")
    assert sandbox.files[path] == first + second


def test_artifact_protocol_rejects_out_of_order_chunk():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.md"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path).startswith("OK")
    result = _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=1, content="# Later")

    assert result.startswith("Error: Expected chunk_index 0")
    assert path not in sandbox.files


def test_artifact_protocol_rejects_oversized_chunk():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.md"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path).startswith("OK")
    result = _call_artifact_tool(
        append_artifact_chunk_tool,
        sandbox,
        path=path,
        chunk_index=0,
        content="a" * (11 * 1024),
    )

    assert result.startswith("Error: artifact chunk")
    assert "single-chunk limit" in result


def test_artifact_protocol_rejects_truncated_html_on_finalize():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.html"
    broken = "/* TIMELINE */\n.timeline{color:red}\n</style></head><body><h1>Broken</h1></body></html>"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path, total_chunks=1).startswith("OK")
    assert _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=0, content=broken).startswith("OK")
    result = _call_artifact_tool(finalize_artifact_write_tool, sandbox, path=path, expected_chunks=1)

    assert result.startswith("Error: HTML appears truncated")
    assert "final target file was not written" in result
    assert path not in sandbox.files


def test_artifact_protocol_validates_final_sha256():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.md"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path).startswith("OK")
    assert _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=0, content="# OK").startswith("OK")
    result = _call_artifact_tool(finalize_artifact_write_tool, sandbox, path=path, final_sha256="not-the-digest")

    assert result.startswith("Error: artifact final SHA-256 mismatch")
    assert path not in sandbox.files


def test_artifact_protocol_rejects_append_after_finalize():
    sandbox = _InMemorySandbox()
    path = "/tmp/report.md"

    assert _call_artifact_tool(begin_artifact_write_tool, sandbox, path=path).startswith("OK")
    assert _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=0, content="# OK").startswith("OK")
    assert _call_artifact_tool(finalize_artifact_write_tool, sandbox, path=path).startswith("OK")
    result = _call_artifact_tool(append_artifact_chunk_tool, sandbox, path=path, chunk_index=1, content="\nextra")

    assert result.startswith("Error: Artifact write session")
    assert sandbox.files[path] == "# OK"
