begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql

select plan(34);

-- 1. Sign-up (the trigger on auth.users) creates a pending learner profile (§4.5).
select tests.create_user(
  'nguyen@hocdeu.test', null, null,
  '{"full_name": "Nguyễn Văn A", "avatar_url": "https://x.test/a.png"}'
) as signup \gset
select results_eq(
  format(
    $$select status, role, ai_personalization, share_notes_with_ai, display_name, avatar_url
      from public.profiles where id = %L$$,
    :'signup'
  ),
  $$values ('pending'::text, 'learner'::text, false, false, 'Nguyễn Văn A'::text,
            'https://x.test/a.png'::text)$$,
  'sign-up creates a pending learner profile with the name and avatar from the metadata'
);
select matches(
  (select bot_ref from public.profiles where id = :'signup'),
  '^[0-9a-f]{16}$',
  'bot_ref is 16 random hex characters'
);

select tests.create_user(
  'http-avatar@hocdeu.test', null, null, '{"avatar_url": "http://x.test/b.png"}'
) as http_avatar \gset
select is(
  (select avatar_url from public.profiles where id = :'http_avatar'),
  null::text,
  'an http:// avatar is stored as null'
);

select tests.create_user('no-meta@hocdeu.test', null, null) as no_meta \gset
select is(
  (select display_name from public.profiles where id = :'no_meta'),
  'no-meta',
  'without metadata the display name is the e-mail local part'
);

select tests.create_user('spaces@hocdeu.test', null, null, '{"full_name": "   "}') as spaces \gset
select is(
  (select display_name from public.profiles where id = :'spaces'),
  'spaces',
  'a full_name of spaces only falls back to the e-mail local part (never blocks sign-up)'
);

select tests.create_user(
  'fallback@hocdeu.test', null, null, '{"full_name": " ", "name": "", "user_name": " octocat "}'
) as fallback \gset
select is(
  (select display_name from public.profiles where id = :'fallback'),
  'octocat',
  'blank full_name and name fall through to the trimmed user_name'
);

select tests.create_user(
  'long@hocdeu.test', null, null, jsonb_build_object('name', repeat('ă', 100))
) as long_name \gset
select is(
  (select display_name from public.profiles where id = :'long_name'),
  repeat('ă', 80),
  'a name longer than 80 characters is cut to 80'
);

-- Fixtures for the rest of the file.
select tests.create_user('active@hocdeu.test') as active \gset
select tests.create_user('pending@hocdeu.test', 'pending') as pending \gset
select tests.create_user('admin@hocdeu.test', 'active', 'admin') as admin \gset
select tests.create_user('suspended-admin@hocdeu.test', 'suspended', 'admin') as suspended_admin \gset

-- 2. A user sees only their own profile.
select tests.authenticate_as(:'active');
select results_eq(
  'select id from public.profiles',
  format('values (%L::uuid)', :'active'),
  'as authenticated, a user sees only their own profile'
);

-- 3. anon has no access at all.
select tests.clear_authentication();
set local role anon;
select throws_ok(
  'select id from public.profiles',
  '42501',
  'permission denied for table profiles',
  'anon cannot select profiles'
);

-- 4. Role, status, the AI flag and the server-set columns are not user-writable (column grants).
select tests.authenticate_as(:'active');
select throws_ok(
  $$update public.profiles set status = 'active' where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update status'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update role'
);
select throws_ok(
  $$update public.profiles set ai_personalization = true where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update ai_personalization'
);
select throws_ok(
  $$update public.profiles set onboarded_at = now() where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update onboarded_at'
);
select throws_ok(
  $$update public.profiles set approved_by = auth.uid() where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update approved_by'
);
select throws_ok(
  $$update public.profiles set bot_ref = 'deadbeefdeadbeef' where id = auth.uid()$$,
  '42501', 'permission denied for table profiles', 'a user cannot update bot_ref'
);
select throws_ok(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', 'permission denied for table profiles', 'a user cannot insert a profile'
);

-- 5. An active user updates the user-writable columns; a pending user's update is filtered out.
select lives_ok(
  $$update public.profiles
    set display_name = 'Anh A', code_language = 'python', avatar_url = 'https://x.test/c.png'
    where id = auth.uid()$$,
  'an active user can update display_name, code_language and avatar_url'
);
select results_eq(
  'select display_name, code_language, avatar_url from public.profiles',
  $$values ('Anh A'::text, 'python'::text, 'https://x.test/c.png'::text)$$,
  'the update is stored'
);

select tests.authenticate_as(:'pending');
select lives_ok(
  $$update public.profiles set display_name = 'Pending B' where id = auth.uid()$$,
  'a pending user''s update runs'
);
select tests.clear_authentication();
select is(
  (select display_name from public.profiles where id = :'pending'),
  'pending',
  '... but changes nothing (RLS: update needs is_active())'
);

-- 6. Check constraints.
select tests.authenticate_as(:'active');
select throws_ok(
  $$update public.profiles set code_language = 'rust' where id = auth.uid()$$,
  '23514', null, 'code_language must be python, java or go'
);
select throws_ok(
  $$update public.profiles set avatar_url = 'http://x.test/d.png' where id = auth.uid()$$,
  '23514', null, 'avatar_url must be https'
);
select throws_ok(
  $$update public.profiles set display_name = '' where id = auth.uid()$$,
  '23514', null, 'display_name cannot be empty'
);

-- 7. share_notes_with_ai can be turned on only while ai_personalization is on (§4.5, §4.6).
select throws_ok(
  $$update public.profiles set share_notes_with_ai = true where id = auth.uid()$$,
  'P0001', 'ai_personalization_off', 'turning share_notes_with_ai on needs ai_personalization'
);
select tests.clear_authentication();
select lives_ok(
  format('update public.profiles set ai_personalization = true where id = %L', :'active'),
  'postgres turns ai_personalization on'
);
select tests.authenticate_as(:'active');
select lives_ok(
  $$update public.profiles set share_notes_with_ai = true where id = auth.uid()$$,
  'with ai_personalization on, the user turns share_notes_with_ai on'
);
select tests.clear_authentication();
select lives_ok(
  format('update public.profiles set ai_personalization = false where id = %L', :'active'),
  'postgres turns ai_personalization off again'
);
select tests.authenticate_as(:'active');
select lives_ok(
  $$update public.profiles set share_notes_with_ai = false where id = auth.uid()$$,
  'turning share_notes_with_ai off is always allowed'
);
select results_eq(
  'select ai_personalization, share_notes_with_ai from public.profiles',
  $$values (false, false)$$,
  'both flags are off'
);

-- 8. is_active() / is_admin() read the caller's own profile.
select tests.authenticate_as(:'active');
select is(
  array[public.is_active(), public.is_admin()], array[true, false], 'active learner: (t, f)'
);
select tests.authenticate_as(:'pending');
select is(
  array[public.is_active(), public.is_admin()], array[false, false], 'pending learner: (f, f)'
);
select tests.authenticate_as(:'admin');
select is(
  array[public.is_active(), public.is_admin()], array[true, true], 'active admin: (t, t)'
);
select tests.authenticate_as(:'suspended_admin');
select is(
  array[public.is_active(), public.is_admin()], array[false, false], 'suspended admin: (f, f)'
);
select tests.clear_authentication();
select is(
  array[public.is_active(), public.is_admin()], array[false, false], 'no JWT: (f, f)'
);

select * from finish();
rollback;
