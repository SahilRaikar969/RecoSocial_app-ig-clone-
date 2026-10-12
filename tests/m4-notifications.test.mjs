import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/notifications/unread-monitor.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const testModule = { exports: {} }
new Function('exports', output)(testModule.exports)
const { startUnreadMonitor } = testModule.exports
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

function setup() {
  const events = new Map(), intervals = new Set(), timeouts = []
  globalThis.document = { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) }
  globalThis.window = { setInterval: fn => { intervals.add(fn); return fn }, clearInterval: fn => intervals.delete(fn), setTimeout: fn => { timeouts.push(fn) } }
  const state = { user: 'viewer-a', count: 4, authReads: 0, reads: [], channels: [], activeChannels: [], removed: [], pendingRemovals: [], unsubscribed: false }
  let authEvent
  const client = {
    realtime: { async setAuth() {} },
    auth: {
      async getUser() { state.authReads++; if (state.authPending) return await state.authPending.promise; return { data: { user: state.user ? { id: state.user } : null }, error: null } },
      onAuthStateChange(fn) { authEvent = fn; return { data: { subscription: { unsubscribe() { state.unsubscribed = true } } } } },
    },
    from(table) { assert.equal(table, 'notifications'); const record = {}; return {
      select(columns, options) { assert.deepEqual(options, { count: 'exact', head: true }); record.columns = columns; return this },
      eq(key, value) { assert.equal(key, 'recipient_id'); record.viewer = value; return this },
      async is(key, value) { assert.equal(key, 'read_at'); assert.equal(value, null); state.reads.push(record); return state.countPending ? await state.countPending.promise : { count: state.count, error: state.countError } },
    } },
    channel(name) {
      // Match the installed SDK: channel(topic) returns an existing same-topic
      // channel until its asynchronous unsubscribe removes it from the client.
      const existing = state.activeChannels.find(channel => channel.name === name)
      if (existing) return existing
      const channel = {
        name,
        on(type, filter, callback) { Object.assign(channel, { type, filter, callback }); return channel },
        subscribe() {
          if (channel.subscribed) throw new Error('subscribe can only be called once per channel')
          channel.subscribed = true
          state.channels.push(channel)
          return channel
        },
      }
      state.activeChannels.push(channel)
      return channel
    },
    removeChannel(channel) {
      state.removed.push(channel)
      const remove = () => { state.activeChannels = state.activeChannels.filter(active => active.name !== channel.name) }
      if (!state.delayRemoval) { remove(); return Promise.resolve() }
      return new Promise(resolve => state.pendingRemovals.push(() => { remove(); resolve() }))
    },
  }
  const counts = [], stop = startUnreadMonitor(client, count => counts.push(count))
  const emitAuth = event => { authEvent(event); while (timeouts.length) timeouts.shift()() }
  return {
    state, counts, stop, intervals, events,
    poll: () => [...intervals].forEach(fn => fn()),
    changeUser: id => { state.user = id; emitAuth(id ? 'SIGNED_IN' : 'SIGNED_OUT') },
    emitAuth,
    finishRemovals: () => { while (state.pendingRemovals.length) state.pendingRemovals.shift()() },
  }
}

