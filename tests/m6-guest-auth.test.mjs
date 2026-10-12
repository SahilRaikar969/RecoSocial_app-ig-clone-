import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest } = require('next/server')
const id = '11111111-1111-4111-8111-111111111111'
class Redirect extends Error { constructor(url) { super(url); this.url = url } }
const navigation = { redirect(url) { throw new Redirect(url) }, notFound() { throw new Error('not-found') } }
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url))
  const source = readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', 'window', outputText)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'next/server') return require(name)
    if (name === 'next/navigation') return navigation
    if (name === 'next/cache') return { revalidatePath() {} }
    if (name.startsWith('@/lib/')) return load(`${name.slice(2)}.ts`, mocks)
    throw new Error(`Unexpected dependency: ${name}`)
  }, compiledModule, compiledModule.exports, mocks.window)
  return compiledModule.exports
}
const { isPublicRoute } = load('lib/auth/public-routes.ts')
const { authReturnPath, guestReturnPath } = load('lib/auth/return-path.ts')
const { preparePasswordRecovery, recoveryReturnPath } = load('lib/auth/recovery.ts')

test('public route allowlist admits exact guest pages and UUID content routes only', () => {
  for (const path of ['/', '/feed', '/explore', '/login', '/signup', '/forgot-password', '/reset-password', ...['post', 'profile', 'reel', 'stories'].map(route => `/${route}/${id}`)]) assert.equal(isPublicRoute(path), true, path)
  for (const path of ['/saved', '/activity', '/messages', `/messages/${id}`, '/settings', '/onboarding', '/camera', '/create', '/profile', '/profile/edit', '/stories/create', `/post/${id}/edit`, `/profile/${id}/followers`, '/api/camera/publish', '/post/not-a-uuid', `/profile/${id}/extra`]) assert.equal(isPublicRoute(path), false, path)
})

test('authentication redirects reject external destinations and authentication loops', () => {
  for (const path of ['//evil.invalid', '/%2fevil.invalid', '/\\evil.invalid', 'https://evil.invalid', '/login?next=/feed', '/signup', '/reset-password#token', '/auth/callback']) assert.equal(authReturnPath(path), '/feed', path)
  assert.equal(authReturnPath(`/post/${id}?source=explore#comments`), `/post/${id}?source=explore#comments`)
  assert.equal(authReturnPath('/messages'), '/messages')
})

test('continue browsing retains public content context but never returns guests to protected pages', () => {
  assert.equal(guestReturnPath(`/post/${id}?source=explore#comments`), `/post/${id}?source=explore#comments`)
  for (const path of ['/messages', '/settings', '/profile/edit', '/login', '//evil.invalid']) assert.equal(guestReturnPath(path), '/feed')
})

