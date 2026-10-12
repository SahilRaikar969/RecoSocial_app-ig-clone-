import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
function load(file, overrides = {}, globals = {}) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const loaded = { exports: {} }
  runInNewContext(outputText, {
    module: loaded, exports: loaded.exports, URL, URLSearchParams, ...globals,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name === '@/components/auth/auth-prompt-link') return {AuthPromptLink:'AuthPromptLink'}
      if (name === '@/components/ui/navigation-link') return { NavigationLink: 'a' }
      if (name === 'lucide-react') return new Proxy({}, { get: () => 'svg' })
      if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts', overrides, globals)
      throw new Error('Unexpected import: ' + name)
    },
  }, { filename })
  return loaded.exports
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function content(tree) {
  if (tree == null) return ''
  if (Array.isArray(tree)) return tree.map(content).join('')
  return typeof tree === 'object' ? content(tree.props?.children) : String(tree)
}
function hooks({ pending = false } = {}) {
  const state = []
  const transitions = []
  const optimistic = []
  let cursor = 0
  return {
    begin() { cursor = 0 }, transitions, optimistic,
    react: {
      useId: () => 'test-unique-id',
      useState(initial) {
        const slot = cursor++
        if (!(slot in state)) state[slot] = initial
        return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value }]
      },
      useOptimistic: initial => [initial, value => optimistic.push(value)],
      useMemo: fn => fn(),
      useTransition: () => [pending, fn => transitions.push(Promise.resolve(fn()))],
      useRef: () => ({ current: null }),
      useEffect() {},
    },
  }
}
const panelProps = { postId: 'post-id', devProfileId: 'viewer', returnTo: '/feed?view=following&page=2', initialLikedByMe: false, initialSavedByMe: false, initialLikeCount: 5, initialSaveCount: 2, commentCount: 3, commentsHref: '/post/post-id', commentsLabel: '' }
function engagementFixture({ clipboardFails = false, pending = false, props = {}, result = { ok: true } } = {}) {
  const h = hooks({ pending })
  const copied = []
  const calls = []
  const { PostEngagementPanel } = load('components/feed/post-engagement-panel.tsx', {
    react: h.react,
    'next/navigation': { useRouter: () => ({ refresh: () => calls.push('refresh') }) },
    '@/actions/likes': { toggleLikeInline: async value => { calls.push(['like', value]); return result } },
    '@/actions/saves': { toggleSaveInline: async value => { calls.push(['save', value]); return result } },
  }, {
    window: { location: { origin: 'https://recosocial.example', href: 'https://recosocial.example/feed?view=following&page=2' } },
    navigator: { clipboard: { async writeText(value) { if (clipboardFails) throw new Error('permission denied'); copied.push(value) } } },
  })
  return { ...h, copied, calls, render() { h.begin(); return PostEngagementPanel({ ...panelProps, ...props }) } }
}
function byName(tree, name) { return nodes(tree).find(node => node.props?.['aria-label'] === name) }

test('share copies the post destination and announces success, never the current listing', async () => {
  const f = engagementFixture()
  await byName(f.render(), 'Copy post link').props.onClick()
  assert.deepEqual(f.copied, ['https://recosocial.example/post/post-id'])
  assert.equal(content(nodes(f.render()).find(node => node.props.role === 'status')), 'Post link copied.')
})

test('reel sharing retains the concrete reel and its discovery context', async () => {
  const f = engagementFixture({ props: { secondaryHref: '/reel/post-id?from=explore&q=travel&category=nature' } })
  await byName(f.render(), 'Copy post link').props.onClick()
  assert.equal(f.copied[0], 'https://recosocial.example/reel/post-id?from=explore&q=travel&category=nature')
})

test('clipboard denial produces useful visible status rather than false success', async () => {
  const f = engagementFixture({ clipboardFails: true })
  await byName(f.render(), 'Copy post link').props.onClick()
  const status = nodes(f.render()).find(node => node.props.role === 'status')
  assert.match(content(status), /Could not copy the link/)
  assert.ok(!status.props.className.includes('sr-only'))
  assert.equal(f.copied.length, 0)
})

