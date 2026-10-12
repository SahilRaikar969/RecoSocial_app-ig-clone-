import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoDataset, demoId, DATASET_ID, DEFAULT_ANCHOR } from '../scripts/demo/dataset.mjs'
import { demoFeedFixture, rankedTopics, allDemoPages, demoAffinity } from './helpers/demo-feed-fixture.mjs'
import { ids, load } from './helpers/m3-feed-fixture.mjs'

const { scoreCandidate, diversify } = load('lib/recommendations/engine.ts')
const { compareFeedPosts } = load('lib/recommendations/feed-contract.ts')
const emptyAffinity = { categories: new Map(), creators: new Map() }
const countRepeats = (rows, key) => rows.slice(1).filter((row, index) => key(row) === key(rows[index])).length
const topic = post => post.post_categories[0].categories.slug
const historyId = demoId('post:health-fitness:12')
const candidateId = demoId('post:health-fitness:0')

test('demo corpus is deterministic, bounded, explicitly generated and has referentially valid taste graphs', () => {
  const dataset = createDemoDataset()
  assert.deepEqual(createDemoDataset(), dataset)
  assert.equal(dataset.version, DATASET_ID)
  assert.equal(dataset.anchor, DEFAULT_ANCHOR)
  assert.deepEqual(Object.fromEntries(['users', 'categories', 'posts', 'postCategories', 'follows', 'likes', 'saves', 'comments', 'preferences'].map(key => [key, dataset[key].length])), {
    users: 30, categories: 10, posts: 300, postCategories: 300, follows: 33, likes: 808, saves: 139, comments: 86, preferences: 33,
  })
  assert.equal(dataset.posts.filter(post => post.media_type === 'video').length, 60)
  const users = new Set(ids(dataset.users)), posts = new Set(ids(dataset.posts)), categories = new Set(ids(dataset.categories))
  assert.equal(users.size, 30); assert.equal(posts.size, 300)
  for (const user of dataset.users) {
    assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.match(user.username, /^demo_/); assert.match(user.display_name, /^Demo /)
    assert.match(user.bio, /Not a real person/); assert.match(user.email, /@recosocial\.invalid$/)
  }
  for (const post of dataset.posts) {
    assert.ok(users.has(post.author_id)); assert.match(post.caption, /^\[Demo\]/); assert.ok(post.created_at <= dataset.anchor)
    assert.equal(post.aspect_ratio, post.media_type === 'video' ? 2 / 3 : 0.8)
    assert.equal(post.duration_seconds, post.media_type === 'video' ? 2 : null)
  }
  for (const join of dataset.postCategories) assert.ok(posts.has(join.post_id) && categories.has(join.category_id))
  for (const row of [...dataset.likes, ...dataset.saves]) assert.ok(users.has(row.profile_id) && posts.has(row.post_id))
  for (const row of dataset.comments) assert.ok(users.has(row.author_id) && posts.has(row.post_id))
  for (const row of dataset.follows) assert.ok(users.has(row.follower_id) && users.has(row.following_id) && row.follower_id !== row.following_id)
  for (const row of dataset.preferences) assert.ok(users.has(row.profile_id) && categories.has(row.category_id))
  for (const rows of [dataset.likes, dataset.saves, dataset.comments]) {
    for (const row of rows) assert.ok(row.created_at >= dataset.posts.find(post => post.id === row.post_id).created_at && row.created_at <= dataset.anchor)
  }
  for (const [rows, key] of [
    [dataset.likes, row => `${row.profile_id}:${row.post_id}`],
    [dataset.saves, row => `${row.profile_id}:${row.post_id}`],
    [dataset.follows, row => `${row.follower_id}:${row.following_id}`],
    [dataset.preferences, row => `${row.profile_id}:${row.category_id}`],
    [dataset.postCategories, row => `${row.post_id}:${row.category_id}`],
    [dataset.comments, row => row.id],
  ]) assert.equal(new Set(rows.map(key)).size, rows.length)
})

test('the real feed query uses exactly 8 candidates per category from the seed corpus; guests read no private tables', async () => {
  const context = demoFeedFixture(null)
  const rows = await allDemoPages(context)
  assert.equal(rows.length, 80)
  assert.deepEqual(Object.fromEntries(context.dataset.categories.map(category => [category.slug, rows.filter(row => topic(row) === category.slug).length])), Object.fromEntries(context.dataset.categories.map(category => [category.slug, 8])))
  assert.ok(context.calls.every(call => ['posts', 'rpc'].includes(call.table)))
  assert.ok(rows.every(row => !row.saved_by_me && !row.liked_by_me))
})

