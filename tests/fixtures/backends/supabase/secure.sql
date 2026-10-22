-- Disposable fixture only. Apply to an isolated scratch schema, never a live project.
create table public.bal_notes (id text primary key, owner_id uuid not null, body text not null);
alter table public.bal_notes enable row level security;
grant select on public.bal_notes to anon, authenticated;
create policy owner_read on public.bal_notes for select to authenticated using (auth.uid() = owner_id);
