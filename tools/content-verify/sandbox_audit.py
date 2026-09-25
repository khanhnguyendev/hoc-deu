"""content-verify sandbox audit (ADR-0012): run AS the sandbox user, before any solution runs.

    python3 -I -B - --user cvsandbox --path "$PATH" /opt /usr/local /home /etc < sandbox_audit.py

Reports everything the calling user can write that the runner may later execute from:
- every directory and regular file under each root and each existing PATH directory (and the
  ancestors of each root), symlinks never followed while walking;
- every symlink found there: each hop of its chain (the directories above each hop, and the
  final target unless it is a device or under /proc or /sys; for a dangling link, the nearest
  existing directory above the missing target);
- every PATH entry: a relative entry, or a missing directory whose nearest existing ancestor
  (or any directory above it) is writable.

Positive controls, so the audit cannot pass by checking nothing: it must run as --user, the
--writable-control directory (/tmp) must be writable, and it must walk at least --min-entries
entries. A directory it cannot read is unreachable (fine); any other error breaks the audit.

A writable directory is reported once and not descended into (everything below it is the
sandbox user's anyway); a directory it can enter but not list is a finding too (writable paths may
be reachable by name). Findings are printed as they are found, up to --max-printed, then counted;
progress goes to stderr, so the run is never silent.

Exit 0: clean · 1: findings (printed) · 2: the audit itself is broken. The last stdout line is
always the summary `audited N entries under K roots as USER: M findings` — CI trusts no exit status
without it. --assume-trusted DIR skips DIR and its ancestors (for tests on a developer's machine).
"""

import argparse
import os
import pwd
import stat
import sys

MAX_HOPS = 40
PSEUDO = ("/proc/", "/sys/")
PROGRESS_EVERY = 50_000


class Audit:
    def __init__(self, trusted, max_printed):
        self.trusted = [os.path.realpath(path) for path in trusted]
        self.max_printed = max_printed
        self.findings = {}  # insertion-ordered set: O(1) de-duplication
        self.errors = []
        self.entries = 0
        self._writable = {}

    def is_trusted(self, directory):
        return any(
            directory == path or path.startswith(directory.rstrip("/") + "/")
            for path in self.trusted
        )

    def writable(self, path):
        if path not in self._writable:
            self._writable[path] = os.access(path, os.W_OK)  # real uid: the sandbox user
        return self._writable[path]

    def find(self, message):
        if message in self.findings:
            return
        self.findings[message] = None
        if len(self.findings) <= self.max_printed:
            print(message, flush=True)

    def first_writable_above(self, path):
        """The first writable directory from / down to dirname(path), skipping trusted ones."""
        parts = [part for part in os.path.dirname(path).split("/") if part]
        for index in range(len(parts) + 1):
            directory = "/" + "/".join(parts[:index])
            if not self.is_trusted(directory) and self.writable(directory):
                return directory
        return None

    def nearest_existing(self, path):
        current = path
        while not os.path.lexists(current):
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
        return current

    def check_link(self, link):
        current = link
        for _ in range(MAX_HOPS):
            target = os.readlink(current)
            # Against the real directory the link sits in: `..` after a symlinked parent goes
            # where the kernel goes, not where the text suggests.
            base = os.path.realpath(os.path.dirname(current))
            current = os.path.normpath(os.path.join(base, target))
            above = self.first_writable_above(current)
            if above is not None:
                self.find(f"link {link}: {above} is writable")
            if not os.path.lexists(current):
                existing = self.nearest_existing(current)
                if not self.is_trusted(existing) and self.writable(existing):
                    self.find(f"link {link}: {existing} is writable")
                return
            mode = os.lstat(current).st_mode
            if stat.S_ISLNK(mode):
                continue
            if stat.S_ISCHR(mode) or stat.S_ISBLK(mode) or current.startswith(PSEUDO):
                return
            if self.writable(current):
                self.find(f"link {link}: target {current} is writable")
            return
        self.find(f"link {link}: more than {MAX_HOPS} hops")

    def check_entry(self, path):
        """Checks one entry; True when it is a writable directory (reported, not descended)."""
        self.entries += 1
        if self.entries % PROGRESS_EVERY == 0:
            print(f"sandbox_audit: {self.entries} entries so far ({path})", file=sys.stderr, flush=True)
        try:
            mode = os.lstat(path).st_mode
        except (FileNotFoundError, PermissionError):
            return False  # vanished, or not reachable by this user
        if stat.S_ISLNK(mode):
            self.check_link(path)
            return False
        if (stat.S_ISDIR(mode) or stat.S_ISREG(mode)) and self.writable(path):
            self.find(f"writable: {path}")
            return stat.S_ISDIR(mode)
        return False

    def walk(self, root):
        print(f"sandbox_audit: walking {root}", file=sys.stderr, flush=True)
        above = self.first_writable_above(root)
        if above is not None:
            self.find(f"writable: {above} (above {root})")

        def on_error(error):
            if isinstance(error, PermissionError):
                # Unlistable is fine unless it can still be entered: then a writable path below
                # may be reachable by a name the audit cannot see.
                if error.filename and os.access(error.filename, os.X_OK):
                    self.find(
                        f"searchable but unlistable: {error.filename} (writable paths may hide by name)"
                    )
            elif not isinstance(error, FileNotFoundError):
                self.errors.append(f"{error.filename}: {error}")

        if self.check_entry(root):
            return
        for directory, dirs, files in os.walk(root, onerror=on_error, followlinks=False):
            dirs[:] = [name for name in dirs if not self.check_entry(os.path.join(directory, name))]
            for name in files:
                self.check_entry(os.path.join(directory, name))

    def check_path_entry(self, entry):
        if not entry or not os.path.isabs(entry):
            self.find(f'PATH entry "{entry}" is relative')
            return None
        if os.path.isdir(entry):
            return entry
        existing = self.nearest_existing(entry)
        for directory in [existing, *self.ancestors(existing)]:
            if not self.is_trusted(directory) and self.writable(directory):
                self.find(f"PATH {entry}: missing, and {directory} is writable")
                break
        return None

    @staticmethod
    def ancestors(path):
        result = []
        current = os.path.dirname(path)
        while True:
            result.append(current)
            parent = os.path.dirname(current)
            if parent == current:
                return result
            current = parent


