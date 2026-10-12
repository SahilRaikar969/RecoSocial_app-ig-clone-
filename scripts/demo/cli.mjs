import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createDemoDataset, DATASET_ID } from './dataset.mjs'
import { buildSeedSql, buildResetSql } from './sql.mjs'

export function parseArguments(args) {
  const [command = 'plan', ...flags] = args
  if (!['plan', 'seed', 'reset'].includes(command)) throw new Error('Use plan, seed or reset.')
  const options = { command }
  for (const flag of flags) {
    const match = /^--(confirm|anchor|media-origin)=(.+)$/.exec(flag)
    if (!match || Object.hasOwn(options, match[1])) throw new Error('Unknown or repeated demo option.')
    options[match[1]] = match[2]
  }
  if (command === 'reset' && (options.anchor || options['media-origin'])) throw new Error('Reset takes only --confirm.')
  return options
}

export function guardedConnection(environment, options) {
  if (environment.RECOSOCIAL_DEMO_MODE !== 'local' || options.confirm !== DATASET_ID ||
      environment.NODE_ENV === 'production' || environment.VERCEL) {
    throw new Error('Demo writes require local mode, explicit dataset confirmation and a non-production process.')
  }
  let url
  try { url = new URL(environment.RECOSOCIAL_DEMO_DATABASE_URL) } catch { throw new Error('Set an explicit local demo database URL.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '54322' || url.pathname !== '/postgres' || url.username !== 'postgres' || !url.password || url.search || url.hash) {
    throw new Error('Demo writes allow only postgres at local loopback port 54322, database postgres, without URL options.')
  }
  const env = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.toUpperCase().startsWith('PG')))
  // A URL is never passed as a command argument or logged. Disable inherited
  // PG service/host/options overrides and force numeric loopback (no DNS).
  delete env.RECOSOCIAL_DEMO_DATABASE_URL
  return { ...env, PGHOST: '127.0.0.1', PGPORT: '54322', PGDATABASE: 'postgres', PGUSER: 'postgres',
    PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c recosocial.demo_mode=local' }
}

export function run(args, environment, execute = spawnSync) {
  const options = parseArguments(args)
  if (options.command === 'seed' && !options.anchor) throw new Error('Seed requires an explicit --anchor UTC date; reuse it for idempotent reruns.')
  const mediaOrigin = options['media-origin'] ?? 'http://127.0.0.1:3000'
  const origin = new URL(mediaOrigin)
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname)) {
    throw new Error('Demo media must use a local HTTP application origin.')
  }
  const dataset = createDemoDataset({ anchor: options.anchor, mediaOrigin })
  const counts = Object.fromEntries(['users', 'categories', 'posts', 'follows', 'likes', 'saves', 'comments', 'preferences'].map(key => [key, dataset[key].length]))
  if (options.command === 'plan') return { command: 'plan', dataset: DATASET_ID, anchor: dataset.anchor, mediaOrigin: dataset.mediaOrigin, counts, writes: false }
  const env = guardedConnection(environment, options)
  const result = execute('psql', ['-X', '--no-password', '--set', 'ON_ERROR_STOP=1', '--quiet'], {
    input: options.command === 'seed' ? buildSeedSql(dataset) : buildResetSql(),
    env, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 120_000, windowsHide: true,
  })
  // Do not forward raw driver output: connection errors can contain secrets.
  if (result.error?.code === 'ENOENT') throw new Error('Install the PostgreSQL psql client before local demo seeding.')
  if (result.error || result.status !== 0) throw new Error('Local demo transaction failed or timed out; no success claimed. Check local schema, ownership, and parameters; rerun unchanged to reconcile an uncertain result.')
  return { command: options.command, dataset: DATASET_ID, result: options.command === 'seed' ? 'Seed applied or existing identical seed retained.' : 'Demo dataset reset (or already absent).' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(run(process.argv.slice(2), process.env), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
