import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
const jsx = (type, props) => ({ type, props: props || {} })
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  runInNewContext(code, { module: mod, exports: mod.exports, crypto: globalThis.crypto, Headers, URL, process: { env: {} }, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected dependency: ' + name)
    return mocks[name]
  } })
  return mod.exports
}
function allNodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(allNodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...allNodes(tree.props?.children)]
}
const containsPrivate = tree => allNodes(tree).some(node => node.type === 'SavedGrid' && node.props.posts[0].id === 'a-private-save')

async function boundary(serverViewer = 'account-a') {
  const SavedPage = load('app/saved/page.tsx', {
    '@/components/profile/profile-post-grid': { ProfilePostGrid: 'SavedGrid' },
    '@/components/ui/feedback-banner': { FeedbackBanner: 'Banner' },
    '@/components/ui/page-shell': { PageShell: 'PageShell' },
    '@/components/ui/surface-empty': { SurfaceEmpty: 'Empty' },
    '@/lib/auth/session': { async requireSession() { return { profileId: 'account-a' } } },
    '@/lib/db/queries/saved': { async getSavedPosts(viewer) { assert.equal(viewer, 'account-a'); return [{ id: 'a-private-save', media_path: '/demo.svg', caption: 'A private saved selection' }] } },
    '@/lib/media/get-media-url': { async getMediaUrl(path) { return path } },
  }).default
  const serverChildren = await SavedPage({})
  const cells = [], effects = [], pending = [], intervals = new Set(), listeners = new Map()
  let cursor = 0, reloads = 0, resolveUser
  const deferredUser = new Promise(resolve => { resolveUser = resolve })
  const state = { first: true, viewer: 'account-b', error: null }
  const react = {
    createContext: () => ({ Provider: 'context' }),
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] },
    useEffect(fn, deps) { const i = cursor++, previous = effects[i]; if (!previous || deps.some((v, j) => v !== previous.deps[j])) pending.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
  }
  const target = { addEventListener(name, fn) { listeners.set(name, fn) }, removeEventListener(name) { listeners.delete(name) } }
  const window = { ...target, location: { reload() { reloads++ } }, setInterval(fn) { intervals.add(fn); return fn }, clearInterval(fn) { intervals.delete(fn) }, setTimeout() {} }
  const document = { ...target, visibilityState: 'visible' }
  const client = {
    auth: { async getUser() { if (state.first) { state.first = false; return deferredUser } return { data: { user: state.viewer ? { id: state.viewer } : null }, error: state.error } }, onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } } },
    realtime: { async setAuth() {} }, channel() { return { on() { return this }, subscribe() { return this } } }, async removeChannel() {},
    from() { return { select() { return this }, eq() { return this }, async is() { return { count: 0, error: null } } } },
  }
  const { startUnreadMonitor } = load('lib/notifications/unread-monitor.ts', {}, { window, document })
  const { UnreadNotificationsProvider } = load('components/activity/unread-notifications-provider.tsx', {
    react, '@/lib/notifications/unread-monitor': { startUnreadMonitor }, '@/lib/supabase/browser': { createClient: () => client },
  }, { window })
  const { RootChrome } = load('components/layout/root-chrome.tsx', {
    'next/navigation': { usePathname: () => '/saved' }, '@/components/layout/app-shell': { AppShell: 'AppShell' },
    '@/components/activity/unread-notifications-provider': { UnreadNotificationsProvider },
  })
  const RootLayout = load('app/layout.tsx', {
    './globals.css': {}, 'next/headers': { async headers() { return new Headers({ 'x-recosocial-viewer-id': serverViewer || '' }) } },
    '@/components/layout/root-chrome': { RootChrome },
  }).default
  const documentTree = await RootLayout({ children: serverChildren })
  const chrome = allNodes(documentTree).find(node => node.type === RootChrome)
  const element = RootChrome(chrome.props)
  assert.equal(element.type, UnreadNotificationsProvider)
  return {
    state,
    render(nextProps = {}) { cursor = 0; return element.type({ ...element.props, ...nextProps }) },
    flush() { while (pending.length) pending.shift()() },
    async first(viewer, error = null) { resolveUser({ data: { user: viewer ? { id: viewer } : null }, error }); await settle() },
    async poll() { for (const fn of intervals) fn(); await settle() },
    stop() { for (const effect of effects) effect?.cleanup?.() },
    get reloads() { return reloads },
  }
}

