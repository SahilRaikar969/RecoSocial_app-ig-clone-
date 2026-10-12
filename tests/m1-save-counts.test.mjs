import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Execute the actual query modules with controlled Supabase responses. Database
// RLS itself is covered separately by the disposable PostgreSQL policy tests.
function loadQuery(file, client = {}, hidden = new Set()) {
  const source = readFileSync(resolve(root, 'lib/db/queries', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loadedModule = { exports: {} }
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/db/queries/post-moderation': { getHiddenPostIds: async () => hidden },
  }
  const requireDependency = (name) => {
    if (name === '@/lib/recommendations/engine') return loadQuery('../../recommendations/engine.ts')
    if (name === '@/lib/db/queries/public-content') return {} // Authenticated paths must never call the guest branch.
    if (name === '@/lib/recommendations/feed-contract') return loadQuery('../../recommendations/feed-contract.ts')
    if (name === '@/lib/db/normalize-relations') return loadQuery('../normalize-relations.ts')
    if (name === '@/lib/db/queries/save-counts') return loadQuery('save-counts.ts')
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }
  new Function('require', 'module', 'exports', outputText)(requireDependency, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

function clientFixture(respond, counts = {}) {
  const rpcCalls = []
  return {
    rpcCalls,
    async rpc(name, args) {
      assert.ok(['get_visible_post_save_counts', 'get_visible_post_engagement'].includes(name))
      assert.deepEqual(Object.keys(args), ['post_ids'])
      assert.ok(args.post_ids.length <= 1000)
      rpcCalls.push(args.post_ids)
      if(name==='get_visible_post_engagement'){const rows=respond({table:'posts'}).data;return {data:args.post_ids.map(id=>{const p=rows.find(p=>p.id===id);return {post_id:id,like_count:p.likes.length,save_count:counts[id]??0,comment_count:p.comments.length,liked_by_me:p.likes.some(l=>l.profile_id===viewer),saved_by_me:p.saves.some(s=>s.profile_id===viewer)}}),error:null}}
      return { data: args.post_ids.map((id) => ({ post_id: id, save_count: String(counts[id] ?? 0) })), error: null }
    },
    from(table) {
      const query = { table, filters: [], columns: '', options: {}, single: false }
      const chain = {
        select(columns, options = {}) { query.columns = columns; query.options = options; return chain },
        eq(key, value) { query.filters.push([key, value]); return chain },
        neq(key, value) { query.filters.push([`!${key}`, value]); return chain },
        gte() { return chain },
        lte() { return chain },
        in() { return chain },
        not() { return chain },
        order() { return chain },
        limit() { return chain },
        maybeSingle() { query.single = true; return chain },
        then(fulfill, reject) { return Promise.resolve(respond(query)).then(fulfill, reject) },
      }
      return chain
    },
  }
}

const viewer = 'viewer'
const category = (slug) => ({ category_id: slug, categories: { id: slug, name: slug, slug } })
function post(id, slug = 'cooking', ownSave = false) {
  return {
    id, author_id: `author-${id}`, caption: id, media_type: 'image',
    media_path: `${id}.jpg`, thumbnail_path: null, created_at: '2000-01-01T00:00:00Z',
    post_categories: [category(slug)], likes: [], saves: ownSave ? [{ profile_id: viewer }] : [], comments: [],
  }
}
const ok = (data, count = null) => ({ data, error: null, count })

test('aggregate helper skips empty input, deduplicates and chunks the RPC limit', async () => {
  const { getVisiblePostSaveCounts } = loadQuery('save-counts.ts')
  const client = clientFixture(() => ok([]), { p0: 9 })
  assert.equal((await getVisiblePostSaveCounts(client, [])).size, 0)
  assert.equal(client.rpcCalls.length, 0)
  const ids = Array.from({ length: 1001 }, (_, index) => `p${index}`)
  const counts = await getVisiblePostSaveCounts(client, [...ids, 'p0'])
  assert.deepEqual(client.rpcCalls.map((batch) => batch.length), [1000, 1])
  assert.equal(counts.size, 1001)
  assert.equal(counts.get('p0'), 9)
})

test('aggregate failures cannot silently replace global ranking counts with viewer-only counts', async () => {
  const { getVisiblePostSaveCounts } = loadQuery('save-counts.ts')
  await assert.rejects(getVisiblePostSaveCounts({ rpc: async () => ({ error: { message: 'unavailable' } }) }, ['p']), /unavailable/)
  for (const save_count of [-1, 'invalid', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(getVisiblePostSaveCounts({ rpc: async () => ok([{ post_id: 'p', save_count }]) }, ['p']), /Invalid post save count/)
  }
})

function rankingClient({ posts, counts = {}, liked = [], saved = [], preferences = [], follows = [] }) {
  return clientFixture(({ table }) => {
    if (table === 'posts') return ok(posts)
    if (table === 'likes') return ok(liked)
    if (table === 'saves') return ok(saved)
    if (table === 'profile_category_preferences') return ok(preferences)
    if (table === 'follows') return ok(follows)
    if (table === 'profiles' || table === 'comments') return ok([])
    throw new Error(`Unexpected table: ${table}`)
  }, counts)
}

for (const [file, fn, scoreKey, baseBoost, savedWeight, likedWeight, preferenceWeight, followWeight] of [
  ['feed.ts', 'getFeedData', 'feed_score', 3, 8*Math.log2(1+5/8), 8*Math.log2(1+3/8), 8, 10],
  ['explore.ts', 'getExploreData', 'explore_score', 0, 3, 2, 6, 3],
]) {
  test(`${file}: global save totals preserve engagement scores, tie ordering and own-save state`, async () => {
    const travel = post('travel', 'travel', true)
    travel.likes = [{ profile_id: 'other-a' }, { profile_id: 'other-b' }]
    const cooking = post('cooking')
    const client = rankingClient({ posts: [travel, cooking], counts: { travel: 3, cooking: 4 } })
    const { posts } = await loadQuery(file, client)[fn](viewer)
    assert.deepEqual(posts.map((row) => row.id), ['cooking', 'travel'])
    const engagement = file === 'feed.ts' ? 4*Math.log2(5) : 16
    assert.deepEqual(posts.map((row) => row[scoreKey]), [engagement + baseBoost, engagement + baseBoost])
    assert.deepEqual(posts.map((row) => row.save_count), [4, 3])
    assert.deepEqual(posts.map((row) => row.saved_by_me), [false, true])
    if (file === 'feed.ts') {
      assert.equal(posts[0].save_count, 4)
      assert.equal(posts[0].source_bucket, 'trending')
      assert.equal(posts[0].recommendation_bucket, undefined)
    }
  })

  test(`${file}: likes, saves and preference rows still change later category ranking`, async () => {
    const candidates = [post('travel', 'travel'), post('cooking')]
    const priorInteraction = { post_id: 'older-cooking', created_at:new Date().toISOString(), posts: { author_id:'older-creator', post_categories: [category('cooking')] } }
    for (const [signal, weight] of [['liked', likedWeight], ['saved', savedWeight], ['preferences', preferenceWeight]]) {
      const input = { posts: candidates, [signal]: signal === 'preferences' ? [category('cooking')] : [priorInteraction] }
      const { posts } = await loadQuery(file, rankingClient(input))[fn](viewer)
      assert.equal(posts[0].id, 'cooking')
      assert.ok(Math.abs(posts[0][scoreKey] - (baseBoost + weight)) < 0.0001)
      assert.equal(posts[1][scoreKey], baseBoost)
    }
    const { posts: resetPosts } = await loadQuery(file, rankingClient({ posts: candidates }))[fn](viewer)
    assert.deepEqual(resetPosts.map((row) => row[scoreKey]), [baseBoost, baseBoost])
  })

  test(`${file}: follow weights and hard hidden exclusion remain correct`, async () => {
    const client = rankingClient({ posts: [post('cooking'), post('travel', 'travel')], follows: [{ following_id: 'author-travel' }] })
    const result = await loadQuery(file, client, new Set(['cooking']))[fn](viewer)
    assert.deepEqual(result.posts.map((row) => row.id), ['travel'])
    assert.equal(result.posts[0][scoreKey], followWeight)
    if (file === 'feed.ts') assert.equal(result.posts[0].source_bucket, 'following')
  })
}

for (const [file, fn, table] of [
  ['saved.ts', 'getSavedPosts', 'saves'],
  ['liked.ts', 'getLikedPosts', 'likes'],
  ['public-liked.ts', 'getPublicLikedPosts', 'likes'],
  ['hidden.ts', 'getHiddenPosts', 'hidden_posts'],
  ['reported.ts', 'getReportedPosts', 'post_reports'],
]) {
  test(`${file}: total save count stays separate from the viewer's private save row`, async () => {
    const client = clientFixture(({ table: requested }) => {
      if (requested === table) return ok([{ post_id: 'p', posts: post('p', 'cooking', true) }])
      if (requested === 'profiles') return ok([])
      throw new Error(`Unexpected table: ${requested}`)
    }, { p: 7 })
    const rows = await loadQuery(file, client)[fn](viewer, 'other')
    assert.equal(rows[0].save_count, 7)
    assert.equal(rows[0].saved_by_me, true)
    assert.deepEqual(rows[0].saves, [{ profile_id: viewer }])
  })
}

test('profile posts retain global save counts under owner-only saves RLS', async () => {
  const client = clientFixture(({ table, single }) => {
    if (table === 'posts') return ok([post('p')])
    if (table === 'profiles') return single ? ok({ id: viewer }) : ok([])
    if (table === 'saves' || table === 'follows') return ok([], 0)
    throw new Error(`Unexpected table: ${table}`)
  }, { p: 11 })
  const result = await loadQuery('profile.ts', client).getProfilePageData(viewer, viewer)
  assert.equal(result.posts[0].save_count, 11)
  assert.equal(result.posts[0].saved_by_me, false)
})

test('post detail and related ranking both consume global counts without saver identities', async () => {
  const client = clientFixture(({ table, single, columns }) => {
    if (table === 'posts') {
      if (single) return ok(post('current'))
      if (columns === 'id') return ok([{ id: 'current' }])
      return ok([post('related-a'), post('related-b', 'cooking', true)])
    }
    if (table === 'profiles' || table === 'follows') return ok([])
    throw new Error(`Unexpected table: ${table}`)
  }, { current: 9, 'related-a': 2, 'related-b': 5 })
  const result = await loadQuery('post.ts', client).getPostPageData(viewer, 'current')
  assert.equal(result.save_count, 9)
  assert.equal(result.saved_by_me, false)
  assert.deepEqual(result.related_posts.map((row) => row.id), ['related-b', 'related-a'])
  assert.deepEqual(result.related_posts.map((row) => row.related_score), [27, 15])
  assert.deepEqual(result.related_posts.map((row) => row.saved_by_me), [true, false])
})

function loadReelPage(client) {
  const source = readFileSync(resolve(root, 'app/reel/[postId]/page.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const loadedModule = { exports: {} }
  function loadReels() {
    const source = readFileSync(resolve(root, 'lib/db/queries/reels.ts'), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })
    const loaded = { exports: {} }
    new Function('require', 'module', 'exports', outputText)((name) => {
      if (name === '@/lib/db/queries/feed') return loadQuery('feed.ts', client)
      if (name === '@/lib/db/queries/explore') return loadQuery('explore.ts', client)
      if (name === '@/lib/db/queries/post-moderation') return { getHiddenPostIds: async () => new Set() }
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    }, loaded, loaded.exports)
    return loaded.exports
  }
  const dependencies = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'next/navigation': { notFound: () => { throw new Error('not-found') } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/db/queries/save-counts': loadQuery('save-counts.ts'),
    '@/lib/media/get-media-url': { getMediaUrl: async (path) => path },
    '@/lib/auth/session': { requireSession: async () => ({ profileId: viewer }), getOptionalSession: async () => ({ profileId: viewer }) },
    '@/components/reels/reel-viewer': { ReelViewer: 'ReelViewer' },
  }
  new Function('require', 'module', 'exports', outputText)((name) => {
    if (name === '@/lib/db/queries/reels') return loadReels()
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, loadedModule, loadedModule.exports)
  return loadedModule.exports.default
}

test('active reel page keeps current-first ordering and aggregate counts with private viewer saves', async () => {
  const client = clientFixture(({ table, single, filters }) => {
    if (table === 'posts') return ok(single ? { ...post('current'), media_type: 'video' } :
      ['related', 'current'].map((id) => ({ ...post(id), media_type: 'video' })))
    if (table === 'saves') {
      assert.ok(filters.some(([key, value]) => key === 'profile_id' && value === viewer), 'Save identities must only be requested for the viewer')
      return ok([{ post_id: 'related' }])
    }
    if (table === 'profiles' || table === 'likes' || table === 'comments') return ok([])
    throw new Error(`Unexpected table: ${table}`)
  }, { current: 9, related: 4 })
  const result = await loadReelPage(client)({ params: Promise.resolve({ postId: 'current' }) })
  assert.equal(result.type, 'ReelViewer')
  assert.deepEqual(result.props.reels.map((row) => row.id), ['current', 'related'])
  assert.deepEqual(result.props.reels.map((row) => row.save_count), [9, 4])
  assert.deepEqual(result.props.reels.map((row) => row.saved_by_me), [false, true])
  assert.equal(result.props.initialPostId, 'current')
  assert.equal(result.props.backHref, '/feed')
})

test('active reel page propagates aggregate RPC errors instead of silently reporting viewer-only totals', async () => {
  const client = clientFixture(({ table, single }) => {
    if (table === 'posts') return ok(single ? { ...post('current'), media_type: 'video' } : [])
    return ok([])
  })
  client.rpc = async () => ({ error: { message: 'aggregate unavailable' } })
  await assert.rejects(loadReelPage(client)({ params: Promise.resolve({ postId: 'current' }) }), /aggregate unavailable/)
})