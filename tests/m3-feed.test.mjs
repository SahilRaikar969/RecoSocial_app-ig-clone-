import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, load, post, category, ids, getFeed, renderPosts, viewer } from './helpers/m3-feed-fixture.mjs'

// Contract boundaries are exercised independently of a live backend or cache.
test('feed comparator keeps score/save/comment/date precedence and deterministic ID ties', () => {
  const { compareFeedPosts } = load('lib/recommendations/feed-contract.ts')
  const row = (id, extra = {}) => ({ id, feed_score: 10, save_count: 0, comment_count: 0, created_at: '2000-01-01T00:00:00Z', ...extra })
  const rows = [row('z'), row('a'), row('newer', { created_at: '2020-01-01T00:00:00Z' }),
    row('comment', { comment_count: 1 }), row('save', { save_count: 1 }), row('score', { feed_score: 11 })]
  assert.deepEqual(ids(rows.sort(compareFeedPosts)), ['score', 'save', 'comment', 'newer', 'a', 'z'])
})

test('pagination deduplicates first occurrence without sorting or mutating ranked input', () => {
  const { selectFeedPage } = load('lib/recommendations/feed-contract.ts')
  const first = Object.freeze({ id: 'b', source_bucket: 'trending', marker: 'ranked first' })
  const posts = Object.freeze([first, Object.freeze({ id: 'a', source_bucket: 'following' }),
    Object.freeze({ id: 'b', source_bucket: 'interest', marker: 'fallback duplicate' }), Object.freeze({ id: 'c', source_bucket: 'interest' })])
  const page = selectFeedPage(posts, 'for-you', 1, 2)
  assert.deepEqual(ids(page.posts), ['b', 'a'])
  assert.equal(page.posts[0], first)
  assert.equal(page.total, 3)
  assert.equal(page.pageCount, 2)
  assert.deepEqual(ids(selectFeedPage(posts, 'for-you', 2, 2).posts), ['c'])
  assert.deepEqual(ids(posts), ['b', 'a', 'b', 'c'])
})

test('Following filters source_bucket before slicing pages and never admits fallback', () => {
  const { selectFeedPage } = load('lib/recommendations/feed-contract.ts')
  const posts = [
    { id: 'fallback', source_bucket: 'trending', recommendation_bucket: 'following' },
    { id: 'follow-a', source_bucket: 'following' }, { id: 'interest', source_bucket: 'interest' },
    { id: 'follow-b', source_bucket: 'following' }, { id: 'follow-c', source_bucket: 'following' },
  ]
  assert.deepEqual(ids(selectFeedPage(posts, 'following', 1, 2).posts), ['follow-a', 'follow-b'])
  assert.deepEqual(ids(selectFeedPage(posts, 'following', 2, 2).posts), ['follow-c'])
  assert.equal(selectFeedPage(posts, 'following', 2, 2).total, 3)
})

test('FeedList renders the exact mixed global rank without a Following-first regroup', async () => {
  const posts = Object.freeze([
    Object.freeze({ ...post('popular'), source_bucket: 'trending', feed_score: 80 }),
    Object.freeze({ ...post('followed'), source_bucket: 'following', feed_score: 22 }),
    Object.freeze({ ...post('interest'), source_bucket: 'interest', feed_score: 13 }),
    Object.freeze({ ...post('fallback'), source_bucket: 'trending', feed_score: 5 }),
  ])
  assert.deepEqual(ids(await renderPosts(posts)), ['popular', 'followed', 'interest', 'fallback'])
  assert.deepEqual(ids(posts), ['popular', 'followed', 'interest', 'fallback'])
})

test('Following renderer reads source_bucket and defensively excludes legacy misclassification', async () => {
  const posts = [
    { ...post('not-followed'), source_bucket: 'trending', recommendation_bucket: 'following' },
    { ...post('followed-a'), source_bucket: 'following' },
    { ...post('followed-b'), source_bucket: 'following', recommendation_bucket: 'interest' },
  ]
  assert.deepEqual(ids(await renderPosts(posts, 'following')), ['followed-a', 'followed-b'])
  assert.deepEqual(await renderPosts([posts[0]], 'following'), [])
})

