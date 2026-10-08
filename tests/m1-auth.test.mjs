import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')

function loadTs(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url))
  const source = readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  })
  const compiledModule = { exports: {} }
  runInNewContext(outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      throw new Error(`Unexpected dependency: ${name}`)
    },
    URL,
    URLSearchParams,
    FormData,
    process: { env: {} },
  }, { filename })
  return compiledModule.exports
}

const routes = loadTs('lib/routes/safe-return-path.ts')
class Redirect extends Error {
  constructor(url) { super(url); this.url = url }
}
const navigation = { redirect(url) { throw new Redirect(url) } }
const expectRedirect = (fn, expected) => assert.rejects(fn, (error) => {
  assert.ok(error instanceof Redirect)
  assert.equal(error.url, expected)
  return true
})
const form = (entries) => {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

test('return paths preserve a local path, query and fragment', () => {
  assert.equal(routes.safeReturnPath('/post/abc?tab=saved#comments'), '/post/abc?tab=saved#comments')
  assert.equal(routes.safeReturnPath(' /feed '), '/feed')
  assert.equal(routes.safeReturnPath('/explore?q=caf%C3%A9'), '/explore?q=caf%C3%A9')
  assert.equal(routes.safeReturnPath('', '/activity'), '/activity')
  assert.equal(routes.safeReturnPath('', 'https://outside.invalid'), '/feed')
})

for (const destination of [
  'https://outside.invalid', '//outside.invalid', 'javascript:alert(1)',
  '/\\outside.invalid', '\\outside.invalid', '/%2foutside.invalid', '/%5coutside.invalid',
  '/%252foutside.invalid', '/%25%32%66outside.invalid', '/%00test', '/%250Atest',
  '/a\ntest', '/a\rtest', '/a\ttest', '/%7ftest', '/bad%escape', '/a/..//outside.invalid',
]) {
  test(`reject unsafe return path ${JSON.stringify(destination)}`, () => {
    assert.equal(routes.safeReturnPath(destination, '/activity'), '/activity')
  })
}

test('return parameters merge and encode once, preserving fragment', () => {
  assert.equal(
    routes.buildReturnUrl('/settings?tab=privacy&error=old#details', { error: 'A & B? 50%' }),
    '/settings?tab=privacy&error=A+%26+B%3F+50%25#details'
  )
  assert.equal(routes.buildReturnUrl('//outside.invalid', { error: 'denied' }, '/activity'), '/activity?error=denied')
})

function onboarding(client, session = async () => ({ profileId: 'verified-actor' })) {
  return loadTs('actions/onboarding.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': navigation,
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/auth/get-dev-session': { getDevSession: session },
    '@/lib/routes/safe-return-path': routes,
  }).saveOnboardingPreferences
}

test('onboarding resolves category names and RPC receives IDs only, ignoring forged owner', async () => {
  const calls = []
  const client = {
    from(table) {
      assert.equal(table, 'categories')
      return { select() { return { async in(column, names) {
        assert.equal(column, 'name')
        assert.deepEqual(Array.from(names), ['Cooking', 'Travel'])
        return { data: [{ id: 'category-c', name: 'Cooking' }, { id: 'category-t', name: 'Travel' }], error: null }
      } } } }
    },
    async rpc(name, args) { calls.push([name, JSON.parse(JSON.stringify(args))]); return { error: null } },
  }
  await expectRedirect(() => onboarding(client)(form([
    ['profile_id', 'another-user'], ['categories', ' Cooking '], ['categories', 'Cooking'], ['categories', 'Travel'],
  ])), '/feed?onboarding=done')
  assert.deepEqual(calls, [['save_profile_category_preferences', { category_ids: ['category-c', 'category-t'] }]])
})

test('onboarding rejects unauthenticated requests before database access', async () => {
  await expectRedirect(() => onboarding(null, async () => navigation.redirect('/login'))(
    form([['profile_id', 'victim'], ['categories', 'Cooking']])
  ), '/login')
})

