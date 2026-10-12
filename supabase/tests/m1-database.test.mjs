import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { applyMigrations, asRole, createTestDatabase, migrationsDirectory } from './database.mjs'

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const A = id(1), B = id(2), C = id(3)
const PA = id(101), PB = id(102), DRAFT = id(103), STORY = id(201)
let db, categoryA, categoryB
const owner = (user, callback) => asRole(db, 'authenticated', user, callback)
const anon = callback => asRole(db, 'anon', null, callback)
const denied = promise => assert.rejects(promise, /permission denied|row-level security|immutable|check constraint/i)
const rows = async (sql, params = []) => (await db.query(sql, params)).rows
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0]

before(async () => {
  db = await createTestDatabase()
  for (const [user, username] of [[A, 'alice'], [B, 'bob'], [C, 'carol']]) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [user, username + '@example.test', { username }])
  }
  const categories = await rows('select id from public.categories order by slug limit 2')
  categoryA = categories[0].id
  categoryB = categories[1].id
  await db.query("insert into public.posts(id,author_id,media_type,media_path,status) values($1,$2,'image',$3,'published'),($4,$5,'image',$6,'published'),($7,$5,'image',$8,'draft')", [PA,A,'images/'+A+'/a.jpg',PB,B,'images/'+B+'/b.jpg',DRAFT,'images/'+B+'/draft.jpg'])
  await db.query("insert into public.stories(id,author_id,media_type,media_path) values($1,$2,'image',$3)", [STORY,A,'story-images/'+A+'/story.jpg'])
})
after(async () => { if (db) await db.close() })

test('fresh installation creates 17 application tables, RLS, categories and safe function grants', async () => {
  const tables = await rows("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")
  // M6 adds owner-only message read receipts through a forward migration.
  assert.equal(tables.length, 17)
  assert.ok(tables.every(table => table.relrowsecurity))
  assert.equal(await scalar('select count(*)::int from public.categories'), 16)
  assert.equal(await scalar("select has_function_privilege('anon','public.save_profile_category_preferences(uuid[])','execute')"), false)
  assert.equal(await scalar("select has_function_privilege('authenticated','public.save_profile_category_preferences(uuid[])','execute')"), true)
  for (const name of ['provision_auth_profile()', 'emit_social_notification()', 'touch_direct_thread()', 'keep_identity_columns()']) {
    assert.equal(await scalar("select has_function_privilege('authenticated',$1,'execute')", ['public.'+name]), false)
  }
  const definers = await rows("select proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")
  assert.ok(definers.length >= 5)
  assert.ok(definers.every(fn => fn.proconfig.some(value => value.startsWith('search_path=') && (value === 'search_path=""' || value === 'search_path='))))
  assert.equal(await scalar("select has_schema_privilege('authenticated','public','create')"), false)
})

test('baseline refuses existing public tables before changing data', async () => {
  const candidate = await createTestDatabase({ migrations: false })
  try {
    await candidate.exec("create table public.keep_me(value text); insert into public.keep_me values('preserved')")
    await assert.rejects(applyMigrations(candidate), /clean-install only/)
    assert.deepEqual((await candidate.query('select * from public.keep_me')).rows, [{ value: 'preserved' }])
    assert.equal((await candidate.query("select to_regclass('public.profiles') as relation")).rows[0].relation, null)
  } finally { await candidate.close() }
})

test('baseline refuses existing Auth users even when public is empty', async () => {
  const candidate = await createTestDatabase({ migrations: false })
  try {
    await candidate.query('insert into auth.users(id,email) values($1,$2)', [A,'preserved@example.test'])
    await assert.rejects(applyMigrations(candidate), /clean-install only/)
    assert.equal((await candidate.query('select count(*)::int as n from auth.users')).rows[0].n, 1)
    assert.equal((await candidate.query("select to_regclass('public.profiles') as relation")).rows[0].relation, null)
  } finally { await candidate.close() }
})

