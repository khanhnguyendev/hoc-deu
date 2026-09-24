begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
\ir _helpers.psql
select plan(2);
select has_schema('public');
select ok(tests.helpers_loaded(), 'shared helpers load via \ir');
select * from finish();
rollback;
