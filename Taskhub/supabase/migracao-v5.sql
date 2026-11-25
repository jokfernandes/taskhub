-- Taskhub v5: Finanças (contas, cartões, dívidas e valores a receber)
-- Idempotente: pode rodar mais de uma vez.

create table if not exists public.finance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
alter table public.finance_items add column if not exists kind text not null default 'bill';
alter table public.finance_items add column if not exists name text not null default '';
alter table public.finance_items add column if not exists amount numeric(14,2) not null default 0;
alter table public.finance_items add column if not exists due_day integer;
alter table public.finance_items add column if not exists start_month text;
alter table public.finance_items add column if not exists installments integer;
alter table public.finance_items add column if not exists note text not null default '';
alter table public.finance_items add column if not exists created_at timestamptz not null default now();

create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
alter table public.finance_payments add column if not exists item_id uuid references public.finance_items(id) on delete cascade;
alter table public.finance_payments add column if not exists month text;
alter table public.finance_payments add column if not exists amount numeric(14,2);
alter table public.finance_payments add column if not exists paid boolean not null default false;
alter table public.finance_payments add column if not exists paid_at timestamptz;
create unique index if not exists finance_payments_item_month_key on public.finance_payments (item_id, month);
create index if not exists finance_payments_item_idx on public.finance_payments (item_id);

do $$
declare t text;
begin
  foreach t in array array['finance_items','finance_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format(
      'create policy "%s_own" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
