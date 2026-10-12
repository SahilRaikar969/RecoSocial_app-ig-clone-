import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function load(file, client) {
  const source = readFileSync(resolve(root, 'lib/db/queries', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const loaded = { exports: {} }
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/media/get-media-url': { getMediaUrl: async value => value },
    '@/lib/db/queries/post-moderation': { getHiddenPostIds: async () => new Set() },
    '@/lib/db/queries/save-counts': file === 'save-counts.ts' ? {} : load('save-counts.ts', client),
  }
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name === '@/lib/db/normalize-relations') return load('../normalize-relations.ts', client)
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
    return dependencies[name]
  }, loaded, loaded.exports)
  return loaded.exports
}
const ok = (data, count = null) => ({ data, count, error: null })
function clientFixture(respond, rpc = async () => ok([])) {
  const calls = []
  return {
    calls,
    rpc,
    from(table) {
      const query = { table, filters: [], operation: 'read', payload: null }
      const chain = {
        select() { return chain },
        eq(key, value) { query.filters.push([key, value]); return chain },
        insert(payload) { query.operation = 'insert'; query.payload = payload; return chain },
        in() { return chain },
        or() { return chain },
        ilike() { return chain },
        order() { return chain },
        limit() { return chain },
        maybeSingle() { return chain },
        single() { return chain },
        then(fulfill, reject) { calls.push(query); return Promise.resolve().then(() => respond(query)).then(fulfill, reject) },
      }
      return chain
    },
  }
}

test('same-pair DM create race re-reads only the canonical pair after 23505', async () => {
  let threadReads = 0
  const expected = { id: 'thread', profile_low_id: 'a', profile_high_id: 'b' }
  const client = clientFixture(query => {
    if (query.table === 'follows') return ok(null, 1)
    assert.equal(query.table, 'direct_threads')
    if (query.operation === 'insert') {
      assert.deepEqual(query.payload, { profile_low_id: 'a', profile_high_id: 'b' })
      return { error: { code: '23505', message: 'duplicate' } }
    }
    assert.deepEqual(query.filters, [['profile_low_id', 'a'], ['profile_high_id', 'b']])
    return ok(++threadReads === 1 ? null : expected)
  })
  assert.deepEqual(await load('messages.ts', client).getOrCreateDirectThread('b', 'a'), expected)
  assert.equal(threadReads, 2)
})

test('DM unique conflict without a visible matching pair is still a failure', async () => {
  const client = clientFixture(query => query.table === 'follows' ? ok(null, 1)
    : query.operation === 'insert' ? { error: { code: '23505', message: 'duplicate' } } : ok(null))
  await assert.rejects(load('messages.ts', client).getOrCreateDirectThread('a', 'b'), /duplicate/)
})

test('DM create does not treat unrelated database failures as an idempotent success', async () => {
  const client = clientFixture(query => query.table === 'follows' ? ok(null, 1)
    : query.operation === 'insert' ? { error: { code: '42501', message: 'denied' } } : ok(null))
  await assert.rejects(load('messages.ts', client).getOrCreateDirectThread('a', 'b'), /denied/)
  assert.equal(client.calls.filter(query => query.table === 'direct_threads').length, 2)
})

test('DM non-mutual followers never create a thread', async () => {
  const client = clientFixture(() => ok(null, 0))
  assert.equal(await load('messages.ts', client).getOrCreateDirectThread('a', 'b'), null)
  assert.equal(client.calls.some(query => query.table === 'direct_threads'), false)
})

function searchFixture(rpc) {
  const post = (id, saves) => ({ id, author_id: 'creator', caption: 'topic', media_type: 'image',
    media_path: `${id}.jpg`, thumbnail_path: null, created_at: '2026-01-01T00:00:00Z',
    likes: [], comments: [], saves })
  return clientFixture(query => {
    if (query.table === 'posts') return ok([post('popular', []), post('mine', [{ profile_id: 'viewer' }])])
    return ok([])
  }, rpc)
}

test('search uses private-safe global save totals with the existing score coefficient', async () => {
  const client = searchFixture(async (name, args) => {
    assert.equal(name, 'get_visible_post_save_counts')
    assert.deepEqual(args, { post_ids: ['popular', 'mine'] })
    return ok([{ post_id: 'popular', save_count: 10 }, { post_id: 'mine', save_count: 1 }])
  })
  const result = await load('search.ts', client).getSearchData('viewer', 'topic')
  assert.deepEqual(result.posts.map(post => post.id), ['popular', 'mine'])
  assert.deepEqual(result.posts.map(post => post.save_count), [10, 1])
  assert.equal(result.posts[0].score - result.posts[1].score, 9 * 4)
  assert.equal('saves' in result.posts[0], false)
})

test('search fails visibly when aggregate totals fail instead of using private row counts', async () => {
  const client = searchFixture(async () => ({ error: { message: 'counts unavailable' } }))
  await assert.rejects(load('search.ts', client).getSearchData('viewer', 'topic'), /counts unavailable/)
})

test('edit contracts preserve the concurrency token and normalize a nullable caption', async () => {
  const client = clientFixture(() => ok({ id: 'p', author_id: 'viewer', caption: null,
    media_type: 'image', updated_at: '2026-01-01T00:00:00Z', post_categories: [] }))
  const result = await load('post-edit.ts', client).getEditablePost('p', 'viewer')
  assert.equal(result.post.caption, '')
  assert.equal(result.post.updated_at, '2026-01-01T00:00:00Z')
  assert.equal((await load('post-edit.ts', client).getEditablePost('p', 'stranger')).unauthorized, true)
})