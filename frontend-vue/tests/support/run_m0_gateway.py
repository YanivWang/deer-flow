"""
【文件职责】     启动带受控事件保留窗口的真实 replay Gateway 供 M0 协议测试。
【对应 frontend/】 frontend/playwright.real-backend.config.ts
【架构位置】     测试
【主要导出】     main
【依赖关系】     复用 backend replay fixture/config builder 与 Gateway app
【边界与注意】   临时配置写入系统临时目录，不读取或覆盖用户 config.yaml。
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

_REPOSITORY = Path(__file__).resolve().parents[3]
_BACKEND = _REPOSITORY / "backend"
_SUPPORT = Path(__file__).resolve().parent
sys.path[:0] = [str(_BACKEND), str(_BACKEND / "tests"), str(_SUPPORT)]


_LAST_REPLAY_TOOL = "  - name: write_file\n    group: file:write\n    use: deerflow.sandbox.tools:write_file_tool"

# allow_private_addresses is required because G0-6 navigates to the Nuxt preview on
# localhost; the SSRF guard blocks private addresses by default. Keep this confined
# to the M0 gateway fixture.
_BROWSER_TOOL_BLOCK = """  - name: browser_navigate
    group: browser
    use: deerflow.community.browser_automation.tools:browser_navigate_tool
    headless: true
    timeout_ms: 30000
    viewport_width: 1280
    viewport_height: 720
    allow_private_addresses: true"""


def _enable_browser_control(config: str) -> str:
    """Add browser_navigate so the browser REST/WS surface stops answering 404.

    Injected into the existing ``tools:`` list rather than appended, because a
    second top-level ``tools:`` key would replace the replay toolset entirely.
    """
    if _LAST_REPLAY_TOOL not in config:
        raise RuntimeError("replay config layout changed; browser tool anchor not found")
    config = config.replace("tool_groups:\n", "tool_groups:\n  - name: browser\n", 1)
    return config.replace(_LAST_REPLAY_TOOL, f"{_LAST_REPLAY_TOOL}\n{_BROWSER_TOOL_BLOCK}", 1)


def _oidc_block(issuer: str, client_id: str, client_secret: str) -> str:
    """Enable SSO against the fixture IdP.

    ``frontend_base_url`` and the provider's ``redirect_uri`` are both left
    unset on purpose: that is exactly the dual-frontend contract G0-7 verifies —
    the callback is derived from the entry the browser used, and the post-login
    redirect stays relative so it resolves back to that same entry.
    """
    return f"""
auth:
  oidc:
    enabled: true
    providers:
      m0idp:
        display_name: M0 Fixture IdP
        issuer: {issuer}
        client_id: {client_id}
        client_secret: {client_secret}
        require_verified_email: true
        auto_create_users: true
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--cors", default="http://localhost:3101")
    parser.add_argument(
        "--queue-maxsize",
        type=int,
        default=int(os.environ.get("DEERFLOW_M0_QUEUE_MAXSIZE", "256")),
        help=(
            "StreamBridge retention window. Must stay above the live burst so the "
            "create stream is not gapped, and below the run's total event count so "
            "a resume from the first cursor is genuinely evicted."
        ),
    )
    parser.add_argument(
        "--browser",
        action="store_true",
        help=(
            "Enable agentic browser control so the browser REST/WS surface is reachable. "
            "Off by default: adding the tool changes the lead-agent toolset and therefore "
            "the system prompt, which would break the run-protocol replay fixture's hash."
        ),
    )
    parser.add_argument(
        "--oidc-issuer",
        default="",
        help="Enable an OIDC provider pointing at the M0 fixture IdP (see run_m0_idp.py).",
    )
    parser.add_argument("--oidc-client-id", default="deerflow-m0")
    parser.add_argument("--oidc-client-secret", default="m0-idp-secret")
    args = parser.parse_args()

    from _replay_fixture import REPLAY_MODEL_BLOCK, build_config_yaml, prepare_hermetic_extras

    home = Path(tempfile.mkdtemp(prefix="m0-replay-gw-"))
    model_block = REPLAY_MODEL_BLOCK.replace(
        "replay_provider:ReplayChatModel",
        "m0_replay_provider:M0ReplayChatModel",
    )
    config = build_config_yaml(model_block=model_block, home=home)
    if args.browser:
        config = _enable_browser_control(config)
    if args.oidc_issuer:
        config += _oidc_block(args.oidc_issuer, args.oidc_client_id, args.oidc_client_secret)
    config += f"\nstream_bridge:\n  type: memory\n  queue_maxsize: {args.queue_maxsize}\n"
    config_path = home / "config.yaml"
    config_path.write_text(config, encoding="utf-8")

    os.environ["DEER_FLOW_HOME"] = str(home)
    os.environ["DEER_FLOW_CONFIG_PATH"] = str(config_path)
    os.environ["DEER_FLOW_EXTENSIONS_CONFIG_PATH"] = str(prepare_hermetic_extras(home))
    os.environ["DEERFLOW_REPLAY_FIXTURE"] = str(
        _BACKEND / "tests" / "fixtures" / "replay" / "write_read_file.ultra.json"
    )
    os.environ.setdefault("AUTH_JWT_SECRET", "ci-replay-secret")
    os.environ["GATEWAY_CORS_ORIGINS"] = args.cors
    os.environ.setdefault("DEERFLOW_M0_REPLAY_DELAY_SECONDS", "16")
    os.environ["PYTHONPATH"] = os.pathsep.join(
        [str(_BACKEND), str(_BACKEND / "tests"), str(_SUPPORT)]
    )

    import uvicorn

    uvicorn.run(
        "app.gateway.app:app",
        host="127.0.0.1",
        port=args.port,
        log_level="warning",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
