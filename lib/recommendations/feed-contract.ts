/** For You preserves the engine’s bounded diversity order. Following is a filtered view, never a prefix. */
export type FeedView = 'for-you' | 'following'
export type FeedBucket = 'following' | 'interest' | 'trending'
export const FEED_PAGE_SIZE = 24
export const FEED_CANDIDATE_LIMIT = 80

type RankedPost = { id: string; feed_score: number; save_count: number; comment_count: number; created_at: string }
export function compareFeedPosts(a: RankedPost, b: RankedPost) {
  return b.feed_score - a.feed_score || b.save_count - a.save_count ||
    b.comment_count - a.comment_count || Date.parse(b.created_at) - Date.parse(a.created_at) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Slice only after ranking and membership filtering. First occurrence wins; input is never mutated.
 * Pages are stable for unchanged candidates/signals/time. A refresh is a new ranking, not a snapshot cursor.
 */
export function selectFeedPage<T extends { id: string; source_bucket: FeedBucket }>(
  ranked: readonly T[], view: FeedView = 'for-you', requestedPage = 1, pageSize = FEED_PAGE_SIZE
) {
  const seen = new Set<string>()
  const eligible = ranked.filter(post => {
    if (view === 'following' && post.source_bucket !== 'following') return false
    if (seen.has(post.id)) return false
    seen.add(post.id)
    return true
  })
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : FEED_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(eligible.length / size))
  const page = Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1))
  return { posts: eligible.slice((page - 1) * size, page * size), page, pageCount, total: eligible.length }
}

/** Keep candidate recency and new candidate insertion fixed during a short paging journey.
 * Current interactions, their decay, removals and authorization still apply; this is not a stored ranking snapshot.
 */
export function feedRankingTime(value: string | undefined, now = Date.now()) {
  const parsed = Number(value)
  return value && Number.isSafeInteger(parsed) && parsed <= now && parsed >= now - 30 * 60_000 ? parsed : now
}
