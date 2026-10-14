import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  runInNewContext(code, {
    module: mod, exports: mod.exports, Headers, URL, URLSearchParams, FormData, process: { env: {} },
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/lib/auth/') || name === '@/lib/routes/safe-return-path') return load(name.slice(2) + '.ts', mocks)
      throw new Error('Unexpected dependency: ' + name)
    },
  })
  return mod.exports
}
async function proxyResponse(path, method, user) {
  const { proxy } = load('proxy.ts', {
    'next/server': { NextResponse },
    '@supabase/ssr': { createServerClient(_url, _key, options) { return { auth: { async getUser() {
      options.cookies.setAll([{ name: 'fixture-session', value: 'refreshed', options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } }])
      return { data: { user }, error: null }
    } } } } },
  })
  return proxy(new NextRequest('https://recosocial.invalid' + path, { method, headers: { 'x-recosocial-viewer-id': 'forged' } }))
}
function assertForwarded(response, viewer) {
  assert.equal(response.headers.get('location'), null, 'Proxy must leave action/handler response serialization to Next')
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('x-middleware-request-x-recosocial-viewer-id'), viewer || '')
  assert.match(response.headers.get('x-middleware-request-cookie'), /fixture-session=refreshed/)
  assert.equal(response.cookies.get('fixture-session').httpOnly, true)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
}

for (const path of ['/login?next=%2Fsaved', '/signup', '/']) test('already authenticated POST to ' + path + ' reaches its action without a page redirect', async () => {
  assertForwarded(await proxyResponse(path, 'POST', { id: 'current-viewer' }), 'current-viewer')
})
for (const path of ['/saved', '/settings', '/api/camera/publish']) test('logged-out POST to ' + path + ' reaches its own authorization boundary', async () => {
  assertForwarded(await proxyResponse(path, 'POST', null), null)
})
for (const method of ['GET', 'HEAD']) test(method + ' navigation still redirects safely and preserves refreshed cookies', async () => {
  const signedIn = await proxyResponse('/login?next=%2Fsaved', method, { id: 'viewer' })
  assert.equal(signedIn.headers.get('location'), 'https://recosocial.invalid/saved')
  assert.equal(signedIn.cookies.get('fixture-session').httpOnly, true)
  const forged = await proxyResponse('/login?next=https%3A%2F%2Foutside.invalid', method, { id: 'viewer' })
  assert.equal(forged.headers.get('location'), 'https://recosocial.invalid/feed')
  const signedOut = await proxyResponse('/saved?page=2', method, null)
  const destination = new URL(signedOut.headers.get('location'))
  assert.equal(destination.pathname, '/login')
  assert.equal(destination.searchParams.get('next'), '/saved?page=2')
  assert.equal(signedOut.headers.get('cache-control'), 'private, no-store')
  assert.equal(signedOut.cookies.get('fixture-session').httpOnly, true)
})
class Redirect extends Error {
  constructor(url) { super(url); this.url = url }
}
const navigation = { redirect(url) { throw new Redirect(url) } }

test('stale login POST runs the requested login action and uses its safe action redirect', async () => {
  assertForwarded(await proxyResponse('/login?next=%2Fsaved', 'POST', { id: 'travel-viewer' }), 'travel-viewer')
  const calls = []
  const client = {
    auth: { async signInWithPassword(input) {
      calls.push(input.email)
      return { data: { user: { id: 'fitness-viewer', user_metadata: { username: 'fitness' } } }, error: null }
    } },
    from() { return { select() { return this }, eq(_column, value) {
      assert.equal(value, 'fitness-viewer')
      return this
    }, async maybeSingle() { return { data: { id: 'fitness-viewer' }, error: null } } } },
  }
  const { login } = load('actions/auth.ts', { 'next/navigation': navigation, '@/lib/supabase/server': { createClient: async () => client } })
  const form = new FormData()
  form.set('email', 'fitness@recosocial.invalid'); form.set('password', 'fixture-only'); form.set('next', '/saved')
  await assert.rejects(() => login(form), error => error instanceof Redirect && error.url === '/saved')
  assert.deepEqual(calls, ['fitness@recosocial.invalid'])
})

test('a protected post action after logout still rejects before any data access', async () => {
  assertForwarded(await proxyResponse('/create', 'POST', null), null)
  let dataAccess = 0
  const client = {
    auth: { async getUser() { return { data: { user: null }, error: null } } },
    from() { dataAccess++; throw new Error('unauthorized data access') },
    rpc() { dataAccess++; throw new Error('unauthorized mutation') },
  }
  const { createPost } = load('actions/posts.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createClient: async () => client }, '@/lib/media/server-media': {},
  })
  await assert.rejects(() => createPost(new FormData()), error => error instanceof Redirect && error.url === '/login')
  assert.equal(dataAccess, 0)
})

test('camera API after logout returns its structured 401 instead of an HTML redirect', async () => {
  assertForwarded(await proxyResponse('/api/camera/publish', 'POST', null), null)
  let bodyRead = false
  const { POST } = load('app/api/camera/publish/route.ts', {
    'next/server': { NextResponse }, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { async getUser() { return { data: { user: null }, error: null } } } }) },
    '@/lib/media/server-media': {}, '@/lib/media/upload-validation': {},
  })
  const response = await POST({ formData() { bodyRead = true; throw new Error('must not read an unauthorized upload') } })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).ok, false)
  assert.equal(bodyRead, false)
})
