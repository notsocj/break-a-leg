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
