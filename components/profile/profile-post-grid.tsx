import { NavigationLink as Link } from '@/components/ui/navigation-link'
import { Bookmark, Heart, MessageCircle, Play } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { buildPostOpenHref, type MediaOpenContext } from '@/lib/routes/media-links'

type ProfilePost = {
  id: string
  author_id?: string
  caption?: string | null
  media_type: string
  media_path: string
  thumbnail_path?: string | null
  like_count?: number
  comment_count?: number
  save_count?: number
  resolved_media_url?: string | null
  resolved_thumbnail_url?: string | null
}

type ProfilePostGridProps = {
  posts: ProfilePost[]
  openContext?: MediaOpenContext
  emptyTitle?: string
  emptyBody?: string
}

function formatCompactNumber(value?: number) {
  const safeValue = Number(value || 0)

  if (safeValue >= 1_000_000) {
    return `${(safeValue / 1_000_000).toFixed(safeValue >= 10_000_000 ? 0 : 1)}M`
  }

  if (safeValue >= 1_000) {
    return `${(safeValue / 1_000).toFixed(safeValue >= 10_000 ? 0 : 1)}K`
  }

  return String(safeValue)
}

export async function ProfilePostGrid({
  posts,
  openContext,
  emptyTitle = 'No posts yet',
  emptyBody = 'Published posts will appear here.',
}: ProfilePostGridProps) {
  if (!posts.length) {
    return <section className="rounded-xl border border-dashed border-zinc-700 px-5 py-10 text-center">
      <h2 className="text-lg font-semibold text-white">{emptyTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{emptyBody}</p>
    </section>
  }

  const resolvedPosts = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      resolvedMediaUrl:
        post.resolved_media_url ?? (await getMediaUrl(post.media_path)),
      resolvedThumbnailUrl:
        post.resolved_thumbnail_url ??
        (await getMediaUrl(post.thumbnail_path ?? null)),
    }))
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {resolvedPosts.map(post => {
        const previewUrl = post.media_type === 'video' ? post.resolvedThumbnailUrl : post.resolvedMediaUrl
        const href = buildPostOpenHref({
          postId: post.id,
          mediaType: post.media_type,
          source: 'profile',
          profileId: post.author_id || null,
          ...openContext,
        })
        return <Link key={post.id} href={href}
          aria-label={(post.media_type === 'video' ? 'Watch reel: ' : 'Open post: ') + (post.caption || 'Untitled post')}
          className="group min-w-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600 focus-visible:border-violet-400">
          <div className="relative">
            <SmartImage src={previewUrl} alt={post.caption || 'Post preview'}
              className="aspect-square w-full object-cover"
              fallbackClassName="flex aspect-square w-full items-center justify-center bg-zinc-900 text-sm text-zinc-400"
              fallbackText={post.media_type === 'video' ? 'Watch reel' : 'Image unavailable'} />
            {post.media_type === 'video' ? <span className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white" aria-hidden="true"><Play className="h-4 w-4 fill-current" /></span> : null}
          </div>
          <div className="px-2 py-2 sm:px-3">
            {post.caption ? <p className="mb-2 line-clamp-2 break-words text-sm leading-5 text-zinc-200">{post.caption}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400" aria-hidden="true">
              <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatCompactNumber(post.like_count)}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{formatCompactNumber(post.comment_count)}</span>
              <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{formatCompactNumber(post.save_count)}</span>
            </div>
            <span className="sr-only">{post.like_count ?? 0} likes, {post.comment_count ?? 0} comments, {post.save_count ?? 0} saves</span>
          </div>
        </Link>
      })}
    </div>
  )
}
