import Link from 'next/link'
import { unhidePost } from '@/actions/post-moderation'
import { PostCard, type PostCardPost } from '@/components/feed/post-card'
import { getViewerPostModerationStates } from '@/lib/db/queries/post-moderation'

type HiddenPostGridProps = {
  posts: PostCardPost[]
  devProfileId: string
  returnTo: string
}

export async function HiddenPostGrid({
  posts,
  devProfileId,
  returnTo,
}: HiddenPostGridProps) {
  const moderationStates = await getViewerPostModerationStates(
    devProfileId,
    posts.filter(post => post.author_id !== devProfileId).map(post => String(post.id))
  )
  return (
    <div className="space-y-6">
      {posts.map((post) => {
        const authorId = String(post?.author?.id || post?.author_id || '').trim()
        const authorHref = authorId === devProfileId ? '/profile' : `/profile/${authorId}`

        return (
          <section
            key={post.id}
            className="overflow-hidden rounded-xl border border-zinc-800/90 bg-black"
          >
            <div className="border-b border-zinc-800/80 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Hidden post
                  </div>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                    Hidden from your feed and Explore.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={authorHref}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    View profile
                  </Link>

                  <Link
                    href={`/post/${post.id}`}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Open post
                  </Link>

                  <form action={unhidePost}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <input type="hidden" name="dev_profile_id" value={devProfileId} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-lg border border-white bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      Restore post
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <PostCard
                post={post}
                devProfileId={devProfileId}
                returnTo={returnTo}
                moderationState={moderationStates.get(post.id)}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}