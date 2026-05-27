-- Run this once in your Supabase project's SQL Editor.
-- (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists maps (
  name       text primary key,
  walls      jsonb not null,
  updated_at timestamptz default now()
);

-- Allow the anon key to read/write maps (game has no auth; the lobby code
-- gates access at the app layer). If you'd rather lock it down, swap this
-- policy for one that requires an authenticated user.
alter table maps enable row level security;

drop policy if exists "maps_all" on maps;
create policy "maps_all" on maps
  for all
  using (true)
  with check (true);
