-- ============================================================
-- survey-sentry-pro: work logged from the field, and the schedule it is
-- checked against.
--
-- Run once in the Supabase SQL Editor → https://supabase.com/dashboard
--
-- Purely additive: two new tables. Nothing existing is altered, and no
-- policy on any other table is touched. Safe to re-run.
-- ============================================================

-- ── What an employee did in a day ────────────────────────────
--
-- Shaped like public.reports so the client's patterns carry over: a
-- client-generated id, device_id holding the owning account, and the day
-- itself as jsonb { date, jobs[], note, sentAt }. A job inside that is
-- either paid by the hour (an event accompaniment, carrying from/to) or at
-- a fixed price (no hours at all).

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

-- An employee's own record is theirs to write.
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

-- An owner or admin reads everyone's.
--
-- Deliberately read-only: there is no admin update or delete policy here,
-- unlike public.reports. A record of hours worked that the employer can
-- silently edit or remove is not a record, and this one decides a salary.
-- Corrections are made by the person who logged them.
drop policy if exists "admins read all hours" on public.work_hours;
create policy "admins read all hours" on public.work_hours
  for select using (get_current_user_role() = any (array['owner'::text, 'admin'::text]));


-- ── The company schedule ─────────────────────────────────────
--
-- Uploaded from the daily xlsx. One row per scheduled job, with the whole
-- parsed row kept as jsonb so a column the office adds later is not lost.
-- The id is derived from the day, the job name and its time, so re-sending
-- a corrected file keeps the rows an employee has already picked from.

create table if not exists public.work_schedule (
  id           text primary key,
  date         text not null,
  data         jsonb not null,
  uploaded_by  text not null,
  uploaded_at  bigint not null
);

create index if not exists work_schedule_date_idx on public.work_schedule (date);

alter table public.work_schedule enable row level security;

-- Everyone signed in reads it: an employee cannot pick the job they worked
-- from a schedule they are not allowed to see.
drop policy if exists "signed in reads schedule" on public.work_schedule;
create policy "signed in reads schedule" on public.work_schedule
  for select using (auth.uid() is not null);

-- Only the office replaces it.
drop policy if exists "admins insert schedule" on public.work_schedule;
create policy "admins insert schedule" on public.work_schedule
  for insert with check (get_current_user_role() = any (array['owner'::text, 'admin'::text]));

drop policy if exists "admins update schedule" on public.work_schedule;
create policy "admins update schedule" on public.work_schedule
  for update using (get_current_user_role() = any (array['owner'::text, 'admin'::text]))
  with check (get_current_user_role() = any (array['owner'::text, 'admin'::text]));

drop policy if exists "admins delete schedule" on public.work_schedule;
create policy "admins delete schedule" on public.work_schedule
  for delete using (get_current_user_role() = any (array['owner'::text, 'admin'::text]));

-- ── Verify ───────────────────────────────────────────────────
-- select count(*) from public.work_hours;
-- select count(*) from public.work_schedule;
