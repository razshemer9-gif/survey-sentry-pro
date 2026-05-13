-- ============================================================
-- Survey Sentry Pro – Supabase Auth Setup
-- Run this SQL in the Supabase SQL Editor (project dashboard)
-- ============================================================

-- Reports table: add user_id column if migrating from device_id
-- (The existing table uses device_id — we keep it as-is, just treat it as user_id)
-- No schema changes needed for reports table.

-- ------------------------------------------------------------
-- User settings table
-- ------------------------------------------------------------
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}',
  updated_at bigint not null
);

alter table user_settings enable row level security;

create policy "user reads own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "user inserts own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "user updates own settings"
  on user_settings for update
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Update reports RLS to be user-scoped
-- (device_id column stores auth.uid()::text for authenticated users)
-- ------------------------------------------------------------
drop policy if exists "device can read own reports" on reports;
drop policy if exists "device can insert own reports" on reports;
drop policy if exists "device can update own reports" on reports;
drop policy if exists "device can delete own reports" on reports;

create policy "user reads own reports"
  on reports for select
  using (auth.uid()::text = device_id);

create policy "user inserts own reports"
  on reports for insert
  with check (auth.uid()::text = device_id);

create policy "user updates own reports"
  on reports for update
  using (auth.uid()::text = device_id);

create policy "user deletes own reports"
  on reports for delete
  using (auth.uid()::text = device_id);