def broken(message):
    """The audit itself failed: exit 2, never mistaken for findings (1) or clean (0)."""
    print(f"sandbox_audit: {message}", file=sys.stderr)
    sys.exit(2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True)
    parser.add_argument("--path", required=True)
    parser.add_argument("--writable-control", default="/tmp")
    parser.add_argument("--min-entries", type=int, default=100)
    parser.add_argument("--max-printed", type=int, default=200)
    parser.add_argument("--assume-trusted", action="append", default=[])
    parser.add_argument("roots", nargs="+")
    args = parser.parse_args()

    actual = pwd.getpwuid(os.geteuid()).pw_name
    if actual != args.user:
        broken(f"runs as {actual}, not {args.user}")
    if not os.access(args.writable_control, os.W_OK):
        broken(f"positive control: {args.writable_control} is not writable")

    audit = Audit(args.assume_trusted, args.max_printed)
    roots = []
    for entry in args.path.split(":"):
        existing = audit.check_path_entry(entry)
        if existing is not None:
            roots.append(existing)
    roots.extend(root for root in args.roots if os.path.isdir(root))
    roots = list(dict.fromkeys(roots))
    for root in roots:
        audit.walk(root)

    if audit.errors:
        broken("could not audit:\n" + "\n".join(audit.errors[:20]))
    if audit.entries < args.min_entries:
        broken(f"walked only {audit.entries} entries (< {args.min_entries})")
    hidden = len(audit.findings) - args.max_printed
    if hidden > 0:
        print(f"… {hidden} more findings not shown", flush=True)
    print(
        f"audited {audit.entries} entries under {len(roots)} roots as {actual}: "
        f"{len(audit.findings)} findings",
        flush=True,
    )
    sys.exit(1 if audit.findings else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # a crash is a broken audit (2), never "findings" (1)
        broken(f"crashed: {error!r}")
