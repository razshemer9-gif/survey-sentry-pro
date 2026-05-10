-- Run this in Supabase SQL Editor
create table if not exists reports (
  id text primary key,
  device_id text not null,
  data jsonb not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists reports_device_id_updated_at on reports(device_id, updated_at desc);

-- Allow public read/write (anonymous access per device_id)
alter table reports enable row level security;

create policy "device can read own reports"
  on reports for select using (true);

create policy "device can insert own reports"
  on reports for insert with check (true);

create policy "device can update own reports"
  on reports for update using (true);

create policy "device can delete own reports"
  on reports for delete using (true);
