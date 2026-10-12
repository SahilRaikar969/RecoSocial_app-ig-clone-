import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function loadTs(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  })
  const compiledModule = { exports: {} }
  runInNewContext(outputText, {
    module: compiledModule, exports: compiledModule.exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      throw new Error(`Unexpected dependency: ${name}`)
    },
    URL, URLSearchParams, FormData,
  }, { filename })
  return compiledModule.exports
}
const routes = loadTs('lib/routes/safe-return-path.ts')
class Redirect extends Error {
  constructor(url) { super(url); this.url = url }
}
const navigation = { redirect(url) { throw new Redirect(url) } }
const form = (values) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}
const expectRedirect = (action, expected) => assert.rejects(action, (error) => {
  assert.ok(error instanceof Redirect)
  assert.equal(error.url, expected)
  return true
})

function fixture(path, answer = () => ({ data: null, error: null }), extras = {}) {
  const calls = []
  const invalidated = []
  const client = { from(table) {
    const call = { table, method: 'select', payload: null, options: null, filters: [] }
    const query = {
      select() { return this },
      insert(payload) { call.method = 'insert'; call.payload = payload; return this },
      upsert(payload, options) { call.method = 'upsert'; call.payload = payload; call.options = options; return this },
      update(payload) { call.method = 'update'; call.payload = payload; return this },
      delete() { call.method = 'delete'; return this },
      eq(key, value) { call.filters.push([key, value]); return this },
      is(key, value) { call.filters.push([key, value]); return this },
      single() { return this },
      maybeSingle() { return this },
      then(resolve, reject) {
        calls.push(call)
        return Promise.resolve().then(() => answer(call)).then(resolve, reject)
      },
    }
    return query
  } }
  const actions = loadTs(path, {
    'next/navigation': navigation,
    'next/cache': { revalidatePath(path) { invalidated.push(path) } },
    '@/lib/routes/safe-return-path': routes,
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/auth/get-dev-session': { getDevSession: async () => ({ profileId: 'actor' }) },
    ...extras,
  })
  return { actions, calls, invalidated }
}

for (const [table, fn, field, input] of [
  ['likes', 'toggleLikeInline', 'liked', { postId: 'post', devProfileId: 'forged' }],
  ['saves', 'toggleSaveInline', 'saved', { postId: 'post', devProfileId: 'forged' }],
  ['follows', 'toggleFollowInline', 'followedByMe', { followingId: 'other', followerId: 'forged' }],
]) {
  test(`${table} repeat desired-state writes are owner-scoped DO NOTHING upserts`, async () => {
    const rows = new Set()
    let actualInserts = 0
    const f = fixture(`actions/${table}.ts`, (call) => {
      if (call.method === 'select') return { data: { id: 'target', author_id: 'other' }, error: null }
      assert.equal(call.options.ignoreDuplicates, true)
      assert.equal(call.payload[table === 'follows' ? 'follower_id' : 'profile_id'], 'actor')
      const key = JSON.stringify(call.payload)
      if (!rows.has(key)) { rows.add(key); actualInserts++ }
      return { error: null }
    })
    for (let index = 0; index < 2; index++) {
      const result = await f.actions[fn]({ ...input, [field]: false })
      assert.equal(result.ok, true)
      assert.equal(result[field], true)
    }
    assert.equal(actualInserts, 1)
    assert.ok(f.invalidated.includes('/feed'))
    assert.ok(f.invalidated.includes(table === 'follows' ? '/messages' : '/reel/post'))
  })

  test(`${table} rejects mutation failures without exposing database text or invalidating`, async () => {
    const f = fixture(`actions/${table}.ts`, (call) => call.method === 'select'
      ? { data: { id: 'target', author_id: 'other' }, error: null }
      : { error: { message: 'secret relation metadata SQL exception' } })
    const result = await f.actions[fn]({ ...input, [field]: false })
    assert.equal(result.ok, false)
    assert.match(result.error, /_failed$/)
    assert.doesNotMatch(result.error, /secret|relation|SQL/)
    assert.deepEqual(f.invalidated, [])
  })

  test(`${table} interrupted network is unconfirmed and is not retried`, async () => {
    const f = fixture(`actions/${table}.ts`, (call) => {
      if (call.method === 'select') return { data: { id: 'target', author_id: 'other' }, error: null }
      throw new Error('connection lost after possible commit')
    })
    const result = await f.actions[fn]({ ...input, [field]: false })
    assert.equal(result.ok, false)
    assert.match(result.error, /_unconfirmed$/)
    assert.equal(f.calls.filter((call) => call.method === 'upsert').length, 1)
    assert.deepEqual(f.invalidated, [])
  })

  test(`${table} deletes target only the authenticated actor and preserve auth redirects`, async () => {
    const f = fixture(`actions/${table}.ts`, () => ({ data: { id: 'target', author_id: 'other' }, error: null }))
    assert.equal((await f.actions[fn]({ ...input, [field]: true })).ok, true)
    const deletion = f.calls.find((call) => call.method === 'delete')
    assert.ok(deletion.filters.some(([key, value]) => key === (table === 'follows' ? 'follower_id' : 'profile_id') && value === 'actor'))
    const unauthenticated = fixture(`actions/${table}.ts`, undefined, {
      '@/lib/auth/get-dev-session': { getDevSession: async () => navigation.redirect('/login') },
    })
    await expectRedirect(() => unauthenticated.actions[fn]({ ...input, [field]: false }), '/login')
    assert.deepEqual(unauthenticated.calls, [])
  })
}

