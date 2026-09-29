# Content authoring runbook

How DSA problem content (`tests.yaml`, solutions, notes) is sourced and checked. See also:
platform design §3.5–§3.6, ADR-0012 (`pnpm content:verify`), `docs/ops/content-images.md`.

## 1. No automated access to LeetCode (owner rule, 2026-09-29)

- **No tool, script, agent or CI job calls `leetcode.com`** — not the problem pages, not the
  GraphQL endpoint, not any other URL. LeetCode's terms forbid automated access, and a `403` on a
  page is LeetCode blocking bots: working around it (another endpoint, another user agent, a
  proxy) is not allowed.
- Links to problem pages in content are fine; they are followed by learners, not fetched by us.
- An agent that needs an example writes the case from its own reasoning and marks it for the
  person-check below; it never fetches it.

## 2. What goes into `tests.yaml`

- LeetCode's published examples as `example-*` cases: the `Input:` / `Output:` values only, in
  our encoding. Never the statement text, constraints prose or explanations (CLAUDE.md, Content).
- Our own edge cases, each recomputed by hand.

## 3. Checking the examples (a person)

- Every `example-*` case is compared with LeetCode's published examples by a person, in a
  browser, or by the owner in the content PR's review.
- The content PR lists the problems whose examples need that check; the owner spot-checks them
  (and any others) before merging.
- `pnpm content:verify` then proves the three solutions agree with the checked cases; it does not
  check the cases themselves.
