-- DRAFT ONLY — DO NOT APPLY YET.
-- Reconcile table names, auth ownership, existing schema and RLS conventions first.
-- This file is a design starting point, not a production-ready migration.

create table if not exists public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  status text not null default 'created',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.research_tasks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.research_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.research_tasks(id) on delete cascade,
  source_uri text not null,
  source_title text not null,
  retrieved_at timestamptz not null default now(),
  evidence jsonb not null,
  content_hash text not null
);

-- RLS policies intentionally omitted pending audit of the existing auth model.
