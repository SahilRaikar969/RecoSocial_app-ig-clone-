import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, load, post, category, ids, getFeed, viewer } from './helpers/m3-feed-fixture.mjs'

const media = { '@/lib/media/get-media-url': { getMediaUrl: async value => value } }
const video = (id, extra = {}) => post(id, { media_type: 'video', media_path: `${id}.mp4`, thumbnail_path: `${id}.jpg`, ...extra })
const explore = context => load('lib/db/queries/explore.ts', context)
const reels = (context, input = {}) => load('lib/db/queries/reels.ts', context, media).getReelPageData({ viewerProfileId: viewer, postId: 'current', ...input })
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type))
  return [...(tree.type === type ? [tree.props] : []), ...nodes(tree.props?.children, type)]
}

test('Explore excludes owner drafts, private/deleted/hidden and incomplete media without relaxing public eligibility', async () => {
  const context = fixture({ posts: [post('public'), post('own-draft', { author_id: viewer, status: 'draft' }), post('private', { visibility: 'private' }), post('deleted', { status: 'deleted' }), post('hidden'), post('blank', { media_path: ' ' }), post('invalid', { media_type: 'audio' })], hidden: ['hidden'] })
  assert.deepEqual(ids((await explore(context).getExploreData(viewer)).posts), ['public'])
})

test('Explore category and substring filtering retain ranked metadata, thumbnails and comments', async () => {
  const context = fixture({ posts: [video('low', { caption: 'recipe', comments: [{ id: 'comment', author_id: 'a', body: 'hello', created_at: '2000-01-01' }] }), video('high', { caption: 'Recipe' }), post('travel', { post_categories: [category('travel')] })], counts: { high: 4 } })
  const query = explore(context)
  const result = await query.getExploreData(viewer, 'cooking')
  assert.deepEqual(ids(result.posts), ['high', 'low'])
  const filtered = query.filterDiscoveryPosts(result.posts, 'recipe')
  assert.deepEqual(ids(filtered), ['high', 'low'])
  assert.equal(filtered[0].thumbnail_path, 'high.jpg')
  assert.equal(filtered[0].ranking_meta.engagement_score, 16)
  assert.equal(filtered[1].comments[0].id, 'comment')
  assert.equal(filtered[0].post_categories[0].categories.slug, 'cooking')
  assert.deepEqual((await query.getExploreData(viewer, 'unknown')).posts, [])
})

test('Explore equal-score ties are deterministic and spotlight membership requires a real eligible author', async () => {
  const context = fixture({ posts: [post('z'), post('a'), post('own', { author_id: viewer }), post('draft', { status: 'draft' })], follows: ['missing', viewer, 'author-draft'] })
  const result = await explore(context).getExploreData(viewer)
  assert.deepEqual(ids(result.posts), ['own', 'a', 'z']) // explicit self-follow fixture affects score; DB disallows it
  assert.deepEqual(new Set(result.creators.map(row => row.id)), new Set(['author-a', 'author-z']))
  assert.equal(result.creators.some(row => ['missing', viewer, 'author-draft'].includes(row.id)), false)
})

test('account search finds public accounts outside spotlights, including accounts without posts, and returns only public fields', async () => {
  const profile = { id: 'new-account', username: 'needle', display_name: 'Needle', bio: '', avatar_url: null }
  const context = fixture({ profiles: [profile, { ...profile, id: viewer }], posts: [] })
  const result = await load('lib/db/queries/search.ts', context, media).getSearchCreators(viewer, 'needle')
  assert.deepEqual(result.map(row => row.id), ['new-account'])
  assert.equal(result[0].post_count, 0)
  assert.deepEqual(Object.keys(result[0]).sort(), ['avatar_url','bio','display_name','followed_by_me','follower_count','id','post_count','score','username'].sort())
  assert.ok(context.calls.filter(call => call.table === 'profiles').every(call => call.columns === 'id, username, display_name, bio, avatar_url'))
})

test('account search literal punctuation cannot turn into a raw PostgREST boolean expression or wildcard', async () => {
  const profile = { id: 'literal', username: 'literal', display_name: '50%_(),', bio: '', avatar_url: null }
  const context = fixture({ profiles: [profile, { ...profile, id: 'no', display_name: '500abc' }] })
  const result = await load('lib/db/queries/search.ts', context, media).getSearchCreators(viewer, '50%_(),')
  assert.deepEqual(result.map(row => row.id), ['literal'])
})

test('account search category restriction is explicit and stats exclude draft/hidden content', async () => {
  const context = fixture({ posts: [post('valid'), post('draft', { author_id: 'author-valid', status: 'draft' }), post('hidden', { author_id: 'author-valid' }), post('other')], hidden: ['hidden'] })
  const search = load('lib/db/queries/search.ts', context, media)
  assert.deepEqual(await search.getSearchCreators(viewer, 'valid', []), [])
  const result = await search.getSearchCreators(viewer, 'valid', ['author-valid'])
  assert.deepEqual(result.map(row => row.id), ['author-valid'])
  assert.equal(result[0].post_count, 1)
})

