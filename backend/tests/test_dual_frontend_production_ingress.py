"""Production contract for the React/Vue dual-host ingress.

M7 keeps one published nginx surface and one Gateway.  The browser-facing
hostname selects only the HTML frontend; API, SSE, WebSocket, auth, and cookie
traffic stay same-origin through the same server block.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_PATH = REPO_ROOT / "docker/docker-compose.yaml"
DEV_COMPOSE_PATH = REPO_ROOT / "docker/docker-compose-dev.yaml"
NGINX_PATH = REPO_ROOT / "docker/nginx/nginx.conf"


def _compose() -> dict:
    return yaml.safe_load(COMPOSE_PATH.read_text(encoding="utf-8"))


def _nginx() -> str:
    return NGINX_PATH.read_text(encoding="utf-8")


def test_production_compose_builds_secondary_vue_without_publishing_a_port() -> None:
    services = _compose()["services"]
    vue = services["frontend-vue"]

    assert vue["build"]["dockerfile"] == "frontend-vue/Dockerfile"
    assert "ports" not in vue
    assert vue["networks"] == ["deer-flow"]
    assert vue["restart"] == "unless-stopped"
    assert set(services["nginx"]["depends_on"]) >= {"frontend", "frontend-vue", "gateway"}


def test_production_compose_keeps_one_loopback_nginx_entry_and_private_gateway() -> None:
    services = _compose()["services"]

    assert services["nginx"]["ports"] == ["${BIND_HOST:-127.0.0.1}:${PORT:-2026}:2026"]
    assert "ports" not in services["gateway"]
    assert "ports" not in services["frontend"]
    assert "ports" not in services["frontend-vue"]


def test_nginx_templates_only_the_vue_hostname_and_defaults_everything_else_to_react() -> None:
    compose_nginx = _compose()["services"]["nginx"]
    environment = compose_nginx["environment"]
    command = "\n".join(compose_nginx["command"])
    config = _nginx()

    assert "DEER_FLOW_VUE_HOSTNAME=${DEER_FLOW_VUE_HOSTNAME:-vue.localhost}" in environment
    # Compose uses $$ to defer expansion until the nginx container starts.
    assert "envsubst '$$DEER_FLOW_VUE_HOSTNAME'" in command
    assert "map $host $frontend_upstream" in config
    assert '"${DEER_FLOW_VUE_HOSTNAME}" frontend-vue:3000;' in config
    assert "default frontend:3000;" in config
    assert "set $frontend_upstream frontend:3000;" not in config
    assert "listen 2026 default_server;" in config
    assert "server_name _;" in config


def test_development_compose_renders_the_shared_nginx_template_too() -> None:
    dev_nginx = yaml.safe_load(DEV_COMPOSE_PATH.read_text(encoding="utf-8"))["services"]["nginx"]
    command = "\n".join(dev_nginx["command"])

    assert "DEER_FLOW_VUE_HOSTNAME=${DEER_FLOW_VUE_HOSTNAME:-vue.localhost}" in dev_nginx["environment"]
    assert "envsubst '$$DEER_FLOW_VUE_HOSTNAME'" in command


def test_all_gateway_proxy_locations_overwrite_forwarded_host_and_proto() -> None:
    config = _nginx()
    gateway_proxy_count = len(re.findall(r"proxy_pass http://\$gateway_upstream;", config))

    assert gateway_proxy_count > 0
    forwarded_proto_count = config.count("proxy_set_header X-Forwarded-Proto $forwarded_proto;")
    assert forwarded_proto_count >= gateway_proxy_count
    assert config.count("proxy_set_header X-Forwarded-Host $http_host;") == forwarded_proto_count


def test_dual_host_reuses_existing_stream_websocket_and_body_limit_contracts() -> None:
    config = _nginx()

    # One server block owns both hostnames, so these path contracts apply
    # symmetrically to React and Vue without a duplicated route table.
    assert config.count("server {") == 1
    assert "rewrite ^/api/langgraph/(.*) /api/$1 break;" in config
    assert "proxy_set_header X-Accel-Buffering no;" in config
    assert "proxy_buffering off;" in config
    assert "proxy_read_timeout 600s;" in config
    assert "client_max_body_size 20M;" in config
    assert "client_max_body_size 100M;" in config
    assert "proxy_set_header Upgrade $http_upgrade;" in config
    assert "proxy_set_header Connection 'upgrade';" in config
