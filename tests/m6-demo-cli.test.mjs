import test from 'node:test'
import assert from 'node:assert/strict'
import { run, parseArguments, guardedConnection } from '../scripts/demo/cli.mjs'
import { DATASET_ID } from '../scripts/demo/dataset.mjs'

const environment = { RECOSOCIAL_DEMO_MODE: 'local', RECOSOCIAL_DEMO_DATABASE_URL: 'postgresql://postgres:fixture-only@127.0.0.1:54322/postgres' }
const confirmed = ['seed', '--anchor=2026-10-12T12:00:00.000Z', `--confirm=${DATASET_ID}`]

test('plan is deterministic, bounded and never executes a connection', () => {
  const execute = () => assert.fail('Plan must not spawn psql')
  const plan = run([], {}, execute)
  assert.deepEqual(plan, run(['plan'], {}, execute))
  assert.equal(plan.writes, false)
  assert.deepEqual(plan.counts, { users: 30, categories: 10, posts: 300, follows: 33, likes: 808, saves: 139, comments: 86, preferences: 33 })
})

test('writes require explicit confirmation, local mode and non-production execution', () => {
  const execute = () => assert.fail('Guard failure must precede subprocess')
  for (const changes of [{ RECOSOCIAL_DEMO_MODE: '' }, { NODE_ENV: 'production' }, { VERCEL: '1' }, { RECOSOCIAL_DEMO_DATABASE_URL: undefined }]) {
    assert.throws(() => run(confirmed, { ...environment, ...changes }, execute))
  }
  assert.throws(() => run(['seed'], environment, execute))
  assert.throws(() => run(['reset', '--confirm=wrong'], environment, execute))
})

test('remote hosts, alternative ports, users, databases and connection options are rejected', () => {
  const urls = ['postgresql://postgres:x@production.supabase.co:54322/postgres', 'postgresql://postgres:x@127.0.0.1:5432/postgres',
    'postgresql://postgres:x@127.0.0.2:54322/postgres', 'postgresql://other:x@localhost:54322/postgres',
    'postgresql://postgres:x@localhost:54322/other', 'postgresql://postgres:x@localhost:54322/postgres?host=remote',
    'postgresql://postgres:x@localhost:54322/postgres#fragment', 'https://postgres:x@localhost:54322/postgres',
    'postgresql://postgres@localhost:54322/postgres']
  for (const url of urls) assert.throws(() => run(confirmed, { ...environment, RECOSOCIAL_DEMO_DATABASE_URL: url }, () => assert.fail('Invalid target executed')))
})

test('psql receives no credential arguments and cannot inherit PG target overrides', () => {
  let calls = 0
  run(confirmed, { ...environment, PGSERVICE: 'remote', PGHOST: 'remote', PGOPTIONS: '-c unsafe=true' }, (command, args, options) => {
    calls++
    assert.equal(command, 'psql')
    assert.equal(args.includes('-X'), true)
    assert.equal(args.join(' ').includes('fixture-only'), false)
    assert.equal(options.env.PGHOST, '127.0.0.1')
    assert.equal(options.env.PGSERVICE, undefined)
    assert.equal(options.env.RECOSOCIAL_DEMO_DATABASE_URL, undefined)
    assert.equal(options.env.PGOPTIONS, '-c recosocial.demo_mode=local')
    assert.equal(options.env.PGPASSWORD, 'fixture-only')
    assert.match(options.input, /begin;[\s\S]*commit;/)
    assert.equal(options.windowsHide, true)
    assert.equal(options.timeout, 120000)
    return { status: 0 }
  })
  assert.equal(calls, 1)
  const env = guardedConnection({ ...environment, RECOSOCIAL_DEMO_DATABASE_URL: 'postgresql://postgres:p%40ss@localhost:54322/postgres' }, { confirm: DATASET_ID })
  assert.equal(env.PGPASSWORD, 'p@ss')
})

test('reset is explicit and failures never forward raw subprocess secrets', () => {
  run(['reset', `--confirm=${DATASET_ID}`], environment, (_command, _args, options) => {
    assert.match(options.input, /delete from auth.users/)
    assert.doesNotMatch(options.input, /insert into auth.users/)
    return { status: 0 }
  })
  assert.throws(() => run(confirmed, environment, () => ({ status: 1, stderr: 'secret-connection-url' })), error => !error.message.includes('secret-connection-url'))
  assert.throws(() => run(confirmed, environment, () => ({ error: { code: 'ENOENT' } })), /psql client/)
})

test('invalid CLI parameters and nonlocal media are rejected', () => {
  for (const args of [['seed', '--force'], ['seed', '--anchor=x', '--anchor=y'], ['reset', '--anchor=x'], ['unknown']]) {
    assert.throws(() => parseArguments(args))
  }
  assert.throws(() => run(['plan', '--media-origin=https://example.com'], {}))
  assert.throws(() => run(['plan', '--media-origin=http://localhost:3000/path'], {}))
  assert.throws(() => run(['plan', '--anchor=invalid'], {}))
})
