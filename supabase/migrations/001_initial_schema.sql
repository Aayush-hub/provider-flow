-- CertifyOS prototype schema. Run with Supabase CLI or the SQL editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('practitioner','provider_admin','reviewer');
create type public.fact_classification as enum ('publicly_reported','practitioner_asserted','document_extracted','provider_confirmed','primary_source_verified','conflicting','outdated');
create type public.case_status as enum ('submitted','intake_review','information_requested','verification','credentialing_review','approved','denied','withdrawn');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, role public.app_role not null default 'practitioner', created_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  is_fictional boolean not null default true, requirement_version integer not null default 1,
  workflow jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.organization_memberships (
  organization_id uuid references public.organizations on delete cascade,
  user_id uuid references public.profiles on delete cascade, role public.app_role not null,
  primary key (organization_id,user_id)
);
create table public.practitioners (
  id uuid primary key default gen_random_uuid(), npi text unique not null check (npi ~ '^\d{10}$'),
  legal_first_name text not null, legal_middle_name text, legal_last_name text not null, credential text,
  public_data_only boolean not null default true, created_by uuid references public.profiles,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.practitioner_access (
  practitioner_id uuid references public.practitioners on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  relationship text not null check (relationship in ('self','authorized_delegate','reviewer')),
  can_attest boolean not null default false, primary key (practitioner_id,user_id)
);
create table public.practitioner_facts (
  id uuid primary key default gen_random_uuid(), practitioner_id uuid not null references public.practitioners on delete cascade,
  field_key text not null, value jsonb not null, source_id text not null, source_reference text,
  classification public.fact_classification not null, scope text not null default 'reusable',
  acquired_at timestamptz not null default now(), updated_at timestamptz not null default now(), supersedes uuid references public.practitioner_facts
);
create index practitioner_facts_lookup on public.practitioner_facts(practitioner_id,field_key);
create table public.data_source_runs (
  id uuid primary key default gen_random_uuid(), practitioner_id uuid references public.practitioners on delete cascade,
  source_id text not null, status text not null, live boolean not null, reference text,
  warning text, retrieved_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), practitioner_id uuid not null references public.practitioners on delete cascade,
  owner_id uuid not null references public.profiles, storage_path text not null unique, file_name text not null,
  document_type text not null, extraction_status text not null default 'not_requested',
  classification public.fact_classification not null default 'practitioner_asserted', created_at timestamptz not null default now()
);
create table public.org_requirements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  version integer not null, canonical_key text not null, label text not null, required boolean not null default true,
  conditional_rule jsonb, evidence_rule jsonb, freshness_days integer, unique(organization_id,version,canonical_key)
);
create table public.org_field_mappings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  version integer not null, canonical_concept text not null, org_field text not null, org_value text,
  relationship text not null check (relationship in ('exact','approved_equivalent','unmapped')), approved_by uuid references public.profiles
);
create table public.applications (
  id uuid primary key default gen_random_uuid(), practitioner_id uuid not null references public.practitioners,
  created_by uuid not null references public.profiles, status text not null default 'draft', created_at timestamptz not null default now(), submitted_at timestamptz
);
create table public.application_organizations (
  application_id uuid references public.applications on delete cascade,
  organization_id uuid references public.organizations, requirement_version integer not null,
  primary key(application_id,organization_id)
);
create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications on delete cascade,
  canonical_key text not null, organization_ids uuid[] not null default '{}', status text not null default 'open', reason text not null
);
create table public.attestations (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications,
  signer_id uuid not null references public.profiles, text_version text not null, attestation_text text not null,
  acknowledged_at timestamptz not null default now(), constraint practitioner_signer check (length(attestation_text) > 20)
);
create table public.submission_snapshots (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications,
  organization_id uuid not null references public.organizations, requirement_version integer not null,
  snapshot jsonb not null, created_at timestamptz not null default now(), unique(application_id,organization_id)
);
create table public.credentialing_cases (
  id uuid primary key default gen_random_uuid(), snapshot_id uuid not null unique references public.submission_snapshots,
  practitioner_id uuid not null references public.practitioners, organization_id uuid not null references public.organizations,
  status public.case_status not null default 'submitted', assigned_reviewer uuid references public.profiles,
  decision text, decision_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cases_org_status on public.credentialing_cases(organization_id,status);
create table public.credentialing_events (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.credentialing_cases on delete cascade,
  actor_id uuid not null references public.profiles, event_type text not null, from_status public.case_status, to_status public.case_status,
  provider_visible boolean not null default true, note text, created_at timestamptz not null default now()
);
create table public.information_requests (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.credentialing_cases on delete cascade,
  title text not null, detail text not null, status text not null default 'open', response_document_id uuid references public.documents,
  requested_by uuid not null references public.profiles, responded_at timestamptz, resolved_at timestamptz, created_at timestamptz not null default now()
);
create table public.recredentialing_cycles (
  id uuid primary key default gen_random_uuid(), practitioner_id uuid not null references public.practitioners,
  organization_id uuid not null references public.organizations, prior_case_id uuid references public.credentialing_cases,
  status text not null default 'initiated', initiated_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles,
  organization_id uuid references public.organizations, practitioner_id uuid references public.practitioners,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.practitioners enable row level security;
alter table public.practitioner_access enable row level security;
alter table public.practitioner_facts enable row level security;
alter table public.documents enable row level security;
alter table public.applications enable row level security;
alter table public.application_organizations enable row level security;
alter table public.submission_snapshots enable row level security;
alter table public.credentialing_cases enable row level security;
alter table public.credentialing_events enable row level security;
alter table public.information_requests enable row level security;
alter table public.audit_events enable row level security;

create policy "own profile" on public.profiles for all using (id=auth.uid()) with check (id=auth.uid());
create policy "organizations public configuration" on public.organizations for select using (true);
create policy "own memberships" on public.organization_memberships for select using (user_id=auth.uid());
create policy "authorized practitioner access" on public.practitioners for select using (exists(select 1 from public.practitioner_access a where a.practitioner_id=id and a.user_id=auth.uid()));
create policy "authorized facts" on public.practitioner_facts for all using (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid())) with check (exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()));
create policy "authorized documents" on public.documents for all using (owner_id=auth.uid() or exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid())) with check (owner_id=auth.uid());
create policy "application owner" on public.applications for all using (created_by=auth.uid()) with check (created_by=auth.uid());
create policy "case practitioner or org reviewer" on public.credentialing_cases for select using (
  exists(select 1 from public.practitioner_access a where a.practitioner_id=practitioner_id and a.user_id=auth.uid()) or
  exists(select 1 from public.organization_memberships m where m.organization_id=organization_id and m.user_id=auth.uid() and m.role='reviewer')
);
create policy "case org reviewer update" on public.credentialing_cases for update using (exists(select 1 from public.organization_memberships m where m.organization_id=organization_id and m.user_id=auth.uid() and m.role='reviewer'));
create policy "visible events or reviewer" on public.credentialing_events for select using (provider_visible or exists(select 1 from public.credentialing_cases c join public.organization_memberships m on m.organization_id=c.organization_id where c.id=case_id and m.user_id=auth.uid() and m.role='reviewer'));
create policy "scoped requests" on public.information_requests for select using (exists(select 1 from public.credentialing_cases c where c.id=case_id and (exists(select 1 from public.practitioner_access a where a.practitioner_id=c.practitioner_id and a.user_id=auth.uid()) or exists(select 1 from public.organization_memberships m where m.organization_id=c.organization_id and m.user_id=auth.uid() and m.role='reviewer'))));

insert into storage.buckets(id,name,public) values ('credentialing-documents','credentialing-documents',false) on conflict do nothing;
create policy "private practitioner uploads" on storage.objects for insert to authenticated with check (bucket_id='credentialing-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "private practitioner reads" on storage.objects for select to authenticated using (bucket_id='credentialing-documents' and (storage.foldername(name))[1]=auth.uid()::text);