test('fitness, travel, gaming/tech and mixed personas receive distinct relevant feeds with bounded candidate exploration', async () => {
  const feeds = {}
  for (const persona of ['fitness', 'travel', 'gaming-tech', 'mixed', 'cold-start']) feeds[persona] = (await demoFeedFixture(persona).feed()).posts
  assert.equal(rankedTopics(feeds.fitness.slice(0, 12)).filter(slug => slug === 'health-fitness').length, 8)
  assert.equal(rankedTopics(feeds.travel.slice(0, 12)).filter(slug => slug === 'travel').length, 8)
  assert.equal(new Set(rankedTopics(feeds.fitness.slice(0, 12))).size, 5)
  assert.equal(new Set(rankedTopics(feeds.travel.slice(0, 12))).size, 5)
  assert.deepEqual(new Set(rankedTopics(feeds['gaming-tech'].slice(0, 12))), new Set(['gaming', 'technology']))
  assert.deepEqual(new Set(rankedTopics(feeds.mixed.slice(0, 12))), new Set(['travel', 'food', 'photography', 'music']))
  assert.equal(new Set(Object.values(feeds).map(rows => ids(rows).join(','))).size, 5)
})

test('cold-start persona has no outgoing signals or preferences and receives non-empty cross-category ranking', async () => {
  const context = demoFeedFixture('cold-start'), dataset = context.dataset, viewer = context.viewer
  assert.equal(dataset.likes.filter(row => row.profile_id === viewer).length, 0)
  assert.equal(dataset.saves.filter(row => row.profile_id === viewer).length, 0)
  assert.equal(dataset.comments.filter(row => row.author_id === viewer).length, 0)
  assert.equal(dataset.follows.filter(row => row.follower_id === viewer).length, 0)
  assert.equal(dataset.preferences.filter(row => row.profile_id === viewer).length, 0)
  const result = await context.feed()
  assert.equal(result.posts.length, 24)
  assert.equal(new Set(rankedTopics(result.posts)).size, 10)
  assert.ok(result.posts.every(row => row.source_bucket === 'trending' && row.reason_labels.length === 0))
  assert.equal(demoAffinity(context).categories.size, 0)
})

test('selected interest alone increases relevant candidate scores without requiring an interaction history', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  const category = context.dataset.categories.find(row => row.slug === 'health-fitness')
  context.state.profile_category_preferences.push({ profile_id: context.viewer, category_id: category.id, categories: category })
  const after = await allDemoPages(context)
  for (const post of after) assert.ok(Math.abs(post.feed_score - before.find(row => row.id === post.id).feed_score - (topic(post) === category.slug ? 8 : 0)) < 1e-10)
  assert.ok(rankedTopics(after.slice(0, 12)).filter(slug => slug === category.slug).length > rankedTopics(before.slice(0, 12)).filter(slug => slug === category.slug).length)
})

test('seed history creates bounded creator affinity that also transfers to a different topic by that creator', () => {
  const context = demoFeedFixture('fitness'), affinity = demoAffinity(context)
  const creatorId = context.state.posts.find(row => row.id === candidateId).author_id
  const input = { creatorId, categories: ['technology'], createdAt: context.dataset.anchor, likes: 0, saves: 0, comments: 0, followed: false }
  const learned = scoreCandidate(input, affinity, context.now)
  assert.ok(learned.creator > 0 && learned.creator <= 10)
  assert.equal(learned.interest, 0)
  assert.ok(learned.total > scoreCandidate({ ...input, creatorId: context.viewer }, affinity, context.now).total)
})

test('following a seed creator changes ranking and Following membership; removing it restores the original feed', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  const creatorId = context.state.posts.find(row => row.id === demoId('post:sports:0')).author_id
  context.state.follows.push({ follower_id: context.viewer, following_id: creatorId })
  const followed = await allDemoPages(context)
  for (const post of followed.filter(row => row.author_id === creatorId)) {
    assert.ok(Math.abs(post.feed_score - before.find(row => row.id === post.id).feed_score - 7) < 1e-10)
    assert.equal(post.source_bucket, 'following')
  }
  const following = await context.feed({ view: 'following' })
  assert.equal(following.posts.length, 15)
  assert.ok(following.posts.every(row => row.author_id === creatorId))
  context.state.follows = context.state.follows.filter(row => row.follower_id !== context.viewer)
  assert.deepEqual(await allDemoPages(context), before)
  assert.equal((await context.feed({ view: 'following' })).posts.length, 0)
})

test('a new like on older seed content predictably changes future candidate affinity; unlike removes the contribution', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  context.state.likes.push({ profile_id: context.viewer, post_id: historyId, created_at: context.dataset.anchor })
  const after = await allDemoPages(context)
  assert.ok(after.find(row => row.id === candidateId).feed_score > before.find(row => row.id === candidateId).feed_score)
  assert.notDeepEqual(ids(after), ids(before))
  assert.equal(after.find(row => row.id === candidateId).like_count, before.find(row => row.id === candidateId).like_count)
  context.state.likes = context.state.likes.filter(row => row.profile_id !== context.viewer)
  assert.deepEqual(await allDemoPages(context), before)
})

