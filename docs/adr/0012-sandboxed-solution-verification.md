# ADR-0012: Solutions verified in a sandboxed CI job; phased harness

- **Status:** accepted
- **Date:** 2026-09-25
- **Spec:** platform design §3.5, §3.7; implementation plan Part B-M3 (owner decision OD2,
  decisions 18–21, gate-review fixes 6, 8, 17)

## Context

Every DSA problem with a note ships Python, Java and Go solutions and a `tests.yaml` (§3.5); the
badge a learner sees (`tested` / `compile-only`) must be earned by actually running them. From
v1.1 an AI bot writes solutions too and opens content PRs, so `content-verify` runs code nobody
has reviewed yet: the job is a security boundary, not just a test runner. §3.7 asks for a job with
no secrets and a read-only `GITHUB_TOKEN` that runs solutions "in a container with no network",
as a required check that always runs.

## Decision

- **A dedicated no-network user instead of a container (OD2, a deviation from §3.7).** The
  `content-verify` workflow creates a system user `cvsandbox` on the GitHub runner and rejects all
  of its outgoing IPv4 and IPv6 traffic — loopback included — with iptables and ip6tables owner
  matches; an ACL denies it systemd-resolved's varlink directory, the D-Bus system socket, nscd and
  snapd's sockets, so it cannot resolve names or reach the snap store by any route either. It has
  no supplementary group and is listed in `cron.deny` and `at.deny`, so it cannot schedule a
  process that outlives the run. The same orchestrator runs locally and in CI; CI wraps
  each toolchain command as `sudo -n -u cvsandbox -- timeout --kill-after=1 <limit> prlimit
  --nproc=512 --fsize=256MiB --core=0 -- env -i PATH=<toolchain dirs> HOME=/tmp … <absolute tool>
  <args>`. No image is pulled or maintained, and the toolchains are the ones the setup actions
  install (Python 3.13, Temurin 25 compiling `--release 21`, Go 1.26).
