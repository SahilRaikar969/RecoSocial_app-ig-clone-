-- Forward-only M6 messaging support. Apply only after the established M1/M2 schema.
begin;

create table public.direct_thread_reads (
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null,
  last_read_message_id uuid not null,
  primary key (thread_id, profile_id)
);
alter table public.direct_thread_reads enable row level security;
revoke all on public.direct_thread_reads from public, anon, authenticated;
grant select on public.direct_thread_reads to authenticated;
create policy thread_reads_owner on public.direct_thread_reads for select to authenticated
  using (profile_id = (select auth.uid()) and exists (
    select 1 from public.direct_threads t where t.id = thread_id
  ));

-- Message IDs are client request IDs; timestamps must come from PostgreSQL.
-- The existing participant/mutual-follow INSERT policy remains authoritative.
revoke insert on public.direct_messages from authenticated;
grant insert (id, thread_id, sender_id, body) on public.direct_messages to authenticated;
revoke insert on public.direct_threads from authenticated;
grant insert (id, profile_low_id, profile_high_id) on public.direct_threads to authenticated;
-- Serialize each thread's inserts before assigning time. Transaction-start now()
-- can commit out of order, which would otherwise skip rows in cursor catch-up.
create function public.order_direct_message() returns trigger language plpgsql security definer set search_path = '' as $$
declare previous_time timestamptz;
begin
  select t.last_message_at into previous_time from public.direct_threads t where t.id = new.thread_id for update;
  new.created_at := greatest(clock_timestamp(), previous_time + interval '1 microsecond');
  update public.direct_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
revoke all on function public.order_direct_message() from public, anon, authenticated;
create trigger direct_message_order before insert on public.direct_messages for each row execute function public.order_direct_message();
create or replace function public.touch_direct_thread() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.direct_threads set last_message_at = greatest(last_message_at, new.created_at) where id = new.thread_id;
  return new;
end;
$$;
revoke all on function public.touch_direct_thread() from public, anon, authenticated;

create index direct_messages_thread_order_idx on public.direct_messages(thread_id, created_at desc, id desc);

create function public.mark_direct_thread_read(p_thread_id uuid, p_message_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  message_time timestamptz;
begin
  if viewer is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.direct_threads t where t.id = p_thread_id
    and viewer in (t.profile_low_id, t.profile_high_id)) then
    raise exception 'thread_not_found';
  end if;
  select m.created_at into message_time from public.direct_messages m
    where m.id = p_message_id and m.thread_id = p_thread_id;
  if not found then raise exception 'message_not_found'; end if;
  insert into public.direct_thread_reads as receipt (thread_id, profile_id, last_read_at, last_read_message_id)
    values (p_thread_id, viewer, message_time, p_message_id)
    on conflict (thread_id, profile_id) do update
      set last_read_at = excluded.last_read_at, last_read_message_id = excluded.last_read_message_id
      where (receipt.last_read_at, receipt.last_read_message_id) < (excluded.last_read_at, excluded.last_read_message_id);
  return true;
end;
$$;
revoke all on function public.mark_direct_thread_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_direct_thread_read(uuid, uuid) to authenticated;

create function public.get_direct_inbox(p_limit integer default 50, p_before_at timestamptz default null, p_before_id uuid default null)
returns table (
  thread_id uuid, profile_low_id uuid, profile_high_id uuid, last_message_at timestamptz,
  last_message_id uuid, last_message_body text, last_message_sender_id uuid,
  last_message_created_at timestamptz, has_unread boolean
) language sql stable security invoker set search_path = '' as $$
  with selected_threads as materialized (
    select t.id, t.profile_low_id, t.profile_high_id, t.last_message_at from public.direct_threads t
    where (select auth.uid()) in (t.profile_low_id, t.profile_high_id)
      and (p_before_at is null or (t.last_message_at, t.id) < (p_before_at, p_before_id))
    order by t.last_message_at desc, t.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  select t.id, t.profile_low_id, t.profile_high_id, t.last_message_at,
    latest.id, latest.body, latest.sender_id, latest.created_at,
    exists (select 1 from public.direct_messages unseen
      where unseen.thread_id = t.id and unseen.sender_id <> (select auth.uid())
        and (receipt.last_read_at is null or (unseen.created_at, unseen.id) > (receipt.last_read_at, receipt.last_read_message_id)))
  from selected_threads t
  left join public.direct_thread_reads receipt on receipt.thread_id = t.id and receipt.profile_id = (select auth.uid())
  left join lateral (
    select m.id, m.body, m.sender_id, m.created_at from public.direct_messages m
    where m.thread_id = t.id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  order by t.last_message_at desc, t.id desc;
$$;
revoke all on function public.get_direct_inbox(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.get_direct_inbox(integer, timestamptz, uuid) to authenticated;

-- Realtime is optional in embedded PostgreSQL. Never assume live publication state.
do $$
declare relation_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array['direct_messages', 'direct_threads', 'direct_thread_reads'] loop
      if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = relation_name) then
        execute format('alter publication supabase_realtime add table public.%I', relation_name);
      end if;
    end loop;
  end if;
end;
$$;
commit;
