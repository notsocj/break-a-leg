-- Secure counterpart: owner-only rows, invoker views, locked-down definer function.
create table public.notes (id uuid primary key, owner_id uuid not null, body text);
alter table public.notes enable row level security;
create policy "owners read notes" on public.notes for select to authenticated using ((select auth.uid()) = owner_id);

create table public.old_name (id uuid primary key);
alter table public.old_name rename to renamed;
alter table public.renamed enable row level security;

create table public.scratch (id int);
drop table if exists public.scratch;

create view public.my_notes with (security_invoker = true) as select id from public.notes;

create function public.add_credits(amount int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.notes set body = body;
end;
$$;
revoke execute on function public.add_credits(int) from public, anon, authenticated;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false);
create policy "own files" on storage.objects for select to authenticated using (bucket_id = 'avatars' and (select auth.uid())::text = (storage.foldername(name))[1]);