test('a new save changes future ranking more than a like on the same older seed post; unsave restores baseline', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  context.state.likes.push({ profile_id: context.viewer, post_id: historyId, created_at: context.dataset.anchor })
  const liked = (await allDemoPages(context)).find(row => row.id === candidateId)
  context.state.likes = context.state.likes.filter(row => row.profile_id !== context.viewer)
  context.state.saves.push({ profile_id: context.viewer, post_id: historyId, created_at: context.dataset.anchor })
  const saved = await allDemoPages(context)
  assert.ok(saved.find(row => row.id === candidateId).feed_score > liked.feed_score)
  assert.notDeepEqual(ids(saved), ids(before))
  context.state.saves = context.state.saves.filter(row => row.profile_id !== context.viewer)
  assert.deepEqual(await allDemoPages(context), before)
})

test('synthetic comments are actual affinity signals and deletion removes their contribution', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  context.state.comments.push({ id: demoId('test:comment'), author_id: context.viewer, post_id: historyId, body: '[Demo] Test comment', created_at: context.dataset.anchor })
  const after = await allDemoPages(context)
  assert.ok(after.find(row => row.id === candidateId).feed_score > before.find(row => row.id === candidateId).feed_score)
  context.state.comments = context.state.comments.filter(row => row.author_id !== context.viewer)
  assert.deepEqual(await allDemoPages(context), before)
})

test('actual seed ranking reranks diversity and reduces repeated creators without dropping or fabricating posts', async () => {
  const ranked = await allDemoPages(demoFeedFixture('fitness')), raw = [...ranked].sort(compareFeedPosts)
  assert.deepEqual(ids(diversify(raw)), ids(ranked))
  assert.notDeepEqual(ids(raw), ids(ranked))
  assert.ok(countRepeats(ranked, row => row.author_id) < countRepeats(raw, row => row.author_id))
  assert.deepEqual([...ids(ranked)].sort(), [...ids(raw)].sort())
})

test('mixed persona reduces adjacent category repetition; relevance guard honestly allows a strong single-topic run', async () => {
  const mixed = await allDemoPages(demoFeedFixture('mixed')), raw = [...mixed].sort(compareFeedPosts)
  assert.ok(countRepeats(mixed, topic) < countRepeats(raw, topic))
  const fitness = await allDemoPages(demoFeedFixture('fitness'))
  assert.equal(rankedTopics(fitness.slice(0, 8)).filter(slug => slug === 'health-fitness').length, 8)
  // This is not a hard topic quota. The production reranker cannot promote
  // candidates more than ten score points weaker just to satisfy a fixture.
  assert.ok(fitness[7].feed_score - fitness[8].feed_score > 10)
})

test('recency of seed timestamps increases score when engagement and affinity are held equal', () => {
  const context = demoFeedFixture('cold-start')
  const fresh = context.state.posts.find(row => row.id === candidateId)
  const old = context.state.posts.find(row => row.id === demoId('post:health-fitness:20'))
  const input = { creatorId: fresh.author_id, categories: ['health-fitness'], likes: 0, saves: 0, comments: 0, followed: false }
  const freshScore = scoreCandidate({ ...input, createdAt: fresh.created_at }, emptyAffinity, context.now)
  const oldScore = scoreCandidate({ ...input, createdAt: old.created_at }, emptyAffinity, context.now)
  assert.ok(freshScore.recency > oldScore.recency)
  assert.ok(freshScore.total > oldScore.total)
  assert.equal(freshScore.engagement, oldScore.engagement)
})

test('engagement from seed actors changes cold-start scoring without manufacturing viewer interests', async () => {
  const context = demoFeedFixture('cold-start'), before = await allDemoPages(context)
  const target = demoId('post:sports:7')
  const unused = context.dataset.users.filter(user => !context.state.likes.some(row => row.profile_id === user.id && row.post_id === target) && user.id !== context.viewer).slice(0, 5)
  for (const actor of unused) context.state.likes.push({ profile_id: actor.id, post_id: target, created_at: context.dataset.anchor })
  const after = await allDemoPages(context)
  assert.ok(after.find(row => row.id === target).feed_score > before.find(row => row.id === target).feed_score)
  assert.ok(ids(after).indexOf(target) < ids(before).indexOf(target))
  assert.equal(demoAffinity(context).categories.size, 0)
})

test('fixed corpus and clock give stable pagination with exactly 80 unique candidates across four pages', async () => {
  const context = demoFeedFixture('mixed')
  const pages = await Promise.all([1, 2, 3, 4].map(page => context.feed({ page, candidateBefore: context.now })))
  assert.deepEqual(pages.map(page => page.posts.length), [24, 24, 24, 8])
  const first = pages.flatMap(page => page.posts)
  assert.equal(new Set(ids(first)).size, 80)
  assert.deepEqual(await allDemoPages(context, { candidateBefore: context.now }), first)
  const candidates = context.state.posts.slice().sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).slice(0, 80)
  assert.deepEqual([...ids(first)].sort(), [...ids(candidates)].sort())
})
