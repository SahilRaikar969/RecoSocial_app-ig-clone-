create table if not exists public.profiles (
  id text primary key,
  username text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username
  on public.profiles(username);

alter table public.profiles enable row level security;

create policy "allow read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "allow insert profiles"
on public.profiles
for insert
to anon, authenticated
with check (true);

create policy "allow update profiles"
on public.profiles
for update
to anon, authenticated
using (true)
with check (true);