-- À coller UNE FOIS dans Supabase › SQL Editor › New query › Run  (même projet que Flashcards)
create table if not exists public.capprepa_chapters (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  data    jsonb,
  ts      bigint not null,
  del     boolean not null default false,
  seq     bigint not null default 0,
  primary key (user_id, id)
);
create sequence if not exists public.capprepa_seq;
create index if not exists capprepa_seq_idx on public.capprepa_chapters (user_id, seq);

create or replace function public.capprepa_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.ts <= old.ts then return null; end if;  -- la modif la plus récente gagne
  new.seq := nextval('public.capprepa_seq');
  return new;
end $$;

drop trigger if exists capprepa_guard on public.capprepa_chapters;
create trigger capprepa_guard before insert or update on public.capprepa_chapters
  for each row execute function public.capprepa_guard();

alter table public.capprepa_chapters enable row level security;
drop policy if exists "mes chapitres" on public.capprepa_chapters;
create policy "mes chapitres" on public.capprepa_chapters for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.capprepa_chapters to authenticated;
grant usage, select on sequence public.capprepa_seq to authenticated;
