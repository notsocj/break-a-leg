/* Later migration: RLS gets switched off again; the final state is what matters. */
alter table public.drafts disable row level security;

create view public.note_titles as select id, owner_id from public.notes;

create or replace function public.add_credits(amount int) returns void
language plpgsql security definer as $$
begin
  -- semicolons inside a function body; must not split the statement
  update public.profiles set display_name = 'x';
end;
$$;

insert into storage.buckets (id, name, public) values ('documents', 'documents', true);
create policy "read documents" on storage.objects for select to authenticated using (bucket_id = 'documents');
