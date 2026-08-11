#!/usr/bin/env python3
"""Append-only backup log for every action taken in the tracker.

The contract this server exists to keep is recovery: whatever arrives is
written down and never modified afterwards. That shapes every decision here.

  * Appends only. No record is ever rewritten or deleted, so a bug in a later
    version cannot destroy what an earlier one captured.
  * Never rejects on shape. A payload the server does not understand is still
    the user's data; refusing it would be the one failure mode that loses the
    thing we are trying to protect. Unknown fields are stored verbatim.
  * fsync per write. A log that is still in a page cache when the machine dies
    is not a backup.
  * No dependencies. Standard library only, so recovery never depends on a
    working package install.

Layout under --data-dir:

    actions/actions-YYYY-MM-DD.jsonl   every action, in arrival order
    snapshots/<household>__<baby>.json newest full state, for instant recovery
    snapshots/<household>__<baby>.meta.json

Recovering is deliberately boring: read the snapshot file. The JSONL history is
there for when you need to see how the state got that way, or to rebuild a
moment that the newest snapshot has already moved past.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# A single lock serialises appends. Throughput is irrelevant here — one
# household generates a handful of actions a minute — and interleaved writes
# from concurrent devices would corrupt lines, which is the one outcome this
# server may not permit.
WRITE_LOCK = threading.Lock()

MAX_BODY_BYTES = 64 * 1024 * 1024
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def safe_component(value: object, fallback: str) -> str:
    text = str(value) if value not in (None, "") else fallback
    cleaned = SAFE_NAME.sub("_", text)
    return cleaned[:120] or fallback


def fsync_write(path: str, payload: str, mode: str = "a") -> None:
    """Write and flush all the way to the platter before returning."""
    with open(path, mode, encoding="utf-8") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def atomic_write(path: str, payload: str) -> None:
    """Replace a file without ever leaving a half-written one behind.

    Snapshots are the fast path for recovery, so a torn snapshot would be worse
    than no snapshot: it reads as valid JSON right up until it doesn't. Writing
    to a temporary file and renaming makes the swap atomic on POSIX.
    """
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp, path)
    dir_fd = os.open(os.path.dirname(path) or ".", os.O_RDONLY)
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


class ActionLogStore:
    def __init__(self, data_dir: str) -> None:
        self.data_dir = os.path.abspath(data_dir)
        self.actions_dir = os.path.join(self.data_dir, "actions")
        self.snapshots_dir = os.path.join(self.data_dir, "snapshots")
        os.makedirs(self.actions_dir, exist_ok=True)
        os.makedirs(self.snapshots_dir, exist_ok=True)
        self.started_with = self._count_existing()
        self.received = 0

    def _count_existing(self) -> int:
        """Continue the sequence across restarts.

        A counter that resets to 1 every time the process starts would make
        `seq` meaningless in exactly the situation this log exists for: piecing
        together what happened across a crash. Counting what is already on disk
        keeps it monotonic for the life of the data directory.
        """
        total = 0
        for name in os.listdir(self.actions_dir):
            if not name.endswith(".jsonl"):
                continue
            with open(os.path.join(self.actions_dir, name), "rb") as handle:
                total += sum(1 for _ in handle)
        return total

    def actions_path(self, when: datetime) -> str:
        return os.path.join(self.actions_dir, f"actions-{when:%Y-%m-%d}.jsonl")

    def snapshot_paths(self, household: object, baby: object) -> tuple[str, str]:
        stem = f"{safe_component(household, 'unknown-household')}__{safe_component(baby, 'unknown-baby')}"
        return (
            os.path.join(self.snapshots_dir, f"{stem}.json"),
            os.path.join(self.snapshots_dir, f"{stem}.meta.json"),
        )

    def append(self, records: list[dict]) -> dict:
        received_at = utc_now()
        now = datetime.now(timezone.utc)
        written = 0
        snapshots = 0

        with WRITE_LOCK:
            lines = []
            for record in records:
                envelope = {
                    "receivedAt": received_at,
                    "seq": self.started_with + self.received + written + 1,
                    "action": record,
                }
                lines.append(json.dumps(envelope, ensure_ascii=False, default=str))
                written += 1

            if lines:
                fsync_write(self.actions_path(now), "\n".join(lines) + "\n")

            # The newest full state wins. Actions arrive in order within a
            # batch, so the last one carrying a state is the freshest.
            for record in records:
                state = record.get("state") if isinstance(record, dict) else None
                if not isinstance(state, dict):
                    continue
                snapshot_path, meta_path = self.snapshot_paths(
                    record.get("householdId"), record.get("babyId")
                )
                atomic_write(snapshot_path, json.dumps(state, ensure_ascii=False, indent=2, default=str))
                atomic_write(
                    meta_path,
                    json.dumps(
                        {
                            "receivedAt": received_at,
                            "clientTime": record.get("at"),
                            "action": record.get("action"),
                            "householdId": record.get("householdId"),
                            "babyId": record.get("babyId"),
                            "clientId": record.get("clientId"),
                            "counts": record.get("counts"),
                        },
                        ensure_ascii=False,
                        indent=2,
                        default=str,
                    ),
                )
                snapshots += 1

            self.received += written

        return {"ok": True, "written": written, "snapshots": snapshots, "receivedAt": received_at}

    def stats(self) -> dict:
        files = sorted(f for f in os.listdir(self.actions_dir) if f.endswith(".jsonl"))
        snapshots = sorted(f for f in os.listdir(self.snapshots_dir) if f.endswith(".json") and not f.endswith(".meta.json"))
        total_bytes = sum(os.path.getsize(os.path.join(self.actions_dir, f)) for f in files)
        return {
            "ok": True,
            "dataDir": self.data_dir,
            "actionFiles": files,
            "actionBytes": total_bytes,
            "receivedThisRun": self.received,
            "totalRecords": self.started_with + self.received,
            "snapshots": snapshots,
        }

    def latest_snapshot(self, household: object, baby: object) -> tuple[dict | None, dict | None]:
        snapshot_path, meta_path = self.snapshot_paths(household, baby)
        if not os.path.exists(snapshot_path):
            return None, None
        with open(snapshot_path, encoding="utf-8") as handle:
            state = json.load(handle)
        meta = None
        if os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as handle:
                meta = json.load(handle)
        return state, meta


class Handler(BaseHTTPRequestHandler):
    store: ActionLogStore = None  # type: ignore[assignment]
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:  # quieter than the default
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        # The tracker is served from a different origin (and port) than this
        # server, so the browser will preflight every POST.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")

    def _respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/health":
            self._respond(200, {"ok": True, "at": utc_now()})
            return
        if path == "/stats":
            self._respond(200, self.store.stats())
            return
        if path == "/recover":
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            params = dict(
                (part.split("=", 1) + [""])[:2] for part in query.split("&") if part
            )
            state, meta = self.store.latest_snapshot(
                params.get("householdId"), params.get("babyId")
            )
            if state is None:
                self._respond(404, {"ok": False, "error": "no snapshot for that household/baby"})
                return
            self._respond(200, {"ok": True, "meta": meta, "state": state})
            return
        self._respond(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/log":
            self._respond(404, {"ok": False, "error": "not found"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            self._respond(400, {"ok": False, "error": "bad content length"})
            return

        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            # Even unparseable input is preserved: it is evidence of something,
            # and discarding it would violate the one promise this server makes.
            with WRITE_LOCK:
                fsync_write(
                    os.path.join(self.store.data_dir, "actions", "unparseable.jsonl"),
                    json.dumps(
                        {"receivedAt": utc_now(), "error": str(exc), "raw": raw.decode("utf-8", "replace")},
                        ensure_ascii=False,
                    )
                    + "\n",
                )
            self._respond(202, {"ok": True, "stored": "unparseable"})
            return

        records = parsed.get("actions") if isinstance(parsed, dict) else parsed
        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list):
            records = [{"action": "unknown", "payload": parsed}]

        result = self.store.append([r if isinstance(r, dict) else {"action": "unknown", "payload": r} for r in records])
        self._respond(200, result)


def main() -> int:
    parser = argparse.ArgumentParser(description="Append-only action backup log")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8099)
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("ACTION_LOG_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")),
    )
    args = parser.parse_args()

    Handler.store = ActionLogStore(args.data_dir)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"action log server on http://{args.host}:{args.port}  ->  {Handler.store.data_dir}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