test('Auth trigger provisions confirmation-safe UUID profiles and handles duplicate usernames', async () => {
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id(4),'new.user@example.test',{username:'ALICE',id:B,is_private:true}])
  const profile = (await rows('select * from public.profiles where id=$1', [id(4)]))[0]
  assert.equal(profile.id, id(4))
  assert.match(profile.username, /^alice_[a-z0-9]{8}$/)
  assert.equal(profile.display_name, 'new user')
  assert.equal(profile.is_private, false)
  assert.equal((await rows('select username from public.profiles where id=$1', [B]))[0].username, 'bob')
})

test('profile ownership and public-only account constraints cannot be bypassed', async () => {
  await anon(async () => {
    assert.equal(await scalar('select count(*)::int from public.profiles'), 4)
    await denied(db.query("update public.profiles set bio='attacker' where id=$1", [A]))
    await denied(db.query("insert into public.profiles(id,username,display_name) values($1,'spoof','Spoof')", [id(999)]))
  })
  await owner(A, async () => {
    assert.equal((await rows("update public.profiles set bio='owned' where id=$1 returning id", [A])).length, 1)
    assert.equal((await rows("update public.profiles set bio='attacker' where id=$1 returning id", [B])).length, 0)
    await denied(db.query('update public.profiles set id=$1 where id=$2', [C,A]))
    await denied(db.query('update public.profiles set is_private=true where id=$1', [A]))
  })
  await assert.rejects(db.query('update public.profiles set is_private=true where id=$1',[A]), /check constraint/)
})

test('posts and category joins enforce owner mutations and draft visibility', async () => {
  await anon(async () => {
    assert.equal((await rows('select id from public.posts where id=$1', [DRAFT])).length, 0)
    assert.equal((await rows('select id from public.posts where id=$1', [PA])).length, 1)
    await denied(db.query("insert into public.posts(author_id,media_type,media_path) values($1,'image',$2)", [A,'images/'+A+'/anon.jpg']))
  })
  await owner(A, async () => {
    await denied(db.query("insert into public.posts(author_id,media_type,media_path) values($1,'image',$2)", [B,'images/'+B+'/spoof.jpg']))
    assert.equal((await rows("update public.posts set caption='mine' where id=$1 returning id", [PA])).length, 1)
    assert.equal((await rows("update public.posts set caption='spoof' where id=$1 returning id", [PB])).length, 0)
    assert.equal((await rows('delete from public.posts where id=$1 returning id', [PB])).length, 0)
    await denied(db.query('update public.posts set author_id=$1 where id=$2', [B,PA]))
    await db.query('insert into public.post_categories(post_id,category_id) values($1,$2)', [PA,categoryA])
    await denied(db.query('insert into public.post_categories(post_id,category_id) values($1,$2)', [PB,categoryA]))
    assert.equal((await rows('select id from public.posts where id=$1', [DRAFT])).length, 0)
  })
  await owner(B, async () => assert.equal((await rows('select id from public.posts where id=$1', [DRAFT])).length, 1))
})

test('preference replacement is owner-derived, atomic, deduplicated and row-locked', async () => {
  await owner(A, async () => {
    await db.query('select public.save_profile_category_preferences($1::uuid[])', [[categoryA,categoryA]])
    assert.deepEqual(await rows('select category_id from public.profile_category_preferences'), [{category_id:categoryA}])
    await assert.rejects(db.query('select public.save_profile_category_preferences($1::uuid[])', [[categoryB,id(999)]]), /Unknown category/)
    assert.deepEqual(await rows('select category_id from public.profile_category_preferences'), [{category_id:categoryA}])
    await assert.rejects(db.query('select public.save_profile_category_preferences($1::uuid[])', [[]]), /Select between/)
    await assert.rejects(db.query('select public.save_profile_category_preferences($1::uuid[])', [[null]]), /Select between/)
    await denied(db.query('insert into public.profile_category_preferences(profile_id,category_id) values($1,$2)', [B,categoryB]))
    // Overlapping callers are queued by this single embedded connection.
    // True multi-connection lock contention remains a live/staging check.
    await Promise.all([
      db.query('select public.save_profile_category_preferences($1::uuid[])', [[categoryA,categoryB]]),
      db.query('select public.save_profile_category_preferences($1::uuid[])', [[categoryB]])
    ])
    assert.deepEqual(await rows('select category_id from public.profile_category_preferences'), [{category_id:categoryB}])
  })
  await owner(B, async () => assert.equal((await rows('select * from public.profile_category_preferences')).length, 0))
  await anon(async () => await denied(db.query('select public.save_profile_category_preferences($1::uuid[])', [[categoryA]])))
  const definition = await scalar("select pg_get_functiondef('public.save_profile_category_preferences(uuid[])'::regprocedure)")
  assert.match(definition, /public\.profiles where id = actor for update/i)
})

