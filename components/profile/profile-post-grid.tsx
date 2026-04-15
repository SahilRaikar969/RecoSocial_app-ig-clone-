import Link from 'next/link'
import { Bookmark, Heart, MessageCircle, Play } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
import { getMediaUrl } from '@/lib/media/get-media-url'
import { buildPostOpenHref } from '@/lib/routes/media-links'

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
  emptyTitle = 'No posts yet',
  emptyBody = 'Published posts will appear here.',
}: ProfilePostGridProps) {
  if (!posts.length) {
    return (
      <section className="pt-2">
        <div className="relative overflow-hidden rounded-[30px] border border-dashed border-zinc-800 bg-black px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_28%)]" />

          <div className="relative">
            <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
              Grid empty
            </div>

            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
              {emptyTitle}
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-300">
              {emptyBody}
            </p>
          </div>
        </div>
      </section>
    )
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
    <section className="pt-2">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
            Grid
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Visual post grid
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
            Fast scan, stronger media-first browsing, and quicker re-entry into posts or reels.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">
            {resolvedPosts.length} posts
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {resolvedPosts.map((post) => {
          const previewUrl =
            post.media_type === 'video'
              ? post.resolvedThumbnailUrl || post.resolvedMediaUrl
              : post.resolvedMediaUrl

          const href = buildPostOpenHref({
            postId: post.id,
            mediaType: post.media_type,
            source: 'profile',
            profileId: post.author_id || null,
          })

          return (
            <Link
              key={post.id}
              href={href}
              className="group relative block overflow-hidden rounded-[18px] border border-zinc-900 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_14px_36px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_22px_60px_rgba(0,0,0,0.34)]"
            >
              <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_top_left,rgba(120,119,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_26%)] opacity-80" />

              <SmartImage
                src={previewUrl}
                alt={post.caption || 'Post preview'}
                className="aspect-square w-full transition duration-500 group-hover:scale-[1.05]"
                fallbackClassName="flex aspect-square w-full items-center justify-center bg-zinc-950 text-[10px] uppercase tracking-[0.16em] text-zinc-500"
                fallbackText="Media"
              />

              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-black/12 to-transparent opacity-100" />

              <div className="pointer-events-none absolute left-2.5 top-2.5 z-[3] flex items-center gap-1.5">
                {post.media_type === 'video' ? (
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                    <Play className="h-3 w-3 fill-current" />
                    Reel
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                    Post
                  </div>
                )}
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] p-2">
                <div className="rounded-2xl border border-white/10 bg-black/62 p-2 backdrop-blur transition duration-300 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                  {post.caption ? (
                    <p className="mb-2 line-clamp-2 text-[10px] leading-4 text-zinc-100">
                      {post.caption}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-1">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-white">
                      <Heart className="h-3.5 w-3.5" />
                      <span>{formatCompactNumber(post.like_count)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-white">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{formatCompactNumber(post.comment_count)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-white">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>{formatCompactNumber(post.save_count)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}