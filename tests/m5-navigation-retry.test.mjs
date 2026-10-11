import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// App Router uses Next's bundled renderer, not the top-level react-dom package.
// Exercise its real retry functions: a version string alone cannot detect a
// release/backport that still drops the synchronous Flight wake-up.
const require = createRequire(import.meta.url)
const rendererPath = require.resolve('next/dist/compiled/react-dom/cjs/react-dom-client.production.js')
const source = ts.createSourceFile(rendererPath, readFileSync(rendererPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const functionNames = ['attachPingListener', 'pingSuspendedRoot', 'markRootSuspended']
const rendererFunctions = functionNames.map(name => {
  const matches = source.statements.filter(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name)
  assert.equal(matches.length, 1, `Review the bundled renderer retry regression after upstream changes: ${name}`)
  return matches[0].getText(source)
}).join('\n')

function fixture({ lane = 256, suspended = lane, rendering = true, exitStatus = 4, sameRoot = true } = {}) {
  const root = {
    pingCache: null,
    pendingLanes: lane,
    suspendedLanes: suspended,
    pingedLanes: 0,
    warmLanes: suspended,
    expirationTimes: Array(31).fill(-1),
  }
  const calls = { scheduled: [], restarted: [] }
  const globals = {
    PossiblyWeakMap: WeakMap,
    Set,
    clz32: Math.clz32,
    now: () => 100,
    globalMostRecentFallbackTime: 0,
    executionContext: rendering ? 2 : 0,
    workInProgressRoot: sameRoot ? root : null,
    workInProgressRootRenderLanes: lane,
    workInProgressRootExitStatus: exitStatus,
    workInProgressRootPingedLanes: 0,
    workInProgressRootInterleavedUpdatedLanes: 0,
    workInProgressSuspendedRetryLanes: 0,
    workInProgressRootDidAttachPingListener: false,
    ensureRootIsScheduled: value => calls.scheduled.push(value),
    prepareFreshStack: (value, lanes) => calls.restarted.push({ root: value, lanes }),
    markSpawnedDeferredLane: () => assert.fail('This fixture does not spawn another lane'),
  }
  const functions = runInNewContext(rendererFunctions + '\n({ attachPingListener, pingSuspendedRoot, markRootSuspended })', globals, { filename: rendererPath })
  return { root, calls, globals, ...functions }
}

function resolvedFlightWakeable() {
  return {
    status: 'resolved_model',
    subscriptions: 0,
    then(resolve) {
      this.subscriptions++
      // Flight initializes a received model and synchronously calls listeners.
      this.status = 'fulfilled'
      resolve(null)
    },
  }
}

for (const suspended of [0, 256]) {
  test(`completed Flight model retains a renderable transition after unwind (previously suspended lanes: ${suspended})`, () => {
    const state = fixture({ suspended })
    const wakeable = resolvedFlightWakeable()
    state.attachPingListener(state.root, wakeable, 256)
    state.markRootSuspended(state.root, 256, 0, true)

    const renderable = state.root.pendingLanes & ~(state.root.suspendedLanes & ~state.root.pingedLanes)
    assert.equal(wakeable.status, 'fulfilled')
    assert.equal(wakeable.subscriptions, 1)
    assert.equal(renderable & 256, 256, 'A completed Flight response must leave work eligible for retry, not permanently suspended')
    assert.deepEqual(state.calls.restarted, [], 'Do not restart a stack while it is rendering')
    assert.deepEqual(state.calls.scheduled, [state.root])
  })
}

test('a completed wakeable outside render still restarts the suspended stack', () => {
  const state = fixture({ rendering: false })
  state.attachPingListener(state.root, resolvedFlightWakeable(), 256)
  assert.deepEqual(state.calls.restarted, [{ root: state.root, lanes: 0 }])
  assert.equal(state.root.pingedLanes & 256, 256)
  assert.deepEqual(state.calls.scheduled, [state.root])
})

test('a synchronous wake-up also preserves a retry lane during a recent fallback', () => {
  const retryLane = 4194304
  const state = fixture({ lane: retryLane, exitStatus: 3 })
  state.attachPingListener(state.root, resolvedFlightWakeable(), retryLane)
  state.markRootSuspended(state.root, retryLane, 0, true)
  const renderable = state.root.pendingLanes & ~(state.root.suspendedLanes & ~state.root.pingedLanes)
  assert.equal(renderable & retryLane, retryLane)
  assert.deepEqual(state.calls.restarted, [])
})

test('a later asynchronous wake-up schedules an already suspended root', async () => {
  const state = fixture({ sameRoot: false, rendering: false })
  let finish
  const wakeable = new Promise(resolve => { finish = resolve })
  state.attachPingListener(state.root, wakeable, 256)
  assert.equal(state.calls.scheduled.length, 0)
  finish(null)
  await wakeable
  assert.equal(state.root.pingedLanes & 256, 256)
  assert.deepEqual(state.calls.restarted, [])
  assert.deepEqual(state.calls.scheduled, [state.root])
})
