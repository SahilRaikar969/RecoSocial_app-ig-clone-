import { createHash } from 'node:crypto'
import { DATASET_ID } from './dataset.mjs'

const literal = value => `'${String(value).replaceAll("'", "''")}'`
const guard = `
begin;
do $$ begin
  if current_setting('recosocial.demo_mode', true) is distinct from 'local' then
    raise exception 'Demo SQL requires the explicit local session guard';
  end if;
  if current_user <> 'postgres' then raise exception 'Demo SQL requires the local postgres administrator'; end if;
end $$;
select pg_advisory_xact_lock(173643, 61012);
create schema if not exists recosocial_demo;
revoke all on schema recosocial_demo from public, anon, authenticated, service_role;
create table if not exists recosocial_demo.runs (
  dataset_id text primary key, digest text not null, manifest jsonb not null
);
alter table recosocial_demo.runs enable row level security;
revoke all on recosocial_demo.runs from public, anon, authenticated, service_role;
`

// Every value is JSON encoded, then SQL quoted; there are no user supplied SQL
// identifiers or executable fragments. The CLI additionally gates local access.
export function buildSeedSql(dataset) {
  if (dataset.version !== DATASET_ID || dataset.users.length !== 30 || dataset.posts.length !== 300) {
    throw new Error('Unexpected demo dataset version or size')
  }
  const json = JSON.stringify(dataset)
  const digest = createHash('sha256').update(json).digest('hex')
  return `${guard}
do $seed$
declare
  data jsonb := ${literal(json)}::jsonb;
  existing recosocial_demo.runs%rowtype;
  created_categories jsonb;
begin
  select * into existing from recosocial_demo.runs where dataset_id = ${literal(DATASET_ID)};
  if found then
    if existing.digest <> ${literal(digest)} then
      raise exception 'Demo parameters changed; reset this dataset before reseeding';
    end if;
    if exists (
      select 1 from jsonb_to_recordset(data->'users') as d(id uuid, email text)
      left join auth.users u on u.id=d.id
      where u.id is null or u.email is distinct from d.email
        or u.raw_app_meta_data->>'recosocial_demo' is distinct from ${literal(DATASET_ID)}
    ) then raise exception 'Demo identity ownership changed; refusing rerun'; end if;
    return; -- Deliberate no-op: retain manual interactions until explicit reset.
  end if;

  if exists (
    select 1 from jsonb_to_recordset(data->'users') as d(id uuid, email text, username text)
    where exists (select 1 from auth.users u where u.id=d.id or lower(u.email)=lower(d.email))
       or exists (select 1 from public.profiles p where p.id=d.id or p.username=d.username)
  ) then raise exception 'Reserved demo identity collision; no existing user will be overwritten'; end if;
  if exists (select 1 from public.posts p join jsonb_to_recordset(data->'posts') as d(id uuid) on d.id=p.id)
     or exists (select 1 from public.comments c join jsonb_to_recordset(data->'comments') as d(id uuid) on d.id=c.id)
  then raise exception 'Reserved demo content collision'; end if;
  if exists (
    select 1 from public.categories c join jsonb_to_recordset(data->'categories') as d(id uuid, name text, slug text)
      on (c.id=d.id or c.name=d.name) and c.slug<>d.slug
  ) then raise exception 'Reserved demo category collision'; end if;

  select coalesce(jsonb_agg(d.id), '[]'::jsonb) into created_categories
    from jsonb_to_recordset(data->'categories') as d(id uuid, slug text)
    where not exists (select 1 from public.categories c where c.slug=d.slug);
  insert into public.categories(id, name, slug)
    select d.id,d.name,d.slug from jsonb_to_recordset(data->'categories') as d(id uuid,name text,slug text)
    where not exists (select 1 from public.categories c where c.slug=d.slug);

  -- These are labeled, non-sign-in actors: no password/identities/sessions,
  -- banned until year 9999 in GoTrue, with ownership only in admin app metadata.
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,banned_until)
    select id,email,jsonb_build_object('username',username),
      jsonb_build_object('recosocial_demo',${literal(DATASET_ID)}),'9999-12-31T23:59:59Z'::timestamptz
    from jsonb_to_recordset(data->'users') as d(id uuid,email text,username text);
  update public.profiles p set display_name=d.display_name,bio=d.bio
    from jsonb_to_recordset(data->'users') as d(id uuid,display_name text,bio text) where p.id=d.id;

  insert into public.posts(id,author_id,caption,media_type,media_path,thumbnail_path,duration_seconds,aspect_ratio,status,visibility,created_at,updated_at)
    select id,author_id,caption,media_type,media_path,thumbnail_path,duration_seconds,aspect_ratio,status,visibility,created_at,updated_at
    from jsonb_to_recordset(data->'posts') as d(id uuid,author_id uuid,caption text,media_type text,media_path text,thumbnail_path text,duration_seconds integer,aspect_ratio numeric,status text,visibility text,created_at timestamptz,updated_at timestamptz);
  insert into public.post_categories(post_id,category_id)
    select d.post_id,c.id from jsonb_to_recordset(data->'postCategories') as d(post_id uuid,category_id uuid)
    join jsonb_to_recordset(data->'categories') as t(id uuid,slug text) on t.id=d.category_id
    join public.categories c on c.slug=t.slug;
  insert into public.profile_category_preferences(profile_id,category_id)
    select d.profile_id,c.id from jsonb_to_recordset(data->'preferences') as d(profile_id uuid,category_id uuid)
    join jsonb_to_recordset(data->'categories') as t(id uuid,slug text) on t.id=d.category_id
    join public.categories c on c.slug=t.slug;
  insert into public.follows(follower_id,following_id,created_at)
    select follower_id,following_id,created_at from jsonb_to_recordset(data->'follows') as d(follower_id uuid,following_id uuid,created_at timestamptz);
  insert into public.likes(profile_id,post_id,created_at)
    select profile_id,post_id,created_at from jsonb_to_recordset(data->'likes') as d(profile_id uuid,post_id uuid,created_at timestamptz);
  insert into public.saves(profile_id,post_id,created_at)
    select profile_id,post_id,created_at from jsonb_to_recordset(data->'saves') as d(profile_id uuid,post_id uuid,created_at timestamptz);
  insert into public.comments(id,post_id,author_id,body,created_at,updated_at)
    select id,post_id,author_id,body,created_at,created_at from jsonb_to_recordset(data->'comments') as d(id uuid,post_id uuid,author_id uuid,body text,created_at timestamptz);
  insert into recosocial_demo.runs(dataset_id,digest,manifest)
    values (${literal(DATASET_ID)},${literal(digest)},data || jsonb_build_object('createdCategoryIds',created_categories));
end $seed$;
commit;
`
}

