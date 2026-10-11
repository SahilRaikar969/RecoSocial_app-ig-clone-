import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props: props ?? {} })
function loadTs(path, mocks) {
  const filename = fileURLToPath(new URL('../' + path, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const testModule = { exports: {} }
  runInNewContext(outputText, {
    module: testModule, exports: testModule.exports, URL,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (Object.hasOwn(mocks, name)) return mocks[name]
      throw new Error('Unexpected dependency: ' + name)
    },
  }, { filename })
  return testModule.exports
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props))
  return [tree, ...nodes(tree.props.children)]
}
function content(tree) {
  if (tree == null) return ''
  if (Array.isArray(tree)) return tree.map(content).join('')
  if (typeof tree !== 'object') return String(tree)
  if (typeof tree.type === 'function') return content(tree.type(tree.props))
  return content(tree.props.children)
}
function fixture(path, name, props = {}, { pending = false } = {}) {
  const states = []
  let cursor = 0
  let mediaCall
  const action = async () => {}
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
    },
    useMemo(fn) { return fn() },
    useEffect() {},
  }
  const component = loadTs(path, {
    react,
    'react-dom': { useFormStatus: () => ({ pending }) },
    'next/link': { __esModule: true, default: props => jsx('a', props) },
    '@/lib/media/use-object-url': { useObjectUrl: file => file ? 'blob:local-preview' : '' },
    '@/lib/media/use-media-form-action': { useMediaFormAction(...args) { mediaCall = args; return action } },
    '@/actions/posts': { createPost: action, updatePost: action },
    '@/actions/profile': { updateProfile: action },
    '@/actions/stories': { createStory: action },
    '@/actions/onboarding': { saveOnboardingPreferences: action },
    '@/components/ui/smart-image': { SmartImage: props => jsx('img', props) },
    '@/components/profile/avatar-crop-editor': { AvatarCropEditor: () => null },
  })[name]
  return {
    render() { cursor = 0; return component(props) },
    get mediaCall() { return mediaCall },
  }
}
const categories = [{ id: 'travel', name: 'Travel', slug: 'travel' }, { id: 'art', name: 'Art', slug: 'art' }]
const post = { id: 'post-1', author_id: 'viewer', caption: 'Original', media_type: 'image', media_path: 'https://example.test/a.jpg?signature=kept', thumbnail_path: null, updated_at: '2026-10-09T12:00:00Z', created_at: '2026-10-08T12:00:00Z', post_categories: [{ category_id: 'travel', categories: categories[0] }] }
const profile = { id: 'viewer', username: 'alice', display_name: 'Alice', bio: '', avatar_url: '' }
function assertFieldLabels(tree) {
  const all = nodes(tree)
  for (const input of all.filter(n => ['input', 'textarea', 'select'].includes(n.type) && n.props.type !== 'hidden' && n.props.type !== 'checkbox')) {
    assert.ok(input.props.id, 'each visible field has an id')
    const label = all.find(n => n.type === 'label' && n.props.htmlFor === input.props.id)
    assert.ok(label && content(label).trim(), 'visible bound label for ' + input.props.id)
    for (const id of (input.props['aria-describedby'] || '').split(' ').filter(Boolean)) assert.ok(all.some(n => n.props.id === id), 'description exists for ' + id)
  }
}

test('password visibility is a named non-submit toggle preserving native form attributes', () => {
  const f = fixture('components/auth/password-field.tsx', 'PasswordField', { id: 'password', name: 'password', label: 'Password', required: true, autoComplete: 'current-password' })
  let all = nodes(f.render())
  assertFieldLabels(f.render())
  let input = all.find(n => n.type === 'input')
  assert.equal(input.props.type, 'password')
  assert.equal(input.props.name, 'password')
  assert.equal(input.props.autoComplete, 'current-password')
  const toggle = all.find(n => n.type === 'button')
  assert.equal(toggle.props.type, 'button')
  assert.equal(toggle.props['aria-controls'], 'password')
  assert.equal(toggle.props['aria-label'], 'Show password')
  toggle.props.onClick()
  all = nodes(f.render())
  input = all.find(n => n.type === 'input')
  assert.equal(input.props.type, 'text')
  assert.equal(all.find(n => n.type === 'button').props['aria-pressed'], true)
  all.find(n => n.type === 'button').props.onClick()
  assert.equal(nodes(f.render()).find(n => n.type === 'input').props.type, 'password')
})

test('auth submit disables duplicate submits and announces the real pending state', () => {
  for (const pending of [false, true]) {
    const f = fixture('components/auth/auth-submit-button.tsx', 'AuthSubmitButton', { children: 'Sign in', pendingLabel: 'Signing in…' }, { pending })
    const button = nodes(f.render())[0]
    assert.equal(button.props.type, 'submit')
    assert.equal(button.props.disabled, pending)
    assert.equal(button.props['aria-live'], 'polite')
    assert.equal(content(button), pending ? 'Signing in…' : 'Sign in')
  }
})

