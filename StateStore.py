#!/usr/bin/env python3
"""Bounded, descriptor-relative Linux persistence for Kids Math.

Invoked only as /usr/bin/python3 -I -S <bundled script> read|write. No paths,
commands or environment configuration come from summon payloads. stdout is
either a bounded state document (read) or empty (write); errors are fixed text.
"""
import json
import os
import pwd
import resource
import secrets
import signal
import stat
import sys

MAX_BYTES = 262144
MAX_DEPTH = 12
MAX_KEYS = 64
MAX_NODES = 12000
DIRECTORIES = (".local", "state", "omarchy", "kids-math")
STATE_NAME = "progress.json"
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC


class UnsafeState(ValueError):
    pass


def check_directory(fd, private=False, ancestor=False):
    info = os.fstat(fd)
    owners = (0, os.getuid()) if ancestor else (os.getuid(),)
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid not in owners
            or info.st_mode & (0o077 if private else 0o022)):
        raise UnsafeState("unsafe directory")


def open_home(home):
    # Walk from / without following *any* ancestor symlink. The account database
    # supplies home in production; the argument exists for isolated unit tests.
    if not home.startswith("/") or ".." in home.split("/"):
        raise UnsafeState("invalid home")
    fd = os.open("/", DIR_FLAGS)
    try:
        check_directory(fd, ancestor=True)
        parts = [part for part in home.split("/") if part]
        for part in parts:
            child = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
            check_directory(fd, ancestor=True)
        check_directory(fd)
        return fd
    except BaseException:
        os.close(fd)
        raise


def open_store(home, create=False, legacy=False):
    fd = open_home(home)
    try:
        directories = DIRECTORIES[:-1] if legacy else DIRECTORIES
        for index, name in enumerate(directories):
            if create:
                try:
                    os.mkdir(name, mode=0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            child = os.open(name, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
            check_directory(fd, private=not legacy and index == len(DIRECTORIES) - 1)
        return fd
    except BaseException:
        os.close(fd)
        raise


def check_file(fd, private):
    info = os.fstat(fd)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
            or info.st_nlink != 1 or info.st_mode & (0o077 if private else 0o022)
            or info.st_size > MAX_BYTES):
        raise UnsafeState("unsafe state file")


def read_at(directory, name, private=True):
    fd = os.open(name, FILE_FLAGS, dir_fd=directory)
    try:
        check_file(fd, private)
        chunks = []
        size = 0
        # Includes a sentinel byte: a file growing after fstat cannot evade the
        # ceiling. O_NONBLOCK prevents a substituted FIFO from blocking open.
        while size <= MAX_BYTES:
            chunk = os.read(fd, min(16384, MAX_BYTES + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
        if size > MAX_BYTES:
            raise UnsafeState("state too large")
        return b"".join(chunks)
    finally:
        os.close(fd)


def validate(raw):
    if len(raw) > MAX_BYTES:
        raise UnsafeState("state too large")
    text = raw.decode("utf-8", errors="strict")
    depth = 0
    quoted = escaped = False
    # Check nesting before the JSON parser allocates nested containers.
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in "[{":
            depth += 1
            if depth > MAX_DEPTH:
                raise UnsafeState("state too deep")
        elif char in "]}":
            depth -= 1

    def pairs(entries):
        if len(entries) > MAX_KEYS or len(dict(entries)) != len(entries):
            raise UnsafeState("invalid object keys")
        return dict(entries)

    def bad_constant(_):
        raise UnsafeState("non-finite number")

    value = json.loads(text, object_pairs_hook=pairs, parse_constant=bad_constant)
    remaining = MAX_NODES

    def visit(item):
        nonlocal remaining
        remaining -= 1
        if remaining < 0:
            raise UnsafeState("too many values")
        if isinstance(item, dict):
            for key, child in item.items():
                if len(key.encode("utf-8")) > 64:
                    raise UnsafeState("key too long")
                visit(child)
        elif isinstance(item, list):
            if len(item) > 60:
                raise UnsafeState("array too long")
            for child in item:
                visit(child)
        elif isinstance(item, str) and len(item.encode("utf-8")) > 2048:
            raise UnsafeState("string too long")

    if not isinstance(value, dict):
        raise UnsafeState("expected object")
    visit(value)
    return raw


def read_state(home):
    try:
        directory = open_store(home)
        try:
            return validate(read_at(directory, STATE_NAME))
        finally:
            os.close(directory)
    except FileNotFoundError:
        # Read-only migration: old FileView files may be 0644. Still require
        # no-follow ancestors, same ownership, one link and no external writers.
        try:
            directory = open_store(home, legacy=True)
            try:
                return validate(read_at(directory, "kids-math.json", private=False))
            finally:
                os.close(directory)
        except FileNotFoundError:
            return b"{}"


def write_state(home, raw):
    validate(raw)
    directory = open_store(home, create=True)
    temporary = None
    try:
        # Refuse an existing unsafe target. A race after this check can only
        # replace a directory entry; rename never follows or writes that inode.
        try:
            target = os.open(STATE_NAME, FILE_FLAGS, dir_fd=directory)
        except FileNotFoundError:
            pass
        else:
            try:
                check_file(target, private=True)
            finally:
                os.close(target)
        temporary = ".progress-" + secrets.token_hex(16)
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL
                     | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=directory)
        try:
            view = memoryview(raw)
            while view:
                written = os.write(fd, view)
                if written <= 0:
                    raise OSError("short write")
                view = view[written:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(temporary, STATE_NAME, src_dir_fd=directory, dst_dir_fd=directory)
        temporary = None
        os.fsync(directory)
    finally:
        if temporary is not None:
            os.unlink(temporary, dir_fd=directory)
        os.close(directory)


def main():
    # Bound even malformed input and a stuck local filesystem outside the shell.
    signal.alarm(5)
    resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES,) * 2)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.umask(0o077)
    home = pwd.getpwuid(os.getuid()).pw_dir
    try:
        if sys.argv[1:] == ["read"]:
            sys.stdout.buffer.write(read_state(home))
        elif sys.argv[1:] == ["write"]:
            write_state(home, sys.stdin.buffer.read(MAX_BYTES + 1))
        else:
            raise UnsafeState("invalid operation")
        return 0
    except (OSError, ValueError, MemoryError, RecursionError):
        sys.stderr.write("Kids Math: state unavailable or rejected\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
