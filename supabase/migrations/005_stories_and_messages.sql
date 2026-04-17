create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_path text not null,
  thumbnail_path text null,
  caption text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  profile_low_id uuid not null references public.profiles(id) on delete cascade,
  profile_high_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint direct_threads_not_self check (profile_low_id <> profile_high_id),
  unique (profile_low_id, profile_high_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists stories_author_created_idx
  on public.stories (author_id, created_at desc);

create index if not exists stories_expires_idx
  on public.stories (expires_at desc);

create index if not exists direct_threads_last_message_idx
  on public.direct_threads (last_message_at desc);

create index if not exists direct_messages_thread_created_idx
  on public.direct_messages (thread_id, created_at asc);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.direct_threads enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "stories are viewable by everyone" on public.stories;
create policy "stories are viewable by everyone"
on public.stories
for select
using (expires_at > now());

drop policy if exists "users can insert own stories" on public.stories;
create policy "users can insert own stories"
on public.stories
for insert
with check (auth.uid() = author_id);

drop policy if exists "users can update own stories" on public.stories;
create policy "users can update own stories"
on public.stories
for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "users can delete own stories" on public.stories;
create policy "users can delete own stories"
on public.stories
for delete
using (auth.uid() = author_id);

drop policy if exists "users can view own story views" on public.story_views;
create policy "users can view own story views"
on public.story_views
for select
using (
  auth.uid() = viewer_id
  or exists (
    select 1
    from public.stories s
    where s.id = story_id
      and s.author_id = auth.uid()
  )
);

drop policy if exists "users can insert own story views" on public.story_views;
create policy "users can insert own story views"
on public.story_views
for insert
with check (auth.uid() = viewer_id);

drop policy if exists "users can view own direct threads" on public.direct_threads;
create policy "users can view own direct threads"
on public.direct_threads
for select
using (auth.uid() = profile_low_id or auth.uid() = profile_high_id);

drop policy if exists "users can insert own direct threads" on public.direct_threads;
create policy "users can insert own direct threads"
on public.direct_threads
for insert
with check (auth.uid() = profile_low_id or auth.uid() = profile_high_id);

drop policy if exists "users can update own direct threads" on public.direct_threads;
create policy "users can update own direct threads"
on public.direct_threads
for update
using (auth.uid() = profile_low_id or auth.uid() = profile_high_id)
with check (auth.uid() = profile_low_id or auth.uid() = profile_high_id);

drop policy if exists "users can view messages in own direct threads" on public.direct_messages;
create policy "users can view messages in own direct threads"
on public.direct_messages
for select
using (
  exists (
    select 1
    from public.direct_threads t
    where t.id = thread_id
      and (t.profile_low_id = auth.uid() or t.profile_high_id = auth.uid())
  )
);

drop policy if exists "users can insert messages in own direct threads" on public.direct_messages;
create policy "users can insert messages in own direct threads"
on public.direct_messages
for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.direct_threads t
    where t.id = thread_id
      and (t.profile_low_id = auth.uid() or t.profile_high_id = auth.uid())
  )
);