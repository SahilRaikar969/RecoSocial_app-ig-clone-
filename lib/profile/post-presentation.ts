import type { CategoryJoin } from '@/lib/db/query-types'
import { getMediaUrl } from '@/lib/media/get-media-url'

type CategorizedPost = { post_categories?: CategoryJoin[] }
type PostMediaPaths = { media_path: string; thumbnail_path?: string | null }

export function buildCategoryHighlights(posts: readonly CategorizedPost[]) {
  const counts = new Map<string, { slug: string; name: string; count: number }>()
  for (const post of posts) {
    for (const item of post.post_categories ?? []) {
      const category = Array.isArray(item.categories) ? item.categories[0] : item.categories
      if (!category?.slug || !category.name) continue
      counts.set(category.slug, {
        slug: category.slug,
        name: category.name,
        count: (counts.get(category.slug)?.count ?? 0) + 1,
      })
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
}

export function resolvePostsWithMedia<T extends readonly PostMediaPaths[]>(posts: T) {
  return Promise.all(posts.map(async (post: T[number]) => ({
    ...post,
    resolved_media_url: await getMediaUrl(post.media_path),
    resolved_thumbnail_url: await getMediaUrl(post.thumbnail_path ?? null),
  })))
}
