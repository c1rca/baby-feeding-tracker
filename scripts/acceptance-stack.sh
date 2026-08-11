#!/bin/sh
# Provision the disposable browser-acceptance candidate on 127.0.0.1:8082.
#
# Dev-only. This never touches production or Dev:
#   * its own image tag and container name, matching nothing else on the host;
#   * `docker run` rather than Compose, because Dev and production share a
#     Compose project name and a stray `compose up` recreates them;
#   * tmpfs for /data, so the database dies with the container and no Dev or
#     production path is ever mounted;
#   * the port is bound to loopback only.
#
# Usage: scripts/acceptance-stack.sh [image-tag]
set -eu

NAME=bft-browser-acceptance
PORT=8082
IMAGE=${1:-bft-dev-candidate:acceptance-matrix}

case "$NAME" in
  *baby-feeding-tracker) echo "refusing: $NAME collides with the production container" >&2; exit 1 ;;
esac

echo "building $IMAGE"
docker build -t "$IMAGE" .

echo "replacing $NAME on 127.0.0.1:$PORT"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$NAME" \
  -p "127.0.0.1:$PORT:8080" \
  --tmpfs /data:uid=1000,gid=1000 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -e DB_DIR=/data \
  -e DB_PATH=/data/acceptance.db \
  -e AUTH_REQUIRED=0 \
  -e AUTH_BYPASS=1 \
  -e ALLOW_INSECURE_LOCAL_MODE=1 \
  -e NOTIFICATIONS_ENABLED=0 \
  -e ACTION_LOG_URL= \
  "$IMAGE" >/dev/null

printf 'waiting for health'
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    printf '\nready: http://127.0.0.1:%s (image %s)\n' "$PORT" "$IMAGE"
    exit 0
  fi
  printf '.'
  i=$((i + 1))
  sleep 1
done

printf '\nacceptance candidate never became healthy\n' >&2
docker logs --tail 40 "$NAME" >&2
exit 1