for (const scenario of ['first read B', 'initial Auth outage then B']) test('SSR Saved for A is discarded after ' + scenario, async () => {
  const f = await boundary()
  try {
    assert.equal(containsPrivate(f.render()), true)
    f.flush(); await settle()
    if (scenario === 'initial Auth outage then B') {
      await f.first(null, { name: 'AuthApiError', status: 503 })
      assert.equal(containsPrivate(f.render()), true, 'a temporary outage is not verified logout')
      f.flush(); await f.poll()
    } else await f.first('account-b')
    assert.equal(containsPrivate(f.render()), false, 'A payload is removed before reload, including the first verified browser read')
    f.flush(); await f.poll(); f.render(); f.flush()
    assert.equal(f.reloads, 1)
  } finally { f.stop() }
})
test('same-viewer navigation and token checks keep the document; changed RSC props cannot silently rebind it', async () => {
  const f = await boundary()
  try {
    f.render(); f.flush(); await settle(); await f.first('account-a')
    f.state.viewer = 'account-a'; f.render(); f.flush(); await f.poll(); f.render(); f.flush()
    assert.equal(f.reloads, 0)
    f.render({ initialViewerId: 'account-b' }); f.flush()
    f.state.viewer = 'account-b'; await f.poll()
    assert.equal(containsPrivate(f.render()), false)
    f.flush(); assert.equal(f.reloads, 1)
  } finally { f.stop() }
})
for (const [before, after] of [[null, 'account-a'], ['account-a', null]]) test(`first browser verification ${before} to ${after} reloads once and the new document stabilizes`, async () => {
  const f = await boundary(before)
  try {
    f.render(); f.flush(); await settle(); await f.first(after)
    assert.equal(containsPrivate(f.render()), false)
    f.flush(); assert.equal(f.reloads, 1)
  } finally { f.stop() }
  const fresh = await boundary(after)
  try {
    fresh.render(); fresh.flush(); await settle(); await fresh.first(after)
    fresh.state.viewer = after; fresh.render(); fresh.flush(); await fresh.poll(); fresh.render(); fresh.flush()
    assert.equal(fresh.reloads, 0, 'a document rendered for the current viewer must not loop')
  } finally { fresh.stop() }
})

for (const [user, error, expected] of [[{ id: 'verified-a' }, null, 'verified-a'], [null, null, ''], [{ id: 'unverified' }, { status: 503 }, '']]) {
  test(`proxy replaces spoofed document identity with ${expected || 'guest'} and preserves refreshed cookies`, async () => {
    const { proxy } = load('proxy.ts', {
      'next/server': { NextResponse }, '@/lib/auth/public-routes': { isPublicRoute: () => true }, '@/lib/auth/return-path': { authReturnPath: value => value },
      '@supabase/ssr': { createServerClient(_url, _key, options) { return { auth: { async getUser() {
        options.cookies.setAll([{ name: 'fixture-session', value: 'refreshed', options: { httpOnly: true, secure: true, sameSite: 'lax' } }])
        return { data: { user }, error }
      } } } } },
    })
    const response = await proxy(new NextRequest('https://recosocial.invalid/feed', { headers: { 'x-recosocial-viewer-id': 'forged-victim' } }))
    assert.equal(response.headers.get('x-middleware-request-x-recosocial-viewer-id'), expected)
    assert.equal(response.headers.get('x-recosocial-viewer-id'), null, 'internal identity is forwarded to rendering, not a response header')
    assert.match(response.headers.get('x-middleware-request-cookie'), /fixture-session=refreshed/)
    assert.equal(response.cookies.get('fixture-session').httpOnly, true)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  })
}