test('onboarding has native named checkbox choices without nested controls, preserving category payloads', () => {
  const f = fixture('components/onboarding/onboarding-form.tsx', 'OnboardingForm', { profileId: 'viewer', categories })
  let tree = f.render(), all = nodes(tree)
  assert.equal(all.filter(n => n.type === 'input' && n.props.name === 'categories').length, 2)
  for (const checkbox of all.filter(n => n.props.type === 'checkbox')) {
    assert.ok(all.some(n => n.type === 'label' && nodes(n).includes(checkbox)), 'checkbox has native label')
    assert.equal(checkbox.props.checked, false)
  }
  assert.ok(all.filter(n => n.type === 'button').every(n => nodes(n).every(child => child.type !== 'input')))
  let prevented = false
  tree.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.match(content(nodes(f.render()).find(n => n.props.role === 'alert')), /Choose at least one/)
  nodes(f.render()).find(n => n.props.type === 'checkbox').props.onChange()
  tree = f.render(); all = nodes(tree)
  assert.equal(all.find(n => n.props.type === 'checkbox').props.checked, true)
  assert.equal(all.find(n => n.props.type === 'checkbox').props.value, 'Travel')
  assert.ok(!all.some(n => n.props.role === 'alert'))
  prevented = false
  tree.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, false)
})

for (const [path, name, props] of [
  ['components/create/create-post-form.tsx', 'CreatePostForm', { profileId: 'viewer', categories }],
  ['components/post/edit-post-form.tsx', 'EditPostForm', { profileId: 'viewer', categories, post }],
  ['components/profile/edit-profile-form.tsx', 'EditProfileForm', { profile }],
  ['components/stories/create-story-form.tsx', 'CreateStoryForm', {}],
]) test(name + ' binds visible fields and announces publication/save errors', () => {
  const f = fixture(path, name, { ...props, errorMessage: 'Upload failed. Please retry.' })
  const tree = f.render()
  assertFieldLabels(tree)
  assert.match(content(nodes(tree).find(n => n.props.role === 'alert')), /Upload failed/)
  assert.doesNotMatch(content(tree), /ranking|creator surface|identity layer|workflow|checklist|your_profile/i)
})

test('create media modes remain explicit and selected files reach the retained-file upload hook', () => {
  const f = fixture('components/create/create-post-form.tsx', 'CreatePostForm', { profileId: 'viewer', categories })
  let tree = f.render()
  const image = new File(['synthetic'], 'selected.jpg', { type: 'image/jpeg' })
  nodes(tree).find(n => n.props.name === 'media_file').props.onChange({ target: { files: [image] } })
  tree = f.render()
  assert.equal(f.mediaCall[3].media_file, image)
  assert.equal(nodes(tree).find(n => n.type === 'img').props.src, 'blob:local-preview')
  nodes(tree).find(n => n.type === 'button' && content(n) === 'Travel').props.onClick()
  tree = f.render()
  assert.equal(nodes(tree).find(n => n.props.type === 'hidden' && n.props.name === 'categories').props.value, 'Travel')
  nodes(tree).find(n => n.type === 'button' && content(n) === 'Use a link').props.onClick()
  tree = f.render()
  assert.equal(f.mediaCall[3].media_file, null)
  assert.ok(!nodes(tree).some(n => n.props.name === 'media_file'))
  assertFieldLabels(tree)
  nodes(tree).find(n => n.type === 'button' && content(n) === 'Video').props.onClick()
  tree = f.render()
  assertFieldLabels(tree)
  assert.ok(nodes(tree).some(n => n.props.name === 'thumbnail_file'))
})

test('edit form retains concurrency version and existing signed source when choosing replacement mode', () => {
  const f = fixture('components/post/edit-post-form.tsx', 'EditPostForm', { profileId: 'viewer', categories, post })
  let tree = f.render()
  let all = nodes(tree)
  assert.equal(all.find(n => n.props.name === 'expected_updated_at').props.value, post.updated_at)
  assert.equal(all.find(n => n.props.name === 'post_id').props.value, post.id)
  assert.equal(all.find(n => n.props.name === 'media_path').props.value, post.media_path)
  assert.equal(all.find(n => n.type === 'img').props.src, post.media_path)
  all.find(n => n.type === 'button' && content(n) === 'Upload replacement').props.onClick()
  tree = f.render(); all = nodes(tree)
  assert.equal(all.find(n => n.props.name === 'media_path' && n.props.type === 'hidden').props.value, post.media_path)
  assert.equal(all.find(n => n.props.name === 'expected_updated_at').props.value, post.updated_at)
  assertFieldLabels(tree)
})

test('story covers are absent for images and labeled when video is selected', () => {
  const f = fixture('components/stories/create-story-form.tsx', 'CreateStoryForm')
  let tree = f.render()
  assert.ok(!nodes(tree).some(n => n.props.name === 'thumbnail_file'))
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: 'video' } })
  tree = f.render()
  assert.ok(nodes(tree).some(n => n.props.name === 'thumbnail_file'))
  assertFieldLabels(tree)
})
