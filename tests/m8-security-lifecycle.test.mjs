import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
function load(file, mocks = {}, globals = {}) {
  const filename = new URL('../' + file, import.meta.url)
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  runInNewContext(source, {
    module: mod, exports: mod.exports, URL, ...globals,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks, globals)
      throw new Error('Unexpected dependency: ' + name)
    },
  }, { filename: filename.pathname })
  return mod.exports
}
function hooks() {
  const cells = []
  let cursor = 0
  return {
    reset() { cursor = 0 },
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
        return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }]
      },
      useRef(initial) {
        const index = cursor++
        if (!(index in cells)) cells[index] = { current: initial }
        return cells[index]
      },
      useCallback(fn) { return fn },
      useEffect() {},
      useId() { return 'comment-input' },
      useMemo(fn) { return fn() },
      useOptimistic(initial) { return [initial, () => {}] },
      useTransition() { return [false, fn => fn()] },
      useSyncExternalStore(_subscribe, snapshot) { return snapshot() },
    },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

// Preserve component state exactly when the real Server Component returns the
// same React key. This exercises route identity plus actual seen-state behavior.
test('same-story account A to B to guest to A refresh isolates private seen state', async () => {
  const storyId = '80000000-0000-4000-8000-000000000001'
  let viewer = null, mountedKey, state = hooks()
  const writes = []
  const mocks = {
    react: new Proxy({}, { get: (_target, name) => (...args) => state.react[name](...args) }),
    'next/link': { default: 'a' },
    'next/navigation': { useRouter: () => ({ push() {}, refresh() {} }), notFound() { throw Error('not found') } },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/actions/stories': { async markStoryViewed(id) { writes.push([viewer, id]); return { ok: true } } },
  }
  const globals = { document: { hidden: false }, window: { matchMedia: () => ({ matches: false }) } }
  const { StoryViewer } = load('components/stories/story-viewer.tsx', mocks, globals)
  const Page = load('app/stories/[storyId]/page.tsx', {
    ...mocks,
    '@/components/stories/story-viewer': { StoryViewer },
    '@/lib/auth/session': { async getOptionalSession() { return viewer ? { profileId: viewer } : null } },
    '@/lib/db/queries/stories': { async getStoryViewerData(profileId) {
      return {
        author: { id: 'author', username: 'creator', display_name: 'Creator' }, initialIndex: 0,
        stories: [{ id: storyId, media_type: 'image', media_url: '/demo.svg', caption: 'Demo', created_at: '2026-10-12', expires_at: '2099-01-01T00:00:00Z', viewed: profileId === 'account-a' }],
      }
    } },
  }).default
  const refresh = async () => {
    const element = await Page({ params: Promise.resolve({ storyId }) })
    if (element.key !== mountedKey) { state = hooks(); mountedKey = element.key }
    state.reset()
    const tree = element.type(element.props)
    const media = nodes(tree).find(node => typeof node.type === 'function' && node.type.name === 'StoryMedia')
    assert.ok(media)
    media.props.onReady()
    await Promise.resolve()
    return tree
  }
  await refresh()
  assert.deepEqual(writes, [], 'initial guest readiness never creates a view')
  viewer = 'account-a'
  await refresh()
  assert.deepEqual(writes, [], 'guest to A uses A authoritative viewed state')
  viewer = 'account-b'
  await refresh()
  assert.deepEqual(writes, [['account-b', storyId]], 'B must persist their own first view')
  const beforePause = await refresh()
  assert.equal(writes.length, 1, 'the same viewer does not duplicate an acknowledged view')
  nodes(beforePause).find(node => node.props['aria-label'] === 'Pause story').props.onClick()
  const paused = await refresh()
  assert.ok(nodes(paused).some(node => node.props['aria-label'] === 'Resume story'))
  viewer = null
  const signedOut = await refresh()
  assert.ok(nodes(signedOut).some(node => node.props['aria-label'] === 'Pause story'), 'logout clears previous viewer playback state')
  assert.equal(writes.length, 1, 'guest viewing does not write private state')
  viewer = 'account-a'
  await refresh()
  assert.equal(writes.length, 1, 'switching back restores A authoritative viewed state')
  viewer = null
  await refresh()
  viewer = 'account-b'
  await refresh()
  assert.deepEqual(writes, [['account-b', storyId], ['account-b', storyId]], 'guest to an authoritatively unseen B Story enables its own view write')
})