for (const [label, extra, hidden] of [
  ['draft', { status: 'draft' }, []], ['private', { visibility: 'private' }, []],
  ['image', { media_type: 'image' }, []], ['blank', { media_path: '' }, []],
  ['hidden', {}, ['current']], ['deleted', { status: 'deleted' }, []],
]) {
  test(`reels reject a ${label} requested post instead of substituting unrelated content`, async () => {
    assert.deepEqual((await reels(fixture({ posts: [video('current', extra), video('other')], hidden }))).reels, [])
  })
}

test('missing/deleted reel ID remains unavailable', async () => {
  assert.deepEqual((await reels(fixture({ posts: [video('other')] }))).reels, [])
})

test('Explore reels pin requested item then preserve ranked category/search sequence and metadata', async () => {
  const context = fixture({ posts: [video('current', { caption: 'recipe' }), video('low', { caption: 'recipe' }), video('high', { caption: 'recipe' }), video('wrong-topic', { caption: 'recipe', post_categories: [category('travel')] }), video('wrong-text', { caption: 'other' }), video('hidden', { caption: 'recipe' })], hidden: ['hidden'], counts: { high: 10, low: 2, 'wrong-topic': 100 } })
  const result = await reels(context, { source: 'explore', activeCategory: 'cooking', searchQuery: 'recipe' })
  assert.deepEqual(ids(result.reels), ['current', 'high', 'low'])
  assert.equal(result.reels[0].post_categories[0].categories.slug, 'cooking')
  assert.equal(typeof result.reels[0].explore_score, 'number')
  assert.equal(result.reels[1].ranking_meta.engagement_score, 40)
  assert.equal(result.reels[1].save_count, 10)
  assert.deepEqual((await reels(context, { source: 'explore', activeCategory: 'unknown' })).reels, [])
  assert.deepEqual((await reels(context, { source: 'explore', searchQuery: 'no-match' })).reels, [])
})

test('reel newest-related window excludes hidden and draft rows before limiting', async () => {
  const ineligible = Array.from({ length: 20 }, (_, i) => video(`hidden-${i}`, { created_at: '2026-01-01' }))
  const context = fixture({ posts: [video('current'), ...ineligible, video('draft', { status: 'draft' }), video('eligible')], hidden: ids(ineligible) })
  assert.deepEqual(ids((await reels(context)).reels), ['current', 'eligible'])
})

test('saved and profile reel scopes never widen into another creator or unsaved item', async () => {
  const context = fixture({ posts: [video('current'), video('saved'), video('same', { author_id: 'author-current' }), video('outside')], saves: [{ profile_id: viewer, post_id: 'current' }, { profile_id: viewer, post_id: 'saved' }] })
  assert.deepEqual(ids((await reels(context, { source: 'saved' })).reels), ['current', 'saved'])
  assert.deepEqual(ids((await reels(context, { source: 'profile', sourceProfileId: 'author-current' })).reels), ['current', 'same'])
  assert.deepEqual((await reels(context, { source: 'profile', sourceProfileId: 'other' })).reels, [])
  context.state.saves = []
  assert.deepEqual((await reels(context, { source: 'saved' })).reels, [])
})

test('Following reel context is strict and preserves ranked members on the selected page', async () => {
  const context = fixture({ posts: [video('current'), video('other', { author_id: 'author-current' }), video('stranger')], follows: ['author-current'], counts: { other: 3, stranger: 100 } })
  const result = await reels(context, { source: 'feed', feedView: 'following' })
  assert.deepEqual(ids(result.reels), ['current', 'other'])
  assert.equal(typeof result.reels[0].feed_score, 'number')
  assert.deepEqual((await reels(context, { postId: 'stranger', source: 'feed', feedView: 'following' })).reels, [])
})

test('related post recommendations filter hidden/owner-draft/private candidates before the cap', async () => {
  const hidden = Array.from({ length: 50 }, (_, i) => post(`hidden-${i}`, { created_at: '2026-01-01' }))
  const context = fixture({ posts: [post('current'), ...hidden, post('draft', { status: 'draft' }), post('private', { visibility: 'private' }), post('related')], hidden: ids(hidden) })
  const result = await load('lib/db/queries/post.ts', context).getPostPageData(viewer, 'current')
  assert.deepEqual(ids(result.related_posts), ['related'])
  assert.ok(result.related_posts[0].reason_labels.includes('Similar category: cooking'))
})

test('For You permits own public posts but Following excludes self because self-follow is not a product relationship', async () => {
  const context = fixture({ posts: [post('mine', { author_id: viewer }), post('friend')], follows: ['author-friend'] })
  assert.ok(ids((await getFeed(context)).posts).includes('mine'))
  assert.deepEqual(ids((await getFeed(context, { view: 'following' })).posts), ['friend'])
})

test('media navigation carries category/search and Following page context', async () => {
  const routing = load('lib/routes/media-links.ts')
  const exploreHref = routing.buildPostOpenHref({ postId: 'video', mediaType: 'video', ...routing.mediaContextFromReturnTo('/explore?category=cooking&q=recipe') })
  assert.equal(exploreHref, '/reel/video?from=explore&category=cooking&q=recipe')
  assert.equal(routing.buildPostOpenHref({ postId: 'video', mediaType: 'video', ...routing.mediaContextFromReturnTo('/feed?view=following&page=2') }), '/reel/video?from=feed&view=following&page=2')
})

