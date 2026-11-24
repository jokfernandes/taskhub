-- Taskhub: schema reconstruído a partir do banco atual
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  emoji text not null default '📁',
  task_counter integer not null default 0,
  created_at timestamptz not null default now(),
  color text not null default '',
  milestones jsonb not null default '[]'::jsonb
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  number integer not null,
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority smallint not null default 3,
  labels text[] not null default '{}'::text[],
  due_date date,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  checklist jsonb not null default '[]'::jsonb,
  time_spent integer not null default 0,
  timer_started_at timestamptz,
  recurrence jsonb,
  recur_next date,
  recur_source uuid,
  links jsonb not null default '[]'::jsonb,
  milestone_id uuid
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid,
  type text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.water_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  cups integer not null default 0,
  goal integer not null default 8
);

create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists activity_project_idx on public.activity (project_id);
create index if not exists milestones_project_idx on public.milestones (project_id);

-- RLS por user_id
do $$
declare t text;
begin
  foreach t in array array['projects','tasks','milestones','activity','water_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format(
      'create policy "%s_own" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
