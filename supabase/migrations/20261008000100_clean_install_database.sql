-- RecoSocial M1 CLEAN-INSTALL baseline. NOT an upgrade for an existing project.
-- Deliberately fail before any DDL if public tables or Auth users already exist.
-- Existing/live projects require an inspected, separately approved forward migration.
begin;

do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'RecoSocial requires Supabase Auth (auth.users is missing)';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  ) or exists (select 1 from auth.users) then
    raise exception 'STOP: RecoSocial baseline is clean-install only. Existing tables or Auth users require live inspection and an approved forward migration; no data was changed.';
  end if;
end;
$$;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Relative references must name an object under the record owner's path.
-- Explicit public HTTP(S) links remain supported. This validates references,
-- not ownership of an externally hosted/public object and performs no fetch.
create function public.valid_media_reference(value text, owner_id uuid) returns boolean
language sql immutable set search_path = '' as $$
  select value is null
    or value ~* '^https?://[^/[:space:]][^[:space:]]*$'
    or (
      array_length(string_to_array(value, '/'), 1) = 3
      and split_part(value, '/', 1) = any(array[
        'images','videos','thumbnails','avatars',
        'story-images','story-videos','story-thumbnails',
        'camera-story-images','camera-story-videos','camera-post-images','camera-post-videos'
      ])
      and split_part(value, '/', 2) = owner_id::text
      and split_part(value, '/', 3) ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    );
