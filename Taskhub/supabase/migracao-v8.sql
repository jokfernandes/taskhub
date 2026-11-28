-- Taskhub v8: projetos arquivados.
-- Idempotente: pode rodar mais de uma vez. Rode depois do migracao-v7.sql.
alter table public.projects add column if not exists archived_at timestamptz;
notify pgrst, 'reload schema';
