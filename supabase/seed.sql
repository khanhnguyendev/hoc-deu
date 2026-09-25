-- Synthetic users for manual local use only (decision 14): `pnpm db:reset` loads this file.
-- End-to-end tests create their own users through the local admin API instead (e2e/support).
-- Never put real people or per-user data here. Password for every user: test-password-123
-- (the test login on /sign-in, enabled by AUTH_TEST_LOGIN=true).
--
-- auth.users + auth.identities is the minimal insert the local auth server accepts (task 2.1
-- spike): `email_confirmed_at` must be set, and the token columns must be '' rather than NULL.
-- The on_auth_user_created trigger creates each profile as a pending learner.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated',
    'admin@example.test',
    extensions.crypt('test-password-123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Quản trị viên mẫu"}',
    '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated',
    'learner@example.test',
    extensions.crypt('test-password-123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Học viên mẫu"}',
    '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated',
    'pending@example.test',
    extensions.crypt('test-password-123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Người dùng chờ duyệt"}',
    '', '', '', '', ''
  );

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.test"}',
    'email', now(), now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"learner@example.test"}',
    'email', now(), now(), now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    '{"sub":"33333333-3333-4333-8333-333333333333","email":"pending@example.test"}',
    'email', now(), now(), now()
  );

-- admin@example.test: an active admin; learner@example.test: an approved learner. None of them has
-- onboarded, so each lands on /onboarding (or /pending) after signing in.
update public.profiles
set role = 'admin', status = 'active', approved_at = now()
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set status = 'active', approved_at = now()
where id = '22222222-2222-4222-8222-222222222222';

-- pending@example.test keeps the trigger's default: a never-processed pending learner.
update public.profiles
set status = 'pending'
where id = '33333333-3333-4333-8333-333333333333';