for (const surface of ['Feed card', 'post detail']) {
  test(`${surface} discards an unsent private comment draft when the verified viewer changes`, async () => {
    let viewer = 'account-a', mountedKey, state = hooks()
    const post = {
      id: 'post', author_id: 'author', caption: 'Public post', media_type: 'image', media_path: '/demo.svg',
      created_at: '2026-10-12', like_count: 0, save_count: 0, comment_count: 0, liked_by_me: false, saved_by_me: false, comments: [],
    }
    const calls = []
    const mocks = {
      react: new Proxy({}, { get: (_target, name) => (...args) => state.react[name](...args) }),
      'next/link': { default: 'a' },
      'next/navigation': { useRouter: () => ({ refresh() {} }), notFound() { throw Error('missing') } },
      'lucide-react': new Proxy({}, { get: () => () => null }),
      '@/actions/comments': { deleteCommentByOwner() {}, async createCommentInline(input) { calls.push(input); return { ok: true } } },
      '@/actions/posts': { deletePost() {} },
      '@/lib/auth/session': { async getOptionalSession() { return viewer ? { profileId: viewer } : null } },
      '@/lib/db/queries/post': { async getPostPageData() { return post } },
      '@/lib/db/queries/post-moderation': { async getViewerPostModerationState() { return { hiddenByViewer: false, reportedByViewer: false } } },
      '@/lib/media/get-media-url': { async getMediaUrl(path) { return path } },
      '@/lib/routes/media-links': { buildPostOpenHref: () => '/post/post', mediaContextFromReturnTo: () => ({}) },
    }
    for (const [file, name] of [
      ['feed/feed-list', 'FeedList'], ['feed/post-engagement-panel', 'PostEngagementPanel'],
      ['feed/post-media', 'PostMedia'], ['feed/post-detail-disclosure', 'PostDetailDisclosure'],
      ['ui/feedback-banner', 'FeedbackBanner'], ['ui/navigation-link', 'NavigationLink'],
      ['auth/auth-prompt-link', 'AuthPromptLink'], ['post/copy-post-link-button', 'CopyPostLinkButton'], ['post/post-viewer-controls', 'PostViewerControls'],
    ]) mocks['@/components/' + file] = { [name]: name }
    const { CommentThreadPanel } = load('components/feed/comment-thread-panel.tsx', mocks)
    mocks['@/components/feed/comment-thread-panel'] = { CommentThreadPanel }
    const Page = surface === 'Feed card' ? load('components/feed/post-card.tsx', mocks).PostCard : load('app/post/[postId]/page.tsx', mocks).default
    const refresh = async () => {
      const tree = surface === 'Feed card'
        ? await Page({ post, devProfileId: viewer, showAllComments: true })
        : await Page({ params: Promise.resolve({ postId: post.id }) })
      const comment = nodes(tree).find(node => node.type === CommentThreadPanel)
      assert.ok(comment)
      if (comment.key !== mountedKey) { state = hooks(); mountedKey = comment.key }
      state.reset()
      return comment.type(comment.props)
    }
    let tree = await refresh()
    nodes(tree).find(node => node.type === 'textarea').props.onChange({ target: { value: 'A private unsent draft' } })
    tree = await refresh()
    assert.equal(nodes(tree).find(node => node.type === 'textarea').props.value, 'A private unsent draft', 'same account refresh retains draft')
    viewer = 'account-b'
    tree = await refresh()
    assert.equal(nodes(tree).find(node => node.type === 'textarea').props.value, '', 'B cannot see or submit A draft')
    nodes(tree).find(node => node.type === 'textarea').props.onChange({ target: { value: 'B own comment' } })
    tree = await refresh()
    nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    await Promise.resolve()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].profileId, 'account-b')
    assert.equal(calls[0].body, 'B own comment')
    viewer = null
    tree = await refresh()
    assert.equal(nodes(tree).some(node => node.type === 'textarea'), false)
    viewer = 'account-a'
    tree = await refresh()
    assert.equal(nodes(tree).find(node => node.type === 'textarea').props.value, '', 'returning after logout does not restore an old draft')
  })
}
