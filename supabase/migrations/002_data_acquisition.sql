-- Additive provider data-acquisition model. Existing records are never reset.
create table if not exists public.extracted_candidate_facts (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners on delete cascade,
  document_id uuid references public.documents on delete set null,
  canonical_key text not null,
  candidate_value jsonb not null,
  confidence text not null check (confidence in ('high','medium')),
  status text not null default 'pending' check (status in ('pending','accepted','ignored')),
  reviewed_by uuid references public.profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.acquisition_events (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners on delete cascade,
  actor_id uuid references public.profiles,
  event_type text not null,
  source_label text not null,
  canonical_keys text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fact_conflicts (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners on delete cascade,
  canonical_key text not null,
  context text not null default 'reusable',
  evidence jsonb not null,
  selected_value jsonb,
  resolved_by uuid references public.profiles,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.career_history_entries (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners on delete cascade,
  category text not null check (category in ('employment','residency','fellowship')),
  organization text not null,
  title text not null default '',
  address text not null default '',
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  source_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.career_gap_explanations (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners on delete cascade,
  gap_start date not null,
  gap_end date not null,
  explanation text,
  resolved_by uuid references public.profiles,
  resolved_at timestamptz,
  unique(practitioner_id,gap_start,gap_end)
);

alter table public.onboarding_tasks
  add column if not exists resolved_by uuid references public.profiles,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution jsonb;

alter table public.extracted_candidate_facts enable row level security;
alter table public.acquisition_events enable row level security;
alter table public.fact_conflicts enable row level security;
alter table public.career_history_entries enable row level security;
alter table public.career_gap_explanations enable row level security;

create policy "authorized extracted candidates" on public.extracted_candidate_facts
for all using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()))
with check (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));

create policy "authorized acquisition events" on public.acquisition_events
for select using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));

create policy "authorized fact conflicts" on public.fact_conflicts
for all using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()))
with check (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));

create policy "authorized career history" on public.career_history_entries
for all using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()))
with check (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));

create policy "authorized career gaps" on public.career_gap_explanations
for all using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()))
with check (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));

insert into public.org_field_mappings(organization_id,version,canonical_concept,org_field,org_value,relationship)
select id,1,'doctor_of_medicine','professional.degree',
  case slug when 'northstar' then 'MD' when 'evergreen' then 'M.D.' else 'Doctor of Medicine' end,
  'approved_equivalent'
from public.organizations where slug in ('northstar','evergreen','horizon')
and not exists (
  select 1 from public.org_field_mappings m
  where m.organization_id=organizations.id and m.version=1 and m.canonical_concept='doctor_of_medicine'
);

