import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const mod = { exports: {} }
  runInNewContext(output, { module: mod, exports: mod.exports, URL, require(name) {
    if (name === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) }
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) }
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
    if (name.startsWith('@/actions/')) return {}
    if (name.startsWith('@/')) {
      const source = name.slice(2)
      return load(existsSync(new URL('../' + source + '.tsx', import.meta.url)) ? source + '.tsx' : source + '.ts')
    }
    return require(name)
  } }, { filename })
  return mod.exports
}
const { ReelViewer } = load('components/reels/reel-viewer.tsx')
const reels = Array.from({ length: 13 }, (_, index) => ({
  id: 'post-' + index, author_id: 'owner', caption: 'Reel ' + index, created_at: '2026-10-09',
  media_url: `https://media.example.test/video-${index}.mp4?token=signed&expires=123`,
  thumbnail_url: `https://media.example.test/thumb-${index}.png?token=signed&expires=123`,
  like_count: index, save_count: index, comment_count: 0, liked_by_me: false, saved_by_me: false, author: null,
}))
function render(index = 0, items = reels) {
  return renderToStaticMarkup(React.createElement(ReelViewer, {
    reels: items, initialPostId: items[index].id, viewerProfileId: 'viewer', backHref: '/feed?view=following&page=2',
  }))
}
function tags(html, name) { return Array.from(html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'g')), match => match[0]) }
function attribute(tag, name) { return tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))?.[1] }

for (const index of [0, 6, 12]) test(`only the active reel fully preloads and immediate neighbors fetch metadata at index ${index}`, () => {
  const videos = tags(render(index), 'video')
  assert.equal(videos.length, 13)
  const policies = videos.map(video => attribute(video, 'preload'))
  assert.equal(policies.filter(value => value === 'auto').length, 1)
  assert.equal(policies[index], 'auto')
  assert.equal(policies.filter(value => value === 'metadata').length, index === 6 ? 2 : 1)
  for (let offset = 0; offset < policies.length; offset++) {
    if (Math.abs(offset - index) > 1) assert.equal(policies[offset], 'none')
  }
})

test('current poster has eager high priority; distant and decorative images stay lazy', () => {
  const images = tags(render(6), 'img')
  assert.equal(images.length, 26)
  const eager = images.filter(image => attribute(image, 'loading') === 'eager')
  assert.equal(eager.length, 1)
  assert.equal(attribute(eager[0], 'fetchPriority'), 'high')
  assert.match(attribute(eager[0], 'src'), /thumb-6\.png/)
  for (const image of images.filter(image => attribute(image, 'alt') === '')) {
    assert.equal(attribute(image, 'loading'), 'lazy')
    assert.equal(attribute(image, 'decoding'), 'async')
  }
})

test('preload policy preserves media URL signing parameters, reel order, and navigation context', () => {
  const html = render(6)
  const videos = tags(html, 'video')
  for (let index = 0; index < videos.length; index++) {
    assert.equal(attribute(videos[index], 'src').replaceAll('&amp;', '&'), reels[index].media_url)
    assert.equal(attribute(videos[index], 'poster').replaceAll('&amp;', '&'), reels[index].thumbnail_url)
  }
  assert.deepEqual(Array.from(html.matchAll(/data-post-id="([^"]+)"/g), match => match[1]), reels.map(reel => reel.id))
  assert.ok(html.includes('href="/feed?view=following&amp;page=2"'))
})