test('onboarding rejects partially unknown categories without replacing saved preferences', async () => {
  let writes = 0
  const client = {
    from() { return { select() { return { async in() { return { data: [{ id: 'one' }], error: null } } } } } },
    async rpc() { writes += 1; return { error: null } },
  }
  await expectRedirect(() => onboarding(client)(form([
    ['categories', 'Cooking'], ['categories', 'Unknown'], ['return_to', '//outside.invalid'],
  ])), '/onboarding?error=categories_not_found')
  assert.equal(writes, 0)
})

test('onboarding propagates RPC failure without a separate delete or insert', async () => {
  const client = {
    from() { return { select() { return { async in() { return { data: [{ id: 'one' }], error: null } } } } } },
    async rpc() { return { error: { message: 'invalid & denied' } } },
  }
  await expectRedirect(() => onboarding(client)(form([
    ['categories', 'Cooking'], ['return_to', '/onboarding?tab=topics#form'],
  ])), '/onboarding?tab=topics&error=preferences_save_failed#form')
})

test('onboarding enforces empty and bounded preference sets before query', async () => {
  await expectRedirect(() => onboarding(null)(form([])), '/onboarding?error=no_categories_selected')
  await expectRedirect(() => onboarding(null)(form(Array.from({ length: 101 }, (_, i) => ['categories', String(i)]))), '/onboarding?error=too_many_categories')
})

function auth(client) {
  return loadTs('actions/auth.ts', {
    'next/navigation': navigation,
    '@/lib/supabase/server': { createClient: async () => client },
  })
}

function signupClient(session) {
  const queries = []
  let inserts = 0
  const client = {
    auth: { async signUp() { return { data: { user: { id: 'new-user' }, session }, error: null } } },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select() { return { eq(column, value) { queries.push([column, value]); return { async maybeSingle() {
          return { data: column === 'id' ? { id: 'new-user' } : null, error: null }
        } } } } },
        async insert() { inserts += 1; return { error: null } },
      }
    },
  }
  return { client, queries, inserts: () => inserts }
}
const signupForm = () => form([['email', 'test@example.invalid'], ['password', 'test-only-password'], ['username', 'tester']])

test('confirmation-required signup never attempts an anonymous profile write', async () => {
  const fixture = signupClient(null)
  await expectRedirect(() => auth(fixture.client).signup(signupForm()), '/login?error=confirm_email_required')
  assert.deepEqual(fixture.queries, [['username', 'tester']])
  assert.equal(fixture.inserts(), 0)
})

test('authenticated signup uses the existing provisioned profile', async () => {
  const fixture = signupClient({ user: { id: 'new-user' } })
  await expectRedirect(() => auth(fixture.client).signup(signupForm()), '/onboarding')
  assert.deepEqual(fixture.queries, [['username', 'tester'], ['id', 'new-user']])
  assert.equal(fixture.inserts(), 0)
})

test('logout does not claim success when signOut fails', async () => {
  await expectRedirect(() => auth({ auth: { async signOut() { return { error: { message: 'signout failed' } } } } }).logout(), '/settings?error=Sign+out+failed.+Try+again.')
  await expectRedirect(() => auth({ auth: { async signOut() { return { error: null } } } }).logout(), '/login')
})

test('notification marking remains owner-scoped and sanitizes navigation', async () => {
  const filters = []
  const query = {
    update(values) { assert.deepEqual(Object.keys(values), ['read_at']); return this },
    eq(key, value) { filters.push([key, value]); return this },
    async is() { return { error: null } },
  }
  const action = loadTs('actions/notifications.ts', {
    'next/navigation': navigation,
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
    '@/lib/auth/get-dev-session': { getDevSession: async () => ({ profileId: 'verified-actor' }) },
    '@/lib/routes/safe-return-path': routes,
  }).markNotificationReadAndRedirect
  await expectRedirect(() => action(form([
    ['notification_id', 'notification-one'], ['target_href', 'https://outside.invalid'], ['return_to', '//outside.invalid'],
  ])), '/activity')
  assert.deepEqual(filters, [['id', 'notification-one'], ['recipient_id', 'verified-actor']])
  await expectRedirect(() => action(form([
    ['notification_id', 'notification-two'], ['target_href', '/post/abc?tab=likes#comments'],
  ])), '/post/abc?tab=likes#comments')
})

