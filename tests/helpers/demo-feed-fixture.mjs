import { createDemoDataset } from '../../scripts/demo/dataset.mjs'
import { fixture, getFeed, load } from './m3-feed-fixture.mjs'

/** Map the actual seed corpus into the existing relational query harness. */
export function demoFeedFixture(persona = 'cold-start', dataset = createDemoDataset()) {
  const profileId = persona === null ? null : dataset.personas[persona]
  if (persona !== null && !profileId) throw new Error(`Unknown demo persona: ${persona}`)
  const profiles = dataset.users.map(({ id, username, display_name }) => ({ id, username, display_name, avatar_url: null }))
  const posts = dataset.posts.map(post => ({
    ...post, profiles: profiles.find(profile => profile.id === post.author_id), likes: [], saves: [], comments: [],
    post_categories: dataset.postCategories.filter(join => join.post_id === post.id).map(join => ({ ...join, categories: dataset.categories.find(topic => topic.id === join.category_id) })),
  }))
  const context = fixture({ posts, profiles, profileId, likes: dataset.likes, saves: dataset.saves })
  context.state.comments = structuredClone(dataset.comments)
  context.state.follows = structuredClone(dataset.follows)
  context.state.profile_category_preferences = dataset.preferences.map(join => ({ ...join, categories: dataset.categories.find(topic => topic.id === join.category_id) }))
  const now = Date.parse(dataset.anchor)
  return { ...context, dataset, now, feed: options => getFeed(context, { now, ...options }) }
}

export function rankedTopics(posts) { return posts.map(post => post.post_categories[0].categories.slug) }

export function allDemoPages(context, options = {}) {
  return Promise.all([1, 2, 3, 4].map(page => context.feed({ ...options, page }))).then(pages => pages.flatMap(page => page.posts))
}

export function demoAffinity(context) {
  const { buildAffinity } = load('lib/recommendations/engine.ts')
  const categories = postId => context.state.posts.find(post => post.id === postId)?.post_categories.map(join => join.categories.slug) ?? []
  const selected = context.state.profile_category_preferences.filter(row => row.profile_id === context.viewer).map(row => row.categories.slug)
  const events = [['like', context.state.likes], ['save', context.state.saves], ['comment', context.state.comments]].flatMap(([kind, rows]) => rows.filter(row => (row.profile_id ?? row.author_id) === context.viewer).map(row => ({
    kind, postId: row.post_id, creatorId: context.state.posts.find(post => post.id === row.post_id).author_id,
    categories: categories(row.post_id), at: row.created_at,
  })))
  return buildAffinity(selected, events, context.viewer, context.now)
}
