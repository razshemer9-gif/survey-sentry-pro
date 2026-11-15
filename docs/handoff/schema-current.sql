-- ============================================================================
-- survey-sentry-pro — the database schema as it runs in production
--
-- Snapshot taken: 2026-11-15, read from the live Supabase project
-- (Postgres 17). Read-only inspection; nothing was changed to produce it.
--
-- WHY THIS FILE EXISTS
--   The SQL files in the project root were run by hand, one at a time, over
--   several months, and a few changes were made directly in the Supabase
--   dashboard and never saved to a file. This file is the single,
--   consolidated picture of what the app actually depends on today:
--     * 6 tables, all with Row Level Security
--     * 6 functions, 3 triggers
--   Pieces that exist ONLY here (not in any root .sql file):
--     * table public.report_summaries + trigger sync_report_summary_trg
--     * function public.list_report_summaries() reading from that table
--     * function public.list_my_reports()  (legacy; current code does not call it)
--     * index reports_device_id_idx
--
-- HOW TO USE
--   Run it once, top to bottom, in the SQL editor of a NEW, EMPTY Supabase
--   project (or any Postgres with Supabase's `auth` schema). It is written
--   to be safe to re-run. It creates structure only — no data.
--   The standards table (accessibility_requirements) seeds itself from
--   src/lib/standards-data.ts the first time an owner/admin opens the
--   /standards screen (RLS lets only them insert).
--
-- DO NOT run this against the current production project: it is already
-- in this state.
-- ============================================================================


-- ── 1. Tables ───────────────────────────────────────────────────────────────

-- One row per report. The whole report — including every photo, as base64
-- data URLs — lives in `data`. That is why the table is large (~457 MB for
-- 277 reports at snapshot time) and why the list screen reads
-- report_summaries instead.
--   device_id  = the author's auth.users.id, stored as TEXT (historical name)
--   created_at / updated_at = Unix epoch in MILLISECONDS (bigint)
create table if not exists public.reports (
  id         text   primary key,
  device_id  text   not null,
  data       jsonb  not null,
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists reports_device_id_updated_at on public.reports (device_id, updated_at desc);
create index if not exists reports_device_id_idx        on public.reports (device_id);

-- Lightweight copy of each report for the list screen: names, address, date
-- and per-item status only — no photos. Maintained by a trigger on reports
-- (section 4); the app never writes to it.
create table if not exists public.report_summaries (
  id         text   primary key,
  device_id  text   not null,
  summary    jsonb  not null,
  updated_at bigint not null
);
create index if not exists report_summaries_updated_at_idx on public.report_summaries (updated_at desc);
create index if not exists report_summaries_device_id_idx  on public.report_summaries (device_id);

-- One row per user: role and display name.
create table if not exists public.profiles (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text        not null default 'employee'
                         check (role in ('owner', 'admin', 'employee')),
  created_at timestamptz default now()
);

-- Per-user settings (company details, logo, signatures, per-report-type
-- formats) as one JSON document. Images inside are base64 data URLs.
create table if not exists public.user_settings (
  user_id    uuid   primary key references auth.users(id) on delete cascade,
  settings   jsonb  not null default '{}'::jsonb,
  updated_at bigint not null
);

-- Per-user checklist templates. The built-in templates live in app code.
create table if not exists public.user_templates (
  id          text  primary key,
  user_id     uuid  not null references auth.users(id) on delete cascade,
  name        text  not null,
  description text,
  items       jsonb not null default '[]'::jsonb,
  created_at  bigint,
  updated_at  bigint,
  survey_type text
);
create index if not exists user_templates_user_id_idx on public.user_templates (user_id);

-- The standards / findings library (Israeli Standard 1918 and safety items),
-- shared by everyone; only owner/admin may change it.
create table if not exists public.accessibility_requirements (
  id                    text   primary key,
  standard_part         text   not null,
  clause                text,
  category              text   not null,
  category_code         text   not null,
  sub_category          text   not null,
  requirement_title     text   not null,
  practical_requirement text   not null,
  defect_text           text   not null,
  correction_text       text   not null,
  severity              text   not null,
  measurement_fields    jsonb,
  inspection_method     text   not null,
  applies_to            jsonb  not null,
  tags                  jsonb  not null,
  internal_citation     text,
  updated_at            bigint not null,
  reference_photo       text,           -- legacy single photo
  reference_photos      jsonb,          -- array of photos (preferred)
  survey_type           text   default 'accessibility'
);


-- ── 2. Role helper (used by the policies below) ─────────────────────────────

-- SECURITY DEFINER so it can read profiles from inside a profiles policy
-- without recursing through RLS.
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where user_id = auth.uid();
$$;


-- ── 3. Row Level Security ───────────────────────────────────────────────────
-- Roles: 'employee' sees only their own data; 'owner' and 'admin' see and
-- manage everyone's reports and profiles and edit the standards library.

alter table public.reports                    enable row level security;
alter table public.report_summaries           enable row level security;
alter table public.profiles                   enable row level security;
alter table public.user_settings              enable row level security;
alter table public.user_templates             enable row level security;
alter table public.accessibility_requirements enable row level security;

-- reports
drop policy if exists "user reads own reports"    on public.reports;
drop policy if exists "user inserts own reports"  on public.reports;
drop policy if exists "user updates own reports"  on public.reports;
drop policy if exists "user deletes own reports"  on public.reports;
drop policy if exists "admins read all reports"   on public.reports;
drop policy if exists "admins update all reports" on public.reports;
drop policy if exists "admins delete all reports" on public.reports;
create policy "user reads own reports"    on public.reports for select using (auth.uid()::text = device_id);
create policy "user inserts own reports"  on public.reports for insert with check (auth.uid()::text = device_id);
create policy "user updates own reports"  on public.reports for update using (auth.uid()::text = device_id);
create policy "user deletes own reports"  on public.reports for delete using (auth.uid()::text = device_id);
create policy "admins read all reports"   on public.reports for select using (public.get_current_user_role() in ('owner', 'admin'));
create policy "admins update all reports" on public.reports for update using (public.get_current_user_role() in ('owner', 'admin'));
create policy "admins delete all reports" on public.reports for delete using (public.get_current_user_role() in ('owner', 'admin'));
-- No admin INSERT on purpose: a new report is always created under its author.

-- report_summaries (read-only to clients; the trigger writes it)
drop policy if exists "user reads own summaries"  on public.report_summaries;
drop policy if exists "admins read all summaries" on public.report_summaries;
create policy "user reads own summaries"  on public.report_summaries for select using (auth.uid()::text = device_id);
create policy "admins read all summaries" on public.report_summaries for select using (public.get_current_user_role() in ('owner', 'admin'));

-- profiles
drop policy if exists "Users can view own profile"     on public.profiles;
drop policy if exists "Admins can view all profiles"   on public.profiles;
drop policy if exists "Users can update own profile"   on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "System can insert profiles"     on public.profiles;
create policy "Users can view own profile"     on public.profiles for select using (auth.uid() = user_id);
create policy "Admins can view all profiles"   on public.profiles for select using (public.get_current_user_role() in ('owner', 'admin'));
create policy "Users can update own profile"   on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins can manage all profiles" on public.profiles for all    using (public.get_current_user_role() in ('owner', 'admin'));
create policy "System can insert profiles"     on public.profiles for insert with check (true);

-- user_settings
drop policy if exists "user reads own settings"   on public.user_settings;
drop policy if exists "user inserts own settings" on public.user_settings;
drop policy if exists "user updates own settings" on public.user_settings;
create policy "user reads own settings"   on public.user_settings for select using (auth.uid() = user_id);
create policy "user inserts own settings" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "user updates own settings" on public.user_settings for update using (auth.uid() = user_id);

-- user_templates
drop policy if exists "Users read own templates"   on public.user_templates;
drop policy if exists "Users insert own templates" on public.user_templates;
drop policy if exists "Users update own templates" on public.user_templates;
drop policy if exists "Users delete own templates" on public.user_templates;
create policy "Users read own templates"   on public.user_templates for select using (auth.uid() = user_id);
create policy "Users insert own templates" on public.user_templates for insert with check (auth.uid() = user_id);
create policy "Users update own templates" on public.user_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own templates" on public.user_templates for delete using (auth.uid() = user_id);

-- accessibility_requirements
drop policy if exists "Anyone can read requirements"   on public.accessibility_requirements;
drop policy if exists "Admins can insert requirements" on public.accessibility_requirements;
drop policy if exists "Admins can update requirements" on public.accessibility_requirements;
drop policy if exists "Admins can delete requirements" on public.accessibility_requirements;
create policy "Anyone can read requirements"   on public.accessibility_requirements for select using (true);
create policy "Admins can insert requirements" on public.accessibility_requirements for insert with check (public.get_current_user_role() in ('owner', 'admin'));
create policy "Admins can update requirements" on public.accessibility_requirements for update using (public.get_current_user_role() in ('owner', 'admin'));
create policy "Admins can delete requirements" on public.accessibility_requirements for delete using (public.get_current_user_role() in ('owner', 'admin'));


-- ── 4. Functions and triggers ───────────────────────────────────────────────

-- 4a. A profile for every new sign-up (role 'employee').
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4b. Only owner/admin may change anyone's role. (No check when auth.uid()
--     is null, i.e. the SQL editor / service role.)
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if not (select exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role in ('owner', 'admin')
    )) then
      raise exception 'permission denied: only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- 4c. Keep report_summaries in step with reports. Errors are swallowed on
