import { createHash } from 'node:crypto'

export const DATASET_ID = 'recosocial-demo-v1'
export const DEFAULT_ANCHOR = '2026-10-12T12:00:00.000Z'

const TOPICS = [
  ['health-fitness', 'Fitness'], ['travel', 'Travel'], ['gaming', 'Gaming'],
  ['technology', 'Technology'], ['cars-bikes', 'Cars'], ['food', 'Food'],
  ['fashion', 'Fashion'], ['photography', 'Photography'], ['music', 'Music'], ['sports', 'Sports'],
]
const TASTES = [
  ['fitness', ['health-fitness']], ['travel', ['travel']],
  ['gaming-tech', ['gaming', 'technology']], ['cars', ['cars-bikes']],
  ['food', ['food']], ['fashion', ['fashion']],
  ['mixed', ['travel', 'food', 'photography', 'music']], ['cold-start', []],
  ['music', ['music']], ['sports', ['sports']],
]

/** Stable UUIDs identify this version's generated rows; no random or real user data. */
export function demoId(key) {
  const bytes = createHash('sha256').update(`${DATASET_ID}:${key}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Pure, bounded data generation. This module never connects to a database.
 * A caller can choose an explicit anchor; the default is fixed for reproducible tests.
 */
export function createDemoDataset({ anchor = DEFAULT_ANCHOR, mediaOrigin = 'http://127.0.0.1:3000' } = {}) {
  const timestamp = Date.parse(anchor)
  if (!Number.isFinite(timestamp)) throw new Error('Demo anchor must be a valid date.')
  const origin = new URL(mediaOrigin)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Demo media origin must be an HTTP(S) origin without credentials, path, query, or fragment.')
  }
  const normalizedAnchor = new Date(timestamp).toISOString()
  const mediaRoot = `${origin.origin}/demo/recosocial-v1`
  const at = milliseconds => new Date(timestamp - milliseconds).toISOString()
  const categories = TOPICS.map(([slug, name]) => ({ id: demoId(`category:${slug}`), name, slug }))
  const users = [], posts = [], postCategories = [], follows = [], likes = [], saves = [], comments = [], preferences = []
  const personas = {}
  const addUser = (key, label, persona) => {
    const user = {
      id: demoId(`user:${key}`), email: `${key}@recosocial.invalid`,
      username: `demo_${key.replaceAll('-', '_')}`, display_name: `Demo ${label}`,
      bio: `Generated demo account for RecoSocial testing. Not a real person. Dataset: ${DATASET_ID}.`, persona,
    }
    users.push(user)
    return user
  }
  const creators = new Map()
  for (const topic of categories) {
    const pair = [1, 2].map(index => addUser(`creator-${topic.slug}-${index}`, `${topic.name} Creator ${index}`, `creator:${topic.slug}`))
    creators.set(topic.slug, pair)
    for (const user of pair) preferences.push({ profile_id: user.id, category_id: topic.id })
  }
  const creatorUsers = [...users]
  for (const [key, topics] of TASTES) {
    const user = addUser(`viewer-${key}`, `${key.replaceAll('-', ' ')} Viewer`, key)
    personas[key] = user.id
    for (const slug of topics) {
      preferences.push({ profile_id: user.id, category_id: categories.find(topic => topic.slug === slug).id })
      follows.push({ follower_id: user.id, following_id: creators.get(slug)[0].id, created_at: at(20 * 86_400_000) })
    }
  }
  // One cross-topic follow per creator gives public profiles a small social graph.
  for (let index = 0; index < creatorUsers.length; index++) {
    follows.push({ follower_id: creatorUsers[index].id, following_id: creatorUsers[(index + 3) % creatorUsers.length].id, created_at: at(20 * 86_400_000) })
  }
  // Interleave categories in time: the newest 80 contain exactly 8 per category.
  for (let round = 0; round < 30; round++) {
    for (const [topicIndex, topic] of categories.entries()) {
      const author = creators.get(topic.slug)[round % 2]
      const id = demoId(`post:${topic.slug}:${round}`)
      const createdAt = at(3_600_000 + round * 6 * 3_600_000 + topicIndex * 900_000)
      const isVideo = round % 5 === 4
      posts.push({
        id, author_id: author.id, caption: `[Demo] ${topic.name} study ${String(round + 1).padStart(2, '0')} — generated visual fixture for recommendation testing.`,
        media_type: isVideo ? 'video' : 'image', media_path: `${mediaRoot}/${isVideo ? 'loop.webm' : `${topic.slug}.svg`}`,
        thumbnail_path: `${mediaRoot}/${topic.slug}.svg`, duration_seconds: isVideo ? 2 : null,
        aspect_ratio: isVideo ? 2 / 3 : 0.8, status: 'published', visibility: 'public', created_at: createdAt, updated_at: createdAt,
      })
      postCategories.push({ post_id: id, category_id: topic.id })
      // Balanced engagement differs by age round, not by category or target persona.
      for (let offset = 0; offset < 1 + round % 4; offset++) {
        const actor = creatorUsers[(topicIndex * 2 + 3 + offset) % creatorUsers.length]
        likes.push({ profile_id: actor.id, post_id: id, created_at: at(1_800_000 + round * 300_000 + offset * 1000) })
      }
      if (round % 3 === 0) saves.push({ profile_id: creatorUsers[(topicIndex * 2 + 8) % creatorUsers.length].id, post_id: id, created_at: at(1_200_000 + round * 300_000) })
      if (round % 5 === 0) comments.push({ id: demoId(`comment:community:${id}`), post_id: id, author_id: creatorUsers[(topicIndex * 2 + 11) % creatorUsers.length].id, body: '[Demo] Generated discussion fixture; no real user activity.', created_at: at(900_000 + round * 300_000) })
    }
  }
  // Viewer histories use older posts outside the current 80 candidates. They
  // deliberately span both category creators, with stronger first-creator affinity.
  for (const [key, topics] of TASTES) {
    const profileId = personas[key]
    for (const slug of topics) {
      for (let index = 0; index < 6; index++) {
        const round = 12 + index
        const postId = demoId(`post:${slug}:${round}`)
        const createdAt = at((index + 1) * 3_600_000)
        likes.push({ profile_id: profileId, post_id: postId, created_at: createdAt })
        if (index % 2 === 0) saves.push({ profile_id: profileId, post_id: postId, created_at: createdAt })
        if (index === 0 || index === 2) comments.push({ id: demoId(`comment:persona:${key}:${slug}:${index}`), post_id: postId, author_id: profileId, body: `[Demo] Synthetic ${key} interest signal for ${slug}.`, created_at: createdAt })
      }
    }
  }
  return { version: DATASET_ID, anchor: normalizedAnchor, mediaOrigin: origin.origin, users, categories, posts, postCategories, follows, likes, saves, comments, preferences, personas }
}
