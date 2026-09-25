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
  matches; an ACL denies it systemd-resolved's varlink directory and the D-Bus system socket, so it
  cannot resolve names by any route either. The same orchestrator runs locally and in CI; CI wraps
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
    `timeout`, `prlimit`, `env`, `pkill`, `pgrep`, `chown` and `rm` are fixed `/usr/bin` paths,
    checked root-owned and writable by root only (every directory up to `/`) before sandbox mode
    starts; the toolchains must not be writable by others. The workflow removes other-write from
    the tool cache and every PATH directory, then fails unless the sandbox user can write nothing
    under PATH, `/opt`, `/usr/local`, `/home` or `/etc`. The runner's own temp files move to
    `RUNNER_TEMP`.
  - After every command `pkill -KILL` by effective and real user repeats until `pgrep` finds no
    sandbox process (or the run stops), so in sandbox mode units run one at a time. A unit
    directory is handed to the sandbox user (`chown -R -P`) right after the runner wrote it; the
    shared Go cache only once, while empty.
  - A runaway case meets four fences: the Node timer (SIGTERM, then SIGKILL; a kill the runner may
    not deliver to the root-owned `sudo` does not end the case early), the inner `timeout`
    (`sudo` cannot relay SIGKILL), the `prlimit` caps and the `pkill`.
- **Fail closed.** The CLI refuses to run on GitHub Actions (`GITHUB_ACTIONS=true`) without
  `CONTENT_VERIFY_SANDBOX_USER` (exit 2), and the workflow checks that it does. Before verifying
  content, a self-test step proves the sandbox user can run every toolchain and can neither
  resolve a name nor connect by address or on loopback (`ECONNREFUSED`, with positive controls
  from the runner, so the checks cannot pass vacuously); the integration test then runs the
  fixtures through the sandbox, and a step after each run checks no sandbox process survived.
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
  included), name resolution (port 53 by iptables; systemd-resolved's varlink socket and D-Bus by
  ACL), writing anywhere the runner later executes from (audited), leaving a process behind,
  more than 512 processes or a file over 256 MiB.
- **Not blocked** (accepted, the job holds nothing worth stealing — no secrets, a read-only token,
  no persisted credentials): reading world-readable files, whose content a solution can print into
  the public log; Unix-domain sockets it has file permission for, and abstract-namespace sockets,
  which no file permission governs; writing to the shared `/tmp`, `/var/tmp` and `/dev/shm`;
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