test('database retrieval and server transformation preserve rank through the rendered feed', async () => {
  const context = fixture({ posts: [post('fallback'), post('interest'), post('followed'), post('popular')],
    preferences: ['travel'], follows: ['author-followed'], counts: { popular: 20 } })
  context.state.posts.find(row => row.id === 'interest').post_categories = [category('travel')]
  const result = await getFeed(context)
  assert.deepEqual(ids(result.posts), ['popular', 'followed', 'interest', 'fallback'])
  assert.deepEqual(result.posts.map(row => row.feed_score), [85, 22, 13, 5])
  assert.deepEqual(ids(await renderPosts(result.posts)), ids(result.posts))
  assert.deepEqual(result.posts.map(row => row.source_bucket), ['trending', 'following', 'interest', 'trending'])
})

test('draft, private and deleted candidates are excluded before the 80-row cap', async () => {
  const excluded = Array.from({ length: 90 }, (_, index) => post(`excluded-${index}`, {
    created_at: '2026-10-08T10:00:00Z',
    ...(index % 3 === 0 ? { status: 'draft' } : index % 3 === 1 ? { visibility: 'private' } : { status: 'deleted' }),
  }))
  const result = await getFeed(fixture({ posts: [...excluded, post('eligible')] }))
  assert.deepEqual(ids(result.posts), ['eligible'])
})

test('hidden candidates are filtered before the cap so they cannot starve a valid feed', async () => {
  const hidden = Array.from({ length: 90 }, (_, index) => post(`hidden-${index}`, { created_at: '2026-10-08T10:00:00Z' }))
  const context = fixture({ posts: [...hidden, post('eligible')], hidden: ids(hidden) })
  const result = await getFeed(context)
  assert.deepEqual(ids(result.posts), ['eligible'])
  assert.deepEqual(context.calls.filter(call => call.table === 'rpc').flatMap(call => call.ids), ['eligible'])
})

test('Following fetch filters authors before the cap and does not leak popular fallback', async () => {
  const strangers = Array.from({ length: 90 }, (_, index) => post(`stranger-${index}`, { created_at: '2026-10-08T10:00:00Z' }))
  const context = fixture({ posts: [...strangers, post('followed')], follows: ['author-followed'], counts: { 'stranger-0': 1000 } })
  const result = await getFeed(context, { view: 'following' })
  assert.deepEqual(ids(result.posts), ['followed'])
  assert.equal(result.posts[0].source_bucket, 'following')
  assert.deepEqual(ids(await renderPosts(result.posts, 'following')), ['followed'])
})

test('Following with no followed creators stays empty rather than substituting recommendations', async () => {
  const result = await getFeed(fixture({ posts: [post('popular')], counts: { popular: 100 } }), { view: 'following' })
  assert.deepEqual(result.posts, [])
  assert.equal(result.pagination.total, 0)
  assert.deepEqual(await renderPosts(result.posts, 'following'), [])
})

test('page boundaries preserve global order and contain no duplicates across a candidate window', async () => {
  const posts = Array.from({ length: 60 }, (_, index) => post(`post-${String(index).padStart(2, '0')}`))
  const counts = Object.fromEntries(posts.map((row, index) => [row.id, index]))
  const context = fixture({ posts, counts })
  const pages = await Promise.all([1, 2, 3].map(page => getFeed(context, { page })))
  const received = pages.flatMap(page => ids(page.posts))
  assert.deepEqual(received, ids([...posts].reverse()))
  assert.equal(new Set(received).size, 60)
  assert.deepEqual(pages.map(page => page.posts.length), [24, 24, 12])
  assert.deepEqual(pages.map(page => page.pagination.page), [1, 2, 3])
  for (const page of pages) assert.deepEqual(ids(await renderPosts(page.posts)), ids(page.posts))
})

test('Following pagination is over followed posts and preserves their ranked order', async () => {
  const followed = Array.from({ length: 30 }, (_, index) => post(`follow-${String(index).padStart(2, '0')}`, { author_id: 'creator' }))
  const context = fixture({ posts: [post('outsider'), ...followed], follows: ['creator'] })
  const first = await getFeed(context, { view: 'following', page: 1 })
  const second = await getFeed(context, { view: 'following', page: 2 })
  assert.deepEqual([...ids(first.posts), ...ids(second.posts)], ids(followed))
  assert.equal(first.pagination.total, 30)
  assert.equal(second.posts.length, 6)
  assert.ok([...first.posts, ...second.posts].every(row => row.source_bucket === 'following'))
})