test('middleware permits guest public detail and gates protected routes with local next context', async () => {
  const middleware = load('proxy.ts', { '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) } }).proxy
  const publicResponse = await middleware(new NextRequest(`http://localhost/post/${id}`))
  assert.equal(publicResponse.headers.get('location'), null)
  assert.equal(publicResponse.headers.get('cache-control'), 'private, no-store')
  const response = await middleware(new NextRequest('http://localhost/messages?tab=unread'))
  const location = new URL(response.headers.get('location'))
  assert.equal(location.pathname, '/login')
  assert.equal(location.searchParams.get('next'), '/messages?tab=unread')
  assert.equal(location.searchParams.get('reason'), 'continue')
})

test('optional session does not query or provision any profile for absent or invalid identity', async () => {
  for (const result of [{ data: { user: null }, error: null }, { data: { user: { id } }, error: new Error('expired') }]) {
    let reads = 0
    const sessions = load('lib/auth/session.ts', { '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => result }, from() { reads += 1; throw new Error('guest profile access') } }) } })
    assert.equal(await sessions.getOptionalSession(), null)
    await assert.rejects(sessions.requireSession, error => error instanceof Redirect && error.url === '/login')
    assert.equal(reads, 0)
  }
})

test('guest action calls cannot bypass authentication by forging profile IDs', async () => {
  let databaseCalls = 0
  const mocks = {
    '@/lib/auth/session': { requireSession: async () => navigation.redirect('/login') },
    '@/lib/supabase/server': { createClient: async () => { databaseCalls += 1; throw new Error('unauthorized database call') } },
  }
  const actions = [
    [load('actions/likes.ts', mocks).toggleLikeInline, { postId: id, devProfileId: id, liked: false }],
    [load('actions/saves.ts', mocks).toggleSaveInline, { postId: id, devProfileId: id, saved: false }],
    [load('actions/follows.ts', mocks).toggleFollowInline, { followerId: id, followingId: id, followedByMe: false }],
    [load('actions/comments.ts', mocks).createCommentInline, { postId: id, profileId: id, body: 'forged guest mutation' }],
  ]
  for (const [action, input] of actions) await assert.rejects(() => action(input), error => error instanceof Redirect && error.url === '/login')
  assert.equal(databaseCalls, 0)
})

function recoveryClient({ initializationError = null, verificationError = null, userError = null, user = { id } } = {}) {
  const calls = []
  return { calls, auth: {
    async initialize() { calls.push('initialize'); return { error: initializationError } },
    async verifyOtp(input) { calls.push(input); return { error: verificationError } },
    async getUser() { calls.push('getUser'); return { data: { user }, error: userError } },
    async exchangeCodeForSession() { throw new Error('PKCE must not be exchanged twice') },
  } }
}
test('PKCE recovery waits for SDK initialization and then verifies identity without a second exchange', async () => {
  const client = recoveryClient()
  await preparePasswordRecovery(client, { code: 'local-test-code' })
  assert.deepEqual(client.calls, ['initialize', 'getUser'])
})

test('token hash recovery verifies only recovery OTP before verifying the resulting user', async () => {
  const client = recoveryClient()
  await preparePasswordRecovery(client, { tokenHash: 'local-test-hash', type: 'recovery' })
  assert.deepEqual(client.calls, [{ token_hash: 'local-test-hash', type: 'recovery' }, 'getUser'])
  const invalid = recoveryClient()
  await assert.rejects(() => preparePasswordRecovery(invalid, { tokenHash: 'local-test-hash', type: 'signup' }), /Not a recovery link/)
  assert.deepEqual(invalid.calls, [])
})

test('invalid recovery is rejected even if a previous signed-in user exists', async () => {
  const errorClient = recoveryClient()
  await assert.rejects(() => preparePasswordRecovery(errorClient, { error: 'access_denied' }), /Invalid or expired/)
  assert.deepEqual(errorClient.calls, [])
  const initializationClient = recoveryClient({ initializationError: new Error('code expired') })
  await assert.rejects(() => preparePasswordRecovery(initializationClient, { code: 'expired' }), /Invalid or expired/)
  assert.deepEqual(initializationClient.calls, ['initialize'])
  const verificationClient = recoveryClient({ verificationError: new Error('OTP expired') })
  await assert.rejects(() => preparePasswordRecovery(verificationClient, { tokenHash: 'expired', type: 'recovery' }), /Invalid or expired/)
  assert.equal(verificationClient.calls.length, 1)
})

test('initialized recovery cannot enable password changes without a server-verified identity', async () => {
  for (const options of [{ user: null }, { userError: new Error('unverified identity') }]) {
    await assert.rejects(() => preparePasswordRecovery(recoveryClient(options), {}), /Sign in or request/)
  }
})

test('consumed recovery credentials are removed from URL while unrelated local context survives', () => {
  assert.equal(recoveryReturnPath('https://local.invalid/reset-password?token_hash=secret&type=recovery&next=%2Ffeed#access_token=secret&refresh_token=secret'), '/reset-password?next=%2Ffeed')
  assert.equal(recoveryReturnPath('https://local.invalid/reset-password?code=secret&error=access_denied&error_description=secret#token'), '/reset-password')
})

test('reset form displays expired-link error without a password form despite an existing old session', async () => {
  const state = [], effects = [], refs = []
  let stateIndex = 0, refIndex = 0
  const jsx = (type, props) => ({ type, props })
  const client = recoveryClient({ initializationError: new Error('expired callback') })
  let cleanedPath
  const ResetPasswordForm = load('components/auth/reset-password-form.tsx', {
    react: {
      useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value }] },
      useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial } },
      useEffect(effect) { effects.push(effect) },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'Link' },
    'next/navigation': { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams('code=expired') },
    '@/components/ui/feedback-banner': { FeedbackBanner: 'FeedbackBanner' },
    '@/components/auth/password-field': { PasswordField: 'PasswordField' },
    '@/lib/supabase/browser': { createClient: () => client },
    window: { location: { href: 'https://local.invalid/reset-password?code=expired' }, history: { state: { tree: 'keep-router-state' }, replaceState(stateValue, _title, path) { assert.deepEqual(stateValue, { tree: 'keep-router-state' }); cleanedPath = path } } },
  }).ResetPasswordForm
  ResetPasswordForm()
  effects[0]()
  await new Promise(resolve => setImmediate(resolve))
  stateIndex = 0; refIndex = 0
  const tree = ResetPasswordForm()
  const nodes = []
  const visit = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(visit); return } nodes.push(node); visit(node.props?.children) }
  visit(tree)
  assert.equal(nodes.some(node => node.type === 'form' || node.type === 'PasswordField'), false)
  assert.ok(nodes.some(node => node.type === 'FeedbackBanner' && /invalid or expired/.test(node.props.children)))
  assert.deepEqual(client.calls, ['initialize'])
  assert.equal(cleanedPath, '/reset-password')
})

