import { toggleLike } from '@/actions/interactions'
import { SaveButton } from '@/components/feed/save-button'

export function FeedActions({
  postId,
  devProfileId,
  liked,
  likeCount,
  saved,
  saveCount,
}: {
  postId: string
  devProfileId: string
  liked: boolean
  likeCount: number
  saved: boolean
  saveCount: number
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <form action={toggleLike}>
        <input type="hidden" name="post_id" value={postId} />
        <input type="hidden" name="dev_profile_id" value={devProfileId} />
        <input type="hidden" name="liked" value={liked ? 'true' : 'false'} />

        <button
          type="submit"
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          {liked ? 'Unlike' : 'Like'}
        </button>
      </form>

      <span className="text-sm text-zinc-400">
        {likeCount} like{likeCount === 1 ? '' : 's'}
      </span>

      <SaveButton
        postId={postId}
        devProfileId={devProfileId}
        savedByMe={saved}
      />

      <span className="text-sm text-zinc-400">
        {saveCount} save{saveCount === 1 ? '' : 's'}
      </span>
    </div>
  )
}