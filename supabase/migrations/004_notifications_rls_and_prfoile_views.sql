alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('follow', 'like', 'comment', 'profile_view'));

create unique index if not exists notifications_unique_profile_view
  on public.notifications (recipient_id, actor_id, type)
  where type = 'profile_view';

alter table public.hidden_posts enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "users can view own notifications" on public.notifications;
create policy "users can view own notifications"
on public.notifications
for select
using (auth.uid() = recipient_id);

drop policy if exists "users can insert notifications they generate" on public.notifications;
create policy "users can insert notifications they generate"
on public.notifications
for insert
with check (auth.uid() = actor_id);

drop policy if exists "users can update own notifications" on public.notifications;
create policy "users can update own notifications"
on public.notifications
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

drop policy if exists "users can delete notifications they generated" on public.notifications;
create policy "users can delete notifications they generated"
on public.notifications
for delete
using (auth.uid() = actor_id or auth.uid() = recipient_id);

drop policy if exists "users can manage own hidden posts" on public.hidden_posts;
create policy "users can manage own hidden posts"
on public.hidden_posts
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "users can manage own post reports" on public.post_reports;
create policy "users can manage own post reports"
on public.post_reports
for all
using (auth.uid() = reporter_id)
with check (auth.uid() = reporter_id);