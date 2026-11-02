-- Secure counterpart: entitlement columns locked by column grants, app_metadata roles,
-- and permissive policies that later migrations drop or tighten.
create table public.accounts (id uuid primary key, display_name text, is_pro boolean default false, coach_credits int default 3);
alter table public.accounts enable row level security;
create policy "own account update" on public.accounts for update to authenticated using ((select auth.uid()) = id);
revoke update on public.accounts from authenticated;
grant update (display_name) on public.accounts to authenticated;
create policy "admins read accounts" on public.accounts for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "old open" on public.accounts for select using (true);
drop policy if exists "old open" on public.accounts;

create policy "notes temp" on public.notes for select using (true);
alter policy "notes temp" on public.notes using ((select auth.uid()) = owner_id);

-- Admin-gated writes to a role column, and storage access checked through membership helpers.
create table public.invites (id uuid primary key, team_id uuid not null, email text, role text not null default 'member');
alter table public.invites enable row level security;
create policy "admins manage invites" on public.invites for all to authenticated using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
create policy "members read team files" on storage.objects for select to authenticated using (bucket_id = 'team-files' and public.is_team_member(((storage.foldername(name))[1])::uuid));
create policy "members upload team files" on storage.objects for insert to authenticated with check (bucket_id = 'team-files' and public.is_team_member(((storage.foldername(name))[1])::uuid));