test('social controls expose state, named comments and associated exact counts; no empty link', () => {
  const f = engagementFixture({ props: { initialLikedByMe: true, initialSavedByMe: true } })
  const tree = f.render()
  for (const [name, text] of [['Unlike post', '5 likes'], ['Unsave post', '2 saves']]) {
    const button = byName(tree, name)
    assert.equal(button.props['aria-pressed'], true)
    const description = nodes(tree).find(node => node.props.id === button.props['aria-describedby'])
    assert.equal(content(description), text)
  }
  assert.equal(byName(tree, 'View 3 comments').props.href, '/post/post-id')
  for (const link of nodes(tree).filter(node => node.type === 'a')) assert.ok(link.props['aria-label'] || content(link).trim())
})

test('pending social mutations prevent duplicate handlers and preserve refresh on failed confirmation', async () => {
  const pending = engagementFixture({ pending: true })
  const like = byName(pending.render(), 'Like post')
  assert.equal(like.props.disabled, true)
  like.props.onClick()
  assert.equal(pending.calls.length, 0)
  const failed = engagementFixture({ result: { ok: false } })
  byName(failed.render(), 'Save post').props.onClick()
  await Promise.all(failed.transitions)
  assert.equal(failed.calls[0][0], 'save')
  assert.equal(failed.calls[0][1].saved, false)
  assert.equal(failed.calls[0][1].returnTo, panelProps.returnTo)
  assert.ok(failed.calls.includes('refresh'))
  assert.match(content(nodes(failed.render()).find(node => node.props.role === 'alert')), /Could not confirm the save change/)
})

function commentsFixture({ result = { ok: false }, pending = false } = {}) {
  const h = hooks({ pending })
  const calls = []
  const { CommentThreadPanel } = load('components/feed/comment-thread-panel.tsx', {
    react: h.react,
    'next/navigation': { useRouter: () => ({ refresh: () => calls.push('refresh') }) },
    '@/actions/comments': { createCommentInline: async value => { calls.push(value); return result } },
  })
  return { ...h, calls, render() { h.begin(); return CommentThreadPanel({ postId: 'post-id', profileId: 'viewer', returnTo: '/feed', initialComments: [] }) } }
}

test('comments have a real label, count hint and disabled empty submit', () => {
  const f = commentsFixture()
  const output = nodes(f.render())
  const textarea = output.find(node => node.type === 'textarea')
  assert.ok(output.some(node => node.type === 'label' && node.props.htmlFor === textarea.props.id))
  assert.equal(content(output.find(node => node.props.id === textarea.props['aria-describedby'])), '0/280 characters')
  assert.equal(output.find(node => node.type === 'button').props.disabled, true)
  assert.match(content(f.render()), /No comments yet/)
})

test('failed comment keeps the draft, refreshes and connects the alert to its field', async () => {
  const f = commentsFixture()
  nodes(f.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: '  A thoughtful comment  ' } })
  nodes(f.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await Promise.all(f.transitions)
  const output = nodes(f.render())
  const textarea = output.find(node => node.type === 'textarea')
  const alert = output.find(node => node.props.role === 'alert')
  assert.equal(textarea.props.value, '  A thoughtful comment  ')
  assert.equal(f.calls[0].body, 'A thoughtful comment')
  assert.ok(f.calls.includes('refresh'))
  assert.ok(textarea.props['aria-describedby'].split(' ').includes(alert.props.id))
})

test('confirmed comment clears the draft, while pending comments remain disabled and announced', async () => {
  const f = commentsFixture({ result: { ok: true } })
  nodes(f.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'Hello' } })
  nodes(f.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await Promise.all(f.transitions)
  assert.equal(nodes(f.render()).find(node => node.type === 'textarea').props.value, '')
  const p = commentsFixture({ pending: true })
  const output = nodes(p.render())
  assert.equal(output.find(node => node.type === 'textarea').props.disabled, true)
  assert.equal(output.find(node => node.type === 'form').props['aria-busy'], true)
  assert.match(content(output.find(node => node.props.role === 'status')), /Posting comment/)
})