--     purpose so that a summary problem can never block saving a report.
create or replace function public.sync_report_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    begin
      delete from public.report_summaries where id = old.id;
    exception when others then null;
    end;
    return old;
  end if;

  begin
    insert into public.report_summaries (id, device_id, summary, updated_at)
    values (
      new.id,
      new.device_id,
      jsonb_build_object(
        'id',         new.data ->> 'id',
        'surveyType', new.data ->> 'surveyType',
        'placeName',  new.data ->> 'placeName',
        'clientName', new.data ->> 'clientName',
        'address',    new.data ->> 'address',
        'surveyDate', new.data ->> 'surveyDate',
        'createdAt',  new.created_at,
        'updatedAt',  new.updated_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('id', i ->> 'id', 'status', i ->> 'status'))
          from   jsonb_array_elements(new.data -> 'items') i
        ), '[]'::jsonb)
      ),
      new.updated_at
    )
    on conflict (id) do update
      set device_id  = excluded.device_id,
          summary    = excluded.summary,
          updated_at = excluded.updated_at;
  exception when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists sync_report_summary_trg on public.reports;
create trigger sync_report_summary_trg
  after insert or delete or update on public.reports
  for each row execute function public.sync_report_summary();

-- 4d. The list screen's single call: supabase.rpc('list_report_summaries').
--     SECURITY INVOKER, so the report_summaries policies decide who sees what.
create or replace function public.list_report_summaries(p_limit integer default 300)
returns table (id text, device_id text, summary jsonb)
language sql
stable
as $$
  select s.id, s.device_id, s.summary
  from   public.report_summaries s
  order  by s.updated_at desc
  limit  greatest(1, least(p_limit, 1000));
