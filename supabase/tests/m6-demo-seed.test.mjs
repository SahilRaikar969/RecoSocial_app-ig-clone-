import test from 'node:test'
import assert from 'node:assert/strict'
import { createTestDatabase, asRole } from './database.mjs'
import { createDemoDataset } from '../../scripts/demo/dataset.mjs'
import { buildSeedSql, buildResetSql } from '../../scripts/demo/sql.mjs'

const dataset = createDemoDataset()
const seed = buildSeedSql(dataset)
const reset = buildResetSql()
const unrelated = 'a0000000-0000-4000-8000-000000000001'
const unrelatedPost = 'b0000000-0000-4000-8000-000000000001'

async function database() {
  const db = await createTestDatabase()
  // Extra GoTrue column contracts for seeding only. This is not an Auth server.
  await db.exec(`alter table auth.users add column raw_app_meta_data jsonb not null default '{}';
    alter table auth.users add column banned_until timestamptz;
    alter table auth.users add column encrypted_password text;
    set recosocial.demo_mode='local';`)
  return db
}
async function rejected(db, sql, pattern) {
  await assert.rejects(db.exec(sql), pattern)
  await db.exec('rollback')
}
async function counts(db) {
  const result = {}
  for (const name of ['profiles', 'posts', 'categories', 'post_categories', 'follows', 'likes', 'saves', 'comments', 'profile_category_preferences', 'notifications']) {
    result[name] = Number((await db.query(`select count(*) as n from public.${name}`)).rows[0].n)
  }
  return result
}

test('real migrations accept the full corpus, triggers and idempotent transaction; role isolation is preserved', async () => {
  const db = await database()
  try {
    await db.exec(seed)
    const first = await counts(db)
    assert.deepEqual(first, { profiles: 30, posts: 300, categories: 18, post_categories: 300, follows: 33, likes: 808,
      saves: 139, comments: 86, profile_category_preferences: 33, notifications: 927 })
    await db.exec(seed)
    assert.deepEqual(await counts(db), first)
    const ownership = await db.query("select count(*) as n from auth.users where raw_app_meta_data->>'recosocial_demo'='recosocial-demo-v1' and banned_until='9999-12-31T23:59:59Z' and encrypted_password is null")
    assert.equal(Number(ownership.rows[0].n), 30)
    assert.equal(Number((await db.query("select count(*) n from public.profiles where username like 'demo_%' and bio like 'Generated demo account%'")).rows[0].n), 30)
    await asRole(db, 'anon', null, async () => {
      assert.equal(Number((await db.query('select count(*) n from public.posts')).rows[0].n), 300)
      await assert.rejects(db.query('select * from public.saves'), /permission denied/)
      await assert.rejects(db.query('select * from recosocial_demo.runs'), /permission denied/)
    })
    await asRole(db, 'authenticated', dataset.personas.fitness, async () => {
      assert.equal(Number((await db.query('select count(*) n from public.saves')).rows[0].n), 3)
      await assert.rejects(db.query('select * from recosocial_demo.runs'), /permission denied/)
      await assert.rejects(db.query('insert into public.likes(profile_id,post_id) values($1,$2)', [dataset.personas.travel, dataset.posts[0].id]), /row-level security/)
      const aggregate = await db.query('select * from public.get_visible_post_engagement($1::uuid[])', [[dataset.posts[0].id]])
      assert.equal(aggregate.rows.length, 1)
      assert.equal(Object.keys(aggregate.rows[0]).some(key => key.includes('profile')), false)
    })
    await db.exec('set role service_role')
    await assert.rejects(db.query('select * from recosocial_demo.runs'), /permission denied/)
    await db.exec('reset role')
    await rejected(db, buildSeedSql(createDemoDataset({ anchor: '2026-10-13T12:00:00Z' })), /parameters changed/)
    assert.deepEqual(await counts(db), first)
    // Same-seed reruns preserve manual removal; reset/reseed restores the graph.
    await db.query('delete from public.saves where profile_id=$1', [dataset.personas.fitness])
    await db.exec(seed)
    assert.equal((await counts(db)).saves, 136)
    await db.exec(reset)
    await db.exec(seed)
    assert.deepEqual(await counts(db), first)
  } finally { await db.close() }
})

test('selective reset preserves unrelated accounts, content and referenced new categories', async () => {
  const db = await database()
  try {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'local-test@invalid.test','{\"username\":\"unrelated\"}')", [unrelated])
    await db.query("insert into public.posts(id,author_id,media_type,media_path) values($1,$2,'image','http://127.0.0.1/fixture.svg')", [unrelatedPost, unrelated])
    await db.exec(seed)
    const gaming = (await db.query("select id from public.categories where slug='gaming'")).rows[0].id
    await db.query('insert into public.post_categories(post_id,category_id) values($1,$2)', [unrelatedPost, gaming])
    // Real-user activity on demo content is necessarily removed with that content.
    await db.query('insert into public.likes(profile_id,post_id) values($1,$2)', [unrelated, dataset.posts[0].id])
    await db.exec(reset)
    const after = await counts(db)
    assert.equal(after.profiles, 1)
    assert.equal(after.posts, 1)
    assert.equal(after.categories, 17)
    assert.equal(after.likes, 0)
    assert.equal(after.post_categories, 1)
    assert.equal(after.notifications, 0)
    assert.equal((await db.query('select id from auth.users')).rows[0].id, unrelated)
    await db.exec(reset)
    assert.deepEqual(await counts(db), after)
    await db.exec(seed)
    assert.equal((await counts(db)).posts, 301)
    await db.exec(reset)
    assert.deepEqual(await counts(db), after)
  } finally { await db.close() }
})

test('identity and category collisions roll back all seed changes without taking over existing data', async () => {
  const db = await database()
  try {
    await db.query('insert into auth.users(id,email) values($1,$2)', [unrelated, dataset.users[0].email])
    const before = await counts(db)
    await rejected(db, seed, /identity collision/)
    assert.deepEqual(await counts(db), before)
    assert.equal((await db.query("select to_regclass('recosocial_demo.runs') as name")).rows[0].name, null)
    await db.query('delete from auth.users where id=$1', [unrelated])
    await db.query("insert into public.categories(id,slug,name) values($1,'foreign-topic','Foreign topic')", [dataset.categories[0].id])
    await rejected(db, seed, /category collision/)
    assert.equal((await counts(db)).profiles, 0)
    assert.equal((await counts(db)).posts, 0)
  } finally { await db.close() }
})

test('reset refuses changed identity ownership and leaves the ecosystem intact', async () => {
  const db = await database()
  try {
    await db.exec(seed)
    await db.query("update auth.users set raw_app_meta_data='{}' where id=$1", [dataset.users[0].id])
    await rejected(db, reset, /ownership changed/)
    assert.equal((await counts(db)).posts, 300)
    await rejected(db, seed, /ownership changed/)
  } finally { await db.close() }
})

test('missing SQL session guard rejects before creating registry or demo rows', async () => {
  const db = await database()
  try {
    await db.exec("set recosocial.demo_mode='' ")
    await rejected(db, seed, /explicit local session guard/)
    await rejected(db, reset, /explicit local session guard/)
    assert.equal((await counts(db)).profiles, 0)
    assert.equal((await db.query("select to_regclass('recosocial_demo.runs') as name")).rows[0].name, null)
  } finally { await db.close() }
})
