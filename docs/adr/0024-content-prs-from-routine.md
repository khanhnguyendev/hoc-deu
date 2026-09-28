# ADR-0024: Content PRs only from the Routine; publishing through admin requests; no GitHub write token in the app

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §2.3, §2.4, §4.2, §6.4.1, §6.4.6, §6.4.7, §6.6, §6.9, §6.11;
  implementation plan Part B-M6 decisions 19 and 20 (task 6.7a)

## Context

The daily bot proposes shared content (lessons, notes, cards, exercises) through pull requests,
and bot-written notes, deep-dives and lessons ship as drafts (ADR-0025) that an admin publishes
later. The forces:

- `main` is protected by required checks and auto-merge (§6.6, ADR-0023). A pull request opened
  with a workflow's `GITHUB_TOKEN` **does not trigger** other workflows, so its required checks
  never report and it could never merge — or would need someone to bypass the ruleset.
- The Routine (M7) works under the owner's GitHub identity, so its PRs trigger the checks like any
  owner PR. The GitHub Actions fallback runner (§6.9) only has `GITHUB_TOKEN`.
- The app runs on Vercel with a public repository. A GitHub write token in the app would let any
  bug in a route, or a leaked environment, push to the repository.
- Publishing is a one-line `status` change per target, but it has to go through the same checks
  as any content change, and `bot-content-policy` must be able to tell an approved draft → active
  flip from one the bot made up.

## Decision

- **Content PRs come only from the Routine** (`claude/content-<date>`, at most one per plan run),
  never from the fallback runner: its PRs would not trigger the required checks.
- **The app holds no GitHub write token.** It only reads the public GitHub API without a token
  (the maintenance cron: workflow runs, ADR-0034, and pull request states).
- **Publishing goes through admin publish requests** (`content_publish_requests`, §4.2):
  - "Xuất bản" on `/admin/content` (admins only) records a pending request for a **draft** item or
    draft note (target = item ID or `<itemId>#note`), after the admin ticks the three-item publish
    checklist (§6.6). The server checks the target against the deployed catalog before the RPC
    (`admin_request_publish`); one pending request per target (a second click returns the same
    one). "Huỷ" cancels a pending request (`admin_cancel_publish`). Both run with the admin's own
    session and count against the admin-action rate limit.
  - A **publish run** (`POST /runs {"kind":"publish"}`, ADR-0027) takes the pending requests that
    are in no PR yet, flips exactly those targets to `active` in a
    `claude/content-publish-<date>-<n>` PR and reports the PR and the request IDs through `PATCH
    /runs/{runId}`, which sets their `pr_url`. Until the Routine's `/fire` trigger exists, requests
    wait for the next scheduled run; "Chạy ngay" is built in M7 task 7.4 (Part B-M6 decision 20).
  - `GET /api/content/publish-requests` is **public** and answers the pending targets only
    (`publish_request_targets()`, the publishable key, no session): `200 {"targets":[…]}`,
    `Cache-Control: public, max-age=60`; `503 {"ok":false}` on a database error.
    `bot-content-policy` fails any draft → active flip without a pending request.
  - **Lifecycle** (the maintenance cron's `publish` step, ADR-0034): a pending request whose target
    the deployed catalog shows `active` → `merged`; a pending request whose PR the public GitHub
    API reports closed unmerged loses its `pr_url`, so the next publish run retries it. A PR merged
    on GitHub but not yet deployed leaves its requests pending until the deployed catalog shows
    the flip.
- **Content signals** (`GET /runs/{runId}/content-signals`, §6.4.7) are the content loop's only
  input: aggregates only (decision 19), for today's plan run while `content_proposals` is on
  (`409 {"error":"content_proposals_off"}` otherwise). Their `openProposals` list the pending
  publish targets and today's content PR, so the bot does not propose the same thing twice.

## Consequences

- Easier: no GitHub credential to protect or rotate in Vercel; every change to `main`, publishing
  included, passes the same required checks; an admin publishes with two clicks and never edits
  YAML or MDX.
- Harder: publishing is asynchronous — a request waits for the next publish run, then for the PR
  to merge and deploy (the cron marks it merged the next day at the latest). The fallback runner
  cannot open content PRs; if the Routine is down, content waits (plans still work).
- Accepted: the manual fallback is a one-line `status` edit in the GitHub web editor (the owner's
  PR runs the checks like any other). The public targets endpoint reveals which draft IDs are
  queued for publishing — public data in a public repository.