function publicClient() {
  const calls = []
  const profile = { id, username: 'public', display_name: 'Public', avatar_url: null, bio: '', is_private: false, theme_preference: 'dark' }
  const posts = [
    { id, author_id: id, caption: 'public', status: 'published', visibility: 'public', media_type: 'image', media_path: 'images/public.jpg', thumbnail_path: null, created_at: '2026-10-11T00:00:00Z', profiles: profile, post_categories: [] },
    { id: 'draft', author_id: id, status: 'draft', visibility: 'public', media_type: 'image', media_path: 'images/draft.jpg', created_at: '2026-10-11T00:00:00Z' },
    { id: 'private', author_id: id, status: 'published', visibility: 'private', media_type: 'image', media_path: 'images/private.jpg', created_at: '2026-10-11T00:00:00Z' },
  ]
  const tables = { posts, profiles: [profile], categories: [], comments: [], follows: [] }
  return { calls, client: {
    from(table) {
      assert.ok(Object.hasOwn(tables, table), `Guest attempted private table ${table}`)
      const query = { table, filters: [], limit: Infinity, single: false }
      const chain = {
        select(columns, options) { query.columns = columns; query.options = options; return chain },
        eq(column, value) { query.filters.push(['eq', column, value]); return chain },
        in(column, values) { query.filters.push(['in', column, values]); return chain },
        order() { return chain },
        limit(value) { query.limit = value; return chain },
        maybeSingle() { query.single = true; return chain },
        then(resolve, reject) {
          calls.push(query)
          const rows = tables[table].filter(row => query.filters.every(([op, key, value]) => op === 'in' ? value.includes(row[key]) : row[key] === value)).slice(0, query.limit)
          return Promise.resolve({ data: query.options?.head ? null : query.single ? rows[0] ?? null : rows, count: rows.length, error: null }).then(resolve, reject)
        },
      }
      return chain
    },
    async rpc(name, args) {
      assert.equal(name, 'get_visible_post_engagement')
      calls.push({ table: 'rpc', ids: args.post_ids })
      return { data: args.post_ids.map(post_id => ({ post_id, like_count: 2, save_count: 4, comment_count: 0, liked_by_me: true, saved_by_me: true })), error: null }
    },
  } }
}

test('guest post, Explore and profile queries only read public content and count aggregates', async () => {
  const context = publicClient()
  const queries = load('lib/db/queries/public-content.ts', { '@/lib/supabase/server': { createClient: async () => context.client } })
  const posts = await queries.getPublicPosts()
  assert.equal(posts.length, 1)
  assert.equal(posts[0].save_count, 4)
  assert.equal(posts[0].saved_by_me, false)
  assert.equal(posts[0].liked_by_me, false)
  assert.equal((await queries.getPublicExplore()).posts.length, 1)
  const profile = await queries.getPublicProfile(id)
  assert.equal(profile.stats.saved_count, 0)
  assert.equal(profile.profile.can_message, false)
  const post = await queries.getPublicPost(id)
  assert.equal(post.is_owner, false)
  assert.deepEqual(post.comments, [])
  for (const call of context.calls) {
    assert.doesNotMatch(call.columns ?? '', /\b(?:saves|profile_category_preferences|post_hides|notifications|direct_messages|direct_thread_reads)\b/)
    if (call.table === 'posts') {
      assert.ok(call.filters.some(filter => filter[1] === 'status' && filter[2] === 'published'))
      assert.ok(call.filters.some(filter => filter[1] === 'visibility' && filter[2] === 'public'))
      if (!call.options?.head) assert.equal(call.limit, 80)
    }
  }
})

test('guest missing public content returns not-found without private fallback', async () => {
  const context = publicClient()
  const queries = load('lib/db/queries/public-content.ts', { '@/lib/supabase/server': { createClient: async () => context.client } })
  assert.equal(await queries.getPublicPost('draft'), null)
  assert.equal(await queries.getPublicPost('private'), null)
  await assert.rejects(() => queries.getPublicProfile('missing'), /not-found/)
})