- **Hardening (gate-review fix 6 and the 3.5b review).**
  - Compile commands run as the sandbox user as well as the cases (annotation processors, cgo and
    build scripts are code execution too): `CGO_ENABLED=0`, `GOPROXY=off`, `GOTOOLCHAIN=local`,
    `GOENV=off`, `GOWORK=off`, `-buildvcs=false`; `javac -proc:none`; Python `-I -B`.
  - Every file the sandbox runs (solution, `runner.py`, `check.py`, `HarnessJson.java`,
    `normalize.go`, the generated harness) is copied into a per-unit work directory under a fresh
    `/tmp` directory; nothing is written into `content/`. Content is never read through a symlink:
    a symlinked problem directory, `tests.yaml` or solution is an error, not something the runner
    copies.
  - Nothing the runner or root executes after sandboxed code comes from a PATH lookup: `sudo`,
    `timeout`, `prlimit`, `env`, `pkill`, `pgrep`, `kill`, `chown` and `rm` are fixed `/usr/bin`
    paths, checked root-owned and writable by root only — every directory up to `/`, along every
    hop of a symlink chain — before sandbox mode starts; the toolchains must not be writable by
    others. The runner image is pinned (`ubuntu-24.04`).
  - **The strip.** Once every toolchain and dependency is installed (no action runs after it), one
    `find` as root walks every local disk filesystem (ext2/3/4, xfs, btrfs; pseudo, tmpfs and
    squashfs mounts are not walked, and are logged). It removes write-for-others (the mode bits)
    from every entry except symlinks, and search-for-others from every directory others can enter
    but not list. The shared `/tmp` and `/var/tmp` are skipped as whole subtrees — nothing under
    them changes — and keep 1777. It also removes the default ACLs of the tool cache's directories
    (the image ships them as `drwxrwxrwx+`), so nothing created there later is writable by others
    again. It fails closed:
    - unless `/` is one of the walked types, the walk reached `/usr/bin` (it really walked `/`),
      and every audited root and PATH directory sits on a walked filesystem;
    - if a tool-cache directory still carries a default ACL afterwards;
    - if any entry already carries the new user's uid or gid — an orphaned id the new user
      inherits: an entry it owns it could `chmod` back to writable, which the audit (it judges
      only present access) cannot see, and an entry of its group grants it the group's bits,
      which the strip does not remove.

    It logs what it changed, by tree, and how long it took (PR #5's run 2: 811,443 entries in
    184 s, the whole job about 4 minutes). A per-tree `chmod` was tried first and was not enough
    on the real image (PR #5's first run, 1958 audit findings). `/opt`, `/usr/lib/jvm` and the
    tool cache were 0777 (run 2's `namei` shows them), and `/usr/share`,
    `/usr/local/lib/node_modules`, `/usr/local/.ghcup` and binaries in `/usr/local/bin` were
    writable by others (the first run's audit findings), all reached from PATH through links. The
    tool cache's Java `x64` is only a link to `/usr/lib/jvm/…`, which `chmod -R` on the tool cache
    never enters.
  - **The audit.** `sandbox_audit.py` then runs as the sandbox user over these roots: every PATH
    directory (for a missing one, its nearest existing parent), `/opt`, `/usr/local`, `/home` and
    `/etc`, each symlink chain in them hop by hop. It fails on any writable file, directory, link
    hop or target, or any directory it can enter but not list. It fails as broken unless its
    positive controls hold (it runs as the sandbox user, `/tmp` is writable, it walked a real
    tree). The audit judges by what the sandbox user can do now (`os.access`: mode bits, groups,
    ACLs), so it sees ACLs as they are when it runs: a default ACL shapes only entries created
    later, which is why the strip removes the tool cache's. Ownership is the strip's job, because
    a file the user owns but cannot yet write passes `os.access`. The runner's own temp files move
    to `RUNNER_TEMP`.
  - After every command, `kill -KILL -1` as the sandbox user (every process of the uid in one
    syscall), then `pkill -KILL` by effective and real user, repeat until `pgrep` finds no sandbox
    process (or the run stops), so in sandbox mode units run one at a time. A unit
    directory is handed to the sandbox user (`chown -R -P`) right after the runner wrote it; the
    shared Go cache only once, while empty.
  - A runaway case meets four fences: the Node timer (SIGTERM, then SIGKILL; a kill the runner may
    not deliver to the root-owned `sudo` does not end the case early), the inner `timeout`
    (`sudo` cannot relay SIGKILL), the `prlimit` caps and the `pkill`.
- **Fail closed.** The CLI refuses to run on GitHub Actions (`GITHUB_ACTIONS=true`) without
  `CONTENT_VERIFY_SANDBOX_USER` (exit 2), and the workflow checks that it does. Before verifying
  content, a self-test step proves the sandbox user can run every toolchain and can neither
  resolve a name nor connect by address or on loopback (`ECONNREFUSED`, with positive controls
  from the runner, so the checks cannot pass vacuously), nor open the resolver, D-Bus, docker or
  snapd sockets (`PermissionError`); the integration test then runs the fixtures through the
  sandbox and must report every test passed (none skipped), and a step after each run checks no
  sandbox process survived.
- **The job** has `permissions: contents: read`, no secrets, `persist-credentials: false`. It is a
  required check that always reports: the path check (content, the harness, everything it imports,
  the dependency and test configuration, the workflow; pinned by
  `tools/content-verify/workflow.test.ts`) is a step inside the job and every later step carries
  its `if:` (fix 17).
- **Phased harness (§3.7, §0).** M3a runs `function` signatures (numbers, strings, arrays, nested
  arrays); M3b adds linked lists, trees, graph nodes and random-pointer lists; M3c design classes
  (operation sequences, `$result` / `$any`) — both before any learner reaches week 4. The status is
  derived, not declared: `tested` iff the signature kind is in `SUPPORTED_SIGNATURE_KINDS`
  (`lib/content/verification.ts`), otherwise `compile-only` (decision 21).
- **Compile-only fallback:** Python `compile()` plus an `ast` check for the class and methods;
  `javac` plus a declaration check; `go vet` plus checks for the function, or the struct,
  `Constructor` and each method.
- **Runners only execute and print JSON; one Node orchestrator compares** (decision 19). Python
  loads the solution from a static runner (request on stdin); Java and Go get generated harnesses
  with literal arguments; each problem × language compiles once and runs once per case. Go's
  normaliser turns nil slices into `[]` (fix 8) and bytes (`char`) into strings.
- **Validators stay outside `content/**`** (`tools/content-verify/validators/`): a new validator
  is a normal code PR, so a content PR can never add executable check code.

## Consequences

- No container image to build, pin or update, and one code path for local and CI runs. A
  developer's local run is unsandboxed: it executes the repository's own solutions as the
  developer, like any test suite.
- **Blocked** for the sandbox user: every IPv4/IPv6 packet it sends (TCP, UDP, ICMP, loopback
  included), name resolution (port 53 by iptables; systemd-resolved's varlink socket, D-Bus and
  nscd by ACL), the snapd sockets, writing anywhere on the runner's local disks outside `/tmp` and
  `/var/tmp` (the strip, by mode bits; the audit proves it — mode bits, groups and ACLs — as the
  sandbox user for its roots, the ones the runner executes from: the PATH directories, `/opt`,
  `/usr/local`, `/home`, `/etc`), leaving a process behind or scheduling one (cron, at), more
  than 512 processes or a file over 256 MiB.
- **Not blocked** (accepted, the job holds nothing worth stealing — no secrets, a read-only token,
  no persisted credentials): reading world-readable files, whose content a solution can print into
  the public log; other Unix-domain sockets it has file permission for, and abstract-namespace
  sockets, which no file permission governs; writing to the shared `/tmp`, `/var/tmp` and the
  world-writable directories of tmpfs mounts, which the strip does not walk (`/dev/shm`,
  `/run/lock`);
  memory beyond Java's `-Xmx` (no address-space cap: it breaks the JVM), bounded only by the
  runner and the timeouts. All units share one sandbox user, and Go units share a build cache, so
  a hostile solution could tamper with another problem's verdict within the same run; the damage
  is a wrong verdict in a PR that a person reviews, never a leak.
- **Next step (M3b, when content grows):** a transient systemd unit per command (`systemd-run
  --pipe --wait -p User=… -p PrivateNetwork=yes -p ProtectSystem=strict -p ReadWritePaths=<unit>
  -p PrivateTmp=yes -p LimitNPROC=… -p RuntimeMaxSec=…`) would close the Unix-socket, `/tmp` and
  filesystem-read gaps with a private network namespace and mount view, and one sandbox user per
  worker would allow parallel sandboxed runs; today W1–W3 take about 90 s sequentially.
- A `tested` badge means the three solutions agree with the hand-checked `tests.yaml`, not that
  they are optimal; a bot-written note says "tested (bot tests)" until published (ADR-0040).
