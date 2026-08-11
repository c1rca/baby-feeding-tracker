#!/usr/bin/env python3
"""Tests for the append-only action log. Run: python3 test_server.py"""

import json
import os
import shutil
import tempfile
import unittest

from server import ActionLogStore


class ActionLogStoreTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="actionlog-test-")
        self.store = ActionLogStore(self.dir)

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def read_actions(self):
        path = os.path.join(self.dir, "actions")
        records = []
        for name in sorted(os.listdir(path)):
            if name.endswith(".jsonl"):
                with open(os.path.join(path, name), encoding="utf-8") as handle:
                    records.extend(json.loads(line) for line in handle if line.strip())
        return records

    def test_appends_never_overwrite(self):
        self.store.append([{"action": "first", "babyId": "b1", "state": {"entries": [1]}}])
        self.store.append([{"action": "second", "babyId": "b1", "state": {"entries": [1, 2]}}])
        records = self.read_actions()
        self.assertEqual([r["action"]["action"] for r in records], ["first", "second"])
        self.assertEqual([r["seq"] for r in records], [1, 2])

    def test_snapshot_holds_the_newest_state(self):
        self.store.append([{"action": "a", "babyId": "b1", "state": {"entries": [1]}}])
        self.store.append([{"action": "b", "babyId": "b1", "state": {"entries": [1, 2]}}])
        state, meta = self.store.latest_snapshot(None, "b1")
        self.assertEqual(state, {"entries": [1, 2]})
        self.assertEqual(meta["action"], "b")

    def test_sequence_survives_a_restart(self):
        self.store.append([{"action": "before", "babyId": "b1", "state": {}}])
        # A crash and restart against the same data directory.
        restarted = ActionLogStore(self.dir)
        restarted.append([{"action": "after", "babyId": "b1", "state": {}}])
        seqs = [r["seq"] for r in self.read_actions()]
        self.assertEqual(seqs, [1, 2], "seq must not reset when the process restarts")

    def test_records_without_state_are_still_kept(self):
        self.store.append([{"action": "no-state-here"}])
        records = self.read_actions()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["action"]["action"], "no-state-here")

    def test_unknown_fields_are_preserved_verbatim(self):
        self.store.append([{"action": "a", "babyId": "b1", "somethingNew": {"deep": [1, 2]}, "state": {}}])
        self.assertEqual(self.read_actions()[0]["action"]["somethingNew"], {"deep": [1, 2]})

    def test_ids_that_would_escape_the_directory_are_neutralised(self):
        self.store.append([{"action": "a", "householdId": "../../etc", "babyId": "../passwd", "state": {"x": 1}}])
        snapshots_dir = os.path.realpath(os.path.join(self.dir, "snapshots"))
        # The property that matters is containment, not the spelling of the
        # name: a separator-free name cannot traverse, however it reads.
        for name in os.listdir(snapshots_dir):
            self.assertNotIn("/", name)
            resolved = os.path.realpath(os.path.join(snapshots_dir, name))
            self.assertTrue(resolved.startswith(snapshots_dir + os.sep), resolved)
        # The data is still retrievable under the sanitised key.
        state, _ = self.store.latest_snapshot("../../etc", "../passwd")
        self.assertEqual(state, {"x": 1})

    def test_separate_babies_get_separate_snapshots(self):
        self.store.append([{"action": "a", "babyId": "b1", "state": {"who": "one"}}])
        self.store.append([{"action": "b", "babyId": "b2", "state": {"who": "two"}}])
        self.assertEqual(self.store.latest_snapshot(None, "b1")[0], {"who": "one"})
        self.assertEqual(self.store.latest_snapshot(None, "b2")[0], {"who": "two"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