for (const [pathname, user, destination] of [
  ['/feed', null, '/login'], ['/login', { id: 'actor' }, '/feed'], ['/feed', { id: 'actor' }, null],
]) {
  test(`middleware preserves refreshed cookie batches and private caching for ${pathname} ${user ? 'signed in' : 'signed out'}`, async () => {
    const middleware = loadTs('middleware.ts', {
      'next/server': { NextResponse },
      '@supabase/ssr': { createServerClient(_url, _key, options) { return { auth: { async getUser() {
        options.cookies.setAll([{ name: 'session.0', value: 'first', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } }])
        options.cookies.setAll([{ name: 'session.1', value: 'second', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } }])
        return { data: { user } }
      } } } } },
    }).middleware
    const request = new NextRequest(`https://recosocial.invalid${pathname}?test=1`)
    const response = await middleware(request)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    for (const [name, value] of [['session.0', 'first'], ['session.1', 'second']]) {
      const cookie = response.cookies.get(name)
      assert.equal(cookie?.value, value)
      assert.equal(cookie?.httpOnly, true)
      assert.equal(cookie?.secure, true)
      assert.equal(cookie?.sameSite, 'lax')
      assert.equal(request.cookies.get(name)?.value, value)
    }
    assert.equal(response.headers.get('location'), destination ? `https://recosocial.invalid${destination}` : null)
  })
}


function profileSessionClient({ user = { id: 'verified-actor', email: 'actor@example.invalid', user_metadata: { username: 'actor' } }, readResults = [], insertError = null } = {}) {
  const reads = []
  const writes = []
  const client = {
    auth: { async getUser() { return { data: { user }, error: null } } },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select() { return { eq(column, value) { reads.push([column, value]); return { async maybeSingle() {
          assert.ok(readResults.length, 'unexpected extra profile read')
          return { data: readResults.shift(), error: null }
        } } } } },
        insert(values) {
          writes.push(JSON.parse(JSON.stringify(values)))
          return { select() { return { async single() {
            return { data: insertError ? null : values, error: insertError }
          } } } }
        },
      }
    },
  }
  const session = loadTs('lib/auth/get-dev-session.ts', {
    'next/navigation': navigation,
    '@/lib/supabase/server': { createClient: async () => client },
  }).getDevSession
  return { session, reads, writes }
}

test('protected session rejects missing auth before profile access', async () => {
  const fixture = profileSessionClient({ user: null })
  await expectRedirect(() => fixture.session(), '/login')
  assert.equal(fixture.reads.length, 0)
  assert.equal(fixture.writes.length, 0)
})

test('protected session uses the existing verified profile without writing', async () => {
  const fixture = profileSessionClient({ readResults: [{ id: 'verified-actor', username: 'existing', display_name: 'Existing' }] })
  const session = await fixture.session()
  assert.equal(session.profileId, 'verified-actor')
  assert.equal(session.username, 'existing')
  assert.deepEqual(fixture.reads, [['id', 'verified-actor']])
  assert.equal(fixture.writes.length, 0)
})

