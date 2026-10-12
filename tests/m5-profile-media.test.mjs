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
function load(file, overrides = {}) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const mod = { exports: {} }
  const Link = ({ children, ...props }) => React.createElement('a', props, children)
  runInNewContext(output, { module: mod, exports: mod.exports, URL, URLSearchParams, require(name) {
    if (name in overrides) return overrides[name]
    if (name === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) }
    if (name === 'next/link') return { default: Link }
    if (name === '@/components/auth/auth-prompt-link') return {AuthPromptLink:'AuthPromptLink'}
      if (name === '@/components/ui/navigation-link') return { NavigationLink: Link }
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
    if (name.startsWith('@/actions/')) return new Proxy({}, { get: () => () => {} })
    if (name === '@/lib/media/get-media-url') return { getMediaUrl: async value => value }
    if (name.startsWith('@/')) {
      const source = name.slice(2)
      return load(existsSync(new URL('../' + source + '.tsx', import.meta.url)) ? source + '.tsx' : source + '.ts', overrides)
    }
    return require(name)
  } }, { filename })
  return mod.exports
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const elements = (html, tag) => [...html.matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'g'))].map(match => match[0])
const attribute = (tag, name) => tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))?.[1]

test('collapsed post details use hidden, and their disclosure has matching state and control target', () => {
  const { PostDetailDisclosure } = load('components/feed/post-detail-disclosure.tsx')
  for (const open of [false, true]) {
    const html = render(PostDetailDisclosure, { defaultOpen: open, children: React.createElement('button', null, 'Moderate post') })
    const button = elements(html, 'button')[0]
    const content = elements(html, 'div').find(tag => attribute(tag, 'id') === attribute(button, 'aria-controls'))
    assert.ok(content)
    assert.equal(attribute(button, 'aria-expanded'), String(open))
    assert.equal(content.includes('hidden=""'), !open)
    assert.match(html, /Moderate post/)
  }
})