test('likes and saves reject impersonation, repeated upserts remain one current interaction', async () => {
  await owner(A, async () => {
    for (const table of ['likes','saves']) {
      await denied(db.query('insert into public.'+table+'(profile_id,post_id) values($1,$2)', [B,PA]))
      await denied(db.query('insert into public.'+table+'(profile_id,post_id) values($1,$2)', [A,DRAFT]))
      for (let i=0;i<2;i++) {
        await db.query('insert into public.'+table+'(profile_id,post_id) values($1,$2) on conflict(profile_id,post_id) do update set profile_id=excluded.profile_id,post_id=excluded.post_id', [A,PB])
      }
      assert.equal(await scalar('select count(*)::int from public.'+table+' where profile_id=$1 and post_id=$2', [A,PB]), 1)
      await denied(db.query('update public.'+table+' set post_id=$1 where profile_id=$2 and post_id=$3', [PA,A,PB]))
    }
  })
  await owner(B, async () => {
    await db.query('insert into public.saves(profile_id,post_id) values($1,$2)', [B,PB])
    assert.equal((await rows('delete from public.likes where profile_id=$1 returning profile_id', [A])).length, 0)
  })
})

test('save history is private while count-only RPC preserves aggregate ranking input', async () => {
  await owner(A, async () => {
    assert.deepEqual(await rows('select profile_id,post_id from public.saves'), [{profile_id:A,post_id:PB}])
    const counts = await rows('select * from public.get_visible_post_save_counts($1::uuid[]) order by post_id', [[PA,PB,DRAFT]])
    assert.deepEqual(counts, [{post_id:PA,save_count:0},{post_id:PB,save_count:2}])
    assert.deepEqual(Object.keys(counts[0]).sort(), ['post_id','save_count'])
  })
  await anon(async () => {
    await denied(db.query('select * from public.saves'))
    assert.deepEqual(await rows('select * from public.get_visible_post_save_counts($1::uuid[])', [[PB,DRAFT]]), [{post_id:PB,save_count:2}])
  })
  await owner(B, async () => assert.deepEqual(await rows('select * from public.get_visible_post_save_counts($1::uuid[])', [[DRAFT]]), [{post_id:DRAFT,save_count:0}]))
  await assert.rejects(db.query('select * from public.get_visible_post_save_counts($1::uuid[])',[Array(1001).fill(PA)]),/at most 1000/)
  await owner(A, async () => await db.query('delete from public.saves where profile_id=$1 and post_id=$2', [A,PB]))
  assert.equal(await scalar('select save_count from public.get_visible_post_save_counts($1::uuid[])', [[PB]]), 1)
})

