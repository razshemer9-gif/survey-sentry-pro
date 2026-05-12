create table if not exists accessibility_requirements (
  id text primary key,
  standard_part text not null,
  clause text,
  category text not null,
  category_code text not null,
  sub_category text not null,
  requirement_title text not null,
  practical_requirement text not null,
  defect_text text not null,
  correction_text text not null,
  severity text not null,
  measurement_fields jsonb,
  inspection_method text not null,
  applies_to jsonb not null,
  tags jsonb not null,
  internal_citation text,
  updated_at bigint not null
);
alter table accessibility_requirements enable row level security;
create policy "read requirements" on accessibility_requirements for select using (true);
create policy "insert requirements" on accessibility_requirements for insert with check (true);
create policy "update requirements" on accessibility_requirements for update using (true);
create policy "delete requirements" on accessibility_requirements for delete using (true);
