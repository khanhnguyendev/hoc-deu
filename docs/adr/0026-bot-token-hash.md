# ADR-0026: Bot token hash in the database, rotated from `/admin/bot`; a two-lock kill switch

- **Status:** accepted
- **Date:** 2026-09-28
- **Spec:** platform design §2.2, §2.4, §2.5, §4.2, §6.2, §6.3, §6.4; implementation plan Part B-M6
  decisions 5, 7, 22 and 31 (task 6.3)

## Context

The bot API (`/api/bot/v1/*`, v1.1) is called by the Claude Routine and, as a fallback, by a
GitHub Actions job (§6.9). It writes plans, custom items and roadmap overrides for real learners,
so it needs a credential, a brake and a way to replace the credential without downtime:

- The Routine holds the credential as an API credential of its environment (§6.3); the fallback
  holds it as a GitHub secret. Both must be updated when it changes, one after the other.
- A credential in an env var needs a redeploy to change, and whoever reads Vercel's env reads the
  credential. The admin page should be the one place to create and replace it.
- A leak of the database (a backup, a support dump) must not hand out a working credential.
- The route map is public; a timing side channel on the comparison must not leak the token.
- M6 must change no production behaviour when it merges (decision 5): nothing may turn the bot on.

## Decision

- **The token is a random 32-byte bearer**, `hdb_` + 43 base64url characters
  (`lib/bot/token.ts`, `newBotToken`), generated on the server with `node:crypto`'s `randomBytes`.
  **Only its SHA-256** (64 lowercase hex digits) is stored, in `bot_settings.token_hash`.
- **Rotation from `/admin/bot`** ("Tạo token mới", after a confirm dialog): the server makes a new
  token and sends only its hash to `admin_rotate_bot_token` (6.2b), which moves the current hash
  to `token_prev_hash` with `token_prev_valid_until = now() + 24 hours` and writes the audit event
  `admin.bot_token_rotated` (decision 31). The previous token keeps working for those 24 hours, so
  the Routine credential and the fallback secret can be updated without downtime.
- **The first token is created the same way** — with no current hash there is no previous one and
  no overlap. No token ever lives in an env var.
- **Shown once:** the rotation's server action returns the token to the page that asked; the
  client component keeps it in state and shows it in a read-only field with a copy button and
  "Token chỉ hiện một lần". Nothing stores it: a reload, or any later render, shows only when the
  current token was created (and until when the old one still works). The token is never logged.
- **Checked in constant time:** `requireBotToken` hashes the presented token and compares the
  32-byte digests with `timingSafeEqual`, against the current hash and the previous one, both
  comparisons always running; the previous hash counts only while `token_prev_valid_until > now`.
- **The kill switch has two locks, and both must be on:** the env variable `BOT_API_ENABLED`
  (hard; exactly `true`, a redeploy to change; `lib/env.ts` also requires `BOT_REF_SECRET` of at
  least 32 characters while it is on) and `bot_settings.enabled` (soft; a switch on `/admin/bot`).
  `requireBotToken` checks them in that order before the token: the env lock first, before the
  database is read, then the row; either off answers `503 {"error":"disabled"}`. Then the token
  (`401 {"error":"unauthorized"}`), then the rate limit, 120 requests / 10 minutes per token keyed
  by the first 16 hex characters of the hash (`429 {"error":"rate_limited"}` with `Retry-After`,
  decision 22). Every answer is JSON with `Cache-Control: no-store`.
- `requireBotToken` **returns** its denial, like `requireCronSecret` (ADR-0034): it is listed in
  `RESPONSE_GUARD_NAMES`, and the architecture test accepts it only as
  `const denied = await requireBotToken(request)` followed at once by `if (denied) return denied`.
- **Nothing turns on by merging:** `BOT_API_ENABLED` is unset in production and the seeded row is
  `enabled = false`, `dry_run = true`, `content_proposals = false` (decision 5).

## Consequences

- A database leak yields hashes of 256-bit random tokens: no working credential. A lost token is
  replaced from `/admin/bot` in one click; the old one dies within 24 hours (or at once, by
  rotating twice).
- The owner must copy the token when it is shown; a lost copy means a new rotation.
- Either lock stops the bot: the admin switch without a redeploy, the env variable even if the
  admin page or the database were compromised.
- Each bot request reads `bot_settings` once (one row, secret-key client): cheap, and a switch
  flipped mid-run takes effect on the next request.
- The rate limit is a brake against runaway retries, not an attacker (it fails open to memory,
  decision 22); the kill switch is the real brake.
