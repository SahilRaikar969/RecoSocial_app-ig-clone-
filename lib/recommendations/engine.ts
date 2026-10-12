/** Deterministic, bounded heuristics over current interactions; no inferred views/watch time. */
export const SIGNAL_LIMIT = 200
export const SIGNAL_DAYS = 180
const DAY = 86_400_000
export type InterestEvent = { kind: 'like' | 'save' | 'comment'; postId: string; creatorId: string; categories: string[]; at: string }
export type Affinity = { categories: Map<string, number>; creators: Map<string, number> }
export function decay(at: string, now: number) {
  const timestamp = Date.parse(at)
  if (!Number.isFinite(timestamp) || timestamp > now) return 0
  const age = (now - timestamp) / DAY
  return age > SIGNAL_DAYS ? 0 : 2 ** (-age / 30)
}
export function buildAffinity(selected: readonly string[], events: readonly InterestEvent[], viewerId: string | null, now: number): Affinity {
  const categories = new Map<string, number>(), creators = new Map<string, number>()
  const newest = new Map<string, InterestEvent>()
  for (const event of events) {
    if (!event.postId || !event.creatorId || event.creatorId === viewerId || !decay(event.at, now)) continue
    const key = event.kind + ':' + event.postId
    const previous = newest.get(key)
    if (!previous || Date.parse(event.at) > Date.parse(previous.at)) newest.set(key, event)
  }
  for (const event of newest.values()) {
    const weight = ({ like: 3, save: 5, comment: 2 }[event.kind]) * decay(event.at, now)
    creators.set(event.creatorId, (creators.get(event.creatorId) ?? 0) + weight)
    const topics = [...new Set(event.categories.filter(Boolean))]
    // Tagging more topics cannot multiply one interaction's influence.
    for (const topic of topics) categories.set(topic, (categories.get(topic) ?? 0) + weight / topics.length)
  }
  for (const [topic, value] of categories) categories.set(topic, Math.min(16, 8 * Math.log2(1 + value / 8)))
  for (const topic of new Set(selected.filter(Boolean))) categories.set(topic, Math.min(24, 8 + (categories.get(topic) ?? 0)))
  for (const [creator, value] of creators) creators.set(creator, Math.min(10, 4 * Math.log2(1 + value / 4)))
  return { categories, creators }
}
export function scoreCandidate(input: { creatorId: string; categories: readonly string[]; createdAt: string; likes: number; saves: number; comments: number; followed: boolean }, affinity: Affinity, now: number) {
  const topicWeights = [...new Set(input.categories)].map(slug => affinity.categories.get(slug) ?? 0).sort((a,b) => b-a)
  const interest = Math.min(24, (topicWeights[0] ?? 0) + (topicWeights[1] ?? 0) * .25)
  const creator = affinity.creators.get(input.creatorId) ?? 0
  const engagementTotal = Math.max(0,input.likes)*2 + Math.max(0,input.saves)*4 + Math.max(0,input.comments)*3
  const engagement = Math.min(16, 4 * Math.log2(1 + engagementTotal / 4))
  const age = Math.max(0, (now - Date.parse(input.createdAt)) / DAY)
  const recency = Number.isFinite(age) ? 8 * 2 ** (-age / 3) : 0
  const relationship = input.followed ? 10 : 0
  const exploration = input.followed ? 0 : 3
  return { interest, creator, engagement, recency, relationship, exploration,
    total: interest + creator + engagement + recency + relationship + exploration }
}
type DiversePost = { id: string; author_id: string; feed_score: number; post_categories: Array<{categories: {slug: string} | null}> }
/** At most six nearby ranked candidates compete. Never promote a candidate >10 score points weaker. */
export function diversify<T extends DiversePost>(ranked: readonly T[]): T[] {
  const queue = [...ranked], result: T[] = []
  while (queue.length) {
    const head = queue[0]
    const recent = result.slice(-3)
    const adjusted = (post:T) => post.feed_score - recent.filter(p=>p.author_id===post.author_id).length*6 - recent.filter(p=>p.post_categories[0]?.categories?.slug && p.post_categories[0]?.categories?.slug===post.post_categories[0]?.categories?.slug).length*2
    let best = 0
    for (let index=1; index<Math.min(6,queue.length); index++) {
      if (head.feed_score-queue[index].feed_score>10) continue
      if (adjusted(queue[index])>adjusted(queue[best])) best=index
    }
    result.push(queue.splice(best,1)[0])
  }
  return result
}
