import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props })
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  runInNewContext(code, { module: mod, exports: mod.exports, crypto: globalThis.crypto, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected dependency: ' + name)
    return mocks[name]
  } })
  return mod.exports
}

function boundary(initialViewerId = 'a') {
  const cells = [], effects = [], pending = []
  let cursor = 0, observer, reloads = 0, stopped = false
  const react = {
    createContext: () => ({ Provider: 'context' }),
    useState(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = initial
      return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }]
    },
    useEffect(fn, deps) {
      const index = cursor++
      const previous = effects[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.push(() => {
        previous?.cleanup?.()
        effects[index] = { deps, cleanup: fn() }
      })
    },
  }
  const { UnreadNotificationsProvider } = load('components/activity/unread-notifications-provider.tsx', {
    react,
    '@/lib/notifications/unread-monitor': { startUnreadMonitor(_client, _count, callbacks) { observer = callbacks; return () => { stopped = true } } },
    '@/lib/supabase/browser': { createClient: () => ({}) },
  }, { window: { location: { reload() { reloads++ } } } })
  return {
    render() { cursor = 0; return UnreadNotificationsProvider({ children: 'Private Saved list and unsent draft', initialViewerId }) },
    flush() { while (pending.length) pending.shift()() },
    verify(viewer) { observer.onVerifiedViewer?.(viewer) },
    invalidate(viewer) { observer.onViewer(viewer) },
    get reloads() { return reloads },
    get stopped() { return stopped },
    stop() { for (const effect of effects) effect?.cleanup?.() },
  }
}
function containsPrivate(tree) {
  if (!tree || typeof tree !== 'object') return tree === 'Private Saved list and unsent draft'
  return containsPrivate(tree.props.children)
}

for (const [initial, next] of [['a', 'b'], ['a', null], [null, 'b']]) {
  test(`verified identity ${initial} to ${next} removes private payload and resets the whole document once`, async () => {
    const f = boundary(initial)
    assert.equal(containsPrivate(f.render()), true)
    f.flush(); await settle()
    f.verify(initial); f.render(); f.flush()
    assert.equal(f.reloads, 0, 'matching verified identity retains the server-rendered document')
    f.verify(next)
    assert.equal(containsPrivate(f.render()), false, 'old payload disappears before document reload')
    assert.equal(f.reloads, 0)
    f.flush()
    assert.equal(f.reloads, 1)
    f.verify(next); f.render(); f.flush()
    assert.equal(f.reloads, 1, 'repeated polling cannot reload in a loop')
    f.stop(); assert.equal(f.stopped, true)
  })
}
test('same-viewer revalidation and unverified auth invalidation do not reset the document', async () => {
  const f = boundary(); f.render(); f.flush(); await settle()
  f.verify('a'); f.render(); f.flush()
  f.invalidate(null)
  assert.equal(containsPrivate(f.render()), true)
  f.flush(); f.verify('a'); f.render(); f.flush()
  assert.equal(f.reloads, 0)
  f.stop()
})

function monitor() {
  const listeners = new Map(), intervals = new Set(), timeouts = [], identities = [], counts = [], channels = [], removed = []
  const state = { viewer: 'a', error: null, count: 4, stopped: false, authReads: 0 }
  let authCallback
  const eventTarget = {
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name) { listeners.delete(name) },
  }
  const document = { visibilityState: 'visible', ...eventTarget }
  const window = { ...eventTarget, setInterval(fn) { intervals.add(fn); return fn }, clearInterval(fn) { intervals.delete(fn) }, setTimeout(fn) { timeouts.push(fn) } }
  const client = {
    auth: {
      async getUser() { state.authReads++; return { data: { user: state.viewer ? { id: state.viewer } : null }, error: state.error } },
      onAuthStateChange(fn) { authCallback = fn; return { data: { subscription: { unsubscribe() { state.stopped = true } } } } },
    },
    realtime: { async setAuth() { if (state.realtimeError) throw Error('offline') } },
    channel(name) { const channel = { name, on() { return this }, subscribe() { return this } }; channels.push(channel); return channel },
    removeChannel(channel) { removed.push(channel); return Promise.resolve() },
    from() { return { select() { return this }, eq() { return this }, async is() { return { count: state.count, error: null } } } },
  }
  const { startUnreadMonitor } = load('lib/notifications/unread-monitor.ts', {}, { document, window })
  const stop = startUnreadMonitor(client, value => counts.push(value), { onVerifiedViewer: value => identities.push(value) })
  return {
    state, counts, identities, channels, removed, listeners, intervals, document, stop,
    async poll() { for (const fn of intervals) fn(); await settle() },
    async event(name) { assert.ok(listeners.has(name), name + ' listener must exist'); listeners.get(name)(); await settle() },
    async auth(event, id) { state.viewer = id; authCallback(event, { user: { id } }); while (timeouts.length) timeouts.shift()(); await settle() },
  }
}
test('server-action cookie changes reverify on focus and online, with one owner and complete cleanup', async () => {
  const f = monitor(); await settle(); assert.equal(f.identities.at(-1), 'a')
  f.state.viewer = 'b'; await f.event('focus'); assert.equal(f.identities.at(-1), 'b')
  assert.equal(f.channels.length, 2); assert.equal(f.removed.length, 1)
  f.state.viewer = null; await f.event('online'); assert.equal(f.identities.at(-1), null)
  assert.equal(f.removed.length, 2)
  f.stop(); assert.equal(f.listeners.size, 0); assert.equal(f.intervals.size, 0); assert.equal(f.state.stopped, true)
})
test('temporary Auth outages do not masquerade as logout; subsequent verified identity still changes', async () => {
  const f = monitor(); await settle()
  for (const error of [{ name: 'AuthRetryableFetchError', status: 0 }, { name: 'AuthApiError', status: 503 }]) {
    const before = f.identities.length
    f.state.error = error; f.state.viewer = null; await f.poll()
    assert.equal(f.identities.length, before, 'unavailable identity is not verified logout')
    assert.equal(f.counts.at(-1), 4)
    assert.equal(f.removed.length, 0)
  }
  f.state.error = null; f.state.viewer = 'b'; await f.poll()
  assert.equal(f.identities.at(-1), 'b'); f.stop()
})
test('missing or rejected sessions invalidate the document even when realtime cannot authenticate', async () => {
  const f = monitor(); await settle()
  f.state.viewer = 'b'; f.state.realtimeError = true; await f.poll()
  assert.equal(f.identities.at(-1), 'b', 'identity protection is independent of Realtime availability')
  for (const error of [{ name: 'AuthSessionMissingError', status: 400 }, { name: 'AuthApiError', status: 401 }, { name: 'AuthApiError', status: 403 }]) {
    f.state.error = error; f.state.viewer = null; await f.poll()
    assert.equal(f.identities.at(-1), null)
  }
  f.stop()
})
test('same-account token refresh verifies without emitting a false guest identity', async () => {
  const f = monitor(); await settle(); await f.auth('TOKEN_REFRESHED', 'a')
  assert.ok(f.identities.length >= 2)
  assert.equal(f.identities.every(viewer => viewer === 'a'), true)
  assert.equal(f.intervals.size, 1); f.stop()
})
