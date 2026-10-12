begin;
-- Forward-only M6 additions. Apply after M1/M2 have been reconciled; never reset hosted data.
create index if not exists likes_profile_recent_idx on public.likes(profile_id, created_at desc, post_id);
create index if not exists saves_profile_recent_idx on public.saves(profile_id, created_at desc, post_id);
create index if not exists comments_author_recent_idx on public.comments(author_id, created_at desc, id);

-- Counts and the caller's own flags only. No saver identity or private history is returned.
create or replace function public.get_visible_post_engagement(post_ids uuid[])
returns table(post_id uuid, like_count bigint, save_count bigint, comment_count bigint, liked_by_me boolean, saved_by_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if post_ids is null or cardinality(post_ids) > 80 then
    raise exception 'Provide at most 80 post IDs' using errcode = '22023';
  end if;
  return query select p.id,
    (select count(*) from public.likes l where l.post_id=p.id),
    (select count(*) from public.saves s where s.post_id=p.id),
    (select count(*) from public.comments c where c.post_id=p.id),
    exists(select 1 from public.likes l where l.post_id=p.id and l.profile_id=auth.uid()),
    exists(select 1 from public.saves s where s.post_id=p.id and s.profile_id=auth.uid())
  from public.posts p where p.id=any(post_ids)
    and ((p.status='published' and p.visibility='public') or p.author_id=auth.uid());
end;
$$;
revoke all on function public.get_visible_post_engagement(uuid[]) from public, anon, authenticated;
grant execute on function public.get_visible_post_engagement(uuid[]) to anon, authenticated;

commit;