test('notification triggers target owners, suppress self/duplicate events and remove deleted events', async () => {
  await owner(C, async () => {
    for (let i=0;i<2;i++) {
      await db.query('insert into public.follows(follower_id,following_id) values($1,$2) on conflict(follower_id,following_id) do update set follower_id=excluded.follower_id,following_id=excluded.following_id', [C,A])
      await db.query('insert into public.likes(profile_id,post_id) values($1,$2) on conflict(profile_id,post_id) do update set profile_id=excluded.profile_id,post_id=excluded.post_id', [C,PA])
    }
    await db.query('insert into public.comments(id,author_id,post_id,body) values($1,$2,$3,$4)', [id(301),C,PA,'hello'])
    await db.query("update public.comments set body='edited' where id=$1", [id(301)])
    await denied(db.query("insert into public.notifications(recipient_id,actor_id,type) values($1,$2,'follow')", [A,B]))
  })
  let notifications = await rows('select type,recipient_id,actor_id from public.notifications where recipient_id=$1 and actor_id=$2 order by type', [A,C])
  assert.deepEqual(notifications.map(row => row.type), ['comment','follow','like'])
  assert.ok(notifications.every(row => row.recipient_id===A && row.actor_id===C))
  await owner(A, async () => {
    await db.query('insert into public.likes(profile_id,post_id) values($1,$2)', [A,PA])
    await db.query('insert into public.comments(id,author_id,post_id,body) values($1,$2,$3,$4)', [id(302),A,PA,'self'])
    assert.equal((await rows('select id from public.notifications where recipient_id=$1 and actor_id=$1', [A])).length, 0)
    await db.query('update public.notifications set read_at=now() where recipient_id=$1', [A])
    await denied(db.query('update public.notifications set actor_id=$1 where recipient_id=$2', [B,A]))
    // Post owner may moderate a comment; the comment notification cascades away.
    await db.query('delete from public.comments where id=$1', [id(301)])
  })
  await owner(C, async () => {
    assert.equal((await rows('select id from public.notifications where recipient_id=$1', [A])).length, 0)
    await db.query('delete from public.likes where profile_id=$1 and post_id=$2', [C,PA])
    await db.query('delete from public.follows where follower_id=$1 and following_id=$2', [C,A])
  })
  notifications = await rows('select id from public.notifications where recipient_id=$1 and actor_id=$2', [A,C])
  assert.equal(notifications.length,0)
})

test('profile-view RPC derives actor, deduplicates and only permits recipient read state changes', async () => {
  await owner(C, async () => {
    await db.query('select public.record_profile_view($1)',[A])
    await db.query('select public.record_profile_view($1)',[A])
    await db.query('select public.record_profile_view($1)',[C])
  })
  assert.equal(await scalar("select count(*)::int from public.notifications where type='profile_view' and recipient_id=$1 and actor_id=$2",[A,C]),1)
  assert.equal(await scalar("select count(*)::int from public.notifications where recipient_id=actor_id"),0)
  await anon(async () => await denied(db.query('select public.record_profile_view($1)',[A])))
  await owner(B, async () => assert.equal((await rows('update public.notifications set read_at=now() where recipient_id=$1 returning id',[A])).length,0))
})

test('comments, moderation and story records cannot be written as another user', async () => {
  await owner(C, async () => {
    await denied(db.query('insert into public.comments(post_id,author_id,body) values($1,$2,$3)', [PA,B,'spoof']))
    assert.equal((await rows("update public.comments set body='attack' where id=$1 returning id",[id(302)])).length,0)
    assert.equal((await rows('delete from public.comments where id=$1 returning id',[id(302)])).length,0)
    for (const [table, column, suffix] of [['hidden_posts','profile_id',''],['post_reports','reporter_id',",'spam'"]]) {
      const extra = table==='post_reports' ? ',reason' : ''
      await denied(db.query('insert into public.'+table+'('+column+',post_id'+extra+') values($1,$2'+suffix+')',[B,PA]))
      await db.query('insert into public.'+table+'('+column+',post_id'+extra+') values($1,$2'+suffix+')',[C,PA])
      await denied(db.query('update public.'+table+' set post_id=$1 where '+column+'=$2',[PB,C]))
    }
    await denied(db.query("insert into public.stories(author_id,media_type,media_path) values($1,'image',$2)",[B,'story-images/'+B+'/bad.jpg']))
    assert.equal((await rows("update public.stories set caption='bad' where id=$1 returning id",[STORY])).length,0)
    assert.equal((await rows('delete from public.stories where id=$1 returning id',[STORY])).length,0)
    await denied(db.query('insert into public.story_views(story_id,viewer_id) values($1,$2)',[STORY,B]))
    for(let i=0;i<2;i++) await db.query('insert into public.story_views(story_id,viewer_id) values($1,$2) on conflict(story_id,viewer_id) do update set story_id=excluded.story_id,viewer_id=excluded.viewer_id',[STORY,C])
    assert.equal(await scalar('select count(*)::int from public.story_views where story_id=$1',[STORY]),1)
  })
  await owner(B, async () => {
    assert.equal((await rows('select * from public.hidden_posts')).length,0)
    assert.equal((await rows('select * from public.post_reports')).length,0)
    assert.equal((await rows('select * from public.story_views')).length,0)
  })
  await owner(A, async () => assert.equal((await rows('select * from public.story_views where story_id=$1',[STORY])).length,1))
})

