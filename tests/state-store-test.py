#!/usr/bin/env python3
"""Real filesystem attacks, all confined to a temporary private test home."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("state_store", REPO / "StateStore.py")
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)


class StateStoreTests(unittest.TestCase):
    def setUp(self):
        # /tmp is intentionally disallowed as a production home ancestor.
        self.temporary = tempfile.TemporaryDirectory(prefix=".kids-math-state-test-", dir=Path.home())
        self.addCleanup(self.temporary.cleanup)
        self.home = self.temporary.name
        self.directory = Path(self.home).joinpath(*store.DIRECTORIES)
        self.state = self.directory / store.STATE_NAME
        self.raw = b'{"schemaVersion":1,"learners":{},"lastAssessment":null}'

    def initialize(self):
        store.write_state(self.home, self.raw)

    def test_absent_state_read_does_not_create_anything(self):
        self.assertEqual(store.read_state(self.home), b"{}")
        self.assertEqual(list(Path(self.home).iterdir()), [])

    def test_private_modes_atomic_replacement_and_roundtrip(self):
        self.initialize()
        self.assertEqual(stat.S_IMODE(self.directory.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(self.state.stat().st_mode), 0o600)
        with self.state.open("rb") as old:
            store.write_state(self.home, b'{"learners":{"sam":{}}}')
            self.assertEqual(old.read(), self.raw)
        self.assertEqual(store.read_state(self.home), b'{"learners":{"sam":{}}}')
        self.assertEqual(list(self.directory.iterdir()), [self.state])

    def test_bounded_readonly_legacy_import(self):
        legacy = self.directory.parent / "kids-math.json"
        for n in range(1, len(store.DIRECTORIES)):
            Path(self.home).joinpath(*store.DIRECTORIES[:n]).mkdir(mode=0o700)
        legacy.write_bytes(self.raw)
        legacy.chmod(0o644)
        self.assertEqual(store.read_state(self.home), self.raw)
        self.assertFalse(self.directory.exists())
        self.initialize()
        self.assertEqual(legacy.read_bytes(), self.raw)
        legacy.write_bytes(b"broken")
        self.assertEqual(store.read_state(self.home), self.raw)

    def test_symlink_target_is_never_read_or_written(self):
        self.initialize()
        victim = Path(self.home) / "victim"
        victim.write_bytes(b"do not touch")
        self.state.unlink()
        self.state.symlink_to(victim)
        for operation in (lambda: store.read_state(self.home), lambda: store.write_state(self.home, self.raw)):
            with self.assertRaises(OSError):
                operation()
        self.assertEqual(victim.read_bytes(), b"do not touch")
        self.assertTrue(self.state.is_symlink())

    def test_every_state_ancestor_rejects_symlinks(self):
        self.initialize()
        for path in [Path(self.home).joinpath(*store.DIRECTORIES[:n]) for n in range(1, 5)]:
            moved = path.with_name(path.name + "-real")
            path.rename(moved)
            path.symlink_to(moved, target_is_directory=True)
            try:
                with self.assertRaises(OSError):
                    store.read_state(self.home)
                with self.assertRaises(OSError):
                    store.write_state(self.home, self.raw)
            finally:
                path.unlink()
                moved.rename(path)
        alias = Path(self.home) / "alias"
        alias.symlink_to(self.home, target_is_directory=True)
        with self.assertRaises(OSError):
            store.read_state(str(alias))

    def test_nonregular_hardlinked_and_nonprivate_targets_rejected(self):
        self.initialize()
        self.state.unlink()
        os.mkfifo(self.state, 0o600)
        with self.assertRaises(store.UnsafeState):
            store.read_state(self.home)
        with self.assertRaises(store.UnsafeState):
            store.write_state(self.home, self.raw)
        self.state.unlink()
        self.state.mkdir()
        with self.assertRaises(store.UnsafeState):
            store.read_state(self.home)
        self.state.rmdir()
        self.initialize()
        link = Path(self.home) / "hardlink"
        os.link(self.state, link)
        with self.assertRaises(store.UnsafeState):
            store.write_state(self.home, self.raw)
        with self.assertRaises(store.UnsafeState):
            store.read_state(self.home)
        link.unlink()
        self.state.chmod(0o644)
        with self.assertRaises(store.UnsafeState):
            store.read_state(self.home)
        with self.assertRaises(store.UnsafeState):
            store.write_state(self.home, self.raw)

    def test_directory_permissions_and_ownership_checked(self):
        self.initialize()
        for path, mode in [(self.directory, 0o755), (self.directory.parent, 0o777)]:
            old_mode = stat.S_IMODE(path.stat().st_mode)
            path.chmod(mode)
            try:
                with self.assertRaises(store.UnsafeState):
                    store.read_state(self.home)
                with self.assertRaises(store.UnsafeState):
                    store.write_state(self.home, self.raw)
            finally:
                path.chmod(old_mode)
        real_stat = os.fstat
        def foreign_owner(fd):
            info = real_stat(fd)
            if info.st_ino == self.state.stat().st_ino:
                values = list(info)
                values[4] = os.getuid() + 1
                return os.stat_result(values)
            return info
        with patch.object(store.os, "fstat", side_effect=foreign_owner):
            with self.assertRaises(store.UnsafeState):
                store.read_state(self.home)

    def test_invalid_data_never_replaces_previous_state(self):
        self.initialize()
        invalid = [b" " * (store.MAX_BYTES + 1), b"[" * 10000 + b"]" * 10000,
                   b'{"x":NaN}', b'{"x":1,"x":2}', b'{"x":"\xff"}', b"null",
                   json.dumps({"x": list(range(61))}).encode(),
                   json.dumps({str(i): 0 for i in range(65)}).encode()]
        for raw in invalid:
            with self.subTest(raw=raw[:40]):
                with self.assertRaises(ValueError):
                    store.write_state(self.home, raw)
                self.assertEqual(self.state.read_bytes(), self.raw)

    def test_oversized_sparse_file_and_growing_read_are_bounded(self):
        self.initialize()
        with self.state.open("r+b") as state:
            state.truncate(1024 ** 3)
        with self.assertRaises(store.UnsafeState):
            store.read_state(self.home)
        self.state.write_bytes(self.raw)
        reads = []
        def growing(fd, size):
            reads.append(size)
            return b" " * size
        with patch.object(store.os, "read", side_effect=growing):
            with self.assertRaises(store.UnsafeState):
                store.read_state(self.home)
        self.assertEqual(sum(reads), store.MAX_BYTES + 1)

    def test_ancestor_swap_cannot_redirect_atomic_write(self):
        self.initialize()
        original_open = store.open_store
        moved = self.directory.with_name("original")
        victim = Path(self.home) / "victim"
        victim.mkdir()
        sentinel = victim / store.STATE_NAME
        sentinel.write_bytes(b"do not touch")
        def swap_after_open(home, **kwargs):
            fd = original_open(home, **kwargs)
            self.directory.rename(moved)
            self.directory.symlink_to(victim, target_is_directory=True)
            return fd
        with patch.object(store, "open_store", side_effect=swap_after_open):
            store.write_state(self.home, b'{"learners":{"sam":{}}}')
        self.assertEqual(sentinel.read_bytes(), b"do not touch")
        self.assertEqual((moved / store.STATE_NAME).read_bytes(), b'{"learners":{"sam":{}}}')

    def test_failed_replace_preserves_state_and_cleans_temporary(self):
        self.initialize()
        with patch.object(store.os, "replace", side_effect=OSError("simulated failure")):
            with self.assertRaises(OSError):
                store.write_state(self.home, b"{}")
        self.assertEqual(self.state.read_bytes(), self.raw)
        self.assertEqual(list(self.directory.iterdir()), [self.state])

    def test_fixed_cli_rejects_paths_and_oversized_stdin(self):
        command = ["/usr/bin/python3", "-I", "-S", str(REPO / "StateStore.py")]
        for args, data in [(["write", self.home], b"{}"), (["write"], b" " * (store.MAX_BYTES + 1))]:
            result = subprocess.run(command + args, input=data, capture_output=True, timeout=8)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stdout, b"")
            self.assertEqual(result.stderr, b"Kids Math: state unavailable or rejected\n")

    def test_isolated_cli_roundtrip_with_resource_limits(self):
        # Override only the account lookup in a separate interpreter, so main()
        # exercises its real limits and pipes without touching actual user data.
        bootstrap = """import pwd, runpy, sys, types
test_home, script, operation = sys.argv[1:]
pwd.getpwuid = lambda uid: types.SimpleNamespace(pw_dir=test_home)
sys.argv = [script, operation]
runpy.run_path(script, run_name='__main__')
"""
        command = ["/usr/bin/python3", "-I", "-S", "-c", bootstrap,
                   self.home, str(REPO / "StateStore.py")]
        written = subprocess.run(command + ["write"], input=self.raw, capture_output=True, timeout=8, env={})
        self.assertEqual((written.returncode, written.stdout, written.stderr), (0, b"", b""))
        read = subprocess.run(command + ["read"], capture_output=True, timeout=8, env={})
        self.assertEqual((read.returncode, read.stdout, read.stderr), (0, self.raw, b""))


if __name__ == "__main__":
    unittest.main()
