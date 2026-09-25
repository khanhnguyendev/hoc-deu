# ADR-0004: Open sign-up with admin approval

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §0.1 (Q1, Q2), §2.2, §2.4, §2.5, §4.3, §4.5; decisions 13, 17, 19, 23

## Context

Học Đều is a small, non-commercial platform. Anyone with a Google or GitHub account may sign up
(ADR-0003), but the owner wants to know who uses it, keep the free-tier budget (§8) for real
learners and be able to stop an account that misbehaves. The platform sends **no e-mail** (Q2:
Supabase's built-in SMTP allows two messages an hour, to team addresses only), so an account's
state can only be shown in the app.

The first admin cannot be approved by anyone, so a bootstrap is needed (§2.5) — but an
environment list must never undo what an admin decided later.

## Decision

- **Every new account is a pending learner.** The `on_auth_user_created` trigger creates the
  profile with `status = 'pending'`, `role = 'learner'`; users cannot insert or change their own
  role or status (column grants and RLS, §4.5).
- **Four statuses, five transitions** (decision 17): `pending → active | rejected`,
  `active → suspended`, `suspended | rejected → active`. Anything else raises
  `invalid_transition`. There is no way back to `pending`, and a rejection is not final: an
  admin can activate a rejected account later.
- **Two roles:** `learner` and `admin`; a change to the current role raises `no_change`. Admin
  rights need both `role = 'admin'` and `status = 'active'` (`is_admin()`), so suspending an admin
  also removes their rights.
- **Only an active admin decides, never about themselves.** `admin_set_status` and
  `admin_set_role` are `SECURITY DEFINER`, callable by `authenticated`, check `is_admin()` first
  (`forbidden`) and refuse the caller's own id (`cannot_change_self`). They lock the profile row
  (`for update`), so two admins acting at once cannot both pass the transition check. The server
  actions (`features/admin/actions.ts`) call `requireAdmin()` first, validate the input with Zod
  and call the functions with the **admin's own session** — never the secret key — so the
  database checks the caller itself. No admin can lock themselves out; another admin can.
- **Every decision is audited.** Each change writes one event — `admin.user_approved`,
  `admin.user_rejected`, `admin.user_suspended` or `admin.role_changed` — with the admin as
  `actor_id`, `source = 'admin'` and `{ targetUserId, from, to }`. Activation also sets
  `approved_by` and `approved_at`. Admin events do not count against the learner write quota
  (ADR-0030).
- **The queue is `/admin/users`** (§2.4; until the overview, `/admin` redirects there with a
  `next.config.ts` redirect, decision 13). It reads `admin_list_users()` (decision 19): `SECURITY
  DEFINER`, `is_admin()` first, the e-mail from `auth.users`, account fields only — no notes, no
  events (§4.5). Pending accounts come first, oldest first; then everyone else, newest first.
  "Duyệt" and "Kích hoạt lại" act at once; "Từ chối", "Tạm khoá" and role changes ask in a
  confirm dialog. The acting admin's own row shows "Bạn" and no actions. Non-admins get the 404
  (`requireAdmin()`), so the admin area is not advertised.
- **Status is in the app only.** A pending, rejected or suspended user who signs in lands on
  `/pending` (every guarded route group sends a non-active user there) and sees the copy for
  their status; the page refreshes itself (every 30 s, on focus, when the tab becomes visible) and
  moves on as soon as the account is approved. No e-mail, push or chat message is sent.
- **Bootstrap only for a never-processed profile, and only while no active admin exists**
  (decision 23, owner review MF1, ruling R13). On sign-in, a provider-verified e-mail listed in
  `ADMIN_EMAILS` calls `admin_bootstrap`, which promotes only a profile that is `learner`,
  `pending` and has never been approved (`approved_at` null), and only when no profile is an
  active admin. A suspended admin stays suspended, a demoted admin stays a learner and a rejected
  e-mail stays rejected: the env list never overrides an admin decision. That holds even when the
  listed account deletes itself (any signed-in account may, §4.6) and signs in again — the fresh
  profile is never-processed, but an active admin exists, so it waits in the queue like anyone
  else. Removing an address demotes no one. A transaction-scoped advisory lock serialises
  bootstraps, so two listed e-mails signing in at once cannot both become admin.
- **Break-glass.** If no active admin remains — the last admin deleted their account, or every
  admin was suspended or demoted by another who has since left — nobody can approve anything in
  the app. Two paths restore one:
  - **Automatic, for a listed e-mail:** the next sign-in of an e-mail in `ADMIN_EMAILS` with a
    never-processed profile bootstraps it (e.g. the owner's new account after the last admin
    deleted theirs). This is why `ADMIN_EMAILS` holds only the owner's e-mail (runbook §5).
  - **Manual, for anyone else:** the owner runs the break-glass SQL in the runbook
    (`docs/ops/staging.md` §8), as `postgres` in the Supabase SQL editor, for one named account —
    an account whose profile was already processed (suspended, rejected or demoted) or that is
    not listed. It is the only path that changes a role or status outside the admin functions.

## Consequences

- Easier: no e-mail infrastructure or deliverability to manage; every access decision is in the
  event log with who made it and when.
- Easier: the database enforces the rules — a bug in the page or a hand-crafted request cannot
  approve an account without an active admin session, skip a transition or act on the caller.
- Harder: a new user learns about the approval only by coming back (the `/pending` page updates by
  itself while it is open). Accepted for a small, invited-by-word-of-mouth audience.
- Harder: with a single admin, that admin cannot be suspended or demoted by anyone, and if they
  leave, only a listed e-mail's next sign-in or the break-glass SQL helps. Keeping a second admin
  avoids both.
- Accepted: while no active admin exists, any e-mail in `ADMIN_EMAILS` becomes admin on its next
  sign-in — the list is trusted exactly as much as the owner. Keep it to the owner's own address.
- Accepted: the queue shows every account on one page, without search or paging — enough for tens
  to a few hundred accounts; paging can come when the list outgrows that. Sign-up days are shown
  as calendar days in `Asia/Ho_Chi_Minh`, the platform default.
