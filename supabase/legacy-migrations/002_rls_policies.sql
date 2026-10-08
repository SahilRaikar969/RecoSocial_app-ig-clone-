alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.profile_interests enable row level security;
alter table public.posts enable row level security;
alter table public.post_categories enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.post_views enable row level security;
alter table public.post_skips enable row level security;
alter table public.profile_category_affinity enable row level security;
alter table public.profile_creator_affinity enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are viewable by everyone"
on public.profiles
for select
using (true);

create policy "users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can view categories"
on public.categories
for select
using (true);

create policy "users can view profile interests"
on public.profile_interests
for select
using (true);

create policy "users can manage own profile interests"
on public.profile_interests
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create policy "public posts are viewable by everyone"
on public.posts
for select
using (visibility = 'public' and status = 'published');

create policy "users can insert own posts"
on public.posts
for insert
with check (auth.uid() = author_id);

create policy "users can update own posts"
on public.posts
for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "users can delete own posts"
on public.posts
for delete
using (auth.uid() = author_id);

create policy "post categories viewable by everyone"
on public.post_categories
for select
using (true);

create policy "users can manage categories on own posts"
on public.post_categories
for all
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_id and p.author_id = auth.uid()
  )
)
with check (
with check (auth.uid() = recipient_id);