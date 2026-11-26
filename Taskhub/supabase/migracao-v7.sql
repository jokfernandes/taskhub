-- Taskhub v7: divisão de cada compra do cartão entre pessoas e recebimento por pessoa
-- Idempotente: pode rodar mais de uma vez. Rode depois do migracao-v6.sql.

alter table public.finance_lines add column if not exists splits jsonb not null default '[]'::jsonb;
alter table public.finance_receipts add column if not exists person text;

notify pgrst, 'reload schema';
