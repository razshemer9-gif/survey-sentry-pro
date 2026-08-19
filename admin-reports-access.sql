-- ============================================================
-- survey-sentry-pro: let owners/admins see every user's reports
-- Run once in Supabase SQL Editor → https://supabase.com/dashboard
--
-- Employees are UNCHANGED: they still see, edit and delete only
-- their own reports. This only widens access for 'owner'/'admin'
-- roles in public.profiles.
--
-- Safe to re-run.
-- ============================================================

-- Reuses the SECURITY DEFINER helper created by rbac-migration.sql.
-- It reads public.profiles while bypassing RLS, so using it inside a
-- policy cannot recurse. If that migration has not been run yet, run
-- it first — this script depends on it.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_current_user_role'
  ) then
    raise exception 'public.get_current_user_role() is missing — run rbac-migration.sql first';
  end if;
end $$;

-- ── Reports: additive admin policies ────────────────────────
-- Postgres combines multiple permissive policies with OR, so the
-- existing "user reads own reports" policy keeps working untouched;
-- these simply add a second way to qualify.

drop policy if exists "admins read all reports"   on public.reports;
drop policy if exists "admins update all reports" on public.reports;
drop policy if exists "admins delete all reports" on public.reports;

create policy "admins read all reports"
  on public.reports for select
  using (public.get_current_user_role() in ('owner', 'admin'));

create policy "admins update all reports"
  on public.reports for update
  using (public.get_current_user_role() in ('owner', 'admin'));

create policy "admins delete all reports"
  on public.reports for delete
  using (public.get_current_user_role() in ('owner', 'admin'));

-- NOTE: no admin INSERT policy on purpose. New reports must always be
-- created under the author's own id, which the existing insert policy
-- already enforces (auth.uid()::text = device_id).

-- ── Author display name ─────────────────────────────────────
-- profiles.full_name is never populated by the signup trigger, so the
-- app falls back to email. Give existing rows a name from whatever the
-- user supplied at signup, if anything.
update public.profiles p
set    full_name = coalesce(
         nullif(p.full_name, ''),
         nullif(u.raw_user_meta_data ->> 'full_name', ''),
         nullif(u.raw_user_meta_data ->> 'name', '')
       )
from   auth.users u
where  u.id = p.user_id
and    coalesce(p.full_name, '') = '';

-- Keep it populated for future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name',
                    new.raw_user_meta_data ->> 'name'), ''),
    'employee'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── Verify ──────────────────────────────────────────────────
-- Should list the three new admin policies alongside the four user ones.
select policyname, cmd
from   pg_policies
where  schemaname = 'public' and tablename = 'reports'
order  by policyname;
