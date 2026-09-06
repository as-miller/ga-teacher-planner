-- License-aware Georgia CASE framework metadata.
-- Run once in Supabase SQL Editor for an existing project.
alter table public.standard_frameworks
  add column if not exists license_uri text,
  add column if not exists license_status text not null default 'unknown'
    check (license_status in ('commercial-ok','noncommercial','unknown')),
  add column if not exists commercial_caching_allowed boolean not null default false;

comment on column public.standard_frameworks.license_uri is 'License URI reported by the authoritative CASE framework metadata.';
comment on column public.standard_frameworks.license_status is 'Planner classification of the framework license; unknown is intentionally restrictive.';
comment on column public.standard_frameworks.commercial_caching_allowed is 'True only when the importer has classified the reported license as permitting commercial reuse, subject to its terms.';