export function buildResetSql() {
  return `${guard}
do $reset$
declare data jsonb;
begin
  select manifest into data from recosocial_demo.runs where dataset_id=${literal(DATASET_ID)};
  if not found then return; end if;
  if exists (
    select 1 from jsonb_to_recordset(data->'users') as d(id uuid,email text)
    join auth.users u on u.id=d.id
    where u.email is distinct from d.email
       or u.raw_app_meta_data->>'recosocial_demo' is distinct from ${literal(DATASET_ID)}
  ) then raise exception 'Demo identity ownership changed; refusing reset'; end if;
  if exists (
    select 1 from jsonb_to_recordset(data->'posts') as d(id uuid,author_id uuid)
    join public.posts p on p.id=d.id where p.author_id<>d.author_id
  ) then raise exception 'Demo content ownership changed; refusing reset'; end if;
  -- Cascades are limited to these admin-marked actors. Real users' interactions
  -- on their demo content are removed with that content; unrelated data stays.
  delete from auth.users u using jsonb_to_recordset(data->'users') as d(id uuid) where u.id=d.id;
  delete from public.categories c
    where c.id in (select value::uuid from jsonb_array_elements_text(data->'createdCategoryIds'))
      and not exists (select 1 from public.post_categories pc where pc.category_id=c.id)
      and not exists (select 1 from public.profile_category_preferences pp where pp.category_id=c.id)
      and exists (select 1 from jsonb_to_recordset(data->'categories') as d(id uuid,slug text,name text)
        where d.id=c.id and d.slug=c.slug and d.name=c.name);
  delete from recosocial_demo.runs where dataset_id=${literal(DATASET_ID)};
end $reset$;
commit;
`
}
