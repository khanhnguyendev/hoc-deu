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
  of its outgoing traffic — loopback included — with iptables and ip6tables owner matches. The
  same orchestrator runs locally and in CI; CI only wraps each toolchain command as
  `sudo -n -u cvsandbox -- timeout --kill-after=1 <limit> env -i PATH=<toolchain dirs> HOME=/tmp
  … <absolute tool> <args>`. No image is pulled or maintained, and the toolchains are the ones the
  setup actions install (Python 3.13, Temurin 25 compiling `--release 21`, Go 1.26).
- **Hardening (gate-review fix 6).** Compile commands run as the sandbox user as well as the cases
  (annotation processors, cgo and build scripts are code execution too); `CGO_ENABLED=0`,
  `GOPROXY=off`, `GOTOOLCHAIN=local`, `GOENV=off`; `javac -proc:none`; Python `-I -B`. Every file
  the sandbox runs (solution, `runner.py`, `check.py`, `Json.java`, `normalize.go`, the generated
  harness) is copied into a per-unit work directory under a fresh temp dir; nothing is written into
  `content/`. After every command `sudo -n pkill -KILL -u cvsandbox` removes anything a solution
  left running, so in sandbox mode units run one at a time. A runaway case meets three fences: the
  Node timer (SIGTERM, then SIGKILL), the inner `timeout` (`sudo` cannot relay SIGKILL) and the
  `pkill`.
- **Fail closed.** The CLI refuses to run on GitHub Actions (`GITHUB_ACTIONS=true`) without
  `CONTENT_VERIFY_SANDBOX_USER` (exit 2). Before verifying content, a self-test step proves the
  sandbox user can run every toolchain and cannot reach the network by name, by address or on
  loopback (with positive controls from the runner, so the checks cannot pass vacuously), and the
  integration test runs the fixtures through the sandbox.
- **The job** has `permissions: contents: read`, no secrets, `persist-credentials: false`. It is a
  required check that always reports: the path check (content, the harness, the schemas, the
  lockfile, the workflow) is a step inside the job and every later step carries its `if:`
  (fix 17).
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
- The sandbox protects the network and the runner's secrets, not the runner's filesystem from
  being read: a solution can read world-readable files, and whatever it prints can reach the
  public log. The job therefore holds nothing worth stealing (no secrets, read-only token, no
  persisted credentials). Resource exhaustion is bounded by the per-case timeout, the `pkill` and
  the job's 20-minute limit, not by cgroups.
- All units share one sandbox user, and Go units share a build cache, so a hostile solution could
  tamper with another problem's result within the same run; the damage is a wrong verdict in a PR
  that a person reviews, never a leak. One sandbox user per worker (M3b, when content grows) would
  also allow parallel sandboxed runs; today W1–W3 take about 90 s sequentially.
- A `tested` badge means the three solutions agree with the hand-checked `tests.yaml`, not that
  they are optimal; a bot-written note says "tested (bot tests)" until published (ADR-0040).
