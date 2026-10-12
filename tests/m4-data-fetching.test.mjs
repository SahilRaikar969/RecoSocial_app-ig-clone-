import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import { asRole, createTestDatabase } from '../supabase/tests/database.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const post = (id = 'post', author_id = 'viewer') => ({
  id, author_id, caption: 'Fixture post', media_type: 'image', media_path: `${author_id}/${id}.jpg`,
  thumbnail_path: null, created_at: '2026-10-09T00:00:00Z', post_categories: [],
  likes: [], saves: [], comments: [], like_count: 0, save_count: 0, comment_count: 0,
})
function fixture({ viewer = 'viewer', failTable, hidden = [], reports = [] } = {}) {
  const calls = [], media = []
  const profile = { id: viewer, username: viewer, display_name: viewer, avatar_url: null }
  const client = {
    async rpc(name, args) {
      calls.push({ table: 'rpc', name })
      return { data: name === 'record_profile_view' ? null : args.post_ids.map(post_id => ({ post_id, save_count: 3 })), error: null }
    },
    from(table) {
      const query = { table, columns: '', options: {}, filters: [], single: false }
      const chain = {
        select(columns, options = {}) { query.columns = columns; query.options = options; return chain },
        eq(key, value) { query.filters.push(['eq', key, value]); return chain },
        in(key, value) { query.filters.push(['in', key, value]); return chain },
        order() { return chain },
        maybeSingle() { query.single = true; return chain },
        then(fulfill, reject) {
          calls.push(query)
          if (table === failTable) return Promise.resolve({ data: null, error: { message: 'fixture failure' } }).then(fulfill, reject)
          const target = query.filters.find(([, key]) => key === 'id')?.[2] ?? viewer
          let data = table === 'profiles' ? query.single ? { ...profile, id: target } : [profile]
            : table === 'posts' ? [post('own', viewer)]
            : ['saves', 'likes', 'hidden_posts', 'post_reports'].includes(table)
              ? [{ post_id: `${table}-post`, posts: post(`${table}-post`, 'creator') }]
              : []
          if (query.columns === 'post_id') {
            const source = table === 'hidden_posts' ? hidden : reports
            const owner = table === 'hidden_posts' ? 'profile_id' : 'reporter_id'
            const scopedViewer = query.filters.find(([, key]) => key === owner)?.[2]
            const ids = query.filters.find(([op, key]) => op === 'in' && key === 'post_id')?.[2]
            data = source.filter(row => row[owner] === scopedViewer && (!ids || ids.includes(row.post_id)))
          }
          if (query.single && table !== 'profiles') data = null
          return Promise.resolve({ data: query.options.head ? null : data, count: 1, error: null }).then(fulfill, reject)
        },
      }
      return chain
    },
  }
  return { calls, media, client, viewer }
}
function load(file, context) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const loaded = { exports: {} }
  const jsx = (type, props) => ({ type, props })
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
    if (name === 'next/link') return { default: 'Link' }
    if (name === 'next/navigation') return { redirect: path => { throw new Error(`redirect:${path}`) } }
    if (name === '@/lib/auth/get-dev-session') return { getDevSession: async () => ({ profileId: context.viewer }), getOptionalSession: async () => ({ profileId: context.viewer }) }
    if (name === '@/lib/supabase/server') return { createClient: async () => context.client }
    if (name === '@/lib/media/get-media-url') return { getMediaUrl: async value => { context.media.push(value); return value } }
    if (name === '@/actions/post-moderation') return { unhidePost() {} }
    if (name.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => String(key) })
    if (name.startsWith('@/lib/')) return load(`${name.slice(2)}.ts`, context)
    throw new Error(`Unexpected fixture dependency: ${name}`)
  }, loaded, loaded.exports)
  return loaded.exports
}
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => find(child, type))
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)]
}

test('24 feed cards batch moderation into 2 requests (measured M3 baseline: 48)', async () => {
  const context = fixture()
  const rows = Array.from({ length: 24 }, (_, i) => post(`p${i}`, 'creator'))
  const tree = await load('components/feed/feed-list.tsx', context).FeedList({ posts: rows, devProfileId: 'viewer' })
  const cards = find(tree, 'PostCard')
  assert.deepEqual(cards.map(card => card.props.post.id), rows.map(row => row.id))
  await Promise.all(cards.map(card => load('components/feed/post-card.tsx', context).PostCard(card.props)))
  assert.equal(context.calls.length, 2)
  for (const query of context.calls) assert.equal(query.filters.find(([op]) => op === 'in')[2].length, 24)
})

