import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props: props ?? {} })
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL('../' + path, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const mod = { exports: {} }
  runInNewContext(outputText, {
    module: mod, exports: mod.exports, URL,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' } },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/lib/media/')) return load(name.slice(2) + '.ts', mocks)
      throw new Error('Unexpected dependency: ' + name)
    },
  }, { filename })
  return mod.exports
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props.children)]
}
const owner = '10000000-0000-4000-8000-000000000001'
const categories = [{ id: 'travel', name: 'Travel', slug: 'travel' }]
const basePost = {
  id: 'post', author_id: owner, caption: 'Original caption', media_type: 'video',
  media_path: 'videos/' + owner + '/upload.webm', thumbnail_path: 'thumbnails/' + owner + '/cover.png',
  updated_at: '2026-10-12T00:00:00Z', created_at: '2026-10-11T00:00:00Z',
  post_categories: [{ category_id: 'travel', categories: categories[0] }],
}
async function editProps(post = basePost) {
  const Page = load('app/post/[postId]/edit/page.tsx', {
    'next/navigation': { notFound() { throw new Error('not found') }, redirect() { throw new Error('unauthorized') } },
    '@/components/post/edit-post-form': { EditPostForm: 'EditPostForm' },
    '@/components/ui/page-shell': { PageShell: 'PageShell' },
    '@/components/ui/surface-hero': { SurfaceHero: 'SurfaceHero' },
    '@/lib/auth/session': { requireSession: async () => ({ profileId: owner }) },
    '@/lib/db/queries/categories': { getAllCategories: async () => categories },
    '@/lib/db/queries/post-edit': { getEditablePost: async () => ({ post }) },
  }).default
  return nodes(await Page({ params: Promise.resolve({ postId: post.id }) })).find(n => n.type === 'EditPostForm').props
}
function fixture(props) {
  const states = []; let cursor = 0
  const Component = load('components/post/edit-post-form.tsx', {
    react: { useMemo: fn => fn(), useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    } },
    'react-dom': { useFormStatus: () => ({ pending: false }) },
    'next/link': { default: 'a' },
    '@/components/ui/smart-image': { SmartImage: 'img' },
    '@/lib/media/use-object-url': { useObjectUrl: () => '' },
    '@/lib/media/use-media-form-action': { useMediaFormAction: () => async () => {} },
    '@/actions/posts': { updatePost: async () => {} },
  }).EditPostForm
  return { render() { cursor = 0; return Component(props) } }
}
function field(tree, id) { return nodes(tree).find(n => n.props.id === id) }
function value(tree, name) {
  const inputs = nodes(tree).filter(n => n.type === 'input' && n.props.name === name)
  assert.equal(inputs.length, 1, 'exactly one submitted value for ' + name)
  return inputs[0].props.value
}
function assertCanSubmit(tree) {
  for (const input of nodes(tree).filter(n => n.type === 'input' && n.props.type === 'url' && n.props.value)) {
    assert.doesNotThrow(() => new URL(input.props.value), 'native URL field must contain an absolute URL')
  }
  let prevented = false
  tree.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, false, 'client validation allows preserving uploaded media')
}

for (const extension of ['webm', 'm4v', 'ogg']) test('uploaded ' + extension + ' post and cover preview and retain owner paths during metadata edit', async () => {
  const post = { ...basePost, media_path: 'videos/' + owner + '/upload.' + extension }
  const f = fixture(await editProps(post))
  let tree = f.render()
  assertCanSubmit(tree)
  const video = nodes(tree).find(n => n.type === 'video')
  assert.equal(video.props.src, 'http://127.0.0.1:54321/storage/v1/object/public/media/' + post.media_path)
  assert.equal(video.props.poster, 'http://127.0.0.1:54321/storage/v1/object/public/media/' + post.thumbnail_path)
  field(tree, 'post-caption').props.onChange({ target: { value: 'Changed caption only' } })
  tree = f.render()
  assertCanSubmit(tree)
  assert.equal(value(tree, 'media_path'), post.media_path, 'server receives the unchanged reference for comparison with the verified owned row')
  assert.equal(value(tree, 'thumbnail_path'), post.thumbnail_path)
  assert.equal(value(tree, 'expected_updated_at'), post.updated_at)
})

test('uploaded image preview resolves to a browser URL while submission retains the owner path', async () => {
  const post = { ...basePost, media_type: 'image', media_path: 'images/' + owner + '/image.png', thumbnail_path: null }
  const f = fixture(await editProps(post)), tree = f.render()
  assertCanSubmit(tree)
  assert.equal(nodes(tree).find(n => n.type === 'img').props.src, 'http://127.0.0.1:54321/storage/v1/object/public/media/' + post.media_path)
  assert.equal(value(tree, 'media_path'), post.media_path)
  assert.ok(!nodes(tree).some(n => n.props.name === 'thumbnail_path'))
})

test('changing a media link submits the new link and clearing an optional cover does not restore the prior one', async () => {
  const f = fixture(await editProps())
  let tree = f.render()
  field(tree, 'post-media-url').props.onChange({ target: { value: 'https://example.test/replacement.webm' } })
  field(tree, 'post-thumbnail-url').props.onChange({ target: { value: '' } })
  tree = f.render()
  assertCanSubmit(tree)
  assert.equal(value(tree, 'media_path'), 'https://example.test/replacement.webm')
  assert.equal(value(tree, 'thumbnail_path'), '')
  assert.equal(nodes(tree).find(n => n.type === 'video').props.poster, undefined)
})

test('signed URLs retain query tokens and upload replacement retains the original source until replaced', async () => {
  const post = { ...basePost, media_path: 'https://example.test/source.webm?token=fixture', thumbnail_path: 'https://example.test/cover.png?token=fixture' }
  const f = fixture(await editProps(post))
  let tree = f.render()
  assertCanSubmit(tree)
  assert.equal(value(tree, 'media_path'), post.media_path)
  assert.equal(value(tree, 'thumbnail_path'), post.thumbnail_path)
  nodes(tree).find(n => n.type === 'button' && n.props.children === 'Upload replacement').props.onClick()
  tree = f.render()
  assertCanSubmit(tree)
  assert.equal(value(tree, 'media_path'), post.media_path)
})