test('media preserves metadata preload and a full play target while loading; images preserve their content', () => {
  const h = hooks()
  const { PostMedia } = load('components/feed/post-media.tsx', {
    react: h.react,
    'next/navigation': { usePathname: () => '/feed' },
    '@/components/ui/media-skeleton': { MediaSkeleton: 'Skeleton' },
    '@/components/ui/smart-image': { SmartImage: 'Image' },
  })
  const output = nodes(PostMedia({ mediaType: 'video', mediaUrl: 'https://media.example/post.mp4', thumbnailUrl: 'https://media.example/post.jpg' }))
  const video = output.find(node => node.type === 'video')
  assert.equal(video.props.preload, 'metadata')
  assert.equal(video.props.poster, 'https://media.example/post.jpg')
  assert.ok(!video.props.className.includes('absolute'), 'video must reserve the play button height before loadeddata')
  assert.match(video.props.className, /aspect-\[4\/5\]/)
  assert.ok(output.find(node => node.type === 'button' && node.props['aria-label'] === 'Play video'))
  h.begin()
  const image = nodes(PostMedia({ mediaType: 'image', mediaUrl: 'https://media.example/post.jpg', alt: 'Landscape' })).find(node => node.type === 'Image')
  assert.match(image.props.className, /object-contain/)
  assert.equal(image.props.alt, 'Landscape')
})

const serverMocks = {
  '@/components/ui/page-shell': { PageShell: 'PageShell' },
  '@/components/ui/feedback-banner': { FeedbackBanner: 'Banner' },
  '@/components/ui/surface-empty': { SurfaceEmpty: 'Empty' },
  '@/components/feed/feed-list': { FeedList: 'FeedList' },
  '@/components/stories/story-rail': { StoryRail: 'Stories' },
  '@/components/explore/search-panel': { SearchPanel: 'SearchPanel' },
  '@/components/explore/search-results': { SearchResults: 'SearchResults' },
  '@/components/explore/creator-spotlight-list': { CreatorSpotlightList: 'Creators' },
  '@/lib/auth/get-dev-session': { getOptionalSession: async () => ({ profileId: 'viewer' }) },
  '@/lib/db/queries/feed': { getFeedData: async () => ({ posts: [], summary: {}, pagination: { page: 1, pageCount: 1 } }) },
  '@/lib/db/queries/stories': { getStoriesRail: async () => [] },
  '@/lib/db/queries/explore': { getExploreData: async () => ({ posts: [], creators: [], categories: [{ id: 'travel', name: 'Travel', slug: 'travel' }] }), filterDiscoveryPosts: posts => posts },
  '@/lib/db/queries/search': { getSearchCreators: async () => [] },
}

test('feed has one compact heading, selected Following link and no ranking guide or raw query error', async () => {
  const page = load('app/feed/page.tsx', serverMocks).default
  const tree = await page({ searchParams: Promise.resolve({ view: 'following', error: 'raw database password % value' }) })
  const output = nodes(tree)
  assert.equal(output.filter(node => node.type === 'h1').length, 1)
  assert.equal(content(output.find(node => node.type === 'a' && node.props['aria-current'] === 'page')), 'Following')
  assert.equal(output.find(node => node.type === 'FeedList').props.feedView, 'following')
  assert.doesNotMatch(content(tree), /raw database|Ranking mix|ranked within|Why these posts/i)
})

test('Explore remounts search drafts on URL changes and topic navigation retains the search', async () => {
  const page = load('app/explore/page.tsx', serverMocks).default
  const first = nodes(await page({ searchParams: Promise.resolve({ q: 'ocean', category: 'travel' }) }))
  const second = nodes(await page({ searchParams: Promise.resolve({ q: 'mountains', category: 'travel' }) }))
  const a = first.find(node => node.type === 'SearchPanel')
  const b = second.find(node => node.type === 'SearchPanel')
  assert.notEqual(a.key, b.key)
  assert.equal(a.props.initialQuery, 'ocean')
  assert.equal(b.props.initialQuery, 'mountains')
  assert.ok(first.some(node => node.type === 'a' && node.props.href === '/explore?q=ocean&category=travel'))
  assert.ok(first.some(node => node.type === 'a' && node.props.href === '/explore?q=ocean'))
})
