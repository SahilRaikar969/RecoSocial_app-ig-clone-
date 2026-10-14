import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))

test('generated database check accepts Git newline variants, rejects schema drift and never rewrites source', async () => {
  // Keep the disposable project beneath tests so imports resolve the installed
  // PGlite dependency without copying node_modules or relying on the npm cache.
  const parent = resolve(root, 'tests')
  const fixture = await mkdtemp(join(parent, '.generated-types-'))
  try {
    for (const file of ['scripts/generate-database-types.mjs', 'supabase/tests/database.mjs']) {
      const destination = join(fixture, file)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(join(root, file), destination)
    }
    await cp(join(root, 'supabase/migrations'), join(fixture, 'supabase/migrations'), { recursive: true })
    const target = join(fixture, 'lib/supabase/database.types.ts')
    await mkdir(dirname(target), { recursive: true })
    const source = (await readFile(join(root, 'lib/supabase/database.types.ts'), 'utf8')).replace(/\r\n/g, '\n')
    for (const [name, candidate, passes] of [
      ['LF', source, true],
      ['CRLF', source.replace(/\n/g, '\r\n'), true],
      ['schema drift', source.replace('export type Json = string', 'export type Json = number'), false],
    ]) {
      await writeFile(target, candidate)
      const result = spawnSync(process.execPath, [join(fixture, 'scripts/generate-database-types.mjs'), '--check'], {
        cwd: fixture, encoding: 'utf8', timeout: 30000,
      })
      assert.ifError(result.error)
      assert.equal(result.status === 0, passes, `${name}: ${result.stdout}\n${result.stderr}`)
      if (!passes) assert.match(result.stderr, /Database types are stale/)
      assert.equal(await readFile(target, 'utf8'), candidate, `${name}: check mode must not write`)
    }
  } finally {
    const within = relative(parent, resolve(fixture))
    assert.ok(within.startsWith('.generated-types-') && !within.includes(sep), 'Cleanup stays within the one temporary test project')
    await rm(fixture, { recursive: true, force: true })
  }
})
