/**
 * Synthetic dumps for the tools/backup tests: data-only plain dumps as pg_dump 17.6+ writes them
 * (with the `\restrict` pair). No real data.
 */

/** public: profiles (4 rows, some with escaped characters) and ops_metrics (empty). */
export const PUBLIC_DUMP = [
  '--',
  '-- PostgreSQL database dump',
  '--',
  '',
  '\\restrict Ab3dEf9',
  '',
  '-- Dumped from database version 17.6',
  '-- Dumped by pg_dump version 17.6',
  '',
  'SET statement_timeout = 0;',
  "SELECT pg_catalog.set_config('search_path', '', false);",
  'SET row_security = off;',
  '',
  '--',
  '-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -',
  '--',
  '',
  'COPY public.profiles (id, role, display_name) FROM stdin;',
  '11111111-1111-4111-8111-111111111111\tadmin\tQuản trị viên',
  // COPY text format escapes newlines, tabs and backslashes: one row is always one line, even
  // when it starts with an escaped backslash or with the word COPY.
  '22222222-2222-4222-8222-222222222222\tlearner\ttwo\\nlines\\tand a \\\\ backslash',
  '\\\\N-looking text\tlearner\tx',
  'COPY public.fake (a) FROM stdin;\tlearner\ty',
  '\\.',
  '',
  '',
  '--',
  '-- Data for Name: ops_metrics; Type: TABLE DATA; Schema: public; Owner: -',
  '--',
  '',
  'COPY public.ops_metrics (id, key, value, recorded_at) FROM stdin;',
  '\\.',
  '',
  '',
  "SELECT pg_catalog.setval('public.ops_metrics_id_seq', 1, false);",
  '',
  '\\unrestrict Ab3dEf9',
  '',
].join('\n')

/** The row counts of PUBLIC_DUMP. */
export const PUBLIC_ROWS = { 'public.ops_metrics': 0, 'public.profiles': 4 }

/**
 * auth: users (2 rows) and identities (2 rows), as the backup's snapshot session writes them with
 * auth-dump.sql (task 5.7c): the allow-listed columns only, copied out of the backup functions.
 */
export const AUTH_DUMP = [
  '\\restrict 0f9e8d7c6b5a49382716a5b4c3d2e1f00f9e8d7c6b5a49382716a5b4c3d2e1f0',
  "SET client_encoding = 'UTF8';",
  'COPY auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, is_anonymous, instance_id) FROM stdin;',
  '11111111-1111-4111-8111-111111111111\tauthenticated\tauthenticated\ta@example.test\t2026-09-20 10:00:00+00\t{"provider": "google", "providers": ["google"]}\t{"full_name": "Học viên A"}\t2026-09-20 10:00:00+00\t2026-09-26 08:00:00+00\t2026-09-26 08:00:00+00\tf\t00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222\tauthenticated\tauthenticated\tb@example.test\t2026-09-21 10:00:00+00\t{"provider": "github", "providers": ["github"]}\t{}\t2026-09-21 10:00:00+00\t2026-09-21 10:00:00+00\t\\N\tf\t00000000-0000-0000-0000-000000000000',
  '\\.',
  'COPY auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at) FROM stdin;',
  'aaaaaaaa-1111-4111-8111-111111111111\t11111111-1111-4111-8111-111111111111\tgoogle\t1098765432\t{"sub": "1098765432", "email": "a@example.test"}\t2026-09-20 10:00:00+00\t2026-09-26 08:00:00+00\t2026-09-26 08:00:00+00',
  'bbbbbbbb-2222-4222-8222-222222222222\t22222222-2222-4222-8222-222222222222\tgithub\t4242\t{"sub": "4242", "email": "b@example.test"}\t2026-09-21 10:00:00+00\t2026-09-21 10:00:00+00\t2026-09-21 10:00:00+00',
  '\\.',
  '\\unrestrict 0f9e8d7c6b5a49382716a5b4c3d2e1f00f9e8d7c6b5a49382716a5b4c3d2e1f0',
  '',
].join('\n')

/** The row counts of AUTH_DUMP. */
export const AUTH_ROWS = { 'auth.identities': 2, 'auth.users': 2 }

/** A commit SHA in the manifest's format. */
export const COMMIT = '9bf847e0123456789abcdef0123456789abcdef0'
