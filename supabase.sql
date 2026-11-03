-- À coller UNE FOIS dans Supabase › SQL Editor › New query › Run
create table if not exists public.entities (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key     text not null,
  data    jsonb,
  ts      bigint not null,
  del     boolean not null default false,
  seq     bigint not null default 0,
  primary key (user_id, key)
);
create sequence if not exists public.entities_seq;
create index if not exists entities_seq_idx on public.entities (user_id, seq);

create or replace function public.entities_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.ts <= old.ts then return null; end if;  -- la modif la plus récente gagne
  new.seq := nextval('public.entities_seq');
  return new;
end $$;

drop trigger if exists entities_guard on public.entities;
create trigger entities_guard before insert or update on public.entities
  for each row execute function public.entities_guard();

alter table public.entities enable row level security;
drop policy if exists "mes donnees" on public.entities;
create policy "mes donnees" on public.entities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.entities to authenticated;
