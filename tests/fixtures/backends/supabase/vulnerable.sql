-- Alternative to secure.sql, not an incremental migration. Deliberately vulnerable.
create table public.bal_notes (id text primary key, owner_id uuid not null, body text not null);
alter table public.bal_notes enable row level security;
grant select on public.bal_notes to anon, authenticated;
create policy public_read on public.bal_notes for select to anon, authenticated using (true);
