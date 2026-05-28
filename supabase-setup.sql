-- Run this once in your Supabase project's SQL Editor.
-- (Dashboard → SQL Editor → New query → paste → Run)
--
-- This sets up password-protected map create/delete via SECURITY DEFINER
-- RPC functions. Public still reads freely. After running this, raw
-- INSERT/UPDATE/DELETE on `maps` via the anon key is blocked — clients
-- must call rpc/save_map and rpc/delete_map with the correct password.

-- 1) maps table
create table if not exists public.maps (
  name        text primary key,
  walls       jsonb not null,
  updated_at  timestamptz default now()
);

-- 2) RLS: public read only; writes go through RPCs.
alter table public.maps enable row level security;

drop policy if exists "maps_all"        on public.maps;
drop policy if exists "maps read public" on public.maps;
create policy "maps read public"
  on public.maps for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.maps from anon, authenticated;

-- 3) Secrets table — holds the editor password. RLS is on but no policy
--    exists, so anon cannot read it. RPCs (SECURITY DEFINER) can.
create table if not exists public._secrets (
  key text primary key,
  val text not null
);
insert into public._secrets (key, val)
  values ('map_editor_password', 'goldwave2026')
  on conflict (key) do update set val = excluded.val;

alter table public._secrets enable row level security;

-- 4) SAVE RPC: validates password, upserts the map.
create or replace function public.save_map(
  p_name text, p_walls jsonb, p_password text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare expected text;
begin
  select val into expected from public._secrets where key = 'map_editor_password';
  if p_password is null or p_password <> expected then
    raise exception 'invalid password' using errcode = '28000';
  end if;
  if length(p_name) = 0 or length(p_name) > 24 then
    raise exception 'bad name' using errcode = '22000';
  end if;
  insert into public.maps (name, walls, updated_at)
    values (p_name, p_walls, now())
    on conflict (name) do update set walls = excluded.walls, updated_at = now();
end$$;

grant execute on function public.save_map(text, jsonb, text) to anon, authenticated;

-- 5) DELETE RPC: validates password, removes the row (except 'default').
create or replace function public.delete_map(
  p_name text, p_password text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare expected text;
begin
  select val into expected from public._secrets where key = 'map_editor_password';
  if p_password is null or p_password <> expected then
    raise exception 'invalid password' using errcode = '28000';
  end if;
  if p_name = 'default' then
    raise exception 'cannot delete default' using errcode = '22000';
  end if;
  delete from public.maps where name = p_name;
end$$;

grant execute on function public.delete_map(text, text) to anon, authenticated;

-- To rotate the password later:
-- update public._secrets set val = 'YENI_SIFRE' where key = 'map_editor_password';
