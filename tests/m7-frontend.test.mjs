import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props: props ?? {} })
function load(file, mocks, globals = {}) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const testModule = { exports: {} }
  runInNewContext(outputText, { module: testModule, exports: testModule.exports, URL, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (Object.hasOwn(mocks, name)) return mocks[name]
    throw new Error('Unexpected dependency: ' + name)
  } }, { filename })
  return testModule.exports
}
function hooks() {
  const cells = [], pending = [], cleanups = []
  let cursor = 0
  return {
    render(fn) { cursor = 0; const result = fn(); for (const effect of pending.splice(0)) effect(); return result },
    unmount() { cleanups.forEach(cleanup => cleanup?.()) },
    react: {
      useState(initial) { const slot = cursor++; if (!(slot in cells)) cells[slot] = initial; return [cells[slot], next => { cells[slot] = typeof next === 'function' ? next(cells[slot]) : next }] },
      useMemo(fn) { return fn() },
      useCallback(fn) { return fn },
      useEffect(fn, deps) {
        const slot = cursor++, previous = cells[slot]
        if (!previous || deps.some((value, i) => value !== previous[i])) {
          cells[slot] = deps
          pending.push(() => { cleanups[slot]?.(); cleanups[slot] = fn() })
        }
      },
      useSyncExternalStore(subscribe, snapshot) {
        const slot = cursor++
        if (!(slot in cells)) { cells[slot] = true; cleanups[slot] = subscribe(() => {}) }
        return snapshot()
      },
    },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function content(tree) {
  if (tree == null) return ''
  if (Array.isArray(tree)) return tree.map(content).join('')
  return typeof tree === 'object' ? content(tree.props?.children) : String(tree)
}
function formFixture(file, name, props) {
  const h = hooks()
  const action = async () => {}
  const Component = load(file, {
    react: h.react, 'react-dom': { useFormStatus: () => ({ pending: false }) },
    'next/link': { default: 'a' },
    '@/lib/media/use-object-url': { useObjectUrl: file => file ? 'blob:local' : '' },
    '@/lib/media/use-media-form-action': { useMediaFormAction: () => action },
    '@/actions/posts': { createPost: action, updatePost: action },
    '@/actions/profile': { updateProfile: action },
    '@/components/ui/smart-image': { SmartImage: 'Image' },
    '@/components/profile/avatar-crop-editor': { AvatarCropEditor: 'Crop' },
  })[name]
  return { ...h, render: () => h.render(() => Component(props)) }
}
const categories = [{ id: 'travel', name: 'Travel', slug: 'travel' }]
const profile = { id: 'viewer', username: 'alice', display_name: 'Alice', bio: '', avatar_url: '' }

for (const [file, name, props, field] of [
  ['components/create/create-post-form.tsx', 'CreatePostForm', { profileId: 'viewer', categories }, 'media_file'],
  ['components/profile/edit-profile-form.tsx', 'EditProfileForm', { profile }, 'avatar_file'],
]) test(name + ' keeps fresh HEIC validation after replacing a valid file, then clears it on the next edit', () => {
  const f = formFixture(file, name, props)
  let tree = f.render()
  const change = file => {
    tree.props.onChangeCapture?.()
    nodes(tree).find(node => node.props.name === field).props.onChange({ target: { files: [file] }, currentTarget: { value: '' } })
    f.render()
    tree = f.render()
  }
  change(new File(['image'], 'valid.jpg', { type: 'image/jpeg' }))
  change(new File(['unsupported'], 'invalid.heic', { type: 'image/heic' }))
  assert.match(content(nodes(tree).find(node => node.props.role === 'alert')), /HEIC and HEIF are not supported/)
  tree.props.onChangeCapture?.()
  assert.ok(!nodes(f.render()).some(node => node.props.role === 'alert'))
  f.unmount()
})

test('edit media type clears a replacement cover but restores the existing signed cover when returning to video', () => {
  const cover = 'https://media.example.test/cover.jpg?token=retained'
  const post = { id: 'post', author_id: 'viewer', caption: '', media_type: 'video', media_path: 'https://media.example.test/clip.mp4', thumbnail_path: cover, created_at: '2026-10-12', updated_at: '2026-10-12', post_categories: [] }
  const f = formFixture('components/post/edit-post-form.tsx', 'EditPostForm', { profileId: 'viewer', categories, post })
  let tree = f.render()
  nodes(tree).find(node => node.type === 'button' && content(node) === 'Image').props.onClick()
  tree = f.render()
  assert.ok(!nodes(tree).some(node => node.props.id === 'post-thumbnail-url'))
  nodes(tree).find(node => node.type === 'button' && content(node) === 'Video').props.onClick()
  tree = f.render()
  assert.equal(nodes(tree).find(node => node.props.id === 'post-thumbnail-url').props.value, cover)
})

test('stored unmuted preference survives hydration and only explicit toggles write storage', () => {
  const h = hooks(), writes = [], listeners = new Set()
  const window = { localStorage: { getItem: () => '0', setItem: (...args) => writes.push(args) }, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) }
  const { useMutedPreference } = load('lib/media/use-muted-preference.ts', { react: h.react }, { window })
  const render = () => h.render(() => useMutedPreference('recosocial_video_muted'))
  assert.equal(render()[0], false)
  assert.deepEqual(writes, [])
  render()[1]()
  assert.equal(render()[0], true)
  assert.deepEqual(writes, [['recosocial_video_muted', '1']])
  h.unmount()
  assert.equal(listeners.size, 0)
})

test('mute controls still work when storage is denied, and SSR always starts muted', () => {
  const h = hooks()
  const window = { localStorage: { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }, addEventListener() {}, removeEventListener() {} }
  const { useMutedPreference } = load('lib/media/use-muted-preference.ts', { react: h.react }, { window })
  const render = () => h.render(() => useMutedPreference('recosocial_reel_muted'))
  assert.equal(render()[0], true)
  render()[1]()
  assert.equal(render()[0], false)
  const server = hooks()
  server.react.useSyncExternalStore = (_subscribe, _snapshot, serverSnapshot) => serverSnapshot()
  const { useMutedPreference: serverHook } = load('lib/media/use-muted-preference.ts', { react: server.react })
  assert.equal(server.render(() => serverHook('recosocial_reel_muted'))[0], true)
})
