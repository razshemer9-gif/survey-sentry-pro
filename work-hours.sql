-- ============================================================
-- survey-sentry-pro: overtime logged from the field
-- Run once in Supabase SQL Editor → https://supabase.com/dashboard
--
-- Shaped like public.reports so the client's patterns carry over: a
-- client-generated id, device_id holding the owning account, and the
-- entry itself as jsonb { date, visits[], note, sentAt }.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.work_hours (
  id          text primary key,
  device_id   text not null,
  data        jsonb not null,
  created_at  bigint not null,
  updated_at  bigint not null
);

create index if not exists work_hours_device_id_idx  on public.work_hours (device_id);
create index if not exists work_hours_updated_at_idx on public.work_hours (updated_at desc);

alter table public.work_hours enable row level security;

-- ── An employee's own hours are theirs to write ──────────────
drop policy if exists "user reads own hours" on public.work_hours;
create policy "user reads own hours" on public.work_hours
  for select using ((auth.uid())::text = device_id);

drop policy if exists "user inserts own hours" on public.work_hours;
create policy "user inserts own hours" on public.work_hours
  for insert with check ((auth.uid())::text = device_id);

drop policy if exists "user updates own hours" on public.work_hours;
create policy "user updates own hours" on public.work_hours
  for update using ((auth.uid())::text = device_id)
  with check ((auth.uid())::text = device_id);

drop policy if exists "user deletes own hours" on public.work_hours;
create policy "user deletes own hours" on public.work_hours
  for delete using ((auth.uid())::text = device_id);

-- ── An owner or admin reads everyone's ───────────────────────
-- Deliberately read-only: there is no admin update or delete policy here,
-- unlike public.reports. A record of hours worked that the employer can
-- silently edit or remove is not a record. Corrections are made by the
-- person who logged them.
drop policy if exists "admins read all hours" on public.work_hours;
create policy "admins read all hours" on public.work_hours
  for select using (get_current_user_role() = any (array['owner'::text, 'admin'::text]));

-- ── Verify ───────────────────────────────────────────────────
-- select * from public.work_hours limit 1;
