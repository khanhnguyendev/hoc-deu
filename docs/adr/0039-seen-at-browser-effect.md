# ADR-0039: `seen_at` is set only by a browser-side effect on `/today`

- **Status:** accepted
- **Date:** 2026-09-26 (M5 task 5.1b)
- **Spec:** platform design §5.2, §5.4, §2.4; implementation plan Part B-M5 decision 6

## Context

The gate (§5.2, ADR-0016) closes on the **last seen plan**: a plan the learner opened and left
without a `done` / `partial` check-in pauses the roadmap. "Seen" must therefore mean that a
person looked at the plan — not that some code path built or read it. Three paths build or read
today's plan without anyone looking at it:

- `ensureToday` runs in the `/today` render (decision 6), and a render is not a view: Next.js
  prefetches routes it has links to (the app shell's "Hôm nay" link is on every page), and a full
  prefetch renders the page on the server;
- "Học thêm" (5.4) and off-plan study run `ensureToday` to attach items to today's plan, and the
  settings actions rebuild an untouched plan (5.1a) — none of them shows the plan;
- the bot (v1.1) pre-creates AI plans for days the learner may never open.

If any of these marked the plan seen, a learner who never opened `/today` could find the roadmap
paused the next day, and an AI user would be paused by a plan the bot wrote for them.

## Decision

- `day_plans.seen_at` is set **only** by `<MarkPlanSeen planId>`
  (`features/today/components/mark-plan-seen.tsx`), a client component that calls the
  `markPlanSeen` server action from `useEffect` after `/today` has rendered the plan **in the
  browser**. The action calls `mark_plan_seen(plan_id)` (idempotent,
  `seen_at = coalesce(seen_at, now())`, the caller's own plan only — `auth.uid()`).
- `ensureToday`, `resumeToday`, `rebuildTodayIfUntouched` and every other server path never write
  `seen_at` — not even through `plan.generated`. Server rendering never runs effects, so no render
  — a prefetch's included — can mark a plan.
- `<MarkPlanSeen>` renders only in the `plan` state (`TodayPage.markSeenPlanId`): today's plan.
  The resumed and paused views show an older plan that is already seen. It fires once per plan id
  (a re-render, a new action identity or StrictMode's second effect run sends nothing more); a
  failed call is swallowed and the next visit marks the plan again. The server action comes from
  the page as an unbound prop (a client component never imports the server-only feature API).

## Consequences

- A **default prefetch** of `/today` (the `<Link>` default, `prefetch="auto"`) stops at the
  segment's `loading.tsx` (task 5.1c keeps it) and never runs the page, so it neither builds nor
  marks a plan. Visiting another page leaves no seen plan behind (e2e: `today.spec.ts`).
- A **full prefetch** (`prefetch={true}`) of `/today` would run `ensureToday` and could build
  (store) today's plan without anyone seeing it. Nothing in the app uses one for `/today`; the
  unseen plan it could leave is harmless to the gate (unseen plans never count) but would fix the
  day's plan early — a later settings change rebuilds it only while it is untouched. Adding a full
  prefetch of `/today` needs a new decision.
- An **AI plan never opened never closes the gate**: the bot's plan for a day the learner skipped
  stays unseen, so the gate keeps looking at the last plan the learner actually opened (§5.2), and
  AI and baseline users follow one rule.
- Opening `/today` with scripts disabled, or leaving before hydration, does not mark the plan:
  the learner saw at most a server-rendered page for a moment, and the gate treats the day as not
  seen. We accept that — the opposite error (pausing a learner who never saw the plan) is worse.
- The mark costs one small request each time `/today` mounts in the `plan` state (the RPC is
  idempotent; re-renders of the same plan in one mount send nothing).
