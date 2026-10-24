-- Deliberately vulnerable migrations for the rls-audit tests.
create table public.profiles (id uuid primary key, display_name text);
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);

-- Private notes, but RLS is never enabled (a semicolon in a comment; must not split)
create table if not exists "public"."notes" (id uuid primary key, owner_id uuid, body text);

create table public.drafts (id uuid primary key, body text);
alter table public.drafts enable row level security;