test('direct threads require mutual follows, keep immutable participants and retain history after unfollow', async () => {
  await owner(A, async () => {
    await denied(db.query('insert into public.direct_threads(id,profile_low_id,profile_high_id) values($1,$2,$3)',[id(401),A,B]))
    await db.query('insert into public.follows(follower_id,following_id) values($1,$2)',[A,B])
  })
  await owner(B, async () => await db.query('insert into public.follows(follower_id,following_id) values($1,$2)',[B,A]))
  await owner(C, async () => await denied(db.query('insert into public.direct_threads(profile_low_id,profile_high_id) values($1,$2)',[A,B])))
  await owner(A, async () => {
    await db.query('insert into public.direct_threads(id,profile_low_id,profile_high_id) values($1,$2,$3)',[id(401),A,B])
    await denied(db.query('update public.direct_threads set profile_high_id=$1 where id=$2',[C,id(401)]))
    await denied(db.query('update public.direct_threads set last_message_at=now() where id=$1',[id(401)]))
    await denied(db.query('insert into public.direct_messages(thread_id,sender_id,body) values($1,$2,$3)',[id(401),B,'spoof']))
    await db.query('insert into public.direct_messages(id,thread_id,sender_id,body) values($1,$2,$3,$4)',[id(501),id(401),A,'hello'])
  })
  await owner(C, async () => {
    assert.equal((await rows('select * from public.direct_threads')).length,0)
    assert.equal((await rows('select * from public.direct_messages')).length,0)
    await denied(db.query('insert into public.direct_messages(thread_id,sender_id,body) values($1,$2,$3)',[id(401),C,'intrusion']))
  })
  await owner(B, async () => {
    assert.equal((await rows('select * from public.direct_messages')).length,1)
    await denied(db.query("update public.direct_messages set body='edit' where id=$1",[id(501)]))
  })
  await owner(A, async () => {
    await db.query('delete from public.follows where follower_id=$1 and following_id=$2',[A,B])
    assert.equal((await rows('select * from public.direct_messages')).length,1)
    await denied(db.query('insert into public.direct_messages(thread_id,sender_id,body) values($1,$2,$3)',[id(401),A,'blocked after unfollow']))
  })
  assert.equal(await scalar('select count(*)::int from public.direct_messages'),1)
})

