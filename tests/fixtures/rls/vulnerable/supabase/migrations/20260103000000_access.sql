-- Later migration: entitlement columns users can set, sign-in-only and user_metadata policies.
alter table public.profiles add column is_pro boolean default false;
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id);

create table public.teams (id uuid primary key, name text);
alter table public.teams enable row level security;
create policy "signed in read teams" on public.teams for select to authenticated using ((select auth.uid()) is not null);
create policy "admins manage teams" on public.teams for all to authenticated using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- A dropped policy must not be reported.
create policy "temporary open" on public.teams for select using (true);
drop policy "temporary open" on public.teams;

-- Uploads that only check the caller is signed in can land in any team's folder.
create policy "upload team files" on storage.objects for insert to authenticated with check (bucket_id = 'team-files' and auth.role() = 'authenticated');
