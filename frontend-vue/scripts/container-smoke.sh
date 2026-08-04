#!/usr/bin/env bash

# 【文件职责】验证生产镜像非 root、health、最小产物与 SIGTERM 生命周期。
# 【对应 frontend/】frontend/Dockerfile
# 【架构位置】工程底座
# 【主要导出】container-smoke 命令
# 【依赖关系】Docker daemon
# 【边界与注意】trap 始终清理本脚本创建的唯一容器。

set -euo pipefail

IMAGE=${1:?container image is required}
CONTAINER_NAME="deer-flow-frontend-vue-m0-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --detach --name "$CONTAINER_NAME" --publish 127.0.0.1::3000 "$IMAGE" >/dev/null

USER_ID=$(docker inspect --format '{{.Config.User}}' "$CONTAINER_NAME")
if [ -z "$USER_ID" ] || [ "$USER_ID" = "0" ] || [ "$USER_ID" = "root" ]; then
  echo "container must run as a non-root user" >&2
  exit 1
fi

HOST_PORT=$(docker port "$CONTAINER_NAME" 3000/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1)
if [ -z "$HOST_PORT" ]; then
  echo "container did not publish port 3000" >&2
  exit 1
fi

for _ in $(seq 1 45); do
  if curl --fail --silent "http://127.0.0.1:${HOST_PORT}/health" | grep -q '"status":"ok"'; then
    break
  fi
  sleep 1
done
curl --fail --silent "http://127.0.0.1:${HOST_PORT}/health" | grep -q '"service":"frontend-vue"'

docker exec "$CONTAINER_NAME" sh -c 'test -f /app/.output/server/index.mjs && test ! -d /app/app && test ! -d /app/tests'

docker stop --time 10 "$CONTAINER_NAME" >/dev/null
STATUS=$(docker inspect --format '{{.State.Status}}' "$CONTAINER_NAME")
if [ "$STATUS" != "exited" ]; then
  echo "container did not exit after SIGTERM" >&2
  exit 1
fi