test('profile collection links identify the active page without pretending to be a tab widget', () => {
  const { ProfileSurfaceTabs } = load('components/profile/profile-surface-tabs.tsx')
  const html = render(ProfileSurfaceTabs, { tabs: [
    { key: 'posts', label: 'Posts', href: '/profile', count: 3, active: false },
    { key: 'saved', label: 'Saved', href: '/profile?tab=saved', count: 2, active: true },
  ] })
  const links = elements(html, 'a')
  assert.equal(links.filter(tag => attribute(tag, 'aria-current') === 'page').length, 1)
  assert.equal(attribute(links[1], 'href'), '/profile?tab=saved')
  assert.match(html, /<nav aria-label="Profile collections"/)
  assert.doesNotMatch(html, /role="tab/)
})

test('video grid without a thumbnail shows an honest placeholder and preserves scoped navigation', async () => {
  const { ProfilePostGrid } = load('components/profile/profile-post-grid.tsx')
  const html = renderToStaticMarkup(await ProfilePostGrid({ posts: [{
    id: 'video', author_id: 'creator', caption: 'A mountain walk', media_type: 'video',
    media_path: 'https://example.test/video.mp4?token=signed', thumbnail_path: null,
    like_count: 4, comment_count: 2, save_count: 1,
  }], openContext: { source: 'explore', category: 'travel', query: 'mountains' } }))
  assert.equal(elements(html, 'img').length, 0)
  assert.match(html, /Watch reel/)
  assert.match(html, /from=explore&amp;profileId=creator&amp;category=travel&amp;q=mountains/)
  assert.doesNotMatch(html, /Visual post grid|Fast scan|grid-rows-\[0fr\]|group-hover:opacity/)
  assert.match(html, /grid-cols-2/)
  assert.match(html, /sm:grid-cols-3/)
  assert.match(html, /4 likes, 2 comments, 1 saves/)
})

test('only the active Reel is available to sequential focus; controls remain named', () => {
  const { ReelViewer } = load('components/reels/reel-viewer.tsx')
  const reels = Array.from({ length: 3 }, (_, i) => ({
    id: 'reel-' + i, author_id: 'creator', caption: 'A walk ' + i, created_at: '2026-10-10',
    media_url: 'https://example.test/video-' + i + '.mp4?token=signed', thumbnail_url: null,
    like_count: 1, save_count: 2, comment_count: 3, liked_by_me: i === 1, saved_by_me: false, author: null,
  }))
  const html = render(ReelViewer, { reels, initialPostId: 'reel-1', viewerProfileId: 'viewer', backHref: '/feed?view=following&page=2' })
  const slides = elements(html, 'section')
  assert.equal(slides.length, 3)
  assert.deepEqual(slides.map(tag => tag.includes('inert=""')), [true, false, true])
  assert.match(html, /<main[^>]+aria-label="Reels"/)
  const buttons = elements(html, 'button')
  assert.ok(buttons.every(button => Boolean(attribute(button, 'aria-label'))))
  assert.ok(buttons.some(button => attribute(button, 'aria-label') === 'Unlike reel' && attribute(button, 'aria-pressed') === 'true'))
  assert.ok(buttons.some(button => attribute(button, 'aria-label') === 'Unmute reel'))
  assert.match(html, /href="\/feed\?view=following&amp;page=2"/)
})

test('Story controls remain named, pause is explicit, and Next can complete the viewer', () => {
  const { StoryViewer } = load('components/stories/story-viewer.tsx')
  const html = render(StoryViewer, {
    author: { id: 'creator', username: 'mira', display_name: 'Mira' },
    initialIndex: 0, stories: [{ id: 's1', media_type: 'video', media_url: 'https://example.test/story.mp4', created_at: '', expires_at: '' }],
  })
  assert.match(html, /aria-label="Back to feed"/)
  const buttons = elements(html, 'button')
  assert.ok(['Pause story', 'Unmute story', 'Previous story', 'Next story'].every(label => buttons.some(button => attribute(button, 'aria-label') === label)))
  assert.ok(buttons.find(button => attribute(button, 'aria-label') === 'Previous story').includes('disabled=""'))
  assert.ok(!buttons.find(button => attribute(button, 'aria-label') === 'Next story').includes('disabled=""'))
  assert.match(html, /Retry media/)
})

test('Follow uses a native server-action form with unchanged identity, state, and return fields', () => {
  const action = () => {}
  let pending = false
  const { FollowButton } = load('components/profile/follow-button.tsx', {
    '@/actions/follows': { toggleFollow: action },
    'react-dom': { useFormStatus: () => ({ pending }) },
  })
  const props = { followerId: 'viewer', followingId: 'creator', followedByMe: true, returnTo: '/profile/creator?tab=liked' }
  const tree = FollowButton(props)
  assert.equal(tree.type, 'form')
  assert.equal(tree.props.action, action)
  const children = React.Children.toArray(tree.props.children)
  assert.deepEqual(children.filter(node => node.type === 'input').map(node => [node.props.name, node.props.value]), [
    ['follower_id', 'viewer'], ['following_id', 'creator'], ['followed', 'true'], ['return_to', '/profile/creator?tab=liked'],
  ])
  const submit = children.at(-1)
  assert.equal(submit.type(submit.props).props.disabled, false)
  pending = true
  assert.equal(submit.type(submit.props).props.disabled, true)
  assert.equal(submit.type(submit.props).props.type, 'submit')
  assert.equal(submit.type(submit.props).props['aria-pressed'], true)
})


test('empty Story rail keeps a single useful action without an empty carousel', () => {
  const { StoryRail } = load('components/stories/story-rail.tsx')
  const html = render(StoryRail, { items: [] })
  const links = elements(html, 'a')
  assert.equal(links.length, 1)
  assert.equal(attribute(links[0], 'href'), '/stories/create')
  assert.match(html, /Add story/)
  assert.match(html, /min-h-11/)
  assert.doesNotMatch(html, /No stories yet|overflow-x-auto/)
})

test('post not-found fits inside the app main and uses product language', () => {
  const NotFound = load('app/post/not-found.tsx').default
  const html = render(NotFound)
  assert.equal(elements(html, 'main').length, 0)
  assert.match(html, /Post not found/)
  assert.ok(html.includes('href="/feed"'))
  assert.doesNotMatch(html, /dataset|surface|tutorial/)
})