test('storage contract allows owner inserts/deletes, blocks overwrite and cross-owner paths', async () => {
  const path = 'images/'+A+'/unique.jpg'
  await owner(A, async () => {
    await db.query("insert into storage.objects(bucket_id,name,owner_id) values('media',$1,$2)",[path,A])
    for (const [name,claimedOwner] of [
      ['images/'+B+'/spoof.jpg',A], ['images/'+A+'/spoof.jpg',B],
      ['unrecognized/'+A+'/spoof.jpg',A], ['images/'+A+'/../spoof.jpg',A],
      ['images/'+A+'/.hidden',A], ['images/'+A+'/no-owner.jpg',null]
    ]) await denied(db.query("insert into storage.objects(bucket_id,name,owner_id) values('media',$1,$2)",[name,claimedOwner]))
    // Supabase upsert requires an UPDATE policy; no such policy is supplied.
    assert.equal((await rows("update storage.objects set name=$1 where name=$2 returning id",['images/'+A+'/replace.jpg',path])).length,0)
    await denied(db.query("insert into storage.objects(bucket_id,name,owner_id) values('media',$1,$2) on conflict(bucket_id,name) do update set owner_id=excluded.owner_id",[path,A]))
  })
  await owner(B, async () => {
    assert.equal((await rows('select * from storage.objects where name=$1',[path])).length,0)
    assert.equal((await rows('delete from storage.objects where name=$1 returning id',[path])).length,0)
  })
  await anon(async () => {
    assert.equal((await rows('select * from storage.objects')).length,0)
    await denied(db.query("insert into storage.objects(bucket_id,name,owner_id) values('media',$1,$2)",['images/'+A+'/anon.jpg',A]))
  })
  const bucket=(await rows("select public,file_size_limit,allowed_mime_types from storage.buckets where id='media'"))[0]
  assert.equal(bucket.public,true)
  assert.equal(bucket.file_size_limit,52428800)
  assert.ok(bucket.allowed_mime_types.includes('image/jpeg'))
  // Public URL serving is a Storage HTTP service concern, not SQL SELECT policy.
  await owner(A,async()=>assert.equal((await rows('delete from storage.objects where name=$1 returning id',[path])).length,1))
})

test('storage migration refuses an existing bucket or policy before changing it', async () => {
  const migration=await readFile(new URL('20261008000200_media_storage.sql',migrationsDirectory),'utf8')
  const candidate=await createTestDatabase({migrations:false})
  try {
    await candidate.exec("insert into storage.buckets(id,name,public) values('media','existing',false)")
    await assert.rejects(candidate.exec(migration),/Existing storage configuration/)
    await candidate.exec('rollback')
    assert.deepEqual((await candidate.query("select name,public from storage.buckets where id='media'")).rows,[{name:'existing',public:false}])
    assert.equal((await candidate.query("select count(*)::int as n from pg_policies where schemaname='storage'")).rows[0].n,0)
  } finally {await candidate.close()}
})

test('media record references allow owner paths/public links and reject other-owner raw paths', async () => {
  await owner(A, async () => {
    await denied(db.query('update public.posts set media_path=$1 where id=$2',['images/'+B+'/taken.jpg',PA]))
    await denied(db.query('update public.posts set thumbnail_path=$1 where id=$2',['thumbnails/'+B+'/taken.jpg',PA]))
    await denied(db.query('update public.stories set media_path=$1 where id=$2',['story-images/'+B+'/taken.jpg',STORY]))
    await denied(db.query('update public.profiles set avatar_url=$1 where id=$2',['avatars/'+B+'/taken.jpg',A]))
    for (const invalid of ['../outside.jpg','images/'+A+'/../bad.jpg','javascript:alert(1)','https:///no-host','https://example.test/white space.jpg']) {
      await denied(db.query('update public.posts set media_path=$1 where id=$2',[invalid,PA]))
    }
    const publicUrl='https://cdn.example.test/shared.jpg?token=public';
    assert.equal((await rows('update public.posts set media_path=$1 where id=$2 returning id',[publicUrl,PA])).length,1)
    assert.equal((await rows('update public.posts set media_path=$1,thumbnail_path=null where id=$2 returning id',['images/'+A+'/owned.jpg',PA])).length,1)
    assert.equal((await rows('update public.stories set media_path=$1 where id=$2 returning id',[publicUrl,STORY])).length,1)
    assert.equal((await rows('update public.profiles set avatar_url=$1 where id=$2 returning id',['avatars/'+A+'/avatar.webp',A])).length,1)
  })
})

test('profile provisioning preserves a valid 30-character requested username', async () => {
  const username='a'.repeat(30)
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id(990),'length@example.test',{username}])
  assert.equal((await rows('select username from public.profiles where id=$1',[id(990)]))[0].username,username)
})
