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

/** auth: users (2 rows) and identities (2 rows). */
export const AUTH_DUMP = [
  '\\restrict Zz9',
  'SET statement_timeout = 0;',
  'COPY auth.users (instance_id, id, email) FROM stdin;',
  '00000000-0000-0000-0000-000000000000\t11111111-1111-4111-8111-111111111111\ta@example.test',
  '00000000-0000-0000-0000-000000000000\t22222222-2222-4222-8222-222222222222\tb@example.test',
  '\\.',
  '',
  'COPY auth.identities (provider_id, user_id, provider) FROM stdin;',
  '11111111-1111-4111-8111-111111111111\t11111111-1111-4111-8111-111111111111\tgoogle',
  '22222222-2222-4222-8222-222222222222\t22222222-2222-4222-8222-222222222222\tgithub',
  '\\.',
  '',
  '\\unrestrict Zz9',
  '',
].join('\n')

/** The row counts of AUTH_DUMP. */
export const AUTH_ROWS = { 'auth.identities': 2, 'auth.users': 2 }

/** A commit SHA in the manifest's format. */
export const COMMIT = '9bf847e0123456789abcdef0123456789abcdef0'
