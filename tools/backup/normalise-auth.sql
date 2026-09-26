-- Run right after a backup's auth.sql is loaded, in the same transaction (task 5.7c, ADR-0029):
-- the restore test (.github/workflows/restore-test.yml) and a restore by hand
-- (docs/ops/backups.md §7) both do.
--
-- A backup holds only the allow-listed auth columns (tools/backup/auth-columns.ts), never a token
-- or a pending change. GoTrue reads these auth.users columns as non-null strings: the local round
-- trip (task 5.7c) set each one null in turn, and GoTrue then failed to load the user (HTTP 500,
-- "converting NULL to string is unsupported"). Loaded without them, the first four are null (no
-- default) and the last four '' (their default); every one that is null becomes '' — no pending
-- confirmation, recovery or change, never an old value, and no reliance on a default a later
-- GoTrue may drop. Idempotent; the columns are tools/backup/auth-columns.ts's NORMALISED_COLUMNS.
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
  or recovery_token is null
  or email_change_token_new is null
  or email_change is null
  or email_change_token_current is null
  or phone_change is null
  or phone_change_token is null
  or reauthentication_token is null;