$$;
grant execute on function public.list_report_summaries(integer) to authenticated;

-- 4e. Legacy — present in production, not called by the current code.
--     Kept so the schema matches exactly; safe to leave out of a new project.
create or replace function public.list_my_reports()
returns table (id text, data jsonb)
language sql
security definer
as $$
  select
    id,
    jsonb_build_object(
      'id',          data->>'id',
      'placeName',   data->>'placeName',
      'clientName',  data->>'clientName',
      'address',     data->>'address',
      'surveyDate',  data->>'surveyDate',
      'surveyType',  data->>'surveyType',
      'updatedAt',   (data->>'updatedAt')::bigint,
      'createdAt',   (data->>'createdAt')::bigint,
      'items', coalesce(
        (select jsonb_agg(item - 'photo' - 'referencePhoto' - 'referencePhotos')
         from jsonb_array_elements(data->'items') as item),
        '[]'::jsonb
      )
    )
  from reports
  where device_id = (auth.uid())::text;
$$;


-- ── 5. After the first owner signs up ───────────────────────────────────────
-- Sign up through the app, then promote that account (replace the address):
--
--   update public.profiles set role = 'owner' where email = '<OWNER_EMAIL>';
--
-- If report rows were copied in from elsewhere BEFORE this file was run,
-- backfill the summaries once:
--
--   update public.reports set updated_at = updated_at;   -- fires the trigger
