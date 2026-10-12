import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

// Read only the app's trusted local Next build, never a supplied remote manifest.
const build = new URL('../.next/', import.meta.url)
const manifest = new URL('server/app/feed/page_client-reference-manifest.js', build)
const context = {}
try {
  runInNewContext(await readFile(manifest, 'utf8'), context, { timeout: 1000 })
  const modules = context.__RSC_MANIFEST['/feed/page'].clientModules
  const directPaths = [...new Set(Object.values(modules).flatMap(module => module.chunks))]
  const directFiles = await Promise.all(directPaths.map(async path => {
    if (!/^\/_next\/static\/chunks\/[a-zA-Z0-9_.~/-]+\.js$/.test(path) || path.includes('..')) {
      throw new Error('Unexpected client chunk path; review the installed Next manifest format.')
    }
    return { path, gzipBytes: gzipSync(await readFile(new URL(path.slice('/_next/'.length), build))).length }
  }))
  const chunks = new URL('static/chunks/', build)
  const allPaths = (await readdir(chunks, { recursive: true })).filter(path => path.endsWith('.js'))
  const allSizes = await Promise.all(allPaths.map(async path => gzipSync(await readFile(fileURLToPath(chunks) + path)).length))
  console.log(JSON.stringify({
    measurement: 'Summed gzip build artifacts, not transfer size or complete first load',
    feedDirectChunks: directFiles,
    feedDirectGzipBytes: directFiles.reduce((sum, file) => sum + file.gzipBytes, 0),
    allClientChunkCount: allPaths.length,
    allClientGzipBytes: allSizes.reduce((sum, size) => sum + size, 0),
  }, null, 2))
} catch (error) {
  console.error('Unable to measure the local client build. Run npm run build first.', error.message)
  process.exitCode = 1
}
