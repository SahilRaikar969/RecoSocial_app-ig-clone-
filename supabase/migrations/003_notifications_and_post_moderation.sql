create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  post_id uuid null references posts(id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'comment')),
  comment_id uuid null references comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists notifications_recipient_created_idx
  on notifications (recipient_id, created_at desc);

create index if not exists notifications_actor_idx
  on notifications (actor_id);

create index if not exists notifications_post_idx
  on notifications (post_id);

create unique index if not exists notifications_unique_follow
  on notifications (recipient_id, actor_id, type)
  where type = 'follow';

create unique index if not exists notifications_unique_like
  on notifications (recipient_id, actor_id, post_id, type)
  where type = 'like';

alter table notifications
  add column if not exists read_at timestamptz null;

create table if not exists hidden_posts (
  profile_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

create table if not exists post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  reason text not null,
  details text null,
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

create index if not exists hidden_posts_profile_created_idx
  on hidden_posts (profile_id, created_at desc);

create index if not exists hidden_posts_post_idx
  on hidden_posts (post_id);

create index if not exists post_reports_reporter_created_idx
  on post_reports (reporter_id, created_at desc);

create index if not exists post_reports_post_idx
  on post_reports (post_id);