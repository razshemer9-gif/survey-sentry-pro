-- ============================================================
-- survey-sentry-pro: lightweight report list
-- Run once in Supabase SQL Editor → https://supabase.com/dashboard
--
-- Fixes: "canceling statement due to statement timeout" on the
-- reports screen.
--
-- Why: every report stores its photos inline as base64 inside
-- reports.data. Listing all users' reports therefore shipped tens of
-- megabytes per page load, and Postgres cancelled the statement. The
-- list only needs a name, address, date and the per-status counts —
-- never the photos.
--
-- This function returns exactly that. `items` is kept as an array of
-- {id, status} so existing client code that counts statuses keeps
-- working unchanged, just without the image payload.
--
-- SECURITY INVOKER (the default): RLS still applies, so an employee
-- gets only their own rows and an owner/admin gets everyone's.
--
-- Safe to re-run.
-- ============================================================

drop function if exists public.list_report_summaries(integer);

create or replace function public.list_report_summaries(p_limit integer default 300)
returns table (id text, device_id text, summary jsonb)
language sql
stable
as $$
  select
    r.id,
    r.device_id,
    jsonb_build_object(
      'id',          r.data ->> 'id',
      'surveyType',  r.data ->> 'surveyType',
      'placeName',   r.data ->> 'placeName',
      'clientName',  r.data ->> 'clientName',
      'address',     r.data ->> 'address',
      'surveyDate',  r.data ->> 'surveyDate',
      'createdAt',   r.created_at,
      'updatedAt',   r.updated_at,
      -- statuses only; no photos, notes or costs
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('id', i ->> 'id', 'status', i ->> 'status'))
        from   jsonb_array_elements(r.data -> 'items') i
      ), '[]'::jsonb)
    )
  from   public.reports r
  order  by r.updated_at desc
  limit  greatest(1, least(p_limit, 1000));
$$;

grant execute on function public.list_report_summaries(integer) to authenticated;

-- ── Verify ──────────────────────────────────────────────────
-- Should return quickly and show small summary objects.
select id, device_id, jsonb_pretty(summary) as summary
from   public.list_report_summaries(3);