test('one shell refresh verifies once, queries one count and subscribes to verified recipient', async () => {
  const f = setup(); await settle()
  assert.equal(f.state.authReads, 1); assert.equal(f.state.reads.length, 1); assert.equal(f.counts.at(-1), 4)
  assert.equal(f.state.channels.length, 1); assert.equal(f.state.channels[0].filter.filter, 'recipient_id=eq.viewer-a')
  f.poll(); await settle(); assert.equal(f.state.authReads, 2); assert.equal(f.state.reads.length, 2); assert.equal(f.state.channels.length, 1); f.stop()
})
test('hidden tabs pause polling and refresh on visibility return', async () => {
  const f=setup(); await settle(); document.visibilityState='hidden'; f.poll(); await settle(); assert.equal(f.state.authReads,1)
  document.visibilityState='visible'; f.events.get('visibilitychange')(); await settle(); assert.equal(f.state.authReads,2); f.stop()
})
test('overlapping realtime and poll refreshes coalesce, then reconcile once', async () => {
  const f=setup(); await settle(); f.state.countPending=deferred(); f.poll(); await settle()
  for(let i=0;i<8;i++) f.state.channels[0].callback()
  assert.equal(f.state.authReads,2); f.state.countPending.resolve({count:9,error:null}); delete f.state.countPending; await settle()
  assert.equal(f.state.authReads,3); assert.equal(f.state.reads.length,3); f.stop()
})
test('account switch clears old count and ignores a late result from previous viewer', async () => {
  const f=setup(); await settle(); const pending=deferred(); f.state.countPending=pending; f.poll(); await settle()
  f.changeUser('viewer-b'); assert.equal(f.counts.at(-1),0); f.state.count=2; delete f.state.countPending
  pending.resolve({count:99,error:null}); await settle()
  assert.ok(!f.counts.includes(99)); assert.equal(f.counts.at(-1),2); assert.equal(f.state.reads.at(-1).viewer,'viewer-b')
  assert.equal(f.state.channels.at(-1).filter.filter,'recipient_id=eq.viewer-b'); assert.equal(f.state.removed.length,1); f.stop()
})
test('sign out clears badges and never queries counts without verified user', async () => {
  const f=setup(); await settle(); f.changeUser(null); await settle(); assert.equal(f.counts.at(-1),0)
  assert.equal(f.state.reads.length,1); assert.equal(f.state.removed.length,1); f.stop()
})
test('unmount removes subscription/timer and suppresses late async updates', async () => {
  const f=setup(); await settle(); const pending=deferred(); f.state.countPending=pending; f.poll(); await settle(); f.stop()
  const before=f.counts.length; pending.resolve({count:77,error:null}); await settle(); assert.equal(f.counts.length,before)
  assert.equal(f.intervals.size,0); assert.equal(f.events.size,0); assert.equal(f.state.unsubscribed,true); assert.equal(f.state.removed.length,1)
})
test('count failure preserves last confirmed count; later refresh recovers', async () => {
  const f=setup(); await settle(); f.state.countError={message:'unavailable'}; f.state.count=0; f.poll(); await settle(); assert.equal(f.counts.at(-1),4)
  delete f.state.countError; f.poll(); await settle(); assert.equal(f.counts.at(-1),0); f.stop()
})
test('separate shell mounts start empty with independently verified identity', async () => {
  const a=setup(); await settle(); a.stop(); const b=setup(); b.changeUser('viewer-b'); await settle()
  assert.equal(b.state.reads.at(-1).viewer,'viewer-b'); assert.equal(a.state.reads.at(-1).viewer,'viewer-a'); b.stop()
})

test('same-viewer token refresh replaces a closing channel without SDK topic reuse', async () => {
  const f = setup(); await settle()
  f.state.delayRemoval = true
  for (let index = 0; index < 3; index++) {
    f.emitAuth('TOKEN_REFRESHED')
    await settle()
  }
  assert.equal(f.state.channels.length, 4)
  assert.equal(new Set(f.state.channels.map(channel => channel.name)).size, 4)
  assert.equal(f.state.reads.length, 4)
  assert.ok(f.state.channels.every(channel => channel.filter.filter === 'recipient_id=eq.viewer-a'))
  const latest = f.state.channels.at(-1)
  f.finishRemovals(); await settle()
  assert.deepEqual(f.state.activeChannels, [latest])
  f.state.count = 9; latest.callback(); await settle()
  assert.equal(f.counts.at(-1), 9)
  f.stop(); f.finishRemovals(); await settle()
  assert.equal(f.state.activeChannels.length, 0)
})
test('unmount during same-viewer re-verification does not open a replacement channel', async () => {
  const f = setup(); await settle()
  f.state.delayRemoval = true
  const pending = deferred(); f.state.authPending = pending
  f.emitAuth('TOKEN_REFRESHED'); await settle()
  f.stop()
  const before = f.counts.length
  pending.resolve({ data: { user: { id: 'viewer-a' } }, error: null })
  f.finishRemovals(); await settle()
  assert.equal(f.state.channels.length, 1)
  assert.equal(f.state.activeChannels.length, 0)
  assert.equal(f.counts.length, before)
})