test('fallback profile insert uses the auth id and bounds editable metadata', async () => {
  const fixture = profileSessionClient({
    user: { id: 'verified-actor', email: 'actor@example.invalid', user_metadata: { id: 'forged-owner', username: ' Actor! ', display_name: 'D'.repeat(100) } },
    readResults: [null, null],
  })
  const session = await fixture.session()
  assert.equal(session.profileId, 'verified-actor')
  assert.equal(fixture.writes[0].id, 'verified-actor')
  assert.equal(fixture.writes[0].username, 'actor')
  assert.equal(fixture.writes[0].display_name.length, 60)
})

test('parallel protected profile provisioning re-reads only the auth user after a duplicate', async () => {
  const fixture = profileSessionClient({
    readResults: [null, null, { id: 'verified-actor', username: 'concurrent', display_name: 'Concurrent' }],
    insertError: { code: '23505', message: 'duplicate profile' },
  })
  const session = await fixture.session()
  assert.equal(session.profileId, 'verified-actor')
  assert.equal(session.username, 'concurrent')
  assert.deepEqual(fixture.reads, [['id', 'verified-actor'], ['username', 'actor'], ['id', 'verified-actor']])
  assert.equal(fixture.writes.length, 1)
})

test('profile username conflict never adopts or overwrites the other account', async () => {
  const fixture = profileSessionClient({
    readResults: [null, null, null],
    insertError: { code: '23505', message: 'duplicate username' },
  })
  await assert.rejects(() => fixture.session(), /duplicate username/)
  assert.equal(fixture.writes.length, 1)
  assert.deepEqual(fixture.reads.at(-1), ['id', 'verified-actor'])
})

test('authenticated signup tolerates concurrent provisioning of its own profile', async () => {
  const reads = []
  const writes = []
  const results = [null, null, null, { id: 'new-user' }]
  const client = {
    auth: { async signUp(values) {
      assert.equal(values.options.data.username, 'tester')
      return { data: { user: { id: 'new-user' }, session: { user: { id: 'new-user' } } }, error: null }
    } },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select() { return { eq(column, value) { reads.push([column, value]); return { async maybeSingle() {
          return { data: results.shift(), error: null }
        } } } } },
        async insert(values) { writes.push(JSON.parse(JSON.stringify(values))); return { error: { code: '23505', message: 'duplicate profile' } } },
      }
    },
  }
  await expectRedirect(() => auth(client).signup(signupForm()), '/onboarding')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].id, 'new-user')
  assert.deepEqual(reads.at(-1), ['id', 'new-user'])
})

function pageMocks() {
  return {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: 'a' },
    'lucide-react': new Proxy({}, { get(_target, name) { return String(name) } }),
    '@/actions/auth': { login() {}, signup() {} },
    '@/actions/notifications': { markNotificationsRead() {} },
    '@/lib/auth/get-dev-session': { getDevSession: async () => ({ profileId: 'verified-actor' }) },
    '@/lib/db/queries/onboarding': { getOnboardingCategories: async () => [] },
    '@/lib/db/queries/notifications': { getNotificationsPageData: async () => ({ notifications: [], summary: { total: 0, unread: 0, follow: 0, like: 0, comment: 0 } }) },
    '@/components/onboarding/onboarding-form': { OnboardingForm: 'OnboardingForm' },
    '@/components/activity/activity-list': { ActivityList: 'ActivityList' },
    '@/components/ui/feedback-banner': { FeedbackBanner: 'FeedbackBanner' },
    '@/components/ui/page-shell': { PageShell: 'PageShell' },
    '@/components/ui/surface-hero': { SurfaceHero: 'SurfaceHero' },
  }
}

for (const path of ['app/(auth)/login/page.tsx', 'app/(auth)/signup/page.tsx', 'app/onboarding/page.tsx', 'app/activity/page.tsx']) {
  test(path + ' renders an already-decoded percent error without throwing or decoding twice', async () => {
    const page = loadTs(path, pageMocks()).default
    const error = 'Denied 50% / literal %2F'
    const tree = await page({ searchParams: Promise.resolve({ error }) })
    assert.ok(JSON.stringify(tree).includes(error))
  })
}
