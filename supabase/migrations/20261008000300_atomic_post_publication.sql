-- M2: atomic post and category writes. Apply only after the reconciled M1 schema.
-- No data is rewritten by this migration. Existing/live rollout remains manual.
begin;
create function public.save_post_with_categories(
  target_post_id uuid,
  create_new boolean,
  post_caption text,
  post_media_type text,
  post_media_path text,
  post_thumbnail_path text,
  category_ids uuid[],
  expected_updated_at timestamptz default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  current_post public.posts%rowtype;
  selected_ids uuid[];
  existing_ids uuid[];
  inserted_count integer;
begin
  if actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if target_post_id is null or create_new is null then raise exception 'invalid_post_request' using errcode = '22023'; end if;
  if category_ids is null or cardinality(category_ids) not between 1 and 100
     or array_position(category_ids, null) is not null then
    raise exception 'invalid_categories' using errcode = '22023';
  end if;
  select array_agg(distinct item order by item) into selected_ids from unnest(category_ids) as item;
  if (select count(*) from public.categories where id = any(selected_ids)) <> cardinality(selected_ids) then
    raise exception 'invalid_categories' using errcode = '22023';
  end if;
  if create_new then
    insert into public.posts(id,author_id,caption,media_type,media_path,thumbnail_path,status,visibility)
    values(target_post_id,actor,post_caption,post_media_type,post_media_path,post_thumbnail_path,'published','public')
    on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count = 0 then
      select * into current_post from public.posts where id = target_post_id and author_id = actor for update;
      if not found then raise exception 'post_not_found' using errcode = '42501'; end if;
      select array_agg(category_id order by category_id) into existing_ids from public.post_categories where post_id = target_post_id;
      if current_post.caption is not distinct from post_caption
         and current_post.media_type = post_media_type
         and current_post.media_path = post_media_path
         and current_post.thumbnail_path is not distinct from post_thumbnail_path
         and existing_ids is not distinct from selected_ids then return target_post_id; end if;
      raise exception 'publication_request_conflict' using errcode = '40001';
    end if;
  else
    select * into current_post from public.posts where id = target_post_id and author_id = actor for update;
    if not found then raise exception 'post_not_found' using errcode = '42501'; end if;
    if expected_updated_at is null or current_post.updated_at <> expected_updated_at then
      raise exception 'post_changed_reload' using errcode = '40001';
    end if;
    update public.posts set caption = post_caption, media_type = post_media_type,
      media_path = post_media_path, thumbnail_path = post_thumbnail_path
      where id = target_post_id and author_id = actor;
    delete from public.post_categories where post_id = target_post_id;
  end if;
  insert into public.post_categories(post_id,category_id) select target_post_id, unnest(selected_ids);
  return target_post_id;
end;
$$;
revoke all on function public.save_post_with_categories(uuid,boolean,text,text,text,text,uuid[],timestamptz) from public, anon, authenticated;
grant execute on function public.save_post_with_categories(uuid,boolean,text,text,text,text,uuid[],timestamptz) to authenticated;
commit;