test('search result grid forwards Explore context, and grid links preserve it instead of defaulting to profile', async () => {
  const overrides = { ...media, 'lucide-react': { ArrowRight: 'Icon', Search: 'Icon', Sparkles: 'Icon', Bookmark: 'Icon', Heart: 'Icon', MessageCircle: 'Icon', Play: 'Icon' },
    '@/components/profile/follow-button': { FollowButton: 'FollowButton' }, '@/components/profile/profile-post-grid': { ProfilePostGrid: 'Grid' }, '@/components/ui/smart-image': { SmartImage: 'Image' } }
  const result = await load('components/explore/search-results.tsx', fixture(), overrides).SearchResults({ query: 'recipe', activeCategory: 'cooking', viewerProfileId: viewer, creators: [], posts: [video('current')] })
  const grid = nodes(result, 'Grid')[0]
  assert.deepEqual(grid.openContext, { source: 'explore', category: 'cooking', query: 'recipe' })
  const tree = await load('components/profile/profile-post-grid.tsx', fixture(), overrides).ProfilePostGrid(grid)
  assert.ok(nodes(tree, 'Link').some(link => link.href === '/reel/current?from=explore&profileId=author-current&category=cooking&q=recipe'))
})

test('Explore page passes original ranked objects to FeedList rather than stripping thumbnail and ranking metadata', async () => {
  const sample = { ...video('current'), author: video('current').profiles, explore_score: 10, ranking_meta: { category_boost: 6 } }
  const overrides = { 'lucide-react': { Compass: 'Icon', Search: 'Icon', Sparkles: 'Icon', TrendingUp: 'Icon' },
    '@/components/feed/feed-list': { FeedList: 'FeedList' }, '@/components/explore/creator-spotlight-list': { CreatorSpotlightList: 'Creators' },
    '@/components/explore/search-results': { SearchResults: 'SearchResults' }, '@/components/explore/search-panel': { SearchPanel: 'SearchPanel' },
    '@/components/ui/page-shell': { PageShell: 'PageShell' }, '@/components/ui/surface-hero': { SurfaceHero: 'Hero' }, '@/components/ui/surface-empty': { SurfaceEmpty: 'Empty' },
    '@/lib/db/queries/explore': { getExploreData: async () => ({ posts: [sample], creators: [], categories: [] }), filterDiscoveryPosts: posts => posts },
    '@/lib/db/queries/search': { getSearchCreators: async () => [] },
  }
  const tree = await load('app/explore/page.tsx', fixture(), overrides).default({ searchParams: Promise.resolve({ category: 'cooking' }) })
  const list = nodes(tree, 'FeedList')[0]
  assert.equal(list.posts[0], sample)
  assert.equal(list.returnToBase, '/explore?category=cooking')
})

test('PostCard reel links derive Explore context from the actual listing return path', async () => {
  const overrides = { ...media,
    '@/components/feed/post-engagement-panel': { PostEngagementPanel: 'Engagement' },
    '@/components/feed/comment-thread-panel': { CommentThreadPanel: 'Comments' },
    '@/components/feed/post-detail-disclosure': { PostDetailDisclosure: 'Disclosure' },
    '@/components/feed/post-media': { PostMedia: 'Media' },
    '@/components/post/post-viewer-controls': { PostViewerControls: 'Controls' },
    '@/lib/db/queries/post-moderation': { getViewerPostModerationState: async () => ({}) },
  }
  const tree = await load('components/feed/post-card.tsx', fixture(), overrides).PostCard({
    post: { ...video('current'), like_count: 0, save_count: 0, comment_count: 0 }, devProfileId: viewer, returnTo: '/explore?category=cooking&q=recipe',
  })
  assert.ok(nodes(tree, 'Link').some(link => link.href === '/reel/current?from=explore&category=cooking&q=recipe'))
})

test('reel page preserves scoped return and viewer navigation query parameters', async () => {
  const overrides = { '@/components/reels/reel-viewer': { ReelViewer: 'ReelViewer' },
    '@/lib/db/queries/reels': { getReelPageData: async () => ({ reels: [video('current')] }) },
  }
  const page = load('app/reel/[postId]/page.tsx', fixture(), overrides).default
  const following = await page({ params: Promise.resolve({ postId: 'current' }), searchParams: Promise.resolve({ from: 'feed', view: 'following', page: '2' }) })
  assert.equal(following.props.backHref, '/feed?view=following&page=2')
  assert.equal(following.props.viewerQueryString, 'from=feed&view=following&page=2')
  const discovery = await page({ params: Promise.resolve({ postId: 'current' }), searchParams: Promise.resolve({ from: 'explore', category: 'cooking', q: 'recipe' }) })
  assert.equal(discovery.props.backHref, '/explore?category=cooking&q=recipe')
  assert.equal(discovery.props.viewerQueryString, 'from=explore&category=cooking&q=recipe')
})