test('committed comment stays successful when optional author lookup throws', async () => {
  const f = fixture('actions/comments.ts', (call) => {
    if (call.table === 'posts') return { data: { id: 'post', author_id: 'other' }, error: null }
    if (call.table === 'profiles') throw new Error('enrichment unavailable')
    assert.equal(call.table, 'comments')
    assert.equal(call.payload.author_id, 'actor')
    return { data: { id: 'comment', author_id: 'actor', body: 'Hello', created_at: '2026-10-08T00:00:00Z' }, error: null }
  })
  const result = await f.actions.createCommentInline({ postId: 'post', profileId: 'forged', body: ' Hello ' })
  assert.equal(result.ok, true)
  assert.equal(result.comment.id, 'comment')
  assert.equal(result.comment.author, null)
  assert.equal(f.calls.filter((call) => call.method === 'insert').length, 1)
  assert.ok(f.invalidated.includes('/activity'))
  assert.ok(f.invalidated.includes('/reel/post'))
})

test('comment boundaries prevent writes and insert errors remain safe', async () => {
  const f = fixture('actions/comments.ts', (call) => call.method === 'select'
    ? { data: { id: 'post', author_id: 'other' }, error: null }
    : { error: { message: 'private SQL schema' } })
  for (const body of ['', 'x'.repeat(281)]) {
    assert.equal((await f.actions.createCommentInline({ postId: 'post', profileId: 'forged', body })).ok, false)
  }
  assert.deepEqual(f.calls, [])
  const result = await f.actions.createCommentInline({ postId: 'post', profileId: 'forged', body: 'Hello' })
  assert.equal(result.error, 'comment_insert_failed')
  assert.deepEqual(f.invalidated, [])
})

test('message insert failure has no success redirect or cache invalidation', async () => {
  const f = fixture('actions/messages.ts', (call) => call.method === 'select'
    ? { data: { id: 'thread', profile_low_id: 'actor', profile_high_id: 'other' }, error: null }
    : { error: { message: 'private SQL schema' } }, {
    '@/lib/db/queries/messages': { areMutualFollowers: async () => true },
  })
  await expectRedirect(() => f.actions.sendDirectMessage(form({ thread_id: 'thread', body: 'Hello' })), '/messages/thread?error=message_failed')
  assert.deepEqual(f.invalidated, [])
})

test('message success invalidates inbox and thread after authenticated insert', async () => {
  const f = fixture('actions/messages.ts', (call) => call.method === 'select'
    ? { data: { id: 'thread', profile_low_id: 'actor', profile_high_id: 'other' }, error: null }
    : { error: null }, {
    '@/lib/db/queries/messages': { areMutualFollowers: async () => true },
  })
  await expectRedirect(() => f.actions.sendDirectMessage(form({ thread_id: 'thread', sender_id: 'forged', body: 'Hello' })), '/messages/thread?sent=1')
  assert.equal(f.calls.find((call) => call.method === 'insert').payload.sender_id, 'actor')
  assert.deepEqual(f.invalidated, ['/messages', '/messages/thread'])
})

test('theme update affecting no profile does not update cookie or claim success', async () => {
  let cookieWrites = 0
  const f = fixture('actions/settings.ts', () => ({ data: null, error: null }), {
    'next/headers': { cookies: async () => ({ set() { cookieWrites++ } }) },
  })
  await expectRedirect(() => f.actions.updateThemePreference(form({ theme: 'dark' })), '/settings?error=theme_update_failed')
  assert.equal(cookieWrites, 0)
  assert.deepEqual(f.invalidated, [])
})

test('optimistic counts reconcile against refreshed state without double increments', () => {
  const { optimisticEngagement } = loadTs('lib/mutations/optimistic-engagement.ts')
  assert.deepEqual(JSON.parse(JSON.stringify(optimisticEngagement({ active: false, count: 4 }, true))), { active: true, count: 5 })
  assert.deepEqual(JSON.parse(JSON.stringify(optimisticEngagement({ active: true, count: 5 }, true))), { active: true, count: 5 })
  assert.deepEqual(JSON.parse(JSON.stringify(optimisticEngagement({ active: false, count: 0 }, false))), { active: false, count: 0 })
  assert.equal(optimisticEngagement({ active: true, count: 0 }, false).count, 0)
})