$$;
revoke all on function public.valid_media_reference(text, uuid) from public, anon, authenticated;
grant execute on function public.valid_media_reference(text, uuid) to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{1,30}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  bio text check (char_length(bio) <= 280),
  avatar_url text check (public.valid_media_reference(avatar_url, id)),
  is_private boolean not null default false check (is_private = false),
  theme_preference text not null default 'dark' check (theme_preference in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profile_category_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, category_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text check (char_length(caption) <= 280),
  media_type text not null check (media_type in ('image', 'video')),
  media_path text not null check (btrim(media_path) <> '' and public.valid_media_reference(media_path, author_id)),
  thumbnail_path text check (public.valid_media_reference(thumbnail_path, author_id)),
  duration_seconds integer check (duration_seconds >= 0),
  aspect_ratio numeric check (aspect_ratio > 0),
  status text not null default 'published' check (status in ('draft', 'published')),
  visibility text not null default 'public' check (visibility = 'public'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_categories (
  post_id uuid not null references public.posts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (post_id, category_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.likes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

create table public.saves (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'comment', 'profile_view')),
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id),
  check (
    (type in ('follow', 'profile_view') and post_id is null and comment_id is null)
    or (type = 'like' and post_id is not null and comment_id is null)
    or (type = 'comment' and post_id is not null and comment_id is not null)
  )
);

create table public.hidden_posts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'nsfw', 'misinformation', 'other')),
  details text,
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_path text not null check (btrim(media_path) <> '' and public.valid_media_reference(media_path, author_id)),
  thumbnail_path text check (public.valid_media_reference(thumbnail_path, author_id)),
  caption text check (char_length(caption) <= 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours'),
  check (expires_at > created_at)
);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  profile_low_id uuid not null references public.profiles(id) on delete cascade,
  profile_high_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (profile_low_id < profile_high_id),
  unique (profile_low_id, profile_high_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

-- Query/FK indexes; primary keys already cover owner-first interaction queries.
create index posts_author_created_idx on public.posts(author_id, created_at desc);
create index posts_public_created_idx on public.posts(created_at desc) where status = 'published' and visibility = 'public';
create index post_categories_category_idx on public.post_categories(category_id, post_id);
create index preferences_category_idx on public.profile_category_preferences(category_id);
create index follows_following_idx on public.follows(following_id, follower_id);
create index likes_post_idx on public.likes(post_id);
create index saves_post_idx on public.saves(post_id);
create index comments_post_created_idx on public.comments(post_id, created_at);
create index comments_author_idx on public.comments(author_id);
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications(recipient_id) where read_at is null;
create index notifications_actor_idx on public.notifications(actor_id);
create index notifications_post_idx on public.notifications(post_id);
create index notifications_comment_idx on public.notifications(comment_id);
create unique index notifications_unique_follow on public.notifications(recipient_id, actor_id, type) where type = 'follow';
create unique index notifications_unique_like on public.notifications(recipient_id, actor_id, post_id, type) where type = 'like';
create unique index notifications_unique_comment on public.notifications(comment_id) where type = 'comment';
create unique index notifications_unique_profile_view on public.notifications(recipient_id, actor_id, type) where type = 'profile_view';
create index hidden_posts_post_idx on public.hidden_posts(post_id);
create index hidden_posts_profile_created_idx on public.hidden_posts(profile_id, created_at desc);
create index post_reports_post_idx on public.post_reports(post_id);
create index post_reports_reporter_created_idx on public.post_reports(reporter_id, created_at desc);
create index stories_author_created_idx on public.stories(author_id, created_at desc);
create index stories_expires_idx on public.stories(expires_at);
create index story_views_viewer_idx on public.story_views(viewer_id);
create index direct_threads_high_idx on public.direct_threads(profile_high_id, last_message_at desc);
create index direct_threads_low_idx on public.direct_threads(profile_low_id, last_message_at desc);
create index direct_messages_thread_created_idx on public.direct_messages(thread_id, created_at);
create index direct_messages_sender_idx on public.direct_messages(sender_id);

-- No unimplemented views/skips/affinity tables: current recommendations derive
-- their category weights from preferences, current likes and current saves.
insert into public.categories (name, slug) values
  ('Animals', 'animals'), ('Religion & Spirituality', 'religion-spirituality'),
  ('Memes & Brainrot', 'memes-brainrot'), ('Science', 'science'),
  ('Finance', 'finance'), ('Cars & Bikes', 'cars-bikes'), ('Fashion', 'fashion'),
  ('Food', 'food'), ('Travel', 'travel'), ('Health & Fitness', 'health-fitness'),
  ('Music', 'music'), ('Movies & Series', 'movies-series'), ('Sports', 'sports'),
  ('Art & Design', 'art-design'), ('Photography', 'photography'), ('Lifestyle', 'lifestyle');

-- Confirmation-safe provisioning: this runs inside the Auth user transaction,
-- before a confirmed browser session exists. Metadata cannot choose profile id.
create function public.provision_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base_name text;
  candidate text;
  profile_name text;
begin
  base_name := left(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', '')), '[^a-z0-9._]', '', 'g'), 30);
  if base_name = '' then base_name := 'user'; end if;
  candidate := base_name;
  profile_name := left(btrim(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[._-]+', ' ', 'g')), 60);
  if profile_name = '' then profile_name := 'New User'; end if;
  loop
    begin
      insert into public.profiles(id, username, display_name, bio)
      values (new.id, candidate, profile_name, '');
      return new;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = new.id) then return new; end if;
      candidate := left(base_name, 20) || '_' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    end;
  end loop;
end;
$$;
revoke all on function public.provision_auth_profile() from public, anon, authenticated;
create trigger recosocial_auth_profile after insert on auth.users
for each row execute function public.provision_auth_profile();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger posts_updated before update on public.posts for each row execute function public.touch_updated_at();
create trigger comments_updated before update on public.comments for each row execute function public.touch_updated_at();

-- PostgREST upsert updates conflict columns too. Permit repeated own upserts but
-- never let an UPDATE move an interaction to another owner/target.
create function public.keep_identity_columns() returns trigger
language plpgsql set search_path = '' as $$
declare column_name text;
begin
  foreach column_name in array tg_argv loop
    if to_jsonb(new)->column_name is distinct from to_jsonb(old)->column_name then
      raise exception 'Identity columns are immutable' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.keep_identity_columns() from public, anon, authenticated;
create trigger follows_identity before update on public.follows for each row execute function public.keep_identity_columns('follower_id', 'following_id', 'created_at');
create trigger likes_identity before update on public.likes for each row execute function public.keep_identity_columns('profile_id', 'post_id', 'created_at');
create trigger saves_identity before update on public.saves for each row execute function public.keep_identity_columns('profile_id', 'post_id', 'created_at');
create trigger hidden_posts_identity before update on public.hidden_posts for each row execute function public.keep_identity_columns('profile_id', 'post_id', 'created_at');
create trigger reports_identity before update on public.post_reports for each row execute function public.keep_identity_columns('id', 'reporter_id', 'post_id', 'created_at');
create trigger story_views_identity before update on public.story_views for each row execute function public.keep_identity_columns('story_id', 'viewer_id', 'created_at');
create trigger direct_threads_identity before update on public.direct_threads for each row execute function public.keep_identity_columns('id', 'profile_low_id', 'profile_high_id', 'created_at');

create function public.save_profile_category_preferences(category_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); requested uuid[];
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if category_ids is null or cardinality(category_ids) not between 1 and 100 or array_position(category_ids, null) is not null then
    raise exception 'Select between 1 and 100 valid categories' using errcode = '22023';
  end if;
  select array_agg(distinct id) into requested from unnest(category_ids) as t(id);
  if (select count(*) from public.categories where id = any(requested)) <> cardinality(requested) then
    raise exception 'Unknown category' using errcode = '22023';
  end if;
  -- Serialize concurrent replacement for this owner; failure rolls back deletion.
  perform 1 from public.profiles where id = actor for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  delete from public.profile_category_preferences where profile_id = actor;
  insert into public.profile_category_preferences(profile_id, category_id)
  select actor, id from unnest(requested) as t(id);
end;
$$;
revoke all on function public.save_profile_category_preferences(uuid[]) from public, anon, authenticated;
grant execute on function public.save_profile_category_preferences(uuid[]) to authenticated;

-- Counts are public engagement signals; saver identities/history remain private.
-- Never return a row for a draft belonging to somebody else.
create function public.get_visible_post_save_counts(post_ids uuid[])
returns table(post_id uuid, save_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if post_ids is null or cardinality(post_ids) > 1000 then
    raise exception 'Provide at most 1000 post IDs' using errcode = '22023';
  end if;
  return query
  select p.id, count(s.profile_id)
  from public.posts p left join public.saves s on s.post_id = p.id
  where p.id = any(post_ids)
    and ((p.status = 'published' and p.visibility = 'public') or p.author_id = auth.uid())
  group by p.id;
end;
$$;
revoke all on function public.get_visible_post_save_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_visible_post_save_counts(uuid[]) to anon, authenticated;

-- Social notifications are derived from successful, RLS-authorized interactions.
-- Their creation/deletion is part of the same database transaction as that event.
create function public.emit_social_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'follows' then
    if tg_op = 'DELETE' then
      delete from public.notifications where type = 'follow' and actor_id = old.follower_id and recipient_id = old.following_id;
      return old;
    end if;
    insert into public.notifications(recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow') on conflict do nothing;
  elsif tg_table_name = 'likes' then
    if tg_op = 'DELETE' then
      delete from public.notifications where type = 'like' and actor_id = old.profile_id and post_id = old.post_id;
      return old;
    end if;
    select author_id into target_id from public.posts where id = new.post_id;
    if target_id is distinct from new.profile_id then
      insert into public.notifications(recipient_id, actor_id, post_id, type)
      values (target_id, new.profile_id, new.post_id, 'like') on conflict do nothing;
    end if;
  elsif tg_table_name = 'comments' then
    select author_id into target_id from public.posts where id = new.post_id;
    if target_id is distinct from new.author_id then
      insert into public.notifications(recipient_id, actor_id, post_id, comment_id, type)
      values (target_id, new.author_id, new.post_id, new.id, 'comment');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.emit_social_notification() from public, anon, authenticated;
create trigger follows_notification after insert or delete on public.follows for each row execute function public.emit_social_notification();
create trigger likes_notification after insert or delete on public.likes for each row execute function public.emit_social_notification();
create trigger comments_notification after insert on public.comments for each row execute function public.emit_social_notification();

create function public.record_profile_view(target_profile_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if target_profile_id = actor then return; end if;
  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'Profile not found' using errcode = '22023';
  end if;
  insert into public.notifications(recipient_id, actor_id, type)
  values(target_profile_id, actor, 'profile_view')
  on conflict (recipient_id, actor_id, type) where type = 'profile_view'
  do update set created_at = now(), read_at = null;
end;
$$;
revoke all on function public.record_profile_view(uuid) from public, anon, authenticated;
grant execute on function public.record_profile_view(uuid) to authenticated;

create function public.touch_direct_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.direct_threads set last_message_at = now() where id = new.thread_id;
  return new;
end;
$$;
revoke all on function public.touch_direct_thread() from public, anon, authenticated;
create trigger direct_message_timestamp after insert on public.direct_messages for each row execute function public.touch_direct_thread();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.profile_category_preferences enable row level security;
alter table public.posts enable row level security;
alter table public.post_categories enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.hidden_posts enable row level security;
alter table public.post_reports enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.direct_threads enable row level security;
alter table public.direct_messages enable row level security;

-- Explicit grants override permissive platform default privileges for new tables.
revoke all on public.profiles, public.categories, public.profile_category_preferences,
  public.posts, public.post_categories, public.follows, public.likes, public.saves,
  public.comments, public.notifications, public.hidden_posts, public.post_reports,
  public.stories, public.story_views, public.direct_threads, public.direct_messages
from public, anon, authenticated;
grant select on public.profiles, public.categories, public.posts, public.post_categories,
  public.follows, public.likes, public.comments, public.stories to anon, authenticated;
grant select on public.profile_category_preferences, public.saves, public.notifications,
  public.hidden_posts, public.post_reports, public.story_views, public.direct_threads,
  public.direct_messages to authenticated;
grant insert on public.profiles, public.posts, public.post_categories, public.follows,
  public.likes, public.saves, public.comments, public.hidden_posts, public.post_reports,
  public.stories, public.story_views, public.direct_threads, public.direct_messages to authenticated;
grant update(username, display_name, bio, avatar_url, theme_preference) on public.profiles to authenticated;
grant update(caption, media_type, media_path, thumbnail_path, duration_seconds, aspect_ratio, status, visibility) on public.posts to authenticated;
grant update on public.follows, public.likes, public.saves, public.hidden_posts, public.post_reports, public.story_views to authenticated;
grant update(body) on public.comments to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(media_type, media_path, thumbnail_path, caption) on public.stories to authenticated;
grant delete on public.posts, public.post_categories, public.follows, public.likes,
  public.saves, public.comments, public.notifications, public.hidden_posts,
  public.post_reports, public.stories to authenticated;

create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()) and is_private = false);
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy preferences_read_self on public.profile_category_preferences for select to authenticated using (profile_id = (select auth.uid()));
-- Preference writes are only exposed through the validated atomic RPC.

create policy posts_read on public.posts for select to anon, authenticated using ((status = 'published' and visibility = 'public') or author_id = (select auth.uid()));
create policy posts_insert_self on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy posts_update_self on public.posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete_self on public.posts for delete to authenticated using (author_id = (select auth.uid()));
create policy post_categories_read on public.post_categories for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_categories_insert_self on public.post_categories for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
create policy post_categories_delete_self on public.post_categories for delete to authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy follows_read on public.follows for select to anon, authenticated using (true);
create policy follows_insert_self on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_update_self on public.follows for update to authenticated using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));
create policy follows_delete_self on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy likes_read on public.likes for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy likes_insert_self on public.likes for insert to authenticated with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy likes_update_self on public.likes for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy likes_delete_self on public.likes for delete to authenticated using (profile_id = (select auth.uid()));

create policy saves_read_self on public.saves for select to authenticated using (profile_id = (select auth.uid()));
create policy saves_insert_self on public.saves for insert to authenticated with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy saves_update_self on public.saves for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy saves_delete_self on public.saves for delete to authenticated using (profile_id = (select auth.uid()));

create policy comments_read on public.comments for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert_self on public.comments for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_update_self on public.comments for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy comments_delete_author_or_post_owner on public.comments for delete to authenticated using (author_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy notifications_read_self on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy notifications_delete_self on public.notifications for delete to authenticated using (recipient_id = (select auth.uid()));

create policy hidden_read_self on public.hidden_posts for select to authenticated using (profile_id = (select auth.uid()));
create policy hidden_insert_self on public.hidden_posts for insert to authenticated with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy hidden_update_self on public.hidden_posts for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy hidden_delete_self on public.hidden_posts for delete to authenticated using (profile_id = (select auth.uid()));
create policy reports_read_self on public.post_reports for select to authenticated using (reporter_id = (select auth.uid()));
create policy reports_insert_self on public.post_reports for insert to authenticated with check (reporter_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy reports_update_self on public.post_reports for update to authenticated using (reporter_id = (select auth.uid())) with check (reporter_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy reports_delete_self on public.post_reports for delete to authenticated using (reporter_id = (select auth.uid()));

create policy stories_read on public.stories for select to anon, authenticated using (expires_at > now() or author_id = (select auth.uid()));
create policy stories_insert_self on public.stories for insert to authenticated with check (author_id = (select auth.uid()));
create policy stories_update_self on public.stories for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy stories_delete_self on public.stories for delete to authenticated using (author_id = (select auth.uid()));
create policy story_views_read on public.story_views for select to authenticated using (viewer_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid())));
create policy story_views_insert_self on public.story_views for insert to authenticated with check (viewer_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id and s.expires_at > now()));
create policy story_views_update_self on public.story_views for update to authenticated using (viewer_id = (select auth.uid())) with check (viewer_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id and s.expires_at > now()));

-- Existing inbox behavior retains participant-only history after an unfollow.
-- New threads/messages require mutual follows. Participants never change, and
-- clients cannot update thread timestamps or move a message between threads.
create policy threads_read_participant on public.direct_threads for select to authenticated using ((select auth.uid()) in (profile_low_id, profile_high_id));
create policy threads_insert_mutual on public.direct_threads for insert to authenticated with check (
  (select auth.uid()) in (profile_low_id, profile_high_id)
  and exists (select 1 from public.follows f where f.follower_id = profile_low_id and f.following_id = profile_high_id)
  and exists (select 1 from public.follows f where f.follower_id = profile_high_id and f.following_id = profile_low_id)
);
create policy messages_read_participant on public.direct_messages for select to authenticated using (exists (select 1 from public.direct_threads t where t.id = thread_id));
create policy messages_insert_mutual on public.direct_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.direct_threads t where t.id = thread_id
    and exists (select 1 from public.follows f where f.follower_id = t.profile_low_id and f.following_id = t.profile_high_id)
    and exists (select 1 from public.follows f where f.follower_id = t.profile_high_id and f.following_id = t.profile_low_id)
  )
);

-- Enable the existing recipient-filtered notification subscription on Supabase.
-- The embedded PostgreSQL tests do not provide Realtime; see live checklist.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

commit;
