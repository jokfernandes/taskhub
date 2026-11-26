-- Taskhub v6: Finanças com detalhe de cartão (lançamentos) e recebimentos parciais
-- Idempotente: pode rodar mais de uma vez. Rode depois do migracao-v5.sql.

create table if not exists public.finance_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
alter table public.finance_lines add column if not exists item_id uuid references public.finance_items(id) on delete cascade;
alter table public.finance_lines add column if not exists name text not null default '';
alter table public.finance_lines add column if not exists amount numeric(14,2) not null default 0;
alter table public.finance_lines add column if not exists start_month text;
alter table public.finance_lines add column if not exists installments integer;
alter table public.finance_lines add column if not exists payer text not null default '';
alter table public.finance_lines add column if not exists note text not null default '';
alter table public.finance_lines add column if not exists created_at timestamptz not null default now();
create index if not exists finance_lines_item_idx on public.finance_lines (item_id);

create table if not exists public.finance_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
alter table public.finance_receipts add column if not exists item_id uuid references public.finance_items(id) on delete cascade;
alter table public.finance_receipts add column if not exists line_id uuid references public.finance_lines(id) on delete cascade;
alter table public.finance_receipts add column if not exists month text;
alter table public.finance_receipts add column if not exists amount numeric(14,2) not null default 0;
alter table public.finance_receipts add column if not exists received_on date;
alter table public.finance_receipts add column if not exists created_at timestamptz not null default now();
create index if not exists finance_receipts_item_idx on public.finance_receipts (item_id);
create index if not exists finance_receipts_line_idx on public.finance_receipts (line_id);

do $$
declare t text;
begin
  foreach t in array array['finance_lines','finance_receipts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format(
      'create policy "%s_own" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