test('cold start uses deterministic engagement and recency rather than empty affinity', async () => {
  const context = fixture({ posts: [post('old'), post('fresh', { created_at: '2026-10-08T11:00:00Z' }), post('popular')], counts: { popular: 1 } })
  const result = await getFeed(context)
  assert.deepEqual(ids(result.posts), ['popular', 'fresh', 'old'])
  assert.deepEqual(result.posts.map(row => row.feed_score), [9, 8, 5])
  assert.ok(result.posts.every(row => row.source_bucket === 'trending'))
  assert.deepEqual(result.summary.topInterestCategories, [])
})

test('sparse and missing category metadata keeps public content available with fallback scores', async () => {
  const context = fixture({ posts: [post('no-category', { post_categories: [] }), post('missing-join', { post_categories: [{ category_id: 'gone', categories: null }] })], preferences: ['travel'] })
  const result = await getFeed(context)
  assert.deepEqual(ids(result.posts), ['missing-join', 'no-category'])
  assert.deepEqual(result.posts.map(row => row.feed_score), [5, 5])
  assert.ok(result.posts.every(row => row.source_bucket === 'trending'))
})

for (const [table, actionFile, actionName, stateKey, weight] of [
  ['likes', 'actions/likes.ts', 'toggleLikeInline', 'liked', 3],
  ['saves', 'actions/saves.ts', 'toggleSaveInline', 'saved', 5],
]) {
  test(`${table}: actual mutation influences later category scores; duplicate retry and undo are consistent`, async () => {
    const context = fixture({ posts: [post('a-travel', { post_categories: [category('travel')] }), post('b-cooking'), post('history')], hidden: ['history'] })
    const action = load(actionFile, context)[actionName]
    const input = { postId: 'history', devProfileId: 'untrusted-client-id', [stateKey]: false }
    assert.deepEqual(ids((await getFeed(context)).posts), ['a-travel', 'b-cooking'])
    assert.deepEqual(await action(input), { ok: true, [stateKey]: true })
    const after = await getFeed(context)
    assert.deepEqual(ids(after.posts), ['b-cooking', 'a-travel'])
    assert.equal(after.posts[0].feed_score, 5 + weight)
    assert.equal(after.posts[0].source_bucket, 'interest')
    assert.equal(after.posts[1].feed_score, 5)
    assert.deepEqual(await action(input), { ok: true, [stateKey]: true })
    const retried = await getFeed(context)
    assert.equal(retried.posts[0].feed_score, after.posts[0].feed_score)
    assert.equal(context.state[table].length, 1)
    assert.deepEqual(await action({ ...input, [stateKey]: true }), { ok: true, [stateKey]: false })
    const undone = await getFeed(context)
    assert.deepEqual(ids(undone.posts), ['a-travel', 'b-cooking'])
    assert.deepEqual(undone.posts.map(row => row.feed_score), [5, 5])
    assert.equal(context.state[table].length, 0)
    assert.ok(context.invalidations.includes('/feed'))
  })
}

test('likes, saves and explicit preferences add without replacing their established weights', async () => {
  const context = fixture({ posts: [post('candidate'), post('history')], hidden: ['history'], preferences: ['cooking'],
    likes: [{ post_id: 'history', profile_id: viewer }], saves: [{ post_id: 'history', profile_id: viewer }] })
  const result = await getFeed(context)
  assert.equal(result.posts[0].feed_score, 5 + 8 + 3 + 5)
  assert.deepEqual(result.summary.topInterestCategories.map(row => row.slug), ['cooking'])
})

test('private save identities are not returned while count-only totals still influence ranking', async () => {
  const context = fixture({ posts: [post('popular'), post('mine')], counts: { popular: 10, mine: 1 },
    saves: [{ post_id: 'mine', profile_id: viewer }, { post_id: 'popular', profile_id: 'private-saver' }] })
  const result = await getFeed(context)
  assert.deepEqual(ids(result.posts), ['popular', 'mine'])
  assert.deepEqual(result.posts.map(row => row.save_count), [10, 1])
  assert.deepEqual(result.posts.map(row => row.saved_by_me), [false, true])
  assert.equal(JSON.stringify(result).includes('private-saver'), false)
  assert.ok(result.posts.every(row => !('saves' in row)))
  const saveQuery = context.calls.find(call => call.table === 'saves')
  assert.ok(saveQuery.filters.some(([op, key, value]) => op === 'eq' && key === 'profile_id' && value === viewer))
})