test('Following batch includes only rendered non-owned posts and never changes order', async () => {
  const context = fixture()
  const rows = [post('b', 'creator'), post('a', 'creator'), post('own'), post('unfollowed', 'other')]
  rows.slice(0, 3).forEach(row => { row.source_bucket = 'following' })
  const tree = await load('components/feed/feed-list.tsx', context).FeedList({ posts: rows, devProfileId: 'viewer', feedView: 'following' })
  assert.deepEqual(find(tree, 'PostCard').map(card => card.props.post.id), ['b', 'a', 'own'])
  assert.deepEqual(context.calls[0].filters.find(([op]) => op === 'in')[2], ['b', 'a'])
})

test('moderation batch stays viewer-scoped, deduplicates IDs, and exposes no cross-viewer flags', async () => {
  const context = fixture({ hidden: [{ profile_id: 'viewer', post_id: 'p' }], reports: [{ reporter_id: 'other', post_id: 'p' }] })
  const query = load('lib/db/queries/post-moderation.ts', context).getViewerPostModerationStates
  assert.deepEqual((await query('viewer', ['p', 'p'])).get('p'), { hiddenByViewer: true, reportedByViewer: false })
  assert.deepEqual((await query('other', ['p'])).get('p'), { hiddenByViewer: false, reportedByViewer: true })
  assert.deepEqual(context.calls[0].filters, [['eq', 'profile_id', 'viewer'], ['in', 'post_id', ['p']]])
  assert.deepEqual(context.calls[1].filters, [['eq', 'reporter_id', 'viewer'], ['in', 'post_id', ['p']]])
})

test('moderation skips empty batches, bounds large batches, and propagates read failures', async () => {
  const context = fixture()
  const query = load('lib/db/queries/post-moderation.ts', context).getViewerPostModerationStates
  assert.equal((await query('viewer', [])).size, 0)
  assert.equal(context.calls.length, 0)
  assert.equal((await query('viewer', Array.from({ length: 201 }, (_, i) => `p${i}`))).size, 201)
  assert.equal(context.calls.length, 4)
  assert.deepEqual(context.calls.map(call => call.filters.find(([op]) => op === 'in')[2].length), [200, 200, 1, 1])
  const failed = fixture({ failTable: 'post_reports' })
  await assert.rejects(load('lib/db/queries/post-moderation.ts', failed).getViewerPostModerationStates('viewer', ['p']), /fixture failure/)
})

test('hidden grid passes actual batched flags into cards without per-card reads', async () => {
  const context = fixture({ hidden: [{ profile_id: 'viewer', post_id: 'p' }] })
  const tree = await load('components/profile/hidden-post-grid.tsx', context).HiddenPostGrid({ posts: [post('p', 'creator')], devProfileId: 'viewer', returnTo: '/profile?tab=hidden' })
  const [card] = find(tree, 'PostCard')
  assert.equal(card.props.moderationState.hiddenByViewer, true)
  await load('components/feed/post-card.tsx', context).PostCard(card.props)
  assert.equal(context.calls.length, 2)
})

for (const activeTab of ['posts', 'saved', 'liked', 'hidden', 'reported']) {
  test(`self profile ${activeTab} only reads active collection/media and preserves badges`, async () => {
    const context = fixture()
    const tree = await load('app/profile/page.tsx', context).default({ searchParams: Promise.resolve({ tab: activeTab }) })
    const fullCollections = context.calls.filter(query => ['saves', 'likes', 'hidden_posts', 'post_reports'].includes(query.table) && !query.options.head)
    assert.equal(fullCollections.length, activeTab === 'posts' ? 0 : 1)
    const expectedTable = { saved: 'saves', liked: 'likes', hidden: 'hidden_posts', reported: 'post_reports' }[activeTab]
    if (expectedTable) assert.equal(fullCollections[0].table, expectedTable)
    assert.equal(context.calls.length, activeTab === 'posts' ? 11 : 13)
    // M3 baseline for this populated fixture was 19 queries and 4 full inactive reads.
    assert.deepEqual(find(tree, 'ProfileSurfaceTabs')[0].props.tabs.map(tab => tab.count), [1, 1, 1, 1, 1])
    const mediaPaths = context.media.filter(Boolean)
    assert.deepEqual(mediaPaths, [activeTab === 'posts' ? 'viewer/own.jpg' : `creator/${expectedTable}-post.jpg`])
  })
}

