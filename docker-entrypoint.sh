#!/bin/sh
set -e

# Ensure the runtime data directories exist and are owned by the unprivileged
# `node` user, then drop root before exec'ing the server. This self-heals bind
# mounts that an earlier root-running container created root-owned, so switching
# to non-root never breaks writes on redeploy. Volumes for a baby tracker are
# small (KB–MB), so the recursive chown at boot is negligible.
if [ "$(id -u)" = "0" ]; then
  for dir in /data /backups; do
    mkdir -p "$dir"
    chown -R node:node "$dir" 2>/dev/null || true
  done
  # setpriv (util-linux, present in debian bookworm) re-execs as node with the
  # correct supplementary groups and no residual root privileges.
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