for (const activeTab of ['posts', 'liked']) {
  test(`public profile ${activeTab} loads only the active media collection`, async () => {
    const context = fixture()
    const tree = await load('app/profile/[profileId]/page.tsx', context).default({ params: Promise.resolve({ profileId: 'creator' }), searchParams: Promise.resolve({ tab: activeTab }) })
    const fullLikes = context.calls.filter(query => query.table === 'likes' && !query.options.head)
    assert.equal(fullLikes.length, activeTab === 'liked' ? 1 : 0)
    assert.equal(context.calls.length, activeTab === 'liked' ? 13 : 11)
    assert.deepEqual(find(tree, 'ProfileSurfaceTabs')[0].props.tabs.map(tab => tab.count), [1, 1])
    assert.deepEqual(context.media.filter(Boolean), [activeTab === 'liked' ? 'creator/likes-post.jpg' : 'viewer/own.jpg'])
  })
}

for (const [collection, table, owner] of [['saved', 'saves', 'profile_id'], ['liked', 'likes', 'profile_id'], ['hidden', 'hidden_posts', 'profile_id'], ['reported', 'post_reports', 'reporter_id']]) {
  test(`${collection} badge count uses scoped head-only inner post visibility join`, async () => {
    const context = fixture()
    assert.equal(await load('lib/db/queries/profile-collection-counts.ts', context).getProfileCollectionCount('viewer', collection), 1)
    assert.deepEqual(context.calls, [{ table, columns: 'post_id, posts!inner(id)', options: { count: 'exact', head: true }, filters: [['eq', owner, 'viewer']], single: false }])
    const failed = fixture({ failTable: table })
    await assert.rejects(load('lib/db/queries/profile-collection-counts.ts', failed).getProfileCollectionCount('viewer', collection), /fixture failure/)
  })
}

// Execute the inner-join visibility semantics against the actual local RLS.
// PostgREST HTTP serialization itself remains a manual hosted integration check.
test('collection count joins preserve owner privacy and post visibility under actual RLS', async () => {
  const db = await createTestDatabase()
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
  const viewer = id(1), creator = id(2), stranger = id(3)
  const publicPost = id(101), creatorDraft = id(102), ownerDraft = id(103)
  try {
    for (const [profileId, username] of [[viewer, 'viewer'], [creator, 'creator'], [stranger, 'stranger']]) {
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [profileId, username + '@example.test', { username }])
    }
    for (const [postId, authorId, status] of [[publicPost, creator, 'published'], [creatorDraft, creator, 'draft'], [ownerDraft, viewer, 'draft']]) {
      await db.query("insert into public.posts(id,author_id,media_type,media_path,status) values($1,$2,'image',$3,$4)", [postId, authorId, 'images/' + authorId + '/' + postId + '.jpg', status])
    }
    // Administrative seeding models an existing interaction whose post is now a draft.
    for (const table of ['saves', 'likes', 'hidden_posts', 'post_reports']) {
      const owner = table === 'post_reports' ? 'reporter_id' : 'profile_id'
      for (const postId of [publicPost, creatorDraft, ownerDraft]) {
        const extraColumns = table === 'post_reports' ? ',reason' : ''
        const extraValues = table === 'post_reports' ? ",'other'" : ''
        await db.query('insert into public.' + table + '(' + owner + ',post_id' + extraColumns + ') values($1,$2' + extraValues + ')', [viewer, postId])
      }
      const count = async profileId => (await db.query('select count(*)::int as count from public.' + table + ' c inner join public.posts p on p.id=c.post_id where c.' + owner + '=$1', [profileId])).rows[0].count
      await asRole(db, 'authenticated', viewer, async () => assert.equal(await count(viewer), 2))
      await asRole(db, 'authenticated', stranger, async () => assert.equal(await count(viewer), table === 'likes' ? 1 : 0))
      await asRole(db, 'authenticated', creator, async () => assert.equal(await count(viewer), table === 'likes' ? 2 : 0))
    }
    await db.query('delete from public.posts where id=$1', [publicPost])
    await asRole(db, 'authenticated', viewer, async () => {
      const result = await db.query('select count(*)::int as count from public.saves c inner join public.posts p on p.id=c.post_id where c.profile_id=$1', [viewer])
      assert.equal(result.rows[0].count, 1)
    })
  } finally { await db.close() }
})
